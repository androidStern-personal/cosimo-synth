# Transient Plan: Modulation Matrix Plus MSEG Restore Refactor

This is a transient planning note for the current discussion.

This version changes one important architectural rule:

- the UI should not be responsible for restoring modulation into the synth at boot

That refactor is now part of the modulation-matrix work, not a separate cleanup.

## Why This Refactor Is Part Of The Plan

The current repo stores MSEG editor state in the preset, but the DSP does not restore that state by itself.
Today the React-side `MsegController` reads stored keys like `mseg1.shape` and then sends DSP messages like `mseg1Buffer`, `mseg1Playback`, and `mseg1Depth`.

That is manageable for one fixed-route MSEG.
It becomes technical debt once we expand to:

- 3 MSEGs
- 3 ADSR modulation envelopes
- a route table

If we keep the same pattern, the modulation editor becomes part of the synth boot process.
That is the wrong ownership model.

The better rule is:

- the preset owns modulation
- the runtime restores modulation
- the UI edits modulation

## Core Ownership Rule

Use three distinct forms of modulation state.

### 1. Canonical preset state

This is the saved modulation definition.
It is the source of truth.

It should live under one stored-state key:

- `modulation.v1`

Do not keep modulation spread across keys like:

- `mseg1.shape`
- `mseg1.playback`
- `mseg1.depth`
- `warpMsegDepth`
- `filterMsegDepth`

Those keys are part of the current technical debt and should be removed in the cutover.

### 2. Runtime restore layer

This is one non-React runtime component whose only job is:

- read `modulation.v1`
- translate it into DSP-friendly slot and route data
- upload that data into the synth engine

This runtime restore layer should exist outside the React patch view.
It should run when the patch connection is created, not when the modulation editor happens to mount.

Plainly:

- the synth should restore correctly even if the modulation editor never opens

### 3. DSP runtime state

This is the efficient fixed-size data that Cmajor wants:

- rendered MSEG buffers by slot
- MSEG playback config by slot
- ADSR config by slot
- route table
- per-voice playheads and envelope stages

The DSP runtime state is not the saved format.
It is the execution format.

## Canonical Preset Shape

Save one modulation object in the preset.

Suggested shape:

```text
type ModulationPresetV1 =
{
    msegs: [
        { shape, playback },
        { shape, playback },
        { shape, playback }
    ],
    modEnvs: [
        { attackSeconds, decaySeconds, sustainLevel, releaseSeconds },
        { attackSeconds, decaySeconds, sustainLevel, releaseSeconds },
        { attackSeconds, decaySeconds, sustainLevel, releaseSeconds }
    ],
    routes: [
        { enabled, sourceKind, sourceSlot, destKind, amount, polarityMode },
        ...
    ]
}
```

Important rules:

- the preset stores MSEG shapes, not rendered MSEG buffers
- the preset stores ADSR definitions, not per-voice ADSR stage state
- the preset stores routes, not effective destination values
- base `pan` is a normal patch parameter, not part of `modulation.v1`

## Runtime Restore Layer

Create one runtime-side modulation loader.

Suggested name:

- `ModulationRuntimeBridge`

Its job is:

1. read `modulation.v1` from stored state
2. render each saved MSEG shape into a DSP buffer
3. upload the 3 MSEG slots
4. upload the 3 ADSR slots
5. upload the route table
6. enable the modulation engine

This loader should not live in `useMsegState()`.
The current `MsegController` boot behavior should be removed as part of the cutover.

The UI can still use a controller for editing convenience, but that controller should edit the canonical `modulation.v1` model.
It should not be the thing that makes restored audio correct.

## DSP Boot Flow

Replace the earlier snapshot or commit idea with a simpler boot rule.

### Boot messages

Add these DSP endpoints:

- `clearModulationRuntime`
- `setModulationEnabled`
- `uploadMsegSlot`
- `uploadModEnvSlot`
- `uploadRouteTable`

Suggested meaning:

- `clearModulationRuntime`
  - clears MSEG slot validity
  - clears ADSR slot validity
  - clears all route rows
  - resets per-voice modulation state
  - disables modulation
- `setModulationEnabled(false)`
  - modulation evaluator ignores the route table
- `uploadMsegSlot`
  - uploads one full MSEG slot definition
- `uploadModEnvSlot`
  - uploads one full ADSR slot definition
- `uploadRouteTable`
  - uploads the whole route table in one message
