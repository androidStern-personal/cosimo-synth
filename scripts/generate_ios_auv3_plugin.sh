#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
output_dir="${1:-$repo_root/build/ios_auv3/generated/cmajor}"
default_patch_path="$repo_root/WavetableSynth.iOS.cmajorpatch"

if [[ ! -f "$default_patch_path" ]]; then
  default_patch_path="$repo_root/WavetableSynth.cmajorpatch"
fi

patch_path="${2:-$default_patch_path}"
output_parent="$(dirname "$output_dir")"

mkdir -p "$output_parent"

resolved_output_parent="$(cd "$output_parent" && pwd -P)"
output_basename="$(basename "$output_dir")"

if [[ "$output_basename" == "." || "$output_basename" == ".." ]]; then
  resolved_output_dir="$(cd "$output_parent/$output_basename" && pwd -P)"
else
  resolved_output_dir="$resolved_output_parent/$output_basename"
fi

case "$resolved_output_dir" in
  ""|"/"|"$repo_root")
    printf 'Refusing to overwrite unsafe output directory: %s\n' "$resolved_output_dir" >&2
    exit 1
    ;;
esac

output_dir="$resolved_output_dir"

if ! command -v cmaj >/dev/null 2>&1; then
  printf 'cmaj is required to generate the AUv3 plug-in source.\n' >&2
  exit 1
fi

if [[ ! -f "$patch_path" ]]; then
  printf 'Patch file not found: %s\n' "$patch_path" >&2
  exit 1
fi

uv run python "$repo_root/build_assets.py"

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/cosimo-ios-auv3.XXXXXX")"
cleanup() {
  rm -rf "$temp_dir"
}
trap cleanup EXIT

stage_dir="$temp_dir/staging"
generated_dir="$temp_dir/generated"
codegen_patch_path="$stage_dir/$(basename "$patch_path")"

mkdir -p "$stage_dir"
mkdir -p "$generated_dir"
cp -R "$repo_root/cmajor" "$stage_dir/cmajor"
cp -R "$repo_root/patch_gui" "$stage_dir/patch_gui"
cp "$patch_path" "$codegen_patch_path"

cmaj generate --target=juce "$codegen_patch_path" --output="$generated_dir"

webview_header="$generated_dir/include/choc/choc/gui/choc_WebView.h"

if [[ -f "$webview_header" ]]; then
  python3 - "$webview_header" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
needle = """        if (options->transparentBackground)
            call<void> (webview, "setValue:forKey:", getNSNumberBool (false), getNSString ("drawsBackground"));
"""
replacement = """       #if CHOC_OSX
        if (options->transparentBackground)
            call<void> (webview, "setValue:forKey:", getNSNumberBool (false), getNSString ("drawsBackground"));
       #endif

       #if CHOC_IOS
        if (options->transparentBackground)
        {
            auto black = callClass<id> ("UIColor", "blackColor");
            call<void> (webview, "setOpaque:", (BOOL) 0);
            call<void> (webview, "setBackgroundColor:", black);

            if (auto scrollView = call<id> (webview, "scrollView"))
                call<void> (scrollView, "setBackgroundColor:", black);
        }
       #endif
"""

if needle not in text:
    raise SystemExit(f"Could not find the expected WebView background snippet in {path}")

path.write_text(text.replace(needle, replacement, 1), encoding="utf-8")
PY
fi

python3 - "$generated_dir" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1])
targets = [
    root / "include/cmajor/helpers/cmaj_EmbeddedWebAssets.h",
    root / "cmajor_plugin.cpp",
]

old_width = '            width:  view.clientHeight - parseFloat (clientStyle.paddingTop)  - parseFloat (clientStyle.paddingBottom),\\n'
new_width = '            width:  view.clientWidth  - parseFloat (clientStyle.paddingLeft) - parseFloat (clientStyle.paddingRight),\\n'
old_height = '            height: view.clientWidth  - parseFloat (clientStyle.paddingLeft) - parseFloat (clientStyle.paddingRight)\\n'
new_height = '            height: view.clientHeight - parseFloat (clientStyle.paddingTop)  - parseFloat (clientStyle.paddingBottom)\\n'

