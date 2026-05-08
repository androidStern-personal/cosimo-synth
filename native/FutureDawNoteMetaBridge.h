#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <vector>

namespace cosimo::future_daw
{
constexpr std::size_t noteMetaMessageSize = 16;
constexpr std::uint8_t noteMetaVendorID = 0x7d;
constexpr std::uint8_t noteMetaMessageID = 0x01;
constexpr int noteMetaMaxPackedValue = 0x0fffffff;
constexpr int selectorUnset = -1;

struct NoteMeta
{
    int channel = 1; // FutureDaw wire format stores MIDI channels as 1..16.
    int noteNumber = 0;
    int selectorA = 0;
    int selectorB = 0;
    int durationSamples = 0;
    int ageSamples = 0;

    [[nodiscard]] int cmajorChannel() const { return channel - 1; }
};

struct ShortMidiMessage
{
    std::array<std::uint8_t, 3> bytes {};
    std::size_t size = 0;
};

enum class BridgeOutputKind
{
    shortMidi,
    noteMeta
};

struct BridgeOutputEvent
{
    int sampleOffset = 0;
    std::uint64_t sequence = 0;
    BridgeOutputKind kind = BridgeOutputKind::shortMidi;
    ShortMidiMessage midi {};
    NoteMeta noteMeta {};
};

enum class ArticulationTriggerMode
{
    chain,
    key,
    velocity
};

struct ArticulationTriggerConfig
{
    ArticulationTriggerConfig()
    {
        chainSelectorToRuntimeSlot.fill (selectorUnset);
        keyNoteToRuntimeSlot.fill (selectorUnset);
        velocityToRuntimeSlot.fill (selectorUnset);
    }

    ArticulationTriggerMode activeMode = ArticulationTriggerMode::chain;
    std::array<int, 128> chainSelectorToRuntimeSlot {};
    std::array<int, 128> keyNoteToRuntimeSlot {};
    std::array<int, 128> velocityToRuntimeSlot {};
};

[[nodiscard]] inline std::optional<int> lookupTriggerMap (const std::array<int, 128>& map, int value)
{
    if (value < 0 || value >= 128)
        return std::nullopt;

    const auto runtimeSlot = map[static_cast<std::size_t> (value)];
    return runtimeSlot >= 0 && runtimeSlot < 128 ? std::optional<int> { runtimeSlot } : std::nullopt;
}

[[nodiscard]] inline bool is7BitDataByte (std::uint8_t value)
{
    return value <= 0x7f;
}

[[nodiscard]] inline int unpackFour7BitBytes (const std::uint8_t* data)
{
    return static_cast<int> (data[0])
         | (static_cast<int> (data[1]) << 7)
         | (static_cast<int> (data[2]) << 14)
         | (static_cast<int> (data[3]) << 21);
}

[[nodiscard]] inline std::array<std::uint8_t, 4> packFour7BitBytes (int value)
{
    return {
        static_cast<std::uint8_t> (value & 0x7f),
        static_cast<std::uint8_t> ((value >> 7) & 0x7f),
        static_cast<std::uint8_t> ((value >> 14) & 0x7f),
        static_cast<std::uint8_t> ((value >> 21) & 0x7f)
    };
}

[[nodiscard]] inline bool isValidDurationAndAge (int durationSamples, int ageSamples)
{
    return durationSamples > 0
        && durationSamples <= noteMetaMaxPackedValue
        && ageSamples >= 0
        && ageSamples < durationSamples;
}

[[nodiscard]] inline std::optional<NoteMeta> decodeNoteMetaMessage (const std::uint8_t* data, std::size_t size)
{
    if (data == nullptr
        || size != noteMetaMessageSize
        || data[0] != 0xf0
        || data[1] != noteMetaVendorID
        || data[2] != noteMetaMessageID
        || data[15] != 0xf7)
        return std::nullopt;

    for (std::size_t index = 3; index < 15; ++index)
        if (! is7BitDataByte (data[index]))
            return std::nullopt;

    const auto channel = static_cast<int> (data[3]);
    const auto noteNumber = static_cast<int> (data[4]);

    if (channel < 1 || channel > 16 || noteNumber < 0 || noteNumber > 127)
        return std::nullopt;

    const auto durationSamples = unpackFour7BitBytes (data + 7);
    const auto ageSamples = unpackFour7BitBytes (data + 11);

    if (! isValidDurationAndAge (durationSamples, ageSamples))
        return std::nullopt;

    return NoteMeta {
        channel,
        noteNumber,
        static_cast<int> (data[5]),
        static_cast<int> (data[6]),
        durationSamples,
        ageSamples
    };
}

[[nodiscard]] inline std::array<std::uint8_t, noteMetaMessageSize> encodeNoteMetaMessage (const NoteMeta& meta)
{
    std::array<std::uint8_t, noteMetaMessageSize> bytes {};
    bytes[0] = 0xf0;
    bytes[1] = noteMetaVendorID;
    bytes[2] = noteMetaMessageID;
    bytes[3] = static_cast<std::uint8_t> (meta.channel);
    bytes[4] = static_cast<std::uint8_t> (meta.noteNumber);
    bytes[5] = static_cast<std::uint8_t> (meta.selectorA);
    bytes[6] = static_cast<std::uint8_t> (meta.selectorB);

    const auto duration = packFour7BitBytes (meta.durationSamples);
    const auto age = packFour7BitBytes (meta.ageSamples);

    for (std::size_t index = 0; index < 4; ++index)
    {
        bytes[7 + index] = duration[index];
        bytes[11 + index] = age[index];
    }

    bytes[15] = 0xf7;
    return bytes;
}

[[nodiscard]] inline bool isFutureDawPrivateSysExPrefix (const std::uint8_t* data, std::size_t size)
{
    return data != nullptr
        && size >= 3
        && data[0] == 0xf0
        && data[1] == noteMetaVendorID
        && data[2] == noteMetaMessageID;
}

[[nodiscard]] inline bool isShortMidi (const std::uint8_t* data, std::size_t size)
{
    return data != nullptr && size > 0 && size <= 3 && (data[0] & 0x80) != 0;
}

[[nodiscard]] inline bool isNoteOn (const std::uint8_t* data, std::size_t size)
{
    return size >= 3 && (data[0] & 0xf0) == 0x90 && data[2] != 0;
}

[[nodiscard]] inline bool isNoteOffLike (const std::uint8_t* data, std::size_t size)
{
    return size >= 3 && (((data[0] & 0xf0) == 0x80) || ((data[0] & 0xf0) == 0x90 && data[2] == 0));
}

[[nodiscard]] inline int midiChannelOneBased (const std::uint8_t statusByte)
{
    return static_cast<int> (statusByte & 0x0f) + 1;
}

class NoteMetaBridge
{
public:
    explicit NoteMetaBridge (ArticulationTriggerConfig triggerConfigToUse = {})
        : triggerConfig (triggerConfigToUse)
    {
        swallowedKeysHeld.fill (false);
    }

