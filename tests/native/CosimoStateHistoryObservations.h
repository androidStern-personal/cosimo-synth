#pragma once
#include "RendererSharedDataProvider.h"

// Observe an actual renderer input, forwarding every call to the production
// shared renderer. This checks sounding pitch without adding a DSP endpoint.
inline thread_local float historyPhaseIncrement = 0;
inline thread_local std::array<float,2> historyMsegQuarter { -1.0f, -1.0f };
inline thread_local std::array<std::int32_t,2> historyMsegSerial {};
inline std::int32_t historyRenderShared(cosimo::three_osc::bridge::Slice<float> floats,
                                       cosimo::three_osc::bridge::Slice<std::int32_t> ints) noexcept
{
    using namespace cosimo::three_osc::bridge;
    historyPhaseIncrement = 0;
    if (floats.elements && floats.size >= packedFloatCount)
        for (int index = 0; index < voiceOscillatorCount; ++index)
            if (floats.elements[basePhaseIncrementOffset + index] > historyPhaseIncrement)
                historyPhaseIncrement = floats.elements[basePhaseIncrementOffset + index];
    for (int shape = 0; shape < 2; ++shape)
    {
        const auto input = 3 + shape;
        const auto* data = cmaj::PatchSharedData::data(input);
        historyMsegQuarter[shape] = -1.0f;
        historyMsegSerial[shape] = 0;
        if (data && cmaj::PatchSharedData::byteSize(input) >= 16)
        {
            std::array<std::int32_t,4> header;
            std::memcpy(header.data(), data, 16);
            if (header[0] == 0x4d534547 && header[2] > 0 && sharedMsegSerialNative(input, header[1]) == header[2])
            {
                historyMsegSerial[shape] = header[2];
                historyMsegQuarter[shape] = sampleSharedMsegNative(input, header[1], header[2], 0.25f);
            }
        }
    }
    return renderSharedNative(floats, ints);
}
template <typename Floats, typename Ints>
std::int32_t historyRenderSharedGenerated(Floats floats, Ints ints) noexcept
{
    return historyRenderShared({floats.elements, static_cast<std::int32_t>(floats.size())},
                               {ints.elements, static_cast<std::int32_t>(ints.size())});
}
