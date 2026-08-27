# Ableton Live 11 VST3 validation — 2026-08-26

> **Current editor:** the chronological UI experiments below are retained as
> evidence, not as current product descriptions. Every pre-existing clipper,
> decoded-mode, dashed-reference, knot/tension, Drive, Mix, and Amount-editor
> surface is superseded by the 2026-08-27 bipolar Curve Lab replacement recorded
> below. The extraction/corpus evidence remains unchanged.

This record proves the independently named Polish Voicing Lab was associated
with the repo-patched generic Cmajor VST3 and instantiated by Ableton Live
11.3.43 on the retained audio-loop test track. It does not claim an Ableton
null test against any third-party product.

## Initial installed artifacts (2026-08-26; superseded)

- VST3 bundle: `/Users/winterfell/Library/Audio/Plug-Ins/VST3/CmajPlugin.vst3`
- VST3 binary SHA-256: `b7cf660de10a9bb381535db1df58775e6150ee449689a037d9ca19fad3846a87`
- Patch association: `/Users/winterfell/Library/Audio/Plug-Ins/VST3/CmajPlugin.json`
- Association SHA-256: `6862780413b71a932cdf286e40add2ecfbdb9ecf224f9e92ca6bbe66b8688fe5`
- Associated patch: `/Users/winterfell/.codex/worktrees/a68e3ac6-eb15-442d-9a2e-af21dae745ad/cosimo-synth/build/fx/polish_lab_runtime/PolishVoicingLab.cmajorpatch`
- Compiled patch SHA-256: `21c9c4312313a832be1735b9f0a7e37a604167dac1c5b15c02aecbbb51515377`
- Compiled DSP SHA-256: `ff04cf55aa39bc45a5faf5aa59955b821a895d1c4b05c95e7ae94fcfa1196b56`
- Compiled graph SHA-256: `f2909d3abfb1ca36f4f66ab708d95ad9c35abf420cac4cad6c371ab93f9b7728`
- Compiled UI SHA-256: `e33d78ad56feeb7bf5a633acff2802998085fb7bc50202efd4ba31a25d264739`

`codesign --verify --deep --strict` reported the installed bundle valid on disk
and satisfying its designated requirement. `npm run fx:jit:install -- polish`
also required the repo's patched CHOC keyboard-bridge markers before writing the
association.

## Ableton host evidence

The device was loaded from Live's browser onto the selected audio track. The
following lines are copied exactly from
`~/Library/Preferences/Ableton/Live 11.3.43/Log.txt`:

```text
2026-08-26T10:14:41.271267: info: VST3: Going to create: CmajPlugin
2026-08-26T10:14:43.034178: info: VST3: plugin processor successfully loaded: Cmajor Software Ltd 'CmajPlugin' v1.0.3066 (cid: {ABCDEF01-9182-FAEB-4D61-6E75436D616A})
2026-08-26T10:14:43.035237: info: VST3: parameter count is 2081
2026-08-26T10:14:43.035974: info: VST3: Created: CmajPlugin
2026-08-26T10:25:11.188589: info: VST3: Going to restore: CmajPlugin
2026-08-26T10:25:11.222730: info: VST3: plugin processor successfully loaded: Cmajor Software Ltd 'CmajPlugin' v1.0.3066 (cid: {ABCDEF01-9182-FAEB-4D61-6E75436D616A})
2026-08-26T10:25:11.223589: info: VST3: parameter count is 2081
2026-08-26T10:25:11.224083: info: VST3: Restored: CmajPlugin
```

Live also logged `couldn't get controller state of CmajPlugin: not implemented`
after the first creation. That is a known generic-loader controller-state
message, not a processor-load failure; it is recorded here rather than hidden.

## Direct-manipulation follow-up

The earlier knob-only/non-interactive transfer UI was rejected as insufficient
for sound design. After the direct-manipulation compressor and clipper graphs
were built into the runtime and the association above was reinstalled, a fresh
verification used a disposable Ableton audio track named
`T27 FINAL VERIFY TEMP`. Ableton's browser loaded
`query:Plugins#VST3:Cmajor%20Software%20Ltd:CmajPlugin`; the device was enabled,
and the following fresh processor evidence was copied exactly from Live's log:

