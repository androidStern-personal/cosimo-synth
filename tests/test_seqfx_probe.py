from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
PATCH_PATH = ROOT / "fx" / "seqfx" / "SeqFx.cmajorpatch"
SAMPLE_RATE = 48_000
STEP_FRAMES = 3_000
LANE_FILTER = 0
LANE_CRUSHER = 1
LANE_TAPE = 2
LANE_STUTTER = 3
STEP_COUNT = 32
LANE_COUNT = 4
PARAM_COUNT = 8


@dataclass(frozen=True)
class GeneratedRuntime:
    runtime_path: Path
    render_script_path: Path


def _require_tool(name: str) -> str:
    path = shutil.which(name)
    if path is None:
        pytest.skip(f"{name} is required for SeqFX render tests")
    return path


def _empty_upload(*, revision: int = 1, pattern_index: int = 0) -> dict[str, object]:
    return {
        "patternIndex": pattern_index,
        "revision": revision,
        "authoritative": True,
        "activeSteps": [[False for _ in range(STEP_COUNT)] for _ in range(LANE_COUNT)],
        "triggerSteps": [[False for _ in range(STEP_COUNT)] for _ in range(LANE_COUNT)],
        "mix": [[1.0 for _ in range(STEP_COUNT)] for _ in range(LANE_COUNT)],
        "params": [
            [[0.0 for _ in range(PARAM_COUNT)] for _ in range(STEP_COUNT)]
            for _ in range(LANE_COUNT)
        ],
    }


def _activate_step(
    upload: dict[str, object],
    *,
    lane: int,
    step: int,
    trigger: bool = True,
    mix: float = 1.0,
    params: list[float] | None = None,
) -> None:
    active_steps = upload["activeSteps"]
    trigger_steps = upload["triggerSteps"]
    mixes = upload["mix"]
    param_grid = upload["params"]
    assert isinstance(active_steps, list)
    assert isinstance(trigger_steps, list)
    assert isinstance(mixes, list)
    assert isinstance(param_grid, list)
    active_steps[lane][step] = True
    trigger_steps[lane][step] = trigger
    mixes[lane][step] = float(mix)
    if params is not None:
        for index, value in enumerate(params):
            param_grid[lane][step][index] = float(value)


