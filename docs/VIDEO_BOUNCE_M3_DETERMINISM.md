# Bounce Video M3: deterministic time seams

Date: 2026-08-24  
Branch: `claude/video-bounce-ui-animation-7trtmw`

## Outcome

The real-UI scripted renderer is reproducible over a complete recipe. M3 adds
only the product seams authorized by the approved plan:

- `uiTimeout` defaults to native `window.setTimeout`, with matching clear
  behavior. The isolated capture iframe installs a media-time scheduler for
  the inventoried decorative callbacks: HUD linger, route feedback/confirm/
  failure and count pulses, directional-panel cleanup, rail settle/dwell/
  duplicate feedback, recent-route and cursor reset, MSEG hold, subway and
  articulation long press, and articulation toast.
- The filter-spectrum smoother now reads the optional media clock. The shared
  mod-source live driver accepts frame hooks through its acquire seam. Both
  use native `performance.now`/rAF in the product and the frame controller in
  capture.
- The FrameDirector advances media time, dispatches connection and pointer
  inputs, scrubs WAAPI animations, fires due UI callbacks, advances smoother
  rAF work, then runs the existing settle protocol. Global timers and rAF are
  never virtualized.
- Capture-only CSS forces `content-visibility: visible` inside the scripted
  phone subtree so below-fold rows rasterize. The M0 light-DOM keyboard and M2
  exact-value gesture snaps remain the finalized implementations.

No product visual change, transient-forcing prop, reduced-motion shortcut,
replica edit, or integrated-flow switch landed in M3.

## Full-render reproducibility gate

`tests/test_video_bounce_scripted_hardening_browser.mjs` rendered the complete
439-frame effects-lane fixture twice at 1080×1920/30fps. Both passes inspected
all 439 frames, produced 1,037,133-byte WebM probes, and matched exact
pre-encode RGBA SHA-256 at every 30th frame:

| Frame | SHA-256 |
| ---: | --- |
| 0 | `053066acad95c6ab58361588a9cda9f62d04e40dd76b3750753245e2398b4366` |
| 30 | `1adf07cf3dc670c5118cac576a41f89e3f0b7e3f77913c2d50b0dc9ec81b4837` |
| 60 | `8fe95f5ed3216e6f28f38820c0802e3a0295b7ade922a279861ae9cda91fd47d` |
| 90 | `9c3c27629c065e40a0f2844b6ead8ce0c7c75c69f5e74053bbb6beb51d5e73c8` |
| 120 | `473e768fd40f958115b7026c0501e8c724724328658da1bdcb7530eacadf216d` |
| 150 | `f00af62a6a371f37b90bd86ed09cb435aa2e2902979ef24077b15c9c44677415` |
| 180 | `5e1043c9e80e9012b78b78ecd9bcccc7049b557ae2247530347ec8944bdc99c3` |
| 210 | `c59bbfd8c7b3c292cd46c1d9b495749406863b57de224ea9c01b2e6714067a40` |
| 240 | `c337d28a3bb2d662a01bc24339ff47cda0bd5ae851a62f6bf8e461f8a5d4afe9` |
| 270 | `dedb7d4b0622d066d1d39aede30f2ad4fb422257981220c9d0a6fc74b0ec076e` |
| 300 | `58f724f7515258e111e6f36c818039cb075912700fd1da0e9025e00b2b45493e` |
| 330 | `0fc8966bcfb69ac86c61b4c7626f2a48c938b66dedeaaeda76a9fb8c75758f6b` |
| 360 | `78647b649a9e93e7edd440d40dce9775308f28b5324993d858d0a75e50611e93` |
| 390 | `a45216271f6047d7bb4fe249ef615bc851d9c9d927e4cdf21c02cebac754dfa5` |
| 420 | `612dd5238290da3d23343bb0aa8959e77f3bc889474259db3e526182c074d38a` |

The passes took 178.8s and 185.1s on the small shared Linux VM. This is
full-resolution export throughput only; no time-based feature rejection was
applied.

## Product and pipeline evidence

- Product desktop browser suite: 222/222 pass when run sequentially. The
  default five-file suite at concurrency four initially passed 220/222; its two
  failures were explicitly CPU-sensitive probes (54.1ms against a 50ms commit
  threshold, and `performance.now` rail momentum). Both passed unchanged in
  isolation, then the whole suite passed with concurrency 1. No assertion or
  product threshold was relaxed.
- Bounce Audio soak: 10/10 cycles pass; deterministic generation three,
  exactly two OPFS banks / 76,896 bytes, flat advisory JS heap.
- Speedrun pipeline: 5/5 pass, including verified MP4/AAC, WebM fallback,
  effects-lane `delay#2`, maximal 2,700-frame analysis, and five-render resource
  soak.
- Speedrun audio: 6/6 pass in Chromium and WebKit. Core/hardening,
  mod-source, and capture-clock tests: 26/26 pass.
- Existing current-patch launcher/lazy-render/download integration: 1/1 pass.
  M0 real-UI fidelity: 1/1 pass. M2 gesture suite: 1/1 pass. M1 sampled hashes
  remain byte-identical.
- Both the real video bundle and scripted harness build in production mode.

The untouched replica composition suite still has its branch-baseline
Chromium-147 checked-in-PNG byte mismatch at `source-env-1` frame 0, already
recorded in M1. Its frame-purity test and decoded MP4/AAC alignment test pass.
M3 neither edits the replica nor rewrites its browser-version-specific goldens.