- `setModulationEnabled(true)`
  - route evaluator becomes active

### Boot sequence

On preset restore:

1. runtime loader reads `modulation.v1`
2. runtime loader sends `setModulationEnabled(false)`
3. runtime loader sends `clearModulationRuntime`
4. runtime loader uploads all 3 MSEG slots
5. runtime loader uploads all 3 ADSR slots
6. runtime loader uploads the full route table
7. runtime loader sends `setModulationEnabled(true)`

This is simple and enough.

The engine never uses half-restored modulation because modulation stays disabled until the full upload is done.

## Live Edit Rule

Live editing is different from preset restore.

### Preset restore

Preset restore uses the full runtime boot flow above.

### Live edits

Live edits update the canonical `modulation.v1` object and then send targeted DSP updates:

- MSEG shape or playback change:
  - rerender that one slot
  - resend that one `uploadMsegSlot`
- ADSR change:
  - resend that one `uploadModEnvSlot`
- route edit:
  - resend the full `uploadRouteTable`

Resending the full route table for live route edits is fine.
It is small, simple, and avoids route-row compaction bugs.

The UI should not emit per-field stored-state chatter during restore.
It should hydrate local state silently from `modulation.v1`, then re-enable normal live propagation after restore.

## Final V1 Source List

Use exactly these routeable sources:

- `MSEG`, slot `0..2`
- `MOD_ENV`, slot `0..2`
- `VELOCITY`
- `PRESSURE`
- `SLIDE`

Do not include these as matrix sources in v1:

- `PITCH_BEND`
- `AMP_ENV`

Reason:

- pitch bend already has a correct built-in pitch path
- the amp envelope already has a separate loudness job

## Final V1 Destination List

Use exactly these destinations:

- `FRAME_POSITION`
- `WARP_AMOUNT`
- `FILTER_CUTOFF_OCT`
- `FILTER_Q`
- `PITCH_SEMITONES`
- `AMP_GAIN_DB`
- `PAN`

## Destination Units

Every route amount is stored in destination units.

### `FRAME_POSITION`

- additive normalized offset
- clamp `0..1`

### `WARP_AMOUNT`

- additive normalized offset
- clamp `0..1`

### `FILTER_CUTOFF_OCT`

- additive octave delta
- final rule: `baseCutoffHz * 2^(octaveDelta)`

### `FILTER_Q`

- additive Q offset
- final rule: `clampFilterQ(baseQ + modQ)`

### `PITCH_SEMITONES`

- additive semitone delta from the matrix

### `AMP_GAIN_DB`

- additive dB offset
- recommended clamp: `-48 dB .. +6 dB`
- final rule:
  - convert dB to linear gain
  - multiply that with the existing amp envelope output

Positive amp modulation is intentionally kept modest in v1 to avoid runaway headroom problems.

### `PAN`

- additive pan offset in `-1..1`
- constant-power pan law

## The Pitch Rule

Pitch keeps the current synth behavior and adds one matrix term:

```text
finalPitchSemitones =
    voiceCurrentPitch
    + voiceBendSemitones
    + routePitchSemitones
```

That means:

- note and glide behavior stay where they are
- bend stays where it is
- the matrix adds pitch on top

That is the whole rule.

## The Pan Rule

`PAN` stays in scope and requires a real stereo voice path.

Implementation rule:

1. oscillator, warp, and filter stay mono per voice
2. apply amp envelope and `AMP_GAIN_DB`
3. apply constant-power pan
4. sum left and right inside `SharedVoiceEngine`
5. `SharedVoiceEngine` outputs stereo
6. `WavetableSynth` removes `MonoToStereo`

Also handle the current mono nodes explicitly:

- `trim` must become stereo or move before pan
- `FilterSpectrumAnalyzer` must be given a defined mono feed

Use:

- pre-pan mono mix into `FilterSpectrumAnalyzer`

That keeps analyzer behavior stable and easy to reason about.

## Signal Ranges And Normalization

Every routeable v1 source resolves to `0..1`.

### MSEG

- stored shape renders to unipolar `0..1`

### Mod envelope

- unipolar `0..1`

### Velocity

- unipolar `0..1`

### Pressure

- normalize and clamp to `0..1` inside `resolveRouteSourceValue()`

### Slide

- normalize and clamp to `0..1` inside `resolveRouteSourceValue()`

Important rule:

- `resolveRouteSourceValue()` is the normalization boundary

