#!/usr/bin/env python3
"""Resolve the largest remaining Spectre/Enhancer matching uncertainties.

This is an offline black-box research tool.  It deliberately separates four
questions that magnitude-only sine sweeps cannot answer:

* Does the recovered static Tube/Solid curve predict intermodulation products?
* Does the shaper have meaningful signal-history dependence?
* Are the linear bells different, or is there a common resampling wrapper?
* Which measured difference moves complete musical renders the most?

The activated Spectre plug-in and the currently installed Cosimo Enhancer VST3
are rendered side by side.  Raw audio and the full report remain under build/;
only the deterministic measurement procedure belongs in source control.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import measure_spectre_reference as reference
import numpy as np
from pedalboard import load_plugin

SAMPLE_RATE = 48_000
DEFAULT_OUTPUT = reference.REPO_ROOT / "build" / "t26-spectre-uncertainty"
COSIMO_VST3_PATH = (
    Path.home() / "Library" / "Audio" / "Plug-Ins" / "VST3" / "CosimoEnhancer.vst3"
)
COSIMO_BINARY_PATH = COSIMO_VST3_PATH / "Contents" / "MacOS" / "CosimoEnhancer"
FREQUENCY_MIN_HZ = 20.0
FREQUENCY_MAX_HZ = 20_000.0
Q_MIN = 0.1
Q_MAX = 10.0
ANALYSIS_FLOOR = 1.0e-30

SHAPER_MODE_MODELS = {
    "Subtle": {
        "drive": 3.0,
        "output_scale": 1.0 / math.sqrt(2.0),
        "tube_bias": 0.125,
    },
    "Medium": {
        "drive": 6.0,
        "output_scale": 0.5,
        "tube_bias": 0.3125,
    },
}


def rms(signal: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(signal.astype(np.float64)))))


def ratio_db(numerator: float, denominator: float) -> float:
    return reference.gain_to_db(
        max(float(numerator), ANALYSIS_FLOOR)
        / max(float(denominator), ANALYSIS_FLOOR)
    )


def git_head() -> str:
    result = subprocess.run(
        ("git", "rev-parse", "HEAD"),
        cwd=reference.REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def normalized_frequency(frequency_hz: float) -> float:
    return (frequency_hz - FREQUENCY_MIN_HZ) / (
        FREQUENCY_MAX_HZ - FREQUENCY_MIN_HZ
    )


def normalized_q(q: float) -> float:
    return (q - Q_MIN) / (Q_MAX - Q_MIN)


def set_raw_parameter(plugin: Any, name: str, value: float) -> None:
    plugin.parameters[name].raw_value = float(value)


def render_cosimo(
    audio: np.ndarray,
    bands: Iterable[dict[str, Any]],
    *,
    saturation_mode: str,
    de_emphasis: float,
) -> np.ndarray:
    """Render the installed isolated Enhancer with physical settings.

    A fresh instance is used for every render.  All stimuli in this script have
    ample leading silence, allowing the module's documented 15 ms parameter
    smoothing to settle before the measured material begins.
    """

    plugin = load_plugin(str(COSIMO_VST3_PATH))
    band_rows = list(bands)
    for index in (1, 2):
        if index <= len(band_rows):
            band = band_rows[index - 1]
            set_raw_parameter(
                plugin,
                f"band_{index}_frequency_hz",
                normalized_frequency(float(band["frequency_hz"])),
            )
            set_raw_parameter(
                plugin,
                f"band_{index}_q",
                normalized_q(float(band["q"])),
            )
            set_raw_parameter(plugin, f"band_{index}_mode", 0.0)
            set_raw_parameter(
                plugin,
                f"band_{index}_amount_mid",
                float(band["amount"]),
            )
            set_raw_parameter(plugin, f"band_{index}_side", 0.0)
            set_raw_parameter(
                plugin,
                f"band_{index}_character",
                1.0 if band["color"] == "Solid" else 0.0,
            )
        else:
            set_raw_parameter(plugin, f"band_{index}_amount_mid", 0.0)
            set_raw_parameter(plugin, f"band_{index}_side", 0.0)
    set_raw_parameter(
        plugin,
        "saturation_mode",
        1.0 if saturation_mode == "Medium" else 0.0,
    )
    set_raw_parameter(plugin, "de_emphasis", de_emphasis)
    set_raw_parameter(plugin, "bypass", 0.0)
    output = plugin.process(
        np.ascontiguousarray(audio, dtype=np.float32),
        SAMPLE_RATE,
        buffer_size=512,
        reset=True,
    )
    return np.ascontiguousarray(output, dtype=np.float32)


def spectre_two_band_settings(
    *, amount: float, mode: str, quality: str = "Good"
) -> dict[str, Any]:
    settings = reference.default_settings()
    settings.update(
        {
            "peak_01_switch": True,
            "peak_01_frequency": 130.0,
            "peak_01_gain": amount * 12.0,
            "peak_01_q": 0.71,
            "peak_01_color": "Solid",
            "peak_01_processing": "Stereo",
            "peak_02_switch": True,
            "peak_02_frequency": 9_000.0,
            "peak_02_gain": amount * 12.0,
            "peak_02_q": 0.71,
            "peak_02_color": "Tube",
            "peak_02_processing": "Stereo",
            "mode": mode,
            "quality": quality,
            "de_emphasis": True,
            # Spectre's measured 50% law is dry + one complete effect output.
            "dry_wet": 0.5,
        }
    )
    return settings


def contribution_comparison(
    target: np.ndarray, candidate: np.ndarray
) -> dict[str, float]:
    target64 = target.astype(np.float64)
    candidate64 = candidate.astype(np.float64)
    error = candidate64 - target64
    target_rms = rms(target64)
    candidate_rms = rms(candidate64)
    denominator = math.sqrt(
        float(np.sum(np.square(target64)))
        * float(np.sum(np.square(candidate64)))
    )
    correlation = (
        float(np.sum(target64 * candidate64)) / denominator
        if denominator > ANALYSIS_FLOOR
        else 1.0
    )

    target_channels = target64[np.newaxis, :] if target64.ndim == 1 else target64
    candidate_channels = (
        candidate64[np.newaxis, :] if candidate64.ndim == 1 else candidate64
    )
    phase_only_errors: list[np.ndarray] = []
    magnitude_only_errors: list[np.ndarray] = []
    for target_channel, candidate_channel in zip(
        target_channels, candidate_channels
    ):
        target_spectrum = np.fft.rfft(target_channel)
        candidate_spectrum = np.fft.rfft(candidate_channel)
        candidate_phase_with_target_magnitude = np.fft.irfft(
            np.abs(target_spectrum) * np.exp(1j * np.angle(candidate_spectrum)),
            n=target_channel.size,
        )
        target_phase_with_candidate_magnitude = np.fft.irfft(
            np.abs(candidate_spectrum) * np.exp(1j * np.angle(target_spectrum)),
            n=target_channel.size,
        )
        phase_only_errors.append(candidate_phase_with_target_magnitude - target_channel)
        magnitude_only_errors.append(
            target_phase_with_candidate_magnitude - target_channel
        )

    return {
        "candidate_level_vs_target_db": ratio_db(candidate_rms, target_rms),
        "error_relative_to_target_db": ratio_db(rms(error), target_rms),
        "correlation": correlation,
        "phase_only_error_relative_db": ratio_db(
            rms(np.asarray(phase_only_errors)), target_rms
        ),
        "magnitude_only_error_relative_db": ratio_db(
            rms(np.asarray(magnitude_only_errors)), target_rms
        ),
    }


def apply_frequency_correction(
    signal: np.ndarray,
    correction_frequencies_hz: np.ndarray,
    correction: np.ndarray,
) -> np.ndarray:
    channels = signal[np.newaxis, :] if signal.ndim == 1 else signal
    frame_count = channels.shape[1]
    fft_size = 1 << (2 * frame_count - 1).bit_length()
    frequencies_hz = np.fft.rfftfreq(fft_size, 1.0 / SAMPLE_RATE)
    valid = (
        (correction_frequencies_hz >= 20.0)
        & (correction_frequencies_hz <= 23_500.0)
        & np.isfinite(correction.real)
        & np.isfinite(correction.imag)
        & (np.abs(correction) > 0.0)
    )
    source_frequency = correction_frequencies_hz[valid]
    log_magnitude = np.log(np.maximum(np.abs(correction[valid]), 1.0e-20))
    unwrapped_phase = np.unwrap(np.angle(correction[valid]))
    interpolated = np.exp(
        np.interp(
            frequencies_hz,
            source_frequency,
            log_magnitude,
            left=log_magnitude[0],
            right=log_magnitude[-1],
        )
        + 1j
        * np.interp(
            frequencies_hz,
            source_frequency,
            unwrapped_phase,
            left=unwrapped_phase[0],
            right=unwrapped_phase[-1],
        )
    )
    corrected = np.stack(
        [
            np.fft.irfft(
                np.fft.rfft(channel, n=fft_size) * interpolated,
                n=fft_size,
            )[:frame_count]
            for channel in channels
        ]
    )
    return corrected[0] if signal.ndim == 1 else corrected


def linear_band_render_pair(
    session: reference.SpectreSession,
    impulse: np.ndarray,
    frequency_hz: float,
    q: float,
    gain_db: float,
) -> tuple[np.ndarray, np.ndarray]:
    spectre, _ = session.process(
        impulse,
        SAMPLE_RATE,
        reference.one_peak_settings(
            frequency_hz=frequency_hz,
            gain_db=gain_db,
            q=q,
            color="Clean",
            mode="Medium",
            quality="Good",
            de_emphasis=False,
            mix=1.0,
        ),
    )
    cosimo = render_cosimo(
        impulse,
        (
            {
                "frequency_hz": frequency_hz,
                "q": q,
                "amount": gain_db / 12.0,
                "color": "Solid",
            },
        ),
        saturation_mode="Medium",
        de_emphasis=0.0,
    )
    # Medium Solid has derivative 0.5 * 6 = 3 at zero.  The 1e-4
    # impulse keeps cubic terms below the float32 measurement floor.
    cosimo_linear_band = (cosimo[0] - impulse[0]) / 3.0
    return spectre[0].astype(np.float64), cosimo_linear_band.astype(np.float64)


def impulse_support(signal: np.ndarray, origin: int) -> dict[str, Any]:
    signal64 = signal.astype(np.float64)
    threshold = float(np.max(np.abs(signal64))) * 1.0e-6
    indices = np.where(np.abs(signal64) >= threshold)[0]
    pre_energy = float(np.sum(np.square(signal64[:origin])))
    post_energy = float(np.sum(np.square(signal64[origin:])))
    return {
        "relative_threshold": 1.0e-6,
        "first_offset_frames": int(indices[0] - origin),
        "last_offset_frames": int(indices[-1] - origin),
        "peak_offset_frames": int(np.argmax(np.abs(signal64)) - origin),
        "pre_energy_vs_post_db": ratio_db(
            math.sqrt(pre_energy), math.sqrt(post_energy)
        ),
    }


def identify_linear_wrapper() -> tuple[dict[str, Any], np.ndarray, np.ndarray]:
    frame_count = SAMPLE_RATE * 3
    impulse_frame = SAMPLE_RATE
    impulse = np.zeros((2, frame_count), dtype=np.float32)
    impulse[:, impulse_frame] = 1.0e-4
    session = reference.SpectreSession()
    training_cases = (
        (130.0, 0.1, 12.0),
        (500.0, 0.1, 12.0),
        (1_000.0, 0.1, 12.0),
        (4_000.0, 0.1, 12.0),
        (9_000.0, 0.1, 12.0),
        (16_000.0, 0.1, 12.0),
    )
    held_out_cases = (
        (130.0, 0.71, 9.0),
        (1_000.0, 0.71, 9.0),
        (9_000.0, 0.71, 9.0),
        (16_000.0, 0.71, 9.0),
        (1_000.0, 2.0, 12.0),
        (9_000.0, 2.0, 12.0),
        (16_000.0, 8.0, 12.0),
    )

    training_spectra: list[np.ndarray] = []
    training_cosimo_spectra: list[np.ndarray] = []
    training_rows: list[dict[str, Any]] = []
    for frequency_hz, q, gain_db in training_cases:
        spectre, cosimo = linear_band_render_pair(
            session, impulse, frequency_hz, q, gain_db
        )
        spectre_spectrum = np.fft.rfft(spectre)
        cosimo_spectrum = np.fft.rfft(cosimo)
        training_spectra.append(spectre_spectrum)
        training_cosimo_spectra.append(cosimo_spectrum)
        training_rows.append(
            {
                "frequency_hz": frequency_hz,
                "q": q,
                "gain_db": gain_db,
                "cosimo_level_vs_spectre_db": ratio_db(rms(cosimo), rms(spectre)),
            }
        )

    spectre_stack = np.stack(training_spectra)
    cosimo_stack = np.stack(training_cosimo_spectra)
    denominator = np.sum(np.square(np.abs(cosimo_stack)), axis=0)
    correction = np.sum(np.conj(cosimo_stack) * spectre_stack, axis=0) / np.maximum(
        denominator, 1.0e-30
    )
    frequencies_hz = np.fft.rfftfreq(frame_count, 1.0 / SAMPLE_RATE)

    ratio_consistency: list[dict[str, Any]] = []
    for target_hz in (
        50.0,
        100.0,
        200.0,
        500.0,
        1_000.0,
        2_000.0,
        4_000.0,
        8_000.0,
        12_000.0,
        16_000.0,
        20_000.0,
    ):
        index = int(np.argmin(np.abs(frequencies_hz - target_hz)))
        ratios: list[complex] = []
        for spectre_spectrum, cosimo_spectrum in zip(
            training_spectra, training_cosimo_spectra
        ):
            spectre_peak = float(np.max(np.abs(spectre_spectrum)))
            if (
                abs(spectre_spectrum[index])
                >= spectre_peak * reference.db_to_gain(-25.0)
                and abs(cosimo_spectrum[index])
                >= spectre_peak * reference.db_to_gain(-25.0)
            ):
                ratios.append(spectre_spectrum[index] / cosimo_spectrum[index])
        ratio_array = np.asarray(ratios, dtype=np.complex128)
        circular_mean = np.mean(
            ratio_array / np.maximum(np.abs(ratio_array), 1.0e-30)
        )
        centred_phase = np.angle(
            ratio_array * np.exp(-1j * np.angle(circular_mean)), deg=True
        )
        ratio_consistency.append(
            {
                "frequency_hz": target_hz,
                "usable_bell_cases": int(ratio_array.size),
                "magnitude_median_db": float(
                    np.median(20.0 * np.log10(np.abs(ratio_array)))
                ),
                "magnitude_standard_deviation_db": float(
                    np.std(20.0 * np.log10(np.abs(ratio_array)))
                ),
                "phase_wrapped_median_degrees": float(
                    np.median(np.angle(ratio_array, deg=True))
                ),
                "phase_circular_standard_deviation_degrees": float(
                    np.std(centred_phase)
                ),
            }
        )

    fit = (frequencies_hz >= 500.0) & (frequencies_hz <= 8_000.0)
    unwrapped_correction_phase = np.unwrap(np.angle(correction[fit]))
    slope, intercept = np.polyfit(
        frequencies_hz[fit], unwrapped_correction_phase, 1
    )
    phase_fit = slope * frequencies_hz[fit] + intercept
    equivalent_advance_samples = float(slope * SAMPLE_RATE / (2.0 * math.pi))

    held_out_rows: list[dict[str, Any]] = []
    for frequency_hz, q, gain_db in held_out_cases:
        spectre, cosimo = linear_band_render_pair(
            session, impulse, frequency_hz, q, gain_db
        )
        spectre_spectrum = np.fft.rfft(spectre)
        cosimo_spectrum = np.fft.rfft(cosimo)
        useful = (
            (frequencies_hz >= 40.0)
            & (frequencies_hz <= 20_000.0)
            & (
                np.abs(spectre_spectrum)
                >= np.max(np.abs(spectre_spectrum)) * reference.db_to_gain(-12.0)
            )
        )

        def complex_error(
            candidate: np.ndarray,
            target_spectrum: np.ndarray,
            mask: np.ndarray,
        ) -> dict[str, float]:
            ratio = candidate[mask] / target_spectrum[mask]
            magnitude_error_db = 20.0 * np.log10(np.abs(ratio))
            phase_error_degrees = np.angle(ratio, deg=True)
            return {
                "magnitude_rms_error_db": float(
                    np.sqrt(np.mean(np.square(magnitude_error_db)))
                ),
                "magnitude_max_error_db": float(
                    np.max(np.abs(magnitude_error_db))
                ),
                "phase_rms_error_degrees": float(
                    np.sqrt(np.mean(np.square(phase_error_degrees)))
                ),
                "phase_max_error_degrees": float(
                    np.max(np.abs(phase_error_degrees))
                ),
            }

        held_out_rows.append(
            {
                "frequency_hz": frequency_hz,
                "q": q,
                "gain_db": gain_db,
                "useful_fft_bins": int(np.count_nonzero(useful)),
                "raw_cosimo_vs_spectre": complex_error(
                    cosimo_spectrum, spectre_spectrum, useful
                ),
                "after_common_wrapper_correction": complex_error(
                    cosimo_spectrum * correction, spectre_spectrum, useful
                ),
            }
        )

    support_impulse = np.zeros((2, frame_count), dtype=np.float32)
    support_impulse[:, impulse_frame] = 0.1
    quality_support: dict[str, Any] = {}
    for quality in ("Normal", "Good", "Best"):
        output, _ = session.process(
            support_impulse,
            SAMPLE_RATE,
            reference.one_peak_settings(
                frequency_hz=1_000.0,
                gain_db=12.0,
                q=2.0,
                color="Clean",
                mode="Medium",
                quality=quality,
                de_emphasis=False,
                mix=1.0,
            ),
        )
        quality_support[quality] = impulse_support(output[0], impulse_frame)
    _, representative_cosimo = linear_band_render_pair(
        session, impulse, 1_000.0, 2.0, 12.0
    )
    quality_support["CosimoCurrent4x"] = impulse_support(
        representative_cosimo, impulse_frame
    )

    report = {
        "training_cases": training_rows,
        "common_ratio_consistency": ratio_consistency,
        "phase_fit_500_to_8000_hz": {
            "equivalent_spectre_advance_over_cosimo_samples": equivalent_advance_samples,
            "intercept_degrees": float(math.degrees(intercept)),
            "phase_residual_rms_degrees": float(
                math.degrees(
                    np.sqrt(
                        np.mean(
                            np.square(unwrapped_correction_phase - phase_fit)
                        )
                    )
                )
            ),
        },
        "held_out_complex_eq_cases": held_out_rows,
        "impulse_support": quality_support,
    }
    return report, frequencies_hz, correction


def multitone_static_transfer() -> dict[str, Any]:
    pre_frames = SAMPLE_RATE // 2
    tone_frames = SAMPLE_RATE * 2
    time = np.arange(tone_frames, dtype=np.float64) / SAMPLE_RATE
    per_tone_peak = math.sqrt(2.0) * reference.db_to_gain(-18.0)
    mono = (
        per_tone_peak * np.sin(2.0 * math.pi * 97.0 * time)
        + per_tone_peak * np.sin(2.0 * math.pi * 137.0 * time)
    ).astype(np.float32)
    audio = np.concatenate(
        (
            np.zeros((2, pre_frames), dtype=np.float32),
            np.stack((mono, mono)),
        ),
        axis=1,
    )
    session = reference.SpectreSession()
    common_settings = {
        "frequency_hz": 115.0,
        "gain_db": 12.0,
        "q": 0.7,
        "quality": "Good",
        "de_emphasis": False,
        "mix": 1.0,
    }
    clean, _ = session.process(
        audio,
        SAMPLE_RATE,
        reference.one_peak_settings(
            color="Clean", mode="Subtle", **common_settings
        ),
    )
    selected_band = clean[0, -SAMPLE_RATE:].astype(np.float64)
    frequencies_hz = np.fft.rfftfreq(SAMPLE_RATE, 1.0 / SAMPLE_RATE)
    rows: list[dict[str, Any]] = []
    for mode, model in SHAPER_MODE_MODELS.items():
        for color in ("Solid", "Tube"):
            output, _ = session.process(
                audio,
                SAMPLE_RATE,
                reference.one_peak_settings(
                    color=color, mode=mode, **common_settings
                ),
            )
            measured = output[0, -SAMPLE_RATE:].astype(np.float64)
            bias = model["tube_bias"] if color == "Tube" else 0.0
            predicted = model["output_scale"] * (
                np.tanh(model["drive"] * selected_band + bias) - math.tanh(bias)
            )
            measured -= np.mean(measured)
            predicted -= np.mean(predicted)
            measured_peaks = np.abs(np.fft.rfft(measured) / (SAMPLE_RATE / 2.0))
            predicted_peaks = np.abs(
                np.fft.rfft(predicted) / (SAMPLE_RATE / 2.0)
            )
            useful = (
                (frequencies_hz >= 50.0)
                & (frequencies_hz <= 5_000.0)
                & (measured_peaks >= reference.db_to_gain(-80.0))
                & (predicted_peaks >= reference.db_to_gain(-80.0))
            )
            errors_db = 20.0 * np.log10(
                predicted_peaks[useful] / measured_peaks[useful]
            )
            rows.append(
                {
                    "mode": mode,
                    "color": color,
                    "retained_intermodulation_bins": int(
                        np.count_nonzero(useful)
                    ),
                    "magnitude_rms_error_db": float(
                        np.sqrt(np.mean(np.square(errors_db)))
                    ),
                    "magnitude_95th_percentile_error_db": float(
                        np.percentile(np.abs(errors_db), 95.0)
                    ),
                    "magnitude_max_error_db": float(
                        np.max(np.abs(errors_db))
                    ),
                }
            )
    return {
        "stimulus": "97 Hz + 137 Hz, each -18 dBFS RMS",
        "settings": "115 Hz, +12 dB, Q 0.7, Good, de-emphasis off",
        "analysis_band_hz": [50.0, 5_000.0],
        "retained_peak_floor_dbfs": -80.0,
        "rows": rows,
    }


def cycle_demeaned_rms(signal: np.ndarray, cycle_frames: int) -> float:
    usable_frames = signal.size - signal.size % cycle_frames
    cycles = signal[:usable_frames].reshape(-1, cycle_frames).astype(np.float64)
    cycles -= np.mean(cycles, axis=1, keepdims=True)
    return rms(cycles)


def history_dependence() -> dict[str, Any]:
    history_frames = SAMPLE_RATE
    frequency_hz = 1_000.0
    history_time = np.arange(history_frames, dtype=np.float64) / SAMPLE_RATE
    hot_history = (
        0.95 * np.sin(2.0 * math.pi * frequency_hz * history_time)
    ).astype(np.float32)
    probe = reference.make_sine(
        SAMPLE_RATE, frequency_hz, -30.0, duration_seconds=1.0
    )[0]
    cycle_frames = SAMPLE_RATE // int(frequency_hz)
    rows: list[dict[str, Any]] = []
    session = reference.SpectreSession()
    for color in ("Clean", "Solid", "Tube"):
        settings = reference.one_peak_settings(
            frequency_hz=frequency_hz,
            gain_db=12.0,
            q=2.0,
            color=color,
            mode="Medium",
            quality="Good",
            de_emphasis=False,
            mix=1.0,
        )

        def pair(
            gap_seconds: float, settings_for_color: dict[str, Any]
        ) -> tuple[np.ndarray, np.ndarray, int]:
            gap_frames = round(gap_seconds * SAMPLE_RATE)
            quiet_mono = np.concatenate(
                (np.zeros(history_frames + gap_frames, dtype=np.float32), probe)
            )
            hot_mono = np.concatenate(
                (
                    hot_history,
                    np.zeros(gap_frames, dtype=np.float32),
                    probe,
                )
            )
            quiet, _ = session.process(
                np.stack((quiet_mono, quiet_mono)),
                SAMPLE_RATE,
                settings_for_color,
            )
            hot, _ = session.process(
                np.stack((hot_mono, hot_mono)),
                SAMPLE_RATE,
                settings_for_color,
            )
            return quiet[0], hot[0], history_frames + gap_frames

        quiet, hot, probe_start = pair(0.020, settings)
        difference = hot.astype(np.float64) - quiet.astype(np.float64)
        late_start = probe_start + int(0.100 * SAMPLE_RATE)
        late_end = probe_start + int(0.500 * SAMPLE_RATE)
        late_difference = difference[late_start:late_end]
        late_probe = quiet[late_start:late_end]
        quiet_long, hot_long, long_probe_start = pair(0.500, settings)
        long_difference = (
            hot_long[long_probe_start:].astype(np.float64)
            - quiet_long[long_probe_start:].astype(np.float64)
        )
        rows.append(
            {
                "color": color,
                "20ms_gap_then_100_to_500ms_probe_window": {
                    "difference_rms_dbfs": reference.gain_to_db(
                        rms(late_difference)
                    ),
                    "cycle_demeaned_difference_rms_dbfs": reference.gain_to_db(
                        cycle_demeaned_rms(late_difference, cycle_frames)
                    ),
                    "difference_relative_to_probe_db": ratio_db(
                        rms(late_difference), rms(late_probe)
                    ),
                    "difference_mean": float(np.mean(late_difference)),
                },
                "500ms_silence_gap": {
                    "maximum_absolute_probe_difference": float(
                        np.max(np.abs(long_difference))
                    ),
                    "bit_identical": bool(
                        np.array_equal(
                            quiet_long[long_probe_start:],
                            hot_long[long_probe_start:],
                        )
                    ),
                },
            }
        )
    return {
        "hot_history": "1 second 1 kHz sine at 0.95 peak",
        "probe": "1 second 1 kHz sine at -30 dBFS RMS",
        "settings": "1 kHz, +12 dB, Q 2, Medium, Good, de-emphasis off",
        "rows": rows,
        "interpretation_boundary": (
            "Tube's slow mean decay is measured separately from cycle-demeaned AC; "
            "it is consistent with the already identified residue DC blocker, not "
            "evidence of an envelope follower."
        ),
    }


def high_frequency_quality_sweep(
    correction_frequencies_hz: np.ndarray, correction: np.ndarray
) -> list[dict[str, Any]]:
    pre_frames = SAMPLE_RATE // 2
    session = reference.SpectreSession()
    rows: list[dict[str, Any]] = []
    for frequency_hz in (100.0, 997.0, 4_001.0, 7_993.0, 11_987.0, 15_991.0):
        tone = reference.make_sine(
            SAMPLE_RATE, frequency_hz, -12.0, duration_seconds=2.0
        )
        audio = np.concatenate(
            (np.zeros((2, pre_frames), dtype=np.float32), tone), axis=1
        )
        dry = audio[0].astype(np.float64)
        spectre_outputs: dict[str, np.ndarray] = {}
        for quality in ("Normal", "Good", "Best"):
            output, _ = session.process(
                audio,
                SAMPLE_RATE,
                reference.one_peak_settings(
                    frequency_hz=frequency_hz,
                    gain_db=12.0,
                    q=0.71,
                    color="Solid",
                    mode="Medium",
                    quality=quality,
                    de_emphasis=True,
                    mix=0.5,
                ),
            )
            spectre_outputs[quality] = output[0].astype(np.float64) - dry
        cosimo_output = render_cosimo(
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
        cosimo_contribution = cosimo_output[0].astype(np.float64) - dry
        corrected_contribution = apply_frequency_correction(
            cosimo_contribution, correction_frequencies_hz, correction
        )
        measured = slice(pre_frames + SAMPLE_RATE, pre_frames + SAMPLE_RATE * 2)
        target = spectre_outputs["Good"][measured]
        rows.append(
            {
                "frequency_hz": frequency_hz,
                "spectre_effect_relative_to_dry_db": ratio_db(
                    rms(target), rms(dry[measured])
                ),
                "cosimo_current_vs_spectre_good": contribution_comparison(
                    target, cosimo_contribution[measured]
                ),
                "cosimo_after_linear_wrapper_correction_vs_spectre_good": (
                    contribution_comparison(target, corrected_contribution[measured])
                ),
                "spectre_normal_vs_good": contribution_comparison(
                    target, spectre_outputs["Normal"][measured]
                ),
                "spectre_best_vs_good": contribution_comparison(
                    target, spectre_outputs["Best"][measured]
                ),
            }
        )
    return rows


def musical_comparison(
    output_root: Path,
    correction_frequencies_hz: np.ndarray,
    correction: np.ndarray,
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
    cosimo_bands = (
        {
            "frequency_hz": 130.0,
            "q": 0.71,
            "amount": amount,
            "color": "Solid",
        },
        {
            "frequency_hz": 9_000.0,
            "q": 0.71,
            "amount": amount,
            "color": "Tube",
        },
    )
    session = reference.SpectreSession()
    listening_root = output_root / "listening"
    rows: list[dict[str, Any]] = []
    for name, dry_fixture in fixtures.items():
        audio = np.concatenate(
            (
                np.zeros((2, pre_frames), dtype=np.float32),
                dry_fixture,
            ),
            axis=1,
        )
        spectre_output, _ = session.process(
            audio,
            SAMPLE_RATE,
            spectre_two_band_settings(amount=amount, mode="Medium"),
        )
        cosimo_output = render_cosimo(
            audio,
            cosimo_bands,
            saturation_mode="Medium",
            de_emphasis=1.0,
        )
        dry64 = audio.astype(np.float64)
        target_contribution = spectre_output.astype(np.float64) - dry64
        current_contribution = cosimo_output.astype(np.float64) - dry64
        corrected_contribution = apply_frequency_correction(
            current_contribution, correction_frequencies_hz, correction
        )
        corrected_output = dry64 + corrected_contribution
        measured = slice(pre_frames, audio.shape[1] - SAMPLE_RATE // 10)
        target_measured = target_contribution[:, measured]
        current_measured = current_contribution[:, measured]
        corrected_measured = corrected_contribution[:, measured]
        spectre_measured = spectre_output[:, measured]

        current_metrics = contribution_comparison(
            target_measured, current_measured
        )
        current_metrics["full_output_error_relative_to_spectre_db"] = ratio_db(
            rms(cosimo_output[:, measured] - spectre_measured),
            rms(spectre_measured),
        )
        corrected_metrics = contribution_comparison(
            target_measured, corrected_measured
        )
        corrected_metrics[
            "full_output_error_relative_to_spectre_db"
        ] = ratio_db(
            rms(corrected_output[:, measured] - spectre_measured),
            rms(spectre_measured),
        )
        rows.append(
            {
                "fixture": name,
                "spectre_effect_relative_to_dry_db": ratio_db(
                    rms(target_measured), rms(dry64[:, measured])
                ),
                "cosimo_current": current_metrics,
                "cosimo_after_linear_wrapper_correction": corrected_metrics,
            }
        )

        fixture_slice = slice(pre_frames, audio.shape[1])
        reference.write_float_wav(
            listening_root / f"{name}-00-dry.wav",
            SAMPLE_RATE,
            dry64[:, fixture_slice].astype(np.float32),
        )
        reference.write_float_wav(
            listening_root / f"{name}-01-spectre-good.wav",
            SAMPLE_RATE,
            spectre_output[:, fixture_slice],
        )
        reference.write_float_wav(
            listening_root / f"{name}-02-cosimo-current.wav",
            SAMPLE_RATE,
            cosimo_output[:, fixture_slice],
        )
        reference.write_float_wav(
            listening_root / f"{name}-03-cosimo-wrapper-corrected.wav",
            SAMPLE_RATE,
            corrected_output[:, fixture_slice].astype(np.float32),
        )
    return rows


def repeatability_probe() -> dict[str, Any]:
    pre_frames = SAMPLE_RATE // 2
    tone = reference.make_sine(
        SAMPLE_RATE, 997.0, -12.0, duration_seconds=1.0
    )
    audio = np.concatenate(
        (np.zeros((2, pre_frames), dtype=np.float32), tone), axis=1
    )
    settings = reference.one_peak_settings(
        frequency_hz=997.0,
        gain_db=12.0,
        q=0.71,
        color="Tube",
        mode="Medium",
        quality="Good",
        de_emphasis=True,
        mix=0.5,
    )
    first, _ = reference.SpectreSession().process(audio, SAMPLE_RATE, settings)
    second, _ = reference.SpectreSession().process(audio, SAMPLE_RATE, settings)
    difference = first.astype(np.float64) - second.astype(np.float64)
    return {
        "fresh_instances_bit_identical": bool(np.array_equal(first, second)),
        "maximum_absolute_difference": float(np.max(np.abs(difference))),
        "rms_difference": rms(difference),
    }


def summary_findings(report: dict[str, Any]) -> dict[str, Any]:
    multitone_rows = report["static_curve_intermodulation"]["rows"]
    history_rows = report["history_dependence"]["rows"]
    held_out = report["linear_wrapper_and_eq"]["held_out_complex_eq_cases"]
    musical = report["musical_comparison"]
    return {
        "static_curve_worst_retained_intermod_rms_error_db": max(
            row["magnitude_rms_error_db"] for row in multitone_rows
        ),
        "static_curve_worst_retained_intermod_max_error_db": max(
            row["magnitude_max_error_db"] for row in multitone_rows
        ),
        "history_500ms_gap_all_bit_identical": all(
            row["500ms_silence_gap"]["bit_identical"] for row in history_rows
        ),
        "held_out_eq_after_common_wrapper_worst_magnitude_rms_error_db": max(
            row["after_common_wrapper_correction"]["magnitude_rms_error_db"]
            for row in held_out
        ),
        "held_out_eq_after_common_wrapper_worst_phase_rms_error_degrees": max(
            row["after_common_wrapper_correction"]["phase_rms_error_degrees"]
            for row in held_out
        ),
        "musical_current_effect_error_relative_db_range": [
            min(
                row["cosimo_current"]["error_relative_to_target_db"]
                for row in musical
            ),
            max(
                row["cosimo_current"]["error_relative_to_target_db"]
                for row in musical
            ),
        ],
        "musical_wrapper_corrected_effect_error_relative_db_range": [
            min(
                row["cosimo_after_linear_wrapper_correction"][
                    "error_relative_to_target_db"
                ]
                for row in musical
            ),
            max(
                row["cosimo_after_linear_wrapper_correction"][
                    "error_relative_to_target_db"
                ]
                for row in musical
            ),
        ],
        "decision": (
            "The recovered static shapers and parametric-bell law are retained. "
            "The next fidelity prototype should replace the current Cmajor node "
            "oversampling wrapper with a Spectre-Good-matched 4x reconstruction "
            "path, including its timing/phase behavior, before changing either "
            "the EQ law or the tanh curves."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    output_root = args.output.resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    for required_path in (
        reference.AU_PATH,
        reference.VST3_PATH,
        reference.LICENSE_PATH,
        COSIMO_VST3_PATH,
        COSIMO_BINARY_PATH,
    ):
        if not required_path.exists():
            raise FileNotFoundError(required_path)

    print("identifying common linear wrapper and held-out EQ behavior", flush=True)
    linear_report, correction_frequencies_hz, correction = (
        identify_linear_wrapper()
    )
    print("checking static intermodulation transfer", flush=True)
    static_report = multitone_static_transfer()
    print("checking history dependence", flush=True)
    history_report = history_dependence()
    print("checking high-frequency quality and alias wrapper", flush=True)
    quality_report = high_frequency_quality_sweep(
        correction_frequencies_hz, correction
    )
    print("rendering musical A/B bundle", flush=True)
    musical_report = musical_comparison(
        output_root, correction_frequencies_hz, correction
    )

    report: dict[str, Any] = {
        "schema": "cosimo.spectre-enhancer-uncertainty.v1",
        "provenance": {
            "git_head_before_measurement_commit": git_head(),
            "spectre": reference.plugin_metadata(),
            "cosimo_vst3_path": str(COSIMO_VST3_PATH),
            "cosimo_binary_sha256": reference.sha256_file(COSIMO_BINARY_PATH),
            "sample_rate": SAMPLE_RATE,
            "spectre_target_quality": "Good",
            "spectre_target_mode": "Medium",
        },
        "repeatability": repeatability_probe(),
        "static_curve_intermodulation": static_report,
        "history_dependence": history_report,
        "linear_wrapper_and_eq": linear_report,
        "high_frequency_quality_sweep": quality_report,
        "musical_comparison": musical_report,
    }
    report["summary"] = summary_findings(report)
    reference.write_json(output_root / "report.json", report)
    print(json.dumps(report["summary"], indent=2, sort_keys=True), flush=True)
    print(f"wrote {output_root / 'report.json'}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
