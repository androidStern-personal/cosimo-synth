# ADR-014: Sparse Articulation Storage With Latch-Time Route Inheritance

Status: Accepted 2026-07-18; three-oscillator hard-cut amendment 2026-08-13;
RT-01 runtime endpoint amendment 2026-08-14
Satisfies: ledger §11.2 ("Before porting, an ADR must reconcile [the full-snapshot
implementation] with the accepted sparse-inheritance product model and remove global rack state
from articulation ownership"). Companion: `COSIMO_IOS_MERGE_ROADMAP.md` (Phase 0), ledger §11.1.

## Decision

Articulations are **stored sparse**. Scalar voice settings are uploaded as resolved images;
mapping amounts preserve sparse inheritance through the runtime upload.

- **Storage** (`cosimo.articulations` version 4, stored-state key `articulations.v4`): each
  articulation slot holds only the values it overrides — a flat map of voice-parameter overrides
  plus a map of per-route amount overrides. Absent keys inherit the patch base (§11.1 sparse
  absolute inheritance).
- **Runtime source contract**: `ArticulationSnapshotRuntimeUpload` defines the fixed per-selector
  image consumed by the matching `articulationSnapshotIn` endpoint in `latchVoiceArticulation` at
  note start. RT-01 makes that Cmajor endpoint capable of the exact v4 image. Production worker
  composition remains deliberately deferred to HOST-02; RT-01 does not claim live product
  publication.
  Scalar cells contain resolved A/B/C values. Each of the 650 deterministic voice-mapping cells
  (13 sources × 50 voice targets) contains either an explicit override or the out-of-range
  `ARTICULATION_ROUTE_AMOUNT_INHERIT` sentinel.
  The engine resolves that sentinel from the current base mapping amount at note latch. ADR-020
  replaces the old list-position route array with these deterministic cells.

## The overridable surface is exactly the runtime upload's voice fields

`ArticulationSnapshotRuntimeUpload` (`ui/shared/articulations.ts`) is the ground truth for
what an articulation can own: 21 oscillator-local fields for each of A, B, and C, plus shared
voice filter mode/cutoff/Q, the three MSEG morphs, the deterministic voice-mapping amount cells,
and the three envelopes' ADSR fields. Everything else is patch-owned. Oscillator-local storage
keys are qualified (`oscA.framePosition`, `oscB.framePosition`, and so on), so one oscillator's
override cannot alias another's.
Global rack mappings are deliberately absent because one global effect amount cannot vary by note.

The v2 *storage* snapshot additionally recorded `playMode`, `glideTime`, `distortion*`, and
`chorus*` (`articulations.ts:41-77`) — fields the upload builder already ignores. That dead
weight is precisely the "global rack state in articulation ownership" §11.2 orders removed; v4
has no representation for it, making the illegal state unrepresentable rather than merely unused.

All scalar overridables live in ONE flat keyed map (envelope ADSR and MSEG morph fields are keys
like `env1.attackSeconds`, `msegMorph2` alongside `oscA.pan` and `filterCutoffHz`), because the product
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

## Hard cut from v3 (no migration code)

Per the roadmap's hard-cut policy: `parseArticulationsV4` accepts only
`format: "cosimo.articulations", version: 4`. Lower and future versions return a typed
`unsupported-version` failure; malformed current documents return `malformed`. Hydration and live
writes call this one parser and never repair, project, or rewrite a rejected document. No migration
function, old-key read, or alias is committed. Existing dev patches are re-authored once; the day
v4 lands, v3 is dead.

## Trigger assignment moves into the slot

v2 kept key/velocity/chain assignments in parallel arrays with their own synthetic ids. The
product model (mobile prototype, locked in its `INTERACTION_MATRIX.md`) is per-articulation:
one keyswitch note, one velocity range, one chain range, plus a bank-level active trigger mode.
v4 stores these on the slot (`key`, `velRange`, `chainRange`), with the bank-level
`activeTriggerMode` and `selectedSlotId` retained. Non-overlap of ranges and flush keyswitch
walking are UI policies (`clampArticulationRange`, `walkArticulationKey`), not storage
invariants — storage only guarantees well-formed bounds.
Every slot always has a valid assignment in all three modes; there is no unassigned sentinel.
Until UI-01 replaces the older presentation, its former Clear actions collapse a range to one
valid point and are labeled Collapse/Collapse All.

## Identity

Slots store `name` and `color` (the semantic identity the ledger reserves for articulation
marking). Icons remain a UI derivation, not storage.

## Consequences

- The prototype's existing sparse model (`articulationOverrides`, `articulationMappingAmounts`)
  maps 1:1 onto v4 — the merge carries the product model into storage unchanged.
- The source contract keeps a fixed-shape latch path. ADR-020 expands the mapping amount image, changes its
  index from list position to deterministic voice-mapping cell, and RT-01 resolves inherited cells
  at note latch. HOST-02 separately owns production publication of those images.
- A 60 Hz base mapping drag emits no articulation image traffic, even with all 128 selectors stored.
- Preset application passes the normalized parameter record and stored-state documents through one
  transaction context. The articulation adapter derives and replaces its stable patch base from
  that transaction before projecting the v4 bank, so a prior patch base cannot leak across presets.
- Per-articulation envelope/morph overrides (a deferred prototype feature) need no schema work
  later: the keys already exist in the override map.
- The three engineering obligations recorded in the prototype `AGENTS.md` are discharged by:
  (1) the resolve invariant property test (sparse over base == intended complete image),
  (2) `affectedSelectors` + its equivalence property test,
  (3) the selector-allocation rules above with their own tests.
