# Enhancer Design (Spectre-style, two-band)

Status: **measurement-locked production-isolated implementation, 2026-08-26**
(Andrew clarification + activated Spectre 1.5.6 black-box corpus), companion to
`DISTORTION_QUALITY_DESIGN.md`. Integration resolved same day: this module is a
member of the fixed, non-modulatable end-of-chain polish section — see
`POLISH_CHAIN_DESIGN.md`. T26 owns the isolated DSP, state, reference evidence,
audition VST, and GUI; T28 still owns final chain composition. The measured JUCE
FIR wrapper and shaped-path conditioning are now in the production module; final
T26 closure still waits for Andrew's installed-VST audition and separate per-voice
decision. This module is **separate from and orthogonal to** the saturator redesign —
that module makes a sound *driven*; this one adds frequency-selected
presence/weight/air at the end of the chain.

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
the end of the signal chain. One global selector chooses the measured Subtle or
Medium saturation law for both bands.** The earlier claim that independent M/S
amounts eliminated the routing selector was wrong and is superseded by this correction.

---

## 1. Signal flow

```
in (stereo) ── shared JUCE-compatible ×4 FIR upsampler ───────────────┐
              │                                                       │
              │ per band, in parallel Stereo and M/S domains:        │
              │   d = peakingEQ(input) − input at 4×                  │
              │   shaped = selectedMode(curve, d) at 4×               │
              │   reconstruct shaped and d separately to host rate    │
              │   conditioned = 20.016 Hz ButterworthHP(shaped)       │
              │   c = conditioned − deEmphasis·d                      │
              │   decode M/S; smooth-crossfade by per-band mode       │
              │                                                       │
              └── reconstruct neutral dry through the same FIR ───────┤
                  out = delayedDry + band1 contribution + band2 contribution
```

De-emphasis is one global continuous control. At **0%**, no inverse bell is applied:
the contribution is the complete shaped bell. At **100%**, the aligned unprocessed
bell is fully inverted and summed with the shaped bell. Intermediate values scale only
that subtraction. There is no post-shaper trim, gain matcher, or level compensation.
The fixed high-pass is on the reconstructed shaped path only; the reconstructed
unprocessed bell remains unfiltered, matching the measured `off − on` endpoint.
The 100% result contains new harmonics and may also contain saturation-induced change
to the selected band's fundamental; that is the literal shaped-minus-unprocessed
algorithm rather than a promise of mathematically isolated harmonics.

The bands are **two full parametric bells, Spectre-style** (Andrew, 2026-08-25:
bands, not LP/HP halves): each freely steerable across the audible range with its own
displayed Q. Direct impulse measurements show that Spectre first makes a conventional
boosted peaking EQ and then takes `EQ − dry`. For `G = gain(12 dB · Amount)`, that
difference is exactly a unity-peak bandpass multiplied by `G − 1`, with effective
pole Q `Qdisplay · sqrt(G)`. The implementation uses that equivalent form inside the
4× core. This gain-dependent Q is important: a +12 dB bell is about twice as narrow
as the old fixed-Q approximation. The parallel topology keeps the subtraction
phase-clean by construction.

## 2. Parameters (10 band settings + 2 routing modes + 2 globals, all static)

| Param | Range | Default | Meaning |
|---|---|---|---|
| `b1FreqHz` | 20..20k | 130 | band 1 bell center |
| `b1Q` | 0.1..10 | 0.71 | band 1 displayed Q |
| `b1Mode` | Stereo / Mid-Side | Stereo | band 1 routing domain |
| `b1MidAmount` | 0..1 | 0 | Stereo Amount, relabelled Mid in M/S mode |
| `b1SideAmount` | 0..1 | 0 | band 1 Side drive, active only in M/S mode |
| `b1Curve` | Tube / Solid | Solid | band 1 curve |
| `b2FreqHz` | 20..20k | 9k | band 2 bell center |
| `b2Q` | 0.1..10 | 0.71 | band 2 displayed Q |
| `b2Mode` | Stereo / Mid-Side | Stereo | band 2 routing domain |
| `b2MidAmount` | 0..1 | 0 | Stereo Amount, relabelled Mid in M/S mode |
| `b2SideAmount` | 0..1 | 0 | band 2 Side drive, active only in M/S mode |
| `b2Curve` | Tube / Solid | Tube | band 2 curve |
| `saturationMode` | Subtle / Medium | Subtle | global measured Spectre intensity law |
| `deEmphasis` | 0..1 | 1 | 0 = shaped bell; 1 = shaped bell minus aligned unprocessed bell |

