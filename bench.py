from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Mapping, Protocol
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
) -> Recipe:
    num_samples = _num_samples(duration_seconds, sample_rate)
    return Recipe(
        name=name,
        sample_rate=sample_rate,
        num_samples=num_samples,
        freq_hz_curve=_constant_curve(frequency_hz, num_samples),
        frame_pos_curve=_constant_curve(frame_position, num_samples),
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
