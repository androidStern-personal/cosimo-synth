# Cosimo iOS Merge Roadmap — prototype → official iOS synth

Status: ACCEPTED 2026-07-18 (trigger pulled). Companion to `COSIMO_IOS_UI_DECISION_LEDGER.md`.
`TRANSIENT_IOS_REACT_MIGRATION_PLAN.md` is complete and covered only the legacy→React port of the
old patch view — it is not this plan.

## The reframe: parity is the wrong trigger

The official iOS UI (`ui/ios/IOSPatchView.tsx`) is one screen — wavetable stage, play, distortion,
MSEG launcher/modal, a flat mod-route list, keyboard dock — talking to the live engine. The
prototype is the far richer product, talking to nothing real (`mockCosimoReducer`). Most "missing
parity" features are engine *visualizations* (live wavetable frames, distortion scope, unison
detail) that cannot be meaningfully built against a mock; building mock versions first means
building them twice.

Therefore the merge trigger is not surface parity. It is: **the prototype shell drives the real
engine through a real adapter on one vertical slice** (Phase 3). After that, the prototype *is* the
iOS UI codebase and parity becomes ordinary feature work inside it.

## Two questions settled 2026-07-18

**Macros: build the engine support — it is trivial (revised same day).** Inspection of
`resolveRouteSourceValue` (`cmajor/FixedFrameOscillator.cmajor:2199`) shows sources are a flat
integer-kind dispatch returning clamped 0..1 floats; a macro is the degenerate case — a global
smoothed scalar, no per-voice state, no buffers. Work: `modulationSourceMacro = 6` + a
`float32[4]` + one dispatch branch; four annotated `input value` endpoints (which surface as AU
parameters, giving §16's host-automation requirement for free); a `macro` source kind in
`modulation.ts`; renameable names in stored state. Per-articulation behavior comes free via the
existing route-amount override machinery. Scheduled as the smallest Phase-2 item, landing before
cutover — so the locked 7×2 rail geometry stands, and both adapters carry macros identically (no
straddle, consistent with the hard-cut policy).

**Route budget: 12 is an engine compile-time constant, kept for the merge.**
`cmajor/FixedFrameOscillator.cmajor:31` (`let modulationRouteCount = 12`) sizes fixed per-voice and
per-articulation-slot arrays (`articulationRouteAmounts` = 128 × 12 floats;
`voiceArticulationRouteAmounts` = voices × 12) and the per-frame route evaluation loop. Not an
architectural wall — raising it is a one-line change + recompile — but it is a deliberate real-time
memory/CPU budget on mobile, so it is not unbounded either. Decision: keep 12, surface the budget
honestly in the UI (`RouteBudgetExceeded`, below); revisit the constant only with a measured need.

## Hard-cut policy (2026-07-18)

No migration-period scaffolding, anywhere:
- **Cutover is one commit.** The commit that mounts the merged shell deletes `IOSPatchView`. No
  feature flags, no A/B window, no retained old view.
- **No migration code in the repo.** The `articulations.v3` parser accepts v3 and rejects
  everything else as a typed parse error. Existing dev patches are re-authored once (by hand or a
  throwaway uncommitted script); v2 is dead the day v3 lands.
- **No straddle layers.** Nothing exists solely to let old and new coexist. The mock and the bridge
  implement the same port with the same surface; the codebase's state at any commit IS the
  capability set. A feature without engine backing is absent from both adapters, not display-only
  on one of them.
- What stays is permanent architecture, not migration debt: the port seam, the mock as the test
  fixture behind it, and the bridge. Those would exist with no migration at all.

## Critical path

```
ADR (§11.2) ──► descriptor layer + port contract ──► bridge adapter ──► vertical slice ◄── merge trigger
                                  │
   engine gaps (rack DSP, capture) — parallel, gate individual features, not the merge
```

---

# Phases with acceptance criteria

## Phase 0 — The §11.2 ADR (days; blocks everything)

Reconcile the accepted sparse-inheritance product model with the shipped full-snapshot
`articulations.v2`. De-risked 2026-07-16: **storage sparse, runtime complete** — a pure resolver
compiles sparse overrides into the complete per-selector images `articulationSnapshotIn` requires.

**Acceptance:**
- ADR merged in `docs/` covering: the `articulations.v3` stored-state schema (sparse absolute
  overrides + trigger assignment; global rack/effect state removed from articulation ownership per
  §11.1); base-change semantics (an edit to an un-overridden base parameter re-resolves and
  re-uploads every affected selector image); selector allocation rules; the hard cut from v2
  (parser rejects it; dev patches re-authored once, no migration code committed).
- The three engineering obligations recorded in the prototype's `AGENTS.md` (resolver correctness,
  re-upload triggering, selector allocation) each answered explicitly.
