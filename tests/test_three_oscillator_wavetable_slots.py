from __future__ import annotations

import json
from pathlib import Path
import tempfile

import pytest

from bench import DEFAULT_SAMPLE_RATE, _collect_cmajor_output_events_via_generated_javascript


REPO_ROOT = Path(__file__).resolve().parents[1]
MSEG_SOURCE = REPO_ROOT / "cmajor" / "Mseg.cmajor"
FIXED_FRAME_SOURCE = REPO_ROOT / "cmajor" / "FixedFrameOscillator.cmajor"
VOICE_REDUCER_SOURCE = REPO_ROOT / "cmajor" / "VoiceReducer.cmajor"
MIP_LEVEL_COUNT = 11
SAMPLES_PER_FRAME = 2048


def _build_probe_source() -> str:
    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + VOICE_REDUCER_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + "processor RuntimeSessionAdapter\n"
        + "{\n"
        + "    input event wt::OscillatorWavetableLoadBegin loadBeginIn;\n"
        + "    input event wt::OscillatorWavetableMipFrame mipFrameIn;\n"
        + "    input event wt::WavetableLoadBegin legacyLoadBeginIn;\n"
        + "    input event wt::WavetableMipFrame legacyMipFrameIn;\n"
        + "    output event wt::OscillatorWavetableLoadBegin loadBeginOut;\n"
        + "    output event wt::OscillatorWavetableMipFrame mipFrameOut;\n"
        + "    output event wt::WavetableLoadBegin legacyLoadBeginOut;\n"
        + "    output event wt::WavetableMipFrame legacyMipFrameOut;\n"
        + "    event loadBeginIn (wt::OscillatorWavetableLoadBegin load)\n"
        + "    {\n"
        + "        wt::OscillatorWavetableLoadBegin rewritten = load;\n"
        + "        rewritten.dspSessionId = int32 (processor.session);\n"
        + "        loadBeginOut <- rewritten;\n"
        + "    }\n"
        + "    event mipFrameIn (wt::OscillatorWavetableMipFrame frame)\n"
        + "    {\n"
        + "        wt::OscillatorWavetableMipFrame rewritten = frame;\n"
        + "        rewritten.dspSessionId = int32 (processor.session);\n"
        + "        mipFrameOut <- rewritten;\n"
        + "    }\n"
        + "    event legacyLoadBeginIn (wt::WavetableLoadBegin load)\n"
        + "    {\n"
        + "        wt::WavetableLoadBegin rewritten = load;\n"
        + "        rewritten.dspSessionId = int32 (processor.session);\n"
        + "        legacyLoadBeginOut <- rewritten;\n"
        + "    }\n"
        + "    event legacyMipFrameIn (wt::WavetableMipFrame frame)\n"
        + "    {\n"
        + "        wt::WavetableMipFrame rewritten = frame;\n"
        + "        rewritten.dspSessionId = int32 (processor.session);\n"
        + "        legacyMipFrameOut <- rewritten;\n"
        + "    }\n"
        + "    void main() { loop { advance(); } }\n"
        + "}\n"
        + "graph ThreeOscillatorWavetableSlotProbe [[ main ]]\n"
        + "{\n"
        + "    input event wt::OscillatorWavetableLoadBegin loadBegin;\n"
        + "    input event wt::OscillatorWavetableMipFrame mipFrame;\n"
        + "    input event wt::WavetableLoadBegin legacyLoadBegin;\n"
        + "    input event wt::WavetableMipFrame legacyMipFrame;\n"
        + "    output event wt::OscillatorWavetableUploadAck uploadAck;\n"
        + "    output event wt::WavetableUploadAck legacyUploadAck;\n"
        + "    output event wt::WavetableSlotMonitor slotMonitor;\n"
        + "    node adapter = RuntimeSessionAdapter;\n"
        + "    node engine = wt::SharedVoiceEngine (1, 440.0f, 1);\n"
        + "    connection\n"
        + "    {\n"
        + "        loadBegin -> adapter.loadBeginIn;\n"
        + "        mipFrame -> adapter.mipFrameIn;\n"
        + "        legacyLoadBegin -> adapter.legacyLoadBeginIn;\n"
        + "        legacyMipFrame -> adapter.legacyMipFrameIn;\n"
        + "        adapter.loadBeginOut -> engine.oscillatorWavetableLoadBeginIn;\n"
        + "        adapter.mipFrameOut -> engine.oscillatorWavetableMipFrameIn;\n"
        + "        adapter.legacyLoadBeginOut -> engine.wavetableLoadBeginIn;\n"
        + "        adapter.legacyMipFrameOut -> engine.wavetableMipFrameIn;\n"
        + "        engine.oscillatorWavetableUploadAckOut -> uploadAck;\n"
        + "        engine.wavetableUploadAckOut -> legacyUploadAck;\n"
        + "        engine.wavetableSlotMonitorOut -> slotMonitor;\n"
        + "    }\n"
        + "}\n"
    )


