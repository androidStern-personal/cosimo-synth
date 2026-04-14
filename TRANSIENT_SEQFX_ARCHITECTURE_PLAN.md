# Transient SeqFX Architecture Plan

This is a transient planning document for a separate Cmajor insert effect plugin. It is not a new page inside Cosimo Synth, and it is not a durable project tracker. Update or delete it once implementation replaces the plan.

Prime directive: keep the plugin simple and technically correct. Avoid extra abstractions, needless process, speculative frameworks, and ceremony that does not directly reduce implementation risk.

## Goal

Build an Effectrix-style sequenced multi-effect plugin in Cmajor with four lanes:

- Filter envelope
- Bit crusher
- Tape stop
- Stutter/loop

The signal path is fixed:

```text
dry input
  -> filter envelope
  -> bit crusher
  -> tape stop
  -> stutter/loop
  -> global wet/dry
```

The fixed order is part of the sound design. The filter shapes the incoming material before lo-fi destruction, the crusher degrades the filtered signal, the tape stop slows the degraded signal, and the stutter repeats the final effected signal. For v1, do not add draggable lane order.

Implementation note from the first build pass: the generated Cmajor JavaScript target rejected the original eight-second fixed tape/stutter history buffers with `Too many array elements`. The implemented v1 uses one-second fixed tape and stutter history buffers so the patch compiles, the JavaScript render tests can exercise the effects, and the generated JUCE standalone can build. This still supports the requested four-lane effect chain and the tested 1/64 through 1/4 stutter slices at normal tempos, but very slow tempos or very long block-duration captures are capped by that fixed buffer size.

## Research Anchors

Effectrix and Effectrix2 are useful references because they combine a step grid, block lengths, per-step modulation/parameter variation, host/manual clocking, MIDI pattern switching, and effects processed in lane order. Cmajor shapes the implementation because graph endpoints are static, UI communication goes through patch connection events/values, and fixed-latency behavior must be declared up front.

Primary sources:

- Sugar Bytes Effectrix product page: https://sugar-bytes.de/effectrix
- Sugar Bytes Effectrix2 product page: https://sugar-bytes.de/effectrix2
- Effectrix2 manual: https://downloads.sugar-bytes.de/manuals/Effectrix2.pdf
- Cmajor language reference: https://cmajor.dev/docs/LanguageReference
- Cmajor patch format: https://cmajor.dev/docs/PatchFormat
- Cmajor standard library: https://cmajor.dev/docs/StandardLibrary
- Cmajor test file format: https://cmajor.dev/docs/TestFileFormat

Local repo anchors:

- `WavetableSynth.cmajorpatch` is an instrument/generator, so SeqFX needs its own effect manifest.
- `ui/shared/cmajor-react.ts` already defines the host bridge shape: `sendEventOrValue`, stored state, endpoint listeners, parameter listeners, MIDI input events, and status listeners.
- `ui/shared/modulation.ts` already has a practical pattern for storing UI-owned state and uploading normalized Cmajor structs through event endpoints.
- `cmajor/Chorus.cmajor` already uses fixed-size circular buffers, `wrap<N>` indices, and interpolation. Tape stop and stutter should use the same basic buffer mechanics.
- `cmajor/FixedFrameOscillator.cmajor` and `cmajor/Distortion.cmajor` already use Cmajor standard filters. The filter envelope should use that same standard-library direction rather than a custom filter unless the standard filter is proven unsuitable.

## New Plugin Files

Suggested files:

```text
fx/seqfx/SeqFx.cmajorpatch
fx/seqfx/SeqFx.cmajor
ui/seqfx/patch-view-entry.tsx
ui/seqfx/SeqFxPatchView.tsx
ui/seqfx/seqfx-state.ts
ui/seqfx/seqfx-runtime-bridge.ts
tests/seqfx/
```

Do not add these files inside the existing synth patch. The effect plugin should be able to load as an audio insert without MIDI note input.

Suggested manifest shape:

```json
{
  "CmajorVersion": 1,
  "ID": "dev.cosimo.seqfx",
  "version": "0.1.0",
  "name": "Cosimo SeqFX",
  "description": "Step-sequenced stereo effect with filter envelope, bit crusher, tape stop, and stutter lanes.",
  "category": "effect",
  "manufacturer": "Cosimo",
  "plugin": {
    "pluginCode": "CsFx",
    "manufacturerCode": "Cosi"
  },
  "isInstrument": false,
  "source": [
    "SeqFx.cmajor"
  ],
  "view": {
    "src": "view/index.js",
    "resizable": true,
    "width": 1120,
    "height": 680
  }
}
```

The exact plugin/manufacturer codes need to avoid collisions with the existing synth.

## Build And Load Wiring

Use the existing `fx/ott_lab` and `fx/chorus_lab` pattern as the model. Do not invent a new packaging system.

Add package scripts:

```json
{
  "seqfx:ui:build": "vite build --config ui/vite.seqfx.config.mjs",
  "seqfx:play": "cmaj play fx/seqfx/SeqFx.cmajorpatch",
  "seqfx:dry-run": "cmaj play --dry-run --stop-on-error fx/seqfx/SeqFx.cmajorpatch",
  "seqfx:plugin:generate": "npm run seqfx:ui:build && ./scripts/generate_seqfx_plugin.sh",
  "seqfx:jit:install": "./scripts/install_seqfx_cmajplugin.sh"
}
```

Add `scripts/generate_seqfx_plugin.sh` by copying the existing JUCE generation pattern and changing only the patch path and output directory:

