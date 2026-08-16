# ADR-013: Effects Workspace And Strip Quick Controls

Status: accepted.

## Decision

The effects workspace contains:

- one large focused editor for the selected effect, with its primary visualization
  taking center stage;
- one persistent compact ordered chain strip;
- one compact item per named module, including disabled modules;
- enable state and a reorder handle on each item;
- one quick parameter control on each item.

Tapping a module item focuses its full editor. The chain strip may scroll on narrow
screens rather than compressing every module below a usable touch size.

## Quick Parameter Behavior

Each module tracks a `quickParameterID` referring to one of its parameters.

- Before any edit, each effect supplies a curated default quick parameter.
- A deliberate user edit in the full effect editor makes that parameter the
  module's quick parameter.
- Editing the quick control keeps that same parameter selected.
- Host automation, incoming MIDI control, modulation, preset restore, and DSP
  telemetry do not change `quickParameterID`.
- The strip edits and displays the parameter's base value; modulation visualization
  may be overlaid without replacing the base control.
- If a software update removes a remembered parameter, the effect falls back to its
  curated default.

`quickParameterID` is transient presentation state. Loading a patch resets each
effect to its curated default quick parameter. It is not serialized into patch or
preset state and does not mark a patch dirty.

## Consequences

- The user can keep shaping several effects without repeatedly opening every full
  editor.
- The strip remains effect-centric even when modules move.
- Every effect descriptor must nominate a valid default quick parameter.
