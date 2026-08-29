# T48/T49 responsive ADSR editor evidence

These screenshots mount the production `DesktopPatchView` against the repository's Cmajor connection harness. They are real in-context synth surfaces, not replica markup, and no generated UI bundle or native wrapper is involved.

- `phone-393x852-compact.png` shows the short Envelope drawer.
- `phone-393x852-live-resize.png` captures the drawer while its real grab gesture is still in progress.
- `phone-393x852-expanded.png` shows the settled half-height drawer.
- `phone-393x852-full.png` shows the phone's full Envelope editor.
- `desktop-1280x900.png` shows the same responsive editor in the desktop composition.
- `desktop-1280x900-mseg-colors.png` shows MSEG B selected while A stays purple, B stays gray, and the realized shape stays cyan.
- `phone-393x852-decay-bubble.png` shows horizontal breakpoint ownership and its compact time bubble.
- `phone-393x852-sustain-bubble.png` shows Sustain acquired from the middle of the horizontal segment with only a percentage bubble.
- `geometry.json` records the exact viewport, shell, SVG/viewBox, curve, visible-handle, hit-target, stroke, and bubble geometry behind the captures.

Regenerate with:

```sh
node --test tests/tools/capture_adsr_editor_evidence.mjs
```