- `articulation-image.ts` skeleton exists (types + parser, contract below) with property tests:
  v3 parse/serialize roundtrip; resolve invariant (sparse form over base reproduces the intended
  complete image); v2 input yields a typed parse error, never a silent default.
- Ledger §11.2 annotated as resolved-by this ADR.

## Phase 1 — Contract hardening in the prototype (no engine required)

Make the mock adapter's contract the real contract, so the Phase-3 swap is a substitution.

**Acceptance:**
- `target-descriptor.ts` exists (contract below). Every prototype target has a descriptor whose
  `binding` is either a real endpoint binding or an explicit `unbacked` tag with a reason (compound
  Free/Sync, rack DSP, capture). Zero silent illustrative values remain: default, range, formatter
  all come from the descriptor. Property test: engine-unit ↔ normalized conversion roundtrips
  within epsilon for every bound target.
- Port contract (`CosimoAdapterPort`, below) extracted as the typed seam; the mock adapter
  implements it; `useMobileSynthController` consumes only the port. A **behavioral contract test
  suite parameterized over an adapter factory** exists and passes against the mock. (This suite is
  the Phase-3 gate — the bridge must pass it unchanged.)
- Route budget enforced at the seam: the 13th `addMapping` returns `RouteBudgetExceeded`; the rail's
  assign flow shows the refusal; a contract test asserts it.
- `SourceShapeEditor.jsx`'s fake MSEG/ADSR stubs replaced by the shared editor:
  `ui/shared/mseg.ts` model imported directly (no transliteration — divergence is the enemy),
  `EditableMsegSurface` + `useMsegEditorInteractions` with `curveEditActivationMode:"hold-or-drag"`,
  vertical orientation; a prototype-side controller implements `MsegEditorControllerLike` over port
  commands. Tests: point add/move/delete and morph through the controller; agent-browser real-touch
  drag verification at 390×844.
- Command-map audit table complete: every port command annotated with its real counterpart
  (endpoint / stored-state op) or `ENGINE GAP`.
- Macro sources modeled in the port and descriptor catalog against the §16 spec (the engine work is
  a small Phase-2 item); the locked 7×2 rail geometry stands unchanged.
- 41-test parity suite and style contract still green; interaction-matrix rows amended where
  behavior changed (rail geometry, route budget).

## Phase 2 — Engine gaps (parallel track; each gates a feature, none gates the merge)

| Gap | Ledger | Gates | Acceptance |
|---|---|---|---|
| Macros: engine source kind + 4 automatable endpoints + `modulation.ts` kind + stored names (smallest item; land before cutover) | §16 | macro rail chips | macro scrub audibly modulates a mapped target; AU host automation moves it; rename persists; route-amount overrides apply per articulation |
| DSP effects rack (8 fixed effects, ADR-001…009) | :585 | rack workspace | reorder preserves tails; disabled = clean bypass; order/enable as patch state; A/B null test on bypass |
| Motion capture buffer | :852 | Capture Motion | real motion samples + note timing retained; capture commits to a mapped MSEG |
| Compound Free/Sync endpoint | — | compound controls | endpoint exists; descriptor binding switches from `unbacked` |
| Articulation runtime per Phase-0 ADR | §11.2 | articulation workspace | resolver uploads verified against engine latch behavior |

## Phase 3 — Vertical-slice adapter swap ◄ THE MERGE TRIGGER

Build `CosimoBridgeAdapter` (contract below) and mount the prototype shell in the existing
WKWebView harness (`ios_auv3`, `runtime-host.js`) against the live engine.

Slice scope: wavetable voice module (position/select), filter, two mod routes (one envelope, one
MSEG source), the MSEG editor, MIDI note input through the audition transport.