for path in targets:
    if not path.is_file():
        continue

    text = path.read_text(encoding="utf-8")

    if old_width not in text or old_height not in text:
        raise SystemExit(f"Could not find the expected patch scaling snippet in {path}")

    text = text.replace(old_width, new_width, 1)
    text = text.replace(old_height, new_height, 1)
    path.write_text(text, encoding="utf-8")
PY

python3 - "$generated_dir/include/cmajor/helpers/cmaj_PatchWebView.h" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])

if not path.is_file():
    raise SystemExit(0)

text = path.read_text(encoding="utf-8")
old_header = '<meta charset="utf-8" />\n  <title>Cmajor Patch Controls</title>'
new_header = '<meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n  <title>Cmajor Patch Controls</title>'
old_style = """  * { box-sizing: border-box; padding: 0; margin: 0; border: 0; }
  html { background: black; overflow: hidden; }
  body { display: block; position: absolute; width: 100%; height: 100%; color: white; font-family: Monaco, Consolas, monospace; }
  #cmaj-view-container { display: block; position: relative; width: 100%; height: 100%; overflow: auto; }
"""

if old_header not in text and new_header not in text:
    raise SystemExit(f"Could not find the expected patch webview HTML header snippet in {path}")

text = text.replace(old_header, new_header, 1)

if old_style not in text:
    raise SystemExit(f"Could not find the expected patch webview style snippet in {path}")

path.write_text(text, encoding="utf-8")
PY

python3 - "$generated_dir/include/cmajor/helpers/cmaj_Patch.h" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])

if not path.is_file():
    raise SystemExit(0)

text = path.read_text(encoding="utf-8")
old_client_queue = "    static constexpr uint32_t clientEventQueueSize = 65536;\n"
new_client_queue = "    static constexpr uint32_t clientEventQueueSize = 8388608;\n"
old_performer_queue = "    static constexpr uint32_t performerEventQueueSize = 65536;\n"
new_performer_queue = "    static constexpr uint32_t performerEventQueueSize = 8388608;\n"

for old, new, label in [
    (old_client_queue, new_client_queue, "client event queue size"),
    (old_performer_queue, new_performer_queue, "performer event queue size"),
]:
    if old not in text and new not in text:
        raise SystemExit(f"Could not find the expected Patch {label} snippet in {path}")

    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
PY

python3 - "$generated_dir/include/cmajor/helpers/cmaj_JUCEPlugin.h" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])

if not path.is_file():
    raise SystemExit(0)

