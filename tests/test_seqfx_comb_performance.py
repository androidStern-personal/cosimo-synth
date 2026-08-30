from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from statistics import median

import pytest

from test_seqfx_probe import (
    EFFECT_COMB,
    LANE_COUNT,
    STEP_COUNT,
    GeneratedRuntime,
    _activate_step,
    _base_schedule,
    _empty_upload,
    generated_runtime,
)


ROOT = Path(__file__).resolve().parent.parent
PROBE_PATH = ROOT / "tests" / "helpers" / "seqfx_comb_performance_probe.cjs"
PERFORMANCE_SEED = 0x53455146


@dataclass(frozen=True)
class FastPathTiming:
    neutral_ms: tuple[float, ...]
    advanced_ms: tuple[float, ...]


@dataclass(frozen=True)
class PostTailTiming:
    early_tail_peak: float
    pre_expiry_ms: float
    post_expiry_peak: float
    expired_ms: tuple[float, ...]
    empty_ms: tuple[float, ...]


@dataclass(frozen=True)
class CombPerformanceResult:
    fast_path: FastPathTiming
    post_tail: PostTailTiming


def _four_chain_setup(*, dispersion: float) -> list[list[object]]:
    upload = _empty_upload()
    params = [220.0, 1.4, 0.0, dispersion, 20_000.0, 1.0, 0.18, 0.65]
    for lane in range(LANE_COUNT):
        for step in range(STEP_COUNT):
            _activate_step(
                upload,
                lane=lane,
                step=step,
                trigger=(step == 0),
                effect_type=EFFECT_COMB,
                params=params,
            )
    return _base_schedule(upload)[0]


def _maximum_tail_setup() -> list[list[object]]:
    upload = _empty_upload()
    params = [30.0, 8.0, 0.0, 1.0, 20_000.0, 0.0, 0.0, 1.0]
    for lane in range(LANE_COUNT):
        _activate_step(
            upload,
            lane=lane,
            step=0,
            trigger=True,
            effect_type=EFFECT_COMB,
            params=params,
        )
    return _base_schedule(upload, manual_bpm=20.0, rate=0.0)[0]


@pytest.fixture(scope="module")
def comb_performance_result(
    generated_runtime: GeneratedRuntime,
    tmp_path_factory: pytest.TempPathFactory,
) -> CombPerformanceResult:
    node = shutil.which("node")
    if node is None:
        pytest.skip("node is required for the generated SeqFX performance probe")
    temp_dir = tmp_path_factory.mktemp("seqfx_comb_performance")
    config_path = temp_dir / "config.json"
    config_path.write_text(
        json.dumps(
            {
                "sampleRate": 48_000,
                "blockFrames": 512,
                "warmupBlocks": 192,
                "trialBlocks": 96,
                "trials": 9,
                "seed": PERFORMANCE_SEED,
                "neutralSetup": _four_chain_setup(dispersion=0.0),
                "advancedSetup": _four_chain_setup(dispersion=1.0),
                "tailSetup": _maximum_tail_setup(),
                "emptySetup": _base_schedule(
                    _empty_upload(), manual_bpm=20.0, rate=0.0
                )[0],
                "tailStepFrames": 72_000,
                "tailIdleStart": 72_000 + round((8.0 * 1.5 + 0.25) * 48_000) + 4,
                "expiryProbeFrames": 128,
                "preExpiryBlocks": 96,
            }
        ),
        encoding="utf-8",
    )
    result = subprocess.run(
        [
            node,
            str(PROBE_PATH),
            str(generated_runtime.runtime_path),
            str(config_path),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise AssertionError(f"generated SeqFX performance probe failed:\n{result.stderr}")
    payload = json.loads(result.stdout)
    return CombPerformanceResult(
        fast_path=FastPathTiming(
            neutral_ms=tuple(float(value) for value in payload["fastPath"]["neutralMs"]),
            advanced_ms=tuple(float(value) for value in payload["fastPath"]["advancedMs"]),
        ),
        post_tail=PostTailTiming(
            early_tail_peak=float(payload["postTail"]["earlyTailPeak"]),
            pre_expiry_ms=float(payload["postTail"]["preExpiryMs"]),
            post_expiry_peak=float(payload["postTail"]["postExpiryPeak"]),
            expired_ms=tuple(float(value) for value in payload["postTail"]["expiredMs"]),
            empty_ms=tuple(float(value) for value in payload["postTail"]["emptyMs"]),
        ),
    )


def test_four_neutral_comb_chains_take_a_material_generated_runtime_fast_path(
    comb_performance_result: CombPerformanceResult,
) -> None:
    fast_path_timing = comb_performance_result.fast_path
    neutral_median = median(fast_path_timing.neutral_ms)
    advanced_median = median(fast_path_timing.advanced_ms)
    paired_ratios = tuple(
        neutral / advanced
        for neutral, advanced in zip(
            fast_path_timing.neutral_ms,
            fast_path_timing.advanced_ms,
            strict=True,
        )
    )

    assert neutral_median < advanced_median * 0.72, (
        f"generated-runtime medians were neutral={neutral_median:.3f} ms and "
        f"advanced={advanced_median:.3f} ms"
    )
    assert sum(ratio < 0.8 for ratio in paired_ratios) >= 7, paired_ratios


def test_maximum_comb_tail_expires_atomically_in_the_generated_runtime(
    comb_performance_result: CombPerformanceResult,
) -> None:
    post_tail = comb_performance_result.post_tail
    post_tail_median = median(post_tail.expired_ms)
    assert post_tail.early_tail_peak > 1.0e-4
    assert post_tail.pre_expiry_ms > post_tail_median * 1.8
    assert post_tail.post_expiry_peak == 0.0


def test_post_tail_generated_runtime_work_returns_near_an_empty_pattern(
    comb_performance_result: CombPerformanceResult,
) -> None:
    post_tail = comb_performance_result.post_tail
    expired_median = median(post_tail.expired_ms)
    empty_median = median(post_tail.empty_ms)
    paired_ratios = tuple(
        expired / empty
        for expired, empty in zip(post_tail.expired_ms, post_tail.empty_ms, strict=True)
    )

    assert expired_median <= (empty_median * 1.2) + 0.5, (
        f"generated-runtime post-tail medians were expired={expired_median:.3f} ms and "
        f"empty={empty_median:.3f} ms"
    )
    assert sum(ratio < 1.35 for ratio in paired_ratios) >= 7, paired_ratios
