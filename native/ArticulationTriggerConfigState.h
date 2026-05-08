#pragma once

#include "FutureDawNoteMetaBridge.h"
#include "choc/text/choc_JSON.h"

#include <string>
#include <string_view>

namespace cosimo::future_daw
{
constexpr auto articulationTriggerConfigStateKey = "articulationTriggerConfig.v1";

inline ArticulationTriggerMode triggerModeFromString (std::string_view mode)
{
    if (mode == "key")
        return ArticulationTriggerMode::key;

    if (mode == "vel")
        return ArticulationTriggerMode::velocity;

    return ArticulationTriggerMode::chain;
}

inline int normalizeRuntimeSlot (int value)
{
    return value >= 0 && value < 128 ? value : selectorUnset;
}

inline void fillTriggerMapFromJSON (std::array<int, 128>& target, const choc::value::ValueView& value)
{
    target.fill (selectorUnset);

    if (! value.isArray())
        return;

    const auto valueCount = static_cast<int> (value.size());

    for (int index = 0; index < 128 && index < valueCount; ++index)
        target[static_cast<std::size_t> (index)] = normalizeRuntimeSlot (value[static_cast<uint32_t> (index)].getWithDefault (selectorUnset));
}

inline ArticulationTriggerConfig createTriggerConfigFromJSON (const choc::value::ValueView& value)
{
    auto config = ArticulationTriggerConfig {};

    if (! value.isObject())
        return config;

    config.activeMode = triggerModeFromString (value["activeMode"].toString());
    fillTriggerMapFromJSON (config.chainSelectorToRuntimeSlot, value["chain"]);
    fillTriggerMapFromJSON (config.keyNoteToRuntimeSlot, value["key"]);
    fillTriggerMapFromJSON (config.velocityToRuntimeSlot, value["velocity"]);
    config.velocityToRuntimeSlot[0] = selectorUnset;
    return config;
}

inline ArticulationTriggerConfig createTriggerConfigFromJSONString (const std::string& serializedConfig)
{
    try
    {
        return createTriggerConfigFromJSON (choc::json::parse (serializedConfig));
    }
    catch (...)
    {
        return {};
    }
}

inline ArticulationTriggerConfig createTriggerConfigFromStoredValue (const choc::value::ValueView& value)
{
    if (value.isString())
        return createTriggerConfigFromJSONString (value.toString());

    if (value.isObject())
        return createTriggerConfigFromJSON (value);

    return {};
}
} // namespace cosimo::future_daw
