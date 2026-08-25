# Distortion Quality Design

Status: implementation authority, superseded in full by Andrew's decisions on
2026-08-25 and his low-level Mix correction on 2026-08-26.

This document replaces the earlier grade-2 proposal imported from
`claude/cosimo-distortion-quality-x0rx9c` at
`63dd431b15f7ebfd27e9f54406892391a42fd6d7`. The source survey and taxonomy in
`DISTORTION_FIELD_NOTES.md` remain useful context, but they do not override this
design.

## 1. Product outcome

Rebuild the rack Distortion around three deliberately different, selectable
nonlinearities:

1. **Symmetric** saturation: the positive and negative halves bend identically.
2. **Asymmetric** saturation: one half bends earlier through a fixed static bias.
3. **Wavefold**: peaks reflect back after crossing fold thresholds instead of
   flattening.

The target remains a warm, alive, useful distortion whose complete Drive and Mix
travel is controllable. Soundtoys Decapitator, Ableton Drum Buss, and Auxy's built-in
distortion remain references for the saturation school; Wavefold is intentionally a
third, more overtly harmonic option. Physical circuit simulation is not required.

The user-visible defect this task must close is objective: the dry and driven wet
signals currently reach Mix at radically different levels. Wet must be corrected
before the dry/wet blend, and the intermediate Mix positions must then be normalized
so sweeping Mix does not create a large hump or hole.

## 2. Superseding decisions

The following decisions are explicit and final for T25:

- The earlier no-new-controls restriction is lifted.
- Add one discrete `distortionType` control with `Symmetric`, `Asymmetric`, and
  `Wavefold` choices. Keep all six existing parameter identities and ranges.
- Each selected Type is **one nonlinear distortion algorithm**. There is no
  cascaded/two-clip design, no character clipper followed by a Knee clipper, and no
  pre- or post-fold saturator.
- Asymmetric bias is fixed and static. There is no envelope follower and no dynamic
  or program-dependent bias.
- Drive controls the level entering the selected nonlinearity. It is not a hidden
  macro over EQ, bias, and other voicing changes.
- Both user wet filters stay before Drive and before the selected distortion. There
  is no post-shaper Tone/fizz filter, drive-scaled pre-emphasis, or inverse EQ.
- Preserve the existing post-distortion DC removal; do not add a duplicate blocker.
- Preserve 4x oversampling, zero declared latency, allocation-free/pool-safe
  processing, exact Classic dry at zero Wet, and aligned Harmonics residue.
- Gain correction is calculated algorithmically from the actual running dry and wet
  signals. Andrew is not a manual calibration or loudness-approval step, and a
  single fixed correction calibrated at one input level is explicitly rejected.
- Start without ADAA, feedback, hysteresis, WDF/circuit models, neural models, or any
  other grade-3 detour.

These choices supersede every contrary statement in the earlier version of this
document, T25, and `OPEN_WORK_ROADMAP.md`, especially the prior moving-bias,
pre/de-emphasis, post-low-pass, Drive-macro, and two-stage-shaper instructions.

## 3. Parameter surface

The existing six endpoints remain:

| Endpoint | Meaning |
| --- | --- |
| `distortionMode` | Classic output or Harmonics-residue output |
| `distortionDriveDb` | 0..36 dB input gain into the selected algorithm |
| `distortionKnee` | softer to sharper curvature inside that one algorithm |
| `distortionWet` | dry/wet amount; new/reset default is 50% under T41 |
| `distortionWetHPHz` | pre-distortion wet high-pass |
| `distortionWetLPHz` | pre-distortion wet low-pass |

Add:

| Endpoint | Meaning |
| --- | --- |
| `distortionType` | `0 = Symmetric`, `1 = Asymmetric`, `2 = Wavefold` |

`distortionType` is a saved, UI-editable discrete Effects Lane slot parameter. The B3
parameter cut means Effects Lane fields are not separate DAW host parameters. Type is
not a modulation destination. The five existing continuous
Distortion modulation targets remain unchanged. The default Type is Asymmetric because
the default product target is warm saturation; Symmetric retains the familiar balanced
curve, and Wavefold is an explicit choice.

