#pragma once

#include "SharedDataReader.h"

extern "C" {
__attribute__((import_module("env"), import_name("cmaj_sharedDataAddress")))
std::uint32_t cmaj_sharedDataAddress (std::int32_t input);
__attribute__((import_module("env"), import_name("cmaj_sharedDataSize")))
std::uint32_t cmaj_sharedDataSize (std::int32_t input);
}

namespace builder_kit::shared_data
{
inline View readWasmSharedData (std::int32_t input) noexcept
{
    return { reinterpret_cast<const void*> (cmaj_sharedDataAddress (input)), cmaj_sharedDataSize (input) };
}

// Each Wasm module instance belongs to one processor and one linear memory.
// The host brackets its advance call; no pointer survives endSharedBlock().
template <std::size_t InputCount>
struct WasmData
{
    static void beginSharedBlock() noexcept { block.refresh (readWasmSharedData); }
    static void endSharedBlock() noexcept { block.refresh (nullptr); }
    static View readForAudioBlock (std::int32_t input) noexcept { return block.readForAudioBlock (input); }
    static std::int32_t size (std::int32_t input) noexcept { return block.size (input); }
    static std::int32_t byteSize (std::int32_t input) noexcept { return block.byteSize (input); }
    static float readFloat (std::int32_t input, std::int32_t index) noexcept { return block.readFloat (input, index); }
    static std::int32_t readInt (std::int32_t input, std::int32_t index) noexcept { return block.readInt (input, index); }
private:
    inline static BlockReader<InputCount> block;
};
}
