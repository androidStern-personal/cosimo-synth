from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
TOOL_DIR = REPO_ROOT / "tools" / "warp_atlas_diagnostic"
RENDERER_DIR = REPO_ROOT / "native" / "three_oscillator_renderer"
RUNNER = TOOL_DIR / "run_warp_atlas_diagnostic.py"
CANONICAL_BYTE_COUNT = 71_170_064
CANONICAL_SHA256 = (
    "faf3a9d7cb967ae1a572b4ff5dfdfb874641c0f942eabec1c789566b527f2157"
)
ARCHIVED_ATLAS = Path(
    "/Users/winterfell/.codex/evidence/cosimo-integration-2026-08-13/"
    "atlas/warp-basis-atlas.i16"
)


@pytest.fixture(scope="module")
def diagnostic_binary(tmp_path_factory: pytest.TempPathFactory) -> Path:
    if sys.platform != "darwin":
        pytest.skip("the developer diagnostic uses macOS CommonCrypto")
    output = tmp_path_factory.mktemp("warp-atlas-diagnostic") / "diagnostic"
    command = [
        "/usr/bin/c++",
        "-std=c++17",
        "-O2",
        "-Wall",
        "-Wextra",
        "-Werror",
        "-Wno-deprecated-declarations",
        "-Wno-unused-local-typedef",
        "-Wno-unused-function",
        f"-I{TOOL_DIR}",
        f"-I{RENDERER_DIR}",
        f"-I{RENDERER_DIR / 'third_party' / 'xsimd' / 'include'}",
        str(TOOL_DIR / "main.cpp"),
        str(TOOL_DIR / "AtlasFile.cpp"),
        str(RENDERER_DIR / "WarpRenderer.cpp"),
        "-o",
        str(output),
    ]
    subprocess.run(command, cwd=REPO_ROOT, check=True)
    return output


