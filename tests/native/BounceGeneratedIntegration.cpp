#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <iostream>

#include "../../native/three_oscillator_renderer/RendererBridge.h"

#ifndef COSIMO_GENERATED_CPP_PATH
 #error "COSIMO_GENERATED_CPP_PATH must point to generated production Cmajor C++"
#endif

#define CosimoThreeOscillatorRenderer__renderAll(...) \
    ::cosimo::three_osc::bridge::renderAllGenerated (__VA_ARGS__)
#include COSIMO_GENERATED_CPP_PATH
#undef CosimoThreeOscillatorRenderer__renderAll

namespace
{
constexpr auto sessionID = std::int32_t { 0x424000 };
constexpr auto generation = std::int32_t { 7 };
constexpr auto sampleRate = 48000.0;
constexpr auto rootNote = std::int32_t { 60 };
constexpr auto sourceFrames = std::int32_t { 1024 };
constexpr auto bakedNoteOffFrame = std::int32_t { 768 };
constexpr auto blockFrames = std::int32_t { 128 };

std::int32_t packStereo (std::int16_t left, std::int16_t right) noexcept
{
    const auto packed = static_cast<std::uint32_t> (static_cast<std::uint16_t> (left))
                      | (static_cast<std::uint32_t> (static_cast<std::uint16_t> (right)) << 16u);
    return static_cast<std::int32_t> (packed);
}

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
}

int main()
{
    static_assert (WavetableSynth::maxFramesPerBlock == 128,
                   "Native and browser Bounce drivers require 128-frame slices");
    static_assert (WavetableSynth::getEndpointHandleForName ("bounceBankLoadBegin") != 0,
                   "Generated production class is missing the Bounce bank protocol");
    static_assert (WavetableSynth::getEndpointHandleForName ("sourceMode") != 0,
                   "Generated production class is missing sampled source mode");

    // The production performer owns two fixed 5,472,000-frame bank slots, so
    // keep it out of the small VM's stack just as desktop/iOS wrappers do.
    static WavetableSynth performer;
    performer.initialise (sessionID, sampleRate);

    WavetableSynth::wt_BounceBankLoadBegin begin;
    begin.dspSessionId = sessionID;
    begin.generation = generation;
    begin.deliverySerial = 1;
    begin.sampleRate = static_cast<std::int32_t> (sampleRate);
    begin.rootCount = 1;
    begin.totalFrameCount = sourceFrames;
    begin.rootNotes[0] = rootNote;
    begin.rootFrameOffsets[0] = 0;
    begin.rootFrameCounts[0] = sourceFrames;
    begin.rootNoteOffFrameOffsets[0] = bakedNoteOffFrame;
    performer.addEvent_bounceBankLoadBegin (begin);
    advanceDiscard (performer, 2);

    WavetableSynth::wt_BounceBankFrameBatch batch;
    batch.dspSessionId = sessionID;
    batch.generation = generation;
    batch.deliverySerial = 2;
    batch.frameIndexBase = 0;
    batch.frameCount = sourceFrames;
    for (std::int32_t frame = 0; frame < sourceFrames; ++frame)
    {
        const auto phase = 2.0 * 3.14159265358979323846 * 220.0
                         * static_cast<double> (frame) / sampleRate;
        const auto edge = std::min ({ 1.0,
                                     static_cast<double> (frame) / 32.0,
                                     static_cast<double> (sourceFrames - 1 - frame) / 32.0 });
        const auto sample = static_cast<std::int16_t> (
            std::lround (std::sin (phase) * edge * 8192.0));
        batch.packedFrames[frame] = packStereo (sample, sample);
    }
    performer.addEvent_bounceBankFrameBatch (batch);
    advanceDiscard (performer, 2);

    WavetableSynth::wt_BounceBankCommit commit;
    commit.dspSessionId = sessionID;
    commit.generation = generation;
    commit.deliverySerial = 3;
    performer.addEvent_bounceBankCommit (commit);
    performer.advance (2);

    const auto runtimeHandle = static_cast<std::uint32_t> (
        WavetableSynth::EndpointHandles::bounceBankRuntimeState);
    bool sawCommittedBank = false;
    for (std::uint32_t index = 0; index < performer.getNumOutputEvents (runtimeHandle); ++index)
    {
        WavetableSynth::wt_BounceBankRuntimeState state;
        performer.readOutputEvent (runtimeHandle, index,
                                   reinterpret_cast<unsigned char*> (&state));
        sawCommittedBank = sawCommittedBank
            || (state.dspSessionId == sessionID
                && state.hasActive == 1
                && state.activeGeneration == generation
                && state.activeRootCount == 1
                && state.activeFrameCount == sourceFrames
                && state.hasStaging == 0
                && state.rejectedDeliverySerial == 0);
    }

    if (! sawCommittedBank)
    {
        std::cerr << "FAIL: generated performer did not atomically commit the staged bank\n";
        return 1;
    }

    auto sampledMode = 1.0f;
    performer.setValue (static_cast<std::uint32_t> (WavetableSynth::EndpointHandles::sourceMode),
                        &sampledMode,
                        0);
    // Complete the fixed 192-down/192-up source transition before note-on.
    advanceDiscard (performer, 384);

    performer.addEvent_midiIn ({ packMIDI (0x90, rootNote, 100) });
    std::array<float, static_cast<std::size_t> (blockFrames) * 2> audio {};
    double sumSquares = 0.0;
    double releaseSquares = 0.0;
    float peak = 0.0f;
    std::int32_t renderedFrames = 0;

    while (renderedFrames < sourceFrames)
    {
        if (renderedFrames == 512)
            performer.addEvent_midiIn ({ packMIDI (0x80, rootNote, 0) });

        performer.advance (blockFrames);
        performer.copyOutputFrames (
            static_cast<std::uint32_t> (WavetableSynth::EndpointHandles::audioOut),
            audio.data(),
            blockFrames);

        for (std::int32_t frame = 0; frame < blockFrames; ++frame)
        {
            const auto left = audio[static_cast<std::size_t> (frame) * 2];
            const auto right = audio[static_cast<std::size_t> (frame) * 2 + 1];
            if (! std::isfinite (left) || ! std::isfinite (right))
            {
                std::cerr << "FAIL: generated sampled path emitted a non-finite sample\n";
                return 1;
            }
            sumSquares += 0.5 * (static_cast<double> (left) * left
                               + static_cast<double> (right) * right);
            peak = std::max ({ peak, std::abs (left), std::abs (right) });
            if (renderedFrames + frame >= 512)
                releaseSquares += 0.5 * (static_cast<double> (left) * left
                                       + static_cast<double> (right) * right);
        }
        renderedFrames += blockFrames;
    }

    const auto rms = std::sqrt (sumSquares / sourceFrames);
    const auto earlyReleaseRms = std::sqrt (releaseSquares / (sourceFrames - 512));
    if (rms < 0.01 || peak < 0.02f || earlyReleaseRms < 0.001)
    {
        std::cerr << "FAIL: generated sampled path was silent or lost its live early release"
                  << " rms=" << rms
                  << " peak=" << peak
                  << " releaseRms=" << earlyReleaseRms << '\n';
        return 1;
    }

    std::cout << "PASS generated production Bounce sampler"
              << " sizeofPerformer=" << sizeof (WavetableSynth)
              << " rms=" << rms
              << " peak=" << peak
              << " earlyReleaseRms=" << earlyReleaseRms << '\n';
    return 0;
}
