#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_GIT_URL = "https://github.com/cmajor-lang/cmajor.git"
RUNTIME_TAG = "1.0.3066"
RUNTIME_COMMIT = "172db53232337154d5a1c0f9a448318129dfacd9"
PATCHED_CHOC_GIT_URL = "https://github.com/androidStern/choc.git"
PATCHED_CHOC_BRANCH = "cosimo-keyboard-bridge"
PATCHED_CHOC_COMMIT = "e50b21a272a1729bc1dd1fd368c112095cb18d5a"
PATCHED_CHOC_SHORT_COMMIT = PATCHED_CHOC_COMMIT[:8]
RUNTIME_DESTINATION = REPO_ROOT / "build" / "deps" / f"cmajor-{RUNTIME_TAG}-choc-{PATCHED_CHOC_SHORT_COMMIT}"
PATCHED_CHOC_MARKERS = (
    "chocHostKeyboard",
    "__chocHostKeyboardBridgeInstalled",
    "__chocUserFiles",
    "chocUserFiles",
)
CMAJOR_JUCE_SIDECHAIN_PATCH_MARKER = "COSIMO_CMAJOR_JUCE_PLUGIN_SPLIT_INPUT_BUSES"


def _run(command: list[str], *, cwd: Path | None = None, capture: bool = False) -> subprocess.CompletedProcess[str]:
    if capture:
        return subprocess.run(
            command,
            cwd=cwd,
            check=True,
            text=True,
            capture_output=True,
        )

    return subprocess.run(
        command,
        cwd=cwd,
        check=True,
        text=True,
        stdout=sys.stderr,
    )


def _runtime_looks_complete(runtime_root: Path) -> bool:
    required_paths = (
        runtime_root / ".git",
        runtime_root / "include" / "cmajor" / "helpers" / "cmaj_Patch.h",
        runtime_root / "include" / "choc" / "choc" / "gui" / "choc_WebView.h",
        runtime_root / "javascript" / "cmaj_api" / "cmaj-patch-view.js",
        runtime_root / "3rdParty" / "llvm" / "release" / "osx" / "universal" / "cmake_platforms",
        runtime_root / "3rdParty" / "boost" / "asio" / "include" / "boost" / "asio.hpp",
    )
    return all(path.exists() for path in required_paths)


def _choc_head(runtime_root: Path) -> str | None:
    choc_root = runtime_root / "include" / "choc"

    if not choc_root.exists():
        return None

    try:
        return _run(["git", "rev-parse", "HEAD"], cwd=choc_root, capture=True).stdout.strip()
    except subprocess.CalledProcessError:
        return None


def _runtime_contains_required_choc_patches(runtime_root: Path) -> bool:
    webview_header = runtime_root / "include" / "choc" / "choc" / "gui" / "choc_WebView.h"

    if not webview_header.exists():
        return False

    header_text = webview_header.read_text(encoding="utf-8")
    return all(marker in header_text for marker in PATCHED_CHOC_MARKERS)


def _runtime_contains_required_cmajor_sidechain_patch(runtime_root: Path) -> bool:
    juce_plugin_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_JUCEPlugin.h"

    if not juce_plugin_header.exists():
        return False

    return CMAJOR_JUCE_SIDECHAIN_PATCH_MARKER in juce_plugin_header.read_text(encoding="utf-8")


