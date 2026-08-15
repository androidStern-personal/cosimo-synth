# ADR-021: Parameters own ordinary state; structured documents own structure

Status: accepted, implementation pending — 2026-08-14

## The two problems this decision separates

Cosimo had mixed together two different questions:

1. **Schema:** which controls and structured fields exist, what they are called, their
   types/ranges, and which subsystem they belong to.
2. **State:** the particular values currently being edited, saved, restored, compiled,
   or played.

`uiPatchValues.v2` tried to help with both. It was a flat saved copy of values selected
from the UI target descriptor catalog. The articulation compiler used it as the base for
un-overridden articulation parameters, and the UI/preset paths used it as an extra patch
snapshot.

That solved a real data-availability problem, but in the wrong place. It duplicated
Cmajor parameters, derived its field inventory from a catalog with a different job, and
never represented the complete accepted A/B/C control surface. A knob could therefore
be restored by the host while the articulation compiler saw a missing or default base.
Adding `uiPatchValues.v3` would make the duplicate more complete without removing the
duplicate authority.

## Decision

There is no `uiPatchValues` successor.

### Schema authorities

Each kind of schema has one owner:

| Schema | Authority | What it owns |
| --- | --- | --- |
| Product parameters and oscillator meaning | One authored build-time product-parameter catalog | Endpoint ID, type, range, default, step/discreteness, declaration order, A/B/C control identity, runtime delivery class, ART identity, and optional reference to a MOD target |
| Cmajor/TypeScript/native parameter contracts | Generated projections of that catalog | Cmajor input declarations, `OSCILLATOR_BINDING_CONTRACTS`, snapshot/validator metadata, and platform address tables; never separately authored |
| Host automation slots | The compiled order generated from the catalog | Exact order-sensitive golden ledger, including the hidden slot-0 guard |
| Factory wavetable slots | Ordered factory catalog `tableId` values | Immutable occupied 0–237 index-to-table-ID/content-digest ledger used by `wavetableSelect` |
| Modulation document | The current modulation domain parser/catalog | MSEG shapes/discrete playback policy, envelope names, routes, macro names, target identities, exact document shape |
| Articulation document | The `articulations.v4` domain parser/catalog plus referenced live parameter/MOD contracts | Slots, trigger ranges, sparse override identities/shape; scalar/envelope range and step from the referenced owner; route-amount bounds from the referenced MOD target |
| Rack structure | The `rack.v1` domain parser | Order and enabled state |

The build-time catalog is the one authored product-control definition. It expands the
single 22-control oscillator definition across A/B/C and emits the Cmajor declarations,
TypeScript binding module, and native validator metadata. A clean generation gate and
compiled-product inspection prove those projections match. The host slot ledger is an
independent frozen oracle, not another source definition.

The hard cut also retires the current competing endpoint facts rather than leaving them
beside the generator:

- `rack-parameter-descriptors.ts` consumes generated endpoint ID/type/range/default/step
  facts and retains only rack labels, grouping, and display behavior;
- `target-descriptor.ts` consumes those same generated facts and retains only UI
  presentation and domain-specific descriptive metadata. It no longer defines saved
  parameter inventory, endpoint identity, range, default, step, or connectivity;
- `modulation-targets.ts` continues to own MOD target IDs, DSP indexes, amount bounds,
  and modulation-domain behavior. For a product control that links to a MOD target, the
  control-to-target reference comes from the generated parameter projection; this file
  may not independently repeat the product endpoint's semantics or connectivity.

Those modules remain useful views of one parameter contract; none is a second authored
parameter catalog.

ART values are cross-validated rather than normalized. An ART scalar ID resolves through
the binding catalog to its live Cmajor endpoint metadata and must satisfy that endpoint's
range, discreteness, and step. An envelope override uses the modulation envelope schema;
a route-amount override uses the referenced MOD target's own amount bounds. Boundary
values are accepted exactly; out-of-range or non-step values reject before any runtime
send. Cmajor clamps remain defensive guards against corrupt transport only and can never
turn an invalid saved document into accepted state.

### Exhaustive oscillator classification

For each of A, B, and C, the authored catalog classifies the same 22 controls; generated
Cmajor and TypeScript projections expose that classification to their consumers:

| Control | Durable owner | Runtime delivery | ART | MOD |
| --- | --- | --- | --- | --- |
| `wavetableSelect` | Parameter snapshot | Indexed table scheduler only | No | No |
| `framePosition` | Parameter snapshot | Cmajor parameter | Yes | `wavetablePosition` |
| `pan` | Parameter snapshot | Cmajor parameter | Yes | `pan` |
| `octave` | Parameter snapshot | Cmajor parameter | Yes | Through aggregate `pitchSemitones` target |
| `semitone` | Parameter snapshot | Cmajor parameter | Yes | Through aggregate `pitchSemitones` target |
| `fineCents` | Parameter snapshot | Cmajor parameter | Yes | Through aggregate `pitchSemitones` target |
| `phase` | Parameter snapshot | Cmajor parameter | Yes | No |
| `phaseRandom` | Parameter snapshot | Cmajor parameter | Yes | No |
| `retrigger` | Parameter snapshot | Cmajor parameter | Yes | No |
| `volumeDb` | Parameter snapshot | Cmajor parameter | Yes | `ampGainDb` |
| `mute` | Parameter snapshot | Cmajor parameter | Yes | No |
| `solo` | Parameter snapshot | Cmajor parameter | Yes | No |
| `warpMode` | Parameter snapshot | Cmajor parameter | Yes | No |
| `warpAmount` | Parameter snapshot | Cmajor parameter | Yes | `warpAmount` |
| `unisonVoices` | Parameter snapshot | Cmajor parameter | Yes | No |
| `unisonDetune` | Parameter snapshot | Cmajor parameter | Yes | `unisonDetune` |
| `unisonBlend` | Parameter snapshot | Cmajor parameter | Yes | `unisonBlend` |
| `unisonWidth` | Parameter snapshot | Cmajor parameter | Yes | `unisonWidth` |
| `unisonDetuneMode` | Parameter snapshot | Cmajor parameter | Yes | No |
| `unisonStackMode` | Parameter snapshot | Cmajor parameter | Yes | No |
| `unisonWavetablePositionSpread` | Parameter snapshot | Cmajor parameter | Yes | `unisonWavetablePositionSpread` |
| `unisonWarpSpread` | Parameter snapshot | Cmajor parameter | Yes | `unisonWarpSpread` |

