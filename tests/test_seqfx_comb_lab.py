from __future__ import annotations

import numpy as np
import pytest

from reference_labs.seqfx_comb.comb_candidates import (
    CombCandidate,
    CombSettings,
    estimate_tuning_cents,
    render_candidate,
    render_metrics,
)


@pytest.fixture
def settings() -> CombSettings:
    return CombSettings(sample_rate=48_000, tune_hz=220.0, decay_seconds=0.8)


@pytest.fixture
def impulse(settings: CombSettings) -> np.ndarray:
    source = np.zeros(settings.sample_rate, dtype=np.float64)
    source[0] = 0.6
    return source


@pytest.mark.parametrize("candidate", list(CombCandidate))
def test_comb_candidate_is_finite_bounded_and_decaying(
    candidate: CombCandidate,
    settings: CombSettings,
    impulse: np.ndarray,
) -> None:
    render = render_candidate(candidate, impulse, settings)
    metrics = render_metrics(render, settings, 1)

    assert metrics["finite"]
    assert metrics["peak"] < 4.0
    assert metrics["lateToEarlyTail"] < 1.0


@pytest.mark.parametrize("candidate", list(CombCandidate))
def test_comb_candidate_is_deterministic(
    candidate: CombCandidate,
    settings: CombSettings,
    impulse: np.ndarray,
) -> None:
    first = render_candidate(candidate, impulse[:12_000], settings).audio
    second = render_candidate(candidate, impulse[:12_000], settings).audio
    np.testing.assert_array_equal(first, second)


def test_reference_comb_tracks_the_requested_tune(
    settings: CombSettings,
    impulse: np.ndarray,
) -> None:
    render = render_candidate(CombCandidate.REFERENCE, impulse, settings)
    cents = estimate_tuning_cents(render.audio, settings, 1)
    assert abs(cents) < 20.0


def test_advanced_candidates_are_not_reference_in_disguise(
    settings: CombSettings,
    impulse: np.ndarray,
) -> None:
    reference = render_candidate(CombCandidate.REFERENCE, impulse, settings).audio
    dispersive = render_candidate(CombCandidate.DISPERSIVE, impulse, settings).audio
    vector = render_candidate(CombCandidate.VECTOR, impulse, settings).audio

    assert float(np.sqrt(np.mean((reference - dispersive) ** 2))) > 1.0e-3
    assert float(np.sqrt(np.mean((reference - vector) ** 2))) > 1.0e-3
    assert float(np.sqrt(np.mean((vector[:, 0] - vector[:, 1]) ** 2))) > 1.0e-4
