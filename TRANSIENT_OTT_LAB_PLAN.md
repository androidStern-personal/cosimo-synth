# Transient Plan: OTT Lab

This is a temporary implementation plan for building a standalone OTT-style multiband dynamics effect before integrating anything into the Cosimo synth effect card.

## Goal

Build `fx/ott_lab` as a separate Cmajor effect lab with stock Cmajor-generated controls. The lab should let us hear and measure an OTT-style multiband upward/downward compressor without changing the main synth.

## Research Conclusions

- Cmajor does not ship a compressor or multiband dynamics example.
- Cmajor does ship a 4th-order flat-summing crossover implementation and dB/gain helpers, which are the right stock building blocks for a first lab.
- Ableton OTT is a 3-band bidirectional compressor: each band compresses downward above an upper threshold and upward below a lower threshold.
- The installed Ableton OTT preset uses these anchor values:
- Low/Mid crossover: `88.2818 Hz`
- Mid/High crossover: `2499.9995 Hz`
- RMS mode, soft knee on
- Input gain per band: `+5.2 dB`
- Output gains: low `+10.3 dB`, mid `+5.7 dB`, high `+10.3 dB`
- Downward ratios: low/mid about `66.7:1`, high effectively limiting
- Upward ratio: about `4.17:1`
- Useful reference ideas:
- Tsarpf Disting OTT: enforce threshold/crossover ordering, smooth gain after gain computation.
- vitOTT/Vital: use power/RMS-style detection and clamp maximum expansion.
- OTTT: separate upward/downward stages are understandable, but 4 bands are too much for the first Cosimo lab.
- MusicDSP LR4 note: crossover outputs should flat-sum, and fast crossover movement needs smoothing.

## Architecture

1. Create `fx/ott_lab/OttLab.cmajorpatch` as a standalone effect patch.
2. Create `fx/ott_lab/OttLab.cmajor` with stereo stream input and output.
3. Create `fx/ott_lab/view/index.js` from the chorus lab stock-control pattern.
4. Split audio into 3 bands with two chained Cmajor crossovers.
5. Process each band with one bidirectional gain computer:
- Detect stereo-linked RMS level by default.
- Compute downward gain above the upper threshold.
- Compute upward gain below the lower threshold.
- Apply a soft knee around each threshold.
- Smooth the target gain with a short fixed smoother to avoid zippering.
- Clamp upward expansion to prevent runaway loudness.
6. Recombine bands, apply output trim, then apply linear dry/wet mix.

## Initial Parameter Surface

- Hidden first parameter: host slot guard.
- Output: Bypass, Mix, Amount, Time, Input Gain, Output Gain.
- Character: Up Amount, Down Amount, Detector Mode, Soft Knee, Knee Width, Stereo Link.
- Crossovers: Low/Mid Hz, Mid/High Hz.
- Low, Mid, High: Above Threshold, Below Threshold, Down Ratio, Up Ratio, Attack, Release, Band Input Gain, Band Output Gain.

## Test Plan

- Native Cmajor dry-run loads without internal compiler errors.
- Bypass, mix `0%`, and amount `0%` are transparent.
- Crossover recombination is near-transparent when dynamics and gains are neutral.
- Above-threshold steady tones are attenuated.
- Below-threshold steady tones are boosted.
- Signals between lower and upper thresholds stay unchanged.
- Up Amount and Down Amount isolate their respective branches.
- Time control changes step-response speed.
- Stereo Link applies the same gain to both channels when one channel is loud.
- Silence and hot signals remain finite and bounded.
- Stock UI renders visible parameters and hides the host slot guard.

## Execution Notes

- Implemented the standalone lab under `fx/ott_lab`.
- Added stock generated-parameter UI in `fx/ott_lab/view/index.js`.
- Added `npm run ott:play` and `npm run ott:dry-run`.
- Added `tests/test_ott_lab_probe.py` to render the real generated Cmajor DSP and verify bypass, mix-zero, neutral-band level reconstruction, downward compression, upward compression, stereo linking, and time response.
- Renamed the internal Time endpoint to `timePercent` while keeping its display label as `Time`; the original endpoint name `time` did not affect generated-runtime behavior.
- The probe explicitly seeds crossover and envelope defaults because child-node value endpoints in generated test graphs do not reliably inherit annotation defaults.
