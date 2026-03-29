Path 1 polyphony implementation plan
Transient planning note for the shared-bank owner-processor refactor.

What this refactor is trying to achieve
- Keep the current JavaScript patch view and JavaScript wavetable worker.
- Keep graph-level MIDI conversion and voice allocation in Cmajor.
- Replace the current voice-owned wavetable bank with one shared wavetable bank owned by one processor.
- Render multiple voices from that one shared bank.

Architecture that was confirmed before implementation
- The top-level graph can route `std::voices::VoiceAllocator(numVoices).voiceEventOut[numVoices]` into one processor input event array.
- Processor composition can still be used for per-voice helpers such as envelopes and MSEG readers, but the shared wavetable bank and wavetable request/ack state machine must stay in the parent processor.
- The current worker protocol already matches one global wavetable service, so the implementation should preserve the existing runtime endpoints and payload shapes.

Files expected to carry most of the refactor
- `cmajor/WavetableSynth.cmajor`
- `cmajor/FixedFrameOscillator.cmajor`
- `tests/test_runtime_state_coordinator.py`
- `tests/test_runtime_wavetable_mip_probe.py`

Implementation order
1. Add focused proof tests for shared-bank polyphony and note-release independence.
2. Add a new shared owner processor beside the existing single-voice code instead of deleting the old code first.
3. Move wavetable-bank ownership and runtime-service logic into the shared owner.
4. Keep graph-level `MPEConverter -> VoiceAllocator`, then route `voiceEventOut[numVoices]` into the shared owner.
5. Preserve the current worker endpoint names and runtime-state payloads.
6. Rewire the shipping patch to the shared owner after the proof tests pass.
7. Replace direct single-voice runtime probe tests with shared-owner probe tests.
8. Delete dead single-voice graph code after the shared-owner path is green.

Decisions locked for this refactor
- Do not fork Cmajor.
- Do not move wavetable rendering into native C++.
- Do not change the iPhone wrapper unless a mechanical source-list update is required.
- Do not widen scope into new synthesis features such as unison or additional filters.

Main risks to watch during implementation
- Accidentally reintroducing one wavetable-loading service per voice.
- Regressing MSEG or envelope behavior while moving from one whole `wt::Voice` graph to one owner processor.
- Emitting ambiguous display-monitor events for polyphony instead of choosing one clear visible voice policy.
