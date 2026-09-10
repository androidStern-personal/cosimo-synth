# Plugin state implementation

Status: audit fixes and module test matrix reviewed; beginning vertical module slices.

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
master merge, push, deployment, installed plugin replacement, or DAW manipulation
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
