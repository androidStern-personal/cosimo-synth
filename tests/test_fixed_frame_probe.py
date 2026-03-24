from __future__ import annotations

from typing import Callable

import numpy as np
from numpy.testing import assert_allclose
import pytest

from bench import (
    CmajorFixedFrameProbe,
    DEFAULT_SAMPLE_RATE,
    Recipe,
    dominant_bin_hz,
    dump_render_artifacts,
    formula_mip_index_for_frequency,
    frame_position_to_indices,
    is_finite,
    make_blend2_bank,
    make_bright_bank,
    make_edge_bank,
    make_frame_sweep_recipe,
    make_pitch_sweep_recipe,
    make_saw_bank,
    make_sine_bank,
    make_square_bank,
    make_static_tone_recipe,
    make_sweep4_bank,
    make_zero_bank,
    peak_abs,
    render_bank_reference,
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


def _reference_audio(
    bank,
    recipe,
    *,
    frequency_events: tuple[tuple[int, float], ...] = (),
) -> np.ndarray:
    return render_bank_reference([bank], recipe, frequency_events=frequency_events)


def _stepped_recipe(
    *,
    name: str,
    frame_positions: list[float],
    samples_per_step: int,
    frequency_hz: float = 441.0,
    start_phase: float = 0.0,
) -> Recipe:
    frame_curve = np.repeat(np.asarray(frame_positions, dtype=np.float64), samples_per_step)
    return Recipe(
        name=name,
        sample_rate=DEFAULT_SAMPLE_RATE,
        num_samples=frame_curve.size,
        freq_hz_curve=np.full(frame_curve.shape, frequency_hz, dtype=np.float64),
        frame_pos_curve=frame_curve,
        start_phase=start_phase,
    )


@pytest.mark.parametrize(
    ("frame_position", "frame_count", "expected"),
    [
        (-1.0, 4, (0, 1, 0.0)),
        (0.0, 4, (0, 1, 0.0)),
        (1.0 / 3.0, 4, (1, 2, 0.0)),
        (0.5, 4, (1, 2, 0.5)),
        (1.0, 4, (3, 3, 0.0)),
        (2.0, 4, (3, 3, 0.0)),
        (0.75, 1, (0, 0, 0.0)),
    ],
)
def test_frame_position_mapping_matches_expected_neighbors(
    frame_position: float,
    frame_count: int,
    expected: tuple[int, int, float],
) -> None:
    actual_lo, actual_hi, actual_t = frame_position_to_indices(frame_position, frame_count)

    assert (actual_lo, actual_hi) == expected[:2]
    assert actual_t == pytest.approx(expected[2], abs=1e-12)


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
    audio = render_case(CmajorFixedFrameProbe(), make_sine_bank(), recipe)

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
@pytest.mark.parametrize("frequency_hz", [10.0, 12_000.0])
def test_cmajor_fixed_frame_probe_wrap_boundary_matches_reference(frequency_hz: float) -> None:
    recipe = make_static_tone_recipe(
        name="wrap_boundary",
        duration_seconds=16 / DEFAULT_SAMPLE_RATE,
        frequency_hz=frequency_hz,
        start_phase=2047.25 / 2048.0,
    )
    bank = make_sine_bank()
    audio = render_case(CmajorFixedFrameProbe(), bank, recipe)
    expected = _reference_audio(bank, recipe)

    def assertion() -> None:
        assert_allclose(audio, expected, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        f"test_cmajor_fixed_frame_probe_wrap_boundary_matches_reference_{int(frequency_hz)}hz",
        recipe.sample_rate,
        {"actual": audio, "expected": expected},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_edge_bank_matches_reference_across_seam() -> None:
    recipe = make_static_tone_recipe(
        name="edge_wrap_boundary",
        duration_seconds=24 / DEFAULT_SAMPLE_RATE,
        frequency_hz=440.0,
        start_phase=2047.75 / 2048.0,
    )
    bank = make_edge_bank()
    audio = render_case(CmajorFixedFrameProbe(), bank, recipe)
    expected = _reference_audio(bank, recipe)

    def assertion() -> None:
        assert is_finite(audio)
        assert peak_abs(audio) > 1e-3
        assert_allclose(audio, expected, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_edge_bank_matches_reference_across_seam",
        recipe.sample_rate,
        {"actual": audio, "expected": expected},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_frequency_events_match_reference() -> None:
    recipe = make_static_tone_recipe(
        name="frequency_event",
        duration_seconds=128 / DEFAULT_SAMPLE_RATE,
        frequency_hz=441.0,
        start_phase=0.125,
    )
    bank = make_bright_bank()
    frequency_events = (
        (0, 10.0),
        (32, 55.0),
        (64, 440.0),
        (96, 4_000.0),
        (112, 14_000.0),
    )
    audio = render_cmajor_fixed_frame_tables(
        [bank],
        recipe,
        frequency_events=frequency_events,
    )
    expected = _reference_audio(bank, recipe, frequency_events=frequency_events)

    def assertion() -> None:
        assert_allclose(audio, expected, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_frequency_events_match_reference",
        recipe.sample_rate,
        {"actual": audio, "expected": expected},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_blend2_position_zero_matches_sine() -> None:
    recipe = make_static_tone_recipe(name="blend2_sine_frame", frame_position=0.0)
    from_blend = render_case(CmajorFixedFrameProbe(), make_blend2_bank(), recipe)
    from_sine = render_case(CmajorFixedFrameProbe(), make_sine_bank(), recipe)

    def assertion() -> None:
        assert_allclose(from_blend, from_sine, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_blend2_position_zero_matches_sine",
        recipe.sample_rate,
        {"blend2_position_0": from_blend, "sine": from_sine},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_single_frame_bank_ignores_frame_position() -> None:
    position_zero = make_static_tone_recipe(name="sine_position_0", frame_position=0.0)
    position_one = make_static_tone_recipe(name="sine_position_1", frame_position=1.0)
    bank = make_sine_bank()
    from_zero = render_case(CmajorFixedFrameProbe(), bank, position_zero)
    from_one = render_case(CmajorFixedFrameProbe(), bank, position_one)

    def assertion() -> None:
        assert_allclose(from_zero, from_one, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_single_frame_bank_ignores_frame_position",
        position_zero.sample_rate,
        {"position_0": from_zero, "position_1": from_one},
        assertion,
    )


def test_cmajor_fixed_frame_probe_blend2_position_one_matches_square() -> None:
    recipe = make_static_tone_recipe(name="blend2_square_frame", frame_position=1.0)
    from_blend = render_case(CmajorFixedFrameProbe(), make_blend2_bank(), recipe)
    from_square = render_case(CmajorFixedFrameProbe(), make_square_bank(), recipe)

    def assertion() -> None:
        assert_allclose(from_blend, from_square, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_blend2_position_one_matches_square",
        recipe.sample_rate,
        {"blend2_position_1": from_blend, "square": from_square},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_blend2_midpoint_matches_reference_and_average() -> None:
    midpoint_recipe = make_static_tone_recipe(
        name="blend2_midpoint",
        frame_position=0.5,
        duration_seconds=256 / DEFAULT_SAMPLE_RATE,
        start_phase=0.125,
    )
    lo_recipe = make_static_tone_recipe(
        name="blend2_lo",
        frame_position=0.0,
        duration_seconds=midpoint_recipe.num_samples / DEFAULT_SAMPLE_RATE,
        start_phase=midpoint_recipe.start_phase,
    )
    hi_recipe = make_static_tone_recipe(
        name="blend2_hi",
        frame_position=1.0,
        duration_seconds=midpoint_recipe.num_samples / DEFAULT_SAMPLE_RATE,
        start_phase=midpoint_recipe.start_phase,
    )
    blend_bank = make_blend2_bank()
    midpoint_audio = render_case(CmajorFixedFrameProbe(), blend_bank, midpoint_recipe)
    expected = _reference_audio(blend_bank, midpoint_recipe)
    lo_audio = render_case(CmajorFixedFrameProbe(), blend_bank, lo_recipe)
    hi_audio = render_case(CmajorFixedFrameProbe(), blend_bank, hi_recipe)

    def assertion() -> None:
        assert_allclose(midpoint_audio, expected, atol=1e-6, rtol=0.0)
        assert_allclose(midpoint_audio, 0.5 * (lo_audio + hi_audio), atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_blend2_midpoint_matches_reference_and_average",
        midpoint_recipe.sample_rate,
        {
            "actual": midpoint_audio,
            "expected": expected,
            "lo": lo_audio,
            "hi": hi_audio,
        },
        assertion,
    )


@pytest.mark.cmajor
@pytest.mark.parametrize(
    ("frame_position", "expected_bank_builder"),
    [
        (0.0, make_sine_bank),
        (1.0 / 3.0, make_saw_bank),
        (2.0 / 3.0, make_square_bank),
        (1.0, make_bright_bank),
    ],
)
def test_cmajor_fixed_frame_probe_sweep4_exact_boundaries_match_expected_frame(
    frame_position: float,
    expected_bank_builder,
) -> None:
    recipe = make_static_tone_recipe(
        name=f"sweep4_boundary_{frame_position:.3f}",
        frame_position=frame_position,
        duration_seconds=128 / DEFAULT_SAMPLE_RATE,
        start_phase=0.25,
    )
    from_sweep = render_case(CmajorFixedFrameProbe(), make_sweep4_bank(), recipe)
    from_expected = render_case(CmajorFixedFrameProbe(), expected_bank_builder(), recipe)

    def assertion() -> None:
        assert_allclose(from_sweep, from_expected, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        f"test_cmajor_fixed_frame_probe_sweep4_exact_boundaries_match_expected_frame_{frame_position:.3f}",
        recipe.sample_rate,
        {"sweep4": from_sweep, "expected_frame": from_expected},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_stepped_frame_position_matches_reference() -> None:
    recipe = _stepped_recipe(
        name="stepped_frame_position",
        frame_positions=[0.0, 1.0 / 3.0, 0.5, 2.0 / 3.0, 1.0],
        samples_per_step=32,
        frequency_hz=440.0,
        start_phase=0.125,
    )
    bank = make_sweep4_bank()
    audio = render_case(CmajorFixedFrameProbe(), bank, recipe)
    expected = _reference_audio(bank, recipe)

    def assertion() -> None:
        assert_allclose(audio, expected, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_stepped_frame_position_matches_reference",
        recipe.sample_rate,
        {"actual": audio, "expected": expected},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_bright_bank_gets_more_band_limited_at_high_pitch() -> None:
    low_recipe = make_static_tone_recipe(name="bright_low_pitch", frequency_hz=55.0)
    high_recipe = make_static_tone_recipe(name="bright_high_pitch", frequency_hz=7_040.0)
    bright_bank = make_bright_bank()
    low_pitch_audio = render_case(CmajorFixedFrameProbe(), bright_bank, low_recipe)
    high_pitch_audio = render_case(CmajorFixedFrameProbe(), bright_bank, high_recipe)
    low_expected = _reference_audio(bright_bank, low_recipe)
    high_expected = _reference_audio(bright_bank, high_recipe)
    low_mip = formula_mip_index_for_frequency(low_recipe.freq_hz_curve[0], low_recipe.sample_rate)
    high_mip = formula_mip_index_for_frequency(high_recipe.freq_hz_curve[0], high_recipe.sample_rate)

    def assertion() -> None:
        assert low_mip > high_mip
        assert_allclose(low_pitch_audio, low_expected, atol=1e-6, rtol=0.0)
        assert_allclose(high_pitch_audio, high_expected, atol=1e-6, rtol=0.0)
        assert not np.allclose(low_pitch_audio, high_pitch_audio, atol=1e-6, rtol=0.0)
        assert residual_db_excluding_bin(
            low_pitch_audio, low_recipe.sample_rate, low_recipe.freq_hz_curve[0]
        ) > residual_db_excluding_bin(
            high_pitch_audio, high_recipe.sample_rate, high_recipe.freq_hz_curve[0]
        )

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_bright_bank_gets_more_band_limited_at_high_pitch",
        low_recipe.sample_rate,
        {
            "bright_low_pitch_actual": low_pitch_audio,
            "bright_low_pitch_expected": low_expected,
            "bright_high_pitch_actual": high_pitch_audio,
            "bright_high_pitch_expected": high_expected,
        },
        assertion,
    )


@pytest.mark.cmajor
@pytest.mark.parametrize(
    ("phase_increment", "expected_mip"),
    [
        (np.float32(1.0 / 32.0), 4),
        (np.nextafter(np.float32(1.0 / 32.0), np.float32(np.inf), dtype=np.float32), 3),
    ],
)
def test_cmajor_fixed_frame_probe_boundary_handoff_matches_reference(
    phase_increment: np.float32,
    expected_mip: int,
) -> None:
    frequency_hz = float(np.float32(phase_increment * np.float32(DEFAULT_SAMPLE_RATE)))
    recipe = make_static_tone_recipe(
        name=f"bright_boundary_{expected_mip}",
        duration_seconds=64 / DEFAULT_SAMPLE_RATE,
        frequency_hz=frequency_hz,
        start_phase=0.125,
    )
    bright_bank = make_bright_bank()
    audio = render_case(CmajorFixedFrameProbe(), bright_bank, recipe)
    expected = _reference_audio(bright_bank, recipe)

    def assertion() -> None:
        assert formula_mip_index_for_frequency(frequency_hz, recipe.sample_rate) == expected_mip
        assert_allclose(audio, expected, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        f"test_cmajor_fixed_frame_probe_boundary_handoff_matches_reference_mip_{expected_mip}",
        recipe.sample_rate,
        {"actual": audio, "expected": expected},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_reads_from_second_table_offset() -> None:
    recipe = make_static_tone_recipe(name="second_table_square", frame_position=2.0 / 3.0)
    second_table_audio = render_cmajor_fixed_frame_tables(
        [make_blend2_bank(), make_sweep4_bank()],
        recipe,
        table_index=1,
    )
    square_audio = render_case(
        CmajorFixedFrameProbe(),
        make_square_bank(),
        recipe,
    )

    def assertion() -> None:
        assert_allclose(second_table_audio, square_audio, atol=1e-6, rtol=0.0)

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_reads_from_second_table_offset",
        recipe.sample_rate,
        {"table_1_position_2_3": second_table_audio, "square": square_audio},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_slow_frame_sweep_stays_finite_and_nontrivial() -> None:
    recipe = make_frame_sweep_recipe()
    bank = make_sweep4_bank()
    audio = render_case(CmajorFixedFrameProbe(), bank, recipe)
    first_diff = np.abs(np.diff(audio.astype(np.float64)))
    second_diff = np.abs(np.diff(audio.astype(np.float64), n=2))

    def assertion() -> None:
        assert is_finite(audio)
        assert 0.05 < peak_abs(audio) <= 1.5
        assert rms(audio) > 0.01
        assert float(np.std(audio.astype(np.float64))) > 0.01
        assert float(np.max(first_diff, initial=0.0)) < 0.05
        assert float(np.max(second_diff, initial=0.0)) < 0.005

    _assert_with_artifacts(
        "test_cmajor_fixed_frame_probe_slow_frame_sweep_stays_finite_and_nontrivial",
        recipe.sample_rate,
        {"frame_sweep": audio},
        assertion,
    )


@pytest.mark.cmajor
def test_cmajor_fixed_frame_probe_rejects_invalid_selectors() -> None:
    recipe = make_static_tone_recipe(name="bad_selector")

    with pytest.raises(ValueError, match="table_index"):
        render_cmajor_fixed_frame_tables([make_sine_bank()], recipe, table_index=1)


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
