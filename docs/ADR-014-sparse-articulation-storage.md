# ADR-014: Sparse Articulation Storage With Complete-Image Runtime

Status: Accepted 2026-07-18
Satisfies: ledger §11.2 ("Before porting, an ADR must reconcile [the full-snapshot
implementation] with the accepted sparse-inheritance product model and remove global rack state
from articulation ownership"). Companion: `COSIMO_IOS_MERGE_ROADMAP.md` (Phase 0), ledger §11.1.

## Decision

Articulations are **stored sparse and uploaded complete**.

- **Storage** (`articulations.v3`, stored-state key `articulations.v3`): each articulation slot
  holds only the values it overrides — a flat map of voice-parameter overrides plus a map of
  per-route amount overrides. Absent keys inherit the patch base (§11.1 sparse absolute
  inheritance).
- **Runtime**: the engine's contract is unchanged — `articulationSnapshotIn` receives complete
  per-selector images (`ArticulationSnapshotRuntimeUpload`) and `latchVoiceArticulation` copies
  all fields at note start. A pure resolver (`resolveArticulationImages`) compiles sparse storage
  over the patch base into those complete images. The engine never learns about sparseness.

## The overridable surface is exactly the runtime upload's voice fields

`ArticulationSnapshotRuntimeUpload` (`ui/shared/articulations.ts:133`) is the ground truth for
what an articulation can own: wavetable position, pan, warp mode/amount, voice filter
mode/cutoff/Q, the eleven unison fields, the three MSEG morphs, the twelve route amounts, and the
three envelopes' ADSR fields. Everything else is patch-owned.

The v2 *storage* snapshot additionally recorded `playMode`, `glideTime`, `distortion*`, and
`chorus*` (`articulations.ts:41-77`) — fields the upload builder already ignores. That dead
weight is precisely the "global rack state in articulation ownership" §11.2 orders removed; v3
has no representation for it, making the illegal state unrepresentable rather than merely unused.

All scalar overridables live in ONE flat keyed map (envelope ADSR and MSEG morph fields are keys
like `env1.attackSeconds`, `msegMorph2` alongside `pan` and `filterCutoffHz`), because the product
model — the diff inventory, per-parameter reset, override counting — treats them uniformly. Route
amounts keep a separate map keyed by route id, matching both v2's `modRouteAmounts` and the
engine's per-route array. Values are stored in **engine units** (v2 precedent); normalized
conversion is the descriptor layer's job at the port boundary, so the resolver stays free of any
descriptor dependency.

## Base-change semantics (re-upload targeting)

An edit to a patch-base voice parameter changes the resolved image of every slot that does NOT
override that key; slots that override it are unaffected. `affectedSelectors(change, state)`
computes exactly that set, and the adapter re-uploads only those selector images. An edit to a
slot's own override affects that slot alone. Global (non-voice) edits never touch articulation
images. This is a pure function so it is property-testable: uploading ONLY the affected selectors
must yield the same engine state as re-uploading everything.

## Selector allocation

`runtimeSlot` (selectorA) allocation keeps v2's rules: slots own a stable integer 0..127
(`ARTICULATION_MAX_SLOTS = 128`), assigned at creation from the lowest free selector, never
reused while occupied, freed on delete. Slot identity (`id`) remains a string independent of the
selector so reordering or renaming never moves engine data.

## Hard cut from v2 (no migration code)

Per the roadmap's hard-cut policy: `parseArticulationsV3` accepts only
`format: "cosimo.articulations", version: 3`. A v2 payload is detected and rejected with the
typed error reason `legacy-v2-rejected` (a precise message beats a generic parse failure); any
other shape is `malformed`. No migration function is committed. Existing dev patches are
re-authored once; the day v3 lands, v2 is dead.

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
- The engine keeps its fixed-shape latch path — no Cmajor changes.
- Per-articulation envelope/morph overrides (a deferred prototype feature) need no schema work
  later: the keys already exist in the override map.
- The three engineering obligations recorded in the prototype `AGENTS.md` are discharged by:
  (1) the resolve invariant property test (sparse over base == intended complete image),
  (2) `affectedSelectors` + its equivalence property test,
  (3) the selector-allocation rules above with their own tests.
