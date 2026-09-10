# Plugin state implementation

Status: the automatic prepared-state declaration, stock complex-data delivery,
compiled receiver/storage, and cleaned public hook surface pass their module and
native integration gates. Three Cosimo Voice controls use the framework;
structured plugin migration is next. Modulation is not migrated. Earlier
checkpoint results below describe their exact candidates, not later changes.

Branch: `codex/plugin-state-system`, starting at `44f179fdb9c35b27456bedfdf389ec563f5c9a85`.

## Authorized outcome

Implement small, independently testable framework modules for shared plugin state,
history, GUI interaction, persistence and engine delivery. Use Jotai for local
reactivity. Hide worker/channel machinery from plugin authors. Different engine
transports remain supported; a local accepted edit must not claim engine application.

The two `module-design-*.md` files record the independently designed and reviewed
starting proposal. They are not evidence of implementation. The following later
decisions supersede their single-gesture/interruption policy:

- Protect each actively dragged field against other GUI/agent writers; return busy.
- Independent fields can be edited concurrently.
- Conditional edits compare a field version, not the whole plugin revision.
- DAW automation remains host-owned; observe it without history or echo writes.
- GUI and agent edits share history. No selective per-author Undo is promised.

Implementation defaults being tested: Undo/Redo refuses while a gesture is active;
completed groups are ordered by their last accepted edit, not pointer release.
Host automation does not change that history order. Client detach closes only its
own groups. An unchanged group contributes no history entry.

## Required order

1. Audit existing tests and identify useful coverage, weak tests, missing coverage,
   and measured runtime costs. Preserve existing protections.
2. Tighten the suite and freeze a module state/invariant matrix with independent
   review. A written matrix is not a batch of speculative tests.
3. Implement one behavior at a time: failing public-interface test, minimum working
   implementation, green test, refactor. Record red/green evidence per slice.
4. Independently review tests for false confidence, swallowed failures, fixtures
   that implement the behavior being asserted, and untested failure paths.
5. After all module gates pass, refactor the best-covered suitable plugin. Existing
   tests remain unchanged except mechanically necessary API adaptations preserving
   assertions. Run the complete relevant regression suite.
6. Qualify actual runtime integration. JavaScript connection fakes do not prove
   native routing, real worker lifetime, host restore, or audible engine delivery.

## Safety and evidence

Unrelated dirty trackers and other research remain untouched and unstaged. No
master merge, product release, deployment, installed plugin replacement, or DAW manipulation
is part of this implementation without separate scope. Native build artifacts
use a task-specific build directory. Do not modify downloaded dependency caches.

Test integrity is a release gate. No skipped, deleted, narrowed, or relaxed test
may disguise a defect. Audit-stage replacements require equal-or-stronger behavior
coverage and independent review before removal. Prefer retaining an existing test
when its value is uncertain. Baseline failures are recorded, not normalized away.

## Audit checkpoint

- Independent audit: `TEST-AUDIT.md`; independent matrix/review:
  `TEST-MATRIX-REVIEW.md`; actual platform seams: `NATIVE-TEST-SEAMS.md`.
- Six new mirror lifetime regressions run through the existing public connection
  and delivery interfaces. The first three were added separately, observed red,
  then repaired. The three old-outcome cases characterize the repaired ownership.
  All 17 pre-existing mirror tests are unchanged. This fixes bookkeeping and late
  callbacks; the legacy transport cannot cancel a send already in progress.
- Repaired vacuous asynchronous echo test and swallowed-error property. Independent
  review additionally required exact parameter outcomes and genuinely reordered
  echoes; both repairs are included. Existing seeds and run counts are unchanged.
- Runtime install test timeout cleanup reduced the unchanged 18-case file from
  1,129 ms to 121 ms on this machine. Fixed a nonexistent snapshot-bank runner path;
  its real qualification phase now runs all 16 tests successfully.
- Default `npm test` retains all 127 previous unique test paths and adds the new
  lifetime file. It runs a duplicated build-argument file once. The two pure
  property files move to a two-process step with the same cases and seeds.