If a route points at an incomplete MSEG slot or incomplete ADSR slot, that source resolves to `0`.

## Route Table Shape

Use one fixed-size route table.

```text
struct ModRoute
{
    bool enabled;
    int32 sourceKind;
    int32 sourceSlot;
    int32 destKind;
    float32 amount;
    int32 polarityMode;
}
```

Use only these polarity modes in v1:

- `UNIPOLAR`
- `BIPOLAR_FROM_UNIPOLAR`

Use signed `amount` for direction.

## Cmajor Runtime Shape

### Constants

```text
let maxMsegSlots = 3;
let maxModEnvSlots = 3;
let maxRoutes = 24;
```

### Shared patch-level DSP state

```text
struct SharedMsegSlot
{
    float32[msegPaddedSamples] buffer;
    MsegPlaybackConfig playback;
    bool valid;
}

struct ModEnvelopeConfig
{
    float32 attackSeconds;
    float32 decaySeconds;
    float32 sustainLevel;
    float32 releaseSeconds;
    bool valid;
}

SharedMsegSlot[maxMsegSlots] sharedMsegs;
ModEnvelopeConfig[maxModEnvSlots] modEnvConfigs;
ModRoute[maxRoutes] routes;
bool modulationEnabled;
```

### Per-voice runtime state

```text
struct VoiceMsegState
{
    float32 currentValue;
    float32 progress;
    float32 progressIncrement;
    bool active;
    bool stopFutureWraps;
}

struct VoiceModEnvelopeState
{
    int32 stage;
    float32 level;
    bool active;
}
```

Do not keep full MSEG buffers in voice state.

## Voice Lifecycle Rules

### On note-on

- reset or retrigger all 3 MSEG playheads
- start all 3 modulation ADSRs

### On note-off

- notify all 3 MSEGs
- notify all 3 modulation ADSRs

### On mono retune with retrigger

- treat it like note-on for modulation state

### On mono retune without retrigger

- keep MSEG and ADSR runtime state running
- keep velocity frozen until retrigger
- let pressure and slide update live

That makes legato behavior predictable.

## Route Evaluation Algorithm

For each sample, for each voice:

1. advance glide
2. advance active MSEGs
3. advance the current amp envelope
4. advance active modulation ADSRs
5. clear destination accumulators
6. if modulation is enabled, walk all enabled routes
7. resolve effective voice parameters
8. render oscillator, warp, filter, amp, and pan

Suggested accumulator rules:

```text
effectiveFramePosition =
    clamp(baseFramePosition + framePositionMod, 0, 1)

effectiveWarpAmount =
    clamp(baseWarpAmount + warpAmountMod, 0, 1)

effectiveFilterCutoffHz =
    clampFilterCutoffHz(baseCutoffHz * 2^(filterCutoffOctMod), processor.frequency)

effectiveFilterQ =
    clampFilterQ(baseFilterQ + filterQMod)

effectivePitchSemitones =
    voiceCurrentPitch + voiceBendSemitones + pitchSemisMod

effectiveAmpLinearGain =
    ampEnvelopeGain * dbToGain(clamp(ampGainDbMod, -48, 6))

effectivePan =
    clamp(basePan + panMod, -1, 1)
```

If users route `VELOCITY -> AMP_GAIN_DB`, that is intentionally extra velocity sensitivity on top of the current amp envelope's built-in velocity response.

## Helper Functions

Add these helpers in Cmajor:

```text
float32 resolveRouteSourceValue (ModRoute route, int32 voice)
float32 applyRoutePolarity (float32 sourceValue, int32 polarityMode)
void accumulateRouteContribution (ModRoute route, float32 contribution, ...)
float32 dbToGain (float32 db)
```

## Cutover Rule

When the new modulation system lands, remove the old fixed-route MSEG path in the same change.

That cutover removes:

- old DSP endpoints:
  - `mseg1Buffer`
  - `mseg1Playback`
  - `mseg1Depth`
  - `warpMsegDepth`
  - `filterMsegDepth`
- old stored-state keys:
  - `mseg1.shape`
  - `mseg1.playback`
  - `mseg1.depth`
- old UI bindings and fixed-route MSEG controls
- old hard-coded MSEG destination math in `SharedVoiceEngine`

There should not be a release where both systems are trying to own modulation.

## Implementation Order

Use this order.

### Step 1. State Ownership Refactor

Work:

