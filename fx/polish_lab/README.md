# Curve Lab

Curve Lab is an internal, independently named Cmajor effect for finding a
compressor and waveshaper sound by direct manipulation. It is loaded through
the repo-patched generic `CmajPlugin.vst3` and remains disconnected from the
production synth, Distortion, Effects Lane, Polish section, and final output.

## Usable surface

The custom editor deliberately exposes only seven continuous controls:

- compressor Threshold, Ratio, Knee, Attack, Release, and Makeup;
- one Waveshaper Morph control.

The compressor graph uses the same threshold, quadratic knee, ratio, and
makeup equation as the DSP. Its T, R, K, and M handles edit those parameters
directly. The detector is fixed to peak, stereo linking is fixed at 100%, and
the processed path is fixed fully wet. Attack and Release remain ordinary
controls because they cannot be represented honestly on a static transfer
curve; the live gain-reduction trace shows their time behavior instead.

The waveshaper is one full bipolar input/output graph with a solid unity line
and visible `-1`, `0`, and `+1` landmarks on both axes. It starts with one
positive ceiling and one negative ceiling. The two sides are independent:

- add or delete up to seven points per side;
- drag a point freely in input and output;
- drag a curve segment vertically to bend it;
- edit the selected input, output, or bend as an exact number;
- use the final point on each side as that side's ceiling.

Inputs are kept in increasing order so the result remains a single-valued
transfer function. Raw host coordinates are retained exactly even when saved
state is non-monotonic; only the operating geometry is ordered. Outputs may
move anywhere from `-1.5` to `+1.5`, so folds and polarity crossings are
intentional possibilities rather than silently forbidden clipper behavior.

Each incoming segment uses one transparent Cosimo bend primitive:

```text
u' = u + bend * u * (1 - u),  bend in [-1, +1]
```

It preserves both endpoints. The last endpoint is held for larger input
magnitudes. Processing runs through the existing 4x Cmajor oversampling graph.

## Morph

Morph owns exactly one assigned point. The point itself is visible as A and a
second handle is visible as B. At Morph position `m` from 0 to 1, only that
point moves:

```text
current = A + (B - A) * m
```

Morph does not change gain, compression, makeup, bend, another point, or the
opposite side. `Use selected as A` assigns the selected point and initializes B
at the same position; dragging B or entering its exact numbers defines the
destination.

There is no graph Drive handle, Clip Mix, Amount curve, macro wiring, tone
stage, decoded mode, dashed reference curve, or exposed tension machinery in
this design surface. Those rejected controls are not dormant host parameters.

## State and interaction contract

Graph and numeric changes write ordinary Cmajor parameters, so host automation
and saved state reconstruct both graphs without private UI state. Point and
graph targets are touch-sized, axis-specific controls are locked to their
honest axis, acquisition is relative with no value jump, and a large live
readout appears during every graph gesture. Escape, pointer cancellation,
window blur, visibility loss, disconnect, and teardown end gesture ownership;
cancelled gestures restore the exact raw starting values.

Reset restores processed listening, a neutral 4:1 compressor with a 6 dB knee,
10 ms attack, 120 ms release, and 0 dB threshold/makeup, plus one `1 -> 1`
positive ceiling, one `-1 -> -1` negative ceiling, straight segments, Morph at
0%, A on the positive ceiling, and B at `0.72 -> 1.05`. Every inactive point
slot also resets deterministically.

## Evidence boundary

The original T27 extraction, numeric fixtures, retained audio corpus, renders,
and measurements remain in `reference_labs/polish_comp_clip/`. They preserve
four distinct kinds of evidence:

- facts decoded from the retained Bitwig preset;
- Polarity's report that his public recreation nearly null-tested against the
  closed product (the lab did not repeat that null test);
- the closed product itself, which was not inspected, copied, or redistributed;
- Cosimo's own equations and design choices.

The exact decoded compressor, gain, macro, drive, and transfer-curve values are
still pinned in that reference package. They are not the live editor defaults
and are not exposed as reference UI. The retained pure evaluator exists for
fixture verification only; active plugin DSP uses the bipolar editor model.

This is not a reproduction of proprietary behavior. The independent positive
and negative curves, bend primitive, peak/full-link compressor, neutral reset,
4x oversampling choice, and one-point linear Morph are documented Cosimo lab
decisions. No claim is made that they match an undocumented detector,
interpolation law, oversampling filter, interface, or sound from another
product.

## Repeat and install

```sh
npm run test:polish:lab
npm run test:reference:polish
npm run fx:jit:install -- polish
```

The installer builds the self-contained runtime under
`build/fx/polish_lab_runtime/`, validates it in Cmajor, validates the patched
and signed installed generic VST3, and writes
`~/Library/Audio/Plug-Ins/VST3/CmajPlugin.json` to associate that VST3 with the
compiled lab patch. It does not install or touch the generic AU loader.

Automated gates cover sampled compressor and waveshaper math, direct graph
writes, exact entry, live telemetry, reset, saved-state replay, and exact raw
gesture cancellation. Physical touch comfort and subjective sound acceptance
remain Andrew's listening decisions; prior Ableton evidence is not treated as
validation of a newly rebuilt editor.
