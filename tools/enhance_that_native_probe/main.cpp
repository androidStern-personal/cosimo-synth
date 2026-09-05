#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_cryptography/juce_cryptography.h>

#include <array>
#include <charconv>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <initializer_list>
#include <iostream>
#include <limits>
#include <map>
#include <memory>
#include <string_view>
#include <utility>

namespace
{
using Sound = std::array<float, 8>;
using Parameter = juce::HostedAudioProcessorParameter;
constexpr double sampleRate = 48000.0;
constexpr int blockSize = 128;
constexpr float normalizedTolerance = 1.0e-6f;

struct Control
{
    const char* endpoint;
    const char* title;
    const char* unit;
    float minimum;
    float maximum;
    float initial;
    int choices;
    std::array<const char*, 3> labels;

    float defaultNormalized() const { return (initial - minimum) / (maximum - minimum); }
};

// Independent product expectations, not generated from the candidate under test.
constexpr std::array<Control, 8> controls {{
    { "freqHzIn", "Frequency", "Hz", 20.0f, 20000.0f, 130.0f, 0, {} },
    { "qIn", "Q", "", 0.1f, 10.0f, 0.71f, 0, {} },
    { "modeIn", "Routing", "", 0.0f, 1.0f, 0.0f, 2, { "Stereo", "Mid/Side", nullptr } },
    { "midAmountIn", "Amount / Mid", "", 0.0f, 1.0f, 0.0f, 0, {} },
    { "sideAmountIn", "Side", "", 0.0f, 1.0f, 0.0f, 0, {} },
    { "curveIn", "Character", "", 0.0f, 1.0f, 1.0f, 2, { "Tube", "Solid", nullptr } },
    { "saturationModeIn", "Intensity", "", 0.0f, 1.0f, 0.0f, 2, { "Subtle", "Medium", nullptr } },
    { "shapeIn", "Shape", "", 0.0f, 2.0f, 1.0f, 3, { "Low", "Bell", "High" } },
}};

uint32_t stableID(std::string_view endpoint)
{
    uint32_t hash = 0;
    for (const auto character : endpoint)
        hash = 31u * hash + static_cast<unsigned char>(character);
    // Pinned JUCE: hashCode(), with Studio One compatibility enabled by default.
    return hash & 0x7fffffffu;
}

juce::var values(const Sound& sound)
{
    juce::Array<juce::var> result;
    for (const auto value : sound)
        result.add(std::isfinite(value) ? juce::var(value) : juce::var("non-finite"));
    return result;
}

class Report
{
public:
    explicit Report(const juce::File& directory)
        : root(directory), log(directory.getChildFile("events.jsonl").getFullPathName().toStdString()) {}

    bool isOpen() const { return log.is_open(); }

    void emit(const char* kind, const juce::String& stage,
              std::initializer_list<std::pair<const char*, juce::var>> fields = {})
    {
        auto object = std::make_unique<juce::DynamicObject>();
        object->setProperty("kind", kind);
        object->setProperty("stage", stage);
        for (const auto& field : fields)
            object->setProperty(field.first, field.second);
        const auto line = juce::JSON::toString(juce::var(object.release()), true).toStdString();
        log << line << std::endl;
        std::cout << line << std::endl;
    }

    bool check(bool passed, const juce::String& stage, const juce::String& detail)
    {
        ++assertions;
        if (!passed)
            ++failures;
        emit("assertion", stage, {{ "passed", passed }, { "detail", detail }});
        return passed;
    }

    bool save(const juce::String& name, const juce::MemoryBlock& data)
    {
        const auto file = root.getChildFile(name + ".bin");
        const bool valid = data.getSize() > 0 && data.getSize() <= 16u * 1024u * 1024u;
        if (!check(valid, name, "Nonempty state, at most 16 MiB"))
            return false;
        const bool written = !file.exists() && file.replaceWithData(data.getData(), data.getSize());
        emit("state", name, {{ "bytes", static_cast<juce::int64>(data.getSize()) },
                              { "sha256", juce::SHA256(data).toHexString() }});
        return check(written, name, "State evidence written without replacing an existing file");
    }