The MOD column describes the existing ten-target oscillator modulation subset. It does
not turn the MOD route amount into a second base value. Shared filter mode/cutoff/Q and
the three MSEG morph parameters are also parameter-owned ART bases. Envelope values are
modulation-document-owned ART bases. MSEG shapes and playback remain modulation state,
but are not articulation bases or articulation-compile dependencies.

This table explains the accepted catalog; the generator expands one 22-control
definition to A/B/C rather than copying 66 authored definitions. Generated Cmajor,
TypeScript, and native projections must not re-author those identities.

The existing canonical plugin-state contract builder derives a hash from the live
Cmajor parameter metadata plus the required structured-document key/version pairs.
That hash is a drift detector, not another hand-maintained schema. It does not inspect
the internal shape of a structured parser. Any parser-shape change must therefore bump
that document's version, and an independent golden contract test enforces the version
discipline. A silent parser-shape change without a version bump is a release failure.

Parameter schema and host automation order have deliberately separate drift checks:

- the **state contract hash** is keyed by endpoint ID and remains insensitive to the
  order in which a platform enumerates endpoints. It detects endpoint, type, range,
  default, discreteness, and structured key/version drift;
- the **host slot ledger** is an order-sensitive test oracle, not runtime schema. At the hard cut it freezes the exact new
  Cmajor declaration order, including `hostSlot0Guard` in slot 0 even though that hidden
  guard is not a saved user value. Later reorder/removal fails the ledger gate rather
  than silently redirecting DAW automation.

The ledger is compared against the parameters exposed by compiled VST3 and AUv3 products,
not merely the Cmajor source text. The hidden `hostSlot0Guard` remains first for the host
but is excluded from the logical user snapshot (or explicitly normalized away by the
native container); this behavior is tested rather than implied.

Putting declaration order into the saved-state hash would incorrectly reject a keyed
snapshot merely because two hosts enumerate the same endpoints differently. Omitting
the separate ledger would fail to protect DAW automation. Both checks are required.

`wavetableSelect` is numeric because it is host-automatable. Its meaning is protected by
a second test-only compatibility ledger: every existing factory table index must keep
the same stable `tableId` and canonical source/derived content digests. The hard-cut
parameter range is exactly the occupied immutable slots 0–237, so host automation/state
cannot contain an unassigned in-range value. Future factory growth needs a new selector
endpoint/contract rather than changing this endpoint's range and reinterpreting old
automation. Reorder, insertion,
replacement, removal, or byte replacement under an existing ID fails the gate and
requires a new ID/contract.
The snapshot does not store a duplicate table ID. Table bytes/cache remain derived
resources, while the immutable occupied mapping keeps a saved number from silently selecting a
different sound. Out-of-range 238/255 state rejects at strict preflight; supported host
automation cannot express it.

### State authorities

| State | Runtime authority | Durable representation |
| --- | --- | --- |
| Ordinary synth/effect controls | Current Cmajor parameter values | Host/AUv3 parameter state; the same keyed parameter snapshot in browser and synth presets |
| A/B/C wavetable choice | Indexed scheduler's last accepted value/ID; each `osc*WavetableSelect` parameter is its bounded request and durable projection | Numeric 0–237 parameter snapshot; immutable factory slots/content digests preserve its table-ID/sound meaning; table audio/cache contents are not saved |
| Modulation structure | Last strictly accepted modulation document | Hard-cut `modulation.v6` |
| Articulations | Last strictly accepted `articulations.v4` document | `articulations.v4` |
| Rack structure | Last strictly accepted `rack.v1` document | `rack.v1` |
| Active tables/program/images/voices | Cmajor and worker derived runtime state | Not independently saved |
| Selected oscillator tab | React presentation state | Not saved with the patch |

Two current durable keys are deleted rather than carried into this model:

- `uiMappings.v1` stores inert UI-only mappings for controls with no runtime modulation
  destination. The hard cut removes those unsupported mapping affordances rather than
  pretending they are sound state;
- `articulationTriggerConfig.v1` duplicates trigger ranges already owned by
  `articulations.v4`.

The fixed trigger configuration needed by the native MIDI bridge is derived from the
accepted ART epoch. Every ART commit emits a non-destructive correlated
`ArticulationCommitAck { dspSessionId, artEpoch, triggerConfig }`. Desktop and AUv3
wrappers atomically install that trigger image and epoch; existing voices and rack tails
continue untouched. Every native-originated `articulationNoteMeta` carries the installed
epoch, and Cmajor discards a note whose epoch does not equal the currently committed ART
epoch. Stale session/epoch events are ignored.

Restore readiness is a separate, destructive protocol used only for a whole-product
restore. After every parameter/rack/MOD/ART/table prerequisite is ready and the matching
ART acknowledgement is installed, the coordinator sends one terminal
`RestoreFence { dspSessionId, restoreId, artEpoch, parameterImageHash,
expectedRackOrder, expectedRackEnableMask }`. Cmajor processes it after every earlier
input sent to that performer, verifies the session, ART epoch, and canonical float32
parameter-image hash, and waits until the rack has completed its transition to the exact
expected order/enable state. It then resets every
voice/filter/envelope/note latch and every stateful rack history
(delay/tank/feedback/filter/modulation) from the prior sound, then emits correlated
`RestoreApplied`. Restore base parameters use zero ramp, so no ramp timer participates in
readiness. No ordinary live ART edit uses this reset or gate-opening protocol. Both paths
work with the editor closed and neither saves a second trigger document or depends on a
WebView callback.

