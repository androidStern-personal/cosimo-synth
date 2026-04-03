# Transient DesktopPatchView Extraction Test Plan

Last updated: 2026-04-02

Status on 2026-04-02

- This draft was the first plan before implementation started.
- The `jsdom` path described below was tried and then discarded because `nexusui` and the desktop custom-element path do not initialize cleanly there.
- The actual safety net that landed is the browser-based harness in `tests/test_desktop_patch_view_browser.mjs`, plus the desktop harness instrumentation in `ui/shared/patch-connection-mock.ts` and `ui/desktop/harness-main.tsx`.
- Keep this file as a record of the original plan, but use `PROGRESS.txt` and the landed browser test files as the source of truth for what actually shipped.

## Why This File Exists

This is a transient working plan for the `DesktopPatchView.tsx` extraction pass.

The extraction itself is paused until the desktop React page has a real safety net.

Right now the repo has almost no real tests for the React desktop page. Most of the current desktop checks are source-text regex checks against `ui/desktop/DesktopPatchView.tsx`, which are too weak to protect a structural refactor.

The goal of this plan is to replace those weak checks with tests that prove real behavior at the right level before shared hooks and desktop adapters get extracted out of the page file.

## What We Need To Protect

- Factory catalog loading still works through the shared `resourceClient`.
- Factory frame loading still works through the shared `resourceClient`.
- Runtime sync, wavetable selection, retry, and displayed-table status still behave the same.
- Stage dragging still changes wavetable position with the same gesture rules.
- MSEG overview and MSEG editor still behave the same.
- Keyboard routing still works globally and the active control can claim left-right arrow steps.
- The desktop-only adapters for the Cmajor keyboard element and `Nexus.Number` still mount, update, and tear down correctly.
- The desktop entrypoint still renders a real UI instead of a blank screen or silent crash.

## 1. Add A Real React Test Harness

Add a shared desktop React test harness instead of more source-file regex checks.

The harness should provide:

- a fake `patchConnection` with listener registration, parameter value requests, endpoint pushes, gesture logging, and sent event or value recording
- a fake `resourceClient` with controllable deferred promises for catalog and frame loads
- a fake `ResizeObserver`
- a fake canvas 2D context for `CanvasWavetableDisplay`
- a fake `PianoKeyboard` custom element class
- a fake `Nexus.Number` widget class
- a `mountDesktopPatchView()` helper that mounts the actual React tree, not a fake clone

The harness must mount the real `DesktopPatchView.tsx` component with React.

## 2. Replace Static Desktop Regex Tests With Mounted Integration Tests

Add a mounted React suite for the desktop page, likely `tests/test_desktop_patch_view.mjs`.

That suite should cover these behaviors:

- On mount, the page requests runtime sync once.
- The status header reflects real states:
  - `Ready`
  - pending desired-table load
  - catalog failure
  - frame load failure
  - retryable runtime failure detail
- Wavetable select commits the desired table.
- Retry only appears for retryable failures and sends `retryDesiredTableRequest`.
- Stage drag updates position with the actual gesture contract:
  - blank-stage pointer down starts the gesture
  - small moves under threshold do nothing
  - large vertical drag updates the binding
  - pointer up ends the gesture
  - pointer down on `select`, `button`, or `input` does not start the drag
- MSEG overview renders the current state and opens the editor.
- MSEG editor interaction still works:
  - clicking empty space adds a point
  - clicking an interior point without dragging deletes it
  - dragging a point moves it instead of deleting it
  - endpoints are not deleted
  - Escape closes the modal
- Voice mode buttons commit the correct discrete values.
- Glide number field updates the binding and respects focus behavior.
- Keyboard octave controls update the root note and disable at bounds.
- Arrow-key routing works across the real mounted page:
  - wavetable select can claim left and right steps
  - glide can claim left and right steps
  - note keys still route to the keyboard element globally
  - keyup still sends `allNotesOff()` when appropriate

## 3. Add Focused Tests For The Desktop-Only Adapters

