# Bounce Video M1 scripted-state evidence

Date: 2026-08-24

Branch: `claude/video-bounce-ui-animation-7trtmw`

Renderer: `@remotion/web-renderer@4.0.491` fallback rasterizer

Gate browser in this VM: Chromium 147.0.7727.15

Capture viewport/output: 393x852 CSS pixels inside 1080x1920 at 30 fps

## Result

The scripted renderer mounts the production `DesktopPatchView` in a
same-origin phone-sized iframe. It is driven from outside React by a
`ScriptedPatchConnection`; there are no product props that force transient UI
states. The existing replica and the integrated product-flow default remain
unchanged for M1.

The three-frame M1 video proof renders the real view twice in independent
iframes. Pre-encode RGBA SHA-256 values match exactly:

| Frame | SHA-256 |
| ---: | --- |
| 96 | `8f7327123b1fe68fb43cb62347713c10a0ef87437a90852a4b9149370189a7ba` |
| 97 | `a78a1b3d22cae731d576d3f409e179b32ac5cd91f58592b2ecfc63c8ce27c7c5` |
| 98 | `1c9059912edd5726124abe73aeca8e12babf19a8fd7921f0ee567772b1794a13` |

The proof emitted a verified 4,244-byte WebM sample. Every inspection saw the
393x852 iframe viewport, a hit-testable Remotion scaffold, two real canvases,
29 real SVGs, and 18 Cmajor keyboard notes. Frame 96 had a lit MIDI note and
received effective wavetable, warp, unison, filter, MSEG, and modulation-source
telemetry. The hidden iframe's rAF probe passed in `visibility:hidden` mode, so
the opacity fallback was not used on the gate browser.

The M0 live-vs-capture harness was rerun after the persistent-frame shadow/SVG
settle changes. Voice/HUD, FX/Filter, and Mod/route-ghost scenarios all remain
present and nonblank; mean pixel deltas were 5.4339, 9.9674, and 5.3324. This
is the A/B rasterizer evidence for the same real component tree used by M1;
the M1 frame proof adds exact cross-render identity at frames 96-98.

## State and telemetry seams

- Recipe parameters use the accepted smoothstep interpolation and operation
  thresholds. Stored `lane.v1`, `modulation.v6`, and `articulations.v4` state
  is serialized through ordinary connection listeners.
- Runtime wavetable state, recorded effective-state telemetry, optional scope
  endpoints, and performance MIDI are emitted through the normal
  `PatchConnectionLike` surface at exact integer video frames.
- The offline checkpoint renderer subscribes after installation, retains the
  last endpoint value per 1,600-sample video frame, and splits render advances
  at frame boundaries. The global track is spliced at the same section frame
  authority as the master WAV.
- Real wavetable resources are prefetched through the existing resource bundle;
  the real Cmajor keyboard class is capture-subclassed into light DOM without
  changing the product keyboard.
- `FrameDirector` reveals the renderer scaffold for hit testing, advances the
  external connection in `flushSync`, waits for fonts/images/React/canvas
  settlement, projects capture-only shadow leaves, pins standalone SVG boxes,
  and pauses WAAPI animations at deterministic media time.

## Gate evidence

Passing commands/results on this VM:

- `npm run test:video-bounce:scripted-state`: 1/1; two independent renders,
  three exact sampled-frame hashes.
- `npm run test:video-bounce:fidelity`: 1/1.
- `npm run test:speedrun:audio`: 6/6 after installing the pinned Playwright
  WebKit runtime; Chromium and WebKit PCM/telemetry determinism pass.
- `npm run test:speedrun:core`: 14/14.
- `npm run test:speedrun:hardening`: 2/2.
- `node --test tests/test_video_bounce_integration_browser.mjs`: 1/1; the
  preset launcher, lazy boundary, current-patch WAV, video, and download remain
  unchanged.
- `node --test tests/test_speedrun_composition_browser.mjs`: frame-purity and
  decoded MP4/AAC alignment pass. Alignment errors are -0.30625 frame for all
  three click events.

Two pre-existing, platform-sensitive assertions are recorded as VM exceptions,
not scripted-session failures:

1. The pipeline completed its renders and verified WebM/VP9/Opus, including
   its dedicated fallback case, but three assertions hard-code MP4. This Linux
   VM exposes no native AAC WebCodecs encoder, so the product's existing
   capability detector correctly selects WebM. MP4/H.264/AAC remains a final
   verification item on a capable Mac.
2. The untouched replica's first checked-in PNG golden differs at frame 0 on
   Chromium 147 (`936,956` current bytes versus `961,700` checked in). Its
   frame-purity test and encoded alignment test pass. The assertion now compares
   exact byte length and SHA-256 instead of asking Node to format a multi-megabyte
   byte diff; before that reporting-only hardening, the VM kernel OOM-killed
   Node at 7.63 GiB RSS while constructing the failure message.

Neither exception is caused by M1 code, changes product output, or authorizes a
different architecture. The real-UI deterministic WebM path is the supported
gate path on this VM.

## VM performance note

The two independent three-frame real-UI renders completed in about 7.3 seconds
total on this small VM. The video bundle is 5,084.47 kB raw / 1,385.36 kB gzip;
its extracted CSS is 116.67 kB raw / 58.81 kB gzip. These are export-time and
lazy-boundary costs, not interactive product costs. Per the user instruction,
VM wall time is recorded but is not a hard rejection of performance expected
on faster Mac/iOS hardware.
