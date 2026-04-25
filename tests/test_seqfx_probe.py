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
EFFECT_EMPTY = 0
EFFECT_FILTER = 1
EFFECT_CRUSHER = 2
EFFECT_TAPE = 3
EFFECT_STUTTER = 4
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
        "effectTypes": [[EFFECT_EMPTY for _ in range(STEP_COUNT)] for _ in range(LANE_COUNT)],
        "mix": [[1.0 for _ in range(STEP_COUNT)] for _ in range(LANE_COUNT)],
        "params": [
            [[0.0 for _ in range(PARAM_COUNT)] for _ in range(STEP_COUNT)]
            for _ in range(LANE_COUNT)
        ],
        "auxEnabled": [
            [[False for _ in range(PARAM_COUNT)] for _ in range(STEP_COUNT)]
            for _ in range(LANE_COUNT)
        ],
        "auxEnd": [
            [[0.0 for _ in range(PARAM_COUNT)] for _ in range(STEP_COUNT)]
            for _ in range(LANE_COUNT)
        ],
        "auxShape": [[0.0 for _ in range(STEP_COUNT)] for _ in range(LANE_COUNT)],
        "auxSourceCurve": [[0.0 for _ in range(STEP_COUNT)] for _ in range(LANE_COUNT)],
        "auxRateMode": [[1 for _ in range(STEP_COUNT)] for _ in range(LANE_COUNT)],
        "auxTempoMultiplier": [[4 for _ in range(STEP_COUNT)] for _ in range(LANE_COUNT)],
        "auxTempoTriplet": [[False for _ in range(STEP_COUNT)] for _ in range(LANE_COUNT)],
        "auxSliceCount": [[1 for _ in range(STEP_COUNT)] for _ in range(LANE_COUNT)],
    }


def _activate_step(
    upload: dict[str, object],
    *,
    lane: int,
    step: int,
    trigger: bool = True,
    mix: float = 1.0,
    effect_type: int | None = None,
    params: list[float] | None = None,
) -> None:
    active_steps = upload["activeSteps"]
    trigger_steps = upload["triggerSteps"]
    effect_types = upload["effectTypes"]
    mixes = upload["mix"]
    param_grid = upload["params"]
    assert isinstance(active_steps, list)
    assert isinstance(trigger_steps, list)
    assert isinstance(effect_types, list)
    assert isinstance(mixes, list)
    assert isinstance(param_grid, list)
    active_steps[lane][step] = True
    trigger_steps[lane][step] = trigger
    effect_types[lane][step] = int(effect_type if effect_type is not None else lane + 1)
    mixes[lane][step] = float(mix)
    if params is not None:
        for index, value in enumerate(params):
            param_grid[lane][step][index] = float(value)
            upload["auxEnd"][lane][step][index] = float(value)


