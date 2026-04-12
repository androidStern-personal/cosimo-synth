from __future__ import annotations

import json
from pathlib import Path
import tempfile

import pytest

from bench import _collect_cmajor_output_events_via_generated_javascript


REPO_ROOT = Path(__file__).resolve().parents[1]
MSEG_SOURCE = REPO_ROOT / "cmajor" / "Mseg.cmajor"
FIXED_FRAME_OSCILLATOR_SOURCE = REPO_ROOT / "cmajor" / "FixedFrameOscillator.cmajor"
WAVETABLE_SYNTH_SOURCE = REPO_ROOT / "cmajor" / "WavetableSynth.cmajor"
DEFAULT_SAMPLE_RATE = 44100


def _build_runtime_state_coordinator_probe_source() -> str:
    coordinator_source = WAVETABLE_SYNTH_SOURCE.read_text(encoding="utf-8").replace(
        "graph WavetableSynth [[ main ]]",
        "graph WavetableSynth"
    ).split("graph Voice")[0]

    return (
        MSEG_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + FIXED_FRAME_OSCILLATOR_SOURCE.read_text(encoding="utf-8")
        + "\n"
        + coordinator_source
        + "\n}\n"
        + "\n"
        + "graph RuntimeStateCoordinatorProbe [[ main ]]\n"
        + "{\n"
        + "    input event wt::DesiredTableChange desiredTableChange;\n"
        + "    input event int32 runtimeSyncRequest;\n"
        + "    input event int32 retryDesiredTableRequest;\n"
        + "    input event wt::WorkerLoadFailure workerLoadFailure;\n"
        + "    input event wt::RuntimeServiceState runtimeServiceState;\n"
        + "    output event wt::RuntimeState runtimeState;\n"
        + "    node coordinator = wt::RuntimeStateCoordinator;\n"
        + "    event desiredTableChange (wt::DesiredTableChange change) { coordinator.desiredTableChangeIn <- change; }\n"
        + "    event runtimeSyncRequest (int32 request) { coordinator.runtimeSyncRequestIn <- request; }\n"
        + "    event retryDesiredTableRequest (int32 request) { coordinator.retryDesiredTableRequestIn <- request; }\n"
        + "    event workerLoadFailure (wt::WorkerLoadFailure failure) { coordinator.workerLoadFailureIn <- failure; }\n"
        + "    event runtimeServiceState (wt::RuntimeServiceState state) { coordinator.runtimeServiceStateIn <- state; }\n"
        + "    connection\n"
        + "    {\n"
        + "        coordinator.runtimeStateOut -> runtimeState;\n"
        + "    }\n"
        + "}\n"
    )


def _build_probe_manifest(source_filename: str) -> dict[str, object]:
    return {
        "CmajorVersion": 1,
        "ID": "dev.cosimo.runtime-state-coordinator-probe",
        "version": "1.0",
        "name": "Runtime State Coordinator Probe",
        "description": "Exercises the checked-in runtime state coordinator",
        "category": "utility",
        "source": source_filename,
    }


