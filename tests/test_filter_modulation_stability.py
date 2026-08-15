from __future__ import annotations

import json
from pathlib import Path

import pytest

from tests.helpers.generate_filter_reference_assets import FILTER_CASE_OUTPUT_SAMPLES


REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_ROOT = REPO_ROOT / "tests" / "cmajor_filter" / "fixtures"
PATCH_PATH = REPO_ROOT / "WavetableSynth.cmajorpatch"
ALL_FILTER_FIXTURES = tuple(sorted(FILTER_CASE_OUTPUT_SAMPLES.keys()))
REQUIRED_FILTER_FIXTURE_FILES = (
    "midiIn.json",
    "filterMode.json",
    "filterCutoff.json",
    "filterQ.json",
    "filterMsegDepth.json",
    "mseg1Depth.json",
    "wavetableLoadBegin.json",
    "wavetableMipFrame.json",
    "wavetablePosition.json",
)
MSEG_FILTER_FIXTURES = (
    "mseg_lowpass_pluck",
    "two_voice_staggered_mseg",
    "fast_mseg_cutoff_motion_lowpass",
    "fast_mseg_cutoff_motion_bandpass",
    "fast_mseg_cutoff_motion_peak_high_q",
)
REQUIRED_MSEG_FILTER_FIXTURE_FILES = (
    "mseg1Buffer.json",
    "mseg1Playback.json",
    "modulationMsegBuffer.json",
    "modulationMsegPlayback.json",
    "modulationProgram.json",
)
REQUIRED_PATCH_SOURCES = (
    "cmajor/Distortion.cmajor",
    "cmajor/FilterSpectrumCommon.cmajor",
    "cmajor/FilterSpectrumAnalyzer.cmajor",
)

def _require_fixture_files(fixture_dir: Path, required_names: tuple[str, ...]) -> None:
    missing = [name for name in required_names if not (fixture_dir / name).exists()]
    if missing:
        joined = ", ".join(missing)
        raise AssertionError(f"{fixture_dir} is missing required filter fixture files: {joined}")

def test_patch_manifest_includes_filter_spectrum_sources() -> None:
    manifest = json.loads(PATCH_PATH.read_text(encoding="utf-8"))
    sources = tuple(manifest.get("source", ()))

    for required_source in REQUIRED_PATCH_SOURCES:
        assert required_source in sources, (
            f"WavetableSynth.cmajorpatch is missing {required_source}. "
            "The production patch cannot compile the filter spectrum endpoint without it."
        )


@pytest.mark.parametrize("fixture_name", ALL_FILTER_FIXTURES)
def test_filter_fixtures_are_complete(fixture_name: str) -> None:
    fixture_dir = FIXTURE_ROOT / fixture_name
    _require_fixture_files(fixture_dir, REQUIRED_FILTER_FIXTURE_FILES)


@pytest.mark.parametrize("fixture_name", MSEG_FILTER_FIXTURES)
def test_mseg_filter_fixtures_include_explicit_mseg_data(fixture_name: str) -> None:
    fixture_dir = FIXTURE_ROOT / fixture_name
    _require_fixture_files(fixture_dir, REQUIRED_MSEG_FILTER_FIXTURE_FILES)
