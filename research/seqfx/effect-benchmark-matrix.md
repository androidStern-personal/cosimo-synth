# Requested Effect Benchmark Matrix

Koala FX establishes the requested identities. Its official public page does
not document exact parameter ranges, so no hidden Koala behavior is claimed
here. Effectrix2, Looperator, Kilohearts Essentials, and primary DSP literature
provide established control vocabulary and implementation risks.

Official sources:

- https://www.elf-audio.com/koalafx/
- https://downloads.sugar-bytes.de/manuals/Effectrix2.pdf
- https://downloads.sugar-bytes.de/manuals/Looperator.pdf
- https://kilohearts.com/docs/snapins
- https://kilohearts.com/products/bitcrush
- https://kilohearts.com/products/pitch_shifter
- https://www.ableton.com/en/manual/live-audio-effect-reference/#redux

All listed effects are SeqFX block types. Koala's XY pad, scenes, hold UI, and
live-touch workflow are not being cloned.

## Product matrix

| Effect | Core audible job | Established minimal vocabulary | Lifecycle | SeqFX adaptation | Main risks |
|---|---|---|---|---|---|
| Filter | Rhythmic tone opening/closing | Mode, cutoff, resonance/Q, mix | Gated, warm filter state | Retain ID 1; clarify mode and units; preserve current aux sweep | Coefficient instability, zippering, loud resonance |
| Crush | Digital resolution and sample-rate reduction | Bits, rate, conversion quality/dither, mix | Gated | Retain ID 2 and rename display; keep Bits/Rate, add Character/Dither only if audible | Aliasing, DC/level jumps, confusing samples-vs-Hz display |
| Tape Stop | Variable-speed slowdown where pitch and speed fall together | Stop Time, Start Time, Curve, motor/return state | Bounded gesture | Follow `tape-stop-benchmark.md`; one-cell trigger may outlive cell | Tail truncation, read discontinuity, speed-up aliasing, stale history |
| Stutter | Capture a short slice and repeat it rhythmically | Slice/window, speed, gate/envelope, crossfade | Captured | Retain current block-relative slice count, speed, shape, and gate; capture at block start | First-repeat ambiguity, wrap clicks, stale audio, destructive retrigger |
| Pitch | Shift harmonic pitch without changing authored block rate | Semitones, grain size, jitter, spread, mix | Captured/streaming | Waveform-aligned complementary grains reading warm history; semitone snap with smooth aux path | Latency, transient smear, grain beating, phase resets |
| Comb | Repeated peaks/notches plus resonant material color | Tune/cutoff, polarity, mix; advanced feedback/decay/damping | Modulated delay/tail | Conventional neutral core plus an evidence-selected dispersive/vector extension | Feedback runaway, tuning error, mono cancellation, generic metallic sound |
| Ring | Multiply audio by an internal carrier | Frequency, waveform, bias/rectify, spread, mix | Gated | Phase-continuous carrier, documented stereo detune, and free LFO motion; tempo motion remains available through block Aux | Aliasing from carrier shapes, DC from bias, abrupt phase reset |
| Reverse | Play finite buffered sections backward | Window, sync/free, proportional crossfade, within-step decay, mix | Captured | Roll through already-recorded lookback sections at zero host latency; return dry at block exit; cap high-quality windows at four seconds | Unavailable history, wrong-region surprise, boundary pops, old audio after seek |
| Talk Box | Vowel-like formant coloration | Vowel selection/morph, Q, lows, highs | Gated | Two vowel endpoints plus morph; formant filter, not sidechain vocoder | Unstable high-Q filters, coefficient zippering, literal vowel mapping |
| Vibro | Periodic pitch wobble without dry-path combing | Sync/free rate, depth, waveform, spread | Modulated delay | Wet variable-delay modulation; no feedback; separate ID 10 | Interpolation noise, insufficient slow-rate history, mono loss, accidental chorus/flange identity |
| Flange | Short modulated delay mixed with dry for moving notches | Delay, depth, sync/free rate, feedback, spread, polarity, mix | Modulated delay | Separate ID 11; canonical equal direct/delayed target; Scroll omitted without a listening/CPU win | Feedback instability, comb cancellation, parameter zippering |
| Dirty | Character distortion distinct from digital Crush | Drive, type/character, bias, dynamics, tone, mix/trim | Gated | Soft, hard, fold, and asymmetric families behind one Character control; level-conscious output | Aliasing, DC, loudness bias, loss of dynamics |

