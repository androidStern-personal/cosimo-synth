#include "CosimoBounceNativePlatform.h"

#include <JuceHeader.h>

#include "BounceNativeBankStore.h"
#include "BounceNativePlatform.h"

#include <stdexcept>

namespace cosimo::desktop
{

std::filesystem::path resolveBounceBankStoreRoot()
{
    const auto applicationSupport = juce::File::getSpecialLocation (
        juce::File::userApplicationDataDirectory);
    const auto path = applicationSupport.getFullPathName().toStdString();
    if (path.empty())
        throw std::runtime_error ("JUCE could not resolve user Application Support");

    return bounce::desktopBounceBankStoreRoot (std::filesystem::u8path (path));
}

std::unique_ptr<bounce::BounceBankStore> createBounceBankStore()
{
    auto store = std::make_unique<bounce::BounceBankStore> (
        resolveBounceBankStoreRoot());
    store->initialise();
    return store;
}

} // namespace cosimo::desktop
