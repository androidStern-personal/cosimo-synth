#!/usr/bin/env python3
"""Capture and infer Wavesfactory Spectre Low/High Shelf behaviour.

This is an offline black-box research harness.  It extends the existing T26
Spectre corpus infrastructure rather than embedding any Spectre code or audio.
Raw input/output audio, reports, and listening files stay below ignored build/;
only this deterministic procedure and a compact derived lock-in fixture belong
in source control.

The harness keeps three boundaries explicit:

* observations are direct plug-in renders and effective host parameter values;
* inference compares those renders with named candidate shelf equations;
* product comparison is deferred to the separate Enhancer Lite renderer.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
from scipy import optimize

import measure_spectre_reference as reference


DEFAULT_OUTPUT = reference.REPO_ROOT / "build" / "t26-spectre-shelves"
DEFAULT_SAMPLE_RATE = 48_000
ANALYSIS_FLOOR = 1.0e-30
SHAPES = ("low", "high")
MODES = ("Subtle", "Medium")
COLORS = ("Solid", "Tube")
DESIGN_RATE_FACTORS = (1.0, 2.0, 4.0, 8.0)
SPECTRE_SHAPED_HIGHPASS_HZ = 20.01631809314913
SPECTRE_SHAPED_HIGHPASS_Q = 1.0 / math.sqrt(2.0)
SPECTRE_SHAPED_HIGHPASS_GAIN = 1.0023994109214078


@dataclass(frozen=True)
class LinearCase:
    id: str
    shape: str
    sample_rate: int
    frequency_hz: float
    q: float
    gain_db: float
    stimulus_id: str


@dataclass(frozen=True)
class TransferCase:
    id: str
    shape: str
    sample_rate: int
    frequency_hz: float
    probe_hz: float
    q: float
    gain_db: float
    input_dbfs: float
    mode: str
    color: str
    stimulus_id: str


def rms(signal: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(signal.astype(np.float64)))))


def ratio_db(numerator: float, denominator: float) -> float:
    return reference.gain_to_db(
        max(float(numerator), ANALYSIS_FLOOR)
        / max(float(denominator), ANALYSIS_FLOOR)
    )


def shelf_band_name(shape: str) -> str:
    if shape == "low":
        return "lowshelf"
    if shape == "high":
        return "highshelf"
    raise ValueError(f"unknown shelf shape {shape}")


def shelf_settings(
    shape: str,
    *,
    frequency_hz: float,
    gain_db: float,
    q: float,
    color: str,
    processing: str = "Stereo",
    mode: str = "Subtle",
    quality: str = "Good",
    de_emphasis: bool = False,
    mix: float = 1.0,
) -> dict[str, Any]:
    band = shelf_band_name(shape)
    settings = reference.default_settings()
    settings.update(
        {
            f"{band}_switch": True,
            f"{band}_frequency": frequency_hz,
            f"{band}_gain": gain_db,
            f"{band}_q": q,
            f"{band}_color": color,
            f"{band}_processing": processing,
            "mode": mode,
            "quality": quality,
            "de_emphasis": de_emphasis,
            "dry_wet": mix,
        }
    )
    return settings


def dry_settings(*, quality: str = "Good", mix: float = 0.0) -> dict[str, Any]:
    settings = reference.default_settings()
    settings.update({"quality": quality, "dry_wet": mix})
    return settings


def make_impulse(sample_rate: int) -> tuple[np.ndarray, int]:
    frame_count = sample_rate * 2
    impulse_frame = sample_rate
    audio = np.zeros((2, frame_count), dtype=np.float32)
    audio[:, impulse_frame] = 0.1
    return audio, impulse_frame


def rbj_shelf_difference(
    frequencies_hz: np.ndarray,
    design_sample_rate: float,
    shape: str,
    frequency_hz: float,
    q: float,
    gain_db: float,
) -> np.ndarray:
    """Return H(z)-1 for the RBJ/JUCE Q-form shelf candidate."""

    amplitude = 10.0 ** (gain_db / 40.0)
    omega0 = 2.0 * math.pi * frequency_hz / design_sample_rate
    cosine0 = math.cos(omega0)
    beta = math.sin(omega0) * math.sqrt(amplitude) / q
    plus = amplitude + 1.0
    minus = amplitude - 1.0

    if shape == "low":
        b0 = amplitude * (plus - minus * cosine0 + beta)
        b1 = 2.0 * amplitude * (minus - plus * cosine0)
        b2 = amplitude * (plus - minus * cosine0 - beta)
        a0 = plus + minus * cosine0 + beta
        a1 = -2.0 * (minus + plus * cosine0)
        a2 = plus + minus * cosine0 - beta
    elif shape == "high":
        b0 = amplitude * (plus + minus * cosine0 + beta)
        b1 = -2.0 * amplitude * (minus + plus * cosine0)
        b2 = amplitude * (plus + minus * cosine0 - beta)
        a0 = plus - minus * cosine0 + beta
        a1 = 2.0 * (minus - plus * cosine0)
        a2 = plus - minus * cosine0 - beta
    else:
        raise ValueError(shape)

    omega = 2.0 * math.pi * frequencies_hz / design_sample_rate
    z1 = np.exp(-1j * omega)
    z2 = z1 * z1
    response = (b0 + b1 * z1 + b2 * z2) / (a0 + a1 * z1 + a2 * z2)
    return response - 1.0


def spectre_shaped_conditioning_response(
    frequencies_hz: np.ndarray,
    sample_rate: int,
) -> np.ndarray:
    """Measured Good-mode conditioning applied after shaped reconstruction."""

    omega0 = 2.0 * math.pi * SPECTRE_SHAPED_HIGHPASS_HZ / sample_rate
    cosine0 = math.cos(omega0)
    alpha = math.sin(omega0) / (2.0 * SPECTRE_SHAPED_HIGHPASS_Q)
    a0 = 1.0 + alpha
    b0 = (1.0 + cosine0) * 0.5 / a0
    b1 = -(1.0 + cosine0) / a0
    b2 = b0
    a1 = -2.0 * cosine0 / a0
    a2 = (1.0 - alpha) / a0
    omega = 2.0 * math.pi * frequencies_hz / sample_rate
    z1 = np.exp(-1j * omega)
    z2 = z1 * z1
    return SPECTRE_SHAPED_HIGHPASS_GAIN * (
        (b0 + b1 * z1 + b2 * z2) / (1.0 + a1 * z1 + a2 * z2)
    )


def conditioned_shelf_candidate(
    frequencies_hz: np.ndarray,
    sample_rate: int,
    rate_factor: float,
    shape: str,
    frequency_hz: float,
    q: float,
    gain_db: float,
) -> np.ndarray:
    selection = rbj_shelf_difference(
        frequencies_hz,
        sample_rate * rate_factor,
        shape,
        frequency_hz,
        q,
        gain_db,
    )
    return selection * spectre_shaped_conditioning_response(
        frequencies_hz,
        sample_rate,
    )


def useful_response_mask(
    frequencies_hz: np.ndarray,
    measured: np.ndarray,
    sample_rate: int,
) -> np.ndarray:
    magnitude = np.abs(measured)
    audible = (
        (frequencies_hz >= 20.0)
        & (frequencies_hz <= min(20_000.0, sample_rate * 0.45))
        & np.isfinite(measured.real)
        & np.isfinite(measured.imag)
    )
    peak = max(float(np.max(magnitude[audible])), ANALYSIS_FLOOR)
    return audible & (magnitude >= peak * reference.db_to_gain(-42.0))


def complex_response_error(
    target: np.ndarray,
    candidate: np.ndarray,
    mask: np.ndarray,
) -> dict[str, float]:
    safe_candidate = np.where(
        np.abs(candidate) > ANALYSIS_FLOOR,
        candidate,
        complex(ANALYSIS_FLOOR, 0.0),
    )
    ratio = safe_candidate[mask] / target[mask]
    magnitude_error_db = 20.0 * np.log10(np.maximum(np.abs(ratio), ANALYSIS_FLOOR))
    phase_error_degrees = np.angle(ratio, deg=True)
    return {
        "magnitude_rms_error_db": float(
            np.sqrt(np.mean(np.square(magnitude_error_db)))
        ),
        "magnitude_max_error_db": float(np.max(np.abs(magnitude_error_db))),
        "phase_rms_error_degrees": float(
            np.sqrt(np.mean(np.square(phase_error_degrees)))
        ),
        "phase_max_error_degrees": float(np.max(np.abs(phase_error_degrees))),
        "complex_bins": int(np.count_nonzero(mask)),
    }


def impulse_support(signal: np.ndarray, origin: int) -> dict[str, Any]:
    signal64 = signal.astype(np.float64)
    maximum = float(np.max(np.abs(signal64)))
    threshold = maximum * 1.0e-6
    indices = np.where(np.abs(signal64) >= threshold)[0]
    if indices.size == 0:
        return {
            "relative_threshold": 1.0e-6,
            "first_offset_frames": None,
            "last_offset_frames": None,
            "peak_offset_frames": None,
        }
    return {
        "relative_threshold": 1.0e-6,
        "first_offset_frames": int(indices[0] - origin),
        "last_offset_frames": int(indices[-1] - origin),
        "peak_offset_frames": int(np.argmax(np.abs(signal64)) - origin),
    }


def response_from_impulses(
    wet: np.ndarray,
    dry: np.ndarray,
    amplitude: float,
    sample_rate: int,
) -> tuple[np.ndarray, np.ndarray]:
    fft_size = 1 << (wet.shape[1] - 1).bit_length()
    wet_spectrum = np.fft.rfft(wet[0].astype(np.float64) / amplitude, n=fft_size)
    dry_spectrum = np.fft.rfft(dry[0].astype(np.float64) / amplitude, n=fft_size)
    response = wet_spectrum / np.where(
        np.abs(dry_spectrum) > 1.0e-12,
        dry_spectrum,
        complex(1.0e-12, 0.0),
    )
    frequencies_hz = np.fft.rfftfreq(fft_size, 1.0 / sample_rate)
    return frequencies_hz, response


def fit_case_response(
    case: LinearCase,
    frequencies_hz: np.ndarray,
    measured: np.ndarray,
    rate_factor: float,
) -> dict[str, Any]:
    mask = useful_response_mask(frequencies_hz, measured, case.sample_rate)

    def residual(parameters: np.ndarray) -> np.ndarray:
        frequency_hz = case.frequency_hz * math.exp(float(parameters[0]))
        q = case.q * math.exp(float(parameters[1]))
        candidate = conditioned_shelf_candidate(
            frequencies_hz,
            case.sample_rate,
            rate_factor,
            case.shape,
            frequency_hz,
            q,
            case.gain_db,
        )
        ratio = candidate[mask] / measured[mask]
        magnitude_db = 20.0 * np.log10(
            np.maximum(np.abs(ratio), ANALYSIS_FLOOR)
        )
        phase_radians = np.angle(ratio)
        return np.concatenate((magnitude_db, phase_radians * 4.0))

    fitted = optimize.least_squares(
        residual,
        np.zeros(2, dtype=np.float64),
        bounds=(np.log((0.5, 0.05)), np.log((2.0, 20.0))),
        max_nfev=1_000,
        xtol=1.0e-12,
        ftol=1.0e-12,
        gtol=1.0e-12,
    )
    fitted_frequency = case.frequency_hz * math.exp(float(fitted.x[0]))
    fitted_q = case.q * math.exp(float(fitted.x[1]))
    direct = conditioned_shelf_candidate(
        frequencies_hz,
        case.sample_rate,
        rate_factor,
        case.shape,
        case.frequency_hz,
        case.q,
        case.gain_db,
    )
    fitted_candidate = conditioned_shelf_candidate(
        frequencies_hz,
        case.sample_rate,
        rate_factor,
        case.shape,
        fitted_frequency,
        fitted_q,
        case.gain_db,
    )
    return {
        "direct_display_values": complex_response_error(measured, direct, mask),
        "fitted_frequency_q": complex_response_error(
            measured, fitted_candidate, mask
        ),
        "fitted_frequency_hz": fitted_frequency,
        "fitted_frequency_ratio": fitted_frequency / case.frequency_hz,
        "fitted_q": fitted_q,
        "fitted_q_ratio": fitted_q / case.q,
    }


def plateau_gain(
    case: LinearCase,
    frequencies_hz: np.ndarray,
    measured: np.ndarray,
) -> dict[str, float]:
    if case.shape == "low":
        mask = (frequencies_hz >= 20.0) & (
            frequencies_hz <= max(20.0, case.frequency_hz / 8.0)
        )
    else:
        mask = (frequencies_hz >= min(20_000.0, case.frequency_hz * 8.0)) & (
            frequencies_hz <= min(20_000.0, case.sample_rate * 0.45)
        )
    if not np.any(mask):
        return {
            "measured": float("nan"),
            "selection_expected_before_conditioning": float("nan"),
            "conditioned_expected": float("nan"),
            "error_db": float("nan"),
        }
    measured_plateau = float(np.median(np.abs(measured[mask])))
    selection_expected = reference.db_to_gain(case.gain_db) - 1.0
    candidate = conditioned_shelf_candidate(
        frequencies_hz,
        case.sample_rate,
        4.0,
        case.shape,
        case.frequency_hz,
        case.q,
        case.gain_db,
    )
    conditioned_expected = float(np.median(np.abs(candidate[mask])))
    return {
        "measured": measured_plateau,
        "selection_expected_before_conditioning": selection_expected,
        "conditioned_expected": conditioned_expected,
        "error_db": ratio_db(measured_plateau, conditioned_expected),
    }


def response_anchors(
    case: LinearCase,
    frequencies_hz: np.ndarray,
    measured: np.ndarray,
    rate_factor: float,
) -> list[dict[str, float]]:
    requested = (
        20.0,
        max(20.0, case.frequency_hz / 4.0),
        case.frequency_hz,
        min(20_000.0, case.frequency_hz * 4.0),
        min(20_000.0, case.sample_rate * 0.45),
    )
    candidate = conditioned_shelf_candidate(
        frequencies_hz,
        case.sample_rate,
        rate_factor,
        case.shape,
        case.frequency_hz,
        case.q,
        case.gain_db,
    )
    rows = []
    seen_indices: set[int] = set()
    for frequency_hz in requested:
        index = int(np.argmin(np.abs(frequencies_hz - frequency_hz)))
        if index in seen_indices:
            continue
        seen_indices.add(index)
        rows.append(
            {
                "frequency_hz": float(frequencies_hz[index]),
                "measured_magnitude_db": reference.gain_to_db(
                    float(abs(measured[index]))
                ),
                "measured_phase_degrees": float(np.angle(measured[index], deg=True)),
                "candidate_magnitude_db": reference.gain_to_db(
                    float(abs(candidate[index]))
                ),
                "candidate_phase_degrees": float(np.angle(candidate[index], deg=True)),
            }
        )
    return rows


def harmonic_peaks(
    audio: np.ndarray,
    sample_rate: int,
    frequency_hz: float,
    start_seconds: float = 1.0,
    harmonic_count: int = 20,
) -> list[float]:
    start_frame = int(round(start_seconds * sample_rate))
    frame_count = sample_rate
    mid = 0.5 * (audio[0].astype(np.float64) + audio[1].astype(np.float64))
    count = min(harmonic_count, int((sample_rate * 0.49) // frequency_hz))
    return [
        abs(
            reference.complex_tone_coefficient(
                mid,
                sample_rate,
                frequency_hz * harmonic,
                start_frame,
                frame_count,
            )
        )
        for harmonic in range(1, count + 1)
    ]


def predicted_shaper_harmonics(
    band_peak: float,
    mode: str,
    color: str,
    harmonic_count: int,
) -> np.ndarray:
    drive = 3.0 if mode == "Subtle" else 6.0
    output = 1.0 / math.sqrt(2.0) if mode == "Subtle" else 0.5
    bias = 0.0 if color == "Solid" else (0.125 if mode == "Subtle" else 0.3125)
    phase = np.arange(4_800, dtype=np.float64) * (2.0 * math.pi / 4_800.0)
    waveform = output * (
        np.tanh(drive * band_peak * np.sin(phase) + bias) - math.tanh(bias)
    )
    waveform -= np.mean(waveform)
    return np.abs(np.fft.rfft(waveform) / (phase.size / 2.0))[1 : harmonic_count + 1]


def shaper_error(
    clean_peaks: list[float],
    shaped_peaks: list[float],
    mode: str,
    color: str,
) -> dict[str, Any]:
    count = min(len(clean_peaks), len(shaped_peaks), 20)
    predicted = predicted_shaper_harmonics(clean_peaks[0], mode, color, count)
    measured = np.asarray(shaped_peaks[:count], dtype=np.float64)
    valid = (measured >= reference.db_to_gain(-115.0)) & (predicted > 0.0)
    errors_db = 20.0 * np.log10(predicted[valid] / measured[valid])
    return {
        "retained_harmonic_points": int(np.count_nonzero(valid)),
        "rms_error_db": float(np.sqrt(np.mean(np.square(errors_db)))),
        "maximum_error_db": float(np.max(np.abs(errors_db))),
        "measured_harmonic_peaks": [float(value) for value in measured],
        "predicted_harmonic_peaks": [float(value) for value in predicted],
    }


def add_stimuli(builder: reference.CorpusBuilder, quick: bool) -> None:
    for sample_rate in (44_100, 48_000, 96_000, 192_000):
        impulse, _ = make_impulse(sample_rate)
        builder.add_stimulus(
            reference.Stimulus(
                id=f"shelf-impulse-{sample_rate}",
                sample_rate=sample_rate,
                audio=impulse,
                analysis_start_seconds=0.0,
            )
        )

    transfer_levels = (-30.0, -18.0) if quick else (-30.0, -18.0, -6.0)
    transfer_specs = (("low", 2_000.0, 100.0), ("high", 20.0, 100.0))
    for shape, _, probe_hz in transfer_specs:
        for level in transfer_levels:
            builder.add_stimulus(
                reference.Stimulus(
                    id=f"shelf-transfer-{shape}-{probe_hz:g}hz-{level:g}db-48k",
                    sample_rate=48_000,
                    audio=reference.make_sine(48_000, probe_hz, level),
                    sine_frequency_hz=probe_hz,
                )
            )

    for shape, centre_hz, probe_hz in (("low", 12_000.0, 9_000.0), ("high", 6_000.0, 9_000.0)):
        builder.add_stimulus(
            reference.Stimulus(
                id=f"shelf-alias-{shape}-{probe_hz:g}hz-48k",
                sample_rate=48_000,
                audio=reference.make_sine(48_000, probe_hz, -12.0),
                sine_frequency_hz=probe_hz,
            )
        )

    for routing in ("mid", "side", "left", "right"):
        builder.add_stimulus(
            reference.Stimulus(
                id=f"shelf-routing-1k-{routing}-48k",
                sample_rate=48_000,
                audio=reference.make_sine(48_000, 1_000.0, -18.0, routing=routing),
                sine_frequency_hz=1_000.0,
            )
        )

    music_duration = 2.5 if quick else 4.0
    builder.add_stimulus(
        reference.Stimulus(
            "shelf-music-pink-48k",
            48_000,
            reference.make_pink(48_000, -18.0, duration_seconds=music_duration),
        )
    )
    builder.add_stimulus(
        reference.Stimulus(
            "shelf-music-drums-48k",
            48_000,
            reference.make_drums(48_000, -18.0, duration_seconds=music_duration),
        )
    )
    builder.add_stimulus(
        reference.Stimulus(
            "shelf-music-bass-48k",
            48_000,
            reference.make_bass(48_000, -18.0, duration_seconds=music_duration),
        )
    )
    builder.add_stimulus(
        reference.Stimulus(
            "shelf-music-bright-poly-48k",
            48_000,
            reference.make_bright_poly(48_000, -18.0, duration_seconds=music_duration),
        )
    )


def add_linear_cases(
    builder: reference.CorpusBuilder,
    quick: bool,
) -> list[LinearCase]:
    cases: list[LinearCase] = []
    for sample_rate in (44_100, 48_000, 96_000, 192_000):
        builder.add_case(
            reference.RenderCase(
                id=f"shelf-dry-impulse-{sample_rate}",
                group="linear-dry",
                stimulus_id=f"shelf-impulse-{sample_rate}",
                settings=dry_settings(),
                save_audio=True,
            )
        )

    frequencies = {
        "low": (200.0, 1_000.0, 5_000.0),
        "high": (500.0, 3_000.0, 10_000.0),
    }
    q_values = (0.3, 0.7, 2.0) if quick else (0.3, 0.7, 1.0, 2.0, 8.0)
    gains = (6.0, 12.0) if quick else (3.0, 6.0, 12.0)
    for shape in SHAPES:
        for frequency_hz in frequencies[shape]:
            for q in q_values:
                for gain_db in gains:
                    case = LinearCase(
                        id=(
                            f"shelf-linear-{shape}-f{frequency_hz:g}"
                            f"-q{q:g}-g{gain_db:g}-48000"
                        ),
                        shape=shape,
                        sample_rate=48_000,
                        frequency_hz=frequency_hz,
                        q=q,
                        gain_db=gain_db,
                        stimulus_id="shelf-impulse-48000",
                    )
                    cases.append(case)
                    builder.add_case(
                        reference.RenderCase(
                            id=case.id,
                            group="linear-shelf",
                            stimulus_id=case.stimulus_id,
                            settings=shelf_settings(
                                shape,
                                frequency_hz=frequency_hz,
                                gain_db=gain_db,
                                q=q,
                                color="Clean",
                            ),
                        )
                    )

    for shape, frequency_hz in (("low", 1_000.0), ("high", 3_000.0)):
        for sample_rate in (44_100, 96_000, 192_000):
            case = LinearCase(
                id=f"shelf-linear-rate-{shape}-{sample_rate}",
                shape=shape,
                sample_rate=sample_rate,
                frequency_hz=frequency_hz,
                q=0.7,
                gain_db=9.0,
                stimulus_id=f"shelf-impulse-{sample_rate}",
            )
            cases.append(case)
            builder.add_case(
                reference.RenderCase(
                    id=case.id,
                    group="linear-sample-rate",
                    stimulus_id=case.stimulus_id,
                    settings=shelf_settings(
                        shape,
                        frequency_hz=frequency_hz,
                        gain_db=9.0,
                        q=0.7,
                        color="Clean",
                    ),
                )
            )
    return cases


def add_transfer_cases(
    builder: reference.CorpusBuilder,
    quick: bool,
) -> list[TransferCase]:
    cases: list[TransferCase] = []
    levels = (-30.0, -18.0) if quick else (-30.0, -18.0, -6.0)
    gains = (6.0, 12.0) if quick else (3.0, 6.0, 9.0, 12.0)
    for shape, frequency_hz, probe_hz in (
        ("low", 2_000.0, 100.0),
        ("high", 20.0, 100.0),
    ):
        for gain_db in gains:
            for input_dbfs in levels:
                stimulus_id = (
                    f"shelf-transfer-{shape}-{probe_hz:g}hz-{input_dbfs:g}db-48k"
                )
                clean_id = (
                    f"shelf-transfer-{shape}-clean-g{gain_db:g}-i{input_dbfs:g}"
                )
                builder.add_case(
                    reference.RenderCase(
                        id=clean_id,
                        group="transfer-clean",
                        stimulus_id=stimulus_id,
                        settings=shelf_settings(
                            shape,
                            frequency_hz=frequency_hz,
                            gain_db=gain_db,
                            q=0.7,
                            color="Clean",
                            mix=1.0,
                        ),
                    )
                )
                for mode in MODES:
                    for color in COLORS:
                        case = TransferCase(
                            id=(
                                f"shelf-transfer-{shape}-{mode.lower()}-{color.lower()}"
                                f"-g{gain_db:g}-i{input_dbfs:g}"
                            ),
                            shape=shape,
                            sample_rate=48_000,
                            frequency_hz=frequency_hz,
                            probe_hz=probe_hz,
                            q=0.7,
                            gain_db=gain_db,
                            input_dbfs=input_dbfs,
                            mode=mode,
                            color=color,
                            stimulus_id=stimulus_id,
                        )
                        cases.append(case)
                        builder.add_case(
                            reference.RenderCase(
                                id=case.id,
                                group="transfer-shaped",
                                stimulus_id=stimulus_id,
                                settings=shelf_settings(
                                    shape,
                                    frequency_hz=frequency_hz,
                                    gain_db=gain_db,
                                    q=0.7,
                                    color=color,
                                    mode=mode,
                                    mix=1.0,
                                ),
                            )
                        )
    return cases


def add_routing_cases(builder: reference.CorpusBuilder) -> None:
    for shape in SHAPES:
        for input_routing in ("mid", "side", "left", "right"):
            for processing in ("Stereo", "Mid", "Side"):
                builder.add_case(
                    reference.RenderCase(
                        id=(
                            f"shelf-routing-{shape}-input-{input_routing}"
                            f"-process-{processing.lower()}"
                        ),
                        group="routing",
                        stimulus_id=f"shelf-routing-1k-{input_routing}-48k",
                        settings=shelf_settings(
                            shape,
                            frequency_hz=2_000.0 if shape == "low" else 200.0,
                            gain_db=9.0,
                            q=0.7,
                            color="Tube",
                            processing=processing,
                            mode="Medium",
                            mix=0.5,
                        ),
                    )
                )


def add_alias_cases(builder: reference.CorpusBuilder) -> None:
    for shape, frequency_hz in (("low", 12_000.0), ("high", 6_000.0)):
        for color in COLORS:
            builder.add_case(
                reference.RenderCase(
                    id=f"shelf-alias-{shape}-{color.lower()}",
                    group="alias",
                    stimulus_id=f"shelf-alias-{shape}-9000hz-48k",
                    settings=shelf_settings(
                        shape,
                        frequency_hz=frequency_hz,
                        gain_db=12.0,
                        q=0.7,
                        color=color,
                        mode="Medium",
                        mix=1.0,
                    ),
                )
            )


def add_music_cases(builder: reference.CorpusBuilder, quick: bool) -> None:
    stimuli = (
        "shelf-music-pink-48k",
        "shelf-music-drums-48k",
        "shelf-music-bass-48k",
        "shelf-music-bright-poly-48k",
    )
    for stimulus_id in stimuli:
        builder.add_case(
            reference.RenderCase(
                id=f"shelf-music-dry-{stimulus_id}",
                group="music-dry",
                stimulus_id=stimulus_id,
                settings=dry_settings(mix=0.5),
                save_audio=True,
            )
        )
        for shape in SHAPES:
            for mode in MODES:
                colors = ("Solid",) if quick else COLORS
                for color in colors:
                    builder.add_case(
                        reference.RenderCase(
                            id=(
                                f"shelf-music-{shape}-{mode.lower()}-{color.lower()}"
                                f"-{stimulus_id}"
                            ),
                            group="music-shaped",
                            stimulus_id=stimulus_id,
                            settings=shelf_settings(
                                shape,
                                frequency_hz=180.0 if shape == "low" else 6_000.0,
                                gain_db=9.0,
                                q=0.7,
                                color=color,
                                mode=mode,
                                mix=0.5,
                            ),
                            save_audio=True,
                        )
                    )


def analyse_linear(
    builder: reference.CorpusBuilder,
    cases: list[LinearCase],
) -> dict[str, Any]:
    measurements = {row["id"]: row for row in builder.rows}
    model_cases: dict[str, LinearCase] = {}
    for case in cases:
        band = shelf_band_name(case.shape)
        effective = measurements[case.id]["effective_parameters"]
        model_cases[case.id] = LinearCase(
            **{
                **asdict(case),
                "frequency_hz": float(effective[f"{band}_frequency"]["display"]),
                "q": float(effective[f"{band}_q"]["display"]),
                "gain_db": float(effective[f"{band}_gain"]["display"]),
            }
        )

    by_rate: dict[int, np.ndarray] = {}
    impulse_origins: dict[int, int] = {}
    dry_support: dict[str, Any] = {}
    for sample_rate in (44_100, 48_000, 96_000, 192_000):
        dry = builder.outputs[f"shelf-dry-impulse-{sample_rate}"]
        by_rate[sample_rate] = dry
        _, origin = make_impulse(sample_rate)
        impulse_origins[sample_rate] = origin
        dry_support[str(sample_rate)] = impulse_support(dry[0], origin)

    responses: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    factor_scores: dict[str, Any] = {}
    for factor in DESIGN_RATE_FACTORS:
        rows = []
        for case in cases:
            model_case = model_cases[case.id]
            wet = builder.outputs[case.id]
            frequencies_hz, measured = response_from_impulses(
                wet,
                by_rate[case.sample_rate],
                0.1,
                case.sample_rate,
            )
            responses[case.id] = (frequencies_hz, measured)
            mask = useful_response_mask(frequencies_hz, measured, case.sample_rate)
            candidate = conditioned_shelf_candidate(
                frequencies_hz,
                case.sample_rate,
                factor,
                case.shape,
                model_case.frequency_hz,
                model_case.q,
                model_case.gain_db,
            )
            rows.append(complex_response_error(measured, candidate, mask))
        factor_scores[str(factor)] = {
            "mean_magnitude_rms_error_db": float(
                np.mean([row["magnitude_rms_error_db"] for row in rows])
            ),
            "worst_magnitude_rms_error_db": float(
                max(row["magnitude_rms_error_db"] for row in rows)
            ),
            "mean_phase_rms_error_degrees": float(
                np.mean([row["phase_rms_error_degrees"] for row in rows])
            ),
            "worst_phase_rms_error_degrees": float(
                max(row["phase_rms_error_degrees"] for row in rows)
            ),
        }

    selected_factor = min(
        DESIGN_RATE_FACTORS,
        key=lambda factor: (
            factor_scores[str(factor)]["mean_magnitude_rms_error_db"]
            + factor_scores[str(factor)]["mean_phase_rms_error_degrees"] / 10.0
        ),
    )
    rows = []
    for case in cases:
        model_case = model_cases[case.id]
        frequencies_hz, measured = responses[case.id]
        row = measurements[case.id]
        band = shelf_band_name(case.shape)
        rows.append(
            {
                "case": asdict(case),
                "effective_parameters": {
                    "frequency": row["effective_parameters"][f"{band}_frequency"],
                    "q": row["effective_parameters"][f"{band}_q"],
                    "gain": row["effective_parameters"][f"{band}_gain"],
                },
                "plateau": plateau_gain(model_case, frequencies_hz, measured),
                "fit": fit_case_response(
                    model_case,
                    frequencies_hz,
                    measured,
                    selected_factor,
                ),
                "response_anchors": response_anchors(
                    model_case,
                    frequencies_hz,
                    measured,
                    selected_factor,
                ),
                "impulse_support": impulse_support(
                    builder.outputs[case.id][0], impulse_origins[case.sample_rate]
                ),
            }
        )

    return {
        "candidate": "RBJ/JUCE Q-form shelf difference H(z)-1",
        "rate_factor_ranking": factor_scores,
        "selected_design_rate_factor": selected_factor,
        "dry_impulse_support": dry_support,
        "rows": rows,
        "summary": {
            "worst_direct_magnitude_rms_error_db": max(
                row["fit"]["direct_display_values"]["magnitude_rms_error_db"]
                for row in rows
            ),
            "worst_direct_phase_rms_error_degrees": max(
                row["fit"]["direct_display_values"]["phase_rms_error_degrees"]
                for row in rows
            ),
            "fitted_frequency_ratio_range": [
                min(row["fit"]["fitted_frequency_ratio"] for row in rows),
                max(row["fit"]["fitted_frequency_ratio"] for row in rows),
            ],
            "fitted_q_ratio_range": [
                min(row["fit"]["fitted_q_ratio"] for row in rows),
                max(row["fit"]["fitted_q_ratio"] for row in rows),
            ],
            "worst_plateau_gain_error_db": max(
                abs(row["plateau"]["error_db"])
                for row in rows
                if math.isfinite(row["plateau"]["error_db"])
            ),
        },
    }


def analyse_transfer(
    builder: reference.CorpusBuilder,
    cases: list[TransferCase],
) -> dict[str, Any]:
    rows = []
    for case in cases:
        clean_id = (
            f"shelf-transfer-{case.shape}-clean-g{case.gain_db:g}"
            f"-i{case.input_dbfs:g}"
        )
        clean_peaks = harmonic_peaks(
            builder.outputs[clean_id],
            case.sample_rate,
            case.probe_hz,
        )
        shaped_peaks = harmonic_peaks(
            builder.outputs[case.id],
            case.sample_rate,
            case.probe_hz,
        )
        rows.append(
            {
                "case": asdict(case),
                "clean_selected_peak": clean_peaks[0],
                "shaper_model": shaper_error(
                    clean_peaks,
                    shaped_peaks,
                    case.mode,
                    case.color,
                ),
            }
        )
    return {
        "model": {
            "Subtle Solid": "tanh(3*x)/sqrt(2)",
            "Subtle Tube": "(tanh(3*x+0.125)-tanh(0.125))/sqrt(2)",
            "Medium Solid": "tanh(6*x)/2",
            "Medium Tube": "(tanh(6*x+0.3125)-tanh(0.3125))/2",
        },
        "rows": rows,
        "summary": {
            "worst_rms_error_db": max(
                row["shaper_model"]["rms_error_db"] for row in rows
            ),
            "worst_point_error_db": max(
                row["shaper_model"]["maximum_error_db"] for row in rows
            ),
        },
    }


def analyse_routing(builder: reference.CorpusBuilder) -> list[dict[str, Any]]:
    measurements = {row["id"]: row for row in builder.rows}
    rows = []
    for shape in SHAPES:
        for input_routing in ("mid", "side", "left", "right"):
            for processing in ("stereo", "mid", "side"):
                row = measurements[
                    f"shelf-routing-{shape}-input-{input_routing}"
                    f"-process-{processing}"
                ]
                rows.append(
                    {
                        "shape": shape,
                        "input_routing": input_routing,
                        "processing": processing,
                        "left_rms_dbfs": row["metrics"]["left_rms_dbfs"],
                        "right_rms_dbfs": row["metrics"]["right_rms_dbfs"],
                        "mid_rms_dbfs": row["metrics"]["mid_rms_dbfs"],
                        "side_rms_dbfs": row["metrics"]["side_rms_dbfs"],
                    }
                )
    return rows


def analyse_alias(builder: reference.CorpusBuilder) -> list[dict[str, Any]]:
    rows = []
    for shape in SHAPES:
        for color in COLORS:
            audio = builder.outputs[f"shelf-alias-{shape}-{color.lower()}"]
            fundamental = harmonic_peaks(audio, 48_000, 9_000.0, harmonic_count=1)[0]
            aliases = []
            for harmonic in (3, 5):
                remainder = (9_000.0 * harmonic) % 48_000.0
                folded_hz = 48_000.0 - remainder if remainder > 24_000.0 else remainder
                coefficient = abs(
                    reference.complex_tone_coefficient(
                        0.5 * (audio[0].astype(np.float64) + audio[1].astype(np.float64)),
                        48_000,
                        folded_hz,
                        48_000,
                        48_000,
                    )
                )
                aliases.append(
                    {
                        "harmonic": harmonic,
                        "folded_hz": folded_hz,
                        "alias_dbc": ratio_db(coefficient, fundamental),
                    }
                )
            rows.append({"shape": shape, "color": color, "aliases": aliases})
    return rows


def build_listening_bundle(
    builder: reference.CorpusBuilder,
    quick: bool,
) -> list[dict[str, Any]]:
    results = []
    colors = ("Solid",) if quick else COLORS
    for stimulus_id in (
        "shelf-music-pink-48k",
        "shelf-music-drums-48k",
        "shelf-music-bass-48k",
        "shelf-music-bright-poly-48k",
    ):
        dry_id = f"shelf-music-dry-{stimulus_id}"
        dry = builder.outputs[dry_id]
        root = builder.listening_dir / stimulus_id
        dry_path = root / "00-dry.wav"
        reference.write_float_wav(dry_path, 48_000, dry)
        dry_lufs = reference.integrated_lufs(dry_path)
        for shape in SHAPES:
            for mode in MODES:
                for color in colors:
                    case_id = (
                        f"shelf-music-{shape}-{mode.lower()}-{color.lower()}"
                        f"-{stimulus_id}"
                    )
                    output = builder.outputs[case_id]
                    raw_path = root / f"{shape}-{mode.lower()}-{color.lower()}-raw.wav"
                    reference.write_float_wav(raw_path, 48_000, output)
                    output_lufs = reference.integrated_lufs(raw_path)
                    match_db = (
                        dry_lufs - output_lufs
                        if dry_lufs is not None and output_lufs is not None
                        else 0.0
                    )
                    matched = output * reference.db_to_gain(match_db)
                    matched_path = root / (
                        f"{shape}-{mode.lower()}-{color.lower()}-matched.wav"
                    )
                    reference.write_float_wav(
                        matched_path,
                        48_000,
                        matched.astype(np.float32),
                    )
                    results.append(
                        {
                            "case": case_id,
                            "dry_lufs": dry_lufs,
                            "raw_lufs": output_lufs,
                            "static_match_gain_db": match_db,
                            "raw_rms_delta_db": ratio_db(rms(output), rms(dry)),
                            "raw_path": str(raw_path.relative_to(builder.output_root)),
                            "matched_path": str(
                                matched_path.relative_to(builder.output_root)
                            ),
                        }
                    )
    return results


def repeatability_probe(builder: reference.CorpusBuilder) -> dict[str, Any]:
    stimulus = builder.stimuli["shelf-transfer-low-100hz--18db-48k"]
    settings = shelf_settings(
        "low",
        frequency_hz=2_000.0,
        gain_db=9.0,
        q=0.7,
        color="Tube",
        mode="Medium",
        mix=1.0,
    )
    outputs = []
    for _ in range(3):
        session = reference.SpectreSession()
        output, _ = session.process(stimulus.audio, stimulus.sample_rate, settings)
        outputs.append(output)
    differences = [outputs[0].astype(np.float64) - output for output in outputs[1:]]
    return {
        "three_fresh_instances_bit_identical": all(
            np.array_equal(outputs[0], output) for output in outputs[1:]
        ),
        "maximum_absolute_difference": max(
            float(np.max(np.abs(difference))) for difference in differences
        ),
    }


def load_existing_corpus(
    builder: reference.CorpusBuilder,
    output_root: Path,
) -> tuple[int, str]:
    measurements_path = output_root / "measurements.json"
    report_path = output_root / "report.json"
    rows = json.loads(measurements_path.read_text(encoding="utf-8"))
    previous_report = json.loads(report_path.read_text(encoding="utf-8"))
    by_id = {row["id"]: row for row in rows}
    if set(by_id) != {case.id for case in builder.cases}:
        raise RuntimeError(
            "existing shelf corpus case IDs do not match the current measurement plan"
        )
    for case in builder.cases:
        relative_path = by_id[case.id]["output_path"]
        if not relative_path:
            raise RuntimeError(
                f"existing case {case.id} has no saved audio; recapture without --metrics-only"
            )
        sample_rate, audio = reference.read_float_wav(output_root / relative_path)
        expected_rate = builder.stimuli[case.stimulus_id].sample_rate
        if sample_rate != expected_rate:
            raise RuntimeError(
                f"existing case {case.id} is {sample_rate} Hz, expected {expected_rate} Hz"
            )
        builder.outputs[case.id] = audio
    builder.rows = rows
    return (
        int(previous_report["corpus"]["session_count"]),
        str(previous_report["corpus"]["audio_policy"]),
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--quick", action="store_true")
    parser.add_argument(
        "--analyse-existing",
        action="store_true",
        help="reuse a complete all-audio corpus at --output without rerendering Spectre",
    )
    parser.add_argument(
        "--metrics-only",
        action="store_true",
        help="save only curated listening and explicitly marked audio",
    )
    args = parser.parse_args()

    for required_path in (
        reference.AU_PATH,
        reference.VST3_PATH,
        reference.LICENSE_PATH,
    ):
        if not required_path.exists():
            raise FileNotFoundError(required_path)

    output_root = args.output.resolve()
    builder = reference.CorpusBuilder(
        output_root,
        save_all_audio=not args.metrics_only,
    )
    add_stimuli(builder, args.quick)
    linear_cases = add_linear_cases(builder, args.quick)
    transfer_cases = add_transfer_cases(builder, args.quick)
    add_routing_cases(builder)
    add_alias_cases(builder)
    add_music_cases(builder, args.quick)

    if args.analyse_existing:
        print(f"loading existing Spectre shelf corpus from {output_root}", flush=True)
        session_count, audio_policy = load_existing_corpus(builder, output_root)
    else:
        print(
            f"capturing {len(builder.cases)} Spectre shelf cases to {output_root}",
            flush=True,
        )
        builder.render()
        session_count = builder.session.session_count
        audio_policy = (
            "all renders saved" if not args.metrics_only else "curated audio only"
        )
    print("inferring linear shelf topology", flush=True)
    linear = analyse_linear(builder, linear_cases)
    print("checking shelf/shaper interaction", flush=True)
    transfer = analyse_transfer(builder, transfer_cases)
    print("building level-matched shelf listening bundle", flush=True)
    listening = build_listening_bundle(builder, args.quick)

    report = {
        "schema": "cosimo.spectre-shelves-blackbox.v1",
        "provenance": {
            "spectre": reference.plugin_metadata(),
            "measurement_script": str(Path(__file__).relative_to(reference.REPO_ROOT)),
            "session_audio_limit_seconds": reference.SESSION_AUDIO_LIMIT_SECONDS,
            "authorization_boundary": (
                "The activated license file is present. Every headless render session "
                "is still restarted before 40 seconds so a historical headless-host "
                "demo-window quirk cannot contaminate the corpus."
            ),
        },
        "corpus": {
            "case_count": len(builder.rows),
            "stimulus_count": len(builder.stimuli),
            "session_count": session_count,
            "rows_path": "measurements.json",
            "audio_policy": audio_policy,
        },
        "repeatability": repeatability_probe(builder),
        "linear_selection": linear,
        "distortion_interaction": transfer,
        "routing": analyse_routing(builder),
        "aliasing": analyse_alias(builder),
        "listening_bundle": listening,
        "inference_boundary": {
            "decoded_facts": (
                "Effective host values, impulse responses, spectra, channel metrics, "
                "harmonics, and fresh-instance equality are direct observations."
            ),
            "inference": (
                "The selected RBJ/JUCE H(z)-1 model and design-rate factor are chosen "
                "only by the reported complex-response ranking."
            ),
            "remaining_ambiguity": (
                "Black-box equivalence cannot establish source implementation identity. "
                "The later Lite comparison must separately include its faster IIR "
                "wrapper, rational shaper, and shaped-path high-pass deviations."
            ),
        },
    }
    reference.write_json(output_root / "measurements.json", builder.rows)
    reference.write_json(output_root / "report.json", report)
    print(
        json.dumps(
            {
                "report": str((output_root / "report.json").relative_to(reference.REPO_ROOT)),
                "cases": len(builder.rows),
                "sessions": session_count,
                "repeatable": report["repeatability"][
                    "three_fresh_instances_bit_identical"
                ],
                "linear_summary": linear["summary"],
                "distortion_summary": transfer["summary"],
            },
            indent=2,
            sort_keys=True,
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
