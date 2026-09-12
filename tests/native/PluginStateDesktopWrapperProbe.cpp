#include <CoreFoundation/CoreFoundation.h>
#include "../../tools/desktop_native/Source/cmaj_PatchLoaderPlugin.cpp"
#include <chrono>

namespace
{
void require (bool condition, const char* message)
{
    if (! condition) throw std::runtime_error (message);
}

std::array<float, 2> render (FixedPatchInstrumentDevPlugin& processor, bool note = false)
{
    juce::AudioBuffer<float> audio (2, 128);
    audio.clear();
    juce::MidiBuffer midi;
    if (note) midi.addEvent (juce::MidiMessage::noteOn (1, 60, static_cast<juce::uint8> (100)), 0);
    processor.processBlock (audio, midi);
    return { audio.getSample (0, 127), audio.getSample (1, 127) };
}

struct StateView final : cmaj::PatchView
{
    explicit StateView (cmaj::Patch& patch) : PatchView (patch) {}
    void sendMessage (const choc::value::ValueView& envelope) override
    {
        if (envelope["type"].toString() != "kit_state") return;
        const auto body = envelope["message"];
        const auto kind = body["kind"].toString();
        if (kind == "owner-changed") ownerOpened = true;
        if (kind == "attached") attached = choc::value::Value (body);
        if (kind == "attached" || kind == "update") state = choc::value::Value (body["state"]);
    }
    bool ownerOpened = false;
    choc::value::Value attached, state;
};

template <typename Condition>
void waitForWorker (FixedPatchInstrumentDevPlugin& processor, Condition condition, const char* failure)
{
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds (10);
    do
    {
        // Run the real macOS message loop used by the shipping QuickJS worker.
        CFRunLoopRunInMode (kCFRunLoopDefaultMode, 0.001, true);
        render (processor);
        require (! processor.isStatusMessageError, processor.statusMessage.c_str());
        if (condition()) return;
    } while (std::chrono::steady_clock::now() < deadline);
    throw std::runtime_error (failure);
}

void qualifyWorker (FixedPatchInstrumentDevPlugin& processor)
{
    auto& patch = *processor.patch;
    StateView view (patch);
    waitForWorker (processor, [&] { return view.ownerOpened; }, "production factory did not start its state worker");
    const auto send = [&] (const auto& body)
    {
        require (patch.handleClientMessage (view, choc::json::create ("type", "kit_state", "message", body)),
                 "production native view rejected its state message");
    };
    send (choc::json::create ("kind", "attach", "request", 1));
    waitForWorker (processor, [&] { return view.attached.isObject(); }, "production worker did not attach the view");
    int64_t sequence = 0;
    const auto setLevel = [&] (float level)
    {
        send (choc::json::create ("kind", "command", "scope", view.attached["scope"],
            "client", view.attached["client"], "sequence", ++sequence,
            "command", choc::json::create ("kind", "edit", "key", "workerLevel", "value", level,
                "expectedVersion", view.state["fields"]["workerLevel"]["version"])));
        waitForWorker (processor, [&]
        {
            const auto field = view.state["fields"]["workerLevel"];
            return field["value"].getWithDefault<float> (-1) == level
                && field["application"]["kind"].toString() == "acknowledged"
                && render (processor)[0] == level;
        }, "public worker edit did not reach actual wrapper DSP");
    };
    setLevel (2);
    require (patch.getFullStoredState()["values"]["workerLevel"].getWithDefault<float> (-1) == 2,
             "worker edit was not saved by the real native owner");
    setLevel (1); // Restore the prerequisite for the existing wrapper assertions.
}

std::string triggerConfig (int slot)
{
    auto velocity = choc::value::createEmptyArray();
    for (int i = 0; i < 128; ++i) velocity.addArrayElement (i == 100 ? slot : -1);
    return choc::json::toString (choc::json::create ("activeMode", "vel", "velocity", velocity));
}
}

