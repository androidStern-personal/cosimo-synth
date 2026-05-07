#pragma once

#include <JuceHeader.h>

#include <cctype>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <utility>
#include <vector>

#include "../../native/ModulationRuntimeRestore.h"
#include "CosimoSharedWavetableLibrary.h"
#include "cmajor/helpers/cmaj_GeneratedCppEngine.h"
#include "cmajor/helpers/cmaj_Patch.h"
#include "cmajor/helpers/cmaj_PatchManifest.h"
#include "choc/gui/choc_WebView.h"
#include "choc/memory/choc_xxHash.h"
#include "choc/network/choc_MIMETypes.h"

#include "../../native/CosimoCmajorMidiBridge.h"

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
    juce::Logger::writeToLog ("[Cosimo iOS] " + juce::String (context.data(), static_cast<int> (context.size()))
                              + ": " + juce::String (detail.data(), static_cast<int> (detail.size())));
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
    PatchWebViewHost (cmaj::Patch& patchToUse, const cmaj::PatchManifest::View& preferredView, bool shouldLoadBootPageHTML)
        : cmaj::PatchView (patchToUse, preferredView),
          currentView (preferredView),
          loadBootPageHTML (shouldLoadBootPageHTML)
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

        if (auto* playHead = getPlayHead())
            updateTimelineFromPlayhead (*playHead);

        cosimo::cmajor_bridge::processBlockWithFutureDawNoteMeta (
            *patch,
            audio,
            midi,
            noteMetaBridge,
            [&midi] (uint32_t frame, choc::midi::ShortMessage message)
            {
                midi.addEvent (message.data(), static_cast<int> (message.length()), static_cast<int> (frame));
            });
    }

    void processBlock (juce::AudioBuffer<double>&, juce::MidiBuffer&) override
    {
        jassertfalse;
    }

    void getStateInformation (juce::MemoryBlock& destinationData) override
    {
        juce::MemoryOutputStream output (destinationData, false);
        getUpdatedState().writeToStream (output);
    }

    void setStateInformation (const void* data, int sizeInBytes) override
    {
        choc::hash::xxHash64 hash (1);
        hash.addInput (data, static_cast<size_t> (sizeInBytes));
        const auto stateHash = hash.getHash();

        if (lastLoadedStateHash != stateHash)
        {
            lastLoadedStateHash = stateHash;
            setNewStateAsync (juce::ValueTree::readFromData (data, static_cast<size_t> (sizeInBytes)));
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
                                                                        owner.wrapperType == juce::AudioProcessor::wrapperType_Standalone))
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
    } ids;

    struct NewStateMessage final : public juce::Message
    {
        juce::ValueTree newState;
    };

    juce::ValueTree createEmptyState() const
    {
        return juce::ValueTree (ids.cmajor);
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
        if (newState.isValid() && ! newState.hasType (ids.cmajor))
            return unload ("Failed to load: invalid state", true);

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
                            patch->setStoredStateValue (key->toString().toStdString(), convertVarToValue (*value));
                    }
                }
            }
        }

        if (getSampleRate() > 0.0)
            applyCurrentRateAndBlockSize();

        patch->loadPatch (loadParams, true);
        cosimo::modulation::uploadStoredModulationStateToPatch (*patch);
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
    cosimo::future_daw::NoteMetaBridge noteMetaBridge { cosimo::future_daw::KeyswitchMap::defaultLowNoteRange() };
    std::vector<Parameter*> parameters;
    std::string statusMessage;
    bool isStatusMessageError = false;
    uint64_t lastLoadedStateHash = 0;
    int lastEditorWidth = 0;
    int lastEditorHeight = 0;
};

} // namespace cosimo::ios