## Settled lifecycle behavior

### Filter, Crush, Ring, Talk Box, Dirty

These are `gated`. Their internal smoothing remains warm, block entry and exit
use the common transition, and no audio tail persists after release. This keeps
their authored region literal.

### Tape Stop

Tape Stop is a bounded one-shot `gesture`; see the dedicated benchmark. Its
configured Stop/Start timing may outlive the triggering block.

### Stutter

Stutter is `captured`:

- block start captures the first block-relative slice;
- repeats start after that slice is captured, matching the existing tested
  contract rather than inventing unavailable future audio;
- a longer block changes repeat count, not the captured slice identity;
- a retrigger starts a new capture voice and crossfades from the previous one;
- authoritative resets clear the capture.

Reverse remains separate; alternating/reverse Stutter modes are omitted.

### Pitch

Pitch is a continuous captured-history reader with two complementary grains.
It does not report fixed host latency because it is active only on authored
blocks and cannot delay the entire dry signal selectively. The wet algorithmic
delay is displayed through `Grain` and documented; the rolling history is warm
before the block so the first grain is valid. Factory presets avoid a 50/50 dry
mix when the combing from wet delay is undesirable.

Production status: complete through measured DSP, sparse-v7 persistence,
sequenced source and packaged UI, lifecycle/reset proof, and four-chain bounds.
The normalized grain-birth waveform alignment and rejected blind-overlap
prototype are recorded in `pitch-decision.md`. Listening comparison and Ableton
timing remain release gates.

### Reverse

SeqFX chooses zero-added-host-latency lookback reversal:

- `Length` names an already-recorded section immediately behind the current
  read point;
- the first output at trigger is the newest sample of that lookback, then the
  head runs backward;
- a long active block rolls into fresh lookback sections rather than freezing
  and repeating its first source;
- cold start remains dry until one complete requested section exists;
- block exit returns dry through the common transition and has no tail;
- rolling boundaries and repeated triggers use two bounded crossfading voices
  rather than overwriting a live read head;
- `Decay` chooses how early within the authored block Reverse fades back to dry;
- sync lengths stop at 1/4 note plus 1 Cell and Free Length stops at 4000 ms,
  because the selected 48 kHz history cannot honestly retain longer windows at
  every tempo;
- fixed lookahead/capture-then-play is rejected because it would delay the whole
  plugin or make the first authored cell unexpectedly silent.

This source-region choice is a SeqFX product decision and must be written in the
inspector and user guide. Production evidence and rejected alternatives are in
`reverse-decision.md`.

### Comb, Vibro, Flange

These are warm delay-based processors. Comb may ring as a bounded tail when
feedback/decay calls for it; it stops accepting new input at release. Vibro and
Flange are gated but keep their modulation and delay state warm so entry does
not start from invalid memory. All reset on discontinuous host history.

## Parameter contracts

The public module owns these names, units, ranges, defaults, snapping, and aux
eligibility. Final numeric ranges may be tightened by stability/listening tests,
but they cannot drift independently across state, UI, and Cmajor.

### Filter (ID 1)

- Mode: Low Pass / Band Pass / High Pass / Notch, stepped, trigger-latched.
- Cutoff: 20 Hz–20 kHz, logarithmic, aux eligible.
- Resonance: 0.5–12 Q, logarithmic, aux eligible.
- Drive: 0–12 dB, aux eligible.

### Crush (ID 2)

- Bits: 2–16 bits, integer, aux eligible.
- Rate: 200 Hz–48 kHz display, logarithmic; runtime normalizes against sample
  rate instead of exposing an unexplained hold-frame count.
- Drive: 0–36 dB, aux eligible.
- Character: Original / Classic / Smooth / Progressive, stepped and
  trigger-latched.
