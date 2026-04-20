#!/usr/bin/env python3
"""Analyze pure-sine Drum Buss captures for harmonic fingerprints."""

from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path
from typing import Any

from drum_buss_analyze_sweep import (
    dbfs_from_peak_amplitude,
    finite_or_text,
    hann_window,
    read_left_channel,
    segment_stats,
    tone_peak_amplitude,
    windowed_segment,
)


def analyze_capture(
    capture: dict[str, Any],
    start_after_click_sec: float,
    segment_length_sec: float,
    max_harmonic: int,
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
    fundamental = float(capture["freq_hz"])
    rows = []
    for harmonic in range(1, max_harmonic + 1):
        freq = fundamental * harmonic
        if freq >= sample_rate * 0.48:
            break
        amp = tone_peak_amplitude(segment, sample_rate, freq, window)
        rows.append(
            {
                "harmonic": harmonic,
                "freq_hz": freq,
                "peak_amplitude": amp,
                "dbfs": dbfs_from_peak_amplitude(amp),
            }
        )
    fundamental_dbfs = rows[0]["dbfs"] if rows else float("-inf")
    for row in rows:
        row["relative_to_fundamental_db"] = row["dbfs"] - fundamental_dbfs
    odd_energy = sum(
        row["peak_amplitude"] ** 2 for row in rows if row["harmonic"] > 1 and row["harmonic"] % 2 == 1
    )
    even_energy = sum(
        row["peak_amplitude"] ** 2 for row in rows if row["harmonic"] > 1 and row["harmonic"] % 2 == 0
    )
    harmonic_energy = odd_energy + even_energy
    fundamental_amp = rows[0]["peak_amplitude"] if rows else 0.0
    return {
        "index": capture["index"],
        "name": capture["name"],
        "path": str(path),
        "input_amp": capture["input_amp"],
        "input_amp_dbfs": capture["input_amp_dbfs"],
        "params": capture["params"],
        "overrides": capture["overrides"],
        "capture_metrics": metrics,
        "analysis_window": {
            "segment_start_sample": segment_start,
            "segment_length_samples": len(segment),
            "start_after_click_sec": start_after_click_sec,
            "segment_length_sec": segment_length_sec,
        },
        "segment_stats": segment_stats(segment),
        "harmonics": rows,
        "thd_db": (
            float("-inf")
            if harmonic_energy <= 0.0 or fundamental_amp <= 0.0
            else 10.0 * math.log10(harmonic_energy / (fundamental_amp * fundamental_amp))
        ),
        "odd_even_ratio_db": (
            None
            if even_energy <= 0.0 or odd_energy <= 0.0
            else 10.0 * math.log10(odd_energy / even_energy)
        ),
    }


def write_csvs(output_dir: Path, analyses: list[dict[str, Any]]) -> None:
    summary_path = output_dir / "sine_capture_summary.csv"
    with summary_path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "index",
                "name",
                "input_amp",
                "input_amp_dbfs",
                "drive_type",
                "capture_peak",
                "segment_rms_dbfs",
                "fundamental_dbfs",
                "thd_db",
                "odd_even_ratio_db",
                "clipped",
            ],
        )
        writer.writeheader()
        for item in analyses:
            harmonics = item["harmonics"]
            fundamental_dbfs = harmonics[0]["dbfs"] if harmonics else float("-inf")
            writer.writerow(
                {
                    "index": item["index"],
                    "name": item["name"],
                    "input_amp": item["input_amp"],
                    "input_amp_dbfs": item["input_amp_dbfs"],
                    "drive_type": item["overrides"].get("Drive Type"),
                    "capture_peak": item["capture_metrics"]["peak"],
                    "segment_rms_dbfs": finite_or_text(item["segment_stats"]["segment_rms_dbfs"]),
                    "fundamental_dbfs": finite_or_text(fundamental_dbfs),
                    "thd_db": finite_or_text(item["thd_db"]),
                    "odd_even_ratio_db": (
                        "" if item["odd_even_ratio_db"] is None else finite_or_text(item["odd_even_ratio_db"])
                    ),
                    "clipped": item["capture_metrics"]["peak"] >= 32767 or item["segment_stats"]["clipped"],
                }
            )

    harmonics_path = output_dir / "sine_harmonics.csv"
    with harmonics_path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "index",
                "name",
                "input_amp_dbfs",
                "drive_type",
                "harmonic",
                "freq_hz",
                "dbfs",
                "relative_to_fundamental_db",
            ],
        )
        writer.writeheader()
        for item in analyses:
            for row in item["harmonics"]:
                writer.writerow(
                    {
                        "index": item["index"],
                        "name": item["name"],
                        "input_amp_dbfs": item["input_amp_dbfs"],
                        "drive_type": item["overrides"].get("Drive Type"),
                        "harmonic": row["harmonic"],
                        "freq_hz": row["freq_hz"],
                        "dbfs": finite_or_text(row["dbfs"]),
                        "relative_to_fundamental_db": finite_or_text(row["relative_to_fundamental_db"]),
                    }
                )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("summary", type=Path)
    parser.add_argument("--start-after-click-sec", type=float, default=0.6)
    parser.add_argument("--segment-length-sec", type=float, default=1.75)
    parser.add_argument("--max-harmonic", type=int, default=10)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    sweep_summary = json.loads(args.summary.read_text())
    analyses = [
        analyze_capture(
            capture,
            start_after_click_sec=args.start_after_click_sec,
            segment_length_sec=args.segment_length_sec,
            max_harmonic=args.max_harmonic,
        )
        for capture in sweep_summary["captures"]
    ]
    output_dir = args.summary.parent / "analysis"
    output_dir.mkdir(parents=True, exist_ok=True)
    clipped = [
        {"index": item["index"], "name": item["name"], "peak": item["capture_metrics"]["peak"]}
        for item in analyses
        if item["capture_metrics"]["peak"] >= 32767 or item["segment_stats"]["clipped"]
    ]
    summary = {
        "source_summary_path": str(args.summary),
        "analysis_note": "Pure 1 kHz sine harmonic analysis using targeted Hann-windowed DFT bins.",
        "settings": sweep_summary["settings"],
        "clipped_captures": clipped,
        "captures": analyses,
    }
    summary_path = output_dir / "sine_analysis_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, default=finite_or_text) + "\n")
    write_csvs(output_dir, analyses)
    print(f"analysis: {summary_path}")
    print(f"capture CSV: {output_dir / 'sine_capture_summary.csv'}")
    print(f"harmonic CSV: {output_dir / 'sine_harmonics.csv'}")
    print(f"clipped captures: {len(clipped)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
