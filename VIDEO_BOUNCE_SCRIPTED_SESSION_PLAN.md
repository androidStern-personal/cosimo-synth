# Bounce Video: Scripted Session Plan (real synth UI)

Status: **APPROVED DIRECTION — ready to execute.** The user has explicitly
resumed the work paused in `VIDEO_BOUNCE_REAL_SYNTH_UI_HANDOFF.md` and approved
this plan. This document supersedes the replica mandate in
`VIDEO_PIPELINE_AND_URL_SHARING_HANDOFF.md` §4.12/§6 F1 and
`docs/reference/SOUND_SPEEDRUN_PIPELINE_PLAN.md` §9's `SpeedrunPhoneUI`
direction. Where those documents and this one conflict, this one wins.

Date: 2026-08-24
Baseline: branch `claude/video-bounce-ui-animation-7trtmw` (contains
`codex/speedrun-video-share` @ `1cd97c7` merged in — the integrated launcher,
audio pipeline, and the rejected replica are all present).

## 0. Locked product decisions (user-approved — do not re-litigate)

1. **The video shows the real Cosimo synth UI.** The production
   `DesktopPatchView` tree, mounted through its real seam, driven from outside.
   No replica, no reskin of the replica, no hand-assembled composition of
   mid-level components.
2. **Output dimensions: 1080×1920 @ 30fps (9:16).** This matches TikTok's
   native format and X/Twitter's supported vertical range with one file. The
   existing `SPEEDRUN_VIDEO_WIDTH/HEIGHT` constants
   (`ui/speedrun/composition/composition.tsx:15-16`) already say this — the
   decision pins them. The full-bleed phone-shaped (393:852) alternative is
   rejected. The phone UI renders at its native 393×852 CSS pixels and is
   scaled/inset on the 1080×1920 stage with the caption/title framing.
3. **Launcher behavior is unchanged** (carried from the handoff): `Bounce
   Audio` and `Bounce Video` live in the preset-bar dropdown; no ready-state
   Bounce button on Voice/source surfaces; `Bounce Video` starts from the
   current patch only (no file/URL/patch chooser); renderer stays browser-only
   and lazy-loads after selection; the integrated flow stays one fixed,
   non-scrolling view.
4. **Scripted gestures write through the connection for real** (like a user
   session), with an exact-value snap correction at gesture end so the final
   state matches the recipe's target precisely.
5. **Fidelity ships on the fallback rasterizer once the M0 gate passes.** The
   native HTML-in-canvas capture path is treated as a future free upgrade, not
   a dependency.
6. **The replica code is preserved** until the user accepts the real-UI output;
   disposal is a separate decision afterwards (handoff open question 5).
7. **The animations are the product.** Reduced-motion must NOT be used to
   flatten the video. The point is to see the real HUD appear, real drags, real
   panel slides, real confirm choreography, and the playback graphics moving in
   sync with the audio.

## 1. Why the replica happened and what "right" means

The prior implementation followed its instructions: the older plan documents
mandated a frame-pure replica because Remotion requires per-frame determinism.
That requirement was translated as "rebuild the UI as a pure function of
frame." The correct translation — and this plan's thesis — is **"make the real
UI deterministic under external drive."** Drive the production tree through the
inputs it already accepts (patch-connection events, DOM pointer events, and
time), never through new demo-state props.

Do NOT add "force this transient state" props to product components (e.g.
force-show HUD, force a drag ghost). That forks every gesture brain into a real
path and a driven path — the replica mistake one level down. The repo's own
precedent, `SeqFxPromoControls` (`fx/seqfx/view/SeqFxPatchView.tsx:2596`),
deliberately excludes gesture/preview state from outside drive. Transients come
from real input; state comes from the connection.

## 2. Feasibility evidence already gathered (do not redo from scratch; do harden)

All four probes below were run on 2026-08-24 against the repo's pinned
`@remotion/web-renderer@4.0.491` and the repo's gate Chromium (141). Appendix A
contains reconstructible probe code.

