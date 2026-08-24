# Bounce Video M2: real interaction pass

Date: 2026-08-24  
Branch: `claude/video-bounce-ui-animation-7trtmw`

## Outcome

The scripted session now drives the production `DesktopPatchView` through its
existing DOM and connection seams. No replica component, capture-only
transient prop, reduced-motion shortcut, or integrated-flow switch is involved.

`ScriptedInteractionDirector` resolves live `data-role` targets from the
capture subtree and authors pointer timestamps from video media time. It drives:

- workspace, oscillator, FX-device, and mod-source navigation;
- oscillator/readout and rack-knob drags, including the production precision
  HUD;
- wavetable selection with the production picker and scripted loading runtime
  state;
- effect power toggles;
- the full mod-source route gesture (drawer/select, drag ghost, hit-tested
  capture highlight, drop, and confirmation);
- MSEG point, all three ADSR handle, and macro range drags; and
- direct panel scrolling when a live target is below the fold.

The cosmetic finger follows those real inputs. The director adopts every new
Web Animation at its first-seen frame, pauses it, and scrubs it from that media
frame. Gesture-end connection updates are exact recipe-value snap corrections;
the production gesture owns the transient state during the operation.

## Capture-layout correction

The first interaction renders exposed a deterministic layout defect rather
than a Chromium timing race. The dedicated video Vite build did not run the
Tailwind plugin, leaving the real desktop stylesheet's Tailwind layers
unexpanded. The mobile tree consequently computed as block layout and changed
geometry while responsive SVG sizes were inlined.

The video bundle now uses the same Tailwind transform as the product bundle.
Capture SVGs are pinned using their untransformed local `clientWidth` and
`clientHeight`, and their original attributes/styles are restored before the
next frame. This prevents transformed phone-stage dimensions from feeding back
into flex layout. No product CSS or component visuals changed.

## Gate evidence

`node --test tests/test_video_bounce_scripted_gestures_browser.mjs` passed 1/1.
The 487-frame gesture fixture rendered and inspected these focused spans:

| Probe | Frames | Inspected frames | Encoded probe bytes |
| --- | ---: | ---: | ---: |
| Sources / MSEG / ADSR / macro | 0–117 | 118 | 230,617 |
| Voice / wavetable / HUD drag | 144–197 | 55 | 124,558 |
| Filter route drag | 236–283 | 49 | 100,622 |
| FX toggle / knob / route drag | 296–391 | 97 | 204,608 |

The assertions observe production DOM state inside the hit-testable 393×852
capture stage: selected MSEG points, each ADSR pointer target, the macro input,
`Loading Basic_Cjw`, `data-dragging="base"`, a visible percent HUD, the real
route ghost, `is-mod-hover` capture, powered `delay#2`, and the confirmed Delay
Mix route.

The M1 determinism gate re-passed in two independent renders. Exact pre-encode
RGBA SHA-256 values matched at every sampled frame:

- frame 96: `6825f08c349c01c8489f68d0078828657f03020e342ed921354f75593f3c2678`
- frame 97: `52d286b7531e5c49755395e5aeb4605d0f6532baf3d3234aade5a651b3511c44`
- frame 98: `726cc31d51817db69738239290501a43a066132e43c7fd1cc33cf2664d35f7d3`

Each deterministic probe encoded to 9,481-byte WebM. The existing integration
suite also passed 1/1 after a documented Ubuntu web build, proving the preset
launcher, current-patch intake, lazy boundary, renderer, and download path
remain intact.

Both video and scripted-harness production builds pass. The video bundle is
lazy and currently measures 5,107.97 kB JavaScript (1,391.17 kB gzip) plus
1,242.48 kB CSS (813.81 kB gzip). M4 owns the final lazy-bundle assessment.

The gesture suite took 120.6 seconds on the small shared Linux VM because it
rasterizes 319 real-UI frames. This is export/test throughput, not a failed
performance gate; the approved VM rule treats absolute time as informational.