    int finish()
    {
        emit("summary", "complete", {{ "assertions", assertions }, { "failures", failures },
            { "editorOpened", false }, { "audioDeviceOpened", false },
            { "editorNotificationsProven", false }});
        return failures == 0 && log.good() ? 0 : 1;
    }

private:
    juce::File root;
    std::ofstream log;
    int assertions = 0;
    int failures = 0;
};

bool sameValue(size_t index, float actual, float expected)
{
    return std::isfinite(actual) && (controls[index].choices > 0
        ? actual == expected : std::abs(actual - expected) <= normalizedTolerance);
}

class Host
{
public:
    explicit Host(Report& output) : report(output), audio(2, blockSize) {}
    ~Host() { if (prepared) plugin->releaseResources(); }

    bool load(const juce::File& bundle, const juce::String& stage)
    {
        juce::VST3PluginFormat format;
        juce::OwnedArray<juce::PluginDescription> descriptions;
        format.findAllTypesForFile(descriptions, bundle.getFullPathName());
        if (!report.check(descriptions.size() == 1, stage, "Exactly one VST3 class"))
            return false;
        const auto& description = *descriptions[0];
        if (!report.check(description.name == "Enhance That" && description.manufacturerName == "Cosimo"
                          && !description.isInstrument, stage, "Enhance That effect by Cosimo"))
            return false;
        juce::String error;
        plugin = format.createInstanceFromDescription(description, sampleRate, blockSize, error);
        if (!report.check(plugin != nullptr, stage, "Create exact-path instance: " + error))
            return false;
        if (!report.check(plugin->getTotalNumInputChannels() == 2 && plugin->getTotalNumOutputChannels() == 2,
                          stage, "Stereo input and output"))
            return false;
        plugin->setNonRealtime(true);
        plugin->prepareToPlay(sampleRate, blockSize);
        prepared = true;
        return inventory(stage);
    }

    Sound current() const
    {
        Sound result {};
        for (size_t index = 0; index < controls.size(); ++index)
        {
            const auto* parameter = find(index);
            result[index] = parameter != nullptr ? parameter->getValue() : std::numeric_limits<float>::quiet_NaN();
        }
        return result;
    }

    bool write(const Sound& target, const juce::String& stage)
    {
        for (size_t index = 0; index < controls.size(); ++index)
        {
            auto* parameter = find(index);
            if (!report.check(parameter != nullptr, stage, juce::String(controls[index].endpoint) + " available for host write"))
                return false;
            // Outgoing host writes only. Do not count these as editor notifications.
            parameter->setValue(target[index]);
        }
        return settle(target, stage);
    }

    bool settle(const Sound& target, const juce::String& stage)
    {
        const auto started = std::chrono::steady_clock::now();
        const auto deadline = started + std::chrono::seconds(2);
        auto readbackCompleted = started;
        int consecutive = 0;
        int blocks = 0;
        bool finite = true;
        Sound actual {};
        do
        {
            // Parameter dispatch and Cmajor state replacement are asynchronous.
            // Reacquire hosted handles after every pump; restart may rebuild them.
            juce::MessageManager::getInstance()->runDispatchLoopUntil(5);
            finite = process() && finite;
            actual = current();
            readbackCompleted = std::chrono::steady_clock::now();
            bool matches = true;
            for (size_t index = 0; index < controls.size(); ++index)
                matches = sameValue(index, actual[index], target[index]) && matches;
            consecutive = matches ? consecutive + 1 : 0;
            ++blocks;
        }
        while (finite && (blocks < 32 || consecutive < 8) && readbackCompleted < deadline);

        report.emit("values", stage, {{ "expected", values(target) }, { "actual", values(actual) },
            { "processedBlocks", blocks }, { "stableBlocks", consecutive },
            { "readbackElapsedMs", std::chrono::duration<double, std::milli>(readbackCompleted - started).count() }});
        bool passed = report.check(finite, stage, "All directly processed output samples are finite");
        passed = report.check(blocks >= 32 && consecutive >= 8 && readbackCompleted < deadline,
                              stage, "Values settle before the two-second deadline") && passed;
        for (size_t index = 0; index < controls.size(); ++index)
            passed = report.check(sameValue(index, actual[index], target[index]), stage,
                                  juce::String(controls[index].endpoint) + " normalized readback") && passed;
        return passed;
    }

