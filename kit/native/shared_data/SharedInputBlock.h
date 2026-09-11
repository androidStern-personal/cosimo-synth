#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

namespace builder_kit::shared_data
{
struct View { const void* data; std::size_t byteSize; };
using Reader = View (*) (std::int32_t input) noexcept;

// A block borrows immutable host allocations. Refresh at every host render
// scope; validators describe the consumer's format without copying payloads.
template <typename Value, std::size_t Count>
class InputBlock
{
public:
    template <typename Validate>
    void refresh (Reader read, std::int32_t firstInput, Validate validate) noexcept
    {
        values = {};
        if (read != nullptr)
            for (std::size_t i = 0; i < Count; ++i)
                values[i] = validate (read (firstInput + static_cast<std::int32_t> (i)));
    }

    const Value& operator[] (std::size_t index) const noexcept { return values[index]; }

private:
    std::array<Value, Count> values {};
};
}
