# Enhancer Design (Spectre-style, two-band)

Status: **locked design, 2026-08-25** (Andrew + assistant session), companion to
`DISTORTION_QUALITY_DESIGN.md`. Same ground rules: this specifies what to build and
why; implementation is a separate effort. This module is **separate from and
orthogonal to** the saturator redesign — that module makes a sound *driven*; this one
adds presence/weight/air at constant level, at the end of the chain.

Reference product: Wavesfactory Spectre (2018, DSP by Jesús Ginard and Ivan Cohen) —
a five-band parallel EQ where the *difference* between the EQ'd and dry signal is
saturated and mixed back. Architecture verified from the developer's own description
(KVR) and the official v1.5 manual. Lineage: Aphex Aural Exciter (mid-70s) —
high-pass → distort → blend a little back; Spectre generalizes the fixed high-pass to
EQ-shaped regions. Cosimo already ships the core trick: the distortion module's
"harmonics" mode (`dry + residue`) is this architecture with one band.

Andrew's scope decisions (2026-08-25): **two bands, not five. Tube and Solid curves
only. Per-band mid/side targeting with independent amounts. Lives at the end of the
signal chain.**

---

## 1. Signal flow

```
in (stereo) ──┬────────────────────────────────────────────────┐ (dry, bit-exact)
              │ M/S encode:  M = (L+R)/2,  S = (L−R)/2         │
              │                                                │
              │  band LOW:  b = SVF-LP(freqLow)  of M and S    │
              │  band AIR:  b = SVF-HP(freqAir)  of M and S    │
              │                                                │
              │  per band, per channel (M, S):                 │
              │     d   = amount(band, channel) · b            │
              │     [ ×4 oversampled core ]                    │
              │        s    = curve(band)(d)     Tube | Solid  │
              │        thru = d (same round trip)              │
              │     r   = DCblock(s − thru)      residue only  │
              │                                                │
              │  M/S decode residues → stereo residue          │
              └── out = dry + residue                          │
```

De-emphasis is **always on** (the `− thru` subtraction): only newly generated
harmonics are ever added; the band's own level never changes. There is no
non-de-emphasized mode — that would be a parallel EQ with distortion, which the rack's
existing EQ/filter modules already cover. Consequence: each amount knob is pure
*drive*, and the knob-to-drive mapping is voiced so the onset of audible harmonics is
progressive (see §5).

This is the two-band reduction of Spectre's parallel shelving EQ: a low-shelf boost's
difference signal is LP-filtered content scaled by gain; a high-shelf's is HP-filtered
content. Extracting LP/HP directly (TPT/Zavalishin SVF outputs, Q = 0.71,
12 dB/oct) is the same thing with fewer moving parts, and the parallel topology makes
the residue subtraction phase-clean by construction — the reason Spectre's EQ is
boost-only and parallel rather than serial biquads.

## 2. Parameters (8, all modulation-targetable)

| Param | Range | Default | Meaning |
|---|---|---|---|
| `lowFreqHz` | 40..400 | 130 | LOW band extraction cutoff (LP) |
| `lowMidAmount` | 0..1 | 0 | LOW band drive into the curve, mid channel |
| `lowSideAmount` | 0..1 | 0 | LOW band drive, side channel |
| `lowCurve` | Tube / Solid | Solid | LOW band curve |
| `airFreqHz` | 2k..16k | 9k | AIR band extraction cutoff (HP) |
| `airMidAmount` | 0..1 | 0 | AIR band drive, mid |
| `airSideAmount` | 0..1 | 0 | AIR band drive, side |
| `airCurve` | Tube / Solid | Tube | AIR band curve |

Independent mid and side amounts per band subsume Spectre's per-band channel routing
selector (mid-only = side amount 0, and so on) without an enum, and directly support
the two marquee uses: low band driven into the mid for weight that stays mono-solid,
air band driven into the side as a natural widener (Spectre's own manual headlines
this use case). Mono input ⇒ S = 0 ⇒ side amounts do nothing, correctly.

All amounts default 0 ⇒ the module is born silent-by-contribution: `curve(0) = 0`,
residue = 0, `out = dry` **bit-exact**. The rack's hard-bypass invariant (ADR-005)
holds with no special casing.