    juce::MemoryBlock state()
    {
        juce::MemoryBlock result;
        plugin->getStateInformation(result);
        return result;
    }

    bool restore(const juce::MemoryBlock& saved, const Sound& expected, const juce::String& stage)
    {
        report.emit("restore-input", stage, {{ "sha256", juce::SHA256(saved).toHexString() }});
        plugin->setStateInformation(saved.getData(), static_cast<int>(saved.getSize()));
        const bool restored = settle(expected, stage);
        const auto captured = state();
        const bool persisted = report.save(stage, captured);
        report.emit("state-comparison", stage, {{ "identicalBytes", captured == saved }});
        // Host-visible values are the pass criterion. Byte differences are retained
        // for classification and are not silently equated with a changed sound.
        return restored && persisted;
    }

private:
    Parameter* find(size_t index) const
    {
        const auto expected = juce::String(stableID(controls[index].endpoint));
        for (int parameterIndex = 0; parameterIndex < plugin->getParameters().size(); ++parameterIndex)
            if (auto* parameter = plugin->getHostedParameter(parameterIndex))
                if (parameter->getParameterID() == expected)
                    return parameter;
        return nullptr;
    }

    bool inventory(const juce::String& stage)
    {
        std::map<uint32_t, Parameter*> parameters;
        bool passed = true;
        for (int index = 0; index < plugin->getParameters().size(); ++index)
        {
            auto* parameter = plugin->getHostedParameter(index);
            if (!report.check(parameter != nullptr, stage, "Every parameter has a hosted identity"))
                return false;
            const auto idText = parameter->getParameterID().toStdString();
            uint32_t id = 0;
            const auto parsed = std::from_chars(idText.data(), idText.data() + idText.size(), id);
            if (!report.check(parsed.ec == std::errc() && parsed.ptr == idText.data() + idText.size()
                              && parameters.emplace(id, parameter).second, stage, "Unique numeric Steinberg ParamID: " + parameter->getParameterID()))
                return false;
            report.emit("parameter", stage, {{ "id", parameter->getParameterID() }, { "title", parameter->getName(256) },
                { "unit", parameter->getLabel() }, { "automatable", parameter->isAutomatable() },
                { "discrete", parameter->isDiscrete() }, { "steps", parameter->getNumSteps() },
                { "defaultNormalized", parameter->getDefaultValue() },
                { "minimumText", parameter->getText(0.0f, 128) }, { "maximumText", parameter->getText(1.0f, 128) }});
        }
        Sound defaults {};
        for (size_t index = 0; index < controls.size(); ++index)
        {
            const auto& control = controls[index];
            const auto found = parameters.find(stableID(control.endpoint));
            if (!report.check(found != parameters.end(), stage, juce::String(control.endpoint) + " stable ID present"))
                return false;
            auto& parameter = *found->second;
            parameters.erase(found);
            passed = report.check(parameter.getName(256) == control.title && parameter.getLabel() == control.unit,
                                  stage, juce::String(control.endpoint) + " title and unit") && passed;
            const auto steps = control.choices > 0 ? control.choices : juce::AudioProcessor::getDefaultNumParameterSteps();
            passed = report.check(parameter.isAutomatable() && parameter.isDiscrete() == (control.choices > 0)
                                  && parameter.getNumSteps() == steps, stage,
                                  juce::String(control.endpoint) + " automation flag and discrete steps") && passed;
            defaults[index] = control.defaultNormalized();
            passed = report.check(sameValue(index, parameter.getDefaultValue(), defaults[index]), stage,
                                  juce::String(control.endpoint) + " declared default") && passed;
            if (control.choices > 0)
            {
                for (int choice = 0; choice < control.choices; ++choice)
                {
                    const auto normalized = static_cast<float>(choice) / static_cast<float>(control.choices - 1);
                    passed = report.check(parameter.getText(normalized, 128) == control.labels[static_cast<size_t>(choice)],
                                          stage, juce::String(control.endpoint) + " choice " + juce::String(choice)) && passed;
                }
            }
            else
            {
                // JUCE's String numeric conversion accepts junk as zero. Use strict parsing.
                for (const auto normalized : { 0.0f, 1.0f })
                {
                    const auto text = parameter.getText(normalized, 128).trim().toStdString();
                    char* end = nullptr;
                    const double number = std::strtod(text.c_str(), &end);
                    const auto expected = normalized == 0.0f ? control.minimum : control.maximum;
                    passed = report.check(!text.empty() && end == text.c_str() + text.size() && std::isfinite(number)
                                          && std::abs(number - expected) <= 1.0e-6, stage,
                                          juce::String(control.endpoint) + " physical range endpoint") && passed;
                }
            }
        }
        // The existing hidden analyzer event is still a native parameter. It is
        // not one of the eight sound controls, and must not be removed to make
        // this inventory pass. Pinned Cmajor defaults its automation flag to true.
        const auto analyzer = parameters.find(stableID("analyzerEnabledIn"));
        if (!report.check(analyzer != parameters.end(), stage, "Existing analyzerEnabledIn stable ID present"))
            return false;
        const auto& analyzerParameter = *analyzer->second;
        passed = report.check(analyzerParameter.getName(256) == "Analyzer Enable"
                              && analyzerParameter.getLabel().isEmpty()
                              && analyzerParameter.isAutomatable()
                              && !analyzerParameter.isDiscrete()
                              && analyzerParameter.getNumSteps() == juce::AudioProcessor::getDefaultNumParameterSteps()
                              && analyzerParameter.getDefaultValue() == 0.0f,
                              stage, "Existing analyzer title, unit, automation, steps and default preserved") && passed;
        for (const auto normalized : { 0.0f, 1.0f })
        {
            const auto text = analyzerParameter.getText(normalized, 128).trim().toStdString();
            char* end = nullptr;
            const double number = std::strtod(text.c_str(), &end);
            passed = report.check(!text.empty() && end == text.c_str() + text.size() && std::isfinite(number)
                                  && number == static_cast<double>(normalized), stage,
                                  "analyzerEnabledIn physical range endpoint " + juce::String(normalized)) && passed;
        }
        parameters.erase(analyzer);
        for (const auto& entry : parameters)
        {
            const bool bypass = entry.second == plugin->getBypassParameter();
            passed = report.check(bypass, stage, "Only wrapper bypass may appear beyond eight sound controls and the existing analyzer") && passed;
            if (bypass)
                entry.second->setValue(0.0f);
        }
        return settle(defaults, stage + "-defaults") && passed;
    }

