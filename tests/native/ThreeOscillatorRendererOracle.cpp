#include "RendererBridge.h"
#include "WarpRenderer.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>

#if ! defined(__wasm__) && ! defined(__wasm32__)
#include <cstdio>
#include <cstdlib>
#endif

// Ported from the accepted runtime-only cases in the renderer prototype's
// warp_renderer_capture.cpp. This smaller oracle freezes the production seam:
// the same test body runs as native code and SIMD Wasm, and the native path
// additionally enters through RendererBridge's packed Cmajor contract.

namespace
{
using namespace cosimo::three_osc;

constexpr float comparisonTolerance = 2.0e-6f;
constexpr std::size_t samplesPerSlot = 12811;
constexpr std::size_t captureLength = 1024;

static_assert (logicalNoteCount == 16);
static_assert (oscillatorCount == 3);
static_assert (maximumUnisonCount == 8);
static_assert (laneCount == 384);
static_assert (mipLevelCount == 11);
static_assert (tableSlotCount == 4);

static_assert (cosimo::three_osc::bridge::voiceOscillatorCount == 48);
static_assert (cosimo::three_osc::bridge::noteOutputOffset == 11776);
static_assert (cosimo::three_osc::bridge::packedFloatCount == 11808);
static_assert (cosimo::three_osc::bridge::oscillatorSlotOffset == 2080);
static_assert (cosimo::three_osc::bridge::packedIntCount == 2321);
static_assert (cosimo::three_osc::bridge::samplesPerPackedFrameSet
               == static_cast<std::int32_t> (samplesPerSlot));
static_assert (cosimo::three_osc::bridge::tableSlotSampleCount == 3279616);
static_assert (cosimo::three_osc::bridge::tablePoolSampleCount == 13118464);
static_assert (cosimo::three_osc::bridge::tableChunkSampleCount == 819904);
static_assert (cosimo::three_osc::bridge::tablePoolChunkCount == 16);

alignas (64) std::array<std::int32_t, oscillatorCount * samplesPerSlot> sourceTables {};

#if ! defined(__wasm__) && ! defined(__wasm32__)
std::size_t audioThreadAllocationCount = 0;
bool countAudioThreadAllocations = false;
#endif

float absoluteValue (float value) noexcept
{
    return value < 0.0f ? -value : value;
}

float sourceValue (std::size_t oscillator,
                   std::size_t sample,
                   std::size_t length) noexcept
{
    const auto phase = static_cast<float> (sample % length)
                     / static_cast<float> (length);
    if (oscillator == 0)
        return 0.8f * (2.0f * phase - 1.0f);
    if (oscillator == 1)
        return phase < 0.5f ? -0.7f + 2.8f * phase
                            : 2.1f - 2.8f * phase;
    return phase < 0.27f ? 0.6f : -0.6f;
}

std::size_t sourceLength (std::size_t mip) noexcept
{
    const auto harmonicLength = (std::size_t { 1 } << mip) * 32;
    if (harmonicLength < 256)
        return 256;
    return harmonicLength > wavetableSize ? wavetableSize : harmonicLength;
}

bool initialiseTables (TablePoolLayout& layout) noexcept
{
    constexpr auto valueRange = 1.5f;
    constexpr auto derivativeRange = 0.5f;
    for (std::size_t oscillator = 0; oscillator < oscillatorCount; ++oscillator)
    {
        auto offset = std::size_t { 0 };
        for (std::size_t mip = 0; mip < mipLevelCount; ++mip)
        {
            const auto length = sourceLength (mip);
            const auto metadata = oscillator * mipLevelCount + mip;
            layout.mipOffsets[metadata] = static_cast<std::int32_t> (offset);
            layout.mipLengths[metadata] = static_cast<std::int32_t> (length);
            for (std::size_t sample = 0; sample <= length; ++sample)
            {
                const auto current = sourceValue (oscillator, sample, length);
                const auto previous = sourceValue (
                    oscillator, (sample + length - 1) % length, length);
                const auto next = sourceValue (oscillator, (sample + 1) % length, length);
                sourceTables[oscillator * samplesPerSlot + offset + sample]
                    = packSourcePoint (current, 0.5f * (next - previous),
                                       valueRange, derivativeRange);
            }
            offset += length + 1;
        }
        if (offset != samplesPerSlot)
            return false;
        layout.slots[oscillator] = {
            sourceTables.data() + oscillator * samplesPerSlot,
            static_cast<std::int32_t> (samplesPerSlot),
            valueRange / static_cast<float> (sourceValueMaximum),
            derivativeRange / static_cast<float> (sourceDerivativeMaximum)
        };
        layout.frameCounts[oscillator] = 1;
        layout.oscillatorSlots[oscillator] = static_cast<std::int32_t> (oscillator);
    }
    return true;
}

void initialiseControls (WarpRendererControls& controls) noexcept
{
    controls.oversampleFactor = maximumWarpOversampleFactor;
    controls.use441Filter = 0;
    controls.phaseIncrements.fill (0.0f);
    controls.positions.fill (0.0f);
    controls.warpAmounts.fill (0.0f);
    controls.leftGains.fill (0.0f);
    controls.rightGains.fill (0.0f);
    controls.warpModes.fill (static_cast<std::int32_t> (WarpMode::off));

    constexpr std::array<WarpMode, oscillatorCount> modes {
        WarpMode::bend, WarpMode::pwm, WarpMode::asym
    };
    for (std::size_t oscillator = 0; oscillator < oscillatorCount; ++oscillator)
    {
        const auto lane = oscillator * maximumUnisonCount + 1;
        controls.phaseIncrements[lane] = 0.0037f + 0.0011f * static_cast<float> (oscillator);
        controls.positions[lane] = 0.2f + 0.25f * static_cast<float> (oscillator);
        controls.warpAmounts[lane] = 0.2f + 0.3f * static_cast<float> (oscillator);
        controls.leftGains[lane] = 0.31f - 0.04f * static_cast<float> (oscillator);
        controls.rightGains[lane] = 0.23f + 0.03f * static_cast<float> (oscillator);
        controls.warpModes[oscillator] = static_cast<std::int32_t> (modes[oscillator]);
    }
}

void updateControls (WarpRendererControls& controls, std::size_t sample) noexcept
{
    constexpr std::array<WarpMode, 5> modes {
        WarpMode::off, WarpMode::bend, WarpMode::pwm, WarpMode::asym, WarpMode::mirror
    };
    const auto sweep = static_cast<float> (sample % 97) / 96.0f;
    for (std::size_t oscillator = 0; oscillator < oscillatorCount; ++oscillator)
    {
        const auto lane = oscillator * maximumUnisonCount + 1;
        auto position = sweep + 0.19f * static_cast<float> (oscillator);
        if (position > 1.0f)
            position -= 1.0f;
        controls.positions[lane] = position;
        controls.warpAmounts[lane] = oscillator == 1
            ? 0.08f + 0.78f * (1.0f - sweep)
            : 0.12f + 0.76f * sweep;
        controls.warpModes[oscillator] = static_cast<std::int32_t> (
            modes[(sample / 173 + oscillator) % modes.size()]);
    }
}

bool closeEnough (StereoSample left, StereoSample right) noexcept
{
    return absoluteValue (left.left - right.left) <= comparisonTolerance
        && absoluteValue (left.right - right.right) <= comparisonTolerance;
}

std::int32_t runRuntimeOracle() noexcept
{
    TablePoolLayout tables;
    if (! initialiseTables (tables))
        return -1;

    WarpRendererControls controls;
    initialiseControls (controls);
    WarpRendererState runtimeState;
    WarpRendererState explicitEmptyAtlasState;
    WarpRendererState batchedState;
    WarpRendererState repeatedState;
    resetWarpRenderer (runtimeState, 0.125f);
    resetWarpRenderer (explicitEmptyAtlasState, 0.125f);
    resetWarpRenderer (batchedState, 0.125f);
    resetWarpRenderer (repeatedState, 0.125f);

    double weightedEnergy = 0.0;
    for (std::size_t sample = 0; sample < captureLength; ++sample)
    {
        updateControls (controls, sample);
        const auto runtime = renderWarpedNote (runtimeState, controls, tables, 0);
        const auto explicitEmptyAtlas = renderWarpedNote (
            explicitEmptyAtlasState, controls, tables, PackedWarpAtlasView {}, 0);
        const auto repeated = renderWarpedNote (repeatedState, controls, tables, 0);

        std::array<StereoSample, logicalNoteCount> batchedOutputs;
        renderWarpedNotes (view (batchedState), view (controls), view (tables), {}, nullptr,
                           { nullptr, nullptr, nullptr, nullptr }, batchedOutputs);
        if (! closeEnough (runtime, explicitEmptyAtlas)
            || ! closeEnough (runtime, repeated)
            || ! closeEnough (runtime, batchedOutputs[0])
            || ! std::isfinite (runtime.left) || ! std::isfinite (runtime.right))
            return -2;

        const auto weight = static_cast<double> (1 + sample % 7);
        weightedEnergy += weight * (absoluteValue (runtime.left)
                                  + 0.75 * absoluteValue (runtime.right));
    }

    for (std::size_t lane = 0; lane < lanesPerNote; ++lane)
    {
        if (absoluteValue (runtimeState.phases[lane]
                           - explicitEmptyAtlasState.phases[lane]) > comparisonTolerance
            || absoluteValue (runtimeState.phases[lane]
                              - batchedState.phases[lane]) > comparisonTolerance
            || absoluteValue (runtimeState.phases[lane]
                              - repeatedState.phases[lane]) > comparisonTolerance)
            return -3;
    }

    if (! std::isfinite (weightedEnergy) || weightedEnergy < 1.0)
        return -4;
    return static_cast<std::int32_t> (weightedEnergy * 1000.0 + 0.5);
}

std::int32_t runDynamicDetuneOracle (std::int32_t detuneMilli) noexcept
{
    if (detuneMilli <= 0 || detuneMilli > 1000)
        return -20;

    std::array<float, logicalNoteCount * oscillatorCount> basePhaseIncrements {};
    std::array<float, logicalNoteCount * oscillatorCount> positions {};
    std::array<float, logicalNoteCount * oscillatorCount> warpAmounts {};
    std::array<float, logicalNoteCount * oscillatorCount> pans {};
    std::array<float, logicalNoteCount * oscillatorCount> gains {};
    std::array<float, logicalNoteCount * oscillatorCount> detunes {};
    std::array<float, logicalNoteCount * oscillatorCount> blends {};
    std::array<float, logicalNoteCount * oscillatorCount> widths {};
    std::array<float, logicalNoteCount * oscillatorCount> positionSpreads {};
    std::array<float, logicalNoteCount * oscillatorCount> warpSpreads {};
    std::array<std::int32_t, logicalNoteCount * oscillatorCount> unisonVoices {};
    std::array<std::int32_t, logicalNoteCount * oscillatorCount> detuneModes {};
    std::array<std::int32_t, logicalNoteCount * oscillatorCount> stackModes {};
    std::array<float, laneCount> phaseIncrements {};
    std::array<float, laneCount> expandedPositions {};
    std::array<float, laneCount> expandedWarpAmounts {};
    std::array<float, laneCount> leftGains {};
    std::array<float, laneCount> rightGains {};

    constexpr auto baseIncrement = 0.01f;
    basePhaseIncrements[0] = baseIncrement;
    gains[0] = 1.0f;
    detunes[0] = static_cast<float> (detuneMilli) * 0.001f;
    blends[0] = 1.0f;
    unisonVoices[0] = 3;

    expandVoiceOscillatorControls (
        { basePhaseIncrements.data(), positions.data(), warpAmounts.data(), pans.data(),
          gains.data(), detunes.data(), blends.data(), widths.data(),
          positionSpreads.data(), warpSpreads.data(), unisonVoices.data(),
          detuneModes.data(), stackModes.data() },
        { phaseIncrements.data(), expandedPositions.data(), expandedWarpAmounts.data(),
          leftGains.data(), rightGains.data() });

    const auto detuneSemitones = detunes[0] * 0.5f;
    const auto expectedLow = baseIncrement * std::exp2 (-detuneSemitones / 12.0f);
    const auto expectedHigh = baseIncrement * std::exp2 (detuneSemitones / 12.0f);
    if (!(phaseIncrements[0] < phaseIncrements[1]
          && phaseIncrements[1] < phaseIncrements[2])
        || absoluteValue (phaseIncrements[0] - expectedLow) > 2.0e-7f
        || absoluteValue (phaseIncrements[1] - baseIncrement) > 2.0e-7f
        || absoluteValue (phaseIncrements[2] - expectedHigh) > 2.0e-7f
        || phaseIncrements[3] != 0.0f)
        return -21;

    // Cover the full supported unison stack domain, including the small
    // non-constant detune values that exposed xsimd's Wasm defect.
    unisonVoices[0] = static_cast<std::int32_t> (maximumUnisonCount);
    for (std::int32_t stackMode = 0; stackMode <= 4; ++stackMode)
    {
        stackModes[0] = stackMode;
        expandVoiceOscillatorControls (
            { basePhaseIncrements.data(), positions.data(), warpAmounts.data(),
              pans.data(), gains.data(), detunes.data(), blends.data(), widths.data(),
              positionSpreads.data(), warpSpreads.data(), unisonVoices.data(),
              detuneModes.data(), stackModes.data() },
            { phaseIncrements.data(), expandedPositions.data(),
              expandedWarpAmounts.data(), leftGains.data(), rightGains.data() });

        for (std::size_t lane = 0; lane < maximumUnisonCount; ++lane)
        {
            const auto normalized = static_cast<float> (lane)
                / static_cast<float> (maximumUnisonCount - 1) * 2.0f - 1.0f;
            const auto centerOffset = static_cast<float> (lane)
                - static_cast<float> (maximumUnisonCount - 1) * 0.5f;
            float stackSemitones = 0.0f;
            if (stackMode == 1)
                stackSemitones = static_cast<float> (lane) * 12.0f;
            else if (stackMode == 2)
                stackSemitones = static_cast<float> (lane / 2) * 12.0f
                    + ((lane & 1U) != 0U ? 7.0f : 0.0f);
            else if (stackMode == 3)
                stackSemitones = centerOffset * 12.0f;
            else if (stackMode == 4)
                stackSemitones = centerOffset * 24.0f;

            const auto pitchSemitones = normalized * detunes[0] * 0.5f
                + stackSemitones;
            const auto expected = baseIncrement
                * std::exp2 (pitchSemitones / 12.0f);
            const auto tolerance = std::max (2.0e-8f, expected * 2.0e-6f);
            if (absoluteValue (phaseIncrements[lane] - expected) > tolerance)
                return -22;
        }
    }

    return 4242;
}

#if ! defined(__wasm__) && ! defined(__wasm32__)
alignas (64) std::array<
    std::array<std::int32_t, cosimo::three_osc::bridge::tableChunkSampleCount>,
    cosimo::three_osc::bridge::tablePoolChunkCount> bridgeTableChunks {};

cosimo::three_osc::bridge::TableChunkSlices bridgeTableChunkSlices() noexcept
{
    cosimo::three_osc::bridge::TableChunkSlices slices {};
    for (std::size_t chunk = 0; chunk < slices.size(); ++chunk)
        slices[chunk] = {
            bridgeTableChunks[chunk].data(),
            cosimo::three_osc::bridge::tableChunkSampleCount
        };
    return slices;
}

std::int32_t renderThroughExternalAbi (
    cosimo::three_osc::bridge::Slice<float> packedFloats,
    cosimo::three_osc::bridge::Slice<std::int32_t> packedInts,
    const cosimo::three_osc::bridge::TableChunkSlices& chunks) noexcept
{
    return cosimo::three_osc::bridge::renderAll (
        packedFloats, packedInts,
        chunks[0], chunks[1], chunks[2], chunks[3],
        chunks[4], chunks[5], chunks[6], chunks[7],
        chunks[8], chunks[9], chunks[10], chunks[11],
        chunks[12], chunks[13], chunks[14], chunks[15]);
}

template <typename Element>
struct GeneratedSliceProbe
{
    Element* elements = nullptr;
    std::size_t count = 0;

