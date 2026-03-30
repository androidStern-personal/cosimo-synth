from __future__ import annotations

import functools
import http.server
import json
import os
import platform
import shutil
import subprocess
import threading
import zipfile
from pathlib import Path

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


def test_ios_auv3_cmake_uses_the_shared_stock_juce_plugin_targets() -> None:
    cmake_text = IOS_AUV3_CMAKE.read_text(encoding="utf-8")
    cmake = _normalise_whitespace(cmake_text)

    assert "project( CosimoSynthAUv3" in cmake
    assert "LANGUAGES CXX C OBJC OBJCXX" in cmake
    assert "FORMATS Standalone AUv3" in cmake
    assert "generate_ios_auv3_plugin.sh" in cmake_text
    assert "build_ios_factory_library_zip.sh" not in cmake_text
    assert "WavetableSynth.iOS.cmajorpatch" in cmake_text
    assert "cmajor/WavetableSynth.cmajor" in cmake_text
    assert "cmajor_plugin.cpp" in cmake_text
    assert "cmaj_StaticLibraryShim.cpp" in cmake_text
    assert "CosimoSharedWavetableLibrary.mm" in cmake_text
    assert "CosimoSharedWavetableLibrary.entitlements" in cmake_text
    assert "CosimoSynthHost" in cmake_text
    assert "CosimoHostMain.mm" in cmake_text
    assert "CosimoHostViewController.mm" in cmake_text
    assert "CosimoAUv3HostHarness.mm" in cmake_text
    assert "assets/factory-bank-catalog.json" in cmake_text
    assert "foreach(bundle_target CosimoSynth_Standalone CosimoSynth_AUv3)" in cmake_text
    assert 'copy_if_different' in cmake_text
    assert 'assets/factory_sources' in cmake_text
    assert '$<TARGET_FILE_DIR:${bundle_target}>/WavetableSynth.iOS.cmajorpatch' in cmake_text
    assert 'XCODE_ATTRIBUTE_CODE_SIGN_ENTITLEMENTS' in cmake_text
    assert 'copy_directory' not in cmake_text
    assert 'rm -rf "$<TARGET_FILE_DIR:${bundle_target}>/assets/factory_sources"' not in cmake_text
    assert 'rm -f "$<TARGET_FILE_DIR:${bundle_target}>/assets/factory-bank.json"' not in cmake_text
    assert '$<TARGET_FILE_DIR:${bundle_target}>/assets/factory-bank-catalog.json' not in cmake_text
    assert "CosimoStandaloneApp.cpp" not in cmake_text
    assert "JUCE_USE_CUSTOM_PLUGIN_STANDALONE_APP=1" not in cmake_text
    assert "COSIMO_PATCH_PATH" not in cmake_text
    assert "CMAJOR_SOURCE_PATH" not in cmake_text
    assert "libCmajPerformer" not in cmake_text
    assert "CMAJOR_DLL=1" not in cmake_text
    assert "modules/compiler/src" not in cmake_text
    assert "factory-bank.wav" not in cmake_text


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


