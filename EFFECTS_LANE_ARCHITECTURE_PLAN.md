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

- topology: the utility tree (serial / parallel-4 / nested-3 / multiband —
  the four proven plans are the vocabulary; crossovers are Linkwitz-Riley
  LR4, zero latency — the early frozen-65-tap FIR idea is superseded, see
  the T2 entry),
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
- **B5 DYNAMIC TARGET DOMAIN COMPLETE (2026-08-23):** the M2b remainder —
  every display and editing authority is TOTAL over the lane grammar, and
  the pickers speak a per-patch domain. Display: pool instances are
  instance-labeled through the type's #1 descriptor
  (`getModulationTargetDisplayLabel` "DELAY 2 FEEDBACK";
  `getModulationTargetPresentation` category "Delay 2" / parameter
  "Feedback" is the ONE shared table/list authority — the mobile matrix's
  local `targetPresentation` now delegates). Editing language: amount entry
  specs, the log-anchor base-binding spec, and clamp hints defer to the
  instance-#1 mirror exactly like bounds/clamp/readout already did. Base
  ownership stays honest: `resolveModulationTargetBase` returns null for
  instances > 1 (lane.v1 has no document slot for them — their rows edit
  amount only; per-instance base bindings arrive with the instance tree).
  Domain: `buildPatchModulationTargetOptions(devices)` = static voice core
  + one entry per live device parameter, fed by
  `listLaneDeviceInstances(laneState)` (stable identity order, NEVER chain
  order) through the identity-stable `usePatchModulationTargetOptions`
  hook; all four picker surfaces (mappings draft, mobile create flow,
  desktop matrix, iOS route selects) consume it, and the per-route selects
  append a stored kind their patch no longer lists. The resident-#1 set
  reproduces `MODULATION_TARGET_OPTIONS` exactly (pinned by test), so the
  default patch's pickers are unchanged. New reducer-visibility predicate
  `isRackBusModulationTarget` (any lane instance rides the rack bus) where
  `isRackModulationTarget` stays static-membership. Browser-proven: a
  stored `lane.delay#2.delayMix` route renders "Delay 2 Mix", edits
  amount-only with working polarity, and stays out of the fixed-eight
  picker. ONE REAL LATENT CRASH caught by that browser test and fixed:
  `getModulationArticulationCellIndex` resolved the full runtime cell for
  every stored route, and an unassigned pool route made that resolution
  throw — taking down DesktopPatchViewBody at mount (error boundary, dead
  patch view) and the runtime worker's upload builder with it. Lane
  targets ride the rack bus, so no lane route carries a per-note
  articulation cell: the function now answers null from the grammar,
  before any cell resolution. Also fixed a B4 straggler: the
  runtime-program duplicate-index test's synthetic fixtures now use
  prefixed endpoints (kind minting requires the device-type prefix).
  Gate scope (remote Linux container, no macOS toolchain): tsc clean;
  units:orphans 691/691; the FULL fx-modulation browser file 51/51
  (Chromium) plus targeted matrix/mappings/rail cases in the other three
  desktop files and shared hooks 34/34. Deferred to the dev machine:
  WebKit variants, web:poc (renderer-wasm build needs macOS clang), the
  cmajor engine suite (no cmaj binary here — this slice touches no
  cmajor/ source), iOS shell, native benchmarks.
- **M2 — The hard cut:** delete the `rack.*` namespace and the 45
  per-parameter endpoints; rewrite target descriptors, the resolver, the
  legal-pair domain, and every fixture to `lane.*`; lane state v1 replaces
  rack state v1. One namespace, one delivery path, one application.
- **M3 DIRECTION PIVOT (2026-08-23, Andrew):** the lane-container row
  treatment (08f70bab lineage) was reviewed as mocks and REJECTED — it never
  shows the full graph and spends too much row height. The locked mobile
  direction is the SUBWAY MAP: the rack list column becomes a top-to-bottom
  line map with the whole topology always in view; devices shrink to
  station pills (effect accent + short code + instance number; hollow =
  bypassed, amber ring = selected); parallel forks at a dot junction with
  lettered lanes, frequency splits at a diamond with band-tinted lanes and
  crossover readouts; empty branches are dashed lanes with ghost add
  stations; the faceplate art moves into the editor header. Design canvas:
  "FX Rack Subway Map" (claude.ai artifact 62b9012a). Accepted tradeoff:
  the per-row quick slider goes away at station scale — quick edits live in
  the editor. Open: station codes vs glyphs, parallel lane coloring, map
  mode trigger.
