# Cosimo Raised Panel Demo (3D cinematic3d)

This feature is a self-contained proof-of-concept that renders the existing Cosimo desktop UI panels as raised, textured 3D panels driven from live DOM measurements.

## Source of truth

The synth UI is not reimplemented for this demo.
The 3D renderer only wraps existing UI DOM sections using `data-cosimo-panel`:

- `wavetable`
- `filter`
- `distortion`
- `effect`
- `envelope`
- `mod`

Each panel root has:

- `data-cosimo-panel="wavetable"` etc.

The renderer validates there is exactly one element per required panel inside the capture root before building panel meshes.

## DOM measurement

`measureCosimoPanels(root)`:

- measures each identified panel with `getBoundingClientRect()`
- measures relative to the capture root using root rect minus panel rect
- reads `borderTopLeftRadius` from computed style
- clamps radius to `min(width, height) / 2`
- throws if a panel is missing, duplicated, out of bounds, or non-positive in size
- returns:

```ts
{
  width: number;
  height: number;
  panels: Array<{
    id: CosimoPanelId;
    x: number;
    y: number;
    width: number;
    height: number;
    borderRadiusPx: number;
  }>;
}
```

## Coordinate conversion

`panelRectToWorld()` converts DOM pixels into world coordinates using:

- `WORLD_SCALE = 1/100`
- `worldX = (panel.x + panel.width / 2 - rootWidth / 2) * worldScale`
- `worldY = -(panel.y + panel.height / 2 - rootHeight / 2) * worldScale`

Positive DOM Y becomes negative world Y so visuals align when composited in orthographic space.

## Texture generation

The capture frame renders the synth and keeps a `fullCanvas` texture for the full UI plane.

`cropPanelCanvases(sourceCanvas, layout)` generates one texture canvas per panel with `drawImage` using source coordinates from each panel rect, no manual PNG assets.

In browsers with `HtmlInCanvas` support, panels come from a live rendered capture.
Otherwise the demo falls back to an offscreen DOM screenshot texture and shows:

`HTML-in-canvas unavailable; using static screenshot fallback.`

## Panel geometry and scene

- Each panel uses an extruded rounded rectangle body (`THREE.ExtrudeGeometry`).
- The front panel skin is a separate mesh with a cropped panel texture.
- The base UI texture remains on a flat plane at `z = 0`.
- Body dark material renders panel sides; texture is only used for the front skin.
- `getPanelDepth(frame, panelIndex, maxDepth)` controls rise animation per panel with staggering.

## Animation

Default constants:

- `MAX_PANEL_DEPTH_WORLD = 0.35`
- `DEMO_FPS = 30`
- panel rise starts at frame `20 + panelIndex * 4`, ends `35` frames later

At start: all depths are `0`.
After frame ~80: all visible rise depths are `> 0`.

## Fallback behavior

If the browser does not support `HtmlInCanvas`:

- the demo captures an offscreen DOM screenshot with `html2canvas`
- the feature remains operational while panel assignment DOM is available
- if screenshot capture fails, it falls back to a generated placeholder canvas instead of crashing

## Run it

Start desktop UI dev server:

```bash
npm run ui:desktop:dev
```

Open:

`http://127.0.0.1:5174/ui/desktop/cinematic3d/index.html`

Enable debug overlays:

`http://127.0.0.1:5174/ui/desktop/cinematic3d/index.html?debug=true`

Render via Remotion (if you install and run Remotion CLI for this repo):

```bash
# remotion cli and matching versions are now installed in package.json
npm run cinematic3d:render
```

## Known limitations

- This is visual/demo-only and does not modify DSP/Cmajor DSP files.
- It is isolated to `ui/desktop/cinematic3d`.
- Browser and device pixel ratio can affect final sharpness.
- In unsupported browsers the full panel geometry and mapping behavior is still measured, but the texture atlas is not live-captured.
