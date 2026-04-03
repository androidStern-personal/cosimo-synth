# Warp Mode Cmajor Test Plan

The real SUT is the production patch path: `WavetableSynth.cmajorpatch`, whose main graph is `cmajor/WavetableSynth.cmajor`. That path is `midiIn -> NoteDispatcher -> SharedVoiceEngine`, and the actual phase lookup/remap hook is inside `cmajor/FixedFrameOscillator.cmajor` in `SharedVoiceEngine` at the `phasors.at(voice).next()` to wavetable lookup boundary.

Do not build the new suite around:

- the legacy `graph Voice`
- standalone `FixedFrameOscillator` probes
- `SharedVoiceEngine` probe graphs
- `BankBackedFixedFrameOscillator` in `bench.py`

## Plan

1. Create a top-level Cmajor patch test harness around `WavetableSynth`.

Acceptance:

- the primary warp tests load the real patch
- they drive only real patch endpoints
- they run with a fixed session ID so runtime wavetable upload events are accepted

Strategy:

- use `.cmajtest` `runScript` against `WavetableSynth.cmajorpatch`
- standardize execution as `cmaj test --singleThread --sessionID=1 ...`

2. Extract the warp math into a pure production helper and unit-test it with Cmajor function tests.

Acceptance:

- `Off` is identity
- neutral amount is identity
- endpoints are pinned
- clamping is correct
- monotonic modes stay monotonic

Strategy:

- add a pure helper in production source
- use `## global (...)` plus `## testFunction()` to call it directly

3. Add real patch golden-render tests for audible behavior.

Acceptance:

- the top-level patch produces stable `audioOut` goldens for `Off`, `Bend`, `Pulse Width`, and later `Squeeze`

Strategy:

- one `.cmajtest` suite with checked-in fixture dirs
- each case supplies `wavetableLoadBegin.json`, `wavetableMipFrame.json`, `midiIn.json` or `midiIn.mid`, and parameter files like `warpMode.json`, `warpAmount.json`, `wavetablePosition.json`
- the required checked-in oracle is `expectedOutput-audioOut.wav`

4. Add relational/property tests in `.cmajtest` JS for cases goldens handle poorly.

Acceptance:

- `warpAmount=0` matches `Off`
- non-zero warp audibly differs from `Off`
- renders stay finite
- block-size changes do not change output materially

Strategy:

- use a small repo-local custom test helper in the `.cmajtest` preamble to render the real patch twice and compare results directly

5. Create deterministic runtime-upload fixtures without Python in the test path.

Acceptance:

- no test requires Python or the current probe generators at runtime

Strategy:

- either check in static upload JSON for a few canonical banks, or add a small repo-owned JS generator that produces them once and checks them in
- keep runtime tests self-contained and checked in

6. Wire a small CI-facing entrypoint.

Acceptance:

- everyone runs the suite the same way, with the same session ID and engine settings

Strategy:

- add one repo script or package command for the `.cmajtest` suite

## Coverage

- `identity_sine`: `Off` baseline on a one-frame sine bank
- `neutral_equals_off`: `Bend@0` and `PulseWidth@neutral` match `Off`
- `bend_harmonic`: active bend on a harmonic-rich bank
- `pulse_width_edge`: active pulse-width on a discontinuous or square-like bank, with wrap/seam exposure
- `scan_plus_warp`: `wavetablePosition` movement while warp is active on a multi-frame bank
- `poly_two_notes`: two-note chord through the real dispatcher/voice engine path
- `mono_legato_glide`: top-level `playMode` and `glideTime` interaction with warp active
- `amount_automation`: ramp `warpAmount` mid-note with `framesToReachValue`
- `block_boundary_invariance`: same case rendered at `blockSize=1` and an awkward non-power-of-two size
- `squeeze`: only after we lock whether it is pure remap or remap-plus-DC-tail

Recommendation:

- do not use `mainProcessor` override for the primary suite
- use the default patch main because it is already the correct hot path