def _load_begin(
    oscillator_index: int,
    generation: int,
    table_index: int,
    *,
    frame_count: int = 1,
) -> tuple[str, dict[str, int]]:
    return (
        "loadBegin",
        {
            "dspSessionId": 1,
            "oscillatorIndex": oscillator_index,
            "generation": generation,
            "tableIndex": table_index,
            "frameCount": frame_count,
        },
    )


def _mip_frame(
    oscillator_index: int,
    generation: int,
    table_index: int,
    mip_index: int,
    *,
    frame_index: int = 0,
    sample_value: float | None = None,
) -> tuple[str, dict[str, object]]:
    value = sample_value if sample_value is not None else 0.125 * float(oscillator_index + 1)
    return (
        "mipFrame",
        {
            "dspSessionId": 1,
            "oscillatorIndex": oscillator_index,
            "generation": generation,
            "tableIndex": table_index,
            "mipIndex": mip_index,
            "frameIndex": frame_index,
            "samples": [value] * SAMPLES_PER_FRAME,
        },
    )


def _legacy_load_begin(
    generation: int,
    table_index: int,
) -> tuple[str, dict[str, int]]:
    return (
        "legacyLoadBegin",
        {
            "dspSessionId": 1,
            "generation": generation,
            "tableIndex": table_index,
            "frameCount": 1,
        },
    )


def _legacy_mip_frame(
    generation: int,
    table_index: int,
    mip_index: int,
) -> tuple[str, dict[str, object]]:
    return (
        "legacyMipFrame",
        {
            "dspSessionId": 1,
            "generation": generation,
            "tableIndex": table_index,
            "mipIndex": mip_index,
            "frameIndex": 0,
            "samples": [0.125] * SAMPLES_PER_FRAME,
        },
    )


def _table_events(
    oscillator_index: int,
    generation: int,
    table_index: int,
    *,
    mip_count: int = MIP_LEVEL_COUNT,
) -> list[tuple[str, dict[str, object]]]:
    events: list[tuple[str, dict[str, object]]] = [
        _load_begin(oscillator_index, generation, table_index)
    ]
    events.extend(
        _mip_frame(oscillator_index, generation, table_index, mip_index)
        for mip_index in range(mip_count)
    )
    return events


