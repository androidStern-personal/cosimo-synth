# Ableton Drum Buss Reverse Engineering Plan

This document is the current plan for reverse engineering Ableton Live's built-in
Drum Buss audio effect by black-box measurement. "Drum Buss" is Ableton's device
name. The user sometimes calls it "Drum Bus"; this plan refers to the Ableton
device as `Drum Buss`.

The goal is not to decompile Ableton Live, extract proprietary code, or copy a
binary implementation. The goal is to build a behavioral model from measured
input/output pairs: send known signals through Drum Buss, measure the result,
hypothesize a signal-flow model, implement the candidate, null-test it against
Ableton's output, and repeat.

## Summary

The project has three locked ideas:

1. Drum Buss reverse engineering is a measurement problem.
2. Ableton Live must be the reference host because Drum Buss is not exposed as a
   normal VST3, AU, or Max for Live device bundle.
3. The research loop should borrow the high-level structure of
   `karpathy/autoresearch`: freeze the measurement harness, modify only the
   candidate hypothesis/model, run fixed experiments, log results, and keep only
   changes that improve held-out measurements or simplify the model without
   making the fit worse.

The most important measurement rule is that the repeatability floor comes
first. If two identical Ableton captures only null to `-45 dB`, then a claimed
`-60 dB` candidate null is not meaningful in that capture configuration. The
harness must measure its own floor before any absolute null target is treated as
a goal.

The intended harness is:

```text
Python research driver
  -> AbletonOSC / Live API for Live control and Drum Buss parameters
  -> ProbeSource.amxd for deterministic probe playback inside Live
  -> Ableton Drum Buss as the closed reference device
  -> ProbeRecorder.amxd for post-Drum-Buss WAV capture
  -> Python analysis pipeline for alignment, scoring, plots, and residual audio
```

The Live track under test should be:

```text
ProbeSource.amxd -> Drum Buss -> ProbeRecorder.amxd
```

Once the Live template and remote control path are configured, the Python driver
should be able to run repeated measurement trials without the user manually
clicking Live's export dialog or changing device parameters.

## Current Facts And Assumptions

### Local Ableton Fact

On this machine, Ableton Live is installed as:

```text
/Applications/Ableton Live 11 Suite.app
```

Drum Buss exists locally as Ableton Core Library device presets:

```text
/Applications/Ableton Live 11 Suite.app/Contents/App-Resources/Core Library/Devices/Audio Effects/Drum Buss
```

Those presets are `.adv` files. They are gzip-compressed XML preset files, not
external plugin binaries. A local inspection found no Drum Buss `.vst`, `.vst3`,
`.component`, or `.amxd` bundle that can be loaded in another host.

That matters because the reference path must run inside Ableton Live. We should
not plan around loading Drum Buss in a standalone plugin host.

### Preset-State Fact

Expanding a Drum Buss `.adv` preset exposes a `<DrumBuss>` XML block. One local
preset contained these parameter/state keys:

```text
On
EnableCompression
DriveAmount
DriveType
CrunchAmount
DampingFrequency
TransientShaping
BoomFrequency
BoomAmount
BoomDecay
BoomAudition
InputTrim
OutputGain
DryWet
```

The `.adv` XML gives useful internal names and ranges, but runtime automation
should still use Live's exposed device parameter list because Live parameter
names, ordering, quantization, and value strings are the real control surface
for the harness.

### Public Description Fact

Ableton's manual describes the main Drum Buss sections in enough detail to seed
the first hypotheses:

- `Drive` is a distortion/saturation stage.
- `Crunch` is a distortion focused around a midrange band, publicly described
  around roughly 3 kHz.
- `Damp` is a high-frequency damping control, likely a lowpass or tilt-style
  filter stage.
- `Transients` changes attack/sustain character.
- `Boom` adds a low-frequency resonant component triggered by input events.
- Drum Buss also has compression-related behavior that must not be ignored.

Those public descriptions are not a solution. They are a block-diagram sketch
that tells us which measurements to run first.

### Harness Assumption

The most reliable harness should avoid Live's GUI export path. Ableton's export
flow is designed for a user-facing dialog. A GUI automation loop using
AppleScript/System Events would be slower and more brittle than an in-set
recorder.

Max for Live audio devices can receive and emit track audio. Max's `sfrecord~`
can write audio to disk. Therefore the planned recorder should be a small Max
for Live audio effect after Drum Buss that writes exactly the post-device signal
to a file path chosen by the Python driver.

## Non-Goals

This plan does not include:

- Decompiling Ableton Live or disassembling Drum Buss.
- Extracting or redistributing Ableton proprietary code.
- Building a pixel-identical Ableton UI.
- Claiming exact parity from one probe type.
- Optimizing the clone before the block diagram is measured.
- Treating a single null-test number as proof when held-out probes fail.

## Research Architecture

### Components

`Python research driver` is the orchestrator. It creates probe definitions,
sends commands to Live, receives completion signals, loads WAV output, aligns
signals, scores candidate models, writes trial metadata, and decides whether a
hypothesis advanced.

`AbletonOSC` is the planned remote-control layer. It is a Live remote script
that exposes much of the Live Object Model over OSC. For this project it should
be used to:

- Query Live version and session state.
- Select the harness track.
- Query the Drum Buss device name, class name, parameter names, parameter
  values, parameter minimums, parameter maximums, and parameter quantization.
- Set Drum Buss parameter values before each capture.
- Start and stop playback when the M4L source/recorder need Live transport.

`ProbeSource.amxd` is a planned Max for Live audio effect placed before Drum
Buss. It should produce deterministic test signals inside Live. It may either
play a WAV generated by Python or synthesize a probe from a compact command.
The initial implementation should prefer WAV playback plus a JSON sidecar
because it keeps probe generation in Python, where `numpy` and `scipy` are
better tools.

`Drum Buss` is Ableton's closed built-in reference effect.

`ProbeRecorder.amxd` is a planned Max for Live audio effect placed after Drum
Buss. It should write a float WAV file to a unique trial path and signal
completion to the Python driver.

`Candidate model` is our implementation hypothesis. It may start as a Python
reference model before being ported to Cmajor or another real-time DSP target.
The model is the mutable research surface.

`Analysis pipeline` aligns input and output, estimates latency and gain,
computes spectra/envelopes/harmonics, compares Ableton output to the candidate
model, generates residual audio, and writes metrics.

### Data Flow

```text
1. Python creates probe WAV and trial metadata.
2. Python sets Drum Buss parameters through AbletonOSC.
3. Python tells ProbeSource.amxd which probe to play.
4. Python tells ProbeRecorder.amxd where to record.
5. Live plays the probe through:
   ProbeSource.amxd -> Drum Buss -> ProbeRecorder.amxd.
6. ProbeRecorder.amxd writes the output WAV and signals done.
7. Python loads input and output WAVs.
8. Python aligns the signals sample-accurately.
9. Python scores the measured Ableton output.
10. Python runs the same input through the candidate model.
11. Python scores the candidate output against the Ableton output.
12. Python writes analysis files, residual audio, plots, and a results ledger.
```

### Why Not Offline Export

Live's audio export is a human workflow. It can probably be automated with
AppleScript, but that would make every trial depend on focus state, dialog
layout, file picker behavior, and export settings. A Max for Live recorder keeps
the capture path inside the Live set and gives the Python driver explicit file
paths and completion signals.

The tradeoff is that the harness runs in real time. That is acceptable because
measurement repeatability is more important than export speed. Later, if a
reliable non-GUI render path is discovered, it can be tested against the M4L
recorder by nulling identical captures.

## One-Time Harness Setup

The following setup should happen once before autonomous experiments begin.

### 1. Install And Enable AbletonOSC

Install the `AbletonOSC` remote script in Live's user remote script folder and
enable it in Live's MIDI preferences.

Expected macOS user script location from AbletonOSC documentation:

```text
~/Music/Ableton/User Library/Remote Scripts/AbletonOSC
```

Live should show that AbletonOSC is listening, typically on OSC port `11000`
with replies on `11001`.

### 2. Create The Harness Live Set

Create a minimal Ableton Live set with one audio track named exactly:

```text
Drum Buss Harness
```

The device chain should be:

```text
ProbeSource.amxd
Drum Buss
ProbeRecorder.amxd
```

Disable unrelated devices, sends, returns, warping, automation, grooves,
sidechains, and master effects. The master channel should be neutral.

### 3. Lock Audio Preferences For A Capture Batch

For each capture batch, record these values in metadata:

```text
Ableton Live version
macOS version
audio device
sample rate
buffer size
tempo
track gain
master gain
Drum Buss parameter names and values
probe corpus version
```

The initial sample rate should be either `44100` or `48000` Hz. Oversampling and
aliasing tests should later repeat at multiple sample rates, but the first
modeling pass should not mix sample rates.

### 4. Smoke-Test Remote Control

Before measuring Drum Buss, verify that Python can:

- Query Live version.
- Find the `Drum Buss Harness` track.
- Find the Drum Buss device on that track.
- Query all Drum Buss parameter names, values, min values, max values, and
  quantization flags.
- Set one harmless parameter and read it back.
- Restore the original parameter value.

### 5. Smoke-Test Recorder Transparency

Before measuring Drum Buss, bypass or remove Drum Buss and record:

- Silence.
- A full-scale-safe sine, for example `-18 dBFS`.
- An impulse.
- A low-amplitude exponential sweep.

The source and recorder path should null against the original probe except for
known latency and expected floating-point error. If the recorder path colors the
signal, the harness is not ready.

### 6. Smoke-Test Drum Buss Repeatability

With Drum Buss enabled and settings fixed, record the same probe twice. The two
Ableton outputs should null extremely well after alignment. If repeated captures
do not null, the harness must identify why before model fitting begins.

This smoke test defines the repeatability floor for that Live version, sample
rate, buffer size, probe corpus, and Drum Buss setting. Store the floor as a
metric, for example:

```text
repeatability_floor_db = rms_db(ableton_capture_a - ableton_capture_b,
                                reference=ableton_capture_a)
```

All later null-test goals are relative to this floor. A candidate that reaches
within `6 dB` to `10 dB` of the measured floor is already near the practical
limit for that configuration. A candidate score below the floor should be
treated as measurement noise or a scoring bug unless repeated captures prove a
lower floor.

