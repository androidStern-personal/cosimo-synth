# Advanced Comb Research and Product Decision

Audit date: 2026-08-30. “Recent” below means work published from 2020
through the latest completed DAFx proceedings (DAFx-2025), plus a relevant
2026 journal paper. Older papers are retained only where they are the direct
foundation for the qualified beta design.

This is an evidence audit, not a listening report. No cited paper evaluates
SeqFX, and no source reviewed here studies the exact problem of a four-chain,
step-sequenced insert effect on drums, bass, chords, and speech. Claims about
musical fit therefore remain hypotheses until controlled SeqFX listening.

## Current product decision

Keep the already-qualified vector-dispersive Comb topology for beta.

- `Dispersion = 0` remains the exact conventional reference and fast path.
- The advanced path remains a fixed four-mode vector network: fractional
  delays around one Tune center, orthogonal Hadamard-style feedback mixing,
  short allpass dispersion, frequency-dependent damping, bounded delay
  motion, drive, DC blocking, soft limiting, and stereo projection.
- Tune, Decay, Polarity, Dispersion, Damping, Motion, Drive, and Width remain
  the public sound model. Recent work does not justify adding a matrix editor,
  per-mode tuning, room targets, learned controls, or a bank of decay bands.
- Existing rendered qualification establishes deterministic, finite, bounded,
  tuned, cross-rate, maximum-tail, and generated-runtime behavior. It does not
  establish native realtime cost, Ableton CPU, or listening quality.

Confidence in preserving the topology: **HIGH** for beta engineering scope,
**UNKNOWN** for final listening acceptance.

## Product baseline, not an originality claim

