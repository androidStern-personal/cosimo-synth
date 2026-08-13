#include "RendererBridge.h"
#include "WarpRenderer.h"

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
        const auto lane = oscillator * maximumUnisonCount;
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
        const auto lane = oscillator * maximumUnisonCount;
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

#if ! defined(__wasm__) && ! defined(__wasm32__)
alignas (64) std::array<std::int32_t,
                        cosimo::three_osc::bridge::tablePoolSampleCount> bridgeTablePool {};

bool runBridgeOracle() noexcept
{
    using namespace cosimo::three_osc::bridge;

    TablePoolLayout tables;
    if (! initialiseTables (tables))
        return false;
    for (std::size_t oscillator = 0; oscillator < oscillatorCount; ++oscillator)
        for (std::size_t sample = 0; sample < samplesPerSlot; ++sample)
            bridgeTablePool[oscillator * static_cast<std::size_t> (tableSlotSampleCount)
                            + sample]
                = sourceTables[oscillator * samplesPerSlot + sample];

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

    if (renderAll ({ nullptr, 0 }, { packedIntsA.data(), packedIntCount },
                   { bridgeTablePool.data(), tablePoolSampleCount }) != 0
        || renderAll ({ packedFloatsA.data(), packedFloatCount },
                      { packedIntsA.data(), packedIntCount },
                      { bridgeTablePool.data(), tablePoolSampleCount - 1 }) != 0)
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
        if (renderAll ({ packedFloatsA.data(), packedFloatCount },
                       { packedIntsA.data(), packedIntCount },
                       { bridgeTablePool.data(), tablePoolSampleCount }) != 1
            || renderAll ({ packedFloatsB.data(), packedFloatCount },
                          { packedIntsB.data(), packedIntCount },
                          { bridgeTablePool.data(), tablePoolSampleCount }) != 1)
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
    if (fingerprint <= 0 || ! runBridgeOracle())
        return 1;
    std::printf ("%d\n", fingerprint);
    return 0;
}
#endif