def test_ios_auv3_generator_writes_self_contained_plugin_source_and_headers(
    generated_ios_plugin_dir: Path,
) -> None:
    assert (generated_ios_plugin_dir / "cmajor_plugin.cpp").is_file()
    assert (generated_ios_plugin_dir / "include/cmajor/helpers/cmaj_JUCEPlugin.h").is_file()
    assert (generated_ios_plugin_dir / "include/choc/choc/javascript/choc_javascript_QuickJS.h").is_file()
    assert (generated_ios_plugin_dir / "include/cmajor/helpers/cmaj_EmbeddedWebAssets.h").is_file()
    assert (generated_ios_plugin_dir / "include/cmajor/helpers/cmaj_PatchWebView.h").is_file()
    assert (generated_ios_plugin_dir / "include/cmajor/helpers/cmaj_PatchWorker_WebView.h").is_file()

    webview_header = (generated_ios_plugin_dir / "include/choc/choc/gui/choc_WebView.h").read_text(
        encoding="utf-8"
    )
    embedded_assets_header = (
        generated_ios_plugin_dir / "include/cmajor/helpers/cmaj_EmbeddedWebAssets.h"
    ).read_text(encoding="utf-8")
    patch_webview_header = (
        generated_ios_plugin_dir / "include/cmajor/helpers/cmaj_PatchWebView.h"
    ).read_text(encoding="utf-8")
    patch_worker_webview_header = (
        generated_ios_plugin_dir / "include/cmajor/helpers/cmaj_PatchWorker_WebView.h"
    ).read_text(encoding="utf-8")
    juce_plugin_header = (
        generated_ios_plugin_dir / "include/cmajor/helpers/cmaj_JUCEPlugin.h"
    ).read_text(encoding="utf-8")

    assert '#if CHOC_OSX' in webview_header
    assert 'if (options->transparentBackground)' in webview_header
    assert 'call<void> (webview, "setValue:forKey:", getNSNumberBool (false), getNSString ("drawsBackground"));' in webview_header
    assert '#endif' in webview_header
    assert 'auto black = callClass<id> ("UIColor", "blackColor");' in webview_header
    assert 'call<void> (webview, "setOpaque:", (BOOL) 0);' in webview_header
    assert 'call<void> (webview, "setBackgroundColor:", black);' in webview_header
    assert 'if (auto scrollView = call<id> (webview, "scrollView"))' in webview_header
    assert 'call<void> (scrollView, "setContentInsetAdjustmentBehavior:", 2);' in webview_header
    assert 'call<void> (scrollView, "setAutomaticallyAdjustsScrollIndicatorInsets:", (BOOL) 0);' in webview_header
    assert 'call<void> (scrollView, "setBackgroundColor:", black);' in webview_header
    assert 'class_addMethod (webviewClass, sel_registerName ("safeAreaInsets"),' in webview_header
    assert '-> choc::objc::UIEdgeInsets' in webview_header
    assert 'struct UIEdgeInsets { CGFloat top = 0, left = 0, bottom = 0, right = 0; };' in (
        generated_ios_plugin_dir / "include/choc/choc/platform/choc_ObjectiveCHelpers.h"
    ).read_text(encoding="utf-8")
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
    assert 'html { background: black; overflow: hidden; }' in patch_webview_header
    assert 'body { display: block; position: absolute; width: 100%; height: 100%; color: white; font-family: Monaco, Consolas, monospace; }' in patch_webview_header
    assert '#cmaj-view-container { display: block; position: relative; width: 100%; height: 100%; overflow: auto; }' in patch_webview_header
    assert 'if (typeof window.setStatusMessage === \'function\') window.setStatusMessage (' in patch_webview_header
    assert 'const isErrorLike = /(^|\\b)(error|failed|could not)\\b/i.test (messageText)' in patch_webview_header
    assert 'if (! isErrorLike)' in patch_webview_header
    assert 'w.bind ("_internalReadResource",' in patch_webview_header
    assert 'w.bind ("_internalReadResourceAsAudioData",' in patch_webview_header
    assert 'this.prefersResourceReadBridge = true;' in patch_webview_header
    assert 'return _internalReadResource (path);' in patch_webview_header
    assert 'return _internalReadResourceAsAudioData (path);' in patch_webview_header
    assert 'const auto normalisedPath = normaliseRequestPath (path);' in patch_webview_header
    assert 'const auto requestPathForLookup = normalisedPath.empty() ? std::string ("/") : ("/" + normalisedPath);' in patch_webview_header
    assert 'readJavascriptResource (path, patch.getManifest())' in patch_webview_header
    assert 'if (extension == ".mjs" || extension == "mjs")' in patch_webview_header
    assert 'return std::string ("text/javascript");' in patch_webview_header
    assert 'if (extension == ".json" || extension == "json")' in patch_webview_header
    assert 'return std::string ("application/json");' in patch_webview_header
    assert 'manifest->readFileContent (relativePath.generic_string())' in patch_webview_header
    assert 'const auto normalisedPath = normaliseRequestPath (path);' in patch_worker_webview_header
    assert 'const auto requestPathForLookup = normalisedPath.empty() ? std::string ("/") : ("/" + normalisedPath);' in patch_worker_webview_header
    assert 'const auto toMimeType = [] (const auto& extension)' in patch_worker_webview_header
    assert 'std::string ("text/javascript")' in patch_worker_webview_header
    assert 'std::string ("application/json")' in patch_worker_webview_header
    assert 'w.bind ("_internalReadResource",' in patch_worker_webview_header
    assert 'w.bind ("_internalReadResourceAsAudioData",' in patch_worker_webview_header
    assert 'this.prefersResourceReadBridge = true;' in patch_worker_webview_header
    assert 'readJavascriptResource (requestPathForLookup, manifest)' in patch_worker_webview_header
    assert 'manifest->readFileContent (relativePath.generic_string())' in patch_worker_webview_header
    assert 'return _internalReadResource (path);' in patch_worker_webview_header
    assert 'return _internalReadResourceAsAudioData (path);' in patch_worker_webview_header
    assert 'if (view?.width > 10)' in embedded_assets_header
    assert 'if (view?.height > 10)' in embedded_assets_header
    assert 'patchView.style.minWidth = "100%"' not in embedded_assets_header
    assert 'patchView.style.minHeight = "100%"' not in embedded_assets_header
    assert '#include "CosimoSharedWavetableLibrary.h"' in juce_plugin_header
    assert "getRuntimeResourceFile" in juce_plugin_header
    assert "resolveManagedWavetableAssetFile (path)" in juce_plugin_header
    assert "juce::File::getSpecialLocation (juce::File::currentApplicationFile)" in juce_plugin_header
    assert "std::make_shared<std::ifstream>" in juce_plugin_header
    assert "#if JUCE_IOS" in juce_plugin_header
    assert "view.isResizable()" in juce_plugin_header
    assert "juce::Desktop::getInstance().getDisplays().getPrimaryDisplay()" in juce_plugin_header
    assert "display->userArea.isEmpty() ? display->totalArea" in juce_plugin_header
    assert "addChildComponent (*extraComp);" in juce_plugin_header
    assert "enum class SharedWavetableLibraryScreenMode" in juce_plugin_header
    assert "getSharedWavetableLibraryScreenMode() const" in juce_plugin_header
    assert "return SharedWavetableLibraryScreenMode::standaloneInstaller;" in juce_plugin_header
    assert "return SharedWavetableLibraryScreenMode::extensionUnavailable;" in juce_plugin_header
    assert "return getSharedWavetableLibraryScreenMode() == SharedWavetableLibraryScreenMode::patchView;" in juce_plugin_header
    assert "patchWebViewHolder->setBounds (r);" in juce_plugin_header
    assert "extraComp->setBounds (getLocalBounds());" in juce_plugin_header
    assert "createSharedWavetableLibraryComponent (cosimo::ios::SharedWavetableLibraryComponentMode::standaloneInstaller" in juce_plugin_header
    assert "createSharedWavetableLibraryComponent (cosimo::ios::SharedWavetableLibraryComponentMode::extensionUnavailable" in juce_plugin_header
    assert "setNewStateAsync (this->getUpdatedState())" in juce_plugin_header
    assert "refreshSharedWavetableLibraryComponent (c)" in juce_plugin_header
    assert "owner.refreshExtraComp (extraComp.get());" in juce_plugin_header
    assert "childBoundsChanged (nullptr);" in juce_plugin_header
    assert "getSharedWavetableLibraryComponentHeight" not in juce_plugin_header


