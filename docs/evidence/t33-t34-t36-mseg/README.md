# T33/T34/T36 MSEG editor evidence

These captures mount the production desktop patch view against the repository's Cmajor connection harness; they are not replica markup.

- `phone-393x852-drawer.png` and `phone-393x852-full.png` cover the phone surfaces.
- `plugin-compact-600x520-drawer.png` covers the drawer at a narrow plug-in window.
- `plugin-900x600-full.png` covers the full editor at a representative plug-in aspect ratio.
- `desktop-1280x900-full.png` covers the full editor at desktop size. The drawer is intentionally unavailable above the product's 639 px compact breakpoint.
- `geometry.json` records the exact viewport, shell, graph, controls, time-axis, border, and shadow geometry visible in each capture.

Regenerate with:

```sh
node --test tests/tools/capture_mseg_editor_evidence.mjs
```
