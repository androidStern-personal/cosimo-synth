# Interface Extrusion Toolkit

A generic, manifest-driven proof-of-concept for turning sections of any fixed-size HTML interface into animated raised panels in Blender.

This was designed for the Cosimo synth use case, but it is intentionally decoupled from Cosimo. The contract is a manifest that points to a capture root and the section selectors to extrude.

## What this does

```text
manifest.json
→ Playwright browser capture
→ interface.png + layout.json + debug-outlines.svg
→ Blender Python scene generator
→ base interface plane + animated raised section panels
```

The important design decisions:

- `layout.json` is the primary geometry contract.
- `interface.png` is the texture atlas.
- `debug-outlines.svg` is only for visual verification.
- Blender geometry is generated directly from JSON.
- Panel skins receive direct per-loop UVs computed from CSS coordinates.
- Panel bodies are dark physical geometry; the UI texture is not wrapped onto the sides.
- Protrusion animation is parameterized, not destructive extrusion.

## Requirements

For tests only:

- Node.js 20+
- Python 3.10+

For actual browser export:

- Node.js
- `npm install`
- Playwright browser install: `npx playwright install chromium`

For actual Blender scene generation:

- Blender 4.x or 5.x available on the command line as `blender`

## Install

```bash
npm install
npx playwright install chromium
```

## Run tests

```bash
npm test
```

The tests do not require Blender or Playwright. They verify the pure invariants: CSS-pixel mapping, high-DPI crop math, radius parsing, rounded-rectangle geometry, UV coordinates, normalized body depth, and animation envelope behavior.

## Try the static example

Terminal 1:

```bash
npm run serve:example
```

Terminal 2:

```bash
npm run export:example
```

This writes:

```text
captures/example-static/interface.png
captures/example-static/layout.json
captures/example-static/debug-outlines.svg
```

Then generate a Blender scene:

```bash
mkdir -p out
blender --background --python blender/generate_interface_scene.py -- \
  --manifest manifests/example.static.json \
  --layout captures/example-static/layout.json \
  --image captures/example-static/interface.png \
  --output out/example-static.blend
```

Open `out/example-static.blend` in Blender.

## Manifest format

```json
{
  "interfaceId": "cosimo-synth",
  "capture": {
    "url": "http://localhost:5173/capture",
    "rootSelector": "#cosimo-root",
    "widthCss": 1600,
    "heightCss": 1000,
    "screenshotScale": "css",
    "waitForCaptureReady": true,
    "animations": "allow"
  },
  "sections": [
    { "id": "wavetable", "selector": "[data-cosimo-panel='wavetable']" },
    { "id": "filter", "selector": "[data-cosimo-panel='filter']" }
  ],
  "world": {
    "unitsPerCssPixel": 0.01,
    "surfacePlane": "XY",
    "extrusionAxis": "Z"
  },
  "animation": {
    "preset": "surface_skim_popout_reveal",
    "fps": 30,
    "durationFrames": 360,
    "maxDepth": 0.35,
    "sectionOrder": ["wavetable", "filter"]
  }
}
```

## Capture root requirements

For v1, the capture root must be fixed-size and non-scrollable:

```css
#cosimo-root {
  width: 1600px;
  height: 1000px;
  overflow: hidden;
  position: relative;
}
```

Sections must be simple rectangular DOM elements:

- axis-aligned
- no CSS rotate/skew/transform
- no `clip-path`
- no non-rectangular visual shape
- v1 supports only circular pixel border radii

## Capture determinism

Do not rely on Playwright's `animations: "disabled"` as the primary freeze mechanism. It fast-forwards finite animations and cancels infinite animations to their initial state. Prefer an app-level capture mode:

```js
window.__INTERFACE_CAPTURE_MODE__ = {
  articulation: "pluck",
  velocity: 91,
  freezeMeters: true,
  animationFrame: 0
};
window.__INTERFACE_CAPTURE_READY__ = true;
```

Then set `waitForCaptureReady: true` in the manifest.

## Screenshot scale

The exporter defaults to `screenshotScale: "css"`, which forces one image pixel per CSS pixel. This keeps `layout.json` coordinates and `interface.png` pixels aligned.

If you later use device-scale screenshots, `layout.json` records:

```json
{
  "pixelScaleX": 2,
  "pixelScaleY": 2
}
```

Blender UVs stay normalized to CSS dimensions, but any raw canvas crop must multiply source coordinates by those scale factors.

## Blender scene model

The generated scene uses:

```text
BaseInterface
Body_<section-id>
Skin_<section-id>
Camera
Camera_Target
```

Each `Body_*` object has normalized local Z geometry from 0 to 1. Its back plane is at Z=0. Scaling `body.scale.z` therefore grows the panel outward without pulling the back off the interface.

Each `Skin_*` object is a thin front face whose `location.z` follows:

```text
current_depth + epsilon
```

That keeps the UI texture on the front of the panel and prevents z-fighting.

## Camera motion

The default generator creates a rough surface-skimming reveal pattern:

```text
low POV skim toward section
→ section protrudes
→ camera lifts/pulls back for reveal
→ section retracts
→ camera dives back to the interface
→ continue to next section
```

This is intended as a generated starting rig, not final cinematography.

## Known limitations

- v1 only supports rectangular DOM sections with circular px border radii.
- v1 does not support rotated/skewed/transformed sections.
- v1 does not support clip paths or arbitrary SVG shapes.
- Lighting and camera motion are intentionally basic.
- The Blender generator is a starting rig, not a polished final trailer renderer.
