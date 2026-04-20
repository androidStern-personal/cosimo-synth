#!/usr/bin/env python3
"""Compare a fitted memoryless Drive candidate against Ableton sine captures."""

from __future__ import annotations

import argparse
import csv
import json
import math
import wave
from array import array
from pathlib import Path
from typing import Any

from drum_buss_analyze_sweep import finite_or_text
from drum_buss_fit_drive import CANDIDATES, DRIVE_TYPE_LABELS


EPS = 1.0e-12


def db10(value: float) -> float:
    if value <= 0.0:
        return float("-inf")
    return 10.0 * math.log10(value)


def db20(value: float) -> float:
    if value <= 0.0:
        return float("-inf")
    return 20.0 * math.log10(value)


def read_left_channel_float(path: Path) -> tuple[list[float], int]:
    with wave.open(str(path), "rb") as wav:
        channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        sample_rate = wav.getframerate()
        frames = wav.getnframes()
        raw = wav.readframes(frames)
    if sample_width != 2:
        raise ValueError(f"{path} has sample width {sample_width}; expected 16-bit PCM")

    samples = array("h")
    samples.frombytes(raw)
    return [sample / 32768.0 for sample in samples[0::channels]], sample_rate


def quantize_16(value: float) -> float:
    sample = max(-32767, min(32767, int(round(value * 32767.0))))
    return sample / 32768.0


def synthesize_sine_probe(
    sample_rate: int,
    duration_sec: float,
    click_amp: float,
    freq_hz: float,
    amp: float,
) -> list[float]:
    total_frames = int(round(sample_rate * duration_sec))
    frames: list[float] = []
    for frame in range(total_frames):
        t = frame / sample_rate
        if frame == 0:
            value = click_amp
        elif 0.25 <= t < duration_sec - 0.25:
            fade_in = min(1.0, (t - 0.25) / 0.05)
            fade_out = min(1.0, (duration_sec - 0.25 - t) / 0.05)
            env = max(0.0, min(fade_in, fade_out))
            value = env * amp * math.sin(2.0 * math.pi * freq_hz * t)
        else:
            value = 0.0
        frames.append(quantize_16(value))
    return frames


def apply_candidate(samples: list[float], fit: dict[str, Any]) -> list[float]:
    candidate_by_name = {candidate.name: candidate for candidate in CANDIDATES}
    candidate = candidate_by_name[fit["candidate"]]
    input_gain = float(fit["input_gain"])
    output_gain = float(fit["output_gain_linear"])
    result = []
    for sample in samples:
        value = output_gain * candidate.fn(input_gain * sample)
        result.append(max(-1.0, min(1.0, value)))
    return result


