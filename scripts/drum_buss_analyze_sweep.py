#!/usr/bin/env python3
"""Analyze Drum Buss sweep captures without external DSP dependencies."""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
import wave
from array import array
from pathlib import Path
from typing import Any


TONES_HZ = [80.0, 220.0, 1000.0, 3000.0, 7000.0, 11000.0]
HARMONIC_FUNDAMENTALS_HZ = [80.0, 220.0, 1000.0, 3000.0]
EPS = 1.0e-20


def db20(value: float) -> float:
    if value <= 0.0:
        return float("-inf")
    return 20.0 * math.log10(value)


def dbfs_from_peak_amplitude(value: float) -> float:
    return db20(value / 32768.0)


def finite_or_text(value: float) -> float | str:
    if math.isinf(value):
        return "-inf" if value < 0 else "inf"
    if math.isnan(value):
        return "nan"
    return value


def read_left_channel(path: Path) -> tuple[list[float], int]:
    with wave.open(str(path), "rb") as wav:
        channels = wav.getnchannels()
        sample_rate = wav.getframerate()
        sample_width = wav.getsampwidth()
        frames = wav.getnframes()
        raw = wav.readframes(frames)
    if sample_width != 2:
        raise RuntimeError(f"{path} is not 16-bit PCM")
    samples = array("h")
    samples.frombytes(raw)
    if channels < 1:
        raise RuntimeError(f"{path} has no channels")
    return [float(value) for value in samples[0::channels]], sample_rate


def windowed_segment(
    left: list[float],
    sample_rate: int,
    click_index: int | None,
    start_after_click_sec: float,
    length_sec: float,
) -> tuple[list[float], int]:
    click = click_index or 0
    start = click + int(round(start_after_click_sec * sample_rate))
    length = int(round(length_sec * sample_rate))
    if start < 0:
        start = 0
    if start + length > len(left):
        start = max(0, len(left) - length)
    return left[start : start + length], start


def hann_window(length: int) -> list[float]:
    if length <= 1:
        return [1.0] * length
    return [0.5 - 0.5 * math.cos((2.0 * math.pi * index) / (length - 1)) for index in range(length)]


def tone_peak_amplitude(segment: list[float], sample_rate: int, freq_hz: float, window: list[float]) -> float:
    omega = 2.0 * math.pi * freq_hz / sample_rate
    real = 0.0
    imag = 0.0
    window_sum = 0.0
    for index, sample in enumerate(segment):
        weight = window[index]
        angle = omega * index
        real += sample * weight * math.cos(angle)
        imag -= sample * weight * math.sin(angle)
        window_sum += weight
    if window_sum <= 0.0:
        return 0.0
    return 2.0 * math.hypot(real, imag) / window_sum


def segment_stats(segment: list[float]) -> dict[str, float | int | bool]:
    if not segment:
        return {
            "segment_peak": 0,
            "segment_rms": 0.0,
            "segment_peak_dbfs": float("-inf"),
            "segment_rms_dbfs": float("-inf"),
            "crest_db": 0.0,
            "clipped_samples": 0,
            "clipped": False,
        }
    peak = max(abs(value) for value in segment)
    rms = math.sqrt(sum(value * value for value in segment) / len(segment))
    clipped_samples = sum(1 for value in segment if abs(value) >= 32767.0)
    return {
        "segment_peak": int(round(peak)),
        "segment_rms": rms,
        "segment_peak_dbfs": dbfs_from_peak_amplitude(peak),
        "segment_rms_dbfs": dbfs_from_peak_amplitude(rms),
        "crest_db": db20((peak + EPS) / (rms + EPS)),
        "clipped_samples": clipped_samples,
        "clipped": clipped_samples > 0,
    }


