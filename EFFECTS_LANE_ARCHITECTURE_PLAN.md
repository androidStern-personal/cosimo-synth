# Effects Lane architecture plan — instance identity end to end

Status: DRAFT for Andrew's review — 2026-08-21
Author: design investigation following the v3 requalification readout.

The product goal: multiple effect instances nested inside utilities (Parallel,
Frequency Split), Ableton-style lanes. If a user pushes past the machine, audio
glitches — no capacity governor, no artificial ceiling. The engineering
question this plan answers: **what has to change, layer by layer, for the
modulation system and the rest of the product to address more than one
instance of an effect — and what must be proven before building.**

## 1. What exists today, verified in source

- **Engine topology is compile-time fixed** (Cmajor). Multiple instances mean
  a pre-compiled pool (N slots per effect type) plus a routing fabric. The
  2026-08-13 physical campaign proved pool residency, state, startup, and
  artifact-free topology switching through +4-each on the phone; the v3
  browser campaign proved the routing fabric costs ~0.01 load. The pool and
  router are feasible and cheap. What was never designed is everything above
  them.
- **Rack modulation targets are a dense compile-time matrix.**
  Each modulatable rack parameter carries `modulationTargetIndex`
  (0..MODULATION_RACK_TARGET_COUNT), and the compiled program
  (`ui/shared/modulation-runtime-program.ts`) uploads fixed-size
  `source x target` cell arrays. ~39 indexed rack targets today. Execution is
  sparse (ADR-020) — only active cells run — but the ADDRESS SPACE is static.
- **Target identity is a singleton string.** `rack.<endpointID>` names a
  parameter of THE one instance of an effect. modulation.v6 routes store these
  strings; the 1,131-pair legal domain, every picker, the mappings table, and
  `resolveModulationTargetBase` (now the single target authority) all assume
  it.
- **Base values travel over 45 fixed host endpoints** (`send_value` per
  endpointID). The old feasibility report locked a constraint: lane-created
  devices get NO new host endpoints (host automation via the permanent macro
  bank only). So per-instance parameter bases need a delivery channel that is
  not an endpoint-per-parameter.
- **Rack state v1** stores the eight fixed modules (order, enable, XY). There
  is no structural schema for lanes.

## 2. The design

### 2.1 Instance identity — HARD CUT (Andrew, 2026-08-21)

- Every effect in the product is a lane device with a **stable per-patch
  instance ID** (monotonic, never reused within a patch): `delay#1`,
  `delay#2`.
- ONE target kind namespace for all of them: **`lane.<instanceId>.<endpointID>`**.
  The `rack.<endpointID>` singleton namespace is DELETED, along with the idea
  of a permanent fixed eight. No compatibility path, no dual addressing, no
  migration shim — the app has never shipped, so saved-state compatibility is
  explicitly not a goal. Test fixtures and the legal-pair domain are rewritten
  to the new namespace as part of the cut.
- A fresh patch starts with a sensible default device set (product call:
  probably the familiar eight, as deletable devices like any other).

### 2.2 Engine addressing: extend the dense domain by pool slot

The pool is compile-time sized anyway (Cmajor), so the target address space
stays static: `targetIndex = poolSlotBase(slot) + paramIndex`. A 2-each pool
(16 extra device slots, ~5 modulatable params each) grows the rack-target
domain from ~39 to roughly 120-160 indices. Cell arrays grow proportionally;
**execution stays sparse**, so inactive lane targets cost nothing at runtime.
Program upload size grows ~3-4x — measured in spike E1 (this is the one place
a number is needed, because install cost is on the acknowledged-serial path).

The UI-side compiler maps `lane.<instanceId>.<endpointID>` ->
`(effectType, poolSlot, paramIndex)` through the lane state (which records
which instance occupies which pool slot). Slot assignment is an engine-facing
detail the user never sees.

### 2.3 Per-instance parameter delivery: a structured lane-state upload

Mirror the pattern that already works for modulation: one value endpoint
carrying a structured program (`MODULATION_PROGRAM_ENDPOINT_ID` precedent,
with the runtime-install-channel serial acknowledgment). A `laneState` upload
carries:

- topology: the utility tree (serial / parallel-4 / nested-3 / multiband with
  the frozen 65-tap crossover — the four proven plans are the vocabulary),
- pool-slot occupancy: which instance ID sits in which compiled slot,
- per-instance parameter bases and enable flags.

