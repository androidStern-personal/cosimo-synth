# Plugin state implementation

Status: audit and test planning. Production implementation has not started.

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
