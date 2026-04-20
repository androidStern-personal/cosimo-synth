#!/usr/bin/env python3
"""Build fixed-path Max for Live probe devices for Drum Buss measurement.

This intentionally avoids the Max UI. A .amxd file is an AMPF container with a
normal Max patch JSON in its ptch chunk. The devices use fixed file paths so the
Python harness can overwrite the current input file and read/rename the current
output file without sending string paths into Max.
"""

from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
LIVE_IO_DIR = REPO_ROOT / "artifacts" / "drum_buss_research" / "live_io"
SOURCE_WAV = LIVE_IO_DIR / "current_probe.wav"
CAPTURE_WAV = LIVE_IO_DIR / "current_capture.wav"
OUT_DIR = REPO_ROOT / "artifacts" / "drum_buss_research" / "m4l_devices"
USER_PRESET_DIR = (
    Path.home()
    / "Music"
    / "Ableton"
    / "User Library"
    / "Presets"
    / "Audio Effects"
    / "Max Audio Effect"
)
USER_INSTRUMENT_PRESET_DIR = (
    Path.home()
    / "Music"
    / "Ableton"
    / "User Library"
    / "Presets"
    / "Instruments"
    / "Max Instrument"
)


def box(
    box_id: str,
    maxclass: str,
    box_text: str | None,
    rect: list[float],
    **extra: object,
) -> dict:
    data: dict[str, object] = {
        "id": box_id,
        "maxclass": maxclass,
        "numinlets": extra.pop("numinlets", 1),
        "numoutlets": extra.pop("numoutlets", 1),
        "patching_rect": rect,
    }
    if box_text is not None:
        data["text"] = box_text
    data.update(extra)
    return {"box": data}


def line(src: str, src_outlet: int, dst: str, dst_inlet: int) -> dict:
    return {
        "patchline": {
            "source": [src, src_outlet],
            "destination": [dst, dst_inlet],
        }
    }


def patcher(boxes: list[dict], lines: list[dict], description: str) -> dict:
    return {
        "patcher": {
            "fileversion": 1,
            "appversion": {
                "major": 8,
                "minor": 5,
                "revision": 8,
                "architecture": "arm64",
                "modernui": 1,
            },
            "classnamespace": "box",
            "rect": [120.0, 120.0, 620.0, 260.0],
            "openrect": [0.0, 0.0, 0.0, 220.0],
            "bglocked": 0,
            "openinpresentation": 1,
            "default_fontsize": 10.0,
            "default_fontface": 0,
            "default_fontname": "Arial",
            "gridonopen": 1,
            "gridsize": [8.0, 8.0],
            "gridsnaponopen": 1,
            "objectsnaponopen": 1,
            "statusbarvisible": 2,
            "toolbarvisible": 1,
            "lefttoolbarpinned": 0,
            "toptoolbarpinned": 0,
            "righttoolbarpinned": 0,
            "bottomtoolbarpinned": 0,
            "toolbars_unpinned_last_save": 0,
            "tallnewobj": 0,
            "boxanimatetime": 500,
            "enablehscroll": 1,
            "enablevscroll": 1,
            "devicewidth": 0.0,
            "description": description,
            "digest": "",
            "tags": "cosimo,drum-buss,probe",
            "style": "",
            "subpatcher_template": "",
            "boxes": boxes,
            "lines": lines,
            "dependency_cache": [],
            "autosave": 0,
        }
    }


def live_text(
    box_id: str,
    varname: str,
    label: str,
    rect: list[float],
) -> dict:
    return box(
        box_id,
        "live.text",
        None,
        rect,
        numinlets=1,
        numoutlets=2,
        parameter_enable=1,
        varname=varname,
        presentation=1,
        presentation_rect=rect,
        saved_attribute_attributes={
            "valueof": {
                "parameter_longname": varname,
                "parameter_shortname": varname,
                "parameter_type": 2,
                "parameter_mmax": 1,
                "parameter_enum": ["off", "on"],
            }
        },
        text=label,
        texton=label,
    )