1. **Real-UI capture works.** The real `DesktopPatchView` mounted on
   `MockPatchConnection` at 393×852, captured via `renderStillOnWeb` (the same
   rasterizer `renderMediaOnWeb` uses per frame), compared against a live
   screenshot of identical state: layout, typography (Departure Mono),
   chips/readout cells/tab bars faithful, and the **wavetable waterfall canvas
   captured pixel-perfect** (canvas bitmaps copy straight through). Known gap
   list (M0 burns these down): SVG knob arcs, the filter-curve SVG trace, the
   shadow-DOM piano-keyboard interior, one `<img>` mod-source icon, the header
   title text.
2. **CSS animation scrubbing is deterministic.** `element.getAnimations()`
   returns live CSSTransition/CSSAnimation objects; `pause()` + set
   `currentTime` landed a transition at exactly its 50% computed value. This
   controls all 28 transitions / 8 keyframes in the mobile sheets without
   touching product CSS.
3. **Synthetic pointers work inside Remotion's hidden scaffold.**
   Programmatic `dispatchEvent(new PointerEvent(...))` delivers to element and
   window listeners under `visibility:hidden; pointer-events:none`;
   `setPointerCapture` throws and the product gesture engine already swallows
   that by design (`ui/shared/parameter-gesture.ts:272`; the realtime-cadence
   test `tests/test_web_poc_browser.mjs:822-900` relies on it).
   `document.elementFromPoint` does NOT see hidden/pointer-events:none content
   — see §4.1 for the iframe answer.
4. **Renderer mechanics (verified in the shipped package source):**
   `renderMediaOnWeb` renders frames **strictly sequentially**
   (`for (frame…) { timeUpdater.update(frame); await waitForReady; createLayer }`),
   the React tree **stays mounted across the whole render** (one scaffold div,
   `flushSync(setFrame)` per frame), each frame's capture **waits on
   `delayRender` handles**, and the scaffold wrapper is
   `position:fixed; inset:0; visibility:hidden; pointer-events:none` in
   `document.body`. There is no out-of-order seeking on the export path.
   Native HTML-in-canvas (`canvas.layoutSubtree` + `ctx.drawElementImage` +
   `canvas.requestPaint`) is absent in Chromium 141, so the custom CSS
   rasterizer fallback is the operative capture path today.

## 3. Architecture: the scripted session

Everything new lives in the lazy video bundle (`ui/speedrun/` + the
`/video-bounce/` entry). The product runtime path is untouched.

```
hidden same-origin iframe (~393×852 viewport)          ← the viewport seam
└─ renderMediaOnWeb scaffold (1080×1920 composition, sequential frames)
   └─ ScriptedSessionComposition
      ├─ stage frame: ambient background, captions, title/end cards
      │  (keep the accepted 1080×1920 framing; phone inset, scaled)
      ├─ FrameDirector (per frame):
      │    1. advance ScriptedPatchConnection to frame N
      │    2. dispatch due synthetic pointer events (interaction scripts)
      │    3. scrub all in-scaffold animations by 1/fps (WAAPI)
      │    4. fire due uiTimeout callbacks at frame time
      │    5. hold delayRender until settle (microtasks + ≥1 rAF turn +
      │       React commit + canvas repaint), then release for capture
      └─ phone stage wrapper (393×852, transform: scale(k))   ← fixed-pos containing block
         └─ REAL DesktopPatchView (light-DOM mount, real stylesheet,
            real cmaj piano keyboard)
```

### 3.1 Render-stage iframe (the viewport seam)

The phone layout binds to the *viewport*, not a container:
`window.matchMedia("(max-width: 639px)")` at
`ui/desktop/DesktopPatchView.tsx:4058-4103`, seven `@media (max-width: 639px)`
stylesheets (`ui/desktop/mobile-workspace.css:13`, `mobile-mod-rail.css:8`,
`mobile-mod-mappings.css:8`, `mobile-mod-matrix.css:747`,
`effects-rack-workspace.css:1240`, `mobile-quick-source-sheet.css:10`,
`ui/desktop/styles.css:301`), and `position: fixed` overlays (mod-rail dock,
quick-source sheet, toasts, MSEG modal backdrop). Running the whole
`renderMediaOnWeb` call inside a hidden same-origin iframe whose window is
phone-sized solves all three at once with zero product changes:

- Media queries evaluate against the iframe viewport.
- The 1080×1920 scaffold div may overflow the iframe — irrelevant, because the
  fallback rasterizer re-draws from layout geometry, not from on-screen pixels.