**Acceptance:**
- The bridge adapter passes the Phase-1 contract test suite **unchanged** (same suite, different
  factory).
- The prototype shell, with zero changes above the composition root, makes real sound in the
  harness: scrubbing a bound cell audibly changes the engine; the MSEG editor shapes a live route.
- State roundtrip: edit → kill the host → relaunch → identical snapshot (stored-state
  `modulation.v2` + `articulations.v3` both survive).
- Connection honesty: detaching the engine moves `ConnectionState` to `detached` and the UI says
  so; no silent dead controls.
- Bridge integration tests run against a fake `PatchConnectionLike` (recording endpoint traffic —
  a real seam, not module mocks) asserting the exact event/stored-state protocol per command.
- After this lands: the prototype directory is promoted to the iOS UI source of truth; the mock
  becomes a named test fixture.

## Phase 4 — Feature ports inside the merged shell

Real wavetable display + bank picker + load/retry states; distortion editor + visualizer; unison;
chorus/bloom; warp modes; MSEG A/B + morph + rate surfaced in the source editor; per-articulation
env/morph overrides (engine already snapshots `msegMorphs` + envelope times per articulation);
octave/root keyboard config. Rack behaviors light up as Phase-2 work lands.

**Acceptance, per feature:** a descriptor entry (binding switched from `unbacked` where relevant);
an `INTERACTION_MATRIX.md` row; a parity test; real-endpoint verification in the harness; §19
geometry invariants hold at 390×844 and 375×667.

## Phase 5 — Cutover

**Acceptance:** one commit mounts the merged shell via `createIOSPatchView` AND deletes the old
`IOSPatchView` — no flag, no A/B window (hard-cut policy). Gate the commit itself on: §19 geometry
checks at both sizes; §20 rejection-list re-audit (all 20 items); parity tests ported to the
browser-harness pattern (`tests/test_ios_patch_view_browser.mjs`); real-touch interaction pass on
device.

## Phase 6 — Post-merge product completion (explicitly not merge-gated)

Preset/patch browser, patch save/name, settings, MIDI config, articulation rename. Ledger §21
list. Per-feature specs when scheduled.

---

# API contracts

New contract code is TypeScript and lives in `ui/shared/` (or `ui/mobile/` if the shared package
gets crowded); the prototype's Vite build imports it directly. Conventions throughout: expected
failures are tagged error values (small local `Result` union — the repo has no Effect/better-result
precedent); illegal states unrepresentable (tagged unions over boolean flags); branded identifiers;
parse at the boundary; JSDoc on every export. The mock and the bridge are two outbound Adapters
behind one application-owned port; the controller is the application service; React components are
the inbound adapter; the entry file is the composition root.

## Branded identifiers (`cosimo-ids.ts` — Domain)

```ts
export type TargetId = Brand<string, "TargetId">;           // "wavetable.warp"
export type SourceId = Brand<string, "SourceId">;           // "envelope-1", "velocity"
export type MappingId = Brand<string, "MappingId">;         // derived: `${TargetId}::${SourceId}`
export type ArticulationId = Brand<string, "ArticulationId">;
export type NormalizedValue = Brand<number, "NormalizedValue">; // 0..1, UI-canonical

export function parseTargetId(input: string): Result<TargetId, UnknownTarget>;
export function parseNormalizedValue(input: number): Result<NormalizedValue, ValueOutOfRange>;
// makeMappingId(target, source), etc. — smart constructors only; no raw-string construction.
```

The UI-canonical value space is normalized 0..1 (matches host automation and the ledger's macro
decision). Engine units exist only inside descriptors and the bridge.

## Target descriptor catalog (`target-descriptor.ts` — Domain, deep module)

One table owning everything the UI may know about a parameter. Replaces the prototype's
illustrative catalog as the single source of truth.

