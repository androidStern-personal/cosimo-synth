from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pytest

from test_seqfx_probe import (
    EFFECT_DIRTY,
    EFFECT_FILTER,
    EFFECT_FLANGE,
    EFFECT_PITCH,
    EFFECT_REVERSE,
    EFFECT_RING,
    EFFECT_STUTTER,
    EFFECT_TALK_BOX,
    EFFECT_VIBRO,
    GeneratedRuntime,
    LANE_FILTER,
    STEP_COUNT,
    _activate_step,
    _base_schedule,
    _credible_refined_frequency_near,
    _empty_upload,
    _fold_frequency,
    _render,
    _render_pitch,
    _render_reverse,
    _rms,
    _sine_at_rate,
    _step_frames_at_rate,
    _tone_amplitude,
    generated_runtime,
)


RATE_PROBES = (44_100, 48_000, 88_200, 96_000, 192_000)
BOUNDARY_VECTOR_SEED = 0x53455146


@dataclass(frozen=True)
class EffectProbe:
    name: str
    effect_type: int
    params: tuple[float, ...]


EFFECT_PROBES = (
    EffectProbe("filter", EFFECT_FILTER, (0.0, 1_200.0, 1_200.0, 0.707, 1.0)),
    EffectProbe("stutter", EFFECT_STUTTER, (4.0, 1.0, 0.2, 0.85)),
    EffectProbe("pitch", EFFECT_PITCH, (7.0, 0.0, 48.0, 0.0, 0.0)),
    EffectProbe("ring", EFFECT_RING, (440.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0)),
    EffectProbe("reverse", EFFECT_REVERSE, (4.0, 0.08, 0.0, 250.0, 1.0)),
    EffectProbe("talk-box", EFFECT_TALK_BOX, (0.0, 0.0, 0.0, 6.0, 0.3, 0.15, 0.0)),
    EffectProbe("vibro", EFFECT_VIBRO, (4.0, 28.0, 0.0, 0.0, 1.0, 2.0)),
    EffectProbe("flange", EFFECT_FLANGE, (1.2, 3.5, 0.28, 0.55, 0.0, 0.0, 1.0, 5.0)),
    EffectProbe("dirty", EFFECT_DIRTY, (12.0, 0.0, 0.0, 0.65, 12_000.0, -6.0)),
)


def _boundary_signal(frames: int, sample_rate: int) -> np.ndarray:
    rng = np.random.default_rng(BOUNDARY_VECTOR_SEED)
    timeline = np.arange(frames, dtype=np.float64) / sample_rate
    noise = rng.standard_normal(frames) * 0.025
    mono = (
        (0.12 * np.sin(2.0 * np.pi * 173.0 * timeline))
        + (0.08 * np.sin(2.0 * np.pi * 1_997.0 * timeline))
        + noise
    ).astype(np.float32)
    mono[frames // 3] += 0.2
    return np.column_stack([mono, mono]).astype(np.float32)


def _render_effect(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    source: np.ndarray,
    *,
    sample_rate: int,
    probe: EffectProbe,
    mix: float,
) -> np.ndarray:
    upload = _empty_upload()
    for step in range(2, 6):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == 2),
            mix=mix,
            effect_type=probe.effect_type,
            params=list(probe.params),
        )
    return _render(
        generated_runtime,
        tmp_path,
        source,
        _base_schedule(upload),
        sample_rate=sample_rate,
    )


def _render_parameterized_effect(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    source: np.ndarray,
    *,
    sample_rate: int,
    effect_type: int,
    params: tuple[float, ...],
    first_step: int = 0,
    active_steps: int = 8,
    mix: float = 1.0,
) -> np.ndarray:
    upload = _empty_upload()
    for step in range(first_step, min(STEP_COUNT, first_step + active_steps)):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step == first_step),
            mix=mix,
            effect_type=effect_type,
            params=list(params),
        )
    return _render(
        generated_runtime,
        tmp_path,
        source,
        _base_schedule(upload),
        sample_rate=sample_rate,
    )


