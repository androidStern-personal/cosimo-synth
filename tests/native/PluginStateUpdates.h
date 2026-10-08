#pragma once

#include "choc/containers/choc_Value.h"

namespace native_test
{
// A state update marks a value that has not changed since the previous update
// with `valueUnchanged: true` instead of resending it. Fold each attach or
// update body onto the state before it so probes read complete field values.
inline choc::value::Value foldPluginState (const choc::value::ValueView& previous, const choc::value::ValueView& body)
{
    choc::value::Value next (body["state"]);
    if (body["kind"].toString() != "update" || ! previous.isObject() || ! next["fields"].isObject())
        return next;

    auto fields = choc::value::createObject ("");
    const auto incoming = next["fields"];
    for (uint32_t index = 0; index < incoming.size(); ++index)
    {
        const auto member = incoming.getObjectMemberAt (index);
        choc::value::Value field (member.value);
        const auto before = previous["fields"].isObject() && previous["fields"].hasObjectMember (member.name)
                              ? previous["fields"][member.name] : choc::value::ValueView();
        if (field.isObject() && field.hasObjectMember ("valueUnchanged") && before.isObject() && before.hasObjectMember ("value"))
            field.setMember ("value", before["value"]);
        fields.addMember (member.name, field);
    }
    next.setMember ("fields", fields);
    return next;
}
}