```text
2026-08-26T14:14:15.884188: info: VST3: Going to create: CmajPlugin
2026-08-26T14:14:15.917391: info: VST3: plugin processor successfully loaded: Cmajor Software Ltd 'CmajPlugin' v1.0.3066 (cid: {ABCDEF01-9182-FAEB-4D61-6E75436D616A})
2026-08-26T14:14:15.918176: info: VST3: parameter count is 2081
2026-08-26T14:14:15.918632: info: VST3: Created: CmajPlugin
```

The temporary track was deleted immediately after inspection; the Live set
returned from four tracks to its original three, and no temporary track
remained. No parameter on the pre-existing CmajPlugin, Serum, Spectre, or
CosimoEnhancer devices was edited.

Live's exposed accessibility surface could select the device and invoke the
View > Plug-In Windows command, but could not invoke the non-accessible plug-in
wrench after this fresh load (`AXError.notImplemented`). Therefore this record
claims a fresh Ableton processor instantiation, not a fresh Ableton custom-editor
interaction pass. Direct graph geometry and gestures are proven separately by
the real Cmajor-control Playwright gate, including exact DSP endpoint writes,
knob-to-graph synchronization, real telemetry coordinates, cancellation, and
reset/state restore. This limitation is retained explicitly rather than filled
with a guessed visual result.

## Graph-first interaction repair — 2026-08-27

The first direct-manipulation clipper graph was rejected after use: its visible
T1/T2/T3 controls suggested freely editable geometry but were constrained
single-coefficient controls, the working points were axis-locked, and the short
ceiling segment could lose pointer ownership to overlapping point targets. That
surface is superseded rather than relabeled as acceptable.

The installed lab now shows the decoded-start curve as an immutable dashed
reference and the editable curve as the solid working line. The positive
magnitude view spends the full graph area on the editable half of the odd-
symmetric lab transfer. Each working point owns both input and output in one
relative two-dimensional gesture; dragging a visible segment writes that
segment's exact DSP curvature coefficient. Raw point and curvature values remain
available for exact entry under closed-by-default `Advanced Reference`.

The real-control browser gate proves the overlap boundary explicitly: the
midpoint of the decoded short ceiling transition opens `curveP3T`, while the
exact point centres still open their paired X/Y endpoints. It also proves
no-jump pickup, exact writes, host gesture bracketing, multi-coordinate and
segment Escape restoration, immutable decoded geometry, signed DSP telemetry on
the magnitude view, and deterministic reset plus host-state reconstruction of
both graphs. `npm run test:polish:lab` passed 6/6 Node/browser tests and 4/4
Cmajor tests; `npm run test:reference:polish` independently passed 7/7 and
revalidated all 21 retained WAV artifacts and nine level-matched comparisons.

`npm run fx:jit:install -- polish` rebuilt and associated this runtime. Strict
code-sign verification passed for the installed VST3. A disposable Ableton
audio track named `T27 GRAPH FIX FINAL TEMP` loaded `CmajPlugin` as an enabled
audio effect, then was deleted; the set returned from two tracks to its original
two. The fresh processor lines are:

```text
2026-08-27T11:31:58.604549: info: VST3: Going to create: CmajPlugin
2026-08-27T11:31:58.641537: info: VST3: plugin processor successfully loaded: Cmajor Software Ltd 'CmajPlugin' v1.0.3066 (cid: {ABCDEF01-9182-FAEB-4D61-6E75436D616A})
2026-08-27T11:31:58.642266: info: VST3: parameter count is 2081
2026-08-27T11:31:58.642816: info: VST3: Created: CmajPlugin
```

The local app-control pass again exposed only Live's main standard window and
could not surface the temporary device's non-accessible plug-in window. It did
not establish a fresh custom-editor pass in Ableton, and this record makes no
such claim. The actual editor appearance was reviewed from the compiled runtime
in Chromium using the pinned real Cmajor controls; Ableton proof remains the
fresh enabled processor instantiation above.

## Control-rendering repair

A follow-up Ableton inspection found that the control labels and layout boxes
were present while the actual knobs, switch, and option outlines were not
painted. The original browser view test had substituted plain buttons for
Cmajor's stock controls, so it could not reproduce that failure.