    void setTriggerConfig (ArticulationTriggerConfig nextConfig)
    {
        triggerConfig = nextConfig;
        activeKeyswitchRuntimeSlot = selectorUnset;
        swallowedKeysHeld.fill (false);
        clearPendingNoteMeta();
    }

    void reset()
    {
        pendingNoteMeta.reset();
        previousEventWasPendingNoteMeta = false;
        pendingNoteMetaSampleOffset = -1;
        activeKeyswitchRuntimeSlot = selectorUnset;
        swallowedKeysHeld.fill (false);
        nextSequence = 0;
    }

    void finishBlock()
    {
        clearPendingNoteMeta();
    }

    void processMidiEvent (int sampleOffset,
                           const std::uint8_t* data,
                           std::size_t size,
                           std::vector<BridgeOutputEvent>& output)
    {
        if (auto meta = decodeNoteMetaMessage (data, size))
        {
            if (triggerConfig.activeMode != ArticulationTriggerMode::chain)
            {
                clearPendingNoteMeta();
                return;
            }

            auto runtimeSlot = lookupTriggerMap (triggerConfig.chainSelectorToRuntimeSlot, meta->selectorA);

            if (! runtimeSlot.has_value())
            {
                clearPendingNoteMeta();
                return;
            }

            pendingNoteMeta = *meta;
            pendingNoteMeta->selectorA = *runtimeSlot;
            previousEventWasPendingNoteMeta = true;
            pendingNoteMetaSampleOffset = sampleOffset;
            return;
        }

        if (isFutureDawPrivateSysExPrefix (data, size))
        {
            clearPendingNoteMeta();
            return;
        }

        if (! isShortMidi (data, size))
        {
            clearPendingNoteMeta();
            return;
        }

        const auto noteNumber = size >= 2 ? static_cast<int> (data[1]) : -1;
        const auto channel = isShortMidi (data, size) ? midiChannelOneBased (data[0]) : 1;

        if (triggerConfig.activeMode == ArticulationTriggerMode::key
            && isNoteOn (data, size))
        {
            const auto keyswitchRuntimeSlot = lookupTriggerMap (triggerConfig.keyNoteToRuntimeSlot, noteNumber);

            if (keyswitchRuntimeSlot.has_value())
            {
                clearPendingNoteMeta();
                activeKeyswitchRuntimeSlot = *keyswitchRuntimeSlot;
                setSwallowedKeyHeld (channel, noteNumber, true);
                return;
            }
        }

        if (triggerConfig.activeMode == ArticulationTriggerMode::key
            && isNoteOffLike (data, size)
            && (isSwallowedKeyHeld (channel, noteNumber)
                || lookupTriggerMap (triggerConfig.keyNoteToRuntimeSlot, noteNumber).has_value()))
        {
            clearPendingNoteMeta();
            setSwallowedKeyHeld (channel, noteNumber, false);
            return;
        }

        if (isNoteOn (data, size))
        {
            if (previousEventWasPendingNoteMeta
                && pendingNoteMeta.has_value()
                && pendingNoteMetaSampleOffset == sampleOffset
                && pendingNoteMeta->channel == channel
                && pendingNoteMeta->noteNumber == noteNumber)
            {
                appendNoteMeta (sampleOffset, *pendingNoteMeta, output);
                appendShortMidi (sampleOffset, data, size, output);
                clearPendingNoteMeta();
                return;
            }

            clearPendingNoteMeta();

            if (triggerConfig.activeMode == ArticulationTriggerMode::key
                && activeKeyswitchRuntimeSlot >= 0)
            {
                appendNoteMeta (sampleOffset,
                                NoteMeta { channel, noteNumber, activeKeyswitchRuntimeSlot, 0, 0, 0 },
                                output);
                appendShortMidi (sampleOffset, data, size, output);
                return;
            }

            if (triggerConfig.activeMode == ArticulationTriggerMode::velocity)
            {
                const auto velocityRuntimeSlot = lookupTriggerMap (triggerConfig.velocityToRuntimeSlot, static_cast<int> (data[2]));

                if (velocityRuntimeSlot.has_value())
                {
                    appendNoteMeta (sampleOffset,
                                    NoteMeta { channel, noteNumber, *velocityRuntimeSlot, 0, 0, 0 },
                                    output);
                    appendShortMidi (sampleOffset, data, size, output);
                    return;
                }
            }
        }
        else
        {
            clearPendingNoteMeta();
        }

        appendShortMidi (sampleOffset, data, size, output);
    }

private:
    [[nodiscard]] static std::size_t swallowedKeyIndex (int channelOneBased, int noteNumber)
    {
        const auto channel = channelOneBased >= 1 && channelOneBased <= 16 ? channelOneBased - 1 : 0;
        const auto note = noteNumber >= 0 && noteNumber < 128 ? noteNumber : 0;
        return static_cast<std::size_t> ((channel * 128) + note);
    }

