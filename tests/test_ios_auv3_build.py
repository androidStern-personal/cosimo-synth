from __future__ import annotations

import functools
import http.server
import json
import os
import platform
import shutil
import subprocess
import threading
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
IOS_AUV3_CMAKE = REPO_ROOT / "ios_auv3" / "CMakeLists.txt"
IOS_AUV3_GENERATOR = REPO_ROOT / "scripts" / "generate_ios_auv3_plugin.sh"
IOS_AUV3_XCODE_PROJECT = REPO_ROOT / "scripts" / "generate_ios_auv3_xcode_project.sh"
IOS_AUV3_HOST_SMOKE = REPO_ROOT / "scripts" / "run_ios_auv3_host_smoke.py"
IOS_AUV3_PATCH = REPO_ROOT / "WavetableSynth.iOS.cmajorpatch"
IOS_AUV3_HOST_SNAPSHOT = REPO_ROOT / "ios_auv3" / "expected_host_smoke.json"


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
    shutil.copy2(REPO_ROOT / "WavetableSynth.cmajorpatch", destination / "WavetableSynth.cmajorpatch")
    shutil.copy2(REPO_ROOT / "WavetableSynth.iOS.cmajorpatch", destination / "WavetableSynth.iOS.cmajorpatch")
    shutil.copytree(REPO_ROOT / "assets", destination / "assets")
    shutil.copytree(REPO_ROOT / "patch_gui", destination / "patch_gui")


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


class _QuietSimpleHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return


class _BundleServer:
    def __init__(self, root: Path) -> None:
        handler = functools.partial(_QuietSimpleHTTPRequestHandler, directory=str(root))
        self._server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self.root_url = f"http://127.0.0.1:{self._server.server_address[1]}/"

    def __enter__(self) -> str:
        self._thread.start()
        return self.root_url

    def __exit__(self, exc_type, exc, tb) -> None:
        self._server.shutdown()
        self._server.server_close()
        self._thread.join()

@pytest.fixture(scope="module")
def generated_ios_plugin_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    output_dir = tmp_path_factory.mktemp("ios-auv3-generated")

    subprocess.run(
        [str(IOS_AUV3_GENERATOR), str(output_dir)],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )

    return output_dir


def test_ios_auv3_cmake_keeps_the_ios_shell_separate_from_the_desktop_loader() -> None:
    cmake_text = IOS_AUV3_CMAKE.read_text(encoding="utf-8")
    cmake = _normalise_whitespace(cmake_text)

    assert "project( CosimoSynthAUv3" in cmake
    assert "LANGUAGES CXX C OBJC OBJCXX" in cmake
    assert "FORMATS Standalone AUv3" in cmake
    assert "generate_ios_auv3_plugin.sh" in cmake_text
    assert "WavetableSynth.iOS.cmajorpatch" in cmake_text
    assert "cmajor_plugin.cpp" in cmake_text
    assert "cmaj_StaticLibraryShim.cpp" in cmake_text
    assert "CosimoSynthHost" in cmake_text
    assert "CosimoHostMain.mm" in cmake_text
    assert "CosimoHostViewController.mm" in cmake_text
    assert "CosimoAUv3HostHarness.mm" in cmake_text
    assert "CosimoStandaloneApp.cpp" not in cmake_text
    assert "JUCE_USE_CUSTOM_PLUGIN_STANDALONE_APP=1" not in cmake_text
    assert "COSIMO_PATCH_PATH" not in cmake_text
    assert "CMAJOR_SOURCE_PATH" not in cmake_text
    assert "libCmajPerformer" not in cmake_text
    assert "CMAJOR_DLL=1" not in cmake_text
    assert "modules/compiler/src" not in cmake_text


def test_ios_patch_manifest_points_at_the_mobile_editor_entry() -> None:
    manifest = json.loads(IOS_AUV3_PATCH.read_text(encoding="utf-8"))

    assert manifest["view"]["src"] == "patch_gui/index.ios.js"
    assert manifest["view"]["width"] == 393
    assert manifest["view"]["height"] == 648
    assert manifest["view"]["background"] == "#07090d"
    assert manifest["view"]["resizable"] is True

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

    assert (build_dir / "CosimoSynthAUv3.xcodeproj" / "project.pbxproj").is_file()
    assert f"Generated Xcode project in {build_dir}" in result.stdout


