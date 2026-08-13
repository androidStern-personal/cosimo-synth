#pragma once

#include "Renderer.h"

#include <array>
#include <cstddef>
#include <cstdint>

namespace cosimo::three_osc
{
constexpr std::int32_t maximumWarpOversampleFactor = 2;
constexpr std::size_t secondHalfbandLength = 79;
constexpr std::size_t tableSlotCount = 4;
constexpr std::size_t tableSlotChunkCount = 4;
constexpr std::size_t warpFamilyBatchWidth = 4;
constexpr std::size_t warpFamilyBatchCount = laneCount / warpFamilyBatchWidth;
constexpr std::int32_t sourceValueBits = 18;
constexpr std::int32_t sourceDerivativeBits = 32 - sourceValueBits;
constexpr std::int32_t sourceValueMaximum = (1 << (sourceValueBits - 1)) - 1;
constexpr std::int32_t sourceDerivativeMaximum = (1 << (sourceDerivativeBits - 1)) - 1;

enum class WarpMode : std::int32_t
{
    off = 0,
    bend = 1,
    pwm = 2,
    asym = 3,
    mirror = 4
};

struct TablePoolLayout
{
    struct PackedSourceSlice
    {
        const std::int32_t* samples = nullptr;
        std::int32_t size = 0;
        float valueScale = 1.5f / static_cast<float> (sourceValueMaximum);
        float derivativeScale = 0.5f / static_cast<float> (sourceDerivativeMaximum);
        std::array<const std::int32_t*, tableSlotChunkCount> chunkSamples {};
        std::array<std::int32_t, tableSlotChunkCount> chunkSizes {};
        std::int32_t chunkSampleCount = 0;
    };

