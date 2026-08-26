# Enhancer Design (Spectre-style, two-band)

Status: **corrected locked design, 2026-08-26** (Andrew clarification), companion to
`DISTORTION_QUALITY_DESIGN.md`. Integration resolved same day: this module is a
member of the fixed, non-modulatable end-of-chain polish section — see
`POLISH_CHAIN_DESIGN.md`. Same ground rules: this specifies what to build and
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

Andrew's scope decisions: **two bands, not five. Tube and Solid curves only. Each
band independently switches between regular Stereo and Mid/Side. Stereo uses one
linked Amount for L/R; Mid/Side exposes independent Mid and Side amounts. Lives at
the end of the signal chain.** The earlier claim that independent M/S amounts
eliminated the routing selector was wrong and is superseded by this correction.

---

## 1. Signal flow

```
in (stereo) ──┬──────────────────────────────────────────────────┐ (dry, bit-exact)
              │ per band:                                       │
              │                                                  │
              │  Stereo branch: SVF-BP on L/R                    │
              │    shared Amount drives both channels            │
              │                                                  │
              │  M/S branch: encode M=(L+R)/2, S=(L−R)/2         │
              │    SVF-BP on M/S; Mid and Side drive separately  │
              │                                                  │
              │  each nonlinear path:                            │
              │    [ ×4 oversampled core ]                       │
              │      r = DCblock(curve(d) − aligned_thru(d))     │
              │                                                  │
              │  decode M/S residue; smooth-crossfade by mode    │
              └── out = dry + band1 residue + band2 residue      │
```

De-emphasis is **always on** (the `− thru` subtraction): it removes the linear bell
contribution and adds only the shaper's nonlinear difference. That difference contains
new harmonics and may also contain the saturation-induced change to the selected
band's fundamental; the loudness ceiling in §8 prevents that component from becoming
an unintended EQ cut. There is no non-de-emphasized mode — that would be a parallel EQ
with distortion, which the rack's existing EQ/filter modules already cover.

The bands are **two full parametric bells, Spectre-style** (Andrew, 2026-08-25:
bands, not LP/HP halves): each freely steerable across the audible range with its own
Q. In a parallel EQ, the difference signal of a bell boost *is* bandpass-shaped
content, so extraction is the constant-peak-gain bandpass output of a TPT/Zavalishin
SVF per band, scaled by amount. A wide low-Q bell parked at either extreme
approximates shelf-like reach when wanted. The parallel topology keeps the residue
subtraction phase-clean by construction — the reason Spectre's EQ is boost-only and
parallel rather than serial biquads.

## 2. Parameters (10 sound settings + 2 routing modes, all static)

| Param | Range | Default | Meaning |
|---|---|---|---|
| `b1FreqHz` | 30..16k | 130 | band 1 bell center |
| `b1Q` | 0.3..8 | 0.71 | band 1 bell width |
| `b1Mode` | Stereo / Mid-Side | Stereo | band 1 routing domain |
| `b1MidAmount` | 0..1 | 0 | Stereo Amount, relabelled Mid in M/S mode |
| `b1SideAmount` | 0..1 | 0 | band 1 Side drive, active only in M/S mode |
| `b1Curve` | Tube / Solid | Solid | band 1 curve |
| `b2FreqHz` | 30..16k | 9k | band 2 bell center |
| `b2Q` | 0.3..8 | 0.71 | band 2 bell width |
| `b2Mode` | Stereo / Mid-Side | Stereo | band 2 routing domain |
| `b2MidAmount` | 0..1 | 0 | Stereo Amount, relabelled Mid in M/S mode |
| `b2SideAmount` | 0..1 | 0 | band 2 Side drive, active only in M/S mode |
| `b2Curve` | Tube / Solid | Tube | band 2 curve |

The primary amount has one stable stored identity: it is labelled Amount and drives
both L/R channels in Stereo mode, then is relabelled Mid in M/S mode. Side remains
stored while Stereo is selected but is inactive. This preserves the original ten
sound settings and adds only the two saved routing modes; switching mode does not
silently overwrite either M/S amount. The two modes default to Stereo. The unpublished
always-M/S v1 state migrates both modes to Mid/Side so its sound is preserved.

All twelve values are smoothed, preset/host-state persisted, non-automatable, absent
from modulation catalogs, and unavailable as an Effects Lane device. The isolated
audition VST exposes them only through its own GUI; T28 owns the final Polish UI.

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
  band 2 (the 9 kHz default position).
