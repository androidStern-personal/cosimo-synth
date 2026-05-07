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


def _extract_wavetable_synth_prelude(source: str) -> str:
    return _strip_main_annotation(source).split("    graph Voice", maxsplit=1)[0] + "\n}\n"


def _articulated_note_on_statement(
    frame_index: int,
    *,
    channel: int,
    pitch: float,
    velocity: float,
    selector_a: int,
    selector_b: int = 0,
    duration_samples: int = 0,
    age_samples: int = 0,
) -> str:
    return (
        "            if (frameCounter == "
        + str(int(frame_index))
        + ")\n"
        + "            {\n"
        + "                wt::ArticulatedNoteOn note;\n"
        + f"                note.channel = {int(channel)};\n"
        + f"                note.pitch = {float(pitch):.1f}f;\n"
        + f"                note.velocity = {float(velocity):.3f}f;\n"
        + "                note.hasArticulation = true;\n"
        + f"                note.selectorA = {int(selector_a)};\n"
        + f"                note.selectorB = {int(selector_b)};\n"
        + f"                note.durationSamples = {int(duration_samples)};\n"
        + f"                note.ageSamples = {int(age_samples)};\n"
        + "                articulatedNoteOut <- note;\n"
        + "            }"
    )


def _note_meta_statement(
    frame_index: int,
    *,
    channel: int,
    note_number: int,
    selector_a: int,
    selector_b: int = 0,
    duration_samples: int = 0,
    age_samples: int = 0,
) -> str:
    return (
        "            if (frameCounter == "
        + str(int(frame_index))
        + ")\n"
        + "            {\n"
        + "                wt::ArticulationNoteMeta meta;\n"
        + f"                meta.channel = {int(channel)};\n"
        + f"                meta.noteNumber = {int(note_number)};\n"
        + f"                meta.selectorA = {int(selector_a)};\n"
        + f"                meta.selectorB = {int(selector_b)};\n"
        + f"                meta.durationSamples = {int(duration_samples)};\n"
        + f"                meta.ageSamples = {int(age_samples)};\n"
        + "                noteMetaOut <- meta;\n"
        + "            }"
    )


def _build_scheduler_source(
    scheduled_events: list[tuple[int, str]],
    scheduled_note_meta_events: list[str] | None = None,
    scheduled_articulated_note_ons: list[str] | None = None,
) -> str:
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
    note_meta_schedule_logic = "\n".join(scheduled_note_meta_events or [])
    articulated_schedule_logic = "\n".join(scheduled_articulated_note_ons or [])

    return (
        "processor ScheduledEvents\n"
        + "{\n"
        + "    output event (std::notes::NoteOn,\n"
        + "                  std::notes::NoteOff,\n"
        + "                  std::notes::PitchBend,\n"
        + "                  std::notes::Slide,\n"
        + "                  std::notes::Pressure,\n"
        + "                  std::notes::Control) noteEventOut;\n"
        + "    output event wt::ArticulationNoteMeta noteMetaOut;\n"
        + "    output event wt::ArticulatedNoteOn articulatedNoteOut;\n"
        + "    int32 frameCounter = 0;\n"
        + "    void main()\n"
        + "    {\n"
        + "        loop\n"
        + "        {\n"
        + note_meta_schedule_logic
        + "\n"
        + schedule_logic
        + "\n"
        + articulated_schedule_logic
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


def _build_stereo_to_mono_probe_source() -> str:
    return (
        "processor StereoToMonoProbe\n"
        + "{\n"
        + "    input stream float32<2> in;\n"
        + "    output stream float32 out;\n"
        + "    void main()\n"
        + "    {\n"
        + "        loop\n"
        + "        {\n"
        + "            out <- (in[0] + in[1]) * 0.5f;\n"
        + "            advance();\n"
        + "        }\n"
        + "    }\n"
        + "}\n"
    )


def _build_dispatcher_probe_source(
    scheduled_events: list[tuple[int, str]],
    scheduled_note_meta_events: list[str] | None = None,
    scheduled_articulated_note_ons: list[str] | None = None,
) -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + _extract_wavetable_synth_prelude(WAVETABLE_SYNTH_SOURCE.read_text(encoding="utf-8"))
        + "\n"
        + _build_scheduler_source(scheduled_events, scheduled_note_meta_events, scheduled_articulated_note_ons)
        + "graph NoteDispatcherProbe [[ main ]]\n"
        + "{\n"
        + "    input value float32 playMode [[ init: 0.0f ]];\n"
        + "    input value float32 glideTime [[ init: 0.0f ]];\n"
        + "    input value float32 framePosition [[ init: 0.0f ]];\n"
        + "    output event wt::VoiceRetune monoRetune;\n"
        + "    node scheduler = ScheduledEvents;\n"
        + "    node dispatcher = wt::NoteDispatcher (4);\n"
        + "    connection\n"
        + "    {\n"
        + "        scheduler.noteMetaOut -> dispatcher.noteMetaIn;\n"
        + "        scheduler.noteEventOut -> dispatcher.eventIn;\n"
        + "        scheduler.articulatedNoteOut -> dispatcher.articulatedNoteOnIn;\n"
        + "        playMode -> dispatcher.playModeIn;\n"
        + "        dispatcher.voiceRetuneOut[0] -> monoRetune;\n"
        + "    }\n"
        + "}\n"
    )


