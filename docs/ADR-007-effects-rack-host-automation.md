# ADR-007: Effects Rack Host Automation And Undo

Status: accepted.

## Context

Rack order and module-enabled state alter which processors participate in the
creative signal path. Exposing either as host automation would require repeated
structural transitions during playback and would complicate any effect-local CPU
sleep or reset optimization.

Users still need ordinary musical automation of effect intensity and parameters.

## Decision

- Effect base parameters are exposed to host automation with stable effect-instance
  and parameter identities.
- Each effect's Mix/Wet parameter is automatable and is the supported way to create
  rhythmic or continuous bypass-like automation.
- Rack order is patch/preset state and is not a host automation parameter.
- Module-enabled state is patch/preset state and is not a host automation parameter
  in v1.
- One committed drag reorder is one undoable UI command.
- One enabled-state change is one undoable UI command.

## Consequences

- Hosts cannot produce rapid order changes or repeatedly wake and sleep processors.
- Disabled effects remain eligible for simple effect-local CPU optimizations.
- Automation lanes remain stable when modules move because they target effect
  identity rather than rack position.
- Every creative rack effect must provide an automatable Mix/Wet control with a
  useful dry state.