Live per-instance base editing streams over the same channel (serial-acked,
like modulation amounts today). The 45 per-parameter host endpoints are
RETIRED with the cut: every device's parameters travel over the structured
upload — one delivery path for the whole application.

### 2.4 State and presets: lane state v1

ONE structural schema replacing rack state v1: the utility tree, device
instances (type, instance ID, per-instance params, enable). Modulation routes
stay in modulation.v6 and carry `lane.*` target kinds exclusively. Old rack
state and `rack.*` routes are not read — hard cut, no migration.

### 2.5 UI

- **Rack workspace**: lane containers per the locked direction (commit
  08f70bab: lane direction + generic X/Y fallback for the six unprotected
  effects; Filter/Distortion keep their protected visuals).
- **Mappings table (T14/T15)**: already route-shaped. Instance identity flows
  through `resolveModulationTargetBase` — the single authority we just
  finished consolidating (rail projection, drag styles). It gains `lane.*`
  resolution: same descriptors per effect type, instance-labeled
  ("Delay 2 - Feedback"). Rows, rails, LED meters, polarity, bypass language
  all inherit unchanged.
- **Target pickers** (draft creation, menus): become per-patch dynamic —
  static core targets plus one entry per live lane device parameter.
- **Drag-to-map**: lane device knobs are drop targets exactly like rack knobs
  (ADR-025 treatments unchanged; knobs are the same component with an
  instance-addressed target kind).

### 2.6 Lifecycle

Deleting a lane device deletes its routes immediately — the T15 semantic, no
confirmation, recovery arrives with T18 Undo. Duplicate-pair rules extend
naturally: (source, `lane.delay#2.feedback`) and (source,
`lane.delay#3.feedback`) are distinct pairs.

## 3. Build order (no spike — every mechanism is proven or arithmetic)

The pool/router are physically proven, the serial-acked structured upload is
shipped production machinery, and the grown table is dense-array arithmetic.
There is no design fork left for an experiment to decide, so this is a build,
milestone by milestone, tests-first as always. The former "spike criteria"
are M1's permanent acceptance tests, not a throwaway report.

- **M1 — Engine:** pool slots for all eight types, the extended target
  matrix, and the laneState upload channel. Acceptance tests: claim/insert a
  second instance with zero misses/discontinuities outside the declared
  transition; sustained drag-rate base edits all acknowledged with no misses;
  install latency reported against today's measured baseline; MSEG modulates
  instance #2 and provably not #1; teardown leaves zero installed routes and
  a clean post-tail output.
