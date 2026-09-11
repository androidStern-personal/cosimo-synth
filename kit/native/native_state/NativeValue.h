#pragma once

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <type_traits>

namespace builder_kit::native_state
{
// Wire helpers are used by generated codecs. Offsets are 32-bit words, so a
// float64 occupies two words. memcpy avoids alignment and aliasing assumptions.
template <typename Scalar>
Scalar readWord (const void* bytes, std::size_t wordOffset) noexcept
{
    Scalar result;
    std::memcpy (&result, static_cast<const unsigned char*> (bytes) + wordOffset * 4, sizeof (result));
    return result;
}

inline bool decodeBool (const void* bytes, std::size_t offset, bool& result) noexcept
{
    const auto word = readWord<std::int32_t> (bytes, offset);
    if (word != 0 && word != 1) return false;
    result = word != 0;
    return true;
}

inline bool decodeInt (const void* bytes, std::size_t offset, std::int32_t minimum,
                       std::int32_t maximum, std::int32_t& result) noexcept
{
    const auto word = readWord<std::int32_t> (bytes, offset);
    if (word < minimum || word > maximum) return false;
    result = word;
    return true;
}

template <typename Float>
bool decodeFloat (const void* bytes, std::size_t offset, Float minimum, Float maximum, Float& result) noexcept
{
    static_assert (std::is_same_v<Float, float> || std::is_same_v<Float, double>);
    const auto word = readWord<Float> (bytes, offset);
    using Bits = std::conditional_t<sizeof (Float) == 4, std::uint32_t, std::uint64_t>;
    constexpr Bits exponent = sizeof (Float) == 4 ? Bits (0x7f800000) : Bits (0x7ff0000000000000ULL);
    // Keep rejecting NaN/Infinity even when the audio build uses fast-math.
    const auto bits = readWord<Bits> (bytes, offset);
    if ((bits & exponent) == exponent || word < minimum || word > maximum) return false;
    result = word;
    return true;
}

template <typename Enum>
bool decodeEnum (const void* bytes, std::size_t offset, std::int32_t count, Enum& result) noexcept
{
    static_assert (std::is_enum_v<Enum>);
    std::int32_t word;
    if (count <= 0 || ! decodeInt (bytes, offset, 0, count - 1, word)) return false;
    result = static_cast<Enum> (word);
    return true;
}

// Codegen owns the finite type, codec and input identity. Authors receive only
// a typed immutable snapshot; storage ownership and synchronization stay here.
// Codec::decode must validate the complete fixed-width payload without retaining
// its pointer. The returned copy has no lifetime tie to the audio block.
template <typename Snapshot, typename Codec, typename Data>
class Value
{
public:
    static_assert (std::is_trivially_copyable_v<Snapshot>);

    constexpr Value (std::int32_t inputIndex, Snapshot defaultValue) noexcept
        : input (inputIndex), initial (defaultValue) {}

    Snapshot readForAudioBlock() const noexcept
    {
        const auto view = Data::readForAudioBlock (input);
        auto result = initial;
        if (view.data != nullptr && view.byteSize == Codec::wordCount * 4 && Codec::decode (view.data, result))
            return result;
        return initial;
    }

private:
    std::int32_t input;
    Snapshot initial;
};
}
