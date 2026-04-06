from __future__ import annotations

import json
from pathlib import Path
import tempfile

import numpy as np
import pytest

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
SAMPLES_PER_FRAME = 2048
OSCILLATOR_MIP_COUNT = 11


def _note_on_expr(channel: int, pitch: float, velocity: float = 1.0) -> str:
    return f"std::notes::NoteOn ({int(channel)}, {float(pitch):.1f}f, {float(velocity):.3f}f)"


def _pitch_bend_expr(channel: int, semitones: float) -> str:
    return f"std::notes::PitchBend ({int(channel)}, {float(semitones):.3f}f)"


def _expected_mip_frame(frame: np.ndarray, mip_index: int) -> np.ndarray:
    from scipy.fft import irfft, rfft

    frame64 = np.asarray(frame, dtype=np.float64)
    canonical = frame64 - np.mean(frame64)
    spectrum = rfft(canonical)
    spectrum[0] = 0.0
    harmonic_limit = min(1 << mip_index, spectrum.size - 1)
    truncated = np.zeros_like(spectrum)
    truncated[1 : harmonic_limit + 1] = spectrum[1 : harmonic_limit + 1]
    return irfft(truncated, n=frame64.size).astype(np.float32)


def _build_load_begin_event(*, generation: int, table_index: int, frame_count: int) -> dict[str, int]:
    return {
        "dspSessionId": 1,
        "generation": int(generation),
        "tableIndex": int(table_index),
        "frameCount": int(frame_count),
    }


def _build_mip_frame_events(bank, *, generation: int, table_index: int) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []

    for mip_index in range(OSCILLATOR_MIP_COUNT):
        for frame_index, frame in enumerate(bank.frames):
            events.append(
                {
                    "dspSessionId": 1,
                    "generation": int(generation),
                    "tableIndex": int(table_index),
                    "mipIndex": int(mip_index),
                    "frameIndex": int(frame_index),
                    "samples": _expected_mip_frame(frame, mip_index).tolist(),
                }
            )

    return events


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


def _build_stereo_splitter_source() -> str:
    return (
        "processor StereoSplitter\n"
        + "{\n"
        + "    input stream float32<2> in;\n"
        + "    output stream float32 leftOut;\n"
        + "    output stream float32 rightOut;\n"
        + "    void main()\n"
        + "    {\n"
        + "        loop\n"
        + "        {\n"
        + "            leftOut <- in[0];\n"
        + "            rightOut <- in[1];\n"
        + "            advance();\n"
        + "        }\n"
        + "    }\n"
        + "}\n"
    )


def _build_modulation_probe_source(scheduled_events: list[tuple[int, str]]) -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + _build_runtime_session_adapter_source()
        + _build_stereo_splitter_source()
        + _build_scheduler_source(scheduled_events)
        + "graph ModulationMatrixProbe [[ main ]]\n"
        + "{\n"
        + "    input event wt::WavetableLoadBegin wavetableLoadBegin;\n"
        + "    input event wt::WavetableMipFrame wavetableMipFrame;\n"
        + "    input event int32 modulationClear;\n"
        + "    input event int32 modulationEnable;\n"
        + "    input event wt::ModulationMsegBufferUpload modulationMsegBuffer;\n"
        + "    input event wt::ModulationMsegPlaybackUpload modulationMsegPlayback;\n"
        + "    input event wt::ModulationEnvelopeUpload modulationEnvelope;\n"
        + "    input event wt::ModulationRouteUpload modulationRoute;\n"
        + "    input value float32 framePosition [[ init: 0.0f ]];\n"
        + "    input value float32 glideTime [[ init: 0.0f ]];\n"
        + "    input value float32 pan [[ init: 0.0f ]];\n"
        + "    input value float32 warpMode [[ init: 0.0f ]];\n"
        + "    input value float32 warpAmount [[ init: 0.0f ]];\n"
        + "    input value float32 filterMode [[ init: 0.0f ]];\n"
        + "    input value float32 filterCutoff [[ init: 1000.0f ]];\n"
        + "    input value float32 filterQ [[ init: 0.707107f ]];\n"
        + "    output stream float leftOut;\n"
        + "    output stream float rightOut;\n"
        + "    output event wt::EffectiveFilterStateMonitor effectiveFilterState;\n"
        + "    node scheduler = ScheduledEvents;\n"
        + "    node adapter = RuntimeSessionAdapter;\n"
        + "    node allocator = std::voices::VoiceAllocator (2);\n"
        + "    node engine = wt::SharedVoiceEngine (2);\n"
        + "    node splitter = StereoSplitter;\n"
        + "    event wavetableLoadBegin (wt::WavetableLoadBegin load) { adapter.loadBeginIn <- load; }\n"
        + "    event wavetableMipFrame (wt::WavetableMipFrame frame) { adapter.mipFrameIn <- frame; }\n"
        + "    connection\n"
        + "    {\n"
        + "        scheduler.noteEventOut -> allocator.eventIn;\n"
        + "        allocator.voiceEventOut -> engine.voiceEventIn;\n"
        + "        adapter.loadBeginOut -> engine.wavetableLoadBeginIn;\n"
        + "        adapter.mipFrameOut -> engine.wavetableMipFrameIn;\n"
        + "        modulationClear -> engine.modulationClearIn;\n"
        + "        modulationEnable -> engine.modulationEnableIn;\n"
        + "        modulationMsegBuffer -> engine.modulationMsegBufferIn;\n"
        + "        modulationMsegPlayback -> engine.modulationMsegPlaybackIn;\n"
        + "        modulationEnvelope -> engine.modulationEnvelopeIn;\n"
        + "        modulationRoute -> engine.modulationRouteIn;\n"
        + "        framePosition -> engine.framePositionIn;\n"
        + "        glideTime -> engine.glideTimeIn;\n"
        + "        pan -> engine.panIn;\n"
        + "        warpMode -> engine.warpModeIn;\n"
        + "        warpAmount -> engine.warpAmountIn;\n"
        + "        filterMode -> engine.filterModeIn;\n"
        + "        filterCutoff -> engine.filterCutoffIn;\n"
        + "        filterQ -> engine.filterQIn;\n"
        + "        engine.out -> splitter.in;\n"
        + "        splitter.leftOut -> leftOut;\n"
        + "        splitter.rightOut -> rightOut;\n"
        + "        engine.effectiveFilterStateOut -> effectiveFilterState;\n"
        + "    }\n"
        + "}\n"
    )


