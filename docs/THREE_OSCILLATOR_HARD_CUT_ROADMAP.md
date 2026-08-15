# Three-Oscillator Hard-Cut Roadmap

Status: product hard cut, functional platform QA, and desktop/Web performance complete; final delivery active — 2026-08-15

Base: `4e7941208f66279159859ad52d257e877a970291`

Architecture records:

- `ADR-021-parameter-state-and-schema-ownership.md` freezes the complete schema,
  persistence, reconstruction, failure, allocation, and hot-edit model.
- `ADR-022-one-three-oscillator-renderer.md` freezes the single-renderer/platform-adapter
  model and the deletion boundary.

The tickets below implement those records. A short ticket description must not be used
to narrow or omit an ADR requirement.

## Implementation override

The proposed `FLOW-01` multi-carrier harness was abandoned before it became tracked
product code. It grew into a second orchestration system instead of a small regression
gate, and the user explicitly removed it from scope. It must not be revived.

The accepted cut uses the product's public seams and existing test infrastructure:

- native and browser builds call the same renderer source and render A, B, and C;
- browser reload and synth-preset tests save and restore distinct A/B/C parameters plus
  `modulation.v5`, `articulations.v4`, and `rack.v1`;
- the production worker proves ordered MOD then ART installation and replay on a new DSP
  session;
- the indexed table worker proves independent A/B/C activation and failure identity;
- existing desktop, browser, AUv3, plugin validation, and physical-device gates qualify
  the actual products.

No custom `ProductRestoreBegin`/`RestoreFence` protocol, native test command channel, or
test-only application runtime was added. Detailed FLOW requirements below are retained
only as design history; they are superseded by this implementation decision.

## Decision

Cosimo will not ship or indefinitely carry two oscillator-rendering architectures.

The current split was a staging device: oscillator A stayed on the exact legacy Cmajor
renderer while B/C and the native renderer were built behind an opt-in flag. That kept
the synth usable during construction, but it also duplicated A's table storage,
transport, controls, render logic, and tests. The user has explicitly rejected that
tradeoff.

The final product therefore has:

- one renderer implementation for A, B, and C: the existing
  `WarpRenderer`/`RendererBridge` source;
- small platform adapters only: desktop calls the renderer through the Cmajor native
  function provider, iPhone links it into the generated AUv3 code, and Web calls the
  same source compiled to WebAssembly;
- one indexed A/B/C table scheduler and one packed table representation;
- one set of `oscA*`, `oscB*`, and `oscC*` product controls;
- no legacy scalar-A renderer, table bank, table protocol, endpoint aliases, fallback
  graph, or `enableExternalRenderer` switch;
- no `uiPatchValues` document, replacement v3 document, or second saved copy of ordinary
  parameter values.

The browser is not allowed to remain A-only. If its renderer cannot be constructed, the
patch reports a startup failure; it does not silently instantiate a different synth.

## Final state model

There are four authorities, each with one job:

1. **Cmajor input parameters** own ordinary knob and selector values. This includes all
   22 controls for each oscillator, including each oscillator's wavetable selection.
   Plugin/AUv3 state already saves these parameters. Browser state must save the same
   parameter snapshot.
2. **`modulation.v5`** owns MSEG shapes/playback, envelopes, mappings, and macro names.
   MSEG morph and macro values are ordinary host parameters; v5 removes the duplicated
   morph fields that exist in v4. The 884-pair routing domain is unchanged.
3. **`articulations.v4`** owns sparse articulation slots and overrides.
4. **`rack.v1`** owns rack order and enabled state.

The active table, sounding voices, installed modulation program, and installed
articulation images are derived runtime state. They are observed for readiness and
diagnostics; they are not another saved source of truth. Oscillator tab selection is
local presentation state and is not saved with the patch.

Articulation inheritance reads the current Cmajor parameter values. It does not read a
UI-owned duplicate parameter bag. Wavetable selection is saved as a Cmajor parameter,
but only the indexed table scheduler translates it into asynchronous table work; it is
never counted as a synchronous parameter-publication lane.

This deliberately separates the two problems that the earlier plan blurred:

- **schema ownership:** one build-time product-parameter catalog generates Cmajor
  endpoints, TypeScript/native bindings, and A/B/C MOD/ART addresses; each structured
  document owns its own fields and version;
- **state ownership:** the live Cmajor parameter values and the last strictly accepted
  structured documents own the values. UI and worker caches are projections only.

The existing canonical plugin-state contract/hash is reused to detect schema drift.
Browser durability and synth presets save the same logical sound snapshot as native
hosts: the exact contract, a complete endpoint-keyed parameter map, and the required
structured documents. The hash sees structured key/version pairs, so any parser-shape
change must bump its document version and an independent golden gate enforces that rule.
There is no migration, alias, default filling, or best-effort field copy under this hard
cut. Parameter snapshots use Cmajor engine units; normalized UI values remain
display-only and cannot become a second storage or conversion model.

State-schema drift and DAW automation-slot drift are different checks. The canonical
state hash is endpoint-keyed and order-independent. A separate order-sensitive test ledger
freezes the new Cmajor declaration order at the cut, including the hidden
`hostSlot0Guard` first. That protects host automation without making keyed presets
depend on platform enumeration order.

The numeric wavetable-selection parameters also have an immutable factory-table slot
ledger. Their declared range is exactly the fully occupied slots 0–237, and each index
must continue to name the same stable table ID and source/derived content digests. Table
bytes and caches remain derived and no duplicate table ID is stored in the snapshot. A
raw snapshot containing 238/255 fails preflight, while supported host automation cannot
express those values. Future catalog growth needs a new selector endpoint/contract rather
than extending this range and reinterpreting old automation.

`uiPatchValues` was originally introduced to give the articulation compiler a complete
base and to make UI-owned values persistable. Those needs remain, but the duplicate
document does not. ART now compiles only explicit override values plus presence bits, so
it no longer copies inherited bases at all; Cmajor reads the live parameter at note start.
The existing snapshot contract persists the Cmajor parameters themselves, and validators
use endpoint metadata for range/type checks rather than reading a UI-owned value bag.

Cmajor's allocation restrictions are handled separately. Sparse MOD/ART documents stay
outside the audio thread and compile to deterministic fixed-capacity programs and ART
override values plus presence bits. At note start Cmajor chooses an explicit override or
the live parameter/installed envelope, then latches it. Cmajor still parses no JSON,
allocates no memory, and uses only preallocated arrays and bounded loops. This removes
the full-image race in which a live parameter could change before the worker rebuilt and
acknowledged inherited selector values.

The schema audit also removes the remaining known parameter/document overlap:
`mseg1Morph`/`2`/`3` stay host parameters, and `modulation.v5` no longer stores those
values. Shapes, playback, envelopes, routes, and macro names remain in the modulation
document. `modulation.v4` is rejected after the cut; there is no reconciliation rule.

