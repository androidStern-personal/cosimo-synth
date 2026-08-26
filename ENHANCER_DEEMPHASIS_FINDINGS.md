# Enhancer Spectre De-Emphasis/DC Ordering Prototype

Date: 2026-08-26

Wrapper checkpoint: `f2aa1bf6`

Target: activated Wavesfactory Spectre 1.5.6, Good quality

Scope: isolated black-box lab work. Production Enhancer DSP, UI, the Polish chain,
the installed VST, and Ableton state were not changed by this pass.

## Verdict

The previous production signal order is wrong. Spectre does **not** subtract the
unprocessed bell and then DC-block the complete residue. The measured equivalent is:

```text
selected = parametric bell contribution
shaped = selected saturation curve
conditioned = fixed 20 Hz second-order Butterworth high-pass(shaped)
wet(deEmphasis) = conditioned - deEmphasis * selected
```

The de-emphasis subtraction is essentially unfiltered. In product language, the
processed bell is DC-conditioned first and the inverse/unprocessed bell is applied
afterward. This is the distinction Andrew raised earlier in the investigation.

The fitted base filter is 20.0163 Hz, Q `1/sqrt(2)`, with a fixed +0.0208 dB scale.
That tiny static coefficient is part of the measured transfer fit; it is not an RMS
follower, correlation follower, automatic gain control, or program-dependent gain.

## Spectre endpoints and Cosimo's continuous control

Spectre exposes De-Emphasis as a binary switch. Raw values 0.00, 0.25, and 0.50 all
read back as `Disabled`; 0.75 and 1.00 read back as `Enabled`. Spectre therefore has
no black-box 25/50/75% reference positions.

Cosimo's continuous law is defined as exact sample-wise interpolation between the
measured Spectre Disabled and Enabled endpoints. The candidate implements that law
directly as `conditioned - amount * selected`; its intermediate affine error is at
floating-point noise (`2.78e-17` maximum in the retained tone cases).

## Training evidence

Only Medium/Solid tones at 31, 53, 89, 149, 251, 503, and 997 Hz selected the
static filter model. Mean normalized error, expressed in dB relative to the target:

| Base-path model | Mean error |
|---|---:|
| Gain only | -7.59 dB |
| One-pole high-pass | -19.37 dB |
| 20.016 Hz Butterworth biquad | **-47.25 dB** |
| Free-Q biquad | -47.27 dB |

The free-Q optimum was 19.996 Hz and Q 0.70591, only 0.026 dB better than the
standard Butterworth. The standard topology was selected to avoid fitting noise.

The independently measured subtraction path produced:

| Subtraction-path model | Mean error |
|---|---:|
| Unfiltered selected bell | **-52.00 dB** |
| 15 Hz one-pole blocked bell | -13.61 dB |

The unconstrained one-pole optimum was 0.0284 Hz and bought only 0.128 dB, so it is
treated as zero. Spectre's `off - on` delta is also invariant across Subtle/Medium
and Tube/Solid to roughly -143 dB in the retained 100 and 997 Hz comparisons.

## Held-out evidence

The model was then applied without refitting to both intensity modes, both
characters, alternate Q/gain/input levels, and frequencies from 43 to 11,987 Hz.

At 100 Hz, candidate errors across Subtle/Medium x Tube/Solid are:

| De-emphasis | Error range | Correlation floor |
|---:|---:|---:|
| 0% | -58.27 to -71.22 dB | 0.99999996 |
| 50% | -51.96 to -62.53 dB | 0.99999952 |
| 100% | -50.87 to -65.17 dB | 0.99999593 |

The installed implementation's corresponding 100% errors are only -3.57 to
-7.51 dB. The former low-frequency exception was therefore algorithmic, not an
inherent cost of accepting the 60-sample FIR wrapper.

The deliberate 11,987 Hz, Q 8 edge case remains the weakest held-out tone at about
-35 dB error and 0.99984 correlation. Ordinary held-out cases range from roughly
-41 to -81 dB.

## Musical evidence

The musical corpus uses parallel 130 Hz Solid and 9 kHz Tube bands, Q 0.71, +9 dB,
in both Subtle and Medium. Mean true-wet error across pink noise, drums, bass, and
bright poly material:

| De-emphasis | Installed current | Corrected candidate |
|---:|---:|---:|
| 0% | -4.79 dB | **-60.85 dB** |
| 25% | -4.55 dB | **-59.62 dB** |
| 50% | -4.21 dB | **-58.20 dB** |
| 75% | -3.74 dB | **-56.56 dB** |
| 100% | -3.16 dB | **-54.76 dB** |

Candidate wet correlation is above 0.9999989 for every endpoint musical case. The
complete-output pink/drum null is limited by the separately approximated dry-path
fractional alignment; it does not weaken the wet-algorithm conclusion.

## Production recommendation

Promote the already identified JUCE 7.0.1 maximum-quality 4x fractional FIR wrapper
with a 60-sample host latency report. After shaping and reconstruction, apply one
fixed 20 Hz Butterworth high-pass to each shaped band/channel, then subtract the
aligned unfiltered bell scaled by the smoothed continuous De-Emphasis control.

Do not retain the current `DCblock(shaped - deEmphasis * selected)` order. Do not add
dynamic compensation. Re-run the full T26 dry identity, mono/side, reset, finite,
sample-rate, state, musical, pluginval, install, and Ableton gates after production
integration. T26 is not complete until those gates pass.

## Reproduction

```sh
npm run prototype:enhancer-deemphasis
```

The ignored primary report is
`build/t26-deemphasis-prototype/report.json`; the endpoint and derived-intermediate
A/B files are under `build/t26-deemphasis-prototype/listening/`. The retained report
SHA-256 for this pass is
`baf4eb5ebb3c7aa2c5feda6bb8d35dd771008882d40f611939a6ff725d02224f`.
