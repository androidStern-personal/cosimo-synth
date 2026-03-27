# MSEG Spec Draft: Vital Shape Foundation

This is a reduced draft for the MSEG system we should actually build.

It takes Vital's shape model as the foundation and layers only the Lumos playback behavior we still want on top.

This draft deliberately cuts the extra Vital features we do not need right now.

## Core Decision

- Use a Vital-style normalized point model as the canonical editable shape.
- Keep playback behavior separate from the shape.
- Keep routing separate from both.
- Render the shape into a fixed runtime buffer for DSP playback.
- Do not adopt Vital's full playback feature set.

## What We Are Keeping From Vital

- normalized point positions from `0.0 .. 1.0`
- per-segment curve power
- optional global smooth flag
- GUI-owned editable point model
- pre-rendered runtime buffer
- cubic interpolation in playback
- Vital import and export for shape data

## What We Are Not Keeping From Vital In V1

- stereo phase
- free-running host-sync LFO mode
- keytrack playback rate
- fade-in amount
- runtime output smoothing time
- Vital's `LoopPoint` and `LoopHold` unchanged

## Canonical Model

The canonical saved model is split into three objects:

1. shape
2. playback
3. routes

The runtime buffer is derived data. It is not the saved source of truth.

## Shape Object

The shape object is Vital-like, but stored in our own direct output space instead of Vital's inverted editor space.

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

### Shape Rules

- `points.length >= 2`
- first point `x == 0`
- last point `x == 1`
- `x` values are non-decreasing
- duplicate `x` values are allowed in the canonical model
- `y` is clamped to `0 .. 1`
- `curvePower` is finite and should be clamped to `[-20, 20]`

### Duplicate X Policy

The canonical model allows duplicate `x` values so imported Vital step shapes can survive exactly.

The editor UI does not have to encourage duplicate `x` values in v1. It can simply preserve them when importing and avoid creating them accidentally during normal drag editing.

## Vital Import And Export

Import Vital with:

- `x = vital_x`
- `y = 1.0 - vital_y`
- `curvePower = vital_powers[i]`
- `globalSmooth = vital_smooth`

Export Vital with:

- `vital_y = 1.0 - y`
- flatten points into `[x0, y0, x1, y1, ...]`
- emit one `powers[i]` value per point

## Playback Object

The playback object is ours, not Vital's.

```json
{
  "format": "cosimo.mseg.playback",
  "version": 1,
  "rate": { "kind": "tempo", "division": "1/4", "modifier": "straight" },
  "loop": { "startX": 0.25, "endX": 0.75 },
  "noteOffPolicy": "finish_loop",
  "legatoRestarts": false,
  "holdFinalValue": true
}
```

## Playback Scope

V1 supports two rate families:

- seconds
- tempo

We are not adding free-running host-sync LFO behavior in this draft. Playback is note-driven.

### Rate Object

Seconds mode:

```json
{ "kind": "seconds", "seconds": 0.5 }
```

Tempo mode:

```json
{ "kind": "tempo", "division": "1/8", "modifier": "triplet" }
```

Rules:

- `kind = "seconds"` means one full pass from `x = 0` to `x = 1` takes `seconds`
- `kind = "tempo"` means one full pass takes the chosen musical division at the current tempo
- `division` is one of:
  - `1/1`
  - `1/2`
  - `1/4`
  - `1/8`
  - `1/16`
  - `1/32`
- `modifier` is one of:
  - `straight`
  - `dotted`
  - `triplet`

## Generalized Playback Model

This draft deliberately avoids a long list of named playback modes.

The generalized model is:

- one shape
- one rate
- one optional loop window
- one note-off policy

That is enough to cover the useful behaviors we care about.

### No Loop

If `loop == null`:

- note-on starts playback at `x = 0`
- playback moves forward to `x = 1` at the chosen rate
- when the end is reached, the output holds the final value if `holdFinalValue` is `true`

This is the one-shot envelope case.

### Loop Present

If `loop = { startX, endX }`:

- playback always starts at `x = 0`
- the segment `0 -> startX` plays once before any looping
- while looping is active, playback wraps from `endX` back to `startX`
- the segment `endX -> 1` is the post-loop tail

This one rule covers:

- middle sustain loops
- tail loops where `endX == 1`
- start-anchored loops where `startX == 0`

## Note-Off Policy

`noteOffPolicy` only matters when a loop exists.

### `finish_loop`

- note-off disables future loop wraps
- if playback is already inside the active loop when note-off happens, it continues until `endX`
- after reaching `endX`, playback leaves the loop and continues through `endX -> 1`

This is the old Lumos behavior.

### `immediate`

- note-off disables looping immediately
- playback continues forward from the current position toward `x = 1`
- it does not wait to reach `endX` before leaving the loop

This is the useful part of Vital's `LoopHold` behavior.