Possible causes:

- Live transport starts at slightly different positions.
- ProbeSource playback is not sample-aligned.
- ProbeRecorder starts too early or too late.
- Drum Buss has randomized or stateful behavior.
- Previous probe tail is still ringing, especially with Boom.
- The M4L recorder writes with a fade, dither, or format conversion.

## Probe Corpus

The probe corpus is the fixed set of test signals. It should be versioned. Each
probe WAV should have a sidecar describing sample rate, channel count, exact
segment boundaries, intended use, amplitude, and expected analysis method.

### Fit And Holdout Split

Every probe type should have two groups:

`fit` probes are allowed to guide parameter fitting.

`holdout` probes are not used during fitting. They are used to decide whether a
hypothesis really generalized.

No hypothesis should be accepted only because it improves `fit` probes.

The holdout set must be locked on day one for a given probe corpus version.
Adding new holdout probes later is allowed only by creating a new corpus
version, for example `v002`. Scores from `v001` and `v002` are not directly
comparable unless the old accepted models are rerun against `v002`.

### General Probe Conventions

Initial probe files should use:

```text
format: WAV
sample format: 32-bit float if the recorder supports it
channels: mono and stereo variants where relevant
sync click: one broadband click at the start of every capture
post-click settling gap: enough silence to let compression and Boom recover
head silence: enough to catch latency and pre-ringing
tail silence: enough to catch release tails and Boom decay
nominal amplitude: conservative, usually -18 dBFS unless testing level
segment gaps: enough silence to isolate nonlinear memory and release behavior
```

Long batched probes are preferred over thousands of short captures. For
example, a single WAV can contain multiple sine bursts separated by silence,
with a sidecar JSON file giving segment labels and sample ranges.

The sync click exists only for alignment. It must be excluded from all subsystem
scoring windows. Because a click can trigger Boom and compression, every probe
must include a fixed settling gap after the click before the first scored
segment starts.

### Linear Probes

These are for low-level behavior where saturation, compression, and transient
processing should be minimized.

Use:

- Impulses.
- Exponential sine sweeps.
- Low-amplitude white or pink noise.
- Stepped sine tones.

Measure:

- Magnitude response.
- Phase response.
- Group delay.
- Latency.
- Minimum-phase vs linear-phase clues.
- Filter order and topology clues.

Target subsystems:

- `Damp`.
- Crunch bandpass pre/post filtering at low distortion amounts.
- Any input/output filtering around Drive.
- Dry/wet summing latency.

### Nonlinear Static Probes

These characterize saturation and distortion curves.

Use:

- Single sine waves at multiple frequencies.
- Amplitude sweeps from very low level to near clipping.
- DC-offset sine waves if Drum Buss accepts and preserves enough low-frequency
  content for asymmetry testing.
- Two-tone intermodulation probes.

Measure:

- Harmonic magnitudes and phases.
- Odd vs even harmonic balance.
- Intermodulation products.
- Level-dependent gain.
- Whether the curve is memoryless or frequency-dependent.

Candidate curves:

- `tanh(kx)`.
- `atan(kx)`.
- `x / (1 + |x|)`.
- Polynomial soft clipping.
- Chebyshev-shaped harmonic generation.
- Piecewise soft/hard clipping.
- Asymmetric waveshaping.

Target subsystems:

- `DriveAmount`.
- `DriveType`.
- `CrunchAmount`.

### Aliasing And Oversampling Probes

These test whether Drum Buss oversamples its nonlinear stages and what the
anti-aliasing filters look like.

Use:

- High-frequency sine waves near `0.25 * sample_rate` and above.
- High-frequency two-tone probes.
- Drive and Crunch at multiple strengths.
- Captures at more than one Live sample rate.

Measure:

- Folded alias components.
- Alias energy relative to harmonic energy.
- Whether alias patterns move as expected when sample rate changes.
- Whether the anti-alias filter looks like a gentle IIR, FIR, polyphase FIR, or
  something else.

Interpretation:

- A non-oversampled saturator aliases strongly.
- A 2x oversampled saturator has a different alias fingerprint.
- A 4x or 8x oversampled saturator suppresses more folded energy and may leave
  clues about filter steepness.

### Dynamic Probes

These characterize compression, transient shaping, envelope followers, and
lookahead.

Use:

- Tone bursts with controlled attack/release.
- Step-level sine waves.
- Click trains.
- Isolated impulses at varied spacing.
- Repeating kick/snare-like pulses.
- Stereo probes where left and right levels differ.

Measure:

- Attack time.
- Release time.
- Hold behavior.
- Ratio.
- Knee.
- Lookahead/group delay.
- Stereo linking.
- Whether envelope detection is peak, RMS, rectified average, or hybrid.

Target subsystems:

- `TransientShaping`.
- `EnableCompression`.
- `InputTrim`.
- Any compressor behavior that remains relevant at neutral-looking settings.

### Boom Probes

Boom is likely the least linear and most stateful section, so it needs focused
tests.

Use:

- Single impulses.
- Synthetic kick attacks.
- Clicks with varied amplitude.
- Clicks with varied spacing.
- Low-frequency sine bursts.
- Real kick one-shots.
- Silence after each trigger long enough to capture full decay.

