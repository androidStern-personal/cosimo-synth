from __future__ import annotations

import json
import tempfile
from pathlib import Path

import numpy as np
import pytest

from bench import (
    DEFAULT_SAMPLE_RATE,
    _collect_cmajor_output_events_via_generated_javascript,
    _render_cmajor_patch_via_generated_javascript,
    make_sine_bank,
    rms,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
MSEG_SOURCE = REPO_ROOT / "cmajor" / "Mseg.cmajor"
FIXED_FRAME_SOURCE = REPO_ROOT / "cmajor" / "FixedFrameOscillator.cmajor"
DISTORTION_SOURCE = REPO_ROOT / "cmajor" / "Distortion.cmajor"
WAVETABLE_SYNTH_SOURCE = REPO_ROOT / "cmajor" / "WavetableSynth.cmajor"
OSCILLATOR_MIP_COUNT = 11


def _note_on_expr(channel: int, pitch: float, velocity: float = 1.0) -> str:
    return f"std::notes::NoteOn ({int(channel)}, {float(pitch):.1f}f, {float(velocity):.3f}f)"


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


def _build_distortion_probe_source(scheduled_events: list[tuple[int, str]]) -> str:
    wavetable_support_source = WAVETABLE_SYNTH_SOURCE.read_text(encoding="utf-8").split(
        "graph WavetableSynth [[ main ]]",
        maxsplit=1,
    )[0]

    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + DISTORTION_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + wavetable_support_source
        + "\n"
        + _build_runtime_session_adapter_source()
        + _build_stereo_splitter_source()
        + _build_scheduler_source(scheduled_events)
        + "graph DistortionProbe [[ main ]]\n"
        + "{\n"
        + "    input event wt::WavetableLoadBegin wavetableLoadBegin;\n"
        + "    input event wt::WavetableMipFrame wavetableMipFrame;\n"
        + "    input value float32 framePosition [[ init: 0.0f ]];\n"
        + "    input value float32 glideTime [[ init: 0.0f ]];\n"
        + "    input value float32 pan [[ init: 0.0f ]];\n"
        + "    input value float32 warpMode [[ init: 0.0f ]];\n"
        + "    input value float32 warpAmount [[ init: 0.0f ]];\n"
        + "    input value float32 filterMode [[ init: 0.0f ]];\n"
        + "    input value float32 filterCutoff [[ init: 1000.0f ]];\n"
        + "    input value float32 filterQ [[ init: 0.707107f ]];\n"
        + "    input value float32 distortionDriveDb [[ init: 12.0f ]];\n"
        + "    input value float32 distortionKnee [[ init: 0.35f ]];\n"
        + "    input value float32 distortionWet [[ init: 0.0f ]];\n"
        + "    input value float32 distortionWetHPHz [[ init: 40.0f ]];\n"
        + "    input value float32 distortionWetLPHz [[ init: 18000.0f ]];\n"
        + "    output stream float leftOut;\n"
        + "    output stream float rightOut;\n"
        + "    output event wt::DistortionScopeFrame distortionScope;\n"
        + "    node scheduler = ScheduledEvents;\n"
        + "    node adapter = RuntimeSessionAdapter;\n"
        + "    node allocator = std::voices::VoiceAllocator (2);\n"
        + "    node engine = wt::SharedVoiceEngine (2);\n"
        + "    node trim = wt::StereoTrim (0.18f);\n"
        + "    node distortion = wt::DistortionBus;\n"
        + "    node scope = wt::DistortionScopeAnalyzer;\n"
        + "    node splitter = StereoSplitter;\n"
        + "    event wavetableLoadBegin (wt::WavetableLoadBegin load) { adapter.loadBeginIn <- load; }\n"
        + "    event wavetableMipFrame (wt::WavetableMipFrame frame) { adapter.mipFrameIn <- frame; }\n"
        + "    connection\n"
        + "    {\n"
        + "        scheduler.noteEventOut -> allocator.eventIn;\n"
        + "        allocator.voiceEventOut -> engine.voiceEventIn;\n"
        + "        adapter.loadBeginOut -> engine.wavetableLoadBeginIn;\n"
        + "        adapter.mipFrameOut -> engine.wavetableMipFrameIn;\n"
        + "        framePosition -> engine.framePositionIn;\n"
        + "        glideTime -> engine.glideTimeIn;\n"
        + "        pan -> engine.panIn;\n"
        + "        warpMode -> engine.warpModeIn;\n"
        + "        warpAmount -> engine.warpAmountIn;\n"
        + "        filterMode -> engine.filterModeIn;\n"
        + "        filterCutoff -> engine.filterCutoffIn;\n"
        + "        filterQ -> engine.filterQIn;\n"
        + "        engine.out -> trim.in;\n"
        + "        trim.out -> distortion.in;\n"
        + "        distortionDriveDb -> distortion.driveDbIn;\n"
        + "        distortionKnee -> distortion.kneeIn;\n"
        + "        distortionWet -> distortion.wetIn;\n"
        + "        distortionWetHPHz -> distortion.wetHPHzIn;\n"
        + "        distortionWetLPHz -> distortion.wetLPHzIn;\n"
        + "        distortion.previewInputLeft -> scope.previewInputLeft;\n"
        + "        distortion.previewInputRight -> scope.previewInputRight;\n"
        + "        distortion.previewOutputLeft -> scope.previewOutputLeft;\n"
        + "        distortion.previewOutputRight -> scope.previewOutputRight;\n"
        + "        distortion.out -> splitter.in;\n"
        + "        splitter.leftOut -> leftOut;\n"
        + "        splitter.rightOut -> rightOut;\n"
        + "        scope.distortionScope -> distortionScope;\n"
        + "    }\n"
        + "}\n"
    )


