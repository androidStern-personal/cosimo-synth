# Circular modulation-source icons

The SVG files are the production masters. `svg/fixed` contains each source in its assigned family color; `svg/mask` contains white alpha-mask versions that can be tinted to any color without duplicating the asset matrix.

The PNG directories contain physical-pixel exports for the app's supported logical sizes (24, 32, and 44 CSS pixels) at 1x, 2x, and 3x display density. `manifest.json` owns the palette, source identities, paths, and size matrix.

Source families:

- Macro: orange `#ff6b2c`
- Cyclic/LFO: cyan `#54d9ff`
- Envelope and MSEG shapes: magenta `#d978e5`
- Performance sources: lime `#b9d947`

The inner audio glyphs are vendored fontaudio artwork. See the repository `CREDITS.md` for attribution and licensing.

Regenerate the complete family with:

```sh
npm run assets:mod-sources
```
