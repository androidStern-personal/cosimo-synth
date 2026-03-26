#include <juce_core/system/juce_TargetPlatform.h>
#include <juce_audio_plugin_client/detail/juce_CheckSettingMacros.h>

#include <juce_audio_plugin_client/detail/juce_IncludeSystemHeaders.h>
#include <juce_audio_plugin_client/detail/juce_IncludeModuleHeaders.h>
#include <juce_gui_basics/native/juce_WindowsHooks_windows.h>
#include <juce_audio_plugin_client/detail/juce_PluginUtilities.h>

#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_gui_extra/juce_gui_extra.h>
#include <juce_audio_utils/juce_audio_utils.h>
#include <juce_audio_plugin_client/Standalone/juce_StandaloneFilterWindow.h>

namespace juce
{

class CosimoStandaloneWindow final : public DocumentWindow
{
public:
    CosimoStandaloneWindow (const String& windowName,
                            Colour background,
                            std::unique_ptr<StandalonePluginHolder> pluginHolderToUse)
        : DocumentWindow (windowName, background, DocumentWindow::allButtons),
          pluginHolder (std::move (pluginHolderToUse))
    {
        setUsingNativeTitleBar (false);
        setTitleBarHeight (0);
        setResizable (false, false);
        setContentOwned (new MainContentComponent (*this), false);

        if (auto* display = Desktop::getInstance().getDisplays().getPrimaryDisplay())
            setBounds (display->userArea);

        setFullScreen (true);
    }

    void closeButtonPressed() override
    {
        if (auto* app = JUCEApplicationBase::getInstance())
            app->systemRequestedQuit();
    }

    BorderSize<int> getBorderThickness() const override
    {
        return {};
    }

    BorderSize<int> getContentComponentBorder() const override
    {
        return {};
    }

    void resized() override
    {
        DocumentWindow::resized();

        if (auto* content = getContentComponent())
            content->setBounds (getLocalBounds());
    }

    StandalonePluginHolder* getPluginHolder() const
    {
        return pluginHolder.get();
    }

    AudioProcessor* getAudioProcessor() const
    {
        return pluginHolder != nullptr ? pluginHolder->processor.get() : nullptr;
    }

private:
    class MainContentComponent final : public Component,
                                       private ComponentListener
    {
    public:
        explicit MainContentComponent (CosimoStandaloneWindow& ownerToUse)
            : owner (ownerToUse),
              editor (createEditor())
        {
            if (editor != nullptr)
            {
                editor->addComponentListener (this);
                addAndMakeVisible (editor.get());
            }

            setOpaque (true);
        }

        ~MainContentComponent() override
        {
            if (editor != nullptr)
            {
                editor->removeComponentListener (this);

                if (auto* processor = owner.getAudioProcessor())
                    processor->editorBeingDeleted (editor.get());

                editor = nullptr;
            }
        }

        void resized() override
        {
            if (editor != nullptr)
                editor->setBounds (getLocalBounds());
        }

        void paint (Graphics& g) override
        {
            g.fillAll (juce::Colours::limegreen);
        }

    private:
        std::unique_ptr<AudioProcessorEditor> createEditor() const
        {
            if (auto* processor = owner.getAudioProcessor())
            {
                if (processor->hasEditor())
                    return std::unique_ptr<AudioProcessorEditor> (processor->createEditorIfNeeded());

                return std::make_unique<GenericAudioProcessorEditor> (*processor);
            }

            return {};
        }

        void componentMovedOrResized (Component&, bool, bool) override
        {
            resized();
        }

        CosimoStandaloneWindow& owner;
        std::unique_ptr<AudioProcessorEditor> editor;
    };

    std::unique_ptr<StandalonePluginHolder> pluginHolder;
};

class CosimoStandaloneApp final : public JUCEApplication
{
public:
    CosimoStandaloneApp()
    {
        PropertiesFile::Options options;
        options.applicationName     = CharPointer_UTF8 (JucePlugin_Name);
        options.filenameSuffix      = ".settings";
        options.osxLibrarySubFolder = "Application Support";
        options.folderName          = "";
        appProperties.setStorageParameters (options);
    }

    const String getApplicationName() override           { return CharPointer_UTF8 (JucePlugin_Name); }
    const String getApplicationVersion() override        { return JucePlugin_VersionString; }
    bool moreThanOneInstanceAllowed() override           { return true; }
    void anotherInstanceStarted (const String&) override {}

    void initialise (const String&) override
    {
        if (Desktop::getInstance().getDisplays().displays.isEmpty())
        {
            pluginHolder = createPluginHolder();
            return;
        }

        mainWindow = std::make_unique<CosimoStandaloneWindow> (
            getApplicationName(),
            juce::Colours::magenta,
            createPluginHolder());
        mainWindow->setVisible (true);
    }

    void shutdown() override
    {
        if (mainWindow != nullptr)
            mainWindow->getPluginHolder()->savePluginState();
        else if (pluginHolder != nullptr)
            pluginHolder->savePluginState();

        pluginHolder = nullptr;
        mainWindow = nullptr;
        appProperties.saveIfNeeded();
    }

    void systemRequestedQuit() override
    {
        if (mainWindow != nullptr)
            mainWindow->getPluginHolder()->savePluginState();
        else if (pluginHolder != nullptr)
            pluginHolder->savePluginState();

        quit();
    }

private:
    std::unique_ptr<StandalonePluginHolder> createPluginHolder()
    {
        constexpr auto autoOpenMidiDevices = true;

       #ifdef JucePlugin_PreferredChannelConfigurations
        constexpr StandalonePluginHolder::PluginInOuts channels[] { JucePlugin_PreferredChannelConfigurations };
        const Array<StandalonePluginHolder::PluginInOuts> channelConfig (channels, numElementsInArray (channels));
       #else
        const Array<StandalonePluginHolder::PluginInOuts> channelConfig;
       #endif

        return std::make_unique<StandalonePluginHolder> (appProperties.getUserSettings(),
                                                         false,
                                                         String{},
                                                         nullptr,
                                                         channelConfig,
                                                         autoOpenMidiDevices);
    }

    ApplicationProperties appProperties;
    std::unique_ptr<CosimoStandaloneWindow> mainWindow;
    std::unique_ptr<StandalonePluginHolder> pluginHolder;
};

} // namespace juce

JUCE_CREATE_APPLICATION_DEFINE (juce::CosimoStandaloneApp)
