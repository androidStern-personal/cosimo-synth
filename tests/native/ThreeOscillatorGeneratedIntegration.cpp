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
constexpr auto sessionID = std::int32_t { 19081 };
constexpr auto sampleRate = 48000.0;
constexpr auto blockSize = std::int32_t { 512 };

float absoluteValue (float value) noexcept
{
    return value < 0.0f ? -value : value;
}
}

extern "C" std::int32_t three_oscillator_generated_integration() noexcept
{
    // Keep the 52 MB table pool out of the Wasm stack. The test process/module is
    // single-use, so one statically allocated performer is the honest product shape.
    static ThreeOscillatorExternalSmoke performer;
    static float audio[static_cast<std::size_t> (blockSize) * 2] {};

    performer.initialise (sessionID, sampleRate);
    performer.advance (blockSize);
    performer.copyOutputFrames (
        static_cast<std::uint32_t> (ThreeOscillatorExternalSmoke::EndpointHandles::audioOut),
        audio,
        static_cast<std::uint32_t> (blockSize));

    float absoluteSum = 0.0f;
    float peak = 0.0f;
    std::int32_t changingSamples = 0;
    auto previous = audio[0];

    for (std::int32_t sample = 0; sample < blockSize * 2; ++sample)
    {
        const auto value = audio[static_cast<std::size_t> (sample)];
        if (value != value)
            return -1;

        const auto magnitude = absoluteValue (value);
        absoluteSum += magnitude;
        if (magnitude > peak)
            peak = magnitude;
        if (absoluteValue (value - previous) > 1.0e-6f)
            ++changingSamples;
        previous = value;
    }

    if (peak < 0.01f || absoluteSum < 1.0f)
        return -2;
    if (changingSamples < blockSize / 4)
        return -3;

    return static_cast<std::int32_t> (absoluteSum * 1000.0f)
         + static_cast<std::int32_t> (peak * 100000.0f)
         + changingSamples;
}

#if ! defined(__wasm__) && ! defined(__wasm32__)
int main()
{
    const auto fingerprint = three_oscillator_generated_integration();
    if (fingerprint <= 0)
    {
        std::cerr << "FAIL generated external renderer integration: " << fingerprint << '\n';
        return 1;
    }

    std::cout << fingerprint << '\n';
    return 0;
}
#endif
