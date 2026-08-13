#include "RendererBridge.h"

#include "WarpRenderer.h"

#include <array>

namespace cosimo::three_osc::bridge
{
static_assert (tableChunkCountPerSlot == static_cast<std::int32_t> (tableSlotChunkCount));

std::int32_t renderAllChunks (Slice<float> packedFloats,
                              Slice<std::int32_t> packedInts,
                              const TableChunkSlices& tableChunks) noexcept
{
    if (packedFloats.elements == nullptr || packedFloats.size < packedFloatCount
        || packedInts.elements == nullptr || packedInts.size < packedIntCount)
        return 0;

    std::array<TablePoolLayout::PackedSourceSlice, tableSlotCount> slots {};
    for (std::size_t slot = 0; slot < tableSlotCount; ++slot)
    {
        auto& source = slots[slot];
        source.size = tableSlotSampleCount;
        source.chunkSampleCount = tableChunkSampleCount;
        for (std::size_t chunk = 0; chunk < tableSlotChunkCount; ++chunk)
        {
            const auto& chunkSlice = tableChunks[slot * tableSlotChunkCount + chunk];
            if (chunkSlice.elements == nullptr || chunkSlice.size < tableChunkSampleCount)
                return 0;

            source.chunkSamples[chunk] = chunkSlice.elements;
            source.chunkSizes[chunk] = chunkSlice.size;
        }
    }
    const WarpRendererStateView state {
        packedFloats.elements + phaseOffset,
        packedFloats.elements + historyOffset,
        packedFloats.elements + atlasFamilyMixOffset,
        packedFloats.elements + cachedAtlasPhaseIncrementOffset,
        packedFloats.elements + cachedAtlasWarpAmountOffset,
        packedFloats.elements + atlasAmountWeight0Offset,
        packedFloats.elements + atlasAmountWeight1Offset,
        packedFloats.elements + atlasAmountWeight2Offset,
        packedInts.elements + writeIndexOffset,
        packedInts.elements + atlasFamilyTargetOffset,
        packedInts.elements + cachedAtlasModeOffset,
        packedInts.elements + atlasLengthOffset,
        packedInts.elements + atlasAmountBase0Offset,
        packedInts.elements + atlasAmountBase1Offset,
        packedInts.elements + atlasAmountBase2Offset
    };
    const VoiceOscillatorControlsView voiceOscillatorControls {
        packedFloats.elements + basePhaseIncrementOffset,
        packedFloats.elements + basePositionOffset,
        packedFloats.elements + baseWarpAmountOffset,
        packedFloats.elements + basePanOffset,
        packedFloats.elements + oscillatorGainOffset,
        packedFloats.elements + unisonDetuneOffset,
        packedFloats.elements + unisonBlendOffset,
        packedFloats.elements + unisonWidthOffset,
        packedFloats.elements + positionSpreadOffset,
        packedFloats.elements + warpSpreadOffset,
        packedInts.elements + unisonVoicesOffset,
        packedInts.elements + unisonDetuneModeOffset,
        packedInts.elements + unisonStackModeOffset
    };
    const WarpRendererControlsWorkspaceView controlsWorkspace {
        packedFloats.elements + phaseIncrementOffset,
        packedFloats.elements + positionOffset,
        packedFloats.elements + warpAmountOffset,
        packedFloats.elements + leftGainOffset,
        packedFloats.elements + rightGainOffset
    };
    expandVoiceOscillatorControls (voiceOscillatorControls, controlsWorkspace);
    const WarpRendererControlsView controls {
        packedFloats.elements + phaseIncrementOffset,
        packedFloats.elements + positionOffset,
        packedFloats.elements + warpAmountOffset,
        packedFloats.elements + leftGainOffset,
        packedFloats.elements + rightGainOffset,
        packedInts.elements + warpModeOffset,
        packedInts.elements[oversampleFactorOffset],
        packedInts.elements[use441FilterOffset]
    };
    const TablePoolView tables {
        slots.data(),
        packedInts.elements + mipOffsetOffset,
        packedInts.elements + mipLengthOffset,
        packedInts.elements + frameCountOffset,
        packedInts.elements + oscillatorSlotOffset
    };

    std::array<StereoSample, logicalNoteCount> noteOutputs;
    renderWarpedNotes (state, controls, tables, {}, nullptr,
                       { nullptr, nullptr, nullptr, nullptr }, noteOutputs);
    for (std::size_t note = 0; note < logicalNoteCount; ++note)
    {
        packedFloats.elements[noteOutputOffset + static_cast<std::int32_t> (2 * note)]
            = noteOutputs[note].left;
        packedFloats.elements[noteOutputOffset + static_cast<std::int32_t> (2 * note) + 1]
            = noteOutputs[note].right;
    }

    return 1;
}

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
    Slice<std::int32_t> slot3Chunk3) noexcept
{
    return renderAllChunks (packedFloats, packedInts, {{
        slot0Chunk0, slot0Chunk1, slot0Chunk2, slot0Chunk3,
        slot1Chunk0, slot1Chunk1, slot1Chunk2, slot1Chunk3,
        slot2Chunk0, slot2Chunk1, slot2Chunk2, slot2Chunk3,
        slot3Chunk0, slot3Chunk1, slot3Chunk2, slot3Chunk3
    }});
}
}
