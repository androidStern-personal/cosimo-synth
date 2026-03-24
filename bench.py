from __future__ import annotations

from dataclasses import dataclass
import json
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
MIP_LEVEL_THRESHOLDS: tuple[tuple[int, np.float32], ...] = tuple(
    (level, np.float32(1.0 / float(1 << (level + 1))))
    for level in range(BRIGHTEST_MIP_INDEX, 0, -1)
)
CMAJOR_FIXED_FRAME_SOURCE = (
    Path(__file__).resolve().parent / "cmajor" / "FixedFrameOscillator.cmajor"
)


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


def _build_fixed_frame_wrapper_source(
    *,
    table_index: int,
    frequency_hz: float,
    start_phase: float,
) -> str:
    return (
        "graph FixedFrameProbe [[ main ]]\n"
        + "{\n"
        + "    input event float frequencyIn;\n"
        + "    input value float framePositionIn;\n"
        + "    output stream float out;\n"
        + "    node osc = wt::FixedFrameOscillator ("
        + str(table_index)
        + ", "
        + _cmajor_float_literal(frequency_hz)
        + ", "
        + _cmajor_float_literal(start_phase)
        + ");\n"
        + "    connection\n"
        + "    {\n"
        + "        frequencyIn -> osc.frequencyIn;\n"
        + "        framePositionIn -> osc.framePositionIn;\n"
        + "        osc.out -> out;\n"
        + "    }\n"
        + "}\n"
    )


def _build_fixed_frame_patch_manifest(
    *,
    source_files: Sequence[str],
    manifest_value: dict[str, object],
) -> dict[str, object]:
    return {
        "CmajorVersion": 1,
        "ID": "dev.cosimo.fixed-frame-probe",
        "version": "1.0",
        "name": "Fixed Frame Probe",
        "description": "Renders the checked-in fixed-frame wavetable oscillator",
        "category": "generator",
        "source": list(source_files),
        "externals": {
            "wt::factoryBank": manifest_value,
        },
    }


def _build_cmajor_render_test_script(
    *,
    patch_name: str,
    sample_rate: int,
    num_samples: int,
    output_dir_name: str,
) -> str:
    return (
        "## runScript({ frequency:"
        + str(sample_rate)
        + ", blockSize:512, samplesToRender:"
        + str(num_samples)
        + ', subDir:"'
        + output_dir_name
        + '", patch:"'
        + patch_name
        + '" })\n'
    )


def _write_cmajor_event_input(
    path: Path,
    events: Sequence[tuple[int, float]],
    *,
    num_samples: int,
) -> None:
    previous_frame_offset = -1
    serialized: list[dict[str, object]] = []

    for frame_offset, event_value in events:
        if not 0 <= frame_offset < num_samples:
            raise ValueError("frequency event frame offsets must stay inside the rendered buffer")
        if frame_offset < previous_frame_offset:
            raise ValueError("frequency event frame offsets must be sorted in ascending order")
        previous_frame_offset = frame_offset
        serialized.append(
            {
                "frameOffset": int(frame_offset),
                "event": float(event_value),
            }
        )

    path.write_text(json.dumps(serialized, indent=2) + "\n", encoding="utf-8")


def _write_cmajor_value_input(
    path: Path,
    values: Sequence[tuple[int, float, int]],
    *,
    num_samples: int,
) -> None:
    previous_frame_offset = -1
    serialized: list[dict[str, object]] = []

    for frame_offset, value, frames_to_reach_value in values:
        if not 0 <= frame_offset < num_samples:
            raise ValueError("value input frame offsets must stay inside the rendered buffer")
        if frame_offset < previous_frame_offset:
            raise ValueError("value input frame offsets must be sorted in ascending order")
        if frames_to_reach_value < 0:
            raise ValueError("framesToReachValue must not be negative")
        previous_frame_offset = frame_offset
        serialized.append(
            {
                "frameOffset": int(frame_offset),
                "value": float(value),
                "framesToReachValue": int(frames_to_reach_value),
            }
        )

    path.write_text(json.dumps(serialized, indent=2) + "\n", encoding="utf-8")


def _curve_to_value_events(curve: Float64Array) -> tuple[tuple[int, float, int], ...]:
    if curve.size == 0:
        raise ValueError("value curve must contain at least one sample")

    if curve.size == 1 or np.allclose(curve, curve[0], rtol=0.0, atol=1e-12):
        return ((0, float(curve[0]), 0),)

    deltas = np.diff(curve)
    nonzero_mask = ~np.isclose(deltas, 0.0, rtol=0.0, atol=1e-12)
    nonzero_deltas = deltas[nonzero_mask]
    if (
        nonzero_deltas.size
        and np.allclose(nonzero_deltas, nonzero_deltas[0], rtol=0.0, atol=1e-12)
        and np.all(nonzero_mask)
    ):
        return (
            (0, float(curve[0]), 0),
            (curve.size - 1, float(curve[-1]), curve.size - 1),
        )

    events: list[tuple[int, float, int]] = [(0, float(curve[0]), 0)]
    for sample_index in range(1, curve.size):
        if not np.isclose(curve[sample_index], curve[sample_index - 1], rtol=0.0, atol=1e-12):
            events.append((sample_index, float(curve[sample_index]), 0))

    return tuple(events)


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


