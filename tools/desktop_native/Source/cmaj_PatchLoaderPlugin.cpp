#include <JuceHeader.h>
#include <assert.h>
#include <mutex>

#include "../../../native/ModulationRuntimeRestore.h"

#define CHOC_ASSERT(x) assert(x)
#include "cmajor/COM/cmaj_Library.h"
#include "cmajor/helpers/cmaj_JUCEPluginFormat.h"
#include "choc/javascript/choc_javascript_QuickJS.h"

#include "../../../native/CosimoCmajorMidiBridge.h"

#ifndef COSIMO_PATCH_PATH
 #error COSIMO_PATCH_PATH must be defined
#endif

#ifndef COSIMO_DESKTOP_UI_SOURCE_MODE
 #define COSIMO_DESKTOP_UI_SOURCE_MODE "compiled"
#endif

#ifndef COSIMO_DESKTOP_DEV_SERVER_ORIGIN
 #define COSIMO_DESKTOP_DEV_SERVER_ORIGIN "http://127.0.0.1:5174"
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

static std::string getDesktopUISourceMode()
{
    return COSIMO_DESKTOP_UI_SOURCE_MODE;
}

static std::string getDesktopDevServerOrigin()
{
    return COSIMO_DESKTOP_DEV_SERVER_ORIGIN;
}

static std::string createDesktopUILoaderSetupCode (std::string_view windowKind = "patch")
{
    auto setupCode = "window.__COSIMO_DESKTOP_UI_SOURCE_MODE__ = "
                   + choc::json::getEscapedQuotedString (getDesktopUISourceMode())
                   + ";";

    setupCode += "\nwindow.__COSIMO_DESKTOP_WINDOW_KIND__ = "
              + choc::json::getEscapedQuotedString (windowKind)
              + ";";

    if (getDesktopUISourceMode() == "dev-server")
    {
        setupCode += "\nwindow.__COSIMO_DESKTOP_DEV_SERVER_ORIGIN__ = "
                  + choc::json::getEscapedQuotedString (getDesktopDevServerOrigin())
                  + ";";

        // The embedded Cmajor shell injects an unlayered blanket reset:
        //   * { box-sizing: border-box; padding: 0; margin: 0; border: 0; }
        // In light-DOM dev mode that outranks our layered Tailwind utilities and
        // wipes layout spacing inside the synth UI. Strip only the destructive
        // properties before the desktop view is created, while preserving the
        // useful box-sizing reset.
        setupCode += R"(
for (const styleSheet of Array.from(document.styleSheets))
{
    let rules;

    try
    {
        rules = styleSheet.cssRules;
    }
    catch
    {
        continue;
    }

    for (const rule of Array.from(rules))
    {
        if (!(rule instanceof CSSStyleRule) || rule.selectorText !== "*")
            continue;

        rule.style.removeProperty("padding");
        rule.style.removeProperty("margin");
        rule.style.removeProperty("border");
    }
}
)";
    }

    return setupCode;
}

