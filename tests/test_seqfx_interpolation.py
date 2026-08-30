import math

from reference_labs.seqfx_buffers.interpolation import (
    cubic_hermite_4point,
    linear_interpolate,
    sine_interpolation_rms_error,
)


def test_cubic_hermite_reproduces_constant_and_linear_sequences() -> None:
    for fraction in (0.0, 0.1, 0.37, 0.5, 0.9, 1.0):
        assert cubic_hermite_4point(2.0, 2.0, 2.0, 2.0, fraction) == 2.0
        assert math.isclose(
            cubic_hermite_4point(-1.0, 0.0, 1.0, 2.0, fraction),
            fraction,
            abs_tol=1e-12,
        )
        assert math.isclose(linear_interpolate(0.0, 1.0, fraction), fraction, abs_tol=1e-12)


def test_cubic_hermite_beats_linear_for_primary_history_band() -> None:
    metrics = {
        frequency: sine_interpolation_rms_error(frequency)
        for frequency in (1_000, 8_000, 16_000)
    }

    assert metrics[1_000]["improvementRatio"] > 80
    assert metrics[8_000]["improvementRatio"] > 4.5
    assert metrics[16_000]["improvementRatio"] > 1.5


def test_cubic_hermite_outputs_remain_bounded_for_bounded_fractional_reads() -> None:
    samples = (-1.0, -0.25, 0.5, 1.0)
    values = [
        cubic_hermite_4point(*samples, fraction / 100)
        for fraction in range(101)
    ]

    assert all(math.isfinite(value) for value in values)
    assert min(values) >= -0.25
    assert max(values) <= 0.5
