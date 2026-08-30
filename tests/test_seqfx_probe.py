from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter

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
EFFECT_PITCH = 5
EFFECT_COMB = 6
EFFECT_RING = 7
EFFECT_REVERSE = 8
EFFECT_TALK_BOX = 9
EFFECT_VIBRO = 10
EFFECT_FLANGE = 11
EFFECT_DIRTY = 12
LIFECYCLE_IDLE = 0
LIFECYCLE_ENTERING = 1
LIFECYCLE_ACTIVE = 2
LIFECYCLE_RELEASED = 3
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
    *,
    sample_rate: int = SAMPLE_RATE,
) -> np.ndarray:
    return _render_with_monitor_events(
        generated_runtime,
        tmp_path,
        input_audio,
        schedule,
        sample_rate=sample_rate,
    )[0]


def _render_with_monitor_events(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    input_audio: np.ndarray,
    schedule: dict[int, list[list[object]]],
    *,
    sample_rate: int = SAMPLE_RATE,
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
            str(sample_rate),
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


def _sine_at_rate(frames: int, frequency: float, sample_rate: int, amplitude: float = 0.55) -> np.ndarray:
    t = np.arange(frames, dtype=np.float64) / sample_rate
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


def _tape_v2_params(
    *,
    stop_division: int = 8,
    curve: float = 0.0,
    return_mode: int = 0,
    start_division: int = 1,
    character: float = 0.0,
    timing_mode: int = 0,
    free_stop_ms: float = 500.0,
    free_start_ms: float = 125.0,
) -> list[float]:
    return [
        float(stop_division),
        curve,
        float(return_mode),
        float(start_division),
        character,
        float(timing_mode),
        free_stop_ms,
        free_start_ms,
    ]


def _rms(samples: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.asarray(samples, dtype=np.float64) ** 2)))


def _tone_amplitude(samples: np.ndarray, frequency: float, sample_rate: int = SAMPLE_RATE) -> float:
    signal = np.asarray(samples, dtype=np.float64)
    phase = np.arange(signal.size, dtype=np.float64) * (2.0 * np.pi * frequency / sample_rate)
    projection = np.sum(signal * np.exp(-1j * phase))
    return float(2.0 * np.abs(projection) / max(1, signal.size))


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


def test_chain_lifecycle_reports_enter_active_release_and_idle(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(
        upload,
        lane=LANE_FILTER,
        step=0,
        trigger=True,
        params=[0.0, 800.0, 800.0, 0.707, 1.0],
    )
    input_audio = np.zeros((STEP_FRAMES * 2, 2), dtype=np.float32)
    _output, monitors = _render_with_monitor_events(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(upload),
    )

    states_by_step: dict[int, list[int]] = {}
    effect_types_by_step: dict[int, list[int]] = {}
    for monitor in monitors:
        value = monitor["value"]
        assert isinstance(value, dict)
        event = value["event"]
        assert isinstance(event, dict)
        step = int(event["stepIndex"])
        states_by_step.setdefault(step, []).append(int(event["lifecycleState"][LANE_FILTER]))
        effect_types_by_step.setdefault(step, []).append(int(event["effectType"][LANE_FILTER]))

    assert LIFECYCLE_ENTERING in states_by_step[0]
    assert LIFECYCLE_ACTIVE in states_by_step[0]
    assert EFFECT_FILTER in effect_types_by_step[0]
    assert LIFECYCLE_RELEASED in states_by_step[1]
    assert LIFECYCLE_IDLE in states_by_step[1]
    assert EFFECT_EMPTY in effect_types_by_step[1]


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
    _activate_step(upload, lane=LANE_CRUSHER, step=0, params=[4, 6_000, 0, 1, 0, 0, 0])
    _activate_step(upload, lane=LANE_CRUSHER, step=1, params=[16, 48_000, 0, 1, 0, 0, 0])
    input_audio = _ramp(STEP_FRAMES * 2)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    first_step = np.round(output[400 : STEP_FRAMES - 400, 0], 3)
    second_step = np.round(output[STEP_FRAMES + 400 : (STEP_FRAMES * 2) - 400, 0], 3)

    assert np.unique(first_step).size < 20
    assert np.unique(second_step).size > np.unique(first_step).size * 6


@pytest.mark.parametrize("sample_rate", [48_000, 96_000])
def test_crush_rate_hz_keeps_the_same_capture_frequency_across_host_sample_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_CRUSHER,
            step=step,
            trigger=step == 0,
            params=[16, 12_000, 0, 1, 0, 0, 0],
        )
    frames = sample_rate // 10
    input_audio = _sine_at_rate(frames, 997.0, sample_rate)
    output = _render(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(upload),
        sample_rate=sample_rate,
    )
    observed_transitions = int(np.count_nonzero(np.abs(np.diff(output[512:, 0])) > 1.0e-5))
    expected_transitions = ((frames - 512) / sample_rate) * 12_000

    assert abs(observed_transitions - expected_transitions) < expected_transitions * 0.04


def test_crush_original_mode_matches_the_legacy_48_khz_hold_and_quantizer(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_CRUSHER,
            step=step,
            trigger=step == 0,
            params=[6, 12_000, 12, 0, 0, 0, 0],
        )
    input_audio = _ramp(5_000)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    levels = (2 ** (6 - 1)) - 1
    drive = 10 ** (12 / 20)
    expected = np.empty(5_000, dtype=np.float64)
    held = 0.0
    counter = 0
    mix = 0.0
    for index, dry in enumerate(input_audio[:, 0].astype(np.float64)):
        clipped = np.clip(np.clip(dry, -1.0, 1.0) * drive, -1.0, 1.0)
        if counter <= 0:
            held = clipped
            counter = 4
        counter -= 1
        quantized = np.copysign(np.floor(abs(held * levels) + 0.5) / levels, held)
        mix = min(1.0, mix + (1.0 / 64.0))
        expected[index] = dry + ((quantized - dry) * mix)

    np.testing.assert_allclose(output[:, 0], expected, atol=2.0e-6, rtol=0.0)