`parameterImageHash` has one frozen cross-platform representation. It is unsigned
FNV-1a-64 (offset basis `14695981039346656037`, prime `1099511628211`, arithmetic modulo
`2^64`) transported as low/high 32-bit bit-pattern words. Cmajor carries each half in an
`int32`; consumers interpret those raw bits as unsigned. Its input is every logical product
parameter in the independent frozen compiled host-slot order, excluding
`hostSlot0Guard` and including the three accepted wavetable selectors. Each finite
engine-unit value is converted once to IEEE-754 binary32, `-0` is canonicalized to `+0`,
and its four raw bytes are hashed least-significant byte first. NaN and infinity reject
preflight and never enter the hash. This is a causal integrity fingerprint, not a
security primitive.

Cmajor must not implement the modulo operation with an overflowing signed `int64`
multiply. Its hash state is two nonnegative 32-bit limbs stored in `int64` values. After
XORing each byte into the low limb, multiplication by
`0x00000100_000001B3` is performed as:

1. `lowProduct = low * 0x1B3`, `nextLow = lowProduct & 4294967295L`,
   `carry = lowProduct >> 32`;
2. `nextHigh = (high * 0x1B3 + low * 0x100 + carry) & 4294967295L`.

Every intermediate is nonnegative and below signed `int64` overflow. A source/compiled
gate rejects a direct signed-64 FNV multiply in the Cmajor path, and edge-limb vectors
must agree in the interpreter, native JIT, generated C++, and Wasm before the actual
carrier gates run.

The conformance oracle does not import the product catalog, serializer, generated hash
projection, runtime monitor, or production hash helper. It combines the independent
host-slot ledger with a hand-authored complete FLOW-A parameter scenario, freezes one
literal low/high result, and implements the byte loop locally. Removing any slot or
swapping any adjacent pair must miss that literal. Test-only actual-product builds also
corrupt the fence hash after every parameter send succeeds (and separately perturb one
DSP-side value before the fence); VST3, AUv3, and packaged WebAudio must withhold
`RestoreApplied`, durability promotion, and readiness and report a parameter-hash phase
failure. This prevents the wrapper, Cmajor, and test harness from sharing the same
omission or merely echoing the supplied hash.

The UI may cache parameter values for display and the snapshot adapter may keep a
durability projection after successful sends. Those caches are projections of the
authorities above and must never be persisted as a second value document or treated as
independent desired state. MOD/ART compilers consume their owning structured documents
and the live schema contract, not a duplicate parameter-value bag.

For the shipping synth, the structured sound-key ledger after the cut is exact:
`modulation.v6`, `articulations.v4`, and `rack.v1`. `effects.presets.v2` is the one
separate auxiliary library key. Source and generated-output gates fail if another
sound-affecting stored key appears. The retired synth keys `uiPatchValues.v2`,
`uiMappings.v1`, `articulationTriggerConfig.v1`, `mseg1.shape`, `mseg1.playback`, and
`mseg1.depth` are absent from the shipping synth graph and generated bundle.

Standalone effect products such as SeqFX and effect-lab snapshot banks have their own
plugin contracts. This synth hard cut neither imports those keys into the synth snapshot
nor deletes a separately shipping effect feature. The boundary is verified from actual
product entry graphs rather than a repository-wide string ban.

### Continuous MSEG and envelope values have one owner

`modulation.v5` stored MSEG duration and envelope ADSR values inside its structured
document. That prevented those controls from using the same host-automation and live
modulation path as ordinary synth parameters without creating two competing copies.
The hard cut advances the document to `modulation.v6` and removes those continuous
values from it.

- MSEG Morph and Time are ordinary host-automatable parameters and modulation destinations.
- Envelope Attack, Decay, Sustain, and Release are ordinary host-automatable parameters and modulation destinations.
- MSEG A/B shapes and discrete playback policy remain structured modulation state.
- Envelope names, routes, and macro display names remain structured modulation state.
- Macro values remain host parameters; macro names remain document fields.
- The routing domain is 13 sources, 50 voice targets, 36 rack targets, and 1118 legal pairs.

`modulation.v5` is rejected after the cut; no dual read or field reconciliation is
added. This closes the last known ordinary-parameter/document overlap rather than merely
removing `uiPatchValues`.

### Exhaustive non-oscillator classification

The rest of the patch follows the same ownership rule:

| Values | Durable owner |
| --- | --- |
| Voice/play mode, glide, macro values, MSEG Morph/Time, envelope ADSR, shared filter controls, and every effect knob | Parameter snapshot |
| MSEG A/B shapes and discrete playback policy, envelope names, modulation routes, source settings, and macro display names | `modulation.v6` |
| Sparse selector definitions, trigger ranges, parameter overrides, and route-amount overrides | `articulations.v4` |
| Effect order and effect enabled state | `rack.v1` |
| Active table data, compiled MOD program, compiled ART images, effective values, and sounding voices | Derived runtime only; never saved independently |

This inventory is exhaustive for the hard cut. A new field must be assigned to exactly
one row before it can be added; no UI cache or descriptor automatically becomes saved
state.

## One snapshot envelope

Browser durability and synth presets reuse/deepen the existing plugin-state contract and
snapshot machinery. They do not introduce a second synth-only schema.

The current implementation lives under effect-oriented names, but its contract hash,
parameter capture, strict normalization, stored-state adapters, and atomic apply rules
are already generic. Reuse or carefully generalize that implementation; do not copy it
into a new synth-only snapshot stack.

A complete **sound snapshot** contains:

- the exact canonical contract (or its exact hash plus the data needed to diagnose a
  mismatch);
- a complete parameter map keyed by Cmajor endpoint ID;
- the required structured documents in their own formats.

The user preset library currently stored as `effects.presets.v2` is auxiliary durable
data, not part of the current sound. Native and browser outer containers may preserve it
in a separate auxiliary section, but it is excluded from the sound contract hash,
restore readiness, and audio comparison. A saved `cosimo.effectPreset` does not embed the
whole library inside itself. This avoids recursive snapshots and prevents preset-library
corruption from changing the sound being restored.

