# T27 Polish Voicing Lab

`Polish Voicing Lab` is an internal, independently named Cmajor effect for
auditioning and tuning the compressor/clipper direction before T28 freezes the
production Polish section. It is loaded through the repo-patched generic
`CmajPlugin.vst3`; it is not connected to the synth, Distortion, Effects Lane,
or final output path.

## Evidence boundary

The complete provenance and byte-level evidence live in
`SAUSAGE_FATTENER_ANALYSIS.md` and
`reference_labs/polish_comp_clip/fixtures/decoded-settings.json`.

- The closed-source original was not inspected, copied, rendered, or measured.
- Polarity reports that his public Bitwig recreation nearly nulls against the
  original. T27 preserves that as his report; it did not repeat the null test.
- The input/output trims, compressor records, curve knots/tensions/drive, and
  three macro target records are decoded preset facts with retained offsets and
  IEEE-754 payloads.
- Detector behavior, ratio conversion, odd symmetry, inter-knot interpolation,
  and every additional tuning control are open Cosimo lab choices.

The plugin product surface never uses the source product's name or interface and
contains no original code or binary material.

## Signal path and decoded start

The live path is:

```text
exploratory low cut (0% at reset)
→ input trim + Amount drive
→ stereo-linked compressor
→ exploratory color EQ (flat at reset)
→ 4× oversampled decoded or point-edited symmetric transfer curve
→ output trim
```

`Restore decoded start` resets the reproducible slice to:

- input trim `-0.2850170805322976 dB`;
- threshold `0 dB`, ratio `11.415525114155871:1`, knee `0 dB`,
  attack `0.20511621788255668 ms`, release `26.79168324819022 ms`,
  and makeup `-0.04000000000000409 dB`;
- clip drive `-0.01920000000000002 dB` and the four decoded transfer
  knots retained in the fixture;
- output trim `+0.16666666666666702 dB`;
- Amount input range `+35.971200000000394 dB` and makeup range
  `+4.120000000000003 dB`.

Cmajor parameters are `float32`, so the executable annotations contain the
nearest representable single-precision values. The exact doubles remain the
authority and tests require each plugin default to round to the same `float32`.

## Deliberate lab choices and unreproducible details

- The preset stores a normalized ratio-map amount of
  `-0.025200000000000014`, but its target's nonlinear normalization is not
  public. The plugin therefore exposes `Ratio Target`, reset to `1000:1`, as an
  honest tunable approximation of the documented movement toward limiting. It
  does not pretend that `1000:1` was decoded.
- The embedded low-cut convolution IR is not redistributed. `Low Cut Mix`,
  cutoff, and 6/12/24 dB-per-octave choices are new tuning tools and reset to
  0% mix.
- The saved Color EQ is flat, and its macro movement was not fully decoded.
  Frequency, gain, and Q are therefore exploratory parametric controls and
  reset flat.
- Bitwig's detector, channel-link law, curve interpolation, and oversampling are
  not encoded publicly. Peak/gain-reduction smoothing, odd symmetry, the
  documented monotonic tension warp, and fixed 4× clipper oversampling are
  transparent Cosimo implementations.
- The optional point editor is a new Cosimo sound-design model, not decoded
  behavior and not an inference about the closed product. It intentionally uses
  only anchors and one bend per incoming segment. The decoded curve remains a
  separate, exactly resettable mode and a fixed dashed visual reference.
- Variable lookahead is intentionally absent. Cmajor processor latency is a
  compile-time frame count; a 0–4 ms control cannot report changing latency to
  Ableton correctly across sample rates. T28 must settle one fixed lookahead and
  prove host compensation separately.

The UI exposes dry/processed A/B and 20 Hz input peak, output peak, input RMS,
output RMS, RMS delta, gain reduction, and clip-activity readings. Output Trim
is the manual level-match control; the plugin does not hide a moving auto-gain
stage behind the comparison.

## Sound-design surface

