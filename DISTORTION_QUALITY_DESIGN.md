# Distortion Quality Design

Status: **locked design, 2026-08-25** (Andrew + assistant session). This document is the
output of the design conversation — it specifies *what to build and why*, not a build log.
Implementation happens under a separate effort against this spec.

Reference sound targets named by Andrew: Soundtoys Decapitator, Ableton Drum Buss,
Auxy's built-in distortion. All three are "analog school" saturators: warm, alive,
usable at every knob position. None of them are the digital fold/crush school (Vital),
and none of them require circuit simulation.

---

## 1. The diagnosis (why the current module sounds bad)

The current `wt::DistortionBus` (`cmajor/Distortion.cmajor`) is a **static, symmetric,
memoryless soft-clip with uncompensated gain**. Four specific defects, none of them
taste questions:

1. **No makeup gain anywhere.** Drive is 0..+36 dB into the shaper
   (`Distortion.cmajor:188`) and the output is never trimmed back. Wet is crushed
   against ±1.0 with massively raised RMS while dry stays at input level. This is the
   dry/wet "different volumes" complaint, and it also means the algorithm has never
   been auditioned fairly — louder always wins.
2. **Perfectly symmetric curve ⇒ odd harmonics only.** `shapeSample` is
   `x / (1+|x|^k)^(1/k)` (`Distortion.cmajor:86-97`). Symmetric clipping produces the
   cold/buzzy character. Every reference target generates even harmonics via
   asymmetry (bias), and modulates that asymmetry with the program material.
3. **No tone shaping around the nonlinearity.** Both wet filters currently sit
   *before* the shaper, so fizz the shaper generates above `wetLP` is never tamed.
   The references all filter on both sides of the clipper.
4. **The "harmonics" residue is misaligned by construction.**
   `residue = shaped − driven` (`Distortion.cmajor:202`) subtracts a pre-oversampling
   signal from a post-round-trip signal. Any resampler smear pollutes the residue with
   dry leakage.

## 2. The chosen grade of realism

Survey of shipping open-source implementations (evidence in §9) shows "memory" in a
distortion comes in three distinct grades:

- **Grade 1 — bookkeeping**: ADAA registers, DC blockers. Mandatory hygiene, no
  audible "character".
- **Grade 2 — structural**: asymmetric bias driven by an envelope follower, filters
  around (and inside) the nonlinear cluster, cascaded gentle stages, static makeup
  laws. Cheap, and this is where the Decapitator/Drum Buss "alive" quality lives.
- **Grade 3 — physical**: circuit ODEs, WDF diode clippers, tape hysteresis solved
  per-sample with Newton–Raphson. Expensive; needed for amp-sim products, not for a
  synth's rack module.

**Locked: this module is a grade-2 design.** Grade 3 is explicitly out of scope (§7).

## 3. Locked signal flow

All of this lives inside `wt::DistortionBus`, stereo, zero declared latency (ADR-008),
no allocation, pool-resettable.

```
in ──┬───────────────────────────────────────────────────────────────┐ (dry, bit-exact)
     │                                                               │
     ├─ wetHP (pre, 4th-order Butterworth HP — "what gets driven")   │
     ├─ pre-emphasis tilt (style constant, scales with drive)        │
     ├─ × driveGain (0..+36 dB)                                      │
     ├─ [ ×4 oversampled core ]                                      │
     │    ├─ + bias  (static + envelope-driven, stereo-linked)       │
     │    ├─ stage 1: asymmetric soft saturator (character)          │
     │    ├─ stage 2: existing knee curve (hardness, exponent cap)   │
     │    └─ thru-path: bias-free unity pass (for residue alignment) │
     ├─ de-emphasis (inverse of pre-emphasis tilt)                   │
     ├─ wetLP (MOVED post-shaper — this is now the Tone / fizz-tamer)│
     ├─ DC blocker (existing)                                        │
     ├─ × makeup (static auto-gain law from drive+knee)              │
     │                                                               │
     └─ mix: classic = equal-power dry/wet   harmonics = dry + residue·wet
```

### 3.1 Stage specifications and starting constants

Constants below are **starting points**; final values land during voicing (§5).
"Norm" means relative to the curve's knee level ≈ 1.0.

