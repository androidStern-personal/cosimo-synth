# Enhancer Design (Spectre-style, two-band)

Status: **accepted high-quality processor contract, updated 2026-08-27**, companion
to `DISTORTION_QUALITY_DESIGN.md`. Integration is still owned by T28: this module is
a fixed, non-modulatable member of the end-of-chain Polish section — see
`POLISH_CHAIN_DESIGN.md`. The measured implementation and audition plug-in live on
the protected T26 branch. This module is **separate from and orthogonal to** the
saturator redesign — that module makes a sound *driven*; this one adds selected-band
presence, weight, and air at the end of the chain.

Reference product: Wavesfactory Spectre (2018, DSP by Jesús Ginard and Ivan Cohen) —
a five-band parallel EQ where the *difference* between the EQ'd and dry signal is
saturated and mixed back. Architecture verified from the developer's own description
(KVR) and the official v1.5 manual. Lineage: Aphex Aural Exciter (mid-70s) —
high-pass → distort → blend a little back; Spectre generalizes the fixed high-pass to
EQ-shaped regions. Cosimo already ships the core trick: the distortion module's
"harmonics" mode (`dry + residue`) is this architecture with one band.

Andrew's accepted processor (updated 2026-08-27): **two bands, not five. Each band
independently selects Stereo or Mid/Side. Stereo uses one linked Amount; Mid/Side
uses separate Mid and Side amounts. Each band selects Tube or Solid. One shared
Subtle/Medium selector and one continuous de-emphasis value apply to the processor.
It lives in the fixed Polish section at the end of the signal chain.**

## Product family boundary (locked 2026-08-27)

Three related products share the residue idea, but they are not interchangeable:

- **Cosimo Enhancer** is the accepted high-quality two-band processor. Its production
  branch uses the measured 4x FIR wrapper and declares 60 samples of latency. It is
  currently auditionable as its own plug-in and will become the Enhancer stage inside
  the fixed Polish section.
- **Cosimo Enhancer Lite** is the one-band standalone spin-off. It keeps the accepted
  Lite routing, character, intensity, analyzer, and direct-manipulation behavior while
  using a cheaper 4x polyphase-IIR wrapper with 3 samples of declared latency. It is
  the source for the free VST3 and iOS AUv3 product, not a replacement for the Polish
  processor.
- **The per-voice Cosimo Enhancer** is a further lightweight derivative of Lite's
  one-band sound, placed after every synth voice's filter. It does not instantiate
  either the full processor's FIR wrapper or Lite's IIR wrapper per voice. It uses the
  dedicated first-order ADAA implementation below, fixed linked Mid/Side, and one
  fixed Tube-family curve.

A control or DSP decision for one member of this family never silently rewrites the
others. In particular, the per-voice simplifications are not permission to remove
routing, Tube/Solid, Subtle/Medium, de-emphasis, latency, or other approved behavior
from Cosimo Enhancer or Cosimo Enhancer Lite.

---

## 1. Signal flow

```
in (stereo) ── shared JUCE-compatible 4x FIR upsampler ─────────┐
              │                                                 │
              │ each band, in parallel Stereo and M/S domains: │
              │   d = peakingEQ(input) - input at 4x           │
              │   shaped = selected curve(d) at 4x             │
              │   reconstruct shaped and d separately          │
              │   conditioned = 20.016 Hz HP(shaped)           │
              │   c = conditioned - deEmphasis * d             │
              │   decode M/S; crossfade by per-band mode       │
              │                                                 │
              └── reconstruct neutral dry through same FIR ─────┤
                  out = delayed dry + band 1 c + band 2 c
```

De-emphasis is one saved continuous control, from 0 to 1 and defaulting to 1. At 0,
the contribution is the complete shaped bell. At 1, the aligned unprocessed bell is
fully inverted and summed with the shaped bell. Intermediate values scale only that
subtraction. There is no post-shaper trim, gain matcher, or level compensation. The
fixed high-pass is on the reconstructed shaped path only; the unprocessed bell is
not filtered. Preserve this control and signal law during integration. Whether T28
exposes, hides, bakes, or macro-maps the control is a later product decision.

The bands are **two full parametric bells, Spectre-style**: each is freely steerable
from 20 Hz to 20 kHz with its own displayed Q. Direct measurements show that Spectre
first makes a conventional boosted peaking EQ and then takes `EQ - dry`. For
`G = gain(12 dB * Amount)`, that difference is a unity-peak bandpass multiplied by
`G - 1`, with effective pole Q `displayed Q * sqrt(G)`. The accepted implementation
uses that equivalent form in the 4x core. This gain-dependent Q replaces the earlier
fixed-Q approximation.

## 2. Accepted processor settings (14, static and non-modulatable)

| Param | Range | Default | Meaning |
|---|---|---|---|
| `b1FreqHz` | 20..20k | 130 | band 1 bell center |
| `b1Q` | 0.1..10 | 0.71 | band 1 bell width |
| `b1Mode` | Stereo / Mid-Side | Stereo | band 1 processing domain |
| `b1MidAmount` | 0..1 | 0 | band 1 drive into the curve, mid channel |
| `b1SideAmount` | 0..1 | 0 | band 1 drive, side channel |
| `b1Curve` | Tube / Solid | Solid | band 1 curve |
| `b2FreqHz` | 20..20k | 9k | band 2 bell center |
| `b2Q` | 0.1..10 | 0.71 | band 2 bell width |
| `b2Mode` | Stereo / Mid-Side | Stereo | band 2 processing domain |
| `b2MidAmount` | 0..1 | 0 | band 2 drive, mid |
| `b2SideAmount` | 0..1 | 0 | band 2 drive, side |
| `b2Curve` | Tube / Solid | Tube | band 2 curve |
| `saturationMode` | Subtle / Medium | Subtle | shared nonlinear intensity |
| `deEmphasis` | 0..1 | 1 | selected-signal subtraction amount |