```text
patch path: fx/seqfx/SeqFx.cmajorpatch
default output: build/seqfx_juce
command shape: cmaj generate --target=juce ...
```

Add `scripts/install_seqfx_cmajplugin.sh` only if we want fast testing through the official generic Cmajor VST3 loader. The script should point `~/Library/Audio/Plug-Ins/VST3/CmajPlugin.json` at `fx/seqfx/SeqFx.cmajorpatch`, mirroring the OTT/chorus lab scripts.

The UI build should produce:

```text
fx/seqfx/view/index.js
```

That keeps the standalone effect self-contained. The checked-in UI source can live in `ui/seqfx`, but the patch manifest should reference the generated `view/index.js` beside the effect patch. `ui/vite.seqfx.config.mjs` should be the one concrete build config that turns `ui/seqfx/patch-view-entry.tsx` into `fx/seqfx/view/index.js`.

## Cmajor Graph

Use one main processor, not four independent graph nodes. The sequencer needs sample-accurate access to clock state, step transitions, trigger steps, block lengths, host jumps, wet ramps, history buffers, and effect state. Splitting each effect into separate processors would force duplicated step logic or extra internal event plumbing.

Sketch:

```cmajor
graph SeqFx [[ main ]]
{
    input  stream float32<2> audioIn;
    output stream float32<2> audioOut;

    input event std::timeline::Position positionIn;
    input event std::timeline::Tempo tempoIn;
    input event std::timeline::TransportState transportStateIn;

    input value float32 enabled [[ name: "SeqFX On", min: 0.0f, max: 1.0f, init: 1.0f, discrete: true, step: 1.0f, rampFrames: 0 ]];
    input value float32 globalMix [[ name: "SeqFX Mix", min: 0.0f, max: 1.0f, init: 1.0f, rampFrames: 128 ]];
    input value float32 patternSelect [[ name: "Pattern", min: 0.0f, max: 11.0f, init: 0.0f, discrete: true, step: 1.0f, rampFrames: 0 ]];
    input value float32 clockMode [[ name: "Clock", min: 0.0f, max: 2.0f, init: 0.0f, discrete: true, step: 1.0f, text: "Host|Internal|Manual", rampFrames: 0 ]];
    input value float32 manualBpm [[ name: "Manual BPM", min: 20.0f, max: 300.0f, init: 120.0f, rampFrames: 128 ]];
    input value float32 rate [[ name: "Rate", min: 0.0f, max: 2.0f, init: 1.0f, discrete: true, step: 1.0f, text: "1/8|1/16|1/32", rampFrames: 0 ]];
    input value float32 swing [[ name: "Swing", min: 0.0f, max: 0.45f, init: 0.0f, rampFrames: 128 ]];
    input value float32 loopStart [[ name: "Loop Start", min: 0.0f, max: 31.0f, init: 0.0f, discrete: true, step: 1.0f, rampFrames: 0 ]];
    input value float32 loopLength [[ name: "Loop Length", min: 1.0f, max: 32.0f, init: 32.0f, discrete: true, step: 1.0f, rampFrames: 0 ]];

    input event SeqPatternUpload patternUpload;
    input event int32 internalPlay;
    input event int32 internalReset;

    output event SeqMonitor monitorOut;

    node bus = seqfx::SequencerBus;

    connection audioIn -> bus.audioIn;
    connection positionIn -> bus.positionIn;
    connection tempoIn -> bus.tempoIn;
    connection transportStateIn -> bus.transportStateIn;
    connection enabled -> bus.enabled;
    connection globalMix -> bus.globalMix;
    connection patternSelect -> bus.patternSelect;
    connection clockMode -> bus.clockMode;
    connection manualBpm -> bus.manualBpm;
    connection rate -> bus.rate;
    connection swing -> bus.swing;
    connection loopStart -> bus.loopStart;
    connection loopLength -> bus.loopLength;
    connection patternUpload -> bus.patternUpload;
    connection internalPlay -> bus.internalPlay;
    connection internalReset -> bus.internalReset;
    connection bus.monitorOut -> monitorOut;
    connection bus.audioOut -> audioOut;
}
```

Verify the exact `std::timeline` endpoint names and host delivery behavior during implementation. If a generated plugin host does not feed timeline data reliably, the internal clock must still work.

Cmajor plugin parameters are commonly exposed as floats, but several of these controls are musical integers. Snap and clamp them at the DSP input boundary before they affect timing or pattern lookup:

```text
patternSelect: 0..11, integer pattern index
clockMode: 0 host, 1 internal, 2 manual
rate: 0 1/8, 1 1/16, 2 1/32
loopStart: 0..31, integer step
loopLength: 1..32, integer step count capped by loopStart
```

Also mark those controls as `discrete: true`, `step: 1.0f`, and `rampFrames: 0` in the endpoint annotations so hosts present integer automation. DSP snapping is still required as the last line of defense.

Continuous controls should be smoothed in DSP:

```text
enabled: ramped bypass
globalMix: ramped wet/dry
manualBpm: smoothed for internal/manual clock
swing: smoothed but latched at step boundaries
```

Discrete controls should not glide through intermediate values. Snap them immediately, then latch timing-sensitive values at the next step boundary unless the transport is stopped.

## Sequencer Constants

Use fixed sizes. This avoids dynamic allocation and keeps Cmajor event structs simple.

```cmajor
let seqStepCount = 32;
let seqLaneCount = 4;
let seqPatternCount = 12;
let seqParamCount = 8;

let laneFilter = 0;
let laneCrusher = 1;
let laneTapeStop = 2;
let laneStutter = 3;
```

