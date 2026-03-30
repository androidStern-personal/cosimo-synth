from __future__ import annotations

import json
from pathlib import Path
import re
import tempfile

import numpy as np
import pytest
from scipy.fft import irfft, rfft

from bench import (
    DEFAULT_SAMPLE_RATE,
    _collect_cmajor_output_events_via_generated_javascript,
    _render_cmajor_patch_via_generated_javascript,
    dominant_bin_hz,
    make_sine_bank,
    rms,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
MSEG_SOURCE = REPO_ROOT / "cmajor" / "Mseg.cmajor"
FIXED_FRAME_SOURCE = REPO_ROOT / "cmajor" / "FixedFrameOscillator.cmajor"
WAVETABLE_SYNTH_SOURCE = REPO_ROOT / "cmajor" / "WavetableSynth.cmajor"
SAMPLES_PER_FRAME = 2048
OSCILLATOR_MIP_COUNT = 11
PLAY_MODE_POLY = 0
PLAY_MODE_MONO = 1
PLAY_MODE_LEGATO = 2


def _expected_mip_frame(frame: np.ndarray, mip_index: int) -> np.ndarray:
    frame64 = np.asarray(frame, dtype=np.float64)
    canonical = frame64 - np.mean(frame64)
    spectrum = rfft(canonical)
    spectrum[0] = 0.0
    harmonic_limit = min(1 << mip_index, spectrum.size - 1)
    truncated = np.zeros_like(spectrum)
    truncated[1 : harmonic_limit + 1] = spectrum[1 : harmonic_limit + 1]
    return irfft(truncated, n=frame64.size).astype(np.float32)


def _note_to_frequency(pitch: float) -> float:
    return float(440.0 * (2.0 ** ((float(pitch) - 69.0) / 12.0)))


def _build_load_begin_event(
    *,
    dsp_session_id: int = 1,
    generation: int,
    table_index: int,
    frame_count: int,
) -> dict[str, int]:
    return {
        "dspSessionId": int(dsp_session_id),
        "generation": int(generation),
        "tableIndex": int(table_index),
        "frameCount": int(frame_count),
    }


def _build_mip_frame_events(
    bank,
    *,
    dsp_session_id: int = 1,
    generation: int,
    table_index: int,
) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []

    for mip_index in range(OSCILLATOR_MIP_COUNT):
        for frame_index, frame in enumerate(bank.frames):
            events.append(
                {
                    "dspSessionId": int(dsp_session_id),
                    "generation": int(generation),
                    "tableIndex": int(table_index),
                    "mipIndex": int(mip_index),
                    "frameIndex": int(frame_index),
                    "samples": _expected_mip_frame(frame, mip_index).tolist(),
                }
            )

    return events


def _build_setup_js(
    *,
    play_mode: int,
    glide_time: float = 0.0,
    include_bank: bool = False,
) -> str:
    statements = [
        f"patch.setInputValue_playMode({float(play_mode):.1f}, 0);",
        f"patch.setInputValue_glideTime({float(glide_time):.6f}, 0);",
        "patch.setInputValue_framePosition(0.0, 0);",
        "patch.setInputValue_msegDepth(0.0, 0);",
    ]

    if include_bank:
        bank = make_sine_bank()
        statements.append(
            f"patch.sendInputEvent_wavetableLoadBegin({json.dumps(_build_load_begin_event(generation=11, table_index=0, frame_count=bank.num_frames))});"
        )
        for event in _build_mip_frame_events(bank, generation=11, table_index=0):
            statements.append(f"patch.sendInputEvent_wavetableMipFrame({json.dumps(event)});")

    return "\n".join(statements)


def _note_on_expr(channel: int, pitch: float, velocity: float = 1.0) -> str:
    return f"std::notes::NoteOn ({int(channel)}, {float(pitch):.1f}f, {float(velocity):.3f}f)"


def _note_off_expr(channel: int, pitch: float, velocity: float = 0.0) -> str:
    return f"std::notes::NoteOff ({int(channel)}, {float(pitch):.1f}f, {float(velocity):.3f}f)"


def _pitch_bend_expr(channel: int, semitones: float) -> str:
    return f"std::notes::PitchBend ({int(channel)}, {float(semitones):.3f}f)"


def _strip_main_annotation(source: str) -> str:
    return re.sub(r"graph\s+WavetableSynth\s+\[\[\s*main\s*\]\]", "graph WavetableSynth", source, count=1)


def _build_scheduler_source(scheduled_events: list[tuple[int, str]]) -> str:
    statements = [
        "            if (frameCounter == "
        + str(int(frame_index))
        + ")\n"
        + "                noteEventOut <- "
        + expression
        + ";"
        for frame_index, expression in scheduled_events
    ]

    schedule_logic = "\n".join(statements)

    return (
        "processor ScheduledEvents\n"
        + "{\n"
        + "    output event (std::notes::NoteOn,\n"
        + "                  std::notes::NoteOff,\n"
        + "                  std::notes::PitchBend,\n"
        + "                  std::notes::Slide,\n"
        + "                  std::notes::Pressure,\n"
        + "                  std::notes::Control) noteEventOut;\n"
        + "    int32 frameCounter = 0;\n"
        + "    void main()\n"
        + "    {\n"
        + "        loop\n"
        + "        {\n"
        + schedule_logic
        + "\n"
        + "            frameCounter += 1;\n"
        + "            advance();\n"
        + "        }\n"
        + "    }\n"
        + "}\n"
    )


def _build_runtime_session_adapter_source() -> str:
    return (
        "processor RuntimeSessionAdapter\n"
        + "{\n"
        + "    input event wt::WavetableLoadBegin loadBeginIn;\n"
        + "    input event wt::WavetableMipFrame mipFrameIn;\n"
        + "    output event wt::WavetableLoadBegin loadBeginOut;\n"
        + "    output event wt::WavetableMipFrame mipFrameOut;\n"
        + "    event loadBeginIn (wt::WavetableLoadBegin load)\n"
        + "    {\n"
        + "        wt::WavetableLoadBegin rewritten = load;\n"
        + "        rewritten.dspSessionId = int32 (processor.session);\n"
        + "        loadBeginOut <- rewritten;\n"
        + "    }\n"
        + "    event mipFrameIn (wt::WavetableMipFrame frame)\n"
        + "    {\n"
        + "        wt::WavetableMipFrame rewritten = frame;\n"
        + "        rewritten.dspSessionId = int32 (processor.session);\n"
        + "        mipFrameOut <- rewritten;\n"
        + "    }\n"
        + "    void main()\n"
        + "    {\n"
        + "        loop\n"
        + "        {\n"
        + "            advance();\n"
        + "        }\n"
        + "    }\n"
        + "}\n"
    )


def _build_dispatcher_probe_source(scheduled_events: list[tuple[int, str]]) -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + _strip_main_annotation(WAVETABLE_SYNTH_SOURCE.read_text(encoding="utf-8"))
        + "\n"
        + _build_scheduler_source(scheduled_events)
        + "graph NoteDispatcherProbe [[ main ]]\n"
        + "{\n"
        + "    input value float32 playMode [[ init: 0.0f ]];\n"
        + "    input value float32 glideTime [[ init: 0.0f ]];\n"
        + "    input value float32 framePosition [[ init: 0.0f ]];\n"
        + "    input value float32 msegDepth [[ init: 0.0f ]];\n"
        + "    output event wt::VoiceRetune monoRetune;\n"
        + "    node scheduler = ScheduledEvents;\n"
        + "    node dispatcher = wt::NoteDispatcher (4);\n"
        + "    connection\n"
        + "    {\n"
        + "        scheduler.noteEventOut -> dispatcher.eventIn;\n"
        + "        playMode -> dispatcher.playModeIn;\n"
        + "        dispatcher.voiceRetuneOut[0] -> monoRetune;\n"
        + "    }\n"
        + "}\n"
    )


