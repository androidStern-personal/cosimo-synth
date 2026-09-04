# Spectral Chord Resonator contracts

Read this before changing the Spectral DSP, patch endpoints, voice dispatcher, mode handling, or host parameters.

## Audio and MIDI

- `SpectralChordResonator.cmajor` exposes one stereo audio input, `audioIn`, named `Input`. It is the source material for both spectral modes.
- `midiIn` is the sidechain control input for held notes, arpeggios, pitch bend, and voice allocation. Do not add a public audio `sidechainIn` bus without an explicit product change.

## Modes and held notes

- Poly mode keeps independent per-voice spectral state. Mono mode steals voice 0 and retunes its existing state so fast notes and 16th-note arpeggios remain audible.
- Resonator mode preserves the spectral feedback algorithm. Imprint is source-driven: it masks the current audio frame with held-note harmonics and must not synthesize fake excitation. Existing feedback can still produce a legitimate tail after source audio stops.
- Changing Mono/Poly mode must not depend on the host resending held note-ons. Preserve the dispatcher's held-note state and qualify note-off behavior across both transitions. Current probes cover the selected note entering Mono; they do not yet prove restoration of every physically held chord note when returning to Poly.

## Host parameter compatibility

Keep `hostSlot0Guard` as the first declared Spectral host parameter. It protects the observed Ableton/Cmajor slot-zero behavior and the released automation order; visible parameters such as `magFeedbackIn` begin after it. Source-order assertions preserve this today, but no current minimal host reproduction identifies the upstream cause. Do not remove or reorder the guard until compiled host parameter inventory and supported-host automation compatibility are independently proven.

## Evidence

`tests/test_spectral_chord_resonator_probe.py` covers audio reconstruction/stereo independence, fast-note Poly/Mono behavior, Imprint source dependence, selected-note continuity into Mono, and slot-zero source order. The probe can skip when its Cmajor/Node toolchain is unavailable, and it does not close the held-chord restoration or compiled host-order gaps above. Report those limits separately from passing source/probe checks.

The routing, dispatcher, Imprint, held-note, and slot-zero contracts entered with `de7ce33f` and `b723b2d2`. They remain current product/compatibility decisions; this file relocates them from universal instructions and does not change DSP behavior.
