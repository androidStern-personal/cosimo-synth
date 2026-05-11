from __future__ import annotations

import json
from pathlib import Path
import tempfile

import numpy as np
import pytest

from bench import DEFAULT_SAMPLE_RATE, _render_cmajor_patch_via_generated_javascript, make_sine_bank, rms
from test_modulation_matrix_probe import (
    OSCILLATOR_MIP_COUNT,
    _build_mip_frame_events,
    _build_load_begin_event,
    _note_on_expr,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
MSEG_SOURCE = REPO_ROOT / "cmajor" / "Mseg.cmajor"
FIXED_FRAME_SOURCE = REPO_ROOT / "cmajor" / "FixedFrameOscillator.cmajor"


def _build_scheduler_source(events: list[tuple[int, str]]) -> str:
    statements = [
        "            if (frameCounter == "
        + str(int(frame_index))
        + ")\n"
        + "                noteEventOut <- "
        + expression
        + ";"
        for frame_index, expression in events
    ]

    return (
        "processor ScheduledUnisonEvents\n"
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
        + "\n".join(statements)
        + "\n"
        + "            frameCounter += 1;\n"
        + "            advance();\n"
        + "        }\n"
        + "    }\n"
        + "}\n"
    )


def _build_probe_source(events: list[tuple[int, str]], *, voice_count: int = 2) -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
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
        + "    void main() { loop { advance(); } }\n"
        + "}\n"
        + "processor StereoSplitter\n"
        + "{\n"
        + "    input stream float32<2> in;\n"
        + "    output stream float32 leftOut;\n"
        + "    output stream float32 rightOut;\n"
        + "    void main() { loop { leftOut <- in[0]; rightOut <- in[1]; advance(); } }\n"
        + "}\n"
        + _build_scheduler_source(events)
        + "graph UnisonProbe [[ main ]]\n"
        + "{\n"
        + "    input event wt::WavetableLoadBegin wavetableLoadBegin;\n"
        + "    input event wt::WavetableMipFrame wavetableMipFrame;\n"
        + "    input event int32 modulationClear;\n"
        + "    input event int32 modulationEnable;\n"
        + "    input event wt::ModulationRouteUpload modulationRoute;\n"
        + "    input value float32 unisonVoices [[ init: 1.0f ]];\n"
        + "    input value float32 unisonDetune [[ init: 0.1f ]];\n"
        + "    input value float32 unisonBlend [[ init: 0.75f ]];\n"
        + "    input value float32 unisonWidth [[ init: 1.0f ]];\n"
        + "    input value float32 unisonWavetablePositionSpread [[ init: 0.0f ]];\n"
        + "    input value float32 unisonWarpSpread [[ init: 0.0f ]];\n"
        + "    input value float32 warpMode [[ init: 0.0f ]];\n"
        + "    input value float32 warpAmount [[ init: 0.0f ]];\n"
        + "    output stream float leftOut;\n"
        + "    output stream float rightOut;\n"
        + "    node scheduler = ScheduledUnisonEvents;\n"
        + "    node adapter = RuntimeSessionAdapter;\n"
        + f"    node allocator = std::voices::VoiceAllocator ({int(voice_count)});\n"
        + f"    node engine = wt::SharedVoiceEngine ({int(voice_count)});\n"
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
        + "        modulationRoute -> engine.modulationRouteIn;\n"
        + "        unisonVoices -> engine.unisonVoicesIn;\n"
        + "        unisonDetune -> engine.unisonDetuneIn;\n"
        + "        unisonBlend -> engine.unisonBlendIn;\n"
        + "        unisonWidth -> engine.unisonWidthIn;\n"
        + "        unisonWavetablePositionSpread -> engine.unisonWavetablePositionSpreadIn;\n"
        + "        unisonWarpSpread -> engine.unisonWarpSpreadIn;\n"
        + "        warpMode -> engine.warpModeIn;\n"
        + "        warpAmount -> engine.warpAmountIn;\n"
        + "        engine.out -> splitter.in;\n"
        + "        splitter.leftOut -> leftOut;\n"
        + "        splitter.rightOut -> rightOut;\n"
        + "    }\n"
        + "}\n"
    )


