# T54 Wavetable Right-Edge Control Evidence

These captures use the real composed `DesktopPatchView` interface from the T54 task branch. The phone rail is parked at its existing lower dock so the wavetable itself is unobstructed during visual review; T54 does not change the rail's placement or interaction behavior.

## Measured insets

| Surface | Viewport | Top left/right | Bottom left/right |
| --- | ---: | ---: | ---: |
| Phone | 393 x 852 | 8 px / 8 px | 8 px / 8 px |
| Plugin | 1120 x 680 | 15 px / 15 px | 5 px / 5 px |
| Desktop | 1440 x 900 | 15 px / 15 px | 5 px / 5 px |

The phone measurement pairs Wavetable with Warp and Voices with Semitone inside the compact wavetable graph. The plugin and desktop measurements pair the existing top and bottom controls inside the noncompact wavetable card. `geometry.json` contains the underlying rectangles.

The automated regression additionally covers a 320 x 568 narrow phone, both left- and right-docked Mod rail states, and the compiled 393 x 852 desktop bundle.

## Reviewed result

- Warp and Semitone return to the same 8 px graph inset as their corresponding left-side controls.
- All four compact controls remain fully inside the graph and the opposite controls do not intersect.
- The phone, plugin, and desktop wavetable graphics retain their existing bounds and remain visible behind the established overlay controls.
- No control dimensions, labels, hit areas, bindings, gestures, or modulation behavior changed.

## Artifacts

- `phone-393x852.png`
- `plugin-1120x680.png`
- `desktop-1440x900.png`
- `geometry.json`

Physical finger comfort on an iPhone remains a manual acceptance check; the browser geometry and existing interaction suite verify the implementation seam.
