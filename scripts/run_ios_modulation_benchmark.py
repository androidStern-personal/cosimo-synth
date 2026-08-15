#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
import os
import plistlib
import statistics
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PROJECT_GENERATOR = REPO_ROOT / "scripts" / "generate_ios_auv3_xcode_project.sh"
PROFILE_GENERATOR = REPO_ROOT / "scripts" / "generate_modulation_benchmark_profiles.mjs"

DEVICE_BUILD_ID = "00008120-000139383644C01E"
DEVICECTL_ID = "00C7F433-8B6A-5CAC-856F-56D7385E12F9"
TEAM_ID = "JUFVT28775"
CONTAINER_BUNDLE_ID = "dev.cosimo.wavetable-synth-modulation-benchmark"
HOST_BUNDLE_ID = "dev.cosimo.wavetable-synth-modulation-benchmark-host"
PLUGIN_CODE = "CmBm"
PLUGIN_MANUFACTURER_CODE = "Manu"
PRODUCT_NAME = "Cosimo Modulation Benchmark"
PROFILE_BASE_DURATIONS_SECONDS = {
    "empty": 20.0,
    "voice-100": 45.0,
    "voice-rack-100": 45.0,
    "mixed-100": 45.0,
    "combined-200": 45.0,
    "stored-1118-active-100": 45.0,
    "active-1118": 20.0,
}
PROFILE_NAMES = tuple(PROFILE_BASE_DURATIONS_SECONDS)
EXECUTABLE_PROFILE_NAMES = PROFILE_NAMES
PAIRED_EMPTY_DURATION_SECONDS = 10.0
WARMUP_DURATION_SECONDS = 2.0
RESULT_COLLECTION_ALLOWANCE_SECONDS = 120.0
THERMAL_COOLDOWN_ALLOWANCE_SECONDS = 3600.0
# audioFrames crosses the out-of-process AUv3 boundary through a normalized float32
# parameter. The field value is packed together with its field index, and the physical
# float32 round trip moved one observed aggregate by 13 frames. Sixteen remains far
# below one 128-frame callback, which the block-count/bounds check must continue to catch.
AUDIO_FRAME_TRANSPORT_TOLERANCE = 16
# Incremental matrix budget in percentage points of one 128-frame audio deadline.
# The identical full synth/effects graph runs in every phase; these limits apply only
# to the added sparse route program, not to total product DSP.
MATRIX_100_MAX_ADDED_RENDER_LOAD_PERCENT = 10.0
MATRIX_LOAD_BUDGETS = {
    "voice-rack-100": MATRIX_100_MAX_ADDED_RENDER_LOAD_PERCENT,
}
RUNTIME_READY_TIMEOUT_MESSAGE = "Timed out waiting for the production modulation runtime to become ready."


def run(command: list[str], *, env: dict[str, str] | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=REPO_ROOT,
        env=env,
        check=check,
        capture_output=True,
        text=True,
    )


def bundle_identifier(app_path: Path) -> str | None:
    info_path = app_path / "Info.plist"
    if not info_path.is_file():
        return None
    return plistlib.loads(info_path.read_bytes()).get("CFBundleIdentifier")


def find_app(build_dir: Path, expected_bundle_id: str) -> Path:
    matches = [path for path in build_dir.rglob("*.app") if bundle_identifier(path) == expected_bundle_id]
    if len(matches) != 1:
        raise RuntimeError(f"Expected one {expected_bundle_id} app under {build_dir}, found {matches}")
    return matches[0]


def read_plist(bundle_path: Path) -> dict[str, object]:
    info_path = bundle_path / "Info.plist"
    if not info_path.is_file():
        raise RuntimeError(f"Bundle has no Info.plist: {bundle_path}")
    payload = plistlib.loads(info_path.read_bytes())
    if not isinstance(payload, dict):
        raise RuntimeError(f"Bundle Info.plist is not a dictionary: {bundle_path}")
    return payload


def find_embedded_extension(container_app: Path) -> Path:
    matches = list((container_app / "PlugIns").glob("*.appex"))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one embedded AUv3 in {container_app}, found {matches}")
    return matches[0]