Snapshot parameter values are always the Cmajor endpoint values in engine units. A UI
adapter may normalize a control for display, but normalized 0..1 UI values are never
stored as the parameter snapshot and are never converted a second time before runtime
delivery or note-start inheritance. The live endpoint contract supplies the valid
engine-unit range.

The native desktop and AUv3 state wrappers save the same logical contents even if their
outer binary container is platform-owned. They record/validate the same contract hash.
The VST3 chunk and AUv3 `fullState` paths are part of the contract; an open editor or UI
cache is not required for save or restore.

The existing `cosimo.effectPreset` v2 envelope remains the generic preset container;
its embedded contract hash and nested document versions make pre-cut synth presets fail
closed without inventing another preset format. Browser durability hard-cuts from
`cosimo.web.patch-state.v1` (stored-state values only) to
`cosimo.web.patch-state.v2`, whose `sound` member is the complete logical snapshot above
and whose separate `auxiliary` member may contain `effects.presets.v2`. Native outer
containers keep their existing platform ValueTree/dictionary carrier; semantic
separation is enforced by excluding the auxiliary key from the sound contract and
readiness rather than inventing literal nested native sections. An individual
`cosimo.effectPreset` contains only its one sound snapshot, never the auxiliary preset
library.

There is one deliberately narrow transition for user-created auxiliary data. On first
post-cut load, browser and native outer adapters may strictly parse and extract only a
valid `effects.presets.v2` value from the pre-cut carrier. They never hydrate any old
parameter, MOD, ART, rack, table, mapping, or trigger state. The extraction is attempted
idempotently whenever the old carrier is still present and reports success/failure through
in-memory diagnostics rather than another durable marker. A valid extracted browser
library is first written inside `cosimo.web.patch-state.v2` beside an accepted/default
sound envelope; only a successful destination `setItem` permits removal of the old key.
If that write fails or the page exits first, the old key remains and the next startup
retries without duplicating presets. This is
auxiliary preservation, not sound-state migration; all pre-cut sound remains rejected.

Malformed auxiliary preset-library data retains the last valid library (or an empty
library on a genuinely new installation) and reports its own error. It never blocks or
alters sound readiness.

Contract mismatch, unknown/missing parameter, wrong type/range, malformed structured
state, or unsupported schema version rejects the whole cold snapshot or preset before
any part is applied. There is no best-effort field copy, alias, default filling, or
automatic migration. A genuinely missing snapshot creates a new patch from current
defaults. Browser storage failure remains non-fatal, but corrupt or mismatched browser
data cannot partially mutate the patch.

The implementation differs only where the platform supplies the outer carrier:

- Browser startup reads and preflights its complete snapshot before the UI exists or the
  suspended AudioContext starts. Browser preset application preflights the same contract.
  Each valid apply emits one synchronous JavaScript command burst:
  `ProductRestoreBegin`, the complete zero-ramp parameter map (including the three table
  selectors), and exactly `modulation.v6`, `articulations.v4`, and `rack.v1`. There is no
  second table-intent field or send. The generated delivery class routes ordinary values
  directly and each selector value to its scheduler; selector activation later commits
  its Cmajor/host/durability projection. MessagePort order prevents later UI work from
  interleaving inside that base burst. After the asynchronous table/rack/MOD/ART owners
  finish, the coordinator sends the correlated `RestoreFence`. Invalid input emits
  nothing. There is no delayed browser snapshot or per-parameter listener acknowledgement
  protocol.
- Hosted desktop/iPhone synth presets send one validated envelope to the native wrapper;
  they do not emit individual WebView parameter writes. This uses the same native restore
  path as VST3 chunks and AUv3 `fullState`.
- Native wrappers classify the outer carrier before semantic restore ingress. An empty or
  non-Cmajor startup probe such as Ableton's device-open query is ignored: it does not
  close a gate or mutate the already initialized patch. A carrier with the Cmajor product
  signature but a wrong hard-cut contract is a real restore attempt and fails closed.
  New/default patch construction itself runs the normal gated readiness lifecycle.
- Native restore request first acquires parameter ingress, starts the fixed automation
  overlay, and copies the carrier without mutating or gating the accepted performer. It
  validates the complete envelope; invalid input discards the candidate while the prior
  performer and concurrent valid automation continue. For a valid candidate, the wrapper
  re-enters ingress, closes its outer gate, mints `restoreId`, and begins the restore. It
  builds a fresh internally gated performer and applies the complete zero-ramp base
  through a return-bearing initializer before publication. The implementation may not
  rely on the current void `LoadParams.applyParameterValues` or generic
  `setFullStoredState`, because those paths discard individual delivery failures. The
  validated structured-state projection replaces rather than merges the prior projection.
  The state-byte hash suppression is deleted, so restoring the same chunk after divergence
  works and a failed attempt may be retried.
- DAW automation can arrive while that performer is being rebuilt. Under canonical
  ingress, the wrapper first performs the checked write to the old performer; only after
  success does it update the cached value and the fixed overlay, before releasing the
  ingress lock. A failed send advances neither state. At the short wrapper publication
  boundary it holds the same parameter
  ingress lock, applies the fixed overlay to the replacement with checked writes, then
  publishes the replacement. Later writes target the replacement directly. A later restore
  supersedes an earlier `restoreId`. This is the only rebuild-ordering state; there are no
  parameter listener stamps, watermarks, or callback acknowledgements.

All native product parameter mutations use one canonical wrapper ingress: VST3/AUv3 host
automation and PatchConnection/WebView parameter writes may not call the generic Cmajor
setter directly. The ingress uses one bounded shared critical section to linearize a
successful parameter enqueue with performer publication, fence cutoff, and durability
classification. It may briefly block a host parameter call—including one made on the
audio thread—only at those two fixed cutovers. No allocation, I/O, listener callback,
serialization, or unbounded loop occurs while held, and a product deadline test covers
continuous automation. Cached host/current values commit only after a return-bearing DSP
enqueue succeeds; failure leaves the accepted value unchanged so retrying the same value
cannot become a false no-op.