```ts
/** How a normalized UI value reaches (and returns from) the engine. */
export type EndpointBinding =
  | { readonly _tag: "endpoint";
      readonly endpointId: EndpointId;
      readonly toEngine: (value: NormalizedValue) => number;   // engine units
      readonly fromEngine: (value: number) => NormalizedValue }
  | { readonly _tag: "storedState"; readonly key: StoredStateKey } // e.g. modulation-owned values
  | { readonly _tag: "unbacked"; readonly reason: "rack-dsp" | "capture" | "compound-sync" };

export type TargetDescriptor = {
  readonly targetId: TargetId;
  readonly moduleId: ModuleId;
  readonly workspace: "voice" | "effects";
  readonly label: string;
  readonly defaultValue: NormalizedValue;
  readonly format: ValueFormat;         // tagged: percent | hertz | decibels | semitones | pan | seconds
  readonly modAmount: ModAmountSpec;    // per-target unit span (exists today; moves here)
  readonly binding: EndpointBinding;
};

export function getTargetDescriptor(id: TargetId): TargetDescriptor; // total over parsed TargetId
export function formatValue(descriptor: TargetDescriptor, value: NormalizedValue): string;
```

Depth test: callers ask "format this", "bind this" — never "what unit is this and how do I convert
it". Conversion math, ranges, and endpoint names are hidden here.

## Adapter port (`cosimo-adapter-port.ts` — application-owned port)

THE seam. `useSyncExternalStore`-compatible reads; synchronous commands that mutate the
authoritative UI-side model; persistence/upload is adapter business, invisible to callers.

```ts
export type ConnectionState =
  | { readonly _tag: "ready" }
  | { readonly _tag: "connecting" }
  | { readonly _tag: "detached"; readonly reason: string };

export type EditLayer =
  | { readonly _tag: "patchBase" }
  | { readonly _tag: "articulationOverride"; readonly articulationId: ArticulationId };

export type CosimoAdapterPort = {
  /** Immutable; reference-stable between changes. */
  getSnapshot(): PatchSnapshot;
  subscribe(onChange: () => void): Unsubscribe;
  readonly commands: CosimoCommands;
};
```

There is deliberately no capabilities record: mock and bridge expose the identical surface at every
commit (hard-cut policy). What the engine can do is a property of the codebase, not of which
adapter is mounted.

`PatchSnapshot` carries `connection: ConnectionState` plus the typed instrument state (parameter
values by `TargetId`, mappings, sources, articulations in v3 sparse form, audition state). Fields
are `readonly`; values are `NormalizedValue`.

Commands: expected failures in return types; infallible-by-construction commands return `void`.

```ts
export type CosimoCommands = {
  // Parameters — layer is always explicit; no audition inference (locked 2026-07-16).
  setParameter(input: { targetId: TargetId; value: NormalizedValue; layer: EditLayer }): void;
  resetParameter(input: { targetId: TargetId; layer: EditLayer }): void;

  // Mappings
  addMapping(input: { sourceId: SourceId; targetId: TargetId }):
    Result<MappingId, RouteBudgetExceeded | MappingAlreadyExists>;
  removeMapping(input: { mappingId: MappingId }): void;
  setMappingAmount(input: { mappingId: MappingId; amount: number; layer: EditLayer }): void;
  setMappingPolarity(input: { mappingId: MappingId; polarity: Polarity }): void;
  setMappingEnabled(input: { mappingId: MappingId; enabled: boolean }): void;
  setMappingReducer(input: { mappingId: MappingId; reducer: "maximum" | "mean" }): void;

  // Sources
  createSource(input: { type: SourceType }): Result<SourceId, SourceSlotsExhausted>;
  deleteSource(input: { sourceId: SourceId }): void;
  undoDeleteSource(): void;
  setMacroValue(input: { sourceId: SourceId; value: NormalizedValue }): void;
  renameMacro(input: { sourceId: SourceId; name: string }): void;

  // MSEG (backs MsegEditorControllerLike; shapes are global, morph is per-layer state)
  setMsegShape(input: { slot: MsegSlotIndex; shapeIndex: 0 | 1; shape: MsegShape }): void;
  setMsegMorph(input: { slot: MsegSlotIndex; morph: NormalizedValue; layer: EditLayer }): void;
  setMsegPlayback(input: { slot: MsegSlotIndex; playback: MsegPlayback }): void;

  // Articulations (sparse, per Phase-0 ADR)
  addArticulation(): Result<ArticulationId, ArticulationSlotsExhausted>; // engine max 128
  duplicateArticulation(input: { articulationId: ArticulationId }):
    Result<ArticulationId, ArticulationSlotsExhausted>;
  deleteArticulation(input: { articulationId: ArticulationId }): void;
  setArticulationKey(input: { articulationId: ArticulationId; key: MidiNote }): KeyWalkOutcome;
  setArticulationRange(input: { articulationId: ArticulationId; mode: "vel" | "chain";
    bound: "lo" | "hi"; value: number }): RangeClampOutcome;
  setArticulationTriggerMode(input: { mode: TriggerMode }): void;
  clearArticulationOverride(input: { articulationId: ArticulationId; targetId: TargetId }): void;
  restoreArticulationLayer(input: { articulationId: ArticulationId;
    layer: ArticulationLayerBackup }): void;

  // Audition
  setAuditionArticulation(input: { articulationId: ArticulationId | "Default" }): void;
  beginTrigger(input: { note: MidiNote }): void;
  endTrigger(): void;
};
```

