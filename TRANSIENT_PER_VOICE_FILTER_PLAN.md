# Per-Voice Filter Plan

This file records the current implementation plan for adding a per-voice filter to Cosimo Synth.

## Goal

Add a real per-voice filter stage to the synth voice signal path with:

- lowpass
- highpass
- bandpass
- ideally notch
- ideally peak

The filter must be modulatable by each voice's own MSEG playback position, the same way warp amount is now modulated per voice.

## Main Recommendation

Use Cmajor's built-in `std::filters::simper::Implementation` as the filter core.

Why:

- Serum's own manual says its `Low`, `High`, and `Band/Peak/Notch` families are state-variable filters.
- Cmajor already ships a public state-variable filter implementation with the exact output families we want.
- `std::filters::simper::Implementation` already supports:
  - `lowPass`
  - `highPass`
  - `bandPass`
  - `notchPass`
  - `peakPass`
  - plus `allPass`, `lowShelf`, `highShelf`, and `bell`
- This is much smaller and cleaner than porting a Faust filter library or writing a new filter from scratch.

## Sources

- Serum manual: <https://www.xferrecords.com/manual/serum-2/docs>
- Cmajor standard filter source:
  - `/Users/winterfell/Library/Caches/cosimo-synth-dev/cmajor-source-1.0.3066/standard_library/std_library_filters.cmajor`
- Andy Simper SVF paper:
  - <https://www.cytomic.com/files/dsp/SvfLinearTrapOptimised2.pdf>
- Faust filters library:
  - <https://faustlibraries.grame.fr/libs/filters/>

## What Cmajor Already Has

The relevant built-in implementations are:

- `std::filters::tpt::svf`
  - lowpass / highpass / bandpass
  - multimode outputs
- `std::filters::simper`
  - lowpass / highpass / bandpass / notch / peak / allpass
  - also shelves and bell

The stock `Processor` wrappers in the Cmajor filter library are not the right fit for this synth. They are useful examples, but they hide coefficient update cadence behind a namespace-level `framesPerParameterUpdate = 32` default.

For this synth, use the `Implementation` struct directly inside the voice engine.

## Real Signal Path Placement

The real synth voice path is in:

- `/Users/winterfell/src/cosimo-synth/cmajor/FixedFrameOscillator.cmajor`

The relevant voice loop is in `SharedVoiceEngine::main()`.

Today, each voice does roughly:

1. advance pitch
2. advance MSEG
3. advance envelope
4. compute `effectivePosition`
5. compute `effectiveWarpAmount`
6. render oscillator sample
7. multiply by envelope gain
8. sum into `mix`

The filter should sit here instead:

1. advance pitch
2. advance MSEG
3. advance envelope
4. compute `effectivePosition`
5. compute `effectiveWarpAmount`
6. render oscillator sample
7. run the per-voice filter
8. multiply by envelope gain
9. sum into `mix`

So the filter is:

- after oscillator and warp
- before amplitude envelope scaling

## Per-Voice Architecture

Add one filter state per voice inside `SharedVoiceEngine`.

Likely new state:

- `std::filters::simper::Implementation[voiceCount] filters`
- `int32[voiceCount] voiceFilterMode`
- `float32[voiceCount] voiceFilterCutoffHz`
- `float32[voiceCount] voiceFilterQ`
- optional small counter if coefficient updates are decimated

Even if the public parameters are global, the effective cutoff must be computed per voice because each voice has its own MSEG position.

## Public Parameters

Recommended first parameter set:

- `filterMode`
- `filterCutoff`
- `filterQ`
- `filterMsegDepth`
- optional `filterDrive`

Suggested v1 modes:

- `Off`
- `Lowpass`
- `Highpass`
- `Bandpass`
- `Notch`
- `Peak`

If we want to stay smaller for the first pass, `Notch` and `Peak` can still be deferred, but the underlying filter implementation already supports them cleanly.

## Per-Voice MSEG Modulation

The important part is not just adding a filter. The filter cutoff must be modulated by each voice's own MSEG output.

The current pattern already exists for warp:

- `modulation = msegs[voice].out`
- `effectiveWarpAmount = warpAmountIn + modulation * warpMsegDepthIn`

