#include "native/CompleteSoundState.h"

#include <juce_audio_processors/juce_audio_processors.h>

#include <array>
#include <cerrno>
#include <charconv>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <limits>
#include <map>
#include <memory>
#include <set>
#include <sstream>
#include <string>
#include <string_view>
#include <system_error>

namespace
{
using HostedParameter = juce::HostedAudioProcessorParameter;

constexpr auto expectedMinimumDb = -100.0;
constexpr auto expectedMaximumDb = 35.0;
constexpr auto expectedSpanDb = expectedMaximumDb - expectedMinimumDb;
constexpr auto expectedDefaultNormalized = 100.0f / 135.0f;
const auto defaultTextToleranceDb = 0.5
    * static_cast<double> (std::nextafter (expectedDefaultNormalized, 1.0f)
                           - expectedDefaultNormalized)
    * expectedSpanDb;

int fail (std::string_view message)
{
    std::cerr << message << '\n';
    return 1;
}

int failParameter (std::string_view endpointID, std::string_view message)
{
    std::cerr << endpointID << ": " << message << '\n';
    return 1;
}

uint32_t stableVST3ParamID (std::string_view endpointID)
{
    uint32_t hash = 0;

    for (const auto character : endpointID)
        hash = (31u * hash) + static_cast<unsigned char> (character);

    // JUCE_USE_STUDIO_ONE_COMPATIBLE_PARAMETERS is enabled by default in the
    // production wrapper, reserving the upper half of Steinberg's ParamID range.
    return hash & 0x7fffffffu;
}

bool parseRuntimeParamID (const juce::String& value, uint32_t& result)
{
    const auto text = value.toStdString();
    const auto parsed = std::from_chars (text.data(), text.data() + text.size(), result);
    return parsed.ec == std::errc() && parsed.ptr == text.data() + text.size();
}

bool parseNumericText (const juce::String& value, double& result)
{
    const auto text = value.trim().toStdString();

    if (text.empty())
        return false;

    char* end = nullptr;
    errno = 0;
    result = std::strtod (text.c_str(), &end);
    return errno != ERANGE
        && end == text.c_str() + text.size()
        && std::isfinite (result);
}

std::string describeParameterText (HostedParameter& parameter)
{
    constexpr auto minimumNormalized = 0.0f;
    constexpr auto maximumNormalized = 1.0f;
    const auto defaultNormalized = parameter.getDefaultValue();
    const auto currentNormalized = parameter.getValue();
    const auto minimumText = parameter.getText (minimumNormalized, 64).trim().toStdString();
    const auto maximumText = parameter.getText (maximumNormalized, 64).trim().toStdString();
    const auto defaultText = parameter.getText (defaultNormalized, 64).trim().toStdString();
    const auto currentText = parameter.getText (currentNormalized, 64).trim().toStdString();
    std::ostringstream output;
    output << std::setprecision (std::numeric_limits<float>::max_digits10)
           << "minimumNormalized=" << minimumNormalized
           << " minimumText=" << std::quoted (minimumText)
           << " maximumNormalized=" << maximumNormalized
           << " maximumText=" << std::quoted (maximumText)
           << " defaultNormalized=" << defaultNormalized
           << " defaultText=" << std::quoted (defaultText)
           << " currentNormalized=" << currentNormalized
           << " currentText=" << std::quoted (currentText);
    return output.str();
}

std::string expectedTitle (std::string_view endpointID)
{
    struct Family
    {
        std::string_view endpointPrefix;
        std::string_view title;
    };

    static constexpr std::array families {
        Family { "laneGlobalFilter", "Global Filter" },
        Family { "laneDistortion", "Distortion" },
        Family { "laneOtt", "OTT" },
        Family { "laneChorus", "Chorus" },
        Family { "laneFlanger", "Flanger" },
        Family { "lanePhaser", "Phaser" },
        Family { "laneDelay", "Delay" },
        Family { "laneReverb", "Reverb" },
    };
    static constexpr std::string_view suffix = "OutputTrimDb";

    for (const auto& family : families)
    {
        if (endpointID.size() != family.endpointPrefix.size() + 1u + suffix.size()
            || endpointID.substr (0, family.endpointPrefix.size()) != family.endpointPrefix
            || endpointID.substr (family.endpointPrefix.size() + 1u) != suffix)
            continue;

        const auto ordinal = endpointID[family.endpointPrefix.size()];

        if (ordinal < '1' || ordinal > '5')
            return {};

        return std::string (family.title) + " " + ordinal + " Output Trim";
    }

    return {};
}

std::unique_ptr<juce::AudioPluginInstance> loadVST3 (
    const juce::File& pluginBundle,
    juce::String& error)
{
    juce::VST3PluginFormat format;
    juce::OwnedArray<juce::PluginDescription> descriptions;
    format.findAllTypesForFile (descriptions, pluginBundle.getFullPathName());

    if (descriptions.size() != 1)
    {
        error = "Expected exactly one VST3 class in " + pluginBundle.getFullPathName()
            + ", found " + juce::String (descriptions.size());
        return {};
    }

    return format.createInstanceFromDescription (*descriptions[0], 48000.0, 128, error);
}
}

