# Bounce Video M0 fidelity evidence

Date: 2026-08-24  
Branch: `claude/video-bounce-ui-animation-7trtmw`  
Renderer: `@remotion/web-renderer@4.0.491` fallback rasterizer  
Gate browser in this VM: Chromium 147.0.7727.15  
Viewport: 393x852 CSS pixels at device scale factor 1

## Method

`tests/test_video_bounce_fidelity_browser.mjs` mounts the production
`DesktopPatchView` on `MockPatchConnection`, once as the live desktop harness
and once through `renderStillOnWeb`. It exercises real pointer handlers to
freeze a Voice HUD and a Mod route ghost mid-drag. The FX case opens the real
Filter station. All cases include the real Cmajor piano keyboard.

The gate checks both semantic and pixel evidence:

- active workspace, 18 visible piano notes, SVG and image leaf counts;
- presence, non-zero size, luminance range, and pixel variance for every
  representative leaf;
- live/capture landmark size within 1 px and position within 2 px;
- bounded whole-frame and leaf-region pixel differences.

Generated live, captured, diff, and JSON artifacts are written under the
ignored `build/video-bounce-m0-fidelity/` directory.

## Rasterizer gap fixes

- SVG presentation properties are resolved from computed style and inlined
  before the fallback rasterizer serializes each SVG in isolation. This keeps
  knob arcs and filter traces.
- Open shadow-root leaves are cloned into scoped light DOM for capture while
  the original connected nodes remain alive for their normal lifecycle. This
  keeps the preset header without changing the product component.
- The capture-only keyboard subclass retains Cmajor's logic and Cosimo's CSS,
  but renders its notes into light DOM behind a slot.
- Fonts and image decoding are awaited before capture.

## Passing result

| Scenario | Required live UI | Mean pixel delta | Strong-delta ratio |
| --- | --- | ---: | ---: |
| Voice/HUD | title, keyboard, knob SVG, filter trace, HUD | 5.8618 | 0.03203 |
| FX/Filter | title, keyboard, filter trace | 9.7882 | 0.03793 |
| Mod/route ghost | title, keyboard, PNG source face, drag ghost | 5.3450 | 0.02196 |

All landmark rectangles match exactly in the passing run. No required element
is missing, blank, or zero-sized.

## Accepted residual deltas

The fallback renderer reconstructs text, gradients, translucent backgrounds,
and shadows rather than copying Chromium compositor pixels. The remaining
deltas are therefore text/edge antialiasing, keyboard gradient and edge
antialiasing, and translucent shadow/background repaint differences. The live
screenshot advances the drag ghost's entrance animation between DOM
inspection and screenshot; the captured tree is paused at the inspected
frame, so that one leaf has a larger local pixel delta while retaining exact
geometry and visible detail. No residual is a missing product leaf or a
restyled substitute.

Run:

```sh
npm run test:video-bounce:fidelity
```
