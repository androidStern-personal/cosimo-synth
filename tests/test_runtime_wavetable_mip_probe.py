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
    _collect_cmajor_output_events_via_generated_javascript,
    _render_cmajor_patch_via_generated_javascript,
    formula_mip_index_for_frequency,
    make_blend2_bank,
    make_sine_bank,
    make_static_tone_recipe,
    render_bank_reference,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
MSEG_SOURCE = REPO_ROOT / "cmajor" / "Mseg.cmajor"
FIXED_FRAME_OSCILLATOR_SOURCE = REPO_ROOT / "cmajor" / "FixedFrameOscillator.cmajor"
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


def _build_runtime_probe_source(*, initial_frequency_hz: float, frame_position: float) -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_OSCILLATOR_SOURCE.read_text(encoding="utf-8")
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
        + "processor RuntimeMipProbeControl\n"
        + "{\n"
        + "    output event float32 frequencyOut;\n"
        + "    output stream float32 framePositionOut;\n"
        + "    bool hasSentFrequency = false;\n"
        + "    void main()\n"
        + "    {\n"
        + "        loop\n"
        + "        {\n"
        + "            if (! hasSentFrequency)\n"
        + "            {\n"
        + "                frequencyOut <- "
        + repr(np.float32(initial_frequency_hz).item())
        + "f;\n"
        + "                hasSentFrequency = true;\n"
        + "            }\n"
        + "            framePositionOut <- "
        + repr(np.float32(frame_position).item())
        + "f;\n"
        + "            advance();\n"
        + "        }\n"
        + "    }\n"
        + "}\n"
        + "graph RuntimeMipProbe [[ main ]]\n"
        + "{\n"
        + "    input event wt::WavetableLoadBegin wavetableLoadBegin;\n"
        + "    input event wt::WavetableMipFrame wavetableMipFrame;\n"
        + "    output event wt::WavetableUploadAck wavetableUploadAck;\n"
        + "    output event wt::WavetableMipRequest wavetableMipRequest;\n"
        + "    output stream float out;\n"
        + "    node control = RuntimeMipProbeControl;\n"
        + "    node adapter = RuntimeSessionAdapter;\n"
        + "    node osc = wt::FixedFrameOscillator ("
        + repr(np.float32(initial_frequency_hz).item())
        + "f, 0.0f);\n"
        + "    event wavetableLoadBegin (wt::WavetableLoadBegin load) { adapter.loadBeginIn <- load; }\n"
        + "    event wavetableMipFrame (wt::WavetableMipFrame frame) { adapter.mipFrameIn <- frame; }\n"
        + "    connection\n"
        + "    {\n"
        + "        control.frequencyOut -> osc.frequencyIn;\n"
        + "        adapter.loadBeginOut -> osc.wavetableLoadBeginIn;\n"
        + "        adapter.mipFrameOut -> osc.wavetableMipFrameIn;\n"
        + "        control.framePositionOut -> osc.framePositionIn;\n"
        + "        osc.wavetableUploadAckOut -> wavetableUploadAck;\n"
        + "        osc.wavetableMipRequestOut -> wavetableMipRequest;\n"
        + "        osc.out -> out;\n"
        + "    }\n"
        + "}\n"
    )