    std::size_t size() const noexcept { return count; }
};

std::int32_t renderThroughGeneratedAbi (
    cosimo::three_osc::bridge::Slice<float> packedFloats,
    cosimo::three_osc::bridge::Slice<std::int32_t> packedInts,
    const cosimo::three_osc::bridge::TableChunkSlices& chunks) noexcept
{
    using cosimo::three_osc::bridge::renderAllGenerated;
    std::array<GeneratedSliceProbe<std::int32_t>,
               cosimo::three_osc::bridge::tablePoolChunkCount> generatedChunks {};
    for (std::size_t chunk = 0; chunk < generatedChunks.size(); ++chunk)
        generatedChunks[chunk] = {
            chunks[chunk].elements, static_cast<std::size_t> (chunks[chunk].size)
        };

    return renderAllGenerated (
        GeneratedSliceProbe<float> {
            packedFloats.elements, static_cast<std::size_t> (packedFloats.size) },
        GeneratedSliceProbe<std::int32_t> {
            packedInts.elements, static_cast<std::size_t> (packedInts.size) },
        generatedChunks[0], generatedChunks[1], generatedChunks[2], generatedChunks[3],
        generatedChunks[4], generatedChunks[5], generatedChunks[6], generatedChunks[7],
        generatedChunks[8], generatedChunks[9], generatedChunks[10], generatedChunks[11],
        generatedChunks[12], generatedChunks[13], generatedChunks[14], generatedChunks[15]);
}

void writeBridgeTablePoint (std::size_t slot,
                            std::size_t virtualIndex,
                            std::int32_t packedPoint) noexcept
{
    using namespace cosimo::three_osc::bridge;
    const auto chunkWithinSlot = virtualIndex / static_cast<std::size_t> (tableChunkSampleCount);
    const auto indexWithinChunk = virtualIndex % static_cast<std::size_t> (tableChunkSampleCount);
    bridgeTableChunks[slot * static_cast<std::size_t> (tableChunkCountPerSlot)
                      + chunkWithinSlot][indexWithinChunk] = packedPoint;
}

bool runChunkBoundaryOracle (
    const cosimo::three_osc::bridge::TableChunkSlices& chunks) noexcept
{
    using namespace cosimo::three_osc::bridge;
    constexpr auto normalBase = std::int32_t { 128 };
    constexpr auto boundaryBase = tableChunkSampleCount - 1;
    const auto point0 = packSourcePoint (-0.65f, 0.0f);
    const auto point1 = packSourcePoint (0.65f, 0.0f);
    writeBridgeTablePoint (0, normalBase, point0);
    writeBridgeTablePoint (0, normalBase + 1, point1);
    writeBridgeTablePoint (0, boundaryBase, point0);
    writeBridgeTablePoint (0, boundaryBase + 1, point1);

    std::array<float, packedFloatCount> normalFloats {};
    std::array<float, packedFloatCount> boundaryFloats {};
    std::array<std::int32_t, packedIntCount> normalInts {};
    std::array<std::int32_t, packedIntCount> boundaryInts {};
    for (std::size_t index = 0; index < warpFamilyBatchCount; ++index)
        normalInts[atlasFamilyTargetOffset + index] = -1;
    for (std::size_t lane = 0; lane < laneCount; ++lane)
        normalInts[cachedAtlasModeOffset + lane] = -1;
    for (std::size_t oscillator = 0; oscillator < oscillatorCount; ++oscillator)
    {
        normalInts[oscillatorSlotOffset + oscillator] = 0;
        normalInts[unisonVoicesOffset + oscillator] = 1;
    }
    normalInts[frameCountOffset] = 1;
    normalInts[oversampleFactorOffset] = 1;
    for (std::size_t mip = 0; mip < mipLevelCount; ++mip)
    {
        normalInts[mipOffsetOffset + mip] = normalBase;
        normalInts[mipLengthOffset + mip] = 1;
    }
    normalFloats[basePhaseIncrementOffset] = 0.0025f;
    normalFloats[oscillatorGainOffset] = 0.5f;
    boundaryFloats = normalFloats;
    boundaryInts = normalInts;
    for (std::size_t mip = 0; mip < mipLevelCount; ++mip)
        boundaryInts[mipOffsetOffset + mip] = boundaryBase;

    double energy = 0.0;
    for (std::size_t sample = 0; sample < 256; ++sample)
    {
        if (renderAllChunks ({ normalFloats.data(), packedFloatCount },
                             { normalInts.data(), packedIntCount }, chunks) != 1
            || renderAllChunks ({ boundaryFloats.data(), packedFloatCount },
                                { boundaryInts.data(), packedIntCount }, chunks) != 1)
            return false;

        for (std::size_t output = 0; output < logicalNoteCount * 2; ++output)
        {
            const auto normal = normalFloats[noteOutputOffset + output];
            const auto boundary = boundaryFloats[noteOutputOffset + output];
            if (! std::isfinite (normal) || ! std::isfinite (boundary)
                || absoluteValue (normal - boundary) > comparisonTolerance)
                return false;
            energy += absoluteValue (boundary);
        }
    }
    return energy > 1.0;
}

bool runBridgeOracle() noexcept
{
    using namespace cosimo::three_osc::bridge;

    TablePoolLayout tables;
    if (! initialiseTables (tables))
        return false;
    for (std::size_t oscillator = 0; oscillator < oscillatorCount; ++oscillator)
        for (std::size_t sample = 0; sample < samplesPerSlot; ++sample)
            writeBridgeTablePoint (
                oscillator, sample, sourceTables[oscillator * samplesPerSlot + sample]);

    const auto tableChunks = bridgeTableChunkSlices();
    if (! runChunkBoundaryOracle (tableChunks))
        return false;

    std::array<float, packedFloatCount> packedFloatsA {};
    std::array<float, packedFloatCount> packedFloatsB {};
    std::array<std::int32_t, packedIntCount> packedIntsA {};
    std::array<std::int32_t, packedIntCount> packedIntsB {};

    for (std::size_t index = 0; index < warpFamilyBatchCount; ++index)
        packedIntsA[atlasFamilyTargetOffset + index] = -1;
    for (std::size_t lane = 0; lane < laneCount; ++lane)
        packedIntsA[cachedAtlasModeOffset + lane] = -1;

    constexpr std::array<WarpMode, oscillatorCount> modes {
        WarpMode::bend, WarpMode::pwm, WarpMode::asym
    };
    for (std::size_t oscillator = 0; oscillator < oscillatorCount; ++oscillator)
    {
        packedIntsA[oscillatorSlotOffset + oscillator]
            = static_cast<std::int32_t> (oscillator);
        packedIntsA[frameCountOffset + oscillator] = 1;
        for (std::size_t mip = 0; mip < mipLevelCount; ++mip)
        {
            const auto metadata = oscillator * mipLevelCount + mip;
            packedIntsA[mipOffsetOffset + metadata] = tables.mipOffsets[metadata];
            packedIntsA[mipLengthOffset + metadata] = tables.mipLengths[metadata];
        }

        const auto voiceOscillator = oscillator;
        packedFloatsA[basePhaseIncrementOffset + voiceOscillator]
            = 0.0037f + 0.0011f * static_cast<float> (oscillator);
        packedFloatsA[basePositionOffset + voiceOscillator]
            = 0.2f + 0.25f * static_cast<float> (oscillator);
        packedFloatsA[baseWarpAmountOffset + voiceOscillator]
            = 0.2f + 0.3f * static_cast<float> (oscillator);
        packedFloatsA[basePanOffset + voiceOscillator]
            = -0.25f + 0.25f * static_cast<float> (oscillator);
        packedFloatsA[oscillatorGainOffset + voiceOscillator] = 0.3f;
        packedIntsA[unisonVoicesOffset + voiceOscillator] = 1;
        packedIntsA[warpModeOffset + voiceOscillator]
            = static_cast<std::int32_t> (modes[oscillator]);
    }
    packedIntsA[oversampleFactorOffset] = maximumWarpOversampleFactor;
    packedIntsA[use441FilterOffset] = 0;
    packedFloatsB = packedFloatsA;
    packedIntsB = packedIntsA;

    auto nullChunks = tableChunks;
    nullChunks[5].elements = nullptr;
    auto undersizedChunks = tableChunks;
    undersizedChunks[9].size = tableChunkSampleCount - 1;
    if (renderAllChunks ({ nullptr, 0 }, { packedIntsA.data(), packedIntCount },
                         tableChunks) != 0
        || renderAllChunks ({ packedFloatsA.data(), packedFloatCount },
                            { packedIntsA.data(), packedIntCount }, nullChunks) != 0
        || renderAllChunks ({ packedFloatsA.data(), packedFloatCount },
                            { packedIntsA.data(), packedIntCount }, undersizedChunks) != 0)
        return false;

    double outputEnergy = 0.0;
    audioThreadAllocationCount = 0;
    countAudioThreadAllocations = true;
    for (std::size_t sample = 0; sample < captureLength; ++sample)
    {
        const auto sweep = static_cast<float> (sample % 97) / 96.0f;
        for (std::size_t oscillator = 0; oscillator < oscillatorCount; ++oscillator)
        {
            auto position = sweep + 0.19f * static_cast<float> (oscillator);
            if (position > 1.0f)
                position -= 1.0f;
            packedFloatsA[basePositionOffset + oscillator] = position;
            packedFloatsB[basePositionOffset + oscillator] = position;
        }
        if (renderThroughExternalAbi ({ packedFloatsA.data(), packedFloatCount },
                                      { packedIntsA.data(), packedIntCount }, tableChunks) != 1
            || renderThroughGeneratedAbi ({ packedFloatsB.data(), packedFloatCount },
                                          { packedIntsB.data(), packedIntCount }, tableChunks) != 1)
        {
            countAudioThreadAllocations = false;
            return false;
        }
        for (std::size_t note = 0; note < logicalNoteCount * 2; ++note)
        {
            const auto outputA = packedFloatsA[noteOutputOffset + note];
            const auto outputB = packedFloatsB[noteOutputOffset + note];
            if (absoluteValue (outputA - outputB) > comparisonTolerance
                || ! std::isfinite (outputA))
            {
                countAudioThreadAllocations = false;
                return false;
            }
            outputEnergy += absoluteValue (outputA);
        }
    }
    countAudioThreadAllocations = false;
    if (audioThreadAllocationCount != 0)
        return false;

    for (std::size_t index = 0; index < packedFloatsA.size(); ++index)
        if (absoluteValue (packedFloatsA[index] - packedFloatsB[index])
            > comparisonTolerance)
            return false;
    for (std::size_t index = 0; index < packedIntsA.size(); ++index)
        if (packedIntsA[index] != packedIntsB[index])
            return false;
    return outputEnergy > 1.0;
}
#endif
}

extern "C" std::int32_t three_osc_renderer_oracle() noexcept
{
    return runRuntimeOracle();
}

extern "C" std::int32_t three_osc_dynamic_detune_oracle (
    std::int32_t detuneMilli) noexcept
{
    return runDynamicDetuneOracle (detuneMilli);
}

#if ! defined(__wasm__) && ! defined(__wasm32__)
#include <new>

void* operator new (std::size_t size)
{
    if (countAudioThreadAllocations)
        ++audioThreadAllocationCount;
    if (auto* memory = std::malloc (size))
        return memory;
    throw std::bad_alloc {};
}

void operator delete (void* memory) noexcept
{
    std::free (memory);
}

void operator delete (void* memory, std::size_t) noexcept
{
    std::free (memory);
}

int main()
{
    const auto fingerprint = three_osc_renderer_oracle();
    if (fingerprint <= 0 || three_osc_dynamic_detune_oracle (250) != 4242
        || ! runBridgeOracle())
        return 1;
    std::printf ("%d\n", fingerprint);
    return 0;
}
#endif
