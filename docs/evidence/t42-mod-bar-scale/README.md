# T42 Floating Mod Bar Scale Evidence

This evidence uses the real composed `DesktopPatchView` interface at local master `6c518a92`, before and after T42. It is not a reconstructed rail or a component-only fixture.

## Measured geometry

| Geometry | Before | After | Ratio |
| --- | ---: | ---: | ---: |
| Complete rail width | 40 px | 44 px | 1.100 |
| Collapsed rail height | 152 px | 167.172 px | 1.100 |
| Fixed tab / grip tap height | 128 px | 140.797 px | 1.100 |
| Selected-source and Note taps | 28 px | 30.797 px | 1.100 |
| Selected-source and Note icons | 16 px | 17.594 px | 1.100 |
| Route badge height | 13 px | 14.297 px | 1.100 |
| Handle | 7 x 12 px | 7.672 x 13.156 px | 1.096 |
| Inter-module gap | 10 px | 11 px | 1.100 |
| Outline | 1 px | 1.1 px | 1.100 |
| Drawer source tap | 40 x 28 px | 44 x 30.797 px | 1.100 |
| Paging tap height | 20 px | 22 px | 1.100 |
| Voice toggle | 34 x 28 px | 37.391 x 30.797 px | 1.100 |

The small sub-pixel difference in the rasterized handle ratio is browser pixel quantization. The governing CSS measurements are exactly 2.2 px dots on a 3.3 px gap.

## Safe bounds and review

- At 393x852 and 430x932, the recalculated default shifts only enough to expose the complete 340 px scaled drawer. Both edges finish 8.828 px above the workspace tabs, matching the scaled 8.8 px safety gap.
- At 320x568, the content cannot physically fit between the preset bar and sticky lower chrome. The drawer keeps a 121.328 px safe scroll viewport and finishes 8.844 px above the tabs; no part of the rail crosses either keep-out boundary.
- Left and right captures use the production grip drag to carry the same dock position across the screen. The rail silhouette, internal centering, chip clearance, and safe lower edge remain symmetric.
- Reviewed overlays show the intended proportional growth rather than selectively enlarged icons. The right-edge Voice chips move inward with the 44 px dock; the corresponding left-edge chips do the same after docking left. No drawer or unrelated Voice control was redesigned.

The automated browser contract measures icons, modules, labels, badge, activity bar, Note status mark, arrows, outline, gaps, handle, drawer sources, toggles, paddles, and actual button rectangles. It also advances paging, checks every visible Voice chip for intersection, and runs the narrow/tall matrix at both edges.

## Artifacts

- `before-geometry.json` — master measurements captured before implementation.
- `after-geometry.json` — reproducible measurements for all twelve after-state captures.
- `overlay-393x852-collapsed.png`, `overlay-393x852-expanded.png`, `overlay-320x568-collapsed.png`, and `overlay-430x932-expanded.png` — 50/50 before/after overlays from the composed interface.
- `before-*.png` — reviewed baseline captures.
- `after-*-right-*.png` and `after-*-left-*.png` — collapsed and expanded reviewed captures at 320x568, 393x852, and 430x932.

Recreate the after captures and measurements with:

```sh
node scripts/capture_t42_mod_bar_scale_evidence.mjs
```
