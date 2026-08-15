from __future__ import annotations

import json
from pathlib import Path
import re
import tempfile

import pytest

from bench import DEFAULT_SAMPLE_RATE, _collect_cmajor_output_events_via_generated_javascript


REPO_ROOT = Path(__file__).resolve().parents[1]
MSEG_SOURCE = REPO_ROOT / "cmajor" / "Mseg.cmajor"
FIXED_FRAME_SOURCE = REPO_ROOT / "cmajor" / "FixedFrameOscillator.cmajor"
VOICE_REDUCER_SOURCE = REPO_ROOT / "cmajor" / "VoiceReducer.cmajor"
WAVETABLE_SYNTH_SOURCE = REPO_ROOT / "cmajor" / "WavetableSynth.cmajor"
PLAY_MODE_MONO = 1
PLAY_MODE_LEGATO = 2


def _note_on_expr(channel: int, pitch: float, velocity: float = 1.0) -> str:
    return f"std::notes::NoteOn ({channel}, {pitch:.1f}f, {velocity:.3f}f)"


def _note_off_expr(channel: int, pitch: float, velocity: float = 0.0) -> str:
    return f"std::notes::NoteOff ({channel}, {pitch:.1f}f, {velocity:.3f}f)"


def _extract_note_dispatcher_source(source: str) -> str:
    source_without_main = re.sub(
        r"graph\s+WavetableSynth\s+\[\[\s*main\s*\]\]",
        "graph WavetableSynth",
        source,
        count=1,
    )
    return source_without_main.split("    processor DesiredTableMonitor", maxsplit=1)[0] + "\n}\n"


def _build_scheduler_source(scheduled_events: list[tuple[int, str]]) -> str:
    statements = "\n".join(
        "            if (frameCounter == "
        + str(frame_index)
        + ")\n                noteEventOut <- "
        + expression
        + ";"
        for frame_index, expression in scheduled_events
    )
    return (
        "processor ScheduledEvents\n"
        "{\n"
        "    output event (std::notes::NoteOn,\n"
        "                  std::notes::NoteOff,\n"
        "                  std::notes::PitchBend,\n"
        "                  std::notes::Slide,\n"
        "                  std::notes::Pressure,\n"
        "                  std::notes::Control) noteEventOut;\n"
        "    int32 frameCounter;\n"
        "    void main()\n"
        "    {\n"
        "        loop\n"
        "        {\n"
        + statements
        + "\n            frameCounter += 1;\n"
        "            advance();\n"
        "        }\n"
        "    }\n"
        "}\n"
    )


def _build_probe_source(scheduled_events: list[tuple[int, str]]) -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + VOICE_REDUCER_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + _extract_note_dispatcher_source(WAVETABLE_SYNTH_SOURCE.read_text(encoding="utf-8"))
        + "\n"
        + _build_scheduler_source(scheduled_events)
        + "graph NoteDispatcherProbe [[ main ]]\n"
        "{\n"
        "    input value float32 playMode [[ init: 0.0f ]];\n"
        "    input value float32 glideTime [[ init: 0.0f ]];\n"
        "    output event wt::VoiceRetune monoRetune;\n"
        "    node scheduler = ScheduledEvents;\n"
        "    node dispatcher = wt::NoteDispatcher (4);\n"
        "    connection\n"
        "    {\n"
        "        scheduler.noteEventOut -> dispatcher.eventIn;\n"
        "        playMode -> dispatcher.playModeIn;\n"
        "        dispatcher.voiceRetuneOut[0] -> monoRetune;\n"
        "    }\n"
        "}\n"
    )


def _collect_retunes(
    scheduled_events: list[tuple[int, str]],
    *,
    play_mode: int,
    glide_time: float = 0.0,
) -> list[dict[str, object]]:
    with tempfile.TemporaryDirectory(prefix="note_dispatcher_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        source_path = temp_dir / "NoteDispatcherProbe.cmajor"
        patch_path = temp_dir / "NoteDispatcherProbe.cmajorpatch"
        source_path.write_text(_build_probe_source(scheduled_events), encoding="utf-8")
        patch_path.write_text(
            json.dumps(
                {
                    "CmajorVersion": 1,
                    "ID": "dev.cosimo.note-dispatcher-probe",
                    "version": "1.0",
                    "name": "Note Dispatcher Probe",
                    "category": "generator",
                    "source": source_path.name,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        setup_js = (
            f"patch.setInputValue_playMode({float(play_mode):.1f}, 0);\n"
            f"patch.setInputValue_glideTime({glide_time:.6f}, 0);"
        )
        return _collect_cmajor_output_events_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=16_384,
            output_endpoint_id="monoRetune",
            setup_js=setup_js,
        )


@pytest.mark.cmajor
def test_note_dispatcher_mono_prefers_the_newest_held_note() -> None:
    events = _collect_retunes(
        [
            (1024, _note_on_expr(1, 60.0)),
            (3072, _note_on_expr(1, 67.0)),
            (5120, _note_on_expr(1, 64.0)),
        ],
        play_mode=PLAY_MODE_MONO,
    )

    assert events
    assert float(events[-1]["event"]["pitch"]) == pytest.approx(64.0, abs=1e-6)


@pytest.mark.cmajor
@pytest.mark.parametrize(
    ("play_mode", "expected_retrigger"),
    [(PLAY_MODE_MONO, True), (PLAY_MODE_LEGATO, False)],
)
def test_note_dispatcher_overlap_glides_with_mode_specific_retrigger(
    play_mode: int,
    expected_retrigger: bool,
) -> None:
    events = _collect_retunes(
        [(1024, _note_on_expr(1, 60.0)), (3072, _note_on_expr(1, 72.0))],
        play_mode=play_mode,
        glide_time=0.150,
    )

    assert len(events) >= 2
    first_event = events[0]["event"]
    second_event = events[1]["event"]
    assert bool(first_event["retrigger"]) is True
    assert bool(first_event["glide"]) is False
    assert bool(second_event["retrigger"]) is expected_retrigger
    assert bool(second_event["glide"]) is True
    assert float(second_event["pitch"]) == pytest.approx(72.0, abs=1e-6)


@pytest.mark.cmajor
@pytest.mark.parametrize(
    ("play_mode", "expected_retrigger"),
    [(PLAY_MODE_MONO, True), (PLAY_MODE_LEGATO, False)],
)
def test_note_dispatcher_returns_to_previous_held_note_on_release(
    play_mode: int,
    expected_retrigger: bool,
) -> None:
    events = _collect_retunes(
        [
            (1024, _note_on_expr(1, 60.0)),
            (3072, _note_on_expr(1, 72.0)),
            (5120, _note_off_expr(1, 72.0)),
        ],
        play_mode=play_mode,
        glide_time=0.150,
    )

    assert len(events) >= 3
    release_event = events[-1]["event"]
    assert float(release_event["pitch"]) == pytest.approx(60.0, abs=1e-6)
    assert bool(release_event["retrigger"]) is expected_retrigger
    assert bool(release_event["glide"]) is True
