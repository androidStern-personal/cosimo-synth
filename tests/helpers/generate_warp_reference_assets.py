from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy.fft import irfft, rfft
from scipy.io import wavfile
from scipy.signal import resample_poly

from bench import MSEG_PADDED_SAMPLES, MsegPlayback, render_mseg_reference

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_ROOT = REPO_ROOT / "tests" / "cmajor_warp" / "fixtures"
PLOT_ROOT = REPO_ROOT / "artifacts" / "warp_review"
DEFAULT_SAMPLE_RATE = 44100
SAMPLES_PER_FRAME = 2048
PADDED_FRAME_SIZE = SAMPLES_PER_FRAME + 3
MIP_LEVEL_COUNT = 11
BRIGHTEST_MIP_INDEX = MIP_LEVEL_COUNT - 1
MAX_MIP_HARMONICS = 1 << BRIGHTEST_MIP_INDEX
OVERSAMPLE_FACTOR = 8
PRODUCTION_OVERSAMPLE_FACTOR = 8
PRODUCTION_DECIMATOR_TAP_COUNT = 257
PRODUCTION_DECIMATOR_CUTOFF_NYQUIST = 0.125
TRIM_GAIN = 0.18
ATTACK_SECONDS = 0.01
RELEASE_SECONDS = 0.20
ALIAS_REFERENCE_FILENAME = "expectedAliasReference-audioOut.wav"
REQUIRED_WARP_INPUT_FILES = (
    "midiIn.json",
    "mseg1Depth.json",
    "warpAmount.json",
    "warpMode.json",
    "wavetableLoadBegin.json",
    "wavetableMipFrame.json",
    "wavetablePosition.json",
)

WARP_CASE_OUTPUT_SAMPLES = {
    "neutral_equals_off_bend": 4096,
    "neutral_equals_off_pwm": 4096,
    "bend_harmonic": 3072,
    "pwm_edge": 4096,
    "asym_triangle": 4096,
    "mirror_triangle": 4096,
    "scan_plus_warp": 4096,
    "amount_automation": 4096,
    "poly_warp_mseg_staggered": 4096,
}

ALIAS_REFERENCE_SAMPLES = {
    "bend_harmonic": 4096,
    "pwm_edge": 4096,
}

NEUTRAL_BASELINE_CASES = {
    "neutral_equals_off_bend": "identity_sine",
    "neutral_equals_off_pwm": "identity_sine",
}


@dataclass(frozen=True, slots=True)
class MidiEvent:
    frame_offset: int
    kind: str
    note: int
    velocity: float


@dataclass(frozen=True, slots=True)
class NoteSegment:
    note: int
    velocity: float
    on_offset: int
    off_offset: int


@dataclass(frozen=True, slots=True)
class FixtureMipBank:
    name: str
    raw_frames: np.ndarray
    padded_mips: np.ndarray

    @property
    def num_frames(self) -> int:
        return int(self.raw_frames.shape[0])


class FixedASREnvelope:
    def __init__(self, sample_rate: int) -> None:
        self.sample_rate = sample_rate
        self.current_level = 0.0
        self.key_down_velocity = 0.0
        self.state = "idle"
        self.attack_multiplier = 1.0
        self.decay_factor = self._compute_decay_factor()

    def _compute_attack_multiplier(self) -> float:
        if ATTACK_SECONDS <= 0.0:
            return 1.0
        attack_exponent = 1.0 / max(1, int(ATTACK_SECONDS * self.sample_rate))
        return (2.0 ** -attack_exponent) * ((2.0 + self.key_down_velocity) ** attack_exponent)

    def _compute_decay_factor(self) -> float:
        if RELEASE_SECONDS <= 0.0:
            return 0.0
        return float(np.power(0.0001, 1.0 / (RELEASE_SECONDS * self.sample_rate)))

    def note_on(self, velocity: float) -> None:
        self.key_down_velocity = velocity
        self.current_level = 0.0
        self.attack_multiplier = self._compute_attack_multiplier()
        self.state = "attack"

    def note_off(self) -> None:
        self.key_down_velocity = 0.0
        self.state = "release"

    def step(self) -> float:
        if self.state == "attack":
            out = self.current_level
            self.current_level = (self.attack_multiplier * (self.current_level + 2.0)) - 2.0
            if self.current_level >= self.key_down_velocity:
                self.current_level = self.key_down_velocity
                self.state = "sustain"
            return out

        if self.state == "sustain":
            return self.current_level

        if self.state == "release":
            if self.current_level > 0.0001:
                out = self.current_level
                self.current_level *= self.decay_factor
                return out
            self.current_level = 0.0
            self.state = "idle"
            return 0.0

        return 0.0


def _read_json(path: Path) -> list[dict[str, object]]:
    return json.loads(path.read_text(encoding="utf-8"))


def _require_fixture_files(fixture_dir: Path, required_names: tuple[str, ...]) -> None:
    missing = [name for name in required_names if not (fixture_dir / name).exists()]
    if missing:
        joined = ", ".join(missing)
        raise FileNotFoundError(f"{fixture_dir} is missing required warp fixture files: {joined}")


def _decode_midi_events(path: Path) -> list[MidiEvent]:
    if not path.exists():
        return []

    events: list[MidiEvent] = []
    for entry in _read_json(path):
        message = int(entry["event"]["message"])
        status = (message >> 16) & 0xFF
        note = (message >> 8) & 0x7F
        velocity = (message & 0x7F) / 127.0
        kind = "unknown"

        if (status & 0xF0) == 0x90 and (message & 0x7F) != 0:
            kind = "note_on"
        elif (status & 0xF0) == 0x80 or ((status & 0xF0) == 0x90 and (message & 0x7F) == 0):
            kind = "note_off"

        events.append(
            MidiEvent(
                frame_offset=int(entry["frameOffset"]),
                kind=kind,
                note=note,
                velocity=velocity,
            )
        )

    return sorted(events, key=lambda event: event.frame_offset)