    [[nodiscard]] bool isSwallowedKeyHeld (int channelOneBased, int noteNumber) const
    {
        if (noteNumber < 0 || noteNumber >= 128)
            return false;

        return swallowedKeysHeld[swallowedKeyIndex (channelOneBased, noteNumber)];
    }

    void setSwallowedKeyHeld (int channelOneBased, int noteNumber, bool isHeld)
    {
        if (noteNumber < 0 || noteNumber >= 128)
            return;

        swallowedKeysHeld[swallowedKeyIndex (channelOneBased, noteNumber)] = isHeld;
    }

    void clearPendingNoteMeta()
    {
        pendingNoteMeta.reset();
        previousEventWasPendingNoteMeta = false;
        pendingNoteMetaSampleOffset = -1;
    }

    void appendNoteMeta (int sampleOffset, const NoteMeta& meta, std::vector<BridgeOutputEvent>& output)
    {
        BridgeOutputEvent event;
        event.sampleOffset = sampleOffset;
        event.sequence = nextSequence++;
        event.kind = BridgeOutputKind::noteMeta;
        event.noteMeta = meta;
        output.push_back (event);
    }

    void appendShortMidi (int sampleOffset,
                          const std::uint8_t* data,
                          std::size_t size,
                          std::vector<BridgeOutputEvent>& output)
    {
        BridgeOutputEvent event;
        event.sampleOffset = sampleOffset;
        event.sequence = nextSequence++;
        event.kind = BridgeOutputKind::shortMidi;
        event.midi.size = size > 3 ? 3 : size;

        for (std::size_t index = 0; index < event.midi.size; ++index)
            event.midi.bytes[index] = data[index];

        output.push_back (event);
    }

    ArticulationTriggerConfig triggerConfig;
    std::optional<NoteMeta> pendingNoteMeta;
    bool previousEventWasPendingNoteMeta = false;
    int pendingNoteMetaSampleOffset = -1;
    int activeKeyswitchRuntimeSlot = selectorUnset;
    std::uint64_t nextSequence = 0;
    std::array<bool, 16 * 128> swallowedKeysHeld {};
};
} // namespace cosimo::future_daw
