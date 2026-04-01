from __future__ import annotations

import functools
import http.server
import importlib.util
import json
import math
import os
import platform
import plistlib
import shutil
import socket
import struct
import subprocess
import tempfile
import threading
import time
import uuid
import zipfile
from pathlib import Path
from types import ModuleType
from urllib.parse import quote
from urllib.request import urlopen

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
IOS_AUV3_CMAKE = REPO_ROOT / "ios_auv3" / "CMakeLists.txt"
IOS_AUV3_GENERATOR = REPO_ROOT / "scripts" / "generate_ios_auv3_plugin.sh"
IOS_FACTORY_LIBRARY_ZIP = REPO_ROOT / "scripts" / "build_ios_factory_library_zip.sh"
IOS_AUV3_XCODE_PROJECT = REPO_ROOT / "scripts" / "generate_ios_auv3_xcode_project.sh"
IOS_AUV3_HOST_SMOKE = REPO_ROOT / "scripts" / "run_ios_auv3_host_smoke.py"
IOS_AUV3_PATCH = REPO_ROOT / "WavetableSynth.iOS.cmajorpatch"
IOS_AUV3_HOST_SNAPSHOT = REPO_ROOT / "ios_auv3" / "expected_host_smoke.json"
IOS_SHARED_LIBRARY_HELPER = REPO_ROOT / "ios_auv3" / "Source" / "CosimoSharedWavetableLibrary.mm"
IOS_SHARED_LIBRARY_HELPER_HEADER = REPO_ROOT / "ios_auv3" / "Source" / "CosimoSharedWavetableLibrary.h"
IOS_SHARED_LIBRARY_ENTITLEMENTS = REPO_ROOT / "ios_auv3" / "Entitlements" / "CosimoSharedWavetableLibrary.entitlements"
IOS_PLUGIN_MAIN = REPO_ROOT / "ios_auv3" / "Source" / "CosimoPluginMain.cpp"
IOS_PLUGIN_SHELL = REPO_ROOT / "ios_auv3" / "Source" / "CosimoCmajorPlugin.h"
IOS_VITE_CONFIG = REPO_ROOT / "ios_auv3" / "vite.config.mjs"
IOS_PATCH_HOST_HTML = REPO_ROOT / "patch_gui" / "index.ios.html"
IOS_PATCH_HOST_RUNTIME = REPO_ROOT / "patch_gui" / "index.ios-host.js"
PACKAGE_JSON = REPO_ROOT / "package.json"
VENDORED_CMAJOR_WEB_API = REPO_ROOT / "ios_auv3" / "Vendor" / "cmajor" / "web" / "cmaj_api"

CONTAINER_BUNDLE_ID = "dev.cosimo.wavetable-synth"
HOST_BUNDLE_ID = "dev.cosimo.wavetable-synth-host"
EXTENSION_BUNDLE_ID = "dev.cosimo.wavetable-synth.wavetable-synthAUv3"
APP_GROUP_ID = "group.dev.cosimo.wavetable-synth"


def _normalise_whitespace(text: str) -> str:
    return " ".join(text.split())


def _write_fake_juce_checkout(root: Path) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    (root / ".git").mkdir(exist_ok=True)
    (root / "juce_plugin_stub.cpp").write_text(
        "void cosimo_fake_juce_plugin_stub() {}\n",
        encoding="utf-8",
    )
    (root / "CMakeLists.txt").write_text(
        """
cmake_minimum_required(VERSION 3.22)
project(FakeJUCE LANGUAGES CXX C)

add_library(juce_audio_utils INTERFACE)
add_library(juce::juce_audio_utils ALIAS juce_audio_utils)

function(juce_add_plugin target)
    add_library(${target} STATIC "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/juce_plugin_stub.cpp")
    add_library(${target}_Standalone STATIC "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/juce_plugin_stub.cpp")
    add_library(${target}_AUv3 STATIC "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/juce_plugin_stub.cpp")
endfunction()

function(juce_generate_juce_header target)
endfunction()
""".strip()
        + "\n",
        encoding="utf-8",
    )
    return root


