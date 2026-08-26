# T33/T34/T36 MSEG editor evidence

These captures mount the production desktop patch view against the repository's Cmajor connection harness; they are not replica markup.
Every surface uses the same seeded MSEG: shape A is the default rise and shape B is a distinct three-point curve, so the live Morph capture has an unambiguous visual result.

- `phone-393x852-drawer.png` and `phone-393x852-full.png` cover the phone surfaces.
- `phone-393x852-drawer-morph-hud.png` proves the drawer's live Morph amount is visible in the shared precision HUD.
- `phone-393x852-full-rate-hud.png` proves the full editor's live Rate HUD is above the editor rather than hidden behind it.
- `plugin-compact-600x520-drawer.png` covers the drawer at a narrow plug-in window.
- `plugin-tall-600x916-full.png` covers the exact tall 600 px review viewport, including its vertical time ruler and bottom control row.
- `plugin-900x600-full.png` covers the full editor at a representative plug-in aspect ratio.
- `plugin-900x600-full-morph-live.png` captures the effective A/B morph as the primary envelope during the real knob gesture.
- `desktop-1280x900-full.png` covers the full editor at desktop size. The drawer is intentionally unavailable above the product's 639 px compact breakpoint.
- `geometry.json` records the exact viewport, shell, graph, controls, time-axis, border, and shadow geometry visible in each capture.

Regenerate with:

```sh
node --test tests/tools/capture_mseg_editor_evidence.mjs
```