For v1, only the current pattern needs to be uploaded to DSP. The UI can store all 12 patterns in host stored state.

## Pattern Data

Use explicit `bool[32]` step arrays rather than signed 32-bit masks. A 32-step bitmask stored in a signed `int32` puts step 32 in the sign bit, which makes simple bit shifts brittle. The payload is still small, and the boolean array is harder to misread.

`activeSteps` says whether a lane is on for a step.

`triggerSteps` says whether a stateful lane restarts or captures a new buffer point at that step. A 4-step tape-stop block can trigger only on the first step and continue for 4 steps, or it can include later trigger steps when the user wants a new tape capture inside the same active run.

Pattern upload:

```cmajor
struct SeqPatternUpload
{
    int32 patternIndex;
    int32 revision;
    bool authoritative;

    bool[seqLaneCount, seqStepCount] activeSteps;
    bool[seqLaneCount, seqStepCount] triggerSteps;

    float32[seqLaneCount, seqStepCount] mix;
    float32[seqLaneCount, seqStepCount, seqParamCount] params;
}
```

Per-step settings are part of the core model. Every lane step stores its own mix value and its own fixed parameter vector. For example:

```text
Filter step 5 can have its own mode, start cutoff, end cutoff, resonance, curve, and mix.
Crusher step 9 can have its own bit depth, rate reduction, drive, and mix.
Tape step 12 can have its own duration scale, slowdown curve, end behavior, release, and mix. Editing duration scale makes step 12 a trigger.
Stutter step 20 can have its own slice length, playback speed, retrigger mode, and mix. Editing slice length makes step 20 a trigger.
```

That means the UI inspector edits the selected step or selected block by writing into `params[lane, step, paramIndex]` and `mix[lane, step]`.

Canonical parameter index map:

```text
Filter params:
0 mode, step-latched, 0 lowpass / 1 highpass / 2 bandpass
1 startCutoffHz, step-latched, clamped 20 Hz to min(20000 Hz, processor.frequency * 0.45)
2 endCutoffHz, step-latched, clamped 20 Hz to min(20000 Hz, processor.frequency * 0.45)
3 resonanceQ, step-latched, clamped 0.1 to 20
4 curve, step-latched, clamped 0.25 to 4
5-7 reserved, write 0 and ignore

Crusher params:
0 bitDepth, step-latched, snapped 4 to 16
1 holdFrames, step-latched, snapped 1 to 64 or resolved from tempo subdivision
2 driveDb, step-latched, clamped 0 dB to 36 dB
3-7 reserved, write 0 and ignore

Tape params:
0 durationScale, trigger-latched, clamped 0.05 to 4.0
1 curvePower, step-latched, clamped 0.25 to 4.0
2 endBehavior, step-latched, 0 fade / 1 hold
3 releaseMs, step-latched, clamped 1 ms to 250 ms
4-7 reserved, write 0 and ignore

Stutter params:
0 sliceLength, trigger-latched, discrete length index
1 playbackSpeed, step-latched, clamped 0.5x to 2x
2 retriggerMode, step-latched, 0 block start / 1 every active cell
3-7 reserved, write 0 and ignore
```

Loop bounds are global host macro controls. They are not stored inside `SeqPatternUpload`, which prevents host automation and pattern uploads from fighting over the same loop start/length values.

Revision and ownership rules:

```text
The UI owns editable pattern contents.
The DSP owns the currently accepted compiled pattern.
Each stored-state edit increments a monotonically increasing revision.
DSP keeps acceptedRevision[12], one accepted revision per pattern.
DSP accepts an authoritative upload for the selected pattern even if its revision is older than acceptedRevision[patternIndex].
DSP ignores a non-authoritative upload only if revision < acceptedRevision[patternIndex] for that same pattern.
Pattern selection never compares revisions across different patterns.
Boot, host recall, and pattern selection use authoritative uploads.
Every committed edit to the currently selected pattern uploads one complete non-authoritative SeqPatternUpload with a new revision.
Edits to non-selected patterns are persisted in UI state and uploaded when that pattern becomes selected.
```

This avoids a half-updated selected pattern and removes the need for lane-upload merge logic. A complete current-pattern payload is small enough for interactive edits.

Per-step playback rules:

```text
One contiguous active run is one block.
Every active step latches its own step-latched params at the step boundary.
Step-latched params are audible for that step.
Trigger-latched params are read when triggerSteps[lane, step] is true or when a lane becomes active.
Editing a trigger-latched param in the UI automatically marks that cell as a trigger.
triggerSteps only decide whether a stateful effect restarts or captures a new buffer point.
```

A single dragged 4-step block can therefore keep one continuous tape/stutter state while still changing cutoff, resonance, crusher bits, wet mix, stutter speed, or other step-latched parameters at each step. If the user edits a trigger-latched field such as tape duration or stutter slice length on a later step, the UI makes that later step a trigger so the entered setting is audible on that step.

Parameter classes:

```text
Filter step-latched: mode, start cutoff, end cutoff, resonance/Q, curve, mix.
Crusher step-latched: bit depth, rate reduction, drive, mix.
Tape trigger-latched: duration scale.
Tape step-latched: slowdown curve, end behavior, release, mix.
Stutter trigger-latched: slice length.
Stutter step-latched: playback speed, retrigger mode, mix.
```

Do not hide this in code. The UI should visually distinguish trigger-latched fields from normal step-latched fields, because changing those fields changes capture/restart behavior.

