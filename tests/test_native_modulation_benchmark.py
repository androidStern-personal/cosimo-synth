from __future__ import annotations

import json
import importlib.util
import math
import subprocess
from argparse import Namespace
from pathlib import Path
from types import SimpleNamespace

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
RUNNER = REPO_ROOT / "scripts" / "run_native_modulation_benchmark.py"
HEADER_GENERATOR = REPO_ROOT / "scripts" / "generate_native_modulation_benchmark_header.mjs"


def test_generated_native_patch_isolates_incremental_modulation_matrix_cost(tmp_path: Path) -> None:
    output_path = tmp_path / "native-modulation-benchmark.json"
    subprocess.run(
        [
            "python3",
            str(RUNNER),
            "--build-dir",
            str(tmp_path / "build"),
            "--output",
            str(output_path),
            "--blocks",
            "24",
            "--warmup-blocks",
            "4",
            "--settle-blocks",
            "8",
            "--repeats",
            "1",
        ],
        cwd=REPO_ROOT,
        check=True,
    )

    result = json.loads(output_path.read_text(encoding="utf-8"))
    assert result["format"] == "cosimo.native-modulation-benchmark"
    assert result["version"] == 2
    assert result["productionSeam"] == {
        "generatorTarget": "cpp",
        "maxFramesPerBlock": 128,
        "patchManifest": "WavetableSynth.cmajorpatch",
        "profileGenerator": "scripts/generate_modulation_benchmark_profiles.mjs",
    }
    assert result["sampleRate"] == 48_000
    assert result["blockSize"] == 128
    assert result["qualification"] == "product-smoke"
    assert "blockedBy" not in result
    assert result["voiceIndexes"] == list(range(16))
    assert result["rackEnableMask"] == 255
    assert result["effectConfiguration"] == {
        "chorusMix": 0.3,
        "delayMix": 0.25,
        "distortionWet": 0.35,
        "env1Sustain": 0.0,
        "filterCutoff": 1200.0,
        "filterMode": 1.0,
        "flangerMix": 0.25,
        "globalFilterCutoff": 1200.0,
        "globalFilterDrive": 1.0,
        "globalFilterMode": 1.0,
        "globalFilterResonance": 0.707107,
        "ottAmount": 35.0,
        "ottMix": 35.0,
        "phaserMix": 0.25,
        "reverbMix": 0.3,
        "oscAUnisonVoices": 1.0,
        "oscBUnisonVoices": 1.0,
        "oscCUnisonVoices": 1.0,
        "oscAWarpAmount": 0.0,
        "oscBWarpAmount": 0.0,
        "oscCWarpAmount": 0.0,
        "oscAWarpMode": 0.0,
        "oscBWarpMode": 0.0,
        "oscCWarpMode": 0.0,
    }

    profiles = {profile["name"]: profile for profile in result["profiles"]}
    assert set(profiles) == {
        "voice-100", "voice-rack-100", "mixed-100", "combined-200",
        "stored-1288-active-100", "active-1288",
    }

    for measured in profiles.values():
        assert measured["status"] == "measured"
        assert measured["installedCounts"] == measured["compiledCounts"]
        assert measured["emptyInstalledCounts"] == {
            "voice": 0,
            "macroVoice": 0,
            "voiceRack": 0,
            "macroRack": 0,
        }
        assert len(measured["stateSha256"]) == 64
        assert measured["audioEquivalent"] is True
        assert measured["maximumAbsoluteSampleDelta"] <= 1.0e-7
        assert measured["nonFiniteSampleCount"] == 0
        assert measured["emptyRms"] > 1.0e-5
        assert measured["loadedRms"] > 1.0e-5
        assert measured["adjacentPairCount"] == 24
        assert measured["emptyMeanNanoseconds"] > 0
        assert measured["loadedMeanNanoseconds"] > 0
        assert math.isfinite(measured["pairedMeanDeltaNanoseconds"])
        assert math.isfinite(measured["addedRenderLoadPercentagePoints"])

    assert profiles["voice-rack-100"]["compiledCounts"] == {
        "voice": 0,
        "macroVoice": 0,
        "voiceRack": 100,
        "macroRack": 0,
    }
    assert profiles["active-1288"]["storedRouteCount"] == 1288
    assert profiles["active-1288"]["compiledCounts"] == {
        "voice": 560,
        "macroVoice": 224,
        "voiceRack": 360,
        "macroRack": 144,
    }