The generated runtime-delivery class is enforced at this ingress. Ordinary parameters
commit after the checked direct send. A `wavetableSelect` write is only a scheduler
request: it does not update the Cmajor/host current value or durability until that exact
table identity becomes active. Selector requests arriving after the restore snapshot's
three requests are held as the scheduler's one latest live request per oscillator; they
do not delay the current restore fence and run after `RestoreApplied`. Failure retains the
prior accepted selector. This is scheduler-owned bounded work, not a second table-intent
state model.

While the valid restore gate is closed and before the fence cutoff, every parameter write
to the target performer uses `rampFrames = 0`, including the rebuild overlay and later
host/WebView automation. The prior performer remains live during candidate preflight, so
writes to it retain their normal declared ramps. Writes ordered after the fence also
retain their normal ramps and are excluded from the fence-time image. This makes the
pre-fence target vector equal to Cmajor's instantaneous image without a ramp timer; normal
live smoothing resumes automatically after the cutoff.

After the base performer/burst is installed, the existing table, rack, MOD, and ART
owners complete against that DSP session. Each keeps its own accepted identity; only MOD
and ART share the `artEpoch` needed for atomic route-layout activation. At terminal
readiness the native wrapper briefly holds parameter ingress, captures the hash of the
complete successfully delivered pending parameter vector, and enqueues
`RestoreFence { dspSessionId, restoreId, artEpoch, parameterImageHash,
expectedRackOrder, expectedRackEnableMask }`. Writes after
that cutoff enter behind the fence. A successful later ordinary write continues updating
the same pending vector and is never resent to DSP; the stored cutoff hash remains the
fence witness. Selector requests remain scheduler-pending until activation. Cmajor hashes
the canonical float32 parameter image when it
processes the fence and waits for the exact expected rack order/enable state to finish its
transition. Matching `RestoreApplied` proves the fence crossed the target performer FIFO
with that exact parameter image and committed rack; enqueue failure, hash/rack mismatch,
or renderer/session replacement withholds or invalidates it. All restore-base values use
zero ramp, so readiness needs no parameter-ramp timer.

Gated MIDI is not queued. Closing the gate clears native held-note/note-metadata state,
discards incoming MIDI, continues processing the patch with an empty MIDI buffer so
installs and acknowledgements can progress, and zeros the resulting audio. Before the
matching readiness event, Cmajor performs the correlated full DSP transient reset described
above, so a voice that existed before the gate cannot reappear when it opens even if its
note-off was discarded. Nothing is replayed when readiness opens; the host must send a
fresh note. This prevents delayed or stuck notes across a restore boundary.

This is the atomicity users can hear and depend on. Tests must not claim stronger native
rollback semantics than the host APIs actually provide.

This is an intentional compatibility break. Future schema changes must either supply an
explicit reviewed migration into a new exact contract or reject the old snapshot.

## Component lifecycle

### 1. Cmajor parameter surface

Inputs:

- host automation, UI edits, preset restore, browser restore.

State:

- current value of every input parameter, including all 22 controls for A/B/C.

Outputs:

- parameter observations used by UI display and diagnostics;
- current values consumed by the audio graph.

It does not write `uiPatchValues` or any other copy of its values.

### 2. Host/browser/preset snapshot adapter

Inputs:

- live Cmajor endpoint contract and values;
- the current MOD, ART, and rack documents.

State:

- the last fully accepted logical sound envelope eligible for durability;
- at most one pending restore envelope;
- on native hosts only, one fixed latest-value-per-endpoint automation overlay while a
  fresh performer is being rebuilt.

Outputs:

- after full validation, either one synchronous browser command burst or one native
  wrapper restore batch, followed by the existing table/MOD/ART/rack protocols.

Desktop plugin state, AUv3 state, browser local durability, and synth presets use the
same logical contract. Browser persistence must no longer save only stored-state keys.
Auxiliary `effects.presets.v2` durability stays outside that sound contract and never
participates in readiness.

This accepted envelope is a durability transaction record, not another sound authority:
it can serialize state but can never drive Cmajor, compile MOD/ART, or select a table.
During a restore, every save path (`getState`, AUv3 `fullState`, browser persistence, and
preset save) continues returning the prior fully accepted envelope. There is no
intermediate base-ready durability state: one terminal readiness event promotes the
validated base plus every successfully delivered ordinary edit through promotion as a
single result and opens the gate. Rejection,
transport failure, or session replacement preserves the prior envelope. Outside restore,
the projection advances only when the owning runtime boundary accepts the change:
successful parameter enqueue, rack acceptance, correlated MOD/ART completion, or accepted
table activation. Native parameter ingress and product connection sends update this
projection at their existing owned boundaries; they are not inferred from asynchronous
listener echoes. A partial runtime observation can therefore never poison the next save.

Browser LocalStorage is only durability: writes are coalesced after the edit burst and
flushed on the existing page-lifecycle seam. A knob drag must not synchronously serialize
the complete snapshot or call LocalStorage at audio/control rate. Runtime parameter
delivery remains immediate and independent of a durability failure.

### 3. Indexed table scheduler

Inputs:

- the three wavetable-selection values observed at their canonical parameter ingress,
  including restore-map entries; there is no second table-intent document or event;
- resource catalog/data;
- runtime table requests, acknowledgements, failures, and DSP session changes.

State:

- one shared decoded-data cache;
- independent desired/active/failure frontiers for A/B/C;
- one serialized staging transfer because the engine exposes one staging slot.

Outputs:

- indexed table load/abort/frame events;
- active/loading/failure status per oscillator, including the stable requested/active
  `tableId` used to prove that numeric selection, decoded data, transfer, and DSP state
  all refer to the same factory asset.

The selection parameter is durable state; the loaded table and cache are derived state.
The snapshot/restore coordinator never republishes table selection as a synchronous
patch-base endpoint. Its declared parameter range is exactly 0–237, so normal host
automation cannot express an unassigned selector. A raw snapshot containing 238/255
fails strict preflight before mutation. A missing or corrupt resource within the occupied
ledger retains the last accepted table, keeps readiness closed, and cannot advance the
accepted durable envelope. There is no asynchronous corrective-write race with a
synchronous VST3/AUv3 state capture.

