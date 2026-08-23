#pragma once

#include "CmajorBounceOfflinePerformer.h"

namespace cosimo::ios
{

/**
 * Bound in CosimoPluginMain.cpp after the generated WavetableSynth class is
 * included, forcing the shipping iOS target to instantiate the real AOT
 * offline factory and its virtual-resource manifest adapter.
 */
bounce::PerformerFactory createIOSBouncePerformerFactory (
    bounce::CmajorPatchSnapshot snapshot);
std::size_t iosBouncePerformerResidentBytes() noexcept;

} // namespace cosimo::ios
