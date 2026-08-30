# Advanced Comb Research and Lab Contract

The product requirement is not satisfied by renaming a one-delay comb. SeqFX
must retain the immediately legible conventional effect while earning a new
material/animated sound through independently implemented research candidates.

## Established reference

Kilohearts documents a feedforward comb as input mixed with a delayed copy,
with controls for peak spacing (`Cutoff`), mix, polarity, and a stereo mode that
flips right-channel polarity for mono-compatible width:
https://kilohearts.com/docs/snapins

This is the neutral reference behavior and supplies the conventional sound that
users expect. It is not the originality claim.

## Primary research

### Vectored time-varying comb

Vesa Norilo generalizes a feedback delay network into time-varying and
nonlinear domains, treating chorus, flanger, tap delay, and pitch effects as
parameterizations of a vectored modulation-delay network. The paper includes
orthogonal/Hadamard coupling and efficient modulation ideas:
https://www.dafx.de/paper-archive/2014/dafx14_vesa_norilo_exploring_the_vectored_ti.pdf

Applicable opportunity: a small coupled stereo delay bank can move resonances
and energy between modes instead of producing one rigid harmonic tooth series.

### Modal dispersive filters

Canfield-Dafilou and Abel describe parallel high-Q modes designed for a target
frequency-dependent delay and show that the parallel structure supports
interactive, time-varying modifications:
https://www.dafx.de/paper-archive/2019/DAFx2019_paper_49.pdf

Applicable opportunity: a `Dispersion` control can bend modal spacing and a
`Damping` control can shorten high modes without destabilizing one shared
feedback coefficient.

### Dispersion and time-varying feedback in a comb loop

Oksanen, Parker, and Välimäki place cascaded first-order allpass dispersion and
time-varying feedback inside a comb model, with a DC blocker in the loop:
https://www.dafx.de/paper-archive/2013/papers/26.dafx2013_submission_23.pdf

Applicable opportunity: allpass dispersion is a computationally compact route
from metallic combing toward string, bar, and spring-like decay. The paper is a
physical-model example, not permission to copy its source or exact sound.

Pekonen, Välimäki, Abel, and Smith derive stability conditions for feedback and
time-varying spectral-delay structures:
https://dafx.de/paper-archive/2009/papers/paper_36.pdf

Applicable constraint: modulation and feedback stability must be tested
together; clamping a UI knob alone is insufficient.

## Independently implemented candidates

Each candidate uses the same parameter-normalization wrapper, input fixtures,
gain matching, and output metrics. Code is written from the equations and
descriptions above, not copied from third-party implementations.

### Candidate A — Reference

```text
wet[n] = x[n - D]
y[n] = dryGain * x[n] + wetGain * polarity * wet[n]
```

An optional stable feedback term and one-pole damping produce decay. Fractional
delay interpolation allows continuous Tune. Opposite right-channel polarity is
available as a width mode and its mono result is measured.

Purpose: establish tuning, CPU, conventional usefulness, and null/mono
baselines. It must remain reachable when advanced controls are neutral.

### Candidate B — Dispersive

A damped feedback comb inserts a short cascade of stable first-order allpass
sections in the feedback path. Dispersion changes their coefficients and mode
spacing; frequency-dependent damping controls high-mode decay. A DC blocker and
soft feedback limiter remain inside the loop.

Purpose: produce stable string/bar/spring color that is clearly not a perfectly
harmonic metallic comb while retaining one understandable Tune center.

### Candidate C — Vector

Four short fractional delay lines use relatively prime/offset lengths around
the Tune center. A normalized 4×4 Hadamard matrix rotates feedback energy;
bounded slow modulation moves delay and/or feedback amplitude. Left/right
outputs use complementary vector projections. Saturating feedback is optional.

Purpose: create animated, stereo material resonance and hybrids that are
unavailable from one delay line. The vector count remains fixed and small for
realtime bounds.

## Lab fixture set

Render at 48 kHz first, then selected extremes at 44.1, 96, and 192 kHz:

- unit impulse and 20 ms noise burst;
- pitched pluck at C2, C3, C4;
- dry drums with kick/snare/hat transients;
- mono bass line;
- sustained stereo chord;
- spoken phrase;
- logarithmic sine sweep;
- silence after excitation for 12 seconds.

For every render record:

- peak, RMS, DC, non-finite count;
- fundamental and modal frequencies;
- tuning cents error at the intended fundamental;
- T20/T60 decay by band;
- stereo correlation and mono-fold RMS/peak;
- largest transition discontinuity;
- deterministic render digest;
- generated-code size, memory allocation, and render wall time.

Matched listening levels use integrated/short-term loudness where the source is
long enough and RMS for impulses/plucks. No candidate wins because it is louder.

## Selection rubric

Scores are 1–5 and written before the product topology is chosen:

| Criterion | Weight |
|---|---:|
| Wide, immediate sweet spot | 5 |
| Distinct from conventional Comb | 5 |
| Distinct from Spectral Chord Resonator | 4 |
| Stable/tunable fundamentals | 4 |
| Controllable musical decay | 4 |
| Stereo interest with useful mono fold | 3 |
| Clean modulation | 3 |
| CPU/memory/codegen cost | 3 |
| No runaway, denormal, or DC risk | 5 |

Hard rejection overrides score:

- any non-finite output;
- a permitted feedback setting that grows after excitation without an explicit
  bounded self-oscillation mode;
- more than 25 cents unexplained tuning error in the core range;
- a mono mode that unexpectedly removes the intended fundamental;
- CPU/codegen cost that prevents four-chain worst-case qualification;
- an advanced neutral setting that cannot reproduce the reference comb.

## Product decision boundary

No production Comb topology is selected yet. The next step is executable lab
implementation and frozen renders. The product may select B, C, or a restrained
B/C hybrid only after the scorecard exists. Candidate A remains the neutral
mode in every outcome.

The originality claim, if earned, will be narrow and literal: SeqFX combines a
conventional tuned comb with a user-controlled dispersive/coupled feedback
topology selected through measured musical, stability, mono, and CPU evidence.
It will not claim invention of dispersion, feedback-delay networks, or Hadamard
coupling.