The browser gate now imports the pinned real `cmaj-parameter-controls.js`
module. Before the repair, the real Attack knob measured at least 70 px in both
dimensions but its computed SVG track stroke was exactly `none`; the Bypass
switch and Detector selector likewise had no painted border. The lab now
provides the stock factory's required `--foreground` and `--background` theme
contract while keeping labels on the lab's neutral ink color. The repeatable
gate asserts non-zero geometry and painted knob, switch, and selector parts.

After rebuilding and rerunning `npm run fx:jit:install -- polish`, the already
open Ableton VST3 window was inspected again. The orange rotary controls,
Bypass switch, Slope selector, and Detector selector were visibly painted while
the saved parameter values remained restored. This repair changes only the
isolated lab view; it does not change DSP or any production Cosimo surface.

A later usability pass added specific hover help for all 36 visible controls.
The browser gate proves complete endpoint coverage, the exact Amount Curve
formula explanation, visible placement inside the viewport, dismissal, and
matching accessibility descriptions. After reinstalling the same isolated
runtime, the active Ableton window visibly rendered the custom Release tooltip
above its knob; the user's tuned Amount, dynamics, tone, and curve values were
not changed during that inspection.

## Arbitrary point-editor follow-up — 2026-08-27

Andrew replaced the confusing exposed knot/tension experiment with a new,
explicit Cosimo lab mode: a fixed origin, two to seven positive anchors, one
direct bend per segment, a final ceiling, odd-symmetric negative mirroring, and
one optional point trajectory driven by shaped Amount. This model is not
decoded or inferred proprietary behavior. Entering it keeps the current decoded
anchor coordinates but intentionally replaces decoded tension interpolation
with straight, individually bendable segments; the immutable dashed reference
and exact decoded reset remain separate.

`npm run test:polish:lab` passed 7/7 Node/browser checks and 5/5 Cmajor checks.
The compiled-browser gate directly moves, adds, removes, and bends points; edits
the 100% Amount target; proves the Amount endpoint changes the heard curve;
checks exact host writes and gesture bracketing; resumes an editor shape after a
temporary decoded-mode comparison; and reconstructs graph geometry from reset
and saved host state. `npm run test:reference:polish` independently remained
7/7 and reverified all 21 WAVs and nine comparisons.

`npm run fx:jit:install -- polish` associated the current runtime with the
strict-code-sign-valid installed VST3. Current hashes are:

- installed VST3 executable:
  `b7cf660de10a9bb381535db1df58775e6150ee449689a037d9ca19fad3846a87`;
- association:
  `6862780413b71a932cdf286e40add2ecfbdb9ecf224f9e92ca6bbe66b8688fe5`;
- compiled Cmajor source:
  `92ef3c14ec746f556c906729596343d288f1ee29968f6eb7e6053618162144f3`;
- compiled UI:
  `a7d7b8cd8b8602ac1a3f5c144ef7c846248b73e7c7cc75983ff2fa8a033a7c85`.

Ableton Live 11.3.43 loaded CmajPlugin onto a fresh audio track in the disposable
Untitled set. The fresh host lines are:

```text
2026-08-27T15:36:02.453554: info: VST3: Going to create: CmajPlugin
2026-08-27T15:36:06.749908: info: VST3: plugin processor successfully loaded: Cmajor Software Ltd 'CmajPlugin' v1.0.3066 (cid: {ABCDEF01-9182-FAEB-4D61-6E75436D616A})
2026-08-27T15:36:06.751506: info: VST3: parameter count is 2081
2026-08-27T15:36:06.752196: info: VST3: Created: CmajPlugin
```

The device remains loaded for Andrew's follow-up. Local app automation exposed
Live's browser and menus but could not press the device's non-accessible wrench,
so it did not establish a fresh Ableton custom-editor gesture pass. The current
compiled editor was instead visually inspected from the real Cmajor-control
browser bundle, and its gestures were exercised by that compiled gate. No
subjective listening or physical-touch acceptance is claimed.

A fresh pluginval 1.0.4 strictness-5 run with seed `0x27a8` completed with
`SUCCESS`. It opened the editor cold and warm, opened it while processing,
exercised editor automation, processed audio at 44.1/48 kHz with 64/512-frame
blocks, and passed plugin state, automation, parameters, and stereo buses. The
new transcript remains at
`build/pluginval-polish-point-editor/pluginval.txt`; build artifacts are not
source-controlled evidence.

## Bipolar Curve Lab replacement — 2026-08-27