def _read_value_events(path: Path) -> list[dict[str, float]]:
    if not path.exists():
        return []
    return _read_json(path)


def _load_mseg_buffer(fixture_dir: Path) -> np.ndarray:
    path = fixture_dir / "mseg1Buffer.json"
    if not path.exists():
        return np.full(MSEG_PADDED_SAMPLES, 0.5, dtype=np.float32)

    entries = _read_json(path)
    if not entries:
        return np.full(MSEG_PADDED_SAMPLES, 0.5, dtype=np.float32)

    buffer = np.asarray(entries[-1]["event"], dtype=np.float32)
    if buffer.shape != (MSEG_PADDED_SAMPLES,):
        raise ValueError(
            f"{path} must contain exactly {MSEG_PADDED_SAMPLES} MSEG samples, got {buffer.shape}"
        )

    return buffer.copy()


def _load_mseg_playback(fixture_dir: Path) -> MsegPlayback:
    path = fixture_dir / "mseg1Playback.json"
    if not path.exists():
        return MsegPlayback(seconds=1.0)

    entries = _read_json(path)
    if not entries:
        return MsegPlayback(seconds=1.0)

    event = dict(entries[-1]["event"])
    loop_enabled = bool(event.get("loopEnabled", False))
    loop_start = float(event.get("loopStart", 0.0))
    loop_end = float(event.get("loopEnd", 1.0))
    loop = (loop_start, loop_end) if loop_enabled else None
    note_off_policy = {
        0: "finish_loop",
        1: "immediate",
        2: "ignore",
    }.get(int(event.get("noteOffPolicy", 0)), "finish_loop")

    return MsegPlayback(
        seconds=float(event.get("seconds", 1.0)),
        loop=loop,
        note_off_policy=note_off_policy,
        hold_final_value=bool(event.get("holdFinalValue", True)),
    )


def _decode_note_segments(path: Path, *, num_samples: int) -> list[NoteSegment]:
    midi_events = _decode_midi_events(path)
    open_segments: dict[int, list[int]] = {}
    segments: list[NoteSegment] = []
    active_count = 0
    peak_active = 0

    for event in midi_events:
        if event.kind == "note_on":
            open_segments.setdefault(event.note, []).append(len(segments))
            segments.append(
                NoteSegment(
                    note=event.note,
                    velocity=event.velocity,
                    on_offset=event.frame_offset,
                    off_offset=num_samples,
                )
            )
            active_count += 1
            peak_active = max(peak_active, active_count)
            continue

        if event.kind == "note_off":
            open_for_note = open_segments.get(event.note)
            if not open_for_note:
                continue

            segment_index = open_for_note.pop(0)
            original = segments[segment_index]
            segments[segment_index] = NoteSegment(
                note=original.note,
                velocity=original.velocity,
                on_offset=original.on_offset,
                off_offset=event.frame_offset,
            )
            active_count = max(0, active_count - 1)

    if peak_active > 16:
        raise ValueError(
            f"{path} requires {peak_active} simultaneous notes, but WavetableSynth only has 16 voices"
        )

    return segments


def _expand_value_curve(
    *,
    num_samples: int,
    default: float,
    events: list[dict[str, float]],
    scale: int = 1,
) -> np.ndarray:
    curve = np.full(num_samples, float(default), dtype=np.float64)
    current = float(default)
    cursor = 0

    for raw_event in events:
        frame_offset = int(raw_event["frameOffset"]) * scale
        value = float(raw_event["value"])
        frames_to_reach = int(raw_event.get("framesToReachValue", 0)) * scale

        if frame_offset > num_samples:
            break

        curve[cursor:frame_offset] = current

        if frames_to_reach <= 0:
            current = value
            cursor = frame_offset
            continue

        ramp_end = min(frame_offset + frames_to_reach, num_samples)
        if ramp_end > frame_offset:
            ramp_length = ramp_end - frame_offset
            ramp = current + (
                (np.arange(ramp_length, dtype=np.float64) + 1.0)
                * ((value - current) / frames_to_reach)
            )
            curve[frame_offset:ramp_end] = ramp
        current = value
        cursor = ramp_end

    curve[cursor:] = current
    return curve


def _pad_frame(frame: np.ndarray) -> np.ndarray:
    padded = np.empty(PADDED_FRAME_SIZE, dtype=np.float32)
    padded[0] = np.float32(frame[-1])
    padded[1:-2] = np.asarray(frame, dtype=np.float32)
    padded[-2] = np.float32(frame[0])
    padded[-1] = np.float32(frame[1])
    return padded


def _build_mip_frame(frame: np.ndarray, mip_index: int) -> np.ndarray:
    canonical_frame = np.asarray(frame, dtype=np.float64) - float(np.mean(frame))
    spectrum = rfft(canonical_frame)
    spectrum[0] = 0.0
    harmonic_limit = min(1 << mip_index, spectrum.size - 1)
    truncated = np.zeros_like(spectrum)
    if harmonic_limit >= 1:
        truncated[1 : harmonic_limit + 1] = spectrum[1 : harmonic_limit + 1]
    return irfft(truncated, n=SAMPLES_PER_FRAME).astype(np.float32)


def _catmull_rom(p0: float, p1: float, p2: float, p3: float, t: float) -> float:
    return p1 + 0.5 * t * (
        (p2 - p0)
        + t * ((2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) + t * (-p0 + 3.0 * p1 - 3.0 * p2 + p3))
    )