Adding Type appends one new parameter contract; it does not rename or repurpose any
existing endpoint. Do not add a preset/state compatibility layer unless separately
authorized.

## 4. One selected nonlinear algorithm

All three algorithms run inside the existing 4x oversampled core. Drive is applied
before the core. The output of every algorithm must be finite and bounded for every
finite input and parameter value.

### 4.1 Symmetric

Use one normalized monotonic soft-saturation curve whose positive and negative halves
are exact sign mirrors. Knee moves continuously from a broad/soft bend to a
narrower/sharper bend. The existing generalized-knee family is the starting curve;
the maximum exponent is 12 to avoid spending the top of the control on near-hard
clipping under only 4x oversampling.

This mode should predominantly produce odd harmonics from a centered sine input.

### 4.2 Asymmetric

Use one biased version of the saturation curve. Apply one fixed internal bias near
`0.08` normalized units, evaluate the one asymmetric transfer, and remove its static
zero-input offset. Knee retains the same soft-to-sharp meaning as Symmetric.

There is no Bias knob and no envelope-controlled motion. The static asymmetry must
produce measurable even harmonics without stereo-dependent movement; left and right
use the same constants.

### 4.3 Wavefold

Use one symmetric, bounded, repeated-fold transfer function. The region before the
first fold is unity; increasing Drive crosses more fold thresholds. Knee controls the
**reflection law** inside the same transfer function:

- soft Knee gives shallow, rounded reflected portions that retain more fundamental;
- sharp Knee approaches a full mirror reflection and produces stronger upper
  harmonics.

Knee changes the complete reflected portion, not only a cosmetic corner radius. It
does not invoke a second clipper before or after the fold. Drive owns fold traversal;
do not add a redundant Fold Amount control in T25.

## 5. Signal flow

```text
input ─────────────────────────────────────────────────────────── dry (bit-exact)
  │
  └─ wet HP → wet LP → Drive → 4x selected nonlinear core ─┬─ shaped round trip
                                                            └─ unity round trip

shaped round trip → existing DC removal → live bounded level match → Classic wet
shaped round trip − unity round trip → DC removal → same live scale → residue

Classic:   normalized dry/wet blend of dry and compensated Classic wet
Harmonics: dry + residue × Wet
```

Both shaped and unity outputs must pass through the same oversampling round trip. The
unity reference begins from the same driven, prefiltered sample and differs only by
bypassing the selected nonlinear transfer. Never subtract the pre-oversampling signal
from the post-round-trip shaped signal.

At zero Drive the selected nonlinear path is exact unity. The selected transfer is
engaged continuously over the first 6 dB of Drive, avoiding a discontinuous switch
between unity and a nonlinear curve. The aligned residue is therefore numerically
negligible at zero.
The existing Harmonics product behavior remains additive (`dry + residue * Wet`); the
residue itself, not the complete additive output, is effectively silent at zero Drive.

Preview input remains the driven pre-core signal. Preview output becomes the final
post-DC, post-makeup Classic wet signal so the visualization reports what Mix receives.

## 6. Deterministic live gain compensation

Dry remains at unity. Applying the same gain to dry and wet would preserve the bug and
is forbidden. Only the completed wet signal is brought to the dry reference level
before mixing.

### 6.1 Why the fixed table is superseded

Andrew's phone test exposed that the -18 dBFS pink-noise table only matched the level
at which it was calibrated. With Asymmetric, Drive 36 dB, and Knee 0.35, the same table
made 50% Mix 12.47 dB louder than 1% Mix for a -36 dBFS filtered saw, but only 1.34 dB
louder at -18 dBFS. Pink noise behaved the same way at matching levels. The filtered
saw's ideal correction differed from pink by at most 0.85 dB; input level, not fixture
choice, was the dominant variable.

This is inherent to the nonlinear transfer: quiet input retains much more of Drive's
gain, while louder input is compressed or folded. One Type x Drive x Knee scalar
cannot match both. Retuning the table at another level merely moves the failure.

### 6.2 Runtime level matcher

