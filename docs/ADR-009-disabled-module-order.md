# ADR-009: Disabled Modules Retain Rack Position

Status: accepted.

## Context

The rack has a fixed inventory of eight named modules. If disabled modules were
removed from rack order, enabling one would require a separate palette and an
insertion-position rule.

## Decision

Rack order is always a complete permutation of all eight effect-instance IDs.

- Disabling a module does not remove it from rack order.
- A disabled module remains visible in its saved position using a compact or dimmed
  presentation.
- The DSP skips or audibly bypasses it according to ADR-005.
- Re-enabling it restores processing at the same position.
- Enabled and disabled modules can both be reordered.

## Domain Invariants

- Every named v1 effect instance occurs exactly once in rack order.
- Enabled state is stored separately from order.
- No enable operation needs an insertion position.

## Consequences

- Preset restoration and undo operate on one unambiguous complete order.
- The mobile UI must keep disabled modules discoverable without giving them the same
  visual weight as enabled modules.

