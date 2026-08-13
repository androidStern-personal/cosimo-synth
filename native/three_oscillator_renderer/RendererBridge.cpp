#include "RendererBridge.h"

#include "WarpRenderer.h"

#include <array>

namespace cosimo::three_osc::bridge
{
std::int32_t renderAll (Slice<float> packedFloats,
                        Slice<std::int32_t> packedInts,
                        Slice<std::int32_t> tablePool) noexcept
{
    if (packedFloats.elements == nullptr || packedFloats.size < packedFloatCount
        || packedInts.elements == nullptr || packedInts.size < packedIntCount
        || tablePool.elements == nullptr || tablePool.size < tablePoolSampleCount)
        return 0;

    const std::array<TablePoolLayout::PackedSourceSlice, tableSlotCount> slots {{
        { tablePool.elements + (0 * tableSlotSampleCount), tableSlotSampleCount },
        { tablePool.elements + (1 * tableSlotSampleCount), tableSlotSampleCount },
        { tablePool.elements + (2 * tableSlotSampleCount), tableSlotSampleCount },
        { tablePool.elements + (3 * tableSlotSampleCount), tableSlotSampleCount }
    }};
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
}
