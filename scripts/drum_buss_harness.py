#!/usr/bin/env python3
"""Run repeatable Ableton Drum Buss probe captures through the local MCP bridge.

This is intentionally conservative:

- it uses one MIDI track containing exactly one source, one Drum Buss, and one
  recorder;
- it refuses to run if multiple Cosimo ProbeRecorder devices are present,
  because all recorders receive the same global Max start/stop messages and
  will race on current_capture.wav;
- it recreates the MIDI clip for every capture and explicitly disables looping.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import socket
import struct
import subprocess
import sys
import time
import wave
from array import array
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
LIVE_IO_DIR = REPO_ROOT / "artifacts" / "drum_buss_research" / "live_io"
RUNS_DIR = REPO_ROOT / "artifacts" / "drum_buss_research" / "runs"
SOURCE_WAV = LIVE_IO_DIR / "current_probe.wav"
CAPTURE_WAV = LIVE_IO_DIR / "current_capture.wav"

HOST = ("127.0.0.1", 9877)

TRACK_NAME = "DBH__ProbeTrack"
SOURCE_DEVICE = "Cosimo ProbeSource Instrument"
DRUM_BUSS_DEVICE = "Drum Buss"
RECORDER_DEVICE = "Cosimo ProbeRecorder"

SOURCE_URI = (
    "query:UserLibrary#Presets:Instruments:Max%20Instrument:"
    "Cosimo%20ProbeSource%20Instrument.amxd"
)
DRUM_BUSS_URI = "query:AudioFx#Drive%20&%20Color:Drum%20Buss"
RECORDER_URI = (
    "query:UserLibrary#Presets:Audio%20Effects:Max%20Audio%20Effect:"
    "Cosimo%20ProbeRecorder.amxd"
)


class HarnessError(RuntimeError):
    pass


@dataclass
class TrackLayout:
    track_index: int
    source_index: int
    drum_buss_index: int
    recorder_index: int
    track_name: str


@dataclass
class WavMetrics:
    path: str
    channels: int
    sample_rate: int
    frames: int
    duration_sec: float
    sample_width: int
    peak: int
    rms: float
    click_index: int | None


class AbletonClient:
    def __init__(self, host: tuple[str, int] = HOST, timeout: float = 45.0) -> None:
        self.host = host
        self.timeout = timeout

    def call(self, command: str, params: dict[str, Any] | None = None) -> Any:
        payload = json.dumps({"type": command, "params": params or {}}).encode()
        try:
            with socket.create_connection(self.host, timeout=3.0) as sock:
                sock.settimeout(self.timeout)
                sock.sendall(struct.pack(">I", len(payload)) + payload)
                header = self._recv_exact(sock, 4)
                length = struct.unpack(">I", header)[0]
                data = self._recv_exact(sock, length)
        except OSError as exc:
            raise HarnessError(
                "Could not reach AbletonMCP on 127.0.0.1:9877. "
                "Open Ableton Live with the AbletonMCP Remote Script enabled."
            ) from exc

        response = json.loads(data.decode())
        if response.get("status") != "success":
            raise HarnessError(f"{command} failed: {response}")
        return response["result"]

    @staticmethod
    def _recv_exact(sock: socket.socket, length: int) -> bytes:
        chunks = bytearray()
        while len(chunks) < length:
            chunk = sock.recv(length - len(chunks))
            if not chunk:
                raise HarnessError("AbletonMCP connection closed unexpectedly")
            chunks.extend(chunk)
        return bytes(chunks)


def build_devices() -> None:
    subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "build_drum_buss_probe_devices.py")],
        cwd=REPO_ROOT,
        check=True,
    )


def write_probe_wav(
    path: Path,
    sample_rate: int,
    duration_sec: float,
    click_amp: float,
    sine_freq: float,
    sine_amp: float,
    sine_start_sec: float,
    sine_end_sec: float,
) -> None:
    frames: list[int] = []
    total_frames = int(round(sample_rate * duration_sec))
    for frame in range(total_frames):
        t = frame / sample_rate
        if frame == 0:
            value = click_amp
        elif sine_start_sec <= t < sine_end_sec:
            value = sine_amp * math.sin(2.0 * math.pi * sine_freq * t)
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


def read_wav(path: Path) -> tuple[WavMetrics, array]:
    with wave.open(str(path), "rb") as wav:
        channels = wav.getnchannels()
        sample_rate = wav.getframerate()
        frames = wav.getnframes()
        sample_width = wav.getsampwidth()
        raw = wav.readframes(frames)
    if sample_width != 2:
        raise HarnessError(f"{path} has sample width {sample_width}; expected 16-bit PCM")

    samples = array("h")
    samples.frombytes(raw)
    peak = max(abs(value) for value in samples) if samples else 0
    rms = math.sqrt(sum(value * value for value in samples) / len(samples)) if samples else 0.0
    click_index = find_click_index(samples, channels, sample_rate)
    metrics = WavMetrics(
        path=str(path),
        channels=channels,
        sample_rate=sample_rate,
        frames=frames,
        duration_sec=frames / sample_rate if sample_rate else 0.0,
        sample_width=sample_width,
        peak=peak,
        rms=rms,
        click_index=click_index,
    )
    return metrics, samples


def find_click_index(samples: array, channels: int, sample_rate: int) -> int | None:
    if channels < 1 or not samples:
        return None
    left = samples[0::channels]
    search_len = min(len(left), sample_rate)
    if search_len == 0:
        return None
    index = max(range(search_len), key=lambda i: abs(left[i]))
    return index if abs(left[index]) > 256 else None


def residual_db(
    reference: tuple[WavMetrics, array],
    candidate: tuple[WavMetrics, array],
) -> dict[str, Any]:
    ref_metrics, ref_samples = reference
    cand_metrics, cand_samples = candidate
    if ref_metrics.click_index is None or cand_metrics.click_index is None:
        return {
            "residual_db": None,
            "reason": "missing_click",
            "reference_click_index": ref_metrics.click_index,
            "candidate_click_index": cand_metrics.click_index,
        }
    if ref_metrics.channels != cand_metrics.channels:
        return {"residual_db": None, "reason": "channel_mismatch"}

    channels = ref_metrics.channels
    ref_start = ref_metrics.click_index * channels
    cand_start = cand_metrics.click_index * channels
    count = min(len(ref_samples) - ref_start, len(cand_samples) - cand_start)
    if count <= 0:
        return {"residual_db": None, "reason": "no_overlap"}

    ref_slice = ref_samples[ref_start : ref_start + count]
    cand_slice = cand_samples[cand_start : cand_start + count]
    signal = sum(value * value for value in ref_slice) / count
    error = sum((a - b) * (a - b) for a, b in zip(ref_slice, cand_slice)) / count
    if signal <= 0.0:
        return {"residual_db": None, "reason": "silent_reference"}
    db = float("-inf") if error <= 0.0 else 10.0 * math.log10(error / signal)
    return {
        "residual_db": db,
        "overlap_samples": count,
        "reference_click_index": ref_metrics.click_index,
        "candidate_click_index": cand_metrics.click_index,
    }


def scan_tracks(client: AbletonClient) -> list[dict[str, Any]]:
    info = client.call("get_session_info")
    tracks: list[dict[str, Any]] = []
    for track_index in range(info["track_count"]):
        try:
            tracks.append(client.call("get_track_info", {"track_index": track_index}))
        except HarnessError as exc:
            message = str(exc)
            if "Master and Return Tracks have no 'Arm' state" in message:
                print(
                    f"warning: skipping non-armable track index {track_index}: {message}",
                    file=sys.stderr,
                    flush=True,
                )
                continue
            raise
    return tracks


def device_indices(track: dict[str, Any], device_name: str) -> list[int]:
    indices: list[int] = []
    for device in track.get("devices", []):
        if device.get("name") == device_name:
            indices.append(int(device["index"]))
    return indices


def find_device_index(track: dict[str, Any], device_name: str) -> int | None:
    indices = device_indices(track, device_name)
    return indices[0] if indices else None


def validate_layout(track: dict[str, Any]) -> TrackLayout:
    source_indices = device_indices(track, SOURCE_DEVICE)
    drum_buss_indices = device_indices(track, DRUM_BUSS_DEVICE)
    recorder_indices = device_indices(track, RECORDER_DEVICE)
    if len(source_indices) != 1 or len(drum_buss_indices) != 1 or len(recorder_indices) != 1:
        raise HarnessError(
            f"Track {track['index']} is not a full harness chain. "
            f"Devices found: {[device.get('name') for device in track.get('devices', [])]}"
        )
    source_index = source_indices[0]
    drum_buss_index = drum_buss_indices[0]
    recorder_index = recorder_indices[0]
    if not (source_index < drum_buss_index < recorder_index):
        raise HarnessError(
            f"Track {track['index']} has the harness devices in the wrong order. "
            f"Expected {SOURCE_DEVICE} -> {DRUM_BUSS_DEVICE} -> {RECORDER_DEVICE}."
        )
    return TrackLayout(
        track_index=int(track["index"]),
        source_index=source_index,
        drum_buss_index=drum_buss_index,
        recorder_index=recorder_index,
        track_name=str(track.get("name", "")),
    )


def delete_stale_harness_tracks(client: AbletonClient) -> list[dict[str, Any]]:
    tracks = scan_tracks(client)
    candidates: list[dict[str, Any]] = []
    for track in tracks:
        has_probe_recorder = bool(device_indices(track, RECORDER_DEVICE))
        is_named_harness_track = track.get("name") == TRACK_NAME
        if has_probe_recorder or is_named_harness_track:
            candidates.append(track)

    deleted: list[dict[str, Any]] = []
    for track in sorted(candidates, key=lambda item: int(item["index"]), reverse=True):
        result = client.call("delete_track", {"track_index": int(track["index"])})
        deleted.append(result)
        time.sleep(0.2)
    return deleted


def ensure_probe_track(client: AbletonClient, load_wait_sec: float) -> TrackLayout:
    tracks = scan_tracks(client)
    recorder_hits = [
        (track, device_index)
        for track in tracks
        for device_index in device_indices(track, RECORDER_DEVICE)
    ]
    if len(recorder_hits) > 1:
        details = [
            f"{track['index']}:{track.get('name', '')}:device{device_index}"
            for track, device_index in recorder_hits
        ]
        raise HarnessError(
            "Multiple Cosimo ProbeRecorder devices are loaded. "
            "They will all write current_capture.wav and corrupt the run. "
            f"Recorder tracks: {', '.join(details)}. Open a clean Live set or remove the extras."
        )
    if len(recorder_hits) == 1:
        layout = validate_layout(recorder_hits[0][0])
        client.call("set_track_name", {"track_index": layout.track_index, "name": TRACK_NAME})
        layout = TrackLayout(
            track_index=layout.track_index,
            source_index=layout.source_index,
            drum_buss_index=layout.drum_buss_index,
            recorder_index=layout.recorder_index,
            track_name=TRACK_NAME,
        )
        reset_track_state(client, layout)
        return layout

    session_info = client.call("get_session_info")
    track_index = int(
        client.call("create_midi_track", {"index": session_info["track_count"]})["index"]
    )
    client.call("set_track_name", {"track_index": track_index, "name": TRACK_NAME})
    for uri in (SOURCE_URI, DRUM_BUSS_URI, RECORDER_URI):
        client.call("load_browser_item", {"track_index": track_index, "item_uri": uri})
        time.sleep(load_wait_sec)

    track = client.call("get_track_info", {"track_index": track_index})
    layout = validate_layout(track)
    reset_track_state(client, layout)
    return layout


def reset_track_state(client: AbletonClient, layout: TrackLayout) -> None:
    client.call("set_track_mute", {"track_index": layout.track_index, "mute": False})
    client.call("set_track_solo", {"track_index": layout.track_index, "solo": False})


def parameter_index(client: AbletonClient, track_index: int, device_index: int, name: str) -> int:
    params = client.call(
        "get_device_parameters",
        {"track_index": track_index, "device_index": device_index},
    )
    for param in params["parameters"]:
        if param["name"] == name:
            return int(param["index"])
    raise HarnessError(
        f"Parameter {name!r} was not found on device {device_index} on track {track_index}"
    )


def reload_source(client: AbletonClient, layout: TrackLayout) -> None:
    reload_index = parameter_index(client, layout.track_index, layout.source_index, "probe_reload")
    for value in (1.0, 0.0):
        client.call(
            "set_device_parameter",
            {
                "track_index": layout.track_index,
                "device_index": layout.source_index,
                "parameter_index": reload_index,
                "value": value,
            },
        )
        time.sleep(0.1)


def prepare_clip(
    client: AbletonClient,
    layout: TrackLayout,
    clip_index: int,
    clip_beats: float,
    note_beats: float,
    pitch: int,
    velocity: int,
) -> dict[str, Any]:
    track = client.call("get_track_info", {"track_index": layout.track_index})
    slots = track.get("clip_slots", [])
    if clip_index < len(slots) and slots[clip_index].get("has_clip"):
        client.call(
            "delete_clip",
            {"track_index": layout.track_index, "clip_index": clip_index},
        )
        time.sleep(0.2)

    client.call(
        "create_clip",
        {"track_index": layout.track_index, "clip_index": clip_index, "length": clip_beats},
    )
    client.call(
        "set_clip_loop",
        {
            "track_index": layout.track_index,
            "clip_index": clip_index,
            "looping": False,
            "loop_start": 0.0,
            "loop_end": clip_beats,
        },
    )
    client.call(
        "add_notes_to_clip",
        {
            "track_index": layout.track_index,
            "clip_index": clip_index,
            "notes": [
                {
                    "pitch": pitch,
                    "start_time": 0.0,
                    "duration": note_beats,
                    "velocity": velocity,
                }
            ],
        },
    )
    return client.call(
        "get_clip_properties",
        {"track_index": layout.track_index, "clip_index": clip_index},
    )


def wait_for_stable_capture(path: Path, timeout_sec: float) -> None:
    deadline = time.monotonic() + timeout_sec
    last_size = -1
    stable_count = 0
    while time.monotonic() < deadline:
        size = path.stat().st_size if path.exists() else 0
        if size > 44 and size == last_size:
            stable_count += 1
            if stable_count >= 3:
                return
        else:
            stable_count = 0
        last_size = size
        time.sleep(0.25)
    raise HarnessError(f"{path} did not stabilize within {timeout_sec:.1f}s")


def run_capture(
    client: AbletonClient,
    layout: TrackLayout,
    run_path: Path,
    clip_index: int,
    clip_beats: float,
    note_beats: float,
    tempo: float,
    pitch: int,
    velocity: int,
    cooldown_sec: float,
) -> tuple[WavMetrics, array, dict[str, Any]]:
    client.call("stop_playback")
    client.call("set_current_time", {"time": 0.0})
    if CAPTURE_WAV.exists():
        CAPTURE_WAV.unlink()

    reload_source(client, layout)
    clip_props = prepare_clip(
        client,
        layout,
        clip_index=clip_index,
        clip_beats=clip_beats,
        note_beats=note_beats,
        pitch=pitch,
        velocity=velocity,
    )

    client.call("start_playback")
    time.sleep(0.25)
    client.call("fire_clip", {"track_index": layout.track_index, "clip_index": clip_index})

    note_duration_sec = note_beats * 60.0 / tempo
    time.sleep(note_duration_sec + 1.0)
    client.call("stop_playback")
    wait_for_stable_capture(CAPTURE_WAV, timeout_sec=5.0)

    metrics, samples = read_wav(CAPTURE_WAV)
    expected_min = note_duration_sec - 0.25
    expected_max = note_duration_sec + 0.25
    if not (expected_min <= metrics.duration_sec <= expected_max):
        raise HarnessError(
            f"Capture duration {metrics.duration_sec:.4f}s is outside "
            f"{expected_min:.4f}s..{expected_max:.4f}s"
        )
    if metrics.peak <= 512:
        raise HarnessError(f"Capture is silent or too quiet: peak={metrics.peak}")
    if metrics.click_index is None:
        raise HarnessError("Capture has no detectable alignment click")

    run_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(CAPTURE_WAV, run_path)
    saved_metrics, saved_samples = read_wav(run_path)
    time.sleep(cooldown_sec)
    return saved_metrics, saved_samples, clip_props


def json_safe(value: Any) -> Any:
    if isinstance(value, float) and math.isinf(value):
        return "-inf" if value < 0 else "inf"
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    return value


def run_repeatability(args: argparse.Namespace) -> int:
    if not args.skip_device_build:
        build_devices()

    write_probe_wav(
        SOURCE_WAV,
        sample_rate=args.sample_rate,
        duration_sec=args.probe_duration_sec,
        click_amp=args.click_amp,
        sine_freq=args.sine_freq,
        sine_amp=args.sine_amp,
        sine_start_sec=args.sine_start_sec,
        sine_end_sec=args.sine_end_sec,
    )

    client = AbletonClient(timeout=args.mcp_timeout_sec)
    client.call("set_tempo", {"tempo": args.tempo})
    deleted_tracks: list[dict[str, Any]] = []
    if args.fresh_track:
        deleted_tracks = delete_stale_harness_tracks(client)
    layout = ensure_probe_track(client, load_wait_sec=args.load_wait_sec)
    run_id = args.run_id or datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = RUNS_DIR / f"{run_id}_repeatability"
    output_dir.mkdir(parents=True, exist_ok=True)

    captures: list[tuple[WavMetrics, array]] = []
    clip_props_by_run: list[dict[str, Any]] = []
    for run_number in range(args.runs):
        run_path = output_dir / f"capture_{run_number + 1:02d}.wav"
        metrics, samples, clip_props = run_capture(
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
        captures.append((metrics, samples))
        clip_props_by_run.append(clip_props)
        print(
            f"run {run_number + 1}/{args.runs}: "
            f"{metrics.duration_sec:.4f}s peak={metrics.peak} "
            f"rms={metrics.rms:.2f} click={metrics.click_index} "
            f"{run_path}",
            flush=True,
        )

    comparisons: list[dict[str, Any]] = []
    reference = captures[0]
    for index, capture in enumerate(captures[1:], start=2):
        comparison = residual_db(reference, capture)
        comparison["candidate_run"] = index
        comparisons.append(comparison)
        db = comparison["residual_db"]
        db_text = "None" if db is None else ("-inf" if math.isinf(db) else f"{db:.2f}")
        print(f"run {index} vs run 1 residual: {db_text} dB", flush=True)

    finite_residuals = [
        item["residual_db"]
        for item in comparisons
        if isinstance(item.get("residual_db"), float) and not math.isinf(item["residual_db"])
    ]
    repeatability_floor_db = max(finite_residuals) if finite_residuals else None

    summary = {
        "run_id": run_id,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "track_layout": asdict(layout),
        "deleted_tracks": deleted_tracks,
        "probe_wav": str(SOURCE_WAV),
        "current_capture_wav": str(CAPTURE_WAV),
        "output_dir": str(output_dir),
        "settings": {
            "runs": args.runs,
            "tempo": args.tempo,
            "clip_index": args.clip_index,
            "clip_beats": args.clip_beats,
            "note_beats": args.note_beats,
            "pitch": args.pitch,
            "velocity": args.velocity,
            "sample_rate": args.sample_rate,
            "probe_duration_sec": args.probe_duration_sec,
            "click_amp": args.click_amp,
            "sine_freq": args.sine_freq,
            "sine_amp": args.sine_amp,
            "sine_start_sec": args.sine_start_sec,
            "sine_end_sec": args.sine_end_sec,
        },
        "captures": [asdict(metrics) for metrics, _samples in captures],
        "clip_properties": clip_props_by_run,
        "comparisons_to_run_1": comparisons,
        "repeatability_floor_db": repeatability_floor_db,
    }
    summary_path = output_dir / "summary.json"
    summary_path.write_text(json.dumps(json_safe(summary), indent=2) + "\n")
    print(f"summary: {summary_path}", flush=True)
    if repeatability_floor_db is not None:
        print(f"repeatability floor: {repeatability_floor_db:.2f} dB vs run 1", flush=True)
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--run-id", default="")
    parser.add_argument("--skip-device-build", action="store_true")
    parser.add_argument(
        "--fresh-track",
        action="store_true",
        help="Delete existing harness/probe-recorder tracks before creating one clean track.",
    )
    parser.add_argument("--mcp-timeout-sec", type=float, default=45.0)
    parser.add_argument("--load-wait-sec", type=float, default=1.2)
    parser.add_argument("--cooldown-sec", type=float, default=1.0)
    parser.add_argument("--tempo", type=float, default=120.0)
    parser.add_argument("--clip-index", type=int, default=0)
    parser.add_argument("--clip-beats", type=float, default=12.0)
    parser.add_argument("--note-beats", type=float, default=10.0)
    parser.add_argument("--pitch", type=int, default=60)
    parser.add_argument("--velocity", type=int, default=100)
    parser.add_argument("--sample-rate", type=int, default=44100)
    parser.add_argument("--probe-duration-sec", type=float, default=4.0)
    parser.add_argument("--click-amp", type=float, default=0.85)
    parser.add_argument("--sine-freq", type=float, default=220.0)
    parser.add_argument("--sine-amp", type=float, default=0.25)
    parser.add_argument("--sine-start-sec", type=float, default=0.25)
    parser.add_argument("--sine-end-sec", type=float, default=3.75)
    args = parser.parse_args()
    if args.runs < 1:
        parser.error("--runs must be at least 1")
    if args.clip_beats <= args.note_beats:
        parser.error("--clip-beats must be larger than --note-beats")
    return args


def main() -> int:
    try:
        return run_repeatability(parse_args())
    except HarnessError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
