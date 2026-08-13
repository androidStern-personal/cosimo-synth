#include <array>
#include <cstddef>
#include <cstdint>

#include "../../native/three_oscillator_renderer/RendererBridge.h"

#ifndef COSIMO_GENERATED_CPP_PATH
 #error "COSIMO_GENERATED_CPP_PATH must point to generated Cmajor C++"
#endif

#define CosimoThreeOscillatorRenderer__renderAll(...) \
    ::cosimo::three_osc::bridge::renderAllGenerated (__VA_ARGS__)
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
constexpr auto renderedFrameCount = std::int32_t { 5184 };
constexpr auto measurementFrameCount = std::int32_t { 512 };

struct Window
{
    std::int32_t firstFrame;
};

constexpr Window oscillatorA { 576 };
constexpr Window oscillatorB { 1600 };
constexpr Window oscillatorC { 2624 };
constexpr Window allOscillators { 3648 };
constexpr Window oscillatorBMuted { 4672 };

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
    for (std::int32_t frame = 0; frame < measurementFrameCount; ++frame)
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
    float total = 0.0f;
    for (std::int32_t frame = 0; frame < measurementFrameCount; ++frame)
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
    return stats.peak > 0.005f
        && stats.leftMagnitude + stats.rightMagnitude > 1.0f;
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
            if (value != value)
                return -1;
            audio[static_cast<std::size_t> (firstFrame) * 2
                  + static_cast<std::size_t> (sample)] = value;
        }
    }

    const auto a = measure (audio.data(), oscillatorA);
    const auto b = measure (audio.data(), oscillatorB);
    const auto c = measure (audio.data(), oscillatorC);
    const auto all = measure (audio.data(), allOscillators);
    const auto muted = measure (audio.data(), oscillatorBMuted);

    if (! isAudible (a) || ! isAudible (b) || ! isAudible (c)
        || ! isAudible (all) || ! isAudible (muted))
        return -2;

    // A is centered, B is left-biased, and C is right-biased. These checks
    // prove that the three independently addressed control sets reach audio.
    if (absoluteValue (a.leftMagnitude - a.rightMagnitude)
            > 0.05f * (a.leftMagnitude + a.rightMagnitude)
        || b.leftMagnitude <= b.rightMagnitude * 1.10f
        || c.rightMagnitude <= c.leftMagnitude * 1.10f)
        return -3;

    if (difference (audio.data(), oscillatorA, oscillatorB) < 1.0f
        || difference (audio.data(), oscillatorA, oscillatorC) < 1.0f
        || difference (audio.data(), oscillatorB, oscillatorC) < 1.0f)
        return -4;

    // The final two windows are driven by direct engine controls only: all
    // oscillators summed, then oscillator B muted. No UI selection state exists.
    if (difference (audio.data(), allOscillators, oscillatorBMuted) < 1.0f)
        return -5;

    const auto weightedMagnitude =
        (a.leftMagnitude + a.rightMagnitude)
        + 2.0f * (b.leftMagnitude + b.rightMagnitude)
        + 3.0f * (c.leftMagnitude + c.rightMagnitude)
        + 4.0f * (all.leftMagnitude + all.rightMagnitude)
        + 5.0f * (muted.leftMagnitude + muted.rightMagnitude);
    return 100000 + static_cast<std::int32_t> (weightedMagnitude * 10.0f);
}

#if ! defined(__wasm__) && ! defined(__wasm32__)
int main()
{
    const auto fingerprint = three_oscillator_generated_integration();
    if (fingerprint <= 0)
    {
        std::cerr << "FAIL shared voice engine integration: " << fingerprint << '\n';
        return 1;
    }

    std::cout << fingerprint << '\n';
    return 0;
}
#endif
