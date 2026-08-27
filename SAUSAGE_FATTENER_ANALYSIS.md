# Sausage Fattener — Extracted Reference Settings

Reference material for the polish chain's final comp/clipper stage
(`POLISH_CHAIN_DESIGN.md`). Extracted 2026-08-25.

T27 reproducibility package: `reference_labs/polish_comp_clip/`. The package is
an isolated internal reference and does not use the original product's identity
as a Cosimo product, surface, or implementation.

T27's live audition surface is the separately named, isolated
`fx/polish_lab/` Cmajor VST3 lab. Its decoded start, additional tuning controls,
and non-reproducible boundaries are documented in `fx/polish_lab/README.md`.

Provenance: Dada Life's Sausage Fattener is closed-source. Polarity (polarity.me)
built a Bitwig recreation he reports nulls against the original at matched settings
(post: polarity.me/posts/polarity-music/2024-08-12-sausage-fattener-in-bitwig/).
The numbers below were decoded directly from his preset binary —
`Bitwig-5.2/Sausage-Fattener.bwpreset` in github.com/polarity/polarity-music-tools —
by parsing the BtWg v3 container (meta + tagged big-endian doubles + zipped sample).
His comment embedded in the preset: *"This replicates the 'Sausage Fattener' by
'Dada Life' as closely as possible. … Sausage Fattener is an EQ with a hard clip,
clipping at 0 dB."*

## Provenance boundary

- **Closed-source original:** not inspected, copied, or rendered by T27.
- **Polarity's recreation:** Polarity reports that it nearly nulls against the
  original at matched settings. T27 preserves that as his report; it does not
  independently repeat the original-versus-preset null.
- **Decoded preset:** stored values and paths below are pinned from preset commit
  `3852ef80ec3f97d93c6a7880c167b64a454ae961`, file SHA-256
  `603fb6d28b1664cf352b5bb7eef288c3093c17a230ac5d63cea70916cfe2749b`.
- **Cosimo inference:** unit conversions, a conventional ratio-from-slope
  conversion, compressor detector/envelope behavior, odd transfer symmetry, and
  interpolation between transfer knots are not source facts. The T27 lab labels
  and tests its own transparent choices without claiming proprietary equivalence.

## Signal chain (as found in the preset)

```
low-cut IR (Convolution, hard-coded ~20–50 Hz)
→ Tool in-gain (stored 0.967718728128794 linear = −0.2850170805322976 dB)
→ Dynamics (the compressor, settings below)
→ EQ-5 "Color" (flat at default; Color macro moves band 2 freq + gain)
→ FX Grid: Transfer waveshaper (the clipper, curve below)
→ Tool out-gain (stored 1.0193734859388728 linear = +0.16666666666666702 dB)
```

## Compressor (Bitwig Dynamics)

| Param | Stored value | Decoded |
|---|---|---|
| Threshold (comp section) | 0.0 | **0.0 dB** — parked at the clip ceiling |
| Knee | 0.0 | hard |
| Ratio | 0.9124000000000048 (slope) | conventional conversion ≈ **11.4155:1** |
| Attack | −3.6879999999999997 (log₁₀ s) | **0.205116 ms**; lookahead behavior is not encoded here |
| Release | −1.5720000000000016 (log₁₀ s) | **26.791683 ms** |
| Makeup | −0.04000000000000409 dB | nominally none |
| Expander section | thr −30 dB, ratio 0 | off |

Note: Polarity's blog/video says "threshold ≈ −0.9 dB"; the shipped preset instead
has threshold 0.0 dB with the −0.29 dB input trim. Same intent (catch peaks just at
the ceiling), slightly different bookkeeping.

## Clipper (Grid Transfer curve)

Normalized transfer breakpoints (input → output, segment tension):

```
(0, 0, t = 0)
→ (0.799438202247191, 0.7176422093981863, t = 0.42000000000000004)
→ (0.9272997032640949, 0.8935926773455377, t = 0)
→ (0.9362017804154302, 1, t = −0.7200000000000001), flat above
```

Linear-ish to ~0.7, one rounded knee, ceiling reached at input 0.94, hard clip past
it. Stored Drive trim: −0.01920000000000002 dB. The preset pins the knots and
tensions, but not a public definition of Bitwig's proprietary interpolation law.

## Fatness macro wiring

One knob targets, simultaneously:

- input amplitude, parameter domain −36…+36 dB, stored map amount
  **+35.971200000000394 dB**;
- Dynamics output gain, parameter domain −36…+36 dB, stored map amount
  **+4.120000000000003 dB**;
- Dynamics high-ratio control, normalized domain −1…+1 with quantum 0.005,
  stored map amount **−0.025200000000000014**.

So "Fatness" is drive into fixed thresholds with linked makeup and ratio control.
The ±36 dB and ±100% figures are target parameter domains, not the actual map
amounts. The proprietary mapping from the normalized ratio amount to an effective
ratio is not recoverable from this preset alone. The T27 audio model follows the
documented direction toward limiting, but preserves that choice as Cosimo inference.

## Takeaways for Cosimo's final comp/clipper

- The architecture is exactly "peak-catching compression parked at the ceiling,
  then a rounded-knee hard clip" — Andrew's "even out, then clip" instinct,
  confirmed at the numbers level.
- Release 26.8 ms sits right above the one-cycle-of-60 Hz floor (16.7 ms) that the
  polish chain adopts as its distortion-free gain-change rule.
- The stored 0.205 ms attack is fast; the preset does not itself establish the
  hidden detector/lookahead law. The polish chain's permitted 4 ms lookahead can
  pursue similar peak timing without copying that unknown implementation.