@pytest.fixture(scope="module")
def generated_runtime(tmp_path_factory: pytest.TempPathFactory) -> GeneratedRuntime:
    cmaj = _require_tool("cmaj")
    node = _require_tool("node")
    del node

    temp_dir = tmp_path_factory.mktemp("seqfx_cmajor_js")
    runtime_path = temp_dir / "runtime.cjs"
    render_script_path = temp_dir / "render.cjs"

    result = subprocess.run(
        [
            cmaj,
            "generate",
            "--target=javascript",
            f"--output={runtime_path}",
            str(PATCH_PATH),
        ],
        cwd=PATCH_PATH.parent,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        details = "\n".join(
            part for part in (result.stdout.strip(), result.stderr.strip()) if part
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
const inputPath = process.argv[3];
const schedulePath = process.argv[4];
const outputPath = process.argv[5];
const numFrames = Number(process.argv[6]);
const sampleRate = Number(process.argv[7]);
const schedule = JSON.parse(fs.readFileSync(schedulePath, "utf8"));
const inputBuffer = fs.readFileSync(inputPath);
const input = new Float32Array(
    inputBuffer.buffer,
    inputBuffer.byteOffset,
    inputBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT
);

(async () => {
    const patch = new RuntimeClass();
    await patch.initialise(2, sampleRate);

    const output = new Float32Array(numFrames * 2);
    const offsets = Object.keys(schedule).map((value) => Number(value)).sort((a, b) => a - b);
    let cursor = 0;
    let nextOffsetIndex = 0;

    function applyScheduledInputs(frameOffset) {
        const entries = schedule[String(frameOffset)] || [];

        for (const [kind, endpointID, payload, rampFrames] of entries) {
            if (kind === "value") {
                patch[`setInputValue_${endpointID}`](payload, rampFrames ?? 0);
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
            const blockLeft = new Float32Array(framesThisStep);
            const blockRight = new Float32Array(framesThisStep);

            for (let index = 0; index < framesThisStep; index += 1) {
                const sourceIndex = (cursor + index) * 2;
                blockLeft[index] = input[sourceIndex];
                blockRight[index] = input[sourceIndex + 1];
            }

            patch.setInputStreamFrames_audioIn([blockLeft, blockRight], framesThisStep, 0);
            patch.advance(framesThisStep);

            const outLeft = new Float32Array(framesThisStep);
            const outRight = new Float32Array(framesThisStep);
            patch.getOutputFrames_audioOut([outLeft, outRight], framesThisStep, 0);

            for (let index = 0; index < framesThisStep; index += 1) {
                const targetIndex = (cursor + index) * 2;
                output[targetIndex] = outLeft[index];
                output[targetIndex + 1] = outRight[index];
            }

            cursor += framesThisStep;
        }

        while (nextOffsetIndex < offsets.length && offsets[nextOffsetIndex] === cursor) {
            applyScheduledInputs(cursor);
            nextOffsetIndex += 1;
        }
    }

    fs.writeFileSync(outputPath, Buffer.from(output.buffer, output.byteOffset, output.byteLength));
})().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
});
""".lstrip(),
        encoding="utf-8",
    )

    return GeneratedRuntime(runtime_path=runtime_path, render_script_path=render_script_path)


def _render(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    input_audio: np.ndarray,
    schedule: dict[int, list[list[object]]],
) -> np.ndarray:
    node = _require_tool("node")
    input_audio = np.asarray(input_audio, dtype=np.float32)
    if input_audio.ndim != 2 or input_audio.shape[1] != 2:
        raise ValueError("input_audio must have shape (frames, 2)")

    input_path = tmp_path / "input.f32"
    schedule_path = tmp_path / "schedule.json"
    output_path = tmp_path / "output.f32"
    input_path.write_bytes(input_audio.reshape(-1).tobytes())
    schedule_path.write_text(json.dumps({str(k): v for k, v in schedule.items()}), encoding="utf-8")

    result = subprocess.run(
        [
            node,
            str(generated_runtime.render_script_path),
            str(generated_runtime.runtime_path),
            str(input_path),
            str(schedule_path),
            str(output_path),
            str(input_audio.shape[0]),
            str(SAMPLE_RATE),
        ],
        cwd=PATCH_PATH.parent,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        details = "\n".join(
            part for part in (result.stdout.strip(), result.stderr.strip()) if part
        )
        raise AssertionError(f"node runtime render failed:\n{details}")

    output = np.frombuffer(output_path.read_bytes(), dtype=np.float32)
    return output.reshape((-1, 2)).copy()


def _base_schedule(upload: dict[str, object], *, global_mix: float = 1.0) -> dict[int, list[list[object]]]:
    return {
        0: [
            ["event", "patternUpload", upload],
            ["value", "enabled", 1.0, 0],
            ["value", "globalMix", global_mix, 0],
            ["value", "patternSelect", 0.0, 0],
            ["value", "clockMode", 1.0, 0],
            ["value", "manualBpm", 120.0, 0],
            ["value", "rate", 2.0, 0],
            ["value", "swing", 0.0, 0],
            ["value", "loopStart", 0.0, 0],
            ["value", "loopLength", 32.0, 0],
            ["event", "internalReset", 1],
            ["event", "internalPlay", 1],
        ]
    }


def _sine(frames: int, frequency: float, amplitude: float = 0.55) -> np.ndarray:
    t = np.arange(frames, dtype=np.float64) / SAMPLE_RATE
    mono = (amplitude * np.sin(2.0 * np.pi * frequency * t)).astype(np.float32)
    return np.column_stack([mono, mono]).astype(np.float32)


def _ramp(frames: int) -> np.ndarray:
    mono = np.linspace(-0.95, 0.95, frames, dtype=np.float32)
    return np.column_stack([mono, mono]).astype(np.float32)


def _zero_crossing_rate(samples: np.ndarray) -> float:
    signs = np.signbit(samples)
    return float(np.count_nonzero(signs[1:] != signs[:-1]) / max(1, samples.size))


def test_empty_seqfx_pattern_passes_audio_unchanged(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    input_audio = _sine(STEP_FRAMES * 2, 440.0)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    np.testing.assert_allclose(output, input_audio, atol=1.0e-5, rtol=0.0)


def test_per_step_crusher_parameters_are_latched_at_step_boundaries(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(upload, lane=LANE_CRUSHER, step=0, params=[4, 8, 0])
    _activate_step(upload, lane=LANE_CRUSHER, step=1, params=[16, 1, 0])
    input_audio = _ramp(STEP_FRAMES * 2)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    first_step = np.round(output[400 : STEP_FRAMES - 400, 0], 3)
    second_step = np.round(output[STEP_FRAMES + 400 : (STEP_FRAMES * 2) - 400, 0], 3)

    assert np.unique(first_step).size < 20
    assert np.unique(second_step).size > np.unique(first_step).size * 6


def test_global_mix_zero_returns_dry_even_when_all_lanes_are_active(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for lane in range(LANE_COUNT):
        for step in range(3):
            _activate_step(upload, lane=lane, step=step)

    _activate_step(upload, lane=LANE_FILTER, step=0, params=[0, 160.0, 160.0, 0.707, 1.0])
    _activate_step(upload, lane=LANE_CRUSHER, step=0, params=[4, 12, 12.0])
    _activate_step(upload, lane=LANE_TAPE, step=0, params=[1.0, 1.0, 0.0, 20.0])
    _activate_step(upload, lane=LANE_STUTTER, step=0, params=[1.0, 1.0, 0.0])

    input_audio = _sine(STEP_FRAMES * 3, 1_200.0)
    dry_output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload, global_mix=0.0))
    wet_output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload, global_mix=1.0))

    np.testing.assert_allclose(dry_output, input_audio, atol=1.0e-5, rtol=0.0)
    assert float(np.sqrt(np.mean((wet_output - input_audio) ** 2))) > 0.02


def test_filter_lane_reduces_high_frequency_energy(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(upload, lane=LANE_FILTER, step=0, params=[0, 220.0, 220.0, 0.707, 1.0])
    input_audio = _sine(STEP_FRAMES, 5_000.0)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    input_rms = float(np.sqrt(np.mean(input_audio[800:, 0] ** 2)))
    output_rms = float(np.sqrt(np.mean(output[800:, 0] ** 2)))
    assert output_rms < input_rms * 0.35


def test_tape_stop_lowers_zero_crossing_rate_during_active_block(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (1, 2, 3):
        _activate_step(upload, lane=LANE_TAPE, step=step, trigger=(step == 1), params=[1.0, 1.4, 0.0, 30.0])

    input_audio = _sine(STEP_FRAMES * 4, 660.0)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    early = output[STEP_FRAMES + 400 : STEP_FRAMES * 2, 0]
    late = output[(STEP_FRAMES * 3) - 1_400 : STEP_FRAMES * 3, 0]

    assert _zero_crossing_rate(late) < _zero_crossing_rate(early) * 0.72


def test_stutter_repeats_the_captured_slice(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (2, 3):
        _activate_step(upload, lane=LANE_STUTTER, step=step, trigger=(step == 2), params=[0.0, 1.0, 0.0])

    frames = STEP_FRAMES * 4
    t = np.arange(frames, dtype=np.float64) / SAMPLE_RATE
    mono = (0.15 + (0.7 * (np.arange(frames) / frames))) * np.sin(2.0 * np.pi * (220.0 + 45.0 * t) * t)
    input_audio = np.column_stack([mono, mono]).astype(np.float32)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    first_loop = output[STEP_FRAMES * 2 : (STEP_FRAMES * 2) + 1_500, 0]
    second_loop = output[(STEP_FRAMES * 2) + 1_500 : STEP_FRAMES * 3, 0]

    difference = float(np.sqrt(np.mean((first_loop - second_loop) ** 2)))
    reference = float(np.sqrt(np.mean(first_loop**2)))
    assert difference < reference * 0.12