At each step boundary:

```text
currentStep = step inside loop
laneActive = activeSteps[lane, currentStep]
laneTrigger = triggerSteps[lane, currentStep], or lane just became active
stepMix = mix[lane, currentStep]
stepParams = params[lane, currentStep]
segmentLengthSteps = active cells from currentStep until lane inactive, loop boundary, or the next trigger step
segmentDurationFrames = sum actual per-step frame durations across that segment
```

Host jumps, pattern changes, loop changes, and transport stops should force time effects into a short release ramp so old buffer state does not spill into the wrong musical position.

The segment duration rule must account for swing. Do not compute a multi-step segment as `segmentLengthSteps * currentStepDurationFrames`, because even and odd swung steps have different durations. Use a helper that sums the real duration of each step in the segment.

## Clocking

Support three modes:

- Host: derives position from host timeline events. This should be the default in DAWs.
- Internal: uses manual BPM and a UI play/reset command. This is needed for `cmaj play` and standalone testing.
- Manual: lets the grid run independently for sound design.

Step duration:

```text
1/8 step  = 0.5 quarter notes
1/16 step = 0.25 quarter notes
1/32 step = 0.125 quarter notes
```

Swing should change pairs of steps without changing the total pair duration:

```text
even step duration = baseStepDuration * (1 + swing)
odd step duration  = baseStepDuration * (1 - swing)
```

Clamp swing to a safe range such as `0..0.45`.

Swing parity is loop-local and anchored to `loopStart`. The first step in the active loop is the even swung step, regardless of its absolute grid index. Keep that parity fixed for any active segment.

When a segment spans several steps, compute its musical length from the actual step schedule. With swing enabled, a 2-step segment should equal one even swung step plus one odd swung step, not two copies of the current step. If host tempo, rate, or swing changes while a tape/stutter segment is already running, keep the current segment stable and apply the new timing to the next trigger, lane activation, or step transition as defined by the effect. If the host position jumps discontinuously, release active time effects instead of trying to stretch stale buffer state.

Emit `SeqMonitor` immediately on step changes, transport start/stop, host jumps, reset, and pattern changes. During steady playback, throttle redundant monitor frames to about 30 Hz:

```cmajor
struct SeqMonitor
{
    int32 patternIndex;
    int32 currentStep;
    float32 stepPhase;
    bool[seqLaneCount] activeNow;
    int32 clockMode;
    float32 tempoBpm;
    bool transportRunning;
}
```

The UI uses this only for playhead display and simple diagnostics.

## Shared Circular Buffer Rules

Tape stop and stutter must use wrap-safe fractional reads. Do not open-code buffer math in each effect.

```text
writeRing(buffer, writeIndex, sample):
  buffer[writeIndex] = sample
  writeIndex = wrap(writeIndex + 1)

readRingFractional(buffer, position):
  wrappedPosition = wrap(position)
  read four wrapped neighbors or two wrapped neighbors, depending on interpolation choice
  return interpolated stereo sample
```

All read positions must be wrapped before interpolation. Render tests must include reads near the physical end of each ring buffer.

## Transport Ownership

Host clock mode:

```text
Host owns play, stop, tempo, and position.
UI play/reset buttons are disabled or ignored.
patternSelect remains host-automatable, but the UI can also write it when the user clicks a pattern button.
```

Internal/manual clock modes:

```text
internalPlay: int32 event, 1 means run, 0 means pause.
internalReset: int32 event, any value resets internal position to loopStart.
manualBpm controls tempo.
```

The pattern contents are not stored inside `patternSelect`. `patternSelect` is a snapped host-owned macro control. The UI must resolve the current `patternSelect` parameter value before uploading a pattern after boot.

## DSP Processor Loop

Per sample:

```text
dry = audioIn

update host/internal clock
detect new step or host jump
if new step:
  compute lane active/trigger state
  compute block lengths
  latch block parameters

stage = dry

stage = mix(stage, processFilterEnvelope(stage), filterWet)
stage = mix(stage, processBitCrusher(stage), crusherWet)

write tape history from stage
stage = mix(stage, processTapeStop(stage), tapeWet)

write stutter history from stage
stage = mix(stage, processStutter(stage), stutterWet)

audioOut = mix(dry, stage, globalMixWithBypassRamp)

if monitor transition happened or monitor interval elapsed:
  emit SeqMonitor
```

Use a bypass/global mix ramp. Do not hard-switch `enabled` or `globalMix`.

## Filter Envelope Lane

Purpose: trigger a one-shot filter sweep over a cell or block.

Input/output position in chain:

```text
input: dry input or previous chain stage
output: filtered signal into the bit crusher
```

Use a Cmajor standard-library filter. First choice is a state-variable or TPT/SVF style filter if the exact syntax compiles cleanly. Fallback is the locally proven `std::filters::simper` direction. Avoid hand-rolling a custom filter for v1.

On each active step boundary:

```text
envAgeFrames = 0
envDurationFrames = max(1, stepDurationFrames)
startCutoffHz = clamp(param, 20 Hz, min(20000 Hz, processor.frequency * 0.45))
endCutoffHz = clamp(param, 20 Hz, min(20000 Hz, processor.frequency * 0.45))
q = clamp(param, 0.1, 20)
mode = param
```

Each sample:

```text
phase = clamp(envAgeFrames / envDurationFrames, 0, 1)
env = curve(phase)
cutoffHz = exp(lerp(log(startCutoffHz), log(endCutoffHz), env))
smoothedCutoffHz = smooth(cutoffHz)
filtered = filter(stage, smoothedCutoffHz, q, mode)
wet = lane mix ramp
```

