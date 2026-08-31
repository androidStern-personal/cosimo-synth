#pragma once

#include <JuceHeader.h>

#if JUCE_IOS
 #include <os/log.h>
#endif

#include <algorithm>
#include <array>
#include <atomic>
#include <cctype>
#include <cmath>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

#include "../../native/ArticulationTriggerConfigState.h"
#include "CosimoSharedWavetableLibrary.h"
#include "cmajor/helpers/cmaj_GeneratedCppEngine.h"
#include "cmajor/helpers/cmaj_Patch.h"
#include "cmajor/helpers/cmaj_PatchManifest.h"
#include "choc/gui/choc_WebView.h"
#include "choc/memory/choc_xxHash.h"
#include "choc/network/choc_MIMETypes.h"

#include "../../native/CosimoCmajorMidiBridge.h"

#ifndef COSIMO_ENABLE_MODULATION_BENCHMARK_METRICS
 #define COSIMO_ENABLE_MODULATION_BENCHMARK_METRICS 0
#endif

#if CMAJ_USE_QUICKJS_WORKER
 #include "cmajor/helpers/cmaj_PatchWorker_QuickJS.h"
#else
 #include "cmajor/helpers/cmaj_PatchWorker_WebView.h"
#endif

namespace cosimo::ios
{
namespace detail
{

inline std::string trimString (std::string text)
{
    const auto first = text.find_first_not_of (" \t\r\n");

    if (first == std::string::npos)
        return {};

    const auto last = text.find_last_not_of (" \t\r\n");
    return text.substr (first, last - first + 1);
}

inline void logRuntimeIssue (std::string_view context, std::string_view detail)
{
    const auto message = "[Cosimo iOS] " + std::string (context) + ": " + std::string (detail);
   #if JUCE_IOS
    os_log_with_type (OS_LOG_DEFAULT, OS_LOG_TYPE_DEFAULT, "%{public}s", message.c_str());
   #else
    juce::Logger::writeToLog (juce::String (message));
   #endif
}

inline std::string normaliseURL (std::string url)
{
    url = trimString (std::move (url));

    if (! url.empty() && url.back() != '/')
        url.push_back ('/');

    return url;
}

inline std::string getDevelopmentServerURL()
{
    std::string url;

   #if defined(COSIMO_ENABLE_WEBVIEW_DEV_SERVER) && COSIMO_ENABLE_WEBVIEW_DEV_SERVER
    if (const auto* env = std::getenv ("COSIMO_WEBVIEW_DEV_SERVER_URL"))
        url = env;

   #if defined(COSIMO_WEBVIEW_DEV_SERVER_URL)
    if (url.empty())
        url = COSIMO_WEBVIEW_DEV_SERVER_URL;
   #endif
   #endif

    return normaliseURL (std::move (url));
}

inline std::string_view getBundleSchemeRoot()
{
    return "cosimo://bundle";
}

inline std::string getBundleResourceBaseURL()
{
    return std::string (getBundleSchemeRoot()) + "/";
}

inline std::string getBundlePageURL()
{
    return getBundleResourceBaseURL() + "patch_gui/index.ios.html";
}

inline int decodeHexDigit (char c)
{
    if (c >= '0' && c <= '9')
        return c - '0';

    c = static_cast<char> (std::tolower (static_cast<unsigned char> (c)));

    if (c >= 'a' && c <= 'f')
        return 10 + (c - 'a');

    return -1;
}

inline std::optional<std::string> decodePercentEscapes (std::string_view encoded)
{
    std::string decoded;
    decoded.reserve (encoded.size());

    for (size_t index = 0; index < encoded.size(); ++index)
    {
        const auto c = encoded[index];

        if (c != '%')
        {
            decoded.push_back (c);
            continue;
        }

        if (index + 2 >= encoded.size())
            return std::nullopt;

        const auto hi = decodeHexDigit (encoded[index + 1]);
        const auto lo = decodeHexDigit (encoded[index + 2]);

        if (hi < 0 || lo < 0)
            return std::nullopt;

        decoded.push_back (static_cast<char> ((hi << 4) | lo));
        index += 2;
    }

    return decoded;
}

inline std::optional<std::string> sanitiseRelativePath (std::string pathText)
{
    if (auto schemePos = pathText.find ("://"); schemePos != std::string::npos)
    {
        if (auto pathPos = pathText.find ('/', schemePos + 3); pathPos != std::string::npos)
            pathText = pathText.substr (pathPos);
        else
            pathText.clear();
    }

    while (! pathText.empty() && pathText.front() == '/')
        pathText.erase (pathText.begin());

    if (pathText.empty())
        return std::string {};

    if (auto decoded = decodePercentEscapes (pathText); decoded.has_value())
        pathText = *decoded;
    else
        return std::nullopt;

    const auto relativePath = std::filesystem::path (pathText).lexically_normal().relative_path();

    for (const auto& part : relativePath)
    {
        const auto component = part.generic_string();

        if (component.empty() || component == "." || component == "..")
            return std::nullopt;
    }

    return relativePath.generic_string();
}

inline juce::File resolveBundleResourceFile (std::string_view relativePath)
{
    const auto relative = juce::String (std::string (relativePath));
    const auto app = juce::File::getSpecialLocation (juce::File::currentApplicationFile);
    const auto root = app.isDirectory() ? app : app.getParentDirectory();

    if (! root.exists())
        return {};

    for (const auto& candidateRoot : {
            root,
            root.getChildFile ("Resources"),
            root.getChildFile ("Contents").getChildFile ("Resources"),
        })
    {
        const auto candidate = candidateRoot.getChildFile (relative);

        if (candidate.existsAsFile())
            return candidate;
    }

    return {};
}

inline juce::File resolveRuntimeResourceFile (std::string_view rawPath)
{
    const auto normalised = sanitiseRelativePath (std::string (rawPath));

    if (! normalised.has_value())
        return {};

    if (normalised->empty())
        return {};

    if (auto managed = resolveManagedWavetableAssetFile (*normalised); managed.existsAsFile())
        return managed;

    return resolveBundleResourceFile (*normalised);
}

inline std::shared_ptr<std::istream> createRuntimeResourceReader (const std::filesystem::path& path)
{
    if (auto file = resolveRuntimeResourceFile (path.generic_string()); file.existsAsFile())
        return std::make_shared<std::ifstream> (file.getFullPathName().toStdString(), std::ios::binary | std::ios::in);

    return {};
}

inline std::filesystem::path getRuntimeResourceFullPath (const std::filesystem::path& path)
{
    if (auto file = resolveRuntimeResourceFile (path.generic_string()); file.existsAsFile())
        return std::filesystem::path (file.getFullPathName().toStdString());

    return path;
}

inline std::filesystem::file_time_type getRuntimeResourceModificationTime (const std::filesystem::path& path)
{
    try
    {
        if (auto file = resolveRuntimeResourceFile (path.generic_string()); file.existsAsFile())
            return std::filesystem::last_write_time (std::filesystem::path (file.getFullPathName().toStdString()));
    }
    catch (const std::exception& e)
    {
        logRuntimeIssue ("Could not inspect runtime resource modification time",
                         path.generic_string() + " (" + e.what() + ")");
    }
    catch (...)
    {
        logRuntimeIssue ("Could not inspect runtime resource modification time", path.generic_string());
    }

    return {};
}

inline bool runtimeResourceExists (const std::filesystem::path& path)
{
    return resolveRuntimeResourceFile (path.generic_string()).existsAsFile();
}

inline std::string getMimeTypeForPath (std::string_view relativePath)
{
    const auto extension = std::filesystem::path (std::string (relativePath)).extension().string();

    if (extension == ".js" || extension == ".mjs")
        return "text/javascript";

    if (extension == ".json")
        return "application/json";

    if (extension == ".html")
        return "text/html";

    if (extension == ".css")
        return "text/css";

    if (extension == ".svg")
        return "image/svg+xml";

    return choc::network::getMIMETypeFromFilename (extension, "application/octet-stream");
}

inline choc::value::Value createPatchBootConfig (const cmaj::Patch& patch, const cmaj::PatchManifest::View& preferredView)
{
    choc::value::Value manifestObject;

    if (auto manifest = patch.getManifest())
        manifestObject = manifest->manifest;

    return choc::json::create ("manifest", manifestObject,
                               "preferredView", preferredView.view,
                               "bundleResourceBaseURL", getBundleResourceBaseURL(),
                               "bundlePageURL", getBundlePageURL(),
                               "devServerURL", getDevelopmentServerURL());
}

class PatchWebViewHost final : public cmaj::PatchView
{
public:
    PatchWebViewHost (cmaj::Patch& patchToUse,
                      const cmaj::PatchManifest::View& preferredView,
                      bool shouldLoadBootPageHTML,
                      std::function<void (std::string)> articulationTriggerConfigHandlerToUse = {})
        : cmaj::PatchView (patchToUse, preferredView),
          currentView (preferredView),
          loadBootPageHTML (shouldLoadBootPageHTML),
          articulationTriggerConfigHandler (std::move (articulationTriggerConfigHandlerToUse))
    {
        choc::ui::WebView::Options options;
        options.enableDebugMode = false;
        options.enableDebugInspector = false;
        options.transparentBackground = false;
        options.customSchemeURI = std::string (getBundleSchemeRoot());
        options.fetchResource = [this] (const std::string& path) { return onRequest (path); };
        options.webviewIsReady = [this] (choc::ui::WebView& readyView)
        {
            using namespace choc::objc;

            if (auto nativeWebView = reinterpret_cast<id> (readyView.getViewHandle()))
            {
                auto black = callClass<id> ("UIColor", "blackColor");
                call<void> (nativeWebView, "setOpaque:", (BOOL) 0);
                call<void> (nativeWebView, "setBackgroundColor:", black);

                if (auto scrollView = call<id> (nativeWebView, "scrollView"))
                {
                    call<void> (scrollView, "setContentInsetAdjustmentBehavior:", 2);
                    call<void> (scrollView, "setBackgroundColor:", black);

                    if (call<BOOL> (scrollView, "respondsToSelector:", sel_registerName ("setAutomaticallyAdjustsScrollIndicatorInsets:")))
                        call<void> (scrollView, "setAutomaticallyAdjustsScrollIndicatorInsets:", (BOOL) 0);
                }
            }

            initialiseBridge();
            navigateToBundlePage();
        };

        webView = std::make_unique<choc::ui::WebView> (options);

        if (webView->isReady())
        {
            initialiseBridge();
            navigateToBundlePage();
        }
    }

    ~PatchWebViewHost() override = default;

    void sendMessage (const choc::value::ValueView& message) override
    {
        getWebView().evaluateJavascript ("window.cmaj_deliverMessageFromServer?.(" + choc::json::toString (message, true) + ");");
    }

    void setStatusMessage (const std::string& newMessage)
    {
        getWebView().evaluateJavascript ("if (typeof window.setStatusMessage === 'function') window.setStatusMessage ("
                                         + choc::json::getEscapedQuotedString (newMessage) + ");");
    }

    void reload()
    {
        // On iOS the first patch reload can happen while WKWebView is still on
        // about:blank. Always re-enter through the bundled boot page so the
        // dev-server redirect and bundled fallback logic run from a known URL.
        navigateToBundlePage();
    }

    void updateView (const cmaj::PatchManifest::View& newView)
    {
        currentView = newView;
        cmaj::PatchView::update (newView);
    }

