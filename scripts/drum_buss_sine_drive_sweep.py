#!/usr/bin/env python3
"""Capture pure-sine Drive Type harmonic probes for Drum Buss."""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
import wave
from array import array
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any

from drum_buss_harness import (
    RUNS_DIR,
    SOURCE_WAV,
    AbletonClient,
    HarnessError,
    build_devices,
    delete_stale_harness_tracks,
    ensure_probe_track,
    run_capture,
)
from drum_buss_parameter_sweep import CORE_BASE_PARAMS, set_drum_buss_params


DRIVE_TYPES = [("soft", 0.0), ("medium", 1.0), ("hard", 2.0)]


def write_sine_probe(
    path: Path,
    sample_rate: int,
    duration_sec: float,
    click_amp: float,
    freq_hz: float,
    amp: float,
) -> None:
    total_frames = int(round(sample_rate * duration_sec))
    frames: list[int] = []
    for frame in range(total_frames):
        t = frame / sample_rate
        if frame == 0:
            value = click_amp
        elif 0.25 <= t < duration_sec - 0.25:
            fade_in = min(1.0, (t - 0.25) / 0.05)
            fade_out = min(1.0, (duration_sec - 0.25 - t) / 0.05)
            env = max(0.0, min(fade_in, fade_out))
            value = env * amp * math.sin(2.0 * math.pi * freq_hz * t)
        else:
            value = 0.0
        sample = max(-32767, min(32767, int(round(value * 32767.0))))
        frames.extend([sample, sample])

    path.parent.mkdir(parents=True, exist_ok=True)
    samples = array("h", frames)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(samples.tobytes())


def amplitude_label(value: float) -> str:
    db = 20.0 * math.log10(value) if value > 0 else float("-inf")
    return f"{db:.0f}dbfs".replace("-", "m")


def sweep_cases(amplitudes: list[float]) -> list[dict[str, Any]]:
    cases = []
    for label, drive_type in DRIVE_TYPES:
        for amp in amplitudes:
            cases.append(
                {
                    "name": f"sine_1k_type_{label}_input_{amplitude_label(amp)}",
                    "input_amp": amp,
                    "params": {
                        "Drive Type": drive_type,
                        "Drive": 1.0,
                        "Crunch": 0.0,
                        "Dry/Wet": 1.0,
                    },
                }
            )
    return cases


def run_sweep(args: argparse.Namespace) -> int:
    if not args.skip_device_build:
        build_devices()

    client = AbletonClient(timeout=args.mcp_timeout_sec)
    client.call("set_tempo", {"tempo": args.tempo})
    deleted_tracks: list[dict[str, Any]] = []
    if args.fresh_track:
        deleted_tracks = delete_stale_harness_tracks(client)
    layout = ensure_probe_track(client, load_wait_sec=args.load_wait_sec)

    run_id = args.run_id or datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = RUNS_DIR / f"{run_id}_sine_drive_sweep"
    output_dir.mkdir(parents=True, exist_ok=True)

    amplitudes = [float(value) for value in args.input_amps.split(",")]
    cases = sweep_cases(amplitudes)
    results = []
    for case_index, case in enumerate(cases, start=1):
        write_sine_probe(
            SOURCE_WAV,
            sample_rate=args.sample_rate,
            duration_sec=args.probe_duration_sec,
            click_amp=args.click_amp,
            freq_hz=args.freq_hz,
            amp=case["input_amp"],
        )
        effective_params = dict(CORE_BASE_PARAMS)
        effective_params.update(case["params"])
        set_drum_buss_params(
            client,
            layout.track_index,
            layout.drum_buss_index,
            effective_params,
        )
        run_path = output_dir / f"{case_index:02d}_{case['name']}.wav"
        metrics, _samples, clip_props = run_capture(
            client,
            layout,
            run_path=run_path,
            clip_index=args.clip_index,
            clip_beats=args.clip_beats,
            note_beats=args.note_beats,
            tempo=args.tempo,
            pitch=args.pitch,
            velocity=args.velocity,
            cooldown_sec=args.cooldown_sec,
        )
        results.append(
            {
                "index": case_index,
                "name": case["name"],
                "path": str(run_path),
                "freq_hz": args.freq_hz,
                "input_amp": case["input_amp"],
                "input_amp_dbfs": 20.0 * math.log10(case["input_amp"]),
                "params": effective_params,
                "overrides": case["params"],
                "metrics": asdict(metrics),
                "clip_properties": clip_props,
            }
        )
        print(
            f"{case_index:02d}/{len(cases)} {case['name']}: "
            f"{metrics.duration_sec:.4f}s peak={metrics.peak} "
            f"rms={metrics.rms:.2f} click={metrics.click_index}",
            flush=True,
        )

    summary = {
        "run_id": run_id,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "output_dir": str(output_dir),
        "probe_wav": str(SOURCE_WAV),
        "deleted_tracks": deleted_tracks,
        "track_layout": asdict(layout),
        "scope_note": "Pure sine Drive Type sweep. Boom and Transients are held neutral.",
        "settings": {
            "tempo": args.tempo,
            "clip_index": args.clip_index,
            "clip_beats": args.clip_beats,
            "note_beats": args.note_beats,
            "pitch": args.pitch,
            "velocity": args.velocity,
            "sample_rate": args.sample_rate,
            "probe_duration_sec": args.probe_duration_sec,
            "click_amp": args.click_amp,
            "freq_hz": args.freq_hz,
            "input_amps": amplitudes,
        },
        "base_params": CORE_BASE_PARAMS,
        "captures": results,
    }
    summary_path = output_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n")
    print(f"summary: {summary_path}", flush=True)
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", default="")
    parser.add_argument("--skip-device-build", action="store_true")
    parser.add_argument("--fresh-track", action="store_true")
    parser.add_argument("--mcp-timeout-sec", type=float, default=45.0)
    parser.add_argument("--load-wait-sec", type=float, default=1.2)
    parser.add_argument("--cooldown-sec", type=float, default=0.75)
    parser.add_argument("--tempo", type=float, default=120.0)
    parser.add_argument("--clip-index", type=int, default=0)
    parser.add_argument("--clip-beats", type=float, default=10.0)
    parser.add_argument("--note-beats", type=float, default=8.0)
    parser.add_argument("--pitch", type=int, default=60)
    parser.add_argument("--velocity", type=int, default=100)
    parser.add_argument("--sample-rate", type=int, default=44100)
    parser.add_argument("--probe-duration-sec", type=float, default=3.0)
    parser.add_argument("--click-amp", type=float, default=0.85)
    parser.add_argument("--freq-hz", type=float, default=1000.0)
    parser.add_argument("--input-amps", default="0.02,0.04,0.08,0.12,0.16,0.2")
    return parser.parse_args()


def main() -> int:
    try:
        return run_sweep(parse_args())
    except HarnessError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