### 4. Modulation compiler and install lane

Inputs:

- strictly parsed `modulation.v6` (MSEG shapes/discrete playback policy, envelope names, routes, macro names);
- the current DSP session.

State:

- last-valid document, compiled sparse program, preallocated active/staging banks, and
  correlated delivery frontier.

Outputs:

- fixed-size/count-bounded Cmajor program events followed by a correlated completion or
  rejection.

An invalid live MOD document retains the prior valid MOD state and does not poison later
valid parameter or ART edits.

### 5. Articulation compiler and install lane

Inputs:

- strictly parsed sparse `articulations.v4`;
- the last accepted MOD route identities;
- the referenced live endpoint/envelope/target value contracts;
- the current DSP session.

State:

- last-valid sparse bank;
- preallocated active/staging override images;
- correlated delivery frontier.

Outputs:

- fixed-size per-selector override values plus fixed-size presence bits;
- route-amount cells using the existing inheritance sentinel.

The durable bank remains sparse: absent keys inherit. Compilation happens off the audio
thread, but it does not copy the current parameter base into each selector. A scalar or
envelope override is represented by a value and a fixed presence bit. At note start,
Cmajor chooses the explicit override when present and otherwise reads the current Cmajor
parameter or installed MOD envelope value, then latches the result for that note. Route
amount cells retain the existing inheritance sentinel. Ordinary parameter edits, MSEG
shape/playback edits, envelope-base edits, and amount-only MOD edits therefore do zero
ART compilation or upload. Only ART document changes, MOD route-identity/layout changes,
or a DSP-session replay rebuild the affected fixed images.

Strict parsing and cross-validation complete before compilation or publication. Finite
but invalid values such as a fractional discrete mode, an excessive unison count, or a
route amount outside that target's bounds reject the ART document and retain the prior
accepted bank. No later Cmajor clamp is treated as state repair.

### 6. Cmajor engine

Inputs:

- current parameter values;
- indexed packed tables;
- fixed modulation programs;
- fixed articulation override images and presence bits;
- correlated restore-begin and terminal-readiness events;
- MIDI/MPE events.

State:

- preallocated tables, program arrays, articulation arrays, per-voice latches, and
  stateful rack histories.

Outputs:

- audio, effective-state monitors, and correlated runtime acknowledgements.

The audio callback parses no JSON, traverses no sparse object graph, allocates no memory,
and performs no persistence. A note start reads bounded preallocated data and latches its
values; a sounding note is not mutated by later base or articulation edits. The bounded
note-start work adds only fixed scalar presence choices alongside the existing fixed
650-cell route latch. No dynamic collection or unbounded scan is introduced.
`ProductRestoreBegin` closes the internal note/output gate in event order. Only the
terminal readiness request may clear all transient sound state and reopen it; ordinary
parameter or preset code cannot bypass that lifecycle.

### 7. Product restore coordinator

The table scheduler, rack owner, MOD install lane, and ART install lane remain separate
deep modules with their own protocols and tests. One small product-level instantiation
owner starts them and maps their accepted identities into the current
`{ restoreId, dspSessionId }` readiness join. Tables and rack keep their existing
identities; only matched MOD/ART layout activation shares `artEpoch`. The owner prevents
duplicate listeners or publishers but does not absorb caches, compilers, retry logic, or
transport state into a monolithic worker service.

## Restore ordering

### Cold host/browser restore and preset application

1. Parse the complete logical envelope against the live contract before mutation. Browser
   and preset code uses the canonical TypeScript parser. Native carriers use the generated
   validator derived from that same contract, not a hand-maintained second schema.
2. Browser/preset paths freeze the prior accepted durability envelope after successful
   preflight, immediately before `ProductRestoreBegin`. Native restore request instead
   starts the fixed automation overlay while it copies/preflights the candidate, without
   mutating, gating, or freezing the prior performer; successful automation during this
   interval remains part of the accepted prior sound. A rejected candidate discards the
   overlay and leaves that sound live. For a valid candidate, the wrapper atomically
   freezes the then-current prior envelope, closes its outer gate under the same ingress,
   mints `restoreId`, and constructs a replacement performer born internally gated. No
   validation/build interval can lose a concurrent host write.
3. Apply the base once. Browser sends the complete zero-ramp parameter map—including the
   three selectors—then exactly the MOD, ART, and rack documents in one synchronous
   command burst. A selector's parameter ingress is the table scheduler's sole request;
   no second table-intent event exists. Native builds a fresh performer and uses a new
   return-bearing complete-base initializer rather than the current void `LoadParams` or
   generic full-state helpers. It applies every direct parameter with zero ramp and checks
   every result; the three selector entries enter the scheduler and commit their parameter
   projections only when their tables activate. It authoritatively replaces the structured
   projection before publishing. Missing required keys reject preflight; unknown or
   retired sound keys from an older patch do not survive.
4. At the short native performer-publication boundary, hold parameter ingress, apply the
   latest fixed overlay to the replacement with checked zero-ramp writes, publish it, and
   release. Later pre-fence writes target the replacement directly with zero ramp; writes
   after fence cutoff use their normal declared ramp. The fixed endpoint count bounds this
   operation, and continuous automation cannot starve it.
5. Apply rack desired state through its existing owner. The three selector entries already
   sent through parameter ingress wake the indexed scheduler; await those exact active
   table identities without republishing them. Compile/stage MOD, then compile/stage ART
   against that exact route layout. Atomically commit the matched MOD+ART epoch and await the
   non-destructive `ArticulationCommitAck` so native trigger configuration and `artEpoch`
   agree. The independent owners retain their current retry/session protocols.