- define `modulation.v1`
- build `ModulationRuntimeBridge`
- remove `MsegController` from boot restore ownership
- make modulation restore work without opening the modulation editor

Done means:

- the preset has one modulation object
- the runtime, not React, restores modulation into DSP

### Step 2. Cut Over The Old One-MSEG Path

Work:

- remove old fixed-route MSEG keys and endpoints
- remove old fixed-route UI
- add `clearModulationRuntime`
- add `setModulationEnabled`
- add `uploadMsegSlot`
- add `uploadModEnvSlot`
- add `uploadRouteTable`

Done means:

- there is one modulation transport path in the repo, not two

### Step 3. Prove The Route Evaluator With One Route Table

Work:

- add `ModRoute`
- replace the current hard-coded MSEG destination math with route evaluation
- keep destinations limited to:
  - frame position
  - warp amount
  - filter cutoff

Done means:

- route data owns modulation, not hard-coded lines

### Step 4. Expand To 3 MSEGs

Work:

- add 3 MSEG slots
- render and upload each slot through the runtime bridge
- add per-voice playheads for all 3 slots

Done means:

- any route row can point at `MSEG 1`, `MSEG 2`, or `MSEG 3`

### Step 5. Add 3 Modulation ADSRs

Work:

- add 3 ADSR definitions in `modulation.v1`
- add 3 DSP ADSR slots
- add 3 per-voice ADSR runtime states

Done means:

- the matrix has 6 slot-based sources

### Step 6. Add Velocity, Pressure, And Slide

Work:

- normalize them in `resolveRouteSourceValue()`
- expose them to the route evaluator

Done means:

- the matrix has both slot-based and note-expression sources

### Step 7. Add Pitch, Amp, And Filter Q Destinations

Work:

- add `FILTER_Q`
- add `PITCH_SEMITONES`
- add `AMP_GAIN_DB`

Done means:

- pitch follows the explicit note-plus-glide-plus-bend-plus-matrix rule
- amp uses the explicit dB rule

### Step 8. Add Base Pan And Stereo Voice Output

Work:

- add a real `pan` patch parameter
- add `PAN` as a routeable destination
- change `SharedVoiceEngine` to stereo output
- update `trim`
- feed pre-pan mono to `FilterSpectrumAnalyzer`
- remove downstream `MonoToStereo`

Done means:

- pan is a real per-voice destination

### Step 9. Move The UI To The New Model

Work:

- replace per-field MSEG stored state with `modulation.v1`
- make the editor read and write the canonical modulation model
- keep the editor as an editor, not a boot restorer

Done means:

- UI and runtime share one modulation model

## Testing Plan

### Restore tests

Add tests that prove:

- a preset with `modulation.v1` restores correctly
- modulation restores even if the modulation editor never mounts
- the runtime bridge sends:
  - disable
  - clear
  - slot uploads
  - route-table upload
  - enable

### Cutover tests

Add tests that prove:

- old `mseg1.*` keys are no longer used
- old fixed-route endpoints are gone
- old fixed-route UI is gone

### Engine monitor tests

Use the existing monitor outputs for:

- effective wavetable position
- effective warp state
- effective filter state

Add new monitor outputs for:

- effective pitch semitones
- effective amp gain
- effective pan

### Voice behavior tests

Add tests for:

- 3 notes with independent MSEG playheads
- 3 notes with independent ADSR stages
- legato retune without retrigger keeping modulation runtime state
- velocity freezing until retrigger
- pressure and slide updating live

### Destination tests

Add tests for:

- MSEG to frame position
- MSEG to warp amount
- MSEG to filter cutoff
- modulation ADSR to filter Q
- slide to pitch
- pressure to pan
- velocity to amp

### Graph migration tests

Add tests for:

- stereo `SharedVoiceEngine` output after pan lands
- `trim` still behaves correctly
- `FilterSpectrumAnalyzer` still receives a defined mono feed

## Summary

This plan now includes the MSEG restore refactor as part of the modulation-matrix implementation.

The key rule is:

- stop letting the React modulation editor act like part of synth boot

The new ownership model is:

- one saved modulation object: `modulation.v1`
- one runtime loader: `ModulationRuntimeBridge`
- one DSP runtime form: slots, routes, and per-voice state

That is the cleaner path for adding:

- 3 MSEGs
- 3 ADSR modulation envelopes
- a real route table
- pitch, amp, and pan modulation

without multiplying the current one-MSEG technical debt.