The first static transfer preview was rejected because it described the sound
without letting the sound designer manipulate it. The current UI replaces that
preview with two large, authoritative direct-manipulation graphs:

- The compressor graph plots detector input dB against the current static
  output, including Amount-shaped ratio/makeup and parallel Comp Mix. Threshold
  drags horizontally; Ratio and Makeup drag vertically; Knee drags its shaded
  width horizontally. The knee shape itself is the fixed quadratic used by the
  DSP—there is no undocumented or guessed shape parameter. Below 50% macro
  influence, the Ratio handle owns the base `Ratio`; at or above 50% it owns
  `Ratio Target`. The live readout names which real host endpoint owns the
  gesture, so no duplicate "effective ratio" state is created.
- The clipper graph is a positive-magnitude editor; the DSP mirrors the same
  curve onto negative samples with odd symmetry. The solid line is the exact
  current mixed clipper output, while the dashed decoded-start curve stays
  fixed as a reference during every edit. Moving Drive shifts the first-point
  boundary. Clip Mix remains an ordinary numeric control outside the graph
  because it is not curve geometry.

`Start point editor` is an explicit model change. It keeps the three decoded
anchor coordinates, changes their interpolation to straight segments, and then
lets the sound designer add or remove anchors and bend every segment. That
transition can change the sound; it is never presented as a lossless conversion
of the decoded tension curve. `Use decoded curve` temporarily returns to the
decoded interpolation using the current decoded coefficients, and `Resume point
editor` restores the editor shape without reinitializing it. Only `Restore
decoded start` returns every decoded coefficient and editor-only value to the
retained fixture baseline.

The point editor's complete vocabulary is deliberately small:

- the origin is fixed at `0 → 0`;
- two to seven positive anchors move freely in both dimensions, subject to
  increasing input and nondecreasing output so the result remains a clipper
  rather than silently becoming a foldback waveshaper;
- one orange diamond bends each incoming segment from concave through straight
  to convex while preserving both endpoints;
- output holds at the final anchor, making that anchor the ceiling;
- selecting one anchor and choosing `Move with Amount` adds one mint 100%
  target. The existing `Amount ^ Amount Curve` position moves that anchor from
  its base to the target, including both input and output coordinates.

Adding a point places it on the current curve and splits that segment; removing
a point merges its neighbors. The selected point exposes exact base input,
output, incoming bend, and optional Amount-target coordinates directly above
the graph. The large point, bend, and segment targets use geometric ownership,
so short transitions remain grabbable where touch areas overlap.

All graph targets are at least 44 CSS pixels, use relative pickup with no value
jump, publish the real host gesture transaction for every affected coordinate,
show a fixed finger-clear numeric readout, and restore the exact raw starting
values on Escape, pointer cancellation, or teardown. Graph geometry is derived
entirely from Cmajor parameter state, including the editor point count, bends,
and Amount target, so numeric edits, automation, saved host state, and decoded
reset reconstruct the same paths and handles without private shape state. The
raw decoded point/tension coefficients remain available for exact entry under
the closed-by-default `Advanced Reference` disclosure; editor-only state is
hidden from the generic knob grid and owned by the graph-first interface.

The compressor operating point is emitted by the real detector and smoothed,
mix-aware compressor output. Its separate gain-reduction history is the live
view of attack/release behavior; attack and release are intentionally not
misrepresented as static transfer geometry. The clipper operating point pairs
the actual pre-Drive sample with that channel's mixed clipper output and changes
color when the driven magnitude crosses Knot 1.

Every voicing decision is editable in the lab window:

- Amount, Amount curve, input trim, output trim, macro input range, macro makeup
  range, and limiting-ratio target;
- low-cut mix, cutoff, and 6/12/24 dB-per-octave slope;
- post-color frequency, gain, and Q;
- compressor threshold, ratio, knee, attack, release, makeup, Peak/RMS detector,
  RMS window, detector high-pass, stereo link, and parallel mix;
