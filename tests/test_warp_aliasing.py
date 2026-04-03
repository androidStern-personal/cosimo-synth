from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pytest
from scipy.fft import rfft
from scipy.io import wavfile

from bench import _require_cmaj_cli, _require_node_cli


REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_ROOT = REPO_ROOT / "tests" / "cmajor_warp" / "fixtures"
PATCH_PATH = REPO_ROOT / "WavetableSynth.cmajorpatch"
REFERENCE_SAMPLE_RATE = 44100
REFERENCE_OVERSAMPLE_FACTOR = 8
ALIAS_REFERENCE_FILENAME = "expectedAliasReference-audioOut.wav"
VALUE_ENDPOINT_IDS = (
    "wavetablePosition",
    "wavetableSelect",
    "playMode",
    "glideTime",
    "mseg1Depth",
    "warpMsegDepth",
    "warpMode",
    "warpAmount",
)
EVENT_ENDPOINT_IDS = (
    "wavetableLoadBegin",
    "wavetableMipFrame",
    "serviceLoadAbort",
    "workerLoadFailure",
    "runtimeSyncRequest",
    "retryDesiredTableRequest",
    "mseg1Buffer",
    "mseg1Playback",
    "midiIn",
)
ALIAS_STRESS_FIXTURES = (
    "bend_harmonic",
    "pwm_edge",
)
REQUIRED_ALIAS_FIXTURE_FILES = (
    ALIAS_REFERENCE_FILENAME,
    "midiIn.json",
    "mseg1Depth.json",
    "warpAmount.json",
    "warpMode.json",
    "wavetableLoadBegin.json",
    "wavetableMipFrame.json",
    "wavetablePosition.json",
)
REAL_PATCH_SESSION_ID = 2
STEADY_STATE_SLICE = slice(1024, 3072)
# Chosen against the current stress fixtures:
# - the checked-in 4x PWM reference sits at about -21.9 dB of level-matched
#   extra spectral energy relative to the 8x reference, so it still passes
# - the checked-in 2x PWM reference sits at about -16.4 dB, so it fails
MAX_LEVEL_MATCHED_EXTRA_SPECTRAL_ENERGY_DB = -20.0
# This second gate prevents silence or a badly attenuated render from looking
# artificially "better" than the reference.
MAX_ABSOLUTE_LEVEL_DRIFT_DB = 1.0


@dataclass(frozen=True, slots=True)
class GeneratedRuntime:
    runtime_path: Path
    render_script_path: Path


def _read_fixture_json(path: Path) -> list[dict[str, object]]:
    return json.loads(path.read_text(encoding="utf-8"))


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


def _build_runtime_schedule(fixture_dir: Path) -> dict[str, list[list[object]]]:
    _require_fixture_files(fixture_dir, REQUIRED_ALIAS_FIXTURE_FILES[1:])

    schedule: dict[int, list[list[object]]] = {}

    for endpoint_id in VALUE_ENDPOINT_IDS:
        value_path = fixture_dir / f"{endpoint_id}.json"
        if not value_path.exists():
            continue

        for entry in _read_fixture_json(value_path):
            schedule.setdefault(int(entry["frameOffset"]), []).append(
                [
                    "value",
                    endpoint_id,
                    float(entry["value"]),
                    int(entry.get("framesToReachValue", 0)),
                ]
            )

    for endpoint_id in EVENT_ENDPOINT_IDS:
        event_path = fixture_dir / f"{endpoint_id}.json"
        if not event_path.exists():
            continue

        for entry in _read_fixture_json(event_path):
            event_payload = entry["event"]
            if endpoint_id in {"wavetableLoadBegin", "wavetableMipFrame"}:
                # The generated JavaScript runtime rejects sessionID=1. Rewrite fixture uploads
                # to the runtime session so the real patch accepts them.
                event_payload = dict(event_payload)
                event_payload["dspSessionId"] = REAL_PATCH_SESSION_ID

            schedule.setdefault(int(entry["frameOffset"]), []).append(
                [
                    "event",
                    endpoint_id,
                    event_payload,
                    0,
                ]
            )

    return {str(frame_offset): entries for frame_offset, entries in sorted(schedule.items())}


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