def _multitone(
    frames: int,
    sample_rate: int,
    frequencies: tuple[float, ...],
    *,
    amplitude: float = 0.08,
) -> np.ndarray:
    timeline = np.arange(frames, dtype=np.float64) / sample_rate
    mono = sum(
        amplitude * np.sin(2.0 * np.pi * frequency * timeline)
        for frequency in frequencies
    ).astype(np.float32)
    return np.column_stack([mono, mono]).astype(np.float32)


def _refined_spectral_peak(
    samples: np.ndarray,
    target_hz: float,
    sample_rate: int,
    *,
    relative_width: float = 0.3,
) -> float:
    signal = np.asarray(samples, dtype=np.float64)
    signal = signal - np.mean(signal)
    transform_size = 1 << int(np.ceil(np.log2(max(signal.size * 16, 65_536))))
    spectrum = np.abs(np.fft.rfft(signal * np.hanning(signal.size), n=transform_size))
    frequencies = np.fft.rfftfreq(transform_size, 1.0 / sample_rate)
    candidates = np.flatnonzero(
        (frequencies >= target_hz * (1.0 - relative_width))
        & (frequencies <= target_hz * (1.0 + relative_width))
    )
    candidates = candidates[(candidates > 0) & (candidates < spectrum.size - 1)]
    peak = int(candidates[np.argmax(spectrum[candidates])])
    magnitudes = np.log(np.maximum(spectrum[peak - 1 : peak + 2], 1.0e-300))
    denominator = magnitudes[0] - (2.0 * magnitudes[1]) + magnitudes[2]
    delta = 0.0 if abs(float(denominator)) < 1.0e-15 else 0.5 * (
        magnitudes[0] - magnitudes[2]
    ) / denominator
    return float((peak + np.clip(delta, -0.5, 0.5)) * sample_rate / transform_size)


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
@pytest.mark.parametrize("probe", EFFECT_PROBES, ids=lambda probe: probe.name)
def test_effect_multirate_render_contract(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
    probe: EffectProbe,
) -> None:
    frames = _step_frames_at_rate(sample_rate) * 7
    source = _boundary_signal(frames, sample_rate)
    first = _render_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        probe=probe,
        mix=1.0,
    )
    second = _render_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        probe=probe,
        mix=1.0,
    )
    silent = _render_effect(
        generated_runtime,
        tmp_path,
        np.zeros_like(source),
        sample_rate=sample_rate,
        probe=probe,
        mix=1.0,
    )
    dry = _render_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        probe=probe,
        mix=0.0,
    )

    np.testing.assert_array_equal(second, first)
    assert np.all(np.isfinite(first))
    assert float(np.max(np.abs(first))) <= 4.001
    np.testing.assert_array_equal(silent, np.zeros_like(silent))
    np.testing.assert_array_equal(dry, source)


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
@pytest.mark.parametrize("mode", (0, 1, 2), ids=("low-pass", "high-pass", "band-pass"))
def test_filter_modes_keep_their_spectral_roles_across_host_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
    mode: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    source = _multitone(step_frames * 8, sample_rate, (250.0, 1_000.0, 4_000.0))
    output = _render_parameterized_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        effect_type=EFFECT_FILTER,
        params=(float(mode), 1_000.0, 1_000.0, 0.707, 1.0),
    )
    analysis = output[step_frames * 2 :, 0]
    low = _tone_amplitude(analysis, 250.0, sample_rate)
    center = _tone_amplitude(analysis, 1_000.0, sample_rate)
    high = _tone_amplitude(analysis, 4_000.0, sample_rate)

    if mode == 0:
        assert low > high * 12.0
        assert low > 0.06
    elif mode == 1:
        assert high > low * 12.0
        assert high > 0.06
    else:
        assert center > low * 2.0
        assert center > high * 2.0


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
def test_filter_public_q_extremes_are_bounded_and_resonance_is_effective(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    source = _multitone(step_frames * 8, sample_rate, (1_000.0,), amplitude=0.015)
    low_q = _render_parameterized_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        effect_type=EFFECT_FILTER,
        params=(0.0, 1_000.0, 1_000.0, 0.1, 1.0),
    )
    high_q = _render_parameterized_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        effect_type=EFFECT_FILTER,
        params=(0.0, 1_000.0, 1_000.0, 20.0, 1.0),
    )
    analysis = slice(step_frames * 2, None)
    low_q_center = _tone_amplitude(low_q[analysis, 0], 1_000.0, sample_rate)
    high_q_center = _tone_amplitude(high_q[analysis, 0], 1_000.0, sample_rate)

    assert np.all(np.isfinite(low_q))
    assert np.all(np.isfinite(high_q))
    assert float(np.max(np.abs(low_q))) <= 4.001
    assert float(np.max(np.abs(high_q))) <= 4.001
    assert high_q_center > low_q_center * 8.0


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
def test_stutter_repeat_timing_scales_with_the_authored_block_at_every_host_rate(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    frames = step_frames * 4
    timeline = np.arange(frames, dtype=np.float64) / sample_rate
    mono = (
        (0.26 * np.sin(2.0 * np.pi * 311.0 * timeline))
        + (0.13 * np.sin(2.0 * np.pi * 947.0 * timeline))
    ).astype(np.float32)
    source = np.column_stack([mono, mono]).astype(np.float32)
    output = _render_parameterized_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        effect_type=EFFECT_STUTTER,
        params=(4.0, 1.0, 0.0, 1.0),
        first_step=2,
        active_steps=2,
    )
    slice_frames = (step_frames * 2) // 4
    window_start = max(64, int(round(slice_frames * 0.08)))
    window_stop = int(round(slice_frames * 0.72))
    trigger_frame = step_frames * 2
    first = output[trigger_frame + window_start : trigger_frame + window_stop, 0]
    repeated = output[
        trigger_frame + slice_frames + window_start : trigger_frame + slice_frames + window_stop,
        0,
    ]

    assert _rms(first) > 0.08
    assert _rms(repeated - first) < _rms(first) * 0.15


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
def test_stutter_retrigger_bridges_with_the_previous_capture_at_every_host_rate(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    upload = _empty_upload()
    for step in range(6):
        _activate_step(
            upload,
            lane=LANE_FILTER,
            step=step,
            trigger=(step in (0, 2, 3)),
            effect_type=EFFECT_STUTTER,
            params=[4.0, 1.0, 0.0, 1.0],
        )
    source = np.zeros((step_frames * 7, 2), dtype=np.float32)
    source[: step_frames // 2] = 0.5
    source[step_frames * 2 : (step_frames * 2) + (step_frames // 4)] = -0.5
    source[step_frames * 3 : (step_frames * 3) + ((step_frames * 3) // 4)] = 0.25
    output = _render(
        generated_runtime,
        tmp_path,
        source,
        _base_schedule(upload),
        sample_rate=sample_rate,
    )
    bridge_start = int(round(step_frames * 0.08))
    bridge_stop = int(round(step_frames * 0.22))

    assert float(np.mean(output[(step_frames * 2) + bridge_start : (step_frames * 2) + bridge_stop, 0])) > 0.4
    assert float(np.mean(output[(step_frames * 3) + bridge_start : (step_frames * 3) + bridge_stop, 0])) < -0.4
    for boundary_step in (2, 3):
        boundary = step_frames * boundary_step
        assert float(np.max(np.abs(np.diff(output[boundary - 16 : boundary + 16, 0])))) < 0.08
    assert np.all(np.isfinite(output))
    assert float(np.max(np.abs(output))) <= 0.55


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
@pytest.mark.parametrize(
    ("semitones", "fine_cents", "expected_hz"),
    (
        (12.0, 0.0, 880.0),
        (-12.0, 0.0, 220.0),
        (0.0, 50.0, 440.0 * (2.0 ** (0.5 / 12.0))),
    ),
    ids=("octave-up", "octave-down", "fifty-cents-up"),
)
def test_pitch_accuracy_stays_within_three_cents_across_host_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
    semitones: float,
    fine_cents: float,
    expected_hz: float,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    source = _sine_at_rate(step_frames * 20, 440.0, sample_rate, amplitude=0.35)
    output = _render_pitch(
        generated_runtime,
        tmp_path,
        source,
        semitones=semitones,
        fine_cents=fine_cents,
        first_step=3,
        active_steps=14,
        sample_rate=sample_rate,
    )
    analysis = output[step_frames * 6 : step_frames * 15, 0]
    measured_hz, prominence = _credible_refined_frequency_near(
        analysis,
        expected_hz,
        sample_rate,
    )
    error_cents = 1_200.0 * np.log2(measured_hz / expected_hz)

    assert prominence > 20.0
    assert abs(float(error_cents)) < 3.0


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
def test_pitch_zero_shift_is_bit_exact_at_every_host_rate(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    source = _boundary_signal(step_frames * 8, sample_rate)
    output = _render_pitch(
        generated_runtime,
        tmp_path,
        source,
        semitones=0.0,
        fine_cents=0.0,
        first_step=1,
        active_steps=5,
        sample_rate=sample_rate,
    )

    np.testing.assert_array_equal(output, source)


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
def test_ring_sine_sidebands_remain_symmetric_across_host_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    source = _sine_at_rate(step_frames * 8, 1_000.0, sample_rate, amplitude=0.6)
    output = _render_parameterized_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        effect_type=EFFECT_RING,
        params=(180.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0),
    )
    analysis = output[step_frames * 2 :, 0]
    lower = _tone_amplitude(analysis, 820.0, sample_rate)
    upper = _tone_amplitude(analysis, 1_180.0, sample_rate)
    dry = _tone_amplitude(analysis, 1_000.0, sample_rate)

    assert lower > 0.24
    assert upper > 0.24
    assert abs(lower - upper) < 0.02
    assert dry < 0.02


@pytest.mark.parametrize("sample_rate", (44_100, 48_000))
def test_ring_square_suppresses_the_first_folded_harmonic_at_low_host_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    analysis_frames = step_frames * 6
    carrier_cycles = round(analysis_frames * 0.19)
    carrier_hz = carrier_cycles * sample_rate / analysis_frames
    source = np.full((step_frames * 8, 2), 0.5, dtype=np.float32)
    output = _render_parameterized_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        effect_type=EFFECT_RING,
        params=(carrier_hz, 2.0, 0.0, 0.5, 0.0, 0.0, 0.0),
    )
    analysis = output[step_frames * 2 :, 0]
    fundamental = _tone_amplitude(analysis, carrier_hz, sample_rate)
    first_folded_harmonic = sample_rate - (carrier_hz * 3.0)
    folded = _tone_amplitude(analysis, first_folded_harmonic, sample_rate)
    naive_timeline = np.arange(analysis.size, dtype=np.float64) / sample_rate
    naive = np.where(np.sin(2.0 * np.pi * carrier_hz * naive_timeline) >= 0.0, 0.5, -0.5)
    naive_folded = _tone_amplitude(naive, first_folded_harmonic, sample_rate)

    assert fundamental > 0.45
    assert naive_folded > fundamental * 0.25
    assert folded < naive_folded * 0.4


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
def test_reverse_reads_the_preceding_cell_without_future_dependence_across_host_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    trigger_step = 3
    trigger_frame = step_frames * trigger_step
    preceding = np.linspace(-0.8, 0.8, step_frames, dtype=np.float32)
    baseline_source = np.zeros((step_frames * 7, 2), dtype=np.float32)
    baseline_source[trigger_frame - step_frames : trigger_frame, 0] = preceding
    baseline_source[trigger_frame - step_frames : trigger_frame, 1] = preceding
    changed_future = baseline_source.copy()
    future_start = trigger_frame + (step_frames // 3)
    changed_future[future_start:] = 0.95
    baseline_path = tmp_path / "baseline"
    changed_path = tmp_path / "changed"
    baseline_path.mkdir()
    changed_path.mkdir()
    baseline = _render_reverse(
        generated_runtime,
        baseline_path,
        baseline_source,
        division=4,
        crossfade=0.0,
        first_step=trigger_step,
        active_steps=2,
        sample_rate=sample_rate,
    )
    changed = _render_reverse(
        generated_runtime,
        changed_path,
        changed_future,
        division=4,
        crossfade=0.0,
        first_step=trigger_step,
        active_steps=2,
        sample_rate=sample_rate,
    )
    margin = max(160, int(round(step_frames * 0.06)))
    first_window = slice(trigger_frame + margin, trigger_frame + step_frames - margin)
    expected = preceding[::-1][margin : step_frames - margin]
    correlation = float(np.corrcoef(baseline[first_window, 0], expected)[0, 1])

    assert correlation > 0.995
    np.testing.assert_allclose(changed[first_window], baseline[first_window], atol=2.0e-5, rtol=0.0)


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
def test_talk_box_documented_a_formants_hold_across_host_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    source = np.zeros((step_frames * 6, 2), dtype=np.float32)
    impulse_frame = max(512, int(round(sample_rate * 0.012)))
    source[impulse_frame] = 0.2
    output = _render_parameterized_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        effect_type=EFFECT_TALK_BOX,
        params=(0.0, 0.0, 0.0, 12.0, 0.0, 0.0, 0.0),
        active_steps=6,
    )
    response = output[impulse_frame:, 0].astype(np.float64)
    transform_size = 1 << int(np.ceil(np.log2(max(response.size * 8, sample_rate * 4))))
    spectrum = np.abs(np.fft.rfft(response, n=transform_size))
    frequencies = np.fft.rfftfreq(transform_size, 1.0 / sample_rate)

    for expected_hz in (730.0, 1_090.0):
        candidates = np.flatnonzero(np.abs(frequencies - expected_hz) <= 75.0)
        peak_index = int(candidates[np.argmax(spectrum[candidates])])
        peak_hz = float(frequencies[peak_index])
        local_median = float(np.median(spectrum[candidates]))
        assert abs(peak_hz - expected_hz) < 12.0
        assert float(spectrum[peak_index]) > local_median * 1.15


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
def test_vibro_free_rate_and_depth_match_the_displayed_contract_across_host_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    frames = step_frames * 20
    slope = 0.5 / frames
    mono = (np.arange(frames, dtype=np.float64) * slope).astype(np.float32)
    source = np.column_stack([mono, mono]).astype(np.float32)
    output = _render_parameterized_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        effect_type=EFFECT_VIBRO,
        params=(4.0, 60.0, 0.0, 0.0, 1.0, 2.0),
        first_step=1,
        active_steps=18,
    )
    wet = output[step_frames * 2 : step_frames * 18, 0].astype(np.float64)
    read_ratio = np.gradient(wet) / slope
    modulation = read_ratio - np.mean(read_ratio)
    measured_rate = _refined_spectral_peak(modulation, 4.0, sample_rate)
    phase = np.arange(read_ratio.size, dtype=np.float64) * (
        2.0 * np.pi * measured_rate / sample_rate
    )
    basis = np.column_stack([np.sin(phase), np.cos(phase), np.ones(read_ratio.size)])
    sine_weight, cosine_weight, _center = np.linalg.lstsq(basis, read_ratio, rcond=None)[0]
    rate_deviation = float(np.hypot(sine_weight, cosine_weight))
    measured_depth_cents = 600.0 * np.log2(
        (1.0 + rate_deviation) / (1.0 - rate_deviation)
    )

    assert measured_rate == pytest.approx(4.0, abs=0.12)
    assert measured_depth_cents == pytest.approx(60.0, abs=3.0)


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
def test_flange_static_delay_keeps_its_expected_notch_across_host_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    frames = step_frames * 10
    notch_path = tmp_path / "notch"
    peak_path = tmp_path / "peak"
    notch_path.mkdir()
    peak_path.mkdir()
    notch_source = _sine_at_rate(frames, 250.0, sample_rate, amplitude=0.35)
    peak_source = _sine_at_rate(frames, 500.0, sample_rate, amplitude=0.35)
    flange_params = (2.0, 0.0, 0.28, 0.0, 0.0, 0.0, 1.0, 5.0)
    notch = _render_parameterized_effect(
        generated_runtime,
        notch_path,
        notch_source,
        sample_rate=sample_rate,
        effect_type=EFFECT_FLANGE,
        params=flange_params,
        first_step=1,
        active_steps=8,
    )
    peak = _render_parameterized_effect(
        generated_runtime,
        peak_path,
        peak_source,
        sample_rate=sample_rate,
        effect_type=EFFECT_FLANGE,
        params=flange_params,
        first_step=1,
        active_steps=8,
    )
    window = slice(step_frames * 2, step_frames * 8)

    assert _rms(notch[window, 0]) < _rms(peak[window, 0]) * 0.08
    assert _rms(peak[window, 0]) == pytest.approx(_rms(peak_source[window, 0]), rel=0.04)


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
def test_flange_free_rate_and_delay_extremes_hold_across_host_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    frames = step_frames * 32
    slope = 0.5 / frames
    mono = (np.arange(frames, dtype=np.float64) * slope).astype(np.float32)
    source = np.column_stack([mono, mono]).astype(np.float32)
    output = _render_parameterized_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        effect_type=EFFECT_FLANGE,
        params=(1.5, 5.0, 3.0, 0.0, 0.0, 0.0, 1.0, 5.0),
        first_step=1,
        active_steps=31,
    )
    window = slice(step_frames * 2, step_frames * 31)
    delay_samples = 2.0 * (source[window, 0] - output[window, 0]) / slope
    measured_rate = _refined_spectral_peak(delay_samples, 3.0, sample_rate)
    low, high = np.quantile(delay_samples, [0.005, 0.995])

    assert measured_rate == pytest.approx(3.0, abs=0.12)
    assert low == pytest.approx(1.5e-3 * sample_rate, abs=4.0)
    assert high == pytest.approx(6.5e-3 * sample_rate, abs=4.0)


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
def test_dirty_soft_character_keeps_odd_harmonic_signature_across_host_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    source = _sine_at_rate(step_frames * 8, 997.0, sample_rate, amplitude=0.08)
    output = _render_parameterized_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        effect_type=EFFECT_DIRTY,
        params=(24.0, 0.0, 0.0, 0.0, 20_000.0, 0.0),
    )
    analysis = output[step_frames * 2 :, 0]
    second_harmonic = _tone_amplitude(analysis, 1_994.0, sample_rate)
    third_harmonic = _tone_amplitude(analysis, 2_991.0, sample_rate)

    assert third_harmonic > 0.015
    assert second_harmonic < third_harmonic * 0.2


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
def test_dirty_four_times_core_reduces_hard_clip_alias_across_host_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    frames = step_frames * 8
    analysis_frames = step_frames * 6
    input_cycles = round(analysis_frames * 0.145)
    input_hz = input_cycles * sample_rate / analysis_frames
    source = _sine_at_rate(frames, input_hz, sample_rate, amplitude=0.18)
    output = _render_parameterized_effect(
        generated_runtime,
        tmp_path,
        source,
        sample_rate=sample_rate,
        effect_type=EFFECT_DIRTY,
        params=(24.0, 1.0, 0.0, 0.0, 20_000.0, 0.0),
    )
    analysis = slice(step_frames * 2, None)
    naive = np.clip(source[analysis, 0] * (10.0 ** (24.0 / 20.0)), -1.0, 1.0)
    fifth_harmonic_alias_hz = _fold_frequency(input_hz * 5.0, sample_rate)
    rendered_alias = _tone_amplitude(output[analysis, 0], fifth_harmonic_alias_hz, sample_rate)
    naive_alias = _tone_amplitude(naive, fifth_harmonic_alias_hz, sample_rate)

    assert naive_alias > 0.05
    assert rendered_alias < naive_alias * 0.4


@pytest.mark.parametrize("sample_rate", RATE_PROBES)
def test_dirty_trim_remains_a_post_character_decibel_control_across_host_rates(
    generated_runtime: GeneratedRuntime,
    tmp_path: Path,
    sample_rate: int,
) -> None:
    step_frames = _step_frames_at_rate(sample_rate)
    source = _boundary_signal(step_frames * 8, sample_rate)
    unity_path = tmp_path / "unity"
    trimmed_path = tmp_path / "trimmed"
    unity_path.mkdir()
    trimmed_path.mkdir()
    unity = _render_parameterized_effect(
        generated_runtime,
        unity_path,
        source,
        sample_rate=sample_rate,
        effect_type=EFFECT_DIRTY,
        params=(24.0, 0.0, 0.0, 0.65, 20_000.0, 0.0),
    )
    minus_six = _render_parameterized_effect(
        generated_runtime,
        trimmed_path,
        source,
        sample_rate=sample_rate,
        effect_type=EFFECT_DIRTY,
        params=(24.0, 0.0, 0.0, 0.65, 20_000.0, -6.0),
    )
    analysis = slice(step_frames * 2, step_frames * 7)

    assert _rms(minus_six[analysis]) / _rms(unity[analysis]) == pytest.approx(
        10.0 ** (-6.0 / 20.0),
        abs=0.015,
    )