text = path.read_text(encoding="utf-8")
old_child_bounds = """        void childBoundsChanged (Component*) override
        {
            if (! isResizing && patchWebViewHolder->isVisible())
                setSize (std::max (50, patchWebViewHolder->getWidth()),
                         std::max (50, patchWebViewHolder->getHeight() + DerivedType::extraCompHeight));
        }
"""
new_child_bounds = """        void childBoundsChanged (Component*) override
        {
            if (! isResizing && patchWebViewHolder->isVisible() && ! patchWebView->resizable)
                setSize (std::max (50, patchWebViewHolder->getWidth()),
                         std::max (50, patchWebViewHolder->getHeight() + DerivedType::extraCompHeight));
        }
"""
old_prepare_manifest = """    bool prepareManifest (Patch::LoadParams& loadParams, const juce::ValueTree& newState) override
    {
        loadParams.manifest.needsToBuildSource = false;

        loadParams.manifest.initialiseWithVirtualFile (std::string (PatchClass::filename),
            [] (const std::string& f) -> std::shared_ptr<std::istream>
            {
                for (auto& file : PatchClass::files)
                    if (f == file.name)
                        return std::make_shared<std::istringstream> (std::string (file.content), std::ios::binary);

                return {};
            },
            [] (const std::string& name) -> std::string { return name; },
            [] (const std::string&) -> std::filesystem::file_time_type { return {}; },
            [] (const std::string& f)
            {
                for (auto& file : PatchClass::files)
                    if (f == file.name)
                        return true;

                return false;
            });

        this->readParametersFromState (loadParams, newState);
        return true;
    }
"""
new_prepare_manifest = """    bool prepareManifest (Patch::LoadParams& loadParams, const juce::ValueTree& newState) override
    {
        loadParams.manifest.needsToBuildSource = false;

        const auto getBundledResourceFile = [] (const std::string& path) -> juce::File
        {
            const auto relativePath = juce::String (path);
            const auto app = juce::File::getSpecialLocation (juce::File::currentApplicationFile);
            auto root = app.isDirectory() ? app : app.getParentDirectory();

            for (int depth = 0; depth < 4 && root.exists(); ++depth)
            {
                const auto direct = root.getChildFile (relativePath);

                if (direct.existsAsFile())
                    return direct;

                const auto flatResources = root.getChildFile ("Resources").getChildFile (relativePath);

                if (flatResources.existsAsFile())
                    return flatResources;

                const auto bundleResources = root.getChildFile ("Contents")
                                                  .getChildFile ("Resources")
                                                  .getChildFile (relativePath);

                if (bundleResources.existsAsFile())
                    return bundleResources;

                const auto parent = root.getParentDirectory();

                if (parent == root)
                    break;

                root = parent;
            }

            return {};
        };

        loadParams.manifest.initialiseWithVirtualFile (std::string (PatchClass::filename),
            [getBundledResourceFile] (const std::string& f) -> std::shared_ptr<std::istream>
            {
                if (f == PatchClass::filename)
                    if (auto bundledFile = getBundledResourceFile (f); bundledFile.existsAsFile())
                        return std::make_shared<std::ifstream> (bundledFile.getFullPathName().toStdString(), std::ios::binary | std::ios::in);

                for (auto& file : PatchClass::files)
                    if (f == file.name)
                        return std::make_shared<std::istringstream> (std::string (file.content), std::ios::binary);

                if (auto bundledFile = getBundledResourceFile (f); bundledFile.existsAsFile())
                    return std::make_shared<std::ifstream> (bundledFile.getFullPathName().toStdString(), std::ios::binary | std::ios::in);

                return {};
            },
            [getBundledResourceFile] (const std::string& name) -> std::string
            {
                if (name == PatchClass::filename)
                    if (auto bundledFile = getBundledResourceFile (name); bundledFile.existsAsFile())
                        return bundledFile.getFullPathName().toStdString();

                for (auto& file : PatchClass::files)
                    if (name == file.name)
                        return name;

                if (auto bundledFile = getBundledResourceFile (name); bundledFile.existsAsFile())
                    return bundledFile.getFullPathName().toStdString();

                return name;
            },
            [getBundledResourceFile] (const std::string& f) -> std::filesystem::file_time_type
            {
                if (f == PatchClass::filename)
                {
                    try
                    {
                        if (auto bundledFile = getBundledResourceFile (f); bundledFile.existsAsFile())
                            return std::filesystem::last_write_time (std::filesystem::path (bundledFile.getFullPathName().toStdString()));
                    }
                    catch (...) {}
                }

                for (auto& file : PatchClass::files)
                    if (f == file.name)
                        return {};

                try
                {
                    if (auto bundledFile = getBundledResourceFile (f); bundledFile.existsAsFile())
                        return std::filesystem::last_write_time (std::filesystem::path (bundledFile.getFullPathName().toStdString()));
                }
                catch (...) {}

                return {};
            },
            [getBundledResourceFile] (const std::string& f)
            {
                if (f == PatchClass::filename && getBundledResourceFile (f).existsAsFile())
                    return true;

                for (auto& file : PatchClass::files)
                    if (f == file.name)
                        return true;

                return getBundledResourceFile (f).existsAsFile();
            });

        this->readParametersFromState (loadParams, newState);
        return true;
    }
"""

