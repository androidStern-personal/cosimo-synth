# Phase 6: One Real MSEG Path Into The Existing Oscillator

Reconstructed on 2026-03-24 after the earlier working-tree copy was deleted. This version is rebuilt from the repo state, the proposal, and the earlier planning discussion, not recovered byte-for-byte.

## What this file is for

Add one concrete MSEG path that fits the architecture already in this repo:

- JS owns a Vital-style editable shape model and pre-renders it into a float buffer
- Cmajor stores that buffer in shared read-only control memory
- Cmajor reads it with the same padded-buffer and interpolation style already used by the wavetable code
- one routed destination proves the path end to end

The first destination should be `Wavetable Position`.

Behavior and data-model decisions now live in `MSEG_VITAL_FOUNDATION_DRAFT.md`. This file is the implementation plan for landing that model in the current repo incrementally.

## Why keep it this narrow

The repo already has:

- an offline immutable bank pipeline
- a packed sample-blob read pattern
- a tested oscillator with frame scanning

The repo does not yet need a giant modulation system to prove MSEG works. The smallest honest step is to feed one MSEG source into one existing destination and compare it against a reference.

## What the repo actually has today

The current checked-in synth is simpler than the full proposal:

- `cmajor/FixedFrameOscillator.cmajor` already has the shared immutable wavetable bank, mip selection, cubic reads, and frame scanning.
- `cmajor/WavetableSynth.cmajor` is still a single `wt::Voice` node, not a polyphonic voice allocator plus modulation system.
- the GUI in `patch_gui/index.js` only exposes wavetable position, table select, the wavetable display, and the keyboard.
- there are no MSEG endpoints, no modulation routes, no GUI-side stored MSEG state, and no tests for control-buffer upload.

That matters because the first MSEG cut needs to land inside a still-small synth, not inside the larger architecture described in `full-proposal.md`.

## The architecture to keep

- 8 shared MSEG slots
- one Vital-style normalized shape model per editable slot on the GUI side
- one pre-rendered float buffer per slot on the DSP side
- one playback object per slot with:
  - rate
  - optional loop window
  - note-off policy
- no bezier math in the realtime Cmajor path
- no per-voice copy of the MSEG buffer data

The GUI owns curve editing and buffer generation. The DSP side owns buffer playback only.

## Research-backed constraints

The current plan is supported by the runtime and by common synth behavior:

- the official Cmajor patch docs say `PatchConnection.sendEventOrValue()` coerces JavaScript arrays and objects into complex endpoint types, so JS-to-DSP buffer upload is a supported direction for this repo's patch model
- the same docs make clear that only scalar `value`/`event` endpoints become host parameters, so the MSEG buffer itself should stay on dedicated endpoints instead of pretending to be an automatable parameter
- the same patch API also exposes stored-state methods, which gives the GUI a place to persist the editable point data while the DSP only receives the rendered float buffer
- official synth manuals converge on a small set of MSEG behaviors users expect:
  - note-triggered playback
  - time in musical sync units or seconds
  - one-shot playback or playback with a loop region
  - some explicit note-off behavior for what a loop should do when a key is released
  - editable loop markers and grid/value snap

Those references do not mean phase 6 needs every one of those features. They do mean phase 6 should choose them deliberately instead of drifting into an accidental behavior set.

The current conversation narrowed that choice to a simpler generalized playback model:

- one shape
- one rate
- one optional loop window
- one note-off policy

That is simpler than carrying a large list of named synth-specific modes.

## The DSP side

Use a small shared store that looks like the current bank work:

- slot metadata
- flat float buffer storage
- deterministic indexing

For playback:

- keep a phase accumulator per running MSEG reader
- map phase into the pre-rendered buffer
- interpolate from adjacent samples
- output one normalized modulation value

The current behavior draft now prefers a Vital-style rendered shape buffer:

- 2048 body samples
- 3 pad samples for cubic reads
- cubic interpolation at playback time

That keeps the transport and read path closer to both Vital and the repo's existing wavetable code.

## The first route to ship

Ship exactly this first:

- source: `MSEG 1`
- destination: `Wavetable Position`

That lets phase 6 reuse the existing oscillator work directly. You can hear the route immediately without also needing filter, FX, or a larger routing UI.

## Recommended first cut

Keep the canonical data model broad enough for the chosen design, but stage the implementation:

- keep 8 DSP slots in the data layout so the transport format does not need to change later
- expose only one editable source in the GUI for now: `MSEG 1`
- expose only one destination in the DSP for now: wavetable position
- store the full chosen playback shape in GUI state now:
  - rate
  - optional loop window
  - note-off policy
- implement the read path in slices:
  - first one-shot playback
  - then tempo and seconds rates
  - then looping
  - then extra note-off policies
