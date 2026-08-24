# Handoff: Bounce Video must use the real Cosimo synth UI

Status: **PAUSED by the user. Do not resume implementation or alter the UI architecture until the user explicitly resumes this work and approves the direction.**

Date: 2026-08-24

## Repository state

- Branch: `codex/speedrun-video-share`
- Worktree: `/Users/winterfell/.codex/worktrees/bounce-in-place`
- Last implementation commit before this note: `e5143a93` (`Integrate audio and video bounce into preset menu`)
- Remote: `origin/codex/speedrun-video-share`
- Current browser review URL: `https://primary-mac.tail5ef964.ts.net/`
- At handoff time that URL was served from this worktree's `build/web` on local port 8123. Recheck the process and URL rather than assuming they survived.

## The user's current direction

The current generated video is **not accepted**. It shows a purpose-built synth replica that does not look like Cosimo. The user requires the video to show the **actual Cosimo synth UI**, not an invented or approximate second interface.

Highest-priority constraints for the resumed run:

1. Do not polish, reskin, or incrementally improve the current replica as the answer.
2. Do not make another architecture decision before discussing the exact direction with the user.
3. Do not describe a vague new "state adapter" without grounding it in the existing repository interfaces.
4. Do not use encoding success, DOM assertions, or screenshot tests as evidence that an invented UI is the right product.
5. Preserve the user's previously requested launcher behavior unless they revise it:
   - `Bounce Audio` and `Bounce Video` live in the preset-bar dropdown on desktop and phone.
   - The old ready-state Bounce button is absent from the Voice/source surface.
   - `Bounce Video` starts from the current patch only; there is no file, pasted URL, or alternate-patch chooser.
   - The renderer is browser-only and lazy-loads after `Bounce Video` is selected.
   - The integrated flow is fixed to one view and does not introduce a scrolling landing page.

The user's rejection concerned the **video's fake synth content**. Do not silently infer approval or rejection of any other part of the integrated shell beyond the requirements above.

## Decision provenance: why the replica exists

The original implementation handoff did explicitly mandate a replica:

- `VIDEO_PIPELINE_AND_URL_SHARING_HANDOFF.md` §4.12 says the composition is the plan's frame-pure replica and says not to mount the real patch view first.
- Its §6 F1 makes a purpose-built phone-UI replica the primary path and the real patch view a fallback after a fidelity spike.
- `docs/reference/SOUND_SPEEDRUN_PIPELINE_PLAN.md` §9 specifies `SpeedrunPhoneUI`, deterministic static geometry, and `uiStateAt(frame)` derived by replaying recipe operations.
- The plan's implementation sequence defers a real-UI swap until an optional post-V1 phase.

That inherited direction explains the separate composition architecture. It does **not** make the current visual result acceptable. The same documents required reuse of real visual leaves and an authentic result; the shipped replica failed that product standard. The user has now explicitly rejected the replica strategy as the product result, so a resumed run must treat that rejection as newer direction rather than blindly citing the old "locked" decision.

The prior agent initially told the user that the replica architecture had not been specified. That was incorrect and was corrected after rereading both instruction documents. Do not repeat that error.

## What is currently implemented

Commit `e5143a93` contains the integrated launcher and current-patch path:

- `ui/shared/effects/preset-bar.ts`
  - Adds `Bounce Audio` and `Bounce Video` to the synth preset dropdown.
  - Captures the current sound for video without applying share-link policy.
- `ui/desktop/DesktopPatchView.tsx`
  - Opens the integrated `VideoBounceFlow` from the preset bar.
  - Removes the visible ready-state Bounce action from the Voice/source surfaces while retaining busy/error feedback.
- `ui/desktop/video-bounce-flow.tsx`
  - Fixed, non-scrolling current-patch render flow.
  - Plain format/quality controls, audio render, video render, and download.
- `ui/speedrun/integrated-entry.ts`
  - Browser-only lazy renderer entry.
  - Uses the bundled performance and sets `createShareLink: false`; video rendering is independent of URL sharing.
- `ui/vite.video-bounce.config.mjs`, `web/build.mjs`, and `web/cosimo-web-host.js`
  - Ship the renderer as `/video-bounce/index.js`, outside the synth startup bundle.
- `ui/shared/effects/synth-preset-identity.ts`
  - Establishes `cosimo-synth` as the shared preset/runtime contract identity. This fixed the earlier live-capture/runtime contract-hash mismatch.

The separate `/speedrun/` studio page remains source/test-harness code but is not shipped as a product route by `web:build`.

## The rejected visual implementation

The unacceptable replica is primarily in:

- `ui/speedrun/composition/phone-ui.tsx`
- `ui/speedrun/composition/styles.css`
- `ui/speedrun/composition/layout.ts`
- `ui/speedrun/composition/state.ts`
- `ui/speedrun/composition/gestures.ts`

