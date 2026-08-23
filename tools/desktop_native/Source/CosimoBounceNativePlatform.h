#pragma once

#include "BounceNativeBankStore.h"
#include "CmajorBounceOfflinePerformer.h"

#include <filesystem>
#include <memory>

namespace cosimo::desktop
{

/** Resolves JUCE's per-user application-data directory, never the bundle/cwd. */
std::filesystem::path resolveBounceBankStoreRoot();
std::unique_ptr<bounce::BounceBankStore> createBounceBankStore();
bounce::PerformerFactory createBouncePerformerFactory (
    bounce::CmajorPatchSnapshot snapshot);

} // namespace cosimo::desktop
