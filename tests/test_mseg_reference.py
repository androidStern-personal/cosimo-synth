from __future__ import annotations

import numpy as np
import pytest

from bench import (
    MSEG_BODY_SAMPLES,
    MSEG_PADDED_SAMPLES,
    MsegPlayback,
    MsegPoint,
    MsegShape,
    apply_mseg_route,
    render_mseg_reference,
    render_mseg_shape_reference,
    sample_rendered_mseg_buffer,
)


def test_reference_renderer_uses_i_over_2047_sample_domain() -> None:
    shape = MsegShape(points=(MsegPoint(0.0, 0.0), MsegPoint(1.0, 1.0)))
    rendered = render_mseg_shape_reference(shape)

    quarter_index = int(0.25 * (MSEG_BODY_SAMPLES - 1))
    half_index = int(0.5 * (MSEG_BODY_SAMPLES - 1))

    assert rendered[quarter_index + 1] == pytest.approx(
        quarter_index / (MSEG_BODY_SAMPLES - 1), abs=1e-6
    )
    assert rendered[half_index + 1] == pytest.approx(
        half_index / (MSEG_BODY_SAMPLES - 1), abs=1e-6
    )


def test_reference_renderer_uses_clamped_padding_contract() -> None:
    shape = MsegShape(points=(MsegPoint(0.0, 0.25), MsegPoint(1.0, 0.75)))
    rendered = render_mseg_shape_reference(shape)

    assert rendered.shape == (MSEG_PADDED_SAMPLES,)
    assert rendered[0] == pytest.approx(rendered[1], abs=1e-6)
    assert rendered[-2] == pytest.approx(rendered[MSEG_BODY_SAMPLES], abs=1e-6)
    assert rendered[-1] == pytest.approx(rendered[MSEG_BODY_SAMPLES], abs=1e-6)


def test_reference_renderer_duplicate_x_step_uses_later_point() -> None:
    shape = MsegShape(
        points=(
            MsegPoint(0.0, 0.2),
            MsegPoint(0.5, 0.2),
            MsegPoint(0.5, 0.9),
            MsegPoint(1.0, 0.9),
        )
    )
    rendered = render_mseg_shape_reference(shape)
    exact_index = round(0.5 * (MSEG_BODY_SAMPLES - 1))

    assert rendered[exact_index + 1] == pytest.approx(0.9, abs=1e-6)


def test_reference_reader_one_shot_starts_at_zero() -> None:
    shape = MsegShape(points=(MsegPoint(0.0, 0.1), MsegPoint(1.0, 0.9)))
    rendered = render_mseg_shape_reference(shape)
    values = render_mseg_reference(
        rendered,
        sample_rate=44_100,
        num_samples=32,
        playback=MsegPlayback(seconds=0.01),
    )

    assert values[0] == pytest.approx(0.1, abs=1e-6)


def test_reference_reader_advances_over_configured_seconds() -> None:
    shape = MsegShape(points=(MsegPoint(0.0, 0.0), MsegPoint(1.0, 1.0)))
    rendered = render_mseg_shape_reference(shape)
    values = render_mseg_reference(
        rendered,
        sample_rate=4,
        num_samples=5,
        playback=MsegPlayback(seconds=1.0),
    )

    assert np.allclose(
        values,
        np.asarray([0.0, 0.25, 0.5, 0.75, 1.0], dtype=np.float32),
        atol=1e-6,
        rtol=0.0,
    )


def test_reference_reader_holds_final_value_after_end() -> None:
    shape = MsegShape(points=(MsegPoint(0.0, 0.0), MsegPoint(1.0, 1.0)))
    rendered = render_mseg_shape_reference(shape)
    values = render_mseg_reference(
        rendered,
        sample_rate=4,
        num_samples=4,
        playback=MsegPlayback(seconds=0.5),
    )

    assert np.allclose(
        values,
        np.asarray([0.0, 0.5, 1.0, 1.0], dtype=np.float32),
        atol=1e-6,
        rtol=0.0,
    )