def _build_audio_probe_source(
    scheduled_events: list[tuple[int, str]],
    scheduled_note_meta_events: list[str] | None = None,
    scheduled_articulated_note_ons: list[str] | None = None,
) -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + _extract_wavetable_synth_prelude(WAVETABLE_SYNTH_SOURCE.read_text(encoding="utf-8"))
        + "\n"
        + _build_runtime_session_adapter_source()
        + _build_stereo_to_mono_probe_source()
        + _build_scheduler_source(scheduled_events, scheduled_note_meta_events, scheduled_articulated_note_ons)
        + "graph NoteDispatcherAudioProbe [[ main ]]\n"
        + "{\n"
        + "    input event wt::WavetableLoadBegin wavetableLoadBegin;\n"
        + "    input event wt::WavetableMipFrame wavetableMipFrame;\n"
        + "    input event wt::ArticulationSnapshotUpload articulationSnapshot;\n"
        + "    input value float32 playMode [[ init: 0.0f ]];\n"
        + "    input value float32 glideTime [[ init: 0.0f ]];\n"
        + "    input value float32 framePosition [[ init: 0.0f ]];\n"
        + "    output event wt::VoiceArticulationMonitor articulationStart;\n"
        + "    output stream float out;\n"
        + "    node scheduler = ScheduledEvents;\n"
        + "    node adapter = RuntimeSessionAdapter;\n"
        + "    node dispatcher = wt::NoteDispatcher (4);\n"
        + "    node engine = wt::SharedVoiceEngine (4);\n"
        + "    node downmix = StereoToMonoProbe;\n"
        + "    event wavetableLoadBegin (wt::WavetableLoadBegin load) { adapter.loadBeginIn <- load; }\n"
        + "    event wavetableMipFrame (wt::WavetableMipFrame frame) { adapter.mipFrameIn <- frame; }\n"
        + "    event articulationSnapshot (wt::ArticulationSnapshotUpload upload) { engine.articulationSnapshotIn <- upload; }\n"
        + "    connection\n"
        + "    {\n"
        + "        scheduler.noteMetaOut -> dispatcher.noteMetaIn;\n"
        + "        scheduler.noteEventOut -> dispatcher.eventIn;\n"
        + "        scheduler.articulatedNoteOut -> dispatcher.articulatedNoteOnIn;\n"
        + "        playMode -> dispatcher.playModeIn;\n"
        + "        dispatcher.voiceEventOut -> engine.voiceEventIn;\n"
        + "        dispatcher.voiceRetuneOut -> engine.voiceRetuneIn;\n"
        + "        glideTime -> engine.glideTimeIn;\n"
        + "        framePosition -> engine.framePositionIn;\n"
        + "        adapter.loadBeginOut -> engine.wavetableLoadBeginIn;\n"
        + "        adapter.mipFrameOut -> engine.wavetableMipFrameIn;\n"
        + "        engine.voiceArticulationStartOut -> articulationStart;\n"
        + "        engine.out -> downmix.in;\n"
        + "        downmix.out -> out;\n"
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


