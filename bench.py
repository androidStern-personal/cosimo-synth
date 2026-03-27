from __future__ import annotations

from dataclasses import dataclass
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Callable, Mapping, Protocol, Sequence
import os

import numpy as np
import numpy.typing as npt
from scipy.fft import rfft, rfftfreq
from scipy.io import wavfile
from scipy.signal import ShortTimeFFT

Float32Array = npt.NDArray[np.float32]
Float64Array = npt.NDArray[np.float64]

SAMPLES_PER_FRAME = 2048
MSEG_BODY_SAMPLES = 2048
MSEG_PADDED_SAMPLES = 2051
DEFAULT_SAMPLE_RATE = 44_100
DEFAULT_STATIC_FREQUENCY_HZ = 441.0
DEFAULT_FIXTURE_PEAK = 0.99
BRIGHT_HARMONIC_COUNT = 32
BRIGHT_PHASE_SEED = 1_729
DUMP_ENV_VAR = "WTBENCH_DUMP"
ARTIFACTS_DIR = Path("artifacts")
SPECTROGRAM_SEGMENT_SIZE = 1024
SPECTROGRAM_OVERLAP = 768
OSCILLATOR_MIP_COUNT = 11
BRIGHTEST_MIP_INDEX = OSCILLATOR_MIP_COUNT - 1
MAX_MIP_HARMONICS = 1 << BRIGHTEST_MIP_INDEX
SYNC_SAW_FRAME_RATIOS: tuple[float, ...] = (
    1.0,
    1.125,
    1.25,
    1.375,
    1.5,
    1.75,
    2.0,
    2.5,
    3.0,
    3.5,
    4.0,
    5.0,
    6.0,
    8.0,
    12.0,
    16.0,
)
DISPLAY_DEMO_FRAME_COUNT = 16
MIP_LEVEL_THRESHOLDS: tuple[tuple[int, np.float32], ...] = tuple(
    (level, np.float32(1.0 / float(1 << (level + 1))))
    for level in range(BRIGHTEST_MIP_INDEX, 0, -1)
)
CMAJOR_FIXED_FRAME_SOURCE = (
    Path(__file__).resolve().parent / "cmajor" / "FixedFrameOscillator.cmajor"
)
CMAJOR_MSEG_SOURCE = Path(__file__).resolve().parent / "cmajor" / "Mseg.cmajor"


@dataclass(frozen=True, slots=True)
class FixtureBank:
    name: str
    frames: Float32Array

    def __post_init__(self) -> None:
        frames = np.asarray(self.frames, dtype=np.float32)

        if frames.ndim != 2:
            raise ValueError("FixtureBank.frames must be a 2-D array")
        if frames.shape[1] != SAMPLES_PER_FRAME:
            raise ValueError(
                f"FixtureBank.frames must have {SAMPLES_PER_FRAME} samples per frame"
            )
        if not np.isfinite(frames).all():
            raise ValueError("FixtureBank.frames must contain only finite values")

        object.__setattr__(self, "frames", frames)

    @property
    def num_frames(self) -> int:
        return int(self.frames.shape[0])

    @property
    def samples_per_frame(self) -> int:
        return SAMPLES_PER_FRAME


@dataclass(frozen=True, slots=True)
class Recipe:
    name: str
    sample_rate: int
    num_samples: int
    freq_hz_curve: Float64Array
    frame_pos_curve: Float64Array
    start_phase: float = 0.0

    def __post_init__(self) -> None:
        freq_hz_curve = np.asarray(self.freq_hz_curve, dtype=np.float64)
        frame_pos_curve = np.asarray(self.frame_pos_curve, dtype=np.float64)

        if self.sample_rate <= 0:
            raise ValueError("Recipe.sample_rate must be positive")
        if self.num_samples <= 0:
            raise ValueError("Recipe.num_samples must be positive")
        if freq_hz_curve.shape != (self.num_samples,):
            raise ValueError("Recipe.freq_hz_curve must match num_samples")
        if frame_pos_curve.shape != (self.num_samples,):
            raise ValueError("Recipe.frame_pos_curve must match num_samples")
        if not np.isfinite(freq_hz_curve).all():
            raise ValueError("Recipe.freq_hz_curve must contain only finite values")
        if not np.isfinite(frame_pos_curve).all():
            raise ValueError("Recipe.frame_pos_curve must contain only finite values")
        if (freq_hz_curve <= 0.0).any():
            raise ValueError("Recipe.freq_hz_curve must stay above 0 Hz")
        if ((frame_pos_curve < 0.0) | (frame_pos_curve > 1.0)).any():
            raise ValueError("Recipe.frame_pos_curve must stay in the range [0, 1]")
        if not np.isfinite(self.start_phase):
            raise ValueError("Recipe.start_phase must be finite")
        if not 0.0 <= self.start_phase < 1.0:
            raise ValueError("Recipe.start_phase must stay in the range [0, 1)")

        object.__setattr__(self, "freq_hz_curve", freq_hz_curve)
        object.__setattr__(self, "frame_pos_curve", frame_pos_curve)


@dataclass(frozen=True, slots=True)
class MsegPoint:
    x: float
    y: float
    curve_power: float = 0.0


@dataclass(frozen=True, slots=True)
class MsegShape:
    points: tuple[MsegPoint, ...]
    global_smooth: bool = False

    def __post_init__(self) -> None:
        if len(self.points) < 2:
            raise ValueError("MsegShape.points must contain at least two points")

        if self.points[0].x != 0.0 or self.points[-1].x != 1.0:
            raise ValueError("MsegShape.points must start at 0.0 and end at 1.0")

        previous_x = self.points[0].x
        for point in self.points:
            if not np.isfinite(point.x) or not np.isfinite(point.y) or not np.isfinite(point.curve_power):
                raise ValueError("MsegShape points must contain only finite values")
            if point.x < previous_x:
                raise ValueError("MsegShape.points must stay in non-decreasing x order")
            previous_x = point.x


@dataclass(frozen=True, slots=True)
class MsegPlayback:
    seconds: float
    hold_final_value: bool = True

    def __post_init__(self) -> None:
        if not np.isfinite(self.seconds) or self.seconds <= 0.0:
            raise ValueError("MsegPlayback.seconds must be positive and finite")


class Probe(Protocol):
    def render(self, bank: FixtureBank, recipe: Recipe) -> Float32Array:
        ...


def render_case(probe: Probe, bank: FixtureBank, recipe: Recipe) -> Float32Array:
    audio = np.asarray(probe.render(bank, recipe), dtype=np.float32)

    if audio.shape != (recipe.num_samples,):
        raise ValueError(
            f"Probe returned shape {audio.shape}, expected {(recipe.num_samples,)}"
        )

    return audio


def _require_cmaj_cli() -> str:
    cmaj = shutil.which("cmaj")
    if cmaj is None:
        raise RuntimeError("cmaj CLI is required to render the fixed-frame oscillator")
    return cmaj


def _require_node_cli() -> str:
    node = shutil.which("node")
    if node is None:
        raise RuntimeError("node is required to render generated Cmajor javascript runtimes")
    return node


def _require_constant_curve(curve: Float64Array, label: str) -> float:
    value = float(curve[0])
    if not np.array_equal(curve, np.full(curve.shape, value, dtype=np.float64)):
        raise ValueError(f"{label} must stay constant for the fixed-frame Cmajor render")
    return value


def _cmajor_float_literal(value: float) -> str:
    literal = repr(float(value))
    if "e" not in literal and "." not in literal:
        literal += ".0"
    return literal + "f"


def _cmajor_bool_literal(value: bool) -> str:
    return "true" if value else "false"