| Stage | Spec | Starting constants |
|---|---|---|
| Pre-emphasis | 1-pole tilt into the clipper, exact inverse after. Makes highs saturate silkier, keeps lows from eating headroom. | +2.5 dB high tilt at full drive, pivot ~900 Hz, amount scales linearly with driveDb |
| Static bias | Constant offset before stage 1 → 2nd-harmonic warmth at low drive | 0.08 norm |
| Dynamic bias | Envelope follower on the driven signal moves the operating point — program-dependent asymmetry, the "it breathes" quality (analog coupling-cap drift) | depth up to +0.10 norm at full drive; attack 10 ms, release 180 ms; stereo-linked (max of L/R) so the image doesn't wobble |
| Stage 1 | Asymmetric soft saturator, e.g. tanh-family evaluated at `x + bias`; asymmetry grows with drive (2nd-dominant at low drive, odd takes over cranked — tube behavior) | tanh rational approx (see Surge `TANH`, §9) |
| Stage 2 | The **existing** knee curve `x/(1+|x|^k)^(1/k)`, kept as the hardness control. Cascading two gentle stages beats one steep stage at equal THD. | exponent remap `k = 2 + 10·knee²` (cap 12, was 16 — see §3.5) |
| DC blockers | Existing `classicDcBlocker`/`residueDcBlocker` stay. Bias + DC-block re-centering is a desirable analog artifact, not a bug. | unchanged |
| Makeup | Static law, never dynamic (dynamic loudness matching pumps) | see §3.3 |

### 3.2 Parameter surface: **unchanged count, two new semantics**

The six existing params keep their ids, ranges, and modulation targets
(`EffectsRack.cmajor` tables untouched):

