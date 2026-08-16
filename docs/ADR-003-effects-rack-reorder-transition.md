# ADR-003: Effects Rack Reorder Transition

Status: accepted with a complexity constraint.

## Context

Changing rack order while audio is active changes the input of every moved effect
at one audio-frame boundary. A hard change may click. Stateful effects such as
delay and reverb may already contain audible tails when the order changes.

Rendering the old and new orders simultaneously would require duplicate effect
instances with synchronized state, substantially increasing CPU, memory, and
implementation complexity.

## Decision

An interactive reorder preserves each effect instance and its internal state. The
rack performs one short transition:

1. Fade the rack output to silence over approximately 2 to 5 milliseconds.
2. Atomically replace the complete rack order at the silent point.
3. Fade the rack output back in over approximately 2 to 5 milliseconds.

Existing delay, reverb, chorus, and other effect state is neither cleared nor
copied. After the swap, every instance continues advancing in its new position.
Consequently, an existing tail may begin passing through effects that are now
downstream; that is the expected audible meaning of changing order.

Rack order is not intended for audio-rate modulation or dense host automation.

## Complexity Constraint

The transition must remain one rack-local fixed-size state machine. It must not
introduce:

- a duplicate A/B rack;
- duplicate effect buffers;
- general DSP-state serialization or copying;
- effect-specific reorder transitions;
- dynamic allocation;
- runtime graph rewiring.

If click protection cannot remain within this boundary, v1 will use an atomic hard
order change rather than expand the architecture.

## Consequences

- Interactive reordering may produce a very short level dip.
- Stateful tails survive and acquire the processing implied by the new order.
- Normal steady-state rack CPU and memory remain unchanged.
- Audible validation is required to choose the shortest reliable fade duration.

