#!/usr/bin/env python3
"""Build and evaluate a throwaway JUCE 7.0.1 Spectre-Good wrapper prototype.

The production Enhancer is deliberately not imported or modified.  This runner
uses the recovered bell and static shaper laws inside a tiny JUCE executable,
selects an oversampling wrapper on training probes, and reveals held-out results
only after the candidate has been fixed.
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

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import measure_spectre_enhancer_uncertainty as uncertainty  # noqa: E402
import measure_spectre_reference as reference  # noqa: E402

SAMPLE_RATE = 48_000
BUILD_ROOT = REPO_ROOT / "build" / "t26-wrapper-prototype"
CMAKE_BUILD_ROOT = BUILD_ROOT / "cmake"
DIRECT_ROOT = BUILD_ROOT / "direct"
RAW_ROOT = BUILD_ROOT / "raw"
RESULT_ROOT = BUILD_ROOT / "results"
LISTENING_ROOT = RESULT_ROOT / "listening"
PROBE = DIRECT_ROOT / "enhancer_wrapper_probe"
JUCE_REPOSITORY = "https://github.com/juce-framework/JUCE.git"
JUCE_TAG = "7.0.1"
JUCE_COMMIT = "b08520c2de1771af3dfcbfbc0e0b6b0b5eb083b0"

TRAINING_TONES_HZ = (997.0, 4_001.0, 7_993.0)
HELD_OUT_TONES_HZ = (100.0, 11_987.0, 15_991.0)
ANALYSIS_FLOOR = 1.0e-30


@dataclass(frozen=True)
class Candidate:
    id: str
    filter_type: str
    maximum_quality: bool
    integer_latency: bool


CANDIDATES = tuple(
    Candidate(
        id=f"{filter_type}-{'maximum' if maximum_quality else 'normal'}-"
        f"{'integer' if integer_latency else 'fractional'}",
        filter_type=filter_type,
        maximum_quality=maximum_quality,
        integer_latency=integer_latency,
    )
    for filter_type in ("iir", "fir")
    for maximum_quality in (False, True)
    for integer_latency in (False, True)
)


def run_command(command: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=REPO_ROOT,
        check=True,
        capture_output=capture,
        text=True,
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def compile_probe() -> None:
    print("building pinned JUCE DSP probe through CPM", flush=True)
    run_command(
        [
            "cmake",
            "-S",
            str(Path(__file__).resolve().parent),
            "-B",
            str(CMAKE_BUILD_ROOT),
            "-DCMAKE_BUILD_TYPE=Release",
            f"-DCOSIMO_T26_PROBE_OUTPUT_DIR={DIRECT_ROOT}",
        ]
    )
    run_command(
        [
            "cmake",
            "--build",
            str(CMAKE_BUILD_ROOT),
            "--target",
            "enhancer_wrapper_probe",
            "--parallel",
            "4",
        ]
    )


def safe_id(value: str) -> str:
    return "".join(character if character.isalnum() else "-" for character in value)


def render_probe(
    signal: np.ndarray,
    candidate: Candidate,
    *,
    frequency_hz: float,
    q: float,
    gain_db: float,
    mode: str,
    color: str,
    de_emphasis: float,
    tag: str,
    dc_cutoff_hz: float = 15.0,
) -> tuple[np.ndarray, float]:
    RAW_ROOT.mkdir(parents=True, exist_ok=True)
    invocation_id = safe_id(
        f"{candidate.id}-{tag}-{frequency_hz:g}-{q:g}-{gain_db:g}-{mode}-{color}-{de_emphasis:g}-dc-{dc_cutoff_hz:g}"
    )
    input_path = RAW_ROOT / f"{invocation_id}-input.raw"
    output_path = RAW_ROOT / f"{invocation_id}-output.raw"
    signal32 = np.ascontiguousarray(signal, dtype=np.float32)
    signal32.tofile(input_path)
    result = run_command(
        [
            str(PROBE),
            str(input_path),
            str(output_path),
            candidate.filter_type,
            "1" if candidate.maximum_quality else "0",
            "1" if candidate.integer_latency else "0",
            str(SAMPLE_RATE),
            str(frequency_hz),
            str(q),
            str(gain_db),
            mode,
            color,
            str(de_emphasis),
            str(dc_cutoff_hz),
        ],
        capture=True,
    )
    metadata = json.loads(result.stdout.strip().splitlines()[-1])
    output = np.fromfile(output_path, dtype=np.float32)
    if output.shape != signal32.shape:
        raise RuntimeError(
            f"probe shape mismatch for {invocation_id}: {output.shape} != {signal32.shape}"
        )
    if not np.all(np.isfinite(output)):
        raise RuntimeError(f"probe returned non-finite output for {invocation_id}")
    return output.astype(np.float64), float(metadata["latency_samples"])


def advance_signal(signal: np.ndarray, samples: float) -> np.ndarray:
    """Apply an offline, zero-padded fractional advance for host compensation."""

    channels = signal[np.newaxis, :] if signal.ndim == 1 else signal
    frame_count = channels.shape[1]
    integer_samples = int(round(samples))
    if abs(samples - integer_samples) <= 1.0e-9:
        shifted = np.zeros_like(channels, dtype=np.float64)
        if integer_samples == 0:
            shifted[:] = channels
        elif integer_samples > 0:
            shifted[:, :-integer_samples] = channels[:, integer_samples:]
        else:
            shifted[:, -integer_samples:] = channels[:, :integer_samples]
        return shifted[0] if signal.ndim == 1 else shifted

    padding = 4096 + int(math.ceil(abs(samples)))
    fft_size = 1 << (frame_count + 2 * padding - 1).bit_length()
    frequencies = np.fft.rfftfreq(fft_size)
    phase = np.exp(2j * math.pi * frequencies * samples)
    shifted = []
    for channel in channels:
        padded = np.zeros(fft_size, dtype=np.float64)
        padded[padding : padding + frame_count] = channel
        transformed = np.fft.rfft(padded)
        shifted.append(
            np.fft.irfft(transformed * phase, n=fft_size)[
                padding : padding + frame_count
            ]
        )
    result = np.stack(shifted)
    return result[0] if signal.ndim == 1 else result


def host_compensation_samples(reported_latency: float) -> int:
    """Mirror the integer latency a JUCE AudioProcessor can report to a host."""

    return int(math.floor(reported_latency + 0.5))


def fit_advance_samples(
    target: np.ndarray, candidate: np.ndarray, reported_latency: float
) -> tuple[float, float]:
    target_spectrum = np.fft.rfft(target.astype(np.float64))
    candidate_spectrum = np.fft.rfft(candidate.astype(np.float64))
    frequencies_hz = np.fft.rfftfreq(target.size, 1.0 / SAMPLE_RATE)
    threshold = float(np.max(np.abs(target_spectrum))) * reference.db_to_gain(-40.0)
    useful = (
        (frequencies_hz >= 40.0)
        & (frequencies_hz <= 20_000.0)
        & (np.abs(target_spectrum) >= threshold)
    )
    target_useful = target_spectrum[useful]
    candidate_useful = candidate_spectrum[useful]
    omega = 2.0 * math.pi * frequencies_hz[useful] / SAMPLE_RATE
    denominator = max(float(np.sum(np.square(np.abs(target_useful)))), ANALYSIS_FLOOR)

    def error_ratio(advance: float) -> float:
        error = candidate_useful * np.exp(1j * omega * advance) - target_useful
        return float(np.sum(np.square(np.abs(error))) / denominator)

    lower = max(0.0, reported_latency - 8.0)
    upper = reported_latency + 8.0
    coarse = np.linspace(lower, upper, 321)
    coarse_errors = np.asarray([error_ratio(value) for value in coarse])
    best_coarse = float(coarse[int(np.argmin(coarse_errors))])
    refined = optimize.minimize_scalar(
        error_ratio,
        bounds=(max(lower, best_coarse - 0.1), min(upper, best_coarse + 0.1)),
        method="bounded",
        options={"xatol": 1.0e-6},
    )
    return float(refined.x), float(refined.fun)


def make_tone_probe(frequency_hz: float) -> tuple[np.ndarray, slice]:
    pre_frames = SAMPLE_RATE // 2
    tail_frames = SAMPLE_RATE // 4
    tone = reference.make_sine(
        SAMPLE_RATE, frequency_hz, -12.0, duration_seconds=2.0
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


def render_spectre_tone(
    session: reference.SpectreSession,
    signal: np.ndarray,
    frequency_hz: float,
    *,
    mix: float,
) -> np.ndarray:
    audio = np.stack((signal, signal)).astype(np.float32)
    output, _ = session.process(
        audio,
        SAMPLE_RATE,
        reference.one_peak_settings(
            frequency_hz=frequency_hz,
            gain_db=12.0,
            q=0.71,
            color="Solid",
            mode="Medium",
            quality="Good",
            de_emphasis=True,
            mix=mix,
        ),
    )
    return output[0].astype(np.float64)


def render_current_tone(signal: np.ndarray, frequency_hz: float) -> np.ndarray:
    audio = np.stack((signal, signal)).astype(np.float32)
    output = uncertainty.render_cosimo(
        audio,
        (
            {
                "frequency_hz": frequency_hz,
                "q": 0.71,
                "amount": 1.0,
                "color": "Solid",
            },
        ),
        saturation_mode="Medium",
        de_emphasis=1.0,
    )
    return output[0].astype(np.float64) - signal.astype(np.float64)


def render_spectre_wet_component(
    session: reference.SpectreSession,
    signal: np.ndarray,
    frequency_hz: float,
    *,
    color: str,
    de_emphasis: bool,
) -> np.ndarray:
    audio = np.stack((signal, signal)).astype(np.float32)
    output, _ = session.process(
        audio,
        SAMPLE_RATE,
        reference.one_peak_settings(
            frequency_hz=frequency_hz,
            gain_db=12.0,
            q=0.71,
            color=color,
            mode="Medium",
            quality="Good",
            de_emphasis=de_emphasis,
            mix=1.0,
        ),
    )
    return output[0].astype(np.float64)


def comparison(target: np.ndarray, candidate: np.ndarray) -> dict[str, float]:
    return uncertainty.contribution_comparison(target, candidate)


def evaluate_tone(
    target: np.ndarray,
    raw_candidate: np.ndarray,
    measured: slice,
    advance: float,
) -> dict[str, float]:
    shifted = advance_signal(raw_candidate, advance)
    return comparison(target[measured], shifted[measured])


def impulse_experiment(
    session: reference.SpectreSession,
) -> tuple[np.ndarray, np.ndarray, int, dict[str, Any], dict[str, dict[str, Any]]]:
    frame_count = SAMPLE_RATE * 2
    origin = SAMPLE_RATE // 2
    amplitude = 1.0e-4
    impulse = np.zeros(frame_count, dtype=np.float32)
    impulse[origin] = amplitude
    stereo = np.stack((impulse, impulse))
    target_output, _ = session.process(
        stereo,
        SAMPLE_RATE,
        reference.one_peak_settings(
            frequency_hz=1_000.0,
            gain_db=12.0,
            q=0.71,
            color="Clean",
            mode="Medium",
            quality="Good",
            de_emphasis=False,
            mix=1.0,
        ),
    )
    target = target_output[0].astype(np.float64)
    candidate_rows: dict[str, dict[str, Any]] = {}
    raw_outputs: dict[str, np.ndarray] = {}
    for candidate in CANDIDATES:
        raw, latency = render_probe(
            impulse,
            candidate,
            frequency_hz=1_000.0,
            q=0.71,
            gain_db=12.0,
            mode="Medium",
            color="Clean",
            de_emphasis=0.0,
            tag="clean-impulse",
        )
        advance, spectral_error_ratio = fit_advance_samples(target, raw, latency)
        fitted_shifted = advance_signal(raw, advance)
        production_advance = host_compensation_samples(latency)
        shifted = advance_signal(raw, production_advance)
        metrics = comparison(target, shifted)
        candidate_rows[candidate.id] = {
            "candidate": asdict(candidate),
            "reported_latency_samples": latency,
            "fitted_host_advance_samples": advance,
            "advance_minus_reported_latency_samples": advance - latency,
            "production_host_advance_samples": production_advance,
            "fit_spectral_error_relative_db": uncertainty.ratio_db(
                math.sqrt(spectral_error_ratio), 1.0
            ),
            "time_domain_after_integer_host_compensation": metrics,
            "time_domain_after_fitted_fractional_advance": comparison(
                target, fitted_shifted
            ),
            "impulse_support_after_integer_host_compensation": uncertainty.impulse_support(
                shifted / amplitude, origin
            ),
        }
        raw_outputs[candidate.id] = raw
    target_report = {
        "settings": "1 kHz, +12 dB, Q 0.71, Clean, Medium, Good, de-emphasis off",
        "spectre_impulse_support": uncertainty.impulse_support(
            target / amplitude, origin
        ),
    }
    return impulse, target, origin, target_report, candidate_rows


def capture_tone_targets(
    session: reference.SpectreSession, frequencies_hz: tuple[float, ...]
) -> dict[float, dict[str, Any]]:
    rows: dict[float, dict[str, Any]] = {}
    for frequency_hz in frequencies_hz:
        signal, measured = make_tone_probe(frequency_hz)
        target = render_spectre_tone(
            session, signal, frequency_hz, mix=1.0
        )
        dry_endpoint = render_spectre_tone(
            session, signal, frequency_hz, mix=0.0
        )
        mix_half = render_spectre_tone(
            session, signal, frequency_hz, mix=0.5
        )
        current = render_current_tone(signal, frequency_hz)
        rows[frequency_hz] = {
            "signal": signal,
            "measured": measured,
            "target": target,
            "dry_endpoint": dry_endpoint,
            "mix_half": mix_half,
            "spectre_dry_endpoint_vs_raw": comparison(
                signal[measured], dry_endpoint[measured]
            ),
            "spectre_mix_half_affine_check": comparison(
                mix_half[measured],
                (dry_endpoint + target)[measured],
            ),
            "raw_subtracted_mix_half_vs_wet_endpoint": comparison(
                target[measured],
                (mix_half - signal.astype(np.float64))[measured],
            ),
            "current_vs_spectre_good": comparison(
                target[measured], current[measured]
            ),
        }
    return rows


def rank_candidates(
    impulse_rows: dict[str, dict[str, Any]],
    tone_targets: dict[float, dict[str, Any]],
) -> tuple[Candidate, list[dict[str, Any]]]:
    rows: list[dict[str, Any]] = []
    for candidate in CANDIDATES:
        advance = float(impulse_rows[candidate.id]["production_host_advance_samples"])
        tone_rows = []
        error_ratios = [
            reference.db_to_gain(
                float(
                    impulse_rows[candidate.id][
                        "time_domain_after_integer_host_compensation"
                    ]["error_relative_to_target_db"]
                )
            )
        ]
        for frequency_hz in TRAINING_TONES_HZ:
            target_row = tone_targets[frequency_hz]
            raw, latency = render_probe(
                target_row["signal"],
                candidate,
                frequency_hz=frequency_hz,
                q=0.71,
                gain_db=12.0,
                mode="Medium",
                color="Solid",
                de_emphasis=1.0,
                tag=f"training-{frequency_hz:g}",
            )
            if abs(latency - impulse_rows[candidate.id]["reported_latency_samples"]) > 1.0e-4:
                raise RuntimeError(f"latency changed for {candidate.id}")
            metrics = evaluate_tone(
                target_row["target"], raw, target_row["measured"], advance
            )
            error_ratios.append(reference.db_to_gain(metrics["error_relative_to_target_db"]))
            tone_rows.append({"frequency_hz": frequency_hz, **metrics})
        score = float(np.mean(np.square(error_ratios)))
        rows.append(
            {
                "candidate": asdict(candidate),
                "selection_score_mean_normalized_error_power": score,
                "clean_impulse": impulse_rows[candidate.id],
                "nonlinear_training_tones": tone_rows,
            }
        )
    rows.sort(key=lambda row: row["selection_score_mean_normalized_error_power"])
    winner_id = rows[0]["candidate"]["id"]
    winner = next(candidate for candidate in CANDIDATES if candidate.id == winner_id)
    return winner, rows


def evaluate_held_out_tones(
    winner: Candidate,
    advance: float,
    tone_targets: dict[float, dict[str, Any]],
) -> list[dict[str, Any]]:
    rows = []
    for frequency_hz in HELD_OUT_TONES_HZ:
        target_row = tone_targets[frequency_hz]
        raw, _ = render_probe(
            target_row["signal"],
            winner,
            frequency_hz=frequency_hz,
            q=0.71,
            gain_db=12.0,
            mode="Medium",
            color="Solid",
            de_emphasis=1.0,
            tag=f"held-out-{frequency_hz:g}",
        )
        dry_raw, _ = render_probe(
            target_row["signal"],
            winner,
            frequency_hz=1_000.0,
            q=0.71,
            gain_db=0.0,
            mode="Medium",
            color="Dry",
            de_emphasis=0.0,
            tag=f"held-out-dry-{frequency_hz:g}",
        )
        rows.append(
            {
                "frequency_hz": frequency_hz,
                "spectre_dry_endpoint_vs_raw": target_row[
                    "spectre_dry_endpoint_vs_raw"
                ],
                "raw_subtracted_mix_half_vs_wet_endpoint": target_row[
                    "raw_subtracted_mix_half_vs_wet_endpoint"
                ],
                "juce_thiran_dry_path_vs_spectre_dry_endpoint": comparison(
                    target_row["dry_endpoint"][target_row["measured"]],
                    advance_signal(dry_raw, advance)[target_row["measured"]],
                ),
                "ideal_half_sample_dry_vs_spectre_dry_endpoint": comparison(
                    target_row["dry_endpoint"][target_row["measured"]],
                    advance_signal(target_row["signal"], 0.5)[
                        target_row["measured"]
                    ],
                ),
                "current_vs_spectre_good": target_row[
                    "current_vs_spectre_good"
                ],
                "winner_vs_spectre_good": evaluate_tone(
                    target_row["target"],
                    raw,
                    target_row["measured"],
                    advance,
                ),
            }
        )
    return rows


def de_emphasis_decomposition(
    session: reference.SpectreSession,
    winner: Candidate,
    advance: float,
    tone_targets: dict[float, dict[str, Any]],
) -> list[dict[str, Any]]:
    """Separate shaped-path mismatch from the linear de-emphasis subtraction."""

    rows = []
    for frequency_hz in (*TRAINING_TONES_HZ, *HELD_OUT_TONES_HZ):
        target_row = tone_targets[frequency_hz]
        signal = target_row["signal"]
        measured = target_row["measured"]
        target_residue = target_row["target"]
        target_clean = render_spectre_wet_component(
            session,
            signal,
            frequency_hz,
            color="Clean",
            de_emphasis=False,
        )
        target_shaped = render_spectre_wet_component(
            session,
            signal,
            frequency_hz,
            color="Solid",
            de_emphasis=False,
        )

        candidate_components: dict[str, np.ndarray] = {}
        for component, color, de_emphasis in (
            ("clean", "Clean", 0.0),
            ("shaped", "Solid", 0.0),
            ("residue", "Solid", 1.0),
        ):
            raw, _ = render_probe(
                signal,
                winner,
                frequency_hz=frequency_hz,
                q=0.71,
                gain_db=12.0,
                mode="Medium",
                color=color,
                de_emphasis=de_emphasis,
                tag=f"decomposition-{frequency_hz:g}-{component}",
            )
            candidate_components[component] = advance_signal(raw, advance)

        target_reconstructed = target_shaped - target_clean
        candidate_reconstructed = (
            candidate_components["shaped"] - candidate_components["clean"]
        )
        rows.append(
            {
                "frequency_hz": frequency_hz,
                "spectre_mix_half_affine_check": target_row[
                    "spectre_mix_half_affine_check"
                ],
                "raw_subtracted_mix_half_vs_wet_endpoint": target_row[
                    "raw_subtracted_mix_half_vs_wet_endpoint"
                ],
                "spectre_de_emphasis_affine_check": comparison(
                    target_residue[measured], target_reconstructed[measured]
                ),
                "candidate_de_emphasis_affine_check": comparison(
                    candidate_components["residue"][measured],
                    candidate_reconstructed[measured],
                ),
                "clean_component_vs_spectre": comparison(
                    target_clean[measured], candidate_components["clean"][measured]
                ),
                "shaped_component_vs_spectre": comparison(
                    target_shaped[measured],
                    candidate_components["shaped"][measured],
                ),
                "residue_vs_spectre": comparison(
                    target_residue[measured],
                    candidate_components["residue"][measured],
                ),
            }
        )
    return rows


def render_candidate_two_band(
    audio: np.ndarray, winner: Candidate, advance: float, tag: str
) -> tuple[np.ndarray, np.ndarray]:
    bands = (
        {"frequency_hz": 130.0, "q": 0.71, "gain_db": 9.0, "color": "Solid"},
        {"frequency_hz": 9_000.0, "q": 0.71, "gain_db": 9.0, "color": "Tube"},
    )
    contribution = np.zeros_like(audio, dtype=np.float64)
    for band_index, band in enumerate(bands, start=1):
        for channel in range(audio.shape[0]):
            raw, _ = render_probe(
                audio[channel],
                winner,
                frequency_hz=band["frequency_hz"],
                q=band["q"],
                gain_db=band["gain_db"],
                mode="Medium",
                color=band["color"],
                de_emphasis=1.0,
                tag=f"{tag}-band-{band_index}-channel-{channel}",
            )
            contribution[channel] += advance_signal(raw, advance)
    # Spectre's measured host-compensated dry endpoint is an almost ideal
    # half-sample advance. The JUCE 7 Thiran DelayLine was tested separately and
    # does not match at high frequency, so do not mislabel it as the dry model.
    delayed_dry = advance_signal(audio.astype(np.float64), 0.5)
    return delayed_dry + contribution, contribution


def musical_experiment(
    session: reference.SpectreSession, winner: Candidate, advance: float
) -> list[dict[str, Any]]:
    pre_frames = SAMPLE_RATE // 2
    amount = 0.75
    fixtures = {
        "pink": reference.make_pink(SAMPLE_RATE, -18.0, duration_seconds=4.0),
        "drums": reference.make_drums(SAMPLE_RATE, -18.0, duration_seconds=4.0),
        "bass": reference.make_bass(SAMPLE_RATE, -18.0, duration_seconds=4.0),
        "bright-poly": reference.make_bright_poly(
            SAMPLE_RATE, -18.0, duration_seconds=4.0
        ),
    }
    bands = (
        {"frequency_hz": 130.0, "q": 0.71, "amount": amount, "color": "Solid"},
        {"frequency_hz": 9_000.0, "q": 0.71, "amount": amount, "color": "Tube"},
    )
    rows = []
    LISTENING_ROOT.mkdir(parents=True, exist_ok=True)
    for name, fixture in fixtures.items():
        audio = np.concatenate(
            (np.zeros((2, pre_frames), dtype=np.float32), fixture), axis=1
        )
        spectre_mix_half, _ = session.process(
            audio,
            SAMPLE_RATE,
            uncertainty.spectre_two_band_settings(amount=amount, mode="Medium"),
        )
        wet_settings = uncertainty.spectre_two_band_settings(
            amount=amount, mode="Medium"
        )
        wet_settings["dry_wet"] = 1.0
        spectre_wet, _ = session.process(audio, SAMPLE_RATE, wet_settings)
        current = uncertainty.render_cosimo(
            audio,
            bands,
            saturation_mode="Medium",
            de_emphasis=1.0,
        )
        candidate, candidate_contribution = render_candidate_two_band(
            audio, winner, advance, name
        )
        dry = audio.astype(np.float64)
        target_contribution = spectre_wet.astype(np.float64)
        current_contribution = current.astype(np.float64) - dry
        measured = slice(pre_frames, audio.shape[1] - SAMPLE_RATE // 10)
        target_measured = target_contribution[:, measured]
        spectre_measured = spectre_mix_half[:, measured].astype(np.float64)

        def metrics(contribution: np.ndarray, output: np.ndarray) -> dict[str, float]:
            result = comparison(target_measured, contribution[:, measured])
            result["full_output_error_relative_to_spectre_db"] = uncertainty.ratio_db(
                uncertainty.rms(output[:, measured] - spectre_measured),
                uncertainty.rms(spectre_measured),
            )
            return result

        rows.append(
            {
                "fixture": name,
                "spectre_effect_relative_to_dry_db": uncertainty.ratio_db(
                    uncertainty.rms(target_measured), uncertainty.rms(dry[:, measured])
                ),
                "current_vs_spectre_good": metrics(
                    current_contribution, current.astype(np.float64)
                ),
                "winner_vs_spectre_good": metrics(candidate_contribution, candidate),
            }
        )
        fixture_slice = slice(pre_frames, audio.shape[1])
        reference.write_float_wav(
            LISTENING_ROOT / f"{name}-00-dry.wav",
            SAMPLE_RATE,
            dry[:, fixture_slice].astype(np.float32),
        )
        reference.write_float_wav(
            LISTENING_ROOT / f"{name}-01-spectre-good.wav",
            SAMPLE_RATE,
            spectre_mix_half[:, fixture_slice],
        )
        reference.write_float_wav(
            LISTENING_ROOT / f"{name}-02-current.wav",
            SAMPLE_RATE,
            current[:, fixture_slice],
        )
        reference.write_float_wav(
            LISTENING_ROOT / f"{name}-03-juce-winner.wav",
            SAMPLE_RATE,
            candidate[:, fixture_slice].astype(np.float32),
        )
    return rows


def recommendation(
    winner_row: dict[str, Any],
    held_out: list[dict[str, Any]],
    musical: list[dict[str, Any]],
) -> dict[str, Any]:
    held_out_improvements = [
        row["winner_vs_spectre_good"]["error_relative_to_target_db"]
        < row["current_vs_spectre_good"]["error_relative_to_target_db"]
        for row in held_out
    ]
    musical_improvements = [
        row["winner_vs_spectre_good"]["error_relative_to_target_db"]
        < row["current_vs_spectre_good"]["error_relative_to_target_db"]
        and row["winner_vs_spectre_good"]["correlation"]
        > row["current_vs_spectre_good"]["correlation"]
        for row in musical
    ]
    latency = float(winner_row["clean_impulse"]["reported_latency_samples"])
    host_latency = int(
        winner_row["clean_impulse"]["production_host_advance_samples"]
    )
    all_music_improved = all(musical_improvements)
    high_frequency_improved = all(
        improvement
        for row, improvement in zip(held_out, held_out_improvements)
        if row["frequency_hz"] >= 8_000.0
    )
    passed = all(held_out_improvements) and all_music_improved
    promising = all_music_improved and high_frequency_improved
    return {
        "prototype_result": (
            "promotion-candidate"
            if passed
            else ("promising-not-locked" if promising else "reject-current-topology")
        ),
        "held_out_tones_improved": sum(held_out_improvements),
        "held_out_tone_count": len(held_out_improvements),
        "musical_fixtures_improved": sum(musical_improvements),
        "musical_fixture_count": len(musical_improvements),
        "production_recommendation": (
            "Prototype the winning wrapper inside a latency-reporting production seam, "
            "then rerun the complete Enhancer contract and Ableton validation. Do not "
            "change the recovered bell or shaper laws."
            if passed
            else (
                "Retain this as the leading wrapper hypothesis, but do not call it a "
                "finished match. Resolve the measured component-level residual and the "
                "latency contract before changing production DSP."
                if promising
                else "Do not promote this JUCE wrapper. Continue identifying the split "
                "upsampler/downsampler response before changing production DSP."
            )
        ),
        "decision_required": (
            f"The winner has {latency:.6g} samples of wrapper latency and requires a "
            f"{host_latency}-sample integer host report. Matching its pre-response "
            "requires delaying dry audio and reporting that latency to the host; "
            "that conflicts with T26's current literal zero-latency/bit-identical-dry "
            "contract and needs Andrew's approval before production integration."
        ),
    }


def main() -> int:
    for required in (
        reference.AU_PATH,
        reference.VST3_PATH,
        reference.LICENSE_PATH,
        uncertainty.COSIMO_VST3_PATH,
        uncertainty.COSIMO_BINARY_PATH,
    ):
        if not required.exists():
            raise FileNotFoundError(required)

    compile_probe()
    RESULT_ROOT.mkdir(parents=True, exist_ok=True)

    session = reference.SpectreSession()
    print("capturing Spectre Good clean impulse", flush=True)
    _, _, _, impulse_report, impulse_rows = impulse_experiment(session)
    print("capturing nonlinear training tones", flush=True)
    training_targets = capture_tone_targets(session, TRAINING_TONES_HZ)
    winner, ranking = rank_candidates(impulse_rows, training_targets)
    winner_row = next(row for row in ranking if row["candidate"]["id"] == winner.id)
    advance = float(winner_row["clean_impulse"]["production_host_advance_samples"])
    print(f"locked winner before holdouts: {winner.id}", flush=True)

    print("revealing held-out tones", flush=True)
    held_out_targets = capture_tone_targets(session, HELD_OUT_TONES_HZ)
    held_out = evaluate_held_out_tones(winner, advance, held_out_targets)
    print("decomposing shaped and de-emphasis paths", flush=True)
    all_tone_targets = {**training_targets, **held_out_targets}
    decomposition = de_emphasis_decomposition(
        session, winner, advance, all_tone_targets
    )
    print("rendering held-out musical A/Bs", flush=True)
    musical = musical_experiment(session, winner, advance)

    report: dict[str, Any] = {
        "schema": "cosimo.enhancer-wrapper-prototype.v1",
        "question": (
            "Can a pinned JUCE 7.0.1 4x oversampler reproduce Spectre 1.5.6 "
            "Good's wrapper closely enough to replace the current Cmajor wrapper "
            "without changing the recovered bell or shaper laws?"
        ),
        "prototype_only": True,
        "provenance": {
            "git_head_before_prototype_commit": uncertainty.git_head(),
            "juce_repository": JUCE_REPOSITORY,
            "juce_tag": JUCE_TAG,
            "juce_commit": JUCE_COMMIT,
            "probe_sha256": sha256_file(PROBE),
            "spectre": reference.plugin_metadata(),
            "spectre_target_mode": "Medium",
            "spectre_target_quality": "Good",
            "cosimo_binary_sha256": sha256_file(uncertainty.COSIMO_BINARY_PATH),
            "sample_rate": SAMPLE_RATE,
        },
        "selection_protocol": {
            "training_tones_hz": list(TRAINING_TONES_HZ),
            "held_out_tones_hz": list(HELD_OUT_TONES_HZ),
            "ranking": (
                "Mean normalized error power across one clean impulse and three "
                "nonlinear training tones. Each candidate uses one static host advance "
                "fit from the clean impulse; nonlinear probes cannot refit timing."
            ),
            "musical_holdouts": ["pink", "drums", "bass", "bright-poly"],
        },
        "clean_impulse_target": impulse_report,
        "candidate_ranking": ranking,
        "winner": asdict(winner),
        "held_out_tones": held_out,
        "de_emphasis_decomposition": decomposition,
        "musical_holdouts": musical,
    }
    report["recommendation"] = recommendation(
        winner_row, held_out, musical
    )
    reference.write_json(RESULT_ROOT / "report.json", report)

    summary = {
        "winner": winner.id,
        "reported_latency_samples": winner_row["clean_impulse"][
            "reported_latency_samples"
        ],
        "production_host_advance_samples": advance,
        "fitted_diagnostic_advance_samples": winner_row["clean_impulse"][
            "fitted_host_advance_samples"
        ],
        "held_out": [
            {
                "frequency_hz": row["frequency_hz"],
                "current_error_db": row["current_vs_spectre_good"][
                    "error_relative_to_target_db"
                ],
                "winner_error_db": row["winner_vs_spectre_good"][
                    "error_relative_to_target_db"
                ],
                "winner_correlation": row["winner_vs_spectre_good"]["correlation"],
            }
            for row in held_out
        ],
        "musical": [
            {
                "fixture": row["fixture"],
                "current_error_db": row["current_vs_spectre_good"][
                    "error_relative_to_target_db"
                ],
                "winner_error_db": row["winner_vs_spectre_good"][
                    "error_relative_to_target_db"
                ],
                "current_correlation": row["current_vs_spectre_good"][
                    "correlation"
                ],
                "winner_correlation": row["winner_vs_spectre_good"]["correlation"],
            }
            for row in musical
        ],
        "recommendation": report["recommendation"],
    }
    print(json.dumps(summary, indent=2, sort_keys=True), flush=True)
    print(f"wrote {RESULT_ROOT / 'report.json'}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
