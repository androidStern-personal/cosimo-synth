from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from math import cos, exp, log2, pi, sin, tanh
from time import perf_counter

import numpy as np


class CombCandidate(StrEnum):
    REFERENCE = "reference"
    DISPERSIVE = "dispersive"
    VECTOR = "vector"


@dataclass(frozen=True)
class CombSettings:
    sample_rate: int = 48_000
    tune_hz: float = 220.0
    decay_seconds: float = 1.4
    damping_hz: float = 7_500.0
    polarity: float = 1.0
    dispersion: float = 0.55
    motion: float = 0.12
    width: float = 0.65
    drive: float = 0.18
    wet: float = 0.72


@dataclass(frozen=True)
class CombRender:
    audio: np.ndarray
    elapsed_seconds: float


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)


def _fractional_read(buffer: np.ndarray, write_index: int, delay_samples: float) -> float:
    size = buffer.size
    position = (write_index - delay_samples) % size
    index_a = int(position)
    fraction = position - index_a
    index_b = (index_a + 1) % size
    return float(buffer[index_a] + ((buffer[index_b] - buffer[index_a]) * fraction))


def _feedback_gain(delay_samples: float, settings: CombSettings) -> float:
    delay_seconds = delay_samples / settings.sample_rate
    # -60 dB at the displayed decay time.
    magnitude = 10.0 ** (-3.0 * delay_seconds / max(0.02, settings.decay_seconds))
    return _clamp(settings.polarity, -1.0, 1.0) * min(magnitude, 0.9985)


def _damping_coefficient(settings: CombSettings) -> float:
    cutoff = _clamp(settings.damping_hz, 100.0, settings.sample_rate * 0.45)
    return exp(-2.0 * pi * cutoff / settings.sample_rate)


def _soft_limit(value: float, drive: float) -> float:
    amount = _clamp(drive, 0.0, 1.0)
    if amount <= 1.0e-9:
        return value
    gain = 1.0 + (amount * 5.0)
    # Dividing by gain keeps the derivative at the origin equal to one. A
    # full-scale normalization such as tanh(x * gain) / tanh(gain) makes the
    # small-signal slope greater than one and can turn a nominally decaying
    # feedback loop into a growing one.
    shaped = tanh(value * gain) / gain
    return (value * (1.0 - amount)) + (shaped * amount)


def _mix(dry: float, wet_left: float, wet_right: float, settings: CombSettings) -> tuple[float, float]:
    wet = _clamp(settings.wet, 0.0, 1.0)
    dry_gain = cos(wet * pi * 0.5)
    wet_gain = sin(wet * pi * 0.5)
    return (
        (dry * dry_gain) + (wet_left * wet_gain),
        (dry * dry_gain) + (wet_right * wet_gain),
    )


def render_reference(source: np.ndarray, settings: CombSettings) -> CombRender:
    mono = np.asarray(source, dtype=np.float64).reshape(-1)
    delay = settings.sample_rate / _clamp(settings.tune_hz, 30.0, 8_000.0)
    buffer = np.zeros(int(settings.sample_rate / 20.0) + 8, dtype=np.float64)
    damping = _damping_coefficient(settings)
    damped = 0.0
    feedback = _feedback_gain(delay, settings)
    output = np.zeros((mono.size, 2), dtype=np.float64)
    write_index = 0
    width = _clamp(settings.width, 0.0, 1.0)
    started = perf_counter()

    for frame, dry in enumerate(mono):
        delayed = _fractional_read(buffer, write_index, delay)
        damped = ((1.0 - damping) * delayed) + (damping * damped)
        returned = _soft_limit(damped, settings.drive)
        buffer[write_index] = float(dry) + (feedback * returned)
        write_index = (write_index + 1) % buffer.size
        right_wet = delayed * (1.0 - (2.0 * width))
        output[frame] = _mix(float(dry), delayed, right_wet, settings)

    return CombRender(output.astype(np.float32), perf_counter() - started)


def _allpass_sample(value: float, coefficient: float, x1: np.ndarray, y1: np.ndarray) -> float:
    current = value
    for stage in range(x1.size):
        next_value = (coefficient * current) + x1[stage] - (coefficient * y1[stage])
        x1[stage] = current
        y1[stage] = next_value
        current = next_value
    return current


