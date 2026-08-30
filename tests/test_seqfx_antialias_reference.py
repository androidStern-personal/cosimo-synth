from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pytest

from reference_labs.seqfx_antialias import (
    adaptive_speedup_coefficients,
    fixed_mip_coefficients,
    response_db,
)

ROOT = Path(__file__).resolve().parent.parent
DSP_SOURCE = ROOT / "fx" / "seqfx" / "SeqFx.cmajor"


def test_fixed_mip_coefficients_reproduce_the_embedded_half_kernel() -> None:
    expected_half = np.asarray(
        [
            0.484055769194,
            0.313502224029,
            0.012690073291,
            -0.096803822304,
            -0.011574096330,
            0.049644199935,
            0.009888999117,
            -0.027712558024,
            -0.007859102447,
            0.015141873695,
            0.005735322834,
            -0.007589563206,
            -0.003743404185,
            0.003465620001,
            0.002977340355,
            0.000209008642,
        ]
    )
    actual = fixed_mip_coefficients()
    np.testing.assert_allclose(actual[15:], expected_half, atol=1.0e-11, rtol=0.0)
    assert np.sum(actual) == pytest.approx(1.0, abs=1.0e-12)
    assert response_db(actual, 0.20) > -0.2
    assert response_db(actual, 0.30) < -55.0


@pytest.mark.parametrize("ratio", [1.1, 1.25, 1.5, 1.75, 2.0])
def test_adaptive_speedup_filter_preserves_a_named_band_and_rejects_alias_zone(
    ratio: float,
) -> None:
    coefficients = adaptive_speedup_coefficients(ratio)
    assert coefficients.size == 47
    np.testing.assert_allclose(coefficients, coefficients[::-1], atol=1.0e-12, rtol=0.0)
    assert np.sum(coefficients) == pytest.approx(1.0, abs=1.0e-12)
    assert response_db(coefficients, 0.36 / ratio) > -0.35
    assert response_db(coefficients, min(0.49, (0.5 / ratio) + 0.08)) < -48.0


def test_fixed_history_phase_accumulators_are_double_precision() -> None:
    source = DSP_SOURCE.read_text()
    assert re.search(r"float64\[seqfx::laneCount\] tapePrimaryWritePhase;", source)
    assert re.search(r"float64\[seqfx::laneCount\] tapeCoarseWritePhase;", source)


def test_long_tape_tier_has_a_real_multistage_antialias_filter() -> None:
    source = DSP_SOURCE.read_text()
    assert "Implementation[seqfx::laneCount, 2, 4] tapeCoarseAntialiasStates" in source
    assert "3200.0f" in source
    assert "antialiasTapeCoarseInput (lane, sample)" in source
