from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess

import numpy as np
from numpy.testing import assert_allclose

from bench import SAMPLES_PER_FRAME, make_saw_bank
from wtbank import load_source_table_wav


REPO_ROOT = Path(__file__).resolve().parent.parent


def _require_node() -> str:
    node = shutil.which("node")
    if node is None:
        raise AssertionError("node is required for runtime worker tests")
    return node


def _expected_unpadded_mip_frame(frame: np.ndarray, mip_index: int) -> np.ndarray:
    from scipy.fft import irfft, rfft

    frame64 = np.asarray(frame, dtype=np.float64)
    canonical = frame64 - np.mean(frame64)
    spectrum = rfft(canonical)
    spectrum[0] = 0.0
    harmonic_limit = min(1 << mip_index, spectrum.size - 1)
    truncated = np.zeros_like(spectrum)
    truncated[1 : harmonic_limit + 1] = spectrum[1 : harmonic_limit + 1]
    return irfft(truncated, n=SAMPLES_PER_FRAME)


def _compile_runtime_mip_frame(frame: np.ndarray, mip_index: int) -> np.ndarray:
    node = _require_node()
    script = """
import process from "node:process";

import { buildMipFrameFromFrame } from "./patch_gui/wavetable-mip.mjs";

const chunks = [];
for await (const chunk of process.stdin) {
    chunks.push(chunk);
}

const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
const frame = Float32Array.from(payload.frame);
const compiled = buildMipFrameFromFrame(frame, payload.mipIndex);

process.stdout.write(JSON.stringify(Array.from(compiled)));
"""

    result = subprocess.run(
        [node, "--input-type=module", "-e", script],
        cwd=REPO_ROOT,
        input=json.dumps({"frame": frame.tolist(), "mipIndex": mip_index}),
        text=True,
        capture_output=True,
        check=False,
    )

    if result.returncode != 0:
        details = "\n".join(
            part for part in (result.stdout.strip(), result.stderr.strip()) if part
        )
        raise AssertionError(f"node runtime mip compile failed:\n{details}")

    return np.asarray(json.loads(result.stdout), dtype=np.float64)


def test_runtime_js_mip_compiler_matches_python_reference_for_saw_bank() -> None:
    saw = make_saw_bank().frames[0]

    for mip_index in (0, 4, 10):
        actual = _compile_runtime_mip_frame(saw, mip_index)
        expected = _expected_unpadded_mip_frame(saw, mip_index)
        assert actual.shape == (SAMPLES_PER_FRAME,)
        assert_allclose(actual, expected, atol=1e-5, rtol=1e-5)


def test_runtime_js_mip_compiler_matches_python_reference_for_real_imported_table() -> None:
    imported_table = load_source_table_wav(
        REPO_ROOT / "assets" / "factory_sources" / "imported" / "4088.wav",
        table_id="4088",
    )
    imported_frame = imported_table.frames[0]

    actual = _compile_runtime_mip_frame(imported_frame, 3)
    expected = _expected_unpadded_mip_frame(imported_frame, 3)

    assert actual.shape == (SAMPLES_PER_FRAME,)
    assert_allclose(actual, expected, atol=1e-5, rtol=1e-5)