It reuses only low-level visual pieces:

- `ParameterKnobArtwork`
- the wavetable render-model/drawing functions
- MSEG path rendering
- `SegmentedEditorTabs`
- parameter descriptors/formatters, fonts, icons, and tokens

It hand-builds the higher-level phone, preset bar, keyboard, Voice workspace, filter surface, FX workspace, Mod workspace, control banks, and their geometry. Those invented layers are why the output looks unlike the product.

Do not delete this code merely to demonstrate progress. Preserve it until the user authorizes a replacement/discard decision; it also records what the old instructions produced.

## What "leaf" means in the current code

The old plan used "leaf" narrowly: a presentational primitive that can render entirely from explicit values.

- `ui/shared/parameter-knob-artwork.tsx`: a genuine leaf. It draws knob artwork from normalized values and colors.
- `ui/shared/wavetable-display.ts`: the render-model and canvas drawing functions are genuine leaves.
- `ui/shared/segmented-editor-tabs.tsx`: reusable visual/interaction chrome with explicit state and callback inputs.
- A complete labeled knob with binding and gestures is not merely a leaf.
- A bank of live knobs is not a leaf in the current extraction.
- The complete mobile wavetable graphic, selectors, graph gestures, overlays, and toolbar are not one leaf; they are composed inside `MobileVoiceFocusedEditor`.
- `MobileVoiceFocusedEditor` is not frame-pure: it owns page/transition/gesture state and still creates some live patch bindings internally.

## A clean whole-synth seam already exists

There is no need to put the principal seam between a knob and a knob bank or between the wavetable drawing and its controls merely to reach the real UI.

The repository already mounts the whole production interface through this established seam:

```text
createDesktopPatchView(patchConnection, options)
  -> DesktopPatchView
    -> PatchConnectionProvider
      -> the actual responsive production component tree
```

Relevant code:

- `ui/desktop/patch-view-entry.tsx:createDesktopPatchView`
- `ui/desktop/DesktopPatchView.tsx:DesktopPatchView`
- `ui/shared/cmajor-react.ts:PatchConnectionLike` and `PatchConnectionProvider`
- `ui/shared/resource-client.ts:ResourceClient`

This is a real, already-exercised seam:

- Production supplies the Cmajor patch connection.
- `ui/shared/patch-connection-mock.ts:MockPatchConnection` supplies an in-memory connection for the real UI.
- `ui/desktop/harness-main.tsx` mounts `createDesktopPatchView` with that mock, sets parameter and stored-state values, emits effective/runtime telemetry, and renders the same responsive synth component tree.
- The desktop browser suite already drives this real view at phone-sized viewports.

Therefore the real UI is already reachable and driveable without recreating its visual hierarchy. The precise limitation is narrower: the existing connection is event-driven and asynchronous. It does not expose a direct command equivalent to "render arbitrary video frame N," and arbitrary out-of-order frame seeking has not been established. Do not conflate that missing frame-control behavior with an inability to use the real UI.

## Technical verification already completed

At `e5143a93`:

- The integrated current-patch path produced a valid downloadable WebM through the actual browser flow.
- The focused preset, capture, bundle, pipeline, and integrated render suites were green.
- The ten-cycle Bounce Audio soak passed through the relocated menu action.
- The Tailnet root and lazy renderer returned HTTP 200.

This evidence establishes pipeline execution, state intake, lazy loading, and encoding. It does **not** establish visual or product acceptance; the user has explicitly rejected the visual result.

## Open questions for the resumed conversation

Do not answer these by editing code before the user resumes:

1. Whether the real `createDesktopPatchView` can be captured reliably by `@remotion/web-renderer` at the actual 393x852 phone layout.
2. How deterministic frame selection, reset, and out-of-order seeking should work across the existing event-driven patch-connection seam.
3. Which runtime-only behaviors should remain active during video capture and which should be held still, without changing the visible UI.
4. Whether the current integrated Bounce Video shell remains accepted once the real synth is inside it.
5. Once a replacement is accepted, whether the replica should be deleted, retained only as historical/experimental code, or reverted separately.

## Required resumption discipline

When the user resumes:

1. Start from this note and the exact current git state.
2. State plainly that the current replica is rejected.
3. Explain the existing whole-synth seam concretely (`createDesktopPatchView` + `PatchConnectionLike` + `MockPatchConnection`), not with a vague invented abstraction.
4. Discuss the frame-control problem separately from visual reuse.
5. Obtain explicit direction before changing the renderer or production UI architecture.
6. Preserve unrelated branch work and continue following the effects-lane sync fence; do not complete effects-lane work from this branch.
