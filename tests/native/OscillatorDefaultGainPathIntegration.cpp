#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <iomanip>
#include <iostream>

#include "../../native/three_oscillator_renderer/RendererBridge.h"

#ifndef COSIMO_GENERATED_CPP_PATH
 #error "COSIMO_GENERATED_CPP_PATH must point to generated production Cmajor C++"
#endif

#ifndef COSIMO_DEFAULT_WAVETABLE_INDEX
 #error "COSIMO_DEFAULT_WAVETABLE_INDEX must match the generated production metadata"
#endif

namespace gain_path_probe
{
using namespace cosimo::three_osc::bridge;

struct CapturedGains
{
    std::array<float, 3> maximum {};
};

CapturedGains capturedGains;

template <typename FloatSlice, typename IntSlice, typename... TableChunkSlice>
std::int32_t render (FloatSlice packedFloats,
                     IntSlice packedInts,
                     TableChunkSlice... tableChunks) noexcept
{
    if (packedFloats.elements != nullptr
        && packedFloats.size() >= oscillatorGainOffset + 3)
    {
        for (std::size_t oscillator = 0; oscillator < capturedGains.maximum.size(); ++oscillator)
        {
            capturedGains.maximum[oscillator] = std::max (
                capturedGains.maximum[oscillator],
                packedFloats.elements[oscillatorGainOffset + oscillator]);
        }
    }

    return renderAllGenerated (packedFloats, packedInts, tableChunks...);
}
}

#define CosimoThreeOscillatorRenderer__renderAll(...) \
    ::gain_path_probe::render (__VA_ARGS__)
#include COSIMO_GENERATED_CPP_PATH
#undef CosimoThreeOscillatorRenderer__renderAll