def _collect_events(
    events: list[tuple[str, dict[str, object]]],
    *,
    output_endpoint_id: str,
) -> list[dict[str, object]]:
    setup_js = "\n".join(
        f"patch.sendInputEvent_{endpoint_id}({json.dumps(payload)});"
        for endpoint_id, payload in events
    )

    with tempfile.TemporaryDirectory(prefix="three_oscillator_slots_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        source_path = temp_dir / "ThreeOscillatorWavetableSlotProbe.cmajor"
        patch_path = temp_dir / "ThreeOscillatorWavetableSlotProbe.cmajorpatch"
        source_path.write_text(_build_probe_source(), encoding="utf-8")
        patch_path.write_text(
            json.dumps(
                {
                    "CmajorVersion": 1,
                    "ID": "dev.cosimo.three-oscillator-wavetable-slot-probe",
                    "version": "1.0",
                    "name": "Three Oscillator Wavetable Slot Probe",
                    "category": "generator",
                    "source": source_path.name,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        return _collect_cmajor_output_events_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=1,
            output_endpoint_id=output_endpoint_id,
            setup_js=setup_js,
        )


@pytest.mark.cmajor
def test_three_active_tables_and_one_rotating_loading_slot_are_isolated() -> None:
    events: list[tuple[str, dict[str, object]]] = []
    events += _table_events(0, 1, 10)
    events += _table_events(1, 1, 20)
    events += _table_events(2, 1, 30)
    events += _table_events(0, 2, 11)

    # A partial replacement is never visible; restarting the same generation
    # clears the loading slot and publishes only after the complete retry.
    events += _table_events(1, 2, 21, mip_count=MIP_LEVEL_COUNT - 1)
    events += _table_events(1, 2, 21)

    # This load is older than A's independent frontier and is ignored.
    events += _table_events(0, 1, 99)

    monitors = [entry["event"] for entry in _collect_events(events, output_endpoint_id="slotMonitor")]

    assert monitors == [
        {"oscillatorIndex": 0, "activeSlotIndex": 0, "tableIndex": 10, "generation": 1},
        {"oscillatorIndex": 1, "activeSlotIndex": 1, "tableIndex": 20, "generation": 1},
        {"oscillatorIndex": 2, "activeSlotIndex": 2, "tableIndex": 30, "generation": 1},
        {"oscillatorIndex": 0, "activeSlotIndex": 3, "tableIndex": 11, "generation": 2},
        {"oscillatorIndex": 1, "activeSlotIndex": 0, "tableIndex": 21, "generation": 2},
    ]

    final_by_oscillator = {int(event["oscillatorIndex"]): event for event in monitors}
    assert {int(event["activeSlotIndex"]) for event in final_by_oscillator.values()} == {0, 2, 3}


@pytest.mark.cmajor
def test_crossed_malformed_and_preempted_uploads_cannot_publish_or_ack() -> None:
    events: list[tuple[str, dict[str, object]]] = [
        _load_begin(1, 1, 20),
        _mip_frame(1, 1, 20, 0),
        _mip_frame(2, 1, 20, 1),
        _mip_frame(1, 2, 20, 1),
        _mip_frame(1, 1, 21, 1),
        _mip_frame(1, 1, 20, MIP_LEVEL_COUNT),
        _mip_frame(1, 1, 20, 1, frame_index=1),
        _mip_frame(1, 1, 20, 1, sample_value=float("nan")),
        _load_begin(2, 1, 30),
        _load_begin(0, 1, 10, frame_count=2),
    ]

    # B's remaining frames arrive after C preempts its partial load. They must
    # neither acknowledge nor finish B. C's valid upload remains current.
    events.extend(_mip_frame(1, 1, 20, mip_index) for mip_index in range(1, MIP_LEVEL_COUNT))
    events.extend(_mip_frame(2, 1, 30, mip_index) for mip_index in range(MIP_LEVEL_COUNT))

    acknowledgements = [
        entry["event"] for entry in _collect_events(events, output_endpoint_id="uploadAck")
    ]
    monitors = [entry["event"] for entry in _collect_events(events, output_endpoint_id="slotMonitor")]

    assert acknowledgements[0] == {
        "dspSessionId": acknowledgements[0]["dspSessionId"],
        "oscillatorIndex": 1,
        "generation": 1,
        "tableIndex": 20,
        "mipIndex": 0,
        "frameIndex": 0,
    }
    assert int(acknowledgements[0]["dspSessionId"]) > 0
    assert len(acknowledgements) == MIP_LEVEL_COUNT + 1
    assert all(
        acknowledgement["oscillatorIndex"] == 2
        and acknowledgement["generation"] == 1
        and acknowledgement["tableIndex"] == 30
        for acknowledgement in acknowledgements[1:]
    )
    assert monitors == [
        {"oscillatorIndex": 2, "activeSlotIndex": 0, "tableIndex": 30, "generation": 1}
    ]


@pytest.mark.cmajor
def test_scalar_and_indexed_a_transports_share_one_guarded_frontier() -> None:
    events: list[tuple[str, dict[str, object]]] = [
        _load_begin(0, 2, 20),
        _mip_frame(0, 2, 20, 0),
        _legacy_load_begin(3, 30),
    ]
    # Indexed frames from the preempted generation cannot advance or publish
    # the scalar-A replacement now in flight.
    events.extend(_mip_frame(0, 2, 20, mip_index) for mip_index in range(1, MIP_LEVEL_COUNT))
    events.extend(_legacy_mip_frame(3, 30, mip_index) for mip_index in range(MIP_LEVEL_COUNT))
    # Once generation 3 is active, either transport must reject generation 2.
    events += _table_events(0, 2, 99)

    indexed_acknowledgements = [
        entry["event"] for entry in _collect_events(events, output_endpoint_id="uploadAck")
    ]
    legacy_acknowledgements = [
        entry["event"] for entry in _collect_events(events, output_endpoint_id="legacyUploadAck")
    ]
    monitors = [entry["event"] for entry in _collect_events(events, output_endpoint_id="slotMonitor")]

    assert len(indexed_acknowledgements) == MIP_LEVEL_COUNT + 1
    assert indexed_acknowledgements[0]["generation"] == 2
    assert all(
        acknowledgement["oscillatorIndex"] == 0
        and acknowledgement["generation"] == 3
        and acknowledgement["tableIndex"] == 30
        for acknowledgement in indexed_acknowledgements[1:]
    )
    assert len(legacy_acknowledgements) == MIP_LEVEL_COUNT + 1
    assert legacy_acknowledgements[0]["generation"] == 2
    assert all(
        acknowledgement["generation"] == 3
        and acknowledgement["tableIndex"] == 30
        for acknowledgement in legacy_acknowledgements[1:]
    )
    assert monitors == [
        {"oscillatorIndex": 0, "activeSlotIndex": 0, "tableIndex": 30, "generation": 3}
    ]