def _set_aux(
    upload: dict[str, object],
    *,
    lane: int,
    step: int,
    param: int,
    end: float,
    enabled: bool = True,
    shape: float = 1.0,
    source_curve: float = 0.0,
    rate_mode: int = 1,
    tempo_multiplier: int = 4,
    tempo_triplet: bool = False,
    slice_count: int = 1,
) -> None:
    upload["auxEnabled"][lane][step][param] = bool(enabled)
    upload["auxEnd"][lane][step][param] = float(end)
    upload["auxShape"][lane][step] = float(shape)
    upload["auxSourceCurve"][lane][step] = float(source_curve)
    upload["auxRateMode"][lane][step] = int(rate_mode)
    upload["auxTempoMultiplier"][lane][step] = int(tempo_multiplier)
    upload["auxTempoTriplet"][lane][step] = bool(tempo_triplet)
    upload["auxSliceCount"][lane][step] = int(slice_count)


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
const monitorPath = process.argv[8];
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
    const monitors = [];
    const offsets = Object.keys(schedule).map((value) => Number(value)).sort((a, b) => a - b);
    let cursor = 0;
    let nextOffsetIndex = 0;

    function applyScheduledInputs(frameOffset) {
        const entries = schedule[String(frameOffset)] || [];

        for (const [kind, endpointID, payload, rampFrames] of entries) {
            if (kind === "value") {
                patch[`setInputValue_${endpointID}`](payload, rampFrames ?? 0);
            } else {
                const eventPayload = endpointID === "positionIn"
                    ? { ...payload, frameIndex: BigInt(payload.frameIndex) }
                    : payload;
                patch[`sendInputEvent_${endpointID}`](eventPayload);
            }
        }
    }

    function captureMonitorEvents(frameOffset) {
        if (!monitorPath) {
            return;
        }

        const count = patch.getOutputEventCount_monitorOut();
        for (let index = 0; index < count; index += 1) {
            monitors.push({
                frame: frameOffset,
                value: patch.getOutputEvent_monitorOut(index),
            });
        }
        patch.resetOutputEventCount_monitorOut();
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
            captureMonitorEvents(cursor + framesThisStep);

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
    if (monitorPath) {
        fs.writeFileSync(monitorPath, JSON.stringify(monitors));
    }
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
    return _render_with_monitor_events(generated_runtime, tmp_path, input_audio, schedule)[0]


def _render_with_monitor_events(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    input_audio: np.ndarray,
    schedule: dict[int, list[list[object]]],
) -> tuple[np.ndarray, list[dict[str, object]]]:
    node = _require_tool("node")
    input_audio = np.asarray(input_audio, dtype=np.float32)
    if input_audio.ndim != 2 or input_audio.shape[1] != 2:
        raise ValueError("input_audio must have shape (frames, 2)")

    input_path = tmp_path / "input.f32"
    schedule_path = tmp_path / "schedule.json"
    output_path = tmp_path / "output.f32"
    monitor_path = tmp_path / "monitor.json"
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
            str(monitor_path),
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
    monitors = json.loads(monitor_path.read_text(encoding="utf-8"))
    return output.reshape((-1, 2)).copy(), monitors


def _base_schedule(
    upload: dict[str, object],
    *,
    global_mix: float = 1.0,
    clock_mode: float = 1.0,
    manual_bpm: float = 120.0,
    rate: float = 2.0,
    swing: float = 0.0,
    loop_start: float = 0.0,
    loop_length: float = 32.0,
) -> dict[int, list[list[object]]]:
    return {
        0: [
            ["event", "patternUpload", upload],
            ["value", "enabled", 1.0, 0],
            ["value", "globalMix", global_mix, 0],
            ["value", "patternSelect", 0.0, 0],
            ["value", "clockMode", clock_mode, 0],
            ["value", "manualBpm", manual_bpm, 0],
            ["value", "rate", rate, 0],
            ["value", "swing", swing, 0],
            ["value", "loopStart", loop_start, 0],
            ["value", "loopLength", loop_length, 0],
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


def _complex_signal(frames: int) -> np.ndarray:
    t = np.arange(frames, dtype=np.float64) / SAMPLE_RATE
    sweep = np.sin(2.0 * np.pi * (120.0 + (860.0 * t)) * t)
    mono = (
        0.25 * np.sin(2.0 * np.pi * 190.0 * t)
        + 0.22 * np.sin(2.0 * np.pi * 1_370.0 * t)
        + 0.18 * sweep
        + 0.08 * np.sign(np.sin(2.0 * np.pi * 73.0 * t))
    ).astype(np.float32)
    return np.column_stack([mono, mono]).astype(np.float32)


def _rms(samples: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.asarray(samples, dtype=np.float64) ** 2)))


def _largest_boundary_jump(samples: np.ndarray, boundary_step: int) -> float:
    boundary = STEP_FRAMES * boundary_step
    window = samples[boundary - 16 : boundary + 16]
    return float(np.max(np.abs(np.diff(window))))


def _zero_crossing_rate(samples: np.ndarray) -> float:
    signs = np.signbit(samples)
    return float(np.count_nonzero(signs[1:] != signs[:-1]) / max(1, samples.size))


def _first_monitor_frame_for_step(monitors: list[dict[str, object]], step_index: int) -> int:
    for monitor in monitors:
        value = monitor["value"]
        assert isinstance(value, dict)
        event = value["event"]
        assert isinstance(event, dict)
        if int(event["stepIndex"]) == step_index:
            return int(monitor["frame"])

    raise AssertionError(f"No monitor event reported step {step_index}; saw {monitors[:8]}")


def _first_monitor_event_for_step(monitors: list[dict[str, object]], step_index: int) -> dict[str, object]:
    for monitor in monitors:
        value = monitor["value"]
        assert isinstance(value, dict)
        event = value["event"]
        assert isinstance(event, dict)
        if int(event["stepIndex"]) == step_index:
            return event

    raise AssertionError(f"No monitor event reported step {step_index}; saw {monitors[:8]}")


@pytest.mark.parametrize(
    ("rate_index", "expected_step_frames"),
    [
        (0.0, 12_000),
        (1.0, 6_000),
        (2.0, 3_000),
    ],
)
def test_internal_clock_rate_labels_match_reported_step_duration(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    rate_index: float,
    expected_step_frames: int,
) -> None:
    upload = _empty_upload()
    input_audio = np.zeros((expected_step_frames + 2_800, 2), dtype=np.float32)
    _output, monitors = _render_with_monitor_events(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(upload, rate=rate_index),
    )

    first_step_one_frame = _first_monitor_frame_for_step(monitors, 1)
    assert expected_step_frames <= first_step_one_frame <= expected_step_frames + 1_800


def test_host_clock_rate_uses_quarter_note_position_for_step_index(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    input_audio = np.zeros((8_500, 2), dtype=np.float32)
    schedule = _base_schedule(upload, clock_mode=0.0, rate=1.0)
    schedule[0].extend([
        ["event", "tempoIn", {"bpm": 120.0}],
        ["event", "transportStateIn", {"flags": 1}],
        ["event", "positionIn", {"frameIndex": 0, "quarterNote": 0.0, "barStartQuarterNote": 0.0}],
    ])
    schedule[6_000] = [
        ["event", "positionIn", {"frameIndex": 6_000, "quarterNote": 0.25, "barStartQuarterNote": 0.0}],
    ]

    _output, monitors = _render_with_monitor_events(generated_runtime, tmp_path, input_audio, schedule)

    first_step_one_frame = _first_monitor_frame_for_step(monitors, 1)
    assert 6_000 <= first_step_one_frame <= 7_800


def test_swing_changes_reported_step_durations_without_changing_rate_label(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    input_audio = np.zeros((8_500, 2), dtype=np.float32)
    _output, monitors = _render_with_monitor_events(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(upload, rate=2.0, swing=0.25),
    )

    first_step_one_frame = _first_monitor_frame_for_step(monitors, 1)
    first_step_two_frame = _first_monitor_frame_for_step(monitors, 2)
    assert 2_250 <= first_step_one_frame <= 4_050
    assert 6_000 <= first_step_two_frame <= 7_800


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


def test_live_crusher_hold_upload_changes_active_continuation_without_retrigger(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_CRUSHER,
            step=step,
            trigger=(step == 0),
            params=[16, 1, 0],
        )

    edited = json.loads(json.dumps(upload))
    edited["revision"] = 2
    edited["authoritative"] = False
    for step in (0, 1):
        _activate_step(
            edited,
            lane=LANE_CRUSHER,
            step=step,
            trigger=(step == 0),
            params=[16, 64, 0],
        )

    input_audio = _ramp(STEP_FRAMES * 2)
    schedule = _base_schedule(upload)
    schedule[STEP_FRAMES + 600] = [["event", "patternUpload", edited]]
    output = _render(generated_runtime, tmp_path, input_audio, schedule)

    pre_upload = output[STEP_FRAMES + 120 : STEP_FRAMES + 520, 0]
    post_upload = output[STEP_FRAMES + 900 : STEP_FRAMES + 1_700, 0]
    pre_held_fraction = float(np.mean(np.abs(np.diff(pre_upload)) < 1.0e-8))
    post_held_fraction = float(np.mean(np.abs(np.diff(post_upload)) < 1.0e-8))

    assert pre_held_fraction < 0.05, (
        f"Hold=1 should not create a staircase before the upload; held fraction was {pre_held_fraction:.3f}"
    )
    assert post_held_fraction > 0.80, (
        f"Hold=64 should create a staircase immediately after the upload; held fraction was {post_held_fraction:.3f}"
    )


def test_live_block_start_upload_relatches_active_continuation(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_CRUSHER,
            step=step,
            trigger=(step == 0),
            params=[16, 1, 0],
        )

    edited = json.loads(json.dumps(upload))
    edited["revision"] = 2
    edited["authoritative"] = False
    _activate_step(
        edited,
        lane=LANE_CRUSHER,
        step=0,
        trigger=True,
        params=[4, 1, 0],
    )

    input_audio = _ramp(STEP_FRAMES * 2)
    schedule = _base_schedule(upload)
    schedule[STEP_FRAMES + 600] = [["event", "patternUpload", edited]]
    output = _render(generated_runtime, tmp_path, input_audio, schedule)

    pre_upload = np.round(output[STEP_FRAMES + 120 : STEP_FRAMES + 520, 0], 3)
    post_upload = np.round(output[STEP_FRAMES + 1_200 : STEP_FRAMES + 2_200, 0], 3)

    assert np.unique(pre_upload).size > 80
    assert np.unique(post_upload).size < 24


def test_aux_envelope_sweeps_crusher_bits_across_the_full_block(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_CRUSHER,
            step=step,
            trigger=(step == 0),
            params=[16, 1, 0],
        )
        _set_aux(upload, lane=LANE_CRUSHER, step=step, param=0, end=4)

    input_audio = _ramp(STEP_FRAMES * 2)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    early = np.round(output[900:1_900, 0], 3)
    late = np.round(output[(STEP_FRAMES * 2) - 1_500 : (STEP_FRAMES * 2) - 500, 0], 3)

    assert np.unique(early).size > np.unique(late).size * 3


def test_aux_source_shapes_render_distinct_stutter_gate_signatures(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    shape_names = {
        -1.0: "falling",
        0.0: "bell",
        1.0: "rising",
    }
    expected_audibility = {
        "falling": {"step1_10": True, "step1_45": False, "step1_85": False, "step2_45": True},
        "bell": {"step1_10": True, "step1_45": False, "step1_85": False, "step2_45": False},
        "rising": {"step1_10": True, "step1_45": True, "step1_85": False, "step2_45": False},
    }

    upload = _empty_upload()
    for step in range(4):
        _activate_step(
            upload,
            lane=LANE_STUTTER,
            step=step,
            trigger=(step == 0),
            params=[4.0, 1.0, 0.0, 1.0],
        )

    frames = STEP_FRAMES * 4
    mono = np.zeros(frames, dtype=np.float32)
    n = np.arange(STEP_FRAMES, dtype=np.float64)
    captured_slice = (
        0.32 * np.sin(2.0 * np.pi * 330.0 * n / SAMPLE_RATE)
        + 0.21 * np.sin(2.0 * np.pi * 870.0 * n / SAMPLE_RATE)
    ).astype(np.float32)
    mono[:STEP_FRAMES] = captured_slice
    input_audio = np.column_stack([mono, mono]).astype(np.float32)

    probe_windows = {
        "step1_10": (STEP_FRAMES, 0.10),
        "step1_45": (STEP_FRAMES, 0.45),
        "step1_85": (STEP_FRAMES, 0.85),
        "step2_45": (STEP_FRAMES * 2, 0.45),
    }

    def rms_for_window(samples: np.ndarray, step_start: int, local_phase: float) -> float:
        center = step_start + int(STEP_FRAMES * local_phase)
        half_width = 16
        window = samples[center - half_width : center + half_width, 0]
        return _rms(window)

    reference_rms = {
        name: _rms(
            captured_slice[
                int(STEP_FRAMES * local_phase) - 16 : int(STEP_FRAMES * local_phase) + 16
            ]
        )
        for name, (_step_start, local_phase) in probe_windows.items()
    }

    for shape, shape_name in shape_names.items():
        for step in range(4):
            _set_aux(upload, lane=LANE_STUTTER, step=step, param=3, end=0.0, shape=shape)

        output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

        for window_name, (step_start, local_phase) in probe_windows.items():
            ratio = rms_for_window(output, step_start, local_phase) / max(reference_rms[window_name], 1.0e-6)
            if expected_audibility[shape_name][window_name]:
                assert ratio > 0.35, f"{shape_name} should stay audible in {window_name}, got ratio {ratio:.3f}"
            else:
                assert ratio < 0.08, f"{shape_name} should mute {window_name}, got ratio {ratio:.3f}"


def test_aux_envelope_sweeps_crusher_hold_frames_across_the_full_block(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in range(4):
        _activate_step(
            upload,
            lane=LANE_CRUSHER,
            step=step,
            trigger=(step == 0),
            params=[16, 1, 0],
        )
        _set_aux(upload, lane=LANE_CRUSHER, step=step, param=1, end=64)

    input_audio = _ramp(STEP_FRAMES * 4)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    early = np.round(output[400:1_400, 0], 6)
    late = np.round(output[(STEP_FRAMES * 3) + 1_000 : (STEP_FRAMES * 3) + 2_000, 0], 6)
    early_change_rate = float(np.count_nonzero(np.diff(early)) / max(1, early.size - 1))
    late_change_rate = float(np.count_nonzero(np.diff(late)) / max(1, late.size - 1))

    assert early_change_rate > late_change_rate * 8


def test_aux_envelope_sweeps_crusher_drive_into_clipping_late_in_the_block(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    baseline_upload = _empty_upload()
    aux_upload = _empty_upload()
    for step in range(4):
        for upload in (baseline_upload, aux_upload):
            _activate_step(
                upload,
                lane=LANE_CRUSHER,
                step=step,
                trigger=(step == 0),
                params=[16, 1, 0],
            )
        _set_aux(aux_upload, lane=LANE_CRUSHER, step=step, param=2, end=36)

    input_audio = _sine(STEP_FRAMES * 4, 330.0, amplitude=0.05)
    baseline = _render(generated_runtime, tmp_path, input_audio, _base_schedule(baseline_upload))
    modulated = _render(generated_runtime, tmp_path, input_audio, _base_schedule(aux_upload))

    early_window = slice(200, 1_000)
    late_window = slice((STEP_FRAMES * 3) + 1_000, (STEP_FRAMES * 3) + 1_800)
    early_delta = _rms(modulated[early_window, 0] - baseline[early_window, 0])
    late_delta = _rms(modulated[late_window, 0] - baseline[late_window, 0])
    early_clip_fraction = float(np.mean(np.abs(modulated[early_window, 0]) > 0.95))
    late_clip_fraction = float(np.mean(np.abs(modulated[late_window, 0]) > 0.95))

    assert early_clip_fraction < 0.01
    assert late_clip_fraction > 0.2
    assert late_delta > early_delta * 8


def test_monitor_reports_raw_aux_cycle_phase_and_shaped_amount_for_the_active_block(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_CRUSHER,
            step=step,
            trigger=(step == 0),
            params=[16, 1, 0],
        )
        _set_aux(upload, lane=LANE_CRUSHER, step=step, param=0, end=4)

    input_audio = np.zeros((STEP_FRAMES * 2, 2), dtype=np.float32)
    _output, monitors = _render_with_monitor_events(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(upload),
    )

    crusher_events = [
        monitor["value"]["event"]
        for monitor in monitors
        if monitor["value"]["event"]["stepIndex"] == 1
    ]

    assert crusher_events, "expected at least one monitor event while step 1 was active"
    first = crusher_events[0]
    assert len(first["auxCyclePhase"]) == LANE_COUNT
    assert len(first["auxAmount"]) == LANE_COUNT
    assert len(first["auxDurationMs"]) == LANE_COUNT
    assert 0.45 <= first["auxCyclePhase"][LANE_CRUSHER] <= 0.75
    assert 0.45 <= first["auxAmount"][LANE_CRUSHER] <= 0.75
    assert 120.0 <= first["auxDurationMs"][LANE_CRUSHER] <= 130.0


def test_monitor_reports_falling_shape_with_raw_phase_increasing_and_amount_falling(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_CRUSHER,
            step=step,
            trigger=(step == 0),
            params=[16, 1, 0],
        )
        _set_aux(upload, lane=LANE_CRUSHER, step=step, param=0, end=4, shape=-1.0)

    input_audio = np.zeros((STEP_FRAMES * 2, 2), dtype=np.float32)
    _output, monitors = _render_with_monitor_events(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(upload),
    )

    crusher_events = [
        monitor["value"]["event"]
        for monitor in monitors
        if monitor["value"]["event"]["auxDurationMs"][LANE_CRUSHER] > 0
    ]

    assert crusher_events, "expected monitor events with crusher aux duration"
    assert crusher_events[0]["auxCyclePhase"][LANE_CRUSHER] < 0.2
    assert crusher_events[-1]["auxCyclePhase"][LANE_CRUSHER] > 0.8
    assert crusher_events[0]["auxAmount"][LANE_CRUSHER] > 0.8
    assert crusher_events[-1]["auxAmount"][LANE_CRUSHER] < 0.2
    assert 120.0 <= crusher_events[-1]["auxDurationMs"][LANE_CRUSHER] <= 130.0


@pytest.mark.parametrize(
    ("tempo_multiplier", "tempo_triplet", "expected_min", "expected_max"),
    [
        (1, False, 0.45, 0.60),
        (2, False, 0.20, 0.35),
        (2, True, 0.32, 0.47),
    ],
)
def test_tempo_synced_aux_rate_controls_raw_cycle_phase(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    tempo_multiplier: int,
    tempo_triplet: bool,
    expected_min: float,
    expected_max: float,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_CRUSHER,
            step=step,
            trigger=(step == 0),
            params=[16, 1, 0],
        )
        _set_aux(
            upload,
            lane=LANE_CRUSHER,
            step=step,
            param=0,
            end=4,
            rate_mode=0,
            tempo_multiplier=tempo_multiplier,
            tempo_triplet=tempo_triplet,
        )

    input_audio = np.zeros((STEP_FRAMES * 2, 2), dtype=np.float32)
    _output, monitors = _render_with_monitor_events(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(upload, manual_bpm=120.0, rate=2.0),
    )

    step_one = _first_monitor_event_for_step(monitors, 1)
    phase = float(step_one["auxCyclePhase"][LANE_CRUSHER])

    assert expected_min <= phase <= expected_max


@pytest.mark.parametrize(
    ("slice_count", "expected_min", "expected_max"),
    [
        (1, 0.45, 0.60),
        (2, 0.0, 0.10),
    ],
)
def test_slice_aux_rate_divides_the_active_block_duration(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    slice_count: int,
    expected_min: float,
    expected_max: float,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_CRUSHER,
            step=step,
            trigger=(step == 0),
            params=[16, 1, 0],
        )
        _set_aux(
            upload,
            lane=LANE_CRUSHER,
            step=step,
            param=0,
            end=4,
            rate_mode=1,
            slice_count=slice_count,
        )

    input_audio = np.zeros((STEP_FRAMES * 2, 2), dtype=np.float32)
    _output, monitors = _render_with_monitor_events(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(upload, rate=2.0),
    )

    step_one = _first_monitor_event_for_step(monitors, 1)
    phase = float(step_one["auxCyclePhase"][LANE_CRUSHER])

    assert expected_min <= phase <= expected_max


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
    _activate_step(upload, lane=LANE_TAPE, step=0, params=[1.0, 1.0, 1.0, 20.0])
    _activate_step(upload, lane=LANE_STUTTER, step=0, params=[1.0, 1.0, 0.0, 1.0])

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


def test_filter_ignores_legacy_end_cutoff_without_cutoff_aux_target(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in range(4):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            params=[0, 220.0, 20_000.0, 0.707, 1.0],
        )

    input_audio = _sine(STEP_FRAMES * 4, 3_000.0)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    first_step_start = output[350:900, 0]
    fourth_step_start = output[(STEP_FRAMES * 3) + 350 : (STEP_FRAMES * 3) + 900, 0]
    first_rms = float(np.sqrt(np.mean(first_step_start**2)))
    fourth_rms = float(np.sqrt(np.mean(fourth_step_start**2)))

    assert fourth_rms < first_rms * 1.25


def test_filter_mode_can_be_modulated_by_the_aux_source(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in range(4):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            params=[0, 1_000.0, 1_000.0, 0.707, 1.0],
        )
        _set_aux(upload, lane=LANE_FILTER, step=step, param=0, end=1.0, shape=1.0)

    input_audio = _sine(STEP_FRAMES * 4, 200.0)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    early_lowpass_window = output[500:1_300, 0]
    late_highpass_window = output[(STEP_FRAMES * 3) + 1_100 : (STEP_FRAMES * 3) + 1_900, 0]
    early_rms = _rms(early_lowpass_window)
    late_rms = _rms(late_highpass_window)

    assert early_rms > 0.28
    assert late_rms < early_rms * 0.35


def test_filter_resonance_can_be_modulated_by_the_aux_source(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    baseline_upload = _empty_upload()
    resonant_upload = _empty_upload()
    for step in range(4):
        for upload in (baseline_upload, resonant_upload):
            _activate_step(
                upload,
                lane=LANE_FILTER,
                step=step,
                trigger=(step == 0),
                params=[0, 1_000.0, 1_000.0, 0.3, 1.0],
            )
        _set_aux(resonant_upload, lane=LANE_FILTER, step=step, param=3, end=18.0, shape=1.0)

    input_audio = _sine(STEP_FRAMES * 4, 1_000.0, amplitude=0.08)
    baseline = _render(generated_runtime, tmp_path, input_audio, _base_schedule(baseline_upload))
    resonant = _render(generated_runtime, tmp_path, input_audio, _base_schedule(resonant_upload))

    late_window = slice((STEP_FRAMES * 3) + 1_100, (STEP_FRAMES * 3) + 1_900)
    late_delta = _rms(resonant[late_window, 0] - baseline[late_window, 0])
    late_resonant_rms = _rms(resonant[late_window, 0])
    late_baseline_rms = _rms(baseline[late_window, 0])

    assert late_delta > 0.035
    assert late_resonant_rms > late_baseline_rms * 1.5


def test_live_filter_cutoff_upload_changes_active_continuation_without_retrigger(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            params=[0, 220.0, 220.0, 0.707, 1.0],
        )

    edited = json.loads(json.dumps(upload))
    edited["revision"] = 2
    edited["authoritative"] = False
    for step in (0, 1):
        _activate_step(
            edited,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            params=[0, 10_000.0, 10_000.0, 0.707, 1.0],
        )

    input_audio = _sine(STEP_FRAMES * 2, 5_000.0)
    schedule = _base_schedule(upload)
    schedule[STEP_FRAMES + 600] = [["event", "patternUpload", edited]]
    output = _render(generated_runtime, tmp_path, input_audio, schedule)

    pre_upload = slice(STEP_FRAMES + 120, STEP_FRAMES + 520)
    post_upload = slice(STEP_FRAMES + 1_800, STEP_FRAMES + 2_600)
    pre_dry_rms = _rms(input_audio[pre_upload, 0])
    post_dry_rms = _rms(input_audio[post_upload, 0])
    pre_wet_rms = _rms(output[pre_upload, 0])
    post_wet_rms = _rms(output[post_upload, 0])

    assert pre_wet_rms < pre_dry_rms * 0.35, (
        f"Low cutoff should suppress the 5 kHz input before upload; wet/dry RMS was {pre_wet_rms:.4f}/{pre_dry_rms:.4f}"
    )
    assert post_wet_rms > post_dry_rms * 0.65, (
        f"High cutoff should pass the 5 kHz input after upload; wet/dry RMS was {post_wet_rms:.4f}/{post_dry_rms:.4f}"
    )


def test_future_filter_upload_does_not_change_active_filter_block(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            params=[0, 220.0, 220.0, 0.707, 1.0],
        )

    future_edit = json.loads(json.dumps(upload))
    future_edit["revision"] = 2
    future_edit["authoritative"] = False
    _activate_step(
        future_edit,
        lane=LANE_FILTER,
        step=8,
        trigger=True,
        params=[0, 10_000.0, 10_000.0, 0.707, 1.0],
    )

    input_audio = _sine(STEP_FRAMES * 2, 5_000.0)
    baseline = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    schedule = _base_schedule(upload)
    schedule[STEP_FRAMES + 600] = [["event", "patternUpload", future_edit]]
    edited = _render(generated_runtime, tmp_path, input_audio, schedule)

    current_block_window = slice(STEP_FRAMES + 900, STEP_FRAMES + 2_600)
    assert _rms(edited[current_block_window, 0] - baseline[current_block_window, 0]) < 1.0e-6


def test_filter_effect_can_run_in_any_chain_not_only_the_old_filter_lane(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(
        upload,
        lane=LANE_TAPE,
        step=0,
        effect_type=EFFECT_FILTER,
        params=[0, 220.0, 220.0, 0.707, 1.0],
    )
    input_audio = _sine(STEP_FRAMES, 5_000.0)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    input_rms = float(np.sqrt(np.mean(input_audio[800:, 0] ** 2)))
    output_rms = float(np.sqrt(np.mean(output[800:, 0] ** 2)))
    assert output_rms < input_rms * 0.35


def test_serial_chain_order_is_chain_order_not_legacy_effect_order(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    serial_upload = _empty_upload()
    _activate_step(
        serial_upload,
        lane=0,
        step=0,
        effect_type=EFFECT_STUTTER,
        params=[5.0, 1.0, 0.0],
    )
    _activate_step(
        serial_upload,
        lane=1,
        step=0,
        effect_type=EFFECT_FILTER,
        params=[0.0, 720.0, 720.0, 0.707, 1.0],
    )
    _activate_step(
        serial_upload,
        lane=2,
        step=0,
        effect_type=EFFECT_CRUSHER,
        params=[5.0, 7.0, 8.0],
    )

    legacy_order_upload = _empty_upload()
    _activate_step(
        legacy_order_upload,
        lane=0,
        step=0,
        effect_type=EFFECT_FILTER,
        params=[0.0, 720.0, 720.0, 0.707, 1.0],
    )
    _activate_step(
        legacy_order_upload,
        lane=1,
        step=0,
        effect_type=EFFECT_CRUSHER,
        params=[5.0, 7.0, 8.0],
    )
    _activate_step(
        legacy_order_upload,
        lane=2,
        step=0,
        effect_type=EFFECT_STUTTER,
        params=[5.0, 1.0, 0.0],
    )

    input_audio = _complex_signal(STEP_FRAMES * 2)
    serial_output = _render(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(serial_upload),
    )
    legacy_order_output = _render(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(legacy_order_upload),
    )

    comparison_window = slice(STEP_FRAMES // 2, STEP_FRAMES * 2)
    assert _rms(serial_output[comparison_window] - input_audio[comparison_window]) > 0.02
    assert _rms(serial_output[comparison_window] - legacy_order_output[comparison_window]) > 0.01


@pytest.mark.parametrize(
    ("effect_type", "params_a", "params_b"),
    [
        (EFFECT_FILTER, [0.0, 360.0, 360.0, 0.707, 1.0], [1.0, 4_500.0, 4_500.0, 0.707, 1.0]),
        (EFFECT_TAPE, [0.7, 1.0, 1.0, 35.0, 0.0], [0.2, 1.8, 1.0, 50.0, 1.0]),
        (EFFECT_STUTTER, [6.0, 1.0, 0.0], [3.0, 1.0, 0.0]),
    ],
)
def test_time_based_and_stateful_effects_keep_state_per_chain(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    effect_type: int,
    params_a: list[float],
    params_b: list[float],
) -> None:
    baseline_upload = _empty_upload()
    dual_upload = _empty_upload()

    for step in (0, 1, 2):
        _activate_step(
            baseline_upload,
            lane=0,
            step=step,
            trigger=(step == 0),
            effect_type=effect_type,
            params=params_a,
        )
        _activate_step(
            dual_upload,
            lane=0,
            step=step,
            trigger=(step == 0),
            effect_type=effect_type,
            params=params_a,
        )

    _activate_step(
        dual_upload,
        lane=2,
        step=1,
        trigger=True,
        effect_type=effect_type,
        params=params_b,
    )

    input_audio = _complex_signal(STEP_FRAMES * 4)
    baseline_output = _render(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(baseline_upload),
    )
    dual_output = _render(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(dual_upload),
    )

    unaffected_late_window = slice((STEP_FRAMES * 2) + 700, (STEP_FRAMES * 3) - 200)
    assert _rms(dual_output[unaffected_late_window] - baseline_output[unaffected_late_window]) < 2.0e-5


def test_filter_envelope_uses_the_full_stretched_block_duration(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in range(4):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            params=[0, 220.0, 220.0, 0.707, 1.0],
        )
        _set_aux(upload, lane=LANE_FILTER, step=step, param=1, end=20_000.0, shape=1.0)

    input_audio = _sine(STEP_FRAMES * 4, 3_000.0)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    first_step_start = output[350:900, 0]
    fourth_step_start = output[(STEP_FRAMES * 3) + 350 : (STEP_FRAMES * 3) + 900, 0]
    first_rms = float(np.sqrt(np.mean(first_step_start**2)))
    fourth_rms = float(np.sqrt(np.mean(fourth_step_start**2)))

    assert fourth_rms > first_rms * 6.0


def test_tape_stop_lowers_zero_crossing_rate_during_active_block(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (1, 2, 3):
        _activate_step(upload, lane=LANE_TAPE, step=step, trigger=(step == 1), params=[1.0, 1.4, 1.0, 30.0])

    input_audio = _sine(STEP_FRAMES * 4, 660.0)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    early = output[STEP_FRAMES + 400 : STEP_FRAMES * 2, 0]
    late = output[(STEP_FRAMES * 3) - 1_400 : STEP_FRAMES * 3, 0]

    assert _zero_crossing_rate(late) < _zero_crossing_rate(early) * 0.72


def test_aux_envelope_modulates_tape_stop_start_length(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    aux_upload = _empty_upload()
    for step in (1, 2):
        _activate_step(
            upload,
            lane=LANE_TAPE,
            step=step,
            trigger=(step == 1),
            params=[1.0, 1.0, 1.0, 0.0, 0.0],
        )
        _activate_step(
            aux_upload,
            lane=LANE_TAPE,
            step=step,
            trigger=(step == 1),
            params=[1.0, 1.0, 1.0, 0.0, 0.0],
        )
        _set_aux(aux_upload, lane=LANE_TAPE, step=step, param=0, end=0.2)

    input_audio = _sine(STEP_FRAMES * 4, 660.0)
    baseline = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    modulated = _render(generated_runtime, tmp_path, input_audio, _base_schedule(aux_upload))
    comparison_window = slice(STEP_FRAMES + 1_000, (STEP_FRAMES * 2) - 200)
    delta = float(np.sqrt(np.mean((modulated[comparison_window] - baseline[comparison_window]) ** 2)))

    assert np.all(np.isfinite(modulated))
    assert delta > 0.04


def test_tape_stop_step_boundaries_do_not_click_on_exit_or_retrigger(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    def render_tape_steps(
        tape_steps: list[tuple[int, bool, list[float]]],
        case_name: str,
    ) -> np.ndarray:
        case_path = tmp_path / case_name
        case_path.mkdir()
        upload = _empty_upload()
        for step, trigger, params in tape_steps:
            _activate_step(upload, lane=LANE_TAPE, step=step, trigger=trigger, params=params)

        return _render(
            generated_runtime,
            case_path,
            _sine(STEP_FRAMES * 5, 660.0),
            _base_schedule(upload),
        )[:, 0]

    def largest_boundary_jump(samples: np.ndarray, boundary_step: int) -> float:
        boundary = STEP_FRAMES * boundary_step
        window = samples[boundary - 16 : boundary + 16]
        return float(np.max(np.abs(np.diff(window))))

    dry = _sine(STEP_FRAMES * 5, 660.0)[:, 0]
    allowed_jump = float(np.max(np.abs(np.diff(dry)))) * 1.5
    stop_params = [1.0, 1.0, 1.0, 25.0, 0.0]
    spin_up_params = [1.0, 1.0, 1.0, 25.0, 1.0]

    stop_exit = render_tape_steps([(1, True, stop_params)], "stop_exit")
    spin_up_exit = render_tape_steps([(1, True, spin_up_params)], "spin_up_exit")
    adjacent_retrigger = render_tape_steps(
        [(1, True, stop_params), (2, True, stop_params)],
        "adjacent_retrigger",
    )

    assert largest_boundary_jump(stop_exit, 2) <= allowed_jump
    assert largest_boundary_jump(spin_up_exit, 2) <= allowed_jump
    assert largest_boundary_jump(adjacent_retrigger, 2) <= allowed_jump
    assert largest_boundary_jump(adjacent_retrigger, 3) <= allowed_jump


def test_adjacent_different_effects_in_one_chain_do_not_create_a_step_boundary_click(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(
        upload,
        lane=0,
        step=0,
        trigger=True,
        effect_type=EFFECT_FILTER,
        params=[0.0, 850.0, 850.0, 0.707, 1.0],
    )
    _activate_step(
        upload,
        lane=0,
        step=1,
        trigger=False,
        effect_type=EFFECT_TAPE,
        params=[0.8, 1.0, 1.0, 25.0, 0.0],
    )

    input_audio = _sine(STEP_FRAMES * 3, 660.0)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))[:, 0]
    dry = input_audio[:, 0]
    allowed_jump = float(np.max(np.abs(np.diff(dry)))) * 1.75

    assert _largest_boundary_jump(output, 1) <= allowed_jump
    assert _largest_boundary_jump(output, 2) <= allowed_jump


def test_tape_stop_catchup_does_not_play_faster_than_dry_timeline(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (1, 2, 3, 4):
        _activate_step(
            upload,
            lane=LANE_TAPE,
            step=step,
            trigger=(step == 1),
            params=[0.25, 1.0, 1.0, 50.0, 0.0],
        )

    input_audio = _sine(STEP_FRAMES * 6, 660.0)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    catchup_window = slice((STEP_FRAMES * 3) + 400, (STEP_FRAMES * 4) + 2_400)
    output_zcr = _zero_crossing_rate(output[catchup_window, 0])
    dry_zcr = _zero_crossing_rate(input_audio[catchup_window, 0])

    assert output_zcr <= dry_zcr * 1.15

    stop_window = slice((STEP_FRAMES * 2) + 300, (STEP_FRAMES * 2) + 1_200)
    end_window = slice((STEP_FRAMES * 5) - 600, (STEP_FRAMES * 5) - 120)
    stop_error = float(np.sqrt(np.mean((output[stop_window] - input_audio[stop_window]) ** 2)))
    end_error = float(np.sqrt(np.mean((output[end_window] - input_audio[end_window]) ** 2)))

    assert stop_error > 0.15
    assert end_error < stop_error * 0.25


def test_stutter_repeats_the_captured_slice(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (2, 3):
        _activate_step(upload, lane=LANE_STUTTER, step=step, trigger=(step == 2), params=[4.0, 1.0, 0.0, 1.0])

    frames = STEP_FRAMES * 4
    t = np.arange(frames, dtype=np.float64) / SAMPLE_RATE
    mono = (0.15 + (0.7 * (np.arange(frames) / frames))) * np.sin(2.0 * np.pi * (220.0 + 45.0 * t) * t)
    input_audio = np.column_stack([mono, mono]).astype(np.float32)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    slice_frames = (STEP_FRAMES * 2) // 4
    window = slice(120, 1_200)
    first_loop = output[(STEP_FRAMES * 2) + window.start : (STEP_FRAMES * 2) + window.stop, 0]
    second_loop = output[(STEP_FRAMES * 2) + slice_frames + window.start : (STEP_FRAMES * 2) + slice_frames + window.stop, 0]

    difference = float(np.sqrt(np.mean((first_loop - second_loop) ** 2)))
    reference = float(np.sqrt(np.mean(first_loop**2)))
    assert difference < reference * 0.12


def test_stutter_gate_shortens_each_repeated_cut(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_STUTTER,
            step=step,
            trigger=(step == 0),
            params=[4.0, 1.0, 0.0, 0.35],
        )

    frames = STEP_FRAMES * 3
    n = np.arange(frames, dtype=np.float64)
    mono = (
        0.45 * np.sin(2.0 * np.pi * 330.0 * n / SAMPLE_RATE)
        + 0.16 * np.sin(2.0 * np.pi * 1_100.0 * n / SAMPLE_RATE)
    ).astype(np.float32)
    input_audio = np.column_stack([mono, mono]).astype(np.float32)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    slice_frames = (STEP_FRAMES * 2) // 4
    repeat_start = slice_frames
    early_window = output[repeat_start + 80 : repeat_start + 420, 0]
    gated_window = output[repeat_start + int(slice_frames * 0.55) : repeat_start + int(slice_frames * 0.75), 0]

    early_rms = float(np.sqrt(np.mean(early_window**2)))
    gated_rms = float(np.sqrt(np.mean(gated_window**2)))

    assert early_rms > 0.15
    assert gated_rms < early_rms * 0.18


def test_stutter_shape_changes_the_rendered_repeat_envelope(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    def render_shape(shape: float) -> np.ndarray:
        upload = _empty_upload()
        for step in (0, 1):
            _activate_step(
                upload,
                lane=LANE_STUTTER,
                step=step,
                trigger=(step == 0),
                params=[4.0, 1.0, shape, 1.0],
            )

        return _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    frames = STEP_FRAMES * 3
    n = np.arange(frames, dtype=np.float64)
    mono = (
        0.42 * np.sin(2.0 * np.pi * 330.0 * n / SAMPLE_RATE)
        + 0.18 * np.sin(2.0 * np.pi * 970.0 * n / SAMPLE_RATE)
    ).astype(np.float32)
    input_audio = np.column_stack([mono, mono]).astype(np.float32)

    gate_output = render_shape(0.0)
    triangle_output = render_shape(0.25)

    slice_frames = (STEP_FRAMES * 2) // 4
    repeat_start = slice_frames
    attack_window = slice(repeat_start + 120, repeat_start + 480)
    middle_window = slice(repeat_start + int(slice_frames * 0.42), repeat_start + int(slice_frames * 0.58))

    gate_attack_rms = float(np.sqrt(np.mean(gate_output[attack_window, 0] ** 2)))
    triangle_attack_rms = float(np.sqrt(np.mean(triangle_output[attack_window, 0] ** 2)))
    gate_middle_rms = float(np.sqrt(np.mean(gate_output[middle_window, 0] ** 2)))
    triangle_middle_rms = float(np.sqrt(np.mean(triangle_output[middle_window, 0] ** 2)))
    envelope_delta = float(np.sqrt(np.mean((gate_output[attack_window, 0] - triangle_output[attack_window, 0]) ** 2)))

    assert gate_attack_rms > 0.12
    assert triangle_attack_rms < gate_attack_rms * 0.72
    assert triangle_middle_rms > gate_middle_rms * 0.75
    assert envelope_delta > gate_attack_rms * 0.25


def test_stutter_gate_to_triangle_segment_forms_a_trapezoid_before_triangle(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    def render_shape(shape: float) -> np.ndarray:
        upload = _empty_upload()
        for step in (0, 1):
            _activate_step(
                upload,
                lane=LANE_STUTTER,
                step=step,
                trigger=(step == 0),
                params=[4.0, 1.0, shape, 1.0],
            )

        return _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    slice_frames = (STEP_FRAMES * 2) // 4
    frames = STEP_FRAMES * 3
    mono = np.zeros(frames, dtype=np.float32)
    mono[:slice_frames] = 0.5
    input_audio = np.column_stack([mono, mono]).astype(np.float32)

    trapezoid_output = render_shape(0.125)
    triangle_output = render_shape(0.25)

    repeat_start = slice_frames

    def sample_mean(samples: np.ndarray, phase: float) -> float:
        center = repeat_start + int(slice_frames * phase)
        window = samples[center - 8 : center + 8, 0]
        return float(np.mean(window))

    assert abs(sample_mean(trapezoid_output, 0.1) - 0.2) <= 0.03
    assert abs(sample_mean(trapezoid_output, 0.3) - 0.5) <= 0.03
    assert abs(sample_mean(trapezoid_output, 0.7) - 0.5) <= 0.03
    assert abs(sample_mean(trapezoid_output, 0.8) - 0.4) <= 0.03
    assert sample_mean(triangle_output, 0.3) < sample_mean(trapezoid_output, 0.3) * 0.75


def test_stutter_capture_output_keeps_a_raw_attack_but_matches_the_repeat_release_tail(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_STUTTER,
            step=step,
            trigger=(step == 0),
            params=[4.0, 1.0, 0.25, 1.0],
        )

    slice_frames = (STEP_FRAMES * 2) // 4
    frames = STEP_FRAMES * 3
    mono = np.zeros(frames, dtype=np.float32)
    mono[:slice_frames] = 0.5
    input_audio = np.column_stack([mono, mono]).astype(np.float32)

    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    capture_start = 0
    repeat_start = slice_frames

    def sample_mean(start_frame: int, phase: float) -> float:
        center = start_frame + int(slice_frames * phase)
        window = output[center - 8 : center + 8, 0]
        return float(np.mean(window))

    capture_attack = sample_mean(capture_start, 0.25)
    capture_release = sample_mean(capture_start, 0.75)
    repeat_attack = sample_mean(repeat_start, 0.25)
    repeat_release = sample_mean(repeat_start, 0.75)

    assert abs(capture_attack - 0.5) <= 0.03
    assert abs(repeat_attack - 0.25) <= 0.03
    assert abs(capture_release - 0.25) <= 0.03
    assert abs(repeat_release - 0.25) <= 0.03
    assert abs(capture_release - repeat_release) <= 0.02


def test_stutter_capture_release_tail_respects_the_current_gate_length(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_STUTTER,
            step=step,
            trigger=(step == 0),
            params=[4.0, 1.0, 0.25, 0.6],
        )

    slice_frames = (STEP_FRAMES * 2) // 4
    frames = STEP_FRAMES * 3
    mono = np.zeros(frames, dtype=np.float32)
    mono[:slice_frames] = 0.5
    input_audio = np.column_stack([mono, mono]).astype(np.float32)

    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    capture_start = 0
    repeat_start = slice_frames

    def sample_mean(start_frame: int, phase: float) -> float:
        center = start_frame + int(slice_frames * phase)
        window = output[center - 8 : center + 8, 0]
        return float(np.mean(window))

    capture_before_release = sample_mean(capture_start, 0.2)
    capture_release = sample_mean(capture_start, 0.4)
    capture_after_gate = sample_mean(capture_start, 0.7)
    repeat_release = sample_mean(repeat_start, 0.4)

    assert abs(capture_before_release - 0.5) <= 0.03
    assert abs(capture_release - (1.0 / 3.0)) <= 0.04
    assert abs(repeat_release - (1.0 / 3.0)) <= 0.04
    assert abs(capture_release - repeat_release) <= 0.02
    assert abs(capture_after_gate) <= 0.03


def test_stutter_capture_release_tail_tracks_faster_repeat_timing(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_STUTTER,
            step=step,
            trigger=(step == 0),
            params=[4.0, 2.0, 0.25, 1.0],
        )

    slice_frames = (STEP_FRAMES * 2) // 4
    frames = STEP_FRAMES * 3
    mono = np.zeros(frames, dtype=np.float32)
    mono[:slice_frames] = 0.5
    input_audio = np.column_stack([mono, mono]).astype(np.float32)

    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    capture_start = 0
    repeat_start = slice_frames

    def sample_mean(start_frame: int, phase: float) -> float:
        center = start_frame + int(slice_frames * phase)
        window = output[center - 8 : center + 8, 0]
        return float(np.mean(window))

    capture_attack = sample_mean(capture_start, 0.125)
    capture_release = sample_mean(capture_start, 0.375)
    capture_after_gate = sample_mean(capture_start, 0.48)
    repeat_release = sample_mean(repeat_start, 0.375)
    repeat_after_gate = sample_mean(repeat_start, 0.48)

    assert abs(capture_attack - 0.5) <= 0.03
    assert abs(capture_release - 0.25) <= 0.03
    assert abs(repeat_release - 0.25) <= 0.03
    assert abs(capture_release - repeat_release) <= 0.02
    assert abs(capture_after_gate - repeat_after_gate) <= 0.02
    assert abs(capture_after_gate) <= 0.06
    assert abs(repeat_after_gate) <= 0.06


def test_stutter_live_upload_keeps_repeating_and_updates_envelope(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    def upload_with_envelope(*, revision: int, shape: float, gate: float) -> dict[str, object]:
        upload = _empty_upload(revision=revision)
        for step in (0, 1):
            _activate_step(
                upload,
                lane=LANE_STUTTER,
                step=step,
                trigger=(step == 0),
                params=[4.0, 1.0, shape, gate],
            )
        return upload

    slice_frames = (STEP_FRAMES * 2) // 4
    frames = STEP_FRAMES * 3
    mono = np.zeros(frames, dtype=np.float32)
    n = np.arange(slice_frames, dtype=np.float64)
    captured_slice = (
        0.42 * np.sin(2.0 * np.pi * 330.0 * n / SAMPLE_RATE)
        + 0.18 * np.sin(2.0 * np.pi * 970.0 * n / SAMPLE_RATE)
    ).astype(np.float32)
    mono[:slice_frames] = captured_slice
    input_audio = np.column_stack([mono, mono]).astype(np.float32)

    schedule = _base_schedule(upload_with_envelope(revision=1, shape=0.0, gate=1.0))
    schedule[STEP_FRAMES + 300] = [
        ["event", "patternUpload", upload_with_envelope(revision=2, shape=0.25, gate=0.45)]
    ]

    output = _render(generated_runtime, tmp_path, input_audio, schedule)

    live_attack_window = output[STEP_FRAMES + 420 : STEP_FRAMES + 620, 0]
    live_gated_window = output[STEP_FRAMES + 850 : STEP_FRAMES + 1_100, 0]
    dry_attack_window = input_audio[STEP_FRAMES + 420 : STEP_FRAMES + 620, 0]

    live_attack_rms = float(np.sqrt(np.mean(live_attack_window**2)))
    live_gated_rms = float(np.sqrt(np.mean(live_gated_window**2)))
    dry_attack_rms = float(np.sqrt(np.mean(dry_attack_window**2)))

    assert dry_attack_rms < 0.001
    assert live_attack_rms > 0.08
    assert live_gated_rms < live_attack_rms * 0.35


def test_aux_envelope_sweeps_stutter_gate_without_restart(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_STUTTER,
            step=step,
            trigger=(step == 0),
            params=[4.0, 1.0, 0.0, 1.0],
        )
        _set_aux(upload, lane=LANE_STUTTER, step=step, param=3, end=0.25)

    frames = STEP_FRAMES * 3
    n = np.arange(frames, dtype=np.float64)
    mono = (
        0.45 * np.sin(2.0 * np.pi * 330.0 * n / SAMPLE_RATE)
        + 0.16 * np.sin(2.0 * np.pi * 1_100.0 * n / SAMPLE_RATE)
    ).astype(np.float32)
    input_audio = np.column_stack([mono, mono]).astype(np.float32)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    slice_frames = (STEP_FRAMES * 2) // 4
    early_repeat_start = slice_frames
    late_repeat_start = STEP_FRAMES + slice_frames
    early_tail = output[early_repeat_start + 840 : early_repeat_start + 990, 0]
    late_tail = output[late_repeat_start + 840 : late_repeat_start + 990, 0]
    early_head = output[early_repeat_start + 70 : early_repeat_start + 200, 0]
    late_head = output[late_repeat_start + 70 : late_repeat_start + 200, 0]

    assert _rms(early_head) > 0.08
    assert _rms(late_head) > 0.08
    assert _rms(late_tail) < _rms(early_tail) * 0.45


def test_aux_envelope_stutter_slices_down_sweep_stays_inside_capture(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_STUTTER,
            step=step,
            trigger=(step == 0),
            params=[32.0, 1.0, 0.0, 1.0],
        )
        _set_aux(upload, lane=LANE_STUTTER, step=step, param=0, end=2.0)

    frames = STEP_FRAMES * 3
    mono = np.zeros(frames, dtype=np.float32)
    n = np.arange(STEP_FRAMES, dtype=np.float64)
    mono[:STEP_FRAMES] = (
        0.45 * np.sin(2.0 * np.pi * 300.0 * n / SAMPLE_RATE)
        + 0.15 * np.sin(2.0 * np.pi * 900.0 * n / SAMPLE_RATE)
    ).astype(np.float32)
    input_audio = np.column_stack([mono, mono]).astype(np.float32)

    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    late_repeat = output[STEP_FRAMES + 1_500 : STEP_FRAMES + 2_400, 0]

    assert np.all(np.isfinite(output))
    assert _rms(late_repeat) > 0.05


def test_stutter_captures_first_slice_when_transport_starts_on_the_block(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(upload, lane=LANE_STUTTER, step=0, trigger=True, params=[8.0, 1.0, 0.0, 1.0])

    slice_frames = STEP_FRAMES // 8
    frames = STEP_FRAMES * 2
    mono = np.zeros(frames, dtype=np.float32)
    n = np.arange(slice_frames, dtype=np.float64)
    captured_slice = (
        0.42 * np.sin(2.0 * np.pi * 330.0 * n / SAMPLE_RATE)
        + 0.18 * np.sin(2.0 * np.pi * 970.0 * n / SAMPLE_RATE)
    ).astype(np.float32)
    mono[:slice_frames] = captured_slice
    input_audio = np.column_stack([mono, mono]).astype(np.float32)

    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    window_start = 80
    window_end = 250
    original_window = captured_slice[window_start:window_end]
    first_repeat = output[slice_frames + window_start : slice_frames + window_end, 0]
    second_repeat = output[(slice_frames * 2) + window_start : (slice_frames * 2) + window_end, 0]

    original_rms = float(np.sqrt(np.mean(original_window**2)))
    assert original_rms > 0.2
    assert float(np.sqrt(np.mean(first_repeat**2))) > original_rms * 0.8
    assert float(np.sqrt(np.mean(second_repeat**2))) > original_rms * 0.8
    assert float(np.sqrt(np.mean((first_repeat - original_window) ** 2))) < original_rms * 0.18
    assert float(np.sqrt(np.mean((second_repeat - original_window) ** 2))) < original_rms * 0.18


def test_future_step_upload_does_not_restart_current_time_effect(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(upload, lane=LANE_STUTTER, step=0, trigger=True, params=[8.0, 1.0, 0.0])

    future_edit = json.loads(json.dumps(upload))
    future_edit["revision"] = 2
    future_edit["authoritative"] = False
    _activate_step(
        future_edit,
        lane=LANE_FILTER,
        step=12,
        trigger=True,
        effect_type=EFFECT_FILTER,
        params=[0.0, 600.0, 600.0, 0.707, 1.0],
    )

    frames = STEP_FRAMES * 2
    mono = np.linspace(-0.8, 0.8, frames, dtype=np.float32)
    input_audio = np.column_stack([mono, mono]).astype(np.float32)
    baseline = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    schedule = _base_schedule(upload)
    schedule[1_000] = [["event", "patternUpload", future_edit]]
    edited = _render(generated_runtime, tmp_path, input_audio, schedule)

    assert float(np.max(np.abs(edited - baseline))) < 1.0e-6


def test_stutter_captures_first_slice_even_when_block_start_mix_is_zero(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(upload, lane=LANE_STUTTER, step=0, trigger=True, mix=0.0, params=[4.0, 1.0, 0.0, 1.0])
    _activate_step(upload, lane=LANE_STUTTER, step=1, trigger=False, mix=1.0, params=[4.0, 1.0, 0.0, 1.0])

    slice_frames = (STEP_FRAMES * 2) // 4
    frames = STEP_FRAMES * 3
    mono = np.zeros(frames, dtype=np.float32)
    n = np.arange(slice_frames, dtype=np.float64)
    captured_slice = (
        0.45 * np.sin(2.0 * np.pi * 290.0 * n / SAMPLE_RATE)
        + 0.12 * np.sin(2.0 * np.pi * 1_030.0 * n / SAMPLE_RATE)
    ).astype(np.float32)
    mono[:slice_frames] = captured_slice
    input_audio = np.column_stack([mono, mono]).astype(np.float32)

    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    window_start = 180
    window_end = 820
    original_window = captured_slice[window_start:window_end]
    audible_repeat = output[STEP_FRAMES + window_start : STEP_FRAMES + window_end, 0]

    original_rms = float(np.sqrt(np.mean(original_window**2)))
    assert original_rms > 0.2
    assert float(np.sqrt(np.mean(audible_repeat**2))) > original_rms * 0.8
    assert float(np.sqrt(np.mean((audible_repeat - original_window) ** 2))) < original_rms * 0.18