The filter should follow the same structure:

- compute `modulation = msegs[voice].out`
- compute `effectiveCutoffHz` from base cutoff plus that voice's modulation
- call the filter with that voice-specific cutoff

Do not modulate cutoff linearly in Hz.

Use log or octave space instead:

```text
effectiveCutoffHz = clamp(
    baseCutoffHz * 2^(modulation * filterMsegDepthIn),
    minCutoffHz,
    maxCutoffHz
)
```

This makes filter sweeps and plucks sound musical instead of cramped at the low end and too wide at the high end.

## Update Cadence

The key distinction:

- audio still processes sample by sample
- the only question is how often the filter coefficients are recomputed

Recomputing the filter coefficients means calling `setFrequency(...)` and related methods.

### Why update less often?

Updating coefficients less often reduces CPU cost because coefficient updates do more math than a normal `process(sample)` step.

### Why not update too slowly?

If cutoff changes too slowly:

- the modulation becomes staircase-like
- fast MSEG motion can zipper
- resonant plucks lose snap
- aggressive modulation can sound smeared or stepped

### What the Cmajor library does by default

The standard library uses:

- `framesPerParameterUpdate = 32`

That is fine for generic processor wrappers, but it is too coarse as the default for a synth voice if we care about sharp per-voice modulation.

At `44.1 kHz`, `32` samples is about `0.73 ms`.

That is not catastrophic, but it is not what we should choose blindly.

## Recommended Cadence Strategy

Use the filter `Implementation` directly and manage updates inside the voice loop ourselves.

Recommended order of preference:

### Option 1: every-sample coefficient updates

Best correctness and simplest logic.

Per sample:

1. compute per-voice `effectiveCutoffHz`
2. if mode/cutoff/Q changed, call `setMode(...)` / `setFrequency(...)`
3. call `filter.process(sample)`

Pros:

- simplest architecture
- best behavior for snappy MSEG-driven filter motion
- matches the rest of the sample-rate voice loop

Cons:

- highest CPU cost

### Option 2: update every 4 samples

If CPU becomes an issue, this is the best first compromise.

At `44.1 kHz`, `4` samples is about `0.09 ms`, which is still very fine-grained.

Pros:

- much cheaper than per-sample coefficient updates
- still fast enough for musical MSEG motion

Cons:

- slightly more bookkeeping

### Option 3: threshold-based updates

Update coefficients only when `effectiveCutoffHz` or `Q` changed by more than a tiny amount.

Pros:

- reduces unnecessary updates on held notes

Cons:

- more policy complexity
- easy to get wrong if thresholds are too coarse

## Recommended V1 Choice

Start with:

- sample-by-sample audio processing
- sample-by-sample coefficient updates

Then profile.

If CPU is too high, step down to:

- update coefficients every 4 samples

Do not start at 32 samples.

## Filter Visual Plan

The desktop UI should also get a Serum-style filter graph.

The point of the graph is not decoration. It should let the user:

- see the filter response shape for the current mode
- drag directly in the graph to adjust cutoff and resonance together
- see the graph move during playback when `MSEG 1` is modulating the cutoff per voice

### Serum Reference

Serum's manual explicitly documents three relevant behaviors:

- the filter display can show frequency response
- the filter display can show frequency response with FFT overlaid
- the filter display supports direct click-and-drag adjustment of cutoff and resonance

Sources:

- Serum manual: <https://www.xferrecords.com/manual/serum-2/docs>
- Tooltip page showing that modulation sources are surfaced on controls:
  - <https://xferrecords.com/web-manual/serum-2/displaying-help-tooltips>

For Cosimo Synth v1, the right target is:

- frequency-response graph
- direct drag editing of cutoff and Q
- live movement from real DSP state during playback

Do not attempt the FFT overlay in the first pass.

## UI Placement

Keep the existing `MSEG 1` workflow exactly as it is:

- the MSEG overview card stays in the top-right area
- the full MSEG editor modal stays the one shared editor for `MSEG 1`

Do not create a second MSEG editor just for the filter.

Add a new `Filter` section to the desktop UI:

- place it below `Phase Warp`
- place it above the keyboard / glide section
- include the filter graph at the top of that section
- include controls below it for:
  - `Mode`
  - `Cutoff`
  - `Q`
  - `MSEG 1 Depth`
  - optional `Drive`

