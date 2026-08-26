#!/usr/bin/env python3
"""PROTOTYPE ONLY: identify Spectre's de-emphasis and DC-filter ordering.

Question: with the previously locked JUCE Good wrapper and recovered bell/shaper
laws held fixed, does Spectre DC-block the complete shaped-minus-bell residue, or
does it condition the shaped path and subtract the unprocessed bell afterward?

Spectre exposes a binary De-Emphasis switch.  Its disabled and enabled renders
are the only black-box endpoints.  Cosimo's 25/50/75 percent targets are defined
as exact affine interpolation between those measured endpoints.
"""

from __future__ import annotations

import hashlib
import json
import math
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
from scipy import optimize
from scipy.signal import lfilter

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import measure_spectre_enhancer_uncertainty as uncertainty  # noqa: E402
import measure_spectre_reference as reference  # noqa: E402
import run as wrapper  # noqa: E402

SAMPLE_RATE = 48_000
RESULT_ROOT = REPO_ROOT / "build" / "t26-deemphasis-prototype"
LISTENING_ROOT = RESULT_ROOT / "listening"
REPORT_PATH = RESULT_ROOT / "report.json"
WRAPPER_REPORT_PATH = (
    REPO_ROOT / "build" / "t26-wrapper-prototype" / "results" / "report.json"
)
WINNER = wrapper.Candidate(
    id="fir-maximum-fractional",
    filter_type="fir",
    maximum_quality=True,
    integer_latency=False,
)
HOST_ADVANCE_SAMPLES = 60.0
DE_EMPHASIS_VALUES = (0.0, 0.25, 0.5, 0.75, 1.0)
LISTENING_VALUES = (0.0, 0.5, 1.0)
ANALYSIS_FLOOR = 1.0e-30


@dataclass(frozen=True)
class ToneCase:
    id: str
    frequency_hz: float
    q: float
    gain_db: float
    input_dbfs: float
    mode: str
    color: str


TRAINING_CASES = tuple(
    ToneCase(
        id=f"train-medium-solid-{frequency_hz:g}",
        frequency_hz=frequency_hz,
        q=0.71,
        gain_db=12.0,
        input_dbfs=-12.0,
        mode="Medium",
        color="Solid",
    )
    for frequency_hz in (31.0, 53.0, 89.0, 149.0, 251.0, 503.0, 997.0)
)

HELD_OUT_CASES = (
    *(
        ToneCase(
            id=f"held-100-{mode.lower()}-{color.lower()}",
            frequency_hz=100.0,
            q=0.71,
            gain_db=12.0,
            input_dbfs=-12.0,
            mode=mode,
            color=color,
        )
        for mode in ("Subtle", "Medium")
        for color in ("Solid", "Tube")
    ),
    *(
        ToneCase(
            id=f"held-997-{mode.lower()}-{color.lower()}",
            frequency_hz=997.0,
            q=0.71,
            gain_db=12.0,
            input_dbfs=-12.0,
            mode=mode,
            color=color,
        )
        for mode in ("Subtle", "Medium")
        for color in ("Solid", "Tube")
    ),
    ToneCase("held-low-wide", 43.0, 0.35, 6.0, -18.0, "Subtle", "Tube"),
    ToneCase("held-low-narrow", 233.0, 2.0, 9.0, -6.0, "Medium", "Solid"),
    ToneCase("held-mid-low-drive", 4_001.0, 1.5, 3.0, -24.0, "Medium", "Tube"),
    ToneCase("held-air-high-q", 11_987.0, 8.0, 6.0, -18.0, "Subtle", "Solid"),
)