- **M1 progress (2026-08-22, branch claude/effects-lane-m1, five commits):**
  DONE: pool slot + topology/params uploads + lifecycle (sleep outside chain,
  fresh entry) + modulation through the one program (`lane.*` kinds, slot
  assignments, pool block on the one bus, static 1,131 domain untouched) +
  the hot-path acknowledgment contract, measured on the real product page:
  120Hz edit stream, final ack 0.3ms Chromium / same-frame WebKit, zero
  misses (vs ~25ms on today's modulation-amount path). All platforms green
  including native parity fingerprints.
- **M1 COMPLETE (2026-08-22, six commits):** all eight types pooled with
  per-module-audited fresh-entry resets (delay + reverb discrimination-
  proven); the pool block is a full derived MIRROR of the static vocabulary
  (bus width 72, no offset tables, cannot drift); topology enables travel as
  a bitmask; the program-execution suite's tail sentinel permanently
  exercises pool modulation. Full cross-platform gate green. Known harness
  constraint recorded: composed-parent event writes cap near 19 ints — big
  structs travel graph connections.
- **M2 staging (2026-08-23):** the cut lands in three slices on the branch.
  M2a ENGINE: slots become uniform — one array of (1 + lanePoolSetCount)
  instances per type, ordinal 0 replacing the named base nodes; every device
  sleeps outside the chain and enters fresh; rackOrder/rackEnable, the 45
  hoisted parameter endpoints, the permutation machinery, and the
  always-advance idle loop are DELETED; laneTopology + parameter records are
  the only structure and parameter paths; a per-field
  LaneSlotParamValueUpload joins the record upload (answers the
  whole-record-race concern with the safer contract: fields for live edits,
  records for bulk restore); the distortion analyzer taps ordinal 0. Default
  chain is empty (dry) until the adapter restores lane state, mirroring the
  legacy empty-enable default. M2b TS/WIRE: lane state v1 schema + adapter,
  knob bindings over the field upload, dynamic target domain, picker/table
  labels. M2c: fixtures, presets, benchmark-profile regeneration against the
  default device set.
- **B2 STRUCTURE CUT COMPLETE (2026-08-23):** rackOrder/rackEnable and the
  permutation machinery are gone; laneTopology is the only structure path.
  Readback = laneCommittedChainLength + laneCommittedChainCode (3 bits per
  position, valid for ordinal-0 chains) + laneCommittedPositionMask +
  laneCommittedGeneration (the ONE generation counter — the redundant
  committedStructureGeneration was deleted) + laneRejectedUploadCount +
  laneParamsAcknowledgedSerial. RackShape tests rewritten SEQUENTIAL
  single-rack (two-instance interpreter anomaly); rack.v1 rides the seam in
  `ui/shared/rack-state.ts` as one laneTopology event with position-indexed
  enable bits; every consumer (browser tests, web:poc, iOS shell readback,
  native quickjs probe, native benchmark) migrated; the orphaned legacy
  `fixtures/rack_*` patch fixtures (runner deleted long ago) removed.
  TWO REAL M1 REGRESSIONS caught and fixed during the gate:
  (1) NATIVE TRANSPORT: the 180-wide matrix-sized program upload hit 68KB
  against cmaj::Patch's fixed 64KB performer event FIFO — the program could
  NEVER be delivered on the native (iPhone) path (wasm bypasses that FIFO,
  so web gates were blind). Cut: the rack tables now carry a ROUTE BUDGET
  (modulationVoiceRackRouteCapacity 512 / modulationMacroRackRouteCapacity
  256 — covers the whole 1,131-route static stress contract: 324 + 144 —
  plus lane routes) while per-CELL amount tables keep the full cell space;
  upload is ~37KB. TS mirrors the capacities and fails fast over budget.
  (2) MACRO-RACK LIVE EDITS: the amount-edit path missed the M1
  blocked-vector conversion — a single-subscript on the [sources, blocks]
  layout clamped the block index and broadcast a scalar across a whole
  36-lane block (every macro-rack edit corrupted its source's other
  routes). Fixed with the install-site block/lane decomposition; new
  MacroRackAmountEditIsolation test pins surgical edits on a static and a
  lane target (discrimination-proven against the reverted bug). Also fixed
  pre-existing master drift: NativeModulationMatrixBenchmark still wrote
  the pre-batching wavetable mip fields. Harness note: every testProcessor
  section in a file whose globals include the rack modules must instantiate
  them, or their latency static_asserts fail to constant-fold.
- **B3 PARAMETER CUT COMPLETE (2026-08-23):** the 45 per-effect host
  endpoints are DELETED engine- and synth-side; ordinal 0 is just another
  slot. One uniform forwarding loop drives all five ordinals (records +
  that ordinal's rackMod block + one glide-scaler bank per ordinal); the
  record/smoothing arrays span all 40 slots; commit-entry snaps every
  entering device onto its record. lane.v1 replaces rack.v1 as the ONE
  stored document, now owning every device parameter alongside order and
  enables (`ui/shared/lane-state.ts`, wire layout in
  `ui/shared/lane-slot-params.ts`). All binding surfaces ride a shared
  per-connection lane store (`ui/shared/lane-param-bindings.ts`):
  optimistic store update + laneSlotParamValue field event per move,
  document persist on gesture end, gestures on the connection's gesture
  channel under the logical parameter id, user-edit bus fed as before
  (auto-preview intact). The bridge adapter routes rack-target
  setParameter through the document, mirrors document values into
  target-id space on hydration, and skips lane params in endpoint
  listeners/base-value uploads. Mock models the ENGINE's truth: lane.v1
  doc overlaid with the field uploads it has seen. Store hydration is
  once-per-connection with serialized-identity dedupe (a hundred mounted
  bindings must not fan out hydration or re-render on echoed writes —
  found as a React update-depth loop under the 100-route profile). DAW
  automation slots for effect params are GONE (sanctioned hard cut);
  the host surface is oscillators + voice + macros + MSEG/env + filterMix.
  Native benchmark seeds effects via lane fields; every browser/iOS test
  speaks the field-upload wire.
- **B4 NAMESPACE CUT COMPLETE (2026-08-23):** the `rack.*` target-kind
  namespace is DELETED. The static vocabulary's kinds are the resident
  instance-#1 lane kinds (`lane.<type>#1.<endpointID>`), minted by
  `laneBaseKindForRackEndpoint` (device type derived from the endpoint's
  own prefix, never hand-mapped); the 1,131-pair static domain and every
  wire index are unchanged — only the naming key moved. ONE grammar for
  every device: instance #1 parses like any other instance, and
  `LaneSlotAssignments` now speak SLOT ordinals (0 = the base block,
  1..4 = pool sets; bus index = ordinal x 36 + static index). The
  compiler resolves static members without assignments; pool instances
  still require them. Bounds/limits/readout authority defers to the
  instance-#1 kind. Every extraction site (`slice("rack.".length)`)
  now parses the lane grammar; every fixture, probe, profile generator
  and stored-route document speaks `lane.*`; old `rack.*` routes are
  not read (hard cut). Internal identifiers that mirror the ENGINE's
  rackMod bus keep their "rack" names, matching the engine's own.
  Full cross-platform battery green.
- **M2 — The hard cut:** delete the `rack.*` namespace and the 45
  per-parameter endpoints; rewrite target descriptors, the resolver, the
  legal-pair domain, and every fixture to `lane.*`; lane state v1 replaces
  rack state v1. One namespace, one delivery path, one application.
- **M3 — UI:** lane containers in the rack workspace (locked direction,
  08f70bab), dynamic per-patch target pickers, instance labels through the
  mappings table.
- **M4 — Product surface:** device add/remove UX, the default starter patch,
  and the physical phone pass.

## 3.1 M1 engine breakdown (reconnaissance 2026-08-22, verified in cmajor/)

The engine already contains all three mechanisms M1 generalizes — nothing is
invented from scratch:

- **Runtime routing exists.** `EffectsRack` is deliberately a `processor`,
  not a `graph`: eight resident `node`s with `main()` dispatching the runtime
  order (this is how 8! reorderings work today, with crossfaded transitions).
  Lanes generalize the dispatch from "a permutation of eight" to "a topology
  tree over pool slots" — same mechanism, richer program. The Parallel and
  FrequencySplit utilities become new resident nodes (crossover spec from the
  feasibility work; the C10 latency discipline in the file header governs the
  compensated dry paths).
- **The structured, acked upload exists.** `RackOrderUpload` /
  `RackEnableUpload` are struct events with committed-generation readbacks
  and rejection counters — exactly the laneState pattern. LaneTopologyUpload
  (tree + pool-slot occupancy + per-slot parameter table) is a third sibling,
  not a new idea.
- **The modulation bus is one indexed array.** Voice-reduced modulation
  arrives as `rackModIn[rackModTargetCount]` (engine constant 36 in
  FixedFrameOscillator.cmajor, mirrored by MODULATION_RACK_TARGET_COUNT on
  the UI side). Pool slots widen this array and the VoiceReducer vocabulary;
  cell counts scale linearly and execution stays sparse.

The 45 hoisted `input value` parameter endpoints on EffectsRack are what the
hard cut deletes: per-slot parameters move into the laneState upload.

**Sequencing constraint (no-dual-path rule):** master never carries two
addressing schemes. The lane work builds on ONE feature branch where the
intermediate dual state may exist while tests migrate; it merges only as the
completed cut (engine + namespace + UI landing together, full gate green).
Milestones M1-M3 are review checkpoints on that branch, not master merges.

**First failing test (M1 start):** a cmajor_rack suite case asserting the
engine accepts a LaneTopologyUpload placing a second delay in series and the
rendered output contains both delays' distinct echo spacings — red today
because neither the upload type nor the second delay node exists.

## 4. Open product questions (Andrew's calls, not blockers for E1)

1. Pool sizes per effect type at compile time (the feasibility evidence used
   2-each; bigger pools cost memory ~6.4 MiB per each-set, not CPU).
2. RESOLVED (2026-08-21): no permanent eight — hard cut, one namespace, no
   backwards compatibility. The default patch ships with a starter device set.
3. Utility vocabulary at launch: the four proven plans (serial, parallel-4,
   nested-3, multiband) or a subset?
4. Mappings table presentation at lane scale: flat with instance labels
   (default; zero new UI) or grouped by device (new grouping mode)?

## 5. Explicitly NOT in this plan

- No capacity governor, no load ceilings, no comfort targets. Overload
  glitches, as decided.
- No new host automation endpoints for lane devices (macro bank only, per the
  locked constraint).
- No per-effect DSP optimization until a design-driven need appears; the only
  measurement in scope is E1's program-install cost.