def test_ios_shared_wavetable_helper_uses_app_groups_zip_import_and_backup_exclusion() -> None:
    helper_source = IOS_SHARED_LIBRARY_HELPER.read_text(encoding="utf-8")
    helper_header = IOS_SHARED_LIBRARY_HELPER_HEADER.read_text(encoding="utf-8")
    entitlements = IOS_SHARED_LIBRARY_ENTITLEMENTS.read_text(encoding="utf-8")

    assert "group.dev.cosimo.wavetable-synth" in helper_header
    assert "containerURLForSecurityApplicationGroupIdentifier" in helper_source
    assert "ZipFile archive" in helper_source
    assert "WavAudioFormat format" in helper_source
    assert "NSURLIsExcludedFromBackupKey" in helper_source
    assert "validateInstalledLibrary" in helper_source
    assert "createSharedWavetableLibraryComponent" in helper_source
    assert "Install Factory Wavetables" in helper_source
    assert "Factory Wavetable Library Required" in helper_source
    assert "Open the Cosimo Synth app and import the factory wavetable zip there." in helper_source
    assert "enum class SharedWavetableLibraryComponentMode" in helper_header
    assert "standaloneInstaller" in helper_header
    assert "extensionUnavailable" in helper_header
    assert "kSharedWavetableLibraryBarHeight" not in helper_header
    assert "getSharedWavetableLibraryComponentHeight" not in helper_header
    assert "requestComponentRefresh" not in helper_header
    assert "com.apple.security.application-groups" in entitlements
    assert "group.dev.cosimo.wavetable-synth" in entitlements


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