def build_source() -> dict:
    source = str(SOURCE_WAV)
    boxes = [
        box("obj-comment", "comment", "ProbeSource: reload/play fixed probe WAV; auto-plays 6s after load", [24.0, 16.0, 420.0, 20.0], numoutlets=0),
        live_text("obj-reload", "probe_reload", "Reload", [24.0, 48.0, 64.0, 24.0]),
        live_text("obj-play", "probe_play", "Play", [96.0, 48.0, 64.0, 24.0]),
        box("obj-loadbang", "newobj", "loadbang", [24.0, 88.0, 60.0, 20.0]),
        box("obj-auto-open-delay", "newobj", "delay 5800", [184.0, 88.0, 70.0, 20.0]),
        box("obj-auto-play-delay", "newobj", "delay 6000", [264.0, 88.0, 70.0, 20.0]),
        box("obj-open", "message", f"open {source}", [24.0, 120.0, 430.0, 20.0]),
        box("obj-sel", "newobj", "sel 1 0", [96.0, 88.0, 56.0, 20.0], numoutlets=3),
        box("obj-start", "message", "1", [96.0, 120.0, 32.0, 20.0]),
        box("obj-stop", "message", "0", [136.0, 120.0, 32.0, 20.0]),
        box("obj-print-open", "newobj", "print cosimo_probe_source_open", [344.0, 88.0, 150.0, 20.0], numoutlets=0),
        box("obj-print-play", "newobj", "print cosimo_probe_source_play", [184.0, 120.0, 150.0, 20.0], numoutlets=0),
        box("obj-sfplay", "newobj", "sfplay~ 2", [96.0, 160.0, 72.0, 20.0], numinlets=2, numoutlets=3),
        box("obj-out", "newobj", "plugout~", [96.0, 204.0, 58.0, 20.0], numinlets=2, numoutlets=0),
    ]
    lines = [
        line("obj-loadbang", 0, "obj-open", 0),
        line("obj-loadbang", 0, "obj-auto-open-delay", 0),
        line("obj-loadbang", 0, "obj-auto-play-delay", 0),
        line("obj-auto-open-delay", 0, "obj-open", 0),
        line("obj-auto-play-delay", 0, "obj-start", 0),
        line("obj-reload", 0, "obj-open", 0),
        line("obj-open", 0, "obj-sfplay", 0),
        line("obj-open", 0, "obj-print-open", 0),
        line("obj-play", 0, "obj-sel", 0),
        line("obj-sel", 0, "obj-start", 0),
        line("obj-sel", 1, "obj-stop", 0),
        line("obj-start", 0, "obj-sfplay", 0),
        line("obj-start", 0, "obj-print-play", 0),
        line("obj-stop", 0, "obj-sfplay", 0),
        line("obj-sfplay", 0, "obj-out", 0),
        line("obj-sfplay", 1, "obj-out", 1),
    ]
    return patcher(boxes, lines, "Fixed-path source player for Cosimo Drum Buss probes.")


def build_source_instrument() -> dict:
    source = str(SOURCE_WAV)
    boxes = [
        box("obj-comment", "comment", "ProbeSource Instrument: plays fixed probe WAV on MIDI note-on", [24.0, 16.0, 430.0, 20.0], numoutlets=0),
        live_text("obj-reload", "probe_reload", "Reload", [24.0, 48.0, 64.0, 24.0]),
        live_text("obj-play", "probe_play", "Play", [96.0, 48.0, 64.0, 24.0]),
        box("obj-loadbang", "newobj", "loadbang", [24.0, 88.0, 60.0, 20.0]),
        box("obj-open", "message", f"open {source}", [24.0, 120.0, 430.0, 20.0]),
        box("obj-notein", "newobj", "notein", [184.0, 48.0, 56.0, 20.0], numoutlets=3),
        box("obj-stripnote", "newobj", "stripnote", [184.0, 80.0, 60.0, 20.0], numinlets=2, numoutlets=2),
        box("obj-midi-trigger", "newobj", "trigger b b", [184.0, 112.0, 70.0, 20.0], numoutlets=2),
        box("obj-midi-start-delay", "newobj", "delay 50", [184.0, 144.0, 58.0, 20.0]),
        box("obj-rec-start-send", "newobj", "send cosimo_probe_record_start", [264.0, 144.0, 170.0, 20.0], numoutlets=0),
        box("obj-noteoff-sel", "newobj", "sel 0", [264.0, 80.0, 44.0, 20.0], numoutlets=2),
        box("obj-rec-stop-send", "newobj", "send cosimo_probe_record_stop", [344.0, 112.0, 170.0, 20.0], numoutlets=0),
        box("obj-sel", "newobj", "sel 1 0", [96.0, 88.0, 56.0, 20.0], numoutlets=3),
        box("obj-start", "message", "1", [96.0, 120.0, 32.0, 20.0]),
        box("obj-stop", "message", "0", [136.0, 120.0, 32.0, 20.0]),
        box("obj-sfplay", "newobj", "sfplay~ 2", [96.0, 160.0, 72.0, 20.0], numinlets=2, numoutlets=3),
        box("obj-out", "newobj", "plugout~", [96.0, 204.0, 58.0, 20.0], numinlets=2, numoutlets=0),
    ]
    lines = [
        line("obj-loadbang", 0, "obj-open", 0),
        line("obj-reload", 0, "obj-open", 0),
        line("obj-open", 0, "obj-sfplay", 0),
        line("obj-play", 0, "obj-sel", 0),
        line("obj-sel", 0, "obj-start", 0),
        line("obj-sel", 1, "obj-stop", 0),
        line("obj-notein", 0, "obj-stripnote", 0),
        line("obj-notein", 1, "obj-stripnote", 1),
        line("obj-notein", 1, "obj-noteoff-sel", 0),
        line("obj-stripnote", 0, "obj-midi-trigger", 0),
        line("obj-midi-trigger", 0, "obj-midi-start-delay", 0),
        line("obj-midi-trigger", 1, "obj-rec-start-send", 0),
        line("obj-midi-start-delay", 0, "obj-start", 0),
        line("obj-noteoff-sel", 0, "obj-rec-stop-send", 0),
        line("obj-noteoff-sel", 0, "obj-stop", 0),
        line("obj-start", 0, "obj-sfplay", 0),
        line("obj-stop", 0, "obj-sfplay", 0),
        line("obj-sfplay", 0, "obj-out", 0),
        line("obj-sfplay", 1, "obj-out", 1),
    ]
    return patcher(boxes, lines, "Fixed-path MIDI-triggered source instrument for Cosimo Drum Buss probes.")


