#pragma once

#include <JuceHeader.h>

#include <functional>
#include <string_view>

namespace cosimo::ios
{

inline constexpr std::string_view kSharedWavetableAppGroupIdentifier = "group.dev.cosimo.wavetable-synth";
inline constexpr std::string_view kFactoryBankCatalogAssetPath = "assets/factory-bank-catalog.json";
inline constexpr std::string_view kFactorySourceAssetPrefix = "assets/factory_sources/";
inline constexpr int kSharedWavetableLibraryBarHeight = 76;

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

struct SharedWavetableLibraryComponentCallbacks
{
    std::function<void()> requestPatchReload;
    std::function<void()> requestComponentRefresh;
};

bool isManagedWavetableAssetPath (std::string_view relativePath);
juce::File resolveManagedWavetableAssetFile (std::string_view relativePath);
SharedWavetableLibraryStatus inspectSharedWavetableLibrary();
int getSharedWavetableLibraryComponentHeight();

std::unique_ptr<juce::Component> createSharedWavetableLibraryComponent (SharedWavetableLibraryComponentCallbacks callbacks);
void refreshSharedWavetableLibraryComponent (juce::Component* component);

} // namespace cosimo::ios
