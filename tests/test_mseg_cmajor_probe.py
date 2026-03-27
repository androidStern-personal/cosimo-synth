from __future__ import annotations

from typing import Callable

import numpy as np
from numpy.testing import assert_allclose
import pytest

from bench import (
    MsegPlayback,
    MsegPoint,
    MsegShape,
    apply_mseg_route,
    dump_render_artifacts,
    is_finite,
    make_sweep4_bank,
    make_static_tone_recipe,
    peak_abs,
    render_cmajor_fixed_frame_tables,
    render_cmajor_mseg_probe,
    render_mseg_reference,
    render_mseg_shape_reference,
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


def _expected_audio(
    *,
    recipe,
    shape: MsegShape,
    playback: MsegPlayback,
    depth: float,
    trigger_offsets: tuple[int, ...] = (0,),
) -> tuple[np.ndarray, np.ndarray]:
    rendered = render_mseg_shape_reference(shape)
    mseg_values = render_mseg_reference(
        rendered,
        sample_rate=recipe.sample_rate,
        num_samples=recipe.num_samples,
        playback=playback,
        trigger_offsets=trigger_offsets,
    )
    routed_curve = apply_mseg_route(recipe.frame_pos_curve, mseg_values, depth)
    expected = render_cmajor_fixed_frame_tables(
        [make_sweep4_bank()],
        make_static_tone_recipe(
            name=recipe.name,
            sample_rate=recipe.sample_rate,
            duration_seconds=recipe.num_samples / recipe.sample_rate,
            frequency_hz=float(recipe.freq_hz_curve[0]),
            frame_position=float(recipe.frame_pos_curve[0]),
            start_phase=recipe.start_phase,
        ).__class__(
            name=recipe.name,
            sample_rate=recipe.sample_rate,
            num_samples=recipe.num_samples,
            freq_hz_curve=recipe.freq_hz_curve,
            frame_pos_curve=routed_curve,
            start_phase=recipe.start_phase,
        ),
    )
    return rendered, expected


@pytest.mark.cmajor
def test_cmajor_mseg_probe_flat_zero_buffer_matches_reference() -> None:
    recipe = make_static_tone_recipe(name="mseg_zero", duration_seconds=0.05, frame_position=0.4)
    shape = MsegShape(points=(MsegPoint(0.0, 0.0), MsegPoint(1.0, 0.0)))
    rendered, expected = _expected_audio(
        recipe=recipe,
        shape=shape,
        playback=MsegPlayback(seconds=0.05),
        depth=0.7,
    )
    actual = render_cmajor_mseg_probe(
        [make_sweep4_bank()],
        recipe,
        mseg_buffer=rendered,
        playback=MsegPlayback(seconds=0.05),
        depth=0.7,
    )

    _assert_with_artifacts(
        "test_cmajor_mseg_probe_flat_zero_buffer_matches_reference",
        recipe.sample_rate,
        {"actual": actual, "expected": expected},
        lambda: assert_allclose(actual, expected, atol=1e-6, rtol=0.0),
    )


@pytest.mark.cmajor
def test_cmajor_mseg_probe_flat_one_buffer_matches_reference() -> None:
    recipe = make_static_tone_recipe(name="mseg_one", duration_seconds=0.05, frame_position=0.0)
    shape = MsegShape(points=(MsegPoint(0.0, 1.0), MsegPoint(1.0, 1.0)))
    rendered, expected = _expected_audio(
        recipe=recipe,
        shape=shape,
        playback=MsegPlayback(seconds=0.05),
        depth=0.5,
    )
    actual = render_cmajor_mseg_probe(
        [make_sweep4_bank()],
        recipe,
        mseg_buffer=rendered,
        playback=MsegPlayback(seconds=0.05),
        depth=0.5,
    )

    _assert_with_artifacts(
        "test_cmajor_mseg_probe_flat_one_buffer_matches_reference",
        recipe.sample_rate,
        {"actual": actual, "expected": expected},
        lambda: assert_allclose(actual, expected, atol=1e-6, rtol=0.0),
    )


@pytest.mark.cmajor
def test_cmajor_mseg_probe_ramp_buffer_matches_reference() -> None:
    recipe = make_static_tone_recipe(name="mseg_ramp", duration_seconds=0.05, frame_position=0.0)
    shape = MsegShape(points=(MsegPoint(0.0, 0.0), MsegPoint(1.0, 1.0)))
    rendered, expected = _expected_audio(
        recipe=recipe,
        shape=shape,
        playback=MsegPlayback(seconds=0.05),
        depth=1.0,
    )
    actual = render_cmajor_mseg_probe(
        [make_sweep4_bank()],
        recipe,
        mseg_buffer=rendered,
        playback=MsegPlayback(seconds=0.05),
        depth=1.0,
    )

    _assert_with_artifacts(
        "test_cmajor_mseg_probe_ramp_buffer_matches_reference",
        recipe.sample_rate,
        {"actual": actual, "expected": expected},
        lambda: assert_allclose(actual, expected, atol=1e-6, rtol=0.0),
    )


@pytest.mark.cmajor
def test_cmajor_mseg_probe_curved_buffer_matches_reference() -> None:
    recipe = make_static_tone_recipe(name="mseg_curved", duration_seconds=0.05, frame_position=0.0)
    shape = MsegShape(points=(MsegPoint(0.0, 0.0, 2.5), MsegPoint(1.0, 1.0)))
    rendered, expected = _expected_audio(
        recipe=recipe,
        shape=shape,
        playback=MsegPlayback(seconds=0.05),
        depth=1.0,
    )
    actual = render_cmajor_mseg_probe(
        [make_sweep4_bank()],
        recipe,
        mseg_buffer=rendered,
        playback=MsegPlayback(seconds=0.05),
        depth=1.0,
    )

    _assert_with_artifacts(
        "test_cmajor_mseg_probe_curved_buffer_matches_reference",
        recipe.sample_rate,
        {"actual": actual, "expected": expected},
        lambda: assert_allclose(actual, expected, atol=1e-6, rtol=0.0),
    )


@pytest.mark.cmajor
def test_cmajor_mseg_probe_duplicate_x_step_matches_reference() -> None:
    recipe = make_static_tone_recipe(name="mseg_step", duration_seconds=0.05, frame_position=0.0)
    shape = MsegShape(
        points=(
            MsegPoint(0.0, 0.0),
            MsegPoint(0.5, 0.0),
            MsegPoint(0.5, 1.0),
            MsegPoint(1.0, 1.0),
        )
    )
    rendered, expected = _expected_audio(
        recipe=recipe,
        shape=shape,
        playback=MsegPlayback(seconds=0.05),
        depth=1.0,
    )
    actual = render_cmajor_mseg_probe(
        [make_sweep4_bank()],
        recipe,
        mseg_buffer=rendered,
        playback=MsegPlayback(seconds=0.05),
        depth=1.0,
    )

    _assert_with_artifacts(
        "test_cmajor_mseg_probe_duplicate_x_step_matches_reference",
        recipe.sample_rate,
        {"actual": actual, "expected": expected},
        lambda: assert_allclose(actual, expected, atol=1e-6, rtol=0.0),
    )


@pytest.mark.cmajor
def test_cmajor_mseg_probe_end_hold_matches_reference() -> None:
    recipe = make_static_tone_recipe(name="mseg_hold", duration_seconds=0.1, frame_position=0.0)
    shape = MsegShape(points=(MsegPoint(0.0, 0.0), MsegPoint(1.0, 1.0)))
    rendered, expected = _expected_audio(
        recipe=recipe,
        shape=shape,
        playback=MsegPlayback(seconds=0.01),
        depth=1.0,
    )
    actual = render_cmajor_mseg_probe(
        [make_sweep4_bank()],
        recipe,
        mseg_buffer=rendered,
        playback=MsegPlayback(seconds=0.01),
        depth=1.0,
    )

    _assert_with_artifacts(
        "test_cmajor_mseg_probe_end_hold_matches_reference",
        recipe.sample_rate,
        {"actual": actual, "expected": expected},
        lambda: assert_allclose(actual, expected, atol=1e-6, rtol=0.0),
    )


@pytest.mark.cmajor
def test_cmajor_mseg_probe_retrigger_matches_reference() -> None:
    recipe = make_static_tone_recipe(name="mseg_retrigger", duration_seconds=0.1, frame_position=0.0)
    shape = MsegShape(points=(MsegPoint(0.0, 0.2), MsegPoint(1.0, 0.8)))
    rendered = render_mseg_shape_reference(shape)
    mseg_values = render_mseg_reference(
        rendered,
        sample_rate=recipe.sample_rate,
        num_samples=recipe.num_samples,
        playback=MsegPlayback(seconds=0.05),
        trigger_offsets=(0, recipe.num_samples // 2),
    )
    expected = render_cmajor_fixed_frame_tables(
        [make_sweep4_bank()],
        recipe.__class__(
            name=recipe.name,
            sample_rate=recipe.sample_rate,
            num_samples=recipe.num_samples,
            freq_hz_curve=recipe.freq_hz_curve,
            frame_pos_curve=apply_mseg_route(recipe.frame_pos_curve, mseg_values, 1.0),
            start_phase=recipe.start_phase,
        ),
    )
    actual = render_cmajor_mseg_probe(
        [make_sweep4_bank()],
        recipe,
        mseg_buffer=rendered,
        playback=MsegPlayback(seconds=0.05),
        depth=1.0,
        trigger_offsets=(0, recipe.num_samples // 2),
    )

    _assert_with_artifacts(
        "test_cmajor_mseg_probe_retrigger_matches_reference",
        recipe.sample_rate,
        {"actual": actual, "expected": expected},
        lambda: assert_allclose(actual, expected, atol=1e-6, rtol=0.0),
    )


@pytest.mark.cmajor
def test_cmajor_mseg_probe_depth_zero_leaves_frame_position_unchanged() -> None:
    recipe = make_static_tone_recipe(name="mseg_depth_zero", duration_seconds=0.05, frame_position=0.35)
    shape = MsegShape(points=(MsegPoint(0.0, 1.0), MsegPoint(1.0, 1.0)))
    rendered = render_mseg_shape_reference(shape)
    expected = render_cmajor_fixed_frame_tables([make_sweep4_bank()], recipe)
    actual = render_cmajor_mseg_probe(
        [make_sweep4_bank()],
        recipe,
        mseg_buffer=rendered,
        playback=MsegPlayback(seconds=0.05),
        depth=0.0,
    )

    _assert_with_artifacts(
        "test_cmajor_mseg_probe_depth_zero_leaves_frame_position_unchanged",
        recipe.sample_rate,
        {"actual": actual, "expected": expected},
        lambda: assert_allclose(actual, expected, atol=1e-6, rtol=0.0),
    )


@pytest.mark.cmajor
def test_cmajor_mseg_probe_positive_depth_modulates_frame_position_as_expected() -> None:
    recipe = make_static_tone_recipe(name="mseg_depth_positive", duration_seconds=0.05, frame_position=0.1)
    shape = MsegShape(points=(MsegPoint(0.0, 0.0), MsegPoint(1.0, 1.0)))
    rendered, expected = _expected_audio(
        recipe=recipe,
        shape=shape,
        playback=MsegPlayback(seconds=0.05),
        depth=0.5,
    )
    actual = render_cmajor_mseg_probe(
        [make_sweep4_bank()],
        recipe,
        mseg_buffer=rendered,
        playback=MsegPlayback(seconds=0.05),
        depth=0.5,
    )

    _assert_with_artifacts(
        "test_cmajor_mseg_probe_positive_depth_modulates_frame_position_as_expected",
        recipe.sample_rate,
        {"actual": actual, "expected": expected},
        lambda: assert_allclose(actual, expected, atol=1e-6, rtol=0.0),
    )


@pytest.mark.cmajor
def test_cmajor_mseg_probe_upper_clamp_matches_reference() -> None:
    recipe = make_static_tone_recipe(name="mseg_upper_clamp", duration_seconds=0.05, frame_position=0.9)
    shape = MsegShape(points=(MsegPoint(0.0, 1.0), MsegPoint(1.0, 1.0)))
    rendered = render_mseg_shape_reference(shape)
    expected = render_cmajor_fixed_frame_tables(
        [make_sweep4_bank()],
        make_static_tone_recipe(
            name="mseg_upper_clamp_expected",
            duration_seconds=0.05,
            frame_position=1.0,
        ),
    )
    actual = render_cmajor_mseg_probe(
        [make_sweep4_bank()],
        recipe,
        mseg_buffer=rendered,
        playback=MsegPlayback(seconds=0.05),
        depth=0.5,
    )

    _assert_with_artifacts(
        "test_cmajor_mseg_probe_upper_clamp_matches_reference",
        recipe.sample_rate,
        {"actual": actual, "expected": expected},
        lambda: assert_allclose(actual, expected, atol=1e-6, rtol=0.0),
    )


@pytest.mark.cmajor
def test_cmajor_mseg_probe_lower_clamp_matches_reference() -> None:
    recipe = make_static_tone_recipe(name="mseg_lower_clamp", duration_seconds=0.05, frame_position=0.1)
    shape = MsegShape(points=(MsegPoint(0.0, 1.0), MsegPoint(1.0, 1.0)))
    rendered = render_mseg_shape_reference(shape)
    expected = render_cmajor_fixed_frame_tables(
        [make_sweep4_bank()],
        make_static_tone_recipe(
            name="mseg_lower_clamp_expected",
            duration_seconds=0.05,
            frame_position=0.0,
        ),
    )
    actual = render_cmajor_mseg_probe(
        [make_sweep4_bank()],
        recipe,
        mseg_buffer=rendered,
        playback=MsegPlayback(seconds=0.05),
        depth=-0.5,
    )

    _assert_with_artifacts(
        "test_cmajor_mseg_probe_lower_clamp_matches_reference",
        recipe.sample_rate,
        {"actual": actual, "expected": expected},
        lambda: assert_allclose(actual, expected, atol=1e-6, rtol=0.0),
    )


@pytest.mark.cmajor
@pytest.mark.parametrize("seconds", [0.01, 1.5])
def test_cmajor_mseg_probe_output_stays_finite_for_slow_and_fast_seconds_rates(seconds: float) -> None:
    recipe = make_static_tone_recipe(name=f"mseg_finite_{seconds:.2f}", duration_seconds=0.05)
    shape = MsegShape(points=(MsegPoint(0.0, 0.0), MsegPoint(1.0, 1.0)))
    rendered = render_mseg_shape_reference(shape)
    actual = render_cmajor_mseg_probe(
        [make_sweep4_bank()],
        recipe,
        mseg_buffer=rendered,
        playback=MsegPlayback(seconds=seconds),
        depth=1.0,
    )

    assert is_finite(actual)
    assert peak_abs(actual) > 1e-4
    assert rms(actual) > 1e-4