- clip drive and wet mix; the exact decoded point/tension coefficients remain
  editable under `Advanced Reference`, while the optional point editor exposes
  two to seven anchors, one bend per segment, and one Amount-movable anchor
  directly on the graph.

`Amount Curve` applies the explicit lab formula
`normalized Amount ^ Amount Curve`: `1` is linear, values above `1` reserve
most macro movement for the top of the Amount knob, and values below `1` bring
the movement in earlier. At curve `4`, 50% Amount produces 6.25% of the macro
movement.

Hovering any of the 36 visible controls shows a concise in-plugin explanation;
focusable controls show the same help on keyboard focus. Each control also
carries the explanation as an accessibility description. The browser gate
requires every visible endpoint to have specific help text and verifies that
the rendered tooltip stays inside the plugin viewport.

`Restore decoded start` is the repeatable baseline. `Hear dry`/`Hear processed`
is a bit-exact bypass comparison, and the meters expose the gain and level
consequences while tuning.

## Repeat and install

```sh
npm run test:reference:polish
npm run test:polish:lab
npm run cmajplugin:build
npm run cmajplugin:install
npm run fx:jit:install -- polish
```

The final command builds the self-contained runtime under
`build/fx/polish_lab_runtime/`, validates it in Cmajor, validates the patched and
signed installed generic VST3, and writes
`~/Library/Audio/Plug-Ins/VST3/CmajPlugin.json` to associate the VST3 with that
compiled patch. It does not install or touch the unsafe generic AU loader.

The retained corpus and level-matched 0/50/100 Amount renders remain in
`reference_labs/polish_comp_clip/`; their hashes and measurements are verified by
`npm run test:reference:polish`.

## Validation retained for this task

On 2026-08-26, `npm run fx:jit:install -- polish` associated the compiled patch
with the strictly codesign-valid repo-patched VST3 at
`~/Library/Audio/Plug-Ins/VST3/CmajPlugin.vst3`. Ableton Live 11.3.43 created and
then restored the processor successfully on the selected audio track. A seeded
pluginval strictness-5 pass independently exercised cold/warm open, audio,
state, automation, parameters, and stereo buses at 44.1/48 kHz with 64/512-frame
blocks. Exact hashes, Live log lines, the pluginval transcript, and the
controller-state warning boundary are retained in
`reference_labs/polish_comp_clip/validation/`.

The browser view gate uses the pinned real Cmajor parameter-control factory,
not simplified substitute elements. It requires painted geometry for a
representative knob, switch, and option selector, which protects the exact
theme-token contract used by Ableton's embedded view.

On 2026-08-27, the graph-first point-editor follow-up passed 7/7 Node/browser
checks and 5/5 Cmajor checks. The independent reference gate remained 7/7 and
reverified 21 retained WAV files and nine comparisons. The current compiled DSP
SHA-256 is `92ef3c14ec746f556c906729596343d288f1ee29968f6eb7e6053618162144f3`;
the compiled UI SHA-256 is
`a7d7b8cd8b8602ac1a3f5c144ef7c846248b73e7c7cc75983ff2fa8a033a7c85`.
A fresh pluginval strictness-5 run with seed `0x27a8` passed editor open while
processing, editor automation, state, parameters, stereo buses, and audio at
44.1/48 kHz with 64/512-frame blocks. Ableton Live 11.3.43 also freshly created
the installed processor and reported all 2,081 parameters. App automation could
not press the embedded device's non-accessible wrench, so this follow-up claims
a fresh Ableton processor instantiation plus compiled-editor visual and gesture
proof—not a fresh Ableton custom-editor gesture or listening verdict.

A fresh generic-loader rebuild on this machine stopped in pinned upstream
Cmajor code because Xcode beta promotes an implicit integer-to-float conversion
in `cmaj_PatchHelpers.h:491` to an error. T27 did not weaken warning policy or
silently patch third-party source; it validated and used the already-installed
repo-patched loader. This is a loader build-environment limitation, not a lab
DSP compile or installed-host failure.
