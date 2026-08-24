# Video Bounce: Live-Performance Render Plan

Approved 2026-08-24 after review of a real render. Supersedes the pixel
strategy of VIDEO_BOUNCE_SCRIPTED_SESSION_PLAN.md (its driving layer —
recipe, timeline structure, scripted state, interaction director, telemetry —
carries forward unchanged in role).

## Why the last architecture kept producing rejects

1. **Pixels came from a fake browser.** Remotion's fallback DOM rasterizer is
   a partial CSS engine; every product feature it lacks (fixed-under-
   transform, masks, color-mix, backdrop-filter, background-image …) became a
   visible defect plus a hand-written compensation. The compensation layer is
   enumerated against today's CSS and cannot stay in sync with future UI.
2. **The captured tree lived under a CSS `scale(1.64)`.** Product components
   measure themselves with `getBoundingClientRect()` (transformed), so every
   measured surface believed it was 64% larger: mis-framed wavetable, the
   contextual toolbar over the preset bar, the original ghost bug.
3. **Duration was an input.** The timeline crammed the op list into a frame
   budget; nothing encoded "a human must be able to see this gesture."
   Result: single-frame cuts, teleporting parameters, a 0.9s flanger section.
4. **Acceptance was never in the loop.** Only the user ever watched a render.

## The architecture

**The render is a live, real-time performance of the real app, recorded from
the real compositor.**

- The master audio plays; a performance clock derived from `audio.currentTime`
  (wall clock when no audio) drives the existing
  `ScriptedInteractionDirector` and a thin live connection: per-frame
  parameter/stored-state publication (reuse `scripted-state`), telemetry and
  MIDI scheduled on the clock. Frame numbers advance at 30fps against the
  same timeline the audio was rendered from — sync is structural.
- The product runs in a plain same-origin iframe at its native 393×852 with
  **no transform anywhere above it**. Real timers, real rAF, real WAAPI, real
  activation choreography (the mock connection's own selectWavetable flow,
  driven by the director's real gesture — the frame-stepped copy of that
  choreography dies on this path).
- The stage (title card, phone, caption band) is laid out at 1× design size
  (9:16). Output resolution comes from capture device pixels / encode-side
  scaling — never from CSS transforms.
- **Capture = real compositor output.**
  - In-app: `getDisplayMedia` + Region Capture (`CropTarget.fromElement` on
    the stage) → `MediaRecorder`, with the playing master audio's
    `captureStream()` track muxed in the same recording. Requires Chromium
    with Region Capture; feature-detected with a clear message otherwise.
    The render is watched as it happens — every render is its own preview.
  - Review (agent/CI): the same performance page driven by Playwright with
    CDP screencast → ffmpeg. Review-grade output for watching choreography
    and paint without an engine build.

## Pacing: duration is an output

`assembleTimeline` drops the compression ladder. One pacing table at
perception scale (30fps frames): navigate 30, setParam 42, rapid 12,
selectWavetable 54, toggleEffect 24, mapRoute 66, configureMseg 72,
setEnvelope/setMacro 48, section lead-in 24 / tail 24 / minimum 105. The
video is as long as the build needs. `maxDurationInFrames` remains only as an
explicit caller ceiling backed by uniform time-scaling (no per-op crushing);
the default integrated flow uses the 2700-frame backstop.

## Audio: loudness leveling

`assembleSpeedrunMasterTrack` measures each audible section's RMS, computes a
clamped per-section gain toward the median section loudness (boost cap so the
patch's build still grows, silence never amplified), applies gains inside the
copy/crossfade math, then a global peak-safety scale. Kills the measured
10–20× loudness cliff between early and late sections.

## What survives, what dies

Survives: recipe/analyzer/timeline structure, `scripted-state`, the
interaction director (unmodified — pumped by the clock instead of frame
stepping), telemetry recording, checkpoint audio pipeline, missedOps
detection, sync/state/seam unit tests.

Dies (after user acceptance of a live render; deprecated immediately):
`renderScriptedVideoInIframe`'s frame-stepped pipeline, the capture-time
media clock's role in video (seams stay for tests), `capture-fidelity`'s
rasterizer compensations, `scripted-styles.css` overlay re-anchoring, the
fidelity gate's live-vs-rasterizer comparison (replaced by watching real
renders), pixel-probe determinism gates.

## Definition of done, per phase

Every phase that changes visible output ends with a render I have personally
watched frame-by-frame in this container (fixture recipe, review backend)
before it is offered to the user. Visual judgments compare against the live
product only. The user's eyeball remains the final gate; it stops being the
first one.

## Phases

1. Pacing rewrite + loudness leveling (pure logic, unit-tested here).
2. Live performance driver: clock, live connection, 1× stage, finger overlay,
   missed-op + lateness report at performance end.
3. Capture backends: in-app Region Capture recorder wired into the Bounce
   Video flow; Playwright/CDP review harness.
4. Render fixture performances here; watch; iterate choreography until it
   reads as a person building a patch.
5. Gates (missedOps empty, lateness bound, headless smoke), docs, push.
   Old path marked deprecated; deletion proposed after acceptance.
