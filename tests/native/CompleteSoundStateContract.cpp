#include "native/CompleteSoundState.h"

#include <set>
#include <string>

int main()
{
    static_assert (cosimo::complete_sound::version == 2);
    static_assert (cosimo::complete_sound::t78EffectOutputTrimParameterIDs.size() == 40);

    std::set<std::string> parameters;
    for (const auto endpointID : cosimo::complete_sound::t78EffectOutputTrimParameterIDs)
        parameters.emplace (endpointID);

    if (parameters.size() != 40)
        return 1;

    const auto contains = [&parameters] (std::string_view endpointID)
    {
        return parameters.count (std::string (endpointID)) == 1;
    };

    if (! cosimo::complete_sound::isCurrentT78CompleteSoundState (2, contains))
        return 2;

    if (cosimo::complete_sound::isCurrentT78CompleteSoundState (1, contains))
        return 3;
    if (cosimo::complete_sound::isCurrentT78CompleteSoundState (2.5, contains))
        return 4;

    parameters.erase ("laneDelay3OutputTrimDb");
    if (cosimo::complete_sound::isCurrentT78CompleteSoundState (2, contains))
        return 5;

    return 0;
}