def test_native_matrix_qualification_rejects_an_expensive_route_program() -> None:
    spec = importlib.util.spec_from_file_location("native_matrix_runner", RUNNER)
    assert spec is not None and spec.loader is not None
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    profiles = [
        {"name": name, "addedRenderLoadPercentagePoints": budget}
        for name, budget in runner.MATRIX_LOAD_BUDGETS.items()
    ]
    runner.assert_matrix_budgets(profiles)
    next(profile for profile in profiles if profile["name"] == "voice-rack-100")[
        "addedRenderLoadPercentagePoints"
    ] = runner.MATRIX_LOAD_BUDGETS["voice-rack-100"] + 0.001
    try:
        runner.assert_matrix_budgets(profiles)
    except RuntimeError as error:
        assert "voice-rack-100 matrix cost" in str(error)
    else:
        raise AssertionError("An over-budget native matrix program must fail qualification")


def test_generated_native_loader_emits_every_post_cut_profile(
    tmp_path: Path,
) -> None:
    header_path = tmp_path / "NativeModulationBenchmarkProfiles.h"
    subprocess.run(
        ["node", str(HEADER_GENERATOR), "--output", str(header_path)],
        cwd=REPO_ROOT,
        check=True,
    )
    header = header_path.read_text(encoding="utf-8")

    assert header.count("destination = {};") == 7
    assert "is unavailable until" not in header
    assert "destination.voiceRouteAmounts[287]" in header
    assert "destination.macroVoiceRouteAmounts[127]" in header
    assert "destination.voiceRouteCells[287]" in header
    assert "destination.macroVoiceRouteCells[127]" in header


def test_native_main_enforces_the_product_shipping_budget(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    spec = importlib.util.spec_from_file_location("native_matrix_main_runner", RUNNER)
    assert spec is not None and spec.loader is not None
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)

    build_path = tmp_path / "generated"
    monkeypatch.setattr(runner, "parse_args", lambda: Namespace(
        build_dir=tmp_path,
        output=None,
        blocks=runner.QUALIFYING_BLOCKS,
        warmup_blocks=1,
        settle_blocks=1,
        repeats=runner.QUALIFYING_REPEATS,
    ))
    monkeypatch.setattr(
        runner,
        "generate_and_compile",
        lambda _build_dir: (build_path, build_path, build_path, ["fixture-compiler"]),
    )
    monkeypatch.setattr(runner, "run", lambda _command: SimpleNamespace(stdout="fixture"))
    monkeypatch.setattr(runner, "parse_run", lambda _output: {})
    monkeypatch.setattr(runner, "build_result", lambda **_arguments: {
        "qualification": "product-shipping",
        "profiles": [{
            "name": "voice-rack-100",
            "addedRenderLoadPercentagePoints": runner.MATRIX_LOAD_BUDGETS["voice-rack-100"] + 0.001,
        }],
    })

    with pytest.raises(RuntimeError, match="voice-rack-100 matrix cost"):
        runner.main()


def test_native_shipping_qualification_requires_full_warmup_and_settle() -> None:
    spec = importlib.util.spec_from_file_location("native_matrix_qualification_runner", RUNNER)
    assert spec is not None and spec.loader is not None
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)

    qualifying = {
        "blocks": runner.QUALIFYING_BLOCKS,
        "warmup_blocks": runner.QUALIFYING_WARMUP_BLOCKS,
        "settle_blocks": runner.QUALIFYING_SETTLE_BLOCKS,
        "repeats": runner.QUALIFYING_REPEATS,
    }
    assert runner.is_qualifying_run(**qualifying) is True
    for field in qualifying:
        below_contract = {**qualifying, field: qualifying[field] - 1}
        assert runner.is_qualifying_run(**below_contract) is False, field


def test_full_1288_route_profile_is_diagnostic_until_the_merged_product_budget_is_set() -> None:
    spec = importlib.util.spec_from_file_location("native_matrix_runner", RUNNER)
    assert spec is not None and spec.loader is not None
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)

    assert "active-1288" in runner.EXPECTED_PROFILE_NAMES
    assert "active-1288" not in runner.MATRIX_LOAD_BUDGETS
