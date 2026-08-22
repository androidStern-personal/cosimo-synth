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
- **M2 — The hard cut:** delete the `rack.*` namespace and the 45
  per-parameter endpoints; rewrite target descriptors, the resolver, the
  legal-pair domain, and every fixture to `lane.*`; lane state v1 replaces
  rack state v1. One namespace, one delivery path, one application.
- **M3 — UI:** lane containers in the rack workspace (locked direction,
  08f70bab), dynamic per-patch target pickers, instance labels through the
  mappings table.
- **M4 — Product surface:** device add/remove UX, the default starter patch,
  and the physical phone pass.

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