namespace
{
constexpr auto sampleRate = 48000.0;
constexpr auto samplesPerFrame = std::int32_t { 2048 };
constexpr auto mipCount = std::int32_t { 11 };
constexpr auto blockFrames = std::int32_t { 128 };
constexpr auto measurementFrames = std::int32_t { 8192 };
constexpr auto measurementWarmupFrames = std::int32_t { 512 };
constexpr auto defaultTableIndex = std::int32_t { COSIMO_DEFAULT_WAVETABLE_INDEX };
constexpr auto noteNumber = std::uint8_t { 60 };
constexpr auto oldQuietLevelDb = -9.542425f;

struct Measurement
{
    double rms = 0.0;
    float peak = 0.0f;
    std::array<float, 3> maximumGains {};
};

std::int32_t packMIDI (std::uint8_t status, std::uint8_t note, std::uint8_t velocity) noexcept
{
    return (static_cast<std::int32_t> (status) << 16)
         | (static_cast<std::int32_t> (note) << 8)
         | static_cast<std::int32_t> (velocity);
}

void advanceDiscard (WavetableSynth& performer, std::int32_t frames)
{
    while (frames > 0)
    {
        const auto count = std::min (frames, blockFrames);
        performer.advance (count);
        frames -= count;
    }
}

void setValue (WavetableSynth& performer,
               WavetableSynth::EndpointHandles endpoint,
               float value)
{
    performer.setValue (static_cast<std::uint32_t> (endpoint), &value, 0);
}

void setOscillatorDefaults (WavetableSynth& performer,
                            float oscillatorALevelDb,
                            std::uint32_t audibleOscillatorMask)
{
    using Handles = WavetableSynth::EndpointHandles;
    const std::array<Handles, 3> volumeEndpoints {
        Handles::oscAVolumeDb,
        Handles::oscBVolumeDb,
        Handles::oscCVolumeDb,
    };
    const std::array<Handles, 3> muteEndpoints {
        Handles::oscAMute,
        Handles::oscBMute,
        Handles::oscCMute,
    };
    const std::array<Handles, 3> retriggerEndpoints {
        Handles::oscARetrigger,
        Handles::oscBRetrigger,
        Handles::oscCRetrigger,
    };
    const std::array<Handles, 3> unisonVoiceEndpoints {
        Handles::oscAUnisonVoices,
        Handles::oscBUnisonVoices,
        Handles::oscCUnisonVoices,
    };
    const std::array<Handles, 3> unisonDetuneEndpoints {
        Handles::oscAUnisonDetune,
        Handles::oscBUnisonDetune,
        Handles::oscCUnisonDetune,
    };
    const std::array<Handles, 3> unisonBlendEndpoints {
        Handles::oscAUnisonBlend,
        Handles::oscBUnisonBlend,
        Handles::oscCUnisonBlend,
    };
    const std::array<Handles, 3> unisonWidthEndpoints {
        Handles::oscAUnisonWidth,
        Handles::oscBUnisonWidth,
        Handles::oscCUnisonWidth,
    };

    for (std::int32_t oscillator = 0; oscillator < 3; ++oscillator)
    {
        setValue (performer, volumeEndpoints[static_cast<std::size_t> (oscillator)],
                  oscillator == 0 ? oscillatorALevelDb : 0.0f);
        setValue (performer, muteEndpoints[static_cast<std::size_t> (oscillator)],
                  (audibleOscillatorMask & (1u << oscillator)) != 0 ? 0.0f : 1.0f);
        setValue (performer, retriggerEndpoints[static_cast<std::size_t> (oscillator)], 1.0f);
        setValue (performer, unisonVoiceEndpoints[static_cast<std::size_t> (oscillator)], 1.0f);
        setValue (performer, unisonDetuneEndpoints[static_cast<std::size_t> (oscillator)], 0.1f);
        setValue (performer, unisonBlendEndpoints[static_cast<std::size_t> (oscillator)], 0.75f);
        setValue (performer, unisonWidthEndpoints[static_cast<std::size_t> (oscillator)], 1.0f);
    }

    setValue (performer, Handles::filterMode, 1.0f);
    setValue (performer, Handles::filterCutoff, 1000.0f);
    setValue (performer, Handles::filterQ, 0.707107f);
    setValue (performer, Handles::filterMix, 1.0f);
    setValue (performer, Handles::ampAttack, 0.01f);
    setValue (performer, Handles::ampDecay, 0.001f);
    setValue (performer, Handles::ampSustain, 1.0f);
    setValue (performer, Handles::ampRelease, 0.2f);
    setValue (performer, Handles::sourceMode, 0.0f);

    // Host values with 64-frame ramps must settle before the note. This is
    // the same endpoint delivery the browser/native wrappers perform.
    advanceDiscard (performer, 128);
}

void uploadSineTable (WavetableSynth& performer,
                      std::int32_t sessionID,
                      std::int32_t oscillatorIndex)
{
    WavetableSynth::wt_OscillatorWavetableLoadBegin begin;
    begin.dspSessionId = sessionID;
    begin.oscillatorIndex = oscillatorIndex;
    begin.generation = 1;
    begin.tableIndex = defaultTableIndex;
    begin.frameCount = 1;
    performer.addEvent_wavetableLoadBegin (begin);
    advanceDiscard (performer, 2);

    for (std::int32_t mipIndex = 0; mipIndex < mipCount; ++mipIndex)
    {
        WavetableSynth::wt_OscillatorWavetableMipFrame frame;
        frame.dspSessionId = sessionID;
        frame.oscillatorIndex = oscillatorIndex;
        frame.generation = 1;
        frame.tableIndex = defaultTableIndex;
        frame.mipIndex = mipIndex;
        frame.frameIndexBase = 0;
        frame.frameCount = 1;
        for (std::int32_t sample = 0; sample < samplesPerFrame; ++sample)
        {
            const auto phase = (static_cast<double> (sample) / samplesPerFrame)
                             * 2.0 * 3.14159265358979323846;
            frame.samples[static_cast<std::size_t> (sample)] = static_cast<float> (std::sin (phase));
        }
        performer.addEvent_wavetableMipFrame (frame);
        advanceDiscard (performer, 2);
    }
}

Measurement runScenario (std::int32_t sessionID,
                         float oscillatorALevelDb,
                         std::uint32_t audibleOscillatorMask)
{
    static WavetableSynth performer;
    performer.initialise (sessionID, sampleRate);
    setOscillatorDefaults (performer, oscillatorALevelDb, audibleOscillatorMask);
    for (std::int32_t oscillator = 0; oscillator < 3; ++oscillator)
        uploadSineTable (performer, sessionID, oscillator);

    gain_path_probe::capturedGains = {};
    // Use maximum MIDI velocity so the 0 dB safety verdict covers the loudest
    // ordinary note-on, not merely a representative performance velocity.
    performer.addEvent_midiIn ({ packMIDI (0x90, noteNumber, 127) });

    std::array<float, static_cast<std::size_t> (blockFrames) * 2> audio {};
    double sumSquares = 0.0;
    std::int32_t measuredSamples = 0;
    float peak = 0.0f;

    for (std::int32_t rendered = 0; rendered < measurementFrames; rendered += blockFrames)
    {
        performer.advance (blockFrames);
        performer.copyOutputFrames (
            static_cast<std::uint32_t> (WavetableSynth::EndpointHandles::audioOut),
            audio.data(),
            blockFrames);

        for (std::int32_t frame = 0; frame < blockFrames; ++frame)
        {
            const auto absoluteFrame = rendered + frame;
            const auto left = audio[static_cast<std::size_t> (frame) * 2];
            const auto right = audio[static_cast<std::size_t> (frame) * 2 + 1];
            if (! std::isfinite (left) || ! std::isfinite (right))
                return { -1.0, -1.0f, gain_path_probe::capturedGains.maximum };
            if (absoluteFrame < measurementWarmupFrames)
                continue;
            sumSquares += 0.5 * (static_cast<double> (left) * left
                               + static_cast<double> (right) * right);
            peak = std::max ({ peak, std::abs (left), std::abs (right) });
            ++measuredSamples;
        }
    }

    return {
        measuredSamples == 0 ? 0.0 : std::sqrt (sumSquares / measuredSamples),
        peak,
        gain_path_probe::capturedGains.maximum,
    };
}

double dbfs (double value)
{
    return value <= 0.0 ? -200.0 : 20.0 * std::log10 (value);
}

bool near (float actual, float expected, float tolerance = 1.0e-4f)
{
    return std::abs (actual - expected) <= tolerance;
}
}

