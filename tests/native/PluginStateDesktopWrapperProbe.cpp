#include "../../tools/desktop_native/Source/cmaj_PatchLoaderPlugin.cpp"

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
        require (argc == 3, "usage: probe <runtime> <manifest>");
        juce::ScopedJuceInitialiser_GUI gui;
        require (cmaj::Library::initialise (argv[1]), "could not load Cmajor runtime");
        auto patch = std::make_shared<cmaj::Patch>();
        patch->createEngine = [] { return cmaj::Engine::create(); };
        FixedPatchInstrumentDevPlugin processor (patch, argv[2]);
        if (! patch->isPlayable())
        {
            patch->statusChanged = [] (const auto& status) { std::cerr << status.statusMessage << '\n'; };
            cmaj::Patch::LoadParams diagnosticLoad;
            diagnosticLoad.manifest.initialiseWithFile (argv[2]);
            patch->loadPatch (diagnosticLoad, true);
            throw std::runtime_error ("real desktop processor did not load fixture DSP");
        }
        processor.prepareToPlay (44100, 128);
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
        require (render (processor)[0] == 3.5f, "first complete-state restore did not restore native gain");
        gain = patch->findParameter (cmaj::EndpointID::create (std::string_view ("gain")));
        gain->setValue (8.0f, true, -1, 0);
        require (render (processor)[0] == 8, "second intervening edit must reach native DSP");
        processor.setStateInformation (saved.getData(), static_cast<int> (saved.getSize()));
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
        std::cout << "PASS actual desktop wrapper: pending trigger mailbox/MIDI/DSP; repeated identical state; invalid chunk\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "FAIL " << error.what() << '\n';
        return 1;
    }
}
