#pragma once

#include "ArticulationTriggerConfigState.h"
#include <utility>

namespace cosimo::future_daw
{
// The state framework owns routing and document fencing. This application
// adapter recognizes the existing articulation payload and calls the host's
// existing pending-configuration setter; it does not claim audio-thread use.
template <typename Sink>
auto createArticulationStateEffectHandler (Sink sink)
{
    return [sink = std::move (sink)] (std::string_view name, const choc::value::ValueView& value) -> bool
    {
        if (name != "cosimo.articulation-trigger-config" || ! value.isString())
            return false;

        choc::value::Value parsed;
        try { parsed = choc::json::parse (value.getString()); }
        catch (const choc::json::ParseError&) { return false; }
        if (! parsed.isObject())
            return false;

        sink (createTriggerConfigFromJSON (parsed));
        return true;
    };
}
}
