# Plugin state implementation

Status: reviewed core, Cmajor adapters, generated worker and React view implemented;
actual native composition passes. Browser composition and plugin selection review
are in progress. No existing plugin has been migrated yet.

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