def analyze_capture(
    capture: dict[str, Any],
    start_after_click_sec: float,
    segment_length_sec: float,
) -> dict[str, Any]:
    path = Path(capture["path"])
    left, sample_rate = read_left_channel(path)
    metrics = capture["metrics"]
    segment, segment_start = windowed_segment(
        left,
        sample_rate,
        metrics.get("click_index"),
        start_after_click_sec,
        segment_length_sec,
    )
    window = hann_window(len(segment))
    tone_rows = []
    tone_map = {}
    for freq in TONES_HZ:
        amplitude = tone_peak_amplitude(segment, sample_rate, freq, window)
        row = {
            "freq_hz": freq,
            "peak_amplitude": amplitude,
            "dbfs": dbfs_from_peak_amplitude(amplitude),
        }
        tone_rows.append(row)
        tone_map[str(freq)] = row

    harmonic_rows = []
    for fundamental in HARMONIC_FUNDAMENTALS_HZ:
        for harmonic in range(2, 9):
            freq = fundamental * harmonic
            if freq >= sample_rate * 0.48:
                continue
            amplitude = tone_peak_amplitude(segment, sample_rate, freq, window)
            harmonic_rows.append(
                {
                    "fundamental_hz": fundamental,
                    "harmonic": harmonic,
                    "freq_hz": freq,
                    "peak_amplitude": amplitude,
                    "dbfs": dbfs_from_peak_amplitude(amplitude),
                }
            )

    return {
        "capture_index": capture["index"],
        "name": capture["name"],
        "path": str(path),
        "overrides": capture.get("overrides", {}),
        "params": capture.get("params", {}),
        "capture_metrics": metrics,
        "analysis_window": {
            "segment_start_sample": segment_start,
            "segment_length_samples": len(segment),
            "start_after_click_sec": start_after_click_sec,
            "segment_length_sec": segment_length_sec,
        },
        "segment_stats": segment_stats(segment),
        "tones": tone_rows,
        "tone_map": tone_map,
        "harmonic_bins": harmonic_rows,
    }


def write_csvs(output_dir: Path, analyses: list[dict[str, Any]], reference_name: str) -> None:
    capture_path = output_dir / "capture_summary.csv"
    with capture_path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "index",
                "name",
                "capture_peak",
                "capture_rms",
                "capture_click_index",
                "segment_peak",
                "segment_rms",
                "segment_peak_dbfs",
                "segment_rms_dbfs",
                "crest_db",
                "clipped_samples",
                "clipped",
                "quiet",
            ],
        )
        writer.writeheader()
        for analysis in analyses:
            metrics = analysis["capture_metrics"]
            stats = analysis["segment_stats"]
            writer.writerow(
                {
                    "index": analysis["capture_index"],
                    "name": analysis["name"],
                    "capture_peak": metrics["peak"],
                    "capture_rms": metrics["rms"],
                    "capture_click_index": metrics["click_index"],
                    "segment_peak": stats["segment_peak"],
                    "segment_rms": stats["segment_rms"],
                    "segment_peak_dbfs": finite_or_text(stats["segment_peak_dbfs"]),
                    "segment_rms_dbfs": finite_or_text(stats["segment_rms_dbfs"]),
                    "crest_db": finite_or_text(stats["crest_db"]),
                    "clipped_samples": stats["clipped_samples"],
                    "clipped": stats["clipped"],
                    "quiet": metrics["peak"] < 1024,
                }
            )

    reference = next((item for item in analyses if item["name"] == reference_name), analyses[0])
    reference_tones = {row["freq_hz"]: row for row in reference["tones"]}

    tone_path = output_dir / "tone_magnitudes.csv"
    with tone_path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "index",
                "name",
                "freq_hz",
                "dbfs",
                "relative_to_reference_db",
                "reference_name",
            ],
        )
        writer.writeheader()
        for analysis in analyses:
            for tone in analysis["tones"]:
                ref_db = reference_tones[tone["freq_hz"]]["dbfs"]
                relative = tone["dbfs"] - ref_db
                writer.writerow(
                    {
                        "index": analysis["capture_index"],
                        "name": analysis["name"],
                        "freq_hz": tone["freq_hz"],
                        "dbfs": finite_or_text(tone["dbfs"]),
                        "relative_to_reference_db": finite_or_text(relative),
                        "reference_name": reference_name,
                    }
                )

    harmonic_path = output_dir / "harmonic_bins.csv"
    with harmonic_path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "index",
                "name",
                "fundamental_hz",
                "harmonic",
                "freq_hz",
                "dbfs",
            ],
        )
        writer.writeheader()
        for analysis in analyses:
            for row in analysis["harmonic_bins"]:
                writer.writerow(
                    {
                        "index": analysis["capture_index"],
                        "name": analysis["name"],
                        "fundamental_hz": row["fundamental_hz"],
                        "harmonic": row["harmonic"],
                        "freq_hz": row["freq_hz"],
                        "dbfs": finite_or_text(row["dbfs"]),
                    }
                )


