from __future__ import annotations

import argparse
import hashlib
import json
import wave
from pathlib import Path

import numpy as np

from reference_labs.seqfx_comb.comb_candidates import (
    CombCandidate,
    CombSettings,
    estimate_tuning_cents,
    render_candidate,
    render_metrics,
)


def _fixtures(settings: CombSettings, seconds: float = 3.0) -> dict[str, tuple[np.ndarray, int]]:
    frames = int(settings.sample_rate * seconds)
    time = np.arange(frames, dtype=np.float64) / settings.sample_rate
    rng = np.random.default_rng(0x5E0F)

    impulse = np.zeros(frames, dtype=np.float64)
    impulse[0] = 0.7

    noise_burst = np.zeros(frames, dtype=np.float64)
    burst_frames = int(settings.sample_rate * 0.02)
    noise_burst[:burst_frames] = rng.normal(0.0, 0.18, burst_frames) * np.hanning(burst_frames)

    pluck = np.zeros(frames, dtype=np.float64)
    pluck_frames = int(settings.sample_rate * 0.035)
    pluck[:pluck_frames] = rng.normal(0.0, 0.15, pluck_frames) * np.exp(-np.arange(pluck_frames) / 240.0)

    drums = np.zeros(frames, dtype=np.float64)
    for beat in range(6):
        start = int(beat * settings.sample_rate * 0.36)
        length = min(int(settings.sample_rate * 0.12), frames - start)
        local = np.arange(length, dtype=np.float64) / settings.sample_rate
        if beat % 2 == 0:
            hit = np.sin(2.0 * np.pi * (80.0 - (35.0 * local)) * local) * np.exp(-local * 28.0)
        else:
            hit = rng.normal(0.0, 1.0, length) * np.exp(-local * 34.0)
        drums[start:start + length] += hit * 0.42

    bass = 0.26 * np.sin(2.0 * np.pi * 55.0 * time) + 0.08 * np.sin(2.0 * np.pi * 110.0 * time)
    chord = sum(0.11 * np.sin(2.0 * np.pi * frequency * time) for frequency in (130.81, 164.81, 196.0, 261.63))
    voice_like = (
        0.23 * np.sin(2.0 * np.pi * 116.0 * time)
        + 0.11 * np.sin(2.0 * np.pi * 696.0 * time)
        + 0.07 * np.sin(2.0 * np.pi * 1_160.0 * time)
    ) * (0.55 + (0.45 * np.sin(2.0 * np.pi * 2.2 * time) ** 2))

    return {
        "impulse": (impulse, 1),
        "noise-burst": (noise_burst, burst_frames),
        "pluck": (pluck, pluck_frames),
        "drums": (drums, int(settings.sample_rate * 2.3)),
        "bass": (bass, frames),
        "chord": (chord, frames),
        "voice-like": (voice_like, frames),
    }


def _write_wav(path: Path, audio: np.ndarray, sample_rate: int) -> None:
    pcm = (np.clip(audio, -1.0, 1.0) * 32_767.0).astype("<i2")
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(2)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(pcm.tobytes())


def render_all(output_dir: Path, settings: CombSettings) -> dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    results: dict[str, object] = {
        "settings": settings.__dict__,
        "candidates": {},
    }

    for candidate in CombCandidate:
        candidate_dir = output_dir / candidate.value
        candidate_dir.mkdir(parents=True, exist_ok=True)
        candidate_results: dict[str, object] = {}
        for fixture_name, (source, excitation_frames) in _fixtures(settings).items():
            render = render_candidate(candidate, source, settings)
            wav_path = candidate_dir / f"{fixture_name}.wav"
            _write_wav(wav_path, render.audio, settings.sample_rate)
            metrics = render_metrics(render, settings, excitation_frames)
            if fixture_name in {"impulse", "noise-burst", "pluck"}:
                metrics["tuningCents"] = estimate_tuning_cents(
                    render.audio,
                    settings,
                    max(1, excitation_frames),
                )
            metrics["pcmSha256"] = hashlib.sha256(render.audio.tobytes()).hexdigest()
            candidate_results[fixture_name] = metrics
        results["candidates"][candidate.value] = candidate_results

    return results


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render and measure SeqFX Comb research candidates")
    parser.add_argument("--output", type=Path, default=Path("build/seqfx-comb-lab"))
    parser.add_argument("--check", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    settings = CombSettings()
    results = render_all(args.output, settings)
    metrics_path = args.output / "metrics.json"
    metrics_path.write_text(json.dumps(results, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    if args.check:
        for candidate, fixtures in results["candidates"].items():
            for fixture, metrics in fixtures.items():
                if not metrics["finite"]:
                    raise SystemExit(f"{candidate}/{fixture} produced a non-finite sample")
                if metrics["peak"] > 4.0:
                    raise SystemExit(f"{candidate}/{fixture} peak {metrics['peak']:.3f} exceeds lab bound")
            impulse = fixtures["impulse"]
            if impulse["lateToEarlyTail"] >= 1.0:
                raise SystemExit(f"{candidate} impulse tail does not decay")

    print(metrics_path)


if __name__ == "__main__":
    main()

