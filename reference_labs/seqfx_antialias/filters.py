"""Independent coefficient oracle for the filters embedded in SeqFx.cmajor."""

from __future__ import annotations

from argparse import ArgumentParser
from json import dumps
from math import log10

import numpy as np
from scipy.signal import freqz, remez


def fixed_mip_coefficients() -> np.ndarray:
    """Generate the normalized 31-tap 2:1 mip-decimation filter."""
    coefficients = remez(
        31,
        [0.0, 0.20, 0.30, 0.50],
        [1.0, 0.0],
        weight=[1.0, 10.0],
        fs=1.0,
    )
    return coefficients / np.sum(coefficients)


def adaptive_speedup_coefficients(residual_ratio: float) -> np.ndarray:
    """Generate the normalized 47-tap residual-rate filter used by Pitch/Stutter."""
    ratio = max(1.0, float(residual_ratio))
    cutoff = float(np.clip(0.44 / ratio, 0.05, 0.475))
    offsets = np.arange(-23, 24, dtype=np.float64)
    coefficients = 2.0 * cutoff * np.sinc(2.0 * cutoff * offsets)
    coefficients *= np.blackman(47)
    return coefficients / np.sum(coefficients)


def response_db(coefficients: np.ndarray, frequency: float) -> float:
    """Return magnitude in dB at a normalized cycles-per-sample frequency."""
    _, response = freqz(coefficients, worN=np.asarray([frequency * 2.0 * np.pi]))
    return 20.0 * log10(max(1.0e-12, float(abs(response[0]))))


def _main() -> None:
    parser = ArgumentParser()
    parser.add_argument("--ratio", type=float, action="append", default=[])
    arguments = parser.parse_args()
    ratios = arguments.ratio or [1.1, 1.25, 1.5, 1.75, 2.0]
    fixed = fixed_mip_coefficients()
    report = {
        "fixed_mip": {
            "tap_count": int(fixed.size),
            "dc_db": response_db(fixed, 0.0),
            "passband_edge_db": response_db(fixed, 0.20),
            "stopband_edge_db": response_db(fixed, 0.30),
            "half_coefficients": fixed[15:].tolist(),
        },
        "adaptive": [],
    }
    for ratio in ratios:
        coefficients = adaptive_speedup_coefficients(ratio)
        report["adaptive"].append(
            {
                "ratio": ratio,
                "tap_count": int(coefficients.size),
                "dc_db": response_db(coefficients, 0.0),
                "pass_probe_hz_per_sample": 0.36 / ratio,
                "pass_probe_db": response_db(coefficients, 0.36 / ratio),
                "reject_probe_hz_per_sample": min(0.49, (0.5 / ratio) + 0.08),
                "reject_probe_db": response_db(
                    coefficients,
                    min(0.49, (0.5 / ratio) + 0.08),
                ),
            }
        )
    print(dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    _main()
