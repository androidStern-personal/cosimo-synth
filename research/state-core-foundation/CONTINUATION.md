# Incomplete implementation checkpoint

The goal remains active and incomplete. Do not substitute the current foundation
or a small parameter demonstration for the requested integrated system.

## Current source

- Root branch: `codex/plugin-state-system`.
- Reviewed adapter/view checkpoint: `f9aee941`.
- Reviewed native/browser qualification checkpoint: `1e4c1d4d`.
- Isolated Cmajor branch: `codex/plugin-state-system` in the dedicated
  `plugin-state-cmajor` worktree; latest local commit `9ed4f96` adds explicit
  client detach. That feature branch is now pushed to the existing Cmajor fork,
  and the root implementation pins exact `9ed4f96cc70996a8e4ab2e6aa13decb0460e260a`.
  A cold normal CPM resolution and web API staging both passed. No master merge,
  product release, deployment, or installed-plugin replacement occurred.
- Four unrelated dirty trackers and old untracked research remain untouched.

## Latest evidence

Root independently ran the current core suite: **96/96 pass**, ~484 ms;
React/browser suite: **5/5 pass**, ~1.2 s; assembled actual production browser
worker/React/AudioWorklet/DSP: **6/6 pass**, ~3.1 s; root TypeScript passes.
The dedicated Cosimo adapter suite advanced through six passing cases. Review
then exposed a real busy-edit preview notification bug, with a distinguishing RED.
Its repair and actual compiled Voice integration are in progress. The new compiled
Undo/Redo test has a genuine missing-button RED; existing UI assertions are intact.

Before the last fixes, the native production QuickJS probe passed all its real
worker/parameter/curve/history/restore/DSP scenarios. The native and browser
channel agent subsequently reported **16/16 each** including explicit detach.
Do not mislabel the root's latest browser rerun as a rerun of that native binary.

The account usage window reset and all three independent reviewers resumed.
They passed the detach/React fixes and are reviewing the current integration.
The module gate reopened; the new edit-receipt evidence and app adapter changes
still require their final review before migrating controls.

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
   Cosimo test now hydrates correctly; its actions and contention behavior are
   implemented and independently reviewed.

## Current Voice integration

Reviewed commit `66e642e3` implements actions, actual accepted-change receipts,
suppression-aware ordered edit-bus reporting, and the real dev native-host helper.
The subsequent uncommitted source wires only `playMode`, `glideTime`, `globalTune`
into the existing complete Desktop/iOS view providers and worker host. Scoped
Voice Undo/Redo controls are in the existing popover. No second app history ledger.

Current evidence: focused Voice **11/11**, helper **4/4**, actual compiled Voice
**3/3**, external legacy compiled write **1/1**, existing iOS **25/25**, selected
shared hooks **7/7**. Root full default suite passes **1301/1302** with the one
pre-existing optional Spectre corpus skip; all eleven phases completed. Actual
rebuilt native QuickJS probe and assembled browser/DSP probe pass against normal
downloaded pinned source9ed4f96; browser **6/6**, native six scenario groups.

Broad desktop qualification **324/327** on its first current run:
- Obsolete manual modulation mirror on the GUI fixture port created uploads that
  contradict the existing GUI-only ownership assertion. Removed that obsolete
  fixture worker; the unchanged ownership test now passes, as does new pageerror
  coverage. Real runtime installation is qualified separately.
- React Grab test expects auto-load inside webdriver automation, but pre-existing
  production code intentionally disables it there. Exact unchanged test fails on
  isolated pre-work source too. Test and guard remain unchanged.
- Polish expanded-editor close sometimes restores graph scroll0 instead of9.
  Root reproduced it twice; controlled comparison gave baseline5/5 passes and
  current4/5 passes. Passive traces identified hidden width177 becoming0, which
  changes compact layout and clamps all scroll restore attempts. A five-line guard
  preserves the last visible width while hidden; unchanged failing test then
  passed5/5, with first-attempt restore9 in the trace. No timing loop or test edit.
  Independent review passed four existing resize/layout cases. The final broad
  rerun passes this case and the unchanged GUI-only ownership case.

Final broad desktop run: **325/327**, `/tmp/plugin-state-desktop-final.tap`.
The remaining failures are the unchanged React Grab contradiction above and an
ADSR pointer-capture test race. Exact untouched pre-work source reproduces the
same ADSR bubble timeout. Minimal passive capture tracing records a failing
release with `hasPointerCapture=true`, `gotpointercapture=0`, and
`lostpointercapture=0`, with the original target still connected. The test has
observed pending capture, not activated native capture; the native loss callback
never arrived. Evidence: `/tmp/plugin-state-capture-pristine-results.json` and
`/tmp/plugin-state-capture-tiny-current-5.json`. Neither test nor handler was
changed to mask this. Combined Voice qualification passes **19/19** in
`/tmp/plugin-state-voice-qualification-final.tap`.

Next module slice in progress: scoped history-entry references and guarded
Undo/Redo, independently authored RED/GREEN tests in
`kit/tests/test_plugin_state_history.mjs`. This is not yet integrated or built
into the recorded Voice artifacts. Modulation migration remains design/matrix
work; its existing acknowledged transport and partial-delivery recovery must be
preserved.

Default suite source tests, native qualification and view interaction tests are
separate evidence. No plugin install, DAW/listening or released artifact claimed.

This is a first integration slice, not a claim that Cosimo's MSEG/whole state has
been migrated. SeqFX review identified several protected behaviors that cannot be
changed merely to fit the candidate: gesture-end persistence with live uploads,
strict legacy-key migration, synchronous Undo and revision rewriting, and distinct
recall/upload authority. Cosimo MSEG is part of the whole modulation bank and
acknowledged modulation/articulation owner, not the legacy standalone controller.
Further integration scope must continue to serve the full approved goal.

## Existing fixture adaptations

The new runtime must be available through the normal source pin before making
existing controls depend on it. Do not silently fall back to old ownership or pin
an unpublished commit as if it were remotely fetchable. The shared source pin is
`kit/cmake/CosimoDependencies.cmake`; browser staging copies the entire pinned API.
`kit/toolchain.json` has blank release-template hashes: preserve honest provenance,
and do not label old prebuilt tools as rebuilt. Release configs/notices contain
matching source pins and existing checks must remain strict.

These fixture APIs now have channel adaptations, with assertions preserved:

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