- **Solid** — *asymmetric* soft clip (bias-offset tanh variant): even + odd
  harmonics, "thickness." Default for band 1. Asymmetry ⇒ DC in the residue ⇒ the
  per-path DC blocker in §1 is mandatory, reusing the existing
  `std::filters::dcblocker` idiom.

Both memoryless. No envelope-driven bias here — this module is a subtle finisher, and
the "alive" machinery belongs to the saturator module. If the two ever share a curve
library, these are the same kernels.

## 4. Anti-aliasing and alignment

Identical stance to `DISTORTION_QUALITY_DESIGN.md` §3.4–3.5, same idiom, same
requirements:

- Every Stereo and M/S shaper branch runs in a ×4 oversampled core with the **unity thru-path**
  trick, so `s − thru` compares two signals that took the same round trip — the
  residue is aligned by construction, zero measurement needed. This matters *more*
  here than in the saturator: the module's entire output contribution is a residue.
- Same resampler requirement: no declared latency, ≤ ~1 sample smear (ADR-008), same
  verification note about Cmajor node-oversampling interpolation, same fallback
  (in-processor polynomial up + cascaded IIR halfband down).
- A high-parked bell is the honest aliasing risk: harmonics of 8–16 kHz content land near
  or above Nyquist and fold. ×4 oversampling plus gentle curves plus residue levels
  (this is a subtle effect by design) keeps fold-back below audibility; the ADAA
  escape hatch from the saturator doc applies here unchanged if listening says
  otherwise.

## 5. Voicing

- Amount→drive mapping per band brings the nonlinear onset forward from the rejected
  squared curve while retaining zero contribution at zero Amount:
  `driven = band · amount · gain(24 dB · amount · (0.5 + 0.5 · amount))`.
  The low/high residue gains are `0.08`/`0.094`; separate calibration accounts for
  the much greater program energy under the low default bell. The rejected build used
  one `0.035` gain, which buried full-Amount residue below the audible acceptance floor.
- Low-position voicing target: kick/bass weight on small speakers (2nd/3rd harmonic
  of 40–130 Hz content landing 80–400 Hz). High-position: acoustic guitar / vocal
  sheen and the side-widener use.
- Voicing target is Spectre itself at Subtle/Medium on matching material (same
  render-and-compare method as the saturator doc §5; the harmonic-profile scripts in
  `scripts/drum_buss_*` extend directly).

## 6. Placement and rack integration

Position: **inside the fixed polish chain** (`POLISH_CHAIN_DESIGN.md`) — after all
rack modules and the global filter, between the SAFE BASS stage and the final
comp/clipper. A single always-resident instance: no pool membership, no
`poolResetIn` lifecycle, no modulation-table rows, no lane-state schema growth. Zero
declared latency (SVFs + memoryless curves + the §4 oversampling stance), no
allocation. Stereo and M/S branches keep independent filter, DC-blocker, and
oversampling history so a smoothed mode change crossfades coherent decoded residues
instead of briefly reinterpreting one channel basis as the other. Reset semantics
follow the polish chain's single-instance rules.

## 7. Per-voice variant (feasibility)

Question on the table (Andrew, 2026-08-25): a single-band instance per synth voice,
band frequency tracking MIDI pitch (center = note frequency × harmonic ratio). How
cheap can it get? **Verdict: cheap enough to run on every voice** — but only by
changing two implementation choices relative to the bus module: drop mid/side (a
voice is one signal), and replace oversampling with first-order ADAA. Costed:

- **Filter**: one TPT SVF bandpass per voice ≈ a dozen flops/sample. MIDI tracking
  is control-rate work, not audio-rate: recompute the `tan()` coefficient only on
  note/bend/glide events (or per block) and smooth the *coefficient*, never call
  `tan` per sample. Cheaper filter structures (cascaded one-poles) save almost
  nothing and lose the clean bell — the SVF is already the floor.
