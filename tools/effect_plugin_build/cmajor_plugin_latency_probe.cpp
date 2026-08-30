#include <charconv>
#include <iostream>
#include <memory>
#include <string_view>

#include "cmajor_plugin.cpp"

namespace
{
int fail (std::string_view message)
{
    std::cerr << message << '\n';
    return 1;
}

bool parseExpectedLatency (const char* text, int& result)
{
    const std::string_view value (text);
    const auto parsed = std::from_chars (value.data(), value.data() + value.size(), result);
    return parsed.ec == std::errc() && parsed.ptr == value.data() + value.size() && result >= 0;
}
}

int main (int argc, char** argv)
{
    if (argc != 2)
        return fail ("Usage: cosimo_generated_latency_probe <expected-samples>");

    int expectedLatency = 0;

    if (! parseExpectedLatency (argv[1], expectedLatency))
        return fail ("Expected latency must be a non-negative integer");

    using GeneratedPlugin = cmaj::plugin::GeneratedPlugin<::COSIMO_GENERATED_INFO_CLASS>;

    juce::ScopedJuceInitialiser_GUI juceInitialiser;
    std::unique_ptr<juce::AudioProcessor> processor (createPluginFilter());

    if (processor == nullptr)
        return fail ("Generated JUCE factory returned no plugin");

    const auto creationLatency = processor->getLatencySamples();

    if (creationLatency != expectedLatency)
        return fail ("Generated JUCE factory reported the wrong creation latency");

    auto* plugin = static_cast<GeneratedPlugin*> (processor.get());

    cmaj::Patch::LoadParams reloadParams;

    if (! plugin->prepareManifest (reloadParams, {}))
        return fail ("Generated JUCE plugin could not prepare its reload manifest");

    plugin->setLatencySamples (expectedLatency == 0 ? 1 : 0);

    if (! plugin->patch->loadPatch (reloadParams, true))
        return fail ("Generated JUCE patch reload failed");

    const auto reloadLatency = plugin->getLatencySamples();

    if (reloadLatency != expectedLatency)
    {
        std::cerr << "expected=" << expectedLatency << " actual=" << reloadLatency << '\n';
        return fail ("Generated JUCE reload callback did not restore the declared latency");
    }

    std::cout << "creation=" << creationLatency << " reload=" << reloadLatency << '\n';
    return 0;
}
