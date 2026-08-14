from __future__ import annotations

import os
from pathlib import Path
import subprocess


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_provider_aware_javascript_keeps_the_canonical_renderer_import(tmp_path: Path) -> None:
    output = tmp_path / "ThreeOscillatorExternalSmoke.js"
    environment = os.environ.copy()

    subprocess.run(
        [
            str(REPO_ROOT / "scripts/generate_cmajor_javascript_with_externals.sh"),
            str(REPO_ROOT / "tests/native/fixtures/ThreeOscillatorExternalSmoke.cmajorpatch"),
            str(output),
            "ThreeOscillatorExternalSmoke",
        ],
        cwd=REPO_ROOT,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )

    inspection = subprocess.run(
        [
            "node",
            str(REPO_ROOT / "tests/native/inspect_cmajor_javascript_external.mjs"),
            str(output),
        ],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )

    assert inspection.stdout.strip() == "PASS JavaScript imports canonical renderer"
    generated = output.read_text(encoding="utf-8")
    assert "_getWasmBytesNonSIMD" not in generated


def test_renderer_wasm_uses_only_the_supplied_shared_memory(tmp_path: Path) -> None:
    output = tmp_path / "three-oscillator-renderer.wasm"
    memory_base = 32 * 65_536
    subprocess.run(
        [
            str(REPO_ROOT / "scripts/build_three_oscillator_renderer_wasm.sh"),
            str(output),
            "--memory-base",
            str(memory_base),
        ],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )

    inspection = subprocess.run(
        [
            "node",
            str(REPO_ROOT / "tests/native/inspect_renderer_shared_memory.mjs"),
            str(output),
            str(memory_base),
        ],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    assert inspection.stdout.strip() == "PASS renderer Wasm shares memory without overlap"


def test_two_wasm_modules_render_b_only_through_the_direct_import(tmp_path: Path) -> None:
    output = tmp_path / "ThreeOscillatorExternalSmokeWithRenderer.js"
    subprocess.run(
        [
            "node",
            str(REPO_ROOT / "scripts/generate_cmajor_javascript_with_renderer.mjs"),
            str(REPO_ROOT / "tests/native/fixtures/ThreeOscillatorExternalSmoke.cmajorpatch"),
            str(output),
            "ThreeOscillatorExternalSmoke",
        ],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )

    rendered = subprocess.run(
        [
            "node",
            "--max-old-space-size=4096",
            str(REPO_ROOT / "tests/native/run_three_oscillator_generated_web.mjs"),
            str(output),
        ],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    assert rendered.stdout.startswith("PASS direct Wasm renderer produced B-only audio; rms=")