@pytest.fixture(scope="module")
def generated_runtime(tmp_path_factory: pytest.TempPathFactory) -> GeneratedRuntime:
    temp_dir = tmp_path_factory.mktemp("warp_alias_runtime")
    runtime_path = temp_dir / "runtime.cjs"
    render_script_path = temp_dir / "render_from_schedule.cjs"

    generate_result = subprocess.run(
        [
            _require_cmaj_cli(),
            "generate",
            "--target=javascript",
            f"--output={runtime_path}",
            str(PATCH_PATH),
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    if generate_result.returncode != 0:
        details = "\n".join(
            part
            for part in (generate_result.stdout.strip(), generate_result.stderr.strip())
            if part
        )
        raise AssertionError(f"cmaj generate failed for {PATCH_PATH}:\n{details}")

    runtime_source = runtime_path.read_text(encoding="utf-8")
    class_match = re.search(r"^class\s+([A-Za-z_][A-Za-z0-9_]*)", runtime_source, re.MULTILINE)
    if class_match is None:
        raise AssertionError("Could not find the generated Cmajor JavaScript class name")

    runtime_path.write_text(
        runtime_source + f"\nmodule.exports = {class_match.group(1)};\n",
        encoding="utf-8",
    )

    render_script_path.write_text(
        """
const fs = require("fs");

const RuntimeClass = require(process.argv[2]);
const outputPath = process.argv[3];
const schedulePath = process.argv[4];
const numFrames = Number(process.argv[5]);
const schedule = JSON.parse(fs.readFileSync(schedulePath, "utf8"));

(async () => {
    const patch = new RuntimeClass();
    await patch.initialise(2, 44100);

    const left = new Float32Array(numFrames);
    const offsets = Object.keys(schedule).map((value) => Number(value)).sort((a, b) => a - b);
    let cursor = 0;
    let nextOffsetIndex = 0;

    function applyScheduledInputs(frameOffset) {
        const entries = schedule[String(frameOffset)] || [];

        for (const [kind, endpointID, payload, rampFrames] of entries) {
            if (kind === "value") {
                patch[`setInputValue_${endpointID}`](payload, rampFrames);
            } else {
                patch[`sendInputEvent_${endpointID}`](payload);
            }
        }
    }

    while (nextOffsetIndex < offsets.length && offsets[nextOffsetIndex] === 0) {
        applyScheduledInputs(0);
        nextOffsetIndex += 1;
    }

    while (cursor < numFrames) {
        const nextOffset = nextOffsetIndex < offsets.length ? offsets[nextOffsetIndex] : numFrames;
        const framesUntilNextOffset = nextOffset > cursor ? nextOffset - cursor : 0;
        const framesThisStep = Math.min(
            framesUntilNextOffset > 0 ? framesUntilNextOffset : numFrames - cursor,
            numFrames - cursor,
            512
        );

        if (framesThisStep > 0) {
            patch.advance(framesThisStep);

            const blockLeft = new Float32Array(framesThisStep);
            const blockRight = new Float32Array(framesThisStep);
            patch.getOutputFrames_audioOut([blockLeft, blockRight], framesThisStep, 0);
            left.set(blockLeft, cursor);
            cursor += framesThisStep;
        }

        while (nextOffsetIndex < offsets.length && offsets[nextOffsetIndex] === cursor) {
            applyScheduledInputs(cursor);
            nextOffsetIndex += 1;
        }
    }

    fs.writeFileSync(outputPath, Buffer.from(left.buffer, left.byteOffset, left.byteLength));
})().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
});
""".lstrip(),
        encoding="utf-8",
    )

    return GeneratedRuntime(runtime_path=runtime_path, render_script_path=render_script_path)


def _render_real_patch_audio(
    *,
    generated_runtime: GeneratedRuntime,
    fixture_name: str,
    num_samples: int,
    tmp_path: Path,
) -> np.ndarray:
    fixture_dir = FIXTURE_ROOT / fixture_name
    schedule_path = tmp_path / f"{fixture_name}.schedule.json"
    output_path = tmp_path / f"{fixture_name}.audio.f32"
    schedule_path.write_text(json.dumps(_build_runtime_schedule(fixture_dir)), encoding="utf-8")

    render_result = subprocess.run(
        [
            _require_node_cli(),
            str(generated_runtime.render_script_path),
            str(generated_runtime.runtime_path),
            str(output_path),
            str(schedule_path),
            str(num_samples),
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
        raise AssertionError(f"node runtime render failed for {fixture_name}:\n{details}")

    audio = np.frombuffer(output_path.read_bytes(), dtype=np.float32)
    if audio.shape != (num_samples,):
        raise AssertionError(
            f"Node runtime render wrote shape {audio.shape} for {fixture_name}, expected {(num_samples,)}"
        )
    return audio.copy()


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


@pytest.mark.cmajor
@pytest.mark.parametrize("fixture_name", ALIAS_STRESS_FIXTURES)
def test_real_patch_keeps_warp_aliasing_below_cutoff(
    fixture_name: str,
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    # This test intentionally drives the real WavetableSynth patch, not the old probe oscillator.
    fixture_dir = FIXTURE_ROOT / fixture_name
    real_audio = _render_real_patch_audio(
        generated_runtime=generated_runtime,
        fixture_name=fixture_name,
        num_samples=4096,
        tmp_path=tmp_path,
    )
    reference_audio = _load_reference_audio(fixture_dir, expected_num_samples=4096)

    level_drift_db = _measure_level_drift_db(real_audio, reference_audio)
    extra_spectral_energy_db = _measure_level_matched_extra_spectral_energy_db(real_audio, reference_audio)

    assert abs(level_drift_db) <= MAX_ABSOLUTE_LEVEL_DRIFT_DB, (
        f"{fixture_name} drifted by {level_drift_db:.2f} dB over frames "
        f"{STEADY_STATE_SLICE.start}:{STEADY_STATE_SLICE.stop} relative to the checked-in "
        f"{REFERENCE_OVERSAMPLE_FACTOR}x oversampled reference. "
        f"The allowed drift is +/-{MAX_ABSOLUTE_LEVEL_DRIFT_DB:.2f} dB."
    )
    assert extra_spectral_energy_db <= MAX_LEVEL_MATCHED_EXTRA_SPECTRAL_ENERGY_DB, (
        f"{fixture_name} added {extra_spectral_energy_db:.2f} dB of level-matched extra spectral energy "
        f"relative to the checked-in {REFERENCE_OVERSAMPLE_FACTOR}x oversampled reference over frames "
        f"{STEADY_STATE_SLICE.start}:{STEADY_STATE_SLICE.stop}. "
        f"The cutoff is {MAX_LEVEL_MATCHED_EXTRA_SPECTRAL_ENERGY_DB:.2f} dB."
    )
