# ADR-011: Progressive Modulator Disclosure

Status: accepted.

## Context

Cmajor benefits from fixed compile-time capacities, but displaying every reserved
macro, envelope, and shape-generator slot burdens a new patch with controls the
sound designer has not chosen to use.

## Decision

DSP capacity and visible patch content are separate concepts.

- Cmajor may reserve a fixed number of slots for each modulator family.
- A new patch initially presents one usable instance of each relevant family plus
  an Add tile.
- Add reveals and initializes another reserved stable slot.
- The Add tile disappears when family capacity is reached.
- Unused reserved slots do not appear as disabled knobs, editors, or source chips.
- Modulation mappings may refer only to visible/active modulator instances.
- Patch state stores which reserved instances are active as well as their content.

The rule applies to Macros, note-triggered Envelopes, and MSEGs.

V1 capacities and initial visibility are:

- four Macro slots, initially Macro 1 plus Add Macro;
- three Envelope slots, initially Envelope 1 plus Add Envelope;
- three MSEG slots, initially MSEG 1 plus Add MSEG.

Cosimo does not add a separate LFO family. Looping and arbitrary repeating shapes
are handled by the existing MSEG concept.

## Consequences

- The mobile interface starts sparse without requiring dynamic DSP allocation.
- Stable IDs remain available for presets, modulation mappings, and host endpoints.
- Removing or hiding an active modulator must clear or explicitly resolve its
  mappings; silently orphaned mappings are not legal state.