    choc::ui::WebView& getWebView()
    {
        jassert (webView != nullptr);
        return *webView;
    }

private:
    void initialiseBridge()
    {
        if (bridgeInitialised || webView == nullptr)
            return;

        bridgeInitialised = true;
        auto& view = getWebView();

        bool boundOK = view.bind ("cmaj_sendMessageToServer", [this] (const choc::value::ValueView& args) -> choc::value::Value
        {
            try
            {
                if (args.isArray() && args.size() != 0)
                    patch.handleClientMessage (*this, args[0]);
            }
            catch (const std::exception& e)
            {
                std::cout << "Error processing message from client: " << e.what() << std::endl;
            }

            return {};
        });

        boundOK = boundOK && view.bind ("_internalReadResource", [this] (const choc::value::ValueView& args) -> choc::value::Value
        {
            try
            {
                if (args.isArray() && args.size() != 0)
                {
                    if (auto manifest = patch.getManifest())
                    {
                        if (auto path = sanitiseRelativePath (args[0].toString()); path.has_value())
                        {
                            if (auto content = manifest->readFileContent (*path))
                            {
                                return choc::value::createArray (static_cast<uint32_t> (content->length()),
                                                                 [&] (uint32_t index) { return static_cast<int32_t> ((*content)[index]); });
                            }
                        }
                    }
                }
            }
            catch (const std::exception& e)
            {
                logRuntimeIssue ("Resource bridge read failed", e.what());
            }
            catch (...)
            {
                logRuntimeIssue ("Resource bridge read failed", "Unknown error");
            }

            return {};
        });

        boundOK = boundOK && view.bind ("_internalReadResourceAsAudioData", [this] (const choc::value::ValueView& args) -> choc::value::Value
        {
            try
            {
                if (args.isArray() && args.size() != 0)
                {
                    const auto path = sanitiseRelativePath (args[0].toString());

                    if (path.has_value() && ! path->empty())
                    {
                        choc::value::Value annotation;

                        if (args.size() > 1)
                            annotation = args[1];

                        if (auto manifest = patch.getManifest())
                            return readManifestResourceAsAudioData (*manifest, *path, annotation);
                    }
                }
            }
            catch (const std::exception& e)
            {
                logRuntimeIssue ("Audio-data bridge read failed", e.what());
            }
            catch (...)
            {
                logRuntimeIssue ("Audio-data bridge read failed", "Unknown error");
            }

            return {};
        });

        boundOK = boundOK && view.bind ("cmaj_getPatchBootConfig", [this] (const choc::value::ValueView&) -> choc::value::Value
        {
            return createPatchBootConfig (patch, currentView);
        });

        boundOK = boundOK && view.bind ("cmaj_triggerHaptic", [] (const choc::value::ValueView& args) -> choc::value::Value
        {
            using namespace choc::objc;
            CHOC_AUTORELEASE_BEGIN

            int style = 0;

            if (args.isArray() && args.size() != 0)
            {
                const auto styleName = args[0].toString();

                if (styleName == "medium")      style = 1;
                else if (styleName == "heavy")  style = 2;
                else if (styleName == "soft")   style = 3;
                else if (styleName == "rigid")  style = 4;
            }

            if (auto generator = call<id> (callClass<id> ("UIImpactFeedbackGenerator", "alloc"), "initWithStyle:", style))
            {
                call<void> (generator, "prepare");
                call<void> (generator, "impactOccurred");
            }

            CHOC_AUTORELEASE_END
            return {};
        });

        boundOK = boundOK && view.bind ("cmaj_requestBundledFallback", [this] (const choc::value::ValueView&) -> choc::value::Value
        {
            navigateToBundlePage();
            return {};
        });

        boundOK = boundOK && view.bind ("cmaj_notifyHostPageReady", [] (const choc::value::ValueView&) -> choc::value::Value
        {
            return {};
        });

        boundOK = boundOK && view.bind ("cosimo_set_articulation_trigger_config", [this] (const choc::value::ValueView& args) -> choc::value::Value
        {
            if (args.isArray() && args.size() > 0 && articulationTriggerConfigHandler)
                articulationTriggerConfigHandler (args[0].toString());

            return {};
        });

        (void) boundOK;
        jassert (boundOK);
    }

    void navigateToBundlePage()
    {
        if (webView == nullptr)
            return;

        if (loadBootPageHTML)
        {
            if (auto htmlFile = resolveBundleResourceFile ("patch_gui/index.ios.html"); htmlFile.existsAsFile())
            {
                webView->setHTML (htmlFile.loadFileAsString().toStdString());
                return;
            }
        }

        webView->navigate (getBundlePageURL());
    }

    std::optional<choc::ui::WebView::Options::Resource> onRequest (const std::string& path) const
    {
        const auto normalised = sanitiseRelativePath (path);

        if (! normalised.has_value())
            return {};

        const auto relativePath = normalised->empty() ? std::string ("patch_gui/index.ios.html") : *normalised;
        const auto file = resolveRuntimeResourceFile (relativePath);

        if (! file.existsAsFile())
            return {};

        juce::MemoryBlock bytes;

        if (! file.loadFileAsData (bytes))
            return {};

        // The custom cosimo://bundle handler must serve raw bytes for binary assets such as WAV files.
        return choc::ui::WebView::Options::Resource (std::string_view (static_cast<const char*> (bytes.getData()),
                                                                       bytes.getSize()),
                                                     getMimeTypeForPath (relativePath));
    }