def test_generated_ios_plugin_externalises_the_bank_but_keeps_patch_ui_resources(
    generated_ios_plugin_dir: Path,
) -> None:
    plugin_source = (generated_ios_plugin_dir / "cmajor_plugin.cpp").read_text(
        encoding="utf-8",
        errors="ignore",
    )

    assert 'File { "assets/factory-bank.wav"' not in plugin_source
    assert 'File { "assets/factory-bank-catalog.json"' not in plugin_source
    assert 'File { "assets/codegen-bank.wav"' not in plugin_source
    assert 'File { "patch_gui/index.ios.js"' in plugin_source
    assert 'File { "patch_gui/index.js"' in plugin_source
    assert 'File { "patch_gui/wavetable-worker.mjs"' in plugin_source
    assert 'File { "patch_gui/wavetable-mip.mjs"' in plugin_source
    assert 'File { "patch_gui/responsive-layout.js"' in plugin_source
    assert 'File { "patch_gui/wavetable-bank.js"' in plugin_source
    assert 'File { "patch_gui/wavetable-display.js"' in plugin_source
    assert "dev-harness.html" not in plugin_source
    assert "renderer-harness.html" not in plugin_source
    assert "mockup-massive-x-ios.html" not in plugin_source
    assert "factory-bank-display-data.js" not in plugin_source
    assert 'factory-bank-manifest.js' not in plugin_source
    assert "GeneratedPlugin<::WavetableSynth>" in plugin_source
    assert '"wavetableLoadBegin"' in plugin_source
    assert '"wavetableMipFrame"' in plugin_source
    assert '"wavetableUploadAck"' in plugin_source
    assert '"wavetableMipRequest"' in plugin_source
    assert '"wavetableFrames"' not in plugin_source
    assert '"cosimoRuntimeSelectedTableIndex"' not in plugin_source
    assert "startTimerHz (30)" not in plugin_source
    assert 'createObject ("UploadedWavetableFrame"' not in plugin_source
    assert 'createObject ("UploadedWavetable"' not in plugin_source
    assert '"uploadToken"' not in plugin_source
    assert "std::vector<choc::value::Value> pendingUploadFrames;" not in plugin_source
    assert "static constexpr int maxUploadFramesPerFlush = 8;" not in plugin_source
    assert "COSIMO_PATCH_PATH" not in plugin_source
    assert "libCmajPerformer" not in plugin_source
    assert "createEngine = +[]" not in plugin_source
    assert "wt::factoryBank" not in plugin_source