- keep the first curve range unipolar `0..1`

This is intentionally smaller than Zebra, Massive X, or Serum-style editors. The point of phase 6 is to prove transport, playback, and routing, not to clone a flagship modulation editor in one jump.

Free-run mode, stereo behavior, bipolar ranges, and a general destination list should stay as explicit later additions.

## Routing plan

Keep the shape of a route table, but prove it with a tiny route set first.

- start with a fixed route list inside a probe or minimal synth patch
- expose depth as a normal scalar
- add the general route-table editor later, after the core source and destination path is proven

For the current repo, that means:

- add one MSEG depth control in the DSP
- compute `effectiveFramePosition = clamp(baseFramePosition + (msegValue * depth), 0.0f, 1.0f)`
- feed that value into the existing frame-scanning path

There is no need to land a full source-index and destination-index table before this first proof works.

## State ownership

Keep three copies of the MSEG in clearly different roles:

- GUI editor state: control points, curve metadata, rate, optional loop window, and note-off policy
- DSP slot buffer: one immutable rendered float buffer per slot plus slot metadata needed for playback
- voice-local reader state: playback phase and trigger/reset state

Do not make the DSP side the owner of editable bezier points. Do not make the GUI side the owner of realtime playback phase.

## Concrete first implementation slices

1. JS buffer renderer

- adopt the chosen canonical shape model from `MSEG_VITAL_FOUNDATION_DRAFT.md`:
  - normalized points
  - per-segment curve power
  - optional global smooth flag
- add Vital import/export conversion at the shape layer
- render that shape model into 2048 float samples plus 3 cubic pad samples
- add pure JS tests that compare a few hand-written shapes against exact expected samples

2. GUI transport and persistence

- add one stored-state key for `MSEG 1` shape data
- add one stored-state key for `MSEG 1` playback data
- when the GUI boots, load stored state, render the float buffer, and send it to the patch
- when the user edits the curve, update stored state first, then re-render and re-send the buffer
- when the user edits rate, loop markers, or note-off policy, update stored state and re-send the slot metadata needed for playback

3. DSP shared slot store

- add slot metadata plus flat float storage for 8 MSEG buffers
- add an upload path that assigns a rendered buffer to a chosen slot
- add playback metadata per slot:
  - rate kind and value
  - optional loop start/end
  - note-off policy
- do not evaluate editable points inside Cmajor

4. DSP reader and route

- add one reader that advances from 0 to the end of the buffer over the configured rate
- reset that reader on note-on
- if looping is enabled, wrap from loop end back to loop start while looping is active
- on note-off, apply the selected note-off policy:
  - ignore
  - finish loop
  - immediate exit
- produce a normalized modulation value and apply depth to wavetable position

5. Probe and reference tests

- add a Python reference MSEG reader that uses the same 2048-sample body buffer, cubic pads, interpolation rules, loop window rules, and note-off policies
- add a Cmajor probe that receives the same buffer and playback metadata
- compare both the raw MSEG output and the resulting wavetable-position-modulated oscillator output

## Verification additions

The current repo already has a strong Python-versus-Cmajor pattern for wavetable reads. Phase 6 should extend that exact pattern:

- a flat buffer of all zeros leaves wavetable position unchanged
- a flat buffer of all ones applies the full configured depth for the whole note
- a simple ramp buffer produces the same frame-position sweep in Python and Cmajor
- note-on retrigger resets the MSEG reader to the first sample deterministically
- out-of-range depth cannot push wavetable position outside `0..1`
- a loop window with `finish_loop` exits only after reaching loop end
- a loop window with `immediate` stops wrapping immediately on note-off
- a loop window with `ignore` keeps wrapping after note-off while the voice is still alive

## Verification

Use the same testing pattern the repo already uses:

- Python builds the reference control curve
- Cmajor receives the same buffer
- `cmaj test` or an equivalent probe renders the result
- compare Cmajor output against the Python reference

The important thing to prove is not “there is an MSEG UI.” The important thing to prove is that the buffer transport, indexing, interpolation, and routing depth all behave exactly as intended.

## Done means

- Cmajor accepts at least one pre-rendered MSEG buffer
- the buffer can be assigned to a known slot
- a reader can play that slot deterministically
- the reader modulates wavetable position in the existing oscillator path
- the result matches a Python reference run closely enough to treat the path as correct

## What this step does not include

- a full modulation-matrix UI
- 32 general routes exposed to the host
- bipolar/unipolar switching
- live user wavetable import
- per-voice filter modulation
- making MSEG “the” modulation system

The point here is simpler: prove one real MSEG-to-oscillator path using the chosen Vital-based shape model, the simplified loop-window-plus-note-off-policy playback model, and the data layout and testing style the repo already has.