    std::unique_ptr<choc::ui::WebView> webView;
    cmaj::PatchManifest::View currentView;
    bool loadBootPageHTML = false;
    bool bridgeInitialised = false;
    std::function<void (std::string)> articulationTriggerConfigHandler;
};

inline cmaj::PatchManifest::View derivePatchViewSize (const cmaj::Patch& patch,
                                                      int lastEditorWidth,
                                                      int lastEditorHeight)
{
    auto view = cmaj::PatchManifest::View
    {
        choc::json::create ("width", lastEditorWidth,
                            "height", lastEditorHeight)
    };

    if (auto manifest = patch.getManifest())
        if (auto* defaultView = manifest->findDefaultView())
            if (lastEditorWidth == 0 && lastEditorHeight == 0)
                view = *defaultView;

   #if JUCE_IOS
    if ((view.getWidth() == 0 || view.getHeight() == 0) && view.isResizable())
        if (auto* display = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay())
        {
            const auto screenBounds = display->userArea.isEmpty() ? display->totalArea
                                                                  : display->userArea;

            if (view.getWidth() == 0)
                view.view.setMember ("width", std::max (50, screenBounds.getWidth()));

            if (view.getHeight() == 0)
                view.view.setMember ("height", std::max (50, screenBounds.getHeight()));
        }
   #endif

    if (view.getWidth() == 0)
        view.view.setMember ("width", 500);

    if (view.getHeight() == 0)
        view.view.setMember ("height", 400);

    return view;
}

} // namespace detail

template <typename GeneratedPerformerClass>
class GeneratedPlugin final : public juce::AudioPluginInstance,
                              private juce::MessageListener
{
public:
    static_assert (GeneratedPerformerClass::maxFramesPerBlock == 128,
                   "The iOS Cmajor performer must render in 128-frame slices");

    GeneratedPlugin()
        : juce::AudioPluginInstance (getBusLayout()),
          patch (std::make_shared<cmaj::Patch>())
    {
        if (juce::MessageManager::getInstance()->isThisTheMessageThread())
            choc::messageloop::initialise();
        else
            juce::MessageManager::callAsync ([] { choc::messageloop::initialise(); });

        patch->setHostDescription (std::string (getWrapperTypeDescription (wrapperType)));
        patch->stopPlayback = [this] { suspendProcessing (true); };
        patch->startPlayback = [this] { suspendProcessing (false); };
        patch->patchChanged = [this]
        {
            const auto notify = [this] { handlePatchChange(); };

            if (juce::MessageManager::getInstance()->isThisTheMessageThread())
                notify();
            else
                juce::MessageManager::callAsync (notify);
        };
        patch->statusChanged = [this] (const auto& status)
        {
           #if COSIMO_ENABLE_MODULATION_BENCHMARK_METRICS
            if (! status.statusMessage.empty())
                detail::logRuntimeIssue (status.messageList.hasErrors() ? "Benchmark patch error" : "Benchmark patch status",
                                         status.statusMessage);
           #endif
            setStatusMessage (status.statusMessage, status.messageList.hasErrors());
        };
        patch->handleOutputEvent = [this] (uint64_t frame, std::string_view endpointID, const choc::value::ValueView& value)
        {
            handleOutputEvent (frame, endpointID, value);
        };

       #if CMAJ_USE_QUICKJS_WORKER
        enableQuickJSPatchWorker (*patch);
       #else
        enableWebViewPatchWorker (*patch);
       #endif

        patch->createEngine = [] { return cmaj::createEngineForGeneratedCppProgram<GeneratedPerformerClass>(); };

        applyRateAndBlockSize (44100.0, 128);
        setNewState (createEmptyState());
    }

    ~GeneratedPlugin() override
    {
        patch->patchChanged = [] {};
        patch->unload();
        patch.reset();
    }

    const juce::String getName() const override
    {
        if (auto name = patch->getName(); ! name.empty())
            return name;

        return "Cosimo Synth";
    }

    juce::StringArray getAlternateDisplayNames() const override
    {
        juce::StringArray names;
        names.add (getName());

        if (auto description = patch->getDescription(); ! description.empty())
            names.add (description);

        return names;
    }

    void fillInPluginDescription (juce::PluginDescription& description) const override
    {
        description.name = getName();
        description.descriptiveName = patch->getDescription().empty() ? getName() : juce::String (patch->getDescription());
        description.category = juce::String (patch->getCategory());
        description.manufacturerName = juce::String (patch->getManufacturer());
        description.version = juce::String (patch->getVersion());
        description.lastFileModTime = juce::Time::getCurrentTime();
        description.isInstrument = patch->isInstrument();
        description.uniqueId = static_cast<int> (std::hash<std::string>{} (patch->getUID()));
        description.fileOrIdentifier = "Cmajor:" + juce::String (patch->getUID());
        description.pluginFormatName = "Cmajor";
        description.lastInfoUpdateTime = juce::Time::getCurrentTime();
        description.deprecatedUid = description.uniqueId;
    }

    juce::AudioProcessorEditor* createEditor() override
    {
        return new Editor (*this);
    }

    bool hasEditor() const override                       { return true; }
    bool acceptsMidi() const override                     { return patch->hasMIDIInput(); }
    bool producesMidi() const override                    { return patch->hasMIDIOutput(); }
    bool supportsMPE() const override                     { return acceptsMidi(); }
    bool isMidiEffect() const override                    { return patch->hasMIDIInput() && ! patch->hasAudioOutput(); }
    double getTailLengthSeconds() const override          { return 0.0; }
    int getNumPrograms() override                         { return 1; }
    int getCurrentProgram() override                      { return 0; }
    void setCurrentProgram (int) override                 {}
    const juce::String getProgramName (int) override      { return "None"; }
    void changeProgramName (int, const juce::String&) override {}

    void prepareToPlay (double sampleRate, int samplesPerBlock) override
    {
        applyRateAndBlockSize (sampleRate, static_cast<uint32_t> (samplesPerBlock));
    }

    void releaseResources() override {}

    bool isBusesLayoutSupported (const BusesLayout& layout) const override
    {
        const auto patchBuses = getBusesProperties (patch->getInputEndpoints(), patch->getOutputEndpoints());
        return isLayoutOK (patchBuses.inputLayouts, layout.inputBuses)
            && isLayoutOK (patchBuses.outputLayouts, layout.outputBuses);
    }

    bool applyBusLayouts (const BusesLayout& layouts) override
    {
        const auto applied = juce::AudioPluginInstance::applyBusLayouts (layouts);
        applyCurrentRateAndBlockSize();
        return applied;
    }

    void processBlock (juce::AudioBuffer<float>& audio, juce::MidiBuffer& midi) override
    {
        if (! patch->isPlayable() || isSuspended())
        {
            audio.clear();
            midi.clear();
            return;
        }

        juce::ScopedNoDenormals noDenormals;

       #if COSIMO_ENABLE_MODULATION_BENCHMARK_METRICS
        const bool captureBenchmarkBlock = beginBenchmarkRenderBlock();
        const auto benchmarkRenderStartedAt = captureBenchmarkBlock ? juce::Time::getHighResolutionTicks() : 0;
       #endif

        if (auto* playHead = getPlayHead())
            updateTimelineFromPlayhead (*playHead);

        applyPendingArticulationTriggerConfig();

        cosimo::cmajor_bridge::processBlockWithFutureDawNoteMeta (
            *patch,
            audio,
            midi,
            noteMetaBridge,
            [&midi] (uint32_t frame, choc::midi::ShortMessage message)
            {
                midi.addEvent (message.data(), static_cast<int> (message.length()), static_cast<int> (frame));
            });

       #if COSIMO_ENABLE_MODULATION_BENCHMARK_METRICS
        if (captureBenchmarkBlock)
        {
            recordBenchmarkRenderBlock (benchmarkRenderStartedAt,
                                        juce::Time::getHighResolutionTicks(),
                                        static_cast<uint32_t> (audio.getNumSamples()),
                                        getSampleRate());
            benchmarkWriters.fetch_sub (1, std::memory_order_release);
        }
       #endif
    }

    void processBlock (juce::AudioBuffer<double>&, juce::MidiBuffer&) override
    {
        jassertfalse;
    }

    void setPendingArticulationTriggerConfigFromJSONString (const std::string& serializedConfig)
    {
        setPendingArticulationTriggerConfig (
            cosimo::future_daw::createTriggerConfigFromJSONString (serializedConfig));
    }

    void getStateInformation (juce::MemoryBlock& destinationData) override
    {
        juce::MemoryOutputStream output (destinationData, false);
        getUpdatedState().writeToStream (output);
    }

    void setStateInformation (const void* data, int sizeInBytes) override
    {
        auto restoredState = juce::ValueTree::readFromData (
            data, static_cast<size_t> (sizeInBytes));
        if (! isCurrentCompleteSoundState (restoredState))
            return;

        choc::hash::xxHash64 hash (1);
        hash.addInput (data, static_cast<size_t> (sizeInBytes));
        const auto stateHash = hash.getHash();

        if (lastLoadedStateHash != stateHash)
        {
            lastLoadedStateHash = stateHash;
            setNewStateAsync (std::move (restoredState));
        }
    }

    struct SharedWavetableLibraryScreen
    {
        enum class Mode
        {
            patchView,
            standaloneInstaller,
            extensionUnavailable,
        };
    };

    typename SharedWavetableLibraryScreen::Mode getScreenMode() const
    {
        if (inspectSharedWavetableLibrary().ready)
            return SharedWavetableLibraryScreen::Mode::patchView;

        if (wrapperType == juce::AudioProcessor::wrapperType_Standalone)
            return SharedWavetableLibraryScreen::Mode::standaloneInstaller;

        if (wrapperType == juce::AudioProcessor::wrapperType_AudioUnitv3)
            return SharedWavetableLibraryScreen::Mode::extensionUnavailable;

        return SharedWavetableLibraryScreen::Mode::patchView;
    }

    std::string getScreenModeName() const
    {
        switch (getScreenMode())
        {
            case SharedWavetableLibraryScreen::Mode::patchView: return "patchView";
            case SharedWavetableLibraryScreen::Mode::standaloneInstaller: return "standaloneInstaller";
            case SharedWavetableLibraryScreen::Mode::extensionUnavailable: return "extensionUnavailable";
        }

        return "patchView";
    }

private:
   #if COSIMO_ENABLE_MODULATION_BENCHMARK_METRICS
    enum class BenchmarkParameterKind
    {
        profileSelection,
        runtimeReady,
        runtimeReadyRequest,
        install,
        installStatus,
        installGeneration,
        capture,
        captureGeneration,
        captureStopGeneration,
        resultGeneration,
        resultFieldRequest,
        resultFieldResponse,
        acceptedModulationProgramSerial,
        installedVoiceRouteCount,
        installedMacroVoiceRouteCount,
        installedVoiceRackRouteCount,
        installedMacroRackRouteCount,
        renderBlockCount,
        capturedRenderSampleCount,
        dspSampleRate,
        audioFrames,
        minimumFrames,
        maximumFrames,
        renderLoadPercent,
        p99RenderLoadPercent,
        p999RenderLoadPercent,
        maximumRenderLoadPercent,
        deadlineMissCount,
        voiceMask,
        rackEnableMask,
    };

    struct BenchmarkParameter final : public juce::HostedAudioProcessorParameter
    {
        BenchmarkParameter (GeneratedPlugin& ownerToUse,
                            BenchmarkParameterKind kindToUse,
                            juce::String idToUse,
                            juce::String nameToUse)
            : juce::HostedAudioProcessorParameter (1),
              owner (ownerToUse),
              kind (kindToUse),
              id (std::move (idToUse)),
              name (std::move (nameToUse))
        {
        }

        juce::String getParameterID() const override        { return id; }
        juce::String getName (int maxLength) const override { return name.substring (0, maxLength); }
        juce::String getLabel() const override              { return {}; }
        Category getCategory() const override               { return Category::genericParameter; }
        bool isDiscrete() const override
        {
            return kind == BenchmarkParameterKind::profileSelection
                || kind == BenchmarkParameterKind::runtimeReady
                || kind == BenchmarkParameterKind::runtimeReadyRequest
                || kind == BenchmarkParameterKind::install
                || kind == BenchmarkParameterKind::installStatus
                || kind == BenchmarkParameterKind::capture
                || kind == BenchmarkParameterKind::resultFieldRequest;
        }
        bool isAutomatable() const override                 { return true; }
        bool isMetaParameter() const override               { return false; }
        float getDefaultValue() const override              { return 0.0f; }
        float getValue() const override                     { return owner.getBenchmarkParameterValue (kind); }

        void setValue (float value) override
        {
            owner.setBenchmarkParameterValue (kind, value);
        }

        juce::String getText (float value, int maximumLength) const override
        {
            return juce::String (value, 6).substring (0, maximumLength);
        }

        float getValueForText (const juce::String& text) const override
        {
            return text.getFloatValue();
        }

        int getNumSteps() const override
        {
            if (kind == BenchmarkParameterKind::capture) return 3;
            if (kind == BenchmarkParameterKind::resultFieldRequest) return 19;
            if (kind == BenchmarkParameterKind::install) return 2;
            if (kind == BenchmarkParameterKind::runtimeReady) return 2;
            if (kind == BenchmarkParameterKind::runtimeReadyRequest) return 2;
            if (kind == BenchmarkParameterKind::installStatus) return 4;
            if (kind == BenchmarkParameterKind::profileSelection) return 7;
            return AudioProcessor::getDefaultNumParameterSteps();
        }

        void publish()
        {
            sendValueChangedMessageToListeners (getValue());
        }

        GeneratedPlugin& owner;
        BenchmarkParameterKind kind;
        juce::String id;
        juce::String name;
    };

    static constexpr size_t modulationBenchmarkMaximumRenderSamples = 65536;

    bool beginBenchmarkRenderBlock()
    {
        if (! modulationBenchmarkCaptureActive.load (std::memory_order_acquire))
            return false;

        benchmarkWriters.fetch_add (1, std::memory_order_acq_rel);
        if (! modulationBenchmarkCaptureActive.load (std::memory_order_acquire))
        {
            benchmarkWriters.fetch_sub (1, std::memory_order_release);
            return false;
        }
        return true;
    }

    void recordBenchmarkRenderBlock (int64_t startedAt, int64_t finishedAt, uint32_t frameCount, double sampleRate)
    {
        const auto tickCount = static_cast<uint64_t> (std::max<int64_t> (0, finishedAt - startedAt));
        const auto ticksPerSecond = static_cast<double> (juce::Time::getHighResolutionTicksPerSecond());
        const double renderSeconds = ticksPerSecond > 0.0 ? static_cast<double> (tickCount) / ticksPerSecond : 0.0;
        const double deadlineSeconds = sampleRate > 0.0 ? static_cast<double> (frameCount) / sampleRate : 0.0;
        const double renderRatio = deadlineSeconds > 0.0 ? renderSeconds / deadlineSeconds : 0.0;
        const auto sampleIndex = benchmarkRenderSampleCount.fetch_add (1, std::memory_order_relaxed);
        if (sampleIndex < benchmarkRenderRatios.size())
            benchmarkRenderRatios[sampleIndex] = renderRatio;

        benchmarkRenderTicks.fetch_add (tickCount, std::memory_order_relaxed);
        benchmarkAudioFrames.fetch_add (frameCount, std::memory_order_relaxed);
        benchmarkRenderBlockCount.fetch_add (1, std::memory_order_relaxed);
        if (renderRatio >= 1.0)
            benchmarkDeadlineMissCount.fetch_add (1, std::memory_order_relaxed);

        auto minimumFrames = benchmarkMinimumFrames.load (std::memory_order_relaxed);
        while (frameCount < minimumFrames
               && ! benchmarkMinimumFrames.compare_exchange_weak (minimumFrames, frameCount, std::memory_order_relaxed)) {}
        auto maximumFrames = benchmarkMaximumFrames.load (std::memory_order_relaxed);
        while (frameCount > maximumFrames
               && ! benchmarkMaximumFrames.compare_exchange_weak (maximumFrames, frameCount, std::memory_order_relaxed)) {}
    }

    static float normaliseBenchmarkValue (double value, double maximum)
    {
        return static_cast<float> (std::clamp (value / maximum, 0.0, 1.0));
    }

    bool isBenchmarkRuntimeReady() const
    {
        const auto observedDspSessionId = benchmarkLastObservedDspSessionId.load();
        const auto acceptedProgramDspSessionId = benchmarkAcceptedProgramDspSessionId.load();
        const auto activeWavetableDspSessionId = benchmarkActiveWavetableDspSessionId.load();
        return observedDspSessionId > 0
            && benchmarkLastAcceptedProgramSerial.load() > 0
            && acceptedProgramDspSessionId == observedDspSessionId
            && activeWavetableDspSessionId == observedDspSessionId;
    }

    void publishBenchmarkParameter (BenchmarkParameterKind kind)
    {
        for (auto* parameter : benchmarkParameters)
            if (parameter->kind == kind)
                parameter->publish();
    }

    void publishBenchmarkResultParameters()
    {
        publishBenchmarkParameter (BenchmarkParameterKind::resultGeneration);
    }

    float getBenchmarkParameterValue (BenchmarkParameterKind kind) const
    {
        switch (kind)
        {
            case BenchmarkParameterKind::profileSelection:          return normaliseBenchmarkValue (benchmarkProfileSelection.load(), 6.0);
            case BenchmarkParameterKind::runtimeReady:              return isBenchmarkRuntimeReady() ? 1.0f : 0.0f;
            case BenchmarkParameterKind::runtimeReadyRequest:       return 0.0f;
            case BenchmarkParameterKind::install:                   return benchmarkInstallRequested.load() ? 1.0f : 0.0f;
            case BenchmarkParameterKind::installStatus:             return normaliseBenchmarkValue (benchmarkInstallStatus.load(), 3.0);
            case BenchmarkParameterKind::installGeneration:         return normaliseBenchmarkValue (benchmarkInstallGeneration.load(), 10000.0);
            case BenchmarkParameterKind::capture:                   return 0.0f;
            case BenchmarkParameterKind::captureGeneration:         return normaliseBenchmarkValue (benchmarkCaptureGeneration.load(), 10000.0);
            case BenchmarkParameterKind::captureStopGeneration:     return normaliseBenchmarkValue (benchmarkCaptureStopGeneration.load(), 10000.0);
            case BenchmarkParameterKind::resultGeneration:          return normaliseBenchmarkValue (benchmarkResultGeneration.load(), 10000.0);
            case BenchmarkParameterKind::resultFieldRequest:        return 0.0f;
            case BenchmarkParameterKind::resultFieldResponse:       return benchmarkResultFieldResponse.load();
            case BenchmarkParameterKind::acceptedModulationProgramSerial: return normaliseBenchmarkValue (benchmarkInstalledProgramSerial.load(), 100000.0);
            case BenchmarkParameterKind::installedVoiceRouteCount:       return normaliseBenchmarkValue (benchmarkInstalledVoiceRouteCount.load(), 590.0);
            case BenchmarkParameterKind::installedMacroVoiceRouteCount:  return normaliseBenchmarkValue (benchmarkInstalledMacroVoiceRouteCount.load(), 236.0);
            case BenchmarkParameterKind::installedVoiceRackRouteCount:   return normaliseBenchmarkValue (benchmarkInstalledVoiceRackRouteCount.load(), 470.0);
            case BenchmarkParameterKind::installedMacroRackRouteCount:   return normaliseBenchmarkValue (benchmarkInstalledMacroRackRouteCount.load(), 188.0);
            case BenchmarkParameterKind::renderBlockCount:          return normaliseBenchmarkValue (benchmarkResultRenderBlockCount.load(), 100000.0);
            case BenchmarkParameterKind::capturedRenderSampleCount: return normaliseBenchmarkValue (benchmarkResultSampleCount.load(), 100000.0);
            case BenchmarkParameterKind::dspSampleRate:             return normaliseBenchmarkValue (benchmarkResultDspSampleRate.load(), 192000.0);
            case BenchmarkParameterKind::audioFrames:               return normaliseBenchmarkValue (benchmarkResultAudioFrames.load(), 10000000.0);
            case BenchmarkParameterKind::minimumFrames:             return normaliseBenchmarkValue (benchmarkResultMinimumFrames.load(), 4096.0);
            case BenchmarkParameterKind::maximumFrames:             return normaliseBenchmarkValue (benchmarkResultMaximumFrames.load(), 4096.0);
            case BenchmarkParameterKind::renderLoadPercent:         return normaliseBenchmarkValue (benchmarkResultRenderLoadPercent.load(), 200.0);
            case BenchmarkParameterKind::p99RenderLoadPercent:      return normaliseBenchmarkValue (benchmarkResultP99RenderLoadPercent.load(), 200.0);
            case BenchmarkParameterKind::p999RenderLoadPercent:     return normaliseBenchmarkValue (benchmarkResultP999RenderLoadPercent.load(), 200.0);
            case BenchmarkParameterKind::maximumRenderLoadPercent:  return normaliseBenchmarkValue (benchmarkResultMaximumRenderLoadPercent.load(), 1000.0);
            case BenchmarkParameterKind::deadlineMissCount:         return normaliseBenchmarkValue (benchmarkResultDeadlineMissCount.load(), 10000.0);
            case BenchmarkParameterKind::voiceMask:                 return normaliseBenchmarkValue (benchmarkVoiceMask.load(), 65535.0);
            case BenchmarkParameterKind::rackEnableMask:            return normaliseBenchmarkValue (benchmarkResultRackEnableMask.load(), 255.0);
        }

        return 0.0f;
    }

    void setBenchmarkParameterValue (BenchmarkParameterKind kind, float value)
    {
        if (kind == BenchmarkParameterKind::runtimeReadyRequest)
        {
            if (! isBenchmarkRuntimeReady())
            {
                const auto syncRequest = choc::value::createInt32 (1);
                patch->sendEventOrValueToPatch (
                    cmaj::EndpointID::create (std::string_view ("runtimeSyncRequest")),
                    syncRequest,
                    0,
                    0);
            }
            publishBenchmarkParameter (BenchmarkParameterKind::runtimeReady);
            return;
        }

        if (kind == BenchmarkParameterKind::resultFieldRequest)
        {
            static constexpr std::array resultKinds {
                BenchmarkParameterKind::acceptedModulationProgramSerial,
                BenchmarkParameterKind::installedVoiceRouteCount,
                BenchmarkParameterKind::installedMacroVoiceRouteCount,
                BenchmarkParameterKind::installedVoiceRackRouteCount,
                BenchmarkParameterKind::installedMacroRackRouteCount,
                BenchmarkParameterKind::renderBlockCount,
                BenchmarkParameterKind::capturedRenderSampleCount,
                BenchmarkParameterKind::dspSampleRate,
                BenchmarkParameterKind::audioFrames,
                BenchmarkParameterKind::minimumFrames,
                BenchmarkParameterKind::maximumFrames,
                BenchmarkParameterKind::renderLoadPercent,
                BenchmarkParameterKind::p99RenderLoadPercent,
                BenchmarkParameterKind::p999RenderLoadPercent,
                BenchmarkParameterKind::maximumRenderLoadPercent,
                BenchmarkParameterKind::deadlineMissCount,
                BenchmarkParameterKind::voiceMask,
                BenchmarkParameterKind::rackEnableMask,
            };
            const auto command = std::clamp (std::lround (value * static_cast<float> (resultKinds.size())),
                                             0l,
                                             static_cast<long> (resultKinds.size()));
            if (command > 0)
            {
                const auto index = static_cast<size_t> (command - 1);
                const auto resultValue = getBenchmarkParameterValue (resultKinds[index]);
                const auto encodedResponse = (static_cast<float> (index) + 0.25f + 0.5f * resultValue)
                                           / static_cast<float> (resultKinds.size());
                benchmarkResultFieldResponse.store (encodedResponse);
                publishBenchmarkParameter (BenchmarkParameterKind::resultFieldResponse);
            }
            return;
        }

        if (kind == BenchmarkParameterKind::profileSelection)
        {
            benchmarkProfileSelection.store (static_cast<uint32_t> (std::clamp (std::lround (value * 6.0f), 0l, 6l)));
            return;
        }

        if (kind == BenchmarkParameterKind::install)
        {
            const bool requested = value >= 0.5f;
            const bool wasRequested = benchmarkInstallRequested.exchange (requested);
            if (requested && ! wasRequested)
            {
                const auto profileIndex = benchmarkProfileSelection.load();
                juce::MessageManager::callAsync ([this, profileIndex] { installBenchmarkProfile (profileIndex); });
            }
            return;
        }

        if (kind != BenchmarkParameterKind::capture)
            return;

        const auto command = std::clamp (std::lround (value * 2.0f), 0l, 2l);
        if (command == 1)
            juce::MessageManager::callAsync ([this] { beginModulationBenchmarkCapture(); });
        else if (command == 2)
        {
            benchmarkCaptureStopGeneration.fetch_add (1);
            publishBenchmarkParameter (BenchmarkParameterKind::captureStopGeneration);
            juce::MessageManager::callAsync ([this] { endModulationBenchmarkCapture(); });
        }
    }

    void completeBenchmarkProfileInstall (int32_t acceptedProgramSerial,
                                            int32_t installedVoice,
                                            int32_t installedMacroVoice,
                                            int32_t installedVoiceRack,
                                            int32_t installedMacroRack)
    {
        benchmarkInstalledProgramSerial.store (acceptedProgramSerial);
        benchmarkInstalledVoiceRouteCount.store (installedVoice);
        benchmarkInstalledMacroVoiceRouteCount.store (installedMacroVoice);
        benchmarkInstalledVoiceRackRouteCount.store (installedVoiceRack);
        benchmarkInstalledMacroRackRouteCount.store (installedMacroRack);
        const bool countsMatch = installedVoice == benchmarkExpectedVoiceRouteCount.load()
            && installedMacroVoice == benchmarkExpectedMacroVoiceRouteCount.load()
            && installedVoiceRack == benchmarkExpectedVoiceRackRouteCount.load()
            && installedMacroRack == benchmarkExpectedMacroRackRouteCount.load();
        benchmarkInstallStatus.store (countsMatch ? 2 : 3);
        benchmarkInstallGeneration.fetch_add (1);
        publishBenchmarkParameter (BenchmarkParameterKind::installStatus);
        publishBenchmarkParameter (BenchmarkParameterKind::installGeneration);
    }

    void installBenchmarkProfile (uint32_t profileIndex)
    {
        try
        {
            static constexpr auto modulationStateKey = "modulation.v6";
            const auto profileFile = detail::resolveBundleResourceFile ("benchmark/modulation-benchmark-profiles.json");
            if (! profileFile.existsAsFile())
                throw std::runtime_error ("Benchmark profile bundle is missing");

            const auto document = choc::json::parse (profileFile.loadFileAsString().toStdString());
            const auto profiles = document["profiles"];
            if (! profiles.isArray() || profileIndex >= profiles.size())
                throw std::runtime_error ("Benchmark profile index is invalid");

            const auto stateJSON = profiles[profileIndex]["stateJSON"].getWithDefault<std::string> ({});
            if (stateJSON.empty())
                throw std::runtime_error ("Benchmark profile state is missing");

            const auto compiledCounts = profiles[profileIndex]["compiledCounts"];
            const auto expectedVoice = compiledCounts["voice"].getWithDefault<int32_t> (-1);
            const auto expectedMacroVoice = compiledCounts["macroVoice"].getWithDefault<int32_t> (-1);
            const auto expectedVoiceRack = compiledCounts["voiceRack"].getWithDefault<int32_t> (-1);
            const auto expectedMacroRack = compiledCounts["macroRack"].getWithDefault<int32_t> (-1);
            if (expectedVoice < 0 || expectedMacroVoice < 0 || expectedVoiceRack < 0 || expectedMacroRack < 0)
                throw std::runtime_error ("Benchmark profile compiled route counts are missing");

            benchmarkExpectedVoiceRouteCount.store (expectedVoice);
            benchmarkExpectedMacroVoiceRouteCount.store (expectedMacroVoice);
            benchmarkExpectedVoiceRackRouteCount.store (expectedVoiceRack);
            benchmarkExpectedMacroRackRouteCount.store (expectedMacroRack);

            benchmarkInstallBaselineSerial.store (std::max (benchmarkLastAcceptedSerial.load(),
                                                             benchmarkLastRejectedSerial.load()));
            benchmarkInstallBaselineProgramSerial.store (benchmarkLastAcceptedProgramSerial.load());
            benchmarkInstallStatus.store (1);
            publishBenchmarkParameter (BenchmarkParameterKind::installStatus);
            detail::logRuntimeIssue ("Benchmark profile install",
                                     "profile=" + std::to_string (profileIndex)
                                         + ", playable=" + std::to_string (patch->isPlayable())
                                         + ", baseline=" + std::to_string (benchmarkInstallBaselineSerial.load()));

            const auto& storedStates = patch->getStoredStateValues();
            const auto currentState = storedStates.find (modulationStateKey);
            const bool stateAlreadyInstalled = currentState != storedStates.end()
                && currentState->second.isString()
                && currentState->second.getString() == stateJSON;
            const bool acknowledgedProgramMatches = benchmarkLastAcceptedProgramSerial.load() > 0
                && benchmarkCurrentVoiceRouteCount.load() == expectedVoice
                && benchmarkCurrentMacroVoiceRouteCount.load() == expectedMacroVoice
                && benchmarkCurrentVoiceRackRouteCount.load() == expectedVoiceRack
                && benchmarkCurrentMacroRackRouteCount.load() == expectedMacroRack;
            if (stateAlreadyInstalled && acknowledgedProgramMatches)
            {
                completeBenchmarkProfileInstall (benchmarkLastAcceptedProgramSerial.load(),
                                                 expectedVoice,
                                                 expectedMacroVoice,
                                                 expectedVoiceRack,
                                                 expectedMacroRack);
                return;
            }

            patch->setStoredStateValue (modulationStateKey, choc::value::createString (stateJSON));
        }
        catch (...)
        {
            benchmarkInstallStatus.store (3);
            benchmarkInstallGeneration.fetch_add (1);
            publishBenchmarkParameter (BenchmarkParameterKind::installStatus);
            publishBenchmarkParameter (BenchmarkParameterKind::installGeneration);
        }
    }

    void beginModulationBenchmarkCapture()
    {
        modulationBenchmarkCaptureActive.store (false, std::memory_order_release);
        while (benchmarkWriters.load (std::memory_order_acquire) != 0)
            std::this_thread::yield();

        benchmarkRenderTicks.store (0, std::memory_order_relaxed);
        benchmarkAudioFrames.store (0, std::memory_order_relaxed);
        benchmarkRenderBlockCount.store (0, std::memory_order_relaxed);
        benchmarkDeadlineMissCount.store (0, std::memory_order_relaxed);
        benchmarkRenderSampleCount.store (0, std::memory_order_relaxed);
        benchmarkMinimumFrames.store (UINT32_MAX, std::memory_order_relaxed);
        benchmarkMaximumFrames.store (0, std::memory_order_relaxed);
        modulationBenchmarkCaptureActive.store (true, std::memory_order_release);
        benchmarkCaptureGeneration.fetch_add (1);
        publishBenchmarkParameter (BenchmarkParameterKind::captureGeneration);
    }

    void endModulationBenchmarkCapture()
    {
        modulationBenchmarkCaptureActive.store (false, std::memory_order_release);
        if (benchmarkWriters.load (std::memory_order_acquire) != 0)
        {
            juce::MessageManager::callAsync ([this] { endModulationBenchmarkCapture(); });
            return;
        }

        const auto blockCount = benchmarkRenderBlockCount.load (std::memory_order_relaxed);
        const auto sampleCount = std::min<uint64_t> (benchmarkRenderSampleCount.load (std::memory_order_relaxed),
                                                     benchmarkRenderRatios.size());
        std::vector<double> sortedRatios (benchmarkRenderRatios.begin(), benchmarkRenderRatios.begin() + sampleCount);
        std::sort (sortedRatios.begin(), sortedRatios.end());
        const auto percentile = [&sortedRatios] (double quantile)
        {
            if (sortedRatios.empty())
                return 0.0;
            const auto index = std::min<size_t> (sortedRatios.size() - 1,
                                                 static_cast<size_t> (std::floor (quantile * sortedRatios.size())));
            return sortedRatios[index] * 100.0;
        };
        const auto renderTicks = benchmarkRenderTicks.load (std::memory_order_relaxed);
        const auto audioFrames = benchmarkAudioFrames.load (std::memory_order_relaxed);
        const double ticksPerSecond = static_cast<double> (juce::Time::getHighResolutionTicksPerSecond());
        const double renderSeconds = ticksPerSecond > 0.0 ? static_cast<double> (renderTicks) / ticksPerSecond : 0.0;
        const double audioSeconds = getSampleRate() > 0.0 ? static_cast<double> (audioFrames) / getSampleRate() : 0.0;
        const auto minimumFrames = benchmarkMinimumFrames.load (std::memory_order_relaxed);

        benchmarkResultRenderBlockCount.store (blockCount);
        benchmarkResultSampleCount.store (sampleCount);
        benchmarkResultAudioFrames.store (audioFrames);
        benchmarkResultDspSampleRate.store (getSampleRate());
        benchmarkResultMinimumFrames.store (minimumFrames == UINT32_MAX ? 0 : minimumFrames);
        benchmarkResultMaximumFrames.store (benchmarkMaximumFrames.load (std::memory_order_relaxed));
        benchmarkResultRenderLoadPercent.store (audioSeconds > 0.0 ? renderSeconds * 100.0 / audioSeconds : 0.0);
        benchmarkResultP99RenderLoadPercent.store (percentile (0.99));
        benchmarkResultP999RenderLoadPercent.store (percentile (0.999));
        benchmarkResultMaximumRenderLoadPercent.store (sortedRatios.empty() ? 0.0 : sortedRatios.back() * 100.0);
        benchmarkResultDeadlineMissCount.store (benchmarkDeadlineMissCount.load (std::memory_order_relaxed));
        benchmarkResultRackEnableMask.store (benchmarkRackEnableMask.load (std::memory_order_relaxed));
        benchmarkResultGeneration.fetch_add (1);
        publishBenchmarkResultParameters();
    }
   #endif

    void setPendingArticulationTriggerConfig (cosimo::future_daw::ArticulationTriggerConfig config)
    {
        std::atomic_store (&pendingArticulationTriggerConfig,
                           std::make_shared<const cosimo::future_daw::ArticulationTriggerConfig> (std::move (config)));
    }

    void applyPendingArticulationTriggerConfig()
    {
        auto pendingConfig = std::atomic_load (&pendingArticulationTriggerConfig);

        if (pendingConfig == activeArticulationTriggerConfig || pendingConfig == nullptr)
            return;

        noteMetaBridge.setTriggerConfig (*pendingConfig);
        activeArticulationTriggerConfig = std::move (pendingConfig);
    }

    static bool isLayoutOK (const juce::Array<BusProperties>& patchLayouts,
                            const juce::Array<juce::AudioChannelSet>& suggestedLayouts)
    {
        if (patchLayouts.isEmpty())
            return suggestedLayouts.isEmpty() || suggestedLayouts.getReference (0).size() == 0;

        for (int index = 0; index < juce::jmin (patchLayouts.size(), suggestedLayouts.size()); ++index)
            if (patchLayouts.getReference (index).defaultLayout.size() != suggestedLayouts.getReference (index).size())
                return false;

        return true;
    }

    static BusesProperties getBusesProperties (const cmaj::EndpointDetailsList& inputs,
                                               const cmaj::EndpointDetailsList& outputs)
    {
        BusesProperties layout;
        uint32_t inputChannels = 0;
        uint32_t outputChannels = 0;

        for (const auto& input : inputs)
            inputChannels += input.getNumAudioChannels();

        for (const auto& output : outputs)
            outputChannels += output.getNumAudioChannels();

        if (inputChannels > 0)
            layout.addBus (true, "in", juce::AudioChannelSet::canonicalChannelSet (static_cast<int> (inputChannels)), true);

        if (outputChannels > 0)
            layout.addBus (false, "out", juce::AudioChannelSet::canonicalChannelSet (static_cast<int> (outputChannels)), true);

        return layout;
    }

    static auto getBusLayout()
    {
        const auto programDetails = choc::json::parse (GeneratedPerformerClass::programDetailsJSON);
        return getBusesProperties (cmaj::EndpointDetailsList::fromJSON (programDetails["inputs"], true),
                                   cmaj::EndpointDetailsList::fromJSON (programDetails["outputs"], false));
    }

    struct Parameter final : public juce::HostedAudioProcessorParameter
    {
        Parameter (GeneratedPlugin& ownerToNotify, juce::String parameterID)
            : juce::HostedAudioProcessorParameter (1),
              owner (ownerToNotify),
              id (std::move (parameterID))
        {
        }

        ~Parameter() override
        {
            detach();
        }

        bool setPatchParam (cmaj::PatchParameterPtr newPatchParameter)
        {
            if (patchParameter == newPatchParameter)
                return false;

            detach();
            patchParameter = std::move (newPatchParameter);

            patchParameter->valueChanged = [this] (float newValue)
            {
                sendValueChangedMessageToListeners (patchParameter->properties.convertTo0to1 (newValue));
            };

            patchParameter->gestureStart = [this] { beginChangeGesture(); };
            patchParameter->gestureEnd = [this] { endChangeGesture(); };
            return true;
        }

        void detach()
        {
            if (patchParameter != nullptr)
            {
                patchParameter->valueChanged = [] (float) {};
                patchParameter->gestureStart = [] {};
                patchParameter->gestureEnd = [] {};
            }
        }

        void forceValueChanged()
        {
            if (patchParameter != nullptr)
                patchParameter->valueChanged (patchParameter->currentValue);
        }

        juce::String getParameterID() const override                { return id; }
        juce::String getName (int maxLength) const override         { return patchParameter == nullptr ? "unknown" : patchParameter->properties.name.substr (0, static_cast<size_t> (maxLength)); }
        juce::String getLabel() const override                      { return patchParameter == nullptr ? juce::String() : patchParameter->properties.unit; }
        Category getCategory() const override                       { return Category::genericParameter; }
        bool isDiscrete() const override                            { return patchParameter != nullptr && patchParameter->properties.discrete; }
        bool isBoolean() const override                             { return patchParameter != nullptr && patchParameter->properties.boolean; }
        bool isAutomatable() const override                         { return patchParameter == nullptr || patchParameter->properties.automatable; }
        bool isMetaParameter() const override                       { return patchParameter != nullptr && patchParameter->properties.hidden; }
        float getDefaultValue() const override                      { return patchParameter != nullptr ? patchParameter->properties.convertTo0to1 (patchParameter->properties.defaultValue) : 0.0f; }
        float getValue() const override                             { return patchParameter != nullptr ? patchParameter->properties.convertTo0to1 (patchParameter->currentValue) : 0.0f; }

        void setValue (float newValue) override
        {
            if (patchParameter != nullptr)
                patchParameter->setValue (patchParameter->properties.convertFrom0to1 (newValue), false, -1, 0);
        }

        juce::String getText (float value, int length) const override
        {
            if (patchParameter == nullptr)
                return "0";

            const auto text = patchParameter->properties.getValueAsString (patchParameter->properties.convertFrom0to1 (value));
            return length > 0 ? juce::String (text).substring (0, length) : juce::String (text);
        }

        float getValueForText (const juce::String& text) const override
        {
            if (patchParameter != nullptr)
            {
                if (auto value = patchParameter->properties.getStringAsValue (text.toStdString()))
                    return *value;

                return patchParameter->properties.defaultValue;
            }

            return 0.0f;
        }

        int getNumSteps() const override
        {
            if (patchParameter != nullptr)
                if (auto steps = patchParameter->properties.getNumDiscreteOptions())
                    return static_cast<int> (steps);

            return AudioProcessor::getDefaultNumParameterSteps();
        }

        juce::StringArray getAllValueStrings() const override
        {
            juce::StringArray values;

            if (patchParameter != nullptr)
                for (const auto& valueString : patchParameter->properties.valueStrings)
                    values.add (valueString);

            return values;
        }

        GeneratedPlugin& owner;
        cmaj::PatchParameterPtr patchParameter;
        juce::String id;
    };

    struct Editor final : public juce::AudioProcessorEditor
    {
        explicit Editor (GeneratedPlugin& ownerToUse)
            : juce::AudioProcessorEditor (ownerToUse),
              owner (ownerToUse),
              patchWebView (std::make_unique<detail::PatchWebViewHost> (*owner.patch,
                                                                        detail::derivePatchViewSize (*owner.patch,
                                                                                                    owner.lastEditorWidth,
                                                                                                    owner.lastEditorHeight),
                                                                        owner.wrapperType == juce::AudioProcessor::wrapperType_Standalone,
                                                                        [&ownerToUse] (std::string serializedConfig)
                                                                        {
                                                                            ownerToUse.setPendingArticulationTriggerConfigFromJSONString (std::move (serializedConfig));
                                                                        }
                                                                        ))
        {
            patchWebViewHolder = choc::ui::createJUCEWebViewHolder (patchWebView->getWebView());
            patchWebViewHolder->setSize (static_cast<int> (patchWebView->width), static_cast<int> (patchWebView->height));

            setResizeLimits (250, 160, 32768, 32768);

            lookAndFeel.setColour (juce::TextEditor::outlineColourId, juce::Colours::transparentBlack);
            lookAndFeel.setColour (juce::TextEditor::backgroundColourId, juce::Colours::transparentBlack);

            if (auto manifest = owner.patch->getManifest())
                if (auto* defaultView = manifest->findDefaultView())
                    if (auto colour = choc::text::trim (defaultView->view["background"].toString()); ! colour.empty())
                        lookAndFeel.setColour (juce::ResizableWindow::backgroundColourId, juce::Colour::fromString (colour));

            setLookAndFeel (&lookAndFeel);

            extraComponent = owner.createExtraComponent();

            if (extraComponent != nullptr)
                addChildComponent (*extraComponent);

            onPatchChanged (false);
            statusMessageChanged();

            juce::Font::setDefaultMinimumHorizontalScaleFactor (1.0f);
        }

        ~Editor() override
        {
            owner.editorBeingDeleted (this);
            setLookAndFeel (nullptr);
            patchWebViewHolder.reset();
            patchWebView.reset();
        }

        void statusMessageChanged()
        {
            owner.refreshExtraComponent (extraComponent.get());
            patchWebView->setStatusMessage (owner.statusMessage);

           #if JUCE_IOS && COSIMO_ENABLE_EDITOR_INSPECTION
            scheduleIOSDebugInspectionDump();
           #endif
        }

       #if JUCE_IOS && COSIMO_ENABLE_EDITOR_INSPECTION
        static juce::File getIOSDebugInspectionFile()
        {
            return juce::File::getSpecialLocation (juce::File::userDocumentsDirectory)
                .getChildFile ("ui-geometry.json");
        }

        void scheduleIOSDebugInspectionDump (int remainingAttempts = 80)
        {
            auto safeThis = juce::Component::SafePointer<Editor> (this);

            juce::Timer::callAfterDelay (250, [safeThis, remainingAttempts]
            {
                if (safeThis != nullptr)
                    safeThis->dumpIOSDebugInspection (remainingAttempts);
            });
        }

        void dumpIOSDebugInspection (int remainingAttempts)
        {
            const auto diagnosticsFile = getIOSDebugInspectionFile();
            const auto displayBounds = []() -> juce::Rectangle<int>
            {
                if (auto* display = juce::Desktop::getInstance().getDisplays().getPrimaryDisplay())
                    return display->userArea.isEmpty() ? display->totalArea : display->userArea;

                return {};
            }();

            const auto writeSnapshot = [this, diagnosticsFile, displayBounds] (std::string_view screenModeName,
                                                                               std::string_view errorMessage,
                                                                               const std::string& hostPageJSON,
                                                                               const std::string& domMetricsJSON,
                                                                               const std::string& catalogJSON,
                                                                               const std::string& runtimeJSON)
            {
                std::string json = "{\n";
                json += "  \"screenMode\": " + choc::json::getEscapedQuotedString (std::string (screenModeName)) + ",\n";
                json += "  \"native\": {\n";
                json += "    \"displayWidth\": " + std::to_string (displayBounds.getWidth()) + ",\n";
                json += "    \"displayHeight\": " + std::to_string (displayBounds.getHeight()) + ",\n";
                json += "    \"editorWidth\": " + std::to_string (getWidth()) + ",\n";
                json += "    \"editorHeight\": " + std::to_string (getHeight()) + ",\n";
                json += "    \"holderWidth\": " + std::to_string (patchWebViewHolder != nullptr ? patchWebViewHolder->getWidth() : 0) + ",\n";
                json += "    \"holderHeight\": " + std::to_string (patchWebViewHolder != nullptr ? patchWebViewHolder->getHeight() : 0) + ",\n";
                json += "    \"holderX\": " + std::to_string (patchWebViewHolder != nullptr ? patchWebViewHolder->getX() : 0) + ",\n";
                json += "    \"holderY\": " + std::to_string (patchWebViewHolder != nullptr ? patchWebViewHolder->getY() : 0) + ",\n";
                json += "    \"webViewPreferredWidth\": " + std::to_string (static_cast<int> (patchWebView->width)) + ",\n";
                json += "    \"webViewPreferredHeight\": " + std::to_string (static_cast<int> (patchWebView->height)) + "\n";
                json += "  },\n";
                json += "  \"hostPage\": " + hostPageJSON + ",\n";
                json += "  \"domMetrics\": " + domMetricsJSON + ",\n";
                json += "  \"catalog\": " + catalogJSON + ",\n";
                json += "  \"runtime\": " + runtimeJSON + ",\n";
                json += "  \"error\": " + (errorMessage.empty() ? std::string ("null")
                                                                 : choc::json::getEscapedQuotedString (std::string (errorMessage))) + "\n";
                json += "}\n";

                diagnosticsFile.replaceWithText (juce::String::fromUTF8 (json.c_str()));
            };

            const auto screenModeName = owner.getScreenModeName();

            if (owner.getScreenMode() != SharedWavetableLibraryScreen::Mode::patchView
            )
            {
                writeSnapshot (screenModeName,
                               "Patch view hidden.",
                               "null",
                               "null",
                               "null",
                               "null");
                return;
            }

            if (patchWebViewHolder == nullptr || ! patchWebViewHolder->isShowing())
            {
                if (remainingAttempts > 0)
                    scheduleIOSDebugInspectionDump (remainingAttempts - 1);

                return;
            }

            auto safeThis = juce::Component::SafePointer<Editor> (this);
            constexpr auto inspectionScript = R"((() => {
  const hostPage = (() => {
    if (typeof window.__cosimoInspectHostPage === 'function') {
      return window.__cosimoInspectHostPage();
    }

    const boot = globalThis.__COSIMO_PATCH_BOOT ?? {};
    const currentURL = window.location.href === 'about:blank' && typeof boot.bundlePageURL === 'string'
      ? boot.bundlePageURL
      : window.location.href;
    const devServerURL = typeof boot.devServerURL === 'string' ? boot.devServerURL : '';
    const bundlePageURL = typeof boot.bundlePageURL === 'string' ? boot.bundlePageURL : '';
    const bundleResourceBaseURL = typeof boot.bundleResourceBaseURL === 'string' ? boot.bundleResourceBaseURL : '';
    const bootSource = devServerURL && currentURL.startsWith(devServerURL) ? 'devServer' : 'bundle';
    const container = document.getElementById('cmaj-view-container');

    return {
      bootSource,
      currentURL,
      bundlePageURL,
      bundleResourceBaseURL,
      devServerURL,
      devServerProbe: globalThis.__COSIMO_DEV_SERVER_PROBE ?? null,
      resourceBaseURL: bootSource === 'devServer' ? devServerURL : bundleResourceBaseURL,
      documentTitle: document.title,
      htmlMarker: globalThis.__COSIMO_DEV_HTML_MARKER ?? '',
      jsMarker: globalThis.__COSIMO_DEV_JS_MARKER ?? '',
      statusText: '',
      viewActive: Boolean(container),
      containerText: container?.innerText ?? '',
    };
  })();
  const domMetrics = typeof window.__cosimoCollectLayoutMetrics === 'function' ? window.__cosimoCollectLayoutMetrics() : null;
  const catalog = globalThis.__cosimoLatestCatalogSnapshot ?? null;
  const runtime = typeof window.__cosimoInspectRuntimeState === 'function' ? window.__cosimoInspectRuntimeState() : null;
  return JSON.stringify({ hostPage, domMetrics, catalog, runtime });
})())";