def test_ios_auv3_generator_writes_self_contained_plugin_source_and_headers(
    generated_ios_plugin_dir: Path,
) -> None:
    assert (generated_ios_plugin_dir / "cmajor_plugin.cpp").is_file()
    assert (generated_ios_plugin_dir / "include/cmajor/helpers/cmaj_JUCEPlugin.h").is_file()
    assert (generated_ios_plugin_dir / "include/choc/choc/javascript/choc_javascript_QuickJS.h").is_file()
    assert (generated_ios_plugin_dir / "include/cmajor/helpers/cmaj_EmbeddedWebAssets.h").is_file()
    assert (generated_ios_plugin_dir / "include/cmajor/helpers/cmaj_PatchWebView.h").is_file()

    webview_header = (generated_ios_plugin_dir / "include/choc/choc/gui/choc_WebView.h").read_text(
        encoding="utf-8"
    )
    embedded_assets_header = (
        generated_ios_plugin_dir / "include/cmajor/helpers/cmaj_EmbeddedWebAssets.h"
    ).read_text(encoding="utf-8")
    patch_webview_header = (
        generated_ios_plugin_dir / "include/cmajor/helpers/cmaj_PatchWebView.h"
    ).read_text(encoding="utf-8")

    assert '#if CHOC_OSX' in webview_header
    assert 'if (options->transparentBackground)' in webview_header
    assert 'call<void> (webview, "setValue:forKey:", getNSNumberBool (false), getNSString ("drawsBackground"));' in webview_header
    assert '#endif' in webview_header
    assert 'auto surface = callClass<id> ("UIColor", "colorWithRed:green:blue:alpha:"' in webview_header
    assert 'call<void> (webview, "setOpaque:", (BOOL) 0);' in webview_header
    assert 'call<void> (webview, "setBackgroundColor:", surface);' in webview_header
    assert 'if (auto scrollView = call<id> (webview, "scrollView"))' in webview_header
    assert 'call<void> (scrollView, "setBackgroundColor:", surface);' in webview_header
    assert (
        '"            width:  view.clientWidth  - parseFloat (clientStyle.paddingLeft) - parseFloat (clientStyle.paddingRight),\\n"'
        in embedded_assets_header
    )
    assert (
        '"            height: view.clientHeight - parseFloat (clientStyle.paddingTop)  - parseFloat (clientStyle.paddingBottom)\\n"'
        in embedded_assets_header
    )
    assert (
        '"            width:  view.clientHeight - parseFloat (clientStyle.paddingTop)  - parseFloat (clientStyle.paddingBottom),\\n"'
        not in embedded_assets_header
    )
    assert (
        '"            height: view.clientWidth  - parseFloat (clientStyle.paddingLeft) - parseFloat (clientStyle.paddingRight)\\n"'
        not in embedded_assets_header
    )
    assert '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />' in patch_webview_header
    assert 'html { background: #07090d; overflow: hidden; }' in patch_webview_header
    assert 'body { display: block; position: absolute; width: 100%; height: 100%; color: white; background: #07090d;' in patch_webview_header
    assert '#cmaj-view-container { display: block; position: relative; width: 100%; height: 100%; overflow: auto; background: #07090d; }' in patch_webview_header
    assert 'if (view?.width > 10)' in embedded_assets_header
    assert 'if (view?.height > 10)' in embedded_assets_header
    assert 'const shouldUseFixedSize = ! view?.resizable;' not in embedded_assets_header


def test_ios_auv3_generator_rejects_a_missing_patch_file(tmp_path: Path) -> None:
    missing_patch = tmp_path / "missing.cmajorpatch"
    output_dir = tmp_path / "generated"

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


def test_generated_ios_plugin_embeds_the_bank_and_patch_ui_resources(
    generated_ios_plugin_dir: Path,
) -> None:
    plugin_source = (generated_ios_plugin_dir / "cmajor_plugin.cpp").read_text(
        encoding="utf-8",
        errors="ignore",
    )

    assert 'File { "assets/factory-bank.wav"' in plugin_source
    assert 'File { "patch_gui/factory-bank-manifest.js"' in plugin_source
    assert 'File { "patch_gui/index.ios.js"' in plugin_source
    assert 'File { "patch_gui/index.js"' in plugin_source
    assert 'File { "patch_gui/responsive-layout.js"' in plugin_source
    assert 'File { "patch_gui/wavetable-bank.js"' in plugin_source
    assert 'File { "patch_gui/wavetable-display.js"' in plugin_source
    assert "GeneratedPlugin<::WavetableSynth>" in plugin_source
    assert "COSIMO_PATCH_PATH" not in plugin_source
    assert "libCmajPerformer" not in plugin_source
    assert "createEngine = +[]" not in plugin_source