    std::array<PackedSourceSlice, tableSlotCount> slots {};
    std::array<std::int32_t, tableSlotCount * mipLevelCount> mipOffsets {};
    std::array<std::int32_t, tableSlotCount * mipLevelCount> mipLengths {};
    std::array<std::int32_t, tableSlotCount> frameCounts {};
    std::array<std::int32_t, oscillatorCount> oscillatorSlots {};
};

struct WarpRendererStateView
{
    float* phases = nullptr;
    float* secondHistory = nullptr;
    float* atlasFamilyMix = nullptr;
    float* cachedAtlasPhaseIncrements = nullptr;
    float* cachedAtlasWarpAmounts = nullptr;
    float* atlasAmountWeights0 = nullptr;
    float* atlasAmountWeights1 = nullptr;
    float* atlasAmountWeights2 = nullptr;
    std::int32_t* secondWriteIndices = nullptr;
    std::int32_t* atlasFamilyTargets = nullptr;
    std::int32_t* cachedAtlasModes = nullptr;
    std::int32_t* atlasLengths = nullptr;
    std::int32_t* atlasAmountBases0 = nullptr;
    std::int32_t* atlasAmountBases1 = nullptr;
    std::int32_t* atlasAmountBases2 = nullptr;
};

struct WarpRendererControlsView
{
    const float* phaseIncrements = nullptr;
    const float* positions = nullptr;
    const float* warpAmounts = nullptr;
    const float* leftGains = nullptr;
    const float* rightGains = nullptr;
    const std::int32_t* warpModes = nullptr;
    std::int32_t oversampleFactor = maximumWarpOversampleFactor;
    std::int32_t use441Filter = 0;
};

// Cmajor writes one audio-rate control set per note/oscillator. The native
// renderer expands those 48 sets into the 384 lane workspace in SIMD batches,
// keeping unison math out of Cmajor's scalar per-lane loop.
struct VoiceOscillatorControlsView
{
    const float* basePhaseIncrements = nullptr;
    const float* positions = nullptr;
    const float* warpAmounts = nullptr;
    const float* pans = nullptr;
    const float* gains = nullptr;
    const float* detunes = nullptr;
    const float* blends = nullptr;
    const float* widths = nullptr;
    const float* positionSpreads = nullptr;
    const float* warpSpreads = nullptr;
    const std::int32_t* unisonVoices = nullptr;
    const std::int32_t* detuneModes = nullptr;
    const std::int32_t* stackModes = nullptr;
};

struct WarpRendererControlsWorkspaceView
{
    float* phaseIncrements = nullptr;
    float* positions = nullptr;
    float* warpAmounts = nullptr;
    float* leftGains = nullptr;
    float* rightGains = nullptr;
};

struct TablePoolView
{
    const TablePoolLayout::PackedSourceSlice* slots = nullptr;
    const std::int32_t* mipOffsets = nullptr;
    const std::int32_t* mipLengths = nullptr;
    const std::int32_t* frameCounts = nullptr;
    const std::int32_t* oscillatorSlots = nullptr;
};

// Source tables store a sample and its Catmull-Rom tangent in one 32-bit word.
// Packing happens off the audio thread; the renderer reconstructs the exact
// cubic form with two reads instead of four reads per frame.
std::int32_t packSourcePoint (float value,
                              float derivative,
                              float valueRange = 1.5f,
                              float derivativeRange = 0.5f) noexcept;

struct PackedWarpAtlasView
{
    const std::int32_t* samples = nullptr;
    std::int32_t packedSampleCount = 0;
};

struct alignas (64) WarpRendererState
{
    std::array<float, laneCount> phases {};
    std::array<float, logicalNoteCount * 4 * secondHalfbandLength> secondHistory {};
    std::array<float, warpFamilyBatchCount> atlasFamilyMix {};
    std::array<float, laneCount> cachedAtlasPhaseIncrements {};
    std::array<float, laneCount> cachedAtlasWarpAmounts {};
    std::array<float, laneCount> atlasAmountWeights0 {};
    std::array<float, laneCount> atlasAmountWeights1 {};
    std::array<float, laneCount> atlasAmountWeights2 {};
    std::array<std::int32_t, logicalNoteCount> secondWriteIndices {};
    std::array<std::int32_t, warpFamilyBatchCount> atlasFamilyTargets {};
    std::array<std::int32_t, laneCount> cachedAtlasModes {};
    std::array<std::int32_t, laneCount> atlasLengths {};
    std::array<std::int32_t, laneCount> atlasAmountBases0 {};
    std::array<std::int32_t, laneCount> atlasAmountBases1 {};
    std::array<std::int32_t, laneCount> atlasAmountBases2 {};
};

struct alignas (64) WarpRendererControls
{
    std::array<float, laneCount> phaseIncrements {};
    std::array<float, laneCount> positions {};
    std::array<float, laneCount> warpAmounts {};
    std::array<float, laneCount> leftGains {};
    std::array<float, laneCount> rightGains {};
    std::array<std::int32_t, logicalNoteCount * oscillatorCount> warpModes {};
    std::int32_t oversampleFactor = maximumWarpOversampleFactor;
    std::int32_t use441Filter = 0;
    std::array<float, laneCount> atlasDc {};
    std::array<std::array<float, laneCount>, 4> atlasBasisWeights {};
};

void resetWarpRenderer (WarpRendererState& state, float phase = 0.0f) noexcept;

WarpRendererStateView view (WarpRendererState& state) noexcept;
WarpRendererControlsView view (const WarpRendererControls& controls) noexcept;
TablePoolView view (const TablePoolLayout& tables) noexcept;

void expandVoiceOscillatorControls (VoiceOscillatorControlsView controls,
                                    WarpRendererControlsWorkspaceView workspace) noexcept;

StereoSample renderWarpedNote (WarpRendererStateView state,
                               WarpRendererControlsView controls,
                               TablePoolView tables,
                               std::size_t noteIndex) noexcept;

StereoSample renderWarpedNote (WarpRendererStateView state,
                               WarpRendererControlsView controls,
                               TablePoolView tables,
                               PackedWarpAtlasView atlas,
                               const float* atlasDc,
                               const std::array<const float*, 4>& atlasBasisWeights,
                               std::size_t noteIndex) noexcept;

void renderWarpedNotes (WarpRendererStateView state,
                        WarpRendererControlsView controls,
                        TablePoolView tables,
                        PackedWarpAtlasView atlas,
                        const float* atlasDc,
                        const std::array<const float*, 4>& atlasBasisWeights,
                        std::array<StereoSample, logicalNoteCount>& outputs) noexcept;

StereoSample renderWarpedNote (WarpRendererState& state,
                               const WarpRendererControls& controls,
                               const TablePoolLayout& tables,
                               std::size_t noteIndex) noexcept;

StereoSample renderWarpedNote (WarpRendererState& state,
                               const WarpRendererControls& controls,
                               const TablePoolLayout& tables,
                               PackedWarpAtlasView atlas,
                               std::size_t noteIndex) noexcept;
}