def _apply_cmajor_sidechain_bus_patch(runtime_root: Path) -> None:
    juce_plugin_header = runtime_root / "include" / "cmajor" / "helpers" / "cmaj_JUCEPlugin.h"

    if not juce_plugin_header.exists():
        raise RuntimeError(f"Cmajor JUCE plugin helper not found: {juce_plugin_header}")

    header_text = juce_plugin_header.read_text(encoding="utf-8")

    if CMAJOR_JUCE_SIDECHAIN_PATCH_MARKER in header_text:
        return

    old_is_layout_ok = """    static bool isLayoutOK (const juce::Array<BusProperties>& patchLayouts,
                            const juce::Array<juce::AudioChannelSet>& suggestedLayouts)
    {
        if (patchLayouts.isEmpty())
            return suggestedLayouts.isEmpty() || suggestedLayouts.getReference(0).size() == 0;

        for (int i = 0; i < juce::jmin (patchLayouts.size(), suggestedLayouts.size()); ++i)
            if (patchLayouts.getReference(i).defaultLayout.size() != suggestedLayouts.getReference(i).size())
                return false;

        return true;
    }
"""
    new_is_layout_ok = f"""    // {CMAJOR_JUCE_SIDECHAIN_PATCH_MARKER}
    static bool isLayoutOK (const juce::Array<BusProperties>& patchLayouts,
                            const juce::Array<juce::AudioChannelSet>& suggestedLayouts,
                            bool isInput)
    {{
        if (patchLayouts.isEmpty())
            return suggestedLayouts.isEmpty() || suggestedLayouts.getReference(0).size() == 0;

        if (suggestedLayouts.size() < patchLayouts.size())
            return false;

        for (int i = 0; i < patchLayouts.size(); ++i)
        {{
            const auto expectedChannels = patchLayouts.getReference(i).defaultLayout.size();
            const auto suggestedChannels = suggestedLayouts.getReference(i).size();

            if (suggestedChannels == expectedChannels)
                continue;

            if (isInput && i > 0 && suggestedChannels == 0)
                continue;

            return false;
        }}

        return true;
    }}
"""
    old_is_buses_layout_supported = """        return isLayoutOK (patchBuses.inputLayouts, layout.inputBuses)
            && isLayoutOK (patchBuses.outputLayouts, layout.outputBuses);
"""
    new_is_buses_layout_supported = """        return isLayoutOK (patchBuses.inputLayouts, layout.inputBuses, true)
            && isLayoutOK (patchBuses.outputLayouts, layout.outputBuses, false);
"""
    old_get_playback_params = """    Patch::PlaybackParams getPlaybackParams (double rate, uint32_t requestedBlockSize)
    {
        auto layout = getBusesLayout();

        return Patch::PlaybackParams (rate, requestedBlockSize,
                                      static_cast<choc::buffer::ChannelCount> (layout.getMainInputChannels()),
                                      static_cast<choc::buffer::ChannelCount> (layout.getMainOutputChannels()));
    }
"""
    new_get_playback_params = """    static int countAudioChannels (const juce::Array<juce::AudioChannelSet>& buses)
    {
        int channels = 0;

        for (const auto& bus : buses)
            channels += bus.size();

        return channels;
    }

    Patch::PlaybackParams getPlaybackParams (double rate, uint32_t requestedBlockSize)
    {
        auto layout = getBusesLayout();

        return Patch::PlaybackParams (rate, requestedBlockSize,
                                      static_cast<choc::buffer::ChannelCount> (countAudioChannels (layout.inputBuses)),
                                      static_cast<choc::buffer::ChannelCount> (countAudioChannels (layout.outputBuses)));
    }
"""
    old_get_buses_properties = """    static BusesProperties getBusesProperties (const EndpointDetailsList& inputs,
                                               const EndpointDetailsList& outputs)
    {
        BusesProperties layout;

        uint32_t inputChannelCount = 0, outputChannelCount = 0;

        for (auto& input : inputs)
            inputChannelCount += input.getNumAudioChannels();

        for (auto& output : outputs)
            outputChannelCount += output.getNumAudioChannels();

        if (inputChannelCount > 0)
            layout.addBus (true, "in", juce::AudioChannelSet::canonicalChannelSet ((int) inputChannelCount), true);

        if (outputChannelCount > 0)
            layout.addBus (false, "out", juce::AudioChannelSet::canonicalChannelSet ((int) outputChannelCount), true);

        return layout;
    }
"""
    new_get_buses_properties = """    static std::string getEndpointBusName (const EndpointDetails& endpoint, std::string_view fallbackName)
    {
        if (auto annotationName = endpoint.annotation["name"].toString(); ! annotationName.empty())
            return annotationName;

        if (auto endpointName = endpoint.endpointID.toString(); ! endpointName.empty())
            return endpointName;

        return std::string (fallbackName);
    }

    static void addInputEndpointBuses (BusesProperties& layout, const EndpointDetailsList& inputs)
    {
        int audioBusIndex = 0;

        for (auto& input : inputs)
        {
            if (auto channelCount = input.getNumAudioChannels())
            {
                const auto fallbackName = audioBusIndex == 0 ? "Input" : "Sidechain";
                layout.addBus (true,
                               juce::String (getEndpointBusName (input, fallbackName)),
                               juce::AudioChannelSet::canonicalChannelSet ((int) channelCount),
                               audioBusIndex == 0);
                ++audioBusIndex;
            }
        }
    }

    static BusesProperties getBusesProperties (const EndpointDetailsList& inputs,
                                               const EndpointDetailsList& outputs)
    {
        BusesProperties layout;

        addInputEndpointBuses (layout, inputs);

        uint32_t outputChannelCount = 0;

        for (auto& output : outputs)
            outputChannelCount += output.getNumAudioChannels();

        if (outputChannelCount > 0)
            layout.addBus (false, "out", juce::AudioChannelSet::canonicalChannelSet ((int) outputChannelCount), true);

        return layout;
    }
"""
    replacements = (
        (old_is_layout_ok, new_is_layout_ok, "isLayoutOK"),
        (old_is_buses_layout_supported, new_is_buses_layout_supported, "isBusesLayoutSupported"),
        (old_get_playback_params, new_get_playback_params, "getPlaybackParams"),
        (old_get_buses_properties, new_get_buses_properties, "getBusesProperties"),
    )

    patched_text = header_text

    for old, new, label in replacements:
        if old not in patched_text:
            raise RuntimeError(f"Could not apply Cmajor sidechain bus patch: {label} block did not match {juce_plugin_header}.")

        patched_text = patched_text.replace(old, new, 1)

    juce_plugin_header.write_text(patched_text, encoding="utf-8")

    if not _runtime_contains_required_cmajor_sidechain_patch(runtime_root):
        raise RuntimeError(f"Cmajor sidechain bus patch marker was not written to {juce_plugin_header}.")


