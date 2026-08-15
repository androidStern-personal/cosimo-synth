#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>

#include "../../native/three_oscillator_renderer/RendererBridge.h"

// This provider observes the renderer inputs while forwarding every frame to
// the same renderer implementation used by the products.

#ifndef COSIMO_GENERATED_CPP_PATH
 #error "COSIMO_GENERATED_CPP_PATH must point to generated Cmajor C++"
#endif

namespace fixture_provider
{
using namespace cosimo::three_osc::bridge;

enum Invariant : std::uint32_t
{
    distinctTables = 1u << 0,
    independentTune = 1u << 1,
    levelAndPan = 1u << 2,
    phaseRandomReset = 1u << 3,
    independentUnison = 1u << 4,
    warpAndScan = 1u << 5,
    soloAndSum = 1u << 6,
    muteKeepsPhaseRunning = 1u << 7,
    levelTransition = 1u << 8,
    panTransition = 1u << 9,
    retriggerReset = 1u << 10,
    inactiveVoiceCleared = 1u << 11,
    independentModulation = 1u << 12,
    perOscillatorArticulation = 1u << 13,
    soundingNoteKeepsInheritedBase = 1u << 14,
    futureNoteInheritsLiveBase = 1u << 15
};

constexpr auto expectedInvariantMask = (1u << 16) - 1u;

std::int32_t frameCounter = 0;
std::int32_t firstError = 0;
std::uint32_t invariantMask = 0;
float previousBPhase = 0.0f;
float predictedBPhase = 0.0f;
float mutedBPhase = 0.0f;
bool hasPredictedBPhase = false;
bool sawBWarpAndScan = false;
float baselineCPhaseIncrement = 0.0f;

float absoluteValue (float value) noexcept
{
    return value < 0.0f ? -value : value;
}

float wrap01 (float value) noexcept
{
    return value - std::floor (value);
}

float circularDifference (float first, float second) noexcept
{
    const auto difference = absoluteValue (first - second);
    return difference < 0.5f ? difference : 1.0f - difference;
}

bool near (float first, float second, float tolerance = 1.0e-4f) noexcept
{
    return absoluteValue (first - second) <= tolerance;
}

void fail (std::int32_t code) noexcept
{
    if (firstError == 0)
        firstError = code;
}

template <typename FloatSlice, typename IntSlice, typename... TableChunkSlice>
std::int32_t render (FloatSlice packedFloats,
                     IntSlice packedInts,
                     TableChunkSlice... tableChunks) noexcept
{
    const auto frame = frameCounter++;
    if (packedFloats.elements == nullptr || packedFloats.size() < packedFloatCount
        || packedInts.elements == nullptr || packedInts.size() < packedIntCount)
    {
        fail (101);
        return 0;
    }

    auto* const floats = packedFloats.elements;
    auto* const ints = packedInts.elements;
    const auto b = std::int32_t { 1 };
    const auto c = std::int32_t { 2 };

    if (frame == 96)
    {
        const auto b0 = floats[phaseOffset + 8];
        const auto b1 = floats[phaseOffset + 9];
        const auto c0 = floats[phaseOffset + 16];
        const auto c1 = floats[phaseOffset + 17];
        if (b0 >= 0.0f && b0 < 1.0f && b1 >= 0.0f && b1 < 1.0f
            && c0 >= 0.0f && c0 < 1.0f && c1 >= 0.0f && c1 < 1.0f
            && circularDifference (b0, b1) > 1.0e-4f
            && circularDifference (c0, c1) > 1.0e-4f
            && circularDifference (b0, c0) > 1.0e-4f)
            invariantMask |= phaseRandomReset;
        else
            fail (102);
    }

    if (frame == 1600)
    {
        const auto slotA = ints[oscillatorSlotOffset];
        const auto slotB = ints[oscillatorSlotOffset + 1];
        const auto slotC = ints[oscillatorSlotOffset + 2];
        if (slotA != slotB && slotA != slotC && slotB != slotC
            && ints[frameCountOffset + slotA] == 2
            && ints[frameCountOffset + slotB] == 2
            && ints[frameCountOffset + slotC] == 2)
            invariantMask |= distinctTables;
        else
            fail (103);

        const auto bIncrement = floats[basePhaseIncrementOffset + b];
        const auto cIncrement = floats[basePhaseIncrementOffset + c];
        baselineCPhaseIncrement = cIncrement;
        if (bIncrement > cIncrement * 2.5f && bIncrement < cIncrement * 3.5f)
            invariantMask |= independentTune;
        else
            fail (104);

        if (floats[oscillatorGainOffset + b] > 0.30f
            && floats[oscillatorGainOffset + b] < 0.36f
            && near (floats[basePanOffset + b], -0.65f)
            && floats[oscillatorGainOffset + c] == 0.0f)
            invariantMask |= levelAndPan;
        else
            fail (105);

        if (ints[unisonVoicesOffset + b] == 3
            && near (floats[unisonDetuneOffset + b], 0.25f)
            && near (floats[unisonBlendOffset + b], 0.70f)
            && near (floats[unisonWidthOffset + b], 0.40f)
            && ints[unisonDetuneModeOffset + b] == 1
            && ints[unisonVoicesOffset + c] == 2
            && near (floats[unisonDetuneOffset + c], 0.15f)
            && ints[unisonDetuneModeOffset + c] == 2)
            invariantMask |= independentUnison;
        else
            fail (106);

        if (near (floats[basePositionOffset + b], 0.35f)
            && near (floats[baseWarpAmountOffset + b], 0.35f)
            && ints[warpModeOffset + b] == 1)
            sawBWarpAndScan = true;
        else
            fail (107);
    }

    if (frame == 2624)
    {
        if (floats[oscillatorGainOffset + b] == 0.0f
            && floats[oscillatorGainOffset + c] > 0.30f
            && sawBWarpAndScan
            && near (floats[basePositionOffset + c], 0.80f)
            && near (floats[baseWarpAmountOffset + c], 0.65f)
            && ints[warpModeOffset + c] == 2)
        {
            invariantMask |= soloAndSum;
            invariantMask |= warpAndScan;
        }
        else
            fail (108);
    }
    else if (frame == 3648)
    {
        if (floats[oscillatorGainOffset + b] <= 0.0f
            || floats[oscillatorGainOffset + c] <= 0.0f)
            fail (109);
    }
    else if (frame == 4672)
    {
        if (floats[oscillatorGainOffset + b] != 0.0f
            || floats[oscillatorGainOffset + c] <= 0.0f)
            fail (110);
        mutedBPhase = floats[phaseOffset + 8];
    }
    else if (frame == 4800)
    {
        if (circularDifference (mutedBPhase, floats[phaseOffset + 8]) > 1.0e-3f)
            invariantMask |= muteKeepsPhaseRunning;
        else
            fail (111);
    }
    else if (frame == 6720)
    {
        if (floats[oscillatorGainOffset + b] > 0.025f
            && floats[oscillatorGainOffset + b] < 0.040f)
            invariantMask |= levelTransition;
        else
            fail (112);
    }
    else if (frame == 7104)
    {
        if (near (floats[basePanOffset + b], 0.65f)
            && floats[oscillatorGainOffset + b] > 0.30f)
            invariantMask |= panTransition;
        else
            fail (113);
    }
    else if (frame == 8704)
    {
        const auto cIncrement = floats[basePhaseIncrementOffset + c];
        if (near (floats[basePanOffset + b], 0.25f, 2.0e-3f)
            && baselineCPhaseIncrement > 0.0f
            && cIncrement > baselineCPhaseIncrement * 1.84f
            && cIncrement < baselineCPhaseIncrement * 1.89f)
            invariantMask |= independentModulation;
        else
            fail (115);
    }
    else if (frame == 9216)
    {
        const auto bIncrement = floats[basePhaseIncrementOffset + b];
        const auto cIncrement = floats[basePhaseIncrementOffset + c];
        if (near (floats[basePositionOffset + b], 0.42f)
            && near (floats[basePositionOffset + c], 0.73f)
            && near (floats[basePanOffset + b], -0.25f)
            && near (floats[basePanOffset + c], 0.40f)
            && near (floats[baseWarpAmountOffset + b], 0.30f)
            && near (floats[baseWarpAmountOffset + c], 0.60f)
            && ints[warpModeOffset + b] == 3
            && ints[warpModeOffset + c] == 4
            && ints[unisonVoicesOffset + b] == 4
            && ints[unisonVoicesOffset + c] == 2
            && near (floats[unisonDetuneOffset + b], 0.20f)
            && near (floats[unisonDetuneOffset + c], 0.30f)
            && near (floats[unisonBlendOffset + b], 0.65f)
            && near (floats[unisonBlendOffset + c], 0.85f)
            && near (floats[unisonWidthOffset + b], 0.35f)
            && near (floats[unisonWidthOffset + c], 0.55f)
            && near (floats[positionSpreadOffset + b], 0.12f)
            && near (floats[positionSpreadOffset + c], 0.24f)
            && near (floats[warpSpreadOffset + b], 0.14f)
            && near (floats[warpSpreadOffset + c], 0.28f)
            && ints[unisonDetuneModeOffset + b] == 1
            && ints[unisonDetuneModeOffset + c] == 3
            && ints[unisonStackModeOffset + b] == 2
            && ints[unisonStackModeOffset + c] == 4
            && floats[oscillatorGainOffset + b] > 0.24f
            && floats[oscillatorGainOffset + b] < 0.26f
            && floats[oscillatorGainOffset + c] > 0.49f
            && floats[oscillatorGainOffset + c] < 0.51f
            && cIncrement > 0.0f
            && bIncrement > cIncrement * 2.75f
            && bIncrement < cIncrement * 2.82f)
            invariantMask |= perOscillatorArticulation;
        else
            fail (116);
    }
    else if (frame == 9344)
    {
        if (near (floats[basePanOffset], 0.0f))
            invariantMask |= soundingNoteKeepsInheritedBase;
        else
            fail (117);
    }
    else if (frame == 9728)
    {
        if (near (floats[basePanOffset], 0.70f))
            invariantMask |= futureNoteInheritsLiveBase;
        else
            fail (118);
    }

    const auto bPhase = floats[phaseOffset + 8];
    if (frame >= 7424 && frame <= 7426 && hasPredictedBPhase
        && circularDifference (bPhase, predictedBPhase) > 0.02f)
        invariantMask |= retriggerReset;

    if (frame == 19584)
    {
        if (floats[basePhaseIncrementOffset + b] == 0.0f
            && floats[basePhaseIncrementOffset + c] == 0.0f
            && floats[oscillatorGainOffset + b] == 0.0f
            && floats[oscillatorGainOffset + c] == 0.0f)
            invariantMask |= inactiveVoiceCleared;
        else
            fail (114);
    }

    previousBPhase = bPhase;
    predictedBPhase = wrap01 (previousBPhase + floats[phaseIncrementOffset + 8]);
    hasPredictedBPhase = floats[phaseIncrementOffset + 8] > 0.0f;

    return renderAllGenerated (packedFloats, packedInts, tableChunks...);
}
}