At every active step boundary, the filter lane updates from that step's params. Cutoff and Q should ramp smoothly. If the filter mode changes while the lane is already wet, crossfade between the previous mode and new mode over a short fixed window, such as 5 ms, or ramp the lane wet down/up around the mode switch. Do not hard-switch a resonant filter mode at full wet.

Parameters:

- Mix
- Mode: lowpass, highpass, bandpass
- Start cutoff
- End cutoff
- Resonance/Q
- Curve

Use log cutoff mapping. Linear Hz mapping makes the low-frequency region too hard to control.

## Bit Crusher Lane

Purpose: reduce amplitude resolution and optionally reduce sample update rate.

Input/output position in chain:

```text
input: filter envelope output
output: crushed signal into tape stop
```

Quantization:

```text
driveGain = dbToGain(driveDb)
driven = clamp(input * driveGain, -1, 1)
bits = map param to 4..16
levels = (1 << (bits - 1)) - 1
```

Sample-rate reduction:

```text
holdFrames = map param to 1..64, or tempo-synced subdivision
if holdCounter == 0:
  held = driven
crushed = round(held * levels) / levels
output = crushed
holdCounter = (holdCounter + 1) % holdFrames
```

Crusher order for v1:

```text
pre-drive -> intentional clip to [-1, 1] -> sample-rate hold -> bit quantize
```

At every active step boundary, update bit depth, rate reduction, drive, and mix from that step's params. Bit depth and hold length are snapped to valid integer values; drive and mix should ramp.

If bit depth, hold length, or drive changes at a step boundary, recapture `held` from the current driven input and reset `holdCounter` to zero. A new step should not begin with the previous step's held sample.

Parameters:

- Mix
- Bits
- Rate reduction
- Drive

Use a wet ramp. Hard-switching a crusher can be useful as a special effect, but the default behavior should avoid accidental clicks.

## Tape Stop Lane

Purpose: create a classic slow-down pitch drop by reading from a rolling buffer at a decreasing speed.

Input/output position in chain:

```text
input: bit crusher output
output: slowing signal into stutter
```

Use zero added latency for v1. A real-time insert cannot read future audio without lookahead latency, so the tape stop should use a history buffer and the current chain signal.

Continuously write the chain stage into `tapeHistory`. On trigger:

```text
tapeActive = true
tapeElapsedFrames = 0
durationScale = clamp(param, 0.05, 4.0)
tapeDurationFrames = max(1, segmentDurationFrames * durationScale)
tapeReadHead = current tape write head
tapeLastSample = current input
start 2-5 ms capture crossfade from old tape output to new tape output if tape was already wet
```

At every active step boundary, update tape mix, curve, release, and end behavior from that step's params. Duration scale is trigger-latched: only a trigger captures a new read head and restarts the slowdown with the step's duration. The UI automatically marks a step as a trigger when the user edits duration scale for that step.

Each sample while active:

```text
progress = clamp(tapeElapsedFrames / tapeDurationFrames, 0, 1)
curvePower = clamp(stepParam, 0.25, 4.0)
speed = pow(max(0, 1 - progress), curvePower)
tapeReadHead += speed
tapeOut = readRingFractional(tapeHistory, tapeReadHead)
tapeLastSample = tapeOut
```

At the end, either hold `tapeLastSample` briefly or fade from `tapeLastSample` to silence depending on parameter. In both cases, release with a small ramp.

Buffer:

```text
maxTapeSeconds = 8
tapeBufferSize = int(processor.maxFrequency * maxTapeSeconds) + safety
float32<2>[tapeBufferSize] tapeHistory
wrap<tapeBufferSize> tapeWriteIndex
int32 validTapeFrames
```

Parameters:

- Mix
- Duration scale
- Curve
- End behavior: hold or fade
- Release milliseconds

Implementation warning: because tape stop sits after the bit crusher, it reads and slows the crushed signal. That is the requested sound path.

Warmup rule: until `validTapeFrames` is large enough for the requested read position, dry-pass the tape lane or ramp the wet amount to zero. Never read uninitialized history on first load, after reset, or immediately after a transport jump.

## Stutter/Loop Lane

Purpose: repeat short chunks of the final effected chain signal.

Input/output position in chain:

```text
input: tape stop output
output: final wet chain before global wet/dry
```

Use zero added latency for v1. The stutter captures the signal immediately before the trigger point. If we later need to capture transients just after the grid line, that requires a lookahead mode with fixed plugin latency.

Continuously write the post-tape chain signal into `stutterHistory`. On trigger:

```text
sliceFrames = clamp(map slice parameter to tempo length, 2, stutterBufferSize - safety)
readStart = stutterWriteIndex - sliceFrames
readLength = sliceFrames
phase = 0
start 2-5 ms capture crossfade from old stutter output to new loop output if stutter was already wet
```

At every active step boundary, update stutter mix, playback speed, and retrigger mode from that step's params. Slice length is trigger-latched: only a trigger captures a new slice start with the step's slice length. The UI automatically marks a step as a trigger when the user edits slice length for that step.

If `validStutterFrames < sliceFrames`, do not start the loop yet. Dry-pass or use a zero-wet ramp until enough signal has accumulated. This avoids stale buffer reads on first load, reset, and very long slice requests.

Each sample while active:

```text
readPosition = readStart + phase * readLength
loopOut = readRingFractional(stutterHistory, readPosition)
phase += playbackSpeed / readLength
if phase >= 1:
  phase -= floor(phase)
```

