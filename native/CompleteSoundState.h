#pragma once

#include <array>
#include <string_view>

namespace cosimo::complete_sound
{

/** T78 is a greenfield complete-sound cut; earlier native chunks are invalid. */
inline constexpr int version = 2;

/** Every resident per-effect Output Trim host identity required by T78 state. */
inline constexpr std::array<std::string_view, 40> t78EffectOutputTrimParameterIDs {{
    "laneGlobalFilter1OutputTrimDb",
    "laneGlobalFilter2OutputTrimDb",
    "laneGlobalFilter3OutputTrimDb",
    "laneGlobalFilter4OutputTrimDb",
    "laneGlobalFilter5OutputTrimDb",
    "laneDistortion1OutputTrimDb",
    "laneDistortion2OutputTrimDb",
    "laneDistortion3OutputTrimDb",
    "laneDistortion4OutputTrimDb",
    "laneDistortion5OutputTrimDb",
    "laneOtt1OutputTrimDb",
    "laneOtt2OutputTrimDb",
    "laneOtt3OutputTrimDb",
    "laneOtt4OutputTrimDb",
    "laneOtt5OutputTrimDb",
    "laneChorus1OutputTrimDb",
    "laneChorus2OutputTrimDb",
    "laneChorus3OutputTrimDb",
    "laneChorus4OutputTrimDb",
    "laneChorus5OutputTrimDb",
    "laneFlanger1OutputTrimDb",
    "laneFlanger2OutputTrimDb",
    "laneFlanger3OutputTrimDb",
    "laneFlanger4OutputTrimDb",
    "laneFlanger5OutputTrimDb",
    "lanePhaser1OutputTrimDb",
    "lanePhaser2OutputTrimDb",
    "lanePhaser3OutputTrimDb",
    "lanePhaser4OutputTrimDb",
    "lanePhaser5OutputTrimDb",
    "laneDelay1OutputTrimDb",
    "laneDelay2OutputTrimDb",
    "laneDelay3OutputTrimDb",
    "laneDelay4OutputTrimDb",
    "laneDelay5OutputTrimDb",
    "laneReverb1OutputTrimDb",
    "laneReverb2OutputTrimDb",
    "laneReverb3OutputTrimDb",
    "laneReverb4OutputTrimDb",
    "laneReverb5OutputTrimDb",
}};

/** Apply one caller-owned presence/value predicate to the complete T78 bank. */
template <typename HasParameter>
bool hasEveryT78EffectOutputTrimParameter (HasParameter&& hasParameter)
{
    for (const auto endpointID : t78EffectOutputTrimParameterIDs)
        if (! hasParameter (endpointID))
            return false;

    return true;
}

/** Accept only this greenfield version with its complete resident trim bank. */
template <typename CandidateVersion, typename HasParameter>
bool isCurrentT78CompleteSoundState (
    const CandidateVersion& candidateVersion,
    HasParameter&& hasParameter)
{
    return candidateVersion == version
        && hasEveryT78EffectOutputTrimParameter (hasParameter);
}

} // namespace cosimo::complete_sound
