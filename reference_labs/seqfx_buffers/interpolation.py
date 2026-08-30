from __future__ import annotations

import math
from collections.abc import Sequence


def linear_interpolate(y0: float, y1: float, fraction: float) -> float:
    return y0 + ((y1 - y0) * fraction)


def cubic_hermite_4point(
    previous: float,
    current: float,
    following: float,
    next_following: float,
    fraction: float,
) -> float:
    """Four-point, third-order Catmull-Rom/Hermite fractional sample."""
    a = (-0.5 * previous) + (1.5 * current) - (1.5 * following) + (0.5 * next_following)
    b = previous - (2.5 * current) + (2.0 * following) - (0.5 * next_following)
    c = (-0.5 * previous) + (0.5 * following)
    return (((a * fraction) + b) * fraction + c) * fraction + current


def sine_interpolation_rms_error(
    frequency_hz: float,
    *,
    sample_rate: float = 48_000,
    fraction: float = 0.37,
    sample_count: int = 4_096,
) -> dict[str, float]:
    source = [
        math.sin(2.0 * math.pi * frequency_hz * sample / sample_rate)
        for sample in range(sample_count + 3)
    ]
    linear_errors: list[float] = []
    hermite_errors: list[float] = []

    for index in range(1, sample_count + 1):
        expected = math.sin(2.0 * math.pi * frequency_hz * (index + fraction) / sample_rate)
        linear_errors.append(linear_interpolate(source[index], source[index + 1], fraction) - expected)
        hermite_errors.append(cubic_hermite_4point(
            source[index - 1],
            source[index],
            source[index + 1],
            source[index + 2],
            fraction,
        ) - expected)

    def rms(values: Sequence[float]) -> float:
        return math.sqrt(sum(value * value for value in values) / len(values))

    linear_rms = rms(linear_errors)
    hermite_rms = rms(hermite_errors)
    return {
        "linearRms": linear_rms,
        "hermiteRms": hermite_rms,
        "improvementRatio": linear_rms / max(hermite_rms, 1e-30),
    }
