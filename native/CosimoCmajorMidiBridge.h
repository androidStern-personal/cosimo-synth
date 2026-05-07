#pragma once

#include <algorithm>
#include <cstdint>
#include <string_view>
#include <vector>

#include "FutureDawNoteMetaBridge.h"

namespace cosimo::cmajor_bridge
{
constexpr auto articulationNoteMetaEndpointID = "articulationNoteMeta";

inline choc::value::Value createNoteMetaValue (const future_daw::NoteMeta& meta)
{
    return choc::json::create (
        "channel", meta.cmajorChannel(),
        "noteNumber", meta.noteNumber,
        "selectorA", meta.selectorA,
        "selectorB", meta.selectorB,
        "durationSamples", meta.durationSamples,
        "ageSamples", meta.ageSamples
    );
}

inline bool sendNoteMetaToPatch (cmaj::Patch& patch, const future_daw::NoteMeta& meta)
{
    auto value = createNoteMetaValue (meta);
    return patch.sendEventOrValueToPatch (cmaj::EndpointID::create (std::string_view (articulationNoteMetaEndpointID)),
                                          value,
                                          0,
                                          0);
}

template <typename MidiOutputFn>
void processBlockWithFutureDawNoteMeta (cmaj::Patch& patch,
                                        juce::AudioBuffer<float>& audio,
                                        juce::MidiBuffer& midi,
                                        future_daw::NoteMetaBridge& bridge,
                                        MidiOutputFn&& midiOutputFn)
{
    std::vector<future_daw::BridgeOutputEvent> bridgedEvents;
    bridgedEvents.reserve (static_cast<std::size_t> (midi.getNumEvents()) * 2u);

    for (const auto metadata : midi)
    {
        bridge.processMidiEvent (metadata.samplePosition,
                                 metadata.data,
                                 static_cast<std::size_t> (metadata.numBytes),
                                 bridgedEvents);
    }

    bridge.finishBlock();
    midi.clear();

    auto* audioChannels = audio.getArrayOfWritePointers();
    const auto numFrames = static_cast<choc::buffer::FrameCount> (audio.getNumSamples());

    if (bridgedEvents.empty())
    {
        patch.process (audioChannels,
                       numFrames,
                       [&] (uint32_t frame, choc::midi::ShortMessage message)
                       {
                           midiOutputFn (frame, message);
                       });
        return;
    }

    std::stable_sort (bridgedEvents.begin(),
                      bridgedEvents.end(),
                      [] (const auto& left, const auto& right)
                      {
                          if (left.sampleOffset != right.sampleOffset)
                              return left.sampleOffset < right.sampleOffset;

                          return left.sequence < right.sequence;
                      });

    float* const* inputChannels = nullptr;
    auto audioInput = choc::buffer::createChannelArrayView (inputChannels,
                                                           static_cast<choc::buffer::ChannelCount> (0),
                                                           numFrames);
    auto audioOutput = choc::buffer::createChannelArrayView (audioChannels,
                                                            static_cast<choc::buffer::ChannelCount> (audio.getNumChannels()),
                                                            numFrames);

    const auto makeFrameRange = [] (int start, int end)
    {
        return choc::buffer::FrameRange {
            static_cast<choc::buffer::FrameCount> (std::max (0, start)),
            static_cast<choc::buffer::FrameCount> (std::max (0, end))
        };
    };

    const auto processRange = [&] (int start,
                                   int end,
                                   choc::span<choc::audio::AudioMIDIBlockDispatcher::MIDIMessage> midiMessages)
    {
        if (end <= start)
            return;

        const auto range = makeFrameRange (start, end);
        patch.processChunk (
            choc::audio::AudioMIDIBlockDispatcher::Block {
                audioInput.getFrameRange (range),
                audioOutput.getFrameRange (range),
                midiMessages,
                [&] (uint32_t frame, choc::midi::ShortMessage message)
                {
                    midiOutputFn (static_cast<uint32_t> (start) + frame, message);
                }
            },
            true
        );
    };

    patch.beginChunkedProcess();

    int cursor = 0;
    std::size_t eventIndex = 0;

    while (eventIndex < bridgedEvents.size())
    {
        auto sampleOffset = bridgedEvents[eventIndex].sampleOffset;
        sampleOffset = std::max (0, std::min (sampleOffset, static_cast<int> (numFrames) - 1));

        processRange (cursor, sampleOffset, {});

        const auto groupStart = eventIndex;
        auto groupEnd = groupStart;

        while (groupEnd < bridgedEvents.size()
               && std::max (0, std::min (bridgedEvents[groupEnd].sampleOffset, static_cast<int> (numFrames) - 1)) == sampleOffset)
        {
            ++groupEnd;
        }

        std::vector<choc::audio::AudioMIDIBlockDispatcher::MIDIMessage> midiMessages;
        midiMessages.reserve (groupEnd - groupStart);

        for (auto index = groupStart; index < groupEnd; ++index)
        {
            const auto& event = bridgedEvents[index];

            if (event.kind == future_daw::BridgeOutputKind::noteMeta)
            {
                sendNoteMetaToPatch (patch, event.noteMeta);
                continue;
            }

            midiMessages.push_back (
                choc::audio::AudioMIDIBlockDispatcher::MIDIMessage {
                    {},
                    {},
                    choc::midi::MessageView (event.midi.bytes.data(), event.midi.size)
                }
            );
        }

        auto nextSampleOffset = static_cast<int> (numFrames);

        if (groupEnd < bridgedEvents.size())
            nextSampleOffset = std::max (0, std::min (bridgedEvents[groupEnd].sampleOffset, static_cast<int> (numFrames) - 1));

        processRange (sampleOffset,
                      nextSampleOffset,
                      choc::span<choc::audio::AudioMIDIBlockDispatcher::MIDIMessage> (midiMessages.data(),
                                                                                      midiMessages.data() + midiMessages.size()));

        cursor = nextSampleOffset;
        eventIndex = groupEnd;
    }

    processRange (cursor, static_cast<int> (numFrames), {});
    patch.endChunkedProcess();
}
} // namespace cosimo::cmajor_bridge
