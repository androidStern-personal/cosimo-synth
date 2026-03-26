from __future__ import annotations

import argparse
import json
import os
import plistlib
import subprocess
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
XCODE_PROJECT_SCRIPT = REPO_ROOT / "scripts" / "generate_ios_auv3_xcode_project.sh"
HOST_BUNDLE_ID = "dev.cosimo.wavetable-synth-host"
CONTAINER_BUNDLE_ID = "dev.cosimo.wavetable-synth"

DEFAULT_PHONE_NAMES = [
    "iPhone 17",
    "iPhone 17 Pro",
    "iPhone 16e",
]

DEFAULT_TABLET_NAMES = [
    "iPad Pro 11-inch (M5)",
    "iPad Pro 13-inch (M5)",
    "iPad Air 11-inch (M3)",
]


def run(command: list[str], *, env: dict[str, str] | None = None, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd or REPO_ROOT,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )


def run_allow_failure(command: list[str], *, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=REPO_ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )


def load_available_devices() -> list[dict[str, object]]:
    result = run(["xcrun", "simctl", "list", "devices", "available", "-j"])
    payload = json.loads(result.stdout)
    devices: list[dict[str, object]] = []

    for runtime, runtime_devices in payload.get("devices", {}).items():
        if "iOS" not in runtime:
            continue

        for device in runtime_devices:
            if device.get("isAvailable"):
                devices.append(device)

    return devices


def select_device(preferred_names: list[str], family_prefix: str) -> dict[str, object]:
    devices = load_available_devices()

    for preferred_name in preferred_names:
        for device in devices:
            if device.get("name") == preferred_name:
                return device

    for device in devices:
        if str(device.get("name", "")).startswith(family_prefix):
            return device

    raise RuntimeError(f"Could not find an available {family_prefix} simulator")


def boot_device(udid: str) -> None:
    run_allow_failure(["xcrun", "simctl", "boot", udid])
    run(["xcrun", "simctl", "bootstatus", udid, "-b"])


def build_project(build_dir: Path, destination_udid: str) -> dict[str, Path]:
    env = os.environ.copy()
    env["COSIMO_IOS_SYSROOT"] = "iphonesimulator"
    run([str(XCODE_PROJECT_SCRIPT), str(build_dir)], env=env)

    project_path = build_dir / "CosimoSynthAUv3.xcodeproj"
    run(
        [
            "xcodebuild",
            "-project",
            str(project_path),
            "-configuration",
            "Debug",
            "-sdk",
            "iphonesimulator",
            "-destination",
            f"id={destination_udid}",
            "-target",
            "CosimoSynth_AUv3",
            "-target",
            "CosimoSynth_Standalone",
            "-target",
            "CosimoSynthHost",
            "CODE_SIGNING_ALLOWED=NO",
            "build",
        ]
    )

    products: dict[str, Path] = {}

    for app_path in build_dir.rglob("*.app"):
        info_plist = app_path / "Info.plist"

        if not info_plist.is_file():
            continue

        bundle_id = plistlib.loads(info_plist.read_bytes())["CFBundleIdentifier"]
        products[bundle_id] = app_path

    if CONTAINER_BUNDLE_ID not in products:
        raise RuntimeError("Could not find the built standalone container app")

    if HOST_BUNDLE_ID not in products:
        raise RuntimeError("Could not find the built host app")

    return products


def uninstall_if_present(udid: str, bundle_id: str) -> None:
    run_allow_failure(["xcrun", "simctl", "uninstall", udid, bundle_id])


def install_app(udid: str, app_path: Path) -> None:
    run(["xcrun", "simctl", "install", udid, str(app_path)])


def prime_extension_registration(udid: str) -> None:
    run_allow_failure(
        [
            "xcrun",
            "simctl",
            "launch",
            "--terminate-running-process",
            udid,
            CONTAINER_BUNDLE_ID,
        ]
    )
    time.sleep(4.0)
    run_allow_failure(["xcrun", "simctl", "terminate", udid, CONTAINER_BUNDLE_ID])


def app_documents_directory(udid: str, bundle_id: str) -> Path:
    result = run(["xcrun", "simctl", "get_app_container", udid, bundle_id, "data"])
    return Path(result.stdout.strip()) / "Documents"