def _runtime_head(runtime_root: Path) -> str | None:
    if not (runtime_root / ".git").exists():
        return None

    try:
        return _run(["git", "rev-parse", "HEAD"], cwd=runtime_root, capture=True).stdout.strip()
    except subprocess.CalledProcessError:
        return None


def _prepare_runtime_submodules(runtime_root: Path) -> None:
    _run(
        [
            "git",
            "-c",
            "url.https://github.com/.insteadof=git@github.com:",
            "submodule",
            "update",
            "--init",
            "--depth",
            "1",
        ],
        cwd=runtime_root,
    )

    choc_root = runtime_root / "include" / "choc"

    _run(["git", "remote", "set-url", "origin", PATCHED_CHOC_GIT_URL], cwd=choc_root)
    _run(["git", "fetch", "--depth", "1", "origin", PATCHED_CHOC_BRANCH], cwd=choc_root)
    _run(["git", "checkout", "--detach", PATCHED_CHOC_COMMIT], cwd=choc_root)


def _clone_runtime(destination: Path) -> None:
    temp_destination = destination.with_name(f"{destination.name}.tmp")

    if temp_destination.exists():
        shutil.rmtree(temp_destination)

    destination.parent.mkdir(parents=True, exist_ok=True)

    _run(
        [
            "git",
            "clone",
            "--depth",
            "1",
            "--branch",
            RUNTIME_TAG,
            RUNTIME_GIT_URL,
            str(temp_destination),
        ]
    )

    _prepare_runtime_submodules(temp_destination)

    fetched_head = _runtime_head(temp_destination)

    if fetched_head != RUNTIME_COMMIT:
        raise RuntimeError(
            f"Fetched Cmajor runtime commit {fetched_head or '<missing>'}, expected {RUNTIME_COMMIT} for tag {RUNTIME_TAG}."
        )

    fetched_choc_head = _choc_head(temp_destination)

    if fetched_choc_head != PATCHED_CHOC_COMMIT:
        raise RuntimeError(
            f"Fetched CHOC commit {fetched_choc_head or '<missing>'}, expected {PATCHED_CHOC_COMMIT}."
        )

    if not _runtime_contains_required_choc_patches(temp_destination):
        raise RuntimeError(
            "Fetched CHOC checkout does not contain the required WebView patch markers."
        )

    if destination.exists():
        shutil.rmtree(destination)

    temp_destination.rename(destination)