    bool process()
    {
        for (int frame = 0; frame < blockSize; ++frame, ++samplePosition)
        {
            const auto time = static_cast<double>(samplePosition) / sampleRate;
            const auto left = 0.125 * std::sin(juce::MathConstants<double>::twoPi * 437.0 * time);
            audio.setSample(0, frame, static_cast<float>(left));
            audio.setSample(1, frame, static_cast<float>(0.11 * std::sin(juce::MathConstants<double>::twoPi * 613.0 * time) + 0.3 * left));
        }
        midi.clear();
        plugin->processBlock(audio, midi);
        for (int channel = 0; channel < audio.getNumChannels(); ++channel)
            for (int frame = 0; frame < blockSize; ++frame)
                if (!std::isfinite(audio.getSample(channel, frame)))
                    return false;
        return true;
    }

    Report& report;
    std::unique_ptr<juce::AudioPluginInstance> plugin;
    juce::AudioBuffer<float> audio;
    juce::MidiBuffer midi;
    uint64_t samplePosition = 0;
    bool prepared = false;
};

void runProof(Report& report, const juce::File& bundle)
{
    auto host = std::make_unique<Host>(report);
    if (!host->load(bundle, "initial-instance"))
        return;

    auto target = host->current();
    for (size_t index = 0; index < controls.size(); ++index)
    {
        const auto count = controls[index].choices > 0 ? controls[index].choices : 5;
        for (int step = 0; step < count; ++step)
        {
            target[index] = static_cast<float>(step) / static_cast<float>(count - 1);
            if (!host->write(target, juce::String("change-") + controls[index].endpoint + "-" + juce::String(step)))
                return;
        }
    }

    const Sound savedSound { 0.137f, 0.263f, 1.0f, 0.421f, 0.687f, 0.0f, 1.0f, 1.0f };
    const Sound editedSound { 0.813f, 0.723f, 0.0f, 0.127f, 0.217f, 1.0f, 0.0f, 0.0f };
    if (!host->write(savedSound, "save-S-values"))
        return;
    const auto saved = host->state();
    if (!report.save("S", saved) || !host->write(editedSound, "edit-before-first-restore"))
        return;
    const auto edited = host->state();
    if (!report.save("edited", edited) || !report.check(edited != saved, "state-edit", "Editing all eight values changes native state bytes"))
        return;

    // Do not mask a restore failure by resending saved parameters from the host.
    host->restore(saved, savedSound, "same-instance-restore-1");
    if (!host->write(editedSound, "edit-before-identical-restore"))
        return;
    host->restore(saved, savedSound, "same-instance-restore-identical-S");

    // Destroy the original processor. A fresh instance receives the exact same S.
    host.reset();
    juce::MessageManager::getInstance()->runDispatchLoopUntil(20);
    host = std::make_unique<Host>(report);
    if (!host->load(bundle, "fresh-instance") || !host->write(editedSound, "fresh-instance-edit"))
        return;
    host->restore(saved, savedSound, "fresh-instance-restore-S");
}
}