The filter section should name the modulation destination explicitly as `MSEG 1 Depth`, because the synth still has one shared editable MSEG shape, not multiple independent envelopes.

## What The Graph Should Show

The graph should render the filter's frequency response, not a fake hand-drawn curve.

V1 should show two curves:

- a dim base curve for the current knob settings
- a bright live curve for the actual effective filter state of the display voice during playback

Behavior by mode:

- `Lowpass`: rolloff after cutoff
- `Highpass`: rolloff before cutoff
- `Bandpass`: peak centered on cutoff
- `Notch`: dip centered on cutoff
- `Peak`: resonant boost centered on cutoff

When no voice is active:

- show only the base curve

When voices are active:

- show the live curve for one selected voice

## Which Voice The Graph Represents

Because the filter is per voice, the UI needs a rule for which note it is visualizing.

Use the same rule the synth already uses for the wavetable stage:

- show the newest active voice when one exists
- otherwise fall back to the base control values

This is already the pattern used by the existing `effectiveWavetablePosition` monitor in the voice engine and React UI.

That means the filter graph will visibly move during live playback in a way that matches the currently most relevant note, without trying to stack all active voices on top of each other.

## DSP To UI Monitor Plan

Do not make the UI guess the live filter position from knob values alone.

Add a real monitor event from the synth DSP, the same way wavetable position is already monitored.

Recommended new patch event:

- `effectiveFilterState`

Recommended payload:

- `voiceGeneration`
- `mode`
- `cutoffHz`
- `q`
- optional `enabled`

Implementation shape:

1. Add a new event type in the Cmajor voice engine for the filter display state.
2. Emit it from the voice engine at a throttled UI cadence.
3. Use the newest active voice's effective cutoff and Q.
4. If there is no active voice, emit the current base mode/cutoff/Q instead.
5. Add a React state helper mirroring the existing wavetable-position monitor reducer:
   - ignore stale `voiceGeneration` values
   - always keep the newest visible voice state

This keeps the visual tied to the real synth state instead of a UI approximation.

## Monitor Update Rate

The filter itself still processes sample by sample.

The monitor event is just for the UI, so it should be throttled separately.

Recommended monitor rate:

- `60 Hz`

Reason:

- `30 Hz` is acceptable for wavetable-position feedback
- filter cutoff movement driven by MSEG is more visually obvious and looks stair-stepped sooner
- `60 Hz` gives smoother perceived motion without turning the UI monitor into a high-frequency event flood

This does not change the filter DSP cadence. It only changes how often the desktop graph is refreshed from DSP state.

## Graph Math

The graph should be derived from the actual filter model parameters, not from a loose sketch.

Because the filter plan already recommends using `std::filters::simper::Implementation`, the UI should mirror that filter's coefficient math closely enough to evaluate magnitude response across a frequency axis.

V1 should draw:

- linear frequency-response magnitude only

That is enough to correctly visualize:

- lowpass
- highpass
- bandpass
- notch
- peak

Do not attempt to visualize saturation or nonlinear drive in the first pass.

## Direct Graph Interaction

The graph should be interactive.

Recommended behavior:

- horizontal drag adjusts cutoff on a logarithmic frequency axis
- vertical drag adjusts resonance / Q

This should work the same whether the user starts from the graph or from the separate knobs.

Important detail:

- dragging the graph changes the base filter controls
- the bright live curve still comes from the DSP monitor, so it will continue to move during playback if `MSEG 1` is modulating the cutoff

## What Not To Build In V1

Do not build these in the first pass:

- FFT overlay
- phase-response overlay
- one curve per active voice
- a separate filter-specific MSEG editor
- fake animation driven only from knob positions

The live motion should come from the real monitored DSP state, not from a guessed UI animation.

## Test Plan For The Filter Visual

Add three layers of tests.

### 1. Response curve tests

Add unit tests for the filter-graph math:

- lowpass falls after cutoff
- highpass falls before cutoff and rises after cutoff
- bandpass peaks around cutoff
- notch dips around cutoff
- peak boosts around cutoff

These tests should assert concrete numeric behavior, not just "it rendered".

