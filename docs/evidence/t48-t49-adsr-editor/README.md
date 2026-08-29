# T48/T49 responsive ADSR editor evidence

The ADSR screenshots mount the production `DesktopPatchView`, and the iPhone MSEG screenshots mount the production `createIOSPatchView`, against repository Cmajor connection harnesses. They are real in-context synth surfaces, not replica markup, and no generated UI bundle or native wrapper is involved.

- `phone-393x852-compact.png` shows the short Envelope drawer.
- `phone-393x852-live-resize.png` captures the drawer while its real grab gesture is still in progress.
- `phone-393x852-expanded.png` shows the settled half-height drawer.
- `phone-393x852-full.png` shows the phone's full Envelope editor.
- `desktop-1280x900.png` shows the same responsive editor in the desktop composition.
- `desktop-1280x900-mseg-colors.png` shows MSEG B selected while A stays purple, B stays gray, and the realized shape stays cyan.
- `iphone-390x844-mseg-a-emphasized.png` mounts the live iPhone source composition with Shape A edited and one segment emphasized; both the segment and A remain purple while B remains gray.
- `iphone-390x844-mseg-b-emphasized.png` shows the reciprocal iPhone state: Shape B and its emphasized segment remain gray while A remains purple.
- `phone-393x852-decay-bubble.png` shows horizontal breakpoint ownership and its compact time bubble.
- `phone-393x852-sustain-bubble.png` shows Sustain acquired from the middle of the horizontal segment with only a percentage bubble.
- `geometry.json` records the exact viewport, shell, SVG/viewBox, curve, visible-handle, hit-target, stroke, and bubble geometry behind the captures.
- `iphone-mseg-identity.json` records the exact computed A, B, and emphasized-segment strokes for both source-composed iPhone captures.

Regenerate with:

```sh
node --test tests/tools/capture_adsr_editor_evidence.mjs
```