Andrew rejected the accumulated reference/editor machinery and requested a
small usable sound-design tool. The installed editor now contains only the six
compressor controls and one Morph knob. Its waveshaper is a full bipolar graph
with one solid unity line, explicit `-1/0/+1` landmarks on both axes, one
independent ceiling per side, freely moved points, direct segment bending,
add/delete, exact entry, and visible Morph A/B positions. Morph linearly moves
one assigned point and changes no other value. The live design surface contains
no graph Drive, Clip Mix, macro wiring, tone stage, decoded mode, dashed
reference, knot, or tension control.

The complete final gate passed 14/14 Node/browser checks and 6/6 Cmajor checks.
It includes real stock Cmajor controls, exact DSP-facing graph writes, Ratio-to-
curve correspondence, independent positive/negative ceilings, bend sampling,
add-point sound continuity, one-point Morph, reset/state replay, telemetry, and
exact raw restoration on Escape, `pointercancel`, blur, disconnect, and teardown.
The isolated reference gate independently remained 7/7 and reverified all 21
WAVs and nine comparisons with worst RMS match `1.742e-7 dB`.

`npm run fx:jit:install -- polish` rebuilt and associated the runtime. The
installed VST3 passed strict deep code-sign verification. Current hashes are:

- installed VST3 executable:
  `b7cf660de10a9bb381535db1df58775e6150ee449689a037d9ca19fad3846a87`;
- association:
  `6862780413b71a932cdf286e40add2ecfbdb9ecf224f9e92ca6bbe66b8688fe5`;
- compiled patch manifest:
  `85b9fc79fb4b056cb9ac76564739d1d2e70353443a38d77d6b7dc2b78b463b26`;
- compiled Cmajor source:
  `7ce5b0801da3e27d0a1f600f55036022ffc9218b9f95021c526e72dcb74271b9`;
- compiled UI:
  `c1218142617d3719bdc85e63247e0f5874de88050d01206f6ac80760e78936a8`.

A fresh pluginval 1.0.4 strictness-5 run with seed `0x27a8` finished with
`SUCCESS`. It opened the editor cold and warm, opened it while processing,
exercised editor automation, processed 44.1/48 kHz audio at 64/512-frame blocks,
and passed plugin state, automation, parameters, and stereo buses. The generated
transcript is at `build/pluginval-polish-curve-lab/pluginval.txt` and is not a
source-controlled artifact.

Ableton Live 11.3.43 loaded the rebuilt association onto a fresh audio track.
The exact new host lines are:

```text
2026-08-27T19:27:39.095413: info: VST3: Going to create: CmajPlugin
2026-08-27T19:27:39.129196: info: VST3: plugin processor successfully loaded: Cmajor Software Ltd 'CmajPlugin' v1.0.3066 (cid: {ABCDEF01-9182-FAEB-4D61-6E75436D616A})
2026-08-27T19:27:39.130162: info: VST3: parameter count is 2081
2026-08-27T19:27:39.130636: info: VST3: Created: CmajPlugin
```

Ableton's accessible surface could instantiate and select the device but could
not invoke its non-accessible wrench, so this is a fresh processor-load check,
not a fresh custom-editor gesture claim. The compiled editor was visually
reviewed separately and its gestures were exercised by the real-control browser
gate. No subjective listening or physical-touch acceptance is claimed.

## Independent host pass

The exact pluginval transcript is retained in `pluginval.txt`. With random seed
`0x6993` and strictness 5, the installed VST3 passed cold/warm open, audio
processing at 44.1/48 kHz and 64/512-frame blocks, plugin state, automation,
automatable parameters, stereo bus enable/disable/restore, and finished with
`SUCCESS`.

This triangulates the Ableton instantiation with a separate host's audio,
automation, and state tests. No Ableton audio render or subjective listening
verdict is claimed; the retained deterministic corpus/render bundle remains the
level-matched measurement authority for T28.

## Build boundary

A fresh rebuild of the generic loader was attempted on this machine. Xcode beta
stopped in pinned upstream Cmajor helper code at
`include/cmajor/helpers/cmaj_PatchHelpers.h:491` because an implicit
`uint64/size_t` to `float` conversion is treated as an error. T27 did not weaken
warning policy or silently patch third-party source. The already-installed,
repo-patched loader above was therefore validated and used.