def _catmull_rom_f32(p0: float, p1: float, p2: float, p3: float, t: float) -> float:
    p0_f = np.float32(p0)
    p1_f = np.float32(p1)
    p2_f = np.float32(p2)
    p3_f = np.float32(p3)
    t_f = np.float32(t)
    half_f = np.float32(0.5)
    inner = np.float32(
        (np.float32(2.0) * p0_f - np.float32(5.0) * p1_f + np.float32(4.0) * p2_f - p3_f)
        + t_f * (-p0_f + np.float32(3.0) * p1_f - np.float32(3.0) * p2_f + p3_f)
    )
    return float(
        np.float32(
            p1_f
            + half_f * t_f * ((p2_f - p0_f) + t_f * inner)
        )
    )


def _frame_position_to_indices(frame_position: float, frame_count: int) -> tuple[int, int, float]:
    clamped_position = float(np.clip(frame_position, 0.0, 1.0))
    if frame_count <= 1:
        return 0, 0, 0.0

    last_frame_index = frame_count - 1
    frame_index = clamped_position * last_frame_index
    frame_lo = int(np.floor(frame_index))
    frame_hi = min(frame_lo + 1, last_frame_index)
    frame_t = frame_index - frame_lo
    return frame_lo, frame_hi, frame_t


def _formula_mip_index_for_frequency(frequency_hz: float, sample_rate: int) -> int:
    phase_increment = np.float32(np.float32(frequency_hz) / np.float32(sample_rate))
    if phase_increment <= np.float32(0.0):
        return BRIGHTEST_MIP_INDEX

    max_harmonics = int(np.floor(np.float32(1.0) / (np.float32(2.0) * phase_increment)))
    max_harmonics = min(max(max_harmonics, 1), MAX_MIP_HARMONICS)
    return int(np.clip(np.floor(np.log2(max_harmonics)), 0, BRIGHTEST_MIP_INDEX))


def _read_bank_frame_sample(
    bank: FixtureMipBank,
    *,
    frame_index: int,
    mip_index: int,
    phase: float,
) -> float:
    wrapped_phase = float(np.mod(np.float32(phase), np.float32(1.0)))
    x = np.float32(wrapped_phase * np.float32(SAMPLES_PER_FRAME))
    sample_index = int(np.floor(x))
    fractional = float(np.float32(x - sample_index))
    frame = bank.padded_mips[mip_index, frame_index]
    return _catmull_rom(
        float(frame[sample_index + 0]),
        float(frame[sample_index + 1]),
        float(frame[sample_index + 2]),
        float(frame[sample_index + 3]),
        fractional,
    )


def _read_bank_frame_sample32(
    bank: FixtureMipBank,
    *,
    frame_index: int,
    mip_index: int,
    phase: float,
) -> float:
    wrapped_phase = np.float32(np.mod(np.float32(phase), np.float32(1.0)))
    x = np.float32(wrapped_phase * np.float32(SAMPLES_PER_FRAME))
    sample_index = int(np.floor(x))
    fractional = float(np.float32(x - sample_index))
    frame = bank.padded_mips[mip_index, frame_index]
    return _catmull_rom_f32(
        float(frame[sample_index + 0]),
        float(frame[sample_index + 1]),
        float(frame[sample_index + 2]),
        float(frame[sample_index + 3]),
        fractional,
    )


def _read_bank_frame_endpoint_sample(
    bank: FixtureMipBank,
    *,
    frame_index: int,
    mip_index: int,
) -> float:
    return float(bank.padded_mips[mip_index, frame_index, SAMPLES_PER_FRAME])


def _load_frame_count_from_fixture(fixture_dir: Path) -> int:
    load_begin_events = _read_json(fixture_dir / "wavetableLoadBegin.json")
    if not load_begin_events:
        raise FileNotFoundError(f"{fixture_dir} is missing wavetableLoadBegin.json events")

    return int(load_begin_events[0]["event"]["frameCount"])


def _load_raw_frames_from_fixture(fixture_dir: Path) -> np.ndarray:
    frame_count = _load_frame_count_from_fixture(fixture_dir)
    mip_frames = _read_json(fixture_dir / "wavetableMipFrame.json")
    raw_frames = np.zeros((frame_count, SAMPLES_PER_FRAME), dtype=np.float32)
    seen_frames = np.zeros(frame_count, dtype=bool)

    for entry in mip_frames:
        event = entry["event"]
        mip_index = int(event["mipIndex"])
        frame_index = int(event["frameIndex"])

        if mip_index != 0:
            continue

        if frame_index < 0 or frame_index >= frame_count:
            raise ValueError(f"{fixture_dir} has invalid frameIndex {frame_index} for mip 0")

        frame = np.asarray(event["samples"], dtype=np.float32)
        if frame.shape != (SAMPLES_PER_FRAME,):
            raise ValueError(
                f"{fixture_dir} mip 0 frame {frame_index} has shape {frame.shape}, "
                f"expected {(SAMPLES_PER_FRAME,)}"
            )

        raw_frames[frame_index] = frame
        seen_frames[frame_index] = True

    if not np.all(seen_frames):
        missing = np.flatnonzero(~seen_frames)
        joined = ", ".join(str(int(index)) for index in missing)
        raise ValueError(f"{fixture_dir} is missing mip 0 frames: {joined}")

    return raw_frames


def _build_fixture_mip_events(raw_frames: np.ndarray) -> list[dict[str, object]]:
    frame_count = int(raw_frames.shape[0])
    events: list[dict[str, object]] = []

    for mip_index in range(MIP_LEVEL_COUNT):
        for frame_index, frame in enumerate(raw_frames):
            events.append(
                {
                    "frameOffset": int((mip_index * frame_count) + frame_index),
                    "event": {
                        "dspSessionId": 1,
                        "generation": 1,
                        "tableIndex": 0,
                        "mipIndex": int(mip_index),
                        "frameIndex": int(frame_index),
                        "samples": _build_mip_frame(frame, mip_index).tolist(),
                    },
                }
            )

    return events