- The phone stage wrapper carries a CSS `transform`, which makes it the
  containing block for the product's `position: fixed` overlays, so they
  anchor to the phone frame, not the composition edges.
- Inside the iframe there is no user-facing UI, so the driver may flip
  Remotion's scaffold wrapper to `visibility:visible; pointer-events:auto`
  (post-mount, from outside Remotion) to make `document.elementFromPoint`
  hit-testing work — required by the mod-source drag's target resolution
  (`ui/desktop/effects-rack-workspace.tsx:265-271, 308, 406-447`).
- Hide the iframe from the user via parent-side `visibility: hidden` or
  opacity — NOT `display: none` (that collapses the inner viewport and breaks
  the media queries). Verify rAF is not throttled in the hidden same-origin
  iframe on the gate browser (spike item, M1).

The integrated flow keeps its current UI; `ui/speedrun/integrated-entry.ts`'s
module boundary changes from "dynamic import in the page" to "create iframe,
load the same module inside it, call it directly" (same-origin, direct function
calls, no postMessage needed). The `IntegratedVideoBounceSession` contract in
`ui/speedrun/integrated-contract.ts` stays as-is.

### 3.2 ScriptedPatchConnection (state seam — already 90% exists)

A `PatchConnectionLike` (pattern: `ui/shared/patch-connection-mock.ts`, which
already models everything needed) that replays, per frame:

- **Parameters** in engine units, using the recipe's exact interpolation — port
  the easing math from `ui/speedrun/composition/state.ts` (`mix`/`smoothstep`,
  per-op progress thresholds) so motion timing matches the already-accepted
  pacing.
- **Stored-state documents**: real `lane.v1` / `modulation.v6` /
  `articulations.v4` from `ui/speedrun/partial-states.ts`
  (`buildCumulativeStates`, `applySpeedrunOp`) — the same authority the audio
  checkpoints render from. Emit through the stored-state listener exactly as
  `MockPatchConnection.setStoredStateValue` does.
- **Runtime state** (wavetable load→activate choreography) scripted at op
  frames, mirroring `MockPatchConnection`'s `runtimeState` shape so the real
  stage shows genuine loading/active transitions.
- **Engine telemetry** from the recorded track (§3.3): `runtimeState`,
  `effectiveWavetablePosition`, `effectiveWarpState`, `effectiveUnisonState`,
  `effectiveFilterState`, `effectiveMsegState`, `effectiveModSourceState`,
  plus `filterSpectrum` / scopes if recorded.
- **MIDI** — `midiIn` events at exact frames derived from the same
  `performanceEvents()` math (`ui/speedrun/audio/checkpoint-renderer.ts:199`),
  so the keyboard lights the real keys in sync with the heard notes.
- **Utilities**: supply the real `PianoKeyboard` class
  (`build/deps/cmajor-*/javascript/cmaj_api/cmaj-piano-keyboard.js` — key
  highlights are pure `midiIn` endpoint listeners, `:157-172`, zero clocks).
  `MockPianoKeyboard` renders no keys — do not use it for video.
- **Resources**: `getResourceAddress`/`readResource` served from the same
  origin (wavetable catalog JSON + per-table WAVs) so the real stage draws the
  patch's REAL wavetable frames. Reuse/share the fetch cache with the audio
  side's resource bundle (`ui/speedrun/audio/resources.ts`) where practical.

Gesture writes: when interaction scripts drag real controls, the UI writes
back through this connection (decision 4). Accept the pixel-quantized values
during the drag; at gesture end, write the recipe's exact target value (a
"snap correction" rendered on the next frame — invisible, keeps video state
identical to audio state).

### 3.3 Telemetry recording during the audio render (~20-line tap)

`OfflineEngineHost` (`ui/speedrun/audio/offline-engine-host.ts`) already
implements `PatchConnectionLike` over the real offline performer and its
`drainOutputEvents()` (`:231-267`) forwards **any subscribed output-event
endpoint** after every ≤128-sample advance. The telemetry endpoints are engine
**output events** (`cmajor/WavetableSynth.cmajor:1358-1367`) — the playback
graphics are engine truth.