def _build_manifest(source_filename: str) -> dict[str, object]:
    return {
        "CmajorVersion": 1,
        "ID": "dev.cosimo.modulation-matrix-probe",
        "version": "1.0",
        "name": "Modulation Matrix Probe",
        "description": "Exercises modulation routing and stereo pan in SharedVoiceEngine",
        "category": "generator",
        "source": source_filename,
    }


def _build_setup_js(
    *,
    extra_events: list[tuple[str, dict[str, object]]],
    frame_position: float = 0.0,
    glide_time: float = 0.0,
    pan: float = 0.0,
    warp_mode: float = 0.0,
    warp_amount: float = 0.0,
    filter_mode: float = 0.0,
    filter_cutoff: float = 1000.0,
    filter_q: float = 0.707107,
) -> str:
    bank = make_sine_bank()
    statements = [
        f"patch.setInputValue_framePosition({float(frame_position):.6f}, 0);",
        f"patch.setInputValue_glideTime({float(glide_time):.6f}, 0);",
        f"patch.setInputValue_pan({float(pan):.6f}, 0);",
        f"patch.setInputValue_warpMode({float(warp_mode):.6f}, 0);",
        f"patch.setInputValue_warpAmount({float(warp_amount):.6f}, 0);",
        f"patch.setInputValue_filterMode({float(filter_mode):.6f}, 0);",
        f"patch.setInputValue_filterCutoff({float(filter_cutoff):.6f}, 0);",
        f"patch.setInputValue_filterQ({float(filter_q):.6f}, 0);",
        f"patch.sendInputEvent_wavetableLoadBegin({json.dumps(_build_load_begin_event(generation=9, table_index=0, frame_count=bank.num_frames))});",
    ]

    for event in _build_mip_frame_events(bank, generation=9, table_index=0):
        statements.append(f"patch.sendInputEvent_wavetableMipFrame({json.dumps(event)});")

    for endpoint_id, payload in extra_events:
        statements.append(f"patch.sendInputEvent_{endpoint_id}({json.dumps(payload)});")

    return "\n".join(statements)