def _build_runtime_protocol_probe_source(*, initial_frequency_hz: float) -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_OSCILLATOR_SOURCE.read_text(encoding="utf-8")
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
        + "namespace probe\n"
        + "{\n"
        + "    struct RuntimeProtocolSnapshot\n"
        + "    {\n"
        + "        int32 controlSessionId;\n"
        + "        int32 requestSessionId;\n"
        + "        int32 generation;\n"
        + "        int32 tableIndex;\n"
        + "        int32 mipIndex;\n"
        + "        int32 urgencyLevel;\n"
        + "    }\n"
        + "}\n"
        + "processor RuntimeProtocolProbeControl\n"
        + "{\n"
        + "    output event float32 frequencyOut;\n"
        + "    bool hasSentFrequency = false;\n"
        + "    void main()\n"
        + "    {\n"
        + "        loop\n"
        + "        {\n"
        + "            if (! hasSentFrequency)\n"
        + "            {\n"
        + "                frequencyOut <- "
        + repr(np.float32(initial_frequency_hz).item())
        + "f;\n"
        + "                hasSentFrequency = true;\n"
        + "            }\n"
        + "            advance();\n"
        + "        }\n"
        + "    }\n"
        + "}\n"
        + "processor RuntimeProtocolSnapshotReporter\n"
        + "{\n"
        + "    input event wt::WavetableMipRequest requestIn;\n"
        + "    output event probe::RuntimeProtocolSnapshot snapshotOut;\n"
        + "    event requestIn (wt::WavetableMipRequest request)\n"
        + "    {\n"
        + "        probe::RuntimeProtocolSnapshot snapshot;\n"
        + "        snapshot.controlSessionId = int32 (processor.session);\n"
        + "        snapshot.requestSessionId = request.dspSessionId;\n"
        + "        snapshot.generation = request.generation;\n"
        + "        snapshot.tableIndex = request.tableIndex;\n"
        + "        snapshot.mipIndex = request.mipIndex;\n"
        + "        snapshot.urgencyLevel = request.urgencyLevel;\n"
        + "        snapshotOut <- snapshot;\n"
        + "    }\n"
        + "    void main()\n"
        + "    {\n"
        + "        loop\n"
        + "        {\n"
        + "            advance();\n"
        + "        }\n"
        + "    }\n"
        + "}\n"
        + "graph RuntimeProtocolProbe [[ main ]]\n"
        + "{\n"
        + "    input event wt::WavetableLoadBegin wavetableLoadBegin;\n"
        + "    input event wt::WavetableMipFrame wavetableMipFrame;\n"
        + "    output event wt::WavetableUploadAck wavetableUploadAck;\n"
        + "    output event wt::WavetableMipRequest wavetableMipRequest;\n"
        + "    output event probe::RuntimeProtocolSnapshot runtimeProtocolSnapshot;\n"
        + "    output stream float out;\n"
        + "    node control = RuntimeProtocolProbeControl;\n"
        + "    node adapter = RuntimeSessionAdapter;\n"
        + "    node osc = wt::FixedFrameOscillator ("
        + repr(np.float32(initial_frequency_hz).item())
        + "f, 0.0f);\n"
        + "    node reporter = RuntimeProtocolSnapshotReporter;\n"
        + "    event wavetableLoadBegin (wt::WavetableLoadBegin load) { adapter.loadBeginIn <- load; }\n"
        + "    event wavetableMipFrame (wt::WavetableMipFrame frame) { adapter.mipFrameIn <- frame; }\n"
        + "    connection\n"
        + "    {\n"
        + "        control.frequencyOut -> osc.frequencyIn;\n"
        + "        adapter.loadBeginOut -> osc.wavetableLoadBeginIn;\n"
        + "        adapter.mipFrameOut -> osc.wavetableMipFrameIn;\n"
        + "        osc.wavetableUploadAckOut -> wavetableUploadAck;\n"
        + "        osc.wavetableMipRequestOut -> wavetableMipRequest;\n"
        + "        osc.wavetableMipRequestOut -> reporter.requestIn;\n"
        + "        reporter.snapshotOut -> runtimeProtocolSnapshot;\n"
        + "        osc.out -> out;\n"
        + "    }\n"
        + "}\n"
    )


def _build_runtime_probe_manifest(source_filename: str) -> dict[str, object]:
    return {
        "CmajorVersion": 1,
        "ID": "dev.cosimo.runtime-mip-probe",
        "version": "1.0",
        "name": "Runtime Mip Probe",
        "description": "Exercises the checked-in runtime mip upload oscillator",
        "category": "generator",
        "source": source_filename,
    }


