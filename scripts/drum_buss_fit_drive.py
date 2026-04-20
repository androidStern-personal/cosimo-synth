#!/usr/bin/env python3
"""Fit first-pass symmetric Drive waveshaper candidates from sine-sweep data."""

from __future__ import annotations

import argparse
import csv
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from drum_buss_analyze_sweep import finite_or_text


DRIVE_TYPE_LABELS = {
    0.0: "soft",
    1.0: "medium",
    2.0: "hard",
}
HARMONICS = [1, 3, 5, 7]
EPS = 1.0e-12


@dataclass(frozen=True)
class Candidate:
    name: str
    fn: Callable[[float], float]


def clamp(value: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, value))


def softclip_cubic(x: float) -> float:
    if x >= 1.0:
        return 1.0
    if x <= -1.0:
        return -1.0
    return 1.5 * x - 0.5 * x * x * x


CANDIDATES = [
    Candidate("tanh", math.tanh),
    Candidate("atan", lambda x: (2.0 / math.pi) * math.atan(x)),
    Candidate("algebraic_sqrt", lambda x: x / math.sqrt(1.0 + x * x)),
    Candidate("algebraic_abs", lambda x: x / (1.0 + abs(x))),
    Candidate("cubic_softclip", softclip_cubic),
    Candidate("hardclip", lambda x: clamp(x, -1.0, 1.0)),
]


def db20(value: float) -> float:
    if value <= 0.0:
        return float("-inf")
    return 20.0 * math.log10(value)


def amp_from_dbfs(dbfs: float) -> float:
    return 10.0 ** (dbfs / 20.0)


def logspace(start_exp: float, stop_exp: float, count: int) -> list[float]:
    if count <= 1:
        return [10.0**start_exp]
    return [
        10.0 ** (start_exp + (stop_exp - start_exp) * index / (count - 1))
        for index in range(count)
    ]


def read_measurements(analysis_path: Path) -> list[dict]:
    summary = json.loads(analysis_path.read_text())
    rows = []
    for capture in summary["captures"]:
        drive_type = float(capture["overrides"].get("Drive Type"))
        harmonic_by_number = {
            int(row["harmonic"]): row for row in capture["harmonics"]
        }
        if 1 not in harmonic_by_number:
            continue
        fundamental_dbfs = float(harmonic_by_number[1]["dbfs"])
        harmonic_rel = {}
        for harmonic in HARMONICS[1:]:
            if harmonic in harmonic_by_number:
                harmonic_rel[harmonic] = float(
                    harmonic_by_number[harmonic]["relative_to_fundamental_db"]
                )
        rows.append(
            {
                "name": capture["name"],
                "drive_type": drive_type,
                "drive_type_label": DRIVE_TYPE_LABELS.get(drive_type, str(drive_type)),
                "input_amp": float(capture["input_amp"]),
                "input_amp_dbfs": float(capture["input_amp_dbfs"]),
                "fundamental_dbfs": fundamental_dbfs,
                "harmonic_rel": harmonic_rel,
                "capture_peak": capture["capture_metrics"]["peak"],
            }
        )
    return rows


class PhaseProjector:
    """Fast one-cycle Fourier projector for memoryless sine waveshaper fitting."""

    def __init__(self, harmonics: list[int], phase_count: int) -> None:
        self.harmonics = harmonics
        self.phase_count = phase_count
        self.points = []
        for index in range(phase_count):
            phase = 2.0 * math.pi * index / phase_count
            self.points.append(
                (
                    math.sin(phase),
                    [math.cos(harmonic * phase) for harmonic in harmonics],
                    [math.sin(harmonic * phase) for harmonic in harmonics],
                )
            )

    def amplitudes(
        self,
        candidate: Candidate,
        input_amp: float,
        input_gain: float,
    ) -> dict[int, float]:
        real = [0.0 for _ in self.harmonics]
        imag = [0.0 for _ in self.harmonics]
        drive = input_gain * input_amp
        for sin_phase, cos_basis, sin_basis in self.points:
            value = candidate.fn(drive * sin_phase)
            for index in range(len(self.harmonics)):
                real[index] += value * cos_basis[index]
                imag[index] += value * sin_basis[index]
        scale = 2.0 / self.phase_count
        return {
            harmonic: scale * math.hypot(real[index], imag[index])
            for index, harmonic in enumerate(self.harmonics)
        }


