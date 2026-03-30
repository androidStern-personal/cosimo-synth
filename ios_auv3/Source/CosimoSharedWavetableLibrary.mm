#include <Foundation/Foundation.h>

#include "CosimoSharedWavetableLibrary.h"

namespace cosimo::ios
{
namespace
{

constexpr int kSamplesPerFrame = 2048;

juce::File getGroupContainerRoot()
{
    NSString* identifier = [NSString stringWithUTF8String: std::string (kSharedWavetableAppGroupIdentifier).c_str()];
    NSURL* containerURL = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier: identifier];

    if (containerURL == nil)
        return {};

    return juce::File (juce::String::fromUTF8 (containerURL.path.UTF8String));
}

juce::File getLocalApplicationSupportRoot()
{
    NSArray<NSURL*>* urls = [[NSFileManager defaultManager] URLsForDirectory: NSApplicationSupportDirectory
                                                                   inDomains: NSUserDomainMask];
    NSURL* firstURL = urls.firstObject;

    if (firstURL == nil)
        return {};

    return juce::File (juce::String::fromUTF8 (firstURL.path.UTF8String));
}

juce::File getResolvedLibraryRoot (bool* usingSharedContainer = nullptr)
{
    if (auto groupRoot = getGroupContainerRoot(); groupRoot.exists())
    {
        if (usingSharedContainer != nullptr)
            *usingSharedContainer = true;

        return groupRoot
            .getChildFile ("Library")
            .getChildFile ("Application Support")
            .getChildFile ("CosimoSynth")
            .getChildFile ("WavetableLibrary")
            .getChildFile ("current");
    }

    if (usingSharedContainer != nullptr)
        *usingSharedContainer = false;

    return getLocalApplicationSupportRoot()
        .getChildFile ("CosimoSynth")
        .getChildFile ("WavetableLibrary")
        .getChildFile ("current");
}

juce::Result setExcludedFromBackup (const juce::File& target)
{
    if (! target.exists())
        return juce::Result::ok();

    NSURL* url = [NSURL fileURLWithPath: [NSString stringWithUTF8String: target.getFullPathName().toRawUTF8()]];

    if (url == nil)
        return juce::Result::fail ("Could not build an iOS file URL for the installed library.");

    NSError* error = nil;
    NSNumber* value = @YES;
    const BOOL ok = [url setResourceValue: value
                                   forKey: NSURLIsExcludedFromBackupKey
                                    error: &error];

    if (! ok)
    {
        NSString* description = error.localizedDescription ?: @"Unknown backup exclusion failure";
        return juce::Result::fail ("Could not exclude the installed library from iCloud backup: "
                                   + juce::String::fromUTF8 (description.UTF8String));
    }

    return juce::Result::ok();
}

juce::Result validateWaveFile (const juce::File& waveFile, int expectedFrameCount)
{
    juce::WavAudioFormat format;
    auto stream = waveFile.createInputStream();

    if (stream == nullptr)
        return juce::Result::fail ("Could not open " + waveFile.getFileName() + ".");

    std::unique_ptr<juce::AudioFormatReader> reader (format.createReaderFor (stream.release(), true));

    if (reader == nullptr)
        return juce::Result::fail (waveFile.getFileName() + " is not a readable WAV file.");

    if (reader->numChannels != 1)
        return juce::Result::fail (waveFile.getFileName() + " must be mono.");

    if (reader->bitsPerSample != 16 && reader->bitsPerSample != 32)
        return juce::Result::fail (waveFile.getFileName() + " must be 16-bit PCM or 32-bit float.");

    if ((reader->lengthInSamples % kSamplesPerFrame) != 0)
        return juce::Result::fail (waveFile.getFileName() + " does not contain a whole number of 2048-sample frames.");

    const auto frameCount = static_cast<int> (reader->lengthInSamples / kSamplesPerFrame);

    if (frameCount != expectedFrameCount)
    {
        return juce::Result::fail (waveFile.getFileName()
                                   + " reports "
                                   + juce::String (frameCount)
                                   + " frames, expected "
                                   + juce::String (expectedFrameCount)
                                   + ".");
    }

    return juce::Result::ok();
}

juce::Result readCatalogTableCount (const juce::File& catalogFile, int* tableCountOut = nullptr)
{
    if (! catalogFile.existsAsFile())
        return juce::Result::fail ("The wavetable catalog is missing.");

    const auto parsed = juce::JSON::parse (catalogFile);
    auto* rootObject = parsed.getDynamicObject();

    if (rootObject == nullptr)
        return juce::Result::fail ("The wavetable catalog is not valid JSON.");

    auto tablesValue = rootObject->getProperty ("tables");
    auto* tablesArray = tablesValue.getArray();

    if (tablesArray == nullptr)
        return juce::Result::fail ("The wavetable catalog does not contain a tables array.");

    if (tableCountOut != nullptr)
        *tableCountOut = tablesArray->size();

    return juce::Result::ok();
}

juce::Result validateInstalledLibrary (const juce::File& libraryRoot, int* tableCountOut = nullptr)
{
    const auto catalogFile = libraryRoot.getChildFile (juce::String (kFactoryBankCatalogAssetPath.data()));

    int tableCount = 0;

    if (auto tableCountResult = readCatalogTableCount (catalogFile, &tableCount); tableCountResult.failed())
        return tableCountResult;

    if (tableCountOut != nullptr)
        *tableCountOut = tableCount;

    const auto parsed = juce::JSON::parse (catalogFile);
    auto* rootObject = parsed.getDynamicObject();
    auto tablesValue = rootObject->getProperty ("tables");
    auto* tablesArray = tablesValue.getArray();

    for (int index = 0; index < tablesArray->size(); ++index)
    {
        auto* tableObject = (*tablesArray)[index].getDynamicObject();

        if (tableObject == nullptr)
            return juce::Result::fail ("Catalog table " + juce::String (index) + " is not an object.");

        const auto sourceWav = tableObject->getProperty ("sourceWav").toString();
        const auto expectedFrameCount = static_cast<int> (tableObject->getProperty ("frameCount"));

        if (sourceWav.isEmpty())
            return juce::Result::fail ("Catalog table " + juce::String (index) + " is missing sourceWav.");

        if (expectedFrameCount <= 0)
            return juce::Result::fail ("Catalog table " + juce::String (index) + " has an invalid frameCount.");

        const auto sourceFile = libraryRoot.getChildFile (sourceWav);

        if (! sourceFile.existsAsFile())
            return juce::Result::fail ("Missing wavetable source file: " + sourceWav);

        if (auto validation = validateWaveFile (sourceFile, expectedFrameCount); validation.failed())
            return validation;
    }

    return juce::Result::ok();
}

struct InstallResult
{
    bool succeeded = false;
    juce::String message;
};

InstallResult installLibraryFromArchive (const juce::URL& archiveURL)
{
    auto archiveStream = archiveURL.createInputStream (juce::URL::InputStreamOptions (juce::URL::ParameterHandling::inAddress));

    if (archiveStream == nullptr)
        return { false, "Could not open the selected wavetable zip." };

    juce::ZipFile archive (*archiveStream);

    if (archive.getNumEntries() == 0)
        return { false, "The selected wavetable zip is empty." };

    const auto libraryRoot = getResolvedLibraryRoot();
    const auto installParent = libraryRoot.getParentDirectory();
    const auto createParent = installParent.createDirectory();

    if (createParent.failed())
        return { false, createParent.getErrorMessage() };

    const auto stageRoot = installParent.getNonexistentChildFile ("staging-", "", false);
    const auto previousRoot = installParent.getChildFile ("previous");

    if (auto createStage = stageRoot.createDirectory(); createStage.failed())
        return { false, createStage.getErrorMessage() };

    const auto cleanupStage = [&stageRoot]
    {
        if (stageRoot.exists())
            stageRoot.deleteRecursively();
    };

    if (auto unzipResult = archive.uncompressTo (stageRoot, true); unzipResult.failed())
    {
        cleanupStage();
        return { false, "Could not unpack the wavetable zip: " + unzipResult.getErrorMessage() };
    }

    int tableCount = 0;

    if (auto validation = validateInstalledLibrary (stageRoot, &tableCount); validation.failed())
    {
        cleanupStage();
        return { false, "The wavetable zip did not contain a valid factory library: " + validation.getErrorMessage() };
    }

    previousRoot.deleteRecursively();
    bool movedOldLibraryAside = false;

    if (libraryRoot.exists() && ! libraryRoot.moveFileTo (previousRoot))
    {
        cleanupStage();
        return { false, "Could not replace the previous wavetable library." };
    }

    movedOldLibraryAside = previousRoot.exists();

    if (! stageRoot.moveFileTo (libraryRoot))
    {
        if (movedOldLibraryAside)
            previousRoot.moveFileTo (libraryRoot);

        cleanupStage();
        return { false, "Could not move the validated wavetable library into place." };
    }

    previousRoot.deleteRecursively();

    if (auto backupResult = setExcludedFromBackup (libraryRoot); backupResult.failed())
        return { false, backupResult.getErrorMessage() };

    return {
        true,
        "Installed "
            + juce::String (tableCount)
            + " factory wavetables into "
            + libraryRoot.getFullPathName()
            + "."
    };
}

class SharedWavetableLibraryComponent final : public juce::Component
{
public:
    explicit SharedWavetableLibraryComponent (SharedWavetableLibraryComponentMode modeToUse,
                                              SharedWavetableLibraryComponentCallbacks callbacksToUse)
        : mode (modeToUse), callbacks (std::move (callbacksToUse))
    {
        titleLabel.setJustificationType (juce::Justification::centredLeft);
        titleLabel.setColour (juce::Label::textColourId, juce::Colours::white);
       #if JUCE_MAJOR_VERSION == 8
        titleLabel.setFont (juce::Font (juce::FontOptions (16.0f).withStyle ("Bold")));
       #else
        titleLabel.setFont (juce::Font (16.0f, juce::Font::bold));
       #endif

        detailLabel.setJustificationType (juce::Justification::topLeft);
        detailLabel.setMinimumHorizontalScale (1.0f);
        detailLabel.setColour (juce::Label::textColourId, juce::Colour (0xffd9e2f2));

        importButton.setButtonText ("Import Zip");
        importButton.onClick = [this] { chooseArchive(); };
        importButton.setVisible (mode == SharedWavetableLibraryComponentMode::standaloneInstaller);

        addAndMakeVisible (titleLabel);
        addAndMakeVisible (detailLabel);

        if (mode == SharedWavetableLibraryComponentMode::standaloneInstaller)
            addAndMakeVisible (importButton);

        refresh();
    }

