#pragma once

#include <JuceHeader.h>

#include <functional>
#include <memory>
#include <string_view>

namespace cosimo::bounce
{
class BounceBankStore;
}

namespace cosimo::ios
{

inline constexpr std::string_view kSharedWavetableAppGroupIdentifier = "group.dev.cosimo.wavetable-synth";
inline constexpr std::string_view kFactoryBankCatalogAssetPath = "assets/factory-bank-catalog.json";
inline constexpr std::string_view kFactorySourceAssetPrefix = "assets/factory_sources/";

struct SharedWavetableLibraryStatus
{
    bool ready = false;
    bool usingSharedContainer = false;
    int tableCount = 0;
    juce::String summary;
    juce::String detail;
    juce::File libraryRoot;
    juce::File catalogFile;
};

enum class SharedWavetableLibraryComponentMode
{
    standaloneInstaller,
    extensionUnavailable,
};

struct SharedWavetableLibraryComponentCallbacks
{
    std::function<void()> requestPatchReload;
};

bool isManagedWavetableAssetPath (std::string_view relativePath);
juce::File resolveManagedWavetableAssetFile (std::string_view relativePath);
SharedWavetableLibraryStatus inspectSharedWavetableLibrary();

/**
 * Resolves the Bounce store in the App Group. Production AUv3 callers pass
 * false: a private fallback would be invisible to the containing app.
 */
juce::File resolveSharedBounceBankStoreRoot (
    bool allowLocalDevelopmentFallback,
    bool* usingSharedContainer = nullptr);
juce::Result prepareSharedBounceBankStoreRoot (const juce::File& root);
juce::Result protectPublishedBounceBankFile (const juce::File& bankFile);
std::unique_ptr<bounce::BounceBankStore> createSharedBounceBankStore (
    bool allowLocalDevelopmentFallback,
    juce::String* errorMessage = nullptr);

std::unique_ptr<juce::Component> createSharedWavetableLibraryComponent (SharedWavetableLibraryComponentMode mode,
                                                                       SharedWavetableLibraryComponentCallbacks callbacks);
void refreshSharedWavetableLibraryComponent (juce::Component* component);

} // namespace cosimo::ios