No global mix (the four amounts are the mix), no output trim (rack gain staging owns
that), no oversampling quality switch (fixed ×4 — one less way to sound bad; Spectre's
16x tier is a CPU luxury this design doesn't need at two gentle bands).

## 3. The two curves

Per the Spectre manual's own characterizations, mapped to our vocabulary:

- **Tube** — symmetric soft clip (the clipped rational tanh approximation already
  cited in `DISTORTION_QUALITY_DESIGN.md` §9): odd harmonics, "presence." Default for
  AIR.
- **Solid** — *asymmetric* soft clip (bias-offset tanh variant): even + odd
  harmonics, "thickness." Default for LOW. Asymmetry ⇒ DC in the residue ⇒ the
  per-path DC blocker in §1 is mandatory, reusing the existing
  `std::filters::dcblocker` idiom.

Both memoryless. No envelope-driven bias here — this module is a subtle finisher, and
the "alive" machinery belongs to the saturator module. If the two ever share a curve
library, these are the same kernels.

## 4. Anti-aliasing and alignment

Identical stance to `DISTORTION_QUALITY_DESIGN.md` §3.4–3.5, same idiom, same
requirements:

- The four shaper paths run in ×4 oversampled cores with the **unity thru-path**
  trick, so `s − thru` compares two signals that took the same round trip — the
  residue is aligned by construction, zero measurement needed. This matters *more*
  here than in the saturator: the module's entire output contribution is a residue.
- Same resampler requirement: no declared latency, ≤ ~1 sample smear (ADR-008), same
  verification note about Cmajor node-oversampling interpolation, same fallback
  (in-processor polynomial up + cascaded IIR halfband down).
- The AIR band is the honest aliasing risk: harmonics of 8–16 kHz content land near
  or above Nyquist and fold. ×4 oversampling plus gentle curves plus residue levels
  (this is a subtle effect by design) keeps fold-back below audibility; the ADAA
  escape hatch from the saturator doc applies here unchanged if listening says
  otherwise.

## 5. Voicing

- Amount→drive mapping per band, voiced so the audible-harmonics onset is spread
  across the knob (compensating the de-emphasis dead zone at low drive), with the
  residue level roughly loudness-linear in the knob. Starting shape:
  `drive = 24 dB · amount²`, residue post-gain trimmed by ear.
- LOW voiced against: kick/bass weight on small speakers (2nd/3rd harmonic of
  40–130 Hz content landing 80–400 Hz). AIR voiced against: acoustic guitar / vocal
  sheen and the side-widener use.
- Voicing target is Spectre itself at Subtle/Medium on matching material (same
  render-and-compare method as the saturator doc §5; the harmonic-profile scripts in
  `scripts/drum_buss_*` extend directly).

## 6. Placement and rack integration

Position: **last in the chain** — after all other rack modules, before the
`RackOutputStage` safety stage. Zero declared latency (SVFs + memoryless curves +
the §4 oversampling stance), no allocation, pool-resettable: the module's only state
is four SVFs, four DC blockers, and the OS cores — all covered by the existing
`poolResetIn` pattern (coefficients preserved, state cleared).

## 7. Ship criteria

1. All amounts 0 ⇒ output bit-exact dry (ADR-005 proof unchanged).
2. Harmonics-only guarantee: enabling any band at default voicing changes pink-noise
   LUFS by ≤ 0.5 dB while visibly adding harmonic lines on a sine — the de-emphasis
   contract, testable.
3. Mono input with only side amounts raised ⇒ output identical to input.
4. Andrew's ears against Spectre at Subtle/Medium on the same stems.

## 8. Open decisions (defaults apply unless overridden)

1. **De-emphasis always-on, no toggle.** Default: yes (rationale in §1). Overriding
   means adding a "boost mode" that duplicates parallel EQ — argue for it before
   spending a param on it.
2. **Rack integration form.** Default: a regular pool module type that the chain
   places last by default (keeps lane/pool machinery uniform). Alternative: a fixed
   pre-output stage baked next to `RackOutputStage` (cheaper wiring, but a second
   integration pattern to maintain).
3. **Module name.** Working name "Enhancer" (`wt::EnhancerBus`).

## 9. Source notes

Architecture facts from: Wavesfactory Spectre product page and v1.5.6 user manual
(signal chain §"How does it work", saturation algorithm list, de-emphasis description,
oversampling rationale, credits: DSP by Jesús Ginard and Ivan Cohen; changelog dating
de-emphasis and per-band saturation to v1.5, June 2019); the developer's KVR posts
(signal-flow description; pre-1.5 confirmation that without de-emphasis "you'll get
the actual volume increase"); Sound On Sound / MusicRadar / Computer Music reviews.
Manual PDF: https://www.wavesfactory.com/audio-plugins/manuals/Spectre-User-Manual.pdf