def test_generated_ios_plugin_reads_worker_resources_via_resolved_bundle_urls(
    generated_ios_plugin_dir: Path,
) -> None:
    plugin_source = (generated_ios_plugin_dir / "cmajor_plugin.cpp").read_text(
        encoding="utf-8",
        errors="ignore",
    )

    old_read_resource_block = _normalise_whitespace(
        """
        "    async readResource (path)\n"
        "    {\n"
        "        return fetch (path);\n"
        "    }\n"
        """
    )

    assert old_read_resource_block not in _normalise_whitespace(plugin_source)
    assert '"        const resourceAddress = this.getResourceAddress (path);\\n"' in plugin_source
    assert '"        if (resourceAddress instanceof URL)\\n"' in plugin_source
    assert '"            return fetch (resourceAddress.toString());\\n"' in plugin_source
    assert '"                return fetch (new URL (resourceAddress, this.rootResourcePath).toString());\\n"' in plugin_source


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
    const firstTableSourceWav = firstTable?.sourceWav;
    const sourceResponse = await fetch(new URL(firstTableSourceWav, rootUrl));

    if (!sourceResponse.ok) {
        throw new Error(`Could not fetch source wavetable from ${rootUrl}`);
    }

    const sourceWave = parseWaveFile(await sourceResponse.arrayBuffer());
    const viewResponse = await fetch(new URL(manifest.view.src, rootUrl));

    if (!viewResponse.ok) {
        throw new Error(`Could not fetch view module from ${rootUrl}`);
    }

    const viewSource = await viewResponse.text();

    if (!viewSource.includes("createPatchViewWithOptions") && !viewSource.includes("createIOSPatchView")) {
        throw new Error(`View module did not load the expected UI from ${rootUrl}`);
    }

    return {
        sampleRate: bank.sampleRate,
        frameCount: bank.frameCount,
        frameLength: bank.frames[0]?.length,
        uploadedSampleCount: bank.samples.length,
        catalogTableCount: catalog.tables.length,
        firstTableName: firstTable?.name,
        firstTableSourceWav,
        expectedFrameCount: firstTable?.frameCount,
        expectedSampleCount: sourceWave.samples.length,
        hasExternals: Object.prototype.hasOwnProperty.call(manifest, "externals"),
        hasResources: Array.isArray(manifest.resources) ? manifest.resources.length : -1,
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

    if (typeof bundle.firstTableName !== "string" || bundle.firstTableName.length === 0) {
        throw new Error(`Missing first table name: ${JSON.stringify(bundle)}`);
    }

    if (bundle.firstTableSourceWav !== "assets/factory_sources/display-demo.wav") {
        throw new Error(`Unexpected first table source wav: ${JSON.stringify(bundle)}`);
    }

    if (bundle.hasExternals) {
        throw new Error(`Unexpected external bank metadata: ${JSON.stringify(bundle)}`);
    }

    if (bundle.hasResources !== 0) {
        throw new Error(`Unexpected manifest resources: ${JSON.stringify(bundle)}`);
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

    assert result.returncode == 0


def test_ios_host_smoke_discovers_the_extension_and_restores_state_across_relaunch(
    ios_host_smoke_result: dict[str, object],
) -> None:
    phone = ios_host_smoke_result["phone"]
    parameter_set = phone["parameterSet"]
    table_selection_set = phone["tableSelectionSet"]
    state = phone["state"]

    assert phone["discover"]["matchedComponents"] >= 1
    assert phone["instantiate"]["componentName"] == "Cosimo Synth"
    assert phone["audio"]["peakRMS"] > 0.001
    assert phone["editor"]["opened"] is True
    assert phone["editor"]["closed"] is True
    assert parameter_set["identifier"] == "wavetablePosition"
    assert parameter_set["requestedValue"] == pytest.approx(0.625, abs=0.001)
    assert parameter_set["observedValue"] == pytest.approx(0.625, abs=0.001)
    assert table_selection_set["identifier"] == "wavetableSelect"
    assert table_selection_set["requestedValue"] == pytest.approx(1.0, abs=0.001)
    assert table_selection_set["observedValue"] == pytest.approx(1.0, abs=0.001)
    assert state["reloadObservedValue"] == pytest.approx(0.625, abs=0.001)
    assert state["reloadObservedTableSelect"] == pytest.approx(1.0, abs=0.001)
    assert state["relaunchObservedValue"] == pytest.approx(0.625, abs=0.001)
    assert state["relaunchObservedTableSelect"] == pytest.approx(1.0, abs=0.001)
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

        dom_metrics = editor["domMetrics"]

        assert dom_metrics["keyboardBottomGap"] <= 1.0
        assert dom_metrics["footerBottomGap"] <= 1.0
        assert abs(dom_metrics["keyboardRect"]["bottom"] - dom_metrics["viewport"]["height"]) <= 1.0
