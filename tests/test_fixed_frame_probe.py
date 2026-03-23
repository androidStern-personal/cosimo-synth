from __future__ import annotations

from pathlib import Path
from typing import Callable

import numpy as np
from numpy.testing import assert_allclose
import pytest
from scipy.fft import irfft, rfft

from bench import (
    CmajorFixedFrameProbe,
    DEFAULT_SAMPLE_RATE,
    DEFAULT_STATIC_FREQUENCY_HZ,
    SAMPLES_PER_FRAME,
    dominant_bin_hz,
    dump_render_artifacts,
    is_finite,
    make_blend2_bank,
    make_bright_bank,
    make_edge_bank,
    make_frame_sweep_recipe,
    make_pitch_sweep_recipe,
    make_sine_bank,
    make_square_bank,
    make_static_tone_recipe,
    make_sweep4_bank,
    make_zero_bank,
    peak_abs,
    render_case,
    render_cmajor_fixed_frame_tables,
    residual_db_excluding_bin,
    rms,
)


def _assert_with_artifacts(
    case_name: str,
    sample_rate: int,
    renders: dict[str, np.ndarray],
    assertion: Callable[[], None],
) -> None:
    try:
        assertion()
    except AssertionError:
        dump_render_artifacts(case_name, sample_rate, renders, enabled=True)
        raise

    dump_render_artifacts(case_name, sample_rate, renders)


def _catmull_rom(p0: float, p1: float, p2: float, p3: float, t: float) -> float:
    return p1 + 0.5 * t * (
        (p2 - p0)
        + t * ((2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) + t * (-p0 + 3.0 * p1 - 3.0 * p2 + p3))
    )


def _expected_padded_frame(frame: np.ndarray, mip_index: int) -> np.ndarray:
    frame64 = np.asarray(frame, dtype=np.float64)
    canonical = frame64 - np.mean(frame64)
    spectrum = rfft(canonical)
    spectrum[0] = 0.0
    harmonic_limit = min(1 << mip_index, spectrum.size - 1)
    truncated = np.zeros_like(spectrum)
    truncated[1 : harmonic_limit + 1] = spectrum[1 : harmonic_limit + 1]
    time_domain = irfft(truncated, n=frame64.size)

    padded = np.empty(SAMPLES_PER_FRAME + 3, dtype=np.float64)
    padded[0] = time_domain[-1]
    padded[1:-2] = time_domain
    padded[-2] = time_domain[0]
    padded[-1] = time_domain[1]
    return padded


def _expected_fixed_frame_audio(
    *,
    frame: np.ndarray,
    mip_index: int,
    recipe,
    frequency_events: tuple[tuple[int, float], ...] = (),
) -> np.ndarray:
    padded = _expected_padded_frame(frame, mip_index).astype(np.float32)
    expected = np.empty(recipe.num_samples, dtype=np.float32)
    phase = np.float32(recipe.start_phase)
    current_frequency = np.float32(recipe.freq_hz_curve[0])
    sample_rate = np.float32(recipe.sample_rate)
    event_index = 0

    for sample_offset in range(recipe.num_samples):
        while event_index < len(frequency_events) and frequency_events[event_index][0] == sample_offset:
            current_frequency = np.float32(frequency_events[event_index][1])
            event_index += 1

        x = np.float32(phase * np.float32(SAMPLES_PER_FRAME))
        sample_index = int(np.floor(x))
        fractional = float(np.float32(x - sample_index))
        p0 = float(padded[sample_index + 0])
        p1 = float(padded[sample_index + 1])
        p2 = float(padded[sample_index + 2])
        p3 = float(padded[sample_index + 3])
        expected[sample_offset] = _catmull_rom(p0, p1, p2, p3, fractional)
        phase_increment = np.float32(current_frequency / sample_rate)
        phase = np.float32(np.mod(np.float32(phase + phase_increment), np.float32(1.0)))

    return expected


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_zero_bank_is_silent() -> None:
    recipe = make_static_tone_recipe(name="zero_fixed_frame")
    audio = render_case(CmajorFixedFrameProbe(), make_zero_bank(), recipe)

    def assertion() -> None:
        assert is_finite(audio)
        assert peak_abs(audio) <= 1e-8
        assert rms(audio) <= 1e-8

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_zero_bank_is_silent",
        recipe.sample_rate,
        {"zero_fixed_frame": audio},
        assertion,
    )


