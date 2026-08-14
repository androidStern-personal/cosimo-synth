from __future__ import annotations

import json
import importlib.util
import math
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
RUNNER = REPO_ROOT / "scripts" / "run_native_modulation_benchmark.py"


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
    assert result["qualification"] == "rack-only-smoke"
    assert result["blockedBy"] == "RT-01"
    assert result["voiceIndexes"] == list(range(16))
    assert result["rackEnableMask"] == 255
    assert result["effectConfiguration"] == {
        "chorusMix": 0.3,
        "delayMix": 0.25,
        "distortionWet": 0.35,
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
        "unisonVoices": 1.0,
        "warpAmount": 0.0,
        "warpMode": 0.0,
    }

    profiles = {profile["name"]: profile for profile in result["profiles"]}
    assert set(profiles) == {
        "voice-100", "voice-rack-100", "mixed-100", "combined-200",
        "stored-884-active-100", "active-884",
    }

    measured = profiles["voice-rack-100"]
    assert measured["status"] == "measured"
    assert measured["compiledCounts"] == {"voice": 0, "macroVoice": 0, "voiceRack": 100, "macroRack": 0}
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

    unavailable = [profile for profile in profiles.values() if profile["status"] == "unavailable"]
    assert len(unavailable) == 5
    assert all(profile["blockedBy"] == "RT-01" for profile in unavailable)
    assert all("addedRenderLoadPercentagePoints" not in profile for profile in unavailable)
    assert profiles["active-884"]["storedRouteCount"] == 884


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


def test_full_884_route_profile_is_diagnostic_until_the_merged_product_budget_is_set() -> None:
    spec = importlib.util.spec_from_file_location("native_matrix_runner", RUNNER)
    assert spec is not None and spec.loader is not None
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)

    assert "active-884" in runner.EXPECTED_PROFILE_NAMES
    assert "active-884" not in runner.MATRIX_LOAD_BUDGETS