Before extraction, add direct tests for the desktop-only adapters so they can be moved safely.

For the keyboard adapter:

- `ensureKeyboardElement` registers the custom element once
- `KeyboardDock` attaches the keyboard to the patch connection on mount
- `KeyboardDock` detaches on unmount
- `KeyboardDock` updates `root-note` and `note-count` without rebuilding unnecessarily
- `KeyboardDock` recomputes natural and accidental widths on resize

For the Nexus adapter:

- `NexusNumberField` creates exactly one `Nexus.Number`
- it applies the expected value range and precision
- widget change writes the clamped value back to the binding
- focus and blur invoke the text-entry callbacks in the correct order
- unmount destroys the widget and ends text-entry state

These should be adapter tests, not full page tests.

## 4. Add Targeted Tests For The Shared Hooks We Are About To Extract

As soon as hooks move out of `DesktopPatchView.tsx`, they need their own tests.

For the data hooks:

- `useFactoryBankCatalog`
  - success path
  - rejected load path
  - no stale success after unmount
  - old in-flight work does not win after dependency change
- `useFactoryTableFrames`
  - loads the presented table index
  - switching indices ignores stale earlier responses
  - rejected frame load produces the expected error state
- `useObservedDisplayPosition`
  - uses the runtime-observed position when present
  - falls back to the parameter value otherwise
  - preserves the current generation-based selection behavior
- `useMsegState`
  - creates one `MsegController`
  - attaches on mount
  - requests boot state
  - detaches on unmount

For the interaction hooks:

- `useStagePositionDrag`
  - preserves the threshold rule
  - preserves the control-hit exclusion rule
  - preserves begin, set, and end gesture ordering
- `useMsegEditorInteractions`
  - preserves add, move, and delete semantics
  - preserves endpoint protection
  - preserves modal close on Escape

These tests should assert outputs and side effects, not internal implementation details.

## 5. Add One Real Browser Smoke For The Desktop Entry Point

Add one browser-level smoke for the actual desktop React entrypoint, likely around `ui/desktop/patch-view-entry.tsx` and the desktop harness page.

That smoke should:

- launch the desktop harness in a browser
- wait for the React root to render
- assert the page is not just an empty root
- assert the top status and at least one control are visible
- assert the wavetable canvas exists
- fail if the error-boundary fallback `pre` is what rendered

This is what catches broken imports, bad adapter wiring, render-time crashes, and real blank-screen failures.

## 6. Keep Only A Small Number Of Static Contract Tests

A few static contract tests still make sense, but only for real build contracts:

- generated `patch_gui/resource-client.js` comes from the TypeScript source
- the desktop bundle exists
- the shared wavetable renderer re-export stays intentional

The current static regex tests that claim user-facing behavior by grepping source text should be removed or replaced by mounted behavior tests.

## 7. Anti-Reward-Hacking Rules For This Pass

Every new test must follow these rules:

- no tests that only assert source code contains a string unless it is a true build contract
- no tests that mock the module under test
- no weak truthiness assertions when an exact value or visible output can be asserted
- async resource-loading tests must use deferred promises so stale-response races can actually be tested
- interaction tests must assert the exact observable outcome: sent event, DOM state, or controller mutation
- any test that would still pass if the implementation were hardcoded is not good enough

## 8. Recommended File Layout

- `tests/helpers/desktop_patch_view_harness.mjs`
- `tests/test_desktop_patch_view.mjs`
- `tests/test_desktop_widget_adapters.mjs`
- `tests/test_shared_synth_hooks.mjs`
- `tests/test_shared_synth_interactions.mjs`
- one browser smoke, either folded into an existing browser harness test or added as `tests/test_desktop_patch_view_smoke.mjs`

## 9. Execution Order

1. Build the shared React and jsdom harness.
2. Add the mounted `DesktopPatchView` integration tests.
3. Add the adapter tests.
4. Add the hook tests as the hooks get extracted.
5. Add the browser smoke.
6. Delete the misleading static regex tests that the new mounted tests supersede.