@pytest.mark.cmajor
@pytest.mark.parametrize("frequency_hz", [220.0, 440.0, 880.0])
def test_cmajor_fixed_frame_probe_compiled_sine_tracks_pitch(frequency_hz: float) -> None:
    recipe = make_static_tone_recipe(
        name=f"sine_{frequency_hz:.0f}",
        frequency_hz=frequency_hz,
    )
    audio = render_case(CmajorFixedFrameProbe(mip_index=10), make_sine_bank(), recipe)

    def assertion() -> None:
        assert is_finite(audio)
        assert dominant_bin_hz(audio, recipe.sample_rate) == pytest.approx(frequency_hz, abs=0.5)
        assert residual_db_excluding_bin(audio, recipe.sample_rate, frequency_hz) <= -35.0

    _assert_with_artifacts(
        f"test_cmajor_fixed_frame_probe_compiled_sine_tracks_pitch_{int(frequency_hz)}",
        recipe.sample_rate,
        {f"sine_{int(frequency_hz)}": audio},
        assertion,
    )


@pytest.mark.cmajor
@pytest.mark.parametrize("mip_index", [0, 10])
def test_cmajor_fixed_frame_probe_wrap_boundary_matches_exact_samples(mip_index: int) -> None:
    recipe = make_static_tone_recipe(
        name="wrap_boundary",
        duration_seconds=16 / DEFAULT_SAMPLE_RATE,
        frequency_hz=440.0,
        start_phase=2047.25 / SAMPLES_PER_FRAME,
    )
    bank = make_sine_bank()
    audio = render_case(CmajorFixedFrameProbe(mip_index=mip_index), bank, recipe)
    expected = _expected_fixed_frame_audio(
        frame=bank.frames[0],
        mip_index=mip_index,
        recipe=recipe,
    )

    def assertion() -> None:
        assert_allclose(audio, expected, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        f"test_cmajor_fixed_frame_probe_wrap_boundary_matches_exact_samples_mip_{mip_index}",
        recipe.sample_rate,
        {"actual": audio, "expected": expected},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_edge_bank_matches_exact_samples_across_seam() -> None:
    recipe = make_static_tone_recipe(
        name="edge_wrap_boundary",
        duration_seconds=24 / DEFAULT_SAMPLE_RATE,
        frequency_hz=440.0,
        start_phase=2047.75 / SAMPLES_PER_FRAME,
    )
    bank = make_edge_bank()
    audio = render_case(CmajorFixedFrameProbe(mip_index=10), bank, recipe)
    expected = _expected_fixed_frame_audio(
        frame=bank.frames[0],
        mip_index=10,
        recipe=recipe,
    )

    def assertion() -> None:
        assert is_finite(audio)
        assert peak_abs(audio) > 1e-3
        assert_allclose(audio, expected, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_edge_bank_matches_exact_samples_across_seam",
        recipe.sample_rate,
        {"actual": audio, "expected": expected},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_frequency_event_matches_exact_samples() -> None:
    recipe = make_static_tone_recipe(
        name="frequency_event",
        duration_seconds=128 / DEFAULT_SAMPLE_RATE,
        frequency_hz=DEFAULT_STATIC_FREQUENCY_HZ,
        start_phase=0.125,
    )
    bank = make_sine_bank()
    frequency_events = ((0, 220.0), (48, 880.0), (96, 330.0))
    audio = render_cmajor_fixed_frame_tables(
        [bank],
        recipe,
        mip_index=10,
        frequency_events=frequency_events,
    )
    expected = _expected_fixed_frame_audio(
        frame=bank.frames[0],
        mip_index=10,
        recipe=recipe,
        frequency_events=frequency_events,
    )

    def assertion() -> None:
        assert_allclose(audio, expected, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_frequency_event_matches_exact_samples",
        recipe.sample_rate,
        {"actual": audio, "expected": expected},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_blend2_frame_one_matches_square() -> None:
    recipe = make_static_tone_recipe(name="blend2_square_frame")
    from_blend = render_case(CmajorFixedFrameProbe(frame_index=1, mip_index=10), make_blend2_bank(), recipe)
    from_square = render_case(
        CmajorFixedFrameProbe(frame_index=0, mip_index=10),
        make_square_bank(),
        recipe,
    )

    def assertion() -> None:
        assert_allclose(from_blend, from_square, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_blend2_frame_one_matches_square",
        recipe.sample_rate,
        {"blend2_frame_1": from_blend, "square": from_square},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_sweep4_frame_two_matches_square() -> None:
    recipe = make_static_tone_recipe(name="sweep4_square_frame")
    from_sweep = render_case(CmajorFixedFrameProbe(frame_index=2, mip_index=10), make_sweep4_bank(), recipe)
    from_square = render_case(
        CmajorFixedFrameProbe(frame_index=0, mip_index=10),
        make_square_bank(),
        recipe,
    )

    def assertion() -> None:
        assert_allclose(from_sweep, from_square, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_sweep4_frame_two_matches_square",
        recipe.sample_rate,
        {"sweep4_frame_2": from_sweep, "square": from_square},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_uses_requested_mip_level() -> None:
    recipe = make_static_tone_recipe(name="bright_mips")
    mip0 = render_case(CmajorFixedFrameProbe(mip_index=0), make_bright_bank(), recipe)
    mip10 = render_case(CmajorFixedFrameProbe(mip_index=10), make_bright_bank(), recipe)

    def assertion() -> None:
        assert not np.allclose(mip0, mip10, atol=1e-6, rtol=0.0)
        assert residual_db_excluding_bin(mip0, recipe.sample_rate, 441.0) <= -35.0
        assert residual_db_excluding_bin(mip10, recipe.sample_rate, 441.0) > -20.0

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_uses_requested_mip_level",
        recipe.sample_rate,
        {"mip0": mip0, "mip10": mip10},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_reads_from_second_table_offset() -> None:
    recipe = make_static_tone_recipe(name="second_table_square")
    second_table_audio = render_cmajor_fixed_frame_tables(
        [make_blend2_bank(), make_sweep4_bank()],
        recipe,
        table_index=1,
        frame_index=2,
        mip_index=10,
    )
    square_audio = render_case(
        CmajorFixedFrameProbe(frame_index=0, mip_index=10),
        make_square_bank(),
        recipe,
    )

    def assertion() -> None:
        assert_allclose(second_table_audio, square_audio, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_reads_from_second_table_offset",
        recipe.sample_rate,
        {"table_1_frame_2": second_table_audio, "square": square_audio},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_rejects_invalid_selectors() -> None:
    recipe = make_static_tone_recipe(name="bad_selector")

    with pytest.raises(ValueError, match="table_index"):
        render_cmajor_fixed_frame_tables([make_sine_bank()], recipe, table_index=1)

    with pytest.raises(ValueError, match="frame_index"):
        render_cmajor_fixed_frame_tables([make_sine_bank()], recipe, frame_index=1)

    with pytest.raises(ValueError, match="mip_index"):
        render_cmajor_fixed_frame_tables([make_sine_bank()], recipe, mip_index=99)


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_rejects_invalid_frequency_events() -> None:
    recipe = make_static_tone_recipe(name="bad_frequency_event")

    with pytest.raises(ValueError, match="inside the rendered buffer"):
        render_cmajor_fixed_frame_tables(
            [make_sine_bank()],
            recipe,
            frequency_events=((recipe.num_samples, 440.0),),
        )

    with pytest.raises(ValueError, match="sorted in ascending order"):
        render_cmajor_fixed_frame_tables(
            [make_sine_bank()],
            recipe,
            frequency_events=((32, 880.0), (16, 220.0)),
        )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_rejects_curves_it_cannot_render() -> None:
    with pytest.raises(ValueError, match="freq_hz_curve"):
        render_case(CmajorFixedFrameProbe(), make_sine_bank(), make_pitch_sweep_recipe())

    with pytest.raises(ValueError, match="frame_pos_curve"):
        render_case(CmajorFixedFrameProbe(), make_sine_bank(), make_frame_sweep_recipe())