def _cmajor_int_literal(value: int) -> str:
    return str(int(value))


def _cmajor_float_array_literal(values: Sequence[float]) -> str:
    return ", ".join(_cmajor_float_literal(float(value)) for value in values)


def _cmajor_int_array_literal(values: Sequence[int]) -> str:
    return ", ".join(_cmajor_int_literal(int(value)) for value in values)


def _curve_to_linear_segments(curve: Float64Array) -> list[tuple[int, float, float]]:
    curve64 = np.asarray(curve, dtype=np.float64)
    if curve64.ndim != 1 or curve64.size == 0:
        raise ValueError("curve must be a non-empty 1-D array")

    if curve64.size == 1:
        return [(0, float(curve64[0]), 0.0)]

    segments: list[tuple[int, float, float]] = []
    current_delta = float(curve64[1] - curve64[0])
    segments.append((0, float(curve64[0]), current_delta))

    for sample_index in range(2, curve64.size):
        delta = float(curve64[sample_index] - curve64[sample_index - 1])
        if not np.isclose(delta, current_delta, rtol=0.0, atol=1e-12):
            segments.append((sample_index - 1, float(curve64[sample_index - 1]), delta))
            current_delta = delta

    return segments


def _build_fixed_frame_wrapper_source(
    *,
    initial_frequency_hz: float,
    start_phase: float,
    frame_position_curve: Float64Array,
    initial_table_index: int,
    table_index_events: Sequence[tuple[int, int]],
    frequency_events: Sequence[tuple[int, float]],
) -> str:
    num_samples = int(frame_position_curve.size)
    if num_samples <= 0:
        raise ValueError("frame_position_curve must contain at least one sample")

    frequency_offsets = [int(offset) for offset, _ in frequency_events]
    frequency_values = [float(value) for _, value in frequency_events]
    table_event_offsets = [int(offset) for offset, _ in table_index_events]
    table_event_values = [float(value) for _, value in table_index_events]
    frame_segments = _curve_to_linear_segments(frame_position_curve)
    frame_segment_offsets = [offset for offset, _, _ in frame_segments]
    frame_segment_values = [value for _, value, _ in frame_segments]
    frame_segment_deltas = [delta for _, _, delta in frame_segments]

    frequency_storage_size = max(len(frequency_offsets), 1)
    table_storage_size = max(len(table_event_offsets), 1)
    frame_segment_storage_size = max(len(frame_segments), 1)
    stored_frequency_offsets = frequency_offsets or [0]
    stored_frequency_values = frequency_values or [0.0]
    stored_table_offsets = table_event_offsets or [0]
    stored_table_values = table_event_values or [float(initial_table_index)]

    return (
        "processor FixedFrameProbeControl\n"
        + "{\n"
        + "    output event float32 frequencyOut;\n"
        + "    output stream float32 framePositionOut;\n"
        + "    output value float32 tableSelectOut;\n"
        + "    let frequencyEventCount = "
        + _cmajor_int_literal(len(frequency_offsets))
        + ";\n"
        + "    let tableEventCount = "
        + _cmajor_int_literal(len(table_event_offsets))
        + ";\n"
        + "    let frameSegmentCount = "
        + _cmajor_int_literal(len(frame_segments))
        + ";\n"
        + "    int32["
        + _cmajor_int_literal(frame_segment_storage_size)
        + "] frameSegmentOffsets = ("
        + _cmajor_int_array_literal(frame_segment_offsets)
        + ");\n"
        + "    float32["
        + _cmajor_int_literal(frame_segment_storage_size)
        + "] frameSegmentValues = ("
        + _cmajor_float_array_literal(frame_segment_values)
        + ");\n"
        + "    float32["
        + _cmajor_int_literal(frame_segment_storage_size)
        + "] frameSegmentDeltas = ("
        + _cmajor_float_array_literal(frame_segment_deltas)
        + ");\n"
        + "    int32["
        + _cmajor_int_literal(frequency_storage_size)
        + "] frequencyEventOffsets = ("
        + _cmajor_int_array_literal(stored_frequency_offsets)
        + ");\n"
        + "    float32["
        + _cmajor_int_literal(frequency_storage_size)
        + "] frequencyEventValues = ("
        + _cmajor_float_array_literal(stored_frequency_values)
        + ");\n"
        + "    int32["
        + _cmajor_int_literal(table_storage_size)
        + "] tableEventOffsets = ("
        + _cmajor_int_array_literal(stored_table_offsets)
        + ");\n"
        + "    float32["
        + _cmajor_int_literal(table_storage_size)
        + "] tableEventValues = ("
        + _cmajor_float_array_literal(stored_table_values)
        + ");\n"
        + "    int32 frameIndex = 0;\n"
        + "    int32 currentFrameSegment = 0;\n"
        + "    int32 nextFrequencyEvent = 0;\n"
        + "    int32 nextTableEvent = 0;\n"
        + "    void main()\n"
        + "    {\n"
        + "        tableSelectOut <- "
        + _cmajor_float_literal(float(initial_table_index))
        + ";\n"
        + "        loop\n"
        + "        {\n"
        + "            if (nextFrequencyEvent < frequencyEventCount && frameIndex == frequencyEventOffsets.at (nextFrequencyEvent))\n"
        + "            {\n"
        + "                frequencyOut <- frequencyEventValues.at (nextFrequencyEvent);\n"
        + "                nextFrequencyEvent += 1;\n"
        + "            }\n"
        + "            if (nextTableEvent < tableEventCount && frameIndex == tableEventOffsets.at (nextTableEvent))\n"
        + "            {\n"
        + "                tableSelectOut <- tableEventValues.at (nextTableEvent);\n"
        + "                nextTableEvent += 1;\n"
        + "            }\n"
        + "            if (currentFrameSegment + 1 < frameSegmentCount && frameIndex >= frameSegmentOffsets.at (currentFrameSegment + 1))\n"
        + "                currentFrameSegment += 1;\n"
        + "            let segmentStart = frameSegmentOffsets.at (currentFrameSegment);\n"
        + "            let segmentOffset = frameIndex - segmentStart;\n"
        + "            framePositionOut <- frameSegmentValues.at (currentFrameSegment) + (frameSegmentDeltas.at (currentFrameSegment) * float32 (segmentOffset));\n"
        + "            advance();\n"
        + "            frameIndex += 1;\n"
        + "        }\n"
        + "    }\n"
        + "}\n"
        + "graph FixedFrameProbe [[ main ]]\n"
        + "{\n"
        + "    output stream float out;\n"
        + "    node control = FixedFrameProbeControl;\n"
        + "    node osc = wt::FixedFrameOscillator ("
        + _cmajor_float_literal(initial_frequency_hz)
        + ", "
        + _cmajor_float_literal(start_phase)
        + ");\n"
        + "    connection\n"
        + "    {\n"
        + "        control.frequencyOut -> osc.frequencyIn;\n"
        + "        control.framePositionOut -> osc.framePositionIn;\n"
        + "        control.tableSelectOut -> osc.tableSelectIn;\n"
        + "        osc.out -> out;\n"
        + "    }\n"
        + "}\n"
    )


def _build_fixed_frame_patch_manifest(
    *,
    source_files: Sequence[str] | str,
    manifest_value: dict[str, object],
) -> dict[str, object]:
    return {
        "CmajorVersion": 1,
        "ID": "dev.cosimo.fixed-frame-probe",
        "version": "1.0",
        "name": "Fixed Frame Probe",
        "description": "Renders the checked-in fixed-frame wavetable oscillator",
        "category": "generator",
        "source": source_files if isinstance(source_files, str) else list(source_files),
        "externals": {
            "wt::factoryBank": manifest_value,
        },
    }


