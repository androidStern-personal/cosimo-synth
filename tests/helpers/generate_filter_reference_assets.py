from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy.io import wavfile

from bench import render_mseg_reference
from tests.helpers.generate_warp_reference_assets import (
    DEFAULT_SAMPLE_RATE,
    FIXTURE_ROOT as _WARP_FIXTURE_ROOT,
    MIP_LEVEL_COUNT,
    FixedASREnvelope,
    TRIM_GAIN,
    _decode_note_segments,
    _build_mip_frame,
    _expand_fixture_uploaded_mips,
    _expand_value_curve,
    _formula_mip_index_for_frequency,
    _frame_position_to_indices,
    _load_mseg_buffer,
    _load_mseg_playback,
    _load_raw_frames_from_fixture,
    _note_off_offsets_for_segment,
    _note_to_frequency,
    _pad_frame,
    _read_json,
    _read_bank_frame_sample32,
    _read_value_events,
    _write_reference_wav,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_ROOT = REPO_ROOT / "tests" / "cmajor_filter" / "fixtures"

FILTER_CASE_OUTPUT_SAMPLES = {
    "filter_off_identity": 4096,
    "lowpass_static": 4096,
    "highpass_static": 4096,
    "bandpass_static": 4096,
    "notch_static": 4096,
    "peak_static": 4096,
    "mseg_lowpass_pluck": 4096,
    "resonance_extreme": 4096,
    "two_voice_staggered_mseg": 4096,
    "fast_mseg_cutoff_motion_lowpass": 4096,
    "fast_mseg_cutoff_motion_bandpass": 4096,
    "fast_mseg_cutoff_motion_peak_high_q": 4096,
}

NATIVE_PRODUCTION_GOLDEN_CASES = {
    "mseg_lowpass_pluck",
    "two_voice_staggered_mseg",
    "fast_mseg_cutoff_motion_lowpass",
    "fast_mseg_cutoff_motion_bandpass",
    "fast_mseg_cutoff_motion_peak_high_q",
}

FILTER_MODE_OFF = 0
FILTER_MODE_LOWPASS = 1
FILTER_MODE_HIGHPASS = 2
FILTER_MODE_BANDPASS = 3
FILTER_MODE_NOTCH = 4
FILTER_MODE_PEAK = 5
FILTER_CUTOFF_MIN_HZ = 20.0
FILTER_CUTOFF_MAX_HZ = 20_000.0
FILTER_Q_MIN = 0.1
FILTER_Q_MAX = 20.0
CENTER_PAN_GAIN = np.float32(2.0 ** -0.5)
MODULATION_SOURCE_MSEG = 1
MODULATION_TARGET_FILTER_CUTOFF_OCTAVES = 3


@dataclass(frozen=True, slots=True)
class SingleMipBank:
    padded_mips: np.ndarray
    num_frames: int


class SimperFilter:
    def __init__(self) -> None:
        self.ic1eq = 0.0
        self.ic2eq = 0.0
        self.a1 = 0.0
        self.a2 = 0.0
        self.a3 = 0.0
        self.f0 = 1.0
        self.f1 = 0.0
        self.f2 = 0.0
        self.mode = FILTER_MODE_LOWPASS

    def reset(self) -> None:
        self.ic1eq = 0.0
        self.ic2eq = 0.0

    def set_mode(self, mode: int) -> None:
        self.mode = int(np.clip(mode, FILTER_MODE_OFF, FILTER_MODE_PEAK))

    def set_frequency(self, sample_rate: int, cutoff_hz: float, q: float) -> None:
        clamped_cutoff = _clamp_filter_cutoff_hz(cutoff_hz, sample_rate)
        clamped_q = _clamp_filter_q(q)
        g = float(np.tan(np.pi * clamped_cutoff / sample_rate))
        k = 1.0 / clamped_q

        if self.mode == FILTER_MODE_LOWPASS:
            self.f0, self.f1, self.f2 = 0.0, 0.0, 1.0
        elif self.mode == FILTER_MODE_HIGHPASS:
            self.f0, self.f1, self.f2 = 1.0, -k, -1.0
        elif self.mode == FILTER_MODE_BANDPASS:
            self.f0, self.f1, self.f2 = 0.0, 1.0, 0.0
        elif self.mode == FILTER_MODE_NOTCH:
            self.f0, self.f1, self.f2 = 1.0, -k, 0.0
        elif self.mode == FILTER_MODE_PEAK:
            self.f0, self.f1, self.f2 = 1.0, -k, -2.0
        else:
            self.f0, self.f1, self.f2 = 1.0, 0.0, 0.0

        self.a1 = 1.0 / (1.0 + (g * (g + k)))
        self.a2 = g * self.a1
        self.a3 = g * self.a2

    def process(self, sample: float) -> float:
        v3 = sample - self.ic2eq
        v1 = (self.a1 * self.ic1eq) + (self.a2 * v3)
        v2 = self.ic2eq + (self.a2 * self.ic1eq) + (self.a3 * v3)
        self.ic1eq = (2.0 * v1) - self.ic1eq
        self.ic2eq = (2.0 * v2) - self.ic2eq
        return float((self.f0 * sample) + (self.f1 * v1) + (self.f2 * v2))


def _resolve_filter_mode(raw_mode: float) -> int:
    return int(np.clip(np.floor(raw_mode + 0.5), FILTER_MODE_OFF, FILTER_MODE_PEAK))


def _clamp_filter_cutoff_hz(cutoff_hz: float, sample_rate: int) -> float:
    return float(np.clip(cutoff_hz, FILTER_CUTOFF_MIN_HZ, min(FILTER_CUTOFF_MAX_HZ, sample_rate * 0.48)))


def _clamp_filter_q(q: float) -> float:
    return float(np.clip(q, FILTER_Q_MIN, FILTER_Q_MAX))


def _load_bank_from_fixture(fixture_dir: Path) -> SingleMipBank:
    raw_frames = _load_raw_frames_from_fixture(fixture_dir)
    padded_mips = np.stack(
        [
            np.stack([_pad_frame(_build_mip_frame(frame, mip_index)) for frame in raw_frames], axis=0)
            for mip_index in range(MIP_LEVEL_COUNT)
        ],
        axis=0,
    ).astype(np.float32, copy=False)
    return SingleMipBank(padded_mips=padded_mips, num_frames=int(raw_frames.shape[0]))


def _expand_filter_curves(
    fixture_dir: Path,
    *,
    num_samples: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
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
    filter_mode = _expand_value_curve(
        num_samples=num_samples,
        default=0.0,
        events=_read_value_events(fixture_dir / "filterMode.json"),
        scale=1,
    )
    filter_cutoff = _expand_value_curve(
        num_samples=num_samples,
        default=1000.0,
        events=_read_value_events(fixture_dir / "filterCutoff.json"),
        scale=1,
    )
    filter_q = _expand_value_curve(
        num_samples=num_samples,
        default=0.707107,
        events=_read_value_events(fixture_dir / "filterQ.json"),
        scale=1,
    )
    filter_mseg_depth = np.full(num_samples, _read_filter_mseg_depth(fixture_dir), dtype=np.float32)
    return wavetable_position, mseg1_depth, filter_mode, filter_cutoff, filter_q, filter_mseg_depth


def _read_filter_mseg_depth(fixture_dir: Path) -> float:
    route_path = fixture_dir / "modulationRoute.json"
    if route_path.exists():
        for entry in _read_json(route_path):
            event = entry.get("event", {})
            if (
                bool(event.get("enabled", False))
                and int(event.get("sourceKind", 0)) == MODULATION_SOURCE_MSEG
                and int(event.get("sourceSlot", 0)) == 1
                and int(event.get("targetKind", 0)) == MODULATION_TARGET_FILTER_CUTOFF_OCTAVES
            ):
                return float(event.get("amount", 0.0))

    events = _read_value_events(fixture_dir / "filterMsegDepth.json")
    if not events:
        return 0.0
    return float(events[-1].get("value", 0.0))


def _read_oscillator_sample(
    bank: SingleMipBank,
    *,
    frame_position: float,
    frequency_hz: float,
    phase: float,
) -> float:
    mip_index = _formula_mip_index_for_frequency(frequency_hz, DEFAULT_SAMPLE_RATE)
    frame_lo, frame_hi, frame_t = _frame_position_to_indices(frame_position, bank.num_frames)
    lo = _read_bank_frame_sample32(bank, frame_index=frame_lo, mip_index=mip_index, phase=phase)

    if frame_hi == frame_lo:
        return float(np.float32(lo))

    hi = _read_bank_frame_sample32(bank, frame_index=frame_hi, mip_index=mip_index, phase=phase)
    return float(np.float32(lo + np.float32((hi - lo) * np.float32(frame_t))))


def render_filter_reference_audio(fixture_dir: Path, *, num_samples: int) -> np.ndarray:
    bank = _load_bank_from_fixture(fixture_dir)
    wavetable_position, mseg1_depth, filter_mode_curve, filter_cutoff_curve, filter_q_curve, filter_mseg_depth_curve = _expand_filter_curves(
        fixture_dir,
        num_samples=num_samples,
    )
    mseg_buffer = _load_mseg_buffer(fixture_dir)
    mseg_playback = _load_mseg_playback(fixture_dir)
    note_segments = _decode_note_segments(fixture_dir / "midiIn.json", num_samples=num_samples)
    mixed = np.zeros(num_samples, dtype=np.float32)

    for segment in note_segments:
        modulation_curve = render_mseg_reference(
            mseg_buffer,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=num_samples,
            playback=mseg_playback,
            trigger_offsets=(segment.on_offset,),
            note_off_offsets=_note_off_offsets_for_segment(segment, num_samples=num_samples),
        )
        envelope = FixedASREnvelope(DEFAULT_SAMPLE_RATE)
        filter_state = SimperFilter()
        phase = np.float32(0.0)
        frequency_hz = np.float32(_note_to_frequency(segment.note))
        current_phase_increment = np.float32(frequency_hz / np.float32(DEFAULT_SAMPLE_RATE))

        for sample_index in range(num_samples):
            if sample_index == segment.on_offset:
                envelope.note_on(segment.velocity)
                filter_state.reset()
            if sample_index == segment.off_offset and segment.off_offset < num_samples:
                envelope.note_off()

            gain = np.float32(envelope.step())
            if gain <= 0.0:
                continue

            modulation = np.float32(modulation_curve[sample_index])
            frame_position = float(np.clip(
                np.float32(wavetable_position[sample_index]) + (modulation * np.float32(mseg1_depth[sample_index])),
                np.float32(0.0),
                np.float32(1.0),
            ))
            sample = np.float32(_read_oscillator_sample(
                bank,
                frame_position=frame_position,
                frequency_hz=float(frequency_hz),
                phase=float(phase),
            ))

            filter_mode = _resolve_filter_mode(float(filter_mode_curve[sample_index]))
            base_cutoff_hz = _clamp_filter_cutoff_hz(float(filter_cutoff_curve[sample_index]), DEFAULT_SAMPLE_RATE)
            effective_cutoff_hz = _clamp_filter_cutoff_hz(
                base_cutoff_hz * float(np.power(2.0, float(modulation) * float(filter_mseg_depth_curve[sample_index]))),
                DEFAULT_SAMPLE_RATE,
            )
            effective_q = _clamp_filter_q(float(filter_q_curve[sample_index]))

            if filter_mode > FILTER_MODE_OFF:
                filter_state.set_mode(filter_mode)
                filter_state.set_frequency(DEFAULT_SAMPLE_RATE, effective_cutoff_hz, effective_q)
                sample = np.float32(filter_state.process(float(sample)))
            else:
                filter_state.reset()

            mixed[sample_index] = np.float32(
                mixed[sample_index] + (sample * gain * np.float32(TRIM_GAIN) * CENTER_PAN_GAIN)
            )
            phase = np.float32(np.mod(np.float32(phase + current_phase_increment), np.float32(1.0)))

    return np.column_stack((mixed, mixed)).astype(np.float32)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate checked-in filter reference WAVs.")
    parser.add_argument("--fixture", action="append", default=[], help="Specific fixture name(s) to refresh.")
    parser.add_argument(
        "--expand-only",
        action="store_true",
        help="rewrite wavetableMipFrame.json fixtures to contain the full uploaded mip pyramid, then exit",
    )
    args = parser.parse_args()

    fixture_names = args.fixture or sorted(FILTER_CASE_OUTPUT_SAMPLES.keys())

    for fixture_name in fixture_names:
        fixture_dir = FIXTURE_ROOT / fixture_name
        if (fixture_dir / "wavetableMipFrame.json").exists() and (fixture_dir / "wavetableLoadBegin.json").exists():
            _expand_fixture_uploaded_mips(fixture_dir)

    if args.expand_only:
        return

    for fixture_name in fixture_names:
        fixture_dir = FIXTURE_ROOT / fixture_name
        if fixture_name in NATIVE_PRODUCTION_GOLDEN_CASES:
            audio_path = fixture_dir / "expectedOutput-audioOut.wav"
            if not audio_path.exists():
                raise FileNotFoundError(f"Missing native production golden audio for filter case: {audio_path}")
            continue

        num_samples = FILTER_CASE_OUTPUT_SAMPLES[fixture_name]
        audio = render_filter_reference_audio(fixture_dir, num_samples=num_samples)
        _write_reference_wav(fixture_dir / "expectedOutput-audioOut.wav", audio)


if __name__ == "__main__":
    main()
