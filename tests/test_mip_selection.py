from __future__ import annotations

import numpy as np
import pytest

from bench import (
    BRIGHTEST_MIP_INDEX,
    DEFAULT_SAMPLE_RATE,
    formula_mip_index_for_frequency,
    formula_mip_index_for_phase_increment,
    threshold_mip_index_for_frequency,
    threshold_mip_index_for_phase_increment,
)

PHASE_INCREMENT_BOUNDARIES: tuple[tuple[int, np.float32], ...] = tuple(
    (level, np.float32(1.0 / float(1 << (level + 1))))
    for level in range(BRIGHTEST_MIP_INDEX, 0, -1)
)


@pytest.mark.parametrize("phase_increment", [-0.25, -1e-6, 0.0])
def test_non_positive_phase_increment_selects_brightest_mip(phase_increment: float) -> None:
    assert formula_mip_index_for_phase_increment(phase_increment) == BRIGHTEST_MIP_INDEX
    assert threshold_mip_index_for_phase_increment(phase_increment) == BRIGHTEST_MIP_INDEX


@pytest.mark.parametrize("expected_level,boundary", PHASE_INCREMENT_BOUNDARIES)
def test_exact_phase_increment_boundary_uses_brighter_safe_mip(
    expected_level: int,
    boundary: np.float32,
) -> None:
    assert formula_mip_index_for_phase_increment(boundary) == expected_level
    assert threshold_mip_index_for_phase_increment(boundary) == expected_level


@pytest.mark.parametrize("expected_level,boundary", PHASE_INCREMENT_BOUNDARIES)
def test_phase_increment_switches_one_level_after_boundary(
    expected_level: int,
    boundary: np.float32,
) -> None:
    just_below = np.nextafter(boundary, np.float32(0.0), dtype=np.float32)
    just_above = np.nextafter(boundary, np.float32(np.inf), dtype=np.float32)
    darker_level = expected_level - 1 if expected_level > 0 else 0

    assert formula_mip_index_for_phase_increment(just_below) == expected_level
    assert threshold_mip_index_for_phase_increment(just_below) == expected_level
    assert formula_mip_index_for_phase_increment(just_above) == darker_level
    assert threshold_mip_index_for_phase_increment(just_above) == darker_level


def test_selectors_match_across_dense_logarithmic_phase_increment_sweep() -> None:
    sweep = np.geomspace(1.0 / (1 << 20), 0.75, num=8192).astype(np.float32)
    formula = np.array(
        [formula_mip_index_for_phase_increment(value) for value in sweep],
        dtype=np.int32,
    )
    threshold = np.array(
        [threshold_mip_index_for_phase_increment(value) for value in sweep],
        dtype=np.int32,
    )

    assert np.array_equal(formula, threshold)


def test_selectors_match_for_reproducible_random_phase_increments() -> None:
    rng = np.random.default_rng(1729)
    random_values = rng.uniform(-0.1, 0.75, size=10_000).astype(np.float32)
    formula = np.array(
        [formula_mip_index_for_phase_increment(value) for value in random_values],
        dtype=np.int32,
    )
    threshold = np.array(
        [threshold_mip_index_for_phase_increment(value) for value in random_values],
        dtype=np.int32,
    )

    assert np.array_equal(formula, threshold)


@pytest.mark.parametrize("expected_level,boundary", PHASE_INCREMENT_BOUNDARIES)
def test_frequency_boundary_at_44k1_matches_expected_level(
    expected_level: int,
    boundary: np.float32,
) -> None:
    boundary_frequency_hz = float(np.float32(boundary * DEFAULT_SAMPLE_RATE))

    assert formula_mip_index_for_frequency(boundary_frequency_hz, DEFAULT_SAMPLE_RATE) == expected_level
    assert threshold_mip_index_for_frequency(boundary_frequency_hz, DEFAULT_SAMPLE_RATE) == expected_level