In `renderSpeedrunCheckpoint` (`checkpoint-renderer.ts:266`): subscribe the
effective-state endpoints before the render loop; tag each event with the
current sample offset (the loop variable `renderedFrames` at `:322-334`); bin
last-value-per-video-frame (1600 samples per frame,
`SPEEDRUN_SAMPLES_PER_FRAME`). Return the per-section track alongside
`samples`; workers structured-clone it back through
`ui/speedrun/audio/checkpoint-worker.ts` / `render-pool.ts`.

Global mapping: video frame = `timedSection.startFrame + floor(sampleOffset /
1600)`, exactly mirroring how `assembleSpeedrunMasterTrack`
(`ui/speedrun/audio/master-track.ts:112`) splices audio at
`timedSection.startSample`. Because telemetry is recorded inside the same
checkpoint renders that produce the spliced audio, **visuals match the heard
audio by construction** — this is why recording beats running a live engine
under the UI (a continuous engine would drift from the splice at section
boundaries; do not do that).

Install-phase events (before the performance loop) are discarded; recording
starts at sample 0 of the performance.

### 3.4 Interaction scripts (the animations the user cares about)

Evolve `ui/speedrun/composition/gestures.ts` from a *finger overlay script*
into an *event script*: per-op pointer sequences dispatched on real DOM
targets, resolved by the same `data-role` selectors the Playwright suites use.
The finger/ripple overlay stays as a cosmetic layer on top — now tracking real
interactions.

Per op kind (targets/patterns already proven in the suites —
`tests/helpers/desktop_patch_view_browser_suite.mjs:533`
`dispatchRackKnobPointerEvents`, `:1307` reorder-without-capture,
`tests/test_web_poc_browser.mjs:822-900` rail drag):

- `navigate` — real taps on the workspace tab bar / osc pager / FX-device and
  mod-source selectors. Voice A/B/C and Mod SOURCE/MAPPINGS use the real slide
  transition (`ui/shared/segmented-editor-tabs.tsx:217` — call path via real
  taps so `beginTabTransition` runs; its inline 170ms transition is scrubbed
  by the clock layer).
- `setParam` / `setLaneParam` — pointerdown on the real cell/knob, moves on
  window with authored `timeStamp`s: the rolling-axis classifier
  (`ui/shared/rolling-axis-classifier.ts`) activates, `useReadoutCells` /
  `rack-parameter-knob` raise the **real precision HUD** through the real
  portal (`ui/shared/parameter-readout-strip.tsx:226-276`,
  `ui/desktop/rack-parameter-knob.tsx:348-377`,
  `ui/shared/parameter-hud.tsx`). Drag distances derived from the control's
  own geometry; snap-correct at gesture end (§3.2).
- `mapRoute` — the full real drag-and-drop: pointerdown on the mod-source
  rail, path to the target, real ghost
  (`data-role="mobile-global-mod-source-ghost"`), real `is-mod-hover` capture
  highlight, real drop → real confirm choreography (flash/check/pulse
  keyframes, scrubbed; state timers via `uiTimeout`, §3.5).
- `selectWavetable` — real taps through the wavetable picker; scripted
  `runtimeState` supplies the loading→active arc.
- `toggleEffect` — real tap on the FX device toggle.
- `configureMseg` / `setEnvelope` — real drags on the real MSEG editor surface
  and ADSR handles (`ui/shared/synth-hooks.ts:1886` `useMsegEditorInteractions`,
  `DesktopPatchView.tsx:1492` ADSR handle drags) — these are the
  "drag-to-resize" class of gestures; script at least node drags and one
  handle resize where the recipe configures shapes.
- `setMacro` — real drag on the macro control.

Scroll: set `panel.scrollTop` directly per frame when a target sits below the
fold (`workspacePanelsRef`, `DesktopPatchView.tsx:4085-4642`); avoid the two
`behavior:"smooth"` paths (`:4625`, `:5054`) during capture.

Coordinate resolution happens per frame against live layout
(`getBoundingClientRect`) — deterministic given identical layout. Add missing
`data-role` attributes where a script target lacks a stable selector (output
attributes only; never behavior).

### 3.5 Frame clock and determinism rules

- **CSS transitions/animations**: after applying frame N's inputs, walk
  `scaffoldRoot.getAnimations({subtree: true})`; adopt new `Animation` objects
  at their first-seen frame; `pause()` all and set
  `currentTime = (N - startFrame) * 1000/fps`. Covers the panel slide, HUD
  fade, ripples, confirm flash/check-rise, count/created pulses, toast-in,
  reorder transitions.
