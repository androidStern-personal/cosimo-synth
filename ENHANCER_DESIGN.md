# Enhancer Design (Spectre-style, two-band)

Status: **locked design, 2026-08-25** (Andrew + assistant session), companion to
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

Andrew's scope decisions (2026-08-25): **two bands, not five. Tube and Solid curves
only. Per-band mid/side targeting with independent amounts. Lives at the end of the
signal chain.**

---

## 1. Signal flow

```
in (stereo) ──┬────────────────────────────────────────────────┐ (dry, bit-exact)
              │ M/S encode:  M = (L+R)/2,  S = (L−R)/2         │
              │                                                │
              │  band 1:  b = SVF-BP(freq1, Q1)  of M and S    │
              │  band 2:  b = SVF-BP(freq2, Q2)  of M and S    │
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

The bands are **two full parametric bells, Spectre-style** (Andrew, 2026-08-25:
bands, not LP/HP halves): each freely steerable across the audible range with its own
Q. In a parallel EQ, the difference signal of a bell boost *is* bandpass-shaped
content, so extraction is the constant-peak-gain bandpass output of a TPT/Zavalishin
SVF per band, scaled by amount. A wide low-Q bell parked at either extreme
approximates shelf-like reach when wanted. The parallel topology keeps the residue
subtraction phase-clean by construction — the reason Spectre's EQ is boost-only and
parallel rather than serial biquads.

## 2. Parameters (10, static — dialed in, not modulatable, per the polish-chain rule)

| Param | Range | Default | Meaning |
|---|---|---|---|
| `b1FreqHz` | 30..16k | 130 | band 1 bell center |
| `b1Q` | 0.3..8 | 0.71 | band 1 bell width |
| `b1MidAmount` | 0..1 | 0 | band 1 drive into the curve, mid channel |
| `b1SideAmount` | 0..1 | 0 | band 1 drive, side channel |
| `b1Curve` | Tube / Solid | Solid | band 1 curve |
| `b2FreqHz` | 30..16k | 9k | band 2 bell center |
| `b2Q` | 0.3..8 | 0.71 | band 2 bell width |
| `b2MidAmount` | 0..1 | 0 | band 2 drive, mid |
| `b2SideAmount` | 0..1 | 0 | band 2 drive, side |
| `b2Curve` | Tube / Solid | Tube | band 2 curve |

Independent mid and side amounts per band subsume Spectre's per-band channel routing
selector (mid-only = side amount 0, and so on) without an enum, and directly support
the two marquee uses at the default band positions: a low bell driven into the mid
for weight that stays mono-solid, a high bell driven into the side as a natural
widener (Spectre's own manual headlines this use case). Mono input ⇒ S = 0 ⇒ side
amounts do nothing, correctly.

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

- The four shaper paths run in ×4 oversampled cores with the **unity thru-path**
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

- Amount→drive mapping per band, voiced so the audible-harmonics onset is spread
  across the knob (compensating the de-emphasis dead zone at low drive), with the
  residue level roughly loudness-linear in the knob. Starting shape:
  `drive = 24 dB · amount²`, residue post-gain trimmed by ear.
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
allocation. State is four SVFs, four DC blockers, and the OS cores; reset semantics
follow the polish chain's single-instance rules.

## 7. Per-voice variant (feasibility)

The per-voice form is required (Andrew, updated 2026-08-27): one single-band
instance after each voice's filter and before that voice's amplitude envelope and
the final voice sum. Pitch tracking is optional (center = note frequency × harmonic
ratio when enabled).

Routing is permanently **linked Mid/Side**. Encode each voice's stereo signal with
the established Lite matrix, `M = 0.5 × (L + R)` and `S = 0.5 × (L − R)`, run the
same Frequency, Q, and Amount through one fixed shaping curve on both components,
then decode with `L = M + S` and `R = M − S`. There is one Amount control, no routing
switch, no independent Mid and Side amounts, and no sound-character parameter or
hidden mode state. Because the shaper is nonlinear, this is deliberately a different
sound from linked Left/Right processing. Keep first-order ADAA instead of the bus
module's oversampling. The original mono-path cost estimate is superseded by this
fixed two-component design:

- **Filter**: one TPT SVF bandpass for Mid and one for Side in every voice. MIDI tracking
  is control-rate work, not audio-rate: recompute the `tan()` coefficient only on
  note/bend/glide events (or per block) and smooth the *coefficient*, never call
  `tan` per sample. Cheaper filter structures (cascaded one-poles) save almost
  nothing and lose the clean bell — the SVF is already the floor.
- **Shaper**: ADAA the residue function directly on both Mid and Side. `r(x) = f(x) − x` is itself a
  waveshaper with antiderivative `R(x) = F(x) − x²/2`, so ONE guarded-divide ADAA
  evaluation per component yields the aligned residue with no oversampling, no resampler,
  no thru-path — the §4 alignment problem *disappears* instead of being solved.
  Use the single fixed algebraic kernel `x/√(1+x²)`, whose antiderivative is
  `√(1+x²) − x²/2` + const. It is the k = 2 case of the saturator's existing
  knee curve, so the implementation can share that kernel.
- **Post-sum, once, not per voice**: after decoding each processed voice back to
  Left/Right, a single stereo DC blocker on the summed voice residues catches any
  signal-dependent DC from the nonlinear residue. The DC blocker is linear, so it
  commutes with the sum.
- **Budget**: the earlier ≈40–50-flop, four-state estimate covered one mono path and
  is no longer valid. Fixed linked Mid/Side roughly doubles the filter/shaper work
  and state relative to that estimate. It remains a plausible retained-voice cost,
  but representative 16-voice phone and desktop measurements now decide the
  production quality setting; the old paper estimate is not acceptance evidence.
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

**Voice interface (locked, Andrew 2026-08-27).** Expose exactly Frequency/Ratio, Q,
and Amount. Reuse the existing Voice filter footprint as a two-stage `FILTER` →
`ENHANCER` surface selected by explicit taps; do not stack another panel or use a
horizontal swipe. The Enhancer view puts its draggable bell in the existing graph
area and the three values in the existing three-cell row. Horizontal bell drag edits
Frequency/Ratio, vertical drag edits Amount, and Q remains directly editable. A small
Key Track button in a graph corner switches the first value's label and meaning
between Frequency and Ratio. The shared surface controls every per-voice instance;
it does not display one panel per sounding note.

Status: the per-voice form, its post-filter placement, fixed linked Mid/Side routing,
three-value interface, optional Key Track, ratio control, and UI placement are locked.
Only the measured production quality setting remains open.

## 8. Ship criteria

1. All amounts 0 ⇒ output bit-exact dry (ADR-005 proof unchanged).
2. Harmonics-only guarantee: enabling any band at default voicing changes pink-noise
   LUFS by ≤ 0.5 dB while visibly adding harmonic lines on a sine — the de-emphasis
   contract, testable.
3. Mono input with only side amounts raised ⇒ output identical to input.
4. Andrew's ears against Spectre at Subtle/Medium on the same stems.

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
