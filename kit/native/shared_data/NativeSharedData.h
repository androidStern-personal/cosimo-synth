#pragma once

#include "SharedDataReader.h"
#include "cmajor/helpers/cmaj_PatchSharedData.h"

namespace builder_kit::shared_data
{
inline View readNativeSharedData (std::int32_t input) noexcept
{
    return { cmaj::PatchSharedData::data (input), static_cast<std::size_t> (cmaj::PatchSharedData::byteSize (input)) };
}

// One cache per audio thread and specialization. Scope identity distinguishes
// instances, successive calls and nested A->B->A rendering. Zero clears pointers.
template <typename Cache>
const Cache& readNativeBlock() noexcept
{
    thread_local Cache cache;
    thread_local std::uint64_t cachedScope = 0;
    const auto scope = cmaj::PatchSharedData::readScopeToken();
    if (scope != cachedScope)
    {
        cache.refresh (scope != 0 ? readNativeSharedData : nullptr);
        cachedScope = scope;
    }
    return cache;
}

template <std::size_t InputCount>
struct NativeData
{
    static View readForAudioBlock (std::int32_t input) noexcept { return block().readForAudioBlock (input); }
    static std::int32_t size (std::int32_t input) noexcept { return block().size (input); }
    static std::int32_t byteSize (std::int32_t input) noexcept { return block().byteSize (input); }
    static float readFloat (std::int32_t input, std::int32_t index) noexcept { return block().readFloat (input, index); }
    static std::int32_t readInt (std::int32_t input, std::int32_t index) noexcept { return block().readInt (input, index); }
private:
    static const BlockReader<InputCount>& block() noexcept { return readNativeBlock<BlockReader<InputCount>>(); }
};
}