            patchWebView->getWebView().evaluateJavascript (inspectionScript,
                                                           [safeThis, remainingAttempts, writeSnapshot, screenModeName] (const std::string& error,
                                                                                                                          const choc::value::ValueView& result)
            {
                if (safeThis == nullptr)
                    return;

                auto hostPageJSON = std::string ("null");
                auto domMetricsJSON = std::string ("null");
                auto catalogJSON = std::string ("null");
                auto runtimeJSON = std::string ("null");
                bool domReady = false;
                bool catalogReady = false;
                bool hostPageReady = false;
                bool runtimeReady = false;
                bool useContinuousPolling = false;
                bool shouldReloadBlankPage = false;
                auto errorMessage = error;
                auto inspectedResult = result;
                auto parsedInspectionResult = choc::value::Value();

                if (errorMessage.empty() && result.isString())
                {
                    try
                    {
                        parsedInspectionResult = choc::json::parse (result.toString());
                        inspectedResult = parsedInspectionResult;
                    }
                    catch (const std::exception& e)
                    {
                        errorMessage = std::string ("Could not parse iOS editor inspection JSON: ") + e.what();
                    }
                }

                if (! inspectedResult.isVoid() && inspectedResult.isObject())
                {
                    if (inspectedResult.hasObjectMember ("hostPage") && ! inspectedResult["hostPage"].isVoid())
                    {
                        hostPageJSON = choc::json::toString (inspectedResult["hostPage"], true);
                        hostPageReady = inspectedResult["hostPage"].isObject()
                            && inspectedResult["hostPage"].hasObjectMember ("viewActive")
                            && inspectedResult["hostPage"]["viewActive"].getWithDefault (false);
                        useContinuousPolling = inspectedResult["hostPage"].isObject()
                            && inspectedResult["hostPage"].hasObjectMember ("bootSource")
                            && inspectedResult["hostPage"]["bootSource"].toString() == "devServer";
                        shouldReloadBlankPage = inspectedResult["hostPage"].isObject()
                            && inspectedResult["hostPage"].hasObjectMember ("currentURL")
                            && inspectedResult["hostPage"]["currentURL"].toString() == "about:blank";
                    }

                    if (inspectedResult.hasObjectMember ("domMetrics") && ! inspectedResult["domMetrics"].isVoid())
                    {
                        domMetricsJSON = choc::json::toString (inspectedResult["domMetrics"], true);
                        domReady = inspectedResult["domMetrics"].isObject()
                            && inspectedResult["domMetrics"].hasObjectMember ("isReady")
                            && inspectedResult["domMetrics"]["isReady"].getWithDefault (false);
                    }

                    if (inspectedResult.hasObjectMember ("catalog") && ! inspectedResult["catalog"].isVoid())
                    {
                        catalogJSON = choc::json::toString (inspectedResult["catalog"], true);
                        catalogReady = inspectedResult["catalog"].isObject()
                            && (! inspectedResult["catalog"].hasObjectMember ("pending")
                                || ! inspectedResult["catalog"]["pending"].getWithDefault (false));
                    }

                    if (inspectedResult.hasObjectMember ("runtime") && ! inspectedResult["runtime"].isVoid())
                    {
                        runtimeJSON = choc::json::toString (inspectedResult["runtime"], true);
                        runtimeReady = inspectedResult["runtime"].isObject()
                            && inspectedResult["runtime"].hasObjectMember ("hasRuntimeStateEvent")
                            && inspectedResult["runtime"]["hasRuntimeStateEvent"].getWithDefault (false);
                    }
                }

                const bool inspectionReady = hostPageReady && domReady && catalogReady && runtimeReady;

                if (shouldReloadBlankPage && errorMessage.empty() && remainingAttempts > 0)
                {
                    safeThis->patchWebView->reload();
                    safeThis->scheduleIOSDebugInspectionDump (remainingAttempts - 1);
                    return;
                }

                if (inspectionReady || ! errorMessage.empty() || remainingAttempts <= 0 || ! getIOSDebugInspectionFile().existsAsFile())
                    writeSnapshot (screenModeName, errorMessage, hostPageJSON, domMetricsJSON, catalogJSON, runtimeJSON);

                if ((useContinuousPolling || ! inspectionReady) && errorMessage.empty() && remainingAttempts > 0)
                    safeThis->scheduleIOSDebugInspectionDump (remainingAttempts - 1);
            });
        }
       #endif

        void onPatchChanged (bool forceReload = true)
        {
            owner.refreshExtraComponent (extraComponent.get());

            if (owner.getScreenMode() == SharedWavetableLibraryScreen::Mode::patchView)
            {
                patchWebView->setActive (true);
                patchWebView->updateView (detail::derivePatchViewSize (*owner.patch,
                                                                      owner.lastEditorWidth,
                                                                      owner.lastEditorHeight));
                patchWebViewHolder->setSize (static_cast<int> (patchWebView->width), static_cast<int> (patchWebView->height));

                setResizable (patchWebView->resizable, false);

                addAndMakeVisible (*patchWebViewHolder);
                patchWebViewHolder->toFront (false);

                if (extraComponent != nullptr)
                    extraComponent->setVisible (false);

                if (! isResizing && ! patchWebView->resizable)
                    childBoundsChanged (nullptr);
                else
                    resized();

                if (forceReload || ! hasLoadedPatchWebView)
                    reloadPatchWebViewAsync();
            }
            else
            {
                removeChildComponent (patchWebViewHolder.get());
                patchWebView->setActive (false);
                patchWebViewHolder->setVisible (false);

                if (extraComponent != nullptr)
                {
                    addAndMakeVisible (*extraComponent);
                    extraComponent->toFront (false);
                }

                setSize (defaultWidth, defaultHeight);
                setResizable (true, false);
                resized();
            }

           #if JUCE_IOS && COSIMO_ENABLE_EDITOR_INSPECTION
            scheduleIOSDebugInspectionDump();
           #endif
        }

        void childBoundsChanged (juce::Component*) override
        {
            if (! isResizing && patchWebViewHolder->isVisible() && ! patchWebView->resizable)
                setSize (std::max (50, patchWebViewHolder->getWidth()),
                         std::max (50, patchWebViewHolder->getHeight()));
        }

        void reloadPatchWebViewAsync()
        {
            hasLoadedPatchWebView = true;

            auto safeThis = juce::Component::SafePointer<Editor> (this);
            juce::MessageManager::callAsync ([safeThis]
            {
                if (safeThis != nullptr && safeThis->patchWebView != nullptr)
                    safeThis->patchWebView->reload();
            });
        }

        void resized() override
        {
            isResizing = true;
            juce::AudioProcessorEditor::resized();

            const auto bounds = getLocalBounds();

            if (patchWebViewHolder->isVisible())
            {
                patchWebViewHolder->setBounds (bounds);

                if (getWidth() > 0 && getHeight() > 0)
                {
                    owner.lastEditorWidth = patchWebViewHolder->getWidth();
                    owner.lastEditorHeight = patchWebViewHolder->getHeight();
                }
            }

            if (extraComponent != nullptr && extraComponent->isVisible())
                extraComponent->setBounds (bounds);

            isResizing = false;

           #if JUCE_IOS && COSIMO_ENABLE_EDITOR_INSPECTION
            scheduleIOSDebugInspectionDump();
           #endif
        }

        void paint (juce::Graphics& graphics) override
        {
            graphics.fillAll (getLookAndFeel().findColour (juce::ResizableWindow::backgroundColourId));
        }

        GeneratedPlugin& owner;
        std::unique_ptr<detail::PatchWebViewHost> patchWebView;
        std::unique_ptr<juce::Component> patchWebViewHolder;
        std::unique_ptr<juce::Component> extraComponent;
        juce::LookAndFeel_V4 lookAndFeel;
        bool isResizing = false;
        bool hasLoadedPatchWebView = false;
        static constexpr int defaultWidth = 500;
        static constexpr int defaultHeight = 400;
    };

    struct IDs
    {
        const juce::Identifier cmajor { "Cmajor" };
        const juce::Identifier parameters { "PARAMS" };
        const juce::Identifier parameter { "PARAM" };
        const juce::Identifier id { "ID" };
        const juce::Identifier value { "V" };
        const juce::Identifier state { "STATE" };
        const juce::Identifier storedValue { "VALUE" };
        const juce::Identifier location { "location" };
        const juce::Identifier key { "key" };
        const juce::Identifier binaryValue { "value" };
        const juce::Identifier viewWidth { "viewWidth" };
        const juce::Identifier viewHeight { "viewHeight" };
        const juce::Identifier completeSoundVersion { "completeSoundVersion" };
    } ids;

    static constexpr int completeSoundStateVersion = 2;

    struct NewStateMessage final : public juce::Message
    {
        juce::ValueTree newState;
    };

    juce::ValueTree createEmptyState() const
    {
        juce::ValueTree state (ids.cmajor);
        state.setProperty (ids.completeSoundVersion, completeSoundStateVersion, nullptr);
        return state;
    }

    bool isCurrentCompleteSoundState (const juce::ValueTree& state) const
    {
        return state.isValid()
            && state.hasType (ids.cmajor)
            && static_cast<int> (state.getProperty (ids.completeSoundVersion, -1))
                == completeSoundStateVersion;
    }

    juce::ValueTree getUpdatedState()
    {
        auto state = createEmptyState();

        if (isViewResizable() && lastEditorWidth != 0 && lastEditorHeight != 0)
        {
            state.setProperty (ids.viewWidth, lastEditorWidth, nullptr);
            state.setProperty (ids.viewHeight, lastEditorHeight, nullptr);
        }

        if (const auto& storedState = patch->getStoredStateValues(); ! storedState.empty())
        {
            juce::ValueTree storedValues (ids.state);

            for (const auto& entry : storedState)
            {
                juce::ValueTree valueTree (ids.storedValue);
                valueTree.setProperty (ids.key, juce::String (entry.first.data(), entry.first.length()), nullptr);
                const auto serialised = entry.second.serialise();
                valueTree.setProperty (ids.binaryValue, juce::var (serialised.data.data(), serialised.data.size()), nullptr);
                storedValues.appendChild (valueTree, nullptr);
            }

            state.appendChild (storedValues, nullptr);
        }

        juce::ValueTree parameterList (ids.parameters);

        for (const auto& parameter : patch->getParameterList())
        {
            parameterList.appendChild (juce::ValueTree (ids.parameter,
                                                        { { ids.id, juce::String (parameter->properties.endpointID) },
                                                          { ids.value, parameter->currentValue } }),
                                       nullptr);
        }

        state.appendChild (parameterList, nullptr);
        return state;
    }

    void setNewStateAsync (juce::ValueTree&& newState)
    {
        auto message = std::make_unique<NewStateMessage>();
        message->newState = std::move (newState);
        postMessage (message.release());
    }

    void setNewState (const juce::ValueTree& newState)
    {
        if (! isCurrentCompleteSoundState (newState))
            return;

        cmaj::Patch::LoadParams loadParams;
        loadParams.manifest.needsToBuildSource = false;
        loadParams.manifest.initialiseWithVirtualFile ("WavetableSynth.iOS.cmajorpatch",
                                                       detail::createRuntimeResourceReader,
                                                       [] (const std::filesystem::path& path) { return detail::getRuntimeResourceFullPath (path).string(); },
                                                       detail::getRuntimeResourceModificationTime,
                                                       detail::runtimeResourceExists);

        readParametersFromState (loadParams, newState);

        if (isViewResizable())
        {
            if (auto* width = newState.getPropertyPointer (ids.viewWidth); width != nullptr && width->isInt())
                lastEditorWidth = *width;

            if (auto* height = newState.getPropertyPointer (ids.viewHeight); height != nullptr && height->isInt())
                lastEditorHeight = *height;
        }
        else
        {
            lastEditorWidth = 0;
            lastEditorHeight = 0;
        }

        if (auto storedState = newState.getChildWithName (ids.state); storedState.isValid())
        {
            for (const auto& valueTree : storedState)
            {
                if (! valueTree.hasType (ids.storedValue))
                    continue;

                if (auto* key = valueTree.getPropertyPointer (ids.key))
                {
                    if (auto* value = valueTree.getPropertyPointer (ids.binaryValue))
                    {
                        if (key->isString() && key->toString().isNotEmpty() && ! value->isVoid())
                        {
                            const auto keyString = key->toString().toStdString();
                            const auto convertedValue = convertVarToValue (*value);
                            patch->setStoredStateValue (keyString, convertedValue);
                        }
                    }
                }
            }
        }

        setPendingArticulationTriggerConfig ({});

        if (getSampleRate() > 0.0)
            applyCurrentRateAndBlockSize();

        patch->loadPatch (loadParams, true);
    }

    void unload (const std::string& message = {}, bool isError = false)
    {
        patch->unload();
        setStatusMessage (message, isError);
    }

    void readParametersFromState (cmaj::Patch::LoadParams& loadParams, const juce::ValueTree& state) const
    {
        if (auto parametersTree = state.getChildWithName (ids.parameters); parametersTree.isValid())
        {
            for (const auto parameterTree : parametersTree)
            {
                if (auto* endpointIDProperty = parameterTree.getPropertyPointer (ids.id))
                {
                    const auto endpointID = endpointIDProperty->toString().toStdString();

                    if (! endpointID.empty())
                    {
                        if (auto* valueProperty = parameterTree.getPropertyPointer (ids.value))
                            loadParams.parameterValues[endpointID] = static_cast<float> (*valueProperty);
                    }
                }
            }
        }
    }

    static choc::value::Value convertVarToValue (const juce::var& value)
    {
        if (value.isVoid() || value.isUndefined())  return {};
        if (value.isString())                       return choc::value::createString (value.toString().toStdString());
        if (value.isBool())                         return choc::value::createBool (static_cast<bool> (value));
        if (value.isInt() || value.isInt64())       return choc::value::createInt64 (static_cast<juce::int64> (value));
        if (value.isDouble())                       return choc::value::createFloat64 (static_cast<double> (value));

        if (value.isArray())
        {
            auto array = choc::value::createEmptyArray();

            for (const auto& element : *value.getArray())
                array.addArrayElement (convertVarToValue (element));

            return array;
        }

        if (value.isObject())
            return choc::json::parse (juce::JSON::toString (value, juce::JSON::FormatOptions().withSpacing (juce::JSON::Spacing::none)).toStdString());

        if (value.isBinaryData())
        {
            const auto* block = value.getBinaryData();
            auto inputData = choc::value::InputData { reinterpret_cast<const unsigned char*> (block->begin()),
                                                      reinterpret_cast<const unsigned char*> (block->end()) };
            return choc::value::Value::deserialise (inputData);
        }

        jassertfalse;
        return {};
    }

    void handlePatchChange()
    {
        auto details = juce::AudioProcessorListener::ChangeDetails::getDefaultFlags();
        const auto newLatency = static_cast<int> (patch->getFramesLatency());

        details.latencyChanged = newLatency != getLatencySamples();
        details.parameterInfoChanged = updateParameters();
        details.programChanged = false;
        details.nonParameterStateChanged = true;

        setLatencySamples (newLatency);
        notifyEditorPatchChanged();
        updateHostDisplay (details);
    }

    void setStatusMessage (const std::string& newMessage, bool isError)
    {
        if (statusMessage != newMessage || isStatusMessageError != isError)
        {
            statusMessage = newMessage;
            isStatusMessageError = isError;
            notifyEditorStatusMessageChanged();
        }
    }

    void notifyEditorStatusMessageChanged()
    {
        if (auto* editor = dynamic_cast<Editor*> (getActiveEditor()))
            editor->statusMessageChanged();
    }

    void notifyEditorPatchChanged()
    {
        if (auto* editor = dynamic_cast<Editor*> (getActiveEditor()))
            editor->onPatchChanged();
    }

    void handleMessage (const juce::Message& message) override
    {
        if (auto* stateMessage = dynamic_cast<const NewStateMessage*> (&message))
            setNewState (const_cast<NewStateMessage*> (stateMessage)->newState);
    }

    void handleOutputEvent (uint64_t, std::string_view endpointID, const choc::value::ValueView& value)
    {
       #if COSIMO_ENABLE_MODULATION_BENCHMARK_METRICS
        if (endpointID == "runtimeInstallAck")
        {
            const auto dspSessionId = value["dspSessionId"].getWithDefault<int32_t> (0);
            const auto acceptedSerial = value["acceptedModulationSerial"].getWithDefault<int32_t> (0);
            const auto acceptedProgramSerial = value["acceptedModulationProgramSerial"].getWithDefault<int32_t> (0);
            const auto installedVoice = value["installedVoiceRouteCount"].getWithDefault<int32_t> (-1);
            const auto installedMacroVoice = value["installedMacroVoiceRouteCount"].getWithDefault<int32_t> (-1);
            const auto installedVoiceRack = value["installedVoiceRackRouteCount"].getWithDefault<int32_t> (-1);
            const auto installedMacroRack = value["installedMacroRackRouteCount"].getWithDefault<int32_t> (-1);
            const auto rejectedSerial = value["rejectedSerial"].getWithDefault<int32_t> (0);
            benchmarkLastAcceptedSerial.store (std::max (benchmarkLastAcceptedSerial.load(), acceptedSerial));
            if (acceptedProgramSerial > 0)
            {
                if (benchmarkAcceptedProgramDspSessionId.load() == dspSessionId)
                    benchmarkLastAcceptedProgramSerial.store (std::max (benchmarkLastAcceptedProgramSerial.load(), acceptedProgramSerial));
                else
                    benchmarkLastAcceptedProgramSerial.store (acceptedProgramSerial);

                benchmarkAcceptedProgramDspSessionId.store (dspSessionId);
            }
            benchmarkLastRejectedSerial.store (std::max (benchmarkLastRejectedSerial.load(), rejectedSerial));
            if (acceptedProgramSerial > 0)
            {
                benchmarkCurrentVoiceRouteCount.store (installedVoice);
                benchmarkCurrentMacroVoiceRouteCount.store (installedMacroVoice);
                benchmarkCurrentVoiceRackRouteCount.store (installedVoiceRack);
                benchmarkCurrentMacroRackRouteCount.store (installedMacroRack);
            }
            if (isBenchmarkRuntimeReady())
                publishBenchmarkParameter (BenchmarkParameterKind::runtimeReady);

            const auto baseline = benchmarkInstallBaselineSerial.load();
            const auto programBaseline = benchmarkInstallBaselineProgramSerial.load();
            detail::logRuntimeIssue ("Benchmark runtime install acknowledgement",
                                     "accepted=" + std::to_string (acceptedSerial)
                                         + ", acceptedProgram=" + std::to_string (acceptedProgramSerial)
                                         + ", rejected=" + std::to_string (rejectedSerial)
                                         + ", baseline=" + std::to_string (baseline)
                                         + ", installed=" + std::to_string (installedVoice)
                                         + "/" + std::to_string (installedMacroVoice)
                                         + "/" + std::to_string (installedVoiceRack)
                                         + "/" + std::to_string (installedMacroRack)
                                         + ", expected=" + std::to_string (benchmarkExpectedVoiceRouteCount.load())
                                         + "/" + std::to_string (benchmarkExpectedMacroVoiceRouteCount.load())
                                         + "/" + std::to_string (benchmarkExpectedVoiceRackRouteCount.load())
                                         + "/" + std::to_string (benchmarkExpectedMacroRackRouteCount.load()));
            if (benchmarkInstallStatus.load() == 1 && rejectedSerial > baseline)
            {
                benchmarkInstallStatus.store (3);
                benchmarkInstallGeneration.fetch_add (1);
                publishBenchmarkParameter (BenchmarkParameterKind::installStatus);
                publishBenchmarkParameter (BenchmarkParameterKind::installGeneration);
            }
            else if (benchmarkInstallStatus.load() == 1 && acceptedProgramSerial > programBaseline)
            {
                completeBenchmarkProfileInstall (acceptedProgramSerial,
                                                 installedVoice,
                                                 installedMacroVoice,
                                                 installedVoiceRack,
                                                 installedMacroRack);
            }
        }
        else if (endpointID == "runtimeState")
        {
            const auto dspSessionId = value["dspSessionId"].getWithDefault<int32_t> (0);
            const auto hasActive = value["hasActive"].getWithDefault<int32_t> (0);
            const auto activeWavetableDspSessionId = hasActive != 0 ? dspSessionId : 0;
            const auto previousDspSessionId = benchmarkLastObservedDspSessionId.exchange (dspSessionId);
            const auto previousActiveDspSessionId = benchmarkActiveWavetableDspSessionId.exchange (activeWavetableDspSessionId);
            if (dspSessionId != previousDspSessionId || activeWavetableDspSessionId != previousActiveDspSessionId)
                detail::logRuntimeIssue ("Benchmark runtime state",
                                         "dspSessionId=" + std::to_string (dspSessionId)
                                             + ", wavetableActive=" + std::to_string (hasActive));
            publishBenchmarkParameter (BenchmarkParameterKind::runtimeReady);
        }
        else if (endpointID == "effectiveRackState")
        {
            const auto rackEnableMask = value["laneCommittedPositionMask"].getWithDefault<int32_t> (-1);
            if (rackEnableMask >= 0 && rackEnableMask <= 255)
            {
                benchmarkRackEnableMask.store (static_cast<uint32_t> (rackEnableMask));
                publishBenchmarkParameter (BenchmarkParameterKind::runtimeReady);
            }
        }
        else if (endpointID == "voiceArticulationStart")
        {
            const auto voiceIndex = value["voiceIndex"].getWithDefault<int32_t> (-1);
            if (voiceIndex >= 0 && voiceIndex < 16)
                benchmarkVoiceMask.fetch_or (static_cast<uint32_t> (1u << voiceIndex));
        }
       #endif

        if (endpointID == cmaj::getConsoleEndpointID())
            std::cout << cmaj::convertConsoleMessageToString (value) << std::flush;
    }

    void updateTimelineFromPlayhead (juce::AudioPlayHead& playHead)
    {
        if (! patch->wantsTimecodeEvents())
            return;

        if (auto position = playHead.getPosition())
        {
            uint32_t timeout = 0;

            if (auto timeSignature = position->getTimeSignature())
                patch->sendTimeSig (timeSignature->numerator, timeSignature->denominator, timeout);

            if (auto bpm = position->getBpm())
                patch->sendBPM (static_cast<float> (*bpm), timeout);

            patch->sendTransportState (position->getIsRecording(),
                                       position->getIsPlaying(),
                                       position->getIsLooping(),
                                       timeout);

            if (auto timeInSamples = position->getTimeInSamples())
            {
                double ppq = 0.0;
                double ppqBar = 0.0;

                if (auto value = position->getPpqPosition())
                    ppq = *value;

                if (auto value = position->getPpqPositionOfLastBarStart())
                    ppqBar = *value;

                patch->sendPosition (static_cast<int64_t> (*timeInSamples), ppq, ppqBar, timeout);
            }
        }
    }

    bool isViewResizable() const
    {
        if (auto manifest = patch->getManifest())
            for (const auto& view : manifest->views)
                if (! view.isResizable())
                    return false;

        return true;
    }

    void createParameterTree()
    {
        struct ParameterTreeBuilder
        {
            ParameterTreeBuilder (GeneratedPlugin& ownerToUse) : owner (ownerToUse) {}

            Parameter* add (const cmaj::PatchParameterPtr& patchParameter)
            {
                auto parameter = std::make_unique<Parameter> (owner, patchParameter->properties.endpointID);
                auto* rawParameter = parameter.get();

                if (! patchParameter->properties.group.empty())
                    getOrCreateGroup (tree, {}, patchParameter->properties.group).addChild (std::move (parameter));
                else
                    tree.addChild (std::move (parameter));

                return rawParameter;
            }

           #if COSIMO_ENABLE_MODULATION_BENCHMARK_METRICS
            BenchmarkParameter* add (std::unique_ptr<BenchmarkParameter> parameter)
            {
                auto* rawParameter = parameter.get();
                tree.addChild (std::move (parameter));
                return rawParameter;
            }
           #endif

            juce::AudioProcessorParameterGroup& getOrCreateGroup (juce::AudioProcessorParameterGroup& targetTree,
                                                                  const std::string& parentPath,
                                                                  const std::string& subPath)
            {
                const auto fullPath = parentPath + "/" + subPath;
                auto& targetGroup = groups[fullPath];

                if (targetGroup != nullptr)
                    return *targetGroup;

                if (auto slash = subPath.find ('/'); slash != std::string::npos)
                {
                    const auto firstPathPart = subPath.substr (0, slash);
                    auto& parentGroup = getOrCreateGroup (targetTree, parentPath, firstPathPart);
                    return getOrCreateGroup (parentGroup, parentPath + "/" + firstPathPart, subPath.substr (slash + 1));
                }

                auto group = std::make_unique<juce::AudioProcessorParameterGroup> (fullPath, subPath, "/");
                targetGroup = group.get();
                targetTree.addChild (std::move (group));
                return *targetGroup;
            }

            GeneratedPlugin& owner;
            std::map<std::string, juce::AudioProcessorParameterGroup*> groups;
            juce::AudioProcessorParameterGroup tree;
        };

        ParameterTreeBuilder builder (*this);

        for (const auto& patchParameter : patch->getParameterList())
        {
            auto* parameter = builder.add (patchParameter);
            parameters.push_back (parameter);
            parameter->setPatchParam (patchParameter);
        }

       #if COSIMO_ENABLE_MODULATION_BENCHMARK_METRICS
        const auto addBenchmark = [&] (BenchmarkParameterKind kind, const char* id, const char* name)
        {
            auto parameter = std::make_unique<BenchmarkParameter> (*this, kind, id, name);
            benchmarkParameters.push_back (builder.add (std::move (parameter)));
        };
        addBenchmark (BenchmarkParameterKind::profileSelection,          "cosimoBenchmarkProfile",                   "Cosimo Benchmark Profile");
        addBenchmark (BenchmarkParameterKind::runtimeReady,                  "cosimoBenchmarkRuntimeReady",              "Cosimo Benchmark Runtime Ready");
        addBenchmark (BenchmarkParameterKind::runtimeReadyRequest,           "cosimoBenchmarkRuntimeReadyRequest",       "Cosimo Benchmark Runtime Ready Request");
        addBenchmark (BenchmarkParameterKind::install,                   "cosimoBenchmarkInstall",                   "Cosimo Benchmark Install");
        addBenchmark (BenchmarkParameterKind::installStatus,             "cosimoBenchmarkInstallStatus",             "Cosimo Benchmark Install Status");
        addBenchmark (BenchmarkParameterKind::installGeneration,         "cosimoBenchmarkInstallGeneration",         "Cosimo Benchmark Install Generation");
        addBenchmark (BenchmarkParameterKind::capture,                   "cosimoBenchmarkCapture",                   "Cosimo Benchmark Capture");
        addBenchmark (BenchmarkParameterKind::captureGeneration,         "cosimoBenchmarkCaptureGeneration",         "Cosimo Benchmark Capture Generation");
        addBenchmark (BenchmarkParameterKind::captureStopGeneration,     "cosimoBenchmarkCaptureStopGeneration",     "Cosimo Benchmark Capture Stop Generation");
        addBenchmark (BenchmarkParameterKind::resultGeneration,          "cosimoBenchmarkResultGeneration",          "Cosimo Benchmark Result Generation");
        addBenchmark (BenchmarkParameterKind::resultFieldRequest,        "cosimoBenchmarkResultFieldRequest",        "Cosimo Benchmark Result Field Request");
        addBenchmark (BenchmarkParameterKind::resultFieldResponse,       "cosimoBenchmarkResultFieldResponse",       "Cosimo Benchmark Result Field Response");
       #endif

        for (auto* parameter : parameters)
            parameter->forceValueChanged();

        setHostedParameterTree (std::move (builder.tree));
    }

    bool updateParameters()
    {
        bool changed = false;
        const auto patchParameters = patch->getParameterList();

        if (parameters.empty())
            createParameterTree();

        for (size_t index = 0; index < patchParameters.size(); ++index)
            changed = parameters[index]->setPatchParam (patchParameters[index]) || changed;

        return changed;
    }

    std::unique_ptr<juce::Component> createExtraComponent()
    {
        if (wrapperType == juce::AudioProcessor::wrapperType_Standalone)
        {
            return createSharedWavetableLibraryComponent (SharedWavetableLibraryComponentMode::standaloneInstaller,
                                                          {
                                                              [this]
                                                              {
                                                                  setNewStateAsync (getUpdatedState());
                                                              }
                                                          });
        }

        if (wrapperType == juce::AudioProcessor::wrapperType_AudioUnitv3)
            return createSharedWavetableLibraryComponent (SharedWavetableLibraryComponentMode::extensionUnavailable, {});

        return {};
    }

    void refreshExtraComponent (juce::Component* component)
    {
        refreshSharedWavetableLibraryComponent (component);
    }

    cmaj::Patch::PlaybackParams getPlaybackParams (double sampleRate, uint32_t requestedBlockSize)
    {
        const auto layout = getBusesLayout();

        return cmaj::Patch::PlaybackParams (sampleRate, requestedBlockSize,
                                            static_cast<choc::buffer::ChannelCount> (layout.getMainInputChannels()),
                                            static_cast<choc::buffer::ChannelCount> (layout.getMainOutputChannels()));
    }

    void applyRateAndBlockSize (double sampleRate, uint32_t samplesPerBlock)
    {
        patch->setPlaybackParams (getPlaybackParams (sampleRate, samplesPerBlock));
    }

    void applyCurrentRateAndBlockSize()
    {
        applyRateAndBlockSize (getSampleRate(), static_cast<uint32_t> (getBlockSize()));
    }

    std::shared_ptr<cmaj::Patch> patch;
    cosimo::future_daw::NoteMetaBridge noteMetaBridge;
    std::shared_ptr<const cosimo::future_daw::ArticulationTriggerConfig> pendingArticulationTriggerConfig {
        std::make_shared<const cosimo::future_daw::ArticulationTriggerConfig>()
    };
    std::shared_ptr<const cosimo::future_daw::ArticulationTriggerConfig> activeArticulationTriggerConfig;
    std::vector<Parameter*> parameters;
    std::string statusMessage;
    bool isStatusMessageError = false;
    uint64_t lastLoadedStateHash = 0;
    int lastEditorWidth = 0;
    int lastEditorHeight = 0;
   #if COSIMO_ENABLE_MODULATION_BENCHMARK_METRICS
    std::vector<BenchmarkParameter*> benchmarkParameters;
    std::atomic<uint32_t> benchmarkProfileSelection { 0 };
    std::atomic<bool> benchmarkInstallRequested { false };
    std::atomic<int32_t> benchmarkInstallStatus { 0 };
    std::atomic<uint32_t> benchmarkInstallGeneration { 0 };
    std::atomic<int32_t> benchmarkLastAcceptedSerial { 0 };
    std::atomic<int32_t> benchmarkLastAcceptedProgramSerial { 0 };
    std::atomic<int32_t> benchmarkAcceptedProgramDspSessionId { 0 };
    std::atomic<int32_t> benchmarkActiveWavetableDspSessionId { 0 };
    std::atomic<int32_t> benchmarkLastRejectedSerial { 0 };
    std::atomic<int32_t> benchmarkLastObservedDspSessionId { 0 };
    std::atomic<int32_t> benchmarkInstallBaselineSerial { 0 };
    std::atomic<int32_t> benchmarkInstallBaselineProgramSerial { 0 };
    std::atomic<int32_t> benchmarkExpectedVoiceRouteCount { 0 };
    std::atomic<int32_t> benchmarkExpectedMacroVoiceRouteCount { 0 };
    std::atomic<int32_t> benchmarkExpectedVoiceRackRouteCount { 0 };
    std::atomic<int32_t> benchmarkExpectedMacroRackRouteCount { 0 };
    std::atomic<int32_t> benchmarkCurrentVoiceRouteCount { -1 };
    std::atomic<int32_t> benchmarkCurrentMacroVoiceRouteCount { -1 };
    std::atomic<int32_t> benchmarkCurrentVoiceRackRouteCount { -1 };
    std::atomic<int32_t> benchmarkCurrentMacroRackRouteCount { -1 };
    std::atomic<int32_t> benchmarkInstalledProgramSerial { 0 };
    std::atomic<int32_t> benchmarkInstalledVoiceRouteCount { 0 };
    std::atomic<int32_t> benchmarkInstalledMacroVoiceRouteCount { 0 };
    std::atomic<int32_t> benchmarkInstalledVoiceRackRouteCount { 0 };
    std::atomic<int32_t> benchmarkInstalledMacroRackRouteCount { 0 };
    std::atomic<uint32_t> benchmarkCaptureGeneration { 0 };
    std::atomic<uint32_t> benchmarkCaptureStopGeneration { 0 };
    std::atomic<bool> modulationBenchmarkCaptureActive { false };
    std::atomic<uint32_t> benchmarkWriters { 0 };
    std::atomic<uint64_t> benchmarkRenderTicks { 0 };
    std::atomic<uint64_t> benchmarkAudioFrames { 0 };
    std::atomic<uint64_t> benchmarkRenderBlockCount { 0 };
    std::atomic<uint64_t> benchmarkDeadlineMissCount { 0 };
    std::atomic<uint64_t> benchmarkRenderSampleCount { 0 };
    std::atomic<uint32_t> benchmarkMinimumFrames { UINT32_MAX };
    std::atomic<uint32_t> benchmarkMaximumFrames { 0 };
    std::atomic<uint32_t> benchmarkVoiceMask { 0 };
    std::atomic<uint32_t> benchmarkRackEnableMask { 255 };
    std::array<double, modulationBenchmarkMaximumRenderSamples> benchmarkRenderRatios {};
    std::atomic<uint64_t> benchmarkResultRenderBlockCount { 0 };
    std::atomic<uint64_t> benchmarkResultSampleCount { 0 };
    std::atomic<uint64_t> benchmarkResultAudioFrames { 0 };
    std::atomic<double> benchmarkResultDspSampleRate { 0.0 };
    std::atomic<uint32_t> benchmarkResultMinimumFrames { 0 };
    std::atomic<uint32_t> benchmarkResultMaximumFrames { 0 };
    std::atomic<uint32_t> benchmarkResultGeneration { 0 };
    std::atomic<float> benchmarkResultFieldResponse { 0.0f };
    std::atomic<double> benchmarkResultRenderLoadPercent { 0.0 };
    std::atomic<double> benchmarkResultP99RenderLoadPercent { 0.0 };
    std::atomic<double> benchmarkResultP999RenderLoadPercent { 0.0 };
    std::atomic<double> benchmarkResultMaximumRenderLoadPercent { 0.0 };
    std::atomic<uint64_t> benchmarkResultDeadlineMissCount { 0 };
    std::atomic<uint32_t> benchmarkResultRackEnableMask { 255 };
   #endif
};

} // namespace cosimo::ios
