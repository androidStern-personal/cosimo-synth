# ADR-023: Route amounts use one canonical fine-grained projection

Status: accepted — 2026-08-16

## Context

`modulation.v6` is the canonical saved document, but projecting that entire document through the root React view model on every amount gesture caused mobile frame starvation. The broad projection is therefore coalesced until 50 ms after the latest pure amount edit. Local optimistic copies made individual controls look responsive, but created a second temporary truth that every control had to reconcile correctly.

## Decision

- `ModulationRuntimeBridge` is the sole in-memory authority for each route amount, addressed by stable route ID.
- Every live amount display reads and writes through `useModulationRouteAmountBinding`. Rack controls, desktop/mobile matrices, and the native iPhone matrix all use that same interface.
- `ModulationRouteUpdate` is structural and excludes `amount`, so ordinary route callbacks cannot accidentally reintroduce a stale amount path. Target changes remain structural; route normalization constrains the existing canonical amount for the new target.
- `useModulationState` remains the broad document/topology projection. Its route amounts may trail the canonical bridge by 50 ms and must not drive a live amount control.
- A canonical amount edit still persists the complete strict `modulation.v6` document. The runtime worker compares it with the last accepted document and emits the existing tiny deterministic-cell `modulationAmount` event when topology is unchanged.

## Consequences

- There is no control-owned route-amount state, reconciliation timer, or second state system.
- External authoritative document replacement immediately updates the route-specific binding; unrelated route and topology changes do not rerender every amount control through that binding.
- Any new live amount UI must use the route-specific binding. Broad document consumers are suitable for route lists, topology, presets, and structural operations, not gesture presentation.
- Full-document persistence remains linear in the stored modulation document for every accepted amount change. That is known performance debt, separate from the canonical presentation decision, and should be changed only with an explicit durability/coalescing contract.

## Rejected alternatives

- Removing the 50 ms broad projection delay was rejected because it restores root-level work during every drag.
- Keeping optimistic state in each control was rejected because it duplicates authority and spreads reconciliation behavior across callers.
- Adding another store or state library was rejected because the existing bridge already owns the canonical document and runtime/persistence seam.