    void refresh()
    {
        currentStatus = inspectSharedWavetableLibrary();
        juce::String title;
        juce::String message;

        if (mode == SharedWavetableLibraryComponentMode::standaloneInstaller)
        {
            title = currentStatus.ready ? "Factory Wavetables Installed"
                                        : "Install Factory Wavetables";

            if (isInstalling)
            {
                message = "Installing the factory wavetable library into shared storage...";
            }
            else if (! lastOperationMessage.isEmpty())
            {
                message = lastOperationMessage;
            }
            else if (currentStatus.ready)
            {
                message = currentStatus.summary;
            }
            else
            {
                message = currentStatus.detail;
            }

            importButton.setEnabled (! isInstalling);
            importButton.setButtonText (currentStatus.ready ? "Reinstall Zip" : "Import Zip");
        }
        else
        {
            title = "Factory Wavetable Library Required";

            if (currentStatus.ready)
            {
                message = "The shared factory wavetable library is ready. Close and reopen this plug-in window if the synth view is still hidden.";
            }
            else if (! currentStatus.detail.isEmpty())
            {
                message = "Open the Cosimo Synth app and import the factory wavetable zip there. This AUv3 reads that shared library after the install finishes.\n\nCurrent shared library status: "
                        + currentStatus.detail;
            }
            else
            {
                message = "Open the Cosimo Synth app and import the factory wavetable zip there. This AUv3 reads that shared library after the install finishes.";
            }
        }

        titleLabel.setText (title, juce::dontSendNotification);
        detailLabel.setText (message, juce::dontSendNotification);
        repaint();
    }

