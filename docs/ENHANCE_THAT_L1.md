# Enhance That — L1 source handoff

## Status and boundary

Source candidate prepared September 5, 2026 from
`c297eeed62aec66e85118df06a229d9cdd8491da`, on `codex/enhance-that-plugin`.
Bob coordinates independent review, integration and resource slots. This record
is source/UI evidence, not installed-host automation, listening or release
acceptance. L3 owns the final downloads and clean macOS 15/26 qualification.

## Observable change

The plugin is presented as **Enhance That** in its manifest, editor heading,
accessible response label and generated package name (`EnhanceThat.vst3`). The
existing eight sound controls now declare `automatable: true`. A changed button
selection or standalone arrow-key step sends one begin/value/end gesture. A pointer drag
begins each changed parameter once and closes it on release, cancellation,
lost capture or editor removal. Modifier changes can add Q to the same drag.
Arrow keys editing a parameter already touched by the pointer reuse its gesture;
they do not open a nested gesture or close the pointer's host touch. Incoming
host parameter notifications update the display without writing
values or gestures back to the host.

The endpoint inventory remains:

| Control | Permanent endpoint | Existing range / choices |
| --- | --- | --- |
| Frequency | `freqHzIn` | 20–20,000 Hz; default 130 |
| Q | `qIn` | 0.1–10; default 0.71 |
| Routing | `modeIn` | Stereo / Mid/Side; default Stereo |
| Mid Amount (host label Amount / Mid) | `midAmountIn` | 0–1; default 0 |
| Side Amount (host label Side) | `sideAmountIn` | 0–1; default 0 |
| Character | `curveIn` | Tube / Solid; default Solid |
| Intensity | `saturationModeIn` | Subtle / Medium; default Subtle |
| Shape | `shapeIn` | Low / Bell / High; default Bell |

Parameter order, types, labels, groups, defaults, ramps and discrete steps are
unchanged. The DSP, its smoothing and analyzer, spectrum geometry, pointer/key
movement laws, serialized sound format, factory presets and stored-state keys
are byte-identical to the base. No synth, Polish, SeqFX or shared kit production
code changed. The only kit edit updates its preview test's expected name.

## Identity and notification trace

- Manifest ID / bundle ID: `dev.cosimo.enhancer-lite`; plugin code `CsEL`;
  manufacturer code `Cosi`; manufacturer `Cosimo`; version `0.1.0`. Unchanged.
- The DSP graph remains `CosimoEnhancerLite`; CLI alias remains `enhancer-lite`.
  Preset effect ID remains `enhancer-lite`, including the original legacy-bank
  identity exception. The new CMake target and package basename are
  `EnhanceThat`, matching the generator's manifest-name derivation.
- Pinned Cmajor `7820a453f25e1b6eaf898d0bb2feb7e4ce01c207` exposes endpoint
  `automatable` through `Parameter::isAutomatable()` in `cmaj_JUCEPlugin.h`.
  Its client `send_gesture_start/end` messages reach the parameter's JUCE
  `beginChangeGesture/endChangeGesture` callbacks. Value writes reach
  `PatchParameter::setValue`; incoming values arrive on the view's parameter
  listeners. The existing shared preset application already brackets writes.
- Cmajor's generated JUCE project explicitly sets
  `JUCE_VST3_CAN_REPLACE_VST2=0`; with pinned stock JUCE
  `501c07674e1ad693085a7e7c398f205c2677f5da`, VST3 class IDs derive from the
  manufacturer/plugin codes. Native binary identity still needs readback.
- Native saved state uses endpoint ID/value pairs (`PARAMS/PARAM` with `ID/V`)
  plus the existing stored-state values. Presentation is not the parameter
  identity. Exact old/new host-project recall remains an explicit host gate.

The renamed bundle retains the same permanent identity. L3 must qualify an
upgrade from an existing `CosimoEnhancerLite.vst3` without leaving both old and
new filenames in a host's scan directory. Do not alter permanent codes to hide
duplicate discovery, or replace an unrelated plugin.

## Focused proof

- `npm run test:enhancer-lite:state`: 61 passed, no skips. Covers saved-state
  validation/round trips, factory inventory, DSP/smoothing contracts and actual
  discovery/identity/build configuration.
- `npm run fx:build -- enhancer-lite`: worktree-local runtime built successfully.
- `node --test kit/tests/test_effect_browser_preview_browser.mjs
  tests/test_enhancer_lite_view_browser.mjs`: 51 passed, no skips. Both source and
  packaged view exercise all eight controls' gesture messages, multi-parameter
  drag/modifier behavior and incoming-host-value/editor-reopen behavior. The
  same suite retains layout, gestures, analyzer, factory/user presets,
  legacy-bank isolation and A–G snapshot checks.
- The eight source/packaged readout/graph keyboard-during-drag cases failed on
  `d8e9ee69` and passed after the ownership repair. They include repeated keydown
  while the pointer remains held, continued pointer motion, release and cancel,
  exactly one closing notification, and a subsequent standalone key gesture.
- `npm run typecheck`: passed.
- `git diff --check`: passed.

Browser host bindings are recording adapters at the actual patch-connection
interface. They establish the UI message contract, not DAW automation recording,
binary state serialization or audible playback. Existing native keyboard
forwarding code and pins are untouched; Space/text/drag ownership must be
rechecked in the final host composition.

## Bounded AU feasibility and remaining work

The existing Cmajor generator includes AU among its generated formats; the
production CLI builds/installs only VST3. Official JUCE
[AudioPluginHost](https://github.com/juce-framework/JUCE/blob/master/extras/AudioPluginHost/AudioPluginHost.jucer)
includes AU hosting and provides a no-purchase host option. A bounded compiled
AU/free-host proof is technically available without a JUCE fork or Logic check.
No AU support claim is established yet. The historical generic-AU notification
crash in `kit/docs/HOST_COMPATIBILITY.md` is not evidence that this compiled
candidate fails, nor that it is fixed.

After review and Bob's native slot grant: build the exact candidate, verify
binary identity and all eight host parameters, exercise continuous/discrete
automation and state restoration, and settle the AU outcome with a bounded
generated-project/free-host proof or explicit defer. Retain Apple Silicon macOS
15 and 26 in scope. Final signing/notarization, downloadable artifacts,
installation/rescan, disk-saved project recall, playback/offline export,
listening and clean supported Macs remain L3/Andrew acceptance surfaces.