class FixedPatchInstrumentDevPlugin
    : public cmaj::plugin::JUCEPluginBase<FixedPatchInstrumentDevPlugin>
{
public:
    struct Editor;

    FixedPatchInstrumentDevPlugin (std::shared_ptr<cmaj::Patch> patchToUse,
                                   std::filesystem::path manifestLocationToUse)
        : cmaj::plugin::JUCEPluginBase<FixedPatchInstrumentDevPlugin> (
              patchToUse,
              preloadBusLayout (*patchToUse, manifestLocationToUse)),
          manifestLocation (std::move (manifestLocationToUse))
    {
        patchChangeCallback = [this] (auto&)
        {
            if (auto* editor = dynamic_cast<Editor*> (getActiveEditor()))
                editor->onPatchChanged();
        };

        patch->statusChanged = [this] (const auto& status)
        {
            setStatusMessage (status.statusMessage, status.messageList.hasErrors());

            if (auto* editor = dynamic_cast<Editor*> (getActiveEditor()))
                editor->statusMessageChanged();
        };

        // Match Cmajor's fixed-patch startup order: give the patch valid playback
        // params before the first synchronous load so it can build a playable renderer.
        applyRateAndBlockSize (44100, 128);
        setFixedStateSynchronously (createEmptyState (manifestLocation));
    }

    struct Editor final : public juce::AudioProcessorEditor
    {
        struct CurveLabWindow final : public juce::DocumentWindow
        {
            explicit CurveLabWindow (Editor& ownerToUse)
                : juce::DocumentWindow ("Curve Lab",
                                        juce::Colour::fromString ("ff050812"),
                                        juce::DocumentWindow::allButtons),
                  owner (ownerToUse),
                  patchWebView (std::make_unique<cmaj::PatchWebView> (
                      *owner.owner.patch,
                      cmaj::PatchManifest::View {
                          choc::json::create ("width", windowWidth,
                                              "height", windowHeight)
                      }))
            {
                patchWebView->extraSetupCode = createDesktopUILoaderSetupCode ("curve-lab");
                owner.bindCurveLabBridge (*patchWebView);

                patchWebViewHolder = choc::ui::createJUCEWebViewHolder (patchWebView->getWebView());
                patchWebView->setActive (true);
                patchWebView->update (cmaj::PatchManifest::View {
                    choc::json::create ("width", windowWidth,
                                        "height", windowHeight)
                });
                patchWebViewHolder->setSize ((int) patchWebView->width, (int) patchWebView->height);

                setUsingNativeTitleBar (true);
                setResizable (true, true);
                setResizeLimits (360, 520, 2200, 2400);
                setContentNonOwned (patchWebViewHolder.get(), true);
                centreAroundComponent (&owner, windowWidth, windowHeight);
                setVisible (true);
                toFront (true);
                patchWebView->reload();
            }

            ~CurveLabWindow() override
            {
                clearContentComponent();
                patchWebViewHolder.reset();
                patchWebView.reset();
            }

            void closeButtonPressed() override
            {
                auto safeOwner = juce::Component::SafePointer<Editor> (&owner);

                juce::MessageManager::callAsync ([safeOwner]
                {
                    if (safeOwner != nullptr)
                        safeOwner->closeCurveLabWindow();
                });
            }

            void resized() override
            {
                juce::DocumentWindow::resized();

                if (patchWebView == nullptr || patchWebViewHolder == nullptr)
                    return;

                auto bounds = getLocalBounds();
                patchWebViewHolder->setBounds (bounds);

                patchWebView->update (cmaj::PatchManifest::View {
                    choc::json::create ("width", std::max (1, bounds.getWidth()),
                                        "height", std::max (1, bounds.getHeight()))
                });
                patchWebViewHolder->setSize ((int) patchWebView->width, (int) patchWebView->height);
            }

            Editor& owner;
            std::unique_ptr<cmaj::PatchWebView> patchWebView;
            std::unique_ptr<juce::Component> patchWebViewHolder;

            static constexpr int windowWidth = 460;
            static constexpr int windowHeight = 880;
        };

        explicit Editor (FixedPatchInstrumentDevPlugin& ownerToUse)
            : juce::AudioProcessorEditor (ownerToUse),
              owner (ownerToUse),
              patchWebView (std::make_unique<cmaj::PatchWebView> (*owner.patch, derivePatchViewSize (owner)))
        {
            patchWebView->extraSetupCode = createDesktopUILoaderSetupCode ("patch");
            bindCurveLabBridge (*patchWebView);
            patchWebViewHolder = choc::ui::createJUCEWebViewHolder (patchWebView->getWebView());
            patchWebViewHolder->setSize ((int) patchWebView->width, (int) patchWebView->height);

            setResizeLimits (250, 160, 32768, 32768);

            lookAndFeel.setColour (juce::TextEditor::outlineColourId, juce::Colours::transparentBlack);
            lookAndFeel.setColour (juce::TextEditor::backgroundColourId, juce::Colours::transparentBlack);

            if (auto manifest = owner.patch->getManifest())
                if (auto defaultView = manifest->findDefaultView())
                    if (auto colour = choc::text::trim (defaultView->view["background"].toString()); ! colour.empty())
                        lookAndFeel.setColour (juce::ResizableWindow::backgroundColourId, juce::Colour::fromString (colour));

            setLookAndFeel (&lookAndFeel);

            extraComp = owner.createExtraComponent();

            onPatchChanged (false);

            if (extraComp)
                addAndMakeVisible (*extraComp);

            statusMessageChanged();

            juce::Font::setDefaultMinimumHorizontalScaleFactor (1.0f);
        }

        ~Editor() override
        {
            closeCurveLabWindow();
            owner.editorBeingDeleted (this);
            setLookAndFeel (nullptr);
            patchWebViewHolder.reset();
            patchWebView.reset();
        }

        void bindCurveLabBridge (cmaj::PatchWebView& targetPatchWebView)
        {
            auto& webView = targetPatchWebView.getWebView();

            auto openBindingOK = webView.bind ("cosimo_desktop_curve_lab_openWindow",
                                               [this] (const choc::value::ValueView&) -> choc::value::Value
            {
                openOrFocusCurveLabWindow();
                return {};
            });

            auto closeBindingOK = webView.bind ("cosimo_desktop_curve_lab_closeWindow",
                                                [this] (const choc::value::ValueView&) -> choc::value::Value
            {
                closeCurveLabWindow();
                return {};
            });

            auto getStateBindingOK = webView.bind ("cosimo_desktop_curve_lab_getState",
                                                   [this] (const choc::value::ValueView&) -> choc::value::Value
            {
                return choc::value::Value (std::string_view (curveLabStateJSON));
            });

            auto setStateBindingOK = webView.bind ("cosimo_desktop_curve_lab_setState",
                                                   [this] (const choc::value::ValueView& args) -> choc::value::Value
            {
                if (args.isArray() && args.size() > 0)
                    updateCurveLabState (args[0].toString());

                return {};
            });

            (void) openBindingOK;
            (void) closeBindingOK;
            (void) getStateBindingOK;
            (void) setStateBindingOK;
            jassert (openBindingOK && closeBindingOK && getStateBindingOK && setStateBindingOK);
        }

        void openOrFocusCurveLabWindow()
        {
            if (curveLabWindow == nullptr)
                curveLabWindow = std::make_unique<CurveLabWindow> (*this);

            setCurveLabWindowOpen (true);
            curveLabWindow->setVisible (true);
            curveLabWindow->toFront (true);
            curveLabWindow->grabKeyboardFocus();
        }

        void closeCurveLabWindow()
        {
            if (curveLabWindow == nullptr)
            {
                setCurveLabWindowOpen (false);
                return;
            }

            setCurveLabWindowOpen (false);
            curveLabWindow->setVisible (false);
            curveLabWindow.reset();
        }

        void updateCurveLabState (std::string newStateJSON)
        {
            curveLabStateJSON = std::move (newStateJSON);
            broadcastCurveLabState();
        }

        void setCurveLabWindowOpen (bool shouldBeOpen)
        {
            choc::value::Value state = choc::json::create ("isOpen", shouldBeOpen);

            if (! curveLabStateJSON.empty())
            {
                try
                {
                    auto parsedState = choc::json::parse (curveLabStateJSON);

                    if (parsedState.isObject())
                        state = parsedState;
                }
                catch (...)
                {
                }
            }

            state.setMember ("isOpen", shouldBeOpen);
            curveLabStateJSON = state.toString();
            broadcastCurveLabState();
        }

        void broadcastCurveLabState()
        {
            if (curveLabStateJSON.empty())
                return;

            auto script = "window.dispatchEvent(new CustomEvent('cosimo-desktop-curve-lab-state', { detail: "
                        + curveLabStateJSON
                        + " }));";

            patchWebView->getWebView().evaluateJavascript (script);

            if (curveLabWindow != nullptr && curveLabWindow->patchWebView != nullptr)
                curveLabWindow->patchWebView->getWebView().evaluateJavascript (script);
        }

        void statusMessageChanged()
        {
            owner.refreshExtraComp (extraComp.get());
            patchWebView->setStatusMessage (owner.statusMessage);
        }

        static cmaj::PatchManifest::View derivePatchViewSize (const FixedPatchInstrumentDevPlugin& owner)
        {
            auto view = cmaj::PatchManifest::View
            {
                choc::json::create ("width", owner.lastEditorWidth,
                                    "height", owner.lastEditorHeight)
            };

            if (auto manifest = owner.patch->getManifest())
                if (auto defaultView = manifest->findDefaultView())
                    if (owner.lastEditorWidth == 0 && owner.lastEditorHeight == 0)
                        view = *defaultView;

            if (view.getWidth() == 0)   view.view.setMember ("width", defaultWidth);
            if (view.getHeight() == 0)  view.view.setMember ("height", defaultHeight);

            return view;
        }

        void onPatchChanged (bool forceReload = true)
        {
            if (owner.isViewVisible())
            {
                patchWebView->setActive (true);
                patchWebView->update (derivePatchViewSize (owner));
                patchWebViewHolder->setSize ((int) patchWebView->width, (int) patchWebView->height);

                setResizable (patchWebView->resizable, false);

                addAndMakeVisible (*patchWebViewHolder);
                childBoundsChanged (nullptr);
            }
            else
            {
                removeChildComponent (patchWebViewHolder.get());

                patchWebView->setActive (false);
                patchWebViewHolder->setVisible (false);

                setSize (defaultWidth, defaultHeight);
                setResizable (true, false);
            }

            if (forceReload)
            {
                patchWebView->reload();
                if (curveLabWindow != nullptr && curveLabWindow->patchWebView != nullptr)
                    curveLabWindow->patchWebView->reload();
            }
        }

        void childBoundsChanged (Component*) override
        {
            if (! isResizing && patchWebViewHolder->isVisible())
                setSize (std::max (50, patchWebViewHolder->getWidth()),
                         std::max (50, patchWebViewHolder->getHeight() + FixedPatchInstrumentDevPlugin::extraCompHeight));
        }

        void resized() override
        {
            isResizing = true;
            juce::AudioProcessorEditor::resized();

            auto bounds = getLocalBounds();

            if (patchWebViewHolder->isVisible())
            {
                patchWebViewHolder->setBounds (bounds.removeFromTop (getHeight() - FixedPatchInstrumentDevPlugin::extraCompHeight));
                bounds.removeFromTop (4);

                if (getWidth() > 0 && getHeight() > 0)
                {
                    owner.lastEditorWidth = patchWebViewHolder->getWidth();
                    owner.lastEditorHeight = patchWebViewHolder->getHeight();
                }
            }

            if (extraComp)
                extraComp->setBounds (bounds);

            isResizing = false;
        }

        void paint (juce::Graphics& g) override
        {
            g.fillAll (getLookAndFeel().findColour (juce::ResizableWindow::backgroundColourId));
        }

        FixedPatchInstrumentDevPlugin& owner;
        std::unique_ptr<cmaj::PatchWebView> patchWebView;
        std::unique_ptr<CurveLabWindow> curveLabWindow;
        std::unique_ptr<juce::Component> patchWebViewHolder, extraComp;
        juce::LookAndFeel_V4 lookAndFeel;
        std::string curveLabStateJSON;
        bool isResizing = false;

        static constexpr int defaultWidth = 500;
        static constexpr int defaultHeight = 400;

        JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (Editor)
    };

    juce::AudioProcessorEditor* createEditor() override
    {
        return new Editor (*this);
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

    void setStateInformation (const void* data, int size) override
    {
        auto restoredState = juce::ValueTree::readFromData (data, static_cast<size_t> (size));

        // Live may send an empty or non-Cmajor state chunk when opening the device.
        // Keep the already-loaded fixed patch alive instead of unloading it.
        if (! restoredState.isValid() || ! restoredState.hasType (ids.Cmajor))
            return;

        choc::hash::xxHash64 hash (1);
        hash.addInput (data, static_cast<size_t> (size));
        auto stateHash = hash.getHash();

        if (lastLoadedStateHash != stateHash)
        {
            lastLoadedStateHash = stateHash;
            setFixedStateSynchronously (restoredState);
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
        cosimo::modulation::uploadStoredModulationStateToPatch (*patch);
    }

    std::filesystem::path manifestLocation;
    cosimo::future_daw::NoteMetaBridge noteMetaBridge { cosimo::future_daw::KeyswitchMap::defaultLowNoteRange() };
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