MUSICAL_BANDS = (
    {"frequency_hz": 130.0, "q": 0.71, "amount": 0.75, "color": "Solid"},
    {"frequency_hz": 9_000.0, "q": 0.71, "amount": 0.75, "color": "Tube"},
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_output(*arguments: str) -> str:
    return subprocess.run(
        ["git", *arguments],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def db_power_ratio(value: float) -> float:
    return 10.0 ** (value / 10.0)


def power_ratio_db(value: float) -> float:
    return 10.0 * math.log10(max(value, ANALYSIS_FLOOR))


def normalized_error_power(target: np.ndarray, candidate: np.ndarray) -> float:
    target64 = target.astype(np.float64)
    error = candidate.astype(np.float64) - target64
    return float(
        np.sum(np.square(error))
        / max(float(np.sum(np.square(target64))), ANALYSIS_FLOOR)
    )


def dc_block(audio: np.ndarray, cutoff_hz: float) -> np.ndarray:
    if cutoff_hz <= 1.0e-9:
        return audio.astype(np.float64, copy=True)
    pole = math.exp(-2.0 * math.pi * cutoff_hz / SAMPLE_RATE)
    return lfilter(
        np.asarray((1.0, -1.0), dtype=np.float64),
        np.asarray((1.0, -pole), dtype=np.float64),
        audio.astype(np.float64),
        axis=-1,
    )


def biquad_highpass(
    audio: np.ndarray,
    cutoff_hz: float,
    q: float,
    gain_db: float = 0.0,
) -> np.ndarray:
    omega = 2.0 * math.pi * cutoff_hz / SAMPLE_RATE
    cosine = math.cos(omega)
    alpha = math.sin(omega) / (2.0 * q)
    a0 = 1.0 + alpha
    gain = reference.db_to_gain(gain_db)
    b0 = gain * (1.0 + cosine) * 0.5 / a0
    b1 = -gain * (1.0 + cosine) / a0
    b2 = b0
    a1 = -2.0 * cosine / a0
    a2 = (1.0 - alpha) / a0
    return lfilter(
        np.asarray((b0, b1, b2), dtype=np.float64),
        np.asarray((1.0, a1, a2), dtype=np.float64),
        audio.astype(np.float64),
        axis=-1,
    )


def apply_filter_fit(audio: np.ndarray, fit: dict[str, Any]) -> np.ndarray:
    if fit["model"] == "none":
        return audio.astype(np.float64, copy=True)
    if fit["model"] == "first-order-highpass":
        return reference.db_to_gain(float(fit.get("gain_db", 0.0))) * dc_block(
            audio, float(fit["cutoff_hz"])
        )
    if fit["model"] == "rbj-biquad-highpass":
        return biquad_highpass(
            audio,
            float(fit["cutoff_hz"]),
            float(fit["q"]),
            float(fit.get("gain_db", 0.0)),
        )
    raise ValueError(f"unknown filter model {fit['model']}")


def make_tone(case: ToneCase) -> tuple[np.ndarray, slice]:
    pre_frames = SAMPLE_RATE // 2
    tail_frames = SAMPLE_RATE // 4
    tone = reference.make_sine(
        SAMPLE_RATE,
        case.frequency_hz,
        case.input_dbfs,
        duration_seconds=2.0,
    )[0]
    mono = np.concatenate(
        (
            np.zeros(pre_frames, dtype=np.float32),
            tone,
            np.zeros(tail_frames, dtype=np.float32),
        )
    )
    measured = slice(pre_frames + SAMPLE_RATE, pre_frames + SAMPLE_RATE * 2)
    return mono, measured


def spectre_settings(case: ToneCase, enabled: bool, mix: float = 1.0) -> dict[str, Any]:
    return reference.one_peak_settings(
        frequency_hz=case.frequency_hz,
        gain_db=case.gain_db,
        q=case.q,
        color=case.color,
        mode=case.mode,
        quality="Good",
        de_emphasis=enabled,
        mix=mix,
    )


def render_spectre_endpoint(
    session: reference.SpectreSession,
    signal: np.ndarray,
    case: ToneCase,
    enabled: bool,
) -> tuple[np.ndarray, dict[str, dict[str, Any]]]:
    stereo = np.stack((signal, signal)).astype(np.float32)
    output, effective = session.process(
        stereo,
        SAMPLE_RATE,
        spectre_settings(case, enabled),
    )
    return output[0].astype(np.float64), effective


def render_candidate_components(
    signal: np.ndarray,
    case: ToneCase,
    tag: str,
) -> tuple[np.ndarray, np.ndarray, float]:
    shaped_raw, shaped_latency = wrapper.render_probe(
        signal,
        WINNER,
        frequency_hz=case.frequency_hz,
        q=case.q,
        gain_db=case.gain_db,
        mode=case.mode,
        color=case.color,
        de_emphasis=0.0,
        dc_cutoff_hz=0.0,
        tag=f"deemphasis-{tag}-shaped",
    )
    selected_raw, selected_latency = wrapper.render_probe(
        signal,
        WINNER,
        frequency_hz=case.frequency_hz,
        q=case.q,
        gain_db=case.gain_db,
        mode=case.mode,
        color="Clean",
        de_emphasis=0.0,
        dc_cutoff_hz=0.0,
        tag=f"deemphasis-{tag}-selected",
    )
    if abs(shaped_latency - selected_latency) > 1.0e-6:
        raise RuntimeError(f"component latency mismatch for {case.id}")
    return (
        wrapper.advance_signal(shaped_raw, HOST_ADVANCE_SAMPLES),
        wrapper.advance_signal(selected_raw, HOST_ADVANCE_SAMPLES),
        shaped_latency,
    )


def render_current_contribution(
    signal: np.ndarray,
    case: ToneCase,
    de_emphasis: float,
) -> np.ndarray:
    stereo = np.stack((signal, signal)).astype(np.float32)
    output = uncertainty.render_cosimo(
        stereo,
        (
            {
                "frequency_hz": case.frequency_hz,
                "q": case.q,
                "amount": case.gain_db / 12.0,
                "color": case.color,
            },
        ),
        saturation_mode=case.mode,
        de_emphasis=de_emphasis,
    )
    return output[0].astype(np.float64) - signal.astype(np.float64)


def capture_tone_case(
    session: reference.SpectreSession,
    case: ToneCase,
) -> dict[str, Any]:
    signal, measured = make_tone(case)
    off, off_effective = render_spectre_endpoint(session, signal, case, False)
    on, on_effective = render_spectre_endpoint(session, signal, case, True)
    shaped, selected, latency = render_candidate_components(signal, case, case.id)
    return {
        "case": case,
        "signal": signal,
        "measured": measured,
        "target_off": off,
        "target_on": on,
        "target_delta": off - on,
        "candidate_shaped": shaped,
        "candidate_selected": selected,
        "latency_samples": latency,
        "effective_de_emphasis": {
            "off": off_effective["de_emphasis"],
            "on": on_effective["de_emphasis"],
        },
    }


def fit_base_path(rows: list[dict[str, Any]]) -> dict[str, Any]:
    def score(candidate: dict[str, Any]) -> float:
        errors = []
        for row in rows:
            measured = row["measured"]
            target = row["target_off"][measured]
            rendered = apply_filter_fit(row["candidate_shaped"], candidate)[measured]
            errors.append(normalized_error_power(target, rendered))
        return float(np.mean(errors))

    no_filter_gain = optimize.minimize_scalar(
        lambda gain_db: score({"model": "first-order-highpass", "cutoff_hz": 0.0, "gain_db": gain_db}),
        bounds=(-1.0, 1.0),
        method="bounded",
    )
    none = {
        "model": "first-order-highpass",
        "cutoff_hz": 0.0,
        "gain_db": float(no_filter_gain.x),
    }
    one_pole_result = optimize.minimize(
        lambda values: score(
            {
                "model": "first-order-highpass",
                "cutoff_hz": float(values[0]),
                "gain_db": float(values[1]),
            }
        ),
        np.asarray((30.0, 0.0)),
        method="Nelder-Mead",
        bounds=((0.0, 80.0), (-1.0, 1.0)),
        options={"xatol": 1.0e-8, "fatol": 1.0e-14, "maxiter": 10_000},
    )
    one_pole = {
        "model": "first-order-highpass",
        "cutoff_hz": float(one_pole_result.x[0]),
        "gain_db": float(one_pole_result.x[1]),
    }
    butterworth_q = 1.0 / math.sqrt(2.0)
    butterworth_result = optimize.minimize(
        lambda values: score(
            {
                "model": "rbj-biquad-highpass",
                "cutoff_hz": float(values[0]),
                "q": butterworth_q,
                "gain_db": float(values[1]),
            }
        ),
        np.asarray((20.0, 0.0)),
        method="Nelder-Mead",
        bounds=((1.0, 80.0), (-1.0, 1.0)),
        options={"xatol": 1.0e-8, "fatol": 1.0e-14, "maxiter": 10_000},
    )
    butterworth = {
        "model": "rbj-biquad-highpass",
        "cutoff_hz": float(butterworth_result.x[0]),
        "q": butterworth_q,
        "gain_db": float(butterworth_result.x[1]),
    }
    free_result = optimize.minimize(
        lambda values: score(
            {
                "model": "rbj-biquad-highpass",
                "cutoff_hz": float(values[0]),
                "q": float(values[1]),
                "gain_db": float(values[2]),
            }
        ),
        np.asarray((20.0, butterworth_q, 0.0)),
        method="Nelder-Mead",
        bounds=((1.0, 80.0), (0.2, 3.0), (-1.0, 1.0)),
        options={"xatol": 1.0e-8, "fatol": 1.0e-14, "maxiter": 10_000},
    )
    free_biquad = {
        "model": "rbj-biquad-highpass",
        "cutoff_hz": float(free_result.x[0]),
        "q": float(free_result.x[1]),
        "gain_db": float(free_result.x[2]),
    }
    candidates = []
    for name, candidate in (
        ("gain-only", none),
        ("one-pole", one_pole),
        ("butterworth-biquad", butterworth),
        ("free-q-biquad", free_biquad),
    ):
        candidate_score = score(candidate)
        candidates.append(
            {
                "name": name,
                **candidate,
                "mean_normalized_error_power": candidate_score,
                "mean_error_relative_db": power_ratio_db(candidate_score),
            }
        )

    butterworth_row = next(row for row in candidates if row["name"] == "butterworth-biquad")
    free_row = next(row for row in candidates if row["name"] == "free-q-biquad")
    if free_row["mean_error_relative_db"] < butterworth_row["mean_error_relative_db"] - 0.1:
        selected = free_row
        rationale = "The free-Q biquad improved mean error by more than 0.1 dB."
    else:
        selected = butterworth_row
        rationale = (
            "The fixed Butterworth Q is within 0.1 dB of the free-Q optimum, so the "
            "simpler standard topology was selected."
        )
    return {
        **selected,
        "selection_rationale": rationale,
        "candidate_models": candidates,
    }


def fit_subtraction_path(
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    def score(cutoff_hz: float) -> float:
        errors = []
        for row in rows:
            measured = row["measured"]
            target = row["target_delta"][measured]
            candidate = dc_block(row["candidate_selected"], cutoff_hz)[measured]
            errors.append(normalized_error_power(target, candidate))
        return float(np.mean(errors))

    result = optimize.minimize_scalar(
        score,
        bounds=(0.0, 80.0),
        method="bounded",
        options={"xatol": 1.0e-5},
    )
    options = (
        (0.0, score(0.0)),
        (15.0, score(15.0)),
        (float(result.x), float(result.fun)),
    )
    cutoff_hz, best_score = min(options, key=lambda row: row[1])
    no_block_score = options[0][1]
    use_no_block = cutoff_hz < 0.1 or power_ratio_db(no_block_score) <= power_ratio_db(best_score) + 0.25
    return {
        "model": "none" if use_no_block else "first-order-highpass",
        "cutoff_hz": 0.0 if use_no_block else cutoff_hz,
        "mean_normalized_error_power": no_block_score if use_no_block else best_score,
        "mean_error_relative_db": power_ratio_db(no_block_score if use_no_block else best_score),
        "no_block_error_relative_db": power_ratio_db(no_block_score),
        "fixed_15_hz_error_relative_db": power_ratio_db(options[1][1]),
        "unconstrained_best_cutoff_hz": cutoff_hz,
        "unconstrained_best_error_relative_db": power_ratio_db(best_score),
        "selection_rationale": (
            "The unconstrained optimum is below 0.1 Hz and improves the score by "
            "less than 0.25 dB, so the subtraction path is treated as unfiltered."
            if use_no_block
            else "The fitted high-pass materially outperformed an unfiltered subtraction."
        ),
    }


def candidate_contribution(
    row: dict[str, Any],
    de_emphasis: float,
    base_fit: dict[str, Any],
    subtraction_fit: dict[str, Any],
) -> np.ndarray:
    base = apply_filter_fit(row["candidate_shaped"], base_fit)
    subtraction = apply_filter_fit(row["candidate_selected"], subtraction_fit)
    return base - de_emphasis * subtraction


def tone_case_report(
    row: dict[str, Any],
    base_fit: dict[str, float],
    subtraction_fit: dict[str, float],
) -> dict[str, Any]:
    case: ToneCase = row["case"]
    measured = row["measured"]
    target_off = row["target_off"]
    target_on = row["target_on"]
    candidate_endpoints = {
        value: candidate_contribution(row, value, base_fit, subtraction_fit)
        for value in (0.0, 1.0)
    }
    values: list[dict[str, Any]] = []
    for value in DE_EMPHASIS_VALUES:
        target = target_off + value * (target_on - target_off)
        candidate = candidate_contribution(row, value, base_fit, subtraction_fit)
        current = render_current_contribution(row["signal"], case, value)
        candidate_affine = candidate_endpoints[0.0] + value * (
            candidate_endpoints[1.0] - candidate_endpoints[0.0]
        )
        values.append(
            {
                "de_emphasis": value,
                "target_kind": (
                    "measured-spectre-endpoint"
                    if value in (0.0, 1.0)
                    else "affine-interpolation-of-measured-spectre-endpoints"
                ),
                "candidate_vs_target": uncertainty.contribution_comparison(
                    target[measured], candidate[measured]
                ),
                "current_vs_target": uncertainty.contribution_comparison(
                    target[measured], current[measured]
                ),
                "candidate_affine_max_abs_error": float(
                    np.max(np.abs(candidate[measured] - candidate_affine[measured]))
                ),
            }
        )

    selected = row["candidate_selected"]
    target_delta = row["target_delta"]
    return {
        "case": asdict(case),
        "wrapper_latency_samples": row["latency_samples"],
        "effective_spectre_switch": row["effective_de_emphasis"],
        "de_emphasis_delta": {
            "unfiltered_selected_vs_spectre_off_minus_on": (
                uncertainty.contribution_comparison(
                    target_delta[measured], selected[measured]
                )
            ),
            "15_hz_blocked_selected_vs_spectre_off_minus_on": (
                uncertainty.contribution_comparison(
                    target_delta[measured], dc_block(selected, 15.0)[measured]
                )
            ),
            "fitted_selected_vs_spectre_off_minus_on": (
                uncertainty.contribution_comparison(
                    target_delta[measured],
                    apply_filter_fit(selected, subtraction_fit)[measured],
                )
            ),
        },
        "values": values,
    }


def delta_independence_report(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[float, list[dict[str, Any]]] = {}
    for row in rows:
        case: ToneCase = row["case"]
        if case.frequency_hz in (100.0, 997.0) and case.q == 0.71:
            grouped.setdefault(case.frequency_hz, []).append(row)

    result = []
    for frequency_hz, frequency_rows in sorted(grouped.items()):
        reference_row = next(
            row
            for row in frequency_rows
            if row["case"].mode == "Medium" and row["case"].color == "Solid"
        )
        measured = reference_row["measured"]
        comparisons = []
        for row in frequency_rows:
            comparisons.append(
                {
                    "mode": row["case"].mode,
                    "color": row["case"].color,
                    "vs_medium_solid": uncertainty.contribution_comparison(
                        reference_row["target_delta"][measured],
                        row["target_delta"][measured],
                    ),
                }
            )
        result.append(
            {"frequency_hz": frequency_hz, "comparisons": comparisons}
        )
    return result


def musical_fixtures() -> dict[str, np.ndarray]:
    return {
        "pink": reference.make_pink(SAMPLE_RATE, -18.0, duration_seconds=4.0),
        "drums": reference.make_drums(SAMPLE_RATE, -18.0, duration_seconds=4.0),
        "bass": reference.make_bass(SAMPLE_RATE, -18.0, duration_seconds=4.0),
        "bright-poly": reference.make_bright_poly(
            SAMPLE_RATE, -18.0, duration_seconds=4.0
        ),
    }


def spectre_two_band_settings(
    mode: str,
    enabled: bool,
    mix: float,
) -> dict[str, Any]:
    settings = uncertainty.spectre_two_band_settings(
        amount=0.75,
        mode=mode,
    )
    settings["de_emphasis"] = enabled
    settings["dry_wet"] = mix
    return settings


def candidate_musical_components(
    audio: np.ndarray,
    mode: str,
    base_fit: dict[str, Any],
    subtraction_fit: dict[str, Any],
    tag: str,
) -> tuple[np.ndarray, np.ndarray]:
    base = np.zeros_like(audio, dtype=np.float64)
    subtraction = np.zeros_like(audio, dtype=np.float64)
    for band_index, band in enumerate(MUSICAL_BANDS, start=1):
        gain_db = float(band["amount"]) * 12.0
        for channel in range(audio.shape[0]):
            shaped_raw, _ = wrapper.render_probe(
                audio[channel],
                WINNER,
                frequency_hz=float(band["frequency_hz"]),
                q=float(band["q"]),
                gain_db=gain_db,
                mode=mode,
                color=str(band["color"]),
                de_emphasis=0.0,
                dc_cutoff_hz=0.0,
                tag=f"deemphasis-music-{tag}-b{band_index}-c{channel}-shaped",
            )
            selected_raw, _ = wrapper.render_probe(
                audio[channel],
                WINNER,
                frequency_hz=float(band["frequency_hz"]),
                q=float(band["q"]),
                gain_db=gain_db,
                mode=mode,
                color="Clean",
                de_emphasis=0.0,
                dc_cutoff_hz=0.0,
                tag=f"deemphasis-music-{tag}-b{band_index}-c{channel}-selected",
            )
            shaped = wrapper.advance_signal(shaped_raw, HOST_ADVANCE_SAMPLES)
            selected = wrapper.advance_signal(selected_raw, HOST_ADVANCE_SAMPLES)
            base[channel] += apply_filter_fit(shaped, base_fit)
            subtraction[channel] += apply_filter_fit(selected, subtraction_fit)
    return base, subtraction


def current_musical_output(
    audio: np.ndarray,
    mode: str,
    de_emphasis: float,
) -> np.ndarray:
    return uncertainty.render_cosimo(
        audio,
        MUSICAL_BANDS,
        saturation_mode=mode,
        de_emphasis=de_emphasis,
    ).astype(np.float64)


def musical_report(
    session: reference.SpectreSession,
    base_fit: dict[str, float],
    subtraction_fit: dict[str, float],
) -> list[dict[str, Any]]:
    pre_frames = SAMPLE_RATE // 2
    LISTENING_ROOT.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    for mode in ("Subtle", "Medium"):
        for name, fixture in musical_fixtures().items():
            audio = np.concatenate(
                (np.zeros((2, pre_frames), dtype=np.float32), fixture), axis=1
            )
            wet_endpoints = {}
            full_endpoints = {}
            for enabled in (False, True):
                wet, _ = session.process(
                    audio,
                    SAMPLE_RATE,
                    spectre_two_band_settings(mode, enabled, 1.0),
                )
                full, _ = session.process(
                    audio,
                    SAMPLE_RATE,
                    spectre_two_band_settings(mode, enabled, 0.5),
                )
                wet_endpoints[float(enabled)] = wet.astype(np.float64)
                full_endpoints[float(enabled)] = full.astype(np.float64)

            base, subtraction = candidate_musical_components(
                audio,
                mode,
                base_fit,
                subtraction_fit,
                f"{mode.lower()}-{name}",
            )
            delayed_dry = wrapper.advance_signal(audio.astype(np.float64), 0.5)
            measured = slice(pre_frames, audio.shape[1] - SAMPLE_RATE // 10)
            values = []
            for value in DE_EMPHASIS_VALUES:
                target_wet = wet_endpoints[0.0] + value * (
                    wet_endpoints[1.0] - wet_endpoints[0.0]
                )
                target_full = full_endpoints[0.0] + value * (
                    full_endpoints[1.0] - full_endpoints[0.0]
                )
                candidate_wet = base - value * subtraction
                candidate_full = delayed_dry + candidate_wet
                current_full = current_musical_output(audio, mode, value)
                current_wet = current_full - audio.astype(np.float64)

                candidate_metrics = uncertainty.contribution_comparison(
                    target_wet[:, measured], candidate_wet[:, measured]
                )
                candidate_metrics["full_output_error_relative_db"] = (
                    uncertainty.ratio_db(
                        uncertainty.rms(
                            candidate_full[:, measured] - target_full[:, measured]
                        ),
                        uncertainty.rms(target_full[:, measured]),
                    )
                )
                current_metrics = uncertainty.contribution_comparison(
                    target_wet[:, measured], current_wet[:, measured]
                )
                current_metrics["full_output_error_relative_db"] = (
                    uncertainty.ratio_db(
                        uncertainty.rms(
                            current_full[:, measured] - target_full[:, measured]
                        ),
                        uncertainty.rms(target_full[:, measured]),
                    )
                )
                values.append(
                    {
                        "de_emphasis": value,
                        "target_kind": (
                            "measured-spectre-endpoint"
                            if value in (0.0, 1.0)
                            else "affine-interpolation-of-measured-spectre-endpoints"
                        ),
                        "candidate_vs_target": candidate_metrics,
                        "current_vs_target": current_metrics,
                    }
                )

                if value in LISTENING_VALUES:
                    percent = int(round(value * 100.0))
                    fixture_slice = slice(pre_frames, audio.shape[1])
                    prefix = f"{mode.lower()}-{name}-de-{percent:03d}"
                    if value == 0.0:
                        reference.write_float_wav(
                            LISTENING_ROOT / f"{mode.lower()}-{name}-00-dry.wav",
                            SAMPLE_RATE,
                            audio[:, fixture_slice],
                        )
                    reference.write_float_wav(
                        LISTENING_ROOT / f"{prefix}-01-reference.wav",
                        SAMPLE_RATE,
                        target_full[:, fixture_slice].astype(np.float32),
                    )
                    reference.write_float_wav(
                        LISTENING_ROOT / f"{prefix}-02-current.wav",
                        SAMPLE_RATE,
                        current_full[:, fixture_slice].astype(np.float32),
                    )
                    reference.write_float_wav(
                        LISTENING_ROOT / f"{prefix}-03-candidate.wav",
                        SAMPLE_RATE,
                        candidate_full[:, fixture_slice].astype(np.float32),
                    )

            rows.append({"mode": mode, "fixture": name, "values": values})
    return rows


def switch_quantization_probe() -> dict[str, Any]:
    plugin = reference.load_plugin(str(reference.AU_PATH))
    parameter = plugin.parameters["de_emphasis"]
    rows = []
    for requested in DE_EMPHASIS_VALUES:
        parameter.raw_value = requested
        rows.append(
            {
                "requested_raw": requested,
                "effective_raw": float(parameter.raw_value),
                "display": parameter.string_value,
            }
        )
    return {
        "conclusion": (
            "Spectre exposes only Disabled and Enabled. Intermediate Cosimo targets "
            "must be derived from the measured endpoints."
        ),
        "rows": rows,
    }


def summarize_music(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_value: dict[str, dict[str, list[float]]] = {}
    for row in rows:
        for value_row in row["values"]:
            key = f"{value_row['de_emphasis']:.2f}"
            bucket = by_value.setdefault(
                key,
                {"candidate_error_db": [], "current_error_db": []},
            )
            bucket["candidate_error_db"].append(
                value_row["candidate_vs_target"]["error_relative_to_target_db"]
            )
            bucket["current_error_db"].append(
                value_row["current_vs_target"]["error_relative_to_target_db"]
            )
    return {
        key: {
            "candidate_mean_error_relative_db": power_ratio_db(
                float(np.mean([db_power_ratio(value) for value in values["candidate_error_db"]]))
            ),
            "current_mean_error_relative_db": power_ratio_db(
                float(np.mean([db_power_ratio(value) for value in values["current_error_db"]]))
            ),
        }
        for key, values in by_value.items()
    }


def main() -> int:
    for required in (
        reference.AU_PATH,
        reference.LICENSE_PATH,
        uncertainty.COSIMO_VST3_PATH,
        uncertainty.COSIMO_BINARY_PATH,
        WRAPPER_REPORT_PATH,
    ):
        if not required.exists():
            raise FileNotFoundError(required)

    wrapper_report = json.loads(WRAPPER_REPORT_PATH.read_text())
    if wrapper_report["winner"]["id"] != WINNER.id:
        raise RuntimeError("wrapper checkpoint winner changed")
    wrapper.ensure_juce()
    wrapper.compile_probe()
    RESULT_ROOT.mkdir(parents=True, exist_ok=True)

    print("confirming Spectre de-emphasis switch quantization", flush=True)
    quantization = switch_quantization_probe()
    session = reference.SpectreSession()

    print("capturing locked de-emphasis training tones", flush=True)
    training_rows = [capture_tone_case(session, case) for case in TRAINING_CASES]
    base_fit = fit_base_path(training_rows)
    subtraction_fit = fit_subtraction_path(training_rows)
    print(
        "locked stage model: "
        f"base {base_fit['name']} at {base_fit['cutoff_hz']:.4f} Hz, "
        f"subtraction {subtraction_fit['model']}",
        flush=True,
    )

    print("revealing modes, characters, controls, and held-out tones", flush=True)
    held_out_rows = [capture_tone_case(session, case) for case in HELD_OUT_CASES]
    training_report = [
        tone_case_report(row, base_fit, subtraction_fit) for row in training_rows
    ]
    held_out_report = [
        tone_case_report(row, base_fit, subtraction_fit) for row in held_out_rows
    ]

    print("rendering Subtle and Medium musical endpoint/interpolation A/Bs", flush=True)
    music = musical_report(session, base_fit, subtraction_fit)
    music_summary = summarize_music(music)

    report = {
        "schema": "cosimo.enhancer-deemphasis-prototype.v1",
        "question": (
            "With the JUCE Good wrapper and recovered bell/shaper fixed, where does "
            "Spectre apply its approximately 10-15 Hz DC conditioning relative to "
            "the de-emphasis subtraction?"
        ),
        "scope": (
            "Lab-only. No production Enhancer, UI, Polish chain, installed VST, or "
            "Ableton state was changed."
        ),
        "continuous_control_contract": (
            "Spectre supplies measured 0 and 100 percent endpoints only. Cosimo's "
            "25/50/75 percent references are exact sample-wise interpolation between "
            "those endpoints; there is no RMS follower, correlation follower, or "
            "dynamic gain compensation."
        ),
        "provenance": {
            "git_head_before_report": git_output("rev-parse", "HEAD"),
            "git_branch": git_output("branch", "--show-current"),
            "wrapper_report_sha256": sha256_file(WRAPPER_REPORT_PATH),
            "wrapper_winner": asdict(WINNER),
            "wrapper_host_advance_samples": HOST_ADVANCE_SAMPLES,
            "spectre_au_sha256": sha256_file(reference.AU_PATH / "Contents/MacOS/Spectre"),
            "cosimo_vst3_binary_sha256": sha256_file(uncertainty.COSIMO_BINARY_PATH),
            "probe_source_sha256": sha256_file(
                Path(__file__).with_name("enhancer_wrapper_probe.cpp")
            ),
            "runner_source_sha256": sha256_file(Path(__file__)),
            "sample_rate_hz": SAMPLE_RATE,
        },
        "spectre_switch_quantization": quantization,
        "training": {
            "selection_rule": (
                "Fit gain-only, one-pole, fixed-Butterworth-biquad, and free-Q-biquad "
                "models on the de-emphasis-off shaped path, and independently compare "
                "unfiltered versus one-pole models on Spectre off-minus-on. The fit uses "
                "only Medium Solid tones at 31-997 Hz. The fixed Butterworth model wins "
                "when it is within 0.1 dB of free-Q; the subtraction stays unfiltered "
                "when a sub-0.1-Hz optimum gains less than 0.25 dB."
            ),
            "base_path_fit": base_fit,
            "subtraction_path_fit": subtraction_fit,
            "cases": training_report,
        },
        "held_out": {
            "cases": held_out_report,
            "spectre_delta_mode_color_independence": delta_independence_report(
                held_out_rows
            ),
        },
        "musical": {
            "settings": (
                "130 Hz Solid plus 9 kHz Tube, Q 0.71, +9 dB each, Good, both "
                "Subtle and Medium"
            ),
            "summary": music_summary,
            "cases": music,
        },
    }
    reference.write_json(REPORT_PATH, report)
    print(json.dumps(
        {
            "report": str(REPORT_PATH.relative_to(REPO_ROOT)),
            "base_path_fit": base_fit,
            "subtraction_path_fit": subtraction_fit,
            "musical_summary": music_summary,
        },
        indent=2,
        sort_keys=True,
    ))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