The primary amount has one stable stored identity: it is labelled Amount and drives
both L/R channels in Stereo mode, then is relabelled Mid in M/S mode. Side remains
stored while Stereo is selected but is inactive. This preserves the original ten
band settings and adds the two saved routing modes, one global saturation mode, and
the requested global de-emphasis value; switching routing does not silently overwrite
either M/S amount. The two routing modes default to Stereo, saturation defaults to
Subtle, and de-emphasis defaults to 100%. The unpublished always-M/S v1 state migrates
both routing modes to Mid/Side. V1 and v2 migrate to 100% de-emphasis, while v1–v3
migrate to Subtle, preserving their previous signal law and approved sound.

All fourteen values are smoothed, preset/host-state persisted, non-automatable, absent
from modulation catalogs, and unavailable as an Effects Lane device. The isolated
audition VST exposes them only through its own GUI; T28 owns the final Polish UI.

The audition GUI shows the two selections on one conventional logarithmic 20 Hz–20
kHz versus 0–12 dB parametric-EQ plot. Its shoulders use the same measured 4× peaking
law as the DSP. The linked Stereo or Mid response is solid; when a band is in M/S,
its independently driven Side response is dashed. This is a selection/drive display,
not a promise that the final harmonic output itself is an ordinary linear EQ curve.

All amounts default 0 ⇒ the module is born silent-by-contribution: `curve(0) = 0`
and residue = 0 exactly. The output is then the measured JUCE 7.0.1 maximum-quality
4× FIR neutral round trip, with 59.5 samples fractional latency and a 60-sample host
report. It is not the same-frame, bit-exact input. Exact Spectre-Good pre-response and
literal zero-latency dry are mutually exclusive; Andrew approved integrating the
measured wrapper after that tradeoff was presented.