6. While the product gate is closed, structure-changing UI commands are disabled rather
   than accumulated in a second restore transaction. Host parameter automation remains
   accepted through the canonical native ingress: the rebuild overlay applies only until
   publication, and one fixed pending parameter vector preserves later ordering.
   After readiness, ordinary live edits resume through their existing owners.
7. Once the target DSP session, rack, all three active tables, matched MOD/ART epoch, and
   native trigger epoch agree, native briefly holds the same parameter ingress lock. It
   incorporates every successful pre-fence write into the pending parameter vector,
   computes its canonical float32 hash, and enqueues
   `RestoreFence { dspSessionId, restoreId, artEpoch, parameterImageHash,
   expectedRackOrder, expectedRackEnableMask }`; the fixed payload contains the exact
   desired rack state, not an uncorrelated monitor generation. It marks the cutoff and
   releases. Browser performs the same classification on its single event loop. Later
   successful ordinary writes enter behind the fence and continue updating that same
   pending vector without being resent; selectors remain scheduler-pending until
   activation. Cmajor
   processes the fence after earlier inputs, verifies the
   session/epoch/hash, defers completion until the rack fade commits the expected
   order/enable state, resets voices, latches, filter/envelope histories, and every
   stateful rack buffer, then emits correlated `RestoreApplied`. No listener callback or
   serial-only echo substitutes for this DSP boundary. Restore parameters used zero ramp,
   so no ramp-settle timer is required.
8. The `RestoreApplied` handler enters the same native ingress lock, validates the
   correlation and stored cutoff hash, promotes the latest contents of the single
   preallocated pending parameter vector by buffer/generation swap, and opens product
   MIDI/audio. Selector requests remain scheduler-pending and update accepted durability
   only on later matching activation; they are neither promoted here nor resent. The handler performs no
   serialization or allocation while held; the immutable envelope is materialized outside
   the lock from that stable generation. A later write advances normal live durability.
   Enqueue failure, invalid state, superseding restore, or DSP-session replacement
   preserves the prior accepted envelope and cannot open the gate. Every platform enforces
   this even when a DAW begins playback during restore.

`{ restoreId, dspSessionId }` identifies the outer restore. The coordinator records the
expected accepted identity from each independent owner. Only MOD and ART share the
`artEpoch` required to commit a route layout with its dependent overrides. A stale MOD
acknowledgement can never authorize ART compiled from a newer or older snapshot, and a
note can never observe a new route layout beside an old ART route image.

Parameter listeners remain display/diagnostic observations only. They are never treated
as restore acknowledgements. Native return-bearing base/overlay sends plus the complete
parameter hash witnessed by the target-performer `RestoreFence` prove initialization and
ordering. Browser MessagePort FIFO plus the same hash/fence proves its synchronous burst.
Negative tests force an ordinary base enqueue failure, independently corrupted parameter
hash or DSP-only value, unfinished rack transition, and performer/session replacement to
prove the gate stays closed.

### Live edits

- A parameter edit goes directly to Cmajor. It never republishes ART; future notes read
  the new live base through the fixed presence choice, while sounding notes keep their
  latch.
- A table-selection edit wakes only that oscillator's scheduler. The parameter ingress is
  a request; Cmajor/host current value and durable projection advance only after matching
  table activation. A live request queued during restore runs after the current
  `RestoreApplied` and cannot delay or contaminate its fence.
- A MOD edit that leaves route identity/layout unchanged may commit MOD alone; envelope,
  amount, polarity, enabled, name, and MSEG shape/playback changes do not rebuild ART. A
  route identity/layout change stages matched MOD and ART banks and activates them with
  one Cmajor epoch commit. An MSEG morph knob is an ordinary parameter edit.
- An ART-only edit stages affected fixed override/presence images against the currently
  active MOD route epoch, commits ART atomically for future notes, and refreshes the
  derived trigger configuration through the non-destructive `ArticulationCommitAck` from
  that committed epoch. Existing voices and charged rack tails continue.
  Until the native wrapper installs the correlated trigger arrays and `artEpoch`, its
  note metadata carries the older epoch and Cmajor discards those new notes rather than
  allowing a classification/install race or adding a second gate protocol.
- Invalid live state retains last-valid state in that domain. The invalid raw document is
  not written to durable storage. Valid unrelated domains continue to advance, and a
  subsequent save/restart contains the last accepted document rather than the rejected
  input.
- Outside restore, a parameter edit advances the durability projection only after its
  runtime enqueue succeeds. Browser and preset restore apply their validated base in one
  synchronous JavaScript command burst, so another UI edit cannot interleave inside that
  burst. Parameter edits that occur while its asynchronous table/MOD/ART prerequisites
  finish are later FIFO commands: they reach Cmajor directly and update the pending
  durability projection without resending the base.
- Native VST3/AUv3 restore has one additional bounded case: DAW automation can arrive
  while a replacement performer is being built. After each checked send succeeds, the
  wrapper records only the latest value per fixed endpoint before releasing ingress. At
  the short wrapper publication boundary it applies
  that fixed overlay to the replacement performer and swaps performers atomically with
  respect to parameter ingress; subsequent automation targets the replacement directly.
  At terminal cutoff the same ingress orders successful parameter enqueues, durability
  classification, and the fence; post-fence values continue updating the same pending
  vector without being resent. No parameter-listener callback, watermark, or general-purpose
  transaction queue is involved.
- Removing a MOD route removes that route identity from the in-memory ART projection so
  an old override cannot resurrect if the ID is reused. Producers persist a coherent ART
  prune and MOD removal; cold snapshots remain strictly cross-validated. Rapid remove,
  re-add, and same-ID reuse cannot expose an intermediate mixed MOD/ART bank because only
  matched staging epochs can commit.

### Stop, restart, and DSP-session replacement

Queued callbacks from a stopped or prior start epoch are ignored. A new DSP session
invalidates delivery frontiers, re-observes parameters, replays MOD then ART and the
derived trigger configuration, and independently restarts only the table transfers that
need it. Readiness remains closed until all of those frontiers agree on the new session.
No saved document or UI cache becomes authoritative merely because runtime state was
lost.

## Real-time and performance decision