def _build_audio_probe_source(scheduled_events: list[tuple[int, str]]) -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + _strip_main_annotation(WAVETABLE_SYNTH_SOURCE.read_text(encoding="utf-8"))
        + "\n"
        + _build_runtime_session_adapter_source()
        + _build_scheduler_source(scheduled_events)
        + "graph NoteDispatcherAudioProbe [[ main ]]\n"
        + "{\n"
        + "    input event wt::WavetableLoadBegin wavetableLoadBegin;\n"
        + "    input event wt::WavetableMipFrame wavetableMipFrame;\n"
        + "    input value float32 playMode [[ init: 0.0f ]];\n"
        + "    input value float32 glideTime [[ init: 0.0f ]];\n"
        + "    input value float32 framePosition [[ init: 0.0f ]];\n"
        + "    input value float32 msegDepth [[ init: 0.0f ]];\n"
        + "    output stream float out;\n"
        + "    node scheduler = ScheduledEvents;\n"
        + "    node adapter = RuntimeSessionAdapter;\n"
        + "    node dispatcher = wt::NoteDispatcher (4);\n"
        + "    node engine = wt::SharedVoiceEngine (4);\n"
        + "    event wavetableLoadBegin (wt::WavetableLoadBegin load) { adapter.loadBeginIn <- load; }\n"
        + "    event wavetableMipFrame (wt::WavetableMipFrame frame) { adapter.mipFrameIn <- frame; }\n"
        + "    connection\n"
        + "    {\n"
        + "        scheduler.noteEventOut -> dispatcher.eventIn;\n"
        + "        playMode -> dispatcher.playModeIn;\n"
        + "        dispatcher.voiceEventOut -> engine.voiceEventIn;\n"
        + "        dispatcher.voiceRetuneOut -> engine.voiceRetuneIn;\n"
        + "        glideTime -> engine.glideTimeIn;\n"
        + "        framePosition -> engine.framePositionIn;\n"
        + "        msegDepth -> engine.msegDepthIn;\n"
        + "        adapter.loadBeginOut -> engine.wavetableLoadBeginIn;\n"
        + "        adapter.mipFrameOut -> engine.wavetableMipFrameIn;\n"
        + "        engine.out -> out;\n"
        + "    }\n"
        + "}\n"
    )