def _read_rendered_wav(
    output_path: Path,
    *,
    expected_num_samples: int,
    expected_sample_rate: int,
) -> Float32Array:
    sample_rate, audio = wavfile.read(output_path)
    if sample_rate != expected_sample_rate:
        raise RuntimeError(
            f"Cmajor test runner wrote sample rate {sample_rate}, expected {expected_sample_rate}"
        )
    audio_array = np.asarray(audio, dtype=np.float32)
    if audio_array.ndim == 2:
        if audio_array.shape[1] != 1:
            raise RuntimeError(
                f"Cmajor test runner wrote shape {audio_array.shape}, expected mono audio"
            )
        audio_array = audio_array[:, 0]
    if audio_array.shape != (expected_num_samples,):
        raise RuntimeError(
            f"Cmajor test runner wrote shape {audio_array.shape}, expected {(expected_num_samples,)}"
        )
    return audio_array.copy()


def _run_cmajor_golden_test(
    *,
    patch_path: Path,
    test_path: Path,
    golden_dir_path: Path,
    sample_rate: int,
    expected_audio: Float32Array,
) -> None:
    cmaj = _require_cmaj_cli()
    golden_dir_path.mkdir(parents=True, exist_ok=True)
    expected_wav_path = golden_dir_path / "expectedOutput-out.wav"
    wavfile.write(expected_wav_path, sample_rate, np.asarray(expected_audio, dtype=np.float32))

    test_path.write_text(
        '## runScript({ frequency:'
        + str(sample_rate)
        + ", blockSize:512, samplesToRender:"
        + str(int(expected_audio.shape[0]))
        + ', subDir:"'
        + golden_dir_path.name
        + '", patch:"'
        + patch_path.name
        + '" })\n',
        encoding="utf-8",
    )

    result = subprocess.run(
        [
            cmaj,
            "test",
            str(test_path),
            "--singleThread",
        ],
        cwd=patch_path.parent,
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        details = "\n".join(
            part
            for part in (result.stdout.strip(), result.stderr.strip())
            if part
        )
        raise RuntimeError(f"cmaj test failed:\n{details}")


def _detect_cmajor_generated_class_name(runtime_source: str) -> str:
    match = re.search(r"^class\s+([A-Za-z_][A-Za-z0-9_]*)", runtime_source, re.MULTILINE)
    if match is None:
        raise RuntimeError("Could not find the generated Cmajor javascript class name")
    return match.group(1)


def _render_cmajor_patch_via_generated_javascript(
    patch_path: Path,
    *,
    sample_rate: int,
    num_samples: int,
    output_endpoint_id: str = "out",
    setup_js: str = "",
) -> Float32Array:
    cmaj = _require_cmaj_cli()
    node = _require_node_cli()

    with tempfile.TemporaryDirectory(prefix="cmajor_js_runtime_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        runtime_path = temp_dir / "runtime.cjs"
        output_path = temp_dir / "output.f32"
        render_script_path = temp_dir / "render.cjs"

        generate_result = subprocess.run(
            [
                cmaj,
                "generate",
                "--target=javascript",
                f"--output={runtime_path}",
                str(patch_path),
            ],
            cwd=patch_path.parent,
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
            raise RuntimeError(f"cmaj generate failed:\n{details}")

        runtime_source = runtime_path.read_text(encoding="utf-8")
        class_name = _detect_cmajor_generated_class_name(runtime_source)
        runtime_path.write_text(
            runtime_source + f"\nmodule.exports = {class_name};\n",
            encoding="utf-8",
        )

        render_script_path.write_text(
            """
const fs = require("fs");

const RuntimeClass = require(process.argv[2]);
const outputPath = process.argv[3];
const sampleRate = Number(process.argv[4]);
const numFrames = Number(process.argv[5]);
const outputEndpointID = process.argv[6];

(async () => {
    const patch = new RuntimeClass();
    await patch.initialise(2, sampleRate);
"""
            + (setup_js.strip() + "\n" if setup_js.strip() else "")
            + """

    const outputEndpoint = patch.getOutputEndpoints().find(
        ({ endpointID }) => endpointID === outputEndpointID
    );

    if (!outputEndpoint) {
        throw new Error(`Could not find output endpoint ${outputEndpointID}`);
    }

    const numChannels = outputEndpoint.numAudioChannels || 1;
    if (numChannels !== 1) {
        throw new Error(`Expected mono output for ${outputEndpointID}, got ${numChannels} channels`);
    }

    const getterName = `getOutputFrames_${outputEndpointID}`;
    if (typeof patch[getterName] !== "function") {
        throw new Error(`Generated runtime is missing ${getterName}()`);
    }

    const output = new Float32Array(numFrames);
    let offset = 0;

    while (offset < numFrames) {
        const framesThisBlock = Math.min(512, numFrames - offset);
        patch.advance(framesThisBlock);

        const block = new Float32Array(framesThisBlock);
        patch[getterName]([block], framesThisBlock, 0);
        output.set(block, offset);
        offset += framesThisBlock;
    }

    fs.writeFileSync(outputPath, Buffer.from(output.buffer, output.byteOffset, output.byteLength));
})().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
});
""".lstrip(),
            encoding="utf-8",
        )

        render_result = subprocess.run(
            [
                node,
                str(render_script_path),
                str(runtime_path),
                str(output_path),
                str(sample_rate),
                str(num_samples),
                output_endpoint_id,
            ],
            cwd=patch_path.parent,
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
            raise RuntimeError(f"node runtime render failed:\n{details}")

        audio = np.frombuffer(output_path.read_bytes(), dtype=np.float32)
        if audio.shape != (num_samples,):
            raise RuntimeError(
                f"Generated javascript runtime wrote shape {audio.shape}, expected {(num_samples,)}"
            )

        return audio.copy()


def render_cmajor_fixed_frame_tables(
    source_tables: Sequence[FixtureBank],
    recipe: Recipe,
    *,
    table_index: int = 0,
    frequency_events: Sequence[tuple[int, float]] = (),
    table_index_events: Sequence[tuple[int, int]] = (),
) -> Float32Array:
    from wtbank import build_bank, emit_cmajor_bank_assets

    if not source_tables:
        raise ValueError("render_cmajor_fixed_frame_tables requires at least one FixtureBank")
    if not CMAJOR_FIXED_FRAME_SOURCE.exists():
        raise RuntimeError(
            f"Checked-in oscillator source is missing: {CMAJOR_FIXED_FRAME_SOURCE}"
        )
    if not 0 <= table_index < len(source_tables):
        raise ValueError("table_index must address a table inside source_tables")

    previous_table_event_offset = -1
    baked_table_events: list[tuple[int, int]] = []
    for frame_offset, next_table_index in table_index_events:
        if not 0 <= frame_offset < recipe.num_samples:
            raise ValueError("table_index event frame offsets must stay inside the rendered buffer")
        if frame_offset < previous_table_event_offset:
            raise ValueError("table_index event frame offsets must be sorted in ascending order")
        if not 0 <= next_table_index < len(source_tables):
            raise ValueError("table_index events must address a table inside source_tables")
        previous_table_event_offset = frame_offset
        baked_table_events.append((frame_offset, next_table_index))

    frequency_hz = _require_constant_curve(recipe.freq_hz_curve, "Recipe.freq_hz_curve")
    initial_frequency_hz = frequency_hz
    baked_frequency_events: list[tuple[int, float]] = []
    previous_frequency_event_offset = -1
    for frame_offset, next_frequency_hz in frequency_events:
        if not 0 <= frame_offset < recipe.num_samples:
            raise ValueError("frequency event frame offsets must stay inside the rendered buffer")
        if frame_offset < previous_frequency_event_offset:
            raise ValueError("frequency event frame offsets must be sorted in ascending order")
        previous_frequency_event_offset = frame_offset
        if frame_offset == 0:
            initial_frequency_hz = float(next_frequency_hz)
        else:
            baked_frequency_events.append((frame_offset, float(next_frequency_hz)))

    with tempfile.TemporaryDirectory(prefix="cmajor_fixed_frame_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        assets = emit_cmajor_bank_assets(
            temp_dir,
            build_bank(source_tables).bank,
            sample_rate=recipe.sample_rate,
        )
        combined_source_path = temp_dir / "FixedFrameProbe.cmajor"
        patch_path = temp_dir / "FixedFrameProbe.cmajorpatch"

        combined_source_path.write_text(
            CMAJOR_FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
            + "\n"
            + _build_fixed_frame_wrapper_source(
                initial_frequency_hz=initial_frequency_hz,
                start_phase=recipe.start_phase,
                frame_position_curve=recipe.frame_pos_curve,
                initial_table_index=table_index,
                table_index_events=baked_table_events,
                frequency_events=baked_frequency_events,
            ),
            encoding="utf-8",
        )
        patch_path.write_text(
            json.dumps(
                _build_fixed_frame_patch_manifest(
                    source_files=combined_source_path.name,
                    manifest_value=assets.manifest_value,
                ),
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        return _render_cmajor_patch_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=recipe.sample_rate,
            num_samples=recipe.num_samples,
        )


def _build_mseg_probe_wrapper_source(
    *,
    frequency_hz: float,
    start_phase: float,
    frame_position: float,
    table_index: int,
    depth: float,
    trigger_offsets: Sequence[int],
) -> str:
    trigger_storage_size = max(len(trigger_offsets), 1)
    stored_trigger_offsets = [int(offset) for offset in trigger_offsets] or [0]
    return (
        "processor MsegProbeControl\n"
        + "{\n"
        + "    output event float32 frequencyOut;\n"
        + "    output event int32 triggerOut;\n"
        + "    output stream float32 framePositionOut;\n"
        + "    output value float32 tableSelectOut;\n"
        + "    output value float32 depthOut;\n"
        + "    let triggerEventCount = "
        + _cmajor_int_literal(len(trigger_offsets))
        + ";\n"
        + "    int32["
        + _cmajor_int_literal(trigger_storage_size)
        + "] triggerEventOffsets = ("
        + _cmajor_int_array_literal(stored_trigger_offsets)
        + ");\n"
        + "    bool hasSentFrequency = false;\n"
        + "    int32 frameIndex = 0;\n"
        + "    int32 nextTriggerEvent = 0;\n"
        + "    void main()\n"
        + "    {\n"
        + "        tableSelectOut <- "
        + _cmajor_float_literal(float(table_index))
        + ";\n"
        + "        depthOut <- "
        + _cmajor_float_literal(depth)
        + ";\n"
        + "        loop\n"
        + "        {\n"
        + "            if (! hasSentFrequency)\n"
        + "            {\n"
        + "                frequencyOut <- "
        + _cmajor_float_literal(frequency_hz)
        + ";\n"
        + "                hasSentFrequency = true;\n"
        + "            }\n"
        + "            if (nextTriggerEvent < triggerEventCount && frameIndex == triggerEventOffsets.at (nextTriggerEvent))\n"
        + "            {\n"
        + "                triggerOut <- 1;\n"
        + "                nextTriggerEvent += 1;\n"
        + "            }\n"
        + "            framePositionOut <- "
        + _cmajor_float_literal(frame_position)
        + ";\n"
        + "            advance();\n"
        + "            frameIndex += 1;\n"
        + "        }\n"
        + "    }\n"
        + "}\n"
        + "graph MsegProbe [[ main ]]\n"
        + "{\n"
        + "    input event float32[wt::msegPaddedSamples] msegBuffer;\n"
        + "    input event wt::MsegPlaybackConfig msegPlayback;\n"
        + "    output stream float out;\n"
        + "    node control = MsegProbeControl;\n"
        + "    node osc = wt::FixedFrameOscillator ("
        + _cmajor_float_literal(frequency_hz)
        + ", "
        + _cmajor_float_literal(start_phase)
        + ");\n"
        + "    node mseg = wt::MsegReader;\n"
        + "    node route = wt::FramePositionModulator;\n"
        + "    connection\n"
        + "    {\n"
        + "        msegBuffer -> mseg.bufferUpload;\n"
        + "        msegPlayback -> mseg.playbackUpload;\n"
        + "        control.frequencyOut -> osc.frequencyIn;\n"
        + "        control.triggerOut -> mseg.triggerIn;\n"
        + "        control.framePositionOut -> route.basePositionIn;\n"
        + "        mseg.out -> route.modulationIn;\n"
        + "        control.depthOut -> route.depthIn;\n"
        + "        route.out -> osc.framePositionIn;\n"
        + "        control.tableSelectOut -> osc.tableSelectIn;\n"
        + "        osc.out -> out;\n"
        + "    }\n"
        + "}\n"
    )


def render_cmajor_mseg_probe(
    source_tables: Sequence[FixtureBank],
    recipe: Recipe,
    *,
    mseg_buffer: Float32Array,
    playback: MsegPlayback,
    depth: float,
    trigger_offsets: Sequence[int] = (0,),
    table_index: int = 0,
) -> Float32Array:
    from wtbank import build_bank, emit_cmajor_bank_assets

    if not source_tables:
        raise ValueError("render_cmajor_mseg_probe requires at least one FixtureBank")
    if not 0 <= table_index < len(source_tables):
        raise ValueError("table_index must address a table inside source_tables")
    if mseg_buffer.shape != (MSEG_PADDED_SAMPLES,):
        raise ValueError(f"mseg_buffer must have shape {(MSEG_PADDED_SAMPLES,)}")
    if not CMAJOR_FIXED_FRAME_SOURCE.exists():
        raise RuntimeError(
            f"Checked-in oscillator source is missing: {CMAJOR_FIXED_FRAME_SOURCE}"
        )
    if not CMAJOR_MSEG_SOURCE.exists():
        raise RuntimeError(
            f"Checked-in MSEG source is missing: {CMAJOR_MSEG_SOURCE}"
        )

    frequency_hz = _require_constant_curve(recipe.freq_hz_curve, "Recipe.freq_hz_curve")
    frame_position = _require_constant_curve(recipe.frame_pos_curve, "Recipe.frame_pos_curve")
    previous_trigger_offset = -1
    for trigger_offset in trigger_offsets:
        if not 0 <= trigger_offset < recipe.num_samples:
            raise ValueError("trigger_offsets must stay inside the rendered buffer")
        if trigger_offset < previous_trigger_offset:
            raise ValueError("trigger_offsets must be sorted in ascending order")
        previous_trigger_offset = trigger_offset

    with tempfile.TemporaryDirectory(prefix="cmajor_mseg_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        assets = emit_cmajor_bank_assets(
            temp_dir,
            build_bank(source_tables).bank,
            sample_rate=recipe.sample_rate,
        )
        combined_source_path = temp_dir / "MsegProbe.cmajor"
        patch_path = temp_dir / "MsegProbe.cmajorpatch"

        combined_source_path.write_text(
            CMAJOR_FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
            + "\n"
            + CMAJOR_MSEG_SOURCE.read_text(encoding="utf-8")
            + "\n"
            + _build_mseg_probe_wrapper_source(
                frequency_hz=frequency_hz,
                start_phase=recipe.start_phase,
                frame_position=frame_position,
                table_index=table_index,
                depth=depth,
                trigger_offsets=trigger_offsets,
            ),
            encoding="utf-8",
        )
        patch_path.write_text(
            json.dumps(
                _build_fixed_frame_patch_manifest(
                    source_files=combined_source_path.name,
                    manifest_value=assets.manifest_value,
                ),
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        playback_event = {
            "seconds": float(playback.seconds),
            "holdFinalValue": bool(playback.hold_final_value),
            "rateKind": 0,
            "loopEnabled": False,
            "loopStart": 0.0,
            "loopEnd": 1.0,
            "noteOffPolicy": 0,
            "legatoRestarts": False,
        }

        return _render_cmajor_patch_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=recipe.sample_rate,
            num_samples=recipe.num_samples,
            setup_js=(
                f"patch.sendInputEvent_msegBuffer({json.dumps(mseg_buffer.tolist())});\n"
                f"patch.sendInputEvent_msegPlayback({json.dumps(playback_event)});"
            ),
        )


def _sample_positions() -> Float64Array:
    return np.arange(SAMPLES_PER_FRAME, dtype=np.float64) / SAMPLES_PER_FRAME


def _normalize_frame(frame: Float64Array) -> Float64Array:
    peak = float(np.max(np.abs(frame), initial=0.0))
    if peak == 0.0:
        return frame.copy()
    return frame * (DEFAULT_FIXTURE_PEAK / peak)


def _make_bank(name: str, frames: list[Float64Array]) -> FixtureBank:
    normalized = np.stack([_normalize_frame(frame) for frame in frames], axis=0)
    return FixtureBank(name=name, frames=normalized.astype(np.float32))


def _sine_frame() -> Float64Array:
    return np.sin(2.0 * np.pi * _sample_positions())


def _saw_frame() -> Float64Array:
    return np.linspace(-1.0, 1.0, num=SAMPLES_PER_FRAME, endpoint=False, dtype=np.float64)


def _square_frame() -> Float64Array:
    indices = np.arange(SAMPLES_PER_FRAME, dtype=np.int64)
    return np.where(indices < SAMPLES_PER_FRAME // 2, 1.0, -1.0).astype(np.float64)


def _sync_saw_frame(sync_ratio: float) -> Float64Array:
    if sync_ratio < 1.0:
        raise ValueError("sync_ratio must stay at or above 1.0")

    slave_phase = np.mod(_sample_positions() * float(sync_ratio), 1.0)
    return (2.0 * slave_phase) - 1.0


def _rounded_triangle_frame() -> Float64Array:
    return (2.0 / np.pi) * np.arcsin(np.sin(2.0 * np.pi * _sample_positions()))


def _soft_square_frame() -> Float64Array:
    return np.tanh(1.35 * np.sin(2.0 * np.pi * _sample_positions()))


def _camel_frame() -> Float64Array:
    positions = _sample_positions()
    return (
        (0.82 * np.sin(2.0 * np.pi * positions))
        + (0.28 * np.sin((4.0 * np.pi * positions) - 0.85))
    )


def _double_peak_frame() -> Float64Array:
    positions = _sample_positions()
    return (
        (0.78 * np.sin(2.0 * np.pi * positions))
        - (0.14 * np.sin((4.0 * np.pi * positions) - 0.75))
        + (0.22 * np.sin((6.0 * np.pi * positions) + 0.45))
    )


def _hollow_frame() -> Float64Array:
    positions = _sample_positions()
    return (
        (0.88 * np.sin(2.0 * np.pi * positions))
        - (0.24 * np.sin((6.0 * np.pi * positions) + 0.15))
    )


def _tilted_sine_frame() -> Float64Array:
    positions = _sample_positions()
    phase = (2.0 * np.pi * positions) + (0.38 * np.sin((2.0 * np.pi * positions) - 0.35))
    return np.sin(phase)


def _folded_sine_frame() -> Float64Array:
    positions = _sample_positions()
    raw = (
        np.sin(2.0 * np.pi * positions)
        + (0.35 * np.sin((4.0 * np.pi * positions) + 0.8))
        - (0.12 * np.sin((6.0 * np.pi * positions) - 0.6))
    )
    return np.tanh(0.95 * raw)


def _display_demo_frame(frame_position: float) -> Float64Array:
    anchors = [
        _sine_frame(),
        _camel_frame(),
        _rounded_triangle_frame(),
        _double_peak_frame(),
        _soft_square_frame(),
        _hollow_frame(),
        _folded_sine_frame(),
        _tilted_sine_frame(),
    ]
    anchor_positions = np.linspace(0.0, 1.0, num=len(anchors), dtype=np.float64)

    if frame_position <= 0.0:
        frame = anchors[0].copy()
    elif frame_position >= 1.0:
        frame = anchors[-1].copy()
    else:
        upper_index = int(np.searchsorted(anchor_positions, frame_position, side="right"))
        lower_index = upper_index - 1
        lower_position = anchor_positions[lower_index]
        upper_position = anchor_positions[upper_index]
        blend_amount = (frame_position - lower_position) / (upper_position - lower_position)
        frame = (
            ((1.0 - blend_amount) * anchors[lower_index])
            + (blend_amount * anchors[upper_index])
        )

    frame -= np.mean(frame)
    return frame


def _bright_frame() -> Float64Array:
    positions = _sample_positions()
    rng = np.random.default_rng(BRIGHT_PHASE_SEED)
    phases = rng.uniform(-np.pi, np.pi, size=BRIGHT_HARMONIC_COUNT)
    frame = np.zeros(SAMPLES_PER_FRAME, dtype=np.float64)

    for harmonic, phase in enumerate(phases, start=1):
        frame += (1.0 / harmonic) * np.sin(2.0 * np.pi * harmonic * positions + phase)

    return frame


def _edge_frame() -> Float64Array:
    frame = np.zeros(SAMPLES_PER_FRAME, dtype=np.float64)
    frame[0] = 1.0
    frame -= np.mean(frame)
    return frame


def make_zero_bank() -> FixtureBank:
    return FixtureBank(
        name="zero_bank",
        frames=np.zeros((1, SAMPLES_PER_FRAME), dtype=np.float32),
    )


def make_sine_bank() -> FixtureBank:
    return _make_bank("sine_bank", [_sine_frame()])


def make_saw_bank() -> FixtureBank:
    return _make_bank("saw_bank", [_saw_frame()])


def make_square_bank() -> FixtureBank:
    return _make_bank("square_bank", [_square_frame()])


def make_bright_bank() -> FixtureBank:
    return _make_bank("bright_bank", [_bright_frame()])


def make_edge_bank() -> FixtureBank:
    return _make_bank("edge_bank", [_edge_frame()])


def make_blend2_bank() -> FixtureBank:
    return _make_bank("blend2_bank", [_sine_frame(), _square_frame()])


def make_sweep4_bank() -> FixtureBank:
    return _make_bank("sweep4_bank", [_sine_frame(), _saw_frame(), _square_frame(), _bright_frame()])


def make_sync_saw_bank() -> FixtureBank:
    return _make_bank(
        "sync_saw_bank",
        [_sync_saw_frame(sync_ratio) for sync_ratio in SYNC_SAW_FRAME_RATIOS],
    )


def make_display_demo_bank() -> FixtureBank:
    frame_positions = np.linspace(
        0.0,
        1.0,
        num=DISPLAY_DEMO_FRAME_COUNT,
        dtype=np.float64,
    )
    return _make_bank(
        "display_demo_bank",
        [_display_demo_frame(frame_position) for frame_position in frame_positions],
    )


FIXTURE_BUILDERS: Mapping[str, Callable[[], FixtureBank]] = {
    "zero_bank": make_zero_bank,
    "sine_bank": make_sine_bank,
    "saw_bank": make_saw_bank,
    "square_bank": make_square_bank,
    "bright_bank": make_bright_bank,
    "edge_bank": make_edge_bank,
    "blend2_bank": make_blend2_bank,
    "sweep4_bank": make_sweep4_bank,
    "sync_saw_bank": make_sync_saw_bank,
}


def _num_samples(duration_seconds: float, sample_rate: int) -> int:
    return int(round(duration_seconds * sample_rate))


def _constant_curve(value: float, num_samples: int) -> Float64Array:
    return np.full(num_samples, float(value), dtype=np.float64)


def _linear_curve(start: float, end: float, num_samples: int) -> Float64Array:
    return np.linspace(start, end, num=num_samples, dtype=np.float64)


def _geometric_curve(start: float, end: float, num_samples: int) -> Float64Array:
    return np.geomspace(start, end, num=num_samples).astype(np.float64)


def make_silence_recipe(sample_rate: int = DEFAULT_SAMPLE_RATE) -> Recipe:
    num_samples = _num_samples(1.0, sample_rate)
    return Recipe(
        name="silence",
        sample_rate=sample_rate,
        num_samples=num_samples,
        freq_hz_curve=_constant_curve(DEFAULT_STATIC_FREQUENCY_HZ, num_samples),
        frame_pos_curve=_constant_curve(0.0, num_samples),
    )


def make_static_tone_recipe(
    *,
    name: str = "static_tone",
    sample_rate: int = DEFAULT_SAMPLE_RATE,
    duration_seconds: float = 1.0,
    frequency_hz: float = DEFAULT_STATIC_FREQUENCY_HZ,
    frame_position: float = 0.0,
    start_phase: float = 0.0,
) -> Recipe:
    num_samples = _num_samples(duration_seconds, sample_rate)
    return Recipe(
        name=name,
        sample_rate=sample_rate,
        num_samples=num_samples,
        freq_hz_curve=_constant_curve(frequency_hz, num_samples),
        frame_pos_curve=_constant_curve(frame_position, num_samples),
        start_phase=start_phase,
    )


def make_blend_midpoint_recipe(
    frame_position: float,
    *,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
) -> Recipe:
    return make_static_tone_recipe(
        name=f"blend_midpoint_{frame_position:.2f}",
        sample_rate=sample_rate,
        frame_position=frame_position,
    )


def make_pitch_sweep_recipe(sample_rate: int = DEFAULT_SAMPLE_RATE) -> Recipe:
    num_samples = _num_samples(2.0, sample_rate)
    return Recipe(
        name="pitch_sweep",
        sample_rate=sample_rate,
        num_samples=num_samples,
        freq_hz_curve=_geometric_curve(55.0, 7040.0, num_samples),
        frame_pos_curve=_constant_curve(0.0, num_samples),
    )


def make_frame_sweep_recipe(sample_rate: int = DEFAULT_SAMPLE_RATE) -> Recipe:
    num_samples = _num_samples(2.0, sample_rate)
    return Recipe(
        name="frame_sweep",
        sample_rate=sample_rate,
        num_samples=num_samples,
        freq_hz_curve=_constant_curve(220.0, num_samples),
        frame_pos_curve=_linear_curve(0.0, 1.0, num_samples),
    )


RECIPE_BUILDERS: Mapping[str, Callable[[], Recipe]] = {
    "silence": make_silence_recipe,
    "static_tone": make_static_tone_recipe,
    "blend_midpoint_lo": lambda: make_blend_midpoint_recipe(0.0),
    "blend_midpoint_mid": lambda: make_blend_midpoint_recipe(0.5),
    "blend_midpoint_hi": lambda: make_blend_midpoint_recipe(1.0),
    "pitch_sweep": make_pitch_sweep_recipe,
    "frame_sweep": make_frame_sweep_recipe,
}


class ZeroProbe:
    def render(self, bank: FixtureBank, recipe: Recipe) -> Float32Array:
        return np.zeros(recipe.num_samples, dtype=np.float32)


class ReferenceTableProbe:
    # This is intentionally sacrificial bench code, not product oscillator code.
    def render(self, bank: FixtureBank, recipe: Recipe) -> Float32Array:
        phase_curve = _phase_curve(recipe)
        sample_indices, fractional = _phase_to_indices(phase_curve)

        if bank.num_frames == 1:
            frame_lo = np.zeros(recipe.num_samples, dtype=np.int64)
            frame_hi = frame_lo
            frame_t = np.zeros(recipe.num_samples, dtype=np.float64)
        else:
            frame_position = recipe.frame_pos_curve * (bank.num_frames - 1)
            frame_lo = np.floor(frame_position).astype(np.int64)
            frame_hi = np.minimum(frame_lo + 1, bank.num_frames - 1)
            frame_t = frame_position - frame_lo

        lo = _sample_bank(bank.frames, frame_lo, sample_indices, fractional)
        hi = _sample_bank(bank.frames, frame_hi, sample_indices, fractional)
        audio = lo + (hi - lo) * frame_t
        return audio.astype(np.float32)


def frame_position_to_indices(
    frame_position: float,
    frame_count: int,
) -> tuple[int, int, float]:
    clamped_position = float(np.clip(frame_position, 0.0, 1.0))
    if frame_count <= 1:
        return 0, 0, 0.0

    last_frame_index = frame_count - 1
    frame_index = clamped_position * last_frame_index
    frame_lo = int(np.floor(frame_index))
    frame_hi = min(frame_lo + 1, last_frame_index)
    frame_t = frame_index - frame_lo
    return frame_lo, frame_hi, frame_t


@dataclass(frozen=True, slots=True)
class CmajorFixedFrameProbe:
    frame_position: float | None = None

    def render(self, bank: FixtureBank, recipe: Recipe) -> Float32Array:
        if self.frame_position is None:
            effective_recipe = recipe
        else:
            effective_recipe = Recipe(
                name=recipe.name,
                sample_rate=recipe.sample_rate,
                num_samples=recipe.num_samples,
                freq_hz_curve=recipe.freq_hz_curve,
                frame_pos_curve=np.full(
                    recipe.frame_pos_curve.shape,
                    self.frame_position,
                    dtype=np.float64,
                ),
                start_phase=recipe.start_phase,
            )
        return render_cmajor_fixed_frame_tables(
            [bank],
            effective_recipe,
        )


def formula_mip_index_for_phase_increment(phase_increment: float) -> int:
    phase_increment32 = np.float32(phase_increment)

    if phase_increment32 <= np.float32(0.0):
        return BRIGHTEST_MIP_INDEX

    max_harmonics = int(
        np.floor(np.float32(1.0) / (np.float32(2.0) * phase_increment32))
    )
    max_harmonics = min(max(max_harmonics, 1), MAX_MIP_HARMONICS)
    return int(
        np.clip(
            np.floor(np.log2(max_harmonics)),
            0,
            BRIGHTEST_MIP_INDEX,
        )
    )


def threshold_mip_index_for_phase_increment(phase_increment: float) -> int:
    phase_increment32 = np.float32(phase_increment)

    if phase_increment32 <= np.float32(0.0):
        return BRIGHTEST_MIP_INDEX

    for mip_index, threshold in MIP_LEVEL_THRESHOLDS:
        if phase_increment32 <= threshold:
            return mip_index

    return 0


def formula_mip_index_for_frequency(frequency_hz: float, sample_rate: int) -> int:
    frequency32 = np.float32(frequency_hz)
    sample_rate32 = np.float32(sample_rate)
    return formula_mip_index_for_phase_increment(frequency32 / sample_rate32)


def threshold_mip_index_for_frequency(frequency_hz: float, sample_rate: int) -> int:
    frequency32 = np.float32(frequency_hz)
    sample_rate32 = np.float32(sample_rate)
    return threshold_mip_index_for_phase_increment(frequency32 / sample_rate32)


def _catmull_rom(p0: float, p1: float, p2: float, p3: float, t: float) -> float:
    return p1 + 0.5 * t * (
        (p2 - p0)
        + t * ((2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) + t * (-p0 + 3.0 * p1 - 3.0 * p2 + p3))
    )


def _mseg_power_scale(value: float, power: float) -> float:
    if abs(power) < 0.01:
        return value
    return (np.exp(power * value) - 1.0) / (np.exp(power) - 1.0)


def evaluate_mseg_shape(shape: MsegShape, x: float) -> float:
    clamped_x = float(np.clip(x, 0.0, 1.0))

    if clamped_x <= shape.points[0].x:
        return float(shape.points[0].y)

    for index in range(len(shape.points) - 1):
        current = shape.points[index]
        following = shape.points[index + 1]

        if clamped_x < following.x:
            width = following.x - current.x
            if width <= 0.0:
                return float(following.y)
            t = (clamped_x - current.x) / width
            curved_t = float(np.clip(_mseg_power_scale(t, current.curve_power), 0.0, 1.0))
            return float(current.y + ((following.y - current.y) * curved_t))

        if np.isclose(clamped_x, following.x, atol=1e-12, rtol=0.0):
            latest_index = index + 1
            while (
                latest_index + 1 < len(shape.points)
                and np.isclose(shape.points[latest_index + 1].x, clamped_x, atol=1e-12, rtol=0.0)
            ):
                latest_index += 1
            return float(shape.points[latest_index].y)

    return float(shape.points[-1].y)


def render_mseg_shape_reference(shape: MsegShape) -> Float32Array:
    body = np.empty(MSEG_PADDED_SAMPLES - 3, dtype=np.float32)
    for sample_index in range(body.shape[0]):
        x = sample_index / float(body.shape[0] - 1)
        body[sample_index] = np.float32(evaluate_mseg_shape(shape, x))

    padded = np.empty(MSEG_PADDED_SAMPLES, dtype=np.float32)
    padded[0] = body[0]
    padded[1:-2] = body
    padded[-2] = body[-1]
    padded[-1] = body[-1]
    return padded


def sample_rendered_mseg_buffer(buffer: Float32Array, x: float) -> float:
    if buffer.shape != (MSEG_PADDED_SAMPLES,):
        raise ValueError(f"MSEG buffers must have shape {(MSEG_PADDED_SAMPLES,)}")

    clamped_x = np.float32(np.clip(x, 0.0, 1.0))
    scaled = np.float32(clamped_x * np.float32((MSEG_PADDED_SAMPLES - 3) - 1))
    sample_index = int(np.floor(scaled))
    fractional = np.float32(scaled - np.float32(sample_index))
    return float(
        np.float32(
            _catmull_rom(
                float(buffer[sample_index]),
                float(buffer[sample_index + 1]),
                float(buffer[sample_index + 2]),
                float(buffer[sample_index + 3]),
                float(fractional),
            )
        )
    )


def render_mseg_reference(
    buffer: Float32Array,
    *,
    sample_rate: int,
    num_samples: int,
    playback: MsegPlayback,
    trigger_offsets: Sequence[int] = (0,),
) -> Float32Array:
    if sample_rate <= 0 or num_samples <= 0:
        raise ValueError("sample_rate and num_samples must be positive")

    previous_trigger = -1
    for trigger_offset in trigger_offsets:
        if not 0 <= trigger_offset < num_samples:
            raise ValueError("trigger_offsets must stay inside the rendered buffer")
        if trigger_offset < previous_trigger:
            raise ValueError("trigger_offsets must be sorted in ascending order")
        previous_trigger = trigger_offset

    output = np.zeros(num_samples, dtype=np.float32)
    progress = np.float32(1.0)
    increment = np.float32(1.0) / (np.float32(playback.seconds) * np.float32(sample_rate))
    active = False
    current_value = np.float32(sample_rendered_mseg_buffer(buffer, 0.0))
    trigger_index = 0

    for sample_offset in range(num_samples):
        while trigger_index < len(trigger_offsets) and trigger_offsets[trigger_index] == sample_offset:
            active = True
            progress = np.float32(0.0)
            current_value = np.float32(sample_rendered_mseg_buffer(buffer, 0.0))
            trigger_index += 1

        if active:
            current_value = np.float32(sample_rendered_mseg_buffer(buffer, float(progress)))
            if progress >= np.float32(1.0):
                active = False
            else:
                progress = np.minimum(progress + increment, np.float32(1.0))

        output[sample_offset] = np.float32(current_value if playback.hold_final_value or active else np.float32(0.0))

    return output


def apply_mseg_route(base_curve: Float64Array, modulation_curve: Float32Array, depth: float) -> Float64Array:
    if base_curve.shape != modulation_curve.shape:
        raise ValueError("base_curve and modulation_curve must have the same shape")
    routed = np.clip(
        np.asarray(base_curve, dtype=np.float32)
        + (np.asarray(modulation_curve, dtype=np.float32) * np.float32(depth)),
        np.float32(0.0),
        np.float32(1.0),
    )
    return np.asarray(routed, dtype=np.float64)


def _read_bank_frame_sample(
    bank,
    *,
    table_index: int,
    frame_index: int,
    mip_index: int,
    phase: float,
) -> float:
    from wtbank import read_padded_sample

    wrapped_phase = float(np.mod(np.float32(phase), np.float32(1.0)))
    x = np.float32(wrapped_phase * np.float32(SAMPLES_PER_FRAME))
    sample_index = int(np.floor(x))
    fractional = float(np.float32(x - sample_index))
    p0 = read_padded_sample(bank, table_index, mip_index, frame_index, sample_index + 0)
    p1 = read_padded_sample(bank, table_index, mip_index, frame_index, sample_index + 1)
    p2 = read_padded_sample(bank, table_index, mip_index, frame_index, sample_index + 2)
    p3 = read_padded_sample(bank, table_index, mip_index, frame_index, sample_index + 3)
    return _catmull_rom(p0, p1, p2, p3, fractional)


def render_bank_reference(
    source_tables: Sequence[FixtureBank],
    recipe: Recipe,
    *,
    table_index: int = 0,
    frequency_events: Sequence[tuple[int, float]] = (),
    table_index_events: Sequence[tuple[int, int]] = (),
) -> Float32Array:
    from wtbank import build_bank

    if not source_tables:
        raise ValueError("render_bank_reference requires at least one FixtureBank")
    if not 0 <= table_index < len(source_tables):
        raise ValueError("table_index must address a table inside source_tables")
    previous_table_event_offset = -1
    for frame_offset, next_table_index in table_index_events:
        if not 0 <= frame_offset < recipe.num_samples:
            raise ValueError("table_index event frame offsets must stay inside the rendered buffer")
        if frame_offset < previous_table_event_offset:
            raise ValueError("table_index event frame offsets must be sorted in ascending order")
        if not 0 <= next_table_index < len(source_tables):
            raise ValueError("table_index events must address a table inside source_tables")
        previous_table_event_offset = frame_offset

    built_bank = build_bank(source_tables).bank
    expected = np.empty(recipe.num_samples, dtype=np.float32)
    phase = np.float32(recipe.start_phase)
    current_frequency = np.float32(recipe.freq_hz_curve[0])
    current_table_index = table_index
    sample_rate = np.float32(recipe.sample_rate)
    event_index = 0
    table_event_index = 0

    for sample_offset in range(recipe.num_samples):
        while event_index < len(frequency_events) and frequency_events[event_index][0] == sample_offset:
            current_frequency = np.float32(frequency_events[event_index][1])
            event_index += 1

        while (
            table_event_index < len(table_index_events)
            and table_index_events[table_event_index][0] == sample_offset
        ):
            next_table_index = table_index_events[table_event_index][1]
            if not 0 <= next_table_index < len(source_tables):
                raise ValueError("table_index events must address a table inside source_tables")
            current_table_index = next_table_index
            phase = np.float32(0.0)
            table_event_index += 1

        mip_index = formula_mip_index_for_frequency(float(current_frequency), recipe.sample_rate)
        frame_lo, frame_hi, frame_t = frame_position_to_indices(
            float(recipe.frame_pos_curve[sample_offset]),
            source_tables[current_table_index].num_frames,
        )
        lo = _read_bank_frame_sample(
            built_bank,
            table_index=current_table_index,
            frame_index=frame_lo,
            mip_index=mip_index,
            phase=float(phase),
        )
        if frame_hi == frame_lo:
            expected[sample_offset] = np.float32(lo)
        else:
            hi = _read_bank_frame_sample(
                built_bank,
                table_index=current_table_index,
                frame_index=frame_hi,
                mip_index=mip_index,
                phase=float(phase),
            )
            expected[sample_offset] = np.float32(lo + (hi - lo) * frame_t)

        phase_increment = np.float32(current_frequency / sample_rate)
        phase = np.float32(np.mod(np.float32(phase + phase_increment), np.float32(1.0)))

    return expected


def _phase_curve(recipe: Recipe) -> Float64Array:
    increments = recipe.freq_hz_curve / recipe.sample_rate
    phase_offsets = np.concatenate(
        (np.zeros(1, dtype=np.float64), np.cumsum(increments[:-1], dtype=np.float64))
    )
    return np.mod(recipe.start_phase + phase_offsets, 1.0)


def _phase_to_indices(phase_curve: Float64Array) -> tuple[npt.NDArray[np.int64], Float64Array]:
    sample_positions = phase_curve * SAMPLES_PER_FRAME
    sample_indices = np.floor(sample_positions).astype(np.int64)
    return sample_indices, sample_positions - sample_indices


def _sample_bank(
    frames: Float32Array,
    frame_indices: npt.NDArray[np.int64],
    sample_indices: npt.NDArray[np.int64],
    fractional: Float64Array,
) -> Float64Array:
    sample_next = (sample_indices + 1) % SAMPLES_PER_FRAME
    p0 = frames[frame_indices, sample_indices].astype(np.float64)
    p1 = frames[frame_indices, sample_next].astype(np.float64)
    return p0 + (p1 - p0) * fractional


def peak_abs(audio: npt.ArrayLike) -> float:
    return float(np.max(np.abs(np.asarray(audio, dtype=np.float64)), initial=0.0))


def rms(audio: npt.ArrayLike) -> float:
    array = np.asarray(audio, dtype=np.float64)
    return float(np.sqrt(np.mean(np.square(array))))


def is_finite(audio: npt.ArrayLike) -> bool:
    return bool(np.isfinite(np.asarray(audio, dtype=np.float64)).all())


def dominant_bin_hz(audio: npt.ArrayLike, sample_rate: int) -> float:
    spectrum = np.abs(rfft(np.asarray(audio, dtype=np.float64)))
    if spectrum.size <= 1:
        return 0.0
    dominant_index = int(np.argmax(spectrum[1:]) + 1)
    return float(rfftfreq(np.asarray(audio).size, d=1.0 / sample_rate)[dominant_index])


def residual_db_excluding_bin(
    audio: npt.ArrayLike,
    sample_rate: int,
    target_hz: float,
    *,
    bin_radius: int = 0,
) -> float:
    spectrum = np.abs(rfft(np.asarray(audio, dtype=np.float64)))
    frequencies = rfftfreq(np.asarray(audio).size, d=1.0 / sample_rate)
    target_index = int(np.argmin(np.abs(frequencies - target_hz)))
    target_magnitude = float(spectrum[target_index])

    if target_magnitude == 0.0:
        return float("-inf")

    keep = np.ones_like(spectrum, dtype=bool)
    low = max(target_index - bin_radius, 0)
    high = min(target_index + bin_radius + 1, spectrum.size)
    keep[low:high] = False

    if not np.any(keep):
        return float("-inf")

    residual_magnitude = float(np.max(spectrum[keep], initial=0.0))
    if residual_magnitude == 0.0:
        return float("-inf")

    return float(20.0 * np.log10(residual_magnitude / target_magnitude))


def dump_requested() -> bool:
    value = os.getenv(DUMP_ENV_VAR, "").strip().lower()
    return value not in {"", "0", "false", "no"}


def maybe_write_wav(
    path: str | Path,
    sample_rate: int,
    audio: npt.ArrayLike,
    *,
    enabled: bool | None = None,
) -> Path | None:
    if enabled is None:
        enabled = dump_requested()
    if not enabled:
        return None

    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(output_path, sample_rate, np.asarray(audio, dtype=np.float32))
    return output_path


def maybe_write_spectrogram(
    path: str | Path,
    sample_rate: int,
    audio: npt.ArrayLike,
    *,
    enabled: bool | None = None,
) -> Path | None:
    if enabled is None:
        enabled = dump_requested()
    if not enabled:
        return None

    try:
        import matplotlib
    except ModuleNotFoundError:
        return None

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    audio_array = np.asarray(audio, dtype=np.float64)
    if audio_array.size < ((SPECTROGRAM_SEGMENT_SIZE + 1) // 2):
        return None
    spectrogram_builder = ShortTimeFFT.from_window(
        "hann",
        fs=sample_rate,
        nperseg=SPECTROGRAM_SEGMENT_SIZE,
        noverlap=SPECTROGRAM_OVERLAP,
        scale_to="magnitude",
    )
    spectrogram = spectrogram_builder.spectrogram(audio_array)
    freqs = spectrogram_builder.f
    times = spectrogram_builder.t(audio_array.size)
    display = 10.0 * np.log10(np.maximum(spectrogram, np.finfo(np.float64).tiny))

    figure, axis = plt.subplots(figsize=(10, 4))
    axis.imshow(
        display,
        origin="lower",
        aspect="auto",
        extent=(times[0], times[-1], freqs[0], freqs[-1]),
    )
    axis.set_title(output_path.stem)
    axis.set_xlabel("Time (s)")
    axis.set_ylabel("Frequency (Hz)")
    figure.tight_layout()
    figure.savefig(output_path, dpi=150)
    plt.close(figure)
    return output_path


def dump_render_artifacts(
    case_name: str,
    sample_rate: int,
    renders: Mapping[str, npt.ArrayLike],
    *,
    enabled: bool | None = None,
) -> list[Path]:
    written: list[Path] = []
    case_dir = ARTIFACTS_DIR / case_name

    for render_name, audio in renders.items():
        base_path = case_dir / render_name
        wav_path = maybe_write_wav(
            base_path.with_suffix(".wav"),
            sample_rate,
            audio,
            enabled=enabled,
        )
        png_path = maybe_write_spectrogram(
            base_path.with_name(f"{base_path.name}_spectrogram.png"),
            sample_rate,
            audio,
            enabled=enabled,
        )
        if wav_path is not None:
            written.append(wav_path)
        if png_path is not None:
            written.append(png_path)

    return written
