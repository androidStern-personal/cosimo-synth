#pragma once

#include <filesystem>
#include <memory>

namespace cosimo::bounce
{
class BounceBankStore;
}

namespace cosimo::desktop
{

/** Resolves JUCE's per-user application-data directory, never the bundle/cwd. */
std::filesystem::path resolveBounceBankStoreRoot();
std::unique_ptr<bounce::BounceBankStore> createBounceBankStore();

} // namespace cosimo::desktop