int main()
{
    static_assert (WavetableSynth::maxFramesPerBlock == blockFrames);
    static_assert (WavetableSynth::getEndpointHandleForName ("oscAVolumeDb") != 0);
    static_assert (WavetableSynth::getEndpointHandleForName ("oscBMute") != 0);
    static_assert (WavetableSynth::getEndpointHandleForName ("audioOut") != 0);

    const auto defaultA = runScenario (53001, 0.0f, 0b001);
    const auto oldQuietA = runScenario (53002, oldQuietLevelDb, 0b001);
    const auto enabledB = runScenario (53003, 0.0f, 0b010);
    const auto enabledC = runScenario (53004, 0.0f, 0b100);
    const auto allEnabled = runScenario (53005, 0.0f, 0b111);
    const auto allMuted = runScenario (53006, 0.0f, 0b000);

    const auto levelRatio = oldQuietA.rms > 0.0 ? defaultA.rms / oldQuietA.rms : 0.0;
    const auto levelDeltaDb = dbfs (defaultA.rms) - dbfs (oldQuietA.rms);
    const auto defaultGainsAreExact = near (defaultA.maximumGains[0], 1.0f)
        && near (defaultA.maximumGains[1], 0.0f)
        && near (defaultA.maximumGains[2], 0.0f);
    const auto enabledSiblingGainsAreExact = near (enabledB.maximumGains[0], 0.0f)
        && near (enabledB.maximumGains[1], 1.0f)
        && near (enabledB.maximumGains[2], 0.0f)
        && near (enabledC.maximumGains[0], 0.0f)
        && near (enabledC.maximumGains[1], 0.0f)
        && near (enabledC.maximumGains[2], 1.0f);

    if (! defaultGainsAreExact || ! enabledSiblingGainsAreExact)
    {
        std::cerr << "FAIL: endpoint values and renderer gains disagree"
                  << " default=" << defaultA.maximumGains[0] << ','
                  << defaultA.maximumGains[1] << ',' << defaultA.maximumGains[2]
                  << " B=" << enabledB.maximumGains[0] << ','
                  << enabledB.maximumGains[1] << ',' << enabledB.maximumGains[2]
                  << " C=" << enabledC.maximumGains[0] << ','
                  << enabledC.maximumGains[1] << ',' << enabledC.maximumGains[2] << '\n';
        return 1;
    }
    if (!(defaultA.rms > 0.005 && defaultA.peak > 0.01f && defaultA.peak < 1.0f))
    {
        std::cerr << "FAIL: 0 dB A path is silent or reaches the output limiter"
                  << " rms=" << defaultA.rms << " peak=" << defaultA.peak << '\n';
        return 1;
    }
    if (!(enabledB.rms > 0.005 && enabledC.rms > 0.005))
    {
        std::cerr << "FAIL: a sibling enabled at its stored 0 dB default is silent"
                  << " B=" << enabledB.rms << " C=" << enabledC.rms << '\n';
        return 1;
    }
    if (!(allEnabled.rms > defaultA.rms * 2.95
          && allEnabled.rms < defaultA.rms * 3.05
          && allEnabled.peak < 1.0f
          && near (allEnabled.maximumGains[0], 1.0f)
          && near (allEnabled.maximumGains[1], 1.0f)
          && near (allEnabled.maximumGains[2], 1.0f)))
    {
        std::cerr << "FAIL: all three oscillators at their stored 0 dB level are unsafe"
                  << " rms=" << allEnabled.rms << " peak=" << allEnabled.peak << '\n';
        return 1;
    }
    if (!(levelRatio > 2.95 && levelRatio < 3.05
          && levelDeltaDb > 9.45 && levelDeltaDb < 9.65))
    {
        std::cerr << "FAIL: production path did not preserve the expected 0 dB/-9.542425 dB ratio"
                  << " ratio=" << levelRatio << " deltaDb=" << levelDeltaDb << '\n';
        return 1;
    }
    if (allMuted.peak > 1.0e-7f || allMuted.rms > 1.0e-8
        || ! near (allMuted.maximumGains[0], 0.0f)
        || ! near (allMuted.maximumGains[1], 0.0f)
        || ! near (allMuted.maximumGains[2], 0.0f))
    {
        std::cerr << "FAIL: muted oscillators reached the renderer/output"
                  << " rms=" << allMuted.rms << " peak=" << allMuted.peak << '\n';
        return 1;
    }

    std::cout << std::fixed << std::setprecision (6)
              << "PASS T53 production oscillator->filter->trim(0.18)->rack->output path"
              << " defaultRms=" << defaultA.rms
              << " defaultRmsDbFS=" << dbfs (defaultA.rms)
              << " defaultPeak=" << defaultA.peak
              << " defaultPeakDbFS=" << dbfs (defaultA.peak)
              << " oldQuietRms=" << oldQuietA.rms
              << " oldQuietRmsDbFS=" << dbfs (oldQuietA.rms)
              << " levelRatio=" << levelRatio
              << " levelDeltaDb=" << levelDeltaDb
              << " enabledBRms=" << enabledB.rms
              << " enabledCRms=" << enabledC.rms
              << " allEnabledPeak=" << allEnabled.peak
              << " allEnabledPeakDbFS=" << dbfs (allEnabled.peak)
              << " allMutedPeak=" << allMuted.peak
              << " rendererDefaultGains=" << defaultA.maximumGains[0] << ','
              << defaultA.maximumGains[1] << ',' << defaultA.maximumGains[2]
              << '\n';
    return 0;
}