#define CosimoThreeOscillatorRenderer__renderAll(...) \
    ::fixture_provider::render (__VA_ARGS__)
#include COSIMO_GENERATED_CPP_PATH
#undef CosimoThreeOscillatorRenderer__renderAll

#if ! defined(__wasm__) && ! defined(__wasm32__)
 #include <iostream>
#endif

namespace
{
constexpr auto sessionID = std::int32_t { 30103 };
constexpr auto sampleRate = 48000.0;
constexpr auto blockSize = std::int32_t { 128 };
constexpr auto renderedFrameCount = std::int32_t { 20096 };
constexpr auto measurementFrameCount = std::int32_t { 512 };

struct Window
{
    std::int32_t firstFrame;
    std::int32_t frameCount = measurementFrameCount;
};

constexpr Window oscillatorA { 5184, 256 };
constexpr Window oscillatorB { 1600 };
constexpr Window oscillatorC { 2624 };
constexpr Window allOscillators { 3648 };
constexpr Window oscillatorBMuted { 4672 };
constexpr Window oscillatorATail { 5441, 48 };
constexpr Window oscillatorBTail { 5761, 48 };
constexpr Window oscillatorCTail { 6081, 48 };
constexpr Window bLevelReference { 6200, 128 };
constexpr Window bLevelLow { 6720, 128 };
constexpr Window bPanRight { 7104, 128 };
constexpr Window inactiveVoice { 19584, 256 };

struct Stats
{
    float leftMagnitude = 0.0f;
    float rightMagnitude = 0.0f;
    float peak = 0.0f;
};

float absoluteValue (float value) noexcept
{
    return value < 0.0f ? -value : value;
}

Stats measure (const float* audio, Window window) noexcept
{
    Stats stats;
    for (std::int32_t frame = 0; frame < window.frameCount; ++frame)
    {
        const auto index = static_cast<std::size_t> (window.firstFrame + frame) * 2;
        const auto left = absoluteValue (audio[index]);
        const auto right = absoluteValue (audio[index + 1]);
        stats.leftMagnitude += left;
        stats.rightMagnitude += right;
        if (left > stats.peak)
            stats.peak = left;
        if (right > stats.peak)
            stats.peak = right;
    }
    return stats;
}

float difference (const float* audio, Window first, Window second) noexcept
{
    const auto frameCount = first.frameCount < second.frameCount
        ? first.frameCount : second.frameCount;
    float total = 0.0f;
    for (std::int32_t frame = 0; frame < frameCount; ++frame)
    {
        const auto firstIndex = static_cast<std::size_t> (first.firstFrame + frame) * 2;
        const auto secondIndex = static_cast<std::size_t> (second.firstFrame + frame) * 2;
        total += absoluteValue (audio[firstIndex] - audio[secondIndex]);
        total += absoluteValue (audio[firstIndex + 1] - audio[secondIndex + 1]);
    }
    return total;
}

bool isAudible (Stats stats) noexcept
{
    return stats.peak > 0.002f
        && stats.leftMagnitude + stats.rightMagnitude > 0.5f;
}

bool hasFilterTail (Stats stats) noexcept
{
    return stats.peak > 1.0e-5f
        && stats.leftMagnitude + stats.rightMagnitude > 1.0e-4f;
}
}

