# ADR-014: Sparse Articulation Storage With Latch-Time Route Inheritance

Status: Accepted 2026-07-18; deterministic modulation-cell amendment 2026-08-08
Satisfies: ledger §11.2 ("Before porting, an ADR must reconcile [the full-snapshot
implementation] with the accepted sparse-inheritance product model and remove global rack state
from articulation ownership"). Companion: `COSIMO_IOS_MERGE_ROADMAP.md` (Phase 0), ledger §11.1.

## Decision

Articulations are **stored sparse**. Scalar voice settings are uploaded as resolved images;
mapping amounts preserve sparse inheritance through the runtime upload.

- **Storage** (`articulations.v3`, stored-state key `articulations.v3`): each articulation slot
  holds only the values it overrides — a flat map of voice-parameter overrides plus a map of
  per-route amount overrides. Absent keys inherit the patch base (§11.1 sparse absolute
  inheritance).
- **Runtime**: `articulationSnapshotIn` receives a fixed per-selector image
  (`ArticulationSnapshotRuntimeUpload`) and `latchVoiceArticulation` copies all fields at note start.
  Scalar cells contain resolved values. Each of the 156 deterministic voice-mapping cells contains
  either an explicit override or the out-of-range `ARTICULATION_ROUTE_AMOUNT_INHERIT` sentinel.
  At note latch, the engine resolves that sentinel from the current base mapping amount. ADR-020
  replaces the old list-position route array with these deterministic cells.

## The overridable surface is exactly the runtime upload's voice fields

`ArticulationSnapshotRuntimeUpload` (`ui/shared/articulations.ts:133`) is the ground truth for
what an articulation can own: wavetable position, pan, warp mode/amount, voice filter
mode/cutoff/Q, the eleven unison fields, the three MSEG morphs, the deterministic voice-mapping
amount cells, and the three envelopes' ADSR fields. Everything else is patch-owned.
Global rack mappings are deliberately absent because one global effect amount cannot vary by note.

The v2 *storage* snapshot additionally recorded `playMode`, `glideTime`, `distortion*`, and
`chorus*` (`articulations.ts:41-77`) — fields the upload builder already ignores. That dead
weight is precisely the "global rack state in articulation ownership" §11.2 orders removed; v3
has no representation for it, making the illegal state unrepresentable rather than merely unused.

All scalar overridables live in ONE flat keyed map (envelope ADSR and MSEG morph fields are keys
like `env1.attackSeconds`, `msegMorph2` alongside `pan` and `filterCutoffHz`), because the product
model — the diff inventory, per-parameter reset, override counting — treats them uniformly. Route
amounts keep a separate map keyed by mapping id. The resolver uses ADR-020's stable source/target
cell and never depends on stored list order. Values are stored in **engine units** (v2 precedent);
normalized conversion is the descriptor layer's job at the port boundary, so the resolver stays
free of any descriptor dependency.

## Base-change semantics (re-upload targeting)

An edit to a patch-base scalar voice parameter changes the resolved image of every slot that does
NOT override that key; slots that override it are unaffected. `affectedSelectors(change, state)`
computes exactly that set, and the adapter re-uploads only those selector images. An edit to a base
mapping amount uploads only the tiny ADR-020 amount event: inherited articulation cells resolve the
new value when the next note latches, so no selector image changes. An edit to a slot's own override
affects that slot alone. Global (non-voice) edits never touch articulation images. These rules are
pure and property-tested against a full rebuild.

## Selector allocation

`runtimeSlot` (selectorA) allocation gives each slot a stable integer 0..127
(`ARTICULATION_MAX_SLOTS = 128`), assigned at creation from the lowest free selector, never
reused while occupied, freed on delete. Slot identity (`id`) remains a string independent of the
selector so reordering or renaming never moves engine data.

## Hard cut from v2 (no migration code)

Per the roadmap's hard-cut policy: `parseArticulationsV3` accepts only
`format: "cosimo.articulations", version: 3`. Every other shape, including v2, returns the same
typed `malformed` parse failure. Hydration and live writes call this one parser and never repair,
project, or rewrite a rejected document. No migration function is committed. Existing dev patches
are re-authored once; the day v3 lands, v2 is dead.

## Trigger assignment moves into the slot

v2 kept key/velocity/chain assignments in parallel arrays with their own synthetic ids. The
product model (mobile prototype, locked in its `INTERACTION_MATRIX.md`) is per-articulation:
one keyswitch note, one velocity range, one chain range, plus a bank-level active trigger mode.
v3 stores these on the slot (`key`, `velRange`, `chainRange`), with the bank-level
`activeTriggerMode` and `selectedSlotId` retained. Non-overlap of ranges and flush keyswitch
walking are UI policies (`clampArticulationRange`, `walkArticulationKey`), not storage
invariants — storage only guarantees well-formed bounds.

## Identity

Slots store `name` and `color` (the semantic identity the ledger reserves for articulation
marking). Icons remain a UI derivation, not storage.

## Consequences

- The prototype's existing sparse model (`articulationOverrides`, `articulationMappingAmounts`)
  maps 1:1 onto v3 — the merge carries the product model into storage unchanged.
- The engine keeps its fixed-shape latch path. ADR-020 expands the mapping amount image, changes its
  index from list position to deterministic voice-mapping cell, and resolves inherited cells there.
- A 60 Hz base mapping drag emits no articulation image traffic, even with all 128 selectors stored.
- Per-articulation envelope/morph overrides (a deferred prototype feature) need no schema work
  later: the keys already exist in the override map.
- The three engineering obligations recorded in the prototype `AGENTS.md` are discharged by:
  (1) the resolve invariant property test (sparse over base == intended complete image),
  (2) `affectedSelectors` + its equivalence property test,
  (3) the selector-allocation rules above with their own tests.