def _expand_fixture_uploaded_mips(fixture_dir: Path) -> None:
    raw_frames = _load_raw_frames_from_fixture(fixture_dir)
    mip_events = _build_fixture_mip_events(raw_frames)
    (fixture_dir / "wavetableMipFrame.json").write_text(
        json.dumps(mip_events, indent=2) + "\n",
        encoding="utf-8",
    )


def _expand_all_fixture_uploaded_mips() -> None:
    for fixture_dir in sorted(path for path in FIXTURE_ROOT.iterdir() if path.is_dir()):
        wavetable_path = fixture_dir / "wavetableMipFrame.json"
        load_begin_path = fixture_dir / "wavetableLoadBegin.json"

        if wavetable_path.exists() and load_begin_path.exists():
            _expand_fixture_uploaded_mips(fixture_dir)


def _load_bank_from_fixture(fixture_dir: Path) -> FixtureMipBank:
    frame_count = _load_frame_count_from_fixture(fixture_dir)
    mip_frames = _read_json(fixture_dir / "wavetableMipFrame.json")
    raw_frames = np.zeros((frame_count, SAMPLES_PER_FRAME), dtype=np.float32)
    padded_mips = np.zeros((MIP_LEVEL_COUNT, frame_count, PADDED_FRAME_SIZE), dtype=np.float32)
    ready = np.zeros((MIP_LEVEL_COUNT, frame_count), dtype=bool)

    for entry in mip_frames:
        event = entry["event"]
        mip_index = int(event["mipIndex"])
        frame_index = int(event["frameIndex"])

        if mip_index < 0 or mip_index >= MIP_LEVEL_COUNT:
            raise ValueError(f"{fixture_dir} has invalid mipIndex {mip_index}")

        if frame_index < 0 or frame_index >= frame_count:
            raise ValueError(f"{fixture_dir} has invalid frameIndex {frame_index} for mip {mip_index}")

        frame = np.asarray(event["samples"], dtype=np.float32)
        if frame.shape != (SAMPLES_PER_FRAME,):
            raise ValueError(
                f"{fixture_dir} mip {mip_index} frame {frame_index} has shape {frame.shape}, "
                f"expected {(SAMPLES_PER_FRAME,)}"
            )

        if ready[mip_index, frame_index]:
            raise ValueError(f"{fixture_dir} has duplicate mip/frame payload for mip {mip_index}, frame {frame_index}")

        ready[mip_index, frame_index] = True
        padded_mips[mip_index, frame_index] = _pad_frame(frame)

        if mip_index == 0:
            raw_frames[frame_index] = frame

    if not np.all(ready):
        missing_indices = np.argwhere(~ready)
        joined = ", ".join(
            f"(mip {int(mip_index)}, frame {int(frame_index)})"
            for mip_index, frame_index in missing_indices
        )
        raise ValueError(f"{fixture_dir} is missing uploaded mip frames: {joined}")

    return FixtureMipBank(name=fixture_dir.name, raw_frames=raw_frames, padded_mips=padded_mips)


def _note_to_frequency(note: int) -> float:
    return 440.0 * (2.0 ** ((float(note) - 69.0) / 12.0))


def _curved_warp_right(phase: float, amount: float) -> float:
    clamped_phase = float(np.clip(phase, 0.0, 1.0))
    clamped_amount = float(np.clip(amount, 0.0, 1.0))
    exponent = float(np.power(2.0, 4.0 * clamped_amount))
    return float(np.power(clamped_phase, exponent))


def _curved_warp_left(phase: float, amount: float) -> float:
    clamped_phase = float(np.clip(phase, 0.0, 1.0))
    clamped_amount = float(np.clip(amount, 0.0, 1.0))
    exponent = float(np.power(2.0, 4.0 * clamped_amount))
    return float(1.0 - np.power(1.0 - clamped_phase, exponent))


def _curved_asym_signed(phase: float, dial: float) -> float:
    clamped_dial = float(np.clip(dial, 0.0, 1.0))
    signed_amount = (2.0 * clamped_dial) - 1.0
    magnitude = abs(signed_amount)
    if signed_amount >= 0.0:
        return _curved_warp_right(phase, magnitude)
    return _curved_warp_left(phase, magnitude)


def _linear_skew_signed(phase: float, dial: float) -> float:
    clamped_phase = float(np.clip(phase, 0.0, 1.0))
    clamped_dial = float(np.clip(dial, 0.0, 1.0))
    signed_amount = (2.0 * clamped_dial) - 1.0
    split = float(np.clip(0.5 + (0.48 * signed_amount), 0.02, 0.98))

    if clamped_phase < split:
        return float(0.5 * (clamped_phase / split))

    return float(0.5 + (0.5 * ((clamped_phase - split) / (1.0 - split))))


def _mirror_base_phase(phase: float) -> float:
    clamped_phase = float(np.clip(phase, 0.0, 1.0))
    if clamped_phase < 0.5:
        return float(clamped_phase * 2.0)
    return float(2.0 - (2.0 * clamped_phase))


def _pwm_active_portion(amount: float) -> float:
    clamped_amount = float(np.clip(amount, 0.0, 1.0))
    return float(1.0 - ((1.0 - 0.02) * clamped_amount))


def _resolve_warped_phase(mode: int, amount: float, phase: float) -> tuple[bool, bool, float]:
    wrapped_phase = float(np.mod(phase, 1.0))

    if mode <= 0:
        return True, False, wrapped_phase

    if mode == 1:
        inverted_dial = 1.0 - float(np.clip(amount, 0.0, 1.0))
        if wrapped_phase < 0.5:
            return True, False, 0.5 * _curved_asym_signed(wrapped_phase * 2.0, inverted_dial)
        return True, False, 1.0 - (0.5 * _curved_asym_signed(2.0 - (2.0 * wrapped_phase), inverted_dial))

    if mode == 2:
        active_portion = _pwm_active_portion(amount)
        if wrapped_phase < active_portion:
            return True, False, wrapped_phase / active_portion
        return False, True, 1.0

    if mode == 3:
        return True, False, _linear_skew_signed(wrapped_phase, amount)

    if mode == 4:
        return True, False, _linear_skew_signed(_mirror_base_phase(wrapped_phase), amount)

    return True, False, wrapped_phase