int main(int argc, char** argv)
{
    if (argc != 3 || !juce::File::isAbsolutePath(argv[1]) || !juce::File::isAbsolutePath(argv[2]))
    {
        std::cerr << "Usage: enhance_that_vst3_probe <absolute EnhanceThat.vst3> <absolute evidence directory>\n";
        return 2;
    }
    const juce::File bundle(juce::String::fromUTF8(argv[1]));
    const juce::File evidence(juce::String::fromUTF8(argv[2]));
    std::error_code error;
    const auto resolvedBundle = std::filesystem::canonical(bundle.getFullPathName().toStdString(), error);
    if (error)
    {
        std::cerr << "Cannot resolve selected bundle: " << error.message() << '\n';
        return 2;
    }
    const auto resolvedEvidence = std::filesystem::canonical(evidence.getFullPathName().toStdString(), error);
    if (error)
    {
        std::cerr << "Cannot resolve evidence directory: " << error.message() << '\n';
        return 2;
    }
    for (auto parent = resolvedEvidence; !parent.empty(); parent = parent.parent_path())
    {
        if (parent == resolvedBundle)
        {
            std::cerr << "Refusing evidence directory inside the selected bundle\n";
            return 2;
        }
        if (parent == parent.root_path())
            break;
    }
    const auto root = evidence.getChildFile("probe");
    if (!evidence.isDirectory() || !std::filesystem::create_directory(root.getFullPathName().toStdString(), error))
    {
        std::cerr << "Refusing absent evidence parent or existing probe directory: " << error.message() << '\n';
        return 2;
    }
    Report report(root);
    if (!report.isOpen())
        return 2;
    const auto binary = bundle.getChildFile("Contents/MacOS/EnhanceThat");
    if (!report.check(bundle.isDirectory() && binary.existsAsFile(),
                      "candidate", "Selected Enhance That VST3 executable exists"))
        return report.finish();
    const auto binaryHash = juce::SHA256(binary).toHexString();
    report.emit("scope", "start", {{ "bundle", bundle.getFullPathName() },
        { "binarySha256", binaryHash }, { "sampleRate", sampleRate }, { "blockSize", blockSize },
        { "normalizedTolerance", normalizedTolerance }, { "stateWaitSeconds", 2 }});

    juce::ScopedJuceInitialiser_GUI juceInitialiser;
    runProof(report, bundle);
    report.check(binary.existsAsFile() && juce::SHA256(binary).toHexString() == binaryHash,
                 "candidate-after", "Candidate executable unchanged");
    return report.finish();
}