int main (int argc, char** argv)
{
    try
    {
        require (argc == 2, "usage: probe <manifest>");
        juce::ScopedJuceInitialiser_GUI gui;
        std::unique_ptr<juce::AudioProcessor> owned (createPluginFilter());
        auto& processor = dynamic_cast<FixedPatchInstrumentDevPlugin&> (*owned);
        auto patch = processor.patch;
        require (std::filesystem::equivalent (patch->getManifestFile(), argv[1]), "production factory loaded the wrong manifest");
        require (patch->isPlayable(), "real desktop processor did not load fixture DSP");
        processor.prepareToPlay (44100, 128);
        qualifyWorker (processor);
        auto output = render (processor, true);
        require (output[0] == 1 && output[1] == -1, "DSP baseline must have gain 1 and no selector");

        // Invoke the actual callback installed by the production constructor.
        // Generic channel authorization is covered separately; this proves the
        // application callback, private pending mailbox and real audio consumer.
        require (static_cast<bool> (patch->handleStateHostEffect), "desktop wrapper did not install host-effect handler");
        require (patch->handleStateHostEffect ("cosimo.articulation-trigger-config", choc::value::Value (triggerConfig (7))),
                 "valid trigger configuration was rejected");
        require (render (processor)[1] == -1, "configuration alone must not fabricate a MIDI selector");
        require (render (processor, true)[1] == 7, "processBlock MIDI did not consume pending selector 7");
        require (patch->handleStateHostEffect ("cosimo.articulation-trigger-config", choc::value::Value (triggerConfig (11))),
                 "replacement trigger configuration was rejected");
        require (render (processor, true)[1] == 11, "processBlock MIDI did not consume replacement selector 11");
        require (! patch->handleStateHostEffect ("cosimo.articulation-trigger-config", choc::value::Value ("invalid-json")),
                 "invalid host-effect payload must be rejected");
        require (render (processor, true)[1] == 11, "invalid payload replaced active configuration");

        auto gain = patch->findParameter (cmaj::EndpointID::create (std::string_view ("gain")));
        require (gain != nullptr, "gain must be a real native parameter");
        gain->setValue (3.5f, true, -1, 0);
        require (render (processor)[0] == 3.5f, "saved-state prerequisite native gain was not applied");
        juce::MemoryBlock saved;
        processor.getStateInformation (saved);
        const auto state = juce::ValueTree::readFromData (saved.getData(), saved.getSize());
        require (static_cast<int> (state.getProperty ("completeSoundVersion")) == cosimo::complete_sound::version,
                 "wrapper did not serialize the current complete-sound version");
        require (state.getChildWithName ("PARAMS").getNumChildren() == 41,
                 "fixture must expose gain and all 40 required complete-state parameters");

        gain->setValue (-2.0f, true, -1, 0);
        require (render (processor)[0] == -2, "intervening edit must reach native DSP");
        processor.setStateInformation (saved.getData(), static_cast<int> (saved.getSize()));
        const auto firstRestoredGain = patch->findParameter (cmaj::EndpointID::create (std::string_view ("gain")));
        require (firstRestoredGain && firstRestoredGain->currentValue == 3.5f, "first restore did not immediately restore native gain");
        // The restored worker resource is prepared asynchronously; do not turn
        // the original exact audio assertion into a claim of gapless restore.
        waitForWorker (processor, [&] { return render (processor)[0] == 3.5f; }, "first restore did not reinstall shared data");
        require (render (processor)[0] == 3.5f, "first complete-state restore did not restore native gain");
        gain = patch->findParameter (cmaj::EndpointID::create (std::string_view ("gain")));
        gain->setValue (8.0f, true, -1, 0);
        require (render (processor)[0] == 8, "second intervening edit must reach native DSP");
        processor.setStateInformation (saved.getData(), static_cast<int> (saved.getSize()));
        const auto secondRestoredGain = patch->findParameter (cmaj::EndpointID::create (std::string_view ("gain")));
        require (secondRestoredGain && secondRestoredGain->currentValue == 3.5f, "identical bytes did not immediately restore native gain");
        waitForWorker (processor, [&] { return render (processor)[0] == 3.5f; }, "identical restore did not reinstall shared data");
        require (render (processor)[0] == 3.5f, "identical saved bytes must restore again after a live edit");

        auto invalid = state.createCopy();
        auto invalidParameters = invalid.getChildWithName ("PARAMS");
        auto requiredTrim = invalidParameters.getChildWithProperty ("ID", "laneGlobalFilter1OutputTrimDb");
        require (requiredTrim.isValid(), "invalid-chunk fixture must remove a required trim");
        invalidParameters.removeChild (requiredTrim, nullptr);
        juce::MemoryBlock invalidBytes;
        juce::MemoryOutputStream stream (invalidBytes, false);
        invalid.writeToStream (stream);
        gain = patch->findParameter (cmaj::EndpointID::create (std::string_view ("gain")));
        gain->setValue (-4.0f, true, -1, 0);
        require (render (processor)[0] == -4, "invalid-state prerequisite must reach native DSP");
        processor.setStateInformation (invalidBytes.getData(), static_cast<int> (invalidBytes.getSize()));
        require (render (processor)[0] == -4, "incomplete native state chunk must leave live gain unchanged");
        processor.releaseResources();
        std::cout << "PASS actual desktop wrapper: production factory/runtime/QuickJS worker/shared-data DSP; pending trigger mailbox/MIDI/DSP; repeated identical state; invalid chunk\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "FAIL " << error.what() << '\n';
        return 1;
    }
}
