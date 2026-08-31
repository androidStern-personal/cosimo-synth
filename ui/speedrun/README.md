# Sound Speedrun Studio

The Sound Speedrun Studio turns one current oscillator-mode Cosimo sound and
one MIDI/JSON performance into a downloadable, locally rendered video. The
pipeline is browser-only: no sound, performance, PCM, or encoded video is
uploaded to a render service.

The studio is a standalone web surface. It does not run inside the desktop or
iPhone plugin bundles and it does not mutate the selected sound.

## Run locally

For the development server:

```sh
npm run speedrun:dev
```

Open `http://127.0.0.1:5175/`. The command first rebuilds the generated Web
performer and worker assets, then starts Vite with the studio at its root.

For the production-equivalent static build:

```sh
npm run speedrun:build
npm run web:serve
```

Open `http://127.0.0.1:8123/speedrun/`. The complete static surface is emitted
under `build/web/speedrun/`; the performer, workers, fonts, and factory assets
remain under `build/web/`. Serve that common root over HTTP—`file://` is not a
supported runtime.

“Current browser sound” reads the browser patch stored on the studio's current
origin. When the synth and studio are not served from the same origin, use a
patch file or paste a share link instead.

## Inputs and output

Sound input accepts:

- the same-origin current browser patch;
- current preset-v2, browser-patch-v2, or bare patch JSON files;
- a current Cosimo `#p=2` sound-share link.

Performance input accepts SMF format 0/1 MIDI, including tempo changes,
running status, CC, and pitch bend; the JSON note-list format; or the bundled
2.4-second demo phrase.

Bounced/sampled sounds are deliberately refused. Their audio banks do not fit
the current reconstruction or URL-sharing contracts.

The default duration ceiling is 90 seconds. A complex sound is compressed
through the deterministic pacing levels and the applied level is shown in the
recipe report. Pacing compression changes presentation timing only; it does
not remove reconstruction sections.

Sound-share URL compression is independent of video timing and encoding. A
share URL over 8,000 characters is warned; over 128,000 characters the copy
action is unavailable, while sound analysis and video rendering continue.

## Pipeline behavior

1. Intake validates and normalizes the sound against the generated current
   performer contract.
2. Analysis emits audible sections, captions, and an inspectable omitted-facts
   report.
3. Checkpoint audio renders through fresh generated performers in the existing
   short-lived Bounce worker pool. The assembled WAV can be auditioned first.
4. The 1080x1920 video renders the REAL DesktopPatchView in a scripted
   session: a phone-width iframe hosts the render, a scripted patch connection
   replays exact recipe state plus engine telemetry recorded during the audio
   render, synthetic pointer scripts drive the production gesture code, and
   CSS animations are scrubbed to media time per frame. (The rejected
   frame-pure replica composition is retained behind
   VITE_COSIMO_VIDEO_BOUNCE_REPLICA=1 and the standalone studio page until its
   disposal is decided.)
5. The encoded blob is withheld until verification proves its container,
   codecs, one video/one audio track, timeline duration, and decoded non-silent
   audio in every audible section window.

Audio and video progress are separate. Either active stage can be cancelled.
Preparing a new sound revokes prior output URLs; rerendering replaces and
revokes the superseded artifact; leaving the page cancels active work and
revokes everything owned by the session. Every checkpoint worker is terminated
when its one job settles.

## Browser and container support

MP4 with H.264 video and AAC audio is the primary Chromium/Chrome/Edge path.
When that complete encoder combination is unavailable, the studio offers a
labeled WebM fallback using VP9 video and Opus audio. Format selection is based
on real WebCodecs capability checks; the studio never silently substitutes a
different container.

Analysis and audio can still be used when video encoders are unavailable. The
render button explains that video export requires a WebCodecs browser.

The committed browser gates exercise both verified MP4/H.264/AAC and verified
WebM/VP9/Opus output in Chromium. Safari remains a secondary capability-gated
path; do not infer a physical-iPhone video-export claim from the WebKit audio
and composition suites.

## Live render path (shipped)

The integrated Bounce Video flow records a REAL-TIME PERFORMANCE of the real
DesktopPatchView: the master audio plays, the interaction director performs
the recipe against the live UI on the audio clock, and the browser's own
compositor output is captured via Region Capture into a MediaRecorder file.
No frame-stepping, no DOM rasterizer — what you watch during the render is
the video. Requirements: a Chromium browser with Region Capture; the render
takes the video's real duration and shows one own-tab capture prompt.
`VIDEO_BOUNCE_LIVE_RENDER_PLAN.md` is the architecture record; the
frame-stepped scripted path is deprecated behind
`VITE_COSIMO_VIDEO_BOUNCE_SCRIPTED=1` pending deletion.

Review-grade renders (no engine, no capture permission — used by agents/CI to
WATCH output before shipping):

```sh
npm run ui:video-bounce:build && npm run speedrun:live:harness:build
npm run speedrun:live:review            # writes build/live-review/review.mp4
```

## Verification commands

```sh
npm run test:speedrun:unit
npm run test:video-bounce:live
npm run test:speedrun:hardening
npm run test:speedrun:audio
npm run test:speedrun:core
npm run test:speedrun:midi
npm run test:video-bounce:fidelity
npm run test:video-bounce:scripted-gestures
npm run test:video-bounce:scripted-hardening
npm run test:video-bounce:integration
```

The replica-only suites (`test:speedrun:replica:pipeline`,
`test:speedrun:replica:composition`) are parked with the rejected replica and
run only while it remains in the tree; they are not part of the product gate
set.

The hardening fixture is generated from the current performer contract. It
carries all 142 public parameters, stores all 1,484 legal modulation mappings,
enables all 8 current effect types, and keeps all 3 oscillators audible. The
browser pipeline gate also performs five consecutive audio-plus-video renders,
tracking worker termination, object-URL lifetime, and post-GC heap bounds.

## Public-shipping hold

Technical completion does not resolve Remotion licensing. Before public ship,
a human must confirm the applicable company license and the production
telemetry/key configuration for `@remotion/web-renderer`. See
[`docs/SPEEDRUN_VIDEO_BROWSER_RENDERING.md`](../../docs/SPEEDRUN_VIDEO_BROWSER_RENDERING.md).