    void resized() override
    {
        auto cardArea = getCardBounds().reduced (24);
        titleLabel.setBounds (cardArea.removeFromTop (28));
        cardArea.removeFromTop (16);

        if (importButton.isVisible())
        {
            auto buttonArea = cardArea.removeFromBottom (44);
            importButton.setBounds (buttonArea.removeFromLeft (150));
            cardArea.removeFromBottom (12);
        }

        detailLabel.setBounds (cardArea);
    }

    void paint (juce::Graphics& g) override
    {
        g.fillAll (juce::Colour (0xff05070d));

        const auto cardBounds = getCardBounds().toFloat();
        g.setColour (juce::Colour (0xff111826));
        g.fillRoundedRectangle (cardBounds, 20.0f);

        g.setColour (lastOperationWasError ? juce::Colour (0xffa74a4a) : juce::Colour (0xff314764));
        g.drawRoundedRectangle (cardBounds, 20.0f, 1.5f);
    }

private:
    juce::Rectangle<int> getCardBounds() const
    {
        auto area = getLocalBounds().reduced (24);
        const auto targetWidth = std::min (620, area.getWidth());
        const auto targetHeight = std::min (mode == SharedWavetableLibraryComponentMode::standaloneInstaller ? 260 : 220,
                                            area.getHeight());
        return juce::Rectangle<int> (targetWidth, targetHeight).withCentre (area.getCentre());
    }

