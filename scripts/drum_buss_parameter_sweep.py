#!/usr/bin/env python3
"""Capture a first-pass Drum Buss parameter sweep through the Live harness."""

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
    DRUM_BUSS_DEVICE,
    RUNS_DIR,
    SOURCE_WAV,
    AbletonClient,
    HarnessError,
    build_devices,
    delete_stale_harness_tracks,
    ensure_probe_track,
    parameter_index,
    run_capture,
)


CORE_BASE_PARAMS = {
    "Device On": 1.0,
    "Compressor On": 0.0,
    "Drive": 0.2,
    "Drive Type": 0.0,
    "Crunch": 0.0,
    "Damping Freq": 0.7894946932792664,
    "Transients": 0.0,
    "Boom Amt": 0.0,
    "Boom Audition": 0.0,
    "Trim": 1.0,
    "Output Gain": 0.9249424338340759,
    "Dry/Wet": 1.0,
}


def write_multitone_probe(
    path: Path,
    sample_rate: int,
    duration_sec: float,
    click_amp: float,
    tone_gain: float,
) -> None:
    tones = [
        (80.0, 0.05 * tone_gain),
        (220.0, 0.07 * tone_gain),
        (1000.0, 0.06 * tone_gain),
        (3000.0, 0.05 * tone_gain),
        (7000.0, 0.04 * tone_gain),
        (11000.0, 0.03 * tone_gain),
    ]
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
            value = env * sum(amp * math.sin(2.0 * math.pi * freq * t) for freq, amp in tones)
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


def core_sweep_cases() -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = [{"name": "baseline_core", "params": {}}]

    drive_types = [("soft", 0.0), ("medium", 1.0), ("hard", 2.0)]
    for label, drive_type in drive_types:
        for drive in [0.0, 0.2, 0.5, 1.0]:
            cases.append(
                {
                    "name": f"drive_type_{label}_drive_{drive:g}",
                    "params": {"Drive Type": drive_type, "Drive": drive},
                }
            )

    for crunch in [0.0, 0.25, 0.5, 1.0]:
        cases.append(
            {
                "name": f"crunch_{crunch:g}",
                "params": {"Drive": 0.0, "Crunch": crunch},
            }
        )

    for damping in [0.0, 0.25, 0.5, 0.75, 1.0]:
        cases.append(
            {
                "name": f"damping_{damping:g}",
                "params": {"Drive": 0.0, "Crunch": 0.0, "Damping Freq": damping},
            }
        )

    for dry_wet in [0.0, 0.25, 0.5, 0.75, 1.0]:
        cases.append(
            {
                "name": f"drywet_{dry_wet:g}",
                "params": {"Drive": 0.5, "Crunch": 0.25, "Dry/Wet": dry_wet},
            }
        )

    for trim in [0.5, 0.75, 1.0]:
        cases.append(
            {
                "name": f"trim_{trim:g}",
                "params": {"Drive": 0.2, "Crunch": 0.0, "Trim": trim},
            }
        )

    for output_gain in [0.5, 0.75, 0.9249424338340759, 1.0]:
        cases.append(
            {
                "name": f"output_gain_{output_gain:g}",
                "params": {"Drive": 0.2, "Crunch": 0.0, "Output Gain": output_gain},
            }
        )

    return cases


def drive_low_sweep_cases() -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = [{"name": "baseline_drive_low", "params": {}}]
    drive_types = [("soft", 0.0), ("medium", 1.0), ("hard", 2.0)]
    drive_values = [0.0, 0.1, 0.2, 0.35, 0.5, 0.75, 1.0]
    for label, drive_type in drive_types:
        for drive in drive_values:
            cases.append(
                {
                    "name": f"drive_low_type_{label}_drive_{drive:g}",
                    "params": {
                        "Drive Type": drive_type,
                        "Drive": drive,
                        "Crunch": 0.0,
                        "Dry/Wet": 1.0,
                    },
                }
            )
    return cases


def sweep_cases(mode: str) -> list[dict[str, Any]]:
    if mode == "core":
        return core_sweep_cases()
    if mode == "drive-low":
        return drive_low_sweep_cases()
    raise HarnessError(f"Unknown sweep mode: {mode}")


def set_drum_buss_params(
    client: AbletonClient,
    track_index: int,
    drum_buss_index: int,
    params: dict[str, float],
) -> None:
    updates = []
    for name, value in params.items():
        updates.append(
            {
                "index": parameter_index(client, track_index, drum_buss_index, name),
                "value": value,
            }
        )
    client.call(
        "batch_set_device_parameters",
        {
            "track_index": track_index,
            "device_index": drum_buss_index,
            "parameters": updates,
        },
    )
    time.sleep(0.15)


def run_sweep(args: argparse.Namespace) -> int:
    if not args.skip_device_build:
        build_devices()

    write_multitone_probe(
        SOURCE_WAV,
        sample_rate=args.sample_rate,
        duration_sec=args.probe_duration_sec,
        click_amp=args.click_amp,
        tone_gain=args.tone_gain,
    )

    client = AbletonClient(timeout=args.mcp_timeout_sec)
    client.call("set_tempo", {"tempo": args.tempo})
    deleted_tracks: list[dict[str, Any]] = []
    if args.fresh_track:
        deleted_tracks = delete_stale_harness_tracks(client)
    layout = ensure_probe_track(client, load_wait_sec=args.load_wait_sec)

    run_id = args.run_id or datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = RUNS_DIR / f"{run_id}_parameter_sweep"
    output_dir.mkdir(parents=True, exist_ok=True)

    results = []
    cases = sweep_cases(args.mode)
    for case_index, case in enumerate(cases, start=1):
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
        "scope_note": "Boom and Transients are held neutral and not swept.",
        "mode": args.mode,
        "base_params": CORE_BASE_PARAMS,
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
            "tone_gain": args.tone_gain,
        },
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
    parser.add_argument("--clip-beats", type=float, default=12.0)
    parser.add_argument("--note-beats", type=float, default=10.0)
    parser.add_argument("--pitch", type=int, default=60)
    parser.add_argument("--velocity", type=int, default=100)
    parser.add_argument("--sample-rate", type=int, default=44100)
    parser.add_argument("--probe-duration-sec", type=float, default=4.0)
    parser.add_argument("--click-amp", type=float, default=0.85)
    parser.add_argument("--tone-gain", type=float, default=1.0)
    parser.add_argument("--mode", choices=["core", "drive-low"], default="core")
    return parser.parse_args()


def main() -> int:
    try:
        return run_sweep(parse_args())
    except HarnessError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