The duplicate `uiPatchValues` document is not required by Cmajor's allocation limits.
Those limits justify a fixed runtime image, not duplicate durable parameter state or a
copy of every inherited scalar base.

Cosimo keeps this split:

- sparse, human-meaningful MOD/ART documents outside the audio thread;
- deterministic, fixed-capacity MOD programs and ART override values/presence bits at the
  Cmajor seam;
- preallocated arrays and bounded active prefixes inside Cmajor.

The fixed presence protocol is chosen over complete inherited scalar images because the
complete-image model has a correctness race: a parameter can already be live in Cmajor
while the worker is still rebuilding and acknowledging selector images, so a note may
latch the old base. Presence bits make Cmajor choose from state it already owns at the
single note-start boundary. This does not move sparse JSON into Cmajor: the worker still
parses the sparse document, and Cmajor receives only bounded arrays of values and bits.

Performance acceptance is behavioral, not speculative:

- non-articulable knob drags perform no ART compilation;
- every base-parameter drag performs no ART compilation;
- amount/polarity/enabled/name, envelope, and MSEG shape/playback MOD edits perform no ART
  compilation when route identity/layout is unchanged;
- note-start presence resolution stays within the established callback deadline and adds
  no allocation or unbounded work;
- a browser parameter drag updates runtime immediately but coalesces full-snapshot
  serialization/durability rather than writing LocalStorage per event;
- no audio callback allocation or unbounded loop is introduced;
- outer product benchmarks run only after the one-renderer hard cut.

## Consequences

- Deleting `uiPatchValues` removes saved duplication but requires browser persistence and
  the restore coordinator to consume real Cmajor parameter state correctly.
- Removing the normalized UI bag also removes an ambiguous unit conversion: persistence,
  restore, live bases, and explicit ART override values use endpoint/engine units;
  normalization remains a presentation concern only.
- Schema drift becomes explicit and fail-closed through the existing canonical contract
  hash rather than silently changing a derived flat bag; an independent order-sensitive
  ledger protects host automation slots.
- One authored build-time parameter catalog now has generated Cmajor, TypeScript, and
  native projections. This adds a deterministic generation step but removes the more
  dangerous long-term cost of reconciling handwritten endpoint/binding lists.
- generated `OSCILLATOR_BINDING_CONTRACTS` remains the TypeScript semantic address book;
  it is neither separately authored nor a second parameter-value store.
- The held RT-02 branch is implementation evidence, not an accepted state model. Its
  correlated MOD/ART lanes may be reconciled only after all patch-base storage and
  publication behavior is removed.
- Route-layout changes require preallocated matched MOD/ART staging and one atomic Cmajor
  epoch commit; sequentially activating the two accepted lanes is not sufficient.
- Preserving `effects.presets.v2` from old outer containers is the sole one-time
  transition. It cannot hydrate or legitimize any pre-cut sound state.
- The wavetable selector contract is deliberately bounded to the fully occupied immutable
  range 0–237. This gives up silent in-range catalog growth in exchange for making every
  host-expressible value valid and stable; future growth needs a new reviewed selector
  endpoint/contract rather than extending this range.
- A selector parameter is an asynchronous request whose reported current/durable value
  changes only when the scheduler activates the table. This gives up an immediate host
  echo during loading in exchange for never saving or reporting a table that failed to
  become audible; pending status remains diagnostic/UI state.
- Native parameter ingress becomes a wrapper-owned seam. It may briefly block a host
  parameter call at performer publication or terminal-fence cutoff, in exchange for one
  provable order across host automation, WebView writes, engine replacement, and durable
  state. The cutovers are fixed-size, allocation-free, and deadline-tested.
- `RestoreFence` carries the complete parameter-image hash and exact desired rack state.
  The frozen FNV-1a-64/binary32/order contract and independent literal oracle make that
  comparison falsifiable; an overflow-free two-limb DSP implementation makes it portable
  under Cmajor's signed-integer rules. This adds one bounded restore-only comparison in Cmajor and
  avoids a second rack acknowledgement protocol or per-parameter callback state machine.
- ADR-014's sparse durable storage remains valid, but its complete inherited-scalar image
  decision is superseded by fixed override/presence images. Its references to
  `uiPatchValues` and HOST-02 must be updated during the hard cut.

## Rejected alternatives

- **Complete `uiPatchValues.v3`:** rejected because it preserves duplicate authority and
  schema drift even if all fields are added.
- **Separate handwritten Cmajor and TypeScript control catalogs:** rejected because a
  conformance test can detect drift only after two sources have already disagreed. Both
  are generated from one authored product-parameter catalog instead.
- **Keep v2 and fill missing B/C defaults:** rejected because restored sound would depend
  on which consumer read the state.
- **Copy every inherited base into complete selector images:** rejected because it makes
  base changes rebuild ART off-thread and leaves a note-start race between the live
  parameter and the acknowledged image.
- **Parse or store sparse ART objects in Cmajor:** rejected because persistence and sparse
  document semantics do not belong on the audio thread. Only fixed values/presence bits
  cross the runtime seam.
- **Let each platform invent its own snapshot:** rejected because browser/plugin/preset
  parity is an outer requirement.
- **Parameter-listener stamps/watermarks as restore acknowledgements:** rejected because
  same-value sends suppress callbacks, listener timing is not a DSP boundary, and browser
  restore is already one synchronous command burst. Native uses one checked ingress plus
  the terminal DSP fence.
- **Generic Cmajor bulk state apply as native delivery proof:** rejected because the
  current void helper discards individual parameter enqueue failures and mutates cached
  values before a failed post. Native restore uses a return-bearing initializer.
- **A separate table-intent field/event:** rejected because wavetable selection already is
  a parameter. Its canonical ingress is also the scheduler request.
- **Best-effort schema migration:** rejected under the current hard-cut policy. Any future
  migration must be explicit, exact, and separately accepted.
- **Keep MSEG morph in both parameter state and `modulation.v4`:** rejected because host
  automation/restore and document restore can produce two different bases.
