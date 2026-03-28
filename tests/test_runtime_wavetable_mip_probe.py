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
        FIXED_FRAME_OSCILLATOR_SOURCE.read_text(encoding="utf-8")
        + "\n"
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
        + "    node osc = wt::FixedFrameOscillator ("
        + repr(np.float32(initial_frequency_hz).item())
        + "f, 0.0f);\n"
        + "    event wavetableLoadBegin (wt::WavetableLoadBegin load) { osc.wavetableLoadBeginIn <- load; }\n"
        + "    event wavetableMipFrame (wt::WavetableMipFrame frame) { osc.wavetableMipFrameIn <- frame; }\n"
        + "    connection\n"
        + "    {\n"
        + "        control.frequencyOut -> osc.frequencyIn;\n"
        + "        control.framePositionOut -> osc.framePositionIn;\n"
        + "        osc.wavetableUploadAckOut -> wavetableUploadAck;\n"
        + "        osc.wavetableMipRequestOut -> wavetableMipRequest;\n"
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


def _build_load_begin_event(*, generation: int, table_index: int, frame_count: int) -> dict[str, int]:
    return {
        "generation": int(generation),
        "tableIndex": int(table_index),
        "frameCount": int(frame_count),
    }


def _build_mip_frame_events(
    bank,
    *,
    generation: int,
    table_index: int,
    mip_indices: tuple[int, ...],
) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []

    for mip_index in mip_indices:
        for frame_index, frame in enumerate(bank.frames):
            events.append(
                {
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
    assert payloads[0] == {
        "generation": 3,
        "tableIndex": 9,
        "mipIndex": expected_mip_index,
    }


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

    assert _unwrap_event_payloads(ack_events) == [
        {
            "generation": 5,
            "tableIndex": 1,
            "mipIndex": current_mip_index,
            "frameIndex": 0,
        }
    ]


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