def _build_manifest(source_filename: str) -> dict[str, object]:
    return {
        "CmajorVersion": 1,
        "ID": "dev.cosimo.unison-probe",
        "version": "1.0",
        "name": "Unison Probe",
        "description": "Exercises SharedVoiceEngine unison sub-voices",
        "category": "generator",
        "source": source_filename,
    }


def _build_setup_js(
    *,
    unison_voices: int = 1,
    unison_detune: float = 0.1,
    unison_blend: float = 0.75,
    unison_width: float = 1.0,
    unison_wavetable_position_spread: float = 0.0,
    unison_warp_spread: float = 0.0,
    warp_mode: float = 0.0,
    warp_amount: float = 0.0,
    extra_events: list[tuple[str, dict[str, object]]] | None = None,
) -> str:
    bank = make_sine_bank()
    statements = [
        f"patch.setInputValue_unisonVoices({float(unison_voices):.6f}, 0);",
        f"patch.setInputValue_unisonDetune({float(unison_detune):.6f}, 0);",
        f"patch.setInputValue_unisonBlend({float(unison_blend):.6f}, 0);",
        f"patch.setInputValue_unisonWidth({float(unison_width):.6f}, 0);",
        f"patch.setInputValue_unisonWavetablePositionSpread({float(unison_wavetable_position_spread):.6f}, 0);",
        f"patch.setInputValue_unisonWarpSpread({float(unison_warp_spread):.6f}, 0);",
        f"patch.setInputValue_warpMode({float(warp_mode):.6f}, 0);",
        f"patch.setInputValue_warpAmount({float(warp_amount):.6f}, 0);",
        f"patch.sendInputEvent_wavetableLoadBegin({json.dumps(_build_load_begin_event(generation=19, table_index=0, frame_count=bank.num_frames))});",
    ]

    assert OSCILLATOR_MIP_COUNT == 11
    for event in _build_mip_frame_events(bank, generation=19, table_index=0):
        statements.append(f"patch.sendInputEvent_wavetableMipFrame({json.dumps(event)});")

    for endpoint_id, payload in extra_events or []:
        statements.append(f"patch.sendInputEvent_{endpoint_id}({json.dumps(payload)});")

    return "\n".join(statements)


def _render_probe(
    events: list[tuple[int, str]],
    *,
    setup_js: str,
    output_endpoint_id: str,
    num_samples: int = 32_768,
    voice_count: int = 2,
) -> np.ndarray:
    with tempfile.TemporaryDirectory(prefix="unison_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        source_path = temp_dir / "UnisonProbe.cmajor"
        patch_path = temp_dir / "UnisonProbe.cmajorpatch"

        source_path.write_text(_build_probe_source(events, voice_count=voice_count), encoding="utf-8")
        patch_path.write_text(json.dumps(_build_manifest(source_path.name), indent=2) + "\n", encoding="utf-8")

        return _render_cmajor_patch_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=num_samples,
            output_endpoint_id=output_endpoint_id,
            setup_js=setup_js,
        )


@pytest.mark.cmajor
def test_unison_one_preserves_existing_single_oscillator_path() -> None:
    schedule = [(1024, _note_on_expr(1, 60.0, 1.0))]
    base_setup = _build_setup_js(unison_voices=1, unison_detune=0.1, unison_blend=0.75, unison_width=1.0)
    extreme_setup = _build_setup_js(unison_voices=1, unison_detune=1.0, unison_blend=0.0, unison_width=0.0)

    base = _render_probe(schedule, setup_js=base_setup, output_endpoint_id="leftOut")
    extreme = _render_probe(schedule, setup_js=extreme_setup, output_endpoint_id="leftOut")

    np.testing.assert_allclose(extreme[2048:], base[2048:], atol=1e-6, rtol=1e-6)


