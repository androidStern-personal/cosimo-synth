#!/usr/bin/env python3
"""Generate analytic factory waveforms without sampled source material."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from scipy.io import wavfile


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_PATH = REPO_ROOT / "assets" / "factory_sources" / "core-shapes.wav"
SAMPLES_PER_FRAME = 2048
SAMPLE_RATE = 44_100
SOURCE_PEAK = 0.99


def build_core_shapes_frames() -> np.ndarray:
    """Build the canonical Sine, Square, Triangle, Saw single-cycle frames."""
    phase = np.arange(SAMPLES_PER_FRAME, dtype=np.float64) / SAMPLES_PER_FRAME
    frames = np.stack(
        (
            np.sin(2.0 * np.pi * phase),
            np.where(phase < 0.5, 1.0, -1.0),
            (2.0 / np.pi) * np.arcsin(np.sin(2.0 * np.pi * phase)),
            (2.0 * phase) - 1.0,
        ),
        axis=0,
    )
    return (SOURCE_PEAK * frames).astype(np.float32)


def write_core_shapes_wavetable(output_path: Path) -> None:
    """Write the four authored frames as one mono float32 factory WAV."""
    frames = build_core_shapes_frames()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(output_path, SAMPLE_RATE, frames.reshape(-1))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate Cosimo's four-frame Core Shapes factory wavetable.",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    args = parser.parse_args()
    write_core_shapes_wavetable(args.output.resolve())


if __name__ == "__main__":
    main()