def test_crush_smooth_character_interpolates_between_captures_instead_of_stair_stepping(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    classic_upload = _empty_upload()
    smooth_upload = _empty_upload()
    for upload, character in ((classic_upload, 1), (smooth_upload, 2)):
        for step in (0, 1):
            _activate_step(
                upload,
                lane=LANE_CRUSHER,
                step=step,
                trigger=step == 0,
                params=[12, 2_000, 0, character, 0, 0, 0],
            )

    input_audio = _sine(5_000, 733.0)
    classic_path = tmp_path / "classic"
    smooth_path = tmp_path / "smooth"
    classic_path.mkdir()
    smooth_path.mkdir()
    classic = _render(generated_runtime, classic_path, input_audio, _base_schedule(classic_upload))[512:, 0]
    smooth = _render(generated_runtime, smooth_path, input_audio, _base_schedule(smooth_upload))[512:, 0]
    classic_diff = np.abs(np.diff(classic))
    smooth_diff = np.abs(np.diff(smooth))

    assert float(np.max(smooth_diff)) < float(np.max(classic_diff)) * 0.35
    assert float(np.mean(smooth_diff > 1.0e-5)) > float(np.mean(classic_diff > 1.0e-5)) * 8


def test_crush_dither_is_repeatable_and_decorrelates_low_level_quantization_error(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    clean_upload = _empty_upload()
    dither_upload = _empty_upload()
    for upload, dither in ((clean_upload, 0.0), (dither_upload, 1.0)):
        for step in (0, 1):
            _activate_step(
                upload,
                lane=LANE_CRUSHER,
                step=step,
                trigger=step == 0,
                params=[4, 48_000, 0, 1, 0, 0, dither],
            )

    input_audio = _sine(5_000, 997.0, amplitude=0.02)
    clean_path = tmp_path / "clean"
    dither_a_path = tmp_path / "dither-a"
    dither_b_path = tmp_path / "dither-b"
    clean_path.mkdir()
    dither_a_path.mkdir()
    dither_b_path.mkdir()
    clean = _render(generated_runtime, clean_path, input_audio, _base_schedule(clean_upload))
    dither_a = _render(generated_runtime, dither_a_path, input_audio, _base_schedule(dither_upload))
    dither_b = _render(generated_runtime, dither_b_path, input_audio, _base_schedule(dither_upload))
    window = slice(512, 4_800)
    dry = input_audio[window, 0]
    clean_error = clean[window, 0] - dry
    dither_error = dither_a[window, 0] - dry
    clean_correlation = abs(float(np.corrcoef(dry, clean_error)[0, 1]))
    dither_correlation = abs(float(np.corrcoef(dry, dither_error)[0, 1]))

    np.testing.assert_array_equal(dither_a, dither_b)
    assert _rms(dither_error) > _rms(clean_error)
    assert dither_correlation < clean_correlation * 0.8


def test_crush_dither_sequence_restarts_on_authoritative_processing_reset(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(
        upload,
        lane=LANE_CRUSHER,
        step=0,
        trigger=True,
        params=[4, 48_000, 0, 1, 0, 0, 1],
    )
    segment = _sine(4_000, 997.0, amplitude=0.02)
    input_audio = np.concatenate((segment, segment), axis=0)
    schedule = _base_schedule(upload)
    schedule[4_000] = [["event", "internalReset", 1]]
    output = _render(generated_runtime, tmp_path, input_audio, schedule)

    np.testing.assert_array_equal(output[512:3_500], output[4_512:7_500])


def test_crush_adc_and_dac_quality_tame_alias_energy_at_low_capture_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    raw_upload = _empty_upload()
    filtered_upload = _empty_upload()
    for upload, quality in ((raw_upload, 0.0), (filtered_upload, 1.0)):
        for step in (0, 1):
            _activate_step(
                upload,
                lane=LANE_CRUSHER,
                step=step,
                trigger=step == 0,
                params=[16, 4_000, 0, 1, quality, quality, 0],
            )

    input_audio = _sine(5_000, 10_000.0)
    raw_path = tmp_path / "raw"
    filtered_path = tmp_path / "filtered"
    raw_path.mkdir()
    filtered_path.mkdir()
    raw = _render(generated_runtime, raw_path, input_audio, _base_schedule(raw_upload))[1_000:4_800, 0]
    filtered = _render(generated_runtime, filtered_path, input_audio, _base_schedule(filtered_upload))[1_000:4_800, 0]

    assert _rms(filtered) < _rms(raw) * 0.45


def test_crush_progressive_character_is_distinct_finite_and_dc_bounded(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    classic_upload = _empty_upload()
    progressive_upload = _empty_upload()
    for upload, character in ((classic_upload, 1), (progressive_upload, 3)):
        for step in range(4):
            _activate_step(
                upload,
                lane=LANE_CRUSHER,
                step=step,
                trigger=step == 0,
                params=[5, 6_000, 0, character, 0, 0, 0],
            )

    input_audio = _sine(STEP_FRAMES * 4, 733.0)
    classic_path = tmp_path / "classic"
    progressive_path = tmp_path / "progressive"
    classic_path.mkdir()
    progressive_path.mkdir()
    classic = _render(generated_runtime, classic_path, input_audio, _base_schedule(classic_upload))
    progressive = _render(generated_runtime, progressive_path, input_audio, _base_schedule(progressive_upload))
    window = slice(1_000, (STEP_FRAMES * 4) - 500)

    assert np.all(np.isfinite(progressive))
    assert float(np.max(np.abs(progressive))) <= 1.21
    assert abs(float(np.mean(progressive[window, 0]))) < 0.02
    assert _rms(progressive[window] - classic[window]) > 0.03


def test_live_crusher_rate_upload_changes_active_continuation_without_retrigger(
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
            params=[16, 48_000, 0, 1, 0, 0, 0],
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
            params=[16, 750, 0, 1, 0, 0, 0],
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
        f"Rate=48 kHz should not create a staircase before the upload; held fraction was {pre_held_fraction:.3f}"
    )
    assert post_held_fraction > 0.80, (
        f"Rate=750 Hz should create a staircase immediately after the upload; held fraction was {post_held_fraction:.3f}"
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
            params=[16, 48_000, 0, 1, 0, 0, 0],
        )

    edited = json.loads(json.dumps(upload))
    edited["revision"] = 2
    edited["authoritative"] = False
    _activate_step(
        edited,
        lane=LANE_CRUSHER,
        step=0,
        trigger=True,
        params=[4, 48_000, 0, 1, 0, 0, 0],
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
            params=[16, 48_000, 0, 1, 0, 0, 0],
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


def test_aux_envelope_sweeps_crusher_rate_across_the_full_block(
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
            params=[16, 48_000, 0, 1, 0, 0, 0],
        )
        _set_aux(upload, lane=LANE_CRUSHER, step=step, param=1, end=200)

    input_audio = _ramp(STEP_FRAMES * 4)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    early = np.round(output[400:1_400, 0], 6)
    late = np.round(output[(STEP_FRAMES * 3) + 1_000 : (STEP_FRAMES * 3) + 2_000, 0], 6)
    early_change_rate = float(np.count_nonzero(np.diff(early)) / max(1, early.size - 1))
    late_change_rate = float(np.count_nonzero(np.diff(late)) / max(1, late.size - 1))

    assert early_change_rate > late_change_rate * 6


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
                params=[16, 48_000, 0, 1, 0, 0, 0],
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
            params=[16, 48_000, 0, 1, 0, 0, 0],
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
            params=[16, 48_000, 0, 1, 0, 0, 0],
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
            params=[16, 48_000, 0, 1, 0, 0, 0],
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
            params=[16, 48_000, 0, 1, 0, 0, 0],
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
    _activate_step(upload, lane=LANE_CRUSHER, step=0, params=[4, 4_000, 12.0, 1, 0, 0, 0])
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
        (
            EFFECT_TAPE,
            _tape_v2_params(timing_mode=1, free_stop_ms=500.0),
            _tape_v2_params(timing_mode=1, free_stop_ms=20.0),
        ),
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


def test_one_cell_tape_stop_can_finish_a_one_beat_gesture_after_its_block(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(
        upload,
        lane=LANE_TAPE,
        step=1,
        trigger=True,
        params=_tape_v2_params(stop_division=3),
    )

    frames = 18_000
    input_audio = np.zeros((frames, 2), dtype=np.float32)
    input_audio[: STEP_FRAMES * 2] = _sine(STEP_FRAMES * 2, 660.0)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    assert _rms(input_audio[6_000:6_300, 0]) < 1.0e-6
    assert _rms(output[6_000:6_300, 0]) > 0.08


def test_tape_stop_lowers_zero_crossing_rate_during_active_block(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (1, 2, 3):
        _activate_step(
            upload,
            lane=LANE_TAPE,
            step=step,
            trigger=(step == 1),
            params=_tape_v2_params(stop_division=2, curve=0.35),
        )

    input_audio = _sine(STEP_FRAMES * 4, 660.0)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    early = output[STEP_FRAMES + 400 : STEP_FRAMES * 2, 0]
    late = output[(STEP_FRAMES * 3) - 1_400 : STEP_FRAMES * 3, 0]

    assert _zero_crossing_rate(late) < _zero_crossing_rate(early) * 0.72


def test_tape_stop_time_is_trigger_latched_and_ignores_mid_gesture_aux_motion(
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
            params=_tape_v2_params(stop_division=2),
        )
        _activate_step(
            aux_upload,
            lane=LANE_TAPE,
            step=step,
            trigger=(step == 1),
            params=_tape_v2_params(stop_division=2),
        )
        _set_aux(aux_upload, lane=LANE_TAPE, step=step, param=0, end=7.0)

    input_audio = _sine(STEP_FRAMES * 4, 660.0)
    baseline = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    modulated = _render(generated_runtime, tmp_path, input_audio, _base_schedule(aux_upload))
    comparison_window = slice(STEP_FRAMES + 1_000, (STEP_FRAMES * 2) - 200)
    assert np.all(np.isfinite(modulated))
    np.testing.assert_allclose(modulated[comparison_window], baseline[comparison_window], atol=1.0e-6, rtol=0.0)


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
    stop_params = _tape_v2_params(stop_division=8, return_mode=0)
    spin_up_params = _tape_v2_params(stop_division=8, return_mode=1, start_division=8)

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


def test_third_tape_retrigger_steals_a_bounded_voice_without_gain_runaway(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    params = _tape_v2_params(stop_division=2, curve=0.25, return_mode=1, start_division=2)
    for step in (1, 2, 3):
        _activate_step(upload, lane=LANE_TAPE, step=step, trigger=True, params=params)

    input_audio = _sine(STEP_FRAMES * 6, 550.0, amplitude=0.45)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    dry_jump = float(np.max(np.abs(np.diff(input_audio[:, 0]))))

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) < 0.8
    for boundary_step in (2, 3, 4):
        assert _largest_boundary_jump(output[:, 0], boundary_step) <= dry_jump * 1.8


def test_tempo_change_does_not_retime_an_active_synced_tape_gesture(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(
        upload,
        lane=LANE_TAPE,
        step=1,
        trigger=True,
        params=_tape_v2_params(stop_division=2, curve=0.2, return_mode=1, start_division=1),
    )
    input_audio = _complex_signal(STEP_FRAMES * 6)
    baseline_path = tmp_path / "baseline"
    changed_path = tmp_path / "changed"
    baseline_path.mkdir()
    changed_path.mkdir()
    baseline = _render(generated_runtime, baseline_path, input_audio, _base_schedule(upload))
    changed_schedule = _base_schedule(upload)
    changed_schedule[5_000] = [["value", "manualBpm", 60.0, 0]]
    changed = _render(generated_runtime, changed_path, input_audio, changed_schedule)

    np.testing.assert_allclose(changed[5_000:14_500], baseline[5_000:14_500], atol=1.0e-6, rtol=0.0)


def test_internal_reset_invalidates_tape_history_before_relatching_current_block(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(
        upload,
        lane=LANE_TAPE,
        step=0,
        trigger=True,
        params=_tape_v2_params(timing_mode=1, free_stop_ms=20.0),
    )

    frames = 4_000
    input_audio = np.zeros((frames, 2), dtype=np.float32)
    input_audio[:1_000] = 0.4
    schedule = _base_schedule(upload)
    schedule[1_000] = [["event", "internalReset", 1]]
    output = _render(generated_runtime, tmp_path, input_audio, schedule)

    assert _rms(output[1_300:3_800, 0]) < 1.0e-5


def test_discontinuous_host_seek_invalidates_captured_history(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(upload, lane=LANE_STUTTER, step=1, trigger=True, params=[8.0, 1.0, 0.0, 1.0])

    frames = 10_000
    input_audio = np.zeros((frames, 2), dtype=np.float32)
    input_audio[6_000:6_750] = _complex_signal(750)
    schedule = _base_schedule(upload, clock_mode=0.0, rate=1.0)
    schedule[0].extend(
        [
            ["event", "transportStateIn", {"flags": 1}],
            ["event", "positionIn", {"frameIndex": 0, "quarterNote": 0.0, "barStartQuarterNote": 0.0}],
        ]
    )
    schedule[6_000] = [
        ["event", "positionIn", {"frameIndex": 6_000, "quarterNote": 0.25, "barStartQuarterNote": 0.0}]
    ]
    schedule[7_000] = [
        [
            "event",
            "positionIn",
            {"frameIndex": 96_000, "quarterNote": 8.25, "barStartQuarterNote": 8.0},
        ]
    ]
    output = _render(generated_runtime, tmp_path, input_audio, schedule)

    assert _rms(output[7_300:9_800, 0]) < 1.0e-5


def test_authoritative_pattern_replacement_invalidates_captured_history(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(upload, lane=LANE_STUTTER, step=0, trigger=True, params=[8.0, 1.0, 0.0, 1.0])
    replacement = json.loads(json.dumps(upload))
    replacement["revision"] = 2
    replacement["authoritative"] = True

    frames = 4_000
    input_audio = np.zeros((frames, 2), dtype=np.float32)
    input_audio[:375] = _complex_signal(375)
    schedule = _base_schedule(upload)
    schedule[1_000] = [["event", "patternUpload", replacement]]
    output = _render(generated_runtime, tmp_path, input_audio, schedule)

    assert _rms(output[1_300:3_800, 0]) < 1.0e-5


def test_global_bypass_crossfades_instead_of_switching_at_one_sample(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=step == 0,
            params=[1.0, 1_000.0, 1_000.0, 0.707, 1.0],
        )

    input_audio = np.full((4_000, 2), 0.8, dtype=np.float32)
    schedule = _base_schedule(upload)
    schedule[1_003] = [["value", "enabled", 0.0, 0]]
    output = _render(generated_runtime, tmp_path, input_audio, schedule)

    boundary = output[995:1_115, 0]
    assert float(np.max(np.abs(np.diff(boundary)))) < 0.08
    assert _rms(output[1_250:1_900, 0] - input_audio[1_250:1_900, 0]) < 1.0e-5


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
        params=_tape_v2_params(stop_division=8),
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
            params=_tape_v2_params(stop_division=2, return_mode=0),
        )

    input_audio = _sine(STEP_FRAMES * 6, 660.0)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    catchup_window = slice((STEP_FRAMES * 3) + 400, (STEP_FRAMES * 4) + 2_400)
    output_zcr = _zero_crossing_rate(output[catchup_window, 0])
    dry_zcr = _zero_crossing_rate(input_audio[catchup_window, 0])

    assert output_zcr <= dry_zcr * 1.15

    stop_window = slice((STEP_FRAMES * 2) + 300, (STEP_FRAMES * 2) + 1_200)
    end_window = slice((STEP_FRAMES * 5) + 700, (STEP_FRAMES * 5) + 1_200)
    stop_error = float(np.sqrt(np.mean((output[stop_window] - input_audio[stop_window]) ** 2)))
    end_error = float(np.sqrt(np.mean((output[end_window] - input_audio[end_window]) ** 2)))

    assert stop_error > 0.15
    assert end_error < stop_error * 0.25


def test_tape_stop_free_time_bounds_produce_distinct_short_and_long_gestures(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    short_upload = _empty_upload()
    long_upload = _empty_upload()
    for upload, stop_ms in ((short_upload, 20.0), (long_upload, 8_000.0)):
        _activate_step(
            upload,
            lane=LANE_TAPE,
            step=1,
            trigger=True,
            params=_tape_v2_params(timing_mode=1, free_stop_ms=stop_ms),
        )

    input_audio = _complex_signal(24_000)
    short_path = tmp_path / "short"
    long_path = tmp_path / "long"
    short_path.mkdir()
    long_path.mkdir()
    short = _render(generated_runtime, short_path, input_audio, _base_schedule(short_upload))
    long = _render(generated_runtime, long_path, input_audio, _base_schedule(long_upload))
    settled_window = slice(8_000, 22_000)
    short_error = _rms(short[settled_window] - input_audio[settled_window])
    long_error = _rms(long[settled_window] - input_audio[settled_window])

    assert short_error < 0.02
    assert long_error > short_error + 0.08


def test_tape_stop_character_is_bounded_and_changes_the_slow_tape_timbre(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    clean_upload = _empty_upload()
    character_upload = _empty_upload()
    for upload, character in ((clean_upload, 0.0), (character_upload, 1.0)):
        _activate_step(
            upload,
            lane=LANE_TAPE,
            step=1,
            trigger=True,
            params=_tape_v2_params(
                curve=0.5,
                character=character,
                timing_mode=1,
                free_stop_ms=500.0,
            ),
        )

    input_audio = _complex_signal(36_000)
    clean_path = tmp_path / "clean"
    character_path = tmp_path / "character"
    clean_path.mkdir()
    character_path.mkdir()
    clean = _render(generated_runtime, clean_path, input_audio, _base_schedule(clean_upload))
    colored = _render(generated_runtime, character_path, input_audio, _base_schedule(character_upload))
    slow_window = slice(9_000, 22_000)

    assert np.all(np.isfinite(colored))
    assert float(np.max(np.abs(colored))) < 1.0
    assert _rms(colored[slow_window] - clean[slow_window]) > 0.025


@pytest.mark.reference
def test_tape_stop_long_synced_gesture_crosses_to_packed_history_without_dropping_out(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    empty = _empty_upload()
    gesture = _empty_upload(revision=2)
    gesture["authoritative"] = False
    for step in range(STEP_COUNT):
        _activate_step(
            gesture,
            lane=LANE_TAPE,
            step=step,
            trigger=False,
            params=_tape_v2_params(stop_division=7, curve=1.0),
        )

    pre_roll_frames = SAMPLE_RATE * 20
    post_trigger_frames = SAMPLE_RATE * 26
    input_audio = _sine(pre_roll_frames + post_trigger_frames, 730.0, amplitude=0.35)
    schedule = _base_schedule(empty, manual_bpm=20.0)
    schedule[pre_roll_frames] = [["event", "patternUpload", gesture]]
    output = _render(generated_runtime, tmp_path, input_audio, schedule)
    crossover = output[
        pre_roll_frames + (SAMPLE_RATE * 23) :
        pre_roll_frames + (SAMPLE_RATE * 25),
        0,
    ]

    assert np.all(np.isfinite(crossover))
    assert _rms(crossover) > 0.04
    assert float(np.max(np.abs(np.diff(crossover)))) < 0.12


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


def test_stutter_retrigger_keeps_the_previous_loop_until_the_new_capture_is_ready(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in range(6):
        _activate_step(
            upload,
            lane=LANE_STUTTER,
            step=step,
            trigger=(step in (0, 2, 3)),
            params=[4.0, 1.0, 0.0, 1.0],
        )

    frames = STEP_FRAMES * 7
    source = np.zeros((frames, 2), dtype=np.float32)
    source[:1_500] = 0.5
    source[STEP_FRAMES * 2 : (STEP_FRAMES * 2) + 750] = -0.5
    source[STEP_FRAMES * 3 : (STEP_FRAMES * 3) + 2_250] = 0.25
    output = _render(generated_runtime, tmp_path, source, _base_schedule(upload))

    # Each retrigger starts a new first-slice capture. The previously completed
    # loop must remain the audible bridge until that capture is ready, including
    # when a third trigger arrives while the bounded voices are being reused.
    assert float(np.mean(output[(STEP_FRAMES * 2) + 160 : (STEP_FRAMES * 2) + 650, 0])) > 0.4
    assert float(np.mean(output[(STEP_FRAMES * 3) + 160 : (STEP_FRAMES * 3) + 650, 0])) < -0.4
    assert _largest_boundary_jump(output[:, 0], 2) < 0.08
    assert _largest_boundary_jump(output[:, 0], 3) < 0.08
    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 0.55


def test_stutter_block_exit_crossfades_to_dry_instead_of_dropping_the_capture(
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

    source = np.zeros((STEP_FRAMES * 4, 2), dtype=np.float32)
    source[:1_500] = 0.5
    output = _render(generated_runtime, tmp_path, source, _base_schedule(upload))

    assert _rms(output[(STEP_FRAMES * 2) - 500 : (STEP_FRAMES * 2) - 100, 0]) > 0.4
    assert _largest_boundary_jump(output[:, 0], 2) < 0.08
    np.testing.assert_allclose(
        output[(STEP_FRAMES * 2) + 192 :],
        source[(STEP_FRAMES * 2) + 192 :],
        atol=2.0e-5,
        rtol=0.0,
    )


def test_stutter_authoritative_reset_discards_every_capture_voice(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in range(5):
        _activate_step(
            upload,
            lane=LANE_STUTTER,
            step=step,
            trigger=(step == 0),
            params=[4.0, 1.0, 0.0, 1.0],
        )

    source = np.zeros((STEP_FRAMES * 7, 2), dtype=np.float32)
    source[:3_750] = 0.5
    reset_frame = STEP_FRAMES * 2 + 400
    schedule = _base_schedule(upload)
    schedule[reset_frame] = [["event", "internalReset", 1]]
    output = _render(generated_runtime, tmp_path, source, schedule)

    assert _rms(output[STEP_FRAMES * 2 : reset_frame - 64, 0]) > 0.4
    np.testing.assert_allclose(
        output[reset_frame + 192 :],
        source[reset_frame + 192 :],
        atol=2.0e-5,
        rtol=0.0,
    )


def test_stutter_two_voice_retriggers_remain_bounded_across_all_four_chains(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for lane in range(LANE_COUNT):
        for step in range(6):
            _activate_step(
                upload,
                lane=lane,
                step=step,
                trigger=(step in (0, 2, 3)),
                effect_type=EFFECT_STUTTER,
                params=[32.0, 2.0, 0.4375, 1.0],
            )

    source = _complex_signal(STEP_FRAMES * 7) * 0.25
    started = perf_counter()
    output = _render(generated_runtime, tmp_path, source, _base_schedule(upload))
    elapsed = perf_counter() - started

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 4.001
    assert elapsed < 2.0, f"four-chain two-voice Stutter render took {elapsed:.3f}s"


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
    def upload_with_envelope(
        *,
        revision: int,
        shape: float,
        gate: float,
        authoritative: bool = True,
    ) -> dict[str, object]:
        upload = _empty_upload(revision=revision)
        upload["authoritative"] = authoritative
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
        [
            "event",
            "patternUpload",
            upload_with_envelope(revision=2, shape=0.25, gate=0.45, authoritative=False),
        ]
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


def test_ring_sine_carrier_creates_expected_sum_and_difference_sidebands(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in range(3):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            effect_type=EFFECT_RING,
            params=[180.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0],
        )

    frames = STEP_FRAMES * 3
    input_audio = _sine(frames, 1_000.0, amplitude=0.6)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    analysis = output[2_000:6_800, 0]

    lower_sideband = _tone_amplitude(analysis, 820.0)
    upper_sideband = _tone_amplitude(analysis, 1_180.0)
    dry_carrier = _tone_amplitude(analysis, 1_000.0)

    assert lower_sideband > 0.24
    assert upper_sideband > 0.24
    assert abs(lower_sideband - upper_sideband) < 0.02
    assert dry_carrier < 0.02


def test_ring_retrigger_keeps_carrier_phase_continuous(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=True,
            effect_type=EFFECT_RING,
            params=[180.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0],
        )

    input_audio = np.full((STEP_FRAMES * 2, 2), 0.5, dtype=np.float32)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))

    boundary_window = output[STEP_FRAMES - 8 : STEP_FRAMES + 8, 0]
    assert float(np.max(np.abs(np.diff(boundary_window)))) < 0.025


@pytest.mark.parametrize("waveform", [0.0, 1.0, 2.0, 3.0])
def test_ring_waveforms_are_finite_bounded_and_audible(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    waveform: float,
) -> None:
    upload = _empty_upload()
    for step in (0, 1):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            effect_type=EFFECT_RING,
            params=[3_500.0, waveform, 0.65, 7.0, 1.0, 0.2, 0.45],
        )

    input_audio = np.full((STEP_FRAMES * 2, 2), 0.5, dtype=np.float32)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    settled = output[500:, :]

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 0.61
    assert _rms(settled[:, 0]) > 0.04
    assert _rms(np.mean(settled, axis=1)) > 0.025


def test_ring_positive_bias_restores_the_input_frequency_without_removing_sidebands(
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
            effect_type=EFFECT_RING,
            params=[180.0, 0.0, 0.0, 0.5, 0.0, 1.0, 0.0],
        )

    input_audio = _sine(STEP_FRAMES * 2, 1_000.0, amplitude=0.6)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    analysis = output[1_000:5_800, 0]

    assert _tone_amplitude(analysis, 1_000.0) > 0.58
    assert _tone_amplitude(analysis, 820.0) > 0.24
    assert _tone_amplitude(analysis, 1_180.0) > 0.24


def test_ring_spread_uses_opposite_small_carrier_detunes(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    for step in range(16):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            effect_type=EFFECT_RING,
            params=[180.0, 0.0, 0.0, 0.5, 1.0, 0.0, 0.0],
        )

    frames = STEP_FRAMES * 16
    input_audio = _sine(frames, 1_000.0, amplitude=0.6)
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    analysis = output[4_800:, :]
    spread_ratio = 2.0 ** (0.25 / 12.0)
    left_lower = 1_000.0 - (180.0 / spread_ratio)
    right_lower = 1_000.0 - (180.0 * spread_ratio)

    assert _tone_amplitude(analysis[:, 0], left_lower) > 0.27
    assert _tone_amplitude(analysis[:, 1], right_lower) > 0.27
    assert _tone_amplitude(analysis[:, 0], left_lower) > _tone_amplitude(analysis[:, 0], right_lower) * 4
    assert _tone_amplitude(analysis[:, 1], right_lower) > _tone_amplitude(analysis[:, 1], left_lower) * 4


def test_talk_box_a_vowel_emphasizes_its_two_documented_formants(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    def gain_at(frequency: float) -> float:
        upload = _empty_upload()
        for step in range(4):
            _activate_step(
                upload,
                lane=LANE_FILTER,
                step=step,
                trigger=(step == 0),
                effect_type=EFFECT_TALK_BOX,
                params=[0.0, 0.0, 0.0, 10.0, 0.0, 0.0, 0.0],
            )
        input_audio = _sine(STEP_FRAMES * 4, frequency, amplitude=0.2)
        output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
        return _rms(output[1_000:, 0]) / _rms(input_audio[1_000:, 0])

    first_formant_gain = gain_at(730.0)
    second_formant_gain = gain_at(1_090.0)
    lower_valley_gain = gain_at(400.0)
    upper_valley_gain = gain_at(1_700.0)

    assert first_formant_gain > lower_valley_gain * 1.8
    assert second_formant_gain > upper_valley_gain * 1.8


@pytest.mark.parametrize(
    ("vowel", "expected_formants"),
    [
        (0.0, (730.0, 1_090.0)),
        (1.0, (530.0, 1_840.0)),
        (2.0, (270.0, 2_290.0)),
        (3.0, (570.0, 840.0)),
        (4.0, (300.0, 870.0)),
    ],
)
def test_talk_box_vowel_peaks_match_the_documented_formant_table(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    vowel: float,
    expected_formants: tuple[float, float],
) -> None:
    upload = _empty_upload()
    for step in range(4):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            effect_type=EFFECT_TALK_BOX,
            params=[vowel, vowel, 0.0, 12.0, 0.0, 0.0, 0.0],
        )

    input_audio = np.zeros((STEP_FRAMES * 4, 2), dtype=np.float32)
    input_audio[512, :] = 0.2
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    spectrum = np.abs(np.fft.rfft(output[512:, 0], n=65_536))
    frequencies = np.fft.rfftfreq(65_536, 1.0 / SAMPLE_RATE)

    for expected in expected_formants:
        local = np.flatnonzero(np.abs(frequencies - expected) <= 75.0)
        peak_frequency = float(frequencies[local[np.argmax(spectrum[local])]])
        assert abs(peak_frequency - expected) < 12.0


def test_talk_box_morph_interpolates_formants_in_log_frequency(
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
            effect_type=EFFECT_TALK_BOX,
            params=[0.0, 2.0, 0.5, 14.0, 0.0, 0.0, 0.0],
        )

    input_audio = np.zeros((STEP_FRAMES * 4, 2), dtype=np.float32)
    input_audio[512, :] = 0.2
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    spectrum = np.abs(np.fft.rfft(output[512:, 0], n=65_536))
    frequencies = np.fft.rfftfreq(65_536, 1.0 / SAMPLE_RATE)

    for expected in (np.sqrt(730.0 * 270.0), np.sqrt(1_090.0 * 2_290.0)):
        local = np.flatnonzero(np.abs(frequencies - expected) <= 75.0)
        peak_frequency = float(frequencies[local[np.argmax(spectrum[local])]])
        assert abs(peak_frequency - expected) < 12.0


@pytest.mark.parametrize(
    ("frequency", "parameter_index"),
    [(80.0, 4), (8_000.0, 5)],
)
def test_talk_box_low_and_high_passthrough_controls_restore_extreme_bands(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    frequency: float,
    parameter_index: int,
) -> None:
    def rendered_rms(amount: float) -> float:
        params = [0.0, 0.0, 0.0, 10.0, 0.0, 0.0, 0.0]
        params[parameter_index] = amount
        upload = _empty_upload()
        for step in range(3):
            _activate_step(
                upload,
                lane=LANE_FILTER,
                step=step,
                trigger=(step == 0),
                effect_type=EFFECT_TALK_BOX,
                params=params,
            )
        input_audio = _sine(STEP_FRAMES * 3, frequency, amplitude=0.2)
        output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
        return _rms(output[1_000:, 0])

    muted = rendered_rms(0.0)
    restored = rendered_rms(1.0)
    assert restored > muted * 2.5


def test_talk_box_extreme_resonance_and_drive_stay_finite_and_bounded(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    baseline_upload = _empty_upload()
    for step in range(4):
        for target_upload, trigger in ((upload, True), (baseline_upload, step == 0)):
            _activate_step(
                target_upload,
                lane=LANE_FILTER,
                step=step,
                trigger=trigger,
                effect_type=EFFECT_TALK_BOX,
                params=[2.0, 4.0, 0.65, 20.0, 1.0, 1.0, 12.0],
            )
    input_audio = _complex_signal(STEP_FRAMES * 4) * 1.8
    output = _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))
    baseline = _render(generated_runtime, tmp_path, input_audio, _base_schedule(baseline_upload))

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 4.001
    assert float(np.max(np.abs(output - baseline))) < 1.0e-6


def _render_dirty(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    input_audio: np.ndarray,
    *,
    drive_db: float = 24.0,
    character: float = 0.0,
    bias: float = 0.0,
    dynamics: float = 0.0,
    tone_hz: float = 20_000.0,
    trim_db: float = 0.0,
) -> np.ndarray:
    upload = _empty_upload()
    for step in range(4):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            effect_type=EFFECT_DIRTY,
            params=[drive_db, character, bias, dynamics, tone_hz, trim_db],
        )
    return _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))


def test_dirty_soft_character_adds_odd_harmonics_without_becoming_crush(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    input_audio = _sine(STEP_FRAMES * 4, 997.0, amplitude=0.08)
    output = _render_dirty(generated_runtime, tmp_path, input_audio)
    analysis = output[2_048:, 0]

    assert _tone_amplitude(analysis, 2_991.0) > 0.015
    assert _tone_amplitude(analysis, 1_994.0) < _tone_amplitude(analysis, 2_991.0) * 0.2


def test_dirty_character_modes_have_distinct_transfer_signatures(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    input_audio = _sine(STEP_FRAMES * 4, 997.0, amplitude=0.16)
    outputs = [
        _render_dirty(generated_runtime, tmp_path, input_audio, character=float(character))[2_048:, 0]
        for character in range(4)
    ]

    for left_index in range(len(outputs)):
        for right_index in range(left_index + 1, len(outputs)):
            assert _rms(outputs[left_index] - outputs[right_index]) > 0.01
    assert _tone_amplitude(outputs[3], 1_994.0) > 0.01


def test_dirty_dynamics_restores_input_level_contrast(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    def ratio(dynamics: float) -> float:
        quiet = _sine(STEP_FRAMES * 4, 997.0, amplitude=0.025)
        loud = _sine(STEP_FRAMES * 4, 997.0, amplitude=0.25)
        quiet_out = _render_dirty(
            generated_runtime,
            tmp_path,
            quiet,
            drive_db=30.0,
            character=1.0,
            dynamics=dynamics,
        )[3_000:, 0]
        loud_out = _render_dirty(
            generated_runtime,
            tmp_path,
            loud,
            drive_db=30.0,
            character=1.0,
            dynamics=dynamics,
        )[3_000:, 0]
        return _rms(loud_out) / _rms(quiet_out)

    flattened_ratio = ratio(0.0)
    preserved_ratio = ratio(1.0)
    assert preserved_ratio > flattened_ratio * 3.0
    assert preserved_ratio > 7.0


def test_dirty_bias_character_is_dc_blocked_but_keeps_even_harmonics(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    input_audio = _sine(STEP_FRAMES * 4, 997.0, amplitude=0.12)
    output = _render_dirty(
        generated_runtime,
        tmp_path,
        input_audio,
        character=3.0,
        bias=0.75,
    )[4_000:, 0]

    assert abs(float(np.mean(output))) < 0.003
    assert _tone_amplitude(output, 1_994.0) > 0.01


def test_dirty_tone_filters_the_nonlinear_residue_not_the_dry_fundamental(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    input_audio = _sine(STEP_FRAMES * 4, 997.0, amplitude=0.13)
    dark = _render_dirty(
        generated_runtime,
        tmp_path,
        input_audio,
        character=2.0,
        tone_hz=1_200.0,
    )[3_000:, 0]
    bright = _render_dirty(
        generated_runtime,
        tmp_path,
        input_audio,
        character=2.0,
        tone_hz=20_000.0,
    )[3_000:, 0]

    assert _tone_amplitude(dark, 997.0) > _tone_amplitude(bright, 997.0) * 0.7
    assert _tone_amplitude(bright, 4_985.0) > _tone_amplitude(dark, 4_985.0) * 2.0


def test_dirty_four_times_core_suppresses_the_naive_hard_clip_fifth_harmonic_alias(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    input_audio = _sine(STEP_FRAMES * 4, 7_000.0, amplitude=0.18)
    output = _render_dirty(
        generated_runtime,
        tmp_path,
        input_audio,
        drive_db=24.0,
        character=1.0,
    )[4_000:, 0]
    naive = np.clip(input_audio[4_000:, 0] * (10.0 ** (24.0 / 20.0)), -1.0, 1.0)

    # A 35 kHz fifth harmonic folds to 13 kHz at the 48 kHz host rate.
    assert _tone_amplitude(output, 13_000.0) < _tone_amplitude(naive, 13_000.0) * 0.4


def test_dirty_trim_is_a_post_character_decibel_control(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    input_audio = _complex_signal(STEP_FRAMES * 4) * 0.25
    unity = _render_dirty(generated_runtime, tmp_path, input_audio, dynamics=0.65)[4_000:, 0]
    minus_six = _render_dirty(
        generated_runtime,
        tmp_path,
        input_audio,
        dynamics=0.65,
        trim_db=-6.0,
    )[4_000:, 0]

    assert _rms(minus_six) / _rms(unity) == pytest.approx(10.0 ** (-6.0 / 20.0), abs=0.015)


@pytest.mark.parametrize("character", [0.0, 1.0, 2.0, 3.0])
def test_dirty_extreme_settings_remain_finite_and_bounded(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    character: float,
) -> None:
    input_audio = _complex_signal(STEP_FRAMES * 4) * 2.0
    output = _render_dirty(
        generated_runtime,
        tmp_path,
        input_audio,
        drive_db=36.0,
        character=character,
        bias=1.0,
        dynamics=1.0,
        tone_hz=20_000.0,
        trim_db=6.0,
    )

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 4.001


def _render_comb(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    input_audio: np.ndarray,
    *,
    tune_hz: float = 220.0,
    decay_seconds: float = 1.4,
    polarity: float = 0.0,
    dispersion: float = 0.55,
    damping_hz: float = 7_500.0,
    motion: float = 0.12,
    drive: float = 0.18,
    width: float = 0.65,
    active_steps: int = 1,
) -> np.ndarray:
    upload = _empty_upload()
    params = [tune_hz, decay_seconds, polarity, dispersion, damping_hz, motion, drive, width]
    for step in range(active_steps):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            effect_type=EFFECT_COMB,
            params=params,
        )
    return _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))


def _comb_impulse(frames: int, frame: int = 256) -> np.ndarray:
    audio = np.zeros((frames, 2), dtype=np.float32)
    audio[frame] = 0.6
    return audio


def _dominant_frequency_near(samples: np.ndarray, target_hz: float) -> float:
    signal = np.asarray(samples, dtype=np.float64)
    transform_size = 262_144
    spectrum = np.abs(np.fft.rfft(signal * np.hanning(signal.size), n=transform_size))
    frequencies = np.fft.rfftfreq(transform_size, 1.0 / SAMPLE_RATE)
    candidates = np.flatnonzero((frequencies >= target_hz * 0.75) & (frequencies <= target_hz * 1.25))
    peak = int(candidates[np.argmax(spectrum[candidates])])
    return float(frequencies[peak])


def test_comb_impulse_tail_outlives_its_trigger_block_and_decays(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    output = _render_comb(
        generated_runtime,
        tmp_path,
        _comb_impulse(STEP_FRAMES * 6),
        decay_seconds=0.35,
        dispersion=0.7,
        motion=0.0,
    )
    early_tail = output[STEP_FRAMES + 128 : STEP_FRAMES * 2, 0]
    late_tail = output[STEP_FRAMES * 5 : STEP_FRAMES * 6, 0]

    assert _rms(early_tail) > 1.0e-4
    assert _rms(late_tail) < _rms(early_tail) * 0.55


@pytest.mark.parametrize("tune_hz", [110.0, 220.0, 880.0])
def test_comb_vector_dispersive_mode_tracks_tune_within_twenty_cents(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    tune_hz: float,
) -> None:
    output = _render_comb(
        generated_runtime,
        tmp_path,
        _comb_impulse(SAMPLE_RATE),
        tune_hz=tune_hz,
        decay_seconds=1.4,
        dispersion=0.7,
        motion=0.0,
    )
    measured_hz = _dominant_frequency_near(np.mean(output[320:], axis=1), tune_hz)
    cents = 1_200.0 * np.log2(measured_hz / tune_hz)

    assert abs(float(cents)) < 20.0, f"{tune_hz=}, {measured_hz=}, {cents=}"


def test_comb_dispersion_zero_is_an_exact_motion_independent_reference_neutral(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _comb_impulse(STEP_FRAMES * 4)
    stationary = _render_comb(generated_runtime, tmp_path, source, dispersion=0.0, motion=0.0)
    motion_ignored = _render_comb(generated_runtime, tmp_path, source, dispersion=0.0, motion=1.0)
    advanced = _render_comb(generated_runtime, tmp_path, source, dispersion=0.75, motion=0.0)

    np.testing.assert_array_equal(stationary, motion_ignored)
    assert _rms(advanced[512:] - stationary[512:]) > 1.0e-3


def test_comb_width_has_a_mono_safe_center_and_a_distinct_stereo_projection(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _comb_impulse(STEP_FRAMES * 4)
    centered = _render_comb(generated_runtime, tmp_path, source, dispersion=0.8, motion=0.2, width=0.0)
    wide = _render_comb(generated_runtime, tmp_path, source, dispersion=0.8, motion=0.2, width=1.0)

    np.testing.assert_allclose(centered[512:, 0], centered[512:, 1], atol=1.0e-6, rtol=0.0)
    assert _rms(wide[512:, 0] - wide[512:, 1]) > 1.0e-3
    assert _rms(np.mean(wide[512:], axis=1)) > _rms(np.mean(centered[512:], axis=1)) * 0.2


def test_comb_extreme_feedback_controls_are_deterministic_finite_and_bounded(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = np.zeros((STEP_FRAMES * 6, 2), dtype=np.float32)
    source[: STEP_FRAMES * 2] = _complex_signal(STEP_FRAMES * 2) * 1.4
    first = _render_comb(
        generated_runtime,
        tmp_path,
        source,
        tune_hz=30.0,
        decay_seconds=8.0,
        polarity=1.0,
        dispersion=1.0,
        damping_hz=20_000.0,
        motion=1.0,
        drive=1.0,
        width=1.0,
        active_steps=2,
    )
    second = _render_comb(
        generated_runtime,
        tmp_path,
        source,
        tune_hz=30.0,
        decay_seconds=8.0,
        polarity=1.0,
        dispersion=1.0,
        damping_hz=20_000.0,
        motion=1.0,
        drive=1.0,
        width=1.0,
        active_steps=2,
    )

    np.testing.assert_array_equal(first, second)
    assert np.all(np.isfinite(first))
    assert float(np.max(np.abs(first))) <= 4.001


def test_comb_aux_sweeps_all_continuous_feedback_controls_without_runaway(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    params = [220.0, 0.4, 0.0, 0.0, 1_500.0, 0.0, 0.0, 0.0]
    for step in range(4):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            effect_type=EFFECT_COMB,
            params=params,
        )
    for param, end in ((0, 55.0), (1, 8.0), (3, 1.0), (4, 20_000.0), (5, 1.0), (6, 1.0), (7, 1.0)):
        _set_aux(upload, lane=LANE_FILTER, step=0, param=param, end=end, shape=0.0)

    source = np.zeros((STEP_FRAMES * 6, 2), dtype=np.float32)
    source[: STEP_FRAMES * 2] = _complex_signal(STEP_FRAMES * 2)
    output = _render(generated_runtime, tmp_path, source, _base_schedule(upload))

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 4.001


def test_comb_authoritative_reset_invalidates_the_live_feedback_tail(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    _activate_step(
        upload,
        lane=LANE_FILTER,
        step=0,
        trigger=True,
        effect_type=EFFECT_COMB,
        params=[220.0, 1.4, 0.0, 0.7, 7_500.0, 0.0, 0.18, 0.65],
    )
    source = _comb_impulse(STEP_FRAMES * 4)
    baseline = _render(generated_runtime, tmp_path, source, _base_schedule(upload))
    reset_schedule = _base_schedule(upload)
    reset_schedule[4_500] = [["event", "internalReset", 1]]
    reset = _render(generated_runtime, tmp_path, source, reset_schedule)

    baseline_tail = _rms(baseline[5_000:7_000])
    reset_tail = _rms(reset[5_000:7_000])
    assert baseline_tail > 1.0e-4
    assert reset_tail < baseline_tail * 0.05


def test_comb_four_chain_worst_case_remains_faster_than_the_generous_js_budget(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    params = [55.0, 8.0, 1.0, 1.0, 20_000.0, 1.0, 1.0, 1.0]
    for lane in range(LANE_COUNT):
        for step in range(4):
            _activate_step(
                upload,
                lane=lane,
                step=step,
                trigger=(step == 0),
                effect_type=EFFECT_COMB,
                params=params,
            )
    source = _complex_signal(STEP_FRAMES * 4) * 0.3
    started = perf_counter()
    output = _render(generated_runtime, tmp_path, source, _base_schedule(upload))
    elapsed = perf_counter() - started

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 4.001
    assert elapsed < 2.0, f"four-chain generated-JS render took {elapsed:.3f}s for {source.shape[0] / SAMPLE_RATE:.3f}s audio"


def _render_vibro(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    input_audio: np.ndarray,
    *,
    rate_hz: float = 4.5,
    depth_cents: float = 28.0,
    waveform: float = 0.0,
    spread_degrees: float = 90.0,
    timing_mode: float = 1.0,
    division: float = 2.0,
    first_step: int = 1,
    active_steps: int = 16,
    mix: float = 1.0,
    bpm: float = 120.0,
) -> np.ndarray:
    upload = _empty_upload()
    params = [rate_hz, depth_cents, waveform, spread_degrees, timing_mode, division]
    for step in range(first_step, min(STEP_COUNT, first_step + active_steps)):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == first_step),
            mix=mix,
            effect_type=EFFECT_VIBRO,
            params=params,
        )
    return _render(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(upload, manual_bpm=bpm),
    )


def _vibro_ramp(frames: int, slope: float = 8.0e-6) -> tuple[np.ndarray, float]:
    mono = (np.arange(frames, dtype=np.float64) * slope).astype(np.float32)
    return np.column_stack([mono, mono]).astype(np.float32), slope


def _vibro_read_ratio(output: np.ndarray, slope: float, start: int, end: int, channel: int = 0) -> np.ndarray:
    wet = np.asarray(output[start:end, channel], dtype=np.float64)
    return np.gradient(wet) / slope


def test_vibro_free_rate_and_depth_match_the_displayed_doppler_contract(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    frames = STEP_FRAMES * 20
    source, slope = _vibro_ramp(frames)
    output = _render_vibro(
        generated_runtime,
        tmp_path,
        source,
        rate_hz=4.0,
        depth_cents=60.0,
        waveform=0.0,
        spread_degrees=0.0,
        active_steps=18,
    )
    ratio = _vibro_read_ratio(output, slope, STEP_FRAMES * 2, STEP_FRAMES * 18)
    modulation = ratio - np.mean(ratio)
    measured_rate = _dominant_frequency_near(modulation, 4.0)
    phase = np.arange(ratio.size, dtype=np.float64) * (2.0 * np.pi * measured_rate / SAMPLE_RATE)
    basis = np.column_stack([np.sin(phase), np.cos(phase), np.ones(ratio.size)])
    sine_weight, cosine_weight, _center = np.linalg.lstsq(basis, ratio, rcond=None)[0]
    rate_deviation = float(np.hypot(sine_weight, cosine_weight))
    measured_depth = 600.0 * np.log2((1.0 + rate_deviation) / (1.0 - rate_deviation))

    assert measured_rate == pytest.approx(4.0, abs=0.12)
    assert measured_depth == pytest.approx(60.0, abs=3.0)


def test_vibro_sync_rate_follows_host_tempo_and_selected_division(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    frames = STEP_FRAMES * 32
    source, slope = _vibro_ramp(frames, slope=4.0e-6)
    output = _render_vibro(
        generated_runtime,
        tmp_path,
        source,
        rate_hz=9.0,
        depth_cents=45.0,
        waveform=0.0,
        spread_degrees=0.0,
        timing_mode=0.0,
        division=3.0,
        active_steps=31,
        bpm=90.0,
    )
    ratio = _vibro_read_ratio(output, slope, 8_000, frames - 2_000)
    measured_rate = _dominant_frequency_near(ratio - np.mean(ratio), 1.5)

    assert measured_rate == pytest.approx(1.5, abs=0.12)


def test_vibro_zero_depth_is_exact_pass_through_under_full_mix(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _complex_signal(STEP_FRAMES * 6) * 0.35
    output = _render_vibro(
        generated_runtime,
        tmp_path,
        source,
        depth_cents=0.0,
        first_step=1,
        active_steps=4,
        mix=1.0,
    )

    np.testing.assert_array_equal(output, source)


def test_vibro_spread_has_a_mono_safe_center_and_a_useful_stereo_extreme(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _sine(STEP_FRAMES * 12, 440.0, amplitude=0.4)
    centered = _render_vibro(
        generated_runtime,
        tmp_path,
        source,
        rate_hz=3.0,
        depth_cents=55.0,
        spread_degrees=0.0,
        active_steps=10,
    )
    wide = _render_vibro(
        generated_runtime,
        tmp_path,
        source,
        rate_hz=3.0,
        depth_cents=55.0,
        spread_degrees=180.0,
        active_steps=10,
    )
    window = slice(STEP_FRAMES * 2, STEP_FRAMES * 10)

    np.testing.assert_allclose(centered[window, 0], centered[window, 1], atol=1.0e-7, rtol=0.0)
    assert _rms(wide[window, 0] - wide[window, 1]) > 0.08
    assert _rms(np.mean(wide[window], axis=1)) > 0.08


def test_vibro_triangle_is_distinct_but_matches_sine_depth_and_stays_bounded(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    frames = STEP_FRAMES * 16
    source, slope = _vibro_ramp(frames)
    sine = _render_vibro(
        generated_runtime,
        tmp_path,
        source,
        rate_hz=5.0,
        depth_cents=70.0,
        waveform=0.0,
        spread_degrees=0.0,
        active_steps=14,
    )
    triangle = _render_vibro(
        generated_runtime,
        tmp_path,
        source,
        rate_hz=5.0,
        depth_cents=70.0,
        waveform=1.0,
        spread_degrees=0.0,
        active_steps=14,
    )
    window = slice(STEP_FRAMES * 2, STEP_FRAMES * 14)
    sine_ratio = _vibro_read_ratio(sine, slope, window.start, window.stop)
    triangle_ratio = _vibro_read_ratio(triangle, slope, window.start, window.stop)

    for ratio in (sine_ratio, triangle_ratio):
        low, high = np.quantile(ratio, [0.005, 0.995])
        assert 600.0 * np.log2(high / low) == pytest.approx(70.0, abs=4.0)
    assert _rms(sine[window, 0] - triangle[window, 0]) > 1.0e-4
    assert np.all(np.isfinite(triangle))
    assert float(np.max(np.abs(triangle))) <= 4.001


def test_vibro_exit_crossfades_back_to_dry_and_has_no_tail(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _sine(STEP_FRAMES * 7, 997.0, amplitude=0.35)
    output = _render_vibro(
        generated_runtime,
        tmp_path,
        source,
        rate_hz=5.5,
        depth_cents=80.0,
        first_step=1,
        active_steps=3,
    )
    release = STEP_FRAMES * 4

    assert _largest_boundary_jump(output[:, 0], 4) < 0.15
    np.testing.assert_allclose(output[release + 160 :], source[release + 160 :], atol=1.0e-7, rtol=0.0)


def test_vibro_cold_history_becomes_available_without_a_delayed_edge(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _sine(STEP_FRAMES * 32, 997.0, amplitude=0.35)
    output = _render_vibro(
        generated_runtime,
        tmp_path,
        source,
        rate_hz=0.05,
        depth_cents=100.0,
        spread_degrees=0.0,
        first_step=0,
        active_steps=32,
    )

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(np.diff(output[:, 0])))) < 0.06


def _render_flange(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    input_audio: np.ndarray,
    *,
    delay_ms: float = 1.2,
    depth_ms: float = 3.5,
    rate_hz: float = 0.28,
    feedback: float = 0.55,
    spread_degrees: float = 120.0,
    polarity: float = 0.0,
    timing_mode: float = 1.0,
    division: float = 5.0,
    first_step: int = 1,
    active_steps: int = 16,
    mix: float = 1.0,
    bpm: float = 120.0,
) -> np.ndarray:
    upload = _empty_upload()
    params = [delay_ms, depth_ms, rate_hz, feedback, spread_degrees, polarity, timing_mode, division]
    for step in range(first_step, min(STEP_COUNT, first_step + active_steps)):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == first_step),
            mix=mix,
            effect_type=EFFECT_FLANGE,
            params=params,
        )
    return _render(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(upload, manual_bpm=bpm),
    )


def test_flange_static_delay_places_the_expected_comb_notch(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    frames = STEP_FRAMES * 10
    notch_source = _sine(frames, 250.0, amplitude=0.35)
    peak_source = _sine(frames, 500.0, amplitude=0.35)
    notch = _render_flange(
        generated_runtime,
        tmp_path,
        notch_source,
        delay_ms=2.0,
        depth_ms=0.0,
        feedback=0.0,
        spread_degrees=0.0,
        active_steps=8,
    )
    peak = _render_flange(
        generated_runtime,
        tmp_path,
        peak_source,
        delay_ms=2.0,
        depth_ms=0.0,
        feedback=0.0,
        spread_degrees=0.0,
        active_steps=8,
    )
    window = slice(STEP_FRAMES * 2, STEP_FRAMES * 8)

    assert _rms(notch[window, 0]) < _rms(peak[window, 0]) * 0.08
    assert _rms(peak[window, 0]) == pytest.approx(_rms(peak_source[window, 0]), rel=0.04)


def test_flange_free_rate_moves_between_the_displayed_delay_extremes(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    frames = STEP_FRAMES * 32
    source, slope = _vibro_ramp(frames, slope=4.0e-6)
    output = _render_flange(
        generated_runtime,
        tmp_path,
        source,
        delay_ms=1.5,
        depth_ms=5.0,
        rate_hz=3.0,
        feedback=0.0,
        spread_degrees=0.0,
        active_steps=31,
    )
    window = slice(STEP_FRAMES * 2, STEP_FRAMES * 31)
    delay_samples = 2.0 * (source[window, 0] - output[window, 0]) / slope
    measured_rate = _dominant_frequency_near(delay_samples - np.mean(delay_samples), 3.0)
    low, high = np.quantile(delay_samples, [0.005, 0.995])

    assert measured_rate == pytest.approx(3.0, abs=0.12)
    assert low == pytest.approx(1.5e-3 * SAMPLE_RATE, abs=3.0)
    assert high == pytest.approx(6.5e-3 * SAMPLE_RATE, abs=3.0)


def test_flange_sync_rate_follows_host_tempo_and_division(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    frames = STEP_FRAMES * 32
    source, slope = _vibro_ramp(frames, slope=4.0e-6)
    output = _render_flange(
        generated_runtime,
        tmp_path,
        source,
        delay_ms=1.0,
        depth_ms=4.0,
        rate_hz=8.0,
        feedback=0.0,
        spread_degrees=0.0,
        timing_mode=0.0,
        division=2.0,
        active_steps=31,
        bpm=90.0,
    )
    window = slice(STEP_FRAMES * 2, STEP_FRAMES * 31)
    delay_samples = 2.0 * (source[window, 0] - output[window, 0]) / slope
    measured_rate = _dominant_frequency_near(delay_samples - np.mean(delay_samples), 1.5)

    assert measured_rate == pytest.approx(1.5, abs=0.12)


def test_flange_spread_has_mono_safe_center_and_useful_stereo_motion(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _sine(STEP_FRAMES * 14, 997.0, amplitude=0.35)
    centered = _render_flange(
        generated_runtime,
        tmp_path,
        source,
        rate_hz=2.0,
        depth_ms=7.0,
        feedback=0.0,
        spread_degrees=0.0,
        active_steps=12,
    )
    wide = _render_flange(
        generated_runtime,
        tmp_path,
        source,
        rate_hz=2.0,
        depth_ms=7.0,
        feedback=0.0,
        spread_degrees=180.0,
        active_steps=12,
    )
    window = slice(STEP_FRAMES * 2, STEP_FRAMES * 12)

    np.testing.assert_allclose(centered[window, 0], centered[window, 1], atol=1.0e-7, rtol=0.0)
    assert _rms(wide[window, 0] - wide[window, 1]) > 0.08
    assert _rms(np.mean(wide[window], axis=1)) > 0.04


def test_flange_feedback_polarity_controls_the_second_echo_without_changing_the_first(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    frames = STEP_FRAMES * 5
    impulse_frame = STEP_FRAMES + 300
    source = np.zeros((frames, 2), dtype=np.float32)
    source[impulse_frame] = 1.0
    normal = _render_flange(
        generated_runtime,
        tmp_path,
        source,
        delay_ms=2.0,
        depth_ms=0.0,
        feedback=0.75,
        spread_degrees=0.0,
        polarity=0.0,
        active_steps=3,
    )
    inverse = _render_flange(
        generated_runtime,
        tmp_path,
        source,
        delay_ms=2.0,
        depth_ms=0.0,
        feedback=0.75,
        spread_degrees=0.0,
        polarity=1.0,
        active_steps=3,
    )
    first_echo = impulse_frame + 96
    second_echo = impulse_frame + 192

    assert normal[first_echo, 0] == pytest.approx(inverse[first_echo, 0], abs=1.0e-5)
    assert normal[first_echo, 0] > 0.4
    assert normal[second_echo, 0] > 0.25
    assert inverse[second_echo, 0] < -0.25


def test_flange_extremes_stay_bounded_and_exit_without_a_tail(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _complex_signal(STEP_FRAMES * 7) * 0.35
    output = _render_flange(
        generated_runtime,
        tmp_path,
        source,
        delay_ms=10.0,
        depth_ms=10.0,
        rate_hz=10.0,
        feedback=0.95,
        spread_degrees=180.0,
        polarity=1.0,
        first_step=1,
        active_steps=3,
    )
    release = STEP_FRAMES * 4

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 4.001
    assert _largest_boundary_jump(output[:, 0], 4) < 0.2
    np.testing.assert_allclose(output[release + 160 :], source[release + 160 :], atol=1.0e-7, rtol=0.0)


def test_flange_retrigger_with_identical_settings_preserves_phase_and_feedback_state(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    params = [1.2, 4.0, 2.5, 0.65, 90.0, 0.0, 1.0, 5.0]
    continuous_upload = _empty_upload()
    retrigger_upload = _empty_upload()
    for step in range(1, 7):
        _activate_step(
            continuous_upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 1),
            effect_type=EFFECT_FLANGE,
            params=params,
        )
        _activate_step(
            retrigger_upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step in (1, 3)),
            effect_type=EFFECT_FLANGE,
            params=params,
        )
    source = _complex_signal(STEP_FRAMES * 9) * 0.25
    continuous = _render(generated_runtime, tmp_path, source, _base_schedule(continuous_upload))
    retriggered = _render(generated_runtime, tmp_path, source, _base_schedule(retrigger_upload))

    np.testing.assert_array_equal(retriggered, continuous)


def test_flange_aux_sweeps_every_continuous_control_without_runaway(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    params = [0.2, 0.0, 0.02, 0.0, 0.0, 0.0, 1.0, 5.0]
    for step in range(4):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            effect_type=EFFECT_FLANGE,
            params=params,
        )
    for param, end in ((0, 10.0), (1, 10.0), (2, 10.0), (3, 0.95), (4, 180.0)):
        _set_aux(upload, lane=LANE_FILTER, step=0, param=param, end=end, shape=0.0)

    source = _complex_signal(STEP_FRAMES * 6) * 0.5
    output = _render(generated_runtime, tmp_path, source, _base_schedule(upload))

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 4.001


def test_flange_authoritative_reset_invalidates_feedback_history(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    params = [2.0, 0.0, 0.28, 0.9, 0.0, 0.0, 1.0, 5.0]
    for step in range(5):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 0),
            effect_type=EFFECT_FLANGE,
            params=params,
        )
    source = np.zeros((STEP_FRAMES * 6, 2), dtype=np.float32)
    source[4_200] = 1.0
    baseline = _render(generated_runtime, tmp_path, source, _base_schedule(upload))
    reset_schedule = _base_schedule(upload)
    reset_schedule[4_500] = [["event", "internalReset", 1]]
    reset = _render(generated_runtime, tmp_path, source, reset_schedule)

    assert _rms(baseline[5_000:6_500]) > 1.0e-3
    assert _rms(reset[5_000:6_500]) < _rms(baseline[5_000:6_500]) * 0.02


def test_flange_four_chain_extremes_remain_faster_than_the_generous_js_budget(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    params = [10.0, 10.0, 10.0, 0.95, 180.0, 1.0, 1.0, 5.0]
    for lane in range(LANE_COUNT):
        for step in range(4):
            _activate_step(
                upload,
                lane=lane,
                step=step,
                trigger=(step == 0),
                effect_type=EFFECT_FLANGE,
                params=params,
            )
    source = _complex_signal(STEP_FRAMES * 4) * 0.3
    started = perf_counter()
    output = _render(generated_runtime, tmp_path, source, _base_schedule(upload))
    elapsed = perf_counter() - started

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 4.001
    assert elapsed < 2.0, f"four-chain generated-JS render took {elapsed:.3f}s for {source.shape[0] / SAMPLE_RATE:.3f}s audio"


def _render_pitch(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    input_audio: np.ndarray,
    *,
    semitones: float = 12.0,
    fine_cents: float = 0.0,
    grain_ms: float = 48.0,
    jitter: float = 0.0,
    spread: float = 0.0,
    first_step: int = 3,
    active_steps: int = 12,
    mix: float = 1.0,
) -> np.ndarray:
    upload = _empty_upload()
    params = [semitones, fine_cents, grain_ms, jitter, spread]
    for step in range(first_step, min(STEP_COUNT, first_step + active_steps)):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == first_step),
            mix=mix,
            effect_type=EFFECT_PITCH,
            params=params,
        )
    return _render(generated_runtime, tmp_path, input_audio, _base_schedule(upload))


@pytest.mark.parametrize(
    ("semitones", "fine_cents", "expected_hz"),
    [
        (12.0, 0.0, 880.0),
        (-12.0, 0.0, 220.0),
        (0.0, 50.0, 440.0 * (2.0 ** (0.5 / 12.0))),
    ],
)
def test_pitch_tracks_semitones_and_fine_cents_on_a_sustained_tone(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    semitones: float,
    fine_cents: float,
    expected_hz: float,
) -> None:
    source = _sine(STEP_FRAMES * 20, 440.0, amplitude=0.35)
    output = _render_pitch(
        generated_runtime,
        tmp_path,
        source,
        semitones=semitones,
        fine_cents=fine_cents,
        first_step=3,
        active_steps=14,
    )
    window = output[STEP_FRAMES * 6 : STEP_FRAMES * 15, 0]

    measured = _dominant_frequency_near(window, expected_hz)
    assert measured == pytest.approx(expected_hz, abs=0.8)


def test_pitch_zero_shift_is_bit_exact_pass_through(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _complex_signal(STEP_FRAMES * 8) * 0.4
    output = _render_pitch(
        generated_runtime,
        tmp_path,
        source,
        semitones=0.0,
        fine_cents=0.0,
        first_step=1,
        active_steps=5,
    )

    np.testing.assert_array_equal(output, source)


def test_pitch_grain_lookback_bounds_transient_smear_without_future_audio(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    frames = STEP_FRAMES * 14
    impulse_frame = STEP_FRAMES * 6 + 500
    source = np.zeros((frames, 2), dtype=np.float32)
    source[impulse_frame] = 0.8
    output = _render_pitch(
        generated_runtime,
        tmp_path,
        source,
        semitones=12.0,
        grain_ms=60.0,
        first_step=4,
        active_steps=8,
    )
    audible = np.flatnonzero(np.abs(output[:, 0]) > 1.0e-5)

    assert audible.size > 0
    assert int(audible[0]) >= impulse_frame
    assert int(audible[-1]) < impulse_frame + 8_000


def test_pitch_jitter_is_seeded_repeatable_and_changes_grain_texture(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _complex_signal(STEP_FRAMES * 16) * 0.3
    jittered_a = _render_pitch(
        generated_runtime,
        tmp_path,
        source,
        semitones=7.0,
        grain_ms=36.0,
        jitter=1.0,
        spread=0.0,
        first_step=4,
        active_steps=10,
    )
    jittered_b = _render_pitch(
        generated_runtime,
        tmp_path,
        source,
        semitones=7.0,
        grain_ms=36.0,
        jitter=1.0,
        spread=0.0,
        first_step=4,
        active_steps=10,
    )
    stable = _render_pitch(
        generated_runtime,
        tmp_path,
        source,
        semitones=7.0,
        grain_ms=36.0,
        jitter=0.0,
        spread=0.0,
        first_step=4,
        active_steps=10,
    )
    window = slice(STEP_FRAMES * 6, STEP_FRAMES * 13)

    np.testing.assert_array_equal(jittered_a, jittered_b)
    assert _rms(jittered_a[window, 0] - stable[window, 0]) > 0.005


def test_pitch_zero_shift_jitter_renews_grains_without_drifting_out_of_history(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _sine(STEP_FRAMES * 48, 440.0, amplitude=0.3)
    output = _render_pitch(
        generated_runtime,
        tmp_path,
        source,
        semitones=0.0,
        fine_cents=0.0,
        grain_ms=32.0,
        jitter=1.0,
        spread=0.0,
        first_step=0,
        active_steps=16,
    )
    late = slice(STEP_FRAMES * 40, STEP_FRAMES * 47)

    assert np.all(np.isfinite(output))
    assert _rms(output[late, 0] - source[late, 0]) > 0.002


def test_pitch_spread_has_dual_mono_zero_and_a_useful_mono_fold(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _complex_signal(STEP_FRAMES * 16) * 0.3
    centered = _render_pitch(
        generated_runtime,
        tmp_path,
        source,
        semitones=7.0,
        grain_ms=48.0,
        spread=0.0,
        first_step=4,
        active_steps=10,
    )
    wide = _render_pitch(
        generated_runtime,
        tmp_path,
        source,
        semitones=7.0,
        grain_ms=48.0,
        spread=1.0,
        first_step=4,
        active_steps=10,
    )
    window = slice(STEP_FRAMES * 6, STEP_FRAMES * 13)

    np.testing.assert_allclose(centered[window, 0], centered[window, 1], atol=1.0e-7, rtol=0.0)
    assert _rms(wide[window, 0] - wide[window, 1]) > 0.01
    assert _rms(np.mean(wide[window], axis=1)) > 0.02


def test_pitch_identical_retrigger_preserves_grain_phase_and_rng_state(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    params = [7.0, 20.0, 42.0, 0.7, 0.6]
    continuous_upload = _empty_upload()
    retrigger_upload = _empty_upload()
    for step in range(3, 11):
        _activate_step(
            continuous_upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 3),
            effect_type=EFFECT_PITCH,
            params=params,
        )
        _activate_step(
            retrigger_upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step in (3, 7)),
            effect_type=EFFECT_PITCH,
            params=params,
        )
    source = _complex_signal(STEP_FRAMES * 14) * 0.25
    continuous = _render(generated_runtime, tmp_path, source, _base_schedule(continuous_upload))
    retriggered = _render(generated_runtime, tmp_path, source, _base_schedule(retrigger_upload))

    np.testing.assert_array_equal(retriggered, continuous)


def test_pitch_aux_sweeps_continuous_controls_and_excludes_grain_size(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    params = [-12.0, -100.0, 48.0, 0.0, 0.0]
    for step in range(5, 13):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 5),
            effect_type=EFFECT_PITCH,
            params=params,
        )
    for param, end in ((0, 12.0), (1, 100.0), (3, 1.0), (4, 1.0)):
        _set_aux(upload, lane=LANE_FILTER, step=5, param=param, end=end, shape=0.0)

    source = _complex_signal(STEP_FRAMES * 15) * 0.35
    output = _render(generated_runtime, tmp_path, source, _base_schedule(upload))

    assert upload["auxEnabled"][LANE_FILTER][5][2] is False
    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 4.001


def test_pitch_exit_is_click_safe_and_has_no_output_tail(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _sine(STEP_FRAMES * 10, 997.0, amplitude=0.35)
    output = _render_pitch(
        generated_runtime,
        tmp_path,
        source,
        semitones=-12.0,
        grain_ms=64.0,
        first_step=3,
        active_steps=3,
    )
    release = STEP_FRAMES * 6

    assert _largest_boundary_jump(output[:, 0], 3) < 0.15
    assert _largest_boundary_jump(output[:, 0], 6) < 0.15
    np.testing.assert_allclose(output[release + 160 :], source[release + 160 :], atol=1.0e-7, rtol=0.0)


def test_pitch_authoritative_reset_invalidates_warm_source_history(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    params = [12.0, 0.0, 72.0, 0.0, 0.0]
    for step in range(4, 10):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 4),
            effect_type=EFFECT_PITCH,
            params=params,
        )
    source = np.zeros((STEP_FRAMES * 12, 2), dtype=np.float32)
    impulse_frame = STEP_FRAMES * 5 + 500
    source[impulse_frame] = 1.0
    baseline = _render(generated_runtime, tmp_path, source, _base_schedule(upload))
    reset_schedule = _base_schedule(upload)
    reset_schedule[impulse_frame + 20] = [["event", "internalReset", 1]]
    reset = _render(generated_runtime, tmp_path, source, reset_schedule)
    tail = slice(impulse_frame + 100, impulse_frame + 10_000)

    assert _rms(baseline[tail]) > 1.0e-4
    assert _rms(reset[tail]) < _rms(baseline[tail]) * 0.02


def test_pitch_four_chain_extremes_remain_faster_than_the_generous_js_budget(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    params = [24.0, 100.0, 120.0, 1.0, 1.0]
    for lane in range(LANE_COUNT):
        for step in range(4, 8):
            _activate_step(
                upload,
                lane=lane,
                step=step,
                trigger=(step == 4),
                effect_type=EFFECT_PITCH,
                params=params,
            )
    source = _complex_signal(STEP_FRAMES * 10) * 0.3
    started = perf_counter()
    output = _render(generated_runtime, tmp_path, source, _base_schedule(upload))
    elapsed = perf_counter() - started

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 4.001
    assert elapsed < 2.0, f"four-chain generated-JS render took {elapsed:.3f}s for {source.shape[0] / SAMPLE_RATE:.3f}s audio"


def _render_reverse(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    input_audio: np.ndarray,
    *,
    division: int = 4,
    crossfade: float = 0.0,
    timing_mode: int = 0,
    free_ms: float = 250.0,
    decay: float = 1.0,
    first_step: int = 3,
    active_steps: int = 4,
    mix: float = 1.0,
    sample_rate: int = SAMPLE_RATE,
) -> np.ndarray:
    upload = _empty_upload()
    params = [float(division), crossfade, float(timing_mode), free_ms, decay]
    for step in range(first_step, min(STEP_COUNT, first_step + active_steps)):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == first_step),
            mix=mix,
            effect_type=EFFECT_REVERSE,
            params=params,
        )
    return _render(
        generated_runtime,
        tmp_path,
        input_audio,
        _base_schedule(upload),
        sample_rate=sample_rate,
    )


def test_reverse_plays_the_immediately_preceding_cell_backward_without_future_audio(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    frames = STEP_FRAMES * 8
    trigger_frame = STEP_FRAMES * 3
    source = np.zeros((frames, 2), dtype=np.float32)
    preceding = np.linspace(-0.8, 0.8, STEP_FRAMES, dtype=np.float32)
    source[trigger_frame - STEP_FRAMES : trigger_frame, 0] = preceding
    source[trigger_frame - STEP_FRAMES : trigger_frame, 1] = preceding
    source[trigger_frame + 500] = 0.95

    output = _render_reverse(
        generated_runtime,
        tmp_path,
        source,
        division=4,
        crossfade=0.0,
        first_step=3,
        active_steps=2,
    )

    window = slice(trigger_frame + 128, trigger_frame + STEP_FRAMES - 128)
    expected = preceding[::-1][128 : STEP_FRAMES - 128]
    correlation = float(np.corrcoef(output[window, 0], expected)[0, 1])
    assert correlation > 0.995
    assert float(np.max(np.abs(output[trigger_frame + 128 : trigger_frame + 480, 0]))) < 0.9


def test_reverse_rolls_forward_to_fresh_lookback_windows_while_the_block_stays_active(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    frames = STEP_FRAMES * 10
    trigger_step = 3
    source = np.zeros((frames, 2), dtype=np.float32)
    values = [0.12, 0.36, 0.68, -0.24]
    for offset, value in enumerate(values):
        end = STEP_FRAMES * (trigger_step + offset)
        source[end - STEP_FRAMES : end] = value

    output = _render_reverse(
        generated_runtime,
        tmp_path,
        source,
        division=4,
        crossfade=0.0,
        first_step=trigger_step,
        active_steps=5,
    )

    measured = []
    for offset in range(3):
        start = STEP_FRAMES * (trigger_step + offset) + 160
        measured.append(float(np.mean(output[start : start + STEP_FRAMES - 320, 0])))
    np.testing.assert_allclose(measured, values[:3], atol=0.015, rtol=0.0)


def test_reverse_proportional_crossfade_smooths_rolling_window_boundaries(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    frames = STEP_FRAMES * 9
    trigger_step = 3
    source = np.zeros((frames, 2), dtype=np.float32)
    for step in range(frames // STEP_FRAMES):
        source[step * STEP_FRAMES : (step + 1) * STEP_FRAMES] = 0.75 if step % 2 == 0 else -0.75

    (tmp_path / "hard").mkdir()
    (tmp_path / "smooth").mkdir()
    hard = _render_reverse(
        generated_runtime,
        tmp_path / "hard",
        source,
        division=4,
        crossfade=0.0,
        first_step=trigger_step,
        active_steps=4,
    )
    smooth = _render_reverse(
        generated_runtime,
        tmp_path / "smooth",
        source,
        division=4,
        crossfade=0.2,
        first_step=trigger_step,
        active_steps=4,
    )
    boundary = STEP_FRAMES * (trigger_step + 1)
    hard_jump = float(np.max(np.abs(np.diff(hard[boundary - 8 : boundary + 8, 0]))))
    smooth_jump = float(np.max(np.abs(np.diff(smooth[boundary - 8 : boundary + 8, 0]))))

    assert hard_jump > 1.0
    assert smooth_jump < hard_jump * 0.1


def test_reverse_free_length_and_decay_are_bounded_to_the_authored_block(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    frames = STEP_FRAMES * 12
    trigger_step = 4
    trigger_frame = STEP_FRAMES * trigger_step
    source = _complex_signal(frames) * 0.35
    output = _render_reverse(
        generated_runtime,
        tmp_path,
        source,
        timing_mode=1,
        free_ms=125.0,
        crossfade=0.1,
        decay=0.5,
        first_step=trigger_step,
        active_steps=4,
    )

    early_delta = _rms(output[trigger_frame + 256 : trigger_frame + 2_000, 0] - source[trigger_frame + 256 : trigger_frame + 2_000, 0])
    after_decay = STEP_FRAMES * (trigger_step + 2) + 512
    late_delta = _rms(output[after_decay : after_decay + 1_500, 0] - source[after_decay : after_decay + 1_500, 0])
    block_end = STEP_FRAMES * (trigger_step + 4)

    assert early_delta > 0.05
    assert late_delta < early_delta * 0.08
    np.testing.assert_allclose(output[block_end + 160 :], source[block_end + 160 :], atol=2.0e-5, rtol=0.0)


def test_reverse_free_length_reads_the_requested_125_ms_window(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    frames = STEP_FRAMES * 10
    trigger_frame = STEP_FRAMES * 4
    source = np.zeros((frames, 2), dtype=np.float32)
    captured = np.linspace(-0.7, 0.7, STEP_FRAMES * 2, dtype=np.float32)
    source[trigger_frame - captured.size : trigger_frame, 0] = captured
    source[trigger_frame - captured.size : trigger_frame, 1] = captured

    output = _render_reverse(
        generated_runtime,
        tmp_path,
        source,
        timing_mode=1,
        free_ms=125.0,
        crossfade=0.0,
        first_step=4,
        active_steps=3,
    )
    window = slice(trigger_frame + 160, trigger_frame + captured.size - 160)
    expected = captured[::-1][160 : captured.size - 160]

    assert float(np.corrcoef(output[window, 0], expected)[0, 1]) > 0.995


def test_reverse_one_cell_length_tracks_host_sample_rate_while_history_stays_fixed_48k(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    sample_rate = 96_000
    step_frames = 6_000
    trigger_frame = step_frames * 3
    source = np.zeros((step_frames * 7, 2), dtype=np.float32)
    preceding = np.linspace(-0.75, 0.75, step_frames, dtype=np.float32)
    source[trigger_frame - step_frames : trigger_frame, 0] = preceding
    source[trigger_frame - step_frames : trigger_frame, 1] = preceding
    output = _render_reverse(
        generated_runtime,
        tmp_path,
        source,
        division=4,
        crossfade=0.0,
        first_step=3,
        active_steps=2,
        sample_rate=sample_rate,
    )
    window = slice(trigger_frame + 256, trigger_frame + step_frames - 256)
    expected = preceding[::-1][256 : step_frames - 256]

    assert float(np.corrcoef(output[window, 0], expected)[0, 1]) > 0.995


def test_reverse_cold_start_uses_dry_audio_until_a_complete_window_exists(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    source = _complex_signal(STEP_FRAMES * 6) * 0.3
    output = _render_reverse(
        generated_runtime,
        tmp_path,
        source,
        division=4,
        crossfade=0.08,
        first_step=0,
        active_steps=5,
    )

    np.testing.assert_array_equal(output[: STEP_FRAMES - 8], source[: STEP_FRAMES - 8])
    assert _rms(output[STEP_FRAMES + 256 : STEP_FRAMES * 2, 0] - source[STEP_FRAMES + 256 : STEP_FRAMES * 2, 0]) > 0.03


def test_reverse_retrigger_and_third_trigger_remain_bounded_and_click_screened(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    params = [4.0, 0.2, 0.0, 250.0, 1.0]
    for step in range(3, 8):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step in (3, 4, 5)),
            effect_type=EFFECT_REVERSE,
            params=params,
        )
    source = _complex_signal(STEP_FRAMES * 10) * 0.3
    output = _render(generated_runtime, tmp_path, source, _base_schedule(upload))

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 1.25
    for boundary_step in (3, 4, 5, 8):
        assert _largest_boundary_jump(output[:, 0], boundary_step) < 0.35


def test_reverse_aux_sweeps_only_crossfade_and_decay_without_runaway(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    params = [4.0, 0.0, 0.0, 250.0, 1.0]
    for step in range(3, 9):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 3),
            effect_type=EFFECT_REVERSE,
            params=params,
        )
    _set_aux(upload, lane=LANE_FILTER, step=3, param=1, end=0.25, shape=0.0)
    _set_aux(upload, lane=LANE_FILTER, step=3, param=4, end=0.15, shape=0.0)
    source = _complex_signal(STEP_FRAMES * 11) * 0.35
    output = _render(generated_runtime, tmp_path, source, _base_schedule(upload))

    assert upload["auxEnabled"][LANE_FILTER][3][0] is False
    assert upload["auxEnabled"][LANE_FILTER][3][2] is False
    assert upload["auxEnabled"][LANE_FILTER][3][3] is False
    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 1.25


def test_reverse_authoritative_reset_invalidates_warm_lookback_history(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    params = [4.0, 0.1, 0.0, 250.0, 1.0]
    for step in range(4, 9):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 4),
            effect_type=EFFECT_REVERSE,
            params=params,
        )
    source = np.zeros((STEP_FRAMES * 11, 2), dtype=np.float32)
    source[STEP_FRAMES * 3 : STEP_FRAMES * 4] = _complex_signal(STEP_FRAMES) * 0.5
    (tmp_path / "baseline").mkdir()
    (tmp_path / "reset").mkdir()
    baseline = _render(generated_runtime, tmp_path / "baseline", source, _base_schedule(upload))
    reset_schedule = _base_schedule(upload)
    reset_frame = STEP_FRAMES * 4 + 400
    reset_schedule[reset_frame] = [["event", "internalReset", 1]]
    reset = _render(generated_runtime, tmp_path / "reset", source, reset_schedule)
    tail = slice(reset_frame + 160, reset_frame + 2_000)

    assert _rms(baseline[tail]) > 0.01
    assert _rms(reset[tail]) < _rms(baseline[tail]) * 0.02


def test_reverse_four_chain_maximum_windows_remain_within_the_generated_js_budget(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
) -> None:
    upload = _empty_upload()
    params = [3.0, 0.25, 0.0, 4000.0, 0.0]
    for lane in range(LANE_COUNT):
        for step in range(4, 9):
            _activate_step(
                upload,
                lane=lane,
                step=step,
                trigger=(step == 4),
                effect_type=EFFECT_REVERSE,
                params=params,
            )
    source = _complex_signal(STEP_FRAMES * 11) * 0.25
    started = perf_counter()
    output = _render(generated_runtime, tmp_path, source, _base_schedule(upload, manual_bpm=20.0))
    elapsed = perf_counter() - started

    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 4.001
    assert elapsed < 2.0, f"four-chain generated-JS render took {elapsed:.3f}s for {source.shape[0] / SAMPLE_RATE:.3f}s audio"
