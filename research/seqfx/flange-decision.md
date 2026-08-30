# SeqFX Flange decision and implementation evidence

Date: 2026-08-30

## Authority

Documented facts:

- Koala FX publicly names one combined `Vibrato/Flanger` effect. Its public
  page does not document its delay range, feedback law, stereo motion, timing,
  defaults, or internal topology. <https://www.elf-audio.com/koalafx/>
- Kilohearts describes flanging as mixing the source with a slightly delayed
  copy. Its documented controls are minimum Delay, added Depth, Rate, stereo
  Spread, Feedback, and Mix; an optional Scroll mode offsets modulation phase
  to create continuous motion. <https://kilohearts.com/products/flanger>
- Effectrix2 documents a combined Chorus/Flanger modulation effect with Sync
  and Free Rate, modulation Depth and shapes, delay Offset, normal/inverse
  Feedback, Width, and filtering. It identifies about 1--20 ms as the flanger
  range. <https://downloads.sugar-bytes.de/manuals/Effectrix2.pdf>
- Julius O. Smith describes the canonical flanger as equal direct and variable
  delayed paths, producing a moving feedforward-comb response. The standard
  model uses fractional-delay interpolation, periodic modulation, and optional
  feedback constrained inside the unit circle.
  <https://www.dsprelated.com/freebooks/pasp/Flanging.html>
  <https://www.dsprelated.com/freebooks/pasp/Flanger_Feedback_Control.html>

These sources establish a short, modulated dry-plus-delay path, explicit
feedback, stereo phase/spread, and free or synchronized rate as mature
flanger vocabulary. They do not establish Koala's private algorithm or justify
copying a barber-pole mode into SeqFX without listening and CPU evidence.

## SeqFX product decision

Flange is a block-sequenced short-delay feedback effect at append-only ID 11.
It remains distinct from Vibro: Vibro is wet-only Doppler motion, while Flange
mixes the direct signal with a short delayed signal to create moving notches.
The common Block Mix remains the outer dry/wet control.

The public controls are:

- Delay: 0.2--10 ms, the minimum delay;
- Depth: 0--10 ms added above Delay;
- Rate: 0.02--10 Hz in Free mode;
- Feedback: 0--95% magnitude;
- Spread: 0--180 degrees of right-channel modulation phase;
- Polarity: Normal or Inverse feedback, trigger-latched;
- Timing: Sync or Free, trigger-latched;
- Division: 1/16, 1/8, 1/4, 1/2, 1 Bar, 2 Bars, or 4 Bars per cycle,
  trigger-latched and used only in Sync mode;
- the common Block Mix.

Delay, Depth, Rate, Feedback, and Spread are Aux eligible and smooth over
25 ms. The other controls latch on a block trigger. Feedback is a positive
magnitude so `Polarity` has one unambiguous job: it controls the feedback-loop
sign. It does not invert the feedforward delayed signal.

The original 0.1 ms lower-bound proposal became 0.2 ms. Four-point Hermite
reads need a safe neighborhood at every supported rate, and 0.2 ms still
reaches 6.4 samples at the 32 kHz qualification floor. The range decision,
division subset, defaults, and the split between Feedback magnitude and
Polarity are Cosimo engineering choices derived from the documented vocabulary,
not competitor measurements.

Scroll/barber-pole motion was rejected for this release slice. Kilohearts
proves it is an established optional mode, but the roadmap made it conditional
on a demonstrated listening and CPU win. No such evidence exists yet, and a
less literal motion mode would consume one of the eight public parameter slots.

## Signal path and motion

The delay trajectory is

```text
delay(t) = Delay + Depth * (0.5 - 0.5 * cos(2*pi*phase(t)))
```

so the displayed Delay is the real minimum and Depth is the real added range.
The right channel offsets the same phase by `Spread / 360`. Free mode advances
at the displayed Rate. Sync mode derives one modulation cycle from host tempo
and Division while leaving the stored Free Rate untouched.

Each channel reads a qualified four-point Hermite fractional delay. The
canonical internal flanged target is level-conscious:

```text
flanged = 0.5 * (input + delayed)
history write = clamp(input + feedbackSign * Feedback * delayed, -4, 4)
```

The common block mix crossfades from the input to that target. Feedback is
clamped both at the public seam and immediately before the write; the write is
hard-bounded independently. Normal and Inverse therefore keep the first echo
identical and flip subsequent recirculation, which has a direct impulse-test
oracle.

## History, stereo, and lifecycle

Flange owns 25 ms of stereo host-rate history per chain. That covers the public
20 ms maximum Delay-plus-Depth and the four interpolation guard samples at all
supported rates without involving the rate-converted Tape/Pitch history.

The effect is gated and has no output tail. Its history and phase remain warm
while transport processing advances so a newly authored block does not start
from invalid memory or an arbitrary phase reset. Entry, exit, cold-history
availability, and Polarity changes use 96-frame transitions. An identical
retrigger is bit-exact and preserves phase and feedback state. On release,
feedback decays to zero over the same bounded transition while output returns
to dry. Authoritative reset invalidates the valid-history count and phase so
stale feedback cannot return after a seek/reset.

Zero Spread is dual mono. Nonzero Spread moves the two comb responses apart;
the 180-degree fixture proves useful stereo difference and a nonzero mono fold.
This is a measured SeqFX property, not a claim about another product.

## Automated evidence

`tests/test_seqfx_probe.py` proves:

- the expected 250 Hz notch and 500 Hz peak for a static 2 ms equal-mix comb;
- Free Rate plus exact Delay/Depth extrema and Sync Rate against BPM/Division;
- dual mono at zero Spread and useful stereo plus mono fold at 180 degrees;
- Normal/Inverse second-echo polarity with an identical first echo;
- bounded output, click-safe exit, and no output tail at extremes;
- bit-exact identical retrigger behavior;
- every Aux-eligible control sweeps without runaway;
- authoritative reset invalidates live feedback history; and
- four simultaneous extreme chains remain inside the generous generated-JS
  runtime budget.

The effect-definition contract test locks all eight controls, ranges,
trigger/Aux policy, Cmajor seams, and the vendored Fontaudio `fad-phase`
identity. Source-browser proof sequences the full inspector and sparse v7
state, while the packaged shadow-root test repeats the inspector, modulation,
glyph, and overflow checks against the production bundle.

Subjective preset listening, native CPU, Ableton recall, and final release
qualification remain shared later-roadmap gates. Automated correctness is not
presented as those unperformed acceptance checks.

The Phase 5 checkpoint passed 140 combined DSP/buffer/interpolation/Comb-lab
tests, 129 non-browser state and contract tests, all 61 source-browser tests,
all 7 packaged-browser tests, the production UI/worker build, and Cmajor
dry-load at 32, 44.1, 48, 88.2, and 96 kHz. The broad state gate initially
found a 264,866-byte dense document; omitting the redundant `length: 1` field
from one-step v7 blocks reduced it to 247,970 bytes while the parser remains
backward compatible with explicit lengths.