def build_recorder() -> dict:
    capture = str(CAPTURE_WAV)
    boxes = [
        box("obj-comment", "comment", "ProbeRecorder: records input to fixed WAV on explicit start/stop", [24.0, 16.0, 430.0, 20.0], numoutlets=0),
        live_text("obj-record", "probe_record", "Record", [24.0, 48.0, 72.0, 24.0]),
        box("obj-in", "newobj", "plugin~", [24.0, 88.0, 56.0, 20.0], numoutlets=2),
        box("obj-rec-start-recv", "newobj", "receive cosimo_probe_record_start", [184.0, 88.0, 180.0, 20.0]),
        box("obj-rec-stop-recv", "newobj", "receive cosimo_probe_record_stop", [376.0, 88.0, 180.0, 20.0]),
        box("obj-start-trigger", "newobj", "trigger b b", [184.0, 120.0, 70.0, 20.0], numoutlets=2),
        box("obj-open", "message", f"open {capture}", [112.0, 120.0, 430.0, 20.0]),
        box("obj-manual-start-delay", "newobj", "delay 50", [376.0, 120.0, 60.0, 20.0]),
        box("obj-sel", "newobj", "sel 1 0", [24.0, 120.0, 56.0, 20.0], numoutlets=3),
        box("obj-start", "message", "1", [24.0, 152.0, 32.0, 20.0]),
        box("obj-stop", "message", "0", [464.0, 152.0, 32.0, 20.0]),
        box("obj-print-run", "newobj", "print cosimo_probe_recorder_run", [344.0, 188.0, 160.0, 20.0], numoutlets=0),
        box("obj-rec", "newobj", "sfrecord~ 2", [112.0, 188.0, 86.0, 20.0], numinlets=3, numoutlets=1),
        box("obj-out", "newobj", "plugout~", [24.0, 220.0, 58.0, 20.0], numinlets=2, numoutlets=0),
    ]
    lines = [
        line("obj-in", 0, "obj-rec", 0),
        line("obj-in", 1, "obj-rec", 1),
        line("obj-in", 0, "obj-out", 0),
        line("obj-in", 1, "obj-out", 1),
        line("obj-rec-start-recv", 0, "obj-start-trigger", 0),
        line("obj-start-trigger", 1, "obj-open", 0),
        line("obj-start-trigger", 0, "obj-manual-start-delay", 0),
        line("obj-manual-start-delay", 0, "obj-start", 0),
        line("obj-rec-stop-recv", 0, "obj-stop", 0),
        line("obj-record", 0, "obj-sel", 0),
        line("obj-sel", 0, "obj-start-trigger", 0),
        line("obj-sel", 1, "obj-stop", 0),
        line("obj-open", 0, "obj-rec", 0),
        line("obj-start", 0, "obj-rec", 0),
        line("obj-start", 0, "obj-print-run", 0),
        line("obj-stop", 0, "obj-rec", 0),
        line("obj-stop", 0, "obj-print-run", 0),
    ]
    return patcher(boxes, lines, "Fixed-path recorder for Cosimo Drum Buss probes.")


def write_amxd(path: Path, patch: dict) -> None:
    payload = json.dumps(patch, indent=2).encode("utf-8") + b"\0"
    data = b"ampf" + (4).to_bytes(4, "little") + b"aaaa"
    data += b"meta" + (4).to_bytes(4, "little") + (0).to_bytes(4, "little")
    data += b"ptch" + len(payload).to_bytes(4, "little") + payload
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def main() -> int:
    LIVE_IO_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    USER_PRESET_DIR.mkdir(parents=True, exist_ok=True)
    USER_INSTRUMENT_PRESET_DIR.mkdir(parents=True, exist_ok=True)

    audio_effect_devices = {
        "Cosimo ProbeSource.amxd": build_source(),
        "Cosimo ProbeRecorder.amxd": build_recorder(),
    }
    for name, patch in audio_effect_devices.items():
        built_path = OUT_DIR / name
        user_path = USER_PRESET_DIR / name
        write_amxd(built_path, patch)
        write_amxd(user_path, patch)
        print(f"wrote {built_path}")
        print(f"installed {user_path}")
    instrument_devices = {
        "Cosimo ProbeSource Instrument.amxd": build_source_instrument(),
    }
    for name, patch in instrument_devices.items():
        built_path = OUT_DIR / name
        user_path = USER_INSTRUMENT_PRESET_DIR / name
        write_amxd(built_path, patch)
        write_amxd(user_path, patch)
        print(f"wrote {built_path}")
        print(f"installed {user_path}")
    print(f"source wav path: {SOURCE_WAV}")
    print(f"capture wav path: {CAPTURE_WAV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