if old_child_bounds not in text and new_child_bounds not in text:
    raise SystemExit(f"Could not find the expected JUCE editor sizing snippet in {path}")

text = text.replace(old_child_bounds, new_child_bounds, 1)

if old_prepare_manifest not in text and new_prepare_manifest not in text:
    raise SystemExit(f"Could not find the expected GeneratedPlugin prepareManifest snippet in {path}")

text = text.replace(old_prepare_manifest, new_prepare_manifest, 1)
path.write_text(text, encoding="utf-8")
PY

python3 - "$generated_dir/include/cmajor/helpers/cmaj_JUCEPlugin.h" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])

if not path.is_file():
    raise SystemExit(0)

text = path.read_text(encoding="utf-8")
old_patch_members = """    std::shared_ptr<Patch> patch;
    std::string statusMessage;
    bool isStatusMessageError = false;
    bool dllLoadedSuccessfully = false;

protected:
"""
new_patch_members = """    std::shared_ptr<Patch> patch;
    std::string statusMessage;
    bool isStatusMessageError = false;
    bool dllLoadedSuccessfully = false;

protected:
    Patch& getPatchForDerived() const { return *patch; }
    virtual void patchLoadedFromState (const juce::ValueTree&) {}
    virtual void patchParameterValueDidChange (std::string_view, float) {}
"""
old_patch_load = "        patch->loadPatch (loadParams, DerivedType::isPrecompiled);\n"
new_patch_load = """        patch->loadPatch (loadParams, DerivedType::isPrecompiled);
        patchLoadedFromState (newState);
"""
old_parameter_ctor = """        Parameter (juce::String&& pID)
            : HostedAudioProcessorParameter (1),
              paramID (std::move (pID))
        {
        }
"""
new_parameter_ctor = """        Parameter (JUCEPluginBase& ownerToNotify, juce::String&& pID)
            : HostedAudioProcessorParameter (1),
              owner (ownerToNotify),
              paramID (std::move (pID))
        {
        }
"""
old_value_changed = """            patchParam->valueChanged = [this] (float v)
            {
                sendValueChangedMessageToListeners (patchParam->properties.convertTo0to1 (v));
            };
"""
new_value_changed = """            patchParam->valueChanged = [this] (float v)
            {
                sendValueChangedMessageToListeners (patchParam->properties.convertTo0to1 (v));
                owner.patchParameterValueDidChange (patchParam->properties.endpointID, v);
            };
"""
old_parameter_member = "        juce::String getParameterID() const override                { return paramID; }\n"
new_parameter_member = """        juce::String getParameterID() const override                { return paramID; }\n
        JUCEPluginBase& owner;
"""
old_parameter_set_value = "        void setValue (float newValue) override      { if (patchParam != nullptr) patchParam->setValue (patchParam->properties.convertFrom0to1 (newValue), false, -1, 0); }\n"
new_parameter_set_value = """        void setValue (float newValue) override
        {
            if (patchParam != nullptr)
            {
                const auto mappedValue = patchParam->properties.convertFrom0to1 (newValue);
                patchParam->setValue (mappedValue, false, -1, 0);
                owner.patchParameterValueDidChange (patchParam->properties.endpointID, mappedValue);
            }
        }
"""
old_parameter_allocation = '            auto p = std::make_unique<Parameter> ("P" + juce::String (parameters.size()));\n'
new_parameter_allocation = '            auto p = std::make_unique<Parameter> (*this, "P" + juce::String (parameters.size()));\n'
old_parameter_tree_allocation = '                    auto newParam = std::make_unique<Parameter> (param->properties.endpointID);\n'
new_parameter_tree_allocation = '                    auto newParam = std::make_unique<Parameter> (owner, param->properties.endpointID);\n'
old_parameter_tree_members = """                std::map<std::string, juce::AudioProcessorParameterGroup*> groups;
                juce::AudioProcessorParameterGroup tree;
            };

            ParameterTreeBuilder builder;
"""
new_parameter_tree_members = """                JUCEPluginBase& owner;
                std::map<std::string, juce::AudioProcessorParameterGroup*> groups;
                juce::AudioProcessorParameterGroup tree;
            };

            ParameterTreeBuilder builder { *this };
"""