### 2. Monitor selection tests

Add tests for the reducer that tracks the display voice:

- stale voice generations are ignored
- newest active voice wins
- no active voice falls back to base cutoff/Q

This should mirror how the existing wavetable-position monitor state works.

### 3. Desktop integration tests

Add browser tests that prove:

- dragging in the graph updates cutoff and Q
- incoming `effectiveFilterState` messages move the live curve
- `MSEG 1 Depth` remains part of the filter section instead of spawning a second MSEG editor

## Final UI Behavior Summary

The intended desktop behavior is:

- the user edits one shared `MSEG 1` shape
- the user sets `Filter MSEG 1 Depth` in the filter section
- when a note plays, that voice's filter cutoff moves according to that voice's own MSEG playback
- the filter graph visibly follows the newest active voice's effective cutoff and resonance in real time
- when playback stops, the graph settles back to the base filter settings

## Reset Behavior

Filter state must reset when a voice is retriggered or reassigned.

That means resetting the per-voice filter integrator state alongside the existing warp render state, envelope retrigger, and MSEG trigger behavior.

Otherwise a newly stolen voice can inherit stale resonant state from the previous note.

## Why Not A Ladder First

A ladder is still a good future option, especially for a more characterful lowpass.

But it is not the best first implementation here because:

- we need LP / HP / BP right away
- notch and peak are desirable
- a single SVF family covers all of that cleanly
- nonlinear ladder designs often want oversampling sooner

So:

- v1: multimode SVF
- later optional flavor: ladder lowpass

## Why Not Faust First

Faust has plenty of public filter designs, including SVFs and morphing filters.

But for this synth:

- Cmajor already has the right public algorithm family built in
- the integration cost is lower
- the behavior is easier to reason about in the existing Cmajor voice engine

Faust only becomes attractive if we specifically want:

- a more specialized morphing filter
- a particular nonlinear ladder implementation not already present
- or a direct match to another published filter family

## Implementation Outline

1. Add public filter endpoints to `WavetableSynth.cmajor`
   - `filterMode`
   - `filterCutoff`
   - `filterQ`
   - `filterMsegDepth`
   - optional `filterDrive`

2. Thread those endpoints into `SharedVoiceEngine`

3. Add one `std::filters::simper::Implementation` per voice

4. Compute per-voice `effectiveCutoffHz` from that voice's MSEG output

5. Process each oscillator sample through the per-voice filter before applying envelope gain

6. Reset filter state on retrigger and voice reassignment

7. Add real production-path tests
   - filter-off identity
   - LP / HP / BP behavior
   - notch and peak if enabled
   - per-voice staggered-note MSEG-driven cutoff differences
   - regression that fails if all voices incorrectly share one cutoff state

8. Add desktop UI controls after DSP is working

## Bottom Line

The simplest strong plan is:

- use `std::filters::simper::Implementation`
- one instance per voice
- modulate cutoff per voice from that voice's own MSEG output
- process audio sample by sample
- start with per-sample coefficient updates
- only reduce coefficient update cadence later if profiling shows it is necessary

## Airtight Test Plan

The filter feature is not complete until all of these are covered by automated tests against the real patch and the real desktop UI.

### What The Tests Must Prove

1. `WavetableSynth.cmajorpatch` actually applies the filter in the production audio path.
2. Each note gets its own filter motion from that note's own `MSEG 1` playback position.
3. Fast filter modulation does not zipper because coefficient updates are too sparse.
4. The desktop filter graph shows the real response shape for the current mode, cutoff, and Q.
5. The desktop filter graph follows live per-voice filter state during playback instead of faking motion from knob values.
6. Dragging in the graph changes the real filter controls.
7. The graph falls back to the base filter settings when no note is active.

### Test Layers

Use six layers:

1. independent Python reference math
2. production patch audio tests through `WavetableSynth.cmajorpatch`
3. modulation and zipper-stability tests
4. DSP-to-UI filter monitor tests
5. desktop browser integration tests
6. adversarial checks that prove the suite is not fake

### 1. Independent Python Reference Math

Create a reference helper:

- `tests/helpers/generate_filter_reference_assets.py`