Measure:

- Ring frequency vs `BoomFrequency`.
- Decay time vs `BoomDecay`.
- Output amplitude vs input amplitude.
- Trigger threshold.
- Trigger retrigger behavior.
- Whether trigger detection uses broadband input, low-passed input, transient
  energy, envelope slope, or another detector.
- Whether the resonator starts at a fixed phase or phase depends on input.
- Whether Boom is mixed before or after compression, Drive, Damp, and Dry/Wet.

Candidate models:

- Damped sine oscillator triggered by transient detector.
- Resonant biquad excited by an impulse/envelope.
- Filtered low-frequency copy of input plus nonlinear envelope shaping.
- Hybrid trigger plus resonator.

### Real-World Holdout Probes

Synthetic probes identify subsystems. Real-world probes catch models that only
fit laboratory signals.

Use short, licensed or self-generated loops:

- Dry kick.
- Dry snare.
- Full drum loop.
- Sparse kick/snare pattern.
- Dense cymbal-heavy loop.
- Percussion with strong transient variation.

These should be holdout-first. They should not drive early curve fitting.

## Baseline Capture Matrix

The first serious measurement batch should capture a baseline matrix. The goal
is not complete parameter coverage. The goal is to isolate the main blocks
enough to start modeling.

### Global Neutral Baseline

Capture with:

```text
Drum Buss On: true
DryWet: 1.0
InputTrim: neutral value as exposed by Live
OutputGain: neutral value as exposed by Live
DriveAmount: 0
CrunchAmount: 0
DampingFrequency: maximum or neutral-bright value
TransientShaping: 0
BoomAmount: 0
EnableCompression: false if exposed and controllable, but do not assume this
  fully removes compression
```

Then repeat with `DryWet: 0` to verify dry path latency and gain.

Until measurements prove otherwise, assume Drum Buss still contains always-on
dynamic behavior. Isolate Drive, Crunch, and Damp with low-level probes that
stay below any compressor or transient-shaper threshold. Treat
`EnableCompression` as an exposed control, not as proof that all compression is
disabled.

### Drive Matrix

Vary:

```text
DriveAmount: low, medium, high, maximum
DriveType: every exposed value
```

Hold the other sections neutral.

Treat each `DriveType` as an independent waveshaper family until measurements
prove that a shared parameterized family explains all modes. Do not force one
curve formula to cover every DriveType early in the project.

Probe with:

- Sine amplitude sweeps.
- Multi-frequency sine set.
- Two-tone intermodulation.
- Aliasing tones.

### Crunch Matrix

Vary:

```text
CrunchAmount: low, medium, high, maximum
```

Hold the other sections neutral.

Probe with:

- Low-amplitude sweep to estimate bandpass shape.
- Sine amplitude sweeps near and away from the expected crunch band.
- Two-tone probes around the expected crunch band.

### Damp Matrix

Vary:

```text
DampingFrequency: several logarithmic points from minimum to maximum
```

Hold the other sections neutral and levels low.

Probe with:

- Low-level exponential sweeps.
- Impulses.
- Low-level noise.

### Transients Matrix

Vary:

```text
TransientShaping: negative, zero, positive values
```

Hold the other sections neutral.

Probe with:

- Clicks.
- Tone bursts.
- Kick/snare one-shots.
- Click trains with varied spacing.

### Boom Matrix

Vary:

```text
BoomAmount: low, medium, high
BoomFrequency: representative frequencies across exposed range
BoomDecay: short, medium, long
BoomAudition: false for normal mix, true only when deliberately measuring audition behavior
```

Hold the other sections neutral where possible.

Probe with:

- Clicks.
- Synthetic kicks.
- Isolated kick samples.
- Silence tails long enough to capture decay.

### Compression Matrix

Vary:

```text
EnableCompression: false and true if exposed, without assuming false is a full
  bypass of compression
InputTrim: several values
```

Hold the other sections neutral.

Probe with:

- Step-level sine waves.
- Tone bursts.
- Drum one-shots.
- Stereo probes to test linking.

The user plan specifically warns not to skip compression. The harness should
verify whether Trim or compression state changes the signal even when other
controls appear neutral.

## Analysis Pipeline

### Alignment

Every output should be aligned to the input or candidate output before scoring.
Do not rely on Live transport timing being sample-accurate.

Initial alignment method:

1. Cross-correlate on the required start-of-capture sync click.
2. Confirm the post-click settling gap is long enough that the click did not
   contaminate the first scored segment.
3. Fine fractional-delay estimation if residuals suggest sub-sample offset.
4. Store measured latency in trial metadata.
5. Apply the same alignment procedure to Ableton output and candidate output.

Do not hide real lookahead or filter phase by overfitting alignment per segment.
Alignment policy should be fixed per trial or per device setting.

### Level Calibration

Before model comparison, record:

- Input peak and RMS.
- Output peak and RMS.
- Any fitted global gain used only for analysis.

Global gain fitting can be useful for diagnosing, but the model itself should
eventually account for gain. A "good" result that depends on arbitrary
post-hoc gain normalization is not final parity.

### Linear Analysis

For sweeps and impulses:

- Estimate impulse response.
- Compute magnitude response.
- Compute phase response.
- Compute group delay.
- Fit candidate filters.
- Compare filter topology clues.

Keep separate metrics for magnitude and phase. Matching magnitude while phase
is wrong is not a complete model.

### Nonlinear Analysis

For tones and amplitude sweeps:

- Compute harmonic spectra.
- Track harmonic magnitudes vs input level.
- Track even/odd balance.
- Track intermodulation products.
- Compare alias products.
- Fit static waveshaper candidates only after accounting for pre/post filters.

The likely order is:

```text
estimate surrounding filters -> estimate waveshaper curve -> test full block
```

Trying to fit a waveshaper before removing its surrounding EQ can create a
misleading curve.

For Drive and Crunch, fit filters at low drive/amount first, then freeze those
filter candidates before fitting the high-drive nonlinear curve. Co-fitting the
filters and waveshaper from high-drive data is underdetermined and can produce
models that match one probe while failing the next.

### Dynamic Analysis

For bursts and steps:

- Extract amplitude envelopes.
- Estimate attack and release constants.
- Estimate threshold and knee.
- Detect lookahead.
- Test stereo linking.
- Compare gain-reduction timing against candidate envelope followers.

Transient processing and compression should be scored with time-domain envelope
metrics as well as broadband null tests.

### Boom Analysis

For Boom:

- Estimate fundamental ring frequency from the tail.
- Estimate decay constant from the amplitude envelope.
- Estimate trigger time relative to input transient.
- Estimate output phase at trigger.
- Test retrigger behavior.
- Compare ring amplitude to input amplitude and input spectral content.

Boom should be analyzed with isolated long-tail probes before it is tested in a
full drum loop.

### Null Tests

The core parity test is:

```text
residual = ableton_output - candidate_output
```

After alignment and model-owned gain matching, compute:

- Residual RMS.
- Residual peak.
- Residual spectrum.
- Residual envelope.
- Segment-level residuals.

Staged null goals:

```text
-20 dB residual: coarse block behavior is probably in the right family
-40 dB residual: subsystem model is becoming useful
-60 dB residual: strong isolated-subsystem match
```

These are only nominal labels. The actual target is the gap above the measured
repeatability floor:

```text
floor_gap_db = candidate_residual_db - repeatability_floor_db
```

For example, if identical Ableton captures null at `-45 dB`, then a `-60 dB`
target is below the measurement floor and should not be used. In that case,
getting the candidate to `-35 dB` is `10 dB` above the floor and may be a strong
result for that configuration. Nonlinear and stateful sections may need
different thresholds, but every threshold must be interpreted relative to the
floor.

## Candidate Model Strategy

### Start In Python

The first candidate models should be Python reference models because Python is
faster for fitting and plotting. Cmajor or plugin implementation should come
after the model has survived enough measurement.

Use Python for:

- Filter fitting.
- Curve fitting.
- Envelope fitting.
- Residual analysis.
- Batch experiment scoring.

Port to Cmajor only when the block diagram and parameter mapping are stable
enough to justify real-time implementation work.

### Keep The Block Diagram Explicit

Every accepted candidate should state:

```text
block order
parameter mapping
sample-rate dependencies
oversampling assumptions
latency
state variables
initial conditions
dry/wet position
gain staging
```

Example:

```text
InputTrim -> Drive prefilter -> oversampled waveshaper -> Drive postfilter
-> Crunch bandpass distortion -> Transient VCA -> Boom mix -> Damp lowpass
-> Compressor -> DryWet -> OutputGain
```

That example is not assumed correct. It shows the level of explicitness needed.

### Subsystem Order

Recommended modeling order:

1. Harness transparency and repeatability.
2. Dry/wet, input trim, output gain, bypass, and latency.
3. Damp linear filter behavior.
4. Drive static and filtered nonlinear behavior.
5. Crunch band-limited nonlinear behavior.
6. Transient shaping.
7. Compression.
8. Boom resonator and trigger.
9. Full block ordering.
10. Full preset and real-drum holdout tests.

The order starts with the most measurable linear pieces and ends with the most
stateful pieces.

## Subsystem Research Plans

### Damp

Question:

```text
What filter does DampingFrequency control, and where is it in the signal chain?
```

Measurements:

- Low-level sweeps at multiple `DampingFrequency` values.
- Impulses at the same values.
- Phase and group delay comparisons.

Hypotheses:

- One-pole lowpass.
- Biquad lowpass.
- Biquad stack.
- Shelving or tilt filter.
- Minimum-phase filter with parameter smoothing.

Acceptance:

- Magnitude response matches across the full knob range.
- Phase/group delay are close enough to explain null residuals.
- Same model works on held-out noise and low-level drum probes.

### Drive

Question:

```text
What waveshaper family, filtering, oversampling, and gain mapping does Drive use?
```

Measurements:

- Sine amplitude sweeps at several frequencies.
- Drive amount sweeps.
- Every exposed DriveType value.
- Aliasing tones at multiple sample rates.
- Two-tone intermodulation.

Hypotheses:

- Static symmetric waveshaper plus pre/post gain for one DriveType.
- Asymmetric waveshaper for one DriveType.
- Saturator with frequency-shaped pre-emphasis and de-emphasis for one
  DriveType.
