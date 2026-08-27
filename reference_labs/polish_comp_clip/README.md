# T27 Polish Comp/Clip Reference Lab

This directory is the offline evidence and comparison half of T27. The separate
`fx/polish_lab/` package turns the same documented reset state into an
independently named, tunable VST3 design studio; neither half has a production
import or signal-path connection. The upstream product name appears only where
necessary to identify the cited source in `SAUSAGE_FATTENER_ANALYSIS.md` and the
pinned third-party artifact.

## What is evidence, and what is a model

| Layer | Retained here | Claim boundary |
|---|---|---|
| Closed-source original | The public fact that the product exists and Polarity's description of its broad behavior | No original binary, code, UI, audio capture, or proprietary behavior is copied or measured here |
| Polarity's recreation | His [published near-null report](https://polarity.me/posts/polarity-music/2024-08-12-sausage-fattener-in-bitwig/) and the pinned public Bitwig preset at commit `3852ef80ec3f97d93c6a7880c167b64a454ae961` | T27 did not independently run his preset against the original, so the reported null remains his claim |
| Decoded preset facts | Source SHA-256, byte offsets, exact big-endian IEEE-754 payloads, target paths, compressor records, gain records, transfer knots, and macro records | These fixtures establish what the preset stores, not the hidden DSP law used by Bitwig or the original |
| Cosimo reference inference | A conventional stereo-linked feed-forward peak compressor and a documented monotonic interpolation through the decoded curve | The renderer is deterministic and useful for T28 tuning; it is not described as a clone or a null-equivalent implementation |

The third-party `.bwpreset` and its embedded low-cut impulse response are not
redistributed. `fixtures/source-artifact.json` pins the source, and
`fixtures/decoded-settings.json` retains every relevant field as a decimal,
eight-byte hexadecimal payload, absolute byte offset, and containing record.

## Exact decoded fixture

The stored comp/clip slice is:

- input Tool volume: `0.967718728128794` linear (`−0.2850170805322976 dB`);
- compressor threshold `0 dB`, hard knee `0`, ratio slope
  `0.9124000000000048`, attack `log10(seconds) = −3.6879999999999997`,
  release `−1.5720000000000016`, and makeup `−0.04000000000000409 dB`;
- conventional conversions used by the lab: `11.415525114155871:1`,
  `0.20511621788255668 ms` attack, and `26.79168324819022 ms` release;
- clipper drive: `−0.01920000000000002 dB`;
- output Tool volume: `1.0193734859388728` linear
  (`+0.16666666666666702 dB`);
- positive transfer knots `(input, output, tension)`:
  `(0, 0, 0)`,
  `(0.799438202247191, 0.7176422093981863, 0.42000000000000004)`,
  `(0.9272997032640949, 0.8935926773455377, 0)`, and
  `(0.9362017804154302, 1, −0.7200000000000001)`.

The source macro has three decoded targets:

| Target | Stored parameter domain | Stored map amount |
|---|---:|---:|
| input amplitude | `−36…+36 dB` | `+35.971200000000394 dB` |
| Dynamics output gain | `−36…+36 dB` | `+4.120000000000003 dB` |
| Dynamics high-ratio control | `−1…+1`, quantum `0.005` | `−0.025200000000000014` |

The older summary's “makeup over ±36 dB” and “ratio over ±100%” describe the
target domains, not the actual stored map amounts. The ratio control's nonlinear
normalization is proprietary and is not recoverable from this preset alone. For
audio renders, the lab honors the documented direction by moving the conventional
ratio slope from its decoded base to `1` (limiting) across the macro. That is a
Cosimo inference; the raw `−0.0252` record remains pinned separately.

## Transparent DSP choices

The renderer in `lib/reference-dsp.mjs` uses:

- a maximum-of-left/right peak detector, a conventional hard-knee feed-forward
  static curve, and one-pole attack/release coefficients;
- no lookahead, because none is established in the retained settings;
- odd symmetry for the positive transfer knots;
- a monotonic cubic perturbation of linear interpolation,
  `u + tension × u × (1 − u) × (1 − 2u)`, using the tension stored on the
  segment's right-hand point;
- a flat plateau above the last decoded knot.

Bitwig's detector ballistics, ratio normalization, transfer interpolation,
oversampling, channel-link details, and embedded low-cut convolution are not
publicly established by the preset. The low-cut IR and Color EQ are deliberately
outside these renders so T28 can compare the comp/clip character without
confounding its separately owned Safe Bass and Enhancer stages.

## Retained comparison bundle

`corpus/` contains 1.5-second, 48 kHz stereo float WAVs for a transient drum bus,
a mono-compatible harmonic bass sequence, and a stereo bright-poly hold. The
seeded generators live in `lib/corpus.mjs`; checked-in WAV hashes are pinned by
`bundle-manifest.json`.

For each program, `renders/raw/` and `renders/level-matched/` contain macro
positions 0, 0.5, and 1. The matched file uses one constant stereo-linked gain
to match unweighted integrated RMS from 100 ms through the end. This is a
controlled audition comparison, not LUFS matching or a true-peak guarantee.
`measurements.json` retains full-precision peak, RMS, crest, correlation, match
gain, gain-reduction, curve-region, and overload measurements;
`measurements.csv` is the compact tuning view.

## Repeat it

```sh
npm run test:reference:polish
npm run reference:polish:extract
```

The first command reruns deterministic value, transfer, isolation, WAV-hash,
render, and measurement gates without network access. The second fetches the
preset from its pinned commit, checks its SHA-256, parses it again, and requires
an exact match with the retained extraction fixture. To intentionally regenerate
the checked-in corpus and render bundle after changing the transparent model:

```sh
npm run reference:polish:update
```

T28 should audition the level-matched files and use the measurements as one
comparison target. It should not import this renderer, inherit its name, or
treat its inferential compressor/curve choices as production requirements.

For live tuning, build and associate `fx/polish_lab/` with
`npm run fx:jit:install -- polish`, then load `CmajPlugin.vst3` in Ableton. The
retained Ableton and independent host evidence is in `validation/`; complete
controls, reset values, and honest unknowns are documented in
`fx/polish_lab/README.md`.