- **Decorative JS timers → `uiTimeout` facade** (small product seam, §5):
  HUD linger 420ms (`parameter-readout-strip.tsx:272`,
  `rack-parameter-knob.tsx:373`), feedback toast 2000ms
  (`effects-rack-workspace.tsx:3112`), confirm window 900ms (`:3133`), rail
  count pulse 700ms (`:1931`), recent-route highlight 1100ms
  (`DesktopPatchView.tsx:4266`), panel-slide cleanup
  (`segmented-editor-tabs.tsx:293`), plus the remaining sites inventoried in
  §7. Facade defaults to `window.setTimeout`; the FrameDirector drives
  registered callbacks by frame time during capture. Without this, toast and
  flash lifetimes depend on render speed (wall-clock), which is both
  nondeterministic and machine-dependent.
- **Smoothing integrators → media-clock injection** (already parameterized):
  filter-spectrum advance takes a timestamp param
  (`ui/shared/synth-components.tsx:1502` → `ui/shared/filter-spectrum.ts:453`);
  the mod-source live-light driver has injectable rAF hooks
  (`ui/shared/mod-source-live.ts:139-149`) that the product acquire path
  (`:382-385`) simply doesn't pass — plumb an optional hooks/clock argument
  through. Feed `frame/fps*1000`.
- **Gesture timestamps**: author `timeStamp` on synthetic PointerEvents
  (own-property shadow over the prototype getter) with frame-time values, so
  the 36ms axis-direction window (`rolling-axis-classifier.ts:50,107`) and
  long-press threshold (`parameter-gesture.ts:30,356` — 500ms) behave
  identically across machines. Long-press menus: only if a recipe op ever
  wants one; otherwise keep drags under threshold... (they activate axes, so
  they do).
- **Do not virtualize global timers or rAF.** Remotion, WebCodecs, and the
  encoder run in the same realm and need real timers. Scope every control to
  the scaffold subtree / product seams listed here.
- **Out of scope**: the mod-rail fling physics
  (`effects-rack-workspace.tsx:2222-2267`, `performance.now` momentum) —
  recipes never fling the rail. Auto-preview auditioning stays off (default).
- **Capture CSS** (video-bundle stylesheet, applied to the stage subtree
  only): `content-visibility: visible !important` for off-viewport rows
  (`ui/desktop/styles.css:17`, `mobile-mod-matrix.css:383`,
  `mobile-mod-mappings.css:228`); nothing else unless M0 demands it.
- **Settle protocol per frame**: apply inputs → dispatch events → scrub
  animations → fire due uiTimeouts → wait: microtask drain, one real rAF turn
  (the visual-endpoint coalescer commits on rAF —
  `ui/shared/cmajor-react.ts:317`), React transition flush → `continueRender`.
  The per-frame driver must be idempotent (frame 0 may render more than once).

### 3.6 Mount specifics

- Mount `DesktopPatchView` directly (it's exported) inside
  `PatchConnectionProvider` semantics via its own props — NOT via the custom
  element in production mode: `ui/desktop/patch-view-entry.tsx:115-143`
  branches on `import.meta.env.DEV` and uses a **shadow root in production**,
  which the fallback rasterizer cannot walk. Add an explicit light-DOM mount
  option (or import the component + `styles.css` directly in the video
  bundle, which is the same thing). The keyboard's own shadow root needs the
  light-DOM capture subclass (§5).
- Await before frame 0: `document.fonts.ready` (the two `@font-face` woff2s —
  no product code awaits fonts), factory-bank catalog JSON + the selected
  tables' frame WAVs (`ui/shared/synth-hooks.ts:538-608`,
  `ui/shared/wavetable-bank.ts:140-197`), decode of the 3–5 UI PNGs
  (mod-source faces, rack icons). Gate with a `delayRender` handle in the
  composition.
- `keyboardInputMode: "standalone-preview"` (harness precedent,
  `harness-main.tsx:296`).

## 4. What stays untouched

- The integrated flow shell (`ui/desktop/video-bounce-flow.tsx`), preset-menu
  launchers (`ui/shared/effects/preset-bar.ts`), lazy-load boundary and
  `integrated-contract.ts` API.