This helper is the independent oracle. It must not call the React graph code or reuse the production implementation as its own expected value.

It should generate:

- reference WAV files for static and modulated audio tests
- reference JSON traces for the live filter monitor
- optional plots for manual review

It must independently validate the response family:

- lowpass stays near unity well below cutoff and attenuates well above cutoff
- highpass attenuates well below cutoff and rises above cutoff
- bandpass peaks near cutoff
- notch dips near cutoff
- peak boosts near cutoff
- changing Q changes the curve shape

### 2. Production Patch Audio Tests

Add a real patch suite:

- `tests/cmajor_filter/WavetableSynthFilter.cmajtest`

This suite must drive:

- wavetable upload events
- `midiIn`
- `filterMode`
- `filterCutoff`
- `filterQ`
- `filterMsegDepth`
- `mseg1Buffer`
- `mseg1Playback`

Do not use a fake voice graph or the old probe oscillator.

Static cases:

- `filter_off_identity`
- `lowpass_static`
- `highpass_static`
- `bandpass_static`
- `notch_static`
- `peak_static`
- `resonance_extreme`

Modulated cases:

- `mseg_lowpass_pluck`
- `mseg_highpass_sweep`
- `mseg_resonant_pluck`
- `two_voice_staggered_mseg`

Acceptance criteria:

- static and modulated cases match checked-in offline references
- `filter_off_identity` fails if the filter is accidentally always on
- `two_voice_staggered_mseg` fails if all voices incorrectly share one filter trajectory

### 3. Modulation And Zipper-Stability Tests

Add Python tests:

- `tests/test_filter_modulation_stability.py`

Cases:

- `fast_mseg_cutoff_motion_lowpass`
- `fast_mseg_cutoff_motion_bandpass`
- `fast_mseg_cutoff_motion_peak_high_q`

For each case:

- render the real patch
- compare against the independent reference
- compute a residual
- measure excess high-frequency residual energy

Acceptance criteria:

- the residual stays below a fixed threshold relative to the reference
- forcing coefficient updates to a very slow cadence would make these tests fail

### 4. DSP-To-UI Filter Monitor Tests

Expand the runtime-state helpers and tests for a new filter monitor event.

Test:

- filter monitor message normalization
- stale `voiceGeneration` rejection
- newest active voice selection
- fallback to base filter state when no voice is active
- malformed monitor messages do not poison valid UI state

These tests should mirror the existing wavetable-position monitor coverage.

### 5. Desktop Browser Integration Tests

Extend the real desktop browser suite:

- `tests/test_desktop_patch_view_browser.mjs`

Add coverage for:

- filter mode dropdown commits the real parameter
- cutoff control commits the real parameter
- Q control commits the real parameter
- dragging in the graph changes cutoff and Q
- incoming `effectiveFilterState` messages move the live curve
- the live curve follows the newest active voice
- the graph reverts to base settings when no note is active
- `Filter MSEG 1 Depth` commits the real parameter
- the synth still has one shared `MSEG 1` editor rather than a second filter-only editor

The graph tests must assert on structured render-model data, not only screenshots.

### 6. Filter Graph Math Tests

Add dedicated graph-math unit tests for the curve generator.

Cover:

- lowpass shape
- highpass shape
- bandpass peak location
- notch dip location
- peak boost location
- higher Q changes width and height of the peak
- horizontal drag maps to log frequency
- vertical drag maps to Q

These tests should fail if:

- the x axis is accidentally made linear
- lowpass and highpass are swapped
- Q is ignored

### 7. Manual Smoke Checks

After the automated suites are green, manually verify in the desktop app:

- changing cutoff and Q changes both the sound and the graph
- playing one note with filter MSEG modulation visibly moves the live curve
- overlapping notes make the graph follow the newest active voice
- stopping playback returns the graph to the base settings

This is not a substitute for the tests above. It is a final sanity check.

### 8. Adversarial Checks

Before calling the feature done, deliberately break the implementation locally and verify the tests fail:

- force `filterMode` to `Off`
- ignore `filterMsegDepth`
- make all voices share one filter state
- freeze the UI monitor at the base cutoff
- make the graph x axis linear

If any of those breakages still pass the suite, the suite is weak and must be fixed before completion.