def read_signed_entitlements(bundle_path: Path) -> dict[str, object]:
    run(["codesign", "--verify", "--strict", str(bundle_path)])
    result = run(["codesign", "-d", "--entitlements", ":-", str(bundle_path)], check=False)
    output = result.stdout + result.stderr
    xml_start = output.find("<?xml")
    plist_end = output.find("</plist>")
    if xml_start < 0 or plist_end < xml_start:
        return {}
    payload = plistlib.loads(output[xml_start:plist_end + len("</plist>")].encode("utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError(f"Signed entitlements are not a dictionary: {bundle_path}")
    return payload


def validate_benchmark_product_plists(container_app: Path, host_app: Path) -> Path:
    container_info = read_plist(container_app)
    host_info = read_plist(host_app)
    extension_path = find_embedded_extension(container_app)
    extension_info = read_plist(extension_path)

    if container_info.get("CFBundleIdentifier") != CONTAINER_BUNDLE_ID:
        raise RuntimeError("Benchmark container has the wrong bundle identifier")
    if host_info.get("CFBundleIdentifier") != HOST_BUNDLE_ID:
        raise RuntimeError("Benchmark host has the wrong bundle identifier")

    extension_bundle_id = extension_info.get("CFBundleIdentifier")
    if not isinstance(extension_bundle_id, str) or not extension_bundle_id.startswith(f"{CONTAINER_BUNDLE_ID}."):
        raise RuntimeError(f"Benchmark AUv3 has the wrong bundle identifier: {extension_bundle_id}")

    extension = extension_info.get("NSExtension")
    attributes = extension.get("NSExtensionAttributes") if isinstance(extension, dict) else None
    components = attributes.get("AudioComponents") if isinstance(attributes, dict) else None
    if not isinstance(components, list) or len(components) != 1 or not isinstance(components[0], dict):
        raise RuntimeError("Benchmark AUv3 does not declare exactly one Audio Component")
    component = components[0]
    expected_component = {
        "type": "aumu",
        "subtype": PLUGIN_CODE,
        "manufacturer": PLUGIN_MANUFACTURER_CODE,
    }
    for key, expected in expected_component.items():
        if component.get(key) != expected:
            raise RuntimeError(f"Benchmark AUv3 {key} is {component.get(key)!r}, expected {expected!r}")
    return extension_path


def assert_no_production_app_group(bundle_path: Path, entitlements: dict[str, object]) -> None:
    groups = entitlements.get("com.apple.security.application-groups", [])
    if groups not in (None, []):
        raise RuntimeError(f"Isolated benchmark bundle has App Group entitlements: {bundle_path}")


def assert_audio_unit_host_entitlement(bundle_path: Path, entitlements: dict[str, object]) -> None:
    if entitlements.get("inter-app-audio") is not True:
        raise RuntimeError(f"Benchmark host omitted the Audio Unit host entitlement: {bundle_path}")


def validate_benchmark_products(container_app: Path, host_app: Path, profile_path: Path) -> None:
    extension_path = validate_benchmark_product_plists(container_app, host_app)
    bundled_profiles = extension_path / "benchmark" / "modulation-benchmark-profiles.json"
    if not bundled_profiles.is_file() or bundled_profiles.read_bytes() != profile_path.read_bytes():
        raise RuntimeError("Benchmark AUv3 does not contain the exact generated strict profile document")
    for bundle_path in (container_app, extension_path, host_app):
        assert_no_production_app_group(bundle_path, read_signed_entitlements(bundle_path))
    assert_audio_unit_host_entitlement(host_app, read_signed_entitlements(host_app))


def generate_profiles(output_path: Path) -> None:
    run(["node", str(PROFILE_GENERATOR), "--output", str(output_path)])


def write_counterbalanced_profiles(source_path: Path, destination_path: Path, run_index: int) -> None:
    document = json.loads(source_path.read_text(encoding="utf-8"))
    profiles = document.get("profiles")
    if not isinstance(profiles, list):
        raise RuntimeError("Benchmark profile document omitted profiles")
    by_name = {profile.get("name"): profile for profile in profiles if isinstance(profile, dict)}
    if set(by_name) != set(PROFILE_NAMES):
        raise RuntimeError(f"Benchmark profile set is not exact: {set(by_name)}")

    orders = (
        PROFILE_NAMES[1:] + PROFILE_NAMES[:1],
        tuple(reversed(PROFILE_NAMES[:-1])) + PROFILE_NAMES[-1:],
        PROFILE_NAMES[3:] + PROFILE_NAMES[:3],
    )
    order = orders[run_index % len(orders)]
    document["profiles"] = [by_name[name] for name in order]
    document["counterbalanceOrder"] = list(order)
    destination_path.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")


def generate_and_build(build_dir: Path, team_id: str, destination_id: str, profile_path: Path) -> tuple[Path, Path]:
    env = os.environ.copy()
    env.update(
        {
            "COSIMO_PRODUCT_NAME": PRODUCT_NAME,
            "COSIMO_BUNDLE_ID": CONTAINER_BUNDLE_ID,
            "COSIMO_HOST_BUNDLE_ID": HOST_BUNDLE_ID,
            "COSIMO_PLUGIN_CODE": PLUGIN_CODE,
            "COSIMO_PLUGIN_MANUFACTURER_CODE": PLUGIN_MANUFACTURER_CODE,
            "COSIMO_ENABLE_APP_GROUP": "OFF",
            "COSIMO_USE_BUNDLED_WAVETABLE_LIBRARY": "ON",
            "COSIMO_ENABLE_MODULATION_BENCHMARK_METRICS": "ON",
            "COSIMO_MODULATION_BENCHMARK_PROFILES_PATH": str(profile_path),
            "COSIMO_ENABLE_EDITOR_INSPECTION": "1",
            "COSIMO_IOS_SYSROOT": "iphoneos",
        }
    )
    run([str(PROJECT_GENERATOR), str(build_dir)], env=env)
    project_path = build_dir / "CosimoSynthAUv3.xcodeproj"
    run(
        [
            "xcodebuild",
            "-project",
            str(project_path),
            "-configuration",
            "Release",
            "-destination",
            f"id={destination_id}",
            "-target",
            "CosimoSynth_Standalone",
            "-target",
            "CosimoSynthHost",
            f"DEVELOPMENT_TEAM={team_id}",
            "CODE_SIGN_STYLE=Automatic",
            "CODE_SIGN_IDENTITY=Apple Development",
            "-allowProvisioningUpdates",
            "build",
        ],
        env=env,
    )
    return find_app(build_dir, CONTAINER_BUNDLE_ID), find_app(build_dir, HOST_BUNDLE_ID)


def install_app(device_id: str, app_path: Path) -> None:
    run(["xcrun", "devicectl", "device", "install", "app", "--device", device_id, str(app_path)])


def launch_registration_container(device_id: str) -> int:
    with tempfile.TemporaryDirectory(prefix="cosimo-modulation-registration-") as temp_dir:
        launch_result_path = Path(temp_dir) / "launch.json"
        launch = run(
            [
                "xcrun", "devicectl", "device", "process", "launch",
                "--device", device_id,
                "--terminate-existing",
                "--json-output", str(launch_result_path),
                CONTAINER_BUNDLE_ID,
            ],
            check=False,
        )
        if launch.returncode != 0:
            raise RuntimeError(f"Could not prime benchmark AUv3 registration:\n{launch.stdout}\n{launch.stderr}")

        launch_payload = json.loads(launch_result_path.read_text(encoding="utf-8"))
        process_identifier = launch_payload.get("result", {}).get("process", {}).get("processIdentifier")
        if not isinstance(process_identifier, int) or process_identifier <= 0:
            raise RuntimeError("Benchmark registration launch did not report a valid process identifier")

        return process_identifier


def prime_extension_registration(device_id: str) -> int:
    launch_registration_container(device_id)
    time.sleep(4.0)
    return launch_registration_container(device_id)


def stop_registration_container(device_id: str, process_identifier: int) -> None:
    terminate = run(
        [
            "xcrun", "devicectl", "device", "process", "terminate",
            "--device", device_id,
            "--pid", str(process_identifier),
        ],
        check=False,
    )
    terminate_output = terminate.stdout + terminate.stderr
    if terminate.returncode != 0 and "No such process" not in terminate_output:
        raise RuntimeError(f"Could not stop benchmark registration container:\n{terminate.stdout}\n{terminate.stderr}")
    time.sleep(1.0)


def wait_for_benchmark_runtime_ready(
    device_id: str,
    output_name: str,
    timeout_seconds: float = 100.0,
) -> None:
    deadline = time.monotonic() + timeout_seconds
    with tempfile.TemporaryDirectory(prefix="cosimo-modulation-instantiation-") as temp_dir:
        destination = Path(temp_dir) / output_name
        while time.monotonic() < deadline:
            payload = fetch_result(device_id, output_name, destination)
            if payload is not None:
                if payload.get("error"):
                    raise RuntimeError(str(payload["error"]))
                if isinstance(payload.get("runtimeReady"), dict):
                    return
            time.sleep(0.25)
    raise RuntimeError(RUNTIME_READY_TIMEOUT_MESSAGE)


def uninstall_app(device_id: str, bundle_id: str) -> None:
    run(
        ["xcrun", "devicectl", "device", "uninstall", "app", "--device", device_id, bundle_id],
        check=False,
    )


def copy_profiles_to_host(device_id: str, profile_path: Path) -> None:
    run(
        [
            "xcrun",
            "devicectl",
            "device",
            "copy",
            "to",
            "--device",
            device_id,
            "--source",
            str(profile_path),
            "--destination",
            f"Documents/{profile_path.name}",
            "--domain-type",
            "appDataContainer",
            "--domain-identifier",
            HOST_BUNDLE_ID,
        ]
    )


def fetch_result(device_id: str, output_name: str, destination: Path) -> dict[str, object] | None:
    temp_destination = destination.with_suffix(".incoming.json")
    temp_destination.unlink(missing_ok=True)
    result = run(
        [
            "xcrun",
            "devicectl",
            "device",
            "copy",
            "from",
            "--device",
            device_id,
            "--source",
            f"Documents/{output_name}",
            "--destination",
            str(temp_destination),
            "--domain-type",
            "appDataContainer",
            "--domain-identifier",
            HOST_BUNDLE_ID,
        ],
        check=False,
    )
    if result.returncode != 0 or not temp_destination.is_file():
        return None
    payload = json.loads(temp_destination.read_text(encoding="utf-8"))
    temp_destination.replace(destination)
    return payload


def launch_benchmark(
    device_id: str,
    profile_name: str,
    output_name: str,
    duration_scale: float,
    *,
    registration_process_id: int | None = None,
) -> None:
    environment = json.dumps(
        {
            "COSIMO_SMOKE_MODE": "modulation-benchmark",
            "COSIMO_SMOKE_OUTPUT_NAME": output_name,
            "COSIMO_MODULATION_BENCHMARK_PROFILE_FILE": profile_name,
            "COSIMO_MODULATION_BENCHMARK_DURATION_SCALE": str(duration_scale),
        }
    )
    launch = run(
        [
            "xcrun",
            "devicectl",
            "device",
            "process",
            "launch",
            "--device",
            device_id,
            "--terminate-existing",
            "--environment-variables",
            environment,
            HOST_BUNDLE_ID,
        ],
        check=False,
    )
    if launch.returncode != 0:
        raise RuntimeError(f"Could not launch benchmark host:\n{launch.stdout}\n{launch.stderr}")
    if registration_process_id is not None:
        wait_for_benchmark_runtime_ready(device_id, output_name)
        stop_registration_container(device_id, registration_process_id)


def wait_for_complete_result(
    device_id: str,
    output_name: str,
    destination: Path,
    timeout_seconds: float,
) -> dict[str, object]:
    deadline = time.monotonic() + timeout_seconds
    latest: dict[str, object] | None = None
    while time.monotonic() < deadline:
        payload = fetch_result(device_id, output_name, destination)
        if payload is not None:
            latest = payload
            if payload.get("error"):
                raise RuntimeError(str(payload["error"]))
            if payload.get("status") == "complete":
                return payload
        time.sleep(2.0)
    raise TimeoutError(f"Timed out waiting for physical iPhone benchmark; latest payload: {latest}")


def launch_and_collect_benchmark(
    device_id: str,
    profile_name: str,
    output_name: str,
    duration_scale: float,
    destination: Path,
    timeout_seconds: float,
    *,
    registration_process_id: int | None = None,
) -> dict[str, object]:
    current_registration_process_id = registration_process_id
    output_path = Path(output_name)
    launch_token = uuid.uuid4().hex[:12]
    for attempt in range(2):
        attempt_output_name = (
            f"{output_path.stem}-{launch_token}-attempt-{attempt + 1}{output_path.suffix}"
        )
        try:
            launch_benchmark(
                device_id,
                profile_name,
                attempt_output_name,
                duration_scale,
                registration_process_id=current_registration_process_id,
            )
            current_registration_process_id = None
            return wait_for_complete_result(
                device_id,
                attempt_output_name,
                destination,
                timeout_seconds,
            )
        except RuntimeError as error:
            if attempt == 0 and str(error) == RUNTIME_READY_TIMEOUT_MESSAGE:
                continue
            raise
    raise RuntimeError(RUNTIME_READY_TIMEOUT_MESSAGE)


def phase_metrics(run_payload: dict[str, object]) -> dict[str, dict[str, float | str]]:
    phases = run_payload.get("phases")
    if not isinstance(phases, list):
        raise AssertionError("Benchmark result omitted phases")
    return {
        str(phase["name"]): phase["metrics"]
        for phase in phases
        if isinstance(phase, dict) and isinstance(phase.get("metrics"), dict)
    }


def _assert_install_ack(name: str, ack: object, expected_counts: dict[str, int]) -> None:
    if not isinstance(ack, dict):
        raise AssertionError(f"{name} omitted install evidence")
    if ack.get("accepted") is not True or int(ack.get("acceptedModulationProgramSerial", 0)) <= 0:
        raise AssertionError(f"{name} did not prove a newly accepted modulation program")
    if ack.get("installedCounts") != expected_counts:
        raise AssertionError(f"{name} installed counts differ from the compiled profile")


def _assert_measured_phase(name: str, phase: object, expected_duration: float) -> None:
    if not isinstance(phase, dict):
        raise AssertionError(f"{name} omitted measured phase evidence")
    measured_duration = float(phase["durationSeconds"])
    if not math.isclose(measured_duration, expected_duration, rel_tol=1.0e-9, abs_tol=1.0e-6):
        raise AssertionError(f"{name} declared {measured_duration:.6f}s, expected {expected_duration:.6f}s")
    wall_to_audio = float(phase["wallToAudioRatio"])
    if not 0.9 <= wall_to_audio <= 1.1:
        raise AssertionError(f"{name} was not paced in real time: {wall_to_audio:.4f}")
    if int(phase["nonFiniteSampleCount"]) != 0:
        raise AssertionError(f"{name} emitted non-finite audio")
    if float(phase["rms"]) <= 1.0e-5:
        raise AssertionError(f"{name} emitted silence")
    if int(phase["sampleTimeDiscontinuityCount"]) != 0:
        raise AssertionError(f"{name} had audio timeline discontinuities")
    if int(phase["measuredGapCount"]) <= 0:
        raise AssertionError(f"{name} omitted callback-arrival pacing evidence")
    if float(phase["p99TapArrivalGapRatio"]) > 1.25:
        raise AssertionError(f"{name} callback-arrival p99 exceeded 125% of real time")
    if float(phase["maximumTapArrivalGapRatio"]) > 2.0:
        raise AssertionError(f"{name} callback-arrival maximum exceeded 200% of real time")
    if float(phase["tapArrivalGapOver125PercentRate"]) > 0.01:
        raise AssertionError(f"{name} had more than 1% late callback arrivals")
    mixer_tap_sample_rate = float(phase["sampleRate"])
    if not math.isfinite(mixer_tap_sample_rate) or mixer_tap_sample_rate <= 0.0:
        raise AssertionError(f"{name} omitted a valid mixer-tap sample rate")
    if int(phase["maximumBufferFrames"]) <= 0:
        raise AssertionError(f"{name} omitted mixer-tap buffer evidence")
    if int(phase["uniqueVoiceCount"]) != 16 or phase.get("uniqueVoiceIndexes") != list(range(16)):
        raise AssertionError(f"{name} did not exercise voice indexes 0 through 15")
    if int(phase.get("rackEnableMask", -1)) != 0:
        raise AssertionError(f"{name} did not prove the intended all-disabled effects rack")
    for thermal_endpoint in ("thermalStateBefore", "thermalStateAfter"):
        thermal_state = str(phase.get(thermal_endpoint, "missing"))
        if thermal_state not in {"nominal", "fair"}:
            raise AssertionError(f"{name} lacks safe thermal evidence at {thermal_endpoint}: {thermal_state}")

    render = phase.get("renderMetrics")
    if not isinstance(render, dict) or int(render.get("renderBlockCount", 0)) <= 0:
        raise AssertionError(f"{name} omitted actual processBlock telemetry")
    if int(render["capturedRenderSampleCount"]) != int(render["renderBlockCount"]):
        raise AssertionError(f"{name} processBlock telemetry was truncated")
    if abs(float(render["dspSampleRate"]) - 48000.0) > 1.0:
        raise AssertionError(f"{name} DSP did not render at 48 kHz")
    dsp_audio_seconds = float(render["audioFrames"]) / float(render["dspSampleRate"])
    host_audio_seconds = float(phase["audioSeconds"])
    if dsp_audio_seconds < expected_duration * 0.95:
        raise AssertionError(f"{name} processBlock telemetry did not cover the timed phase")
    if abs(dsp_audio_seconds - host_audio_seconds) / max(host_audio_seconds, 1.0e-9) > 0.02:
        raise AssertionError(f"{name} processBlock and host audio coverage differ by more than 2%")
    if int(render["deadlineMissCount"]) != 0:
        raise AssertionError(f"{name} missed an audio render deadline")
    if not 0 < int(render["minimumFrames"]) <= int(render["maximumFrames"]):
        raise AssertionError(f"{name} outer processBlock frame bounds are invalid")
    block_count = int(render["renderBlockCount"])
    audio_frames = int(render["audioFrames"])
    minimum_audio_frames = block_count * int(render["minimumFrames"])
    maximum_audio_frames = block_count * int(render["maximumFrames"])
    if not (
        minimum_audio_frames - AUDIO_FRAME_TRANSPORT_TOLERANCE
        <= audio_frames
        <= maximum_audio_frames + AUDIO_FRAME_TRANSPORT_TOLERANCE
    ):
        raise AssertionError(f"{name} processBlock frame totals contradict the captured block bounds")
    if float(render["p99RenderLoadPercent"]) > 50.0:
        raise AssertionError(f"{name} p99 render load exceeded 50%")
    if float(render["p999RenderLoadPercent"]) > 75.0:
        raise AssertionError(f"{name} p99.9 render load exceeded 75%")
    if float(render["maximumRenderLoadPercent"]) >= 100.0:
        raise AssertionError(f"{name} exceeded its audio render deadline")


def assert_shipping_contract(payload: dict[str, object], *, expected_duration_scale: float = 1.0) -> None:
    if payload.get("format") != "cosimo.ios-modulation-benchmark" or payload.get("version") != 2:
        raise AssertionError("Benchmark result is not the current post-cut product contract")
    payload_duration_scale = float(payload.get("durationScale", math.nan))
    if (
        not math.isfinite(expected_duration_scale)
        or expected_duration_scale <= 0.0
        or not math.isclose(payload_duration_scale, expected_duration_scale, rel_tol=1.0e-9, abs_tol=1.0e-9)
    ):
        raise AssertionError(
            f"Benchmark duration scale {payload_duration_scale!r} differs from requested {expected_duration_scale!r}"
        )
    phases = payload.get("phases")
    if not isinstance(phases, list):
        raise AssertionError("Benchmark result omitted phases")
    phase_records = {str(phase["name"]): phase for phase in phases if isinstance(phase, dict)}
    if set(phase_records) != set(PROFILE_NAMES):
        raise AssertionError(f"Benchmark phases differ from required contract: {set(phase_records)}")

    metrics = phase_metrics(payload)
    if set(metrics) != set(EXECUTABLE_PROFILE_NAMES):
        raise AssertionError(f"Benchmark omitted post-cut product profiles: {set(metrics)}")

    zero_counts = {"voice": 0, "macroVoice": 0, "voiceRack": 0, "macroRack": 0}
    paired_loads: dict[str, float] = {}
    for name, phase in metrics.items():
        record = phase_records[name]
        if record.get("status") != "measured":
            raise AssertionError(f"{name} omitted its measured status")
        compiled_counts = record.get("compiledCounts")
        if not isinstance(compiled_counts, dict):
            raise AssertionError(f"{name} omitted compiled/install evidence")
        _assert_install_ack(name, record.get("installAck"), compiled_counts)
        _assert_measured_phase(
            name,
            phase,
            PROFILE_BASE_DURATIONS_SECONDS[name] * expected_duration_scale,
        )
        if name == "empty":
            continue

        pair_load_values = []
        for pair_key in ("pairedEmptyBefore", "pairedEmptyAfter"):
            pair = record.get(pair_key)
            if not isinstance(pair, dict):
                raise AssertionError(f"{name} omitted paired empty evidence: {pair_key}")
            pair_name = f"{name}-{pair_key}"
            _assert_install_ack(pair_name, pair.get("installAck"), zero_counts)
            pair_metrics = pair.get("metrics")
            _assert_measured_phase(
                pair_name,
                pair_metrics,
                PAIRED_EMPTY_DURATION_SECONDS * expected_duration_scale,
            )
            pair_load_values.append(float(pair_metrics["renderMetrics"]["renderLoadPercent"]))
        paired_loads[name] = statistics.fmean(pair_load_values)

    route_added_loads = {
        name: float(metrics[name]["renderMetrics"]["renderLoadPercent"]) - paired_loads[name]
        for name in paired_loads
    }
    for name, budget in MATRIX_LOAD_BUDGETS.items():
        added_load = route_added_loads[name]
        if added_load > budget:
            raise AssertionError(
                f"{name} matrix cost added {added_load:.2f} render-load points; budget is {budget:.2f}"
            )


def validate_physical_iphone_provenance(result: object) -> dict[str, object]:
    if not isinstance(result, dict):
        raise RuntimeError("devicectl omitted physical device provenance")
    device = result.get("deviceProperties")
    hardware = result.get("hardwareProperties")
    product_type = hardware.get("productType") if isinstance(hardware, dict) else None
    if (
        not isinstance(device, dict)
        or not isinstance(hardware, dict)
        or hardware.get("reality") != "physical"
        or not isinstance(product_type, str)
        or not product_type.startswith("iPhone")
    ):
        raise RuntimeError("modulation qualification requires a physical iPhone")
    return {
        "identifier": result.get("identifier"),
        "name": device.get("name"),
        "osVersion": device.get("osVersionNumber"),
        "osBuild": device.get("osBuildUpdate"),
        "marketingName": hardware.get("marketingName"),
        "productType": product_type,
        "platform": hardware.get("platform"),
        "reality": hardware.get("reality"),
        "udid": hardware.get("udid"),
    }


def read_device_provenance(device_id: str) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix="cosimo-modulation-device-") as temp_dir:
        output_path = Path(temp_dir) / "device.json"
        run([
            "xcrun", "devicectl", "device", "info", "details",
            "--device", device_id,
            "--json-output", str(output_path),
            "--quiet",
        ])
        payload = json.loads(output_path.read_text(encoding="utf-8"))
    result = payload.get("result") if isinstance(payload, dict) else None
    return validate_physical_iphone_provenance(result)


def aggregate_runs(
    runs: list[dict[str, object]],
    *,
    qualification: str = "product-shipping",
    device: dict[str, object] | None = None,
) -> dict[str, object]:
    per_run_metrics = [phase_metrics(payload) for payload in runs]
    per_run_added_loads = []
    for payload, metrics in zip(runs, per_run_metrics, strict=True):
        records = {str(phase["name"]): phase for phase in payload["phases"]}
        per_run_added_loads.append({
            name: float(metrics[name]["renderMetrics"]["renderLoadPercent"]) - statistics.fmean(
                float(records[name][pair]["metrics"]["renderMetrics"]["renderLoadPercent"])
                for pair in ("pairedEmptyBefore", "pairedEmptyAfter")
            )
            for name in metrics
            if name != "empty"
        })
    phase_names = per_run_metrics[0].keys()
    return {
        "format": "cosimo.ios-modulation-benchmark-aggregate",
        "version": 2,
        "runCount": len(runs),
        "qualification": qualification,
        "device": device,
        "phases": {
            name: {
                "medianRenderLoadPercent": statistics.median(float(metrics[name]["renderMetrics"]["renderLoadPercent"]) for metrics in per_run_metrics),
                **({
                    "medianAddedRenderLoadPercent": statistics.median(
                        added_loads[name] for added_loads in per_run_added_loads
                    ),
                } if name != "empty" else {}),
                "maximumP99RenderLoadPercent": max(float(metrics[name]["renderMetrics"]["p99RenderLoadPercent"]) for metrics in per_run_metrics),
                "maximumP999RenderLoadPercent": max(float(metrics[name]["renderMetrics"]["p999RenderLoadPercent"]) for metrics in per_run_metrics),
                "maximumRenderLoadPercent": max(float(metrics[name]["renderMetrics"]["maximumRenderLoadPercent"]) for metrics in per_run_metrics),
                "deadlineMissCount": sum(int(metrics[name]["renderMetrics"]["deadlineMissCount"]) for metrics in per_run_metrics),
                "maximumTapArrivalGapRatio": max(float(metrics[name]["maximumTapArrivalGapRatio"]) for metrics in per_run_metrics),
                "medianWallToAudioRatio": statistics.median(float(metrics[name]["wallToAudioRatio"]) for metrics in per_run_metrics),
                "thermalStatesBefore": [str(metrics[name]["thermalStateBefore"]) for metrics in per_run_metrics],
                "thermalStatesAfter": [str(metrics[name]["thermalStateAfter"]) for metrics in per_run_metrics],
            }
            for name in phase_names
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build and run an isolated modulation stress benchmark on the paired iPhone.")
    parser.add_argument("--device", default=DEVICECTL_ID)
    parser.add_argument("--destination", default=DEVICE_BUILD_ID, help="xcodebuild destination identifier")
    parser.add_argument("--team", default=TEAM_ID)
    parser.add_argument("--build-dir", type=Path, default=REPO_ROOT / "build" / "ios_modulation_benchmark")
    parser.add_argument("--output-dir", type=Path, default=REPO_ROOT / "artifacts" / "ios-modulation-benchmark")
    parser.add_argument("--duration-scale", type=float, default=1.0)
    parser.add_argument("--repeat", type=int, default=3)
    parser.add_argument("--no-build", action="store_true")
    parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--keep-installed", action="store_true")
    parser.add_argument("--smoke-only", action="store_true", help="Allow a shorter non-qualifying run and label it smoke-only.")
    return parser.parse_args()


def is_qualifying_run(*, duration_scale: float, repeat: int, no_build: bool = False) -> bool:
    return duration_scale >= 1.0 and repeat >= 3 and not no_build


def benchmark_result_timeout_seconds(duration_scale: float) -> float:
    paired_profile_count = sum(name != "empty" for name in EXECUTABLE_PROFILE_NAMES)
    measurement_seconds = (
        sum(PROFILE_BASE_DURATIONS_SECONDS[name] for name in EXECUTABLE_PROFILE_NAMES)
        + (2.0 * PAIRED_EMPTY_DURATION_SECONDS * paired_profile_count)
    ) * duration_scale + WARMUP_DURATION_SECONDS
    return measurement_seconds + RESULT_COLLECTION_ALLOWANCE_SECONDS + THERMAL_COOLDOWN_ALLOWANCE_SECONDS


def main() -> int:
    args = parse_args()
    if args.duration_scale <= 0 or args.repeat <= 0:
        raise ValueError("duration-scale and repeat must be positive")
    qualifying = is_qualifying_run(
        duration_scale=args.duration_scale,
        repeat=args.repeat,
        no_build=args.no_build,
    )
    if not qualifying and not args.smoke_only:
        raise ValueError("Shipping qualification requires duration-scale >= 1 and repeat >= 3; pass --smoke-only for a shorter diagnostic run")
    args.build_dir = args.build_dir.resolve()
    args.output_dir = args.output_dir.resolve()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    profile_path = args.output_dir / "modulation-benchmark-profiles.json"

    if not args.no_build:
        run(["npm", "run", "ui:build"])
    generate_profiles(profile_path)

    if args.no_build:
        container_app = find_app(args.build_dir, CONTAINER_BUNDLE_ID)
        host_app = find_app(args.build_dir, HOST_BUNDLE_ID)
    else:
        container_app, host_app = generate_and_build(args.build_dir, args.team, args.destination, profile_path)

    validate_benchmark_products(container_app, host_app, profile_path)

    if args.prepare_only:
        print(json.dumps({"containerApp": str(container_app), "hostApp": str(host_app), "profiles": str(profile_path)}, indent=2))
        return 0

    device = read_device_provenance(args.device)
    uninstall_app(args.device, HOST_BUNDLE_ID)
    uninstall_app(args.device, CONTAINER_BUNDLE_ID)
    runs: list[dict[str, object]] = []
    registration_process_id: int | None = None
    try:
        install_app(args.device, container_app)
        install_app(args.device, host_app)
        for run_index in range(args.repeat):
            registration_process_id = prime_extension_registration(args.device)
            run_profile_path = args.output_dir / f"modulation-benchmark-profiles-run-{run_index + 1}.json"
            write_counterbalanced_profiles(profile_path, run_profile_path, run_index)
            copy_profiles_to_host(args.device, run_profile_path)
            output_name = f"modulation-benchmark-run-{run_index + 1}.json"
            output_path = args.output_dir / output_name
            payload = launch_and_collect_benchmark(
                args.device,
                run_profile_path.name,
                output_name,
                args.duration_scale,
                output_path,
                benchmark_result_timeout_seconds(args.duration_scale),
                registration_process_id=registration_process_id,
            )
            registration_process_id = None
            assert_shipping_contract(payload, expected_duration_scale=args.duration_scale)
            runs.append(payload)

        aggregate = aggregate_runs(
            runs,
            qualification="product-shipping" if qualifying and not args.smoke_only else "product-smoke",
            device=device,
        )
        aggregate_path = args.output_dir / "aggregate.json"
        aggregate_path.write_text(json.dumps(aggregate, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(aggregate, indent=2))
    finally:
        try:
            if registration_process_id is not None:
                stop_registration_container(args.device, registration_process_id)
        finally:
            if not args.keep_installed:
                uninstall_app(args.device, HOST_BUNDLE_ID)
                uninstall_app(args.device, CONTAINER_BUNDLE_ID)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, RuntimeError, TimeoutError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