All other values are classified too: voice/play mode, glide, macros, MSEG morphs,
shared filter values, and effect knobs are parameters; rack order/enables are `rack.v1`;
table audio, compiled MOD/ART images, effective values, and voices are derived only.
Nothing becomes saved state merely because the UI or worker caches it.

`uiMappings.v1` is deleted because it records inert UI-only mappings for controls with no
runtime modulation destination. Those unsupported mapping affordances disappear; only
targets represented by the MOD domain can expose a mapping. Durable
`articulationTriggerConfig.v1` is deleted because ART owns trigger ranges; a fixed native
trigger configuration is derived from the accepted ART epoch. Every ART commit emits a
non-destructive correlated acknowledgement carrying session, ART epoch, and trigger
configuration to the native wrappers without an editor or persisted key. Native note
metadata carries the installed ART epoch and Cmajor drops mismatches. Whole-product
restore alone uses the separate terminal readiness/reset event. The
`effects.presets.v2` user
library is retained only as auxiliary outer
container data: it is not part of the current sound contract, is never nested inside an
individual preset, and cannot affect sound readiness.

Browser/preset restores preflight the whole sound snapshot, then send one synchronous
command burst beginning with correlated `ProductRestoreBegin`; no UI command can
interleave inside that burst. Native VST3/AUv3 restore instead builds a fresh gated
performer and applies the validated zero-ramp parameter map through a return-bearing
initializer; the current void Cmajor bulk helpers are not accepted delivery proof. One
canonical native ingress covers host automation and WebView writes. Its fixed
latest-value-per-endpoint overlay preserves writes during the short rebuild, while one
bounded critical section linearizes checked sends with performer publication and the
terminal fence; there is no parameter-listener acknowledgement or watermark state
machine. Every platform mutes audio and gates MIDI until the exact committed rack, MOD,
ART, derived trigger data, and all three table identities agree for the target session
and a terminal `RestoreFence` crosses that performer. While closed, the patch keeps processing
empty MIDI so installs can finish, output is zeroed, incoming MIDI is discarded rather
than queued, held-note metadata is reset, and Cmajor performs a correlated reset of
voices, latches, filter/envelope histories, and every stateful rack buffer before
`RestoreApplied`. Save operations continue returning the last fully accepted envelope
until that matching event promotes the pending one. Invalid native state never produces
a mixed or newly durable sound, though host-owned internal parameter objects may already
have changed.

## Merge rule

The hard-cut implementation tickets share one cutover branch and form one merge unit.
Intermediate commits may be temporarily incomplete, but none may be merged into the
rolling product until `PRODUCT-HARD-CUT-01` deletes every superseded path and the public
product gates pass. This deliberately prefers a temporarily broken construction branch
over long-lived parallel product implementations.

The portable renderer adapters may land earlier because they do not activate or
duplicate a product render path.

## Superseded FLOW-01 design history

This section is not an active ticket or completion gate. It records the behavior that
motivated the cut, but the oversized carrier harness itself was rejected.

These were the proposed regression scenarios. They are not executable acceptance work
and do not override the implementation decision above.

### FLOW A — complete save and restore

1. With the editor closed, choose three different stable table IDs, distinct A/B/C
   controls, shared controls, rack state, MOD v5, ART v4, and one auxiliary user preset.
2. Save through the actual VST3 chunk, AUv3 `fullState`, browser durability, and generic
   preset interfaces. Expected values come from an independent scenario fixture, not the
   serializer under test.
3. Perturb every sound value and table, sustain a pre-restore voice, and charge delay and
   reverb tails, then restore while sending MIDI. Every platform keeps output gated until readiness. Browser/preset
   adapters must also preflight before their first write. A note-on/note-off spanning the
   closed gate is discarded, the pre-restore voice is reset even when its note-off occurs
   during the gate, and neither can replay or reappear. No pre-restore rack tail may spill
   into the restored sound; a fresh post-ready note must match the restored oracle.
4. Verify the exact parameter key set and engine-unit values, MOD/ART/rack documents,
   three numeric selections, three requested/active stable table IDs, derived trigger
   configuration, the independently frozen complete parameter-image hash, and separately
   preserved auxiliary preset library. The hash oracle uses the frozen host-slot ledger
   plus this hand-authored scenario and imports no production catalog/hash helper.
5. Play isolated A, B, C, and summed notes. Require one canonical renderer path,
   non-silent isolated siblings, no cross-oscillator leakage, and the frozen A oracle.
6. Repeat with missing/unknown parameters, contract mismatch, wrong document version,
   malformed structured state, ART scalar/envelope/route values outside their referenced
   range or discrete step, out-of-range table selections, and a parser-shape fixture
   without the required version bump. Browser/preset paths write nothing; native paths
   never authorize the candidate or emit mixed-state sound; the prior accepted performer
   remains live throughout rejection. A genuinely absent snapshot alone chooses defaults.
   Separately, an empty/non-Cmajor VST3 startup probe is ignored
   before restore ingress and leaves the normally initialized default patch running; a
   signed Cmajor carrier with a wrong contract is not mistaken for that probe.
7. Invoke save while a restore is only partially observed and again after a rejected live
   document. Every carrier must return the prior fully accepted envelope until matching
   readiness, then atomically return the new one; failure/restart must never contain the
   partial parameters or rejected raw document.
8. Attempt table values 238 and 255 through raw state and the actual compiled host
   parameter surface, then capture state immediately before any asynchronous work. Raw
   state rejects before mutation, the bounded host surface cannot express either value,
   and every saved carrier still contains a valid 0–237 selection and matching table ID.

The native cases use the actual compiled VST3/AUv3 parameter order and state carriers,
not a JavaScript mock. The physical phone remains the final delivery gate, not a
development retry loop.

### FLOW B — articulation inheritance and note lifecycle

1. Give A, B, and C audibly distinct parameter bases, envelope bases, and tables.
2. Add sparse ART overrides with both present and absent scalar/envelope fields plus a
   MOD route that addresses more than one oscillator.
3. Start a note, change a live base parameter and MOD envelope while it sounds, then
   start another note without republishing ART.
4. Change an explicit ART override, change the MOD route layout, remove a route and its
   ART amount, then reuse the same route ID. Start a note between the MOD and ART staging
   acknowledgements and prove neither staged bank is active until their shared epoch
   commit. Also start a note after the ART commit but before the native trigger event is
   installed; its older `artEpoch` must be discarded, while the first matching-epoch note
   works. Save, perturb, restore, and repeat.
5. Require the existing note to retain its latch, the future note to inherit the current
   live base where presence is absent, explicit overrides to win where present, removed
   route data never to resurrect, and A/B/C never to borrow sibling values.
