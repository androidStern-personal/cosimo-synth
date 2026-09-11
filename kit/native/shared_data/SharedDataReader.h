#pragma once

#include "SharedInputBlock.h"
#include <cstring>
#include <limits>

namespace builder_kit::shared_data
{
// Resolves each declared input once for a render block. A returned View is
// borrowed and must not survive that block. Sample reads never resolve storage.
template <std::size_t InputCount>
class BlockReader
{
public:
    void refresh (Reader read) noexcept
    {
        inputs.refresh (read, 0, [] (View view) { return view; });
    }

    View readForAudioBlock (std::int32_t input) const noexcept
    {
        return input >= 0 && static_cast<std::size_t> (input) < InputCount ? inputs[input] : View {};
    }

    std::int32_t byteSize (std::int32_t input) const noexcept
    {
        const auto bytes = readForAudioBlock (input).byteSize;
        constexpr auto maximum = static_cast<std::size_t> (std::numeric_limits<std::int32_t>::max());
        return static_cast<std::int32_t> (bytes < maximum ? bytes : maximum);
    }

    std::int32_t size (std::int32_t input) const noexcept { return byteSize (input) / 4; }

    float readFloat (std::int32_t input, std::int32_t index) const noexcept
    {
        return readWord<float> (input, index);
    }

    std::int32_t readInt (std::int32_t input, std::int32_t index) const noexcept
    {
        return readWord<std::int32_t> (input, index);
    }

private:
    template <typename Word> Word readWord (std::int32_t input, std::int32_t index) const noexcept
    {
        const auto view = readForAudioBlock (input);
        if (view.data == nullptr || index < 0 || static_cast<std::size_t> (index) >= view.byteSize / sizeof (Word))
            return {};
        Word value;
        std::memcpy (&value, static_cast<const unsigned char*> (view.data) + static_cast<std::size_t> (index) * sizeof (Word), sizeof (value));
        return value;
    }

    InputBlock<View, InputCount> inputs;
};
}