def _resolve_warp_mode(raw_mode: float) -> int:
    return int(np.clip(np.floor(raw_mode + 0.5), 0, 4))


def _is_identity_warp(mode: int, amount: float) -> bool:
    clamped_amount = float(np.clip(amount, 0.0, 1.0))

    if mode <= 0:
        return True
    if mode == 1:
        return abs(clamped_amount - 0.5) <= 1.0e-6
    if mode == 2:
        return clamped_amount <= 1.0e-6
    if mode == 3:
        return abs(clamped_amount - 0.5) <= 1.0e-6
    if mode == 4:
        return False

    return True


def _build_blackman_sinc_taps(
    tap_count: int,
    cutoff_nyquist: float,
) -> np.ndarray:
    middle_index = 0.5 * (tap_count - 1)
    taps = np.zeros(tap_count, dtype=np.float64)

    for tap_index in range(tap_count):
        offset = tap_index - middle_index
        if abs(offset) <= 1.0e-12:
            sinc_value = cutoff_nyquist
        else:
            sinc_value = np.sin(np.pi * cutoff_nyquist * offset) / (np.pi * offset)

        phase = (2.0 * np.pi * tap_index) / (tap_count - 1)
        window = 0.42 - (0.5 * np.cos(phase)) + (0.08 * np.cos(2.0 * phase))
        taps[tap_index] = sinc_value * window

    taps /= np.sum(taps)
    return taps.astype(np.float64, copy=False)


def _lookup_sample(
    bank: FixtureMipBank,
    *,
    frame_position: float,
    frequency_hz: float,
    sample_rate: int,
    phase: float,
    warp_mode: int,
    warp_amount: float,
) -> float:
    should_lookup, hold_cycle_endpoint, warped_phase = _resolve_warped_phase(warp_mode, warp_amount, phase)
    frame_lo, frame_hi, frame_t = _frame_position_to_indices(frame_position, bank.num_frames)
    mip_index = _formula_mip_index_for_frequency(frequency_hz, sample_rate)

    if hold_cycle_endpoint:
        lo = _read_bank_frame_endpoint_sample(
            bank,
            frame_index=frame_lo,
            mip_index=mip_index,
        )
        if frame_hi == frame_lo:
            return lo
        hi = _read_bank_frame_endpoint_sample(
            bank,
            frame_index=frame_hi,
            mip_index=mip_index,
        )
        return lo + ((hi - lo) * frame_t)

    if not should_lookup:
        return 0.0

    lo = _read_bank_frame_sample(
        bank,
        frame_index=frame_lo,
        mip_index=mip_index,
        phase=warped_phase,
    )

    if frame_hi == frame_lo:
        return lo

    hi = _read_bank_frame_sample(
        bank,
        frame_index=frame_hi,
        mip_index=mip_index,
        phase=warped_phase,
    )
    return lo + ((hi - lo) * frame_t)


def _lookup_sample32(
    bank: FixtureMipBank,
    *,
    frame_position: float,
    frequency_hz: float,
    sample_rate: int,
    phase: float,
    warp_mode: int,
    warp_amount: float,
) -> float:
    should_lookup, hold_cycle_endpoint, warped_phase = _resolve_warped_phase(warp_mode, warp_amount, phase)
    frame_lo, frame_hi, frame_t = _frame_position_to_indices(frame_position, bank.num_frames)
    mip_index = _formula_mip_index_for_frequency(frequency_hz, sample_rate)

    if hold_cycle_endpoint:
        lo = np.float32(_read_bank_frame_endpoint_sample(bank, frame_index=frame_lo, mip_index=mip_index))
        if frame_hi == frame_lo:
            return float(lo)
        hi = np.float32(_read_bank_frame_endpoint_sample(bank, frame_index=frame_hi, mip_index=mip_index))
        return float(np.float32(lo + np.float32((hi - lo) * np.float32(frame_t))))

    if not should_lookup:
        return 0.0

    lo = np.float32(
        _read_bank_frame_sample32(
            bank,
            frame_index=frame_lo,
            mip_index=mip_index,
            phase=warped_phase,
        )
    )

    if frame_hi == frame_lo:
        return float(lo)

    hi = np.float32(
        _read_bank_frame_sample32(
            bank,
            frame_index=frame_hi,
            mip_index=mip_index,
            phase=warped_phase,
        )
    )
    return float(np.float32(lo + np.float32((hi - lo) * np.float32(frame_t))))


def _expand_fixture_curves(fixture_dir: Path, *, num_samples: int) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    wavetable_position = _expand_value_curve(
        num_samples=num_samples,
        default=0.0,
        events=_read_value_events(fixture_dir / "wavetablePosition.json"),
        scale=1,
    )
    mseg1_depth = _expand_value_curve(
        num_samples=num_samples,
        default=0.0,
        events=_read_value_events(fixture_dir / "mseg1Depth.json"),
        scale=1,
    )
    warp_mode_curve = _expand_value_curve(
        num_samples=num_samples,
        default=0.0,
        events=_read_value_events(fixture_dir / "warpMode.json"),
        scale=1,
    )
    warp_amount_curve = _expand_value_curve(
        num_samples=num_samples,
        default=0.0,
        events=_read_value_events(fixture_dir / "warpAmount.json"),
        scale=1,
    )
    warp_mseg_depth = _expand_value_curve(
        num_samples=num_samples,
        default=0.0,
        events=_read_value_events(fixture_dir / "warpMsegDepth.json"),
        scale=1,
    )
    return wavetable_position, mseg1_depth, warp_mode_curve, warp_amount_curve, warp_mseg_depth