6. Require causal audio deltas, not only monitor JSON: each expected inheritance/override
   change must alter the isolated output in the predicted direction while silent siblings
   remain silent.

### FLOW C — live edits, recovery, and table independence

1. Load distinct sentinel A/B/C tables while applying live parameter, MOD, and ART edits.
2. For browser and preset restore, prove the validated begin/base/document burst is one
   synchronous command sequence and a parameter edit issued immediately afterward is
   ordered after that base without any listener handshake or stale resend. For actual
   VST3/AUv3 restore, route host automation and native WebView edits through the one
   checked ingress while continuously automating across replacement construction,
   publication, terminal-fence enqueue, and `RestoreApplied`. Prove the fixed latest-value
   overlay wins at publication, later writes target the replacement directly, the bounded
   cutover meets its deadline, and repeated same-value writes cannot stall readiness.
   Restore the same state again after divergence and require it to apply again.
3. Start A and B transfers with deliberately colliding numeric generation/table/mip/frame
   values. Prove that only the full session+oscillator+generation+table+mip+frame identity
   retires work, the shared asset decodes once, and a B-only timeout/retry never replaces
   A or C. Issue a new selector after the restore fence cutoff: delayed success must commit
   its parameter/durability only on matching activation, while resource failure must leave
   the restored selector and active table unchanged without delaying current readiness.
4. Cross two MOD installs with different route layouts and their dependent ART images.
   Delay, cross, duplicate, and replay table/runtime acknowledgements, replace the DSP
   session once, request a non-default rack order/enable state, expose an early/stale rack
   readback while its fade is still active, and inject MIDI throughout. Require matched
   MOD/ART activation, exact committed rack state, continued silence/note discard, and no
   stale callback/session/ack advancement.
5. Hold the last prerequisite and automate an endpoint whose normal contract declares a
   64-frame ramp. Because the valid restore gate is closed, its pre-fence target-performer
   write must be forced to zero ramp; enqueue a distinct post-fence edit with its normal
   ramp, then release the prerequisite. The complete canonical DSP parameter-image hash at
   the fence must contain the settled pre-fence value, exclude the later value, and only then
   permit `RestoreApplied`; the later value must win afterward and a save made exactly at
   readiness must include every successfully delivered value in ingress order. Force a
   named ordinary base-parameter delivery to fail while the host-facing cache still tries
   to report the requested value; require no fence/readiness/promotion, unchanged accepted
   cache, and a successful retry of the same state. Replace the performer/session once and
   prove the stale fence also cannot authorize readiness. In test-only actual-product
   builds, corrupt the fence hash after all sends succeed and separately perturb one
   DSP-side parameter before the fence; both must report the parameter-hash phase and
   withhold `RestoreApplied`.
6. Make one domain invalid while valid unrelated domains advance; then save/restart and
   prove durable last-valid state. Save during partial restore and require the prior
   accepted envelope, delete one structured key and require exact replacement rather than
   merge, then finish with isolated A/B/C and summed audio whose route result identifies
   the accepted epoch, not merely serialized diagnostics.

All renderer checks use distinct per-oscillator tables and controls. The renderer call
must carry the correct oscillator/table identity, each isolated oscillator must match the
same offline renderer source, and removing each oscillator from the sum must cause its
independent expected delta.

## Revised tickets

### Tranche A — lock behavior and make the one renderer portable

#### FLOW-01 — Retired; never ship or resume this harness

Create FLOW A/B/C as real product-facing tests. Freeze current oscillator-A state/audio
evidence before changing the root. The new A/B/C assertions may begin red; do not weaken
them to fit the staged architecture.

Acceptance:

- all three flows use public patch/preset/state interfaces, not production test exports;
- desktop VST3, browser, and iPhone-simulator AUv3 adapters share independent scenario
  definitions while exercising their actual outer state carriers;
- the frozen A manifest is pinned to base `4e794120...` and records exact input assets,
  their hashes, event schedule, sample rate/block layout, toolchain, raw stereo output
  hash, alignment rule, and `2e-6` maximum absolute tolerance; generation must occur in a
  clean worktree at the full pinned commit and a second independent run must reproduce
  the raw hash. Changing that oracle requires a separate review;
- the harness sends MIDI during delayed valid restore, partial-send failure, and rejection
  on native and packaged Web/preset paths. It proves the audio/MIDI readiness gate,
  discard-without-replay behavior, correlated reset of a pre-restore voice, and fresh
  post-ready audio with the editor never opened;
- every valid browser/preset restore records `ProductRestoreBegin` as its first Cmajor
  mutation; native restore closes the wrapper gate synchronously and publishes only a
  fresh internally gated performer. Invalid browser/preset input records no begin event
  or other write;
- actual save calls during partial restore keep the prior accepted envelope; continuous
  native automation during performer rebuild is preserved by one fixed latest-value
  overlay, while browser/preset command order needs no overlay or listener callback; a
  note in the native-trigger/ART event gap is rejected by `artEpoch`;
- actual VST3, AUv3, packaged WebAudio, and preset carriers prove one correlated
  `RestoreFence` crosses the target performer with the complete canonical parameter-image
  hash and exact committed rack state. The hash has one frozen binary32/FNV-1a-64 contract
  and independent literal oracle. A named ordinary-parameter delivery failure, deliberate
  hash/DSP-image mismatch, stale performer, rack still in transition, or replaced session
  cannot emit an accepted `RestoreApplied`; repeated same-value sends remain bounded
  because callbacks are not part of completion;
- actual VST3 startup treats an empty/non-Cmajor device-open probe as a no-op before
  semantic restore ingress, while a signed Cmajor carrier with the wrong hard-cut contract
  fails closed. Default construction itself passes the normal gated readiness lifecycle;
- raw 238/255 selections fail before mutation and immediate state capture cannot contain
  either value because the compiled selector range is exactly 0–237;
- actual compiled VST3/AUv3 parameter slots match the frozen host-order ledger and the
  logical snapshot excludes the hidden slot-0 guard;
- failures identify state, table, renderer, MOD, or ART phase rather than timing out.

#### RENDER-NATIVE-02 — One native renderer adapter — 4 points

Make `RendererBridge` the sole owner of the exact external function name and 18-slice
contract. Desktop binds that contract to the existing Cmajor provider field; iPhone
links the same bridge and renderer into the existing external-codegen route. Do not add
a provider registry or an iOS-specific renderer interface.

Acceptance:

- exact float/int argument order and every table chunk are independently witnessed;
- desktop native and iPhone simulator each record a real renderer invocation and a
  non-silent B-only note;
- wrong name, count, type, or missing symbol fails explicitly;
- the renderer algorithm remains byte-shared source, not copied platform code.

#### RENDER-WEB-01 — Same renderer in the AudioWorklet — 8 points