def _build_articulation_snapshot_upload(
    *,
    selector_a: int,
    frame_position: float,
    mseg1_morph: float,
    route1_amount: float,
    enabled: bool = True,
    pan: float = 0.0,
    warp_mode: int = 0,
    warp_amount: float = 0.0,
    filter_mode: int = 0,
    filter_cutoff_hz: float = 1000.0,
    filter_q: float = 0.707107,
) -> dict[str, object]:
    return {
        "selectorA": int(selector_a),
        "enabled": bool(enabled),
        "framePosition": float(frame_position),
        "pan": float(pan),
        "warpMode": int(warp_mode),
        "warpAmount": float(warp_amount),
        "filterMode": int(filter_mode),
        "filterCutoffHz": float(filter_cutoff_hz),
        "filterQ": float(filter_q),
        "msegMorphs": [float(mseg1_morph), 0.0, 0.0],
        "routeAmounts": [float(route1_amount), *([0.0] * 11)],
        "envelopeAttackSeconds": [0.01, 0.02, 0.03],
        "envelopeDecaySeconds": [0.10, 0.20, 0.30],
        "envelopeSustain": [0.7, 0.6, 0.5],
        "envelopeReleaseSeconds": [0.40, 0.50, 0.60],
    }


def _collect_audio_probe_articulation_starts(
    scheduled_events: list[tuple[int, str]],
    *,
    scheduled_note_meta_events: list[str] | None = None,
    scheduled_articulated_note_ons: list[str] | None = None,
    articulation_snapshots: list[dict[str, object]] | None = None,
    play_mode: int = PLAY_MODE_POLY,
    num_samples: int = 4096,
) -> list[dict[str, object]]:
    with tempfile.TemporaryDirectory(prefix="note_dispatcher_articulation_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        probe_source_path = temp_dir / "NoteDispatcherAudioProbe.cmajor"
        patch_path = temp_dir / "NoteDispatcherAudioProbe.cmajorpatch"

        probe_source_path.write_text(
            _build_audio_probe_source(scheduled_events, scheduled_note_meta_events, scheduled_articulated_note_ons),
            encoding="utf-8",
        )
        patch_path.write_text(
            json.dumps(
                _build_manifest(
                    probe_source_path.name,
                    "dev.cosimo.note-dispatcher-articulation-probe",
                    "Note Dispatcher Articulation Probe",
                ),
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        setup_statements = [_build_setup_js(play_mode=play_mode, include_bank=False)]
        for snapshot in articulation_snapshots or []:
            setup_statements.append(
                f"patch.sendInputEvent_articulationSnapshot({json.dumps(snapshot)});"
            )

        return _collect_cmajor_output_events_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=num_samples,
            output_endpoint_id="articulationStart",
            setup_js="\n".join(setup_statements),
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


@pytest.mark.cmajor
def test_articulated_note_on_latches_selector_snapshot_at_voice_start() -> None:
    events = _collect_audio_probe_articulation_starts(
        [],
        scheduled_articulated_note_ons=[
            _articulated_note_on_statement(
                1024,
                channel=2,
                pitch=64.0,
                velocity=0.75,
                selector_a=5,
                selector_b=9,
                duration_samples=4800,
                age_samples=120,
            ),
        ],
        articulation_snapshots=[
            _build_articulation_snapshot_upload(
                selector_a=5,
                frame_position=0.625,
                mseg1_morph=0.375,
                route1_amount=-0.25,
            ),
        ],
    )

    assert len(events) == 1
    event = events[0]["event"]
    assert event == {
        "voiceIndex": 0,
        "hasArticulation": 1,
        "selectorA": 5,
        "selectorB": 9,
        "durationSamples": 4800,
        "ageSamples": 120,
        "framePosition": pytest.approx(0.625, abs=1e-6),
        "mseg1Morph": pytest.approx(0.375, abs=1e-6),
        "route1Amount": pytest.approx(-0.25, abs=1e-6),
    }


@pytest.mark.cmajor
def test_note_meta_event_attaches_to_matching_midi_note_on() -> None:
    events = _collect_audio_probe_articulation_starts(
        [
            (1024, _note_on_expr(3, 71.0, 0.65)),
        ],
        scheduled_note_meta_events=[
            _note_meta_statement(
                1024,
                channel=3,
                note_number=71,
                selector_a=11,
                selector_b=2,
                duration_samples=22050,
                age_samples=512,
            ),
        ],
        articulation_snapshots=[
            _build_articulation_snapshot_upload(
                selector_a=11,
                frame_position=0.5,
                mseg1_morph=0.2,
                route1_amount=0.125,
            ),
        ],
    )

    assert len(events) == 1
    event = events[0]["event"]
    assert event["hasArticulation"] == 1
    assert event["selectorA"] == 11
    assert event["selectorB"] == 2
    assert event["durationSamples"] == 22050
    assert event["ageSamples"] == 512
    assert event["framePosition"] == pytest.approx(0.5, abs=1e-6)
    assert event["mseg1Morph"] == pytest.approx(0.2, abs=1e-6)
    assert event["route1Amount"] == pytest.approx(0.125, abs=1e-6)


@pytest.mark.cmajor
def test_unknown_selector_does_not_apply_an_articulation_snapshot() -> None:
    events = _collect_audio_probe_articulation_starts(
        [],
        scheduled_articulated_note_ons=[
            _articulated_note_on_statement(
                1024,
                channel=2,
                pitch=64.0,
                velocity=0.75,
                selector_a=12,
                duration_samples=4800,
                age_samples=120,
            ),
        ],
        articulation_snapshots=[
            _build_articulation_snapshot_upload(
                selector_a=5,
                frame_position=0.625,
                mseg1_morph=0.375,
                route1_amount=-0.25,
            ),
        ],
    )

    assert len(events) == 1
    event = events[0]["event"]
    assert event["hasArticulation"] == 0
    assert event["selectorA"] == -1
    assert event["selectorB"] == 0
    assert event["durationSamples"] == 0
    assert event["ageSamples"] == 0
    assert event["framePosition"] == pytest.approx(0.0, abs=1e-6)


@pytest.mark.cmajor
def test_mono_retune_carries_the_new_notes_articulation_selector() -> None:
    events = _collect_audio_probe_articulation_starts(
        [
            (1024, _note_on_expr(1, 60.0)),
        ],
        scheduled_articulated_note_ons=[
            _articulated_note_on_statement(
                2048,
                channel=1,
                pitch=67.0,
                velocity=0.9,
                selector_a=7,
                selector_b=0,
                duration_samples=9600,
                age_samples=0,
            ),
        ],
        articulation_snapshots=[
            _build_articulation_snapshot_upload(
                selector_a=7,
                frame_position=0.25,
                mseg1_morph=0.8,
                route1_amount=0.5,
            ),
        ],
        play_mode=PLAY_MODE_LEGATO,
        num_samples=4096,
    )

    assert len(events) >= 2
    plain_start = events[0]["event"]
    articulated_retune = events[-1]["event"]
    assert plain_start["hasArticulation"] == 0
    assert articulated_retune["hasArticulation"] == 1
    assert articulated_retune["selectorA"] == 7
    assert articulated_retune["durationSamples"] == 9600
    assert articulated_retune["mseg1Morph"] == pytest.approx(0.8, abs=1e-6)
    assert articulated_retune["route1Amount"] == pytest.approx(0.5, abs=1e-6)
