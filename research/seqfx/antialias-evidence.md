# SeqFX rate-conversion and speed-up anti-alias evidence

Date: 2026-08-30

This record covers SeqFX's own rate conversion. It does not infer competitor
implementation details.

## Selected architecture

- Host rates above 48 kHz enter the fixed 48 kHz history through a 16th-order
  Butterworth low-pass. The steeper transition protects the 24 kHz destination
  Nyquist region without permanently darkening 44.1/48 kHz input.
- The 8 kHz long-Tape tier uses an independent eighth-order 3.2 kHz Butterworth
  cascade, double-precision phase, and phase-correct linear sampling. The old
  single one-pole decimator was rejected because it attenuated 6 kHz by only
  about 6 dB before an 8 kHz destination.
- Pitch retains the measured 2:1 half/quarter mip histories, but those histories
  are acceleration tiers rather than the whole anti-alias policy. A cached,
  ratio-dependent 47-tap Blackman-windowed sinc filters the residual rate inside
  each octave. An unsafe finer tier is never crossfaded back into the result.
- Stutter uses the same independently generated residual-rate kernel over its
  circular capture. Speed below or equal to 1 remains unfiltered; every speed-up
  is filtered directly rather than blended with the aliasing raw read.
- Primary and coarse history phase accumulators are float64. This removes the
  observed float32 one-sample timing error after roughly ten minutes at 44.1 kHz.

## Reproduction

```sh
uv run python -m reference_labs.seqfx_antialias
uv run pytest -q tests/test_seqfx_antialias_reference.py
uv run pytest -q tests/test_seqfx_probe.py -k \
  'primary_history_rejects or octave_speedup or residual_rate_filter or stutter_double_speed or stutter_intermediate_speed'
```

The render fixtures use Hann-windowed band energy, not one exact Fourier
projection. That distinction is required because granular sidebands can make an
exact-bin test appear tens of decibels cleaner than the nearby audible band.

The supported-rate render matrix includes 44.1, 48, 88.2, 96, and 192 kHz.
It includes the previously missed 1.5x Pitch, 1.6x Stutter, 44.1 kHz +24-semitone,
and 192 kHz near-transition primary-ingest cases.
