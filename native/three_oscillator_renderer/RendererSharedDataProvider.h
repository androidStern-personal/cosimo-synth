#pragma once

#include "RendererBridge.h"
#include "../../kit/native/shared_data/NativeSharedData.h"

namespace cosimo::three_osc::bridge
{
using builder_kit::shared_data::readNativeSharedData;

struct NativeSharedBlock
{
    SharedTableBlock tables;
    SharedMsegBlock msegs;
    void refresh (SharedDataReader read) noexcept
    {
        tables.refresh (read);
        msegs.refresh (read);
    }
};

inline const NativeSharedBlock& nativeSharedBlock() noexcept
{
    return builder_kit::shared_data::readNativeBlock<NativeSharedBlock>();
}

inline const SharedTableBlock& nativeSharedTableBlock() noexcept { return nativeSharedBlock().tables; }

inline std::int32_t sharedMsegSerialNative (std::int32_t input, std::int32_t session) noexcept
{
    return nativeSharedBlock().msegs.serial (input, session);
}

inline float sampleSharedMsegNative (std::int32_t input, std::int32_t session,
                                     std::int32_t serial, float position) noexcept
{
    return nativeSharedBlock().msegs.sample (input, session, serial, position);
}

inline std::int32_t renderSharedNative (Slice<float> floats, Slice<std::int32_t> ints) noexcept
{
    return nativeSharedTableBlock().render (floats, ints);
}

inline std::int32_t updateSharedTablesNative (std::int32_t session, Slice<std::int32_t> ints) noexcept
{
    return nativeSharedTableBlock().update (session, ints);
}

template <typename FloatSlice, typename IntSlice>
std::int32_t renderSharedGenerated (FloatSlice floats, IntSlice ints) noexcept
{
    return renderSharedNative ({ floats.elements, static_cast<std::int32_t> (floats.size()) },
                               { ints.elements, static_cast<std::int32_t> (ints.size()) });
}

template <typename IntSlice>
std::int32_t updateSharedTablesGenerated (std::int32_t session, IntSlice ints) noexcept
{
    return updateSharedTablesNative (session, { ints.elements, static_cast<std::int32_t> (ints.size()) });
}
}