def _stage_bundle_root(destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    shutil.copy2(REPO_ROOT / "WavetableSynth.cmajorpatch", destination / "WavetableSynth.cmajorpatch")
    shutil.copy2(REPO_ROOT / "WavetableSynth.iOS.cmajorpatch", destination / "WavetableSynth.iOS.cmajorpatch")
    shutil.copytree(REPO_ROOT / "assets", destination / "assets")
    shutil.copytree(REPO_ROOT / "patch_gui", destination / "patch_gui")
    shutil.copytree(VENDORED_CMAJOR_WEB_API, destination / "cmaj_api")


def _load_python_module(module_path: Path, module_name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, module_path)

    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load Python module from {module_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@functools.lru_cache(maxsize=1)
def _load_ios_host_smoke_module() -> ModuleType:
    return _load_python_module(IOS_AUV3_HOST_SMOKE, "cosimo_ios_host_smoke")


def _find_bundle_by_identifier(search_root: Path, bundle_id: str, suffix: str) -> Path:
    for bundle_path in search_root.rglob(f"*{suffix}"):
        info_plist = bundle_path / "Info.plist"

        if not info_plist.is_file():
            continue

        info = plistlib.loads(info_plist.read_bytes())

        if info.get("CFBundleIdentifier") == bundle_id:
            return bundle_path

    raise RuntimeError(f"Could not find {suffix} bundle with identifier {bundle_id} under {search_root}")
def _url_path_from_root(root: Path, path: Path) -> str:
    relative = path.relative_to(root)
    return "/".join(quote(part) for part in relative.parts)


def _factory_library_install_roots(session: dict[str, object]) -> set[Path]:
    module = session["module"]
    udid = session["udid"]

    install_roots: set[Path] = set()
    group_root = module.group_container_directory(udid, CONTAINER_BUNDLE_ID, APP_GROUP_ID)

    if group_root is not None:
        install_roots.add(
            group_root / "Library" / "Application Support" / "CosimoSynth" / "WavetableLibrary" / "current"
        )

    for bundle_id in (CONTAINER_BUNDLE_ID, EXTENSION_BUNDLE_ID):
        data_root = module.data_container_directory(udid, bundle_id)

        if data_root is None:
            continue

        install_roots.add(
            data_root / "Library" / "Application Support" / "CosimoSynth" / "WavetableLibrary" / "current"
        )

    for pluginkit_root in module.pluginkit_data_roots(udid, EXTENSION_BUNDLE_ID):
        install_roots.add(
            pluginkit_root / "Library" / "Application Support" / "CosimoSynth" / "WavetableLibrary" / "current"
        )

    return install_roots


def _set_factory_library_state(
    session: dict[str, object],
    *,
    ready: bool,
    first_table_name: str | None = None,
    first_table_source_wav: str | None = None,
    first_table_frame_count: int | None = None,
    first_table_sample_rate: int | None = None,
) -> None:
    module = session["module"]
    udid = session["udid"]
    install_roots = _factory_library_install_roots(session)

    if not install_roots:
        raise RuntimeError("Could not find any install roots for the shared wavetable library.")

    for install_root in sorted(install_roots):
        if install_root.exists():
            shutil.rmtree(install_root)

    if not ready:
        return

    module.seed_factory_library(udid)

    if (
        first_table_name is None
        and first_table_source_wav is None
        and first_table_frame_count is None
        and first_table_sample_rate is None
    ):
        return

    catalog = json.loads((REPO_ROOT / "assets" / "factory-bank-catalog.json").read_text(encoding="utf-8"))

    if first_table_name is not None:
        catalog["tables"][0]["name"] = first_table_name

    if first_table_source_wav is not None:
        catalog["tables"][0]["sourceWav"] = first_table_source_wav

    if first_table_frame_count is not None:
        catalog["tables"][0]["frameCount"] = first_table_frame_count

    for install_root in sorted(_factory_library_install_roots(session)):
        (install_root / "assets" / "factory-bank-catalog.json").write_text(
            json.dumps(catalog, indent=2) + "\n",
            encoding="utf-8",
        )

        if first_table_sample_rate is not None:
            _write_float32_mono_wav(
                install_root / catalog["tables"][0]["sourceWav"],
                sample_rate=first_table_sample_rate,
                frame_count=int(catalog["tables"][0]["frameCount"]),
            )


def _run_host_mode(
    session: dict[str, object],
    mode: str,
    *,
    extra_child_env: dict[str, str] | None = None,
    terminate_after_output: bool = True,
    output_name: str | None = None,
) -> dict[str, object]:
    output_name = output_name or f"{mode}-{uuid.uuid4().hex}.json"
    module = session["module"]
    udid = session["udid"]
    return module.run_host_mode(
        udid,
        mode,
        output_name,
        extra_child_env=extra_child_env,
        terminate_after_output=terminate_after_output,
    )


def _host_output_path(session: dict[str, object], output_name: str) -> Path:
    module = session["module"]
    udid = session["udid"]
    return module.app_documents_directory(udid, HOST_BUNDLE_ID) / output_name


def _wait_for_host_output_matching(
    session: dict[str, object],
    output_name: str,
    predicate,
    *,
    timeout_seconds: float = 20.0,
) -> dict[str, object]:
    output_path = _host_output_path(session, output_name)
    deadline = time.monotonic() + timeout_seconds
    latest_payload: dict[str, object] | None = None

    while time.monotonic() < deadline:
        if output_path.is_file() and output_path.stat().st_size > 0:
            payload = json.loads(output_path.read_text(encoding="utf-8"))

            if isinstance(payload, dict):
                latest_payload = payload

                if predicate(payload):
                    return payload

        time.sleep(0.2)

    raise AssertionError(f"Timed out waiting for matching host output. Latest payload: {latest_payload}")


def _wait_for_editor_metrics_matching(
    session: dict[str, object],
    predicate,
    *,
    timeout_seconds: float = 20.0,
) -> dict[str, object]:
    module = session["module"]
    udid = session["udid"]
    deadline = time.monotonic() + timeout_seconds
    latest_payload: dict[str, object] | None = None

    while time.monotonic() < deadline:
        for metrics_path in sorted(module.editor_metrics_candidate_paths(udid)):
            if not metrics_path.is_file() or metrics_path.stat().st_size == 0:
                continue

            try:
                payload = json.loads(metrics_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue

            if not isinstance(payload, dict):
                continue

            latest_payload = payload

            if predicate(payload):
                return payload

        time.sleep(0.2)

    raise AssertionError(f"Timed out waiting for matching editor metrics. Latest payload: {latest_payload}")


def _launch_standalone_and_capture_editor_metrics(
    session: dict[str, object],
    *,
    predicate=None,
    timeout_seconds: float = 20.0,
    extra_child_env: dict[str, str] | None = None,
) -> dict[str, object]:
    module = session["module"]
    udid = session["udid"]
    module.clear_editor_metrics_output(udid)
    env = os.environ.copy()

    if extra_child_env is not None:
        for key, value in extra_child_env.items():
            env[f"SIMCTL_CHILD_{key}"] = value

    subprocess.run(
        [
            "xcrun",
            "simctl",
            "launch",
            "--terminate-running-process",
            udid,
            CONTAINER_BUNDLE_ID,
        ],
        cwd=REPO_ROOT,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )

    try:
        return _wait_for_editor_metrics_matching(
            session,
            predicate or (lambda payload: bool(payload.get("screenMode"))),
            timeout_seconds=timeout_seconds,
        )
    finally:
        module.run_allow_failure(["xcrun", "simctl", "terminate", udid, CONTAINER_BUNDLE_ID])


def _prepare_dev_server_root(
    destination: Path,
    *,
    title: str,
    html_marker: str,
    js_marker: str,
    reset: bool = True,
) -> Path:
    if reset and destination.exists():
        shutil.rmtree(destination)

    if not destination.exists():
        _stage_bundle_root(destination)

    html_path = destination / "patch_gui" / "index.ios.html"
    html_text = IOS_PATCH_HOST_HTML.read_text(encoding="utf-8")
    html_text = html_text.replace("<title>Cosimo Synth</title>", f"<title>{title}</title>")
    html_text = html_text.replace(
        "    const boot = await loadBootConfig();\n",
        f'    globalThis.__COSIMO_DEV_HTML_MARKER = "{html_marker}";\n'
        "    const boot = await loadBootConfig();\n",
        1,
    )
    html_path.write_text(html_text, encoding="utf-8")

    host_runtime_path = destination / "patch_gui" / "index.ios-host.js"
    host_runtime_source = IOS_PATCH_HOST_RUNTIME.read_text(encoding="utf-8")
    host_runtime_path.write_text(
        f'globalThis.__COSIMO_DEV_JS_MARKER = "{js_marker}";\n{host_runtime_source}',
        encoding="utf-8",
    )

    return destination


def _write_repo_dev_server_markers(
    *,
    title: str,
    html_marker: str,
    js_marker: str,
    base_html: str | None = None,
    base_js: str | None = None,
) -> tuple[str, str]:
    original_html = IOS_PATCH_HOST_HTML.read_text(encoding="utf-8")
    original_js = IOS_PATCH_HOST_RUNTIME.read_text(encoding="utf-8")
    html_source = original_html if base_html is None else base_html
    js_source = original_js if base_js is None else base_js

    html_text = html_source.replace("<title>Cosimo Synth</title>", f"<title>{title}</title>")
    html_text = html_text.replace(
        "    const boot = await loadBootConfig();\n",
        f'    globalThis.__COSIMO_DEV_HTML_MARKER = "{html_marker}";\n'
        "    const boot = await loadBootConfig();\n",
        1,
    )
    IOS_PATCH_HOST_HTML.write_text(html_text, encoding="utf-8")
    IOS_PATCH_HOST_RUNTIME.write_text(
        f'globalThis.__COSIMO_DEV_JS_MARKER = "{js_marker}";\n{js_source}',
        encoding="utf-8",
    )

    return original_html, original_js


def _restore_repo_dev_server_sources(original_html: str, original_js: str) -> None:
    IOS_PATCH_HOST_HTML.write_text(original_html, encoding="utf-8")
    IOS_PATCH_HOST_RUNTIME.write_text(original_js, encoding="utf-8")


class _QuietSimpleHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()


class _BundleServer:
    def __init__(
        self,
        root: Path,
        port: int | None = None,
        *,
        bind_host: str = "127.0.0.1",
        public_host: str | None = None,
    ) -> None:
        handler = functools.partial(_QuietSimpleHTTPRequestHandler, directory=str(root))
        self._server = http.server.ThreadingHTTPServer((bind_host, 0 if port is None else port), handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        visible_host = public_host or bind_host
        self.root_url = f"http://{visible_host}:{self._server.server_address[1]}/"

    def __enter__(self) -> str:
        self._thread.start()
        return self.root_url

    def __exit__(self, exc_type, exc, tb) -> None:
        self._server.shutdown()
        self._server.server_close()
        self._thread.join()


class _ViteDevServer:
    def __init__(self, *, host: str, port: int) -> None:
        self._host = host
        self._port = port
        self.root_url = f"http://{host}:{port}/"
        self._process: subprocess.Popen[str] | None = None

    def __enter__(self) -> str:
        local_vite = REPO_ROOT / "node_modules" / ".bin" / "vite"

        if not local_vite.is_file():
            subprocess.run(
                ["npm", "install", "--no-save", "vite@7.1.0"],
                cwd=REPO_ROOT,
                check=True,
                capture_output=True,
                text=True,
            )

        command = [str(local_vite)]

        self._process = subprocess.Popen(
            command
            + [
                "--host",
                self._host,
                "--port",
                str(self._port),
                "--config",
                "ios_auv3/vite.config.mjs",
            ],
            cwd=REPO_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        self._wait_until_ready()
        return self.root_url

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._process is None:
            return

        self._process.terminate()

        try:
            self._process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self._process.kill()
            self._process.wait(timeout=10)

    def _wait_until_ready(self) -> None:
        assert self._process is not None
        deadline = time.monotonic() + 30.0

        while time.monotonic() < deadline:
            if self._process.poll() is not None:
                stdout, _ = self._process.communicate(timeout=1)
                raise RuntimeError(f"Vite dev server exited early:\n{stdout}")

            try:
                with urlopen(f"{self.root_url}patch_gui/index.ios.html", timeout=0.5) as response:
                    if response.status == 200:
                        return
            except Exception:
                pass

            time.sleep(0.2)

        raise RuntimeError(f"Timed out waiting for the Vite dev server at {self.root_url}")


def _pick_unused_local_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.bind(("127.0.0.1", 0))
        return int(server.getsockname()[1])


def _detect_host_accessible_ip() -> str:
    return "127.0.0.1"


def _write_float32_mono_wav(
    destination: Path,
    *,
    sample_rate: int,
    frame_count: int,
    samples_per_frame: int = 2048,
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    total_samples = frame_count * samples_per_frame
    samples = bytearray()

    for sample_index in range(total_samples):
        phase = (sample_index % samples_per_frame) / samples_per_frame
        value = 0.25 * math.sin(phase * math.tau)
        samples.extend(struct.pack("<f", float(value)))

    data_chunk_size = len(samples)
    riff_chunk_size = 36 + data_chunk_size
    byte_rate = sample_rate * 4
    block_align = 4

    destination.write_bytes(
        b"RIFF"
        + struct.pack("<I", riff_chunk_size)
        + b"WAVE"
        + b"fmt "
        + struct.pack("<IHHIIHH", 16, 3, 1, sample_rate, byte_rate, block_align, 32)
        + b"data"
        + struct.pack("<I", data_chunk_size)
        + samples
    )


@pytest.fixture(scope="module")
def ios_host_smoke_result(tmp_path_factory: pytest.TempPathFactory) -> dict[str, object]:
    if platform.system() != "Darwin" or shutil.which("xcodebuild") is None:
        pytest.skip("The iOS host smoke run needs macOS and Xcode")

    output_dir = tmp_path_factory.mktemp("ios-host-smoke")
    output_path = output_dir / "host-smoke.json"

    subprocess.run(
        [
            "python3",
            str(IOS_AUV3_HOST_SMOKE),
            "--build-dir",
            str(output_dir / "build"),
            "--output",
            str(output_path),
        ],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )

    return json.loads(output_path.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def generated_ios_plugin_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    output_dir = tmp_path_factory.mktemp("ios-auv3-generated") / "generated" / "cmajor"

    subprocess.run(
        [str(IOS_AUV3_GENERATOR), str(output_dir)],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )

    return output_dir


@pytest.fixture(scope="module")
def ios_debug_host_session(tmp_path_factory: pytest.TempPathFactory) -> dict[str, object]:
    if platform.system() != "Darwin" or shutil.which("xcodebuild") is None:
        pytest.skip("The iOS debug host session needs macOS and Xcode")

    module = _load_ios_host_smoke_module()
    build_dir = tmp_path_factory.mktemp("ios-debug-host-session")
    phone_device = module.select_device(module.DEFAULT_PHONE_NAMES, "iPhone")
    udid = str(phone_device["udid"])
    dev_server_port = _pick_unused_local_port()
    dev_server_host = _detect_host_accessible_ip()
    dev_server_url = f"http://{dev_server_host}:{dev_server_port}/"
    module.boot_device(udid)

    previous_dev_server_url = os.environ.get("COSIMO_WEBVIEW_DEV_SERVER_URL")
    previous_editor_inspection = os.environ.get("COSIMO_ENABLE_EDITOR_INSPECTION")
    os.environ["COSIMO_WEBVIEW_DEV_SERVER_URL"] = dev_server_url

    try:
        products = module.build_project(build_dir, udid, configuration="Debug")
    finally:
        if previous_dev_server_url is None:
            os.environ.pop("COSIMO_WEBVIEW_DEV_SERVER_URL", None)
        else:
            os.environ["COSIMO_WEBVIEW_DEV_SERVER_URL"] = previous_dev_server_url

        if previous_editor_inspection is None:
            os.environ.pop("COSIMO_ENABLE_EDITOR_INSPECTION", None)
        else:
            os.environ["COSIMO_ENABLE_EDITOR_INSPECTION"] = previous_editor_inspection

    extension_bundle = _find_bundle_by_identifier(build_dir, EXTENSION_BUNDLE_ID, ".appex")

    for bundle_id in (CONTAINER_BUNDLE_ID, HOST_BUNDLE_ID):
        module.uninstall_if_present(udid, bundle_id)

    module.install_app(udid, products[CONTAINER_BUNDLE_ID])
    module.install_app(udid, products[HOST_BUNDLE_ID])
    module.prime_extension_registration(udid)
    module.run_host_mode(udid, "layout", "prime-layout.json")

    return {
        "module": module,
        "build_dir": build_dir,
        "udid": udid,
        "dev_server_host": dev_server_host,
        "dev_server_port": dev_server_port,
        "dev_server_url": dev_server_url,
        "container_app": products[CONTAINER_BUNDLE_ID],
        "host_app": products[HOST_BUNDLE_ID],
        "extension_bundle": extension_bundle,
    }


@pytest.fixture(scope="module")
def ios_release_host_session(tmp_path_factory: pytest.TempPathFactory) -> dict[str, object]:
    if platform.system() != "Darwin" or shutil.which("xcodebuild") is None:
        pytest.skip("The iOS release host session needs macOS and Xcode")

    module = _load_ios_host_smoke_module()
    build_dir = tmp_path_factory.mktemp("ios-release-host-session")
    phone_device = module.select_device(module.DEFAULT_PHONE_NAMES, "iPhone")
    udid = str(phone_device["udid"])
    dev_server_port = _pick_unused_local_port()
    dev_server_host = _detect_host_accessible_ip()
    dev_server_url = f"http://{dev_server_host}:{dev_server_port}/"
    module.boot_device(udid)

    previous_dev_server_url = os.environ.get("COSIMO_WEBVIEW_DEV_SERVER_URL")
    previous_editor_inspection = os.environ.get("COSIMO_ENABLE_EDITOR_INSPECTION")
    os.environ["COSIMO_WEBVIEW_DEV_SERVER_URL"] = dev_server_url
    os.environ["COSIMO_ENABLE_EDITOR_INSPECTION"] = "1"

    try:
        products = module.build_project(build_dir, udid, configuration="Release")
    finally:
        if previous_dev_server_url is None:
            os.environ.pop("COSIMO_WEBVIEW_DEV_SERVER_URL", None)
        else:
            os.environ["COSIMO_WEBVIEW_DEV_SERVER_URL"] = previous_dev_server_url

        if previous_editor_inspection is None:
            os.environ.pop("COSIMO_ENABLE_EDITOR_INSPECTION", None)
        else:
            os.environ["COSIMO_ENABLE_EDITOR_INSPECTION"] = previous_editor_inspection

    extension_bundle = _find_bundle_by_identifier(build_dir, EXTENSION_BUNDLE_ID, ".appex")

    for bundle_id in (CONTAINER_BUNDLE_ID, HOST_BUNDLE_ID):
        module.uninstall_if_present(udid, bundle_id)

    module.install_app(udid, products[CONTAINER_BUNDLE_ID])
    module.install_app(udid, products[HOST_BUNDLE_ID])
    module.prime_extension_registration(udid)
    module.run_host_mode(udid, "layout", "prime-layout.json")

    return {
        "module": module,
        "build_dir": build_dir,
        "udid": udid,
        "dev_server_host": dev_server_host,
        "dev_server_port": dev_server_port,
        "dev_server_url": dev_server_url,
        "container_app": products[CONTAINER_BUNDLE_ID],
        "host_app": products[HOST_BUNDLE_ID],
        "extension_bundle": extension_bundle,
    }


def test_ios_auv3_cmake_declares_the_repo_owned_shell_and_bundle_copy_contract() -> None:
    cmake_text = IOS_AUV3_CMAKE.read_text(encoding="utf-8")
    cmake = _normalise_whitespace(cmake_text)

    assert "project( CosimoSynthAUv3" in cmake
    assert "LANGUAGES CXX C OBJC OBJCXX" in cmake
    assert "FORMATS Standalone AUv3" in cmake
    assert "generate_ios_auv3_plugin.sh" in cmake_text
    assert "CosimoPluginMain.cpp" in cmake_text
    assert "CosimoSharedWavetableLibrary.mm" in cmake_text
    assert "Vendor/cmajor/include" in cmake_text
    assert "copy_directory" in cmake_text
    assert "$<TARGET_FILE_DIR:${bundle_target}>/patch_gui" in cmake_text
    assert "$<TARGET_FILE_DIR:${bundle_target}>/cmaj_api" in cmake_text
    assert "$<TARGET_FILE_DIR:${bundle_target}>/assets" in cmake_text
    assert "$<TARGET_FILE_DIR:${bundle_target}>/WavetableSynth.iOS.cmajorpatch" in cmake_text
    assert "COSIMO_REPO_ROOT_PATH" not in cmake_text
    assert "COSIMO_ENABLE_LIVE_REPO_RESOURCES" not in cmake_text
    assert "cmajor_plugin.cpp" not in cmake_text
    assert "cosimo_ios_auv3_generated_plugin" not in cmake_text


def test_repo_owned_patch_shell_keeps_the_bridge_entrypoints_the_ui_depends_on() -> None:
    plugin_main = IOS_PLUGIN_MAIN.read_text(encoding="utf-8")
    plugin_shell = IOS_PLUGIN_SHELL.read_text(encoding="utf-8")
    host_html = IOS_PATCH_HOST_HTML.read_text(encoding="utf-8")
    host_runtime = IOS_PATCH_HOST_RUNTIME.read_text(encoding="utf-8")

    assert '#include "CosimoCmajorPlugin.h"' in plugin_main
    assert '#include "cmajor/helpers/cmaj_JUCEPlugin.h"' not in plugin_main
    assert "GeneratedPlugin<::WavetableSynth>" in plugin_main

    assert 'view.bind ("cmaj_sendMessageToServer"' in plugin_shell
    assert 'view.bind ("_internalReadResource"' in plugin_shell
    assert 'view.bind ("_internalReadResourceAsAudioData"' in plugin_shell
    assert 'view.bind ("cmaj_getPatchBootConfig"' in plugin_shell
    assert 'view.bind ("cmaj_requestBundledFallback"' in plugin_shell
    assert "window.cmaj_deliverMessageFromServer" in plugin_shell

    assert "cmaj_getPatchBootConfig" in host_html
    assert "maybeRedirectToDevServer" in host_html
    assert 'await import(new URL("patch_gui/index.ios-host.js", resourceBaseURL).toString())' in host_html

    assert "globalThis.cmaj_deliverMessageFromServer" in host_runtime
    assert "globalThis.__cosimoPatchConnection = patchConnection;" in host_runtime
    assert "return globalThis._internalReadResource(path);" in host_runtime
    assert "return globalThis._internalReadResourceAsAudioData(path, annotation);" in host_runtime
    assert "globalThis.__cosimoInspectHostPage" in host_runtime
    assert "globalThis.cmaj_requestBundledFallback" in host_runtime or "cmaj_requestBundledFallback" in host_runtime


def test_ios_ui_dev_server_configuration_exists() -> None:
    package_json = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    vite_config = IOS_VITE_CONFIG.read_text(encoding="utf-8")

    assert package_json["scripts"]["ios:ui:dev"] == "vite --config ios_auv3/vite.config.mjs"
    assert "vite" in package_json["devDependencies"]
    assert 'serveStaticDirectory("/cmaj_api", cmajorApiRoot)' in vite_config
    assert 'host: "0.0.0.0"' in vite_config
    assert "strictPort: true" in vite_config
    assert "cors: true" in vite_config
    assert "port: 5173" in vite_config


def test_ios_patch_manifest_points_at_the_mobile_editor_entry() -> None:
    manifest = json.loads(IOS_AUV3_PATCH.read_text(encoding="utf-8"))

    assert manifest["view"]["src"] == "patch_gui/index.ios.js"
    assert "width" not in manifest["view"]
    assert "height" not in manifest["view"]
    assert manifest["view"]["resizable"] is True
    assert manifest["resources"] == []


@pytest.mark.skipif(
    platform.system() != "Darwin" or shutil.which("xcodebuild") is None,
    reason="Xcode project generation is only available on macOS with Xcode installed",
)
def test_ios_auv3_xcode_project_script_generates_an_xcode_project(tmp_path: Path) -> None:
    fake_juce = _write_fake_juce_checkout(tmp_path / "fake-juce")
    build_dir = tmp_path / "xcode-build"
    env = os.environ.copy()
    env["JUCE_PATH"] = str(fake_juce)
    env["COSIMO_IOS_SYSROOT"] = "iphonesimulator"

    result = subprocess.run(
        [str(IOS_AUV3_XCODE_PROJECT), str(build_dir)],
        cwd=REPO_ROOT,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )

    project_file = build_dir / "CosimoSynthAUv3.xcodeproj" / "project.pbxproj"

    assert project_file.is_file()
    assert f"Generated Xcode project in {build_dir}" in result.stdout

    project_text = project_file.read_text(encoding="utf-8")

    assert "CosimoSharedWavetableLibrary.mm" in project_text
    assert "CosimoSharedWavetableLibrary.entitlements" in project_text

    project_json = json.loads(
        subprocess.run(
            ["plutil", "-convert", "json", "-o", "-", str(project_file)],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    )
    root_object = project_json["rootObject"]
    target_attributes = project_json["objects"][root_object]["attributes"]["TargetAttributes"]
    target_names = {
        target["name"]: target_id
        for target_id, target in project_json["objects"].items()
        if target.get("isa") == "PBXNativeTarget"
        and target.get("name") in {"CosimoSynth_AUv3", "CosimoSynth_Standalone"}
    }

    for target_name, target_id in target_names.items():
        target_attributes_entry = target_attributes[target_id]
        assert target_attributes_entry["ProvisioningStyle"] == "Automatic", target_name
        assert (
            target_attributes_entry["SystemCapabilities"]["com.apple.ApplicationGroups.iOS"]["enabled"] == 1
        ), target_name


def test_ios_factory_library_zip_script_preserves_the_runtime_layout(tmp_path: Path) -> None:
    catalog_file = tmp_path / "factory-bank-catalog.json"
    source_dir = tmp_path / "factory_sources"
    output_path = tmp_path / "factory-library.zip"

    source_dir.mkdir(parents=True)
    catalog_file.write_text('{"tables":[{"tableId":"test","name":"Test","frameCount":1,"sourceWav":"assets/factory_sources/test.wav"}]}\n', encoding="utf-8")
    (source_dir / "test.wav").write_bytes(b"RIFFtest")

    subprocess.run(
        [
            str(IOS_FACTORY_LIBRARY_ZIP),
            "--catalog",
            str(catalog_file),
            "--sources",
            str(source_dir),
            "--output",
            str(output_path),
        ],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )

    with zipfile.ZipFile(output_path) as archive:
        assert archive.namelist() == [
            "assets/factory-bank-catalog.json",
            "assets/factory_sources/test.wav",
        ]
        assert archive.read("assets/factory-bank-catalog.json").decode("utf-8") == catalog_file.read_text(encoding="utf-8")
        assert archive.read("assets/factory_sources/test.wav") == b"RIFFtest"


def test_ios_auv3_generator_writes_raw_performer_source(generated_ios_plugin_dir: Path) -> None:
    performer_source = generated_ios_plugin_dir / "WavetableSynth.cpp"
    assert performer_source.is_file()

    source_text = performer_source.read_text(encoding="utf-8", errors="ignore")

    assert "struct WavetableSynth" in source_text
    assert "programDetailsJSON" in source_text
    assert '"wavetablePosition"' in source_text
    assert '"wavetableSelect"' in source_text
    assert '"wavetableLoadBegin"' in source_text
    assert '"wavetableMipFrame"' in source_text
    assert '"wavetableUploadAck"' in source_text
    assert '"wavetableMipRequest"' in source_text
    assert "createPluginFilter" not in source_text
    assert "GeneratedPlugin<::WavetableSynth>" not in source_text
    assert 'File {' not in source_text
    assert 'patch_gui/index.ios.js' not in source_text
    assert 'cmaj_api/' not in source_text


def test_shared_wavetable_library_source_keeps_the_app_group_and_backup_exclusion_hooks() -> None:
    helper_source = IOS_SHARED_LIBRARY_HELPER.read_text(encoding="utf-8")
    helper_header = IOS_SHARED_LIBRARY_HELPER_HEADER.read_text(encoding="utf-8")
    entitlements = IOS_SHARED_LIBRARY_ENTITLEMENTS.read_text(encoding="utf-8")

    assert "group.dev.cosimo.wavetable-synth" in helper_header
    assert "containerURLForSecurityApplicationGroupIdentifier" in helper_source
    assert "NSURLIsExcludedFromBackupKey" in helper_source
    assert "com.apple.security.application-groups" in entitlements
    assert "group.dev.cosimo.wavetable-synth" in entitlements


def test_ios_auv3_generator_rejects_a_missing_patch_file(tmp_path: Path) -> None:
    missing_patch = tmp_path / "missing.cmajorpatch"
    output_dir = tmp_path / "generated" / "cmajor"

    result = subprocess.run(
        [str(IOS_AUV3_GENERATOR), str(output_dir), str(missing_patch)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert f"Patch file not found: {missing_patch}" in result.stderr


def test_ios_auv3_generator_rejects_the_repo_root_as_output_directory() -> None:
    result = subprocess.run(
        [str(IOS_AUV3_GENERATOR), str(REPO_ROOT)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert f"Refusing to overwrite unsafe output directory: {REPO_ROOT}" in result.stderr


def test_ios_auv3_generator_rejects_an_output_directory_outside_the_repo_workspace(tmp_path: Path) -> None:
    outside_output = tmp_path / "not-the-build-layout"

    result = subprocess.run(
        [str(IOS_AUV3_GENERATOR), str(outside_output)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert (
        "Refusing to write outside the repo workspace unless the path ends with generated/cmajor"
        in result.stderr
    )


def test_ios_auv3_generator_rejects_a_repo_root_like_output_directory() -> None:
    repo_root_like_output = REPO_ROOT / "build" / ".."

    result = subprocess.run(
        [str(IOS_AUV3_GENERATOR), str(repo_root_like_output)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert f"Refusing to overwrite unsafe output directory: {REPO_ROOT}" in result.stderr


def test_ios_auv3_generator_refuses_to_overwrite_an_unrelated_non_empty_directory(tmp_path: Path) -> None:
    parent = REPO_ROOT / "build" / "pytest-current"
    parent.mkdir(parents=True, exist_ok=True)
    output_dir = Path(tempfile.mkdtemp(prefix="generator-keep-me-", dir=parent))

    try:
        sentinel = output_dir / "do-not-delete.txt"
        sentinel.write_text("important\n", encoding="utf-8")

        result = subprocess.run(
            [str(IOS_AUV3_GENERATOR), str(output_dir)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )

        assert result.returncode != 0
        assert "Refusing to overwrite a non-empty directory that was not generated by this script" in result.stderr
        assert sentinel.read_text(encoding="utf-8") == "important\n"
    finally:
        shutil.rmtree(output_dir, ignore_errors=True)


def test_built_app_and_extension_bundles_include_runtime_files(
    ios_debug_host_session: dict[str, object],
) -> None:
    app_bundle = ios_debug_host_session["container_app"]
    extension_bundle = ios_debug_host_session["extension_bundle"]

    for bundle_root in (app_bundle, extension_bundle):
        assert (bundle_root / "patch_gui" / "index.ios.html").is_file()
        assert (bundle_root / "patch_gui" / "index.ios-host.js").is_file()
        assert (bundle_root / "patch_gui" / "index.ios.js").is_file()
        assert (bundle_root / "patch_gui" / "index.js").is_file()
        assert (bundle_root / "cmaj_api" / "cmaj-patch-view.js").is_file()
        assert (bundle_root / "cmaj_api" / "cmaj-patch-connection.js").is_file()
        assert (bundle_root / "assets" / "factory-bank-catalog.json").is_file()
        assert (bundle_root / "assets" / "factory_sources" / "display-demo.wav").is_file()
        assert (bundle_root / "WavetableSynth.iOS.cmajorpatch").is_file()
        assert (bundle_root / "WavetableSynth.cmajorpatch").is_file()


def test_actual_built_bundle_roots_load_the_runtime_patch_and_ui_files(
    ios_debug_host_session: dict[str, object],
) -> None:
    build_root = ios_debug_host_session["build_dir"]
    app_bundle = ios_debug_host_session["container_app"]
    extension_bundle = ios_debug_host_session["extension_bundle"]

    with _BundleServer(build_root) as root_url:
        node_env = os.environ.copy()
        node_env["COSIMO_APP_ROOT_URL"] = f"{root_url}{_url_path_from_root(build_root, app_bundle)}/"
        node_env["COSIMO_EXTENSION_ROOT_URL"] = f"{root_url}{_url_path_from_root(build_root, extension_bundle)}/"

        subprocess.run(
            [
                "node",
                "--input-type=module",
                "-e",
                """
import {
    loadFactoryBankCatalogFromPatch,
    loadFactoryBankFramesFromPatch,
    parseWaveFile,
} from "./patch_gui/wavetable-bank.mjs";

async function fetchJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Could not fetch ${url}: ${response.status}`);
    }

    return response.json();
}

async function loadBundle(rootUrl) {
    const manifest = await fetchJSON(new URL("WavetableSynth.iOS.cmajorpatch", rootUrl));
    const patchConnection = {
        manifest,
        getResourceAddress(path) {
            return new URL(path, rootUrl);
        },
    };
    const catalog = await loadFactoryBankCatalogFromPatch(patchConnection);
    const bank = await loadFactoryBankFramesFromPatch(patchConnection, { tableIndex: 0 });
    const firstTable = catalog.tables[0];
    const sourceResponse = await fetch(new URL(firstTable.sourceWav, rootUrl));

    if (!sourceResponse.ok) {
        throw new Error(`Could not fetch source wavetable from ${rootUrl}`);
    }

    const sourceWave = parseWaveFile(await sourceResponse.arrayBuffer());
    const viewResponse = await fetch(new URL(manifest.view.src, rootUrl));

    if (!viewResponse.ok) {
        throw new Error(`Could not fetch view module from ${rootUrl}`);
    }

    const htmlResponse = await fetch(new URL("patch_gui/index.ios.html", rootUrl));

    if (!htmlResponse.ok) {
        throw new Error(`Could not fetch iOS host page from ${rootUrl}`);
    }

    const htmlSource = await htmlResponse.text();
    const viewSource = await viewResponse.text();

    return {
        sampleRate: bank.sampleRate,
        frameCount: bank.frameCount,
        frameLength: bank.frames[0]?.length,
        uploadedSampleCount: bank.samples.length,
        catalogTableCount: catalog.tables.length,
        firstTableName: firstTable?.name,
        firstTableSourceWav: firstTable?.sourceWav,
        expectedFrameCount: firstTable?.frameCount,
        expectedSampleCount: sourceWave.samples.length,
        hasIOSHostPage: htmlSource.includes("cmaj-view-container"),
        hasIOSHostRuntimeImport: htmlSource.includes("patch_gui/index.ios-host.js"),
        hasPatchViewFactory: viewSource.includes("createPatchViewWithOptions") || viewSource.includes("createIOSPatchView"),
    };
}

const app = await loadBundle(process.env.COSIMO_APP_ROOT_URL);
const extension = await loadBundle(process.env.COSIMO_EXTENSION_ROOT_URL);

for (const bundle of [app, extension]) {
    if (bundle.sampleRate !== 44100) {
        throw new Error(`Unexpected sample rate: ${JSON.stringify(bundle)}`);
    }

    if (bundle.frameCount !== bundle.expectedFrameCount) {
        throw new Error(`Unexpected frame count: ${JSON.stringify(bundle)}`);
    }

    if (bundle.uploadedSampleCount !== bundle.expectedSampleCount) {
        throw new Error(`Unexpected uploaded sample count: ${JSON.stringify(bundle)}`);
    }

    if (bundle.frameLength !== 2048) {
        throw new Error(`Unexpected frame length: ${JSON.stringify(bundle)}`);
    }

    if (bundle.firstTableSourceWav !== "assets/factory_sources/display-demo.wav") {
        throw new Error(`Unexpected first table source wav: ${JSON.stringify(bundle)}`);
    }

    if (!bundle.hasIOSHostPage || !bundle.hasIOSHostRuntimeImport || !bundle.hasPatchViewFactory) {
        throw new Error(`The built bundle did not include the expected runtime UI files: ${JSON.stringify(bundle)}`);
    }

    if (bundle.catalogTableCount < 2) {
        throw new Error(`Catalog did not include multiple tables: ${JSON.stringify(bundle)}`);
    }
}
""",
            ],
            cwd=REPO_ROOT,
            env=node_env,
            check=True,
            capture_output=True,
            text=True,
        )


def test_debug_editor_loads_modified_dev_server_html_and_js_without_rebuilding(
    ios_debug_host_session: dict[str, object],
    tmp_path: Path,
) -> None:
    _set_factory_library_state(ios_debug_host_session, ready=True)
    dev_root = _prepare_dev_server_root(
        tmp_path / "dev-root",
        title="Cosimo Dev HTML V1",
        html_marker="html-v1",
        js_marker="js-v1",
    )

    with _BundleServer(
        dev_root,
        port=ios_debug_host_session["dev_server_port"],
        bind_host="0.0.0.0",
        public_host=ios_debug_host_session["dev_server_host"],
    ) as root_url:
        assert root_url == ios_debug_host_session["dev_server_url"]
        opened = _run_host_mode(
            ios_debug_host_session,
            "inspect-open",
            terminate_after_output=False,
        )
        assert opened["editor"]["opened"] is True

        first_metrics = _wait_for_editor_metrics_matching(
            ios_debug_host_session,
            lambda payload: (
                isinstance(payload.get("hostPage"), dict)
                and payload["hostPage"].get("bootSource") == "devServer"
                and payload["hostPage"].get("documentTitle") == "Cosimo Dev HTML V1"
                and payload["hostPage"].get("htmlMarker") == "html-v1"
                and payload["hostPage"].get("jsMarker") == "js-v1"
            ),
            timeout_seconds=20.0,
        )
        first_host_page = first_metrics["hostPage"]
        assert first_host_page["bootSource"] == "devServer"
        assert first_host_page["documentTitle"] == "Cosimo Dev HTML V1"
        assert first_host_page["htmlMarker"] == "html-v1"
        assert first_host_page["jsMarker"] == "js-v1"
        assert first_host_page["currentURL"].startswith(root_url)

        ios_debug_host_session["module"].run_allow_failure(
            ["xcrun", "simctl", "terminate", ios_debug_host_session["udid"], HOST_BUNDLE_ID]
        )

        _prepare_dev_server_root(
            dev_root,
            title="Cosimo Dev HTML V2",
            html_marker="html-v2",
            js_marker="js-v2",
            reset=False,
        )

        reopened = _run_host_mode(
            ios_debug_host_session,
            "inspect-open",
            terminate_after_output=False,
        )
        assert reopened["editor"]["opened"] is True

        second_metrics = _wait_for_editor_metrics_matching(
            ios_debug_host_session,
            lambda payload: (
                isinstance(payload.get("hostPage"), dict)
                and payload["hostPage"].get("bootSource") == "devServer"
                and payload["hostPage"].get("documentTitle") == "Cosimo Dev HTML V2"
                and payload["hostPage"].get("htmlMarker") == "html-v2"
                and payload["hostPage"].get("jsMarker") == "js-v2"
            ),
            timeout_seconds=20.0,
        )
        second_host_page = second_metrics["hostPage"]
        assert second_host_page["bootSource"] == "devServer"
        assert second_host_page["documentTitle"] == "Cosimo Dev HTML V2"
        assert second_host_page["htmlMarker"] == "html-v2"
        assert second_host_page["jsMarker"] == "js-v2"

    ios_debug_host_session["module"].run_allow_failure(
        ["xcrun", "simctl", "terminate", ios_debug_host_session["udid"], HOST_BUNDLE_ID]
    )


def test_debug_editor_live_reloads_repo_html_and_js_from_vite_without_reopening(
    ios_debug_host_session: dict[str, object],
) -> None:
    _set_factory_library_state(ios_debug_host_session, ready=True)
    original_html, original_js = _write_repo_dev_server_markers(
        title="Cosimo Live HTML V1",
        html_marker="live-html-v1",
        js_marker="live-js-v1",
    )

    try:
        with _ViteDevServer(
            host=ios_debug_host_session["dev_server_host"],
            port=ios_debug_host_session["dev_server_port"],
        ) as root_url:
            assert root_url == ios_debug_host_session["dev_server_url"]
            opened = _run_host_mode(
                ios_debug_host_session,
                "inspect-open",
                terminate_after_output=False,
            )
            assert opened["editor"]["opened"] is True

            initial_metrics = _wait_for_editor_metrics_matching(
                ios_debug_host_session,
                lambda payload: (
                    isinstance(payload.get("hostPage"), dict)
                    and payload["hostPage"].get("bootSource") == "devServer"
                    and payload["hostPage"].get("documentTitle") == "Cosimo Live HTML V1"
                    and payload["hostPage"].get("htmlMarker") == "live-html-v1"
                    and payload["hostPage"].get("jsMarker") == "live-js-v1"
                ),
                timeout_seconds=20.0,
            )
            initial_host_page = initial_metrics["hostPage"]

            assert initial_host_page["bootSource"] == "devServer"
            assert initial_host_page["documentTitle"] == "Cosimo Live HTML V1"
            assert initial_host_page["htmlMarker"] == "live-html-v1"
            assert initial_host_page["jsMarker"] == "live-js-v1"

            _write_repo_dev_server_markers(
                title="Cosimo Live HTML V2",
                html_marker="live-html-v2",
                js_marker="live-js-v2",
                base_html=original_html,
                base_js=original_js,
            )

            updated_metrics = _wait_for_editor_metrics_matching(
                ios_debug_host_session,
                lambda payload: (
                    isinstance(payload.get("hostPage"), dict)
                    and payload["hostPage"].get("bootSource") == "devServer"
                    and payload["hostPage"].get("documentTitle") == "Cosimo Live HTML V2"
                    and payload["hostPage"].get("htmlMarker") == "live-html-v2"
                    and payload["hostPage"].get("jsMarker") == "live-js-v2"
                ),
                timeout_seconds=20.0,
            )

            updated_host_page = updated_metrics["hostPage"]
            assert updated_host_page["documentTitle"] == "Cosimo Live HTML V2"
            assert updated_host_page["htmlMarker"] == "live-html-v2"
            assert updated_host_page["jsMarker"] == "live-js-v2"
    finally:
        _restore_repo_dev_server_sources(original_html, original_js)
        ios_debug_host_session["module"].run_allow_failure(
            ["xcrun", "simctl", "terminate", ios_debug_host_session["udid"], HOST_BUNDLE_ID]
        )


def test_debug_editor_falls_back_to_the_bundled_ui_when_the_dev_server_is_unavailable(
    ios_debug_host_session: dict[str, object],
    tmp_path: Path,
) -> None:
    _set_factory_library_state(ios_debug_host_session, ready=True)
    dev_root = _prepare_dev_server_root(
        tmp_path / "fallback-root",
        title="Cosimo Dev HTML Fallback",
        html_marker="html-fallback",
        js_marker="js-fallback",
    )

    with _BundleServer(
        dev_root,
        port=ios_debug_host_session["dev_server_port"],
        bind_host="0.0.0.0",
        public_host=ios_debug_host_session["dev_server_host"],
    ) as root_url:
        assert root_url == ios_debug_host_session["dev_server_url"]
        opened = _run_host_mode(
            ios_debug_host_session,
            "inspect-open",
            terminate_after_output=False,
        )
        assert opened["editor"]["opened"] is True

        warmup = _wait_for_editor_metrics_matching(
            ios_debug_host_session,
            lambda payload: (
                isinstance(payload.get("hostPage"), dict)
                and payload["hostPage"].get("bootSource") == "devServer"
                and payload["hostPage"].get("htmlMarker") == "html-fallback"
                and payload["hostPage"].get("jsMarker") == "js-fallback"
            ),
            timeout_seconds=20.0,
        )
        assert warmup["hostPage"]["bootSource"] == "devServer"

    ios_debug_host_session["module"].run_allow_failure(
        ["xcrun", "simctl", "terminate", ios_debug_host_session["udid"], HOST_BUNDLE_ID]
    )

    fallback = _run_host_mode(ios_debug_host_session, "inspect")

    host_page = fallback["editor"]["hostPage"]
    assert host_page["bootSource"] == "bundle"
    assert host_page["documentTitle"] == "Cosimo Synth"
    assert host_page["htmlMarker"] == ""
    assert host_page["jsMarker"] == ""
    assert host_page["currentURL"] == host_page["bundlePageURL"]


def test_auv3_without_the_shared_library_shows_the_non_webview_gate_screen(
    ios_debug_host_session: dict[str, object],
) -> None:
    _set_factory_library_state(ios_debug_host_session, ready=False)
    result = _run_host_mode(ios_debug_host_session, "inspect")
    editor = result["editor"]

    assert editor["opened"] is True
    assert editor["closed"] is True
    assert editor["screenMode"] == "extensionUnavailable"
    assert "Patch view hidden." in editor["domMetricsError"]


def test_standalone_without_the_shared_library_shows_the_installer_screen(
    ios_debug_host_session: dict[str, object],
) -> None:
    _set_factory_library_state(ios_debug_host_session, ready=False)
    editor_metrics = _launch_standalone_and_capture_editor_metrics(ios_debug_host_session)

    assert editor_metrics["screenMode"] == "standaloneInstaller"
    assert editor_metrics["error"] == "Patch view hidden."


def test_editor_reads_the_factory_catalog_from_the_shared_library_when_installed(
    ios_debug_host_session: dict[str, object],
) -> None:
    unique_name = "Shared Library Override Table"
    _set_factory_library_state(ios_debug_host_session, ready=True, first_table_name=unique_name)
    editor_metrics = _launch_standalone_and_capture_editor_metrics(
        ios_debug_host_session,
        predicate=lambda payload: (
            payload.get("screenMode") == "patchView"
            and isinstance(payload.get("catalog"), dict)
            and payload["catalog"].get("firstTableName") == unique_name
        ),
        timeout_seconds=30.0,
    )

    assert editor_metrics["screenMode"] == "patchView"
    assert editor_metrics["hostPage"]["bootSource"] == "bundle"
    assert editor_metrics["catalog"]["firstTableName"] == unique_name
    assert editor_metrics["catalog"]["firstTableSourceWav"] == "assets/factory_sources/display-demo.wav"
    assert editor_metrics["catalog"]["firstTableAudioSampleRate"] == 44100
    assert editor_metrics["catalog"]["firstTableAudioFrameCount"] > 0
    assert editor_metrics["catalog"]["firstTableAudioError"] == ""
    assert editor_metrics["catalog"]["tableCount"] >= 2


def test_editor_reads_shared_library_audio_from_the_app_group_for_bs2_acid(
    ios_debug_host_session: dict[str, object],
) -> None:
    acid_path = "assets/factory_sources/imported/BS2 - Acid.wav"
    unique_name = "Shared Library Acid Override"
    repo_catalog = json.loads((REPO_ROOT / "assets" / "factory-bank-catalog.json").read_text(encoding="utf-8"))
    acid_table = next((table for table in repo_catalog["tables"] if table["sourceWav"] == acid_path), None)
    assert acid_table is not None, f"Could not find {acid_path} in the runtime catalog"
    _set_factory_library_state(
        ios_debug_host_session,
        ready=True,
        first_table_name=unique_name,
        first_table_source_wav=acid_path,
        first_table_frame_count=int(acid_table["frameCount"]),
        first_table_sample_rate=22050,
    )
    editor_metrics = _launch_standalone_and_capture_editor_metrics(
        ios_debug_host_session,
        predicate=lambda payload: (
            payload.get("screenMode") == "patchView"
            and isinstance(payload.get("catalog"), dict)
            and payload["catalog"].get("firstTableName") == unique_name
            and payload["catalog"].get("firstTableSourceWav") == acid_path
            and payload["catalog"].get("firstTableAudioSampleRate") == 22050
        ),
        timeout_seconds=30.0,
    )
    catalog = editor_metrics["catalog"]

    assert editor_metrics["screenMode"] == "patchView"
    assert catalog["firstTableName"] == unique_name
    assert catalog["firstTableSourceWav"] == acid_path
    assert catalog["firstTableAudioSampleRate"] == 22050
    assert catalog["firstTableAudioFrameCount"] > 0
    assert catalog["firstTableAudioError"] == ""


def test_incomplete_shared_library_keeps_the_standalone_installer_screen(
    ios_debug_host_session: dict[str, object],
) -> None:
    _set_factory_library_state(ios_debug_host_session, ready=True)
    repo_catalog = json.loads((REPO_ROOT / "assets" / "factory-bank-catalog.json").read_text(encoding="utf-8"))
    first_table_source = repo_catalog["tables"][0]["sourceWav"]

    for install_root in sorted(_factory_library_install_roots(ios_debug_host_session)):
        broken_source_file = install_root / first_table_source

        if broken_source_file.exists():
            broken_source_file.unlink()

    editor_metrics = _launch_standalone_and_capture_editor_metrics(
        ios_debug_host_session,
        predicate=lambda payload: payload.get("screenMode") == "standaloneInstaller",
        timeout_seconds=30.0,
    )

    assert editor_metrics["screenMode"] == "standaloneInstaller"
    assert editor_metrics["error"] == "Patch view hidden."


def test_editor_runtime_bridge_receives_runtime_endpoint_events(
    ios_debug_host_session: dict[str, object],
) -> None:
    _set_factory_library_state(ios_debug_host_session, ready=True)
    result = _run_host_mode(ios_debug_host_session, "inspect")
    runtime = result["editor"]["runtime"]

    assert result["editor"]["screenMode"] == "patchView"
    assert runtime["hasRuntimeStateEvent"] is True
    assert isinstance(runtime["latestRuntimeState"], dict)
    assert runtime["latestRuntimeState"]["serviceState"] in (0, 1, 2, 3)
    assert runtime["latestRuntimeState"]["desiredTableIndex"] >= 0


def test_release_editor_ignores_the_dev_server_url(
    ios_release_host_session: dict[str, object],
    tmp_path: Path,
) -> None:
    _set_factory_library_state(ios_release_host_session, ready=True)
    dev_root = _prepare_dev_server_root(
        tmp_path / "release-root",
        title="Cosimo Release Should Ignore This",
        html_marker="html-release",
        js_marker="js-release",
    )

    with _BundleServer(
        dev_root,
        port=ios_release_host_session["dev_server_port"],
        bind_host="0.0.0.0",
        public_host=ios_release_host_session["dev_server_host"],
    ) as root_url:
        assert root_url == ios_release_host_session["dev_server_url"]
        result = _run_host_mode(ios_release_host_session, "inspect")

    host_page = result["editor"]["hostPage"]
    assert host_page["bootSource"] == "bundle"
    assert host_page["devServerURL"] == ""
    assert host_page["documentTitle"] == "Cosimo Synth"
    assert host_page["htmlMarker"] == ""
    assert host_page["jsMarker"] == ""
    assert host_page["currentURL"] == host_page["bundlePageURL"]

def test_ios_host_smoke_discovers_the_extension_and_restores_state_across_relaunch(
    ios_host_smoke_result: dict[str, object],
) -> None:
    phone = ios_host_smoke_result["phone"]
    parameter_set = phone["parameterSet"]
    table_selection_set = phone["tableSelectionSet"]
    state = phone["state"]
    host_page = phone["editor"]["hostPage"]

    assert phone["discover"]["matchedComponents"] >= 1
    assert phone["instantiate"]["componentName"] == "Cosimo Synth"
    assert phone["audio"]["peakRMS"] > 0.001
    assert phone["editor"]["opened"] is True
    assert phone["editor"]["closed"] is True
    assert phone["editor"]["screenMode"] == "patchView"
    assert host_page["bootSource"] == "bundle"
    assert host_page["currentURL"] == host_page["bundlePageURL"]
    assert parameter_set["identifier"] == "wavetablePosition"
    assert parameter_set["requestedValue"] == pytest.approx(0.625, abs=0.001)
    assert parameter_set["observedValue"] == pytest.approx(0.625, abs=0.001)
    assert table_selection_set["identifier"] == "wavetableSelect"
    assert table_selection_set["requestedValue"] == pytest.approx(5.0, abs=0.001)
    assert table_selection_set["observedValue"] == pytest.approx(5.0, abs=0.001)
    assert state["savedStateSource"] in {"fullStateForDocument", "fullState"}
    assert state["reloadStateSource"] == state["savedStateSource"]
    assert state["relaunchStateSource"] == state["savedStateSource"]
    assert state["reloadObservedValue"] == pytest.approx(0.625, abs=0.001)
    assert state["reloadObservedTableSelect"] == pytest.approx(5.0, abs=0.001)
    assert state["relaunchObservedValue"] == pytest.approx(0.625, abs=0.001)
    assert state["relaunchObservedTableSelect"] == pytest.approx(5.0, abs=0.001)
    assert state["parameterSchemaMatchesRelaunch"] is True


def test_ios_host_smoke_freezes_parameter_and_state_shape(
    ios_host_smoke_result: dict[str, object],
) -> None:
    expected = json.loads(IOS_AUV3_HOST_SNAPSHOT.read_text(encoding="utf-8"))
    phone = ios_host_smoke_result["phone"]

    assert phone["parameters"] == expected["parameters"]
    assert phone["state"]["savedStateKeys"] == expected["savedStateKeys"]
    assert phone["state"]["savedStateSource"] == expected["savedStateSource"]


def test_ios_host_smoke_keeps_the_editor_inside_phone_and_tablet_viewports(
    ios_host_smoke_result: dict[str, object],
) -> None:
    for device_name in ("phone", "tablet"):
        editor = ios_host_smoke_result[device_name]["editor"]

        assert editor["opened"] is True
        assert editor["closed"] is True
        assert editor["screenMode"] == "patchView"
        assert editor["hostPage"]["bootSource"] == "bundle"
        assert editor["preferredWidth"] <= editor["containerWidth"]
        assert editor["preferredHeight"] <= editor["containerHeight"]
        assert editor["viewWidth"] <= editor["containerWidth"]
        assert editor["viewHeight"] <= editor["containerHeight"]

        dom_metrics = editor["domMetrics"]

        assert dom_metrics["keyboardBottomGap"] <= 1.0
        assert dom_metrics["footerBottomGap"] <= 1.0