[Kilohearts' official Snapin documentation](https://kilohearts.com/docs/snapins)
describes the familiar comb mental model: peak spacing, wet/dry mix, polarity,
and stereo behavior. SeqFX must retain that immediate reference behavior. A
more advanced structure is only valuable if it still feels like a Comb rather
than a small reverb or an opaque resonator.

## Recent primary-source audit

### 2026 — stable allpass variable fractional delay design

Ruijie Zhao and Chunlu Lai, “Optimal Design of Stable Allpass Variable
Fractional Delay Filters Using Matrix-Based Algorithms,” *Signal Processing*
243 (2026), article 110496, published online in 2026:
[publisher/DOI](https://doi.org/10.1016/j.sigpro.2026.110496).

The paper derives weighted-least-squares and minimax designs for variable
fractional-delay allpasses and gives stability conditions involving phase
error and a delay-shift parameter. This is directly relevant to accurate
moving fractional delay, but the contribution is an offline filter-design
method, not evidence that a higher-order allpass is a better musical Comb.

**Disposition — post-beta experiment, MEDIUM confidence.** Compare a small,
precomputed stable allpass fractional-delay table against the current
interpolated delay. Require better tune/phase accuracy at 30 Hz, 8 kHz, and all
supported sample rates without worse transient smear, modulation artifacts, or
four-chain cost. Do not replace the current delay from theory alone.

### 2025 — efficient frequency-dependent FDN attenuation

Ilias Ibnyahya and Joshua D. Reiss, “Differentiable Attenuation Filters for
Feedback Delay Networks,” DAFx-2025, Ancona, 2–5 September 2025:
[venue paper](https://dafx.de/paper-archive/2025/DAFx25_paper_54.pdf),
[authors' implementation](https://github.com/ilias-audio/iir_match).

The authors fit a shared parametric-EQ shape whose gains scale with each delay
length. Their 12-band example approaches a much larger graphic equalizer with
fewer operations, and even four or eight bands follow the broad target decay
curve. The transferable result is that decay filters should be normalized by
path length and evaluated as frequency-dependent decay, not that SeqFX needs
12 bands or a learned fitter.

**Disposition — principle adopted now; architecture deferred, HIGH
confidence.** Retain delay-length-aware feedback decay and bandwise tail
measurement. Do not add a PEQ per vector mode for beta: that cost and parameter
surface solve realistic room decay, while SeqFX needs a legible colored
resonance. A hidden two-to-four-band damping prototype may be compared after
beta, with no new public controls unless it clearly widens the sweet spot.

### 2025 — FDN resonance as a musical instrument

Costantino Rizzuti, “Compositional Application of a Chaotic Dynamical System
for the Synthesis of Sounds,” DAFx-2025, Ancona, 2–5 September 2025:
[venue paper](https://www.dafx.de/paper-archive/2025/DAFx25_paper_46.pdf).

One described instrument excites three eight-delay FDN resonators tuned to
harmonic pitch sets and exposes a rotation angle controlling circulation in
the feedback matrix. This is recent evidence that matrix circulation can be a
musical control rather than only a room-model parameter. It is not an isolated
evaluation of that control: the paper's focus is a larger compositional system
with chaotic excitation, and it provides no comparison against a fixed matrix.

**Disposition — promising post-beta experiment, LOW confidence.** Test a
single bounded orthogonal-rotation macro against the fixed Hadamard matrix.
Keep the user's audio as excitation, preserve losslessness by construction,
and reject the experiment if it reads as diffuse reverb, changes Tune, or
creates another hard-to-find sweet spot. Do not adopt the chaotic generator.

### 2024 — frequency-dependent decay as an evaluation surface

Alessandro Ilic Mezza, Riccardo Giampiccolo, and Alberto Bernardini,
“Modeling the Frequency-Dependent Sound Energy Decay of Acoustic Environments
with Differentiable Feedback Delay Networks,” DAFx-2024, Guildford,
3–7 September 2024:
[venue paper](https://dafx.de/paper-archive/2024/papers/DAFx24_paper_22.pdf).

The paper introduces a mel-scale energy-decay relief to expose decay behavior
across frequency rather than collapsing a tail to one broadband number. Its
optimization target is realistic room response, but the measurement idea
transfers cleanly to a colored resonator.

**Disposition — adopted now as lab evidence, HIGH confidence.** Continue to
record T20/T60 by band and add a mel-spaced decay view when comparing future
Comb candidates. Use it to reveal low-frequency hangs, high-frequency fizz,
and modes that die too quickly. Do not optimize SeqFX toward a room impulse
response.

### 2024 — lossless prototypes, proportional attenuation, and scattering

Gloria Dal Santo, Benoit Alary, Karolina Prawda, Sebastian Schlecht, and Vesa
Välimäki, “RIR2FDN: An Improved Room Impulse Response Analysis and Synthesis,”
DAFx-2024, Guildford, 3–7 September 2024:
[venue paper](https://www.dafx.de/paper-archive/2024/papers/DAFx24_paper_20.pdf).

The informed method begins from an orthogonal, energy-preserving feedback
prototype, applies delay-proportional attenuation, and uses paraunitary filter
feedback matrices to accelerate echo density. Formal listening tests concern
similarity to measured rooms, not creative comb quality.

**Disposition — two principles retained; dense scattering rejected, HIGH
confidence.** Orthogonal coupling and path-length-normalized decay support the
current four-mode design. Extra mixing/delay stages whose purpose is rapid echo
density are a poor beta fit: they spend CPU to erase the sparse, pitch-legible
identity that makes Comb distinct from reverb.

### 2023 — differentiable optimization for colorless FDNs

Gloria Dal Santo, Karolina Prawda, Sebastian J. Schlecht, and Vesa Välimäki,
“Differentiable Feedback Delay Network for Colorless Reverberation,”
DAFx-2023, Copenhagen, 4–7 September 2023:
[venue paper](https://www.dafx.de/paper-archive/2023/DAFx23_paper_32.pdf).

The work links strong individual modal excitation with metallic ringing and
optimizes a small FDN's feedback matrix and input/output gains for a narrower
modal-excitation distribution, flatter response, and denser late reverb. Its
listening result is about reducing coloration in reverberation. SeqFX Comb is
deliberately a coloration effect, so “colorless” is the wrong objective.

**Disposition — diagnostic adopted; objective rejected, HIGH confidence.**
Measure modal-energy outliers so one accidental mode does not dominate the
entire control range, but do not flatten the tooth structure. A post-beta
offline optimization may constrain only the worst outlier while preserving
the authored Tune and audible inharmonic spacing; it must beat the fixed
projection in blind, level-matched SeqFX listening before adoption.

### 2022 — finite-horizon stability for time-varying filters

Kurt James Werner and Russell McClellan, “Time-Varying Filter Stability and
State Matrix Products,” DAFx-2022, Vienna, 6–10 September 2022:
[venue paper](https://dafx.de/paper-archive/2022/papers/DAFx20in22_paper_41.pdf).

The authors give a sufficient time-varying stability criterion based on the
norm of a product of state-transition matrices over a finite number of time
steps. The practical warning is important: proving every frozen coefficient
setting stable does not prove a swept recursive filter stable.

**Disposition — adopted now as a decision gate, HIGH confidence.** Current
beta keeps bounded, smoothed modulation and rendered sweep/extreme tests; it
does not claim a formal energy-preservation proof. Any proposal for audio-rate
Dispersion, moving feedback matrices, or a new recursive interpolator must
either use an energy-preserving realization or provide an applicable
finite-horizon stability argument plus long-tail renders.

### 2021 — arbitrary allpass FDN completion

Sebastian J. Schlecht, “Allpass Feedback Delay Networks,” *IEEE Transactions
on Signal Processing* 69 (2021), 1028–1038:
[author preprint](https://arxiv.org/abs/2007.07337),
[publisher DOI](https://doi.org/10.1109/TSP.2021.3053507).

The paper characterizes delay-network connections that remain allpass for
arbitrary delay choices and describes completion of input/output gains for a
given feedback matrix. This greatly expands valid FDN design space, but an
allpass total response is not automatically a useful wet/dry comb: mixing an
allpass wet path with dry audio can still produce the audible coloration, while
optimizing the whole effect toward flat magnitude works against the product.

**Disposition — analysis method only, MEDIUM confidence.** Use the completion
framework to check future projection/matrix experiments. Do not make total
allpass response or homogeneous modal decay a beta requirement.

### 2021 — modal excitation and perceived coloration

Janis Heldmann and Sebastian J. Schlecht, “The Role of Modal Excitation in
Colorless Reverberation,” DAFx-2021, Vienna, 8–10 September 2021:
[venue paper](https://www.dafx.de/paper-archive/2021/proceedings/papers/DAFx20in21_paper_17.pdf).

The listening study connects the distribution of modal excitation to perceived
coloration in late reverb. This is useful evidence that input/output projection
matters perceptually, not merely mathematically. Again, the desired direction
for SeqFX is controlled coloration, not colorlessness.

**Disposition — post-beta projection experiment, MEDIUM confidence.** Compare
a small set of fixed, independently derived stereo projections with the current
one. Score pitch clarity, width, mono fold, and sweet-spot size; do not expose a
matrix or modal-gain editor.

### 2021 — parallel comb separation before nonlinear processing

Sebastian Laguerre and Gary P. Scavone, “Simulating a Hexaphonic Pickup Using
Parallel Comb Filters for Guitar Distortion,” DAFx-2021, Vienna,
8–10 September 2021:
[venue paper](https://www.dafx.de/paper-archive/2021/proceedings/papers/DAFx20in21_paper_2.pdf).

The paper uses a parallel comb bank to separate harmonically related guitar
components before individual distortion, reducing intermodulation relative to
one broadband distortion path. It is a genuine creative use of comb filtering,
but it assumes guitar-like harmonic structure and turns the comb into a source
separator feeding a distortion system.

**Disposition — rejected for SeqFX Comb, HIGH confidence.** It overlaps Dirty,
adds source dependence, and would make results unreliable on drums, speech,
and polyphonic material. It belongs in a future source-aware distortion study,
not in the Comb beta.

### 2020 — energy-preserving time-varying Schroeder allpasses

Kurt James Werner, “Energy-Preserving Time-Varying Schroeder Allpass Filters,”
DAFx-2020, Vienna, 8–12 September 2020:
[venue paper](https://www.dafx.de/paper-archive/2020/proceedings/papers/DAFx2020_paper_59.pdf).

The proposed allpass realizations preserve energy while their gain changes
continuously; the paper also gives lower-multiply cascading and nesting forms.
A conventional time-varying Schroeder/first-order allpass does not inherit that
property merely because every frozen coefficient is stable.

**Disposition — promising post-beta implementation experiment, HIGH confidence
in the stability result and UNKNOWN confidence in the sound.** If a faster or
deeper Dispersion gesture is wanted, substitute an energy-preserving moving
allpass inside the same four-mode topology and compare it against the current
smoothed implementation. Do not change beta solely to make an academic claim.

### 2020 — FDN analysis toolbox and the reverb boundary

Sebastian J. Schlecht, “FDNTB: The Feedback Delay Network Toolbox,” DAFx-2020,
Vienna, 8–12 September 2020:
[venue paper](https://dafx.de/paper-archive/2020/proceedings/papers/DAFx2020_paper_53.pdf),
[author repository](https://github.com/SebastianJiroSchlecht/fdnToolbox).

FDNTB unifies modal decomposition, time-varying matrices, filter feedback
matrices, and attenuation design. It is valuable as an independent offline
analysis reference. Many showcased structures explicitly optimize echo density,
decorrelation, and reverberation.

**Disposition — use as an external analysis reference; do not copy code, HIGH
confidence.** The repository is GPL-3.0. SeqFX implementation remains
independently written, and topology additions must solve the Comb product job
rather than importing a reverb technique because the toolbox makes it easy.

## Foundational sources retained

These older sources still explain the beta topology more directly than the
recent reverb-optimization literature:

- Vesa Norilo, “Exploring the Vectored Time Variant Comb Filter,” DAFx-2014:
  [venue paper](https://www.dafx.de/paper-archive/2014/dafx14_vesa_norilo_exploring_the_vectored_ti.pdf).
  It frames chorus, flanger, tap delay, and pitch behavior as a vectored
  modulation-delay network and provides the precedent for small orthogonal
  coupling and efficient modulation.
- Elliot Canfield-Dafilou and Jonathan S. Abel, “Extensions and Applications of
  Modal Dispersive Filters,” DAFx-2019:
  [venue paper](https://www.dafx.de/paper-archive/2019/DAFx2019_paper_49.pdf).
  It supports interactively controlled inharmonic mode placement as a musical
  alternative to one rigid harmonic tooth series.
- Sami Oksanen, Julian Parker, and Vesa Välimäki, “Physically Informed Synthesis
  of Jackhammer Tool Impact Sounds,” DAFx-2013:
  [venue paper](https://www.dafx.de/paper-archive/2013/papers/26.dafx2013_submission_23.pdf).
  It supplies a concrete feedback-comb precedent for cascaded allpass
  dispersion, time-varying feedback, and DC blocking.

These sources justify ingredients, not an invention claim. SeqFX may claim only
its particular product combination and the evidence used to select it.

## Adopted now

1. Preserve an exact conventional neutral path at `Dispersion = 0`.
2. Preserve the fixed, small orthogonal vector network; it is legible and has a
   qualified four-chain cost rather than reverb-scale density.
3. Normalize feedback decay by effective path length so one Decay control has a
   coherent meaning across shifted modes.
4. Evaluate decay by frequency band, not only broadband RMS/T60.
5. Treat modal excitation as a sweet-spot diagnostic, not a target for
   colorlessness.
6. Require time-varying recursive changes to pass long-tail, extreme-sweep,
   cross-rate, and stability evidence; frozen-setting stability is insufficient.
7. Keep implementation independent. Papers and GPL analysis tools are evidence,
   not source-code donors.

## Rejected for the SeqFX Comb beta

- colorless-FDN objectives that flatten the intended resonant identity;
- paraunitary, velvet, or scattering feedback stages whose main purpose is
  rapid echo-density growth;
- room-impulse-response matching, neural parameter estimation, and learned room
  targets;
- per-mode matrices, per-mode tuning, or multi-band attenuation exposed as user
  controls;
- chaotic excitation replacing the user's input;
- guitar-specific harmonic separation feeding distortion;
- any “novel” topology that cannot reproduce the conventional reference at its
  neutral setting.

These are product rejections, not claims that the research is unsound. They
solve reverb, room-modeling, source-separation, or synthesis jobs that would
make this effect more expensive and less immediately understandable.

## Promising post-beta experiments

Run each behind the existing parameter wrapper and compare against the frozen
beta Comb. Do not combine experiments until one wins alone.

1. **Energy-preserving moving dispersion.** Replace only the moving allpass
   realization; keep the same modes, feedback matrix, and controls.
2. **Bounded orthogonal circulation.** Add one slow matrix-rotation macro in the
   lab, with losslessness and Tune invariance enforced by construction.
3. **Stable allpass fractional delay.** Compare a small precomputed design to
   current interpolation at sample-rate and Tune extremes.
4. **Constrained modal projection.** Reduce only pathological modal-energy
   outliers; do not optimize toward a flat or dense reverb response.
5. **Low-order spectral decay.** Compare two-to-four hidden attenuation bands
   against the current Damping law before considering any public control.

For every experiment, freeze impulse, noise-burst, drums, bass, chord, and
speech renders; level-match listening; measure Tune error, bandwise decay,
modal-energy distribution, stereo correlation, mono fold, transition jumps,
tail bounds, deterministic digest, and four-chain cost at 44.1, 48, 88.2, 96,
and 192 kHz.

## Decision boundary

No recent source reviewed through 2026-08-30 invalidates the qualified
vector-dispersive topology or supplies direct listening evidence for a better
step-sequenced Comb. Therefore beta topology is frozen.

A post-beta candidate may replace one internal component only after it shows a
wider immediate sweet spot in blind, level-matched listening and preserves the
existing reference-null, tune, mono, stability, tail, multirate, and cost gates.
Until that test is performed, descriptions such as “better,” “more musical,” or
“cutting edge” remain hypotheses, not findings.
