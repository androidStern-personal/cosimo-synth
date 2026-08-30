# Comb Lab Decision

Date: 2026-08-30

Command:

```sh
uv run pytest -q tests/test_seqfx_comb_lab.py
uv run python -m reference_labs.seqfx_comb.render_candidates \
  --check --output build/seqfx-comb-lab
```

Result: 8/8 lab tests pass. Twenty-one candidate/source WAVs plus
`metrics.json` are under `build/seqfx-comb-lab/`.

## Failure found before selection

The first implementation normalized `tanh(x * gain)` by `tanh(gain)`. That
made the saturator's small-signal slope greater than one and all three nominally
decaying feedback loops grew during the impulse tail. The lab rejected the run.

The corrected loop shaper has unity small-signal slope and blends toward
`tanh(x * gain) / gain`. All candidates then produced finite, decaying output.
This rule is now a production invariant: a feedback character stage may limit
large signals, but must not silently amplify the loop around zero.

## Comparable objective results

Default lab settings: 48 kHz, A3/220 Hz center, 0.8-second test decay for the
unit tests and 1.4 seconds for the complete render set.

| Candidate | Impulse tuning error | Pluck tuning error | Impulse tail late/early RMS | Impulse stereo correlation | Python impulse realtime factor |
|---|---:|---:|---:|---:|---:|
| Reference | -5.24 cents | -3.45 cents | 0.00022 | -0.486 | 25.83× |
| Dispersive | -5.24 cents | -6.12 cents | 0.00019 | 0.406 | 6.99× |
| Vector | -13.15 cents | -14.12 cents | 0.00025 | 0.701 | 3.21× |

The performance column measures unoptimized scalar Python, so it ranks the lab
candidates but does not predict Cmajor CPU. All three remain faster than real
time in the single-instance research render.

The dispersive candidate initially measured roughly -53 cents because its
right-channel allpass cascade was not included in delay compensation. Per-path
group-delay compensation reduced that to -5.24 cents in the mono measurement.

## Selection

Select a **vector-dispersive comb with a true reference neutral** for production:

- At `Dispersion = 0` and `Motion = 0`, use the one-delay reference path. This
  is the expected conventional Comb and the CPU/tuning fallback.
- As `Dispersion` rises, morph into four fixed bounded delay modes coupled by a
  normalized Hadamard matrix. Insert a short, compensated allpass dispersion
  section per feedback path.
- `Motion` adds small deterministic, phase-offset delay movement; it does not
  randomize the network or alter a latched Tune center.
- `Width` changes complementary output projection and reaches a documented
  mono-safe center. It does not rely only on right-channel phase inversion.
- `Drive` uses the unity-small-signal saturator proven by the lab.

Why this wins:

- Candidate A supplies the established neutral behavior but is not original.
- Candidate B earns material/string/spring-like modal bending and has the best
  advanced tuning result, but one dispersed line is less animated and less
  spatially rich than the requested signature effect should be.
- Candidate C supplies coupled moving modes and a strong architecture for
  animated stereo material, but its deliberately offset periods create more
  tuning error and it needs B's compensation/damping discipline.
- The selected topology combines the distinct contribution of B and C while
  retaining A as an exact neutral mode. This is allowed by the predeclared lab
  rule and does not copy a product implementation.

## Rejected alternatives

- **Reference only:** shippable as a utility, rejected as the requested
  cutting-edge signature.
- **Dispersive only:** musically promising, rejected as the sole advanced mode
  because the coupled network offers more controllable motion and spatial
  behavior.
- **Vector only:** rejected because its offset-mode tuning and damping are less
  controlled without explicit dispersion compensation.
- **Modal bank unrelated to a comb:** rejected because it would overlap the
  existing Spectral Chord Resonator and fail the neutral comb requirement.

## Production gates

The selection is conditional on Cmajor proving all of these:

- less than 20 cents error over the core tuned range, with note snapping using
  measured compensation;
- finite decaying output through maximum Decay/Drive/Motion aux sweeps;
- four-chain worst-case codegen and realtime CPU within the roadmap budget;
- exact deterministic output for the same state and transport history;
- useful mono fold at Width extremes;
- a neutral advanced setting that matches the reference path within the
  crossfade tolerance;
- listening acceptance on pluck, drums, bass, chord, and voice fixtures.

If the four-line production CPU gate fails, reduce allpass stage count or use
two coupled lines before changing the user-facing contract. Falling back to a
reference-only comb requires an explicit product decision; it is not an
automatic optimization.

## Production implementation

The selected topology is implemented in `fx/seqfx/SeqFx.cmajor` as effect ID
6. It keeps two deliberately separate signal paths:

- `Dispersion = 0` is a true stereo one-delay feedback comb. `Motion` is
  ignored there, so the neutral reference is exact and deterministic rather
  than an approximation made by collapsing the advanced network.
- Raising `Dispersion` morphs through the complete four-delay vector network.
  Its normalized Hadamard feedback rotation, four compensated allpass stages
  per path, deterministic quarter-cycle motion offsets, complementary stereo
  projection, damping, and unity-small-signal loop limiter remain active at
  the advanced end.

Tune is continuous and Aux-eligible, with a 10 ms smoothing path. The displayed
frequency is converted to a fractional delay and receives two measured phase
corrections: a small host-rate-independent reference correction, then an
octave- and Dispersion-dependent vector correction. The latter compensates
aggregate phase introduced by the four different dispersed loops; it becomes
exactly 1 at `Dispersion = 0` and is bounded to 0.96–1.04. These are measured
implementation corrections, not new user controls.

The loop also contains frequency-dependent damping and a 10 Hz DC blocker.
Continuous controls move over 10 ms; entering and leaving a block uses the
shared 96-frame routing crossfade. On release the comb stops accepting new
audio but its bounded tail continues additively until its measured energy is
quiet or the Decay-derived maximum age expires. An authoritative transport or
state reset clears every delay, allpass, damping, DC, modulation, and tail
state.

## Production evidence

Automated production probes establish:

- an impulse tail survives its trigger block and decays;
- the vector-dispersive mode measures within 20 cents at 110, 220, and 880 Hz;
- `Dispersion = 0` is bit-exact with Motion at either extreme while the
  advanced setting is materially different;
- Width has a mono-safe center, a distinct stereo extreme, and a nonzero mono
  fold;
- extreme Decay, Drive, Motion, Dispersion, and polarity states are
  deterministic, finite, bounded, and resettable;
- every continuous feedback control survives the shared Aux sweep;
- four worst-case generated-JavaScript chains remain inside the deliberately
  generous two-second fixture budget.

The UI exposes all eight effect-specific controls, uses the vendored Fontaudio
notch-filter glyph, persists sparse v7 state, and keeps stepped Polarity out of
Aux mapping. Source and packaged-browser tests cover selection, layout, state,
modulation rows, octave Tune mapping, and the live comb response glyph.

Checkpoint qualification passed 123 combined DSP/buffer/interpolation/lab
tests, 109 non-browser state and contract tests, all 59 source-browser tests,
all 7 explicitly packaged-browser tests, and Cmajor dry-run loading at 32,
44.1, 48, 88.2, and 96 kHz. The packaged harness now forces the packaged
branch so a live effects Vite server cannot silently substitute source UI;
automated source browsers remain hermetic while static contracts prove the
interactive React Grab imports.

Still intentionally unperformed at this checkpoint: matched-level listening
on the five musical fixtures, native-wrapper inspection, Ableton host
acceptance, and release CPU measurement. Those are final qualification gates;
the automated JavaScript budget is not represented as native realtime proof.