def _with_runtime_protocol_probe(
    *,
    initial_frequency_hz: float,
    callback,
):
    with tempfile.TemporaryDirectory(prefix="runtime_protocol_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        probe_source_path = temp_dir / "RuntimeProtocolProbe.cmajor"
        patch_path = temp_dir / "RuntimeProtocolProbe.cmajorpatch"

        probe_source_path.write_text(
            _build_runtime_protocol_probe_source(
                initial_frequency_hz=initial_frequency_hz,
            ),
            encoding="utf-8",
        )
        patch_path.write_text(
            json.dumps(_build_runtime_probe_manifest(probe_source_path.name), indent=2) + "\n",
            encoding="utf-8",
        )
        return callback(patch_path)


def _with_runtime_probe(
    *,
    initial_frequency_hz: float,
    frame_position: float,
    callback,
):
    with tempfile.TemporaryDirectory(prefix="runtime_mip_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        probe_source_path = temp_dir / "RuntimeMipProbe.cmajor"
        patch_path = temp_dir / "RuntimeMipProbe.cmajorpatch"

        probe_source_path.write_text(
            _build_runtime_probe_source(
                initial_frequency_hz=initial_frequency_hz,
                frame_position=frame_position,
            ),
            encoding="utf-8",
        )
        patch_path.write_text(
            json.dumps(_build_runtime_probe_manifest(probe_source_path.name), indent=2) + "\n",
            encoding="utf-8",
        )
        return callback(patch_path)


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
    mip_indices: tuple[int, ...],
) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []

    for mip_index in mip_indices:
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


def _unwrap_event_payloads(events: list[dict[str, object]]) -> list[dict[str, object]]:
    return [event["event"] for event in events]


@pytest.mark.cmajor
def test_runtime_oscillator_requests_the_demanded_mip_after_load_begin() -> None:
    frequency_hz = 440.0
    expected_mip_index = formula_mip_index_for_frequency(frequency_hz, DEFAULT_SAMPLE_RATE)

    def run_probe(patch_path: Path) -> list[dict[str, object]]:
        return _collect_cmajor_output_events_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=8,
            output_endpoint_id="wavetableMipRequest",
            setup_js=_build_setup_js(
                [
                    (
                        "wavetableLoadBegin",
                        _build_load_begin_event(generation=3, table_index=9, frame_count=1),
                    )
                ]
            ),
        )

    events = _with_runtime_probe(
        initial_frequency_hz=frequency_hz,
        frame_position=0.0,
        callback=run_probe,
    )

    payloads = _unwrap_event_payloads(events)

    assert payloads
    assert payloads[0]["generation"] == 3
    assert payloads[0]["tableIndex"] == 9
    assert payloads[0]["mipIndex"] == expected_mip_index
    assert payloads[0]["dspSessionId"] > 0
    assert payloads[0]["urgencyLevel"] == 2


@pytest.mark.cmajor
def test_runtime_oscillator_emits_session_scoped_mip_requests_with_urgency() -> None:
    frequency_hz = 440.0
    expected_mip_index = formula_mip_index_for_frequency(frequency_hz, DEFAULT_SAMPLE_RATE)

    def run_probe(patch_path: Path) -> list[dict[str, object]]:
        return _collect_cmajor_output_events_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=8,
            output_endpoint_id="runtimeProtocolSnapshot",
            setup_js=_build_setup_js(
                [
                    (
                        "wavetableLoadBegin",
                        _build_load_begin_event(generation=3, table_index=9, frame_count=1),
                    )
                ]
            ),
        )

    events = _with_runtime_protocol_probe(
        initial_frequency_hz=frequency_hz,
        callback=run_probe,
    )

    payloads = _unwrap_event_payloads(events)

    assert payloads
    assert payloads[0]["generation"] == 3
    assert payloads[0]["tableIndex"] == 9
    assert payloads[0]["mipIndex"] == expected_mip_index
    assert payloads[0]["requestSessionId"] == payloads[0]["controlSessionId"]
    assert payloads[0]["requestSessionId"] > 0
    assert payloads[0]["urgencyLevel"] == 2


@pytest.mark.cmajor
def test_runtime_oscillator_escalates_to_urgency_one_when_a_darker_mip_is_playable() -> None:
    bank = make_sine_bank()
    frequency_hz = 4000.0
    requested_mip_index = formula_mip_index_for_frequency(frequency_hz, DEFAULT_SAMPLE_RATE)
    darker_playable_mip_index = max(0, requested_mip_index - 2)
    darker_events = _build_mip_frame_events(
        bank,
        generation=6,
        table_index=4,
        mip_indices=(darker_playable_mip_index,),
    )

    def run_probe(patch_path: Path) -> list[dict[str, object]]:
        return _collect_cmajor_output_events_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=8,
            output_endpoint_id="wavetableMipRequest",
            setup_js=_build_setup_js(
                [
                    (
                        "wavetableLoadBegin",
                        _build_load_begin_event(generation=6, table_index=4, frame_count=1),
                    ),
                    ("wavetableMipFrame", darker_events[0]),
                ]
            ),
        )

    events = _with_runtime_protocol_probe(
        initial_frequency_hz=frequency_hz,
        callback=run_probe,
    )

    payloads = _unwrap_event_payloads(events)

    assert payloads
    assert payloads[-1]["generation"] == 6
    assert payloads[-1]["tableIndex"] == 4
    assert payloads[-1]["mipIndex"] == requested_mip_index
    assert payloads[-1]["dspSessionId"] > 0
    assert payloads[-1]["urgencyLevel"] == 1