def _note_off_offsets_for_segment(segment: NoteSegment, *, num_samples: int) -> tuple[int, ...]:
    if segment.off_offset < num_samples:
        return (segment.off_offset,)
    return ()


def _render_alias_voice_segment(
    bank: FixtureMipBank,
    *,
    num_samples: int,
    segment: NoteSegment,
    wavetable_position: np.ndarray,
    mseg1_depth: np.ndarray,
    warp_mode_curve: np.ndarray,
    warp_amount_curve: np.ndarray,
    warp_mseg_depth: np.ndarray,
    mseg_buffer: np.ndarray,
    mseg_playback: MsegPlayback,
    oversample_factor: int,
) -> np.ndarray:
    os_rate = DEFAULT_SAMPLE_RATE * oversample_factor
    os_samples = num_samples * oversample_factor
    modulation_curve = render_mseg_reference(
        mseg_buffer,
        sample_rate=DEFAULT_SAMPLE_RATE,
        num_samples=num_samples,
        playback=mseg_playback,
        trigger_offsets=(segment.on_offset,),
        note_off_offsets=_note_off_offsets_for_segment(segment, num_samples=num_samples),
    )

    envelope = FixedASREnvelope(DEFAULT_SAMPLE_RATE)
    audio_os = np.zeros(os_samples, dtype=np.float64)
    gain_curve = np.zeros(num_samples, dtype=np.float64)
    phase = 0.0
    frequency_hz = _note_to_frequency(segment.note)

    for sample_index in range(num_samples):
        if sample_index == segment.on_offset:
            envelope.note_on(segment.velocity)
        if sample_index == segment.off_offset and segment.off_offset < num_samples:
            envelope.note_off()

        gain = envelope.step()
        gain_curve[sample_index] = gain
        if gain <= 0.0:
            continue

        modulation = float(modulation_curve[sample_index])
        frame_position = float(
            np.clip(
                wavetable_position[sample_index] + (modulation * mseg1_depth[sample_index]),
                0.0,
                1.0,
            )
        )
        warp_mode = _resolve_warp_mode(float(warp_mode_curve[sample_index]))
        effective_warp_amount = float(
            np.clip(
                warp_amount_curve[sample_index] + (modulation * warp_mseg_depth[sample_index]),
                0.0,
                1.0,
            )
        )
        current_phase_increment = float(frequency_hz / DEFAULT_SAMPLE_RATE)
        oversampled_phase_increment = current_phase_increment / oversample_factor
        os_base_index = sample_index * oversample_factor

        for oversample_index in range(oversample_factor):
            oversampled_phase = math.fmod(phase + (oversample_index * oversampled_phase_increment), 1.0)
            audio_os[os_base_index + oversample_index] = _lookup_sample(
                bank,
                frame_position=frame_position,
                frequency_hz=frequency_hz,
                sample_rate=os_rate,
                phase=oversampled_phase,
                warp_mode=warp_mode,
                warp_amount=effective_warp_amount,
            )

        phase = math.fmod(phase + current_phase_increment, 1.0)

    audio = resample_poly(audio_os, up=1, down=oversample_factor)
    if audio.shape[0] < num_samples:
        audio = np.pad(audio, (0, num_samples - audio.shape[0]))
    else:
        audio = audio[:num_samples]

    return np.asarray(audio * gain_curve * TRIM_GAIN, dtype=np.float64)


