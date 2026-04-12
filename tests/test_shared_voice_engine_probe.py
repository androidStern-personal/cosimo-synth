from __future__ import annotations

import json
from pathlib import Path
import tempfile

import numpy as np
from numpy.testing import assert_allclose
import pytest
from scipy.fft import irfft, rfft

from bench import (
    DEFAULT_SAMPLE_RATE,
    _render_cmajor_patch_via_generated_javascript,
    make_sine_bank,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
MSEG_SOURCE = REPO_ROOT / "cmajor" / "Mseg.cmajor"
FIXED_FRAME_SOURCE = REPO_ROOT / "cmajor" / "FixedFrameOscillator.cmajor"
SAMPLES_PER_FRAME = 2048
OSCILLATOR_MIP_COUNT = 11


def _expected_mip_frame(frame: np.ndarray, mip_index: int) -> np.ndarray:
    frame64 = np.asarray(frame, dtype=np.float64)
    canonical = frame64 - np.mean(frame64)
    spectrum = rfft(canonical)
    spectrum[0] = 0.0
    harmonic_limit = min(1 << mip_index, spectrum.size - 1)
    truncated = np.zeros_like(spectrum)
    truncated[1 : harmonic_limit + 1] = spectrum[1 : harmonic_limit + 1]
    return irfft(truncated, n=frame64.size).astype(np.float32)


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


def _build_setup_js(events: list[tuple[str, dict[str, object]]]) -> str:
    return "\n".join(
        f"patch.sendInputEvent_{endpoint_id}({json.dumps(payload)});"
        for endpoint_id, payload in events
    )


def _build_scheduler_source(schedule: list[tuple[int, str, float]]) -> str:
    statements: list[str] = []

    for frame_index, event_type, pitch in schedule:
        if event_type == "note_on":
            message = f"std::notes::NoteOn (1, {float(pitch):.1f}f, 1.0f)"
        elif event_type == "note_off":
            message = f"std::notes::NoteOff (1, {float(pitch):.1f}f, 0.0f)"
        else:
            raise ValueError(f"Unsupported event type {event_type}")

        statements.append(
            "            if (frameCounter == "
            + str(int(frame_index))
            + ")\n"
            + "                noteEventOut <- "
            + message
            + ";"
        )

    schedule_logic = "\n".join(statements)

    return (
        "processor SharedVoiceNoteScheduler\n"
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


def _build_shared_voice_probe_source(schedule: list[tuple[int, str, float]]) -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + _build_stereo_to_mono_probe_source()
        + "\n"
        + "processor RuntimeSessionAdapter\n"
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
        + _build_scheduler_source(schedule)
        + "graph SharedVoiceEngineProbe [[ main ]]\n"
        + "{\n"
        + "    input event wt::WavetableLoadBegin wavetableLoadBegin;\n"
        + "    input event wt::WavetableMipFrame wavetableMipFrame;\n"
        + "    input value float32 framePosition [[ init: 0.0f ]];\n"
        + "    output stream float out;\n"
        + "    node scheduler = SharedVoiceNoteScheduler;\n"
        + "    node adapter = RuntimeSessionAdapter;\n"
        + "    node allocator = std::voices::VoiceAllocator (2);\n"
        + "    node engine = wt::SharedVoiceEngine (2);\n"
        + "    node downmix = StereoToMonoProbe;\n"
        + "    event wavetableLoadBegin (wt::WavetableLoadBegin load) { adapter.loadBeginIn <- load; }\n"
        + "    event wavetableMipFrame (wt::WavetableMipFrame frame) { adapter.mipFrameIn <- frame; }\n"
        + "    connection\n"
        + "    {\n"
        + "        scheduler.noteEventOut -> allocator.eventIn;\n"
        + "        allocator.voiceEventOut -> engine.voiceEventIn;\n"
        + "        adapter.loadBeginOut -> engine.wavetableLoadBeginIn;\n"
        + "        adapter.mipFrameOut -> engine.wavetableMipFrameIn;\n"
        + "        framePosition -> engine.framePositionIn;\n"
        + "        engine.out -> downmix.in;\n"
        + "        downmix.out -> out;\n"
        + "    }\n"
        + "}\n"
    )


def _build_manifest(source_filename: str) -> dict[str, object]:
    return {
        "CmajorVersion": 1,
        "ID": "dev.cosimo.shared-voice-engine-probe",
        "version": "1.0",
        "name": "Shared Voice Engine Probe",
        "description": "Exercises the shared-bank polyphonic voice engine",
        "category": "generator",
        "source": source_filename,
    }


def _render_probe(
    schedule: list[tuple[int, str, float]],
    *,
    num_samples: int,
) -> np.ndarray:
    bank = make_sine_bank()
    setup_events: list[tuple[str, dict[str, object]]] = [
        (
            "wavetableLoadBegin",
            _build_load_begin_event(generation=7, table_index=0, frame_count=bank.num_frames),
        )
    ]
    setup_events.extend(("wavetableMipFrame", event) for event in _build_mip_frame_events(bank, generation=7, table_index=0))

    with tempfile.TemporaryDirectory(prefix="shared_voice_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        probe_source_path = temp_dir / "SharedVoiceEngineProbe.cmajor"
        patch_path = temp_dir / "SharedVoiceEngineProbe.cmajorpatch"

        probe_source_path.write_text(
            _build_shared_voice_probe_source(schedule),
            encoding="utf-8",
        )
        patch_path.write_text(
            json.dumps(_build_manifest(probe_source_path.name), indent=2) + "\n",
            encoding="utf-8",
        )

        return _render_cmajor_patch_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=num_samples,
            output_endpoint_id="out",
            setup_js=_build_setup_js(setup_events),
        )


@pytest.mark.cmajor
def test_shared_voice_engine_sums_two_independent_voices_from_one_bank() -> None:
    num_samples = 16_384
    note0_pitch = 60.0
    note1_pitch = 67.0

    note0_only = _render_probe(
        [(0, "note_on", note0_pitch)],
        num_samples=num_samples,
    )
    note1_only = _render_probe(
        [(0, "note_on", note1_pitch)],
        num_samples=num_samples,
    )
    both = _render_probe(
        [(0, "note_on", note0_pitch), (0, "note_on", note1_pitch)],
        num_samples=num_samples,
    )

    assert_allclose(both, note0_only + note1_only, atol=1e-5, rtol=1e-5)


@pytest.mark.cmajor
def test_shared_voice_engine_note_release_does_not_cut_off_the_other_voice() -> None:
    num_samples = 24_576
    note0_pitch = 60.0
    note1_pitch = 67.0

    note1_only = _render_probe(
        [(0, "note_on", note1_pitch)],
        num_samples=num_samples,
    )
    released_mix = _render_probe(
        [(0, "note_on", note0_pitch), (0, "note_on", note1_pitch), (4_096, "note_off", note0_pitch)],
        num_samples=num_samples,
    )

    tail_start = 16_384
    assert_allclose(released_mix[tail_start:], note1_only[tail_start:], atol=1e-4, rtol=1e-4)
