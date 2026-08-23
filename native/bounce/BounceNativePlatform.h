#pragma once

#include <filesystem>

namespace cosimo::bounce
{

/** Adds the canonical desktop suffix to JUCE's Application Support root. */
std::filesystem::path desktopBounceBankStoreRoot (
    const std::filesystem::path& applicationSupportRoot);

/** Adds the canonical iOS suffix to the resolved App Group container root. */
std::filesystem::path iosBounceBankStoreRoot (
    const std::filesystem::path& appGroupContainerRoot);

} // namespace cosimo::bounce