Compile the same `WarpRenderer`/`RendererBridge` source to SIMD WebAssembly and connect
it to the Cmajor-generated AudioWorklet. Use the already-proven provider-import design:
the Cmajor module and renderer module share one computed, non-overlapping memory layout,
and the imported renderer function is called directly rather than once per sample
through JavaScript. This replaces the stale route-selection ticket; no pure-Cmajor B/C
fallback will be built.

Acceptance:

- Chromium and WebKit execute the actual AudioWorklet and render a B-only note;
- memory regions are computed, disjoint, in bounds, and guarded by surviving canaries;
- the same renderer oracle passes native and browser WebAssembly;
- missing, zero-returning, or trapping setup fails patch construction clearly;
- there is no A-only production manifest or permanent browser capability mode.

### Tranche B — replace the staged state and table machinery in place

These tickets develop on the hard-cut branch and are not independently mergeable.

#### STATE-SCHEMA-01 — One derived plugin-state contract — 4 points

Implement ADR-021's schema half with one authored build-time product-parameter catalog.
It owns every parameter ID/type/range/default/step/order plus A/B/C control, delivery,
MOD, and ART identities; its single 22-control oscillator definition expands to A/B/C.
Generate the Cmajor input declarations, `OSCILLATOR_BINDING_CONTRACTS`, native validator
metadata, and snapshot parameter contract from it. The compiled endpoints are verified
outputs, not a second handwritten catalog. Compose that parameter projection with the
existing MOD/ART/rack key-version contracts. On the construction branch this ticket
hard-replaces the root parameter declarations with the generated final contract; it does
not add dormant B/C endpoints or aliases beside legacy A. The temporarily broken branch
is repaired by the following table/state/UI tickets before it can merge.

Deepen the existing plugin contract/preset/snapshot machinery for the synth rather than
building a parallel synth snapshot framework. Effect-specific names may be generalized
only where the shared behavior actually becomes common; existing effect callers must
keep the same behavior.

Acceptance:

- the contract contains exactly the product parameter endpoints, types, ranges,
  defaults, discreteness, and required structured key/versions;
- one authored parameter catalog generates Cmajor declarations, TypeScript bindings,
  native validation metadata, and the snapshot parameter schema; a clean regeneration
  gate plus compiled-product inspection rejects stale or independently edited outputs;
- `rack-parameter-descriptors.ts` and `target-descriptor.ts` consume the generated
  endpoint ID/type/range/default/step/connectivity facts and retain only their rack/UI
  presentation metadata. `modulation-targets.ts` owns MOD target IDs, DSP indexes, amount
  bounds, and modulation behavior, but consumes the generated control-to-target links and
  may not repeat product endpoint semantics. Source guards and projection tests reject a
  second authored endpoint catalog in any of the three modules;
- the contract and snapshot values use engine units; independent non-normalized examples
  catch accidental 0..1 storage or double conversion;
- all 22 A/B/C controls have one delivery classification: 21 ART-capable ordinary
  parameters plus one scheduler-only wavetable selection;
- MOD membership remains the accepted ten targets per oscillator and is not inferred
  from saved parameter inventory;
- MSEG morph and macro values classify as parameters; MSEG shapes/playback, envelopes,
  mappings, and macro names classify as `modulation.v5`; no field has two durable owners;
- `target-descriptor.ts` is no longer used to define a saved patch schema or independently
  author endpoint semantics;
- the shipping synth's exact structured sound-key ledger is `modulation.v5`,
  `articulations.v4`, and `rack.v1`, with only `effects.presets.v2` classified as
  auxiliary; actual product entry-graph tests reject any unclassified durable key;
- retired synth-local `mseg1.shape`, `mseg1.playback`, and `mseg1.depth` controller paths
  and generated artifacts are absent, while separately shipping SeqFX/effect-lab state
  remains governed by those products' own contracts;
- the existing canonical contract hash changes for any endpoint semantic or
  structured key/version drift and remains stable across platform enumeration order;
- an independent golden parser-shape gate fails if a MOD/ART/rack parser changes without
  the corresponding document-version bump;
- a separate source-backed host-slot ledger changes for any declaration reorder/removal,
  freezes the new hard-cut order, and keeps hidden `hostSlot0Guard` in slot 0 without
  storing it as a user value;
- a source-backed table-slot ledger covers the exact host-expressible range 0–237 and
  rejects any selection-to-table-ID reorder/removal or content-byte change; table IDs and
  canonical source/derived digests are unique, raw 238/255 snapshots reject, and future
  growth requires a new selector endpoint/contract rather than a range extension;
- independent golden/compiled-product tests fail on missing, extra, renamed, reordered,
  mistyped, out-of-range, or misclassified generated controls without creating another
  authored expected-value table;
- ART scalar IDs cross-validate range/discreteness/step through the binding-to-live-
  endpoint contract; envelope overrides use the MOD envelope contract and route amounts
  use the referenced target bounds. Independent boundary fixtures reject out-of-range and
  non-step values without relying on Cmajor clamps;
- controls without a real MOD runtime destination expose no mapping or articulation-
  mapping UI and cannot create or persist `uiMappings.v1`;
- the construction root contains the final parameter names/order and no legacy A aliases;
- no `uiPatchValues.v3`, second synth snapshot format, handwritten Cmajor/TypeScript
  address duplicate, or copied 22/10/21 catalog is introduced.

Dependency: this ticket precedes `ART-INHERITANCE-HARD-CUT-01` and
`STATE-RESTORE-HARD-CUT-01`; both consume the contract it freezes and may not recreate
the schema.

#### ART-INHERITANCE-HARD-CUT-01 — One note-start inheritance model — 4 points

Replace complete inherited scalar selector images with fixed override values and fixed
presence bits. Keep sparse ART parsing off the audio thread. At note start, Cmajor chooses
an explicit scalar/envelope override when present and otherwise reads its live parameter
or installed MOD envelope, then latches once. Retain the existing route-amount sentinel.

Delete durable `articulationTriggerConfig.v1`; derive the native trigger configuration
from the accepted ART epoch. Every ART commit returns it through the fixed,
non-destructive `ArticulationCommitAck { dspSessionId, artEpoch, triggerConfig }`;
desktop and AUv3 install it without an editor/WebView and ignore stale epochs. Whole-
product restore separately sends one terminal readiness request containing the expected
ART epoch after that acknowledgement is installed; the terminal path alone resets DSP
history and may open the gate. There is no hidden UI transport.

Acceptance:

- a base parameter or MOD envelope edit changes a future note without any ART compile or
  upload and cannot mutate a sounding note;
- explicit A/B/C scalar and envelope overrides win independently; absent overrides use
  the live owner and never a UI/worker base cache;
- scalar/envelope/route override values at exact boundaries pass, while out-of-range or
  non-step discrete values reject before compilation/upload; Cmajor clamps are defensive
  only and never normalize accepted state;