def ensure_runtime() -> Path:
    current_head = _runtime_head(RUNTIME_DESTINATION)
    current_choc_head = _choc_head(RUNTIME_DESTINATION)

    if (
        current_head == RUNTIME_COMMIT
        and current_choc_head == PATCHED_CHOC_COMMIT
        and _runtime_contains_required_choc_patches(RUNTIME_DESTINATION)
        and _runtime_looks_complete(RUNTIME_DESTINATION)
    ):
        _apply_cmajor_sidechain_bus_patch(RUNTIME_DESTINATION)
        return RUNTIME_DESTINATION

    if current_head == RUNTIME_COMMIT:
        _prepare_runtime_submodules(RUNTIME_DESTINATION)

        current_head = _runtime_head(RUNTIME_DESTINATION)
        current_choc_head = _choc_head(RUNTIME_DESTINATION)

        if (
            current_head == RUNTIME_COMMIT
            and current_choc_head == PATCHED_CHOC_COMMIT
            and _runtime_contains_required_choc_patches(RUNTIME_DESTINATION)
            and _runtime_looks_complete(RUNTIME_DESTINATION)
        ):
            _apply_cmajor_sidechain_bus_patch(RUNTIME_DESTINATION)
            return RUNTIME_DESTINATION

    if RUNTIME_DESTINATION.exists():
        shutil.rmtree(RUNTIME_DESTINATION)

    _clone_runtime(RUNTIME_DESTINATION)

    current_head = _runtime_head(RUNTIME_DESTINATION)
    current_choc_head = _choc_head(RUNTIME_DESTINATION)

    if current_head != RUNTIME_COMMIT:
        raise RuntimeError(
            f"Pinned Cmajor runtime fetch completed, but {RUNTIME_DESTINATION} resolved to {current_head or '<missing>'} instead of {RUNTIME_COMMIT}."
        )

    if current_choc_head != PATCHED_CHOC_COMMIT:
        raise RuntimeError(
            f"Patched CHOC fetch completed, but {RUNTIME_DESTINATION / 'include/choc'} resolved to {current_choc_head or '<missing>'} instead of {PATCHED_CHOC_COMMIT}."
        )

    if not _runtime_contains_required_choc_patches(RUNTIME_DESTINATION):
        raise RuntimeError(
            f"Patched CHOC checkout is missing required WebView patch markers in {RUNTIME_DESTINATION / 'include/choc/choc/gui/choc_WebView.h'}."
        )

    _apply_cmajor_sidechain_bus_patch(RUNTIME_DESTINATION)

    return RUNTIME_DESTINATION


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch the pinned Cmajor runtime with patched CHOC into build/deps and print its path."
    )
    parser.add_argument(
        "--path",
        action="store_true",
        help="Ensure the pinned runtime exists and print its absolute path.",
    )
    args = parser.parse_args()

    if not args.path:
        parser.error("Pass --path to print the pinned runtime location.")

    runtime_root = ensure_runtime()
    print(runtime_root)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"Failed to prepare the pinned Cmajor runtime: {error}", file=sys.stderr)
        raise SystemExit(1)
