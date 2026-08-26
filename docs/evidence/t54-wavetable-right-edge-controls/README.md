# T54 Wavetable Right-Edge Control Evidence

These captures use the real composed `DesktopPatchView` interface from the T54 task branch. The phone captures deliberately request obstructed top or middle Mod-bar docks; production projects the displayed bar to the nearest control-free position while leaving that requested dock unchanged in storage.

## Measured insets

| Surface | Viewport | Top left/right | Bottom left/right |
| --- | ---: | ---: | ---: |
| Phone | 393 x 852 | 8 px / 8 px | 8 px / 8 px |
| Plugin | 1120 x 680 | 15 px / 15 px | 5 px / 5 px |
| Desktop | 1440 x 900 | 15 px / 15 px | 5 px / 5 px |

The phone measurement pairs Wavetable with Warp and Voices with Semitone inside the compact wavetable graph. The plugin and desktop measurements pair the existing top and bottom controls inside the noncompact wavetable card. `geometry.json` contains the underlying rectangles.

The automated regression additionally covers top, middle, and bottom requested positions at 320 x 568 and 393 x 852, both rail edges, collapsed and expanded states, dynamic Retry Load appearance, a real rail drag, and the compiled 393 x 852 desktop bundle.

## Reviewed result

- Warp and Semitone return to the same 8 px graph inset as their corresponding left-side controls.
- All four compact controls remain fully inside the graph and the opposite controls do not intersect.
- Unsafe Mod-bar requests project the complete visible rail into the nearest free vertical segment; expanding the drawer cannot cover a Voice graph control.
- Layout projection does not rewrite the stored normalized request, and the rail remains draggable, edge-dockable, expandable, and collapsible.
- The phone, plugin, and desktop wavetable graphics retain their existing bounds and remain visible behind the established overlay controls.
- No control dimensions, labels, hit areas, bindings, gestures, or modulation behavior changed.

## Artifacts

- `phone-393x852.png`
- `phone-320x568-left-middle-request.png`
- `phone-393x852-right-middle-expanded.png`
- `plugin-1120x680.png`
- `desktop-1440x900.png`
- `geometry.json`
- `scripts/capture_t54_wavetable_right_edge_evidence.mjs` (reproducible capture and geometry validation)

Physical finger comfort on an iPhone remains a manual acceptance check; the browser geometry and existing interaction suite verify the implementation seam.
