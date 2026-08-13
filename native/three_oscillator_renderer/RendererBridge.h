#pragma once

#include <array>
#include <cstdint>

namespace cosimo::three_osc::bridge
{
template <typename Element>
struct Slice
{
    Element* elements;
    std::int32_t size;
};

constexpr std::int32_t phaseOffset = 0;
constexpr std::int32_t historyOffset = phaseOffset + 384;
constexpr std::int32_t atlasFamilyMixOffset = historyOffset + (16 * 4 * 79);
constexpr std::int32_t cachedAtlasPhaseIncrementOffset = atlasFamilyMixOffset + 96;
constexpr std::int32_t cachedAtlasWarpAmountOffset = cachedAtlasPhaseIncrementOffset + 384;
constexpr std::int32_t atlasAmountWeight0Offset = cachedAtlasWarpAmountOffset + 384;
constexpr std::int32_t atlasAmountWeight1Offset = atlasAmountWeight0Offset + 384;
constexpr std::int32_t atlasAmountWeight2Offset = atlasAmountWeight1Offset + 384;
constexpr std::int32_t phaseIncrementOffset = atlasAmountWeight2Offset + 384;
constexpr std::int32_t positionOffset = phaseIncrementOffset + 384;
constexpr std::int32_t warpAmountOffset = positionOffset + 384;
constexpr std::int32_t leftGainOffset = warpAmountOffset + 384;
constexpr std::int32_t rightGainOffset = leftGainOffset + 384;
constexpr std::int32_t atlasDcOffset = rightGainOffset + 384;
constexpr std::int32_t atlasBasis0Offset = atlasDcOffset + 384;
constexpr std::int32_t atlasBasis1Offset = atlasBasis0Offset + 384;
constexpr std::int32_t atlasBasis2Offset = atlasBasis1Offset + 384;
constexpr std::int32_t atlasBasis3Offset = atlasBasis2Offset + 384;
constexpr std::int32_t voiceOscillatorCount = 16 * 3;
constexpr std::int32_t basePhaseIncrementOffset = atlasBasis3Offset + 384;
constexpr std::int32_t basePositionOffset = basePhaseIncrementOffset + voiceOscillatorCount;
constexpr std::int32_t baseWarpAmountOffset = basePositionOffset + voiceOscillatorCount;
constexpr std::int32_t basePanOffset = baseWarpAmountOffset + voiceOscillatorCount;
constexpr std::int32_t oscillatorGainOffset = basePanOffset + voiceOscillatorCount;
constexpr std::int32_t unisonDetuneOffset = oscillatorGainOffset + voiceOscillatorCount;
constexpr std::int32_t unisonBlendOffset = unisonDetuneOffset + voiceOscillatorCount;
constexpr std::int32_t unisonWidthOffset = unisonBlendOffset + voiceOscillatorCount;
constexpr std::int32_t positionSpreadOffset = unisonWidthOffset + voiceOscillatorCount;
constexpr std::int32_t warpSpreadOffset = positionSpreadOffset + voiceOscillatorCount;
constexpr std::int32_t noteOutputOffset = warpSpreadOffset + voiceOscillatorCount;
constexpr std::int32_t packedFloatCount = noteOutputOffset + (16 * 2);

constexpr std::int32_t writeIndexOffset = 0;
constexpr std::int32_t atlasFamilyTargetOffset = writeIndexOffset + 16;
constexpr std::int32_t cachedAtlasModeOffset = atlasFamilyTargetOffset + 96;
constexpr std::int32_t atlasLengthOffset = cachedAtlasModeOffset + 384;
constexpr std::int32_t atlasAmountBase0Offset = atlasLengthOffset + 384;
constexpr std::int32_t atlasAmountBase1Offset = atlasAmountBase0Offset + 384;
constexpr std::int32_t atlasAmountBase2Offset = atlasAmountBase1Offset + 384;
constexpr std::int32_t warpModeOffset = atlasAmountBase2Offset + 384;
constexpr std::int32_t noteOscillatorModeCount = 16 * 3;
constexpr std::int32_t oscillatorSlotOffset = warpModeOffset + noteOscillatorModeCount;
constexpr std::int32_t mipOffsetOffset = oscillatorSlotOffset + 3;
constexpr std::int32_t mipLengthOffset = mipOffsetOffset + (4 * 11);
constexpr std::int32_t frameCountOffset = mipLengthOffset + (4 * 11);
constexpr std::int32_t oversampleFactorOffset = frameCountOffset + 4;
constexpr std::int32_t use441FilterOffset = oversampleFactorOffset + 1;
constexpr std::int32_t unisonVoicesOffset = use441FilterOffset + 1;
constexpr std::int32_t unisonDetuneModeOffset = unisonVoicesOffset + voiceOscillatorCount;
constexpr std::int32_t unisonStackModeOffset = unisonDetuneModeOffset + voiceOscillatorCount;
constexpr std::int32_t packedIntCount = unisonStackModeOffset + voiceOscillatorCount;

constexpr std::int32_t samplesPerPackedFrameSet = 12811;
constexpr std::int32_t maximumFrameCount = 256;
constexpr std::int32_t tableSlotSampleCount = samplesPerPackedFrameSet * maximumFrameCount;
constexpr std::int32_t tablePoolSampleCount = 4 * tableSlotSampleCount;
constexpr std::int32_t tableChunkCountPerSlot = 4;
constexpr std::int32_t tableChunkSampleCount
    = (tableSlotSampleCount + tableChunkCountPerSlot - 1) / tableChunkCountPerSlot;
constexpr std::int32_t tablePoolChunkCount = 4 * tableChunkCountPerSlot;
using TableChunkSlices = std::array<Slice<std::int32_t>, tablePoolChunkCount>;

std::int32_t renderAllChunks (Slice<float> packedFloats,
                              Slice<std::int32_t> packedInts,
                              const TableChunkSlices& tableChunks) noexcept;

std::int32_t renderAll (
    Slice<float> packedFloats,
    Slice<std::int32_t> packedInts,
    Slice<std::int32_t> slot0Chunk0,
    Slice<std::int32_t> slot0Chunk1,
    Slice<std::int32_t> slot0Chunk2,
    Slice<std::int32_t> slot0Chunk3,
    Slice<std::int32_t> slot1Chunk0,
    Slice<std::int32_t> slot1Chunk1,
    Slice<std::int32_t> slot1Chunk2,
    Slice<std::int32_t> slot1Chunk3,
    Slice<std::int32_t> slot2Chunk0,
    Slice<std::int32_t> slot2Chunk1,
    Slice<std::int32_t> slot2Chunk2,
    Slice<std::int32_t> slot2Chunk3,
    Slice<std::int32_t> slot3Chunk0,
    Slice<std::int32_t> slot3Chunk1,
    Slice<std::int32_t> slot3Chunk2,
    Slice<std::int32_t> slot3Chunk3) noexcept;

template <typename FloatSlice, typename IntSlice, typename... TableChunkSlice>
std::int32_t renderAllGenerated (FloatSlice packedFloats,
                                 IntSlice packedInts,
                                 TableChunkSlice... tableChunks) noexcept
{
    static_assert (sizeof... (TableChunkSlice) == tablePoolChunkCount);
    const TableChunkSlices chunkSlices {{
        { tableChunks.elements, static_cast<std::int32_t> (tableChunks.size()) }...
    }};
    return renderAllChunks (
        { packedFloats.elements, static_cast<std::int32_t> (packedFloats.size()) },
        { packedInts.elements, static_cast<std::int32_t> (packedInts.size()) },
        chunkSlices);
}
}