- ADC Q: 0–100% pre-converter filtering, aux eligible.
- DAC Q: 0–100% post-converter reconstruction filtering, aux eligible.
- Dither: 0–100%, aux eligible.

`Original` preserves the shipped 48 kHz hold/clip/quantize/gain order exactly.
`Classic` uses the corrected drive order and a Rate in Hz. `Smooth` interpolates
captures. `Progressive` quantizes capture-to-capture differences and applies a
bounded DC blocker. Kilohearts' ADC Q/DAC Q vocabulary was selected instead of
an overlapping Tone control; the full source/inference split is recorded in
`crush-v2-decision.md`. The legacy hold-frame parameter migrates to
`48000 / holdFrames` and remains deterministic across save/reopen.

### Pitch (ID 5)

- Pitch: -24 to +24 semitones, semitone snap for direct edits, smooth aux.
- Fine: -100 to +100 cents.
- Grain: 10–120 ms, logarithmic.
- Jitter: 0–100% bounded timing/pitch variation.
- Spread: 0–100%, complementary left/right grain offset.

### Comb (ID 6)

- Tune: 30 Hz–8 kHz, logarithmic with note-name readout option.
- Decay: 20 ms–8 s; runtime derives a stable feedback coefficient.
- Polarity: positive/negative, stepped.
- Dispersion: neutral through selected advanced range.
- Damping: 500 Hz–20 kHz.
- Motion: 0–100% bounded delay modulation.
- Width: 0–100% with documented mono projection.
- Drive: 0–100% saturating feedback character.

Production status: implemented as the lab-selected vector-dispersive network
with a bit-exact conventional neutral at `Dispersion = 0`. Four normalized
cross-feedback paths, per-path allpass dispersion, deterministic motion,
frequency-dependent damping, mono-safe width, loop saturation, measured tuning
compensation, bounded tail lifecycle, and authoritative reset behavior are
covered by DSP and browser fixtures. Human listening and native-host CPU remain
release-phase gates; see `comb-lab-decision.md`.

### Ring (ID 7)

- Frequency: 0.1 Hz–12 kHz, logarithmic; optional musical snaps.
- Wave: Sine / Triangle / Square / Noise, trigger-latched.
- Motion: 0–100% LFO amount, reaching a one-octave exponential sweep.
- Rate: 0.02–20 Hz free-running. Tempo-synced modulation uses the shared Aux
  source rather than a second hidden Rate mode.
- Spread: 0–100% opposite carrier detune, reaching 25 cents per channel.
- Bias: -100–100%.
- Rectify: -100–100%.

Kilohearts directly establishes Frequency-as-noise-cutoff, additive Bias,
bipolar Rectify, and stereo Spread through small opposite frequency shifts.
Effectrix2 establishes internal Ring LFO Speed/Amount and a quality concern.
SeqFX's precise Spread and Motion depths are engineering inferences frozen in
`ring-decision.md`; they are not presented as competitor measurements.

### Reverse (ID 8)

- Length: 1/32 / 1/16 / 1/8 / 1/4 / 1 Cell in Sync mode.
- Crossfade: 0–25% of each reversed section, Aux eligible.
- Timing: Sync / Free, trigger-latched.
- Free Length: 20–4000 ms, trigger-latched.
- Decay: 0–100% of the authored block before Reverse has returned to dry, Aux
  eligible; 100% keeps Reverse active for the complete block.
- Playback speed is fixed at -1 so Reverse remains distinct from Pitch and
  Stutter.

### Talk Box (ID 9)

- From Vowel / To Vowel: A, E, I, O, U, stepped.
- Morph: 0–100%, log-frequency interpolation.
- Q: 1–20.
- Lows / Highs: 0–100% passthrough.
- Drive: 0–12 dB.

The vowel endpoints use Peterson-Barney adult-male F1/F2 means and are frozen
in `talk-box-decision.md`. SeqFX's 180 Hz/3 kHz passthrough crossovers, formant
make-up gain, and saturation are recorded engineering choices rather than
claims about Koala's private implementation.

### Vibro (ID 10)

