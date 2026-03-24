#include <JuceHeader.h>
#include <assert.h>
#include <mutex>

#define CHOC_ASSERT(x) assert(x)
#include "cmajor/COM/cmaj_Library.h"
#include "cmajor/helpers/cmaj_JUCEPluginFormat.h"
#include "choc/javascript/choc_javascript_QuickJS.h"

#ifndef COSIMO_PATCH_PATH
 #error COSIMO_PATCH_PATH must be defined
#endif

static bool initialiseCmajorLibrary()
{
    static std::once_flag once;
    static bool initialised = false;

    std::call_once (once, []
    {
        auto bundle = juce::File::getSpecialLocation (juce::File::currentApplicationFile);
        auto resourceDirectory = bundle.getChildFile ("Contents").getChildFile ("Resources");
        auto dylibPath = resourceDirectory.getChildFile (cmaj::Library::getDLLName());

        initialised = cmaj::Library::initialise (dylibPath.getFullPathName().toStdString());

        if (! initialised)
            std::cerr << "Failed to initialise Cmajor library from "
                      << dylibPath.getFullPathName() << std::endl;
    });

    return initialised;
}

static std::filesystem::path getFixedPatchLocation()
{
    return std::filesystem::path (COSIMO_PATCH_PATH);
}

class FixedPatchInstrumentDevPlugin
    : public cmaj::plugin::JUCEPluginBase<FixedPatchInstrumentDevPlugin>
{
public:
    FixedPatchInstrumentDevPlugin (std::shared_ptr<cmaj::Patch> patchToUse,
                                   std::filesystem::path manifestLocationToUse)
        : cmaj::plugin::JUCEPluginBase<FixedPatchInstrumentDevPlugin> (
              patchToUse,
              preloadBusLayout (*patchToUse, manifestLocationToUse)),
          manifestLocation (std::move (manifestLocationToUse))
    {
        setFixedStateSynchronously (createEmptyState (manifestLocation));
    }

    void setStateInformation (const void* data, int size) override
    {
        choc::hash::xxHash64 hash (1);
        hash.addInput (data, static_cast<size_t> (size));
        auto stateHash = hash.getHash();

        if (lastLoadedStateHash != stateHash)
        {
            lastLoadedStateHash = stateHash;
            setFixedStateSynchronously (juce::ValueTree::readFromData (data, static_cast<size_t> (size)));
        }
    }

    bool prepareManifest (cmaj::Patch::LoadParams& loadParams, const juce::ValueTree& newState) override
    {
        if (! newState.isValid())
            return false;

        loadParams.manifest.initialiseWithFile (manifestLocation);
        readParametersFromState (loadParams, newState);
        return true;
    }

    static BusesProperties preloadBusLayout (cmaj::Patch& patch, const std::filesystem::path& location)
    {
        cmaj::PatchManifest manifest;
        manifest.initialiseWithFile (location);
        patch.preload (manifest);

        return getBusesProperties (patch.getInputEndpoints(), patch.getOutputEndpoints());
    }

    static constexpr bool isPrecompiled = false;
    static constexpr bool isFixedPatch = true;

    static constexpr int extraCompHeight = 0;
    static bool isViewVisible() { return true; }
    std::unique_ptr<juce::Component> createExtraComponent() { return {}; }
    void refreshExtraComp (juce::Component*) {}

private:
    void setFixedStateSynchronously (const juce::ValueTree& newState)
    {
        if (! dllLoadedSuccessfully)
            return;

        if (newState.isValid() && ! newState.hasType (ids.Cmajor))
        {
            unload ("Failed to load: invalid state", true);
            return;
        }

        cmaj::Patch::LoadParams loadParams;

        try
        {
            if (! prepareManifest (loadParams, newState))
            {
                unload ({}, false);
                return;
            }
        }
        catch (const std::runtime_error& e)
        {
            unload (e.what(), true);
            return;
        }

        if (isViewResizable())
        {
            if (auto width = newState.getPropertyPointer (ids.viewWidth); width != nullptr && width->isInt())
                lastEditorWidth = *width;

            if (auto height = newState.getPropertyPointer (ids.viewHeight); height != nullptr && height->isInt())
                lastEditorHeight = *height;
        }
        else
        {
            lastEditorWidth = 0;
            lastEditorHeight = 0;
        }

        if (auto state = newState.getChildWithName (ids.STATE); state.isValid())
        {
            for (const auto& valueTree : state)
            {
                if (! valueTree.hasType (ids.VALUE))
                    continue;

                auto* key = valueTree.getPropertyPointer (ids.key);
                auto* value = valueTree.getPropertyPointer (ids.value);

                if (key == nullptr || value == nullptr)
                    continue;

                if (key->isString() && key->toString().isNotEmpty() && ! value->isVoid())
                    patch->setStoredStateValue (key->toString().toStdString(), convertVarToValue (*value));
            }
        }

        if (getSampleRate() > 0)
            applyCurrentRateAndBlockSize();

        patch->loadPatch (loadParams, true);
        handlePatchChange();
    }

    std::filesystem::path manifestLocation;
};

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    if (! initialiseCmajorLibrary())
        throw std::runtime_error ("Failed to initialise libCmajPerformer.dylib");

    auto manifest = getFixedPatchLocation();

    if (! std::filesystem::exists (manifest))
        throw std::runtime_error ("Patch file not found: " + manifest.string());

    auto patch = std::make_shared<cmaj::Patch>();
    patch->setAutoRebuildOnFileChange (true);
    patch->createEngine = +[] { return cmaj::Engine::create(); };

   #if CMAJ_USE_QUICKJS_WORKER
    enableQuickJSPatchWorker (*patch);
   #else
    enableWebViewPatchWorker (*patch);
   #endif

    return new FixedPatchInstrumentDevPlugin (std::move (patch), manifest);
}