int main (int argc, char** argv)
{
    if (argc != 2)
        return fail ("Usage: cosimo_t78_vst3_automation_probe <CosimoDesktopNative.vst3>");

    const juce::File pluginBundle (juce::String::fromUTF8 (argv[1]));

    if (! pluginBundle.isDirectory())
        return fail ("The VST3 bundle path does not name a directory");

    juce::ScopedJuceInitialiser_GUI juceInitialiser;
    juce::String loadError;
    auto plugin = loadVST3 (pluginBundle, loadError);

    if (plugin == nullptr)
        return fail ("Could not load CosimoDesktopNative.vst3: " + loadError.toStdString());

    // VST3PluginFormat materialises these hosted parameters from the loaded
    // component's Steinberg IEditController::getParameterInfo records.
    std::map<uint32_t, HostedParameter*> runtimeParameters;

    for (int index = 0; index < plugin->getParameters().size(); ++index)
    {
        auto* parameter = plugin->getHostedParameter (index);

        if (parameter == nullptr)
            return fail ("The VST3 host exposed a parameter without a hosted identity");

        uint32_t paramID = 0;

        if (! parseRuntimeParamID (parameter->getParameterID(), paramID))
            return fail ("The VST3 host exposed a non-numeric Steinberg ParamID");

        if (! runtimeParameters.emplace (paramID, parameter).second)
            return fail ("The VST3 host exposed duplicate Steinberg ParamIDs");
    }

    std::set<uint32_t> expectedParamIDs;
    std::set<std::string> expectedTitles;
    std::size_t endpointIndex = 0;

    for (const auto endpointID : cosimo::complete_sound::t78EffectOutputTrimParameterIDs)
    {
        const auto paramID = stableVST3ParamID (endpointID);
        const auto title = expectedTitle (endpointID);

        if (title.empty())
            return failParameter (endpointID, "has no canonical Output Trim title");
        if (! expectedParamIDs.emplace (paramID).second)
            return failParameter (endpointID, "collides with another canonical VST3 ParamID");
        if (! expectedTitles.emplace (title).second)
            return failParameter (endpointID, "collides with another canonical VST3 title");

        const auto runtime = runtimeParameters.find (paramID);

        if (runtime == runtimeParameters.end())
            return failParameter (endpointID, "is missing from the runtime VST3 parameter list");

        auto& parameter = *runtime->second;

        if (parameter.getParameterID() != juce::String (paramID))
            return failParameter (endpointID, "reported the wrong stable Steinberg ParamID");
        if (parameter.getName (256).toStdString() != title)
            return failParameter (endpointID, "reported the wrong VST3 title");
        if (parameter.getLabel() != "dB")
            return failParameter (endpointID, "reported a unit other than dB");

        double minimumTextDb = 0.0;
        double maximumTextDb = 0.0;

        if (! parseNumericText (parameter.getText (0.0f, 64), minimumTextDb)
            || ! parseNumericText (parameter.getText (1.0f, 64), maximumTextDb)
            || minimumTextDb != expectedMinimumDb
            || maximumTextDb != expectedMaximumDb)
            return failParameter (endpointID,
                                  "did not map its normalized range to -100 dB through +35 dB; "
                                      + describeParameterText (parameter));

        const auto defaultNormalized = parameter.getDefaultValue();
        const auto reconstructedDefaultDb = expectedMinimumDb
            + (expectedSpanDb * static_cast<double> (defaultNormalized));
        double defaultTextDb = 0.0;

        if (std::fabs (defaultNormalized - expectedDefaultNormalized)
                > std::numeric_limits<float>::epsilon()
            || ! parseNumericText (parameter.getText (defaultNormalized, 64), defaultTextDb)
            || std::fabs (reconstructedDefaultDb) > defaultTextToleranceDb
            || std::fabs (defaultTextDb) > defaultTextToleranceDb)
            return failParameter (endpointID,
                                  "did not report 0 dB as its exact default; "
                                      + describeParameterText (parameter));
        if (parameter.isDiscrete()
            || parameter.getNumSteps() != juce::AudioProcessor::getDefaultNumParameterSteps())
            return failParameter (endpointID, "did not report a continuous VST3 range");
        if (! parameter.isAutomatable())
            return failParameter (endpointID, "did not set Steinberg's automation flag");

        const auto automationValue = 0.2f + (0.1f * static_cast<float> (endpointIndex % 5u));
        parameter.beginChangeGesture ();
        parameter.setValueNotifyingHost (automationValue);
        parameter.endChangeGesture ();

        if (std::fabs (parameter.getValue () - automationValue)
            > std::numeric_limits<float>::epsilon())
            return failParameter (endpointID, "did not read back its hosted automation write");

        ++endpointIndex;
    }

    std::cout << "validated=" << expectedParamIDs.size() << '\n';
    return expectedParamIDs.size() == cosimo::complete_sound::t78EffectOutputTrimParameterIDs.size()
        ? 0
        : 1;
}