| Param | Before | After |
|---|---|---|
| `modeIn` | classic / harmonics mix | unchanged |
| `driveDbIn` 0..36 | raw input gain | **macro**: drive + pre-emphasis amount + bias depth + makeup, moving together on voiced curves (the Auxy/Decapitator lesson: the knob is the product) |
| `kneeIn` 0..1 | curve exponent 2..16 | curve exponent 2..12 on stage 2 |
| `wetIn` 0..1 | equal-power mix | unchanged law, now honest (makeup makes wet ≈ dry loudness) |
| `wetHPHzIn` 20..4000 | pre-shaper HP | unchanged position — "what gets driven" (the Drum Buss *Crunch* idea: protect the lows from the clipper) |
| `wetLPHzIn` 20..20k | pre-shaper LP | **moved post-shaper** — becomes Tone / fizz high-cut (Decapitator's high cut). Default stays 18 kHz for preset compatibility |

No new user parameters. Makeup is always-on, not a toggle; there is no output trim —
downstream rack gain staging covers that. Fewer knobs, no bad settings.

### 3.3 Auto-makeup law

Mechanism (locked): a **static, hand-voiced function of drive and knee** applied to the
wet path before mixing — the same approach as Decapitator's Auto output; commercial
saturators do not use dynamic loudness matching for this because it pumps.

Form: `makeupDb = −α · driveDb + trim(knee)`, starting at α = 0.85, `trim` within
±2 dB. Final constants are voiced so that, for pink noise at −18 dBFS, wet loudness
tracks dry within ±1 dB across the full drive range (§5). Result: the mix knob and
bypass comparisons become fair by construction.

### 3.4 Residue alignment fix (harmonics mode)

Locked mechanism: the oversampled core gains a second output — a **unity thru path**
that carries the driven signal through the *same* up/down resampling round trip as the
shaped signal. `residue = shaped_rt − thru_rt`, both post-round-trip, aligned by
construction regardless of what the resampler does. This removes dry leakage from
harmonics mode without measuring or compensating anything.

Classic-mode dry stays the bit-exact input (ADR-005 hard bypass at wet = 0 is
non-negotiable), so classic mix tolerates only sub-sample wet-path smear — see §3.5.

### 3.5 Anti-aliasing stance

- Keep the existing ×4 oversampled cores.
- **Requirement on the resampler**: the wet round trip must introduce no declared
  latency and at most ~1 sample of smear, or classic-mode mixing combs. At
  implementation time, verify what interpolation Cmajor's `* 4` node oversampling
  uses and pin it via annotation if supported; if it cannot meet the requirement,
  replace node oversampling with an in-processor ×4 stage in the Surge Distortion
  style (polynomial up, two cascaded polyphase IIR halfband decimators — see §9),
  which stays within ADR-008.
- Cap the stage-2 exponent at 12 (was 16). Near-hard clipping at +36 dB through ×4
  oversampling is the one configuration that audibly folds back; softening the top of
  the knee range costs little character and buys most of the headroom.
- **Escalation path, not v1**: first-order ADAA on stage 2 (sst-waveshapers style:
  one previous-input + one previous-antiderivative register, ill-conditioning guard,
  no declared latency). The general-k curve has no closed-form antiderivative, so this
  would use tabulated antiderivatives over a quantized knee grid (chowdsp-style LUT).
  Only build this if the shipped module audibly aliases on bright material at high
  drive. Second-order ADAA is ruled out: it costs a declared sample of latency
  (chowdsp documents this), which ADR-008 forbids.
- Some aliasing at maximum drive is acceptable. Decapitator itself audibly aliases
  cranked; well-controlled is the bar, perfect is not.

### 3.6 Cmajor structure changes

- `DistortionCoreChannel` gains inputs `biasIn` (value stream, computed once in
  `DistortionBus` at base rate and sent to both cores — this is what stereo-links the
  envelope) and a second output stream `thru` (§3.4). Cores stay mono ×4 nodes.
- `DistortionBus` gains: envelope follower state, tilt shelf pair (pre/de-emphasis),
  and the makeup computation. The wet LP filter moves after the cores.
- `poolResetIn` additionally clears: envelope follower state, tilt filter state.
  (Existing filter/DC resets stay; coefficients preserved, state cleared — same rule
  as today, `Distortion.cmajor:148-158`.)
- Preview taps: `previewInput*` stays the driven pre-shaper signal; `previewOutput*`
  becomes the post-makeup wet, so the scope shows what the module actually
  contributes at matched loudness.
- Zero declared latency throughout; the module remains part of the rack latency
  witness proof (`EffectsRack.cmajor` C10).
- **The envelope follower adds no latency.** It is a causal side-chain control, not
  an element of the audio path: sample `n` leaves the module on tick `n`, biased by an
  envelope computed from samples `≤ n`. Its attack/release constants are *response
  lag in the control value* (the desired bias-drift character), not delay of the
  audio. Latency would only enter via lookahead (reading ahead to react before a
  transient) — banned here for the same reason `RackOutputStage` refuses a lookahead
  limiter and `Ott` dropped its standalone 3 ms lookahead path under ADR-008. Same
  category as the module's existing IIR filters and DC blockers: state and phase
  shift, never delay.

## 4. What stays exactly as-is

- The six-parameter modulation surface, rack tables, lane state, preset schema.
- Equal-power classic mix law and the two-mode (classic/harmonics) architecture —
  harmonics mode is a legitimate exciter topology (Aphex school); it stays, fixed.
- The wet HP as a *pre*-shaper band selector (Drum Buss *Crunch* validated it).
- The existing knee curve — demoted from "the whole algorithm" to stage 2 of a chain,
  which is the correct altitude for it.
- Scope/history analyzers, ADR-005 bypass, ADR-008.

## 5. Voicing (how constants get final values)

The §3.1 constants and the drive-macro curves (§3.2, §3.3) get their final values by
ear against the reference plugins, at −18 dBFS program level, using the same
render-and-compare approach already proven in `scripts/drum_buss_*` (sine-sweep
harmonic profiles were used there to fit Ableton's Drive stage — the method extends
directly to matching a Decapitator-style harmonic profile). Reference renders of a
Cosimo stem through Decapitator at 2–3 loved settings, if provided, become the
voicing target; absent those, the target is the §3.1 description (2nd-dominant at low
drive, odd-dominant cranked, no fizz above the Tone cut).

This is voicing, not research: constants change, the architecture above does not.

## 6. Ship criteria

1. Pink noise at −18 dBFS: wet loudness within ±1 dB of dry across the full drive
   range (the fair-A/B guarantee).
2. Harmonics mode at wet=1, drive=0: output ≈ dry (residue ≈ silence) — proves the
   alignment fix.
3. Bypass invariants hold: wet=0 classic is bit-exact dry; rack latency witness still
   proves 0.
4. Andrew's ears on real patches, A/B'd at matched loudness against the references.

## 7. Explicitly out of scope (v2 shelf)

- **Styles/characters menu** (Decapitator A/E/N/T/P): v1 ships one voiced character.
  The skeleton is the work; styles are constant-set swaps (tilt amount/pivot, bias
  sign/depth, stage-1 curve, transformer-style low-shelf pre-boost). If v1's
  character lands, adding a style table is a small follow-up.
- **Feedback around the nonlinearity** (Surge Distortion's `L = in + fb·L`): audible
  and cheap but interacts with modulation and needs stability care; revisit in v2.
- **Grade-3 physics**: WDF circuits, tape hysteresis, neural stages. Wrong
  cost/benefit for a rack module.
- **Multiband saturation**: the rack's lane architecture is the right home for
  multiband, not this module's internals.
- **Transient re-injection** (Drum Buss *Transients*): valuable for drums; belongs in
  a separate rack module if wanted, not inside the saturator.

## 8. Open decisions (defaults apply unless overridden)

1. **wetLP semantic move** (pre → post shaper) changes how existing presets sound.
   Default: accept — the old placement was the defect. Alternative: keep pre-LP *and*
   add a fixed post fizz-cut, at the cost of a hidden filter presets can't reach.
2. **One character vs. mode-linked flavors in v1.** Default: one character (tube-ish,
   per §3.1). Alternative: make `modeIn` a 3-way (classic/harmonics/alt-voicing) —
   rejected by default because it overloads an existing param's meaning.
3. **Exponent cap 12.** Default: accept the slightly softer maximum hardness.
   Alternative: keep 16 and accept committing to the ADAA escalation path in v1.

## 9. Evidence appendix (what shipping code actually does)

Surveyed 2026-08-25 from source: `surge-synthesizer/sst-waveshapers`,
`surge-synthesizer/surge`, `mtytel/vital`, `Chowdhury-DSP/chowdsp_utils`,
`Chowdhury-DSP/BYOD`.

- **Two-layer separation is universal**: curve primitives hold only
  antialiasing/DC state; filters, bias, feedback, makeup, and mix always live in the
  wrapper one level up. Surge XT's WaveShaper FX wrapper is literally
  pre-LC/HC → **bias** → drive → curve(×2 OS) → post-LC/HC → boost → mix
  (`WaveShaperEffect.h`).
- **Surge Distortion FX** (`DistortionEffect.cpp`): pre parametric EQ → ×4 OS loop
  with feedback around the shaper and lowpasses *inside* the loop → 2-stage halfband
  decimation → output gain → post EQ. Also: probes the shaper at zero input at runtime
  and subtracts the measured DC. Manual output gain; no auto-makeup — none of the
  open-source projects ship auto-makeup, it's commercial polish (Decapitator Auto).
- **sst-waveshapers**: 43 types, 4 SIMD state registers each — ADAA priors, DC
  blocker state, or seeded-deterministic fuzz tables. First-order ADAA with an
  ill-conditioning guard; applied only to sharp-cornered curves (rectifiers, folds);
  the classic saturators run bare inside the 2×-oversampled voice engine. Shipped
  asymmetry exists (`wst_asym`, OJD's offset knees).
- **Vital** (`distortion.cpp`): six raw memoryless curves, no oversampling, no
  compensation, linear dry/wet, one routable SVF. The deliberate opposite school —
  works for digital/EDM aesthetics, and reproduces exactly the symmetric-buzz problem
  this design removes. Cosimo is not choosing this school.
- **chowdsp_utils**: reusable ADAA clippers; generic 2nd-order ADAA via three LUTs
  (f, AD1, AD2), documented +1 sample latency even bypassed — the receipt for why v1
  limits itself to first-order ADAA under ADR-008.
- **BYOD**: grade 3 in the wild — Tube Screamer as a WDF tree of schematic components
  (drive knob = virtual pot resistance), tape hysteresis as per-sample Newton–Raphson
  on magnetization state, LSTM amp captures resampled around training rate, tone
  stacks as separate modules.
- Papers/background: Parker et al., "Reducing the Aliasing of Nonlinear Waveshaping
  Using Continuous-Time Convolution" (DAFx-16, ADAA); Chowdhury, "Real-Time Physical
  Modelling for Analog Tape Machines" (DAFx-19); Pakarinen & Yeh, "A Review of
  Digital Techniques for Modeling Vacuum-Tube Guitar Amplifiers" (CMJ 2009).
- In-repo prior art: `scripts/drum_buss_fit_drive.py` and siblings (sine-sweep
  harmonic fitting of Ableton's Drum Buss Drive) — the voicing method of §5.
