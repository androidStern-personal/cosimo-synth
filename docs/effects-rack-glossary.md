# Effects Rack Glossary

Status: evolving during the effects-rack design interview.

## Articulation

A selectable Cosimo sound state that can affect note-time voice behavior. Whether
an articulation may also select global rack state remains an open decision.

## Effect Instance

One independently stateful DSP processor in the global rack. Its stable identity
does not change when it moves. Two delays would be two effect instances even if
they share the same effect type.

## Effect Instance ID

A stable, persisted identity for one effect instance. Parameters, mappings,
visualization state, and rack order refer to this identity.

## Effect Parameter ID

A stable identity for one controllable property owned by an effect instance, such
as distortion drive or chorus mix.

## Effect Type

The DSP family implemented by an effect instance, such as distortion, chorus,
delay, or reverb. Type is not position and is not necessarily unique within a rack.

## Hard Audible Bypass

A disabled module contributes no wet output and passes the rack signal dry. It does
not imply a particular CPU-sleep or internal-reset implementation.

## Module Enabled State

Patch-owned structural state determining whether an effect participates in the
rack. It is undoable but not host-automatable in v1. Musical bypass-like automation
uses the effect's Mix/Wet parameter instead.

## Global Modulation Source

A source with one value for the entire synth at a given audio frame. It can target
a global effect without resolving competing per-note values.

## Named-Module Inventory

The bounded v1 collection of effect modules compiled into Cosimo. Each named
module owns one stable effect instance and can be enabled, bypassed, or reordered.
The inventory does not contain generic user-populated slots or arbitrary duplicate
instances.

The accepted v1 modules are Global Filter, Distortion, OTT, Chorus/Bloom, Flanger,
Phaser, Delay, and Reverb.

## Mapping

The persistent relationship from a modulation source to an effect parameter,
including amount, polarity, and any future transform settings. A mapping refers to
effect instance ID plus effect parameter ID, never rack position.

## Macro

A renameable patch-global 0-to-1 control and global modulation source. Its stable
identity, value, display name, and parameter mappings are stored with the patch.

## MSEG

Cosimo's editable one-shot or looping multi-segment modulation source. MSEGs cover
the repeating-shape use case; v1 has no separate LFO modulator family.

## Active Modulator Slot

A fixed-capacity modulator instance that the user has chosen to expose and use in
the current patch. Reserved inactive slots exist for DSP capacity but are absent
from the interface and cannot own live mappings.

## Per-Note Modulation Source

A source whose value belongs to one allocated note or voice, including MPE
pressure, MPE slide, velocity, and a note-triggered envelope or MSEG.

## Rack Order

The complete ordered sequence of effect-instance IDs through which the summed
stereo signal is conceptually arranged. It contains every named module exactly
once, including disabled modules; enabled state separately determines processing.

## Rack Position

One location in rack order. Position has no durable parameter or modulation
identity; moving an effect changes its position but not the effect instance.

## Rack State

Patch-owned state containing rack order, module-enabled states, and effect base
parameter values. Rack state is not owned by per-note articulations.

## Quick Parameter

The one effect parameter surfaced directly on a compact chain item. It defaults to
an effect-curated parameter and follows the most recent deliberate UI edit within
that effect, never automation or modulation activity.

## Reorder

An atomic transition from one valid rack order to another valid rack order.

## Reorder Transition

The short rack-level fade-out, atomic order swap, and fade-in used to avoid a click
while preserving every effect instance's existing internal state.

## Modulation Domain

The cardinality of a modulation signal. A voice-domain source has one independent
value per allocated note; a global-domain source has one value for the whole synth.

## Routable Effect Parameter

A continuous effect parameter that can receive modulation. Rack order, enabled
state, and discrete mode selectors are not routable in v1.

## Voice-to-Global Reducer

An explicitly configured rule that derives one global modulation value from a set
of per-note values. It belongs to a voice-to-global mapping alongside amount and
polarity, allowing different destinations to reduce the same source differently.
Examples include maximum held-note pressure and focused-note slide. The reducer
policy is never implicit in a mapping.

## Voice Sum

The stereo signal produced after all active per-note voices have been mixed. The
global effects rack processes this signal.