extern "C" std::int32_t three_oscillator_generated_integration() noexcept
{
    // Keep the large, product-shaped performer out of both native and Wasm stacks.
    static ThreeOscillatorSharedVoiceEngine performer;
    static std::array<float, static_cast<std::size_t> (renderedFrameCount) * 2> audio {};
    static std::array<float, static_cast<std::size_t> (blockSize) * 2> block {};

    performer.initialise (sessionID, sampleRate);
    for (std::int32_t firstFrame = 0; firstFrame < renderedFrameCount; firstFrame += blockSize)
    {
        const auto frames = firstFrame + blockSize <= renderedFrameCount
            ? blockSize : renderedFrameCount - firstFrame;
        performer.advance (frames);
        performer.copyOutputFrames (
            static_cast<std::uint32_t> (
                ThreeOscillatorSharedVoiceEngine::EndpointHandles::audioOut),
            block.data(),
            static_cast<std::uint32_t> (frames));

        for (std::int32_t sample = 0; sample < frames * 2; ++sample)
        {
            const auto value = block[static_cast<std::size_t> (sample)];
            if (! std::isfinite (value))
                return -1;
            audio[static_cast<std::size_t> (firstFrame) * 2
                  + static_cast<std::size_t> (sample)] = value;
        }
    }

    if (fixture_provider::firstError != 0)
        return -1000 - fixture_provider::firstError;
    if (fixture_provider::invariantMask != fixture_provider::expectedInvariantMask)
        return -3;

    const auto a = measure (audio.data(), oscillatorA);
    const auto b = measure (audio.data(), oscillatorB);
    const auto c = measure (audio.data(), oscillatorC);
    const auto all = measure (audio.data(), allOscillators);
    const auto muted = measure (audio.data(), oscillatorBMuted);
    if (! isAudible (a) || ! isAudible (b) || ! isAudible (c)
        || ! isAudible (all) || ! isAudible (muted))
        return -4;

    if (absoluteValue (a.leftMagnitude - a.rightMagnitude)
            > 0.05f * (a.leftMagnitude + a.rightMagnitude)
        || b.leftMagnitude <= b.rightMagnitude * 1.10f
        || c.rightMagnitude <= c.leftMagnitude * 1.10f)
        return -5;

    if (difference (audio.data(), oscillatorA, oscillatorB) < 1.0f
        || difference (audio.data(), oscillatorA, oscillatorC) < 1.0f
        || difference (audio.data(), oscillatorB, oscillatorC) < 1.0f
        || difference (audio.data(), allOscillators, oscillatorBMuted) < 1.0f)
        return -6;

    // All three mutes remove pre-filter input. The shared resonant filter must
    // ring out for each oscillator rather than being reset or post-filter muted.
    if (! hasFilterTail (measure (audio.data(), oscillatorATail))
        || ! hasFilterTail (measure (audio.data(), oscillatorBTail))
        || ! hasFilterTail (measure (audio.data(), oscillatorCTail)))
        return -7;

    const auto levelReference = measure (audio.data(), bLevelReference);
    const auto levelLow = measure (audio.data(), bLevelLow);
    if (levelLow.leftMagnitude + levelLow.rightMagnitude
        >= 0.70f * (levelReference.leftMagnitude + levelReference.rightMagnitude))
        return -8;

    const auto pannedRight = measure (audio.data(), bPanRight);
    if (pannedRight.rightMagnitude <= pannedRight.leftMagnitude * 1.10f)
        return -9;

    const auto inactive = measure (audio.data(), inactiveVoice);
    if (inactive.peak > 1.0e-5f)
        return -10;

    // Exact common success replaces the previous loose aggregate fingerprint.
    return 424242;
}

#if ! defined(__wasm__) && ! defined(__wasm32__)
int main()
{
    const auto result = three_oscillator_generated_integration();
    if (result != 424242)
    {
        std::cerr << "FAIL shared voice engine integration: " << result << '\n';
        return 1;
    }

    std::cout << result << '\n';
    return 0;
}
#endif