def _render_probe_audio(
    scheduled_events: list[tuple[int, str]],
    *,
    setup_js: str,
    output_endpoint_id: str,
    num_samples: int,
) -> np.ndarray:
    with tempfile.TemporaryDirectory(prefix="modulation_matrix_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        probe_source_path = temp_dir / "ModulationMatrixProbe.cmajor"
        patch_path = temp_dir / "ModulationMatrixProbe.cmajorpatch"

        probe_source_path.write_text(
            _build_modulation_probe_source(scheduled_events),
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
            output_endpoint_id=output_endpoint_id,
            setup_js=setup_js,
        )


def _collect_probe_events(
    scheduled_events: list[tuple[int, str]],
    *,
    setup_js: str,
    output_endpoint_id: str,
    num_samples: int,
) -> list[dict[str, object]]:
    with tempfile.TemporaryDirectory(prefix="modulation_matrix_probe_events_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        probe_source_path = temp_dir / "ModulationMatrixProbe.cmajor"
        patch_path = temp_dir / "ModulationMatrixProbe.cmajorpatch"

        probe_source_path.write_text(
            _build_modulation_probe_source(scheduled_events),
            encoding="utf-8",
        )
        patch_path.write_text(
            json.dumps(_build_manifest(probe_source_path.name), indent=2) + "\n",
            encoding="utf-8",
        )

        return _collect_cmajor_output_events_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=num_samples,
            output_endpoint_id=output_endpoint_id,
            setup_js=setup_js,
        )


@pytest.mark.cmajor
def test_velocity_route_can_pan_a_voice_hard_right() -> None:
    extra_events = [
        ("modulationClear", 1),
        ("modulationEnable", 1),
        (
            "modulationRoute",
            {
                "routeIndex": 0,
                "enabled": True,
                "sourceKind": 3,
                "sourceSlot": 0,
                "targetKind": 7,
                "amount": 1.0,
            },
        ),
    ]
    setup_js = _build_setup_js(extra_events=extra_events)
    schedule = [(0, _note_on_expr(1, 60.0, 1.0))]

    left = _render_probe_audio(schedule, setup_js=setup_js, output_endpoint_id="leftOut", num_samples=16_384)
    right = _render_probe_audio(schedule, setup_js=setup_js, output_endpoint_id="rightOut", num_samples=16_384)

    assert rms(right) > 0.05
    assert rms(left) < (rms(right) * 0.1)


@pytest.mark.cmajor
def test_mseg_pitch_route_adds_on_top_of_pitch_bend() -> None:
    mseg_buffer = [1.0] * 2051
    extra_events = [
        ("modulationClear", 1),
        (
            "modulationMsegBuffer",
            {
                "slot": 1,
                "buffer": mseg_buffer,
            },
        ),
        (
            "modulationMsegPlayback",
            {
                "slot": 1,
                "seconds": 0.25,
                "holdFinalValue": True,
                "rateKind": 0,
                "loopEnabled": False,
                "loopStart": 0.0,
                "loopEnd": 1.0,
                "noteOffPolicy": 0,
                "legatoRestarts": False,
            },
        ),
        (
            "modulationRoute",
            {
                "routeIndex": 0,
                "enabled": True,
                "sourceKind": 1,
                "sourceSlot": 1,
                "targetKind": 5,
                "amount": 12.0,
            },
        ),
        ("modulationEnable", 1),
    ]
    setup_js = _build_setup_js(extra_events=extra_events)
    schedule = [
        (1024, _note_on_expr(1, 60.0, 1.0)),
        (17_408, _pitch_bend_expr(1, 12.0)),
    ]

    left = _render_probe_audio(schedule, setup_js=setup_js, output_endpoint_id="leftOut", num_samples=49_152)
    pre_bend_hz = dominant_bin_hz(left[4096:16_384], DEFAULT_SAMPLE_RATE)
    post_bend_hz = dominant_bin_hz(left[32_768:49_152], DEFAULT_SAMPLE_RATE)

    assert pre_bend_hz == pytest.approx(523.25, abs=12.0)
    assert post_bend_hz == pytest.approx(1046.5, abs=20.0)


@pytest.mark.cmajor
def test_envelope_route_can_raise_the_effective_filter_cutoff_monitor() -> None:
    extra_events = [
        ("modulationClear", 1),
        (
            "modulationEnvelope",
            {
                "slot": 1,
                "attackSeconds": 0.001,
                "decaySeconds": 0.005,
                "sustain": 1.0,
                "releaseSeconds": 0.01,
            },
        ),
        (
            "modulationRoute",
            {
                "routeIndex": 0,
                "enabled": True,
                "sourceKind": 2,
                "sourceSlot": 1,
                "targetKind": 3,
                "amount": 2.0,
            },
        ),
        ("modulationEnable", 1),
    ]
    setup_js = _build_setup_js(
        extra_events=extra_events,
        filter_mode=1.0,
        filter_cutoff=400.0,
    )
    schedule = [(0, _note_on_expr(1, 60.0, 1.0))]

    events = _collect_probe_events(
        schedule,
        setup_js=setup_js,
        output_endpoint_id="effectiveFilterState",
        num_samples=8192,
    )

    cutoff_values = [float(event["event"]["cutoffHz"]) for event in events if int(event["event"]["hasActive"]) == 1]
    assert cutoff_values
    assert max(cutoff_values) > 1200.0