def wait_for_output(path: Path, *, timeout_seconds: float = 120.0) -> dict[str, object]:
    deadline = time.monotonic() + timeout_seconds

    while time.monotonic() < deadline:
        if path.is_file() and path.stat().st_size > 0:
            return json.loads(path.read_text(encoding="utf-8"))

        time.sleep(1.0)

    raise RuntimeError(f"Timed out waiting for {path.name}")


def run_host_mode(udid: str, mode: str, output_name: str) -> dict[str, object]:
    documents_dir = app_documents_directory(udid, HOST_BUNDLE_ID)
    documents_dir.mkdir(parents=True, exist_ok=True)
    output_path = documents_dir / output_name

    if output_path.exists():
        output_path.unlink()

    env = os.environ.copy()
    env["SIMCTL_CHILD_COSIMO_SMOKE_MODE"] = mode
    env["SIMCTL_CHILD_COSIMO_SMOKE_OUTPUT_NAME"] = output_name

    run_allow_failure(["xcrun", "simctl", "terminate", udid, HOST_BUNDLE_ID])
    launch = run_allow_failure(
        [
            "xcrun",
            "simctl",
            "launch",
            "--terminate-running-process",
            udid,
            HOST_BUNDLE_ID,
        ],
        env=env,
    )

    if launch.returncode != 0:
        raise RuntimeError(f"Could not launch the host app in {mode} mode:\n{launch.stderr}")

    payload = wait_for_output(output_path)
    run_allow_failure(["xcrun", "simctl", "terminate", udid, HOST_BUNDLE_ID])

    if "error" in payload:
        raise RuntimeError(f"Host app smoke mode {mode} failed: {payload['error']}")

    return payload


def combine_results(phone_save: dict[str, object], phone_reload: dict[str, object], tablet_layout: dict[str, object]) -> dict[str, object]:
    phone_state = dict(phone_save.get("state", {}))
    phone_state["relaunchObservedValue"] = phone_reload.get("state", {}).get("relaunchObservedValue", 0.0)
    phone_state["relaunchObservedTableSelect"] = phone_reload.get("state", {}).get("relaunchObservedTableSelect", 0.0)
    phone_state["parameterSchemaMatchesRelaunch"] = phone_save.get("parameters", []) == phone_reload.get("parameters", [])

    return {
        "phone": {
            "discover": phone_save.get("discover", {}),
            "instantiate": phone_save.get("instantiate", {}),
            "parameters": phone_save.get("parameters", []),
            "parameterSet": phone_save.get("parameterSet", {}),
            "tableSelectionSet": phone_save.get("tableSelectionSet", {}),
            "audio": phone_save.get("audio", {}),
            "editor": phone_save.get("editor", {}),
            "state": phone_state,
        },
        "tablet": {
            "editor": tablet_layout.get("editor", {}),
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the iOS AUv3 targets and run the host smoke checks on Simulator.")
    parser.add_argument("--build-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    args.build_dir.mkdir(parents=True, exist_ok=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    phone_device = select_device(DEFAULT_PHONE_NAMES, "iPhone")
    tablet_device = select_device(DEFAULT_TABLET_NAMES, "iPad")
    phone_udid = str(phone_device["udid"])
    tablet_udid = str(tablet_device["udid"])

    boot_device(phone_udid)
    boot_device(tablet_udid)

    products = build_project(args.build_dir, phone_udid)

    for udid in (phone_udid, tablet_udid):
        uninstall_if_present(udid, CONTAINER_BUNDLE_ID)
        uninstall_if_present(udid, HOST_BUNDLE_ID)
        install_app(udid, products[CONTAINER_BUNDLE_ID])
        install_app(udid, products[HOST_BUNDLE_ID])
        prime_extension_registration(udid)

    phone_save = run_host_mode(phone_udid, "save", "phone-save.json")
    phone_reload = run_host_mode(phone_udid, "reload", "phone-reload.json")
    tablet_layout = run_host_mode(tablet_udid, "layout", "tablet-layout.json")

    args.output.write_text(
        json.dumps(combine_results(phone_save, phone_reload, tablet_layout), indent=2),
        encoding="utf-8",
    )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # pragma: no cover - surfaced directly in tests
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
