from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest
from scipy.fft import rfft, rfftfreq
from scipy.io import wavfile

from bench import _require_cmaj_cli
from tests.helpers.generate_filter_reference_assets import (
    FILTER_CASE_OUTPUT_SAMPLES,
    render_filter_reference_audio,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_ROOT = REPO_ROOT / "tests" / "cmajor_filter" / "fixtures"
PATCH_PATH = REPO_ROOT / "WavetableSynth.cmajorpatch"
PATCH_PATH_FROM_TEMP_TEST = "../../WavetableSynth.cmajorpatch"
REFERENCE_SAMPLE_RATE = 44100
FAST_MOD_FIXTURES = (
    "fast_mseg_cutoff_motion_lowpass",
    "fast_mseg_cutoff_motion_bandpass",
    "fast_mseg_cutoff_motion_peak_high_q",
)
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
)
STEADY_STATE_SLICE = slice(512, 3072)
HIGH_FREQUENCY_RESIDUAL_START_HZ = 6_000.0
MAX_HIGH_FREQUENCY_RESIDUAL_DB = -55.0
MAX_RESIDUAL_RMS_DB = -58.0
MIN_AUDIBLE_PEAK = 1.0e-3
MIN_REFERENCE_LEVEL_DB = -12.0
MAX_REFERENCE_LEVEL_DB = 1.0
REQUIRED_PATCH_SOURCES = (
    "cmajor/FilterSpectrumCommon.cmajor",
    "cmajor/FilterSpectrumAnalyzer.cmajor",
)

def _require_fixture_files(fixture_dir: Path, required_names: tuple[str, ...]) -> None:
    missing = [name for name in required_names if not (fixture_dir / name).exists()]
    if missing:
        joined = ", ".join(missing)
        raise AssertionError(f"{fixture_dir} is missing required filter fixture files: {joined}")