def _build_manifest(source_filename: str, patch_id: str, name: str) -> dict[str, object]:
    return {
        "CmajorVersion": 1,
        "ID": patch_id,
        "version": "1.0",
        "name": name,
        "description": name,
        "category": "generator",
        "source": source_filename,
    }


def _collect_dispatcher_retunes(
    scheduled_events: list[tuple[int, str]],
    *,
    play_mode: int,
    glide_time: float = 0.0,
    num_samples: int = 16_384,
) -> list[dict[str, object]]:
    with tempfile.TemporaryDirectory(prefix="note_dispatcher_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        probe_source_path = temp_dir / "NoteDispatcherProbe.cmajor"
        patch_path = temp_dir / "NoteDispatcherProbe.cmajorpatch"

        probe_source_path.write_text(
            _build_dispatcher_probe_source(scheduled_events),
            encoding="utf-8",
        )
        patch_path.write_text(
            json.dumps(
                _build_manifest(
                    probe_source_path.name,
                    "dev.cosimo.note-dispatcher-probe",
                    "Note Dispatcher Probe",
                ),
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        return _collect_cmajor_output_events_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=num_samples,
            output_endpoint_id="monoRetune",
            setup_js=_build_setup_js(
                play_mode=play_mode,
                glide_time=glide_time,
                include_bank=False,
            ),
        )


def _render_audio_probe(
    scheduled_events: list[tuple[int, str]],
    *,
    play_mode: int,
    glide_time: float = 0.0,
    num_samples: int,
) -> np.ndarray:
    with tempfile.TemporaryDirectory(prefix="note_dispatcher_audio_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        probe_source_path = temp_dir / "NoteDispatcherAudioProbe.cmajor"
        patch_path = temp_dir / "NoteDispatcherAudioProbe.cmajorpatch"

        probe_source_path.write_text(
            _build_audio_probe_source(scheduled_events),
            encoding="utf-8",
        )
        patch_path.write_text(
            json.dumps(
                _build_manifest(
                    probe_source_path.name,
                    "dev.cosimo.note-dispatcher-audio-probe",
                    "Note Dispatcher Audio Probe",
                ),
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        return _render_cmajor_patch_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=num_samples,
            output_endpoint_id="out",
            setup_js=_build_setup_js(
                play_mode=play_mode,
                glide_time=glide_time,
                include_bank=True,
            ),
        )


@pytest.mark.cmajor
def test_note_dispatcher_mono_prefers_the_newest_held_note() -> None:
    events = _collect_dispatcher_retunes(
        [
            (1024, _note_on_expr(1, 60.0)),
            (3072, _note_on_expr(1, 67.0)),
            (5120, _note_on_expr(1, 64.0)),
        ],
        play_mode=PLAY_MODE_MONO,
    )

    assert events
    last_event = events[-1]["event"]
    assert float(last_event["pitch"]) == pytest.approx(64.0, abs=1e-6)


@pytest.mark.cmajor
@pytest.mark.parametrize(
    ("play_mode", "expected_retrigger"),
    [
        (PLAY_MODE_MONO, True),
        (PLAY_MODE_LEGATO, False),
    ],
)
def test_note_dispatcher_overlap_glides_with_mode_specific_retrigger(
    play_mode: int,
    expected_retrigger: bool,
) -> None:
    events = _collect_dispatcher_retunes(
        [
            (1024, _note_on_expr(1, 60.0)),
            (3072, _note_on_expr(1, 72.0)),
        ],
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
    [
        (PLAY_MODE_MONO, True),
        (PLAY_MODE_LEGATO, False),
    ],
)
def test_note_dispatcher_returns_to_the_previous_held_note_on_release(
    play_mode: int,
    expected_retrigger: bool,
) -> None:
    events = _collect_dispatcher_retunes(
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


@pytest.mark.cmajor
def test_shared_voice_engine_legato_keeps_the_envelope_running_on_note_change() -> None:
    schedule = [
        (1024, _note_on_expr(1, 60.0)),
        (9216, _note_on_expr(1, 67.0)),
    ]

    mono_audio = _render_audio_probe(
        schedule,
        play_mode=PLAY_MODE_MONO,
        num_samples=24_576,
    )
    legato_audio = _render_audio_probe(
        schedule,
        play_mode=PLAY_MODE_LEGATO,
        num_samples=24_576,
    )

    mono_attack_window = mono_audio[9216:9472]
    legato_window = legato_audio[9216:9472]
    mono_recovery_window = mono_audio[10_752:13_312]

    assert rms(legato_window) > (rms(mono_attack_window) * 2.0)
    assert rms(mono_recovery_window) > 0.2
    assert dominant_bin_hz(mono_recovery_window, DEFAULT_SAMPLE_RATE) == pytest.approx(
        _note_to_frequency(67.0),
        abs=10.0,
    )


@pytest.mark.cmajor
def test_shared_voice_engine_pitch_bend_changes_output_pitch_after_note_on() -> None:
    audio = _render_audio_probe(
        [
            (1024, _note_on_expr(1, 60.0)),
            (17_408, _pitch_bend_expr(1, 12.0)),
        ],
        play_mode=PLAY_MODE_POLY,
        num_samples=49_152,
    )

    pre_bend_hz = dominant_bin_hz(audio[4096:16_384], DEFAULT_SAMPLE_RATE)
    post_bend_hz = dominant_bin_hz(audio[32_768:49_152], DEFAULT_SAMPLE_RATE)

    assert pre_bend_hz == pytest.approx(_note_to_frequency(60.0), abs=6.0)
    assert post_bend_hz == pytest.approx(_note_to_frequency(72.0), abs=6.0)