- Oversampled nonlinear stage for one DriveType.
- DriveType changes curve family, filter/gain staging, or oversampling
  behavior.

Acceptance:

- Harmonic levels match across input levels.
- Alias fingerprint is explained.
- Candidate works at multiple sine frequencies, not just one.
- Held-out two-tone and drum hits improve.
- Each DriveType stands on its own before any shared-family simplification is
  accepted.

### Crunch

Question:

```text
Is Crunch a bandpassed distortion block around the public midrange focus, and
what filters and curve does it use?
```

Measurements:

- Low-level sweeps with Crunch at low values.
- Sine sweeps through frequencies around and away from the expected band.
- Harmonic and intermodulation analysis.
- Interaction tests with Damp and Drive disabled.

Hypotheses:

- Bandpass -> waveshaper -> mix back.
- Waveshaper with bandpass sidechain.
- Parallel band-limited saturation.
- Fixed center frequency with variable amount.
- Amount-dependent bandwidth or gain.

Acceptance:

- Band focus and phase are explained.
- Harmonic products match near the band and outside it.
- Parallel/series placement is proven by null tests.

### Transients

Question:

```text
Does TransientShaping use fast/slow envelope difference to modulate a VCA, and
how are attack and sustain mapped?
```

Measurements:

- Clicks.
- Tone bursts.
- Repeating pulses at varied spacing.
- Positive and negative TransientShaping values.
- Stereo asymmetry probes.

Hypotheses:

- Fast envelope minus slow envelope.
- Attack/sustain split similar to SPL-style transient designers.
- Frequency-weighted transient detector.
- Program-dependent release.

Acceptance:

- Attack boost/cut timing matches.
- Sustain behavior matches on tails.
- Repeated hits with incomplete release match.
- Held-out drum hits improve.

### Compression

Question:

```text
What compressor behavior exists, and how does InputTrim interact with it?
```

Measurements:

- EnableCompression false/true if exposed, but treat false as "less or
  different compression" until measurements prove full bypass.
- InputTrim sweeps.
- Step-level sine probes.
- Tone bursts.
- Stereo-link probes.
- Drum loops with consistent peaks.

Hypotheses:

- Always-on compressor with an exposed mode/amount/on switch.
- Fixed-ratio compressor enabled by a UI control, if measurements prove a full
  bypass exists.
- InputTrim drives detector and/or pre-gain.
- Soft knee.
- Peak, RMS, or hybrid detector.
- Stereo-linked gain reduction.
- Lookahead.

Acceptance:

- Threshold, ratio, attack, release, knee, and linking are explained.
- Trim behavior is explained as gain staging or detector drive.
- Compressor model improves both synthetic bursts and drum holdouts.

### Boom

Question:

```text
Is Boom a triggered resonator, and what controls trigger, pitch, decay, phase,
and mix?
```

Measurements:

- Impulses and clicks at varied levels.
- Kick-like transients.
- Trigger spacing tests.
- BoomFrequency sweeps.
- BoomDecay sweeps.
- BoomAmount sweeps.
- BoomAudition comparison.

Hypotheses:

- Damped sine oscillator triggered by transient detector.
- Resonant biquad excited by input transient.
- Envelope follower drives oscillator amplitude.
- Trigger threshold and retrigger suppression.
- Fixed or input-dependent phase reset.

Acceptance:

- Frequency mapping matches.
- Decay mapping matches.
- Trigger threshold and retrigger behavior match.
- Ring phase and amplitude are close enough to reduce residuals on kicks.
- Holdout kick samples improve.

### Dry/Wet And Gain Staging

Question:

```text
Where are DryWet, InputTrim, and OutputGain located relative to nonlinear,
dynamic, and Boom blocks?
```

Measurements:

- DryWet 0, 0.25, 0.5, 0.75, 1.0.
- InputTrim sweeps with Drive/Crunch/Compression active and inactive.
- OutputGain sweeps.
- Null tests of parallel dry/wet assumptions.

Hypotheses:

- Dry path is truly unprocessed and latency-compensated.
- Dry path includes InputTrim.
- Dry path excludes InputTrim.
- OutputGain after dry/wet.
- Boom included or excluded from dry/wet mix.

Acceptance:

- DryWet interpolation nulls across multiple settings.
- Gain staging explains nonlinear level changes.
- Latency compensation is consistent.

## Autoresearch-Derived Operating Procedure

The useful idea from `karpathy/autoresearch` is not the LLM training code. It is
the research discipline:

```text
fixed data/eval harness
one mutable experiment surface
baseline first
fixed run budget
single scoreboard
append-only result ledger
keep/discard/crash verdicts
simplicity criterion
autonomous loop after setup
```

For this project, the mapping is:

```text
autoresearch prepare.py   -> frozen Drum Buss measurement harness and probe corpus
autoresearch train.py     -> mutable candidate Drum Buss model/hypothesis
autoresearch program.md   -> this operating procedure
autoresearch val_bpb      -> Drum Buss parity metrics and held-out null score
autoresearch results.tsv  -> Drum Buss experiment ledger
```

### Frozen Files And Mutable Files

Once implemented and calibrated, these should be treated as frozen during model
iteration:

```text
Probe generation definitions
Probe corpus files
Ableton Live harness template
ProbeSource.amxd behavior
ProbeRecorder.amxd behavior
Alignment policy
Scoring policy
Fit/holdout split
Repeatability floor measurement method
```

The mutable surface is the candidate model:

```text
Block diagram
Filter equations
Waveshaper equations
Envelope detector equations
Parameter mappings
Oversampling assumptions
State initialization
```

If the harness itself must change, that is a harness revision, not a model
experiment. Harness revisions require rerunning baseline captures because old
scores may no longer be comparable.

If the holdout set changes, that is also a probe corpus revision. Do not append
new holdouts to the current corpus and compare the resulting scores to older
runs as if nothing changed.

### Baseline First

The first serious run after harness validation should not change the candidate
model. It should capture and score the reference dataset so future experiments
have a stable baseline.

Baseline outputs should include:

```text
Ableton raw captures
candidate passthrough captures if the model is empty
alignment metrics
repeatability metrics
repeatability floor in dB for each baseline setting
initial residuals
```

### Fixed Experiment Budget

Each model experiment should declare its budget before running. Budget means:

- Which probe corpus version.
- Which Drum Buss settings.
- Which fit probes.
- Which holdout probes.
- Which metrics.
- Maximum run time before the trial is marked failed.

Unlike autoresearch, the budget does not have to be exactly five minutes. It
does have to be fixed per experiment class so runs are comparable.

### Results Ledger

Use a tab-separated results ledger, not CSV. Descriptions will contain commas.

Suggested columns:

```text
run_id
timestamp
model_id
probe_corpus
live_version
sample_rate
subsystem
fit_null_db
holdout_null_db
key_metric
status
description
```

Allowed statuses:

```text
keep
discard
crash
inconclusive
```

Definitions:

`keep` means the model improved held-out measurements or simplified the model
without worsening important metrics.

`discard` means the model failed to improve held-out measurements, overfit the
fit probes, or added complexity for a negligible gain.

`crash` means the experiment did not produce valid output because Live, the
harness, or the candidate model failed.

`inconclusive` means the probe or metric was insufficient to distinguish
hypotheses.

### Keep/Discard Rules

Keep a change if:

- Held-out null score improves meaningfully.
- A subsystem-specific metric improves and held-out null does not regress.
- The model becomes simpler and metrics stay effectively the same.
- A previously unexplained residual pattern is explained by a testable model.

Discard a change if:

- It only improves fit probes.
- It depends on arbitrary post-hoc gain or phase correction not owned by the
  model.
- It adds special cases for one probe without a physical/DSP explanation.
- It makes real drum holdouts worse while improving a synthetic probe.
- It changes the harness to make the score better.

Mark inconclusive if:

- The probe cannot isolate the target subsystem.
- Drum Buss state from a previous probe contaminated the output.
- Repeated Ableton captures do not null.
- Two different simple hypotheses score too closely to separate.

### Simplicity Criterion

All else being equal, the simpler model wins.

Examples:

- A one-pole lowpass that matches Damp within the measurement error is better
  than a six-biquad fit with tiny extra improvement.
- A static `tanh` waveshaper plus one prefilter is better than a high-order
  polynomial that only fits one sine frequency.
- A fixed damped sine Boom oscillator is better than a complex resonator bank
  unless the residual proves the extra machinery is needed.

### Autonomous Loop

After the harness is working and the user has approved autonomous iteration,
the loop should be:

```text
1. Read the current results ledger and best accepted model.
2. Choose exactly one hypothesis to test.
3. Write the hypothesis in the trial metadata before fitting.
4. Run the fixed probe set for that experiment class.
5. Fit or adjust the candidate model.
6. Score fit and holdout probes.
7. Save residual audio and plots.
8. Record the ledger row.
9. Keep, discard, crash, or mark inconclusive.
10. If kept, make that model the new baseline for the next related experiment.
11. Continue until interrupted or until the planned experiment batch is done.
```

This loop should not ask the user after every trial. It should only stop for
user input when:

- Live is not controllable.
- The harness repeatability check fails.
- The experiment requires changing the frozen harness.
- The next step would be implementation work outside the approved scope.
- There is a legal or licensing concern.

## Proposed Artifact Layout

When implementation begins, keep generated experiment output out of source
control unless the user explicitly asks to check in a small fixture.

Suggested layout:

```text
artifacts/drum_buss_research/
  probe_corpus/
    v001/
      probes/
      manifest.json
  captures/
    live11_48k_v001/
      baseline/
      drive/
      crunch/
      damp/
      transients/
      compression/
      boom/
  runs/
    2026-04-20_0001/
      trial.json
      input.wav
      ableton_output.wav
      candidate_output.wav
      residual.wav
      metrics.json
      plots/
      run.log
  results.tsv
```

Candidate model source should live separately from generated captures. The exact
source location can be chosen when implementation starts.

## Quality Gates

### Harness Ready Gate

The harness is ready only when:

- Python can control Live and Drum Buss parameters.
- ProbeSource can play a known probe.
- ProbeRecorder can write a file and signal completion.
- Bypassed Drum Buss path is transparent after alignment.
- Repeated Drum Buss captures with identical settings null well.
- Trial metadata records Live version, sample rate, settings, and probe version.