def build_summary(
    sweep_summary: dict[str, Any],
    analyses: list[dict[str, Any]],
    reference_name: str,
) -> dict[str, Any]:
    clipped = [
        {
            "index": item["capture_index"],
            "name": item["name"],
            "peak": item["capture_metrics"]["peak"],
            "segment_clipped_samples": item["segment_stats"]["clipped_samples"],
        }
        for item in analyses
        if item["capture_metrics"]["peak"] >= 32767 or item["segment_stats"]["clipped"]
    ]
    quiet = [
        {
            "index": item["capture_index"],
            "name": item["name"],
            "peak": item["capture_metrics"]["peak"],
        }
        for item in analyses
        if item["capture_metrics"]["peak"] < 1024
    ]

    reference = next((item for item in analyses if item["name"] == reference_name), analyses[0])
    ref_tones = {row["freq_hz"]: row["dbfs"] for row in reference["tones"]}
    tone_ratio_highlights = []
    for item in analyses:
        tone_map = {row["freq_hz"]: row["dbfs"] for row in item["tones"]}
        tone_ratio_highlights.append(
            {
                "index": item["capture_index"],
                "name": item["name"],
                "tone_relative_db": {
                    str(freq): finite_or_text(tone_map[freq] - ref_tones[freq])
                    for freq in TONES_HZ
                },
                "segment_rms_dbfs": finite_or_text(item["segment_stats"]["segment_rms_dbfs"]),
            }
        )

    return {
        "source_summary": sweep_summary.get("run_id"),
        "source_summary_path": None,
        "reference_name": reference_name,
        "scope_note": sweep_summary.get("scope_note"),
        "analysis_note": (
            "Dependency-free targeted DFT analysis. Tone magnitudes use a Hann-windowed "
            "steady-state segment and are amplitude estimates at the explicit probe bins."
        ),
        "tones_hz": TONES_HZ,
        "clipped_captures": clipped,
        "quiet_captures": quiet,
        "tone_ratio_highlights": tone_ratio_highlights,
        "captures": analyses,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "summary",
        type=Path,
        help="Path to a drum_buss_parameter_sweep.py summary.json file.",
    )
    parser.add_argument("--reference-name", default="drywet_0")
    parser.add_argument("--start-after-click-sec", type=float, default=0.75)
    parser.add_argument("--segment-length-sec", type=float, default=2.5)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    sweep_summary = json.loads(args.summary.read_text())
    captures = sweep_summary["captures"]
    analyses = [
        analyze_capture(
            capture,
            start_after_click_sec=args.start_after_click_sec,
            segment_length_sec=args.segment_length_sec,
        )
        for capture in captures
    ]
    output_dir = args.summary.parent / "analysis"
    output_dir.mkdir(parents=True, exist_ok=True)
    summary = build_summary(sweep_summary, analyses, args.reference_name)
    summary["source_summary_path"] = str(args.summary)
    summary_path = output_dir / "analysis_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, default=finite_or_text) + "\n")
    write_csvs(output_dir, analyses, args.reference_name)

    print(f"analysis: {summary_path}")
    print(f"capture CSV: {output_dir / 'capture_summary.csv'}")
    print(f"tone CSV: {output_dir / 'tone_magnitudes.csv'}")
    print(f"harmonic CSV: {output_dir / 'harmonic_bins.csv'}")
    print(f"clipped captures: {len(summary['clipped_captures'])}")
    print(f"quiet captures: {len(summary['quiet_captures'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
