# Sausage Fattener — Extracted Reference Settings

Reference material for the polish chain's final comp/clipper stage
(`POLISH_CHAIN_DESIGN.md`). Extracted 2026-08-25.

Provenance: Dada Life's Sausage Fattener is closed-source. Polarity (polarity.me)
built a Bitwig recreation he reports nulls against the original at matched settings
(post: polarity.me/posts/polarity-music/2024-08-12-sausage-fattener-in-bitwig/).
The numbers below were decoded directly from his preset binary —
`Bitwig-5.2/Sausage-Fattener.bwpreset` in github.com/polarity/polarity-music-tools —
by parsing the BtWg v3 container (meta + tagged big-endian doubles + zipped sample).
His comment embedded in the preset: *"This replicates the 'Sausage Fattener' by
'Dada Life' as closely as possible. … Sausage Fattener is an EQ with a hard clip,
clipping at 0 dB."*

## Signal chain (as found in the preset)

```
low-cut IR (Convolution, hard-coded ~20–50 Hz)
→ Tool in-gain (−0.29 dB)
→ Dynamics (the compressor, settings below)
→ EQ-5 "Color" (flat at default; Color macro moves band 2 freq + gain)
→ FX Grid: Transfer waveshaper (the clipper, curve below)
→ Tool out-gain (+0.17 dB)
```

## Compressor (Bitwig Dynamics)

| Param | Stored value | Decoded |
|---|---|---|
| Threshold (comp section) | 0.0 | **0.0 dB** — parked at the clip ceiling |
| Knee | 0.0 | hard |
| Ratio | 0.9124 (slope) | ≈ **11:1** |
| Attack | −3.688 (log₁₀ s) | **0.21 ms** — effectively instant, no lookahead |
| Release | −1.572 (log₁₀ s) | **26.8 ms** |
| Makeup | −0.04 dB | none |
| Expander section | thr −30 dB, ratio 0 | off |

Note: Polarity's blog/video says "threshold ≈ −0.9 dB"; the shipped preset instead
has threshold 0.0 dB with the −0.29 dB input trim. Same intent (catch peaks just at
the ceiling), slightly different bookkeeping.

## Clipper (Grid Transfer curve)

Normalized transfer breakpoints (input → output, segment tension):

```
(0.00, 0.00) → (0.80, 0.72, t = 0.42) → (0.93, 0.89, t = 0) → (0.94, 1.00, t = −0.72), flat above
```

Linear-ish to ~0.7, one rounded knee, ceiling reached at input 0.94, hard clip past
it. Drive trim −0.02 dB.

## Fatness macro wiring

One knob drives, simultaneously: input amplitude over a **36 dB range**, Dynamics
makeup over ±36 dB, and ratio over ±100% (toward ∞:1 / limiting when cranked). So
"Fatness" = drive into fixed thresholds — the one-knob recipe: nothing inside moves
except by the macro.

## Takeaways for Cosimo's final comp/clipper

- The architecture is exactly "peak-catching compression parked at the ceiling,
  then a rounded-knee hard clip" — Andrew's "even out, then clip" instinct,
  confirmed at the numbers level.
- Release 26.8 ms sits right above the one-cycle-of-60 Hz floor (16.7 ms) that the
  polish chain adopts as its distortion-free gain-change rule.
- Attack 0.21 ms with **no lookahead** is the weak point of the original recipe
  (overshoot-or-distort tradeoff); the polish chain's permitted 4 ms lookahead
  buys the same speed without it.