    void chooseArchive()
    {
        if (mode != SharedWavetableLibraryComponentMode::standaloneInstaller)
            return;

        chooser = std::make_unique<juce::FileChooser> (
            "Import the factory wavetable zip",
            juce::File(),
            "*.zip",
            true,
            false,
            this);

        const auto flags = juce::FileBrowserComponent::openMode
                         | juce::FileBrowserComponent::canSelectFiles;

        chooser->launchAsync (flags, [safeThis = juce::Component::SafePointer<SharedWavetableLibraryComponent> (this)] (const juce::FileChooser& fileChooser)
        {
            if (safeThis != nullptr)
                safeThis->handleArchiveChosen (fileChooser);
        });
    }

    void handleArchiveChosen (const juce::FileChooser& fileChooser)
    {
        auto archiveURL = fileChooser.getURLResult();
        chooser.reset();

        if (archiveURL.isEmpty())
            return;

        isInstalling = true;
        lastOperationMessage.clear();
        lastOperationWasError = false;
        refresh();

        juce::Thread::launch ([safeThis = juce::Component::SafePointer<SharedWavetableLibraryComponent> (this),
                               archiveURL = std::move (archiveURL)]() mutable
        {
            const auto result = installLibraryFromArchive (archiveURL);

            juce::MessageManager::callAsync ([safeThis, result]
            {
                if (safeThis == nullptr)
                    return;

                safeThis->isInstalling = false;
                safeThis->lastOperationWasError = ! result.succeeded;
                safeThis->lastOperationMessage = result.message;
                safeThis->refresh();

                if (result.succeeded && safeThis->callbacks.requestPatchReload != nullptr)
                    safeThis->callbacks.requestPatchReload();
            });
        });
    }

    SharedWavetableLibraryComponentMode mode;
    SharedWavetableLibraryComponentCallbacks callbacks;
    SharedWavetableLibraryStatus currentStatus;
    std::unique_ptr<juce::FileChooser> chooser;
    juce::Label titleLabel;
    juce::Label detailLabel;
    juce::TextButton importButton;
    juce::String lastOperationMessage;
    bool lastOperationWasError = false;
    bool isInstalling = false;
};

} // namespace

bool isManagedWavetableAssetPath (std::string_view relativePath)
{
    return relativePath == kFactoryBankCatalogAssetPath
        || relativePath.rfind (kFactorySourceAssetPrefix, 0) == 0;
}

juce::File resolveManagedWavetableAssetFile (std::string_view relativePath)
{
    if (! isManagedWavetableAssetPath (relativePath))
        return {};

    return getResolvedLibraryRoot().getChildFile (juce::String (relativePath.data(), static_cast<int> (relativePath.size())));
}

SharedWavetableLibraryStatus inspectSharedWavetableLibrary()
{
    SharedWavetableLibraryStatus status;
    status.libraryRoot = getResolvedLibraryRoot (&status.usingSharedContainer);
    status.catalogFile = status.libraryRoot.getChildFile (juce::String (kFactoryBankCatalogAssetPath.data()));

    if (! status.libraryRoot.exists())
    {
        status.summary = "Factory wavetable library missing.";
        status.detail = "Import the factory wavetable zip once. Cosimo Synth will then keep it outside the app bundle.";
        return status;
    }

    int tableCount = 0;

    if (auto tableCountResult = readCatalogTableCount (status.catalogFile, &tableCount); tableCountResult.failed())
    {
        status.summary = "Factory wavetable library is incomplete.";
        status.detail = tableCountResult.getErrorMessage();
        return status;
    }

    status.ready = true;
    status.tableCount = tableCount;
    status.summary = "Factory wavetable library ready. "
                   + juce::String (tableCount)
                   + " tables are installed in "
                   + (status.usingSharedContainer ? "the App Group container." : "local app storage.");
    status.detail = status.summary;
    return status;
}

std::unique_ptr<juce::Component> createSharedWavetableLibraryComponent (SharedWavetableLibraryComponentMode mode,
                                                                       SharedWavetableLibraryComponentCallbacks callbacks)
{
    return std::make_unique<SharedWavetableLibraryComponent> (mode, std::move (callbacks));
}

void refreshSharedWavetableLibraryComponent (juce::Component* component)
{
    if (auto* libraryComponent = dynamic_cast<SharedWavetableLibraryComponent*> (component))
        libraryComponent->refresh();
}

} // namespace cosimo::ios
