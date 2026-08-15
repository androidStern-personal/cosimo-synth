from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
from scipy.fft import rfft
from scipy.io import wavfile

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_ROOT = REPO_ROOT / "tests" / "cmajor_warp" / "fixtures"
REFERENCE_SAMPLE_RATE = 44100
ALIAS_REFERENCE_FILENAME = "expectedAliasReference-audioOut.wav"
ALIAS_STRESS_FIXTURES = (
    "bend_harmonic",
    "pwm_edge",
)
REQUIRED_ALIAS_FIXTURE_FILES = (
    ALIAS_REFERENCE_FILENAME,
    "midiIn.json",
    "warpAmount.json",
    "warpMode.json",
    "wavetableLoadBegin.json",
    "wavetableMipFrame.json",
    "wavetablePosition.json",
)
STEADY_STATE_SLICE = slice(1024, 3072)
# Chosen against the current stress fixtures:
# - the checked-in 4x PWM reference sits at about -21.9 dB of level-matched
#   extra spectral energy relative to the 8x reference, so it still passes
# - the checked-in 2x PWM reference sits at about -16.4 dB, so it fails
MAX_LEVEL_MATCHED_EXTRA_SPECTRAL_ENERGY_DB = -20.0
# This second gate prevents silence or a badly attenuated render from looking
# artificially "better" than the reference.
MAX_ABSOLUTE_LEVEL_DRIFT_DB = 1.0

def _require_fixture_files(fixture_dir: Path, required_names: tuple[str, ...]) -> None:
    missing = [name for name in required_names if not (fixture_dir / name).exists()]
    if missing:
        joined = ", ".join(missing)
        raise AssertionError(f"{fixture_dir} is missing required warp fixture files: {joined}")


def _load_reference_audio(
    fixture_dir: Path,
    *,
    expected_num_samples: int,
) -> np.ndarray:
    _require_fixture_files(fixture_dir, (ALIAS_REFERENCE_FILENAME,))
    sample_rate, audio = wavfile.read(fixture_dir / ALIAS_REFERENCE_FILENAME)

    if sample_rate != REFERENCE_SAMPLE_RATE:
        raise AssertionError(
            f"{fixture_dir} reference WAV has sample rate {sample_rate}, expected {REFERENCE_SAMPLE_RATE}"
        )

    audio_array = np.asarray(audio, dtype=np.float32)
    if audio_array.ndim != 2 or audio_array.shape[1] != 2:
        raise AssertionError(
            f"{fixture_dir} reference WAV has shape {audio_array.shape}, expected stereo audio"
        )
    if audio_array.shape[0] != expected_num_samples:
        raise AssertionError(
            f"{fixture_dir} reference WAV has {audio_array.shape[0]} frames, expected {expected_num_samples}"
        )

    return audio_array[:, 0].copy()


def _window_audio(audio: np.ndarray) -> np.ndarray:
    return np.asarray(audio[STEADY_STATE_SLICE], dtype=np.float64)


def _measure_level_matched_extra_spectral_energy_db(
    real_audio: np.ndarray,
    reference_audio: np.ndarray,
) -> float:
    real_window = _window_audio(real_audio)
    reference_window = _window_audio(reference_audio)

    real_rms = float(np.sqrt(np.mean(real_window**2)))
    reference_rms = float(np.sqrt(np.mean(reference_window**2)))
    if real_rms <= 1.0e-30 or reference_rms <= 1.0e-30:
        return float("inf")

    level_matched_real = real_window * (reference_rms / real_rms)
    real_spectrum_power = np.abs(rfft(level_matched_real)) ** 2
    reference_spectrum_power = np.abs(rfft(reference_window)) ** 2
    extra_power = np.maximum(real_spectrum_power - reference_spectrum_power, 0.0)

    return float(
        10.0
        * np.log10(
            max(float(np.sum(extra_power)), 1.0e-30)
            / max(float(np.sum(reference_spectrum_power)), 1.0e-30)
        )
    )


def _measure_level_drift_db(real_audio: np.ndarray, reference_audio: np.ndarray) -> float:
    real_window = _window_audio(real_audio)
    reference_window = _window_audio(reference_audio)

    real_rms = float(np.sqrt(np.mean(real_window**2)))
    reference_rms = float(np.sqrt(np.mean(reference_window**2)))

    return float(
        20.0
        * np.log10(
            max(real_rms, 1.0e-30)
            / max(reference_rms, 1.0e-30)
        )
    )

@pytest.mark.parametrize("fixture_name", ALIAS_STRESS_FIXTURES)
def test_alias_stress_fixtures_are_complete(fixture_name: str) -> None:
    fixture_dir = FIXTURE_ROOT / fixture_name
    _require_fixture_files(fixture_dir, REQUIRED_ALIAS_FIXTURE_FILES)
    _load_reference_audio(fixture_dir, expected_num_samples=4096)


def test_alias_gate_rejects_silence_and_gain_shortcuts() -> None:
    reference_audio = _load_reference_audio(FIXTURE_ROOT / "pwm_edge", expected_num_samples=4096)

    candidates = {
        "silence": np.zeros_like(reference_audio),
        "half_level": reference_audio * 0.5,
        "double_level": reference_audio * 2.0,
    }

    for label, candidate_audio in candidates.items():
        level_drift_db = _measure_level_drift_db(candidate_audio, reference_audio)
        extra_spectral_energy_db = _measure_level_matched_extra_spectral_energy_db(candidate_audio, reference_audio)

        assert (
            abs(level_drift_db) > MAX_ABSOLUTE_LEVEL_DRIFT_DB
            or extra_spectral_energy_db > MAX_LEVEL_MATCHED_EXTRA_SPECTRAL_ENERGY_DB
        ), (
            f"{label} incorrectly passed the alias gate with level drift {level_drift_db:.2f} dB "
            f"and extra spectral energy {extra_spectral_energy_db:.2f} dB."
        )