def test_bundle_root_resource_paths_work_for_both_app_and_extension(tmp_path: Path) -> None:
    staged_root = tmp_path / "bundles"
    app_root = staged_root / "app"
    extension_root = staged_root / "extension"
    app_root.mkdir(parents=True)
    extension_root.mkdir(parents=True)

    _stage_bundle_root(app_root)
    _stage_bundle_root(extension_root)

    with _BundleServer(staged_root) as root_url:
        node_env = os.environ.copy()
        node_env["COSIMO_APP_ROOT_URL"] = f"{root_url}app/"
        node_env["COSIMO_EXTENSION_ROOT_URL"] = f"{root_url}extension/"

        result = subprocess.run(
            [
                "node",
                "--input-type=module",
                "-e",
                """
import { loadFactoryBankFramesFromPatch } from "./patch_gui/wavetable-bank.mjs";

async function fetchJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Could not fetch ${url}: ${response.status}`);
    }

    return response.json();
}

async function loadBundle(rootUrl) {
    const manifest = await fetchJSON(new URL("WavetableSynth.cmajorpatch", rootUrl));
    const bank = await loadFactoryBankFramesFromPatch({
        manifest,
        getResourceAddress(path) {
            return new URL(path, rootUrl);
        },
    });
    const viewResponse = await fetch(new URL(manifest.view.src, rootUrl));

    if (!viewResponse.ok) {
        throw new Error(`Could not fetch view module from ${rootUrl}`);
    }

    const viewSource = await viewResponse.text();

    if (!viewSource.includes("cosimo-synth-view")) {
        throw new Error(`View module did not load the expected UI from ${rootUrl}`);
    }

    return {
        sampleRate: bank.sampleRate,
        frameCount: bank.frameCount,
        frameLength: bank.frames[0]?.length,
        sampleBlobPath: bank.sampleBlobPath,
    };
}

const app = await loadBundle(process.env.COSIMO_APP_ROOT_URL);
const extension = await loadBundle(process.env.COSIMO_EXTENSION_ROOT_URL);

for (const bundle of [app, extension]) {
    if (bundle.sampleRate !== 44100) {
        throw new Error(`Unexpected sample rate: ${JSON.stringify(bundle)}`);
    }

    if (bundle.frameCount !== 16) {
        throw new Error(`Unexpected frame count: ${JSON.stringify(bundle)}`);
    }

    if (bundle.frameLength !== 2048) {
        throw new Error(`Unexpected frame length: ${JSON.stringify(bundle)}`);
    }

    if (bundle.sampleBlobPath !== "assets/factory-bank.wav") {
        throw new Error(`Unexpected sample blob path: ${JSON.stringify(bundle)}`);
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

    assert result.returncode == 0


def test_ios_host_smoke_discovers_the_extension_and_restores_state_across_relaunch(
    ios_host_smoke_result: dict[str, object],
) -> None:
    phone = ios_host_smoke_result["phone"]
    parameter_set = phone["parameterSet"]
    state = phone["state"]

    assert phone["discover"]["matchedComponents"] >= 1
    assert phone["instantiate"]["componentName"] == "Cosimo Synth"
    assert phone["audio"]["peakRMS"] > 0.001
    assert phone["editor"]["opened"] is True
    assert phone["editor"]["closed"] is True
    assert parameter_set["identifier"] == "wavetablePosition"
    assert parameter_set["requestedValue"] == pytest.approx(0.625, abs=0.001)
    assert parameter_set["observedValue"] == pytest.approx(0.625, abs=0.001)
    assert state["reloadObservedValue"] == pytest.approx(0.625, abs=0.001)
    assert state["relaunchObservedValue"] == pytest.approx(0.625, abs=0.001)
    assert state["parameterSchemaMatchesRelaunch"] is True


def test_ios_host_smoke_freezes_parameter_and_state_shape(
    ios_host_smoke_result: dict[str, object],
) -> None:
    expected = json.loads(IOS_AUV3_HOST_SNAPSHOT.read_text(encoding="utf-8"))
    phone = ios_host_smoke_result["phone"]

    assert phone["parameters"] == expected["parameters"]
    assert phone["state"]["savedStateKeys"] == expected["savedStateKeys"]


def test_ios_host_smoke_keeps_the_editor_inside_phone_and_tablet_viewports(
    ios_host_smoke_result: dict[str, object],
) -> None:
    for device_name in ("phone", "tablet"):
        editor = ios_host_smoke_result[device_name]["editor"]

        assert editor["opened"] is True
        assert editor["closed"] is True
        assert editor["preferredWidth"] <= editor["containerWidth"]
        assert editor["preferredHeight"] <= editor["containerHeight"]
        assert editor["viewWidth"] <= editor["containerWidth"]
        assert editor["viewHeight"] <= editor["containerHeight"]