@pytest.mark.cmajor
def test_runtime_oscillator_rejects_older_load_generations_after_accepting_a_newer_one() -> None:
    bank = make_sine_bank()
    current_mip_index = formula_mip_index_for_frequency(220.0, DEFAULT_SAMPLE_RATE)
    current_events = _build_mip_frame_events(
        bank,
        generation=5,
        table_index=1,
        mip_indices=(current_mip_index,),
    )

    def run_probe(patch_path: Path) -> list[dict[str, object]]:
        setup_events = [
            ("wavetableLoadBegin", _build_load_begin_event(generation=5, table_index=1, frame_count=1)),
            ("wavetableLoadBegin", _build_load_begin_event(generation=4, table_index=2, frame_count=1)),
            ("wavetableMipFrame", current_events[0]),
        ]
        return _collect_cmajor_output_events_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=8,
            output_endpoint_id="wavetableUploadAck",
            setup_js=_build_setup_js(setup_events),
        )

    ack_events = _with_runtime_probe(
        initial_frequency_hz=220.0,
        frame_position=0.0,
        callback=run_probe,
    )

    payloads = _unwrap_event_payloads(ack_events)

    assert len(payloads) == 1
    assert payloads[0]["generation"] == 5
    assert payloads[0]["tableIndex"] == 1
    assert payloads[0]["mipIndex"] == current_mip_index
    assert payloads[0]["frameIndex"] == 0
    assert payloads[0]["dspSessionId"] > 0


@pytest.mark.cmajor
def test_runtime_oscillator_acknowledges_only_current_generation_mip_frames() -> None:
    bank = make_sine_bank()
    current_mip_index = formula_mip_index_for_frequency(220.0, DEFAULT_SAMPLE_RATE)
    stale_events = _build_mip_frame_events(
        bank,
        generation=4,
        table_index=1,
        mip_indices=(current_mip_index,),
    )
    current_events = _build_mip_frame_events(
        bank,
        generation=5,
        table_index=1,
        mip_indices=(current_mip_index,),
    )

    def run_probe(patch_path: Path) -> list[dict[str, object]]:
        setup_events = [
            ("wavetableLoadBegin", _build_load_begin_event(generation=4, table_index=1, frame_count=1)),
            ("wavetableLoadBegin", _build_load_begin_event(generation=5, table_index=1, frame_count=1)),
            ("wavetableMipFrame", stale_events[0]),
            ("wavetableMipFrame", current_events[0]),
        ]
        return _collect_cmajor_output_events_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=8,
            output_endpoint_id="wavetableUploadAck",
            setup_js=_build_setup_js(setup_events),
        )

    ack_events = _with_runtime_probe(
        initial_frequency_hz=220.0,
        frame_position=0.0,
        callback=run_probe,
    )

    payloads = _unwrap_event_payloads(ack_events)

    assert len(payloads) == 1
    assert payloads[0]["generation"] == 5
    assert payloads[0]["tableIndex"] == 1
    assert payloads[0]["mipIndex"] == current_mip_index
    assert payloads[0]["frameIndex"] == 0
    assert payloads[0]["dspSessionId"] > 0


@pytest.mark.cmajor
def test_runtime_oscillator_matches_reference_after_loading_all_mips() -> None:
    bank = make_blend2_bank()
    recipe = make_static_tone_recipe(
        name="runtime_mip_blend2",
        duration_seconds=256 / DEFAULT_SAMPLE_RATE,
        frequency_hz=4000.0,
        frame_position=0.35,
    )
    demanded_mip_index = formula_mip_index_for_frequency(
        float(recipe.freq_hz_curve[0]),
        recipe.sample_rate,
    )
    setup_events = [
        ("wavetableLoadBegin", _build_load_begin_event(generation=7, table_index=0, frame_count=bank.num_frames)),
    ]
    setup_events.extend(
        ("wavetableMipFrame", event)
        for event in _build_mip_frame_events(
            bank,
            generation=7,
            table_index=0,
            mip_indices=(demanded_mip_index,),
        )
    )

    def render_probe(patch_path: Path) -> np.ndarray:
        return _render_cmajor_patch_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=recipe.sample_rate,
            num_samples=recipe.num_samples,
            setup_js=_build_setup_js(list(setup_events)),
        )

    actual = _with_runtime_probe(
        initial_frequency_hz=recipe.freq_hz_curve[0],
        frame_position=recipe.frame_pos_curve[0],
        callback=render_probe,
    )
    expected = render_bank_reference([bank], recipe)

    assert_allclose(actual, expected, atol=1e-5, rtol=0.0)
