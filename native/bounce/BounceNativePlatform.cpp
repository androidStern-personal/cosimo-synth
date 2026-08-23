#include "BounceNativePlatform.h"

#include <stdexcept>

namespace cosimo::bounce
{

std::filesystem::path desktopBounceBankStoreRoot (
    const std::filesystem::path& applicationSupportRoot)
{
    if (applicationSupportRoot.empty())
        throw std::invalid_argument ("Desktop Application Support root is empty");

    return (applicationSupportRoot / "CosimoSynth" / "BounceBanks" / "v1")
        .lexically_normal();
}

std::filesystem::path iosBounceBankStoreRoot (
    const std::filesystem::path& appGroupContainerRoot)
{
    if (appGroupContainerRoot.empty())
        throw std::invalid_argument ("iOS App Group container root is empty");

    return (appGroupContainerRoot / "Library" / "Application Support"
            / "CosimoSynth" / "BounceBanks" / "v1")
        .lexically_normal();
}

} // namespace cosimo::bounce