### Measurement Ready Gate

A measurement batch is valid only when:

- The probe manifest matches the actual WAV.
- Drum Buss settings are read back after being set.
- Output file length and channel count are expected.
- No previous Boom/compressor tail contaminates the next segment.
- Alignment confidence is high.

### Model Acceptance Gate

A candidate model is accepted only when:

- It improves held-out probes or simplifies the model without worsening them.
- Its improvement is above the measured repeatability floor by a meaningful
  margin.
- It has an explicit block-diagram explanation.
- It does not rely on changing the scoring harness.
- It survives at least one probe outside the fitting set.
- It leaves a residual that is understood or documented as next work.

## First Work Sequence

### Step 1: Build The Harness Skeleton

Create:

- `ProbeSource.amxd`.
- `ProbeRecorder.amxd`.
- Python OSC client for AbletonOSC.
- Python trial runner.
- Minimal probe generator.
- Minimal alignment and null-test analyzer.

Do not model Drum Buss yet.

### Step 2: Verify Live Control

Use Python to:

- Find the harness track.
- Find the Drum Buss device.
- Dump the runtime parameter list.
- Compare runtime names/ranges to `.adv` XML names/ranges.
- Set and restore a parameter.

### Step 3: Verify Audio Capture

Record and analyze:

- Bypass path silence.
- Bypass path sine.
- Bypass path impulse.
- Bypass path sweep.
- Repeated Drum Buss default output.

Do not proceed if repeated captures do not null to a documented repeatability
floor. Use that floor to interpret every later null target.

### Step 4: Capture Baseline Matrix

Capture the baseline matrix described above. Store all raw Ableton output before
fitting any model.

### Step 5: Model Damp

Start with Damp because it is the most linear target. A good Damp model will
also make Drive/Crunch fitting easier by removing one source of spectral error.
Use low-level probes so any always-on compression stays below threshold.

### Step 6: Model Drive And Crunch

Fit nonlinear stages after surrounding filters are understood. Use harmonic,
intermodulation, and aliasing metrics.
For each DriveType, first fit low-drive filters, freeze those filter candidates,
then fit the high-drive waveshaper. Treat DriveTypes independently until the
measurements justify a shared simplification.

### Step 7: Model Transients And Compression

Use burst and envelope probes. Keep these separate until each one is understood
well enough to combine.

### Step 8: Model Boom

Use isolated triggers and long tails first. Do not start from full drum loops.

### Step 9: Combine And Reorder Blocks

Once subsystem candidates exist, test block order. Many wrong models will have
good isolated scores but fail when controls are combined.

## Open Questions

These should be answered by the harness, not guessed:

- What exact parameter names and ranges does Live expose for Drum Buss on this
  installed Live version?
- Does Drum Buss introduce fixed latency or lookahead?
- Does Dry/Wet compensate latency between dry and wet paths?
- Does Drive oversample? If yes, at what effective factor?
- Does Crunch use a fixed or parameter-dependent bandpass?
- Is Damp before or after nonlinear stages?
- Does InputTrim drive compression, saturation, both, or only level?
- Does EnableCompression fully bypass compression?
- Is TransientShaping before or after compression?
- Is Boom mixed before or after Damp and Dry/Wet?
- Does Boom trigger from pre- or post-processed input?
- Does Boom reset oscillator phase on each trigger?
- Are repeated captures exactly deterministic?

## Source References

Use these references as starting points, not as proof of implementation details:

- Ableton Live manual, Drum Buss device reference:
  `https://www.ableton.com/en/live-manual/12/live-audio-effect-reference/#drum-buss`
- Ableton Live manual, audio effect reference:
  `https://www.ableton.com/en/live-manual/11/live-audio-effect-reference/`
- Ableton Live manual, working with instruments and effects:
  `https://www.ableton.com/en/live-manual/12/working-with-instruments-and-effects/`
- Ableton help, installing third-party remote scripts:
  `https://help.ableton.com/hc/en-us/articles/209072009-Installing-third-party-remote-scripts`
- Cycling '74 Live API overview:
  `https://docs.cycling74.com/userguide/m4l/live_api_overview/`
- AbletonOSC:
  `https://github.com/ideoforms/AbletonOSC`
- Cycling '74 `sfrecord~` reference:
  `https://docs.cycling74.com/legacy/max8/refpages/sfrecord~`
- Karpathy `autoresearch`:
  `https://github.com/karpathy/autoresearch`
- Karpathy `autoresearch` operating procedure:
  `https://github.com/karpathy/autoresearch/blob/master/program.md`

## Current Decision

The harness plan is locked at the architectural level:

```text
Python driver + AbletonOSC + ProbeSource.amxd + Drum Buss + ProbeRecorder.amxd
```

The research operating procedure is also locked at the principle level:

```text
frozen harness, fixed probes, mutable candidate model, baseline first,
fit/holdout split, explicit metrics, result ledger, keep/discard rules,
and simplicity as a first-class criterion
```

The next real work is implementation of the harness skeleton and its
transparency/repeatability checks. No Drum Buss clone code should be written
until that measurement path is proven.