def _allpass_group_delay(coefficient: float, radians: float, stages: int) -> float:
    numerator = 1.0 - (coefficient * coefficient)
    denominator = 1.0 + (coefficient * coefficient) + (2.0 * coefficient * cos(radians))
    return stages * numerator / max(1.0e-9, denominator)


def render_dispersive(source: np.ndarray, settings: CombSettings) -> CombRender:
    mono = np.asarray(source, dtype=np.float64).reshape(-1)
    target_period = settings.sample_rate / _clamp(settings.tune_hz, 30.0, 8_000.0)
    coefficient = _clamp(settings.dispersion, -0.95, 0.95) * 0.68
    stages = 4
    radians = 2.0 * pi * settings.tune_hz / settings.sample_rate
    channel_coefficients = (coefficient, coefficient * -0.83)
    channel_periods = (
        target_period,
        target_period * (1.0 + (0.0025 * _clamp(settings.width, 0.0, 1.0))),
    )
    channel_delays = tuple(
        max(4.0, period - _allpass_group_delay(channel_coefficient, radians, stages))
        for period, channel_coefficient in zip(channel_periods, channel_coefficients, strict=True)
    )
    buffer_size = int(settings.sample_rate / 20.0) + 16
    buffers = [np.zeros(buffer_size, dtype=np.float64) for _ in range(2)]
    ap_x = [np.zeros(stages, dtype=np.float64) for _ in range(2)]
    ap_y = [np.zeros(stages, dtype=np.float64) for _ in range(2)]
    damping = _damping_coefficient(settings)
    damped = [0.0, 0.0]
    feedback = _feedback_gain(target_period, settings)
    output = np.zeros((mono.size, 2), dtype=np.float64)
    write_index = 0
    started = perf_counter()

    for frame, dry in enumerate(mono):
        wet_channels = [0.0, 0.0]
        for channel, delay in enumerate(channel_delays):
            delayed = _fractional_read(buffers[channel], write_index, delay)
            channel_coefficient = channel_coefficients[channel]
            dispersed = _allpass_sample(delayed, channel_coefficient, ap_x[channel], ap_y[channel])
            damped[channel] = ((1.0 - damping) * dispersed) + (damping * damped[channel])
            returned = _soft_limit(damped[channel], settings.drive)
            buffers[channel][write_index] = float(dry) + (feedback * returned)
            wet_channels[channel] = delayed
        write_index = (write_index + 1) % buffer_size
        output[frame] = _mix(float(dry), wet_channels[0], wet_channels[1], settings)

    return CombRender(output.astype(np.float32), perf_counter() - started)


_HADAMARD_4 = np.asarray(
    [
        [1.0, 1.0, 1.0, 1.0],
        [1.0, -1.0, 1.0, -1.0],
        [1.0, 1.0, -1.0, -1.0],
        [1.0, -1.0, -1.0, 1.0],
    ],
    dtype=np.float64,
) * 0.5


