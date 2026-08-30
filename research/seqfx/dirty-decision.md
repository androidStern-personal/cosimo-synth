# SeqFX Dirty decision and implementation evidence

Date: 2026-08-30

## Authority

Documented facts:

- Koala FX publicly names the requested effect “Dirty distortion.” Its public
  page does not describe a transfer curve, oversampling factor, or gain staging.
  <https://www.elf-audio.com/koalafx/>
- Kilohearts Distortion publishes Drive, Bias, Dynamics, Spread, Mix, and
  selectable Overdrive, Saturate, Foldback, Sine, Hard Clip, and Quantize
  families. It describes Dynamics as preserving the input signal's dynamics.
  <https://kilohearts.com/products/distortion>
- Ableton Saturator publishes Soft Sine, Analog Clip, Soft Clip, Digital Clip,
  Waveshaper, and Sinoid Fold families, a DC filter for asymmetric shaping, and
  a high-quality mode intended to reduce aliasing.
  <https://www.ableton.com/en/live-manual/12/live-audio-effect-reference/#saturator>

These sources establish the expected product vocabulary: multiple nonlinear
characters, input drive, transfer-curve bias, dynamics preservation, DC
removal, output control, and an anti-alias quality path. They do not establish
Koala's private curves, filters, oversampling factor, compensation detector, or
defaults.

## SeqFX product decision

Dirty is a block-sequenced gated distortion at append-only ID 12. It remains
separate from Crush: Dirty changes a continuous transfer curve; Crush models
sample-rate and bit-resolution conversion.

Its public controls are:

- Drive: 0–36 dB into the nonlinear core;
- Character: Soft, Hard, Fold, or Bias, trigger-latched;
- Bias: -100–100% transfer offset;
- Dynamics: 0–100% input-level contrast restoration;
- Tone: 500 Hz–20 kHz low-pass on the nonlinear residue only;
- Trim: -18–6 dB after compensation;
- the common per-block Mix.

The nonlinear core runs at a fixed 4x sample rate through Cmajor's graph-rate
multiplier. The aligned oversampled through output is subtracted from the shaped
output, producing a nonlinear residue that can be DC-blocked and tone-shaped
without delaying or darkening the dry fundamental. The residue is then added to
the current source sample. At zero Mix the output therefore remains exact dry.

Soft uses a bounded algebraic saturator, Hard clamps at unity, Fold uses a
bounded triangle fold, and Bias adds a fixed asymmetric offset before the user
Bias control. Character changes crossfade over 2 ms. A 10 Hz DC blocker follows
the nonlinear residue. Dynamics uses matched 10 ms input/output power detectors
and interpolates toward their bounded RMS compensation ratio. Common 96-frame
mix smoothing owns block entry and exit.

The exact four equations, 4x factor, fixed asymmetric offset, Bias scaling,
10 Hz DC corner, 10 ms detector, residue-only Tone topology, and -6 dB default
Trim are Cosimo engineering decisions. They are not claimed competitor matches.
The 4x cost is accepted because the measured hard-clip fixture keeps the 13 kHz
folded fifth-harmonic alias below 40% of the same host-rate naive clip.

## Automated evidence

`tests/test_seqfx_probe.py` proves:

- Soft produces strong odd harmonics without acquiring asymmetric even content;
- all four Character modes have measurably distinct transfer signatures;
- full Dynamics materially restores a 10:1 source-level contrast;
- biased shaping retains even harmonics while post-stage DC remains bounded;
- Tone attenuates high nonlinear residue without erasing the dry fundamental;
- the 4x core suppresses the named high-frequency alias against a naive clip;
- Trim follows its decibel law; and
- every Character remains finite and bounded at the extreme public settings.

`tests/test_seqfx_effect_definitions.mjs` locks ID 12, the six-control contract,
trigger/Aux eligibility, and the nested 4x Cmajor topology.
`tests/test_seqfx_patch_view_browser.mjs` proves that all six controls sequence
and persist through sparse v7 state, Character is excluded from live Aux
modulation, and the block renders its selected transfer curve. The packaged
shadow-root test repeats inspector, modulation, glyph, and overflow checks
against the production bundle.

Subjective matched-level listening, factory preset tuning, Ableton save/reopen,
installed VST3, pluginval, and release qualification remain later roadmap gates
and are not inferred from these automated tests.