def _build_manifest(source_filename: str) -> dict[str, object]:
    return {
        "CmajorVersion": 1,
        "ID": "dev.cosimo.distortion-probe",
        "version": "1.0",
        "name": "Distortion Probe",
        "description": "Exercises the final synth bus distortion and scope endpoint",
        "category": "generator",
        "source": source_filename,
    }


def _build_setup_js(
    *,
    distortion_drive_db: float,
    distortion_knee: float,
    distortion_wet: float,
    distortion_wet_hp_hz: float = 40.0,
    distortion_wet_lp_hz: float = 18_000.0,
) -> str:
    bank = make_sine_bank()
    statements = [
        "patch.setInputValue_framePosition(0.0, 0);",
        "patch.setInputValue_glideTime(0.0, 0);",
        "patch.setInputValue_pan(0.0, 0);",
        "patch.setInputValue_warpMode(0.0, 0);",
        "patch.setInputValue_warpAmount(0.0, 0);",
        "patch.setInputValue_filterMode(0.0, 0);",
        "patch.setInputValue_filterCutoff(1000.0, 0);",
        "patch.setInputValue_filterQ(0.707107, 0);",
        f"patch.setInputValue_distortionDriveDb({float(distortion_drive_db):.6f}, 0);",
        f"patch.setInputValue_distortionKnee({float(distortion_knee):.6f}, 0);",
        f"patch.setInputValue_distortionWet({float(distortion_wet):.6f}, 0);",
        f"patch.setInputValue_distortionWetHPHz({float(distortion_wet_hp_hz):.6f}, 0);",
        f"patch.setInputValue_distortionWetLPHz({float(distortion_wet_lp_hz):.6f}, 0);",
        f"patch.sendInputEvent_wavetableLoadBegin({json.dumps(_build_load_begin_event(generation=11, table_index=0, frame_count=bank.num_frames))});",
    ]

    for event in _build_mip_frame_events(bank, generation=11, table_index=0):
        statements.append(f"patch.sendInputEvent_wavetableMipFrame({json.dumps(event)});")

    return "\n".join(statements)


