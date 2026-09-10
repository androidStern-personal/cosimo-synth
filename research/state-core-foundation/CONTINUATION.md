# Incomplete implementation checkpoint

The goal remains active and incomplete. Do not substitute the current foundation
or a small parameter demonstration for the requested integrated system.

## Current source

- Root branch: `codex/plugin-state-system`.
- Reviewed adapter/view checkpoint: `f9aee941`.
- Reviewed native/browser qualification checkpoint: `1e4c1d4d`.
- Isolated Cmajor branch: `codex/plugin-state-system` in the dedicated
  `plugin-state-cmajor` worktree; latest local commit `9ed4f96` adds explicit
  client detach. Nothing was pushed or deployed; the default dependency pin is
  still the older Cmajor source. Default-build migration is not complete.
- Four unrelated dirty trackers and old untracked research remain untouched.

## Latest evidence

Root independently ran the current core suite: **96/96 pass**, ~484 ms;
React/browser suite: **5/5 pass**, ~1.2 s; assembled actual production browser
worker/React/AudioWorklet/DSP: **6/6 pass**, ~3.1 s; root TypeScript passes.
The current dedicated Cosimo integration test is **1 pass / 1 fail**. Its failure
is intentional unfinished action wiring, not a passing migration.

Before the last fixes, the native production QuickJS probe passed all its real
worker/parameter/curve/history/restore/DSP scenarios. The native and browser
channel agent subsequently reported **16/16 each** including explicit detach.
Do not mislabel the root's latest browser rerun as a rerun of that native binary.

The required independent reviewers all terminated with an account usage-limit
error. They are not still running. New independent review is required for the
latest detach/React changes and every remaining integration slice. Their earlier
review passed the foundation before these integration-driven findings.

## Two integration-driven foundation repairs

1. `createCmajorPluginStateClient.stop()` now sends an explicit, scope/client
   checked native detach before unsubscribing. It releases an owned gesture while
   the native view stays alive. Native/browser routing reject stale, repeated and
   foreign detach. Root added two distinguishing public adapter regressions,
   including send/removal faults and irrelevant reset messages. The assembled
   browser regression checks that another GUI can Undo **before reattachment**;
   reattachment would otherwise mask broken stop cleanup. The existing React view
   test was adapted only for the newly added detach message, retaining the full
   ordered command and cleanup assertions.

2. Installed Jotai 3's React hook reads during render and subscribes in a passive
   effect without rereading. The real Cosimo fast-boot test exposed an update lost
   between those operations. Root reproduced this deterministically in the shared
   React test with a layout-effect delivery: RED `undefined !== 8`, then GREEN.
   `plugin-state-react.tsx` now uses React's `useSyncExternalStore` directly over
   Jotai `store.sub/get` for both field and history atoms. Jotai still owns state,
   dependencies and listeners; there is no second notification system. The actual
   Cosimo test now hydrates correctly and fails later at its unimplemented drag.

## Next vertical slice

New, unwired app files:

- `ui/shared/synth-plugin-state.ts`: Voice group declaration.
- `ui/shared/synth-plugin-state-react.tsx`: provider and hydration-only adapter.
  `setValue`, `commitValue`, `beginGesture`, `endGesture` are currently empty
  scaffolding. They must be implemented, reviewed and tested before wiring any
  existing control to them.
- `tests/test_synth_plugin_state_browser.mjs` and its dedicated fixture: actual
  framework service/client/React adapter plus the production Cmajor channel.
  First test proves native values/defaults/readiness. Second currently fails
  at expected immediate value 5 versus unchanged host value -7.5. Preserve this
  assertion and implement the action path next.
- `tests/helpers/plugin_state_test_platform.mjs`: external native parameter port
  for an injected actual Cmajor channel. It does not implement history, versions,
  acceptance or snapshots. Do not import this test helper into production UI.

The chosen first real integration slice is Cosimo Voice `playMode`, `glideTime`,
`globalTune`. Preserve the existing `PatchControlBinding`, host baseline, edit bus,
programmatic-write suppression and gesture behavior. Append one service to the
existing worker host; use one provider per complete Desktop/iOS view; replace only
the three old parameter bindings; add clearly scoped Voice Undo/Redo controls.
No app-owned cleanup registry or second history ledger.

This is a first integration slice, not a claim that Cosimo's MSEG/whole state has
been migrated. SeqFX review identified several protected behaviors that cannot be
changed merely to fit the candidate: gesture-end persistence with live uploads,
strict legacy-key migration, synchronous Undo and revision rewriting, and distinct
recall/upload authority. Cosimo MSEG is part of the whole modulation bank and
acknowledged modulation/articulation owner, not the legacy standalone controller.
Further integration scope must continue to serve the full approved goal.

## Existing fixtures and normal build still to adapt

The new runtime must be available through the normal source pin before making
existing controls depend on it. Do not silently fall back to old ownership or pin
an unpublished commit as if it were remotely fetchable. The shared source pin is
`kit/cmake/CosimoDependencies.cmake`; browser staging copies the entire pinned API.
`kit/toolchain.json` has blank release-template hashes: preserve honest provenance,
and do not label old prebuilt tools as rebuilt. Release configs/notices contain
matching source pins and existing checks must remain strict.

Existing fixture APIs needing channel adaptation, with assertions preserved:

- `ui/shared/patch-connection-mock.ts`, also inherited by scripted harnesses.
- Two plain connections in `tests/helpers/desktop_patch_view_browser_suite.mjs`.
- Native-shaped switch in `tests/helpers/ios_harness_browser.mjs`.
- Three direct view-model roots in
  `tests/helpers/desktop_patch_modules_browser.tsx` need the provider.
- Full-worker cases' `FakeWorkerPatchConnection` in
  `tests/test_wavetable_worker.mjs`; direct controller tests need no change.

Complete these vertical slices, independent reviews, existing regression suite,
normal-build source/runtime qualification and completion audit before marking the
goal complete. No release, DAW or listening acceptance is currently established.