def run_binary(
    binary: Path,
    output_directory: Path,
    *,
    selection: str,
    atlas: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    command = [
        str(binary),
        "--output-dir",
        str(output_directory),
        "--path",
        selection,
        "--quick",
    ]
    if atlas is not None:
        command.extend(("--atlas", str(atlas)))
    return subprocess.run(
        command,
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def canonical_atlas() -> Path:
    configured = os.environ.get("COSIMO_WARP_ATLAS_PATH")
    path = Path(configured) if configured else ARCHIVED_ATLAS
    if not path.is_file():
        pytest.skip("canonical external warp atlas is unavailable")
    return path


def test_runtime_default_passes_an_empty_atlas_view_without_storage(
    diagnostic_binary: Path,
    tmp_path: Path,
) -> None:
    output_directory = tmp_path / "runtime"
    completed = run_binary(
        diagnostic_binary, output_directory, selection="runtime-only"
    )
    assert completed.returncode == 0, completed.stderr
    report = json.loads(completed.stdout)
    assert report["selection"] == "runtime-only"
    assert report["automaticFamilyCrossoverEnabled"] is False
    assert report["automaticHandoffVerified"] is None
    assert report["atlas"] == {
        "requested": False,
        "validated": False,
        "viewPackedSampleCount": 0,
        "storageByteCount": 0,
        "loadSeconds": 0.0,
        "canonicalByteCount": CANONICAL_BYTE_COUNT,
        "canonicalSha256": CANONICAL_SHA256,
        "validatedSha256": None,
    }
    assert len(report["cases"]) == 10
    assert all(case["purePathVerified"] for case in report["cases"])
    assert len(list(output_directory.glob("*.wav"))) == 10

    runner_directory = tmp_path / "runner-default"
    runner = subprocess.run(
        [
            sys.executable,
            str(RUNNER),
            "--quick",
            "--output-dir",
            str(runner_directory),
            "--diagnostic-binary",
            str(diagnostic_binary),
        ],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert runner.returncode == 0, runner.stderr
    runner_report = json.loads(
        (runner_directory / "diagnostic.json").read_text(encoding="utf-8")
    )
    assert runner_report["selection"] == "runtime-only"
    assert runner_report["atlas"]["requested"] is False


def test_bad_atlas_inputs_fail_structurally_before_audio_prepare(
    diagnostic_binary: Path,
    tmp_path: Path,
) -> None:
    missing = tmp_path / "missing.i16"
    truncated = tmp_path / "truncated.i16"
    truncated.write_bytes(b"\0\0\0\0")
    corrupt = tmp_path / "corrupt.i16"
    with corrupt.open("wb") as output:
        output.truncate(CANONICAL_BYTE_COUNT)

    cases = (
        (missing, "atlas_missing"),
        (truncated, "atlas_size_mismatch"),
        (corrupt, "atlas_sha256_mismatch"),
    )
    for index, (atlas, expected_code) in enumerate(cases):
        output_directory = tmp_path / f"rejected-{index}"
        completed = run_binary(
            diagnostic_binary,
            output_directory,
            selection="auto-handoff",
            atlas=atlas,
        )
        assert completed.returncode == 3
        error = json.loads(completed.stderr)
        assert error["schema"] == "cosimo.warp-atlas-diagnostic-error.v1"
        assert error["code"] == expected_code
        assert error["stage"] == "atlas-load"
        assert error["beforeAudioPrepare"] is True
        assert not output_directory.exists()


def test_flag_on_keeps_auto_handoff_and_comparison_emits_complete_evidence(
    diagnostic_binary: Path,
    tmp_path: Path,
) -> None:
    atlas = canonical_atlas()
    live_directory = tmp_path / "live-auto"
    live = subprocess.run(
        [
            sys.executable,
            str(RUNNER),
            "--quick",
            "--atlas",
            str(atlas),
            "--output-dir",
            str(live_directory),
            "--diagnostic-binary",
            str(diagnostic_binary),
        ],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert live.returncode == 0, live.stderr
    live_report = json.loads(
        (live_directory / "diagnostic.json").read_text(encoding="utf-8")
    )
    assert live_report["selection"] == "auto-handoff"
    assert live_report["automaticFamilyCrossoverEnabled"] is True
    assert live_report["automaticHandoffVerified"] is True
    assert live_report["atlas"]["validated"] is True
    assert live_report["atlas"]["storageByteCount"] == CANONICAL_BYTE_COUNT
    assert live_report["atlas"]["validatedSha256"] == CANONICAL_SHA256
    assert all(case["purePathVerified"] is None for case in live_report["cases"])

    comparison_directory = tmp_path / "comparison"
    completed = subprocess.run(
        [
            sys.executable,
            str(RUNNER),
            "--compare",
            "--quick",
            "--atlas",
            str(atlas),
            "--output-dir",
            str(comparison_directory),
            "--diagnostic-binary",
            str(diagnostic_binary),
        ],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr
    report_path = comparison_directory / "comparison.json"
    assert Path(completed.stdout.strip()) == report_path
    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report["schema"] == "cosimo.warp-atlas-comparison.v1"
    assert report["similarityPassThreshold"] is None
    assert report["pairing"]["identicalTables"] is True
    assert report["pairing"]["identicalControlSchedules"] is True
    assert report["pairing"]["identicalInitialState"] is True
    assert report["pairing"]["identicalWarmup"] is True
    assert report["pairing"]["automaticFamilyCrossoverDisabled"] is True
    assert report["atlas"]["validated"] is True
    assert report["atlas"]["canonicalByteCount"] == CANONICAL_BYTE_COUNT
    assert report["atlas"]["canonicalSha256"] == CANONICAL_SHA256
    assert report["runs"]["runtimeOnly"]["atlasStorageByteCount"] == 0
    assert (
        report["runs"]["atlasOnly"]["atlasStorageByteCount"]
        == CANONICAL_BYTE_COUNT
    )
    assert report["runs"]["runtimeOnly"]["renderCpuSeconds"] > 0.0
    assert report["runs"]["atlasOnly"]["renderCpuSeconds"] > 0.0
    assert report["runs"]["runtimeOnly"]["peakRssBytes"] > 0
    assert report["runs"]["atlasOnly"]["peakRssBytes"] >= CANONICAL_BYTE_COUNT
    assert len(report["cases"]) == 10
    assert {case["family"] for case in report["cases"]} == {
        "bend",
        "pwm",
        "asym",
        "mirror",
    }
    assert any(case["mipBoundaryPitchCase"] for case in report["cases"])
    for case in report["cases"]:
        assert set(case["audioDifference"]) == {
            "sampleCount",
            "maximumAbsolute",
            "rms",
            "nullSnrDb",
            "bitIdentical",
        }
        assert (comparison_directory / case["runtimeWav"]).is_file()
        assert (comparison_directory / case["atlasWav"]).is_file()
    assert len(list(comparison_directory.rglob("*.wav"))) == 20
    assert list(comparison_directory.rglob("*.json")) == [report_path]


def test_product_sources_and_manifests_do_not_gain_an_atlas_flag_or_asset() -> None:
    bridge = (
        RENDERER_DIR / "RendererBridge.cpp"
    ).read_text(encoding="utf-8")
    assert "renderWarpedNotes (state, controls, tables, {}, nullptr," in bridge

    tracked_product_roots = (
        REPO_ROOT / "ui",
        REPO_ROOT / "cmajor",
        REPO_ROOT / "assets",
    )
    forbidden_tokens = ("warp-basis-atlas.i16", "COSIMO_WARP_ATLAS")
    searchable_suffixes = {
        ".cmajor",
        ".cmajorpatch",
        ".css",
        ".html",
        ".js",
        ".json",
        ".mjs",
        ".ts",
        ".tsx",
    }
    for root in tracked_product_roots:
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix not in searchable_suffixes:
                continue
            contents = path.read_text(encoding="utf-8")
            for token in forbidden_tokens:
                assert token not in contents, f"{token} leaked into {path}"
    for manifest in (
        REPO_ROOT / "WavetableSynth.cmajorpatch",
        REPO_ROOT / "WavetableSynth.iOS.cmajorpatch",
    ):
        contents = manifest.read_text(encoding="utf-8")
        assert "warp-basis-atlas" not in contents
    assert not list(REPO_ROOT.rglob("*.i16"))
