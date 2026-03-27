# Phase 6A: Fixed MSEG To Wavetable Position

This document defines the next implementation slice for MSEG.

It is intentionally smaller than the broader phase-6 work. The goal here is not a full modulation system. The goal is to land one real MSEG editor, one real MSEG reader, and one real audible destination inside the existing synth without choosing an architecture that blocks later loop behavior, tempo sync, import, or a route matrix.

## Goal

Ship exactly this:

- one editable MSEG in the GUI
- point add, move, and delete
- one fixed route from `MSEG 1` to wavetable frame scanning
- one depth control for that route
- one deterministic DSP playback path that modulates the existing wavetable position input

That is the smallest honest slice that proves the editor, the transport, the reader, and the audible result.

## Non-goals

Phase 6A does not include:

- a general modulation matrix
- multiple visible MSEGs
- user-facing loop controls
- tempo-sync UI
- Vital import or export UI
- free-run playback
- stereo behavior
- a full destination list

Those can come later. This step only needs to prove one real modulation path end to end.

## The design decisions we should lock now

These are the choices that matter now because changing them later would be annoying or risky.

### 1. Keep shape separate from playback

The saved editable curve must not also be the playback contract.

The shape is the drawable data:

- normalized points
- per-segment curve power
- optional global smoothing flag

The playback object is separate:

- rate
- optional loop window
- note-off policy
- hold-final behavior
- retrigger behavior

Even though phase 6A only needs one-shot seconds playback, we should still keep playback in its own object now. That makes loop behavior, tempo sync, and alternate note-off rules additive later instead of forcing a schema rewrite.

### 2. Keep loop markers independent of points

Loop behavior must not depend on point IDs or on forcing loop boundaries onto existing points.

That matters even though phase 6A will not expose loops yet. If loops are added later, they should be playback markers on the time axis, not edits to the shape itself.

### 3. Keep DSP on rendered buffers, not editable points

The GUI owns editing and rendering. The DSP owns reading.

The realtime path should never evaluate point lists directly. It should read a pre-rendered float buffer with the same padded-buffer and cubic-interpolation style already used by the wavetable code.

### 4. Keep playback state voice-local

The rendered buffer is shared. The reader state is per voice.

Even in this narrow slice, the playhead should be voice-local so later note-off behavior and loop behavior have somewhere correct to live.

### 5. Keep the route fixed in UI, but shaped correctly in code

Phase 6A should hard-wire one destination:

- `MSEG 1 -> Wavetable Position`

But the code should still treat modulation as modulation:

`effectiveFramePosition = clamp(baseFramePosition + (msegValue * depth), 0.0, 1.0)`

That keeps the modulation application point correct for the later route system.

## The phase 6A active subset

This is the subset we will actually implement now.

### Active editor behavior

- add point
- drag point
- delete point
- preserve endpoint points at `x = 0` and `x = 1`
- keep the value range unipolar `0 .. 1`

Curve editing can stay simple in 6A. The important part is that the underlying shape format still supports `curvePower`, even if the first UI barely exposes it.

### Active playback behavior

- note-triggered playback
- retrigger on note-on
- one-shot playback from `x = 0` to `x = 1`
- hold final value at the end
- seconds-based rate

No loop behavior needs to be active yet.

### Active routing behavior

- one fixed source: `MSEG 1`
- one fixed destination: wavetable frame position
- one depth scalar

## The phase 6A data model

Phase 6A should keep the future-friendly model, even though only a small subset is active.

### Shape object

```json
{
  "format": "cosimo.mseg.shape",
  "version": 1,
  "name": "MSEG 1",
  "globalSmooth": false,
  "points": [
    { "x": 0.0, "y": 0.5, "curvePower": 0.0 },
    { "x": 1.0, "y": 0.5, "curvePower": 0.0 }
  ]
}
```

Shape rules:

- first point `x == 0`
- last point `x == 1`
- `x` values are non-decreasing
- `y` is clamped to `0 .. 1`
- duplicate `x` values are allowed in the canonical model

The phase 6A UI does not need to create duplicate `x` values on purpose, but the model should not prohibit them.

### Playback object

```json
{
  "format": "cosimo.mseg.playback",
  "version": 1,
  "rate": { "kind": "seconds", "seconds": 1.0 },
  "loop": null,
  "noteOffPolicy": "finish_loop",
  "legatoRestarts": false,
  "holdFinalValue": true
}
```

What is active in 6A:

- `rate.kind = "seconds"`
- `loop = null`
- `holdFinalValue = true`

What exists for future compatibility but is not exposed yet:

- tempo-based rate
- loop windows
- alternate note-off policies

### Fixed route state

Phase 6A does not need a general route table.