The production processor keeps three stereo-linked, exponentially weighted values
over a 10 ms window:

1. dry mean-square energy;
2. completed raw-wet mean-square energy;
3. dry/wet cross-energy.

The wet-only correction is calculated every sample:

`makeupGain = sqrt (runningDryPower / runningWetPower)`

Detector floors prevent division by silence. Makeup is bounded from -36 dB to +6 dB
and carries a fixed -0.3 dB transient margin,
so pathological cancellation or extreme non-default filters cannot create unbounded
gain. Left and right share one correction, preserving stereo balance. A fresh or
pool-reset instance fades from dry to the level-matched wet over 5 ms; this removed the
measured startup burst without adding declared latency.

This is automatic level matching, not a compressor threshold or feedback loudness
controller: the two energies are measured through identical windows and their ratio is
applied only to the wet path. The fixed verification entry point remains narrow and
can bypass the matcher to report the raw correction being applied.

### 6.3 Mix normalization

First match the 100% wet endpoint as above. Then use the running dry/wet cross-energy
to calculate the current correlation:

`baseMix = (1 - wet) * dry + wet * compensatedWet`

`mixGain = 1 / sqrt ((1 - wet)^2 + wet^2 + 2 * rho * wet * (1 - wet))`

The runtime Classic output is `baseMix * mixGain`, with hard exact endpoints at 0%
and 100%. This adapts to the actual signal instead of assuming pink noise's
correlation. At exactly 0% Wet, the output takes a hard dry branch before any
multiplication and remains bit-identical. Type changes crossfade inside the one
selected-transfer seam.

No listening judgment is required to derive the correction; production-seam
regressions own it numerically.
## 7. Minimal implementation boundary

The implementation is deliberately limited to:

1. One failing production-seam regression for the present wet/mix mismatch and residue
   leak.
2. The Type parameter/state/UI plumbing required by the existing lane and parameter
   contracts.
3. The three single algorithms inside `wt::DistortionBus`.
4. The aligned oversampled unity output and existing DC/reset handling.
5. One narrow verification entry point for raw-versus-matched production output.
6. Focused behavioral proof, followed by the repository-required desktop delivery.

Do not build a generic audio-analysis framework, add a dependency, refactor unrelated
rack code, or create a second planning document. If the existing seams cannot support
this bounded implementation, stop before expanding scope.

## 8. Acceptance contract

The change is complete only when all of the following are automated and green:

1. The retained level regression fails against the original mismatched implementation.
2. With default filters, 100% Classic wet remains within 1 dB of dry across the tested
   Type x Drive x Knee grid and quiet-to-nominal input levels.
3. Classic Mix at 0/25/50/75/100% remains within 1 dB of dry across that grid, including
   Andrew's 110 Hz saw through a 350 Hz, 12 dB/octave low-pass at -36, -30, -24, and
   -18 dBFS, without discontinuity or non-finite output.
4. Fixed drums, bass, and bright-poly holdouts remain level-controlled; adversarial
   near-Nyquist material remains finite and bounded. Verification includes 44.1, 48,
   96, and 192 kHz where applicable.
5. Symmetric produces the centered/odd-harmonic behavior, Asymmetric produces
   measurable even harmonics, and Wavefold is measurably non-monotonic and distinct.
6. Harmonics residue uses the aligned round trip and is effectively silent at zero
   Drive; the additive Harmonics output therefore remains dry there.
7. Classic Wet at exactly zero is bit-identical dry for every Type. Reported latency
   remains zero. Pool reset clears all filter, DC, interpolation, and oversampling
   histories without changing parameter values.
8. Type is saved/restored and exposed on desktop and iPhone; existing parameter IDs,
   ranges, and modulation targets remain intact. New/reset Wet remains 50% as owned by
   T41.
9. Focused Cmajor/UI/state tests pass, then the current desktop UI is built, a fresh
   HMR standalone is launched, and the compiled VST3 is installed at
   `~/Library/Audio/Plug-Ins/VST3/CosimoDesktopNative.vst3`.

Sound-reference renders may be retained as useful evidence, but Andrew's listening is
not a completion gate for algorithmic level compensation.