def _render_real_patch_audio(
    *,
    fixture_name: str,
    num_samples: int,
    tmp_path: Path,
) -> np.ndarray:
    fixture_dir = FIXTURE_ROOT / fixture_name
    temp_fixture_dir = tmp_path / fixture_name
    shutil.copytree(fixture_dir, temp_fixture_dir)

    temp_test_root = REPO_ROOT / "tests" / "cmajor_filter"

    for expected_output in temp_fixture_dir.glob("expectedOutput-*"):
        expected_output.unlink()

    test_file_path = temp_test_root / f".pytest_{fixture_name}.cmajtest"
    test_file_path.write_text(
        "\n".join(
            (
                f'const patchPath = "{PATCH_PATH_FROM_TEMP_TEST}";',
                "",
                "function audioOnlyPatchRun() {",
                "  return {",
                "    patch: patchPath,",
                f'    subDir: "{temp_fixture_dir.as_posix()}",',
                "    frequency: 44100,",
                "    blockSize: 64,",
                f"    samplesToRender: {num_samples},",
                "    sessionID: 1,",
                "    skipMissingInputs: true,",
                "  };",
                "}",
                "## runScript (audioOnlyPatchRun())",
                "",
            )
        ),
        encoding="utf-8",
    )

    render_result = subprocess.run(
        [
            _require_cmaj_cli(),
            "test",
            "--singleThread",
            "--sessionID=1",
            str(test_file_path),
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    if render_result.returncode != 0:
        details = "\n".join(
            part
            for part in (render_result.stdout.strip(), render_result.stderr.strip())
            if part
        )
        raise AssertionError(f"cmaj test render failed for {fixture_name}:\n{details}")

    audio_path = temp_fixture_dir / "expectedOutput-audioOut.wav"
    if not audio_path.exists():
        raise AssertionError(f"cmaj test did not render expectedOutput-audioOut.wav for {fixture_name}")

    sample_rate, audio = wavfile.read(audio_path)
    if sample_rate != REFERENCE_SAMPLE_RATE:
        raise AssertionError(
            f"{fixture_name} rendered sample rate {sample_rate}, expected {REFERENCE_SAMPLE_RATE}"
        )

    audio_array = np.asarray(audio, dtype=np.float32)
    if audio_array.ndim != 2 or audio_array.shape[1] != 2:
        raise AssertionError(
            f"{fixture_name} rendered audio shape {audio_array.shape}, expected stereo audio"
        )
    if audio_array.shape[0] != num_samples:
        raise AssertionError(
            f"{fixture_name} rendered {audio_array.shape[0]} frames, expected {num_samples}"
        )

    return audio_array[:, 0].copy()


def _window_audio(audio: np.ndarray) -> np.ndarray:
    return np.asarray(audio[STEADY_STATE_SLICE], dtype=np.float64)


def _measure_high_frequency_residual_db(real_audio: np.ndarray, reference_audio: np.ndarray) -> float:
    residual = _window_audio(real_audio) - _window_audio(reference_audio)
    reference = _window_audio(reference_audio)
    residual_spectrum = np.abs(rfft(residual)) ** 2
    reference_spectrum = np.abs(rfft(reference)) ** 2
    freqs = rfftfreq(reference.size, d=1.0 / REFERENCE_SAMPLE_RATE)
    high_band = freqs >= HIGH_FREQUENCY_RESIDUAL_START_HZ

    return float(
        10.0
        * np.log10(
            max(float(np.sum(residual_spectrum[high_band])), 1.0e-30)
            / max(float(np.sum(reference_spectrum[high_band])), 1.0e-30)
        )
    )


def _measure_residual_rms_db(real_audio: np.ndarray, reference_audio: np.ndarray) -> float:
    residual = _window_audio(real_audio) - _window_audio(reference_audio)
    reference = _window_audio(reference_audio)
    residual_rms = float(np.sqrt(np.mean(residual ** 2)))
    reference_rms = float(np.sqrt(np.mean(reference ** 2)))
    return float(20.0 * np.log10(max(residual_rms, 1.0e-30) / max(reference_rms, 1.0e-30)))


def _measure_level_db(real_audio: np.ndarray, reference_audio: np.ndarray) -> float:
    real = _window_audio(real_audio)
    reference = _window_audio(reference_audio)
    real_rms = float(np.sqrt(np.mean(real ** 2)))
    reference_rms = float(np.sqrt(np.mean(reference ** 2)))
    return float(20.0 * np.log10(max(real_rms, 1.0e-30) / max(reference_rms, 1.0e-30)))


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


@pytest.mark.cmajor
def test_real_patch_note_on_emits_audible_audio(tmp_path: Path) -> None:
    fixture_name = "filter_off_identity"
    real_audio = _render_real_patch_audio(
        fixture_name=fixture_name,
        num_samples=4096,
        tmp_path=tmp_path,
    )
    reference_audio = render_filter_reference_audio(FIXTURE_ROOT / fixture_name, num_samples=4096)[:, 0]

    peak = float(np.max(np.abs(real_audio)))
    level_db = _measure_level_db(real_audio, reference_audio)

    assert peak >= MIN_AUDIBLE_PEAK, (
        f"{fixture_name} rendered peak amplitude {peak:.6f}. "
        "A real note-on on WavetableSynth.cmajorpatch must produce audible nonzero audio."
    )
    assert MIN_REFERENCE_LEVEL_DB <= level_db <= MAX_REFERENCE_LEVEL_DB, (
        f"{fixture_name} rendered at {level_db:.2f} dB relative to the independent reference. "
        f"The acceptable range is [{MIN_REFERENCE_LEVEL_DB:.2f}, {MAX_REFERENCE_LEVEL_DB:.2f}] dB."
    )


@pytest.mark.cmajor
@pytest.mark.parametrize("fixture_name", FAST_MOD_FIXTURES)
def test_real_patch_filter_modulation_stays_close_to_reference(
    fixture_name: str,
    tmp_path: Path,
) -> None:
    real_audio = _render_real_patch_audio(
        fixture_name=fixture_name,
        num_samples=4096,
        tmp_path=tmp_path,
    )
    reference_audio = render_filter_reference_audio(FIXTURE_ROOT / fixture_name, num_samples=4096)[:, 0]

    residual_rms_db = _measure_residual_rms_db(real_audio, reference_audio)
    high_frequency_residual_db = _measure_high_frequency_residual_db(real_audio, reference_audio)

    assert residual_rms_db <= MAX_RESIDUAL_RMS_DB, (
        f"{fixture_name} produced {residual_rms_db:.2f} dB residual RMS relative to the independent filter reference. "
        f"The cutoff is {MAX_RESIDUAL_RMS_DB:.2f} dB."
    )
    assert high_frequency_residual_db <= MAX_HIGH_FREQUENCY_RESIDUAL_DB, (
        f"{fixture_name} produced {high_frequency_residual_db:.2f} dB of high-frequency residual energy above "
        f"{HIGH_FREQUENCY_RESIDUAL_START_HZ:.0f} Hz relative to the independent filter reference. "
        f"The cutoff is {MAX_HIGH_FREQUENCY_RESIDUAL_DB:.2f} dB."
    )