- The audio pipeline: intake → analysis → recipe → timeline → checkpoints →
  master WAV. The only audio-side change is the additive telemetry tap (§3.3).
- Recipe/timeline/pacing (`recipe.ts`, `timeline.ts`) — same ops, same
  compression levels, same 2700-frame ceiling.
- Verification harness patterns (`ui/speedrun/studio/verify.ts` etc.).
- The `/speedrun/` studio page remains non-product/test-harness.
- The Remotion licensing hold (`docs/SPEEDRUN_VIDEO_BROWSER_RENDERING.md`):
  a human licensing decision is still required before public ship.
- The effects-lane sync fence (per the prior handoff): no effects-lane work
  from this branch.

## 5. Complete allowed product-code footprint

Only these product/shared-code touches are authorized. Each is small, named,
and default-behavior-preserving; anything beyond this list needs the user.

1. **Light-DOM mount option** for the desktop view entry (~5 lines) — an
   explicit option instead of `import.meta.env.DEV` branching.
2. **`uiTimeout` facade** (`ui/shared/ui-timers.ts`, new) + mechanical swap at
   the ~14 decorative-timer call sites inventoried in §7. Default:
   `window.setTimeout` — behavior identical.
3. **Media-clock plumbing** for the two already-parameterized smoothers
   (filter-spectrum timestamp; mod-source-live hooks through
   `acquireModSourceLiveDriver`).
4. **Light-DOM capture variant of the piano keyboard** (subclass in the video
   bundle rendering the same markup/CSS without a shadow root; product
   keyboard untouched).
5. **`data-role` attributes** added where interaction-script targets lack
   stable selectors (attributes only).
6. **Telemetry tap + track return** in the checkpoint renderer/worker/pool
   (additive fields; existing audio outputs byte-identical).

Hard rules: no visual changes to product components; no forked gesture code
paths; no new props that force transient states; no reduced-motion flattening;
replica untouched (do not delete/refactor `ui/speedrun/composition/*` yet).

## 6. Milestones and gates (execute in order; stop at a failed gate and report)

**M0 — Fidelity gate (before any architecture lands).**
Build a still-vs-live diff harness: mount the real view on
`MockPatchConnection` at 393×852 (the desktop harness does this today), seed
representative state per workspace (Voice, FX, Mod, keyboard visible, a frozen
HUD state, a frozen mapRoute ghost state — freeze by dispatching a gesture and
capturing mid-drag), screenshot live vs `renderStillOnWeb` capture, and diff.
Burn down the known gaps: SVG knob arcs, filter-curve trace, shadow-DOM
keyboard (→ capture subclass), `<img>` decode await, header title text.
Investigate each in the rasterizer's terms (inline SVG attributes, gradient
forms, mask/filter usage) before considering any workaround; if a residual
truly cannot render, the surgical fallback is drawing that one leaf to a
canvas for capture parity — never restyling the product.
*Gate: per-workspace diffs show no missing/blank elements; remaining pixel
deltas are enumerated and user-visible acceptable (subpixel AA class).*

**M1 — Scripted state.**
Render-stage iframe + ScriptedPatchConnection + FrameDirector settle protocol +
telemetry tap. Deliverable: a rendered MP4/WebM of the current patch with real
playback graphics (wavetable position, filter, MSEG playheads, mod lights) and
the real keyboard lighting from the performance — no gestures yet. A/B stills
against the live harness at multiple frames.
*Gate: existing pipeline suites stay green
(`npm run test:speedrun:pipeline|composition|audio|core|hardening` — note the
composition suites assert the replica's frame purity; keep them passing by
leaving the replica path intact and adding new suites for the scripted stage);
`tests/test_video_bounce_integration_browser.mjs` still proves lazy load + WAV
→ video render + download through the new iframe boundary; two renders of the
same recipe produce identical pre-encode frame pixels at sampled frames
(encoded bytes may differ — encoder nondeterminism is accepted, repo
precedent).*