for old, new, label in [
    (old_patch_members, new_patch_members, "patch members"),
    (old_patch_load, new_patch_load, "patch load"),
    (old_parameter_ctor, new_parameter_ctor, "parameter constructor"),
    (old_value_changed, new_value_changed, "parameter valueChanged"),
    (old_parameter_member, new_parameter_member, "parameter owner member"),
    (old_parameter_set_value, new_parameter_set_value, "parameter setValue"),
    (old_parameter_allocation, new_parameter_allocation, "parameter allocation"),
    (old_parameter_tree_allocation, new_parameter_tree_allocation, "parameter tree allocation"),
    (old_parameter_tree_members, new_parameter_tree_members, "parameter tree members"),
]:
    if old not in text and new not in text:
        raise SystemExit(f"Could not find the expected JUCEPlugin {label} snippet in {path}")

    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
PY

python3 - "$generated_dir/cmajor_plugin.cpp" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])

if not path.is_file():
    raise SystemExit(0)

text = path.read_text(encoding="utf-8")
old_includes = """#include <array>
#include <stdexcept>
"""
new_includes = """#include <array>
#include <stdexcept>
#include <algorithm>
#include <vector>
"""
old_factory = """juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new cmaj::plugin::GeneratedPlugin<::WavetableSynth> (std::make_shared<cmaj::Patch>());
}
"""
new_factory = """class CosimoGeneratedPlugin final
    : public cmaj::plugin::GeneratedPlugin<::WavetableSynth>,
      private juce::AsyncUpdater,
      private juce::Timer
{
public:
    using super = cmaj::plugin::GeneratedPlugin<::WavetableSynth>;

    CosimoGeneratedPlugin (std::shared_ptr<cmaj::Patch> patchToUse)
        : super (std::move (patchToUse))
    {
        getPatchForDerived().handleXrun = [this]
        {
            ++uploadXrunCount;
            getPatchForDerived().setStoredStateValue ("cosimoDebugUploadXrunCount", choc::value::createInt32 (uploadXrunCount));
        };
        startTimerHz (30);
        requestRuntimeTableUpload (0.0f, true);
    }

    ~CosimoGeneratedPlugin() override
    {
        stopTimer();
        cancelPendingUpdate();
    }

protected:
    void prepareToPlay (double sampleRate, int samplesPerBlock) override
    {
        super::prepareToPlay (sampleRate, samplesPerBlock);
        requestRuntimeTableUpload (pendingRequestedTableIndex, lastUploadedTableIndex < 0);
    }

    void processBlock (juce::AudioBuffer<float>& audio, juce::MidiBuffer& midi) override
    {
        flushPendingRuntimeTableUpload();
        super::processBlock (audio, midi);
    }

    void patchLoadedFromState (const juce::ValueTree& newState) override
    {
        requestRuntimeTableUpload (readWavetableSelectFromState (newState), true);
    }

    void patchParameterValueDidChange (std::string_view endpointID, float newValue) override
    {
        if (endpointID == std::string_view ("wavetableSelect"))
            requestRuntimeTableUpload (newValue, false);
    }

private:
    static juce::File getBundledResourceFile (const std::string& path)
    {
        const auto relativePath = juce::String (path);
        const auto app = juce::File::getSpecialLocation (juce::File::currentApplicationFile);
        auto root = app.isDirectory() ? app : app.getParentDirectory();

        for (int depth = 0; depth < 4 && root.exists(); ++depth)
        {
            const auto direct = root.getChildFile (relativePath);

            if (direct.existsAsFile())
                return direct;

            const auto flatResources = root.getChildFile ("Resources").getChildFile (relativePath);

            if (flatResources.existsAsFile())
                return flatResources;

            const auto bundleResources = root.getChildFile ("Contents")
                                              .getChildFile ("Resources")
                                              .getChildFile (relativePath);

            if (bundleResources.existsAsFile())
                return bundleResources;

            const auto parent = root.getParentDirectory();

            if (parent == root)
                break;

            root = parent;
        }

        return {};
    }

    static float readWavetableSelectFromState (const juce::ValueTree& state)
    {
        if (auto params = state.getChildWithName ("PARAMS"); params.isValid())
            for (auto param : params)
                if (param.getProperty ("ID").toString() == "wavetableSelect")
                    return static_cast<float> (double (param.getProperty ("V")));

        return 0.0f;
    }

    void requestRuntimeTableUpload (float requestedIndex, bool forceReload)
    {
        pendingRequestedTableIndex = requestedIndex;
        stageBundledRuntimeTableUpload (pendingRequestedTableIndex, forceReloadPending || forceReload);
        triggerAsyncUpdate();
        flushPendingRuntimeTableUpload();
    }

    void handleAsyncUpdate() override
    {
        flushPendingRuntimeTableUpload();
    }

    void timerCallback() override
    {
        syncRuntimeTableSelectionFromStoredState();
    }

    void stageBundledRuntimeTableUpload (float requestedIndex, bool forceReload)
    {
        const auto catalogFile = getBundledResourceFile ("assets/factory-bank-catalog.json");

        if (! catalogFile.existsAsFile())
            return;

        const auto parsedCatalog = juce::JSON::parse (catalogFile.loadFileAsString());
        auto* catalogObject = parsedCatalog.getDynamicObject();

        if (catalogObject == nullptr)
            return;

        auto* tables = catalogObject->getProperty ("tables").getArray();

        if (tables == nullptr || tables->isEmpty())
            return;

        const auto tableIndex = juce::jlimit (0, tables->size() - 1, juce::roundToInt (requestedIndex));

        if (! forceReload)
        {
            if (pendingUploadTableIndex == tableIndex && pendingUploadCursor < pendingUploadFrames.size())
                return;

            if (pendingUploadTableIndex < 0 && tableIndex == lastUploadedTableIndex)
                return;
        }

        const auto& tableVar = tables->getReference (tableIndex);
        auto* tableObject = tableVar.getDynamicObject();

        if (tableObject == nullptr)
            return;

        const auto sourcePath = tableObject->getProperty ("sourceWav").toString();

        if (sourcePath.isEmpty())
            return;

        const auto sourceFile = getBundledResourceFile (sourcePath.toStdString());

        if (! sourceFile.existsAsFile())
            return;

        juce::WavAudioFormat wavFormat;
        auto inputStream = std::unique_ptr<juce::InputStream> (sourceFile.createInputStream());

        if (inputStream == nullptr)
            return;

        auto reader = std::unique_ptr<juce::AudioFormatReader> (wavFormat.createReaderFor (inputStream.release(), true));

        if (reader == nullptr || reader->numChannels != 1 || reader->lengthInSamples <= 0)
            return;

        const auto sampleCount = static_cast<int> (reader->lengthInSamples);

        if (sampleCount <= 0 || sampleCount % 2048 != 0)
            return;

        const auto frameCount = sampleCount / 2048;

        if (frameCount < 1 || frameCount > 256)
            return;

        juce::AudioBuffer<float> buffer (1, sampleCount);

        if (! reader->read (&buffer, 0, sampleCount, 0, true, false))
            return;

        pendingUploadFrames.clear();
        pendingUploadFrames.reserve (static_cast<size_t> (frameCount));
        pendingUploadCursor = 0;

        const auto uploadToken = nextUploadToken++;

        for (int frameIndex = 0; frameIndex < frameCount; ++frameIndex)
        {
            std::vector<float> frameSamples (2048, 0.0f);
            const auto* frameStart = buffer.getReadPointer (0) + (frameIndex * 2048);
            std::copy (frameStart, frameStart + 2048, frameSamples.begin());
            pendingUploadFrames.push_back (choc::value::createObject ("UploadedWavetableFrame",
                                                                      "uploadToken", uploadToken,
                                                                      "frameCount", frameCount,
                                                                      "frameIndex", frameIndex,
                                                                      "samples", choc::value::createArray (frameSamples)));
        }

        pendingUploadTableIndex = tableIndex;
        forceReloadPending = forceReload;
        getPatchForDerived().setStoredStateValue ("cosimoDebugUploadStaged", choc::value::createInt32 (tableIndex));
    }

    void syncRuntimeTableSelectionFromStoredState()
    {
        const auto& storedState = getPatchForDerived().getStoredStateValues();
        auto found = storedState.find (std::string (runtimeTableSelectionStateKey));

        if (found == storedState.end())
            return;

        const auto requestedIndex = found->second.getWithDefault<float> (pendingRequestedTableIndex);
        const auto roundedIndex = juce::roundToInt (requestedIndex);

        if (roundedIndex == lastStoredStateTableIndex)
            return;

        lastStoredStateTableIndex = roundedIndex;
        requestRuntimeTableUpload (requestedIndex, false);
    }

    void flushPendingRuntimeTableUpload()
    {
        if (pendingUploadTableIndex < 0 || pendingUploadFrames.empty())
            return;

        if (pendingUploadCursor >= pendingUploadFrames.size())
        {
            lastUploadedTableIndex = pendingUploadTableIndex;
            forceReloadPending = false;
            pendingUploadTableIndex = -1;
            pendingUploadFrames.clear();
            pendingUploadCursor = 0;
            getPatchForDerived().setStoredStateValue ("cosimoDebugUploadSucceeded", choc::value::createInt32 (lastUploadedTableIndex));
            return;
        }

        int framesSentThisFlush = 0;

        while (pendingUploadCursor < pendingUploadFrames.size() && framesSentThisFlush < maxUploadFramesPerFlush)
        {
            if (! getPatchForDerived().sendEventOrValueToPatch (cmaj::EndpointID::create (std::string_view ("wavetableFrames")),
                                                                pendingUploadFrames[pendingUploadCursor],
                                                                0,
                                                                5000))
                break;

            ++pendingUploadCursor;
            ++framesSentThisFlush;
        }

        if (pendingUploadCursor < pendingUploadFrames.size())
            triggerAsyncUpdate();
        else
            flushPendingRuntimeTableUpload();
    }

    float pendingRequestedTableIndex = 0.0f;
    std::vector<choc::value::Value> pendingUploadFrames;
    size_t pendingUploadCursor = 0;
    int pendingUploadTableIndex = -1;
    bool forceReloadPending = false;
    int lastUploadedTableIndex = -1;
    int lastStoredStateTableIndex = -1;
    int nextUploadToken = 1;
    int uploadXrunCount = 0;

    static constexpr int maxUploadFramesPerFlush = 8;
    static constexpr std::string_view runtimeTableSelectionStateKey = "cosimoRuntimeSelectedTableIndex";
};

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new CosimoGeneratedPlugin (std::make_shared<cmaj::Patch>());
}
"""

if old_includes not in text and new_includes not in text:
    raise SystemExit(f"Could not find the expected cmajor_plugin include snippet in {path}")

text = text.replace(old_includes, new_includes, 1)

if old_factory not in text and new_factory not in text:
    raise SystemExit(f"Could not find the expected createPluginFilter snippet in {path}")

text = text.replace(old_factory, new_factory, 1)
path.write_text(text, encoding="utf-8")
PY

rm -rf "$output_dir"
mv "$generated_dir" "$output_dir"

printf 'Generated iOS plug-in source at %s\n' "$output_dir"
