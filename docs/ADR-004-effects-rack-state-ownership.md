# ADR-004: Effects Rack State Ownership

Status: accepted.

## Context

The effects rack processes the stereo voice sum and therefore has one order and one
base parameter state for the whole synth. Multiple notes using different
articulations may sound simultaneously. Allowing each articulation to own global
rack state would require an implicit conflict rule such as latest articulation wins.

## Decision

The patch owns:

- rack order;
- each named module's enabled state;
- each effect parameter's base value.

These values are stored and restored with patch/preset state. They are not captured
inside per-note articulation snapshots and do not change when an articulation is
latched for a note.

Articulations and MPE may influence global effect parameters only through explicit
modulation mappings and, where required, voice-to-global reducers. Modulation does
not transfer ownership of the base parameter value to the articulation.

## Consequences

- Simultaneous articulations cannot fight over global rack structure.
- Selecting or triggering an articulation cannot reorder or enable effects for
  already sounding notes.
- Preset save/restore must include complete rack state independently of the
  articulation bank.