- Rate: 0.05–12 Hz in Free mode.
- Depth: 0–100 cents, exact half peak-to-peak pitch span.
- Wave: Sine / Triangle.
- Spread: 0–180 degrees stereo phase.
- Timing: Sync / Free, trigger-latched.
- Division: 1/32 / 1/16 / 1/8 / 1/4 / 1/2 / 1 Bar,
  trigger-latched and used only in Sync mode.
- Production decision: 400 ms raw pre-effect history, analytic integrated
  Sine/Triangle Doppler trajectories, 25 ms continuous smoothing, 96-frame
  entry/exit/history/waveform crossfades, phase-continuous block triggers, and
  exact zero-Depth neutral. Drift was omitted because its conditional listening
  gate had no evidence. See `vibro-decision.md`.
- Implementation status: complete through DSP, sequenced UI/state, source
  browser proof, and packaged-bundle proof; subjective/release gates remain in
  the shared roadmap.

### Flange (ID 11)

- Delay: 0.2–10 ms, the minimum delay.
- Depth: 0–10 ms.
- Rate: 0.02–10 Hz in Free mode.
- Feedback: 0–95% magnitude, runtime hard-clamped.
- Spread: 0–180 degrees.
- Polarity: Normal/Inverse feedback, trigger-latched.
- Timing: Sync/Free, trigger-latched.
- Division: 1/16 / 1/8 / 1/4 / 1/2 / 1 Bar / 2 Bars / 4 Bars,
  trigger-latched and used only in Sync mode.
- Production decision: 25 ms host-rate feedback history, qualified four-point
  Hermite reads, canonical 0.5 direct/delayed target, literal minimum-plus-depth
  motion, 25 ms continuous smoothing, 96-frame entry/exit/polarity/history
  transitions, phase-continuous triggers, bounded feedback writes, and no
  output tail. Optional Scroll/barber-pole mode was omitted because its
  conditional listening/CPU gate had no evidence. See `flange-decision.md`.
- Implementation status: complete through DSP, sequenced UI/state, source
  browser proof, and packaged-bundle proof; subjective/release gates remain in
  the shared roadmap.

### Dirty (ID 12)

- Drive: 0–36 dB.
- Character: Soft / Hard / Fold / Bias, trigger-latched.
- Bias: -100–100%.
- Dynamics: 0–100% input-envelope preservation.
- Tone: 500 Hz–20 kHz.
- Trim: -18–6 dB.
- Production decision: fixed 4x nonlinear core, 2 ms Character crossfade,
  10 Hz post-residue DC blocker, 10 ms bounded dynamics compensation, and
  residue-only Tone filtering. See `dirty-decision.md` for documented facts,
  engineering choices, and measured alias evidence.
- Implementation status: complete through DSP, sequenced UI/state, source
  browser proof, and packaged-bundle proof; subjective/release gates remain in
  the shared roadmap.

## Copy, adapt, omit

- Copy established literal vocabulary such as semitones, grain size, bits,
  rate, polarity, vowel, Q, feedback, and crossfade.
- Adapt live/touch effects into deterministic block triggers and tails.
- Omit Koala scenes/XY/hold, sidechain Ring input, Talk Box vocoding, reverse
  future-lookahead, Stutter reverse modes, and Flange barber-pole mode from the
  first complete implementation.
- Keep every parameter modulation-safe only when the DSP can smooth or latch it
  honestly. A visible control is not automatically aux eligible.

## Required fixtures by effect

Every effect receives silence/finite, impulse, sine, stereo/mono, hard
entry/exit, aux sweep, reset, state round-trip, and selected-inspector tests.
Effect-specific oracles add:

- Crush: quantization levels and effective sample rate;
- Pitch: measured frequency ratio and grain latency;
- Comb: tuning, decay, mono collapse, and stability;
- Ring: analytic sine sidebands;
- Stutter: captured slice identity and repeat boundary;
- Reverse: numbered impulse/spoken-region order;
- Talk Box: formant peak locations and smooth morph;
- Vibro: modulation rate/depth;
- Flange: notch motion and feedback decay;
- Dirty: transfer curves, DC, alias screen, and matched-level output.
