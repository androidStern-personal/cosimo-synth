#!/usr/bin/env python3
"""Run the autonomous Drum Buss Drive measurement, analysis, and fit loop."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
RUNS_DIR = REPO_ROOT / "artifacts" / "drum_buss_research" / "runs"


def run_command(command: list[str]) -> None:
    print("+ " + " ".join(command), flush=True)
    subprocess.run(command, cwd=REPO_ROOT, check=True)


def require_file(path: Path, label: str) -> Path:
    path = path.resolve()
    if not path.exists():
        raise SystemExit(f"{label} does not exist: {path}")
    return path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", default="")
    parser.add_argument(
        "--use-existing-sine-summary",
        type=Path,
        help="Skip Live capture and reuse a prior sine-drive sweep summary.json.",
    )
    parser.add_argument("--skip-device-build", action="store_true")
    parser.add_argument(
        "--reuse-track",
        action="store_true",
        help="Reuse the current DBH__ProbeTrack instead of deleting and rebuilding it.",
    )
    parser.add_argument("--mcp-timeout-sec", type=float, default=45.0)
    parser.add_argument("--load-wait-sec", type=float, default=1.2)
    parser.add_argument("--cooldown-sec", type=float, default=0.75)
    parser.add_argument("--freq-hz", type=float, default=1000.0)
    parser.add_argument("--input-amps", default="0.02,0.04,0.08,0.12,0.16,0.2")
    parser.add_argument("--phase-count", type=int, default=2048)
    parser.add_argument("--start-after-click-sec", type=float, default=0.6)
    parser.add_argument("--segment-length-sec", type=float, default=1.75)
    parser.add_argument("--skip-compare", action="store_true")
    parser.add_argument("--max-lag-samples", type=int, default=128)
    parser.add_argument("--lag-search-samples", type=int, default=8192)
    return parser.parse_args()


def capture_sine_sweep(args: argparse.Namespace, run_id: str) -> Path:
    command = [
        sys.executable,
        "scripts/drum_buss_sine_drive_sweep.py",
        "--run-id",
        run_id,
        "--mcp-timeout-sec",
        str(args.mcp_timeout_sec),
        "--load-wait-sec",
        str(args.load_wait_sec),
        "--cooldown-sec",
        str(args.cooldown_sec),
        "--freq-hz",
        str(args.freq_hz),
        "--input-amps",
        args.input_amps,
    ]
    if args.skip_device_build:
        command.append("--skip-device-build")
    if not args.reuse_track:
        command.append("--fresh-track")
    run_command(command)
    return require_file(RUNS_DIR / f"{run_id}_sine_drive_sweep" / "summary.json", "capture summary")


def analyze_sine_sweep(args: argparse.Namespace, summary_path: Path) -> Path:
    command = [
        sys.executable,
        "scripts/drum_buss_analyze_sine_sweep.py",
        str(summary_path),
        "--start-after-click-sec",
        str(args.start_after_click_sec),
        "--segment-length-sec",
        str(args.segment_length_sec),
    ]
    run_command(command)
    return require_file(summary_path.parent / "analysis" / "sine_analysis_summary.json", "analysis summary")


def fit_drive(args: argparse.Namespace, analysis_path: Path) -> Path:
    command = [
        sys.executable,
        "scripts/drum_buss_fit_drive.py",
        str(analysis_path),
        "--phase-count",
        str(args.phase_count),
    ]
    run_command(command)
    return require_file(analysis_path.parent / "drive_fit_summary.json", "fit summary")


def compare_drive(args: argparse.Namespace, analysis_path: Path, fit_summary_path: Path) -> Path:
    command = [
        sys.executable,
        "scripts/drum_buss_compare_drive_candidate.py",
        str(analysis_path),
        str(fit_summary_path),
        "--max-lag-samples",
        str(args.max_lag_samples),
        "--lag-search-samples",
        str(args.lag_search_samples),
    ]
    run_command(command)
    return require_file(analysis_path.parent / "drive_candidate_compare.json", "candidate compare summary")


def main() -> int:
    args = parse_args()
    run_id = args.run_id or datetime.now().strftime("drive_%Y%m%d_%H%M%S")

    if args.use_existing_sine_summary:
        summary_path = require_file(args.use_existing_sine_summary, "existing sine summary")
    else:
        summary_path = capture_sine_sweep(args, run_id)

    analysis_path = analyze_sine_sweep(args, summary_path)
    fit_summary_path = fit_drive(args, analysis_path)
    compare_summary_path = None if args.skip_compare else compare_drive(args, analysis_path, fit_summary_path)

    fit_summary = json.loads(fit_summary_path.read_text())
    compare_summary = json.loads(compare_summary_path.read_text()) if compare_summary_path else None
    pipeline_summary = {
        "run_id": run_id,
        "source_sine_summary": str(summary_path),
        "analysis_summary": str(analysis_path),
        "fit_summary": str(fit_summary_path),
        "fit_rankings": str(fit_summary_path.parent / "drive_fit_rankings.csv"),
        "candidate_compare": None if compare_summary_path is None else str(compare_summary_path),
        "candidate_compare_csv": None if compare_summary_path is None else str(compare_summary_path.parent / "drive_candidate_compare.csv"),
        "best_by_drive_type": {
            drive_type: {
                "candidate": fit["candidate"],
                "input_gain": fit["input_gain"],
                "output_gain_db": fit["output_gain_db"],
                "rms_error_db": fit["rms_error_db"],
                "max_abs_error_db": fit["max_abs_error_db"],
            }
            for drive_type, fit in fit_summary["best_by_drive_type"].items()
        },
        "residual_summary_by_drive_type": None if compare_summary is None else compare_summary["residual_summary_by_drive_type"],
    }
    pipeline_summary_path = fit_summary_path.parent / "drive_pipeline_summary.json"
    pipeline_summary_path.write_text(json.dumps(pipeline_summary, indent=2) + "\n")

    print(f"pipeline summary: {pipeline_summary_path}")
    for drive_type, fit in pipeline_summary["best_by_drive_type"].items():
        print(
            f"{drive_type}: {fit['candidate']} "
            f"input_gain={fit['input_gain']:.6g} "
            f"output_gain_db={fit['output_gain_db']:.2f} "
            f"rms_error={fit['rms_error_db']:.2f} dB"
        )
    if compare_summary is not None:
        for drive_type, item in pipeline_summary["residual_summary_by_drive_type"].items():
            print(
                f"{drive_type}: candidate_residual_mean={item['mean_residual_db']:.2f} dB "
                f"worst={item['worst_residual_db']:.2f} dB"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