- **T1 PARALLEL GROUPS COMPLETE (2026-08-23):** the engine renders parallel
  lanes. Branch tags ride the UPPER BITS of each topology slotIds entry
  (slot id low byte, three tag bits above; tag 0 = trunk) so the upload
  struct and its proven harness event size are unchanged. Grammar,
  validated never coerced: a maximal tagged run is one group; tags start at
  1, never decrease, never skip, reach at least 2; fan-out caps at 4 (the
  physical campaign's ceiling); junk above the tag field rejects whole.
  Dispatch: every branch reads the group's fork signal, a branch change
  banks the finished branch, the merge SUMS branches into the continuing
  trunk (no per-branch level in v1; RackOutputStage owns overload). An
  all-tag-0 chain takes none of the new paths — the serial walk is
  unchanged. Readback: laneCommittedBranchTagsLo/Hi, three bits per
  position (0..9 / 10..15); zero = serial, so the old shape is a strict
  subset. TS mirrors the encoding in lane-state.ts
  (encodeLaneSlotWithBranchTag + decode pair, layout pinned by test on both
  sides); the v1 document replay stays all-trunk by construction.
  Discrimination-proven in tests/cmajor_rack/LaneParallel.cmajtest:
  full-wet 40∥90ms delays echo at 40 AND 90 with NOTHING at the 130ms
  series time; a chained branch ([40→90]∥[60]) through a 25ms trunk delay
  peaks only at the +25-shifted times (in-branch chaining AND
  merge-feeds-trunk); a disabled device inside a branch passes its branch
  through; six malformed-tag uploads reject with the running chain
  untouched, and a valid re-upload still commits. Gates (this container,
  cmaj 1.0.3066 linux binary): cmajor_rack 69/69 (was 65 baseline),
  units:orphans 692/692, tsc clean. Not run here: browser suites (no UI
  code changed; twins additive), WebKit/iOS/native benchmarks. NEXT: T2
  frequency split (see the next entry — the grammar and crossover plan
  both evolved), then lane.v2 (device instances + tree document) feeding
  the subway map.
- **T2 FREQUENCY SPLIT COMPLETE (2026-08-23):** the engine renders 2- and
  3-band frequency splits, and the group grammar HARDENED to marker form
  while T1 was hours old — one migration nobody pays for later. DSP
  decision (Andrew, voice): "let's use the Linkwitz-Riley filters …
  just pick something instantaneous phase. You can double them up …
  twenty-four dBs per octave. Do that." — LR4, minimum phase, ZERO
  LATENCY, superseding the frozen 65-tap linear-phase FIR idea and
  deleting the sibling-branch latency-compensation architecture with it.
  The stdlib crossover is exactly that form (low = LP2², high = its
  2nd-order allpass − low; the bands sum to that allpass — the OTT
  precedent: allpass colour is an effect characteristic, not latency).
  The 3-band tree splits low off first, then the rest at the high
  crossover, and repays the high crossover's allpass on the LOW path with
  a compensation allpass, so the recombined magnitude is EXACTLY flat at
  any crossover spacing.
  Wire: groups are opened by MARKER SLOTS — utility units above the
  device pool (parallel base 40, split base 44, four units each, chain
  slot domain 48) placed in the chain like devices. The marker's tag
  field carries the branch/band count (parallel 2..4, split 2..3, band
  tag 1 = low); members carry tags 1..N monotone non-decreasing with
  skips allowed (an empty branch is representable); a trunk device, the
  next marker, or the chain's end closes the group. The marker's position
  enable bit is the GROUP BYPASS: members and split filters still advance
  on their branch signals while the trunk hands the fork through. An
  empty parallel branch contributes silence; an empty split band its raw
  filtered band; a group with no devices at all is a hard passthrough —
  placing structure never changes the sound. Split markers own a param
  RECORD: values[0]/[1] = crossover Hz (clamped 40..18000), riding the
  same laneSlotParams/laneSlotParamValue + acked-serial machinery as
  every device with the 64-frame utility ramp row — the subway map's
  draggable crossovers get the hot path for free. Filter state resets
  when a unit enters the chain or changes band count (both land on the
  transition's dry frame); retunes only when a crossover actually moves.
  Proven in tests/cmajor_rack/LaneSplit.cmajtest: a full-wet delay in one
  band follows LIVE field-edited crossovers (18k→60 Hz flips echo to dry
  passthrough; a 9000/9500 mid sliver collapses the echo), sine-RMS
  recombination flat within ±0.5 dB at nine frequency/config points
  including crossovers HALF AN OCTAVE apart (400/550 — the case that
  combs by several dB if the compensation allpass is dropped;
  mutation-verified), split grammar rejects (N=1, N=4, tag>N, duplicate
  marker unit), and marker-disabled + zero-device passthroughs.
  LaneParallel.cmajtest rewritten to the marker grammar (7 rejects incl.
  the old markerless form, adjacent groups, tags readback incl. marker
  N). TS mirror: marker slot bases/domain, split param indices, marker
  predicates in lane-state.ts, pinned in test_lane_state_v1.mjs. Gates
  (this container, cmaj 1.0.3066 linux binary): cmajor_rack 73/73,
  units:orphans 693/693, tsc clean, twins regenerated. Not run here:
  browser suites (no UI surface changed), WebKit/iOS/native benchmarks.
  NEXT: lane.v2 document (device instances + topology tree) + the
  subway-map layout model, then the subway-map UI (M3).
- **T3 LANE.V2 DOCUMENT LAYER COMPLETE (2026-08-23):** the TS foundation
  the subway map renders from — new modules with tests, ZERO behavior
  change (the app stays on lane.v1 until the M3 UI cutover swaps the
  workspace wholesale; the deserializer upgrades v1 documents in place so
  no patch is stranded). lane-state-v2.ts: the document is an INSTANCE
  TABLE plus a CHAIN TREE — group nodes hold branches of device
  placements only, exactly as expressive as the wire grammar (no nesting;
  a marker inside a group would close it). Identity is structural:
  `delay#2` is the instance id everywhere and #n statically holds slot
  ordinal n-1, so LaneSlotAssignments is the identity map and a
  modulation route can never silently retarget; `parallel#n`/`split#n`
  name marker units the same way, so a split keeps its engine slot (and
  filter state) across reorders. Parsing validates and never coerces:
  id/unit grammar and pool caps, complete param vocabularies, the
  placement bijection (a device exists iff placed exactly once), fan-outs
  2..4 / 2..3, crossovers inside the engine's 40..18000 clamp, and the
  flattened wire length (placements + markers ≤ 16). Placement enables
  live in the tree; the split's crossovers are group fields that compile
  onto its marker record. compileLaneTopologyUpload flattens the tree to
  the marker/tag wire; validateCompiledLaneTopology is a TS mirror of the
  engine's validator so the adapter fails loudly BEFORE sending;
  buildLaneRuntimeEventsV2 replays records first (every instance + every
  split marker) then the one topology event, and an upgraded serial
  document compiles BIT-IDENTICAL to lane.v1's replay (cross-pinned
  against the v1 builder in test). lane-subway-layout.ts: the
  geometry-free layout model per the accepted canvas — a document becomes
  a row script (terminus / stations / fork / merge) with per-lane cells;
  parallel forks get lettered infra-teal lanes, splits get LO/MID/HI
  band-tinted lanes with crossover readouts (highHz null at 2 bands),
  empty branches open with a ghost add-stub then run dashed, bypassed
  groups carry the flag for the view to dim (stations stay — members
  still advance). Station pills: FLT/DRV/OTT/CHO/FLG/PHA/DLY/RVB + the
  instance number. Gates (this container): units:orphans 706/706 (13 new
  across test_lane_state_v2 + test_lane_subway_layout), tsc clean.
  Engine untouched — no cmajor run needed; twins unchanged (no runtime
  consumer until M3). NEXT: the subway-map UI — render the layout model
  in the rack workspace, cut the adapter over to lane.v2
  (deserialize/commit/assignments), and swap listLaneDeviceInstances to
  the v2 listing.
- **T4 SUBWAY MAP SHIPPED (2026-08-23):** the rack column IS the line map.
  ui/desktop/subway-map-column.tsx renders the T3 pipeline end to end —
  the live lane.v1 document projects through upgradeLaneStateV1 into
  buildSubwayLayout and the station rows render from the layout script —
  so the M4 cutover to stored lane.v2 changes the projection, not the
  renderer. Station pills (type code + instance number, effect accent;
  hollow dashed = bypassed, amber ring = selected) sit on an infra-teal
  line between terminus dots; rows keep the 44px touch floor with the
  pill as the visual inside. RackUnit, RackQuickSurface, the grip, the
  per-row power button, and ~220 lines of row-era CSS are DELETED — the
  accepted tradeoff: quick edits live in the editor, one tap away.
  Gestures per the accepted mocks: TAP selects; DRAGGING a station along
  the line reorders through the workspace's existing preview/commit
  machinery (stations carry data-rack-effect-id, so the same nearest-row
  walk drives the live preview); LONG-PRESS or right-click opens the
  STATION MENU — Bypass and Exact value now, Move/Remove with M4 —
  reusing the parameter-menu presentation; keyboard arrows still
  reorder. The editor header gains the relocated FACEPLATE ART (the
  rack-faceplates strip behind a legibility scrim, keyed by the selected
  effect) and a power toggle for the selected device. Two real bugs
  found by the browser suites and fixed: (1) a station must CAPTURE the
  pointer at pointerdown — mouse pointers have no implicit capture, so
  the threshold-crossing move otherwise lands off the 20px pill and the
  drag never arms; a pointerleave cancel had the same effect for touch
  and is gone; (2) the capture HANDOFF to the list fires
  lostpointercapture on the station, which BUBBLES into the list's
  cancel handler and killed every drag until the handler learned to
  ignore capture losses that are not its own (event.target check).
  Browser suites rewritten to station flows: select via station click,
  bypass via the station menu (toggleRackEffectEnabled helper) or the
  editor power, reorder drags the pill itself, the row layout scan is
  now a station scan (44px rows, whole line in view, single-line pills),
  and the removed quick-slider behavior tests are replaced by a
  station-semantics test (hover inert; tap selects with ZERO DSP
  traffic; one drag = exactly one laneTopology commit and no parameter
  gestures). Gates (this container): desktop browser suites 212/213
  twice (the one red is the rail-flick momentum test — a load flake,
  green solo, red only under 4-way CPU contention, untouched by this
  diff); browser:orphans 114/117 (+1 skip; both reds pre-existing
  container-environment failures verified on the CLEAN baseline —
  Avenir Next font metrics, and the renderer-WASM worklet needing the
  macOS clang build); units:orphans 706/706; tsc clean; desktop twin
  rebuilt (the iOS bundle does not include the rack workspace). web:poc
  suite updated textually (station selectors, menu bypass, station-row
  data-enabled reads) but not runnable here — deferred with WebKit, iOS
  shell, and native benchmarks.
- **T5 GROUPS ARE LIVE (2026-08-23):** lane.v2 is the stored document and
  the map RENDERS AND EDITS trees end to end. STORAGE CUT: all four
  runtime consumers — the lane store (lane-param-bindings), the headless
  worker restore, the cosimo bridge adapter, and the init-preset adapter
  — hold LaneStateV2, persist v2 under the SAME stored-state slot
  ("lane.v1" stays the slot NAME; the value is self-versioned), and read
  v1 through the compat parse, so every existing patch and preset loads
  unchanged and upgrades on its next write (pinned by browser test). The
  bridge's host surface derives its serial effectOrder/effectEnabled
  from the chain walk; a full-order restore is a serial statement that
  dissolves groups. TREE OPS (lane-state-v2, all pure,
  validate-never-coerce, unit-tested): moveLaneDevice splices along and
  ACROSS lanes through document paths (also the map's drop-target
  grammar, encoded on every station and ghost as data-lane-path);
  wrapLaneDeviceInGroup (trunk devices only — the wire cannot nest;
  splits default 800/2500 Hz); dissolveLaneGroup;
  setLaneSplitCrossoverHz; setLaneGroupBranchCount (a split grows an
  EMPTY MID band and shrinks only an empty one; parallels append/remove
  empty last branches — devices never relocate implicitly); enable
  setters for devices and groups; smallest-free unit allocation. MAP:
  fork rows (dot junction / diamond) with lettered or LO/MID/HI
  band-tinted lanes and live crossover readouts, per-lane body cells,
  ghost add-stubs on dashed empty lanes, merge rows, bypassed groups
  dimmed as one section; trunk stations keep the exact serial DOM
  contract so every existing selector held. GESTURES: tap a fork to
  select its group — the right pane becomes the GROUP EDITOR (split:
  log-scaled crossover sliders on the acked laneSlotParamValue marker
  hot path, live field uploads while dragging and one persist on
  release; both kinds: power, fan-out, dissolve); long-press/right-click
  a fork for the group menu; the station menu gains Make parallel / Make
  frequency split (trunk stations); dragging a station now targets ANY
  station or ghost path, so devices move between branches, bands, and
  the trunk with the same physics. One real bug found by the browser
  suite: the reorder target walk was Y-ONLY — correct for a single
  column, wrong the moment lanes sit side by side (it kept landing in
  the neighboring band); the walk now picks by 2D containment with
  smallest-rect-wins and nearest-center fallback. Browser coverage
  (test_desktop_patch_view_browser_subway.mjs, in the sharded suite):
  wrap→tree+wire+map (marker record 800/2500 and the marker-grammar
  topology asserted on the wire), crossover drag (field edits slotId 44
  paramIndex 0, doc persisted, ZERO topology traffic), cross-lane drag
  into the empty band (one topology commit, reverb tagged into band 2),
  fork-menu bypass+dissolve, and the stored-v1 upgrade path. The sweep
  surfaced one more real regression, fixed in the follow-up commit: the
  whole-document preview froze ENABLE state during a station drag, so an
  authoritative enable arriving mid-gesture did not paint until release
  — the map now renders the preview structure with LIVE enables merged
  over it, restoring the old order-previewed/enables-live contract.
  Final gates (this container): units:orphans 706/706, tsc clean,
  subway suite 5/5, sharded desktop suites 217/218 (the one red is the
  rail-flick momentum test — the established CPU-contention flake,
  green solo, untouched by this work), browser:orphans 114/117 +1 skip
  (both reds the pre-existing container-environment failures verified
  on clean baseline: Avenir Next font metrics, renderer-WASM needing
  macOS clang), twins rebuilt. Deferred as always: web:poc, WebKit, iOS
  shell, native benchmarks. NEXT (M4 remainder): device add/remove — the ghost stubs
  become add affordances with a type picker, instance numbers beyond #1
  (slot assignments feed the modulation compiler), Remove/Move-to in the
  station menu, and the starter patch.
- **T6 DEVICE INSTANCES SHIPPED (2026-08-23, commits fe1e9e7 + 412a2a8):**
  add/remove closes M4's core and the whole surface speaks instances.
  OPS (T6a, lane-state-v2, pure + unit-tested): addLaneDevice allocates
  the smallest free instance number (≤5 per type), seeds descriptor
  defaults in wire order, places enabled at any document path, and
  refuses over the pool or the 16-unit wire; removeLaneDevice deletes
  placement and record together (an empty chain is legal);
  laneDefaultParamsForType. STATIC RESOLUTION (T6a): since `#n` IS slot
  ordinal n-1, the B5 assignments map was pure indirection —
  LaneSlotAssignments, buildLaneSlotAssignments, and every runtime
  laneAssignments thread are DELETED; getLaneModulationTargetIndex
  resolves document-free as (n-1)*36 + the static mirror index, and a
  route to an absent device modulates an idle slot bus cell nothing
  reads (audibly identical to dropping it, no recompile coupling).
  EDITOR + MAP (T6b): selection is a DEVICE INSTANCE (selectedDeviceId;
  the effect id derives), stations select/drag/menu by deviceId and
  carry data-device-id, the editor header names the instance ("DELAY
  2") and its power/menu bind the instance, and every parameter surface
  resolves through a SelectedLaneDeviceContext — the selected instance
  where types match, the type's #1 elsewhere (the workspace body sits
  above its own provider, so overlay bindings thread the id
  explicitly). Effect-typed entry points (dwell navigation, parameter
  taps) resolve to the selection when the type matches, else the
  document's lowest-numbered instance. ADD/REMOVE UX: every ghost is a
  tappable add affordance and the trunk keeps a trailing add-ghost at
  the end-of-chain insertion point (also the missing trunk-end drop
  target); a type-picker sheet runs addLaneDevice per type to disable
  capacity-refused entries, commits, and selects the new device
  (identity diffed from the devices table); the station menu grows
  Remove, selection heals onto the head of the line after any document
  swap that strands it, and a truly empty document shows an editor
  placeholder pointing at the map's add stub. PER-INSTANCE BASES:
  resolveModulationTargetBase serves EVERY pool instance (the contract
  is the type's; WHICH slot a binding edits is the deviceId threaded
  through useLaneOrHostParameterBinding — entry specs and mapping rows
  parse it from the route's own target kind); the B5 amount-only
  fallback and its pins flipped to the new contract, and a base write
  to an absent instance is a refused no-op (idle-slot field send, the
  document never corrupts). Browser coverage (subway suite 8/8, 3 new):
  ghost-picker add (topology grows slot 14 on the trunk; exact-value
  edit on delay#2 rides laneSlotParamValue slot 14 with delay#1's value
  untouched), mapping creation with #2 selected stores
  lane.delay#2.delayTime and a nonzero seeded route lands in the
  compiled runtime program (zero-depth routes deliberately park outside
  the active count), remove + selection heal + a full delay pool
  disabling only that type in the picker. Two test-side traps worth
  remembering: `[data-lane-path]` alone is AMBIGUOUS (stations carry
  trunk paths too — role-qualify ghost selectors), and lane.v2's
  every-parameter-once rule silently defaults sparse seeded documents.
  Final gates (this container): units:orphans 706/706, tsc clean,
  subway 8/8, sharded desktop 219/221 whose two reds both resolved —
  the stored-pool-route test was the OLD B5 pin (updated to the T6
  contract, green solo) and rail-flick momentum stayed the established
  CPU-contention flake (green solo); browser:orphans 114/117 +1 skip
  (both reds the pre-existing container-environment failures: Avenir
  Next font metrics in the seqfx harness, renderer-WASM needing macOS
  clang); engine untouched (cmajor_rack 73/73 stands from T2); twins
  rebuilt. Deferred as always: web:poc, WebKit, iOS shell, native
  benchmarks. NEXT (M4 remainder): the default starter patch, then the
  physical phone pass on the user's device.
- **M3 — UI:** the subway-map FX graph in the rack workspace (locked
  direction above — SHIPPED as T4 for serial documents, T5 for groups),
  dynamic per-patch target pickers, instance labels through the mappings
  table.
- **M4 — Product surface:** device add/remove UX (SHIPPED as T6), the
  default starter patch, and the physical phone pass.

## 3.1 M1 engine breakdown (reconnaissance 2026-08-22, verified in cmajor/)

The engine already contains all three mechanisms M1 generalizes — nothing is
invented from scratch:

- **Runtime routing exists.** `EffectsRack` is deliberately a `processor`,
  not a `graph`: eight resident `node`s with `main()` dispatching the runtime
  order (this is how 8! reorderings work today, with crossfaded transitions).
  Lanes generalize the dispatch from "a permutation of eight" to "a topology
  tree over pool slots" — same mechanism, richer program. (Superseded in the
  build: T1/T2 shipped the utilities as MARKER SLOTS dispatched in-processor,
  not resident nodes, and the crossovers are zero-latency LR4 IIR — no
  compensated dry paths exist anywhere.)
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
