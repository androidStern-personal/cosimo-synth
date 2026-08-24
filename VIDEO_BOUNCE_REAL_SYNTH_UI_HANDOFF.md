# Handoff: Bounce Video must use the real Cosimo synth UI

Status: **APPROVED SCRIPTED-SESSION PLAN IMPLEMENTED THROUGH M4'S TECHNICAL GATE. The real-UI MP4 is ready for user acceptance; keep the replica fallback until that acceptance decision.**

Date: 2026-08-24

## Approved scripted-session result

`VIDEO_BOUNCE_SCRIPTED_SESSION_PLAN.md` is the newer approved authority and
supersedes this handoff's old replica mandate and pause. Milestones M0 through
M3 passed in order. M4 now routes the unchanged preset-menu/current-patch flow
to a scripted production `DesktopPatchView` behind the existing lazy boundary.

- The renderer uses `createDesktopPatchView`/`PatchConnectionLike`, recorded
  engine telemetry, synthetic pointer input, and frame-driven WAAPI scrubbing.
  It does not reproduce the UI or force transient state through new props.
- The default integrated video composition is `scripted`. The untouched
  replica remains available only when the video bundle is built with
  `VITE_COSIMO_VIDEO_BOUNCE_REPLICA=1`, pending the user's post-acceptance
  disposal decision.
- The integrated gate observes the real synth at frames 0, 30, and 60 at a
  393×852 viewport inside the 1080×1920 stage, with real canvases, SVGs, and
  all 18 keyboard keys; the replica surface is absent.
- The acceptance artifact is
  `build/video-bounce/cosimo-real-ui-bounce.mp4`: 803,439 bytes, 1080×1920,
  4.821333 seconds, H.264 video plus stereo 48 kHz AAC, SHA-256
  `4cb84e0c236af278d7e0b59ca9beb02782c49589d0e0a027f38977daa0cc8991`.
  The product verifier decoded non-silent audio before exposing the download;
  independent `ffprobe`/`ffmpeg` inspection confirms both tracks and audible
  samples.
- Full M4 evidence is in `docs/VIDEO_BOUNCE_M4_INTEGRATION.md`. User acceptance
  of that artifact remains the final plan gate. A human Remotion licensing
  decision remains required before public shipment.

## Repository state

- Branch: `claude/video-bounce-ui-animation-7trtmw`
- Worktree: `/home/exedev/cosimo-synth`
- Milestone commits: M0 `4bf0ee1`, M1 `a7d3053`, Linux AAC/MP4 capability
  fix `c76c240`, M2 `fde4462`, M3 `40ce32a`, and M4 in the commit that updates
  this handoff.
- Remote: `origin/claude/video-bounce-ui-animation-7trtmw`
- The old Tailnet review URL belonged to a different machine/worktree and is
  not current evidence.

## Product direction carried into the approved plan

The pre-plan generated video was **not accepted**. It showed a purpose-built
synth replica that did not look like Cosimo. The approved replacement shows
the **actual Cosimo synth UI**, not an invented or approximate second
interface.

The constraints that remain in force are:

1. Do not polish, reskin, or incrementally improve the current replica as the answer.
2. Keep the scripted architecture grounded in the existing whole-synth seam:
   `createDesktopPatchView` plus `PatchConnectionLike`.
3. Do not introduce another state adapter or capture-only product UI.
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

## What was implemented before the scripted-session plan

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

## Historical verification before the scripted-session plan

At `e5143a93`:

- The integrated current-patch path produced a valid downloadable WebM through the actual browser flow.
- The focused preset, capture, bundle, pipeline, and integrated render suites were green.
- The ten-cycle Bounce Audio soak passed through the relocated menu action.
- The Tailnet root and lazy renderer returned HTTP 200.

This evidence establishes pipeline execution, state intake, lazy loading, and encoding. It does **not** establish visual or product acceptance; the user has explicitly rejected the visual result.

## Resolved questions and remaining acceptance decision

1. The real `createDesktopPatchView` captures reliably at 393×852 through
   `@remotion/web-renderer`; M0 and the integrated M4 samples prove it.
2. `ScriptedPatchConnection`, `FrameDirector`, the media clock, `uiTimeout`,
   synthetic pointers, and WAAPI scrubbing provide deterministic frame
   selection without changing product-state ownership.
3. Playback graphics and authored product animations remain active. Capture
   does not use reduced motion to flatten them.
4. The preset-menu launcher and fixed current-patch flow shell are unchanged,
   as locked by the approved plan.
5. The remaining decision is user acceptance of the real-UI artifact. After
   acceptance, the user decides whether the retained replica is deleted,
   historical/experimental, or reverted separately.

## Historical resumption discipline (satisfied)

The approved plan and M0–M4 execution satisfied the earlier resumption rules:

1. Start from this note and the exact current git state.
2. State plainly that the current replica is rejected.
3. Explain the existing whole-synth seam concretely (`createDesktopPatchView` + `PatchConnectionLike` + `MockPatchConnection`), not with a vague invented abstraction.
4. Discuss the frame-control problem separately from visual reuse.
5. Obtain explicit direction before changing the renderer or production UI architecture.
6. Preserve unrelated branch work and continue following the effects-lane sync fence; do not complete effects-lane work from this branch.
