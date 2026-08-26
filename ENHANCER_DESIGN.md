# Enhancer Design (Spectre-style, two-band)

Status: **measurement-corrected locked design, 2026-08-26** (Andrew clarification +
activated Spectre 1.5.6 black-box corpus), companion to
`DISTORTION_QUALITY_DESIGN.md`. Integration resolved same day: this module is a
member of the fixed, non-modulatable end-of-chain polish section — see
`POLISH_CHAIN_DESIGN.md`. Same ground rules: this specifies what to build and
why; implementation is a separate effort. This module is **separate from and
orthogonal to** the saturator redesign — that module makes a sound *driven*; this one
adds frequency-selected presence/weight/air at the end of the chain.

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
              │      c = DCblock(curve(d)                       │
              │                  − deEmphasis·aligned_thru(d))   │
              │                                                  │
              │  decode M/S residue; smooth-crossfade by mode    │
              └── out = dry + band1 residue + band2 residue      │
```

De-emphasis is one global continuous control. At **0%**, no inverse bell is applied:
the contribution is the complete shaped bell. At **100%**, the aligned unprocessed
bell is fully inverted and summed with the shaped bell. Intermediate values scale only
that subtraction. There is no post-shaper trim, gain matcher, or level compensation.
The 100% result contains new harmonics and may also contain saturation-induced change
to the selected band's fundamental; that is the literal shaped-minus-unprocessed
algorithm rather than a promise of mathematically isolated harmonics.

The bands are **two full parametric bells, Spectre-style** (Andrew, 2026-08-25:
bands, not LP/HP halves): each freely steerable across the audible range with its own
Q. In a parallel EQ, the difference signal of a bell boost *is* bandpass-shaped
content, so extraction is the constant-peak-gain bandpass output of a TPT/Zavalishin
SVF per band, scaled by amount. A wide low-Q bell parked at either extreme
approximates shelf-like reach when wanted. The parallel topology keeps the residue
subtraction phase-clean by construction — the reason Spectre's EQ is boost-only and
parallel rather than serial biquads.

## 2. Parameters (10 band settings + 2 routing modes + de-emphasis, all static)

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
| `deEmphasis` | 0..1 | 1 | 0 = shaped bell; 1 = shaped bell minus aligned unprocessed bell |

The primary amount has one stable stored identity: it is labelled Amount and drives
both L/R channels in Stereo mode, then is relabelled Mid in M/S mode. Side remains
stored while Stereo is selected but is inactive. This preserves the original ten
band settings and adds only the two saved routing modes plus the requested global
de-emphasis value; switching mode does not silently overwrite either M/S amount. The
two modes default to Stereo and de-emphasis defaults to 100%. The unpublished
always-M/S v1 state migrates both modes to Mid/Side, while both v1 and v2 states migrate
to 100% de-emphasis so their previous signal law is preserved.

All thirteen values are smoothed, preset/host-state persisted, non-automatable, absent
from modulation catalogs, and unavailable as an Effects Lane device. The isolated
audition VST exposes them only through its own GUI; T28 owns the final Polish UI.

All amounts default 0 ⇒ the module is born silent-by-contribution: `curve(0) = 0`,
residue = 0, `out = dry` **bit-exact**. The rack's hard-bypass invariant (ADR-005)
holds with no special casing.

No global mix (the four amounts are the mix), no output trim or hidden residue trim
(rack gain staging owns that), no oversampling quality switch (fixed ×4 — one less way to sound bad; Spectre's
16x tier is a CPU luxury this design doesn't need at two gentle bands).

## 3. The two curves

Direct Spectre 1.5.6 renders supersede the manual's reversed character descriptions.
For the fixed **Subtle** target, the measured transfer functions are:

- **Solid** — `tanh(3x) / sqrt(2)`: symmetric, predominantly odd harmonics.
- **Tube** — `(tanh(3x + 0.125) - tanh(0.125)) / sqrt(2)`: biased, even + odd
  harmonics. Default for band 2. Its signal-dependent DC makes the per-path,
  sample-rate-aware residue blocker mandatory.

These fits reproduce the measured harmonics across the retained level/Amount sweep;
the small-signal gains are approximately +6.53 dB (Solid) and +6.40 dB (Tube).
Spectre does **not** normalize either curve back to unity fundamental gain and does
not run an RMS/correlation follower. That retained positive fundamental contribution
is part of its sound. Both curves are fixed, memoryless, and stateless; there is no
envelope-driven bias or hidden gain compensation.

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

- Spectre's Amount is an ordinary 0..+12 dB boost. The signal extracted from its
  parallel bell is therefore:
  `driven = band · (gain(12 dB · amount) − 1)`.
  Twenty-five measured gain/input pairs fit this law with 0.0000063 dB RMS error
  (0.000018 dB maximum). It is exactly zero at Amount 0 and reaches 2.981x at 100%.
- The contribution is exactly
  `DCblock(shape(driven) − deEmphasis · driven)` and is added to dry. There is no
  second Amount multiply, post-shaper attenuation, static unity-fundamental matcher,
  RMS follower, correlation matcher, or output trim. The rejected `0.035`
  (approximately −29.1 dB), `0.08`, and `0.094` multipliers buried the effect and are
  not part of the design.
- Low-position voicing target: kick/bass weight on small speakers (2nd/3rd harmonic
  of 40–130 Hz content landing 80–400 Hz). High-position: acoustic guitar / vocal
  sheen and the side-widener use.
- Voicing target is Spectre **Subtle** on matching material. The bus has no Mode
  control, so Medium/Aggressive are not silently folded into the Amount law.
  `scripts/measure_spectre_reference.py` regenerates the reference corpus and exact
  inferred-model validation; retained raw and level-matched audition files live under
  ignored `build/t26-spectre-reference/`.

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

## 7. Per-voice variant (separate product decision)

Question on the table (Andrew, 2026-08-25): a single-band instance per synth voice,
with center frequency tracking MIDI pitch. **Recommendation: DEFER.** T26 explicitly
does not implement it, and the previous 30–40 MFLOP/s estimate assumed inexpensive
algebraic substitute curves that the Spectre measurements have now invalidated.
Spectre consistency would require the measured tanh transfers above; first-order ADAA
for tanh uses a log-cosh antiderivative and needs a real prototype before its native
and mobile cost or audible equivalence can be claimed.

If Andrew later approves a prototype, retain one TPT bell per voice, control-rate
coefficient updates, no M/S controls, the documented continuous ratio, and one
post-sum DC blocker. Compare exact 4x oversampling against a measured ADAA or
approximation before choosing the production anti-aliasing path. Do not silently
substitute a cheaper curve and call it the same Enhancer.

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

Status: ratio concept retained; build/defer/reject remains Andrew's decision.

## 8. Ship criteria

1. All Mid/Amount and Side amounts 0 ⇒ output bit-exact dry in either mode (ADR-005 proof unchanged).
2. De-emphasis is exact and affine: 0% adds the shaped bell, 100% subtracts the full
   aligned unprocessed bell, and 50% is the sample-accurate midpoint after smoothing.
   No scalar, output matcher, or loudness-equivalence gate follows that operation.
3. With −18 dBFS pink input and 100% de-emphasis, either band at full Stereo Amount
   contributes no less than −6 dB relative to dry. This is a burial-prevention gate,
   not an output-equivalence target. No dynamic level follower is permitted.
4. Mono input remains mono in Stereo and M/S. In M/S, mono with only Side raised is
   exact dry, and a pure-side signal with only Side raised remains pure side.
5. Each band can select Stereo or M/S without changing the other band's routing.
6. Andrew's ears on the installed VST remain the final sound gate.

## 9. Open decisions (defaults apply unless overridden)

1. **De-emphasis amount.** ~~Always-on~~ **Resolved 2026-08-26 by Andrew**: one global
   continuous 0..100% control, default 100%, with the exact law in §1.
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

Algorithm constants and label behavior come from 742 deterministic black-box cases
captured from the locally activated Spectre 1.5.6 AU/VST3. The corpus covers Amount,
input level, character, de-emphasis, routing, Q/frequency, quality, parallel
additivity, sample rates, and musical fixtures. AU and VST3 renders were bit-identical;
fresh-instance determinism was exact. See `scripts/measure_spectre_reference.py` and
ignored `build/t26-spectre-reference/report.json`. The manual's Tube/Solid prose is
retained only as provenance because the measured plugin labels are reversed.
