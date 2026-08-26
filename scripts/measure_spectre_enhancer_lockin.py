#!/usr/bin/env python3
"""Measure the remaining Spectre-to-Cosimo Enhancer matching questions.

This focused offline research tool complements measure_spectre_reference.py. It
measures the full linear bell response (rather than tones only at the bell
centre) and rechecks the Subtle Tube/Solid transfer at a low fundamental where
the oversampling reconstruction filter cannot bias the harmonic fit.

The output under build/ is ignored. No Spectre audio or proprietary code is
checked in; the report contains only measurements and inferred model errors.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from scipy.optimize import least_squares

import measure_spectre_reference as reference


DEFAULT_OUTPUT = reference.REPO_ROOT / "build" / "t26-spectre-lockin"
SAMPLE_RATE = 48_000
IMPULSE_FRAME = SAMPLE_RATE
IMPULSE_FRAMES = SAMPLE_RATE * 3
IMPULSE_AMPLITUDE = 0.1
FFT_SIZE = 1 << 19
PRE_RING_FRAMES = 512


def rbj_peak_difference(
    frequencies_hz: np.ndarray,
    sample_rate: float,
    centre_hz: float,
    q: float,
    gain_db: float,
) -> np.ndarray:
    """Return H_peak(z)-1 for an RBJ peaking EQ.

    Spectre Good evaluates this filter at four times the host rate. The
    difference form is the exact signal sent into its selected-band shaper.
    """

    amplitude = 10.0 ** (gain_db / 40.0)
    omega = 2.0 * math.pi * centre_hz / sample_rate
    alpha = math.sin(omega) / (2.0 * q)
    cosine = math.cos(omega)
    z1 = np.exp(-2j * math.pi * frequencies_hz / sample_rate)
    z2 = z1 * z1
    numerator = (
        (1.0 + alpha * amplitude)
        - 2.0 * cosine * z1
        + (1.0 - alpha * amplitude) * z2
    )
    denominator = (
        (1.0 + alpha / amplitude)
        - 2.0 * cosine * z1
        + (1.0 - alpha / amplitude) * z2
    )
    return numerator / denominator - 1.0


def crossing_frequency(
    frequencies_hz: np.ndarray,
    magnitude: np.ndarray,
    peak_index: int,
    target: float,
    lower: bool,
) -> float:
    candidates = (
        np.where(magnitude[:peak_index] <= target)[0]
        if lower
        else peak_index + np.where(magnitude[peak_index:] <= target)[0]
    )
    if candidates.size == 0:
        return float(frequencies_hz[0 if lower else -1])
    index = int(candidates[-1] if lower else candidates[0])
    adjacent = index + 1 if lower else index - 1
    adjacent = max(0, min(adjacent, magnitude.size - 1))
    first_magnitude = float(magnitude[index])
    second_magnitude = float(magnitude[adjacent])
    if first_magnitude == second_magnitude:
        return float(frequencies_hz[index])
    fraction = (target - first_magnitude) / (second_magnitude - first_magnitude)
    return float(
        frequencies_hz[index]
        + fraction * (frequencies_hz[adjacent] - frequencies_hz[index])
    )


def filter_case(
    session: reference.SpectreSession,
    impulse: np.ndarray,
    centre_hz: float,
    q: float,
    gain_db: float,
) -> dict[str, Any]:
    settings = reference.one_peak_settings(
        frequency_hz=centre_hz,
        gain_db=gain_db,
        q=q,
        color="Clean",
        mode="Subtle",
        quality="Good",
        de_emphasis=False,
        mix=1.0,
    )
    output, effective = session.process(impulse, SAMPLE_RATE, settings)
    impulse_response = (
        output[0, IMPULSE_FRAME - PRE_RING_FRAMES :].astype(np.float64)
        / IMPULSE_AMPLITUDE
    )
    measured = np.fft.rfft(impulse_response, n=FFT_SIZE)
    frequencies_hz = np.fft.rfftfreq(FFT_SIZE, 1.0 / SAMPLE_RATE)
    predicted = rbj_peak_difference(
        frequencies_hz,
        SAMPLE_RATE * 4.0,
        centre_hz,
        q,
        gain_db,
    )
    measured_magnitude = np.abs(measured)
    predicted_magnitude = np.abs(predicted)
    peak_index = int(np.argmax(measured_magnitude))
    peak_magnitude = float(measured_magnitude[peak_index])
    half_power = peak_magnitude / math.sqrt(2.0)
    low_hz = crossing_frequency(
        frequencies_hz, measured_magnitude, peak_index, half_power, True
    )
    high_hz = crossing_frequency(
        frequencies_hz, measured_magnitude, peak_index, half_power, False
    )
    measured_db = 20.0 * np.log10(np.maximum(measured_magnitude, 1.0e-15))
    predicted_db = 20.0 * np.log10(np.maximum(predicted_magnitude, 1.0e-15))
    predicted_peak_db = float(np.max(predicted_db))
    useful = (
        (frequencies_hz >= 20.0)
        & (frequencies_hz <= 20_000.0)
        & (predicted_db >= predicted_peak_db - 12.0)
        & (measured_db >= predicted_peak_db - 13.0)
    )
    errors_db = measured_db[useful] - predicted_db[useful]
    return {
        "centre_hz": centre_hz,
        "q": q,
        "gain_db": gain_db,
        "peak_hz": float(frequencies_hz[peak_index]),
        "peak_gain": peak_magnitude,
        "expected_peak_gain": reference.db_to_gain(gain_db) - 1.0,
        "minus_3db_low_hz": low_hz,
        "minus_3db_high_hz": high_hz,
        "measured_q": float(frequencies_hz[peak_index] / (high_hz - low_hz)),
        "four_x_peak_model_rms_error_db": float(
            np.sqrt(np.mean(np.square(errors_db)))
        ),
        "four_x_peak_model_max_error_db": float(np.max(np.abs(errors_db))),
        "effective_frequency_raw": effective["peak_01_frequency"]["raw"],
        "effective_q_raw": effective["peak_01_q"]["raw"],
        "effective_gain_raw": effective["peak_01_gain"]["raw"],
    }


def harmonic_coefficients(signal: np.ndarray, frequency_hz: float) -> np.ndarray:
    start_frame = SAMPLE_RATE
    mid = 0.5 * (signal[0].astype(np.float64) + signal[1].astype(np.float64))
    return np.asarray(
        [
            reference.complex_tone_coefficient(
                mid,
                SAMPLE_RATE,
                frequency_hz * harmonic,
                start_frame,
                SAMPLE_RATE,
            )
            for harmonic in range(1, 31)
        ],
        dtype=np.complex128,
    )


def shaper_points(session: reference.SpectreSession) -> dict[str, list[dict[str, Any]]]:
    frequency_hz = 100.0
    results: dict[str, list[dict[str, Any]]] = {"Solid": [], "Tube": []}
    for gain_db in (1.0, 3.0, 6.0, 9.0, 12.0):
        for input_dbfs in (-36.0, -24.0, -18.0, -12.0, -6.0):
            stimulus = reference.make_sine(
                SAMPLE_RATE,
                frequency_hz,
                input_dbfs,
                duration_seconds=2.0,
            )
            rendered: dict[str, np.ndarray] = {}
            for color in ("Clean", "Solid", "Tube"):
                output, _ = session.process(
                    stimulus,
                    SAMPLE_RATE,
                    reference.one_peak_settings(
                        frequency_hz=frequency_hz,
                        gain_db=gain_db,
                        q=2.0,
                        color=color,
                        mode="Subtle",
                        quality="Good",
                        de_emphasis=False,
                        mix=1.0,
                    ),
                )
                rendered[color] = harmonic_coefficients(output, frequency_hz)
            band_peak = float(abs(rendered["Clean"][0]))
            for color in ("Solid", "Tube"):
                results[color].append(
                    {
                        "gain_db": gain_db,
                        "input_dbfs": input_dbfs,
                        "band_peak": band_peak,
                        "harmonic_peaks": [
                            float(value) for value in abs(rendered[color])[:20]
                        ],
                    }
                )
    return results


def shaper_model_errors(
    points: list[dict[str, Any]],
    color: str,
    parameters: np.ndarray,
) -> np.ndarray:
    drive = float(parameters[0])
    output_scale = float(parameters[1])
    bias = float(parameters[2]) if color == "Tube" else 0.0
    phase = np.arange(480, dtype=np.float64) * (2.0 * math.pi / 480.0)
    errors: list[float] = []
    for point in points:
        waveform = output_scale * (
            np.tanh(drive * point["band_peak"] * np.sin(phase) + bias)
            - math.tanh(bias)
        )
        waveform -= np.mean(waveform)
        predicted = np.abs(np.fft.rfft(waveform) / (phase.size / 2.0))[1:21]
        for predicted_peak, measured_peak in zip(
            predicted, point["harmonic_peaks"]
        ):
            if measured_peak > reference.db_to_gain(-120.0):
                errors.append(
                    reference.gain_to_db(
                        max(float(predicted_peak), 1.0e-30) / measured_peak
                    )
                )
    return np.asarray(errors, dtype=np.float64)


def fit_shaper(points: list[dict[str, Any]], color: str) -> dict[str, Any]:
    exact = (
        np.asarray((3.0, 1.0 / math.sqrt(2.0), 0.125))
        if color == "Tube"
        else np.asarray((3.0, 1.0 / math.sqrt(2.0)))
    )
    bounds = (
        (np.asarray((1.0, 0.1, -1.0)), np.asarray((8.0, 2.0, 1.0)))
        if color == "Tube"
        else (np.asarray((1.0, 0.1)), np.asarray((8.0, 2.0)))
    )
    fitted = least_squares(
        lambda parameters: shaper_model_errors(points, color, parameters),
        exact,
        bounds=bounds,
        max_nfev=5_000,
        xtol=1.0e-14,
        ftol=1.0e-14,
        gtol=1.0e-14,
    ).x

    def summary(parameters: np.ndarray) -> dict[str, Any]:
        errors = shaper_model_errors(points, color, parameters)
        return {
            "parameters": [float(value) for value in parameters],
            "harmonic_points": int(errors.size),
            "rms_error_db": float(np.sqrt(np.mean(np.square(errors)))),
            "maximum_error_db": float(np.max(np.abs(errors))),
            "mean_error_db": float(np.mean(errors)),
        }

    return {
        "exact_model": summary(exact),
        "unconstrained_best_fit": summary(fitted),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    output_root = args.output.resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    for required_path in (reference.AU_PATH, reference.VST3_PATH, reference.LICENSE_PATH):
        if not required_path.exists():
            raise FileNotFoundError(required_path)

    impulse = np.zeros((2, IMPULSE_FRAMES), dtype=np.float32)
    impulse[:, IMPULSE_FRAME] = IMPULSE_AMPLITUDE
    session = reference.SpectreSession()
    filter_rows: list[dict[str, Any]] = []
    for centre_hz in (100.0, 1_000.0, 8_000.0, 12_000.0, 16_000.0):
        for q in (0.1, 0.3, 0.7, 2.0, 8.0, 10.0):
            for gain_db in (1.0, 6.0, 12.0):
                filter_rows.append(
                    filter_case(session, impulse, centre_hz, q, gain_db)
                )
                if len(filter_rows) % 30 == 0:
                    print(f"measured {len(filter_rows)}/90 bell cases", flush=True)

    points = shaper_points(session)
    report = {
        "schema": "cosimo.spectre-enhancer-lockin.v1",
        "plugin": reference.plugin_metadata(),
        "measurement": {
            "sample_rate": SAMPLE_RATE,
            "spectre_quality": "Good",
            "bell_model": "RBJ peaking EQ difference evaluated at 4x host rate",
            "bell_cases": len(filter_rows),
            "shaper_fundamental_hz": 100.0,
        },
        "filter_rows": filter_rows,
        "filter_model_summary": {
            "rms_error_db": float(
                np.sqrt(
                    np.mean(
                        np.square(
                            [row["four_x_peak_model_rms_error_db"] for row in filter_rows]
                        )
                    )
                )
            ),
            "worst_case_rms_error_db": float(
                max(row["four_x_peak_model_rms_error_db"] for row in filter_rows)
            ),
            "worst_point_error_db": float(
                max(row["four_x_peak_model_max_error_db"] for row in filter_rows)
            ),
        },
        "shaper_model": {
            color: fit_shaper(color_points, color)
            for color, color_points in points.items()
        },
    }
    reference.write_json(output_root / "report.json", report)
    print(json.dumps(report["filter_model_summary"], indent=2), flush=True)
    print(json.dumps(report["shaper_model"], indent=2), flush=True)
    print(f"wrote {output_root / 'report.json'}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