It only needs:

```json
{
  "mseg1ToWavetablePositionDepth": 0.0
}
```

That depth can later become one row in a real route table without changing how the reader works.

## The runtime model

### GUI side

The GUI owns:

- editable point data
- playback settings
- rendered MSEG buffer
- persistence

The GUI should render the shape into:

- `2048` body samples
- `3` pad samples for cubic reads

### DSP side

The DSP owns:

- one shared uploaded buffer for `MSEG 1`
- the playback metadata needed for the active subset
- one voice-local reader state

For phase 6A, the reader only needs to:

- reset on note-on
- advance from `0` to `1` over the configured seconds duration
- sample the rendered buffer with cubic interpolation
- hold the final value after reaching the end

Then the synth applies:

`effectiveFramePosition = clamp(baseFramePosition + (msegValue * depth), 0.0, 1.0)`

## Why this does not paint us into a corner

This slice is small, but it preserves the decisions that matter:

- loops can be added later without changing the shape schema
- tempo sync can be added later without changing the shape schema
- import and export can be added later because the shape format is already Vital-shaped
- more destinations can be added later because modulation is already applied through a depth path instead of directly replacing the base parameter
- more sources can be added later because the code can use slot-oriented names even if only slot 1 is active in phase 6A

The main thing to avoid is singular hardcoding in the wrong places. It is fine for the UI to expose only one MSEG. It is not fine for the shape model, playback model, or reader logic to assume that MSEG is only ever a special-case wavetable hack.

## Logical tasks

Phase 6A should be implemented in four tasks.

### Task 1: Land the canonical MSEG shape and renderer

Scope:

- add the canonical shape and playback objects on the JS side
- implement the MSEG shape renderer
- render into `2048 + 3` samples
- keep the playback object separate from the shape object

Done means:

- the repo has one reusable `MsegShape` model
- the repo has one reusable `MsegPlayback` model
- a pure JS renderer turns shape data into the padded float buffer the DSP will consume
- renderer tests cover flat, ramp, and multi-point curves

Why this task comes first:

The renderer output is the contract between the editor and the DSP. That contract needs to exist before the UI and Cmajor code can converge on it.

### Task 2: Build the phase 6A editor and GUI transport

Scope:

- add an editor UI for `MSEG 1`
- support add, move, and delete
- store `MSEG 1` shape data in patch stored state
- store `MSEG 1` playback data in patch stored state
- re-render and upload the MSEG buffer whenever the shape changes
- expose one depth control for the fixed wavetable-position route

Done means:

- the user can draw an MSEG
- closing and reopening the patch restores the same MSEG
- GUI edits cause a fresh buffer upload
- the UI does not yet need loop controls or tempo-sync controls

Why this task comes second:

This is the first user-visible proof that the new model is workable, but it still stays narrow.

### Task 3: Add the DSP reader and fixed wavetable-position route

Scope:

- add one uploaded MSEG buffer path to the patch
- add one voice-local MSEG reader in Cmajor
- implement seconds-based one-shot playback
- hold the final value after playback ends
- apply the result to wavetable frame position with a depth scalar

Done means:

- a note trigger starts the MSEG reader
- the reader modulates wavetable frame scanning audibly
- the modulation is clamped correctly into the existing `0 .. 1` frame-position path
- the code path still reads from a rendered buffer, not editable point data

Why this task is separate from task 2:

The editor and the reader should meet through a clear transport boundary. Keeping them separate makes it easier to debug whether a problem is in rendering, transport, or DSP playback.

### Task 4: Prove correctness with reference tests

Scope:

- add JS tests for shape rendering
- add a Python reference reader for the phase 6A active subset
- add a Cmajor probe or equivalent integration test path
- compare MSEG playback output and resulting frame-position modulation against the reference

Done means:

- one-shot playback timing matches the reference
- endpoint holding matches the reference
- cubic reads match the reference closely enough to trust the path
- zero depth leaves wavetable position unchanged
- nonzero depth produces the expected frame-position sweep

Why this task matters:

Without this step, phase 6A would only prove that the UI changes a sound. It would not prove that the new modulation path is correct enough to extend with loops, tempo sync, or more destinations later.

## Definition of done

Phase 6A is done when all of the following are true:

- the synth has a visible `MSEG 1` editor
- the editor supports add, move, and delete
- the editor state persists
- the GUI uploads a rendered MSEG buffer
- the DSP reads that buffer deterministically
- `MSEG 1` modulates wavetable frame position through a depth control
- the behavior matches a reference implementation for the one-shot seconds-based subset

At that point the repo has a real MSEG path, not a mockup, and the next phase can add loops, tempo sync, or more destinations without undoing the phase 6A architecture.