- MSEG shape/playback and amount-only MOD changes do zero ART work; route-layout or ART
  changes rebuild only affected fixed images;
- note-start resolution remains preallocated, fixed-size, allocation-free, and within
  the established callback deadline while preserving the existing 416-cell route latch;
- native MIDI cannot pass until the trigger configuration and ART image share the same
  accepted epoch; whole-product restore additionally requires the terminal correlated
  `RestoreApplied`, while an ordinary live ART edit never invokes that destructive path;
- editor-closed desktop/AUv3 tests prove the Cmajor event is the only trigger transport,
  and note-on/note-off during a closed gate is discarded without replay or stuck state;
- a live trigger-range edit lets existing voices continue; native `articulationNoteMeta`
  carries the installed `artEpoch`, and Cmajor discards intervening mismatched notes until
  the matching trigger acknowledgement is installed; a sustained voice and charged
  delay/reverb tail remain continuous throughout this live edit, proving no restore reset
  was reused;
- complete inherited-base images, base-dependency token machinery, and the durable
  trigger document are deleted.

#### TABLE-HARD-CUT-01 — One indexed A/B/C scheduler — 4 points

Deepen the existing `WavetableWorkerController` in place. It owns one decoded-table
cache, three desired/active records, and the engine's one serialized staging slot. Do
not create a second controller.

Acceptance:

- transfer identity is exactly session, oscillator, generation, table, mip, and frame;
- crossed A/B/C acknowledgements cannot retire each other;
- shared source data is decoded/cached once while transfer frontiers stay independent;
- each numeric selection resolves through the frozen slot-to-table-ID mapping; catalog
  reorder/removal or a source/derived byte change under the same ID fails before a
  product build can reinterpret or silently change saved selections;
- the selector endpoint range is exactly 0–237 and every value resolves to an immutable
  table ID/content digest; raw state containing 238/255 rejects before mutation and the
  compiled host automation surface cannot represent it;
- state capture invoked immediately after an attempted invalid raw/host value still
  serializes a valid accepted selection, with no asynchronous correction window; a
  mutation test proves range extension or new meaning requires a new selector contract;
- requested table ID, decoded asset ID, transfer identity, and active DSP table ID agree
  in status evidence for each oscillator;
- selector parameter ingress is the scheduler request, but Cmajor/host current value and
  durable state commit only when that exact table identity activates; resource failure
  retains the prior accepted selector everywhere;
- during whole-product restore, each oscillator keeps the captured restore-required table
  plus at most one latest live selector request. The restore table completes the current
  fence; the queued request runs afterward and cannot starve readiness. Delayed success
  commits it later, while failure leaves the restored selector durable;
- a failure or retry for one oscillator does not replace another oscillator's active
  table;
- scalar-A messages and controller fields are removed, not wrapped.

#### STATE-RESTORE-HARD-CUT-01 — Parameters plus MOD/ART restore — 8 points

Delete `uiPatchValues.v2` without creating `uiPatchValues.v3`. Rewrite the useful
correlated-lane logic from held branch `e61abb13...` around the real Cmajor parameter
stream: wait for the complete parameter snapshot, let each selector entry enter the table
scheduler through that same parameter ingress, stage MOD, stage dependent ART, then
atomically activate the matched DSP epoch. No second table-intent event exists. The
module observes parameters; it does not republish or persist them. Keep the table scheduler, MOD lane,
and ART lane as
separate deep modules; one small instantiation owner maps each module's accepted identity
into the outer `{ restoreId, dspSessionId }` readiness join. Tables and rack keep their
own identities; only matched MOD/ART layout activation shares `artEpoch`.

Acceptance:

- desktop plugin, AUv3, browser, and synth-preset snapshots reuse the canonical contract
  and save ordinary controls as endpoint-keyed parameter values plus owning structured
  documents;
- native wrappers record/validate the canonical contract hash; browser persistence
  hard-cuts from `cosimo.web.patch-state.v1` to the complete
  `cosimo.web.patch-state.v2` snapshot. It never hydrates v1 sound state;
- synth presets reuse the existing generic `cosimo.effectPreset` v2 envelope with the
  new exact contract and nested v5/v4/v1 documents; old synth presets fail closed by
  contract/version rather than entering a migration path;
- `effects.presets.v2` remains a separate auxiliary library in outer durability, is
  excluded from sound readiness/hash, and is never recursively embedded in a preset;
  browser v2 has explicit `sound` versus `auxiliary` sections, while native carriers keep
  their existing ValueTree/dictionary shape and enforce the distinction semantically;
  malformed auxiliary data retains/defaults only the library without changing sound
  readiness;
- one strict, one-time transition extracts only valid `effects.presets.v2` auxiliary data
  from pre-cut browser/native carriers, never hydrates old sound fields, reports the
  attempt only through in-memory diagnostics, and adds no durable migration marker. A
  valid old browser library is removed only after a v2 carrier containing that library
  plus an accepted/default sound is durably written; injected `setItem` failure and page
  exit before the first v2 write retain the old key, and restart retries extraction
  idempotently without duplicate presets. Valid and malformed cases are both covered;
- `uiMappings.v1` and durable `articulationTriggerConfig.v1` are absent; controls without
  a runtime MOD destination expose no mapping UI, and accepted ART is the only trigger
  owner;
- outside restore, a parameter edit advances the in-memory durability projection only
  after its runtime enqueue succeeds. Complete snapshot serialization and LocalStorage
  writes are coalesced and lifecycle-flushed; runtime control writes never wait on
  browser storage or a parameter-listener echo;
- browser/preset inputs are parsed and cross-validated before mutation; contract
  mismatch, unknown/missing parameter, invalid value/dependency, or wrong version emits
  zero writes. Native VST3/AUv3 state enters a muted/MIDI-gated unready session before
  candidate mutation can be heard and never emits partially restored audio. Preflight
  rejection leaves the prior accepted performer live; a later transport/delivery failure
  preserves the prior durability envelope and follows the explicit gated recovery path;
- browser/preset and native editor-closed fixtures cover ART boundary, out-of-range, and
  non-step scalar/envelope/route values; browser/preset emits zero writes and native
  rejects the candidate without touching the prior performer or emitting candidate
  `RestoreApplied`;
- browser startup preflights before the UI or AudioContext starts. Browser/preset apply
  emits one synchronous command burst beginning with `ProductRestoreBegin`, followed by
  the complete zero-ramp parameter map—including all three selectors—and exactly the MOD,
  ART, and rack documents. The generated delivery class sends ordinary parameters direct;
  each selector enters the table scheduler through that same parameter ingress and commits
  its parameter projection only on activation. There is no second table-intent field or
  send. Another UI command
  cannot interleave inside that burst, and later parameter commands remain FIFO-ordered
  behind it without a callback protocol;