No global mix (the four amounts are the mix), no output trim or hidden residue trim
(rack gain staging owns that), no oversampling quality switch (fixed ×4 — one less way to sound bad; Spectre's
16x tier is a CPU luxury this design doesn't need at two gentle bands).

## 3. The two curves

Direct Spectre 1.5.6 renders supersede the manual's reversed character descriptions.
The measured global **Subtle** transfer functions are:

- **Solid** — `tanh(3x) / sqrt(2)`: symmetric, predominantly odd harmonics.
- **Tube** — `(tanh(3x + 0.125) - tanh(0.125)) / sqrt(2)`: biased, even + odd
  harmonics. Default for band 2. Its signal-dependent DC makes the fixed
  shaped-path high-pass mandatory.

The measured global **Medium** transfer functions are:

- **Solid** — `tanh(6x) / 2`: symmetric, predominantly odd harmonics.
- **Tube** — `(tanh(6x + 0.3125) - tanh(0.3125)) / 2`: biased, even + odd
  harmonics.

These fixed laws reproduce the measured harmonics across the retained level/Amount
sweep. Subtle's small-signal gains are approximately +6.53 dB (Solid) and +6.40 dB
(Tube); Medium's are approximately +9.54 dB and +8.71 dB respectively.
Spectre does **not** normalize either curve back to unity fundamental gain and does
not run an RMS/correlation follower. That retained positive fundamental contribution
is part of its sound. Both curves are fixed, memoryless, and stateless; there is no
envelope-driven bias or hidden gain compensation.

## 4. Anti-aliasing and alignment

The production wrapper is the measured Spectre-Good topology, not Cmajor node
oversampling:

- One shared input stage runs the pinned JUCE 7.0.1 maximum-quality 4× equiripple
  half-band FIR. Every Stereo and M/S **bell and shaper** runs at the resulting 4×
  rate. Shaped and unprocessed selected-bell paths are reconstructed separately by
  identical FIR stages before subtraction, so the residue remains aligned.
- The neutral path uses the same up/down FIR. Its impulse matches the independent
  JUCE reference fixture to `7.45e-9` maximum sample error. The wrapper has 59.5
  samples fractional latency and the processor declares 60 samples to the host
  once the host prepares processing. A JUCE host probe confirms 60 before audio is
  processed and after processing begins. Pluginval's earlier, pre-prepare info query
  displays 0 for both Cosimo and Spectre and is not the processing-state latency.
- The shaped path then receives the measured 20.016318 Hz second-order Butterworth
  high-pass (`Q = 1/sqrt(2)`) and fixed `+0.020816 dB` fit before the unfiltered
  selected bell is subtracted. No program-dependent gain process follows.
- A high-parked bell is the honest aliasing risk: harmonics of 8–16 kHz content land near
  or above Nyquist and fold. ×4 oversampling plus gentle curves plus residue levels
  (this is a subtle effect by design) keeps fold-back below audibility; the ADAA
  escape hatch from the saturator doc applies here unchanged if listening says
  otherwise.

## 5. Voicing

- Spectre's Amount is an ordinary 0..+12 dB boost. The signal extracted from its
  parallel bell is therefore:
  `driven = band(Q · sqrt(gain(12 dB · amount))) · (gain(12 dB · amount) − 1)`.
  Twenty-five measured gain/input pairs fit this law with 0.0000063 dB RMS error
  (0.000018 dB maximum). It is exactly zero at Amount 0 and reaches 2.981x at 100%.
- The host-facing Frequency law is logarithmic 20 Hz–20 kHz and Q is linear 0.1–10,
  matching Spectre's endpoint normalization. Ten retained −3 dB shoulder probes from
  1–12 kHz, Q 0.7–2, and +6/+12 dB match the production Cmajor bell within 0.00154 dB.
- The contribution is exactly
  `ButterworthHP(shape(driven)) − deEmphasis · driven` after both terms are separately
  reconstructed from 4×, and is added to the FIR-aligned dry. There is no
  second Amount multiply, post-shaper attenuation, static unity-fundamental matcher,
  RMS follower, correlation matcher, or output trim. The rejected `0.035`
  (approximately −29.1 dB), `0.08`, and `0.094` multipliers buried the effect and are
  not part of the design.
- Low-position voicing target: kick/bass weight on small speakers (2nd/3rd harmonic
  of 40–130 Hz content landing 80–400 Hz). High-position: acoustic guitar / vocal
  sheen and the side-widener use.
- The global selector reproduces Spectre **Subtle** and **Medium** as separate fixed
  transfer laws; it does not fold either intensity into Amount. Subtle remains the
  default. `scripts/measure_spectre_reference.py` regenerates the broad reference
  corpus, while `scripts/measure_spectre_enhancer_lockin.py` repeats the focused
  low-frequency transfer sweep for both modes. The production Medium renderer is
  guarded against 33 retained harmonic peaks; current worst error is 0.04284 dB.
  Raw and level-matched audition files live under ignored
  `build/t26-spectre-reference/`.

### Spectre-Good fidelity gap resolved in production (2026-08-26)

The uncertainty and wrapper passes isolated the prior mismatch to Spectre Good's
JUCE FIR timing/reconstruction and the post-reconstruction shaped-path high-pass.
Both are now in `wt::EnhancerBus`; the retained EQ and four fixed shaper laws did not
change. Across four musical fixtures and both modes, the production topology targets
the measured candidate errors of about −61 dB at 0% de-emphasis, −58 dB at 50%, and
−55 dB at 100%, versus roughly −3 to −5 dB for the replaced wrapper/order. The
production regression separately locks the FIR impulse to JUCE, bell shoulders to
0.000824 dB worst error, and Medium harmonic peaks to 0.04284 dB worst error.

No RMS, correlation, envelope, or automatic gain follower was introduced. Full
evidence and inference boundaries remain in `ENHANCER_MATCHING_FINDINGS.md`,
`ENHANCER_WRAPPER_PROTOTYPE_FINDINGS.md`, and
`ENHANCER_DEEMPHASIS_FINDINGS.md`.

## 6. Placement and rack integration

Position: **inside the fixed polish chain** (`POLISH_CHAIN_DESIGN.md`) — after all
rack modules and the global filter, between the SAFE BASS stage and the final
comp/clipper. A single always-resident instance: no pool membership, no
`poolResetIn` lifecycle, no modulation-table rows, no lane-state schema growth. It
declares the measured 60-sample wrapper latency and performs no allocation. Stereo
and M/S branches keep independent filter, reconstruction, and shaped-high-pass
history so a smoothed mode change crossfades coherent decoded residues
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

1. All Mid/Amount and Side amounts 0 ⇒ nonlinear contribution is exactly zero and
   output matches the retained JUCE FIR neutral impulse within `1e-7`; host latency
   is exactly 60 samples. Literal same-frame bit-exact dry was superseded by the
   approved Spectre-Good fidelity tradeoff in §4.
2. De-emphasis is exact and affine: 0% adds the shaped bell, 100% subtracts the full
   aligned unprocessed bell, and 50% is the sample-accurate midpoint after smoothing.
   No scalar, output matcher, or loudness-equivalence gate follows that operation.
3. With −18 dBFS pink input and 100% de-emphasis, either band at full Stereo Amount
   contributes no less than −6 dB relative to dry. This is a burial-prevention gate,
   not an output-equivalence target. No dynamic level follower is permitted.
4. Mono input remains mono in Stereo and M/S. In M/S, mono with only Side raised is
   exact dry, and a pure-side signal with only Side raised remains pure side.
5. Each band can select Stereo or M/S without changing the other band's routing.
6. Andrew's ears on the rebuilt installed VST remain the final sound gate.
7. The retained Spectre bell crossings must remain within 0.02 dB in the production
   Cmajor renderer; the current worst result is 0.000824 dB.
8. Medium Solid and Tube must match the retained Spectre harmonic peaks within 0.15
   dB in the production renderer; the current worst result is 0.04284 dB.
9. The built and installed VST3 binaries must be byte-identical, codesign-valid,
   universal arm64/x86_64, pass pluginval strictness 5, report 60 samples after host
   preparation, and be mapped by Ableton from the installed path.

## 9. Open decisions (defaults apply unless overridden)

1. **De-emphasis amount.** ~~Always-on~~ **Resolved 2026-08-26 by Andrew**: one global
   continuous 0..100% control, default 100%, with the exact law in §1.
2. **Rack integration form.** ~~Open~~ **Resolved 2026-08-25**: a fixed member of
   the static polish chain (`POLISH_CHAIN_DESIGN.md`) — not a pool module, not
   modulatable.
3. **Module name.** Working name "Enhancer" (`wt::EnhancerBus`).
4. **Saturation modes.** **Resolved 2026-08-26 by Andrew**: expose the measured
   Subtle and Medium laws globally; keep Subtle as the backward-compatible default.

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
additivity, sample rates, and musical fixtures. A second focused pass adds 90 full
impulse-response bell cases plus 25 low-frequency input/gain pairs for each retained
character. AU and VST3 renders were bit-identical; fresh-instance determinism was
exact. See `scripts/measure_spectre_reference.py`,
`scripts/measure_spectre_enhancer_lockin.py`, and the retained derived fixture
`tests/fixtures/enhancer_spectre_lockin_v1.json`; raw audio and full reports remain
ignored under `build/`. The focused shaper pass contains 25 input/gain pairs for each
Subtle/Medium × Tube/Solid combination. The manual's Tube/Solid prose is retained only
as provenance because the measured plugin labels are reversed.

A third pass, `scripts/measure_spectre_enhancer_uncertainty.py`, adds multitone
intermodulation, hot-history, complex impulse, quality, high-frequency, and musical
holdout comparisons against the installed Cosimo VST3. Its raw report and A/B audio
remain ignored under `build/t26-spectre-uncertainty/`; the evidence-backed conclusion
is recorded in `ENHANCER_MATCHING_FINDINGS.md`.

The fourth and fifth passes identify the exact JUCE FIR wrapper and the shaped-only
high-pass/de-emphasis order. `tests/fixtures/enhancer_juce_fir_wrapper_v1.json`
retains the independent neutral impulse, and `scripts/measure_enhancer.mjs` guards
that fixture plus the Spectre bell and Medium-harmonic locks against the production
Cmajor renderer. See `ENHANCER_WRAPPER_PROTOTYPE_FINDINGS.md` and
`ENHANCER_DEEMPHASIS_FINDINGS.md`.