def _run_cmajor_test_render(
    *,
    patch_path: Path,
    test_path: Path,
    output_dir_path: Path,
    output_wav_path: Path,
    sample_rate: int,
    num_samples: int,
    frequency_events: Sequence[tuple[int, float]] = (),
    frame_position_events: Sequence[tuple[int, float, int]] = (),
) -> Float32Array:
    cmaj = _require_cmaj_cli()
    output_dir_path.mkdir(parents=True, exist_ok=True)
    _write_cmajor_event_input(
        output_dir_path / "frequencyIn.json",
        frequency_events,
        num_samples=num_samples,
    )
    _write_cmajor_value_input(
        output_dir_path / "framePositionIn.json",
        frame_position_events,
        num_samples=num_samples,
    )

    test_path.write_text(
        _build_cmajor_render_test_script(
            patch_name=patch_path.name,
            sample_rate=sample_rate,
            num_samples=num_samples,
            output_dir_name=output_dir_path.name,
        ),
        encoding="utf-8",
    )

    result = subprocess.run(
        [cmaj, "test", str(test_path), "--singleThread"],
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

    if not output_wav_path.exists():
        raise RuntimeError(f"cmaj test did not write the expected output WAV: {output_wav_path}")

    return _read_rendered_wav(
        output_wav_path,
        expected_num_samples=num_samples,
        expected_sample_rate=sample_rate,
    )


def render_cmajor_fixed_frame_tables(
    source_tables: Sequence[FixtureBank],
    recipe: Recipe,
    *,
    table_index: int = 0,
    frequency_events: Sequence[tuple[int, float]] = (),
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

    frequency_hz = _require_constant_curve(recipe.freq_hz_curve, "Recipe.freq_hz_curve")
    frame_position = float(recipe.frame_pos_curve[0])
    frame_position_events = _curve_to_value_events(recipe.frame_pos_curve)

    with tempfile.TemporaryDirectory(prefix="cmajor_fixed_frame_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        assets = emit_cmajor_bank_assets(
            temp_dir,
            build_bank(source_tables).bank,
            sample_rate=recipe.sample_rate,
        )
        source_link_path = temp_dir / CMAJOR_FIXED_FRAME_SOURCE.name
        wrapper_path = temp_dir / "FixedFrameProbe.cmajor"
        patch_path = temp_dir / "FixedFrameProbe.cmajorpatch"
        test_path = temp_dir / "FixedFrameProbe.cmajtest"
        output_dir_path = temp_dir / "golden"
        output_wav_path = output_dir_path / "expectedOutput-out.wav"

        source_link_path.symlink_to(CMAJOR_FIXED_FRAME_SOURCE)
        wrapper_path.write_text(
            _build_fixed_frame_wrapper_source(
                table_index=table_index,
                frequency_hz=frequency_hz,
                start_phase=recipe.start_phase,
            ),
            encoding="utf-8",
        )
        patch_path.write_text(
            json.dumps(
                _build_fixed_frame_patch_manifest(
                    source_files=[
                        source_link_path.name,
                        wrapper_path.name,
                    ],
                    manifest_value=assets.manifest_value,
                ),
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        return _run_cmajor_test_render(
            patch_path=patch_path,
            test_path=test_path,
            output_dir_path=output_dir_path,
            output_wav_path=output_wav_path,
            sample_rate=recipe.sample_rate,
            num_samples=recipe.num_samples,
            frequency_events=frequency_events,
            frame_position_events=frame_position_events,
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


FIXTURE_BUILDERS: Mapping[str, Callable[[], FixtureBank]] = {
    "zero_bank": make_zero_bank,
    "sine_bank": make_sine_bank,
    "saw_bank": make_saw_bank,
    "square_bank": make_square_bank,
    "bright_bank": make_bright_bank,
    "edge_bank": make_edge_bank,
    "blend2_bank": make_blend2_bank,
    "sweep4_bank": make_sweep4_bank,
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
) -> Float32Array:
    from wtbank import build_bank

    if not source_tables:
        raise ValueError("render_bank_reference requires at least one FixtureBank")
    if not 0 <= table_index < len(source_tables):
        raise ValueError("table_index must address a table inside source_tables")

    built_bank = build_bank(source_tables).bank
    frame_count = source_tables[table_index].num_frames
    expected = np.empty(recipe.num_samples, dtype=np.float32)
    phase = np.float32(recipe.start_phase)
    current_frequency = np.float32(recipe.freq_hz_curve[0])
    sample_rate = np.float32(recipe.sample_rate)
    event_index = 0

    for sample_offset in range(recipe.num_samples):
        while event_index < len(frequency_events) and frequency_events[event_index][0] == sample_offset:
            current_frequency = np.float32(frequency_events[event_index][1])
            event_index += 1

        mip_index = formula_mip_index_for_frequency(float(current_frequency), recipe.sample_rate)
        frame_lo, frame_hi, frame_t = frame_position_to_indices(
            float(recipe.frame_pos_curve[sample_offset]),
            frame_count,
        )
        lo = _read_bank_frame_sample(
            built_bank,
            table_index=table_index,
            frame_index=frame_lo,
            mip_index=mip_index,
            phase=float(phase),
        )
        if frame_hi == frame_lo:
            expected[sample_offset] = np.float32(lo)
        else:
            hi = _read_bank_frame_sample(
                built_bank,
                table_index=table_index,
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