`KeyWalkOutcome` / `RangeClampOutcome` carry the flush-contact info (`touching`, `neighborId`) the
haptic layer needs — domain policies (`walkArticulationKey`, `clampArticulationRange`) stay pure
and move to `ui/shared` with types.

Tagged errors (each `extends Error`, stable `_tag as const`, structured fields):
`RouteBudgetExceeded { budget: number }`, `MappingAlreadyExists { mappingId }`,
`SourceSlotsExhausted { type, limit }`, `ArticulationSlotsExhausted { limit: 128 }`,
`UnknownTarget { input: string }`, `ValueOutOfRange { input: number }`.

## Articulation image resolver (`articulation-image.ts` — Domain, from Phase 0)

Pure compile from the product model (sparse) to the engine model (complete images). No I/O.

```ts
export function parseArticulationsV3(input: unknown):
  Result<ArticulationsState, ArticulationsParseError>;
export function serializeArticulationsV3(state: ArticulationsState): JsonValue;

/** Compile sparse overrides over the patch base into complete per-selector images. */
export function resolveArticulationImages(base: PatchBaseValues, state: ArticulationsState):
  ReadonlyArray<ArticulationImage>;   // one per occupied selector, engine-complete

/** Which selector images a given patch change invalidates (re-upload targeting). */
export function affectedSelectors(change: PatchChange, state: ArticulationsState):
  ReadonlyArray<SelectorId>;
```

## Bridge adapter (`CosimoBridgeAdapter` — outbound Adapter, Phase 3)

```ts
/** Constructed at the composition root; the only module that touches PatchConnectionLike. */
export function createCosimoBridgeAdapter(input: {
  readonly connection: PatchConnectionLike;   // globalThis.__cosimoPatchConnection
}): CosimoAdapterPort;
```

Owns, invisibly to callers: endpoint uploads via descriptors' `toEngine`; stored-state
serialization (`modulation.v2`, `articulations.v3`) and initial hydration (parse, don't validate —
malformed stored state is a typed parse error surfaced as `detached`, never a silent default);
selector re-uploads via `affectedSelectors` + `resolveArticulationImages`; engine listener wiring
back into the snapshot; classification of connection loss into `ConnectionState`. Raw
`PatchConnectionLike` types never escape it. Short-lived technical retries live here; nothing else
retries.

The mock (`createMockCosimoAdapter`) implements the identical port over the in-memory reducer and
becomes the named test fixture. The contract test suite takes `() => CosimoAdapterPort` and runs
against both.

## MSEG controller bridge (`mseg-port-controller.ts` — thin inbound glue)

Implements the existing `MsegEditorControllerLike` (`ui/shared/modulation.ts:248`) over
`CosimoCommands` + `getSnapshot`, so `EditableMsegSurface` / `useMsegEditorInteractions` mount in
the prototype unmodified. Deletion test: it earns its keep by translating between two contracts we
don't own; it contains zero policy.

## Composition roots

- Prototype dev/harness: `App.jsx` constructs the mock adapter (same surface as the bridge).
- iOS runtime: `patch-view-entry.tsx` parses the runtime environment (connection present, resources
  reachable) — a missing connection is a reported startup failure, not a fallback to mock — then
  constructs the bridge adapter and mounts the shell.
