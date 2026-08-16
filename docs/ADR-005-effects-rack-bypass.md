# ADR-005: Effects Rack Bypass

Status: accepted with a complexity constraint.

## Context

Disabled rack modules must pass dry input without clicks. Avoiding all DSP work
while disabled could save mobile CPU, but a generic stop-and-reset mechanism is not
free: Chorus owns large delay buffers, while Distortion contains filters and
composed oversampled processors whose complete internal state is not exposed to a
rack-level reset operation.

## Decision

Disabling a module creates a hard audible bypass:

- the rack uses its short transition protection when enabled state changes;
- the disabled module contributes no wet output;
- v1 does not promise effect-tail spillover while a module is disabled;
- re-enabling must not expose an unsmoothed stale-state transient.

Whether a disabled child continues advancing is an effect-local implementation and
performance decision, not part of the public rack-state model.

An effect may stop processing and reset while disabled only when it can do so with
a small local implementation. Otherwise it may continue advancing silently in a
safe disabled mode. Profiling, rather than rack architecture, determines whether a
sleep optimization is necessary.

## Complexity Constraint

V1 will not add:

- rack-wide DSP-state serialization or copying;
- generic traversal and clearing of effect internals;
- tail detection;
- background tail-spill routing;
- duplicate processors for bypass transitions.

## Consequences

- Audible bypass behavior is consistent even if CPU behavior differs by effect.
- Some disabled effects may still consume CPU until a simple local sleep path is
  implemented.
- Mobile performance tests must measure both fully enabled and typically bypassed
  rack configurations.