- **Shaper**: ADAA the residue function directly. `r(x) = f(x) − x` is itself a
  waveshaper with antiderivative `R(x) = F(x) − x²/2`, so ONE guarded-divide ADAA
  evaluation of `r` yields the aligned residue with no oversampling, no resampler,
  no thru-path — the §4 alignment problem *disappears* instead of being solved.
  Choose algebraic kernels so antiderivatives are closed-form and sqrt-cheap:
  tube = `x/√(1+x²)` (R = `√(1+x²) − x²/2` + const), solid = the same curve
  bias-shifted, with its static DC removed exactly by subtracting the constant
  `r(0)` instead of running a per-voice DC blocker. (`x/√(1+x²)` is the k = 2 case
  of the saturator's existing knee curve — shared kernel.)
- **Post-sum, once, not per voice**: a single DC blocker on the summed voice
  residues (the DC blocker is linear, so it commutes with the sum) catches the
  signal-dependent DC of the solid curve.
- **Budget**: ≈ 40–50 flops and 4 state floats per voice per sample. Sixteen voices
  at 48 kHz ≈ 30–40 MFLOP/s — well under a percent of one mobile core, on the order
  of one extra filter per voice, far less than an extra oscillator. The bus module's
  four ×4-oversampled paths cost roughly as much as ten of these voices.
- **SIMD**: two levels. Inside Cmajor: keep the kernel branch-free (the ADAA
  ill-conditioning guard as a select, not a branch) and let the JIT vectorize. On
  the native renderer path: batch voices across SIMD lanes exactly as the surveyed
  code does — sst-waveshapers' `Quad*` functions process four voices per 128-bit
  register with ADAA state in per-lane registers (that is what "Quad" means), and
  Vital packs voices into `poly_float`. The xsimd dependency already vendored under
  `native/three_oscillator_renderer/` is the right tool; lane-batching cuts the
  effective per-voice cost to roughly a quarter.
- **Aliasing**: the tracked narrow band makes this *safer* than the bus case — the
  shaper sees a near-sinusoid at a known f₀, harmonics land at exact multiples with
  fast soft-curve rolloff, and first-order ADAA mops up the fold-back. Voicing can
  taper drive above ~2 kHz fundamentals rather than paying for more anti-aliasing.
- Precedent that per-voice tracked-filter-into-shaper is a shipped pattern, not an
  experiment: Vital routes a keytrackable filter around its per-voice distortion.

**Harmonic ratio control (locked, Andrew 2026-08-25): continuous, no detents, wide.**
Pinned as: ratio 0.5× to 32× the note frequency — i.e. a continuous tracking offset
of −12 to +60 semitones, default 0 (ratio 1, bell on the fundamental) — stored and
modulated in the rack's existing octave/semitone space (`rackOctaveScale`
convention). The bell center is clamped to 0.45 × sample rate; beyond the clamp the
residue shrinks naturally as the bell runs out of content, so the top of the range
is safe on high notes while a 30 Hz sub note keeps the full 32× ≈ 960 Hz reach.
Consequences embraced: with a continuous ratio and a narrow bell, sweeping the knob
rides across the note's harmonic grid — strong on harmonics, dipping between them —
which at high Q is a partial-picking, almost additive sound and at the default
Q ≈ 0.7 smooths into a continuous tilt of where the energy lands. Voicing keeps the
default Q on the low side for smooth sweeps; high Q remains available for the
surgical sound.

Status: feasibility locked; ratio control locked as above. Whether to build the
per-voice variant at all remains a product decision for later.

## 8. Ship criteria

1. All Mid/Amount and Side amounts 0 ⇒ output bit-exact dry in either mode (ADR-005 proof unchanged).
2. De-emphasized-residue guarantee: enabling any band changes pink-noise LUFS and RMS
   by ≤ 0.5 dB while visibly adding harmonic lines on a sine. With a −18 dBFS pink
   input, each band at full Stereo Amount produces at least −35 dBFS residue, so the
   level budget cannot be passed merely by burying the effect.
3. Mono input remains mono in Stereo and M/S. In M/S, mono with only Side raised is
   exact dry, and a pure-side signal with only Side raised remains pure side.
4. Each band can select Stereo or M/S without changing the other band's routing.
5. Andrew's ears against Spectre at Subtle/Medium on the same stems.

## 9. Open decisions (defaults apply unless overridden)

1. **De-emphasis always-on, no toggle.** Default: yes (rationale in §1). Overriding
   means adding a "boost mode" that duplicates parallel EQ — argue for it before
   spending a param on it.
2. **Rack integration form.** ~~Open~~ **Resolved 2026-08-25**: a fixed member of
   the static polish chain (`POLISH_CHAIN_DESIGN.md`) — not a pool module, not
   modulatable.
3. **Module name.** Working name "Enhancer" (`wt::EnhancerBus`).

## 10. Source notes

Architecture facts from: Wavesfactory Spectre product page and v1.5.6 user manual
(signal chain §"How does it work", saturation algorithm list, de-emphasis description,
oversampling rationale, credits: DSP by Jesús Ginard and Ivan Cohen; changelog dating
de-emphasis and per-band saturation to v1.5, June 2019); the developer's KVR posts
(signal-flow description; pre-1.5 confirmation that without de-emphasis "you'll get
the actual volume increase"); Sound On Sound / MusicRadar / Computer Music reviews.
Manual PDF: https://www.wavesfactory.com/audio-plugins/manuals/Spectre-User-Manual.pdf