### `ignore`

- note-off does not change loop behavior
- playback keeps looping while the voice remains alive

This is the useful part of Vital's `LoopPoint` behavior for long release tails or always-moving modulation.

## Loop Window Rules

- `loop` belongs to playback or preset state, not the shape object
- `startX` and `endX` are normalized `0 .. 1` positions
- loop markers can sit anywhere on the time axis
- if `endX < startX`, swap them
- if `startX == endX`, treat the loop as disabled

## Use-Case Mapping

This generalized model is simpler than named synth-specific modes, but it still covers the useful user actions.

### One-shot modulation

```json
{
  "loop": null
}
```

Example uses:

- one wavetable sweep
- one filter pluck
- one pan move

### Lumos sustain loop

```json
{
  "loop": { "startX": 0.25, "endX": 0.75 },
  "noteOffPolicy": "finish_loop"
}
```

Example uses:

- attack once, repeat a middle sustain motion while held, then play a release tail

### Vital `LoopPoint`-like tail repeat

```json
{
  "loop": { "startX": 0.35, "endX": 1.0 },
  "noteOffPolicy": "ignore"
}
```

Example uses:

- one large opening sweep, then repeat only the tail section
- keep modulation moving during a long release tail

### Vital `LoopHold`-like immediate escape

```json
{
  "loop": { "startX": 0.0, "endX": 0.4 },
  "noteOffPolicy": "immediate"
}
```

Example uses:

- repeat a short early gesture while held, then leave the loop immediately on note-off

## Why This Is Simpler

This replaces a pile of named playback modes with two orthogonal questions:

1. Is there a loop window?
2. What should note-off do to that loop?

That keeps the model small while still covering the useful actions users actually want.

## Loop Seam Behavior

We do not force loop boundaries to land on points, and we do not force the loop start and loop end values to match.

That means a loop seam can be continuous or discontinuous depending on the chosen shape and loop range.

This is intentional.

Why:

- Vital's own loop-style behavior does not require matching endpoint values
- Serum's loopback-style behavior also does not depend on matched point values
- forcing loop markers onto existing points creates awkward edge cases and makes import behavior less clean

V1 rule:

- a discontinuity at the loop seam is allowed

If seam discontinuities cause audible problems on important destinations, we can add a very short optional wrap-smoothing or crossfade later. That smoothing should belong to playback behavior, not to the shape file.

## Routing Object

```json
{
  "format": "cosimo.mseg.route",
  "version": 1,
  "source": "mseg_1",
  "destination": "wavetable_position",
  "depth": 1.0,
  "polarity": "unipolar"
}
```

### Route Rules

- routes are saved separately from the shape
- routes are saved separately from playback
- polarity belongs to the route, not the shape
- unsupported destinations should not invalidate the shape or playback objects

## Runtime Buffer

The runtime buffer follows the Vital-style approach, not the old 16384-sample Lumos buffer.

- render resolution: `2048` samples
- cubic pad samples: `3`
- stored runtime layout: `[last, body[0..2047], first, second]`
- DSP reads the rendered buffer with cubic interpolation
- DSP does not walk live segments directly

## Live Edit Behavior

Live edits should still preserve the good part of the old Lumos playback design.

- the GUI owns the editable point model
- the GUI rebuilds the rendered buffer after edits
- the GUI publishes the newest rendered buffer to DSP
- the voice keeps its current musical progress across shape edits
- if a new rendered version arrives while a note is sounding, crossfade briefly from the old audible value to the new audible value instead of hard-jumping

The exact transport and crossfade implementation can follow the old Lumos runtime ideas without changing this saved model.

## Editor Behavior We Still Want

- point-based editing
- undo and redo
- visible grid
- snap as an editor convenience only
- first point locked to start
- last point locked to end
- no zoom or scroll in v1
- loop markers shown independently of points
- playback position marker shown during audition

## Important Constraint

Vital's shape model is the foundation.

Vital's playback model is not the source of truth.

That means:

- shape import and export should be Vital-compatible
- playback semantics should follow this draft instead of trying to mirror Vital exactly

## Deferred Items

These are intentionally out of scope for this draft:

- stereo playback offsets
- free-running LFO mode
- exact Vital `LoopHold`
- optional loop seam smoothing or crossfade control
- exact Serum shape-file parsing

## Summary

The shape system should be Vital-based.

The loop system should be generalized around:

- an optional loop window
- a note-off policy

That generalized loop system should cover:

- Lumos sustain loops
- Vital-style tail loops
- immediate loop exit on note-off

The result is:

- a simple normalized point model
- easy Vital shape import and export
- loop ranges stored in playback or preset state instead of the shape file
- a simpler playback model than a large mode list
- a real sustain loop with a release tail
- an optional tail-loop mode for intro-then-repeat behavior
- fewer playback controls than full Vital
