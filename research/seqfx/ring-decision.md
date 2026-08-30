# SeqFX Ring decision and implementation evidence

Date: 2026-08-30

## Authority

Documented facts:

- Kilohearts defines ring modulation as multiplying the input by an internal
  sine/noise generator or secondary input. Its public controls are Frequency,
  Spread, Bias, Rectify, and Mix. Spread slightly shifts the internal generator
  frequency in opposite directions for the left and right channels; Frequency
  becomes the filter cutoff in noise mode.
  <https://kilohearts.com/products/ring_mod>
- Effectrix2 calls Ring a ring modulator and documents Ring Frequency, LFO
  Speed, LFO Amount, Width, Drive, oscillator Waveform, and a 4x high-quality
  mode. <https://downloads.sugar-bytes.de/manuals/Effectrix2.pdf>
- Looperator documents Drive, Ring Amount, stereo width, Ring Frequency,
  sine/triangle/parabolic carrier shapes, and an optional LFO.
  <https://downloads.sugar-bytes.de/manuals/Looperator.pdf>
- For a sine input at frequency `f` multiplied by a sine carrier at `c`, the
  analytic output contains equal-amplitude components at `f-c` and `f+c`, with
  no original `f` component when Bias is zero.

No undocumented competitor timing, detune depth, phase-reset behavior, or
internal oversampling implementation is claimed.

## SeqFX product decision

Ring remains a block-sequenced, gated effect at append-only ID 7. It uses:

- Frequency: 0.1 Hz–12 kHz, logarithmic and aux eligible;
- Wave: Sine, Triangle, Square, or Noise, trigger-latched;
- Motion: a bounded exponential carrier sweep of up to one octave;
- Rate: 0.02–20 Hz free-running motion rate;
- Spread: opposite carrier-frequency offsets, reaching 25 cents per channel at
  100%;
- Bias: a bipolar value added to the carrier before multiplication;
- Rectify: a bipolar morph toward positive or negative full-wave rectification;
- the existing per-block Mix control.

The 25-cent Spread ceiling and one-octave Motion depth are engineering
inferences, not competitor measurements. They are conservative, named limits
that keep the control useful without letting its default erase the center.
Spread follows Kilohearts' documented frequency-shift behavior; the earlier
phase-offset prototype was rejected before checkpointing.

The oscillator and motion phases are continuous across ordinary block
retrigger. A retrigger latches Wave but does not restart either phase. Common
96-frame entry/exit smoothing owns block click prevention. Periodic stereo
carriers use independently advanced detuned phases. Noise uses deterministic
seeded excitation through per-channel one-pole filters whose cutoff follows the
spread Frequency values.

Sine is the neutral reference. Square uses polyBLEP edge correction rather than
an unbounded naive discontinuity. Triangle and Noise are character choices.
SeqFX omits a secondary-input mode because the plugin's frozen public contract
has one stereo audio input, and omits Ring Drive because Dirty owns distortion
and each effect has an eight-value state vector. Tempo-synced motion remains
available through SeqFX's shared block Aux source; Ring's own Rate stays an
honestly labelled free-running Hz control rather than hiding two timing models
inside one number.

## Automated evidence

`tests/test_seqfx_probe.py` proves:

- a 1 kHz sine multiplied by a 180 Hz sine produces equal 820 Hz and 1180 Hz
  sidebands while suppressing the 1 kHz carrier;
- repeated trigger cells do not reset oscillator phase;
- all four Wave modes remain finite, bounded, audible, and non-silent after
  mono collapse;
- positive Bias restores the input-frequency component while retaining ring
  sidebands;
- full Spread produces the specified opposite 25-cent carrier detunes.

`tests/test_seqfx_patch_view_browser.mjs` proves:

- Ring is selectable as a normal SeqFX block and persists ID 7;
- every public control writes the dense runtime projection and sparse v7 state;
- Wave is absent from live Aux targets because it is trigger-latched;
- Frequency modulation writes physical octave-derived endpoints;
- the block has a parameter-derived waveform glyph and its picker identity uses
  the vendored Fontaudio `fad-modsine` path.

Source/build qualification completed for this slice:

- Cmajor dry-run at 48 kHz;
- focused Ring DSP tests: 9 passing;
- focused Ring/browser/picker/modulation tests: 5 passing;
- SeqFX production source and worker bundle build.

Subjective listening, Ableton save/reopen, installed VST3, pluginval, and release
qualification remain later roadmap gates and are not inferred from these tests.