def test_reference_reader_loop_window_repeats_the_middle_section() -> None:
    shape = MsegShape(points=(MsegPoint(0.0, 0.0), MsegPoint(1.0, 1.0)))
    rendered = render_mseg_shape_reference(shape)
    values = render_mseg_reference(
        rendered,
        sample_rate=4,
        num_samples=8,
        playback=MsegPlayback(seconds=1.0, loop=(0.25, 0.75)),
    )

    assert np.allclose(
        values,
        np.asarray([0.0, 0.25, 0.5, 0.75, 0.5, 0.75, 0.5, 0.75], dtype=np.float32),
        atol=1e-6,
        rtol=0.0,
    )


def test_reference_reader_finish_loop_note_off_exits_after_reaching_loop_end() -> None:
    shape = MsegShape(points=(MsegPoint(0.0, 0.0), MsegPoint(1.0, 1.0)))
    rendered = render_mseg_shape_reference(shape)
    values = render_mseg_reference(
        rendered,
        sample_rate=4,
        num_samples=8,
        playback=MsegPlayback(seconds=1.0, loop=(0.25, 0.75), note_off_policy="finish_loop"),
        note_off_offsets=(2,),
    )

    assert np.allclose(
        values,
        np.asarray([0.0, 0.25, 0.5, 0.75, 1.0, 1.0, 1.0, 1.0], dtype=np.float32),
        atol=1e-6,
        rtol=0.0,
    )


def test_reference_reader_retrigger_resets_to_start() -> None:
    shape = MsegShape(points=(MsegPoint(0.0, 0.2), MsegPoint(1.0, 0.8)))
    rendered = render_mseg_shape_reference(shape)
    values = render_mseg_reference(
        rendered,
        sample_rate=100,
        num_samples=80,
        playback=MsegPlayback(seconds=0.5),
        trigger_offsets=(0, 40),
    )

    assert values[0] == pytest.approx(0.2, abs=1e-6)
    assert values[40] == pytest.approx(0.2, abs=1e-6)


def test_reference_reader_full_shape_loop_wraps_after_reaching_the_end() -> None:
    shape = MsegShape(points=(MsegPoint(0.0, 0.0), MsegPoint(1.0, 1.0)))
    rendered = render_mseg_shape_reference(shape)
    values = render_mseg_reference(
        rendered,
        sample_rate=4,
        num_samples=8,
        playback=MsegPlayback(seconds=1.0, loop=(0.0, 1.0)),
    )

    assert np.allclose(
        values,
        np.asarray([0.0, 0.25, 0.5, 0.75, 1.0, 0.25, 0.5, 0.75], dtype=np.float32),
        atol=1e-6,
        rtol=0.0,
    )


def test_reference_reader_finish_loop_note_off_completes_the_current_pass_then_stops_wrapping() -> None:
    shape = MsegShape(points=(MsegPoint(0.0, 0.0), MsegPoint(1.0, 1.0)))
    rendered = render_mseg_shape_reference(shape)
    values = render_mseg_reference(
        rendered,
        sample_rate=4,
        num_samples=8,
        playback=MsegPlayback(seconds=1.0, loop=(0.0, 1.0)),
        note_off_offsets=(2,),
    )

    assert np.allclose(
        values,
        np.asarray([0.0, 0.25, 0.5, 0.75, 1.0, 1.0, 1.0, 1.0], dtype=np.float32),
        atol=1e-6,
        rtol=0.0,
    )


def test_reference_route_applies_depth_then_clamps_into_zero_to_one() -> None:
    base = np.full(4, 0.75, dtype=np.float64)
    modulation = np.asarray([0.0, 0.5, 1.0, 1.0], dtype=np.float32)

    high = apply_mseg_route(base, modulation, 0.5)
    low = apply_mseg_route(base, modulation, -2.0)

    assert np.allclose(high, np.asarray([0.75, 1.0, 1.0, 1.0]), atol=1e-6, rtol=0.0)
    assert np.allclose(low, np.asarray([0.75, 0.0, 0.0, 0.0]), atol=1e-6, rtol=0.0)


def test_reference_sampler_reads_boundaries_exactly() -> None:
    shape = MsegShape(points=(MsegPoint(0.0, 0.1), MsegPoint(1.0, 0.9)))
    rendered = render_mseg_shape_reference(shape)

    assert sample_rendered_mseg_buffer(rendered, 0.0) == pytest.approx(0.1, abs=1e-6)
    assert sample_rendered_mseg_buffer(rendered, 1.0) == pytest.approx(0.9, abs=1e-6)