def _with_runtime_state_probe(*, callback):
    with tempfile.TemporaryDirectory(prefix="runtime_state_probe_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        probe_source_path = temp_dir / "RuntimeStateCoordinatorProbe.cmajor"
        patch_path = temp_dir / "RuntimeStateCoordinatorProbe.cmajorpatch"

        probe_source_path.write_text(
            _build_runtime_state_coordinator_probe_source(),
            encoding="utf-8",
        )
        patch_path.write_text(
            json.dumps(_build_probe_manifest(probe_source_path.name), indent=2) + "\n",
            encoding="utf-8",
        )
        return callback(patch_path)


def _build_setup_js(events: list[tuple[str, dict[str, object] | int]]) -> str:
    return "\n".join(
        f"patch.sendInputEvent_{endpoint_id}({json.dumps(payload)});"
        for endpoint_id, payload in events
    )


def _unwrap_event_payloads(events: list[dict[str, object]]) -> list[dict[str, object]]:
    return [event["event"] for event in events]


def _runtime_service_state(
    *,
    dsp_session_id: int = 77,
    generation_frontier: int,
    service_state: int,
    has_active: int,
    active_table_index: int,
    active_generation: int,
    has_loading: int,
    loading_table_index: int,
    loading_generation: int,
) -> dict[str, int]:
    return {
        "dspSessionId": dsp_session_id,
        "generationFrontier": generation_frontier,
        "serviceState": service_state,
        "hasActive": has_active,
        "activeTableIndex": active_table_index,
        "activeGeneration": active_generation,
        "hasLoading": has_loading,
        "loadingTableIndex": loading_table_index,
        "loadingGeneration": loading_generation,
    }


@pytest.mark.cmajor
def test_runtime_state_coordinator_sync_snapshot_combines_desired_table_and_service_state() -> None:
    def run_probe(patch_path: Path) -> list[dict[str, object]]:
        return _collect_cmajor_output_events_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=8,
            output_endpoint_id="runtimeState",
            setup_js=_build_setup_js(
                [
                    (
                        "runtimeServiceState",
                        _runtime_service_state(
                            generation_frontier=5,
                            service_state=2,
                            has_active=1,
                            active_table_index=3,
                            active_generation=5,
                            has_loading=0,
                            loading_table_index=0,
                            loading_generation=0,
                        ),
                    ),
                    ("desiredTableChange", {"tableIndex": 4}),
                    ("runtimeSyncRequest", 1),
                ]
            ),
        )

    payloads = _unwrap_event_payloads(_with_runtime_state_probe(callback=run_probe))

    assert payloads
    assert payloads[-1] == {
        "dspSessionId": 77,
        "desiredIntentSerial": 1,
        "desiredTableIndex": 4,
        "generationFrontier": 5,
        "serviceState": 2,
        "hasActive": 1,
        "activeTableIndex": 3,
        "activeGeneration": 5,
        "hasLoading": 0,
        "loadingTableIndex": 0,
        "loadingGeneration": 0,
        "hasFailure": 0,
        "failedTableIndex": 0,
        "failedGeneration": 0,
        "failureScope": 0,
        "failurePhase": 0,
        "failureReasonCode": 0,
    }


@pytest.mark.cmajor
def test_runtime_state_coordinator_ignores_stale_service_failures_but_accepts_current_service_failures() -> None:
    def run_probe(patch_path: Path) -> list[dict[str, object]]:
        return _collect_cmajor_output_events_via_generated_javascript(
            patch_path=patch_path,
            sample_rate=DEFAULT_SAMPLE_RATE,
            num_samples=8,
            output_endpoint_id="runtimeState",
            setup_js=_build_setup_js(
                [
                    (
                        "runtimeServiceState",
                        _runtime_service_state(
                            generation_frontier=5,
                            service_state=2,
                            has_active=1,
                            active_table_index=3,
                            active_generation=5,
                            has_loading=0,
                            loading_table_index=0,
                            loading_generation=0,
                        ),
                    ),
                    (
                        "workerLoadFailure",
                        {
                            "dspSessionId": 77,
                            "tableIndex": 3,
                            "generation": 4,
                            "candidateAttemptSerial": 0,
                            "failurePhase": 2,
                            "failureReasonCode": 9,
                        },
                    ),
                    ("runtimeSyncRequest", 1),
                    (
                        "workerLoadFailure",
                        {
                            "dspSessionId": 77,
                            "tableIndex": 3,
                            "generation": 5,
                            "candidateAttemptSerial": 0,
                            "failurePhase": 2,
                            "failureReasonCode": 9,
                        },
                    ),
                    ("runtimeSyncRequest", 1),
                ]
            ),
        )

    payloads = _unwrap_event_payloads(_with_runtime_state_probe(callback=run_probe))

    assert payloads[1] == {
        "dspSessionId": 77,
        "desiredIntentSerial": 0,
        "desiredTableIndex": 0,
        "generationFrontier": 5,
        "serviceState": 2,
        "hasActive": 1,
        "activeTableIndex": 3,
        "activeGeneration": 5,
        "hasLoading": 0,
        "loadingTableIndex": 0,
        "loadingGeneration": 0,
        "hasFailure": 0,
        "failedTableIndex": 0,
        "failedGeneration": 0,
        "failureScope": 0,
        "failurePhase": 0,
        "failureReasonCode": 0,
    }
    assert payloads[-1] == {
        "dspSessionId": 77,
        "desiredIntentSerial": 0,
        "desiredTableIndex": 0,
        "generationFrontier": 5,
        "serviceState": 2,
        "hasActive": 1,
        "activeTableIndex": 3,
        "activeGeneration": 5,
        "hasLoading": 0,
        "loadingTableIndex": 0,
        "loadingGeneration": 0,
        "hasFailure": 1,
        "failedTableIndex": 3,
        "failedGeneration": 5,
        "failureScope": 1,
        "failurePhase": 2,
        "failureReasonCode": 9,
    }