def _render_probe_audio(
    scheduled_events: list[tuple[int, str]],
    *,
    setup_js: str,
    output_endpoint_id: str,
    num_samples: int,
) -> np.ndarray:
    with tempfile.TemporaryDirectory(prefix="distortion_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        probe_source_path = temp_dir / "DistortionProbe.cmajor"
        patch_path = temp_dir / "DistortionProbe.cmajorpatch"

        probe_source_path.write_text(
            _build_distortion_probe_source(scheduled_events),
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
    with tempfile.TemporaryDirectory(prefix="distortion_probe_events_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        probe_source_path = temp_dir / "DistortionProbe.cmajor"
        patch_path = temp_dir / "DistortionProbe.cmajorpatch"

        probe_source_path.write_text(
            _build_distortion_probe_source(scheduled_events),
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


def _max_event_field(events: list[dict[str, object]], field_name: str) -> float:
    def read_field(event: dict[str, object]) -> float:
        payload = event.get("event", event)
        if not isinstance(payload, dict):
            return 0.0
        return float(payload.get(field_name, 0.0))

    return max(read_field(event) for event in events)


@pytest.mark.cmajor
def test_distortion_wet_mix_changes_the_real_synth_bus_audio() -> None:
    schedule = [(0, _note_on_expr(1, 60.0, 1.0))]
    dry_setup = _build_setup_js(
        distortion_drive_db=24.0,
        distortion_knee=0.35,
        distortion_wet=0.0,
    )
    wet_setup = _build_setup_js(
        distortion_drive_db=24.0,
        distortion_knee=0.35,
        distortion_wet=1.0,
    )

    dry = _render_probe_audio(schedule, setup_js=dry_setup, output_endpoint_id="leftOut", num_samples=16_384)
    wet = _render_probe_audio(schedule, setup_js=wet_setup, output_endpoint_id="leftOut", num_samples=16_384)

    difference = wet - dry

    assert rms(dry) > 0.01
    assert rms(wet) > 0.01
    assert rms(difference) > 0.003, (
        f"Expected distortion wet mix to change the synth bus output. Difference RMS was {rms(difference):.6f}."
    )


@pytest.mark.cmajor
def test_distortion_scope_reports_more_removed_peak_as_drive_rises() -> None:
    schedule = [(0, _note_on_expr(1, 60.0, 1.0))]
    low_drive_events = _collect_probe_events(
        schedule,
        setup_js=_build_setup_js(
            distortion_drive_db=6.0,
            distortion_knee=0.35,
            distortion_wet=1.0,
        ),
        output_endpoint_id="distortionScope",
        num_samples=12_288,
    )
    high_drive_events = _collect_probe_events(
        schedule,
        setup_js=_build_setup_js(
            distortion_drive_db=24.0,
            distortion_knee=0.35,
            distortion_wet=1.0,
        ),
        output_endpoint_id="distortionScope",
        num_samples=12_288,
    )

    assert low_drive_events, "Expected low-drive distortion probe to emit at least one scope frame."
    assert high_drive_events, "Expected high-drive distortion probe to emit at least one scope frame."

    low_removed_peak = _max_event_field(low_drive_events, "removedPeak")
    high_removed_peak = _max_event_field(high_drive_events, "removedPeak")
    high_input_peak = _max_event_field(high_drive_events, "inputPeak")
    high_output_peak = _max_event_field(high_drive_events, "outputPeak")

    assert high_input_peak > 1.1, (
        f"Expected driven wet signal to exceed the shaper ceiling. inputPeak was {high_input_peak:.6f}."
    )
    assert high_output_peak <= 1.05, (
        f"Expected shaped wet output to stay near the normalized ceiling. outputPeak was {high_output_peak:.6f}."
    )
    assert high_removed_peak > low_removed_peak + 0.05, (
        f"Expected higher drive to remove more signal. low={low_removed_peak:.6f}, high={high_removed_peak:.6f}."
    )