def compare_capture(
    capture: dict[str, Any],
    fit: dict[str, Any],
    settings: dict[str, Any],
    click_amp: float,
    max_lag_samples: int,
    lag_search_samples: int,
) -> dict[str, Any]:
    capture_samples, sample_rate = read_left_channel_float(Path(capture["path"]))
    capture_metrics = capture["capture_metrics"]
    click_index = capture_metrics.get("click_index")
    if click_index is None:
        return {
            "name": capture["name"],
            "residual_db": None,
            "reason": "missing_click",
        }

    source = synthesize_sine_probe(
        sample_rate=sample_rate,
        duration_sec=float(settings.get("probe_duration_sec", 3.0)),
        click_amp=click_amp,
        freq_hz=float(capture["overrides"].get("freq_hz", capture.get("freq_hz", settings.get("freq_hz", 1000.0)))),
        amp=float(capture["input_amp"]),
    )
    predicted = apply_candidate(source, fit)

    window = capture["analysis_window"]
    capture_start = int(window["segment_start_sample"])
    source_start = capture_start - int(click_index)
    requested_count = int(window["segment_length_samples"])
    if source_start < 0 or requested_count <= 0:
        return {
            "name": capture["name"],
            "residual_db": None,
            "reason": "no_overlap",
        }

    best_lag: dict[str, Any] | None = None
    for lag in range(-max_lag_samples, max_lag_samples + 1):
        lagged_source_start = source_start + lag
        if lagged_source_start < 0:
            continue
        count = min(
            requested_count,
            lag_search_samples,
            len(capture_samples) - capture_start,
            len(predicted) - lagged_source_start,
        )
        if count <= 0:
            continue

        signal = 0.0
        model = 0.0
        cross = 0.0
        for index in range(count):
            measured = capture_samples[capture_start + index]
            modelled = predicted[lagged_source_start + index]
            signal += measured * measured
            model += modelled * modelled
            cross += measured * modelled
        # With polarity free, the least-squares lag score is signal + model - 2 * abs(cross).
        score = signal + model - (2.0 * abs(cross))
        if best_lag is None or score < best_lag["score"]:
            best_lag = {
                "lag_samples": lag,
                "polarity": 1 if cross >= 0.0 else -1,
                "score": score,
            }

    if best_lag is None:
        return {
            "name": capture["name"],
            "residual_db": None,
            "reason": "no_overlap",
        }

    lagged_source_start = source_start + int(best_lag["lag_samples"])
    count = min(requested_count, len(capture_samples) - capture_start, len(predicted) - lagged_source_start)
    polarity = float(best_lag["polarity"])
    signal = 0.0
    error = 0.0
    peak_error = 0.0
    peak_signal = 0.0
    for index in range(count):
        measured = capture_samples[capture_start + index]
        modelled = polarity * predicted[lagged_source_start + index]
        delta = measured - modelled
        signal += measured * measured
        error += delta * delta
        peak_error = max(peak_error, abs(delta))
        peak_signal = max(peak_signal, abs(measured))
    signal /= count
    error /= count

    return {
        "name": capture["name"],
        "drive_type": DRIVE_TYPE_LABELS.get(float(capture["overrides"].get("Drive Type")), str(capture["overrides"].get("Drive Type"))),
        "candidate": fit["candidate"],
        "input_amp": capture["input_amp"],
        "input_amp_dbfs": capture["input_amp_dbfs"],
        "sample_count": count,
        "lag_samples": best_lag["lag_samples"],
        "polarity": best_lag["polarity"],
        "residual_db": db10(error / max(signal, EPS)),
        "signal_rms_dbfs": db10(signal),
        "error_rms_dbfs": db10(error),
        "peak_signal_dbfs": db20(peak_signal),
        "peak_error_dbfs": db20(peak_error),
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    def csv_value(value: Any) -> Any:
        return finite_or_text(value) if isinstance(value, float) else value

    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "name",
                "drive_type",
                "candidate",
                "input_amp",
                "input_amp_dbfs",
                "sample_count",
                "lag_samples",
                "polarity",
                "residual_db",
                "signal_rms_dbfs",
                "error_rms_dbfs",
                "peak_signal_dbfs",
                "peak_error_dbfs",
                "reason",
            ],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow({key: csv_value(row.get(key, "")) for key in writer.fieldnames})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("analysis", type=Path)
    parser.add_argument("fit_summary", type=Path)
    parser.add_argument("--click-amp", type=float)
    parser.add_argument("--max-lag-samples", type=int, default=128)
    parser.add_argument("--lag-search-samples", type=int, default=8192)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    analysis = json.loads(args.analysis.read_text())
    fit_summary = json.loads(args.fit_summary.read_text())
    best_by_type = fit_summary["best_by_drive_type"]
    settings = analysis["settings"]
    click_amp = args.click_amp if args.click_amp is not None else float(settings.get("click_amp", 0.85))

    rows = []
    for capture in analysis["captures"]:
        drive_type = DRIVE_TYPE_LABELS.get(float(capture["overrides"].get("Drive Type")), str(capture["overrides"].get("Drive Type")))
        rows.append(
            compare_capture(
                capture,
                best_by_type[drive_type],
                settings,
                click_amp,
                args.max_lag_samples,
                args.lag_search_samples,
            )
        )

    valid = [row for row in rows if row.get("residual_db") is not None]
    by_type = {}
    for row in valid:
        by_type.setdefault(row["drive_type"], []).append(row["residual_db"])
    residual_summary = {
        drive_type: {
            "mean_residual_db": sum(values) / len(values),
            "worst_residual_db": max(values),
            "best_residual_db": min(values),
            "count": len(values),
        }
        for drive_type, values in by_type.items()
    }

    output_dir = args.fit_summary.parent
    summary_path = output_dir / "drive_candidate_compare.json"
    csv_path = output_dir / "drive_candidate_compare.csv"
    summary_path.write_text(
        json.dumps(
            {
                "source_analysis": str(args.analysis),
                "source_fit_summary": str(args.fit_summary),
                "compare_note": "Residual score for the fitted memoryless Drive candidate against click-aligned Ableton sine captures.",
                "residual_summary_by_drive_type": residual_summary,
                "captures": rows,
            },
            indent=2,
            default=finite_or_text,
        )
        + "\n"
    )
    write_csv(csv_path, rows)

    print(f"candidate compare: {summary_path}")
    print(f"candidate compare CSV: {csv_path}")
    for drive_type, item in residual_summary.items():
        print(
            f"{drive_type}: mean_residual={item['mean_residual_db']:.2f} dB "
            f"worst={item['worst_residual_db']:.2f} dB count={item['count']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
