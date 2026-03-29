# Phase 6B: MSEG Playback Controls

This document defines the next implementation slice after phase 6A.

Phase 6A proved one real MSEG path end to end:

- one editable MSEG in the GUI
- one rendered buffer upload path
- one deterministic DSP reader
- one fixed route from `MSEG 1` to wavetable frame position

Phase 6B should add the first user-facing playback controls for that path without jumping ahead into a full modulation system or a full MSEG editor feature set.

## Goal

Ship exactly this:

- one user-facing rate control for `MSEG 1`
- looped playback instead of one-shot playback for the current routed MSEG
- deterministic DSP loop behavior that still reads the rendered buffer
- stored playback state that survives closing and reopening the patch
- reference-tested parity between the JavaScript reference path and the Cmajor reader

That is the smallest honest step that makes the current MSEG feel like an always-moving modulation source instead of a one-shot demo path.

## Non-goals

Phase 6B does not include:

- multiple visible MSEGs
- a general modulation matrix
- tempo-sync UI
- visible loop markers in the editor
- arbitrary user-editable loop ranges
- user-facing note-off policy controls
- free-run host-time playback
- Vital import or export UI
- stereo playback behavior

Those are still later steps.

## The design decisions to lock now

These are the choices that matter in phase 6B because they determine whether later loop-window and playback work can stay additive.

### 1. Keep the canonical playback object broad

The phase 6B UI should stay narrow, but the playback object should remain the same future-facing object introduced in phase 6A:

- `rate`
- `loop`
- `noteOffPolicy`
- `holdFinalValue`
- `legatoRestarts`

Phase 6B should not replace that with ad hoc booleans like `isLooping` or `isOneShot`.

### 2. Expose one rate family only

The user-facing control in phase 6B should be seconds-based.

That means:

- the UI edits `rate.kind = "seconds"`
- the UI edits `rate.seconds`
- tempo-sync stays out of scope for this step

This keeps the current implementation small while still making the playback speed clearly controllable.

### 3. Make the current routed MSEG loop by using the real loop field

The current product behavior should change from one-shot playback to looped playback, but phase 6B should do that by writing real playback data:

```json
{
  "loop": { "startX": 0.0, "endX": 1.0 }
}
```

That matters because later arbitrary loop windows should extend the same field, not replace a temporary special case.

### 4. Keep note-off behavior simple but real

Phase 6B should use one note-off behavior for the active UI path:

- `noteOffPolicy = "finish_loop"`

That means:

- while the note is held, the MSEG keeps wrapping
- after note-off, the current pass continues to the loop end
- once that pass reaches the loop end, playback stops wrapping and the output follows normal end-of-shape behavior

Even though phase 6B will not expose a note-off policy picker, the DSP reader must still have a real note-off path so later policies have somewhere correct to live.

### 5. Keep looping in playback, not in the rendered buffer

The rendered shape buffer contract stays the same:

- `2048` body samples
- `3` cubic pad samples
- cubic interpolation in the reader

Looping should be implemented by the reader's playhead logic, not by changing the rendered buffer into a periodic waveform or by forcing the shape endpoints to match.

## The phase 6B active subset

This is the subset we should actually implement now.

### Active editor behavior

- keep the existing point add, move, and delete workflow
- keep the existing unipolar `0 .. 1` value range
- do not add loop markers yet
- add one rate control for `MSEG 1`

### Active playback behavior

- note-triggered playback
- retrigger on note-on
- seconds-based rate
- full-shape loop while the note is active
- `finish_loop` behavior on note-off
- hold final value after playback stops wrapping

### Active routing behavior

- keep the existing fixed route:
  - `MSEG 1 -> Wavetable Position`
- keep the existing depth scalar

## The phase 6B data model

Phase 6B still uses the same future-friendly model from phase 6A.

### Shape object

Unchanged from phase 6A.

### Playback object

The playback object stays:

```json
{
  "format": "cosimo.mseg.playback",
  "version": 1,
  "rate": { "kind": "seconds", "seconds": 1.0 },
  "loop": { "startX": 0.0, "endX": 1.0 },
  "noteOffPolicy": "finish_loop",
  "legatoRestarts": false,
  "holdFinalValue": true
}
```

What is active in 6B:

- `rate.kind = "seconds"`
- `loop = { startX: 0.0, endX: 1.0 }`
- `noteOffPolicy = "finish_loop"`
- `holdFinalValue = true`

What exists for future compatibility but is not exposed yet:

- tempo-based rate
- arbitrary loop windows
- alternate note-off policies

## The runtime model

### GUI side

The GUI owns:

- the editable shape
- playback state
- the user-facing seconds-rate control
- stored-state persistence

Phase 6B should update playback metadata when the rate control changes, but it should not rebuild the rendered shape buffer unless the shape itself changes.

### DSP side

The DSP still owns:

- the uploaded rendered buffer
- playback metadata
- one voice-local reader state

Phase 6B should extend the reader so it can:

- advance at the configured seconds rate
- wrap from `endX` back to `startX` while looping is active
- stop future wraps after note-off for the active `finish_loop` behavior
- hold the final value when playback is done

## Why this does not paint us into a corner

This slice stays narrow, but it preserves the important future directions:

- tempo sync can still be added by extending `rate`
- loop markers can still be added by editing the same `loop` field
- note-off policy controls can still be added without changing the saved format
- multiple MSEGs can still reuse the same playback contract

The main thing to avoid is turning the current looped behavior into a special-case animation mode that bypasses the playback object.

## Logical tasks

Phase 6B should be implemented in four tasks.

### Task 1: Write the phase 6B contract into tests first

Scope:

- add JavaScript tests for playback normalization and controller transport
- add Python reference tests for looped playback and note-off exit
- add Cmajor probe tests for loop parity against the reference
- add one UI-source test that the rate control exists in the patch view

Done means:

- the new behavior is specified before the implementation changes land
- the tests fail for the current one-shot reader

### Task 2: Add the playback controls to the GUI

Scope:

- add one seconds-rate control for `MSEG 1`
- surface the stored playback rate in the UI
- make the default current MSEG playback state loop the full shape
- update playback stored state and playback endpoint uploads when the user edits rate

Done means:

- the user can change the playback speed from the current panel
- the setting survives patch reload
- playback updates do not cause redundant buffer re-renders

### Task 3: Extend the DSP reader from one-shot to looped playback

Scope:

- add a note-off input path into `wt::MsegReader`
- implement loop-aware playhead advancement
- implement the active `finish_loop` behavior
- keep the existing rendered-buffer read path and cubic interpolation

Done means:

- the reader loops audibly while the note is active
- the reader exits correctly after note-off
- the reader still behaves deterministically for fast and slow seconds rates

### Task 4: Re-prove the path with reference tests

Scope:

- update the Python reference reader and probe wrappers
- compare looped Cmajor output against the Python reference
- check rate changes, loop wrapping, retrigger, and note-off exit

Done means:

- looped playback matches the reference closely enough to trust the path
- the current MSEG route stays correct after the behavior change from one-shot to looped playback

## Definition of done

Phase 6B is done when all of the following are true:

- the patch view has a visible seconds-rate control for `MSEG 1`
- default current MSEG playback loops instead of playing once
- the playback rate is stored and restored
- the DSP reader loops using the real playback object
- note-off stops future wraps for the active `finish_loop` behavior
- JavaScript, Python, and Cmajor tests verify the new playback behavior

At that point the repo still has one routed MSEG, but it has crossed the line from a one-shot proof into a real playback-controlled modulation path.
