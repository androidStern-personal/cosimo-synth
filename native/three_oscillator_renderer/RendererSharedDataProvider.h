#pragma once

#include "RendererBridge.h"
#include "cmajor/helpers/cmaj_PatchSharedData.h"

namespace cosimo::three_osc::bridge
{
inline SharedDataView readNativeSharedData (std::int32_t input) noexcept
{
    return { cmaj::PatchSharedData::data (input),
             static_cast<std::size_t> (cmaj::PatchSharedData::byteSize (input)) };
}

inline std::int32_t renderSharedNative (Slice<float> floats, Slice<std::int32_t> ints) noexcept
{
    return renderShared (floats, ints, readNativeSharedData);
}

inline std::int32_t updateSharedTablesNative (std::int32_t session, Slice<std::int32_t> ints) noexcept
{
    return updateSharedTables (session, ints, readNativeSharedData);
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
