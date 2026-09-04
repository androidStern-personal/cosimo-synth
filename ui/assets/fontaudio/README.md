# Fontaudio identity assets

These SVGs are vendored from [fefanto/fontaudio](https://github.com/fefanto/fontaudio) at commit `320ea19819bf66429fa772d6c04614ae75815895`.

Audio and effect identity components should resolve these files at their leaf seam. Do not duplicate their path data or substitute locally drawn audio glyphs inside product components. See the repository `CREDITS.md` for attribution and licensing.

The repository chose fontaudio for instrument identities on 2026-07-18. Use it for envelopes, waveforms, filters, modulation, keyboards, and other audio identities; the surface's existing generic icon set may still handle verbs such as add, close, carets, and navigation. Data plots are not identity glyphs.

The upstream icons are CC BY 4.0, fonts are OFL 1.1, and code is MIT. At adoption time there was no npm package, so this repository pinned and vendored the assets. Keep the rendering seam replaceable: a future bespoke family should be a leaf substitution rather than a rewrite of product components.

This policy is not fully enforced across every synth surface yet. `tests/test_seqfx_fontaudio_assets.mjs` protects the SeqFX assets and credit, but remaining literal instrument paths need migration and visual acceptance before the guidance can be retired as source-enforced.