- hosted desktop/iPhone presets send one validated envelope to the native wrapper rather
  than emitting individual WebView parameter writes. VST3 chunks, AUv3 `fullState`, and
  hosted presets therefore use the same native batch path with the editor closed;
- before semantic restore ingress, native wrappers ignore an empty/non-Cmajor host startup
  probe without closing the gate or mutating the initialized patch. A signed Cmajor
  carrier with the wrong hard-cut contract fails closed, and default construction itself
  runs the normal gated readiness lifecycle;
- native restore request starts the fixed automation overlay while it copies/preflights
  the candidate, without mutating, gating, or freezing the accepted performer. Each live
  write is sent through the checked ingress first and updates the cache/overlay only after
  success, before the lock is released. Invalid input discards the overlay while the prior
  sound and valid automation continue. For a valid candidate, the wrapper freezes the
  then-current accepted envelope, closes its outer gate under the same ingress, mints
  `restoreId`, and builds
  a fresh internally gated performer. A new return-bearing
  complete-base initializer sends every direct zero-ramp parameter and commits its cache
  only after success; the three selectors enter only the scheduler and commit on matching
  activation. Relying on the current void `LoadParams.applyParameterValues` or generic
  full-state helper is forbidden. The exact structured sound-key projection replaces the
  old one: missing required keys reject preflight, and unknown/retired prior sound keys do
  not survive. Auxiliary preset-library data remains separately preserved;
- delete state-byte hash suppression. Restoring the same valid chunk after runtime
  divergence applies again, and a failed attempt may be retried;
- one canonical native parameter-ingress seam covers VST3/AUv3 host automation and
  PatchConnection/WebView writes. It commits cached/current values only after a checked
  DSP enqueue succeeds. While the performer is rebuilt, one fixed-capacity array records
  the latest value per endpoint; one bounded shared critical section applies that overlay
  and swaps performers. The same seam linearizes successful sends with terminal-fence
  cutoff and durability classification. It may briefly block a host parameter call,
  including one on the audio thread, but performs no allocation, I/O, callback,
  serialization, or unbounded work while held and has an outer deadline gate. No listener
  stamp, watermark, no-op callback rule, unbounded queue, or browser equivalent is added;
- while the valid restore gate is closed, every target-performer parameter write classified
  before fence cutoff uses zero ramp, even when its ordinary endpoint contract declares
  64 frames. Candidate-preflight writes to the still-live prior performer and writes
  ordered after the fence retain normal ramps. Actual VST3/AUv3 and packaged Web/preset
  tests use a normally ramped endpoint as the final pre-fence value and prove exact
  hash/readiness/save behavior without a settle timer;
- parameters apply first; rack applies through its existing owner; MOD and dependent ART
  stage for the target `{ restoreId, dspSessionId }` and become active only through one
  matched Cmajor `artEpoch` commit. Tables and rack retain their own accepted identities;
  derived trigger data belongs to the committed ART epoch;
- parameter readiness is established by fresh-performer initialization on native, by the
  synchronous base command burst on browser, and finally by a correlated fence crossing
  the target performer. Parameter listeners remain display/diagnostic observations, not
  acknowledgements. Partial delivery or session loss keeps readiness false and replays
  the complete desired snapshot on the new session;
- sparse `articulations.v4` compiles off-thread to fixed override values/presence bits;
  at note start absent scalar/MSEG-morph overrides read current engine-unit parameters,
  absent envelope overrides read the installed MOD envelope, and MSEG shape/playback is
  never treated as an ART base; wavetable selection goes only to the table scheduler;
- Cmajor receives no JSON or sparse map and performs no allocation; fixed presence
  choices are bounded and sounding notes keep their latch;
- browser/preset cold validation is write-atomic before the first send; a valid restore
  whose transport fails mid-send joins native restore in remaining audio/MIDI-atomic
  behind readiness rather than claiming rollback. Live edits are strict per-domain
  last-valid; a stopped/prior callback cannot mutate runtime; a new DSP session replays
  the expected table/rack identities and matched MOD then ART state for the current
  `restoreId`;
- while a whole-product gate is closed, structure-changing UI commands are disabled
  instead of accumulated in a second global transaction. Parameter automation continues:
  browser/preset writes are later FIFO commands, and native writes use the fixed rebuild
  overlay only until performer publication. At terminal cutoff the native ingress locks,
  classifies every successful send before the fence into one pending parameter vector,
  stores that vector's cutoff hash, and enqueues the fence. Later successful ordinary
  sends continue updating the same pending vector without being resent.
  `RestoreApplied` validates the stored cutoff hash and promotes the latest contents of
  that one vector. Selector requests remain in
  the scheduler and update durability only on matching activation; they do not delay the
  already-cut restore fence;
- actual VST3/AUv3 restore continuously automates parameters across performer rebuild,
  publication, fence enqueue, and `RestoreApplied`, proving the latest value wins without
  starving either cutover and that a save exactly at readiness matches ingress order.
  Packaged browser/preset restore proves an immediate following edit is ordered after the
  synchronous base burst, never causes a stale resend, and reaches runtime/durability
  without a listener callback;
- a note arriving between MOD and ART staging acknowledgements can observe only the old
  committed pair; rapid remove/re-add/same-ID reuse cannot expose a mixed route layout;
- route removal cannot resurrect an old ART amount if its identity is reused, while an
  invalid live domain does not poison unrelated valid domains;
- the snapshot adapter keeps the prior fully accepted envelope during restore; actual
  VST3/AUv3/browser/preset save calls made after partial parameter mutation but before
  terminal readiness return that prior envelope. There is no intermediate base-ready
  durable state: one matching `RestoreApplied` promotes the validated base plus ordered
  pre-fence parameter edits together. Failure, rejection, a superseding restore, or
  session loss preserves the prior envelope. Rejected live raw documents are never
  persisted;
- all parameter-base, envelope, MSEG shape/playback, and MOD amount/polarity/enabled/name
  edits do no ART work; only ART or route-identity/layout changes rebuild affected images;
- a paced browser knob drag performs no per-event full-snapshot serialization or
  LocalStorage write and stays within the existing UI edit-stall bound;
- table readiness remains an independently recoverable scheduler frontier and joins
  overall product readiness together with rack, MOD, ART, derived trigger, and parameter
  initialization, without becoming a patch-publication lane;
- after final prerequisites and installation of the matching non-destructive ART commit
  acknowledgement, exactly one `RestoreFence { dspSessionId, restoreId, artEpoch,
  parameterImageHash, expectedRackOrder, expectedRackEnableMask }` reaches the target
  performer after all earlier required inputs. Cmajor verifies the session/epoch and
  complete canonical float32 parameter hash, waits until the rack's fade has committed
  the exact expected order/enable state, resets voices/latches/filter/envelope histories
  plus every stateful rack buffer, and opens readiness only on matching `RestoreApplied`.
  Restore values use zero ramp, so no ramp timer exists. Earlier acknowledgements and
  uncorrelated rack monitors can never open a gate;