- `npm run test:state`: 102/102 passed in 4.55 s. Reviewed audit subset: 60/60.
  Typecheck baseline passed. These are Node/public-module results, not native or
  browser composition proof. No complete `npm test` result claimed yet.
- Jotai 3.0.0 is pinned for the forthcoming implementation. Earlier library
  experiments do not qualify the new modules or native bridge.

Integration target: SeqFX's structured state, based on the audit's existing public
Undo/preset/worker and property coverage. Scalar host binding remains separately
qualified. The plugin refactor has not started and remains gated on module tests.

## Engine binding checkpoint

`plugin-state-engine.ts` is independently reviewed; 13 public-seam tests pass
(including two using Cosimo's real authored MSEG renderer). The private Cosimo
renderer tests stay under root `tests/`, outside the customer kit. Strong isolated
TypeScript checks pass. The default and focused state runners include these tests.

Behavioral red/green steps caught: obsolete preparation sending after a newer
curve; a transport resuming an obsolete send after readiness; stop waiting forever
for stalled preparation; discarded unexpected diagnostic causes; reuse of a
completed send permit; reuse of an unexpectedly damaged transport; and a nested
replacement being overwritten during cancellation. Additional cases check late
acknowledgement/rejection, document replacement with equal generation, expected
resource/delivery failures, and shutdown from a progress callback.

Reviewed adjustment to matrix E4: a pure preparation defect fails/cancels its
request and retains the diagnostic cause, but a new edit may try again. It has not
mutated accepted state or entered the transport. An unexpected transport defect
closes the binding and transport permanently because delivery may be partial.
Expected typed resource/transport failures can recover on a fresh request. The
independent reviewers accepted this distinction; it is not a relaxed test.

This is engine-module evidence, not proof of a real acknowledgement protocol or
native/browser teardown. Final physical sends use a scope-checked permit after
transport readiness waits. Cancellation is portable and does not assume a browser
AbortController exists in QuickJS. Arbitrary external promises cannot be forcibly
stopped; owned tasks settle and consume their late rejection, and revoked permits
prevent later framework-authorized sends.

## Session and GUI client checkpoint

The reviewed core now passes 57 tests: session 27, client 17, engine 13. Both root
and stricter isolated TypeScript checks passed during review. The coordinator
independently reran all 57 against the frozen candidate (77 ms). Tests use public
constructors, real Jotai subscriptions, controlled external delivery, and one
session composed with the actual engine binding. They do not qualify raw-wire
parsing, React controls, native QuickJS execution, or browser AudioWorklet wiring.

Session tests cover shared Undo/Redo, per-field gesture ownership, both release
orders, field versions and ABA, host automation without echo/history, exact
100-entry retention, reset/detach, failed publication, subscriber/codec/port
faults, dependency-driven engine preparation, stale completion and owned cleanup.
Review caught two additional defects: quick scalar edits used stale host values
as successive history baselines, and one failed cleanup abandoned another pending
cleanup. Both gained distinguishing failing tests before repairs. `canUndo` and
`canRedo` mean actionable now; busy/closed states retain history internally.
Scalar application starts unconfirmed, becomes pending for an owned send, and
uses native-publication-processed evidence only after the matching native reply.

Client tests cover immediate immutable drafts, attach/update races across scopes,
foreign and reordered receipts, correct sequence allocation, reentrant subscribers,
failed readiness, callback/codec/send faults and subscription cleanup. Reset and
close distinguish unsent rejection from sent-but-unacknowledged unknown acceptance;
neither automatically replays edits. A parsed accepted receipt remains accepted
even if GUI projection subsequently fails. Independent review found and required
three additional regressions: another scope hiding a newer attach snapshot,
synchronous subscription closure leaking the listener, and a retained failed value
being treated as editable. All now pass.

The customer dependency allowlist and template lock include exact Jotai 3.0.0.
The lock update contains only that dependency, with no temporary machine paths.
All eight export tests pass. The default and focused test commands include the new
modules; the plugin refactor still had not started at that checkpoint.

## Cmajor adapter and author API checkpoint

The current `npm run test:plugin-state` passes all 94 cases (about half a second).
The added coverage exercises the raw adapter, malformed messages, old attachments,
bounded payload conversion, real MSEG preparation, actual generated worker build,
and the previously reviewed core. `npm run test:plugin-state:browser` passes four
actual Chromium/React cases (about 1.1 seconds). Root TypeScript passes. Independent
test review and a separate coordinator rerun agree on these results.

Author code declares parameters/stored values and optional ordinary event
preparation, selects `stateSource` in the plugin config, and supplies a React view
through `createStatefulPatchView`. It imports the public `kit/index`. Generated
worker startup and view cleanup own the service and client respectively. No
author worker script is required. The existing worker host now awaits every
cleanup even if another cleanup fails; the original 17 tests were retained and
one distinguishing failure/recovery test was added.

The Cmajor adapter is the raw-message boundary. Startup and attach have bounded
deadlines; exact native client incarnations prevent an old attachment from editing
as a new one. Full command preflight occurs before allocating a sequence. An
independently valid receipt remains usable when its accompanying snapshot fails.
The generated worker's public import required an explicit kit side-effect policy:
unused DOM component declarations are removed while preview/dev-tool entry effects
and CSS are retained. The customer dependency allowlist/template lock now include
React DOM and its types. All eight export tests pass.

Three capped subprocess tests distinguish bounded refusal from expanding cyclic
or shared graphs and oversized typed samples. They drive the actual public service,
verify no native event escapes, and then recover with a valid edit. Conversion
charges the native budget during traversal, before allocating the full payload.
The child heap/time caps contain the original failures without hanging the suite.

The event binding reports native-publication-processed, not an invented DSP
acknowledgement. Pure preparation and expected delivery failures fail the target;
unexpected channel/transport faults close the owner and retain the diagnostic.
This binding is a bounded event transport, not the deferred large-asset design.

## Actual native composition checkpoint

`tests/native/run_plugin_state_system_probe.sh` builds the authored fixture through
the actual runtime builder and runs its generated public-Kit worker inside the
pinned native QuickJS engine. It uses real PatchViews, native saved state, host
parameter callbacks and generated DSP. It does not inject worker replies.

The complete native probe passes: current host value 2.5 versus default 1; saved
curve boot; curve and scalar gestures; shared Undo/Redo; automation supplying the
next Undo baseline; closure of every GUI; natively routed edits surviving closure;
coherent full restore fencing old commands/host FIFO values; and event preparation
with a declared parameter dependency reaching the actual DSP throughout.

Two genuine integration failures were repaired with unchanged behavior assertions:
QuickJS lacks `Array.at`, requiring three equivalent last-element accesses; and
stored publication completion dropped an engine target, leaving the GUI stuck at
preparing even while the real DSP had received the curve. The target fix gained a
public session regression. The existing reference-stability test caught an initial
allocation regression in that fix and was preserved while the code was corrected.

The exact worker hash for the passing native probe is
`56cc60bdc87dceacbd9180b85a1740ef4daa4ed5de539f6f11eb82596b74b5e0`.
Reproducible per-run source/runtime/header/executable hashes are written to
`build/native_plugin_state_system/probe-result.json`. The runner takes explicit
isolated source/runtime paths; no downloaded dependency cache was patched.

Cmajor source is isolated on branch `codex/plugin-state-system` in the dedicated
`plugin-state-cmajor` worktree. Native changes are `7d6d5753` and `18c4f2e`;
`a2cd70c` repairs the exact source compiler's existing include path so the real
generator can build. Reviewed browser channel source is committed as `3d1ba296`.
At this checkpoint the pin was still local. It has since been published on the
Cmajor feature branch at `9ed4f96` and the root implementation now pins that exact
revision. This is not a released Builder Kit or a master merge.

The separate native channel probe has 15 passing routing/lifetime cases; the
browser channel has 15 passing actual AudioWorklet cases. Those channel probes
are distinct from the assembled framework/native test above and the assembled
browser test currently in progress. No DAW/listening acceptance is claimed.

## Complete existing suite and remaining integration decision

The complete `npm test` passed after the initial foundation checkpoint. Its only
skip was the pre-existing optional decoded-Float32 corpus case because the local
Spectre corpus was unavailable. No failure was hidden. Later module additions
have been rerun through the focused commands; a later full run is still required
after plugin integration.

The two preserved seeded SeqFX property files remain the expensive phase (about
111 seconds concurrently). A CPU profile of the state-property file (53.5 seconds
with profiling) attributes about 14.6 seconds to dense-array construction, 6.4 to
recursive freezing, and 5.8 to parameter default construction. This is actual
domain generation/transition cost, not justification to reduce seeds, run counts
or assertions. The earlier timeout/deduplication/concurrency improvements remain.

Read-only migration review found material SeqFX requirements not represented by
the candidate API: save at gesture end while uploading live; synchronous Undo
with per-pattern revision rewriting; legacy key migration/null fallback; and
explicitly tested preset upload behavior. Direct replacement would change those
protections or add several special cases. The integration choice is being compared
against a focused Cosimo migration before changing either plugin. This preserves
the requirement to regroup when the migration pressures module design.

## Default build dependency qualification

The dependency feature branch `codex/plugin-state-system` is published on the
existing Cmajor fork at `9ed4f96cc70996a8e4ab2e6aa13decb0460e260a`. Production CPM,
toolchain source identity and live product notices now agree. Existing test
expected pins changed only to match that API/dependency identity; no assertions
were weakened. Notice file SHA was recomputed; historical qualification evidence
and blank prebuilt archive hashes remain unchanged.

Root results: cold CPM **5/5**, release dependency/toolchain **15/15**, release
builder **35/35**, and normal web runtime staging includes the real channel module.
Release checks use the already approved Node22.22.3 binary outside the repository;
its exact approved SHA matches. Canonical TMPDIR avoids the pre-existing macOS
/var vs /private/var fixture-origin mismatch. No approval hashes changed.

Independent review checked the consistent pins, notice SHA and retained strict
qualification gates. Root app integration uses the production channel/service in
the dev host; its three public helper tests cover delayed startup, stopping before
module load, and releasing pending parameter-read subscriptions on stop.

## Reviewed Voice integration checkpoint

`1805e022` pins the remotely fetchable Cmajor extension; `66e642e3` records the
reviewed adapter and accepted-change evidence. Accepted edits now explicitly report
`changed` after native parameter rounding/domain equality. This prevents refused
or no-op writes from masquerading as audible-preview edits. Captured suppression
and ordered completion notifications preserve existing direct-user gesture order
even when actual receipts arrive end/edit/begin. No second value/history owner.

Root updated only fixture native-notification seams for raw parameter writes and
legacy host Undo, with actual Mock browser regressions. Production Voice source
uses the shared owner in three existing controls. Module and focused app reviewers
approved source and test integrity; final broad regression diagnosis remains in
CONTINUATION.md. Generated UI/worker artifacts were rebuilt from current source.

Full default suite:1301 passes, one existing optional-corpus skip, zero failures;
eleven phases retained. The unchanged heavy property phase is111.8s. New state
module/helper phase is101 tests in~508ms. Root current native rebuilt fixture worker
SHA is `aba172f97c73b1804ae8593ea62bd50287202d8c3c1fc5907a5d50caa5fccfb9`, exact
Cmajor9ed4f96; actual DSP/automation/restore/history groups pass.
# Guarded history continuation

The shared ledger now exposes opaque document-scoped head references. Changed
one-shot edits and nonempty gesture ends return their own entry reference;
optional guarded Undo/Redo rejects a different head without any state or native
effect. Existing sealed edit order supplies identity, with no new counter or
history ledger. Public React calls preserve the guard through client preflight,
wire parsing, and the session's single transition queue.

Independent qualification: new history 9/9, history plus existing session 37/37,
React browser 6/6. Root full plugin-state module command passes 110/110 and strict
TypeScript passes. Existing exact expectations were extended only for the new
receipt/head fields; value, version, ordering and publication assertions remain.
Actual native/browser system probes have not yet been rebuilt for this extension.

## Explicit invalid-state recovery

The internal client/session protocol now distinguishes recovery from ordinary
editing. A stored field failed with invalid saved data accepts one validated
`recover` command guarded by version zero. It establishes version one without
inventing a before-value or changing either history stack. Ordinary edits to a
failed field remain refused. The public React setter selects that command; no
additional author-facing call is needed.

Raw stored-state replacement may retain previous valid display values while
readiness remains failed. The replacement still resets the document/history and
blocks obsolete work. This display rule never repairs saved data automatically.
Normal full restore does not retain values from the previous document.

Independent recovery review passed 61 combined core tests, all seven React cases,
and strict TypeScript including exact optional properties and unchecked index
access. Tests caught a real equal-primitive recovery bug: readiness becoming ready
must start engine preparation even when the retained display value is unchanged.
The five new recovery tests cover that repair, concurrent guards, retained history,
wire parsing, drafts and replacement. Existing assertions were not modified.

## Custom engine protocol composition

The Cmajor adapter accepts static custom binding factories in addition to ordinary
eventValue declarations. Factories receive only a captured-scope event/host-effect
publisher, target status reporting and terminal defect reporting. The session
retains all accepted-state/history ownership. One adapter request counter and map
correlate native completions for both kinds of binding.

Tests exposed and repaired rejected old replacement cancelling current work,
prototype lifecycle methods lost by object spread, factory failure reopening a
closed service, caller scope mutation breaking receipt correlation, and unknown
effect kinds being coerced into host effects. Configuration preflight precedes
factory allocation; shutdown waits for every returned port, including a port
returned after synchronous construction failure.

The actual existing RuntimeInstallLane is exercised with the actual service and
an external ACK schedule. A thrown first send remains uncertain and the lane
proves a drop before replaying the exact serial/payload. This is an assembled
module test, not actual DSP evidence. Native host-effect routing is being
qualified separately before the Cosimo modulation owner changes.

## Resumed objective — approved engine-data contract

The author authorized resuming on 2026-09-10 after reviewing the following target.
This extends the original state/history objective; it does not declare the existing
custom binding experiment complete or authorize installing/releasing a plugin.

- Preserve a small author declaration: preparedState({ schema, initial, prepare,
  engine }) alongside parameter state. Automatic framework startup owns the worker;
  authors do not compose worker services to select either stock or custom delivery.
- TypeScript preparation converts editable values into the required representation
  outside audio processing. A TypeScript callback is not a native/Cmajor receiver.
  Framework engine storage/receiving and the component's DSP reader are separate.
- The stock complex-data module owns bounded transfer, completeness, correlation,
  replacement and storage lifetime. Formats and receivers have explicit extension
  seams; supported cases do not require a product-specific transport.
- A replacement is private until complete. Published data is immutable. Related
  metadata/arrays are one engine value when they must become visible together.
- Ordering is per input. Obsolete completions cannot replace a newer applied value;
  independent inputs do not share a global schedule. Intermediate targets may be
  superseded. Capacity, cancellation, shutdown and uncertain delivery have explicit
  outcomes; lost acknowledgement is not proof that installation failed.
- Current readers follow completed replacements. Held readers retain their chosen
  version until released/replaced. Neither active nor held storage can be reused.
  Preserve Cosimo's current behavior: wavetable oscillators follow replacement;
  playing bounce notes retain their original bank. Do not add per-note wavetable
  retention or change oscillator phase/reset semantics.
- Allocation, preparation, I/O and reclamation stay outside audio processing.
  Audio-side work is bounded. Memory and outstanding work are bounded. Overload
  refuses safely instead of overwriting retained data or growing without limit.
- GUI closure does not end plugin ownership. Reset fences old work and coordinates
  readiness before dependent DSP reads. Teardown does not require another render.
- Shared Undo retains editable values and required source assets. Engine storage
  retains playback data; it is not an unlimited archive of historical buffers.
- Existing per-field gesture ownership and whole-value editing remain the accepted
  scope. Do not add multi-field transactions or selective Undo during this work.

### Implementation and test order

1. Preserve stopped diffs and independently review their tests; retain all existing
   assertions. Record the genuine gaps in automatic author setup and engine access.
2. Establish the first new tracer through actual compiled Cmajor: complete A is
   read by DSP; partial B cannot replace A; completed B becomes current while a held
   reader still reads A; exhausted capacity refuses a further load without damage.
   Use a production receiver/storage seam. A fake ACK list or standalone pointer
   class does not establish Cmajor integration.
3. Extend one red/green behavior at a time for stale/duplicate transfers, uncertain
   ACKs, capacity recovery, reader release, reset, suspension and destruction.
   Qualify actual backend differences; do not infer Wasm behavior from native tests.
4. Connect stock delivery and the custom extension to the public declaration and
   generated worker. Exercise author declaration -> actual worker -> DSP output,
   including Undo and closed-GUI restoration, before touching modulation ownership.
5. Independent reviewers gate new tests and source. Only after module/runtime gates
   pass, migrate Cosimo through the approved seam and run unchanged regressions.

The app goal was still reported paused at resumption. Available goal tools cannot
resume or rewrite an unfinished objective; this document records the clarified
scope while implementation continues in the current task. No goal completion is
claimed.

### First resumed repair

Independent stopped-diff review found native failed-publication cleanup could end
a new gesture created by a reentrant restore. The new real Patch/WorkerContext
probe reproduces the exact old-begin -> restore/end -> new-begin -> old-failure
schedule, for both callback refusal and throw. It checks the actual host gesture
trace, unchanged parameter, and the new owner's later explicit gesture end.

- RED: `build/native_plugin_state/resume-gesture-red.log` fails because old cleanup
  ends the restored document's new gesture. The initial test compile typo was
  corrected before recording this behavioral failure.
- GREEN: `build/native_plugin_state/resume-gesture-green.log` passes the new case
  and every existing native channel probe after per-iteration document guarding.
- Independent test/source review approved the regression and guard. Assertions
  run outside the throwing callback; no private native API or fabricated scope.
- Isolated Cmajor commit: `85f6f8a` (native host effects plus this correction).
  Not pushed or pinned into a release. Remaining browser diff is still separate.
- Current existing module suite: 144 pass, zero failures/skips, 566 ms in
  `build/native_plugin_state/resume-modules.log`. This is not managed-data proof.

Selected first data-storage mechanism: a parameterized, product-neutral Cmajor
module with preallocated word storage and readers. This gives actual compiled
Cmajor access without inventing JavaScript writes into native arrays. Transfer
copies have a shared bounded budget; activation and module reset change metadata,
not full buffers. Full performer reset, backend and bulk-size timing still require
qualification. The first new tracer checks every sample of current/held reads
through actual compiled Cmajor before adding capacity/failure cases.

### Resumed framework checkpoint

- `preparedState({ schema, initial, prepare, engine })` constructs no worker at
  import. The normal builder generates and owns its worker, delivery and cleanup.
  Custom `PluginStateDelivery` declarations use the same automatic composition.
- `engineData` handles finite packed-word transfers with actual receiver queries,
  acknowledgements, bounded retries, cancellation and immutable in-flight input.
  An acknowledgement is evidence of the receiver's current version; native send
  completion alone is insufficient. Unknown outcomes stay unknown.
- `kit::engine_data` owns staged/current/held slots. Commit and module reset change
  metadata. Banks can share one bounded copy allowance. Private word blocks repair
  the actual full-size Wasm array-metadata limit without changing the public API.
- Public control results omit internal revisions, versions and engine IDs. Undo
  entries are opaque tokens; guarded Undo/Redo and eligibility queries preserve
  editor-specific controls without another history stack or an identity cache.
- Actual generated worker -> Patch -> QuickJS -> Cmajor tests pass hydration,
  edit, shared Undo, GUI reopen and 6144-word packets. A real failed worker import
  also retains its original error after subsequent native notifications.
- Current sender/receiver suite: 12/12, zero failures/skips, about 12.6 seconds
  including intentionally lost-message deadlines. New failure tests exposed and
  repaired lost ACK handling, lost request replay, shared-budget refusal and an
  exception-path listener leak. All pre-existing receiver assertions remain.
- Full-size JIT, generated C++, and Wasm each pass the same eight-generation,
  every-index oracle for 3,279,616 words, including held readers, partial staging,
  activation, reset, page boundaries and the final partial page. Logical three-slot
  capacity is 39,355,392 bytes; padded word storage is 40,108,032 bytes plus metadata.
- Public hook/type tests and real native tests received independent adversarial
  review. The recovery test helper now waits for the actual projected result and
  its React layout commit; no sleeps or weakened assertions were substituted.
- `npm test` and strict TypeScript pass on this candidate. Full-suite output:
  `build/native_plugin_state/resume-full-suite.log`. One existing test remains
  skipped because its ignored local Spectre corpus is absent; no new skip exists.
  The focused state run within that suite passes all 158 tests in about 1 second.
- Cmajor checkpoint `e0d0cc7` preserves boot errors and completes reviewed browser
  host-effect routing, above `85f6f8a`. Both remain local, unpushed and unpinned.
- Root checkpoint `6e59aaa8` was exported into an independent tree. Its canonical
  typecheck, tests, example build and update-merge proof all passed; evidence is
  `build/native_plugin_state/resume-export-proof.log`.

Evidence boundaries: bulk tests invoke actual compiled performers, not a DAW.
Wasm's generated 6144-word input marshaling showed a 5.84 ms observed maximum in
one run; no full-size realtime AudioWorklet deadline or listening claim is made.
The configured 6144-word/64-frame allowance alone implies about 712 ms per full
table at 48 kHz before messaging overhead. Full Performer reset still clears
resident state and is separate from metadata-only module reset. Cosimo's existing
four-slot wavetable pool also shares capacity between oscillator inputs; separate
stock banks would consume more memory. These constraints must inform a real
plugin migration rather than being hidden by the small fixture.

### Reset qualification and the real-plugin migration

The actual native reset API replaced the Performer without notifying the state
owner. A new generated-worker/actual-DSP test observed stale acknowledged status
and retained Redo after the engine storage was gone. The reset now uses the
existing native document replacement barrier, preserving editable stored values,
invalidating old commands/history, and reinstalling the saved prepared value.
The first native reset RED/GREEN is recorded in
`build/native_plugin_state/resume-performer-reset-{red,green}.log`. Adversarial
callback-failure and reentrant-unload cases also pass. Cleanup attempts every
original gesture, preserves the first exception, and stops when a callback
replaces the owner/document. The adversarial tests first reproduced stranded
gestures, stale closure of replacement views and an unload crash; no existing
assertions were weakened. Full native channel and all four generated-worker/DSP
cases pass in `build/native_plugin_state/resume-reset-{channel,engine}-final.log`.
Browser
public reset had the same omission; two actual-worklet tests now pass, including
a held old effect refused after reset. Its 25 pre-existing outer tests also pass.
No additional transport invalidation API was added.

Independent migration reviews selected the existing Cosimo modulation/articulation
delivery coordinator. Rewriting the MSEG readers/storage would add unrelated DSP
risk. Adding coupled-field framework parsing would broaden the core unnecessarily.
SeqFX additionally requires gesture-end persistence, legacy-key migration and
revision rebasing on Undo; it is not the smaller takeover.

The pending Cosimo slice therefore moves the complete existing `modulation.v6`
editable value into the same session/history as Voice, with a client-backed GUI
projection. One existing delivery coordinator still orders modulation before
dependent articulation, through the already qualified advanced platform binding.
Its modulation stored-state intake is removed; independent articulation editing
and the wavetable/rack services remain outside this takeover. All sends and replay
must use the current document's scoped publisher. The stock author-facing
preparedState/engineData API remains available and automatically composed for
new components; this legacy integration does not establish stock-bank adoption
inside Cosimo's existing DSP.

The new GUI projection, shared GUI-client lease and engine adapter are being
tested before activation. Production state declarations, entrypoints and MSEG
Undo remain unchanged at this stage. The new lease tests use the actual Cmajor
channel and state service, with external native parameter storage substituted;
they do not claim actual host delivery.