At the loop wrap, crossfade the end and beginning of the slice:

```text
crossfadeFrames = clamp(min(5 ms, readLength / 4), 1, max(1, readLength / 2))
```

Buffer:

```text
maxStutterSeconds = 8
stutterBufferSize = int(processor.maxFrequency * maxStutterSeconds) + safety
float32<2>[stutterBufferSize] stutterHistory
wrap<stutterBufferSize> stutterWriteIndex
int32 validStutterFrames
```

Parameters:

- Mix
- Slice length: 1/64, 1/32, 1/16, 1/8, 1/4, or block
- Playback speed: 0.5x, 1x, 2x
- Retrigger mode: block start or every active cell

Defer reverse playback, randomization, probability, and granular modes until the basic stutter is correct.

## UI

Build one purpose-specific React UI under `ui/seqfx`.

Top bar:

- Power
- Global Mix
- Pattern 1-12
- Clock: Host, Internal, Manual
- Manual BPM
- Rate: 1/8, 1/16, 1/32
- Swing
- Loop start
- Loop length
- Play and Reset for non-host clock

Grid:

- 4 rows x 32 steps
- Rows: Filter, Crusher, Tape Stop, Stutter
- Click/drag to paint cells
- Drag block edge to resize a contiguous block
- Click a cell to select that exact step
- Shift-click or drag-select a block to edit multiple steps together
- Playhead highlight from `SeqMonitor`

Inspector:

- Filter: mix, mode, start cutoff, end cutoff, resonance, curve
- Crusher: mix, bits, rate, drive
- Tape Stop: mix, duration, curve, end behavior, release
- Stutter: mix, slice, speed, retrigger mode

Inspector edit rules:

- The selected cell is the default editable unit.
- A cell edit changes only `mix[lane, step]` and `params[lane, step]` for that cell.
- A block edit is an explicit multi-select operation and copies edited values into every selected active step.
- Trigger-latched fields, such as tape duration or stutter slice length, are single-cell edits in v1.
- Editing a trigger-latched field automatically sets `triggerSteps[lane, step] = true` for that one cell.
- Multi-select editing disables trigger-latched fields unless the user collapses the selection to one cell.

Keep keyboard/mouse interactions simple:

- Click toggles one cell.
- Drag paints a contiguous block.
- Inspector edits the selected cell unless a multi-step selection is active.
- Option/Alt drag can erase, if needed.
- Do not add nested modulation editors in v1.

## UI State And DSP Upload

Use a new stored state key:

```text
seqfx.v1
```

UI owns the editable 12-pattern contents. DSP owns only the currently accepted compiled pattern. `patternSelect` is not part of `seqfx.v1`; it is a snapped host-owned macro parameter that the UI may write when the user clicks a pattern button.

Edit focus is UI-local and not persisted. On boot and pattern changes, clear the selected cell and multi-select range, and disable the inspector until the user selects a cell. This avoids applying inspector edits to a stale hidden selection after recall.

Use the same stored-state echo suppression pattern as the existing modulation bridge:

```text
Before sendStoredStateValue, remember the serialized payload as a pending echo.
When stored state comes back from the host, ignore it if it matches a pending echo.
Only apply host stored state when it is not one of our own pending echoes.
```

This prevents boot/edit loops where the UI re-applies its own older state and uploads duplicate or stale patterns.

Boot:

```text
attach stored-state listener
attach patternSelect listener
attach monitorOut listener
request full stored state and wait for the callback
normalize or create default state
persist normalized state if migration changed it
request current parameter values and wait until patternSelect has a resolved snapped value
clear edit focus
upload exactly one authoritative SeqPatternUpload for the resolved selected pattern
```

Edit:

```text
on pointer-down/gesture start, snapshot the selected pattern index
all edits in that gesture apply to the snapshotted pattern, even if patternSelect changes mid-gesture
queue live patternSelect changes until the gesture commits
on pointer-up/commit, update local React state
persist seqfx.v1
if the edited pattern is still selected, upload one complete non-authoritative SeqPatternUpload with the new revision
if a queued patternSelect change exists, apply it after the edit commit and upload an authoritative SeqPatternUpload for the newly selected pattern
if edited pattern is not selected after commit, persist only and upload it when selected
```

Pattern select:

```text
send snapped patternSelect value
when the parameter value resolves, clear edit focus and upload that selected pattern as one authoritative SeqPatternUpload
keep listening to patternSelect for the life of the UI
if host automation or preset recall changes patternSelect, treat it as authoritative and upload that pattern
```

Host automation:

- Expose stable macro controls as `input value`: enabled, global mix, selected pattern, clock mode, manual BPM, rate, swing, loop start, loop length.
- Do not expose each cell or per-cell parameter as a host parameter.
- Pattern contents travel through stored state and event uploads.
- Snap discrete macro controls in DSP before use.
- Smooth continuous macro controls in DSP, and latch timing-sensitive values at step boundaries.

MIDI:

- Add optional MIDI pattern switching later only if the generated effect plugin receives MIDI reliably in target hosts.
- Do not make MIDI required for v1 operation.

## Tests

Cmajor compile:

```text
cmaj play --dry-run --stop-on-error fx/seqfx/SeqFx.cmajorpatch
```

DSP tests:

- Disabled plugin passes audio through.
- Empty grid passes audio through.
- Silence stays silent.
- Bit crusher reduces the number of output levels.
- Stutter repeats a known slice.
- Tape stop on a sine lowers zero-crossing rate over the block.
- Filter envelope changes low/high spectral energy in the expected direction.
- A multi-step active run with different per-step filter cutoff or crusher bits changes audibly at each step without requiring a new trigger.
- Editing tape duration or stutter slice length on a later step creates a trigger and makes the new capture setting audible on that step.
- Bit crusher recaptures or re-quantizes the held sample when bit depth or hold length changes at a step boundary.
- Tape curve clamps keep `curvePower` positive and bounded.
- Tape and stutter retrigger while already wet crossfade without a hard discontinuity.
- Tape and stutter ring-buffer render tests run past the physical buffer size and trigger near wraparound.
- Swing parity is loop-local and anchored to `loopStart`.
- Transport jumps, pattern changes, and loop changes do not produce NaN or infinite samples.
- A 2-step block with swing enabled uses the sum of the two actual swung step durations.
- Tempo/rate/swing changes during an active tape or stutter block release or retime cleanly according to the documented rule.
- Tape and stutter warmup dry-pass until their history buffers contain enough valid frames.
- Filter cutoff clamps prevent `log(0)` and negative cutoff values.
- Tape duration clamps prevent division by zero and hold/fade uses the final interpolated sample.

UI tests:

- Painting cells builds the expected `activeSteps` array.
- Resizing a block creates one trigger step and multiple active steps.
- Stored state migration fills missing fields.
- Stored-state echo suppression ignores our own persisted payload.
- Host-automated `patternSelect` resolves before pattern upload.
- The UI keeps a live listener on `patternSelect` and uploads the newly selected full pattern when it changes.
- A paint/edit gesture stays bound to the pattern selected at gesture start, even if host automation changes `patternSelect` before pointer-up.
- Editing a trigger-latched field automatically marks the affected cell as a trigger.
- Multi-select edits disable trigger-latched fields, so one block edit cannot accidentally create repeated tape/stutter retriggers.
- Single-cell edit, multi-select edit, and cleared edit focus after pattern change all target the intended step or no step.
- Editing the selected pattern sends one complete `SeqPatternUpload`.
- Stale non-authoritative full-pattern uploads with older revisions are ignored in the fake DSP bridge.
- Authoritative selected-pattern uploads are accepted even when their revision is older than the prior accepted revision for that pattern.
- Reopen simulation restores stored state, restores host parameters, reconciles `patternSelect`, handles a dirty non-selected pattern, and ends with UI, DSP, and monitor on the same selected pattern.
- `SeqMonitor` updates the highlighted step immediately on step, stop/start, reset, and pattern change.

Manual host verification:

- Load as an audio effect, not an instrument.
- Host play starts the grid in Host clock mode.
- Host stop releases active tape/stutter state cleanly.
- Tempo changes do not drift over several bars.
- Offline export timing matches realtime playback.
- Pattern stored state recalls after closing and reopening the plugin.

## Deferred Features

Do not include these in v1:

- Draggable lane order
- Reverse stutter
- Granular slicing
- Random probability per step
- Dedicated modulation lanes
- Lookahead stutter
- Tape start
- Per-effect oversampling
- Per-cell host automation
- More than 32 steps

Each of those can be added later, but none is required to prove the core plugin.

## Main Risks

Host timeline reliability is unknown until tested in a generated plugin. The internal clock is the fallback, not an optional extra.

Zero-latency stutter captures pre-trigger audio. If users expect post-grid transient capture, we need a fixed-latency lookahead mode.

Tape stop behavior depends on correct fractional buffer reads and ramping. It should be tested with simple sine and impulse inputs before judging it by ear.

Filter implementation syntax must be verified against the installed Cmajor version. Prefer standard-library filters and compile early.

UI upload size should stay simple and predictable. Store all patterns in UI state, but upload one complete selected-pattern payload to DSP after selection changes and after edits to the selected pattern.

Pattern upload correctness depends on revision handling. DSP must reject stale non-authoritative uploads and must accept authoritative selected-pattern uploads from boot, recall, and pattern selection even if their revision is older than the prior in-memory revision.

Discrete macro controls are floats at the host boundary but integers in the sequencer. DSP must snap/clamp them before they affect pattern lookup or timing.

The fixed signal path is intentional. Tests and UI labels should reflect:

```text
filter envelope -> bit crusher -> tape stop -> stutter/loop
```

## Phased Implementation And Acceptance Criteria

The final target is the full four-lane plugin described in this document. These phases are only the order of implementation and verification. Do not deliver a reduced one-lane plugin as the finished result.

The plan is complete only when all four requested lanes exist and the fixed chain is working:

```text
filter envelope -> bit crusher -> tape stop -> stutter/loop
```

### Phase 1: Separate Effect Skeleton, Build Path, And Timeline Probe

Scope:

- Create `fx/seqfx/SeqFx.cmajorpatch` and `fx/seqfx/SeqFx.cmajor` as a separate stereo insert effect.
- Add `ui/vite.seqfx.config.mjs`, `ui/seqfx/patch-view-entry.tsx`, and generated output at `fx/seqfx/view/index.js`.
- Add `seqfx:ui:build`, `seqfx:play`, `seqfx:dry-run`, `seqfx:plugin:generate`, and optional `seqfx:jit:install`.
- Add a tiny generated-plugin timeline probe before relying on Host clock mode.

Acceptance criteria:

- `npm run seqfx:ui:build` creates `fx/seqfx/view/index.js`.
- `npm run seqfx:dry-run` compiles a pass-through stereo effect with no errors.
- `npm run seqfx:plugin:generate` generates the JUCE project after building the UI.
- A render or dry-run confirms disabled/empty SeqFX passes stereo input through unchanged.
- The timeline probe confirms whether `std::timeline::Position`, `Tempo`, and `TransportState` arrive in the generated insert effect. If they do not, Host clock mode is marked unverified and Internal clock remains the required working path.

### Phase 2: Sequencer Core, Host Controls, And UI State

Scope:

- Implement fixed 32-step, 4-lane, 12-pattern data with `SeqPatternUpload`.
- Implement the canonical parameter index map, `authoritative` pattern upload handling, and per-pattern `acceptedRevision[12]`.
- Implement snapped/discrete host controls, Internal clock, Host clock fallback behavior, swing, loop bounds, and `SeqMonitor`.
- Build the 4 x 32 grid UI, stored state key `seqfx.v1`, full selected-pattern uploads, stored-state echo suppression, edit-focus clearing, gesture transactions, and live `patternSelect` listener.

Acceptance criteria:

- Discrete host controls expose integer metadata and are still snapped/clamped in DSP.
- The UI boots transactionally: listeners attach first, stored state resolves, `patternSelect` resolves, edit focus clears, and exactly one authoritative selected-pattern upload is sent.
- Editing the selected pattern sends one complete non-authoritative `SeqPatternUpload`.
- Host or UI pattern changes send one authoritative selected-pattern upload.
- Stale non-authoritative uploads are rejected, while authoritative selected-pattern uploads are accepted even with older revisions.
- Single-cell edit, multi-select edit, trigger-latched field edit, pattern switch, and reopen/recall paths are covered by UI tests.
- `SeqMonitor` updates immediately on step, transport, reset, host jump, and pattern changes, and is throttled during steady playback.

### Phase 3: Step-Latched Filter Envelope And Bit Crusher

Scope:

- Implement the first half of the requested chain:

```text
dry input -> filter envelope -> bit crusher
```

- Implement per-step filter params: mode, start cutoff, end cutoff, resonance/Q, curve, and mix.
- Implement per-step crusher params: bit depth, hold frames/rate reduction, drive, and mix.
- Implement DSP safety: cutoff clamps before `log`, Q clamps, filter mode transition handling, crusher held-sample recapture on step param changes, wet ramps, and inactive-lane pass-through.

Acceptance criteria:

- A multi-step active run with different filter cutoff or crusher bit settings changes audibly at each step without requiring a new trigger.
- Filter cutoff tests prove no `log(0)`, negative cutoff, NaN, or unstable filter state.
- Crusher tests prove bit-depth reduction, rate hold behavior, drive behavior, and held-sample recapture at step boundaries.
- Empty lanes and inactive steps pass audio through.
- The UI inspector edits the selected filter/crusher cell by default, and explicit multi-select edits copy values only to selected steps.

### Phase 4: Tape Stop And Stutter/Loop Time Effects

Scope:

- Complete the requested chain:

```text
dry input -> filter envelope -> bit crusher -> tape stop -> stutter/loop -> global wet/dry
```

- Implement shared wrap-safe circular fractional reads for tape and stutter.
- Implement tape trigger-latched duration scale plus step-latched curve, end behavior, release, and mix.
- Implement stutter trigger-latched slice length plus step-latched playback speed, retrigger mode, and mix.
- Implement warmup behavior, capture crossfades, loop-wrap crossfades, release ramps, positive bounded tape `curvePower`, and ring-buffer wraparound safety.

Acceptance criteria:

- Editing tape duration or stutter slice length marks that cell as a trigger and makes the new capture setting audible on that step.
- Multi-select editing disables trigger-latched fields so one block edit cannot accidentally create repeated tape/stutter retriggers.
- Tape stop on a sine lowers zero-crossing rate over the segment and never produces NaN or infinity.
- Stutter repeats a known slice, handles fractional playback speed, and crossfades wrap points.
- Tape and stutter dry-pass until history buffers contain enough valid frames.
- Render tests run past the physical tape/stutter buffer sizes and trigger near wraparound.
- Retriggering tape or stutter while already wet crossfades without a hard discontinuity.

### Phase 5: Full Plugin Integration, Recall, And Host Verification

Scope:

- Verify the complete plugin as one effect, not four isolated lanes.
- Verify the fixed signal path, global wet/dry, host/internal clock behavior, state recall, DAW loading, and generated plugin behavior.
- Keep deferred features out of v1 unless they are required to make the requested four-lane plugin correct.

Acceptance criteria:

- The full chain order is proven by tests or controlled renders:

```text
filter envelope -> bit crusher -> tape stop -> stutter/loop
```

- Disabled plugin, empty grid, and global mix 0 pass audio through.
- Global mix 1 outputs the complete wet chain.
- Swing parity is loop-local and anchored to `loopStart`; tests cover loop starts other than step 0.
- Tempo/rate/swing changes and host jumps do not leave stale tape/stutter state in the wrong musical position.
- Reopen simulation restores stored state, restores host parameters, reconciles `patternSelect`, handles a dirty non-selected pattern, and ends with UI, DSP, and monitor on the same selected pattern.
- The generated plugin loads as an audio effect, not an instrument.
- Manual host verification covers play, stop, tempo changes, offline export timing, and pattern recall.
- The final result includes all four requested lanes and passes the focused DSP/UI tests for each lane plus the integration tests above.

Do not start with a large generalized sequencer library. Start with the one plugin behavior described here, then complete every lane in the requested chain.