def _render_production_voice_segment(
    bank: FixtureMipBank,
    *,
    num_samples: int,
    segment: NoteSegment,
    wavetable_position: np.ndarray,
    mseg1_depth: np.ndarray,
    warp_mode_curve: np.ndarray,
    warp_amount_curve: np.ndarray,
    warp_mseg_depth: np.ndarray,
    mseg_buffer: np.ndarray,
    mseg_playback: MsegPlayback,
    production_taps: np.ndarray,
) -> np.ndarray:
    modulation_curve = render_mseg_reference(
        mseg_buffer,
        sample_rate=DEFAULT_SAMPLE_RATE,
        num_samples=num_samples,
        playback=mseg_playback,
        trigger_offsets=(segment.on_offset,),
        note_off_offsets=_note_off_offsets_for_segment(segment, num_samples=num_samples),
    )
    warp_history = np.zeros(PRODUCTION_DECIMATOR_TAP_COUNT, dtype=np.float32)
    history_write_index = 0
    envelope = FixedASREnvelope(DEFAULT_SAMPLE_RATE)
    audio = np.zeros(num_samples, dtype=np.float32)
    phase = np.float32(0.0)
    frequency_hz = np.float32(_note_to_frequency(segment.note))
    os_rate = DEFAULT_SAMPLE_RATE * PRODUCTION_OVERSAMPLE_FACTOR

    def reset_history() -> None:
        nonlocal history_write_index
        warp_history.fill(0.0)
        history_write_index = 0

    def push_history(sample: float) -> None:
        nonlocal history_write_index
        warp_history[history_write_index] = np.float32(sample)
        history_write_index = (history_write_index + 1) % PRODUCTION_DECIMATOR_TAP_COUNT

    def read_history() -> float:
        index = history_write_index
        result = np.float32(0.0)

        for tap in production_taps:
            index = (index - 1) % PRODUCTION_DECIMATOR_TAP_COUNT
            result = np.float32(result + np.float32(warp_history[index] * tap))

        return float(result)

    for sample_index in range(num_samples):
        if sample_index == segment.on_offset:
            envelope.note_on(segment.velocity)
            reset_history()
        if sample_index == segment.off_offset and segment.off_offset < num_samples:
            envelope.note_off()

        gain = np.float32(envelope.step())
        if gain <= 0.0:
            continue

        modulation = np.float32(modulation_curve[sample_index])
        frame_position = float(
            np.clip(
                np.float32(wavetable_position[sample_index]) + (modulation * np.float32(mseg1_depth[sample_index])),
                np.float32(0.0),
                np.float32(1.0),
            )
        )
        warp_mode = _resolve_warp_mode(float(warp_mode_curve[sample_index]))
        effective_warp_amount = float(
            np.clip(
                np.float32(warp_amount_curve[sample_index]) + (modulation * np.float32(warp_mseg_depth[sample_index])),
                np.float32(0.0),
                np.float32(1.0),
            )
        )
        current_phase_increment = np.float32(frequency_hz / np.float32(DEFAULT_SAMPLE_RATE))

        sample = np.float32(_lookup_sample32(
            bank,
            frame_position=frame_position,
            frequency_hz=float(frequency_hz),
            sample_rate=DEFAULT_SAMPLE_RATE,
            phase=float(phase),
            warp_mode=0,
            warp_amount=0.0,
        ))

        if warp_mode > 0:
            oversampled_phase_increment = np.float32(current_phase_increment / np.float32(PRODUCTION_OVERSAMPLE_FACTOR))

            for oversample_index in range(PRODUCTION_OVERSAMPLE_FACTOR):
                oversampled_phase = np.float32(
                    np.mod(
                        np.float32(phase + np.float32(oversample_index) * oversampled_phase_increment),
                        np.float32(1.0),
                    )
                )
                oversampled_sample = _lookup_sample32(
                    bank,
                    frame_position=frame_position,
                    frequency_hz=float(frequency_hz),
                    sample_rate=os_rate,
                    phase=float(oversampled_phase),
                    warp_mode=warp_mode,
                    warp_amount=effective_warp_amount,
                )
                push_history(oversampled_sample)

            if not _is_identity_warp(warp_mode, effective_warp_amount):
                sample = np.float32(read_history())

        audio[sample_index] = np.float32(sample * gain * np.float32(TRIM_GAIN))
        phase = np.float32(np.mod(np.float32(phase + current_phase_increment), np.float32(1.0)))

    return audio


def _render_warp_reference(
    fixture_dir: Path,
    *,
    num_samples: int,
    oversample_factor: int = OVERSAMPLE_FACTOR,
) -> np.ndarray:
    bank = _load_bank_from_fixture(fixture_dir)
    wavetable_position, mseg1_depth, warp_mode_curve, warp_amount_curve, warp_mseg_depth = _expand_fixture_curves(
        fixture_dir,
        num_samples=num_samples,
    )
    mseg_buffer = _load_mseg_buffer(fixture_dir)
    mseg_playback = _load_mseg_playback(fixture_dir)
    note_segments = _decode_note_segments(fixture_dir / "midiIn.json", num_samples=num_samples)
    mixed = np.zeros(num_samples, dtype=np.float64)

    for segment in note_segments:
        mixed += _render_alias_voice_segment(
            bank,
            num_samples=num_samples,
            segment=segment,
            wavetable_position=wavetable_position,
            mseg1_depth=mseg1_depth,
            warp_mode_curve=warp_mode_curve,
            warp_amount_curve=warp_amount_curve,
            warp_mseg_depth=warp_mseg_depth,
            mseg_buffer=mseg_buffer,
            mseg_playback=mseg_playback,
            oversample_factor=oversample_factor,
        )

    stereo = np.column_stack((mixed, mixed)).astype(np.float32)
    return stereo


def _render_production_warp_reference(
    fixture_dir: Path,
    *,
    num_samples: int,
) -> np.ndarray:
    bank = _load_bank_from_fixture(fixture_dir)
    wavetable_position, mseg1_depth, warp_mode_curve, warp_amount_curve, warp_mseg_depth = _expand_fixture_curves(
        fixture_dir,
        num_samples=num_samples,
    )
    mseg_buffer = _load_mseg_buffer(fixture_dir)
    mseg_playback = _load_mseg_playback(fixture_dir)
    note_segments = _decode_note_segments(fixture_dir / "midiIn.json", num_samples=num_samples)
    production_taps = _build_blackman_sinc_taps(
        PRODUCTION_DECIMATOR_TAP_COUNT,
        PRODUCTION_DECIMATOR_CUTOFF_NYQUIST,
    ).astype(np.float32, copy=False)
    mixed = np.zeros(num_samples, dtype=np.float32)

    for segment in note_segments:
        mixed += _render_production_voice_segment(
            bank,
            num_samples=num_samples,
            segment=segment,
            wavetable_position=wavetable_position,
            mseg1_depth=mseg1_depth,
            warp_mode_curve=warp_mode_curve,
            warp_amount_curve=warp_amount_curve,
            warp_mseg_depth=warp_mseg_depth,
            mseg_buffer=mseg_buffer,
            mseg_playback=mseg_playback,
            production_taps=production_taps,
        )

    stereo = np.column_stack((mixed, mixed)).astype(np.float32)
    return stereo