def render_vector(source: np.ndarray, settings: CombSettings) -> CombRender:
    mono = np.asarray(source, dtype=np.float64).reshape(-1)
    target_period = settings.sample_rate / _clamp(settings.tune_hz, 30.0, 8_000.0)
    ratios = np.asarray([1.0, 1.011, 0.987, 1.027], dtype=np.float64)
    base_delays = np.maximum(4.0, target_period * ratios)
    buffer_size = int(settings.sample_rate / 20.0) + 32
    buffers = [np.zeros(buffer_size, dtype=np.float64) for _ in range(4)]
    phases = np.asarray([0.0, 0.25, 0.5, 0.75], dtype=np.float64)
    feedback = np.asarray([_feedback_gain(delay, settings) for delay in base_delays])
    damping = _damping_coefficient(settings)
    damped = np.zeros(4, dtype=np.float64)
    prior_reads = np.zeros(4, dtype=np.float64)
    injection = np.asarray([0.5, 0.5, 0.5, 0.5], dtype=np.float64)
    projection_left = np.asarray([0.5, 0.5, -0.5, 0.5], dtype=np.float64)
    projection_right = np.asarray([0.5, -0.5, 0.5, 0.5], dtype=np.float64)
    output = np.zeros((mono.size, 2), dtype=np.float64)
    write_index = 0
    motion = _clamp(settings.motion, 0.0, 1.0)
    modulation_hz = 0.11 + (0.31 * motion)
    excursion = min(3.0, target_period * 0.018) * motion
    started = perf_counter()

    for frame, dry in enumerate(mono):
        rotated = _HADAMARD_4 @ (prior_reads * feedback)
        for voice in range(4):
            phase = phases[voice] + (frame * modulation_hz / settings.sample_rate)
            delay = base_delays[voice] + (excursion * sin(2.0 * pi * phase))
            buffers[voice][write_index] = (float(dry) * injection[voice]) + _soft_limit(
                float(rotated[voice]),
                settings.drive,
            )

        reads = np.asarray(
            [_fractional_read(buffers[voice], write_index, base_delays[voice] + (
                excursion * sin(2.0 * pi * (phases[voice] + (frame * modulation_hz / settings.sample_rate)))
            )) for voice in range(4)],
            dtype=np.float64,
        )
        damped = ((1.0 - damping) * reads) + (damping * damped)
        prior_reads = damped
        write_index = (write_index + 1) % buffer_size
        wet_left = float(projection_left @ reads)
        wet_right = float(projection_right @ reads)
        width = _clamp(settings.width, 0.0, 1.0)
        wet_mid = (wet_left + wet_right) * 0.5
        wet_left = wet_mid + ((wet_left - wet_mid) * width)
        wet_right = wet_mid + ((wet_right - wet_mid) * width)
        output[frame] = _mix(float(dry), wet_left, wet_right, settings)

    return CombRender(output.astype(np.float32), perf_counter() - started)


def render_candidate(
    candidate: CombCandidate,
    source: np.ndarray,
    settings: CombSettings,
) -> CombRender:
    if candidate is CombCandidate.REFERENCE:
        return render_reference(source, settings)
    if candidate is CombCandidate.DISPERSIVE:
        return render_dispersive(source, settings)
    if candidate is CombCandidate.VECTOR:
        return render_vector(source, settings)
    raise ValueError(f"Unsupported comb candidate: {candidate}")


def estimate_tuning_cents(audio: np.ndarray, settings: CombSettings, start_frame: int) -> float:
    mono = np.mean(np.asarray(audio, dtype=np.float64), axis=1)
    window = mono[start_frame:]
    if window.size < 64:
        raise ValueError("Not enough audio to estimate tuning")
    spectrum = np.abs(np.fft.rfft(window * np.hanning(window.size)))
    frequencies = np.fft.rfftfreq(window.size, 1.0 / settings.sample_rate)
    search = (frequencies >= settings.tune_hz * 0.75) & (frequencies <= settings.tune_hz * 1.25)
    if not np.any(search):
        raise ValueError("Tuning search range is empty")
    peak_frequency = float(frequencies[search][np.argmax(spectrum[search])])
    return 1_200.0 * log2(peak_frequency / settings.tune_hz)


def render_metrics(render: CombRender, settings: CombSettings, excitation_frames: int) -> dict[str, float | bool]:
    audio = np.asarray(render.audio, dtype=np.float64)
    mono = np.mean(audio, axis=1)
    tail_start = min(max(excitation_frames, 1), max(1, mono.size - 2))
    tail = mono[tail_start:]
    midpoint = tail_start + max(1, (mono.size - tail_start) // 2)
    early_tail = mono[tail_start:midpoint]
    late_tail = mono[midpoint:]
    rms = lambda values: float(np.sqrt(np.mean(values * values))) if values.size else 0.0
    left = audio[:, 0]
    right = audio[:, 1]
    correlation = float(np.corrcoef(left, right)[0, 1]) if np.std(left) > 1.0e-12 and np.std(right) > 1.0e-12 else 1.0
    return {
        "finite": bool(np.all(np.isfinite(audio))),
        "peak": float(np.max(np.abs(audio))),
        "rms": rms(audio),
        "dc": float(np.mean(mono)),
        "stereoCorrelation": correlation,
        "monoFoldRms": rms(mono),
        "earlyTailRms": rms(early_tail),
        "lateTailRms": rms(late_tail),
        "lateToEarlyTail": rms(late_tail) / max(1.0e-12, rms(early_tail)),
        "elapsedSeconds": render.elapsed_seconds,
        "realtimeFactor": (audio.shape[0] / settings.sample_rate) / max(render.elapsed_seconds, 1.0e-12),
    }