def score_candidate(
    rows: list[dict],
    candidate: Candidate,
    input_gain: float,
    projector: PhaseProjector,
) -> dict:
    simulated = []
    output_db_offsets = []
    for row in rows:
        sim = projector.amplitudes(
            candidate,
            input_amp=row["input_amp"],
            input_gain=input_gain,
        )
        h1 = max(sim.get(1, 0.0), EPS)
        sim_h1_dbfs = db20(h1)
        output_db_offsets.append(row["fundamental_dbfs"] - sim_h1_dbfs)
        simulated.append((row, sim, sim_h1_dbfs))

    output_gain_db = sum(output_db_offsets) / len(output_db_offsets)
    errors = []
    details = []
    for row, sim, sim_h1_dbfs in simulated:
        h1 = max(sim.get(1, 0.0), EPS)
        predicted_fundamental_dbfs = sim_h1_dbfs + output_gain_db
        fundamental_error = predicted_fundamental_dbfs - row["fundamental_dbfs"]
        errors.append(fundamental_error)
        ratio_errors = {}
        for harmonic, measured_rel in row["harmonic_rel"].items():
            sim_h = max(sim.get(harmonic, 0.0), EPS)
            predicted_rel = db20(sim_h / h1)
            ratio_error = predicted_rel - measured_rel
            # Harmonic ratios define the waveshaper shape, so score them harder.
            weight = 2.5 if harmonic == 3 else 1.5
            errors.extend([ratio_error] * int(weight * 2))
            ratio_errors[str(harmonic)] = {
                "measured_rel_db": measured_rel,
                "predicted_rel_db": predicted_rel,
                "error_db": ratio_error,
            }
        details.append(
            {
                "name": row["name"],
                "input_amp_dbfs": row["input_amp_dbfs"],
                "measured_fundamental_dbfs": row["fundamental_dbfs"],
                "predicted_fundamental_dbfs": predicted_fundamental_dbfs,
                "fundamental_error_db": fundamental_error,
                "harmonic_ratio_errors": ratio_errors,
            }
        )

    rms_error = math.sqrt(sum(error * error for error in errors) / len(errors))
    max_abs_error = max(abs(error) for error in errors)
    return {
        "candidate": candidate.name,
        "input_gain": input_gain,
        "output_gain_db": output_gain_db,
        "output_gain_linear": 10.0 ** (output_gain_db / 20.0),
        "rms_error_db": rms_error,
        "max_abs_error_db": max_abs_error,
        "details": details,
    }


def fit_drive_type(
    rows: list[dict],
    projector: PhaseProjector,
) -> list[dict]:
    coarse = logspace(-1.0, 2.3, 48)
    scored: list[dict] = []
    for candidate in CANDIDATES:
        coarse_scores = [
            score_candidate(rows, candidate, gain, projector)
            for gain in coarse
        ]
        best = min(coarse_scores, key=lambda item: item["rms_error_db"])
        center = math.log10(best["input_gain"])
        fine = logspace(center - 0.12, center + 0.12, 36)
        fine_scores = [
            score_candidate(rows, candidate, gain, projector)
            for gain in fine
        ]
        scored.append(min(fine_scores, key=lambda item: item["rms_error_db"]))
    return sorted(scored, key=lambda item: item["rms_error_db"])


def write_csv(path: Path, fits_by_type: dict[str, list[dict]]) -> None:
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "drive_type",
                "rank",
                "candidate",
                "input_gain",
                "output_gain_db",
                "rms_error_db",
                "max_abs_error_db",
            ],
        )
        writer.writeheader()
        for drive_type, fits in fits_by_type.items():
            for rank, fit in enumerate(fits, start=1):
                writer.writerow(
                    {
                        "drive_type": drive_type,
                        "rank": rank,
                        "candidate": fit["candidate"],
                        "input_gain": fit["input_gain"],
                        "output_gain_db": fit["output_gain_db"],
                        "rms_error_db": fit["rms_error_db"],
                        "max_abs_error_db": fit["max_abs_error_db"],
                    }
                )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("analysis", type=Path)
    parser.add_argument("--phase-count", type=int, default=2048)
    parser.add_argument("--sample-rate", type=int, default=44100, help=argparse.SUPPRESS)
    parser.add_argument("--freq-hz", type=float, default=1000.0, help=argparse.SUPPRESS)
    parser.add_argument("--duration-sec", type=float, default=1.75, help=argparse.SUPPRESS)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    rows = read_measurements(args.analysis)
    projector = PhaseProjector(HARMONICS, args.phase_count)
    output_dir = args.analysis.parent
    fits_by_type: dict[str, list[dict]] = {}
    for drive_type in sorted({row["drive_type"] for row in rows}):
        label = DRIVE_TYPE_LABELS.get(drive_type, str(drive_type))
        type_rows = [row for row in rows if row["drive_type"] == drive_type]
        fits_by_type[label] = fit_drive_type(
            type_rows,
            projector=projector,
        )

    best = {drive_type: fits[0] for drive_type, fits in fits_by_type.items()}
    summary = {
        "source_analysis": str(args.analysis),
        "fit_note": (
            "First-pass memoryless symmetric waveshaper fit. Model is "
            "y = output_gain * shaper(input_gain * x). Scored against 1 kHz sine "
            "fundamental and odd-harmonic ratios."
        ),
        "harmonics_scored": HARMONICS,
        "phase_count": args.phase_count,
        "best_by_drive_type": best,
        "all_fits_by_drive_type": fits_by_type,
        "candidate_formulas": {
            "tanh": "tanh(x)",
            "atan": "(2/pi) * atan(x)",
            "algebraic_sqrt": "x / sqrt(1 + x^2)",
            "algebraic_abs": "x / (1 + abs(x))",
            "cubic_softclip": "1.5*x - 0.5*x^3 for |x| < 1, else sign(x)",
            "hardclip": "clamp(x, -1, 1)",
        },
    }
    summary_path = output_dir / "drive_fit_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, default=finite_or_text) + "\n")
    csv_path = output_dir / "drive_fit_rankings.csv"
    write_csv(csv_path, fits_by_type)
    print(f"fit summary: {summary_path}")
    print(f"fit rankings: {csv_path}")
    for drive_type, fit in best.items():
        print(
            f"{drive_type}: {fit['candidate']} "
            f"input_gain={fit['input_gain']:.6g} "
            f"output_gain_db={fit['output_gain_db']:.2f} "
            f"rms_error={fit['rms_error_db']:.2f} dB"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
