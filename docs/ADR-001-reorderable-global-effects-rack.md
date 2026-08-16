# ADR-001: Reorderable Global Effects Rack

Status: accepted in part; remaining decisions are still under interview.

## Context

Cosimo currently processes the summed voice signal through fixed global distortion
and chorus processors. The intended architecture replaces that fixed post-voice
path with a global effects rack whose processing order can be changed without
changing an effect's parameters, saved state, automation identity, visual identity,
or modulation mappings.

Cmajor graph connections cannot be rewired dynamically. Cmajor processor
composition can, however, keep a bounded set of child processors resident and
advance them in a runtime-selected serial order.

## Decision

Cosimo will treat effect identity and rack position as separate domain concepts.
Reordering changes only the ordered sequence of effect-instance identities.

The effects rack is global and receives the stereo signal after voice summing.
The rack will use a fixed Cmajor processor shape rather than runtime graph rewiring.

For v1, the rack contains a bounded inventory of named effect modules. Each named
module has one independently stateful effect instance, can be enabled or bypassed,
and can move within rack order. V1 does not provide generic user-populated slots or
arbitrary duplicate instances of one effect type.

This decision does not yet determine:

- the exact modulation-source inventory exposed in v1;
The v1 inventory contains eight creative modules, as specified by ADR-006.

## Domain Invariants

- An effect instance has one stable identity independent of its current position.
- Every active rack position refers to exactly one valid effect instance.
- A valid order contains no missing or duplicate instance identity unless a future
  rack model explicitly supports multiple separately identified instances.
- Parameters and modulation mappings target effect identity plus parameter identity,
  never a numeric rack position.
- A reorder is applied atomically; partially updated orders are not legal runtime
  states.
- The DSP processor inventory and declared latency remain bounded at compile time.

## Consequences

- Presets can restore an order without remapping effect parameters.
- Host automation can retain stable effect-centric endpoint identities.
- Reordering is feasible without rebuilding the Cmajor patch.
- Arbitrary plugin-style processor creation and duplicate effect instances are out
  of scope for v1. Supporting either later requires a separately bounded
  preallocation and identity model.

## Open Decision Queue

The accepted v1 source inventory is four Macros, MSEG 1-3, Envelope 1-3, Velocity,
MPE Pressure, and MPE Slide. There is no separate LFO family.