@pytest.mark.cmajor
def test_unison_subvoices_do_not_consume_polyphonic_voice_allocations() -> None:
    schedule = [
        (1024, _note_on_expr(1, 60.0, 1.0)),
        (2048, _note_on_expr(1, 67.0, 1.0)),
    ]
    setup_js = _build_setup_js(unison_voices=8, unison_detune=0.08, unison_blend=0.75, unison_width=0.0)

    left = _render_probe(schedule, setup_js=setup_js, output_endpoint_id="leftOut", num_samples=65_536)
    tail = left[16_384:]
    spectrum = np.abs(np.fft.rfft(tail * np.hanning(tail.size)))
    freqs = np.fft.rfftfreq(tail.size, 1 / DEFAULT_SAMPLE_RATE)
    c4_energy = spectrum[(freqs > 250) & (freqs < 270)].max()
    g4_energy = spectrum[(freqs > 385) & (freqs < 405)].max()

    assert c4_energy > 10.0
    assert g4_energy > 10.0


@pytest.mark.cmajor
def test_maximum_polyphony_times_maximum_unison_renders_finite_audio() -> None:
    schedule = [
        (128 + note_index, _note_on_expr(1, 48.0 + float(note_index), 0.35))
        for note_index in range(16)
    ]
    setup_js = _build_setup_js(
        unison_voices=8,
        unison_detune=0.18,
        unison_blend=0.72,
        unison_width=1.0,
        unison_wavetable_position_spread=0.25,
        unison_warp_spread=0.25,
        warp_mode=1.0,
        warp_amount=0.25,
    )

    left = _render_probe(
        schedule,
        setup_js=setup_js,
        output_endpoint_id="leftOut",
        num_samples=4096,
        voice_count=16,
    )
    tail = left[1024:]

    assert np.all(np.isfinite(tail))
    assert rms(tail) > 0.001
    assert np.max(np.abs(tail)) < 16.0


@pytest.mark.cmajor
def test_modulation_can_drive_unison_width() -> None:
    schedule = [(1024, _note_on_expr(1, 60.0, 1.0))]
    route = {
        "routeIndex": 0,
        "enabled": True,
        "sourceKind": 3,
        "sourceSlot": 0,
        "polarityKind": 0,
        "targetKind": 10,
        "amount": 1.0,
    }
    setup_js = _build_setup_js(
        unison_voices=4,
        unison_detune=0.25,
        unison_blend=0.75,
        unison_width=0.0,
        extra_events=[("modulationClear", 1), ("modulationRoute", route), ("modulationEnable", 1)],
    )

    left = _render_probe(schedule, setup_js=setup_js, output_endpoint_id="leftOut")
    right = _render_probe(schedule, setup_js=setup_js, output_endpoint_id="rightOut")

    assert rms(left - right) > 0.002


@pytest.mark.cmajor
def test_unison_warp_spread_warps_subvoices_when_base_warp_is_identity() -> None:
    schedule = [(1024, _note_on_expr(1, 60.0, 1.0))]
    base_setup = _build_setup_js(
        unison_voices=3,
        unison_detune=0.0,
        unison_blend=1.0,
        unison_width=0.0,
        warp_mode=1.0,
        warp_amount=0.0,
        unison_warp_spread=0.0,
    )
    spread_setup = _build_setup_js(
        unison_voices=3,
        unison_detune=0.0,
        unison_blend=1.0,
        unison_width=0.0,
        warp_mode=1.0,
        warp_amount=0.0,
        unison_warp_spread=1.0,
    )

    base = _render_probe(schedule, setup_js=base_setup, output_endpoint_id="leftOut")
    spread = _render_probe(schedule, setup_js=spread_setup, output_endpoint_id="leftOut")

    assert rms(spread[4096:] - base[4096:]) > 0.001