The routing choice and separate amounts are both part of the accepted sound and state;
do not infer that one makes the other disposable. They support linked Stereo use as
well as Mid/Side targeting such as a low bell in the mid for mono-solid weight and a
high bell in the side for widening. Mono input ⇒ S = 0 ⇒ side amounts do nothing.

All amounts default to 0, so the nonlinear contribution is exactly zero. The output
then matches the retained JUCE FIR neutral impulse within `1e-7` and the processor
reports exactly 60 samples of host latency. It is intentionally not the same-frame,
bit-exact input; that older requirement was superseded when Andrew approved the
measured high-quality wrapper.

There is no global mix, output trim, or oversampling-quality switch. The four band
amounts own contribution level; rack gain staging owns output trim; the high-quality
4x FIR wrapper is fixed. T28 may expose a smaller final Polish surface, but it must
map or bake these accepted settings deliberately rather than deleting them during
branch integration.

## 3. The two curves

Direct Spectre 1.5.6 measurements supersede the manual's reversed character labels.
The accepted **Subtle** transfer functions are:

- **Solid** — `tanh(3x) / sqrt(2)`: symmetric, predominantly odd harmonics.
- **Tube** — `(tanh(3x + 0.125) - tanh(0.125)) / sqrt(2)`: biased, even and odd
  harmonics. Tube is band 2's default.

The accepted **Medium** transfer functions are:

- **Solid** — `tanh(6x) / 2`.
- **Tube** — `(tanh(6x + 0.3125) - tanh(0.3125)) / 2`.

These are fixed, memoryless laws. There is no envelope-driven bias, normalization
back to unity fundamental gain, RMS follower, correlation follower, or hidden gain
compensation. Tube's signal-dependent DC makes the shaped-path high-pass mandatory.

## 4. Anti-aliasing and alignment

- One shared input stage runs the pinned JUCE 7.0.1 maximum-quality 4x equiripple
  half-band FIR. Every Stereo and M/S bell and shaper runs at 4x. Shaped and
  unprocessed selected-bell paths are reconstructed separately by identical FIR
  stages before subtraction, keeping the contribution aligned.
- The neutral path uses the same up/down FIR. The wrapper has 59.5 samples of
  fractional latency and declares 60 samples to the host. This is the high-quality
  algorithm T28 must integrate; do not replace it with Lite's cheaper IIR wrapper.
- The shaped path then receives the measured 20.016318 Hz second-order Butterworth
  high-pass and fixed `+0.020816 dB` fit before the unfiltered selected bell is
  subtracted. No program-dependent gain process follows.
- A high-parked bell is the honest aliasing risk: harmonics of 8–16 kHz content land near
  or above Nyquist and fold. ×4 oversampling plus gentle curves plus residue levels
  (this is a subtle effect by design) keeps fold-back below audibility; the ADAA
  escape hatch from the saturator doc applies here unchanged if listening says
  otherwise.

## 5. Voicing

- Amount is a conventional 0..+12 dB boost. The selected signal is
  `band(displayed Q * sqrt(gain(12 dB * Amount))) * (gain(12 dB * Amount) - 1)`.
  It is exactly zero at Amount 0 and reaches 2.981x at 100%.
- The contribution is exactly
  `ButterworthHP(shape(selected)) - deEmphasis * selected` after both terms are
  reconstructed from 4x, then added to the FIR-aligned dry. There is no second
  Amount multiply, post-shaper attenuation, unity-fundamental matcher, automatic
  level compensation, or output trim.
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
`poolResetIn` lifecycle, no modulation-table rows, no lane-state schema growth. The
processor declares the accepted FIR wrapper's 60-sample latency and performs no
allocation. Stereo and M/S branches retain independent filter/reconstruction state
so a smoothed mode change crossfades coherent contributions rather than reinterpreting
one channel basis as the other. Reset follows the Polish chain's single-instance
rules.

## 7. Lightweight per-voice derivative

The per-voice form is required (Andrew, updated 2026-08-27): one single-band
instance after each voice's filter and before that voice's amplitude envelope and
the final voice sum. Pitch tracking is optional (center = note frequency × harmonic
ratio when enabled).

This is spun from the Lite one-band sound, not from the processor-heavy two-band
implementation. It reuses Lite's selection/filtering behavior, residue sound, and
Mid/Side convention, but it does not copy Lite's 4x IIR wrapper into every voice.

Routing is permanently **linked Mid/Side**. Encode each voice's stereo signal with
the established Lite matrix, `M = 0.5 × (L + R)` and `S = 0.5 × (L − R)`, run the
same Frequency, Q, and Amount through one fixed Tube-family shaping curve on both components,
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

1. All amounts 0 ⇒ nonlinear contribution exactly zero; output matches the retained
   JUCE FIR neutral impulse within `1e-7`; host latency is exactly 60 samples.
2. De-emphasis follows the accepted continuous shaped-minus-selected law at 0%, 50%,
   and 100%; do not replace it with a generic gain matcher or harmonics-only promise.
3. Mono input with only side amounts raised ⇒ output identical to input.
4. Andrew's ears against Spectre at Subtle/Medium on the same stems.

## 9. Open decisions (defaults apply unless overridden)

1. **Final Polish exposure of de-emphasis.** The accepted processor preserves the
   saved coefficient used during listening. T28 may bake, hide, or macro-map it only
   through an explicit product decision; integration alone must not remove it.
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