**M2 — Interaction pass.**
Event scripts per op kind (§3.4) + animation scrubbing + authored timestamps.
The video now shows: real navigation taps and panel slides, real knob/readout
drags with the real HUD appearing, real wavetable pick with loading arc, real
FX toggle, the full real mapRoute drag (ghost → capture highlight → drop →
confirm flash/check/pulse), real MSEG/ADSR handle drags where the recipe
configures them.
*Gate: a scripted-gesture browser suite asserts, at chosen frames, the real
DOM states the product suites already assert (e.g. `data-dragging`,
`[data-role="mobile-voice-hud"]` visible with correct value text, ghost
present, `is-mod-hover` on the target, confirmed-route flash class) — inside
the capture stage; determinism gate from M1 re-passes.*

**M3 — Determinism seams.**
`uiTimeout` facade + swaps, media-clock plumbing, capture CSS, light-DOM
keyboard finalized, snap corrections. Full-length renders reproducible.
*Gate: two full renders of the hardening fixture recipe → identical pre-encode
pixels at every 30th frame; full product browser suites green (the facade must
be behavior-identical on the product path); ten-cycle Bounce Audio soak still
passes.*

**M4 — Integration.**
Swap the integrated flow's composition to the scripted session behind the same
lazy boundary; replica retained behind a build flag. Update
`VIDEO_BOUNCE_REAL_SYNTH_UI_HANDOFF.md` status and `PROGRESS.txt`; present
output to the user for acceptance. Replica disposal is decided by the user
after acceptance.
*Gate: the user accepts the video. Verification suite covers: container/codec
checks (existing), duration within tolerance (existing), decoded non-silent
audio (existing), plus sampled-frame visual assertions (new).*

## 7. Inventory: decorative-timer call sites for the `uiTimeout` swap

From the gesture/transient investigation (verify against current code when
executing; line numbers drift):

- `ui/shared/parameter-readout-strip.tsx:272` (HUD linger 420ms)
- `ui/desktop/rack-parameter-knob.tsx:373` (HUD linger 420ms)
- `ui/desktop/effects-rack-workspace.tsx:3112` (toast 2000ms), `:3133`
  (confirm 900ms), `:3328` (route-failure 750ms), `:1931` (count pulse 700ms),
  `:1303` (dwell-navigate 550ms), `:1336` (duplicate warn 500ms), `:2282`
  (rail X settle 220ms)
- `ui/desktop/DesktopPatchView.tsx:4266` (recent-route 1100ms), `:3264`
  (cursor reset 400ms)
- `ui/shared/segmented-editor-tabs.tsx:293` (slide cleanup 250ms)
- `ui/desktop/subway-map-column.tsx:126` (station long-press 550ms)
- `ui/desktop/articulation-ui.tsx:1495` (toast 1800ms), `:827` (card
  long-press)
- `ui/shared/synth-hooks.ts:2132` (MSEG curve hold 350ms)
- Long-press in `ui/shared/parameter-gesture.ts:356` (500ms) — swap only if a
  scripted long-press is ever needed; otherwise leave.

Not all need frame-driving in v1 (only those on scripted paths: HUD linger,
mapRoute confirm family, slide cleanup, MSEG hold). Swap those first; the rest
may stay on `window.setTimeout` until a script exercises them.

## 8. Risks and standing answers

- **Rasterizer gap resists fixing** → surgical per-leaf canvas parity (M0), or
  capability-gate video quality on the native HTML-in-canvas path when Chrome
  ships it (detect via `supportsNativeHtmlInCanvas`-style checks; same
  capability-gating pattern as WebCodecs container selection). Do not silently
  ship a broken-looking element.
- **Hidden-iframe rAF throttling** on some browser → probe at M1; fallback is
  an on-screen 1px-scale or opacity-0 iframe (kept within the flow's overlay).
- **Performance of full-UI frames** → export-time cost only, behind the
  existing progress UI; if frame settle needs >1 rAF the director takes it;
  budget check at M1 with the hardening fixture (2700-frame ceiling).
- **Two React instances / bundle weight** → the video bundle already builds
  separately (`ui/vite.video-bounce.config.mjs`); it now includes the desktop
  view + styles. Lazy boundary unchanged; measure chunk size at M4.
- **`sessionStorage` shell-state bleed** (`DesktopPatchView.tsx:4061-4078`
  persists workspace shell per session): the iframe shares the origin's
  sessionStorage? Verify; if the capture mount restores a stale shell state,
  clear/namespace it in the iframe before mount (capture-scoped, no product
  change).
- **Section-boundary visuals vs crossfaded audio**: telemetry follows the
  per-section renders including the 90ms crossfade overlap — during the
  crossfade window, show the incoming section's telemetry (matches the
  dominant audio); this is the recorded track's natural shape since sections
  splice at `startSample`.

