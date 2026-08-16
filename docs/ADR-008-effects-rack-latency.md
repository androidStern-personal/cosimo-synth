# ADR-008: Effects Rack Latency

Status: accepted.

## Context

Cosimo is a live-played MPE instrument. Cmajor processor latency is fixed at compile
time and cannot safely change when a rack module is enabled, disabled, or moved.

The existing standalone OTT processor uses 3 milliseconds of lookahead. Integrating
that implementation unchanged would require every synth patch to retain the same
fixed delay even while OTT is disabled.

Serum's documented ordinary multiband upward/downward compressor does not advertise
latency; latency is called out separately for its limiter mode. This provides a
useful low-latency instrument precedent.

## Decision

The v1 creative effects rack adds no declared processing latency.

- The rack adaptation of OTT does not use the standalone processor's lookahead
  path.
- The standalone OTT effect may retain its existing lookahead behavior.
- Rack Delay and Reverb may create audible delayed signals but must maintain a
  zero-latency dry path; this is not host-reported processing latency.
- A future true-peak or lookahead limiter is outside the creative rack and requires
  a separate latency decision.

## Consequences

- Enabling, disabling, and reordering creative modules cannot change host latency.
- MPE and onscreen-keyboard response do not inherit a permanent OTT lookahead
  penalty.
- The rack OTT may sound somewhat different from the standalone OTT and must have
  its own listening and regression tests.