def _write_reference_wav(path: Path, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(path, DEFAULT_SAMPLE_RATE, audio)


def _delete_unwanted_expected_outputs(fixture_dir: Path) -> None:
    for candidate in fixture_dir.glob("expectedOutput-*.json"):
        candidate.unlink()


def _plot_review_assets() -> None:
    import matplotlib.pyplot as plt

    PLOT_ROOT.mkdir(parents=True, exist_ok=True)

    saw_bank = _load_bank_from_fixture(FIXTURE_ROOT / "amount_automation")
    bright_bank = _load_bank_from_fixture(FIXTURE_ROOT / "bend_harmonic")
    square_bank = _load_bank_from_fixture(FIXTURE_ROOT / "pwm_edge")
    triangle_bank = _load_bank_from_fixture(FIXTURE_ROOT / "mirror_triangle")

    phase_grid = np.linspace(0.0, 1.0, num=SAMPLES_PER_FRAME, endpoint=False, dtype=np.float64)

    def render_cycle(bank: FixtureMipBank, mode: int, amount: float) -> np.ndarray:
        return np.asarray(
            [
                _lookup_sample(
                    bank,
                    frame_position=0.0,
                    frequency_hz=440.0,
                    sample_rate=DEFAULT_SAMPLE_RATE * OVERSAMPLE_FACTOR,
                    phase=float(phase),
                    warp_mode=mode,
                    warp_amount=amount,
                )
                for phase in phase_grid
            ],
            dtype=np.float64,
        )

    plots = [
        ("bend_waveforms.png", "Bend +/- Waveforms", bright_bank, 1, [0.0, 0.25, 0.5, 0.75, 1.0]),
        ("pwm_waveforms.png", "PWM Waveforms", square_bank, 2, [0.0, 0.35, 0.6, 0.85]),
        ("asym_waveforms.png", "Asym +/- Waveforms", triangle_bank, 3, [0.0, 0.25, 0.5, 0.75, 1.0]),
        ("mirror_waveforms.png", "Mirror Waveforms", triangle_bank, 4, [0.0, 0.25, 0.5, 0.75, 1.0]),
    ]

    for filename, title, bank, mode, amounts in plots:
        fig, axis = plt.subplots(figsize=(12, 4))
        for amount in amounts:
            axis.plot(phase_grid, render_cycle(bank, mode, amount), label=f"amount={amount:.2f}")
        axis.set_title(title)
        axis.set_xlabel("Phase")
        axis.set_ylabel("Amplitude")
        axis.legend(loc="best")
        axis.grid(True, alpha=0.25)
        fig.tight_layout()
        fig.savefig(PLOT_ROOT / filename, dpi=160)
        plt.close(fig)

    def render_alias_curve(fixture_name: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        fixture_dir = FIXTURE_ROOT / fixture_name
        alias_reference = _render_warp_reference(fixture_dir, num_samples=4096, oversample_factor=OVERSAMPLE_FACTOR)[:, 0]
        production_reference = _render_production_warp_reference(fixture_dir, num_samples=4096)[:, 0]
        naive = _render_warp_reference(fixture_dir, num_samples=4096, oversample_factor=1)[:, 0]
        return naive, production_reference, alias_reference

    alias_specs = [
        ("bend_alias_spectra.png", "Bend Alias Stress", "bend_harmonic"),
        ("pwm_alias_spectra.png", "PWM Alias Stress", "pwm_edge"),
    ]

    for filename, title, fixture_name in alias_specs:
        naive, production_reference, alias_reference = render_alias_curve(fixture_name)
        freqs = np.fft.rfftfreq(alias_reference.size, d=1.0 / DEFAULT_SAMPLE_RATE)
        naive_db = 20.0 * np.log10(np.maximum(np.abs(np.fft.rfft(naive)), 1e-8))
        production_db = 20.0 * np.log10(np.maximum(np.abs(np.fft.rfft(production_reference)), 1e-8))
        alias_reference_db = 20.0 * np.log10(np.maximum(np.abs(np.fft.rfft(alias_reference)), 1e-8))

        fig, axis = plt.subplots(figsize=(12, 4))
        axis.plot(freqs, naive_db, label="naive (1x)")
        axis.plot(freqs, production_db, label="production FIR")
        axis.plot(freqs, alias_reference_db, label=f"alias oracle ({OVERSAMPLE_FACTOR}x)")
        axis.set_xlim(0.0, DEFAULT_SAMPLE_RATE * 0.5)
        axis.set_ylim(-140.0, np.max(alias_reference_db) + 6.0)
        axis.set_title(title)
        axis.set_xlabel("Frequency (Hz)")
        axis.set_ylabel("Magnitude (dB)")
        axis.legend(loc="best")
        axis.grid(True, alpha=0.25)
        fig.tight_layout()
        fig.savefig(PLOT_ROOT / filename, dpi=160)
        plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--expand-only",
        action="store_true",
        help="rewrite wavetableMipFrame.json fixtures to contain the full uploaded mip pyramid, then exit",
    )
    args = parser.parse_args()

    _expand_all_fixture_uploaded_mips()

    if args.expand_only:
        return

    for case_name, output_num_samples in WARP_CASE_OUTPUT_SAMPLES.items():
        fixture_dir = FIXTURE_ROOT / case_name
        _require_fixture_files(fixture_dir, REQUIRED_WARP_INPUT_FILES)
        _delete_unwanted_expected_outputs(fixture_dir)
        if case_name in NEUTRAL_BASELINE_CASES:
            baseline_case = NEUTRAL_BASELINE_CASES[case_name]
            baseline_audio = FIXTURE_ROOT / baseline_case / "expectedOutput-audioOut.wav"
            if not baseline_audio.exists():
                raise FileNotFoundError(f"Missing baseline audio for neutral warp case: {baseline_audio}")
            (fixture_dir / "expectedOutput-audioOut.wav").write_bytes(baseline_audio.read_bytes())
        else:
            alias_num_samples = ALIAS_REFERENCE_SAMPLES.get(case_name, output_num_samples)
            production_audio = _render_production_warp_reference(fixture_dir, num_samples=output_num_samples)
            alias_audio = _render_warp_reference(fixture_dir, num_samples=alias_num_samples)
            _write_reference_wav(fixture_dir / "expectedOutput-audioOut.wav", production_audio)
            _write_reference_wav(fixture_dir / ALIAS_REFERENCE_FILENAME, alias_audio)

    _plot_review_assets()


if __name__ == "__main__":
    main()