## 9. Verification commands (existing)

```
npm run test:speedrun:hardening
npm run test:speedrun:pipeline
npm run test:speedrun:composition
npm run test:speedrun:audio
npm run test:speedrun:core
npm run test:video-bounce            # if defined; else tests/test_video_bounce_integration_browser.mjs
npm run test:desktop:browser suites  # per repo scripts; keep green throughout
```

## Appendix A — Probe reconstructions

**A1. Capture-capability probe (browser-agnostic, Playwright):** checks
`layoutSubtree`/`drawElementImage`/`requestPaint` on canvas (native
HTML-in-canvas), WAAPI transition scrubbing (create a transition, `pause()`,
set `currentTime` to 50%, assert computed value at midpoint), synthetic
pointer delivery + `setPointerCapture` throw inside a
`visibility:hidden; pointer-events:none` wrapper, and `elementFromPoint`
behavior in that wrapper.

**A2. Fidelity probe (still-vs-live), the M0 seed.** Serve the desktop harness
(`COSIMO_TEST_HARNESS=1 npm run ui:desktop:dev -- --host 127.0.0.1 --port
<p> --strictPort`), open at viewport 393×852, wait for
`document.body.dataset.bootStage === "render-called"` and
`__COSIMO_DESKTOP_HARNESS__.getRenderedState().hasCanvas`, seed state via the
harness emit API, then in-page:

```tsx
// module served by the harness vite server, e.g. ui/desktop/__fidelity-probe__.tsx
import { useEffect, useState } from "react";
import { useDelayRender } from "remotion";
import { renderStillOnWeb } from "@remotion/web-renderer";
import { DesktopPatchView } from "./DesktopPatchView";
import { createDesktopResourceClient } from "../shared/resource-client";

function ProbeReady({ children }) {
    const { delayRender, continueRender } = useDelayRender();
    const [handle] = useState(() => delayRender("probe settle"));
    useEffect(() => {
        let cancelled = false;
        (async () => {
            await document.fonts.ready;
            await new Promise((r) => setTimeout(r, 1500));
            // re-emit shared telemetry here so both mounts saw the same last values
            await new Promise((r) => setTimeout(r, 1200));
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            if (!cancelled) continueRender(handle);
        })();
        return () => { cancelled = true; };
    }, []);
    return children;
}

export async function renderStillProbe() {
    const pc = window.__COSIMO_DESKTOP_HARNESS__.patchConnection;
    const Comp = () => (
        <ProbeReady>
            <div style={{ width: 393, height: 852, position: "relative", background: "#02040b" }}>
                <DesktopPatchView patchConnection={pc}
                    resourceClient={createDesktopResourceClient(pc)}
                    keyboardInputMode="standalone-preview" />
            </div>
        </ProbeReady>
    );
    const result = await renderStillOnWeb({
        composition: { id: "cosimo-fidelity-probe", component: Comp,
            durationInFrames: 30, fps: 30, width: 393, height: 852 },
        frame: 0, logLevel: "warn", delayRenderTimeoutInMilliseconds: 60000,
    });
    return result.blob({ format: "png" });
}
```

Compare that PNG against `page.screenshot()` of the live mount (same
connection instance → identical state; note `MockPatchConnection` emits
`runtimeState` once at construction, so re-emit via `setRuntimeState({})`
after the second mount subscribes). The 2026-08-24 run of exactly this probe
produced the faithful-capture result and gap list in §2.1.

**A3. Renderer-mechanics references** (in
`node_modules/@remotion/web-renderer/dist/esm/index.mjs` at 4.0.491): the
sequential frame loop with `timeUpdater.current.update(frame)` +
`waitForRenderReady()` + `createLayer(...)`; `UpdateTime` implemented as
`flushSync(setFrame)` with the tree persistent; `createScaffold` wrapper
styling (`fixed/inset:0/hidden/pointer-events:none/z-index:-9999`);
`setupHtmlInCanvas` requiring `layoutSubtree` + `drawElementImage` +
`requestPaint` for the native path.