- the parameter-image fingerprint is exactly FNV-1a-64 over little-endian IEEE-754
  binary32 engine-unit values in the independent frozen compiled host-slot order,
  excluding `hostSlot0Guard`, including accepted table selectors, and canonicalizing
  negative zero to positive zero. It is transported as low/high 32-bit bit patterns
  (`int32` carriers in Cmajor, interpreted unsigned); non-finite values reject before
  hashing. Cmajor computes the multiply with two nonnegative 32-bit limbs held in `int64`:
  split prime `0x00000100_000001B3`, propagate the low-product carry, and mask each limb,
  so no signed overflow occurs. A test-local oracle combines the independent
  host-slot ledger with a hand-authored complete scenario and a frozen literal hash
  without importing any production generator, serializer, monitor, or hash helper.
  Removing every slot in turn or swapping every adjacent pair must miss the literal;
- source/compile inspection forbids a direct overflowing signed-64 FNV multiply in the
  Cmajor path, and edge-limb vectors agree across interpreter, native JIT, generated C++,
  and Wasm;
- an outer causal gate on packaged WebAudio, actual VST3, and actual AUv3 captures a
  DSP-side complete parameter-image hash and committed rack witness. It proves pre-fence
  values are present, post-fence values are absent at the witness and win afterward, and
  a named ordinary-base delivery failure, early/stale rack readback, unfinished rack fade,
  or performer/session replacement cannot authorize readiness. Even if a host-owned
  parameter object reports the attempted failed value, the accepted wrapper cache remains
  unchanged and retrying that exact value must perform a real send and succeed;
- actual VST3, AUv3, and packaged WebAudio negative builds corrupt the supplied fence
  hash after successful parameter sends and perturb one DSP-only parameter before the
  fence. Neither may emit `RestoreApplied`, promote durability, or open readiness, and
  both report the parameter-hash phase rather than timing out;
- actual native gates also prove same-chunk re-restore after divergence, retry after a
  failed attempt, exact structured-key replacement, superseded AU restores, and state
  capture during rebuild returning the prior accepted envelope rather than a torn mix;
- a source-backed reset ledger enumerates every sound-affecting stateful processor and a
  mutation removing any reset hook fails; charged delay, reverb, feedback, filter, and
  modulation histories are all causally silent after terminal readiness;
- actual VST3 chunks, AUv3 `fullState`, packaged browser restore, and generic presets run
  with the editor closed where applicable; MIDI during delayed valid restore,
  partial-send failure, or rejection is discarded, audio is zeroed, processing continues
  for acknowledgements, and no event is replayed when readiness opens. A sustained
  pre-restore voice whose note-off arrives during the gate is reset and cannot reappear;
  charged delay/reverb tails and other stateful rack histories are also absent after the
  terminal reset;
- one product instantiation owner starts the independent lanes, with no duplicate
  listeners/publishers and no monolithic combined service;
- `uiPatchValues`, its parser, writers, generated artifacts, and compatibility tests are
  absent.

#### UI-HARD-CUT-01 — Real shared A/B/C controls — 4 points

Replace the legacy-A bindings in the existing shared synth hook with the accepted
oscillator address book. Keep desktop and iPhone layout shells separate, but give both
real A/B/C table and control editing. Web uses the desktop shell. Do not introduce a
cross-platform controller beyond the existing hook and binding contract.

Acceptance:

- all 22 controls for each oscillator bind to the selected oscillator only;
- selecting a tab writes nothing and resets to A on remount;
- one B table action and representative B control write emit only B addresses on each
  platform;
- controls without a MOD runtime destination expose no mapping/articulation-mapping
  affordance and cannot create any hidden stored mapping;
- no pending/unavailable B/C presentation remains;
- global effects and the protected Filter/Distortion visuals remain connected.

### Tranche C — atomic product cut and deletion

#### PRODUCT-HARD-CUT-01 — Switch the product once — 8 points

Activate the canonical renderer, indexed scheduler, parameter model, restore module,
and real UI together in the desktop, iPhone, and Web products. This is the only product
activation commit and the merge checkpoint for Tranche B.

In the same ticket, delete:

- `enableExternalRenderer` and every default-off/fallback branch;
- the legacy scalar-A render loop and exact-float A table bank;
- scalar-A table request/ack/load/failure message types and endpoints;
- old scalar A root control names and UI bindings;
- duplicate A table mirroring and its temporary memory-budget comments;
- `uiPatchValues` and held combined patch-base publication behavior;
- `uiMappings.v1`, durable `articulationTriggerConfig.v1`, complete inherited-base ART
  images, and all base-triggered ART rebuild machinery;
- retired synth-local `mseg1.shape`/`playback`/`depth` controller modules, build entries,
  declarations, tests, and generated outputs;
- `modulation.v4` morph duplication and every dual-write/synchronization path between
  MSEG morph parameters and the modulation document;
- pending B/C UI copy and platform capability switches.

Also reconcile the durable documentation: ADR-014 keeps sparse durable ART storage but
its complete inherited-base runtime image is superseded by fixed override/presence
images; ADR-020 and the adapter command map must name the new parameter/MOD/ART owners
and atomic hard-cut ticket rather than the retired HOST-02 plan.

Acceptance:

- one root exposes only canonical `oscA*`, `oscB*`, and `oscC*` controls while preserving
  `hostSlot0Guard` first;
- all shipping manifests use the same root and renderer algorithm;
- one product instantiation owner coordinates the independent table scheduler, rack owner,
  MOD lane, and ART lane with no duplicate listeners or publishers;
- FLOW A/B/C pass on desktop, browser, and iPhone simulator;
- grep/source guards prove every listed transitional symbol and artifact is gone;
- the packed A/B/C table pool is the sole table representation;
- `modulation.v5` is the only modulation document and retains the exact 884-pair domain;
- native MIDI/audio readiness stays closed until parameter, rack, MOD, ART, trigger, and
  all three stable table identities agree on one DSP session, the correlated full DSP
  transient reset completes, and matching `RestoreApplied` proves the terminal fence
  crossed the target performer with the expected `artEpoch`;
- ADR-014 and ADR-020 are explicitly amended/superseded where their complete-image,
  v4, or old-owner rules conflict; `COSIMO_ADAPTER_COMMAND_MAP.md` contains only the v5,
  fixed-presence, current-owner model. A documentation consistency test/source audit is
  a merge gate, not deferred cleanup.

### Tranche D — qualification and delivery

#### QA-CORE-02 — Cross-revision sound and lifecycle qualification — 4 points

