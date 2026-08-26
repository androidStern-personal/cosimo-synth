# Enhancer Spectre-Good Wrapper Prototype

> Superseding low-frequency result, 2026-08-26: the 100 Hz exception below was
> caused by the wrong de-emphasis/DC ordering, not by the selected FIR wrapper.
> A training-only follow-up identifies Spectre's equivalent as a fixed 20 Hz
> Butterworth high-pass on the shaped path followed by an unfiltered de-emphasis
> subtraction. With that order, 100 Hz errors improve to -50.87 through -71.22 dB
> across both modes and characters. See `ENHANCER_DEEMPHASIS_FINDINGS.md`.

Date: 2026-08-26

Checkpoint: `0e07f4230667c04f4f52dac31e9a4bb9eda9f8a4`

Target: activated Wavesfactory Spectre 1.5.6, Medium, Good quality

Scope: lab-only wrapper identification. No production Enhancer, Polish-chain, UI,
installed VST, or Ableton project was changed.

## Verdict

Spectre Good's 4x wet wrapper is extremely likely to be the JUCE 7.0.1
maximum-quality equiripple FIR topology with fractional latency enabled. Its measured
latency is 59.5 samples at 48 kHz; the host-visible compensation is 60 samples.

This is a large and repeatable improvement, not yet a complete production match.
The high-frequency wet path is now near-null. The remaining material mismatch is
concentrated in the low-frequency phase/de-emphasis/DC region, plus the product
decision that an exact wrapper costs about 1.25 ms of reported latency at 48 kHz.

Recommendation: retain this as the leading production topology, but do not replace
the zero-latency Cmajor wrapper until Andrew explicitly accepts the latency-contract
change and the low-frequency residual is resolved.

## Measurement correction

The earlier uncertainty pass estimated Spectre's effect as `Mix 50% output - raw
input`. That is not the isolated Spectre wet contribution. Spectre's balanced 50%
law is `processed dry endpoint + wet endpoint`, and its dry endpoint carries the
same latency compensation as the wet path.

At 11,987 Hz and 15,991 Hz, the Spectre dry endpoint correlates with raw dry at only
0.708 and 0.501 respectively, despite matching its magnitude. Those are the 45 and
60 degree signatures of an almost ideal half-sample advance. The measured dry path
matches an ideal half-sample model to -67.46 dB and -63.70 dB error at those held-out
frequencies. Raw subtraction therefore injected dry-path phase into the old
"effect" metric.

All prototype selection and result tables below use Spectre's actual `Mix 100%`
wet endpoint for effect comparisons. Complete-output comparisons remain separate
and use Spectre's audible balanced-50% output.

## Blind topology selection

The runner built eight pinned JUCE candidates:

- FIR and polyphase IIR
- normal and maximum quality
- fractional and integer-latency modes

It fitted one static host advance from a Clean impulse, ranked candidates on that
impulse plus 997, 4,001, and 7,993 Hz nonlinear training tones, then locked the
winner before revealing 100, 11,987, and 15,991 Hz or any musical fixture.

The maximum-quality fractional FIR won with mean normalized error power
`0.000698`. The next candidate scored `0.0582`; the best IIR scored `0.1423`.

The target and winner both begin their compensated impulse response at -40 frames
and peak at frame 0. Their pre/post energy ratios are -28.629 and -28.644 dB. The
winner's complete Clean impulse error is -37.39 dB with correlation 0.99991.

## Nonlinear tone evidence

Error is residual RMS relative to Spectre's true wet contribution. More negative is
better.

| Tone | Current error | Wrapper error | Wrapper correlation |
|---:|---:|---:|---:|
| 997 Hz (training) | — | -26.25 dB | 0.99882 |
| 4,001 Hz (training) | — | -37.59 dB | 0.99992 |
| 7,993 Hz (training) | — | -41.91 dB | 0.99998 |
| 100 Hz (held out) | -7.49 dB | -6.89 dB | 0.89185 |
| 11,987 Hz (held out) | +3.51 dB | -45.88 dB | 0.999997 |
| 15,991 Hz (held out) | +0.75 dB | -41.51 dB | 0.999975 |

The 100 Hz result is the exception: the candidate is 0.60 dB worse by this error
metric. Clean and shaped components remain within roughly -17 dB there, but their
small difference magnifies phase/DC disagreement in the residue. Removing the
global blocker improved that one steady tone and degraded all four musical
holdouts, especially bass, so that shortcut was rejected.

Above 4 kHz, separate Clean and shaped components match within approximately
-40 to -54 dB, and the resulting residue matches within -38 to -46 dB. This is
strong evidence that the recovered RBJ bell and fixed Medium Solid curve were not
the high-frequency problem.

## Musical holdouts

Two parallel bands were used exactly as in the previous pass: 130 Hz Solid and
9 kHz Tube, Q 0.71, +9 dB, Medium, de-emphasis on. The wrapper choice was already
locked. The dry path in the complete-output A/B uses the independently measured
ideal half-sample model.

| Material | Current wet error / correlation | Wrapper wet error / correlation | Current full error | Wrapper full error |
|---|---:|---:|---:|---:|
| Pink | -0.33 dB / 0.521 | -11.35 dB / 0.963 | -3.16 dB | -14.51 dB |
| Drums | -2.61 dB / 0.691 | -5.69 dB / 0.855 | -4.24 dB | -7.52 dB |
| Bass | -5.92 dB / 0.863 | -6.86 dB / 0.891 | -8.81 dB | -9.81 dB |
| Bright poly | -9.05 dB / 0.937 | -18.27 dB / 0.993 | -13.25 dB | -23.08 dB |

The improvement is positive on every fixture and largest where the previous
wrapper was most phase-wrong. Drums and bass show that the low-frequency/transient
remainder still matters; this is not an honest final-null claim.

## Decisions and boundaries

1. **Kept production untouched.** The measured topology conflicts with the current
   literal zero-declared-latency and bit-identical immediate-dry contract.
2. **Corrected the comparison boundary.** Wet algorithms are compared at Spectre's
   wet-only endpoint; audible full outputs are compared separately.
3. **Retained the bell and shaper laws.** The winning wrapper nearly nulls high
   frequencies without retuning Q, Amount, or the Medium curve.
4. **Rejected a Tube-only DC blocker.** It optimized one sine and materially worsened
   all musical holdouts.
5. **Did not promote the prototype.** Andrew must decide whether Spectre fidelity is
   worth 60 samples of host-reported latency. If yes, the next pass should fit the
   low-frequency common phase/de-emphasis response, implement the wrapper behind a
   production latency seam, and rerun the full T26/Ableton contract.

## Reproduction

```sh
npm run prototype:enhancer-wrapper
```

The command verifies JUCE tag 7.0.1 at commit
`b08520c2de1771af3dfcbfbc0e0b6b0b5eb083b0`, builds only its DSP modules, renders
the activated Spectre and installed Cosimo Enhancer, and writes the ignored report
and A/B audio to `build/t26-wrapper-prototype/results/`.

The retained runner and probe contain no Spectre code or audio. The final local
report SHA-256 was
`9338e709c80f2c72a376db7e35d0ee60142d2bbce93c387c33cda6f5d0707e9a`;
regenerate rather than treating an ignored report hash as a source artifact.
