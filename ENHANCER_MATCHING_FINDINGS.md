# Enhancer Matching: Remaining-Uncertainty Pass

> Follow-up correction, 2026-08-26: the effect-contribution tables in this pass
> subtract raw input from Spectre's balanced-50% output. Spectre's processed dry
> endpoint carries fractional-latency phase, so those tables are useful full-path
> diagnostics but are not isolated wet-endpoint comparisons. The corrected wet-only
> topology experiment and superseding metrics are in
> `ENHANCER_WRAPPER_PROTOTYPE_FINDINGS.md`. The subsequent de-emphasis endpoint pass
> resolves the remaining low-frequency mismatch and is authoritative for the final
> signal order: `ENHANCER_DEEMPHASIS_FINDINGS.md`.

Date: 2026-08-26

Target: activated Wavesfactory Spectre 1.5.6, Medium, Good quality

Candidate: installed `CosimoEnhancer.vst3` from `a1276ef2`

## Verdict

The recovered Tube/Solid curves are not the remaining sound problem. The normal
parametric-bell cases are not the problem either. The largest verified mismatch is
the timing and phase response of the 4x oversampling/reconstruction path.

Do not retune the `tanh` constants or replace the EQ law. Prototype a
Spectre-Good-matched 4x wrapper first, then repeat the same musical comparison.

## What the measurements resolved

### Static distortion curve

A 97 Hz + 137 Hz two-tone generated 58–210 retained harmonic and intermodulation
products for each Subtle/Medium × Solid/Tube combination. The documented formulas
predicted those products with 0.041–0.058 dB RMS error; the worst retained bin was
0.201 dB.

This is stronger evidence than the earlier single-sine harmonic fit: it exercises
cross-products that a merely similar waveshaper would usually miss. It supports
retaining:

- Subtle Solid: `tanh(3x) / sqrt(2)`
- Subtle Tube: `(tanh(3x + 0.125) - tanh(0.125)) / sqrt(2)`
- Medium Solid: `tanh(6x) / 2`
- Medium Tube: `(tanh(6x + 0.3125) - tanh(0.3125)) / 2`

It does not prove Spectre's source code uses these expressions; it proves the tested
black box is equivalent at the measured products and levels.

### Stateful or dynamic behavior

The same quiet probe was rendered after silence and after a near-full-scale history.
After a 500 ms silent gap, all three Clean/Solid/Tube probe outputs were bit-identical.
With only a 20 ms gap, the 100–500 ms Solid difference was −169.2 dBFS. Tube retained
a slow mean at −127.3 dBFS, but its cycle-demeaned AC difference was −157.0 dBFS and
the behavior follows the already measured residue DC-blocker decay.

There is no evidence here for an envelope follower, program-dependent drive, or
other meaningful dynamic "secret sauce" in these two characters.

### Parametric EQ versus a common wrapper

Six broad bells were used to identify the complex Spectre/Cosimo transfer ratio. At
500 Hz–20 kHz, changing the bell center did not materially change that ratio:

- magnitude standard deviation across bell cases: at most 0.0071 dB
- phase circular standard deviation across bell cases: at most 0.0251 degrees

Applying that one common ratio to held-out centers, gains, and Q values reduced the
ordinary cases to at most 0.019 dB RMS magnitude error and 0.197 degrees RMS phase
error. The deliberate stress case at 16 kHz, Q 8, +12 dB remained 0.230 dB and
1.81 degrees RMS, consistent with the already known extreme-high-frequency EQ edge.

Inference: the ordinary bell's complex response is effectively the same. A common
resampling/reconstruction response accounts for almost all of the measured linear
difference. The inference does not identify Spectre's internal filter implementation.

### The actual large mismatch

The common response has almost unity magnitude above 500 Hz but substantial phase:
over 500 Hz–8 kHz, Spectre is equivalent to about 4.85 samples earlier than the
current Cosimo path, with 1.10 degrees RMS residual after the best straight-line
phase fit. Spectre Good's measured impulse has 40 frames of low-level pre-response
and peaks at +1 frame; the current Cmajor 4x path has no pre-response and peaks at
+6 frames.

That phase difference dominates steady-tone error. Representative Medium Solid
contribution comparisons against Spectre Good:

| Center | Level mismatch | Total error vs Spectre effect | Phase-only error | Magnitude-only error | Correlation |
|---:|---:|---:|---:|---:|---:|
| 997 Hz | +0.004 dB | −0.893 dB | −0.890 dB | −59.5 dB | 0.593 |
| 4,001 Hz | +0.046 dB | +4.755 dB | +4.729 dB | −44.1 dB | −0.486 |
| 7,993 Hz | +0.388 dB | +3.421 dB | +3.240 dB | −20.3 dB | −0.050 |
| 15,991 Hz | +0.732 dB | +5.000 dB | +4.623 dB | −21.1 dB | −0.450 |

The spectra are close in level while their components arrive with different phase.
This is why the earlier magnitude-only harmonic and shoulder gates could pass while
the actual waveform remained far away.

In both error tables, the error is residual RMS relative to Spectre's effect
contribution: more negative is better, and 0 dB means the error is as large as the
target effect itself. It is not a simple output-level delta.

### Musical material

One offline diagnostic applied only the identified common linear correction to the
current Cosimo contribution. It is not proposed production DSP; it tests whether
that measured seam moves the result.

| Material | Current effect error | Corrected effect error | Current → corrected correlation |
|---|---:|---:|---:|
| Pink | −0.27 dB | −10.03 dB | 0.497 → 0.949 |
| Drums | −2.53 dB | −6.50 dB | 0.682 → 0.882 |
| Bass | −5.88 dB | −10.09 dB | 0.862 → 0.951 |
| Bright poly | −8.39 dB | −20.62 dB | 0.927 → 0.996 |

The improvement is large on every fixture. The remaining transient and
near-Nyquist error shows that an output correction alone is insufficient: the
input interpolation and anti-alias behavior of the whole 4x cluster must also be
matched.

## Recommendation and decision boundary

Build the next pass as a lab-only custom 4x upsample/filter/downsample prototype.
Fit its complex response to Spectre Good, including the high-frequency and transient
probes, and promote it only if the musical holdouts improve.

An exact match may conflict with the current zero-declared-latency contract. The
observed Good impulse has pre-response, which implies latency compensation or an
equivalent look-ahead arrangement. Whether Spectre fidelity is worth relaxing that
contract is Andrew's product decision; this pass does not make it and does not
change production DSP.

Do not attempt to close this gap by adding a bare 4.85-sample delay/advance. It is
only the low/mid-band linear approximation; the nonlinear phase bends at high
frequency, and the residual high-frequency nonlinear error remains large after the
offline output-only correction.

## Reproduction

Run:

```sh
uv run --with pedalboard --with numpy --with scipy \
  python scripts/measure_spectre_enhancer_uncertainty.py
```

The deterministic derived report and listening A/Bs are written to ignored
`build/t26-spectre-uncertainty/`. Spectre fresh-instance repeatability was bit-exact
in this pass. No Spectre audio or proprietary implementation is committed.