Run the frozen oscillator-A differential across identity, warp, unison, retrigger,
replacement, modulation, articulation, filter, and note lifecycle. Add isolated B and C
and summed A/B/C causal checks. Retain the 884-route and populated-zero-count suites.

#### QA-STATE-02 — Cross-container state and drift qualification — 4 points

Exercise the exact same logical snapshot through native plugin state, AUv3 state,
browser durability, and synth presets. Require identical parameter/document results,
three selector parameter values with matching active table identities, matched MOD/ART
epoch activation, and audio after restore.
Independently mutate each schema dimension and require fail-closed browser/preset writes plus native muted/MIDI-gated
rejection with no mixed sound. Verify compiled host-slot order, parser version discipline,
auxiliary preset-library separation, trigger derivation, durable last-valid state, and
the exact 0–237 table range/content identity. Exercise partial-restore state capture and
continuous native automation across performer rebuild, publication, fence, and readiness
 plus immediate post-burst browser edits. Measure the bounded native ingress-lock deadline,
 the independently frozen FNV-1a-64 parameter-image contract, deliberate mismatch,
 rack terminal-fence ordering, and note-start presence resolution; prove
every base edit performs zero ART compile/upload
while the Cmajor callback remains allocation-free and bounded. Charge voice, delay,
reverb, feedback, and modulation histories before restore and prove the terminal reset
removes every old transient across all four carriers.

#### QA-DESKTOP-02 — Desktop product delivery — 4 points

Run FLOW A/B/C in the fresh HMR standalone and compiled wrapper, build/install the VST3,
strictly verify its signature, run pluginval, and verify actual provider calls plus
isolated A/B/C output. Exercise the actual VST3 state chunk with the editor closed and
MIDI arriving during restore, proving gated events are discarded and a fresh post-ready
note uses the committed epoch. Keep the locked keyboard, Filter, Distortion, and generic
X/Y interaction proofs.

#### QA-WEB-02 — Browser product delivery — 4 points

Run FLOW A/B/C in the packaged Web product in Chromium and WebKit. Verify the actual
AudioWorklet, complete parameter persistence, renderer WebAssembly invocation, recovery
after a browser reload, gated valid/failed preset restore, and deadline/load reporting.
No A-only fallback result counts.

#### QA-IPHONE-02 — AUv3 and physical-phone delivery — 4 points

Rebase the useful `AUV3-HARNESS-01` work after the cutover. First prove FLOW A/B/C and
renderer invocation through actual AUv3 `fullState` in the simulator with the editor
closed. Then perform one bounded signed install and physical smoke on the connected
phone: AU discovery, out-of-process instantiation, 48 kHz non-silent A/B/C audio, and one
editor-closed sentinel save/restore with exact post-restore parameters/documents/table
IDs, gated MIDI, renderer identities, and isolated/summed causal deltas. Retrieve one
structured result. Performance or Effects Lane conclusions happen only after this
functional gate.

#### PERF-PRODUCT-02 — Post-cut product performance — 4 points

Only after all functional QA passes, rerun the accepted modulation matrix and renderer
load/deadline measurements on desktop native, Chromium, WebKit, and the physical iPhone.
Use the complete A/B/C product, 884 stored-domain coverage, accepted 100-active profiles,
and all effects enabled. Compare against explicit baselines; do not reuse default-off,
A-only, atlas-diagnostic, or pre-cut rack-only evidence and do not infer an Effects Lane
budget from this measurement.

Implementation result: the complete native generated product and the packaged Chromium
and WebKit products now execute the accepted 100/200/884-route profiles with 16 voices,
all three oscillators, and all effects. Native qualifies as `product-shipping`; both
browsers remain real-time with no frame discontinuities. The former synthetic 2x browser
callback multiplier is not a shipping requirement. A bounded physical-iPhone benchmark
attempt stopped in the isolated registration launcher before AU discovery, so no device
performance number is claimed; the separately verified signed shipping app remains the
physical functional gate.

## Stale ticket disposition

| Previous ticket | Disposition |
| --- | --- |
| `STATE-BIND-02` | Retired. No `uiPatchValues.v3`; schema ownership moves to `STATE-SCHEMA-01` and lifecycle to `STATE-RESTORE-HARD-CUT-01`. |
| held `RT-02` / `e61abb13...` | Do not merge. Reuse only proven correlated-lane logic and tests after removing patch-base storage/publication, base-dependency rebuilds, and the monolithic combined-service shape. |
| complete inherited-base ART images / durable trigger config | Replaced by `ART-INHERITANCE-HARD-CUT-01`: fixed overrides/presence bits and trigger data derived from the accepted ART epoch. |
| `uiMappings.v1` / `articulationTriggerConfig.v1` | Deleted. Inert mappings without runtime destinations lose their UI affordance; accepted ART derives the native trigger event. No compatibility reads remain. |
| `HOST-PROVIDER-02` / `ABI-JIT-02` + `IOS-RENDER-02` | Replaced by one `RENDER-NATIVE-02` adapter over the existing bridge; there is no platform provider registry. |
| `WEB-RENDER-01` + `WEB-RENDER-02` + browser fallback/manifest work | Replaced by `RENDER-WEB-01`; route-selection, pure-Cmajor fallback, A-only manifest, and runtime zero/trap fallback are rejected. |
| `HOST-TABLE-02` | Rewritten as in-place `TABLE-HARD-CUT-01`; no parallel controller. |
| `SHARED-BIND-02` | Retired as a mixed-layer controller; its UI work moves into `UI-HARD-CUT-01`. |
| `HOST-ROOT-02`, `HOST-WORKER-02`, `HOST-CUTOVER-02` | Collapsed into the atomic `PRODUCT-HARD-CUT-01` merge checkpoint. |
| pending desktop/iPhone B/C UI tickets, including `UI-IOS-01` commit `15c3248...` | Replaced by `UI-HARD-CUT-01`; reuse its tested iPhone tab/layout shell, but replace pending-only B/C cards with real bindings before merge. |
| `AUV3-HARNESS-01` | Retained as qualification infrastructure, rebased only in `QA-IPHONE-02`; its old RT-01 readiness labels are not accepted product evidence. |
| MOD v4 support/benchmark fixtures | Routing/compiler work is retained, but persistence advances to v5 by removing MSEG morph fields; all active fixtures and tools hard-cut with no v4 read. |
| existing QA/performance tickets | Replaced by `QA-CORE-02`, `QA-STATE-02`, platform QA, and `PERF-PRODUCT-02`; default-off/A-only/rack-only evidence is obsolete. |

## Completion condition

The roadmap is complete only when the accepted product has one renderer, one indexed
table path, one parameter/state model, real A/B/C controls, and the public desktop, Web,
and iPhone product gates pass. Passing isolated modules while any old product path
remains is not completion.
