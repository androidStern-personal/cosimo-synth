from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from numpy.testing import assert_allclose, assert_array_equal
from scipy.io import wavfile


REPO_ROOT = Path(__file__).resolve().parents[1]
SAMPLES_PER_FRAME = 2048
DEFAULT_TABLE_ID = "core-shapes"
DEFAULT_TABLE_NAME = "Core Shapes"
DEFAULT_SOURCE_RESOURCE = "factory_sources/core-shapes.wav"
DEFAULT_RUNTIME_RESOURCE = f"assets/{DEFAULT_SOURCE_RESOURCE}"
DEFAULT_TABLE_INDEX = 35
SOURCE_PEAK = 0.99


def _expected_default_frames() -> np.ndarray:
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


def test_shipped_default_factory_wavetable_is_exactly_sine_square_triangle_saw() -> None:
    source_catalog = json.loads(
        (REPO_ROOT / "assets" / "factory-table-catalog.json").read_text(encoding="utf-8")
    )
    runtime_catalog = json.loads(
        (REPO_ROOT / "assets" / "factory-bank-catalog.json").read_text(encoding="utf-8")
    )

    source_matches = [
        (index, entry)
        for index, entry in enumerate(source_catalog)
        if entry.get("tableId") == DEFAULT_TABLE_ID
    ]
    runtime_matches = [
        (index, entry)
        for index, entry in enumerate(runtime_catalog["tables"])
        if entry.get("tableId") == DEFAULT_TABLE_ID
    ]

    assert source_matches == [
        (
            DEFAULT_TABLE_INDEX,
            {
                "tableId": DEFAULT_TABLE_ID,
                "name": DEFAULT_TABLE_NAME,
                "source": DEFAULT_SOURCE_RESOURCE,
            },
        )
    ]
    assert runtime_matches == [
        (
            DEFAULT_TABLE_INDEX,
            {
                "tableId": DEFAULT_TABLE_ID,
                "name": DEFAULT_TABLE_NAME,
                "frameCount": 4,
                "sourceWav": DEFAULT_RUNTIME_RESOURCE,
            },
        )
    ]

    sample_rate, audio = wavfile.read(REPO_ROOT / "assets" / DEFAULT_SOURCE_RESOURCE)
    shipped_frames = np.asarray(audio)

    assert sample_rate == 44_100
    assert shipped_frames.dtype == np.float32
    assert shipped_frames.shape == (4 * SAMPLES_PER_FRAME,)
    shipped_frames = shipped_frames.reshape(4, SAMPLES_PER_FRAME)
    expected_frames = _expected_default_frames()

    assert_allclose(shipped_frames, expected_frames, atol=1e-7, rtol=0.0)
    assert len({frame.tobytes() for frame in shipped_frames}) == 4

    quarter = SAMPLES_PER_FRAME // 4
    half = SAMPLES_PER_FRAME // 2
    three_quarter = 3 * SAMPLES_PER_FRAME // 4
    sine, square, triangle, saw = shipped_frames

    assert_allclose(
        sine[[0, quarter, half, three_quarter]],
        np.array([0.0, SOURCE_PEAK, 0.0, -SOURCE_PEAK]),
        atol=1e-6,
        rtol=0.0,
    )
    assert_array_equal(square[:half], np.full(half, SOURCE_PEAK, dtype=np.float32))
    assert_array_equal(square[half:], np.full(half, -SOURCE_PEAK, dtype=np.float32))
    assert_allclose(
        triangle[[0, quarter, half, three_quarter]],
        np.array([0.0, SOURCE_PEAK, 0.0, -SOURCE_PEAK]),
        atol=1e-6,
        rtol=0.0,
    )
    assert np.all(np.diff(triangle[: quarter + 1]) > 0.0)
    assert np.all(np.diff(triangle[quarter : three_quarter + 1]) < 0.0)
    assert np.all(np.diff(triangle[three_quarter:]) > 0.0)
    assert saw[0] == np.float32(-SOURCE_PEAK)
    assert np.all(np.diff(saw) > 0.0)
    assert saw[-1] < SOURCE_PEAK


def test_core_shapes_authoring_command_reproduces_the_shipped_source(tmp_path: Path) -> None:
    regenerated_path = tmp_path / "core-shapes.wav"
    subprocess.run(
        [
            sys.executable,
            str(REPO_ROOT / "scripts" / "generate_core_shapes_wavetable.py"),
            "--output",
            str(regenerated_path),
        ],
        cwd=REPO_ROOT,
        check=True,
    )

    assert regenerated_path.read_bytes() == (
        REPO_ROOT / "assets" / DEFAULT_SOURCE_RESOURCE
    ).read_bytes()
