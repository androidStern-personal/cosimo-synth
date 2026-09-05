# Enhance That — L1 source handoff

## Status and boundary

Source candidate prepared September 5, 2026 from
`c297eeed62aec66e85118df06a229d9cdd8491da`, on `codex/enhance-that-plugin`.
Bob coordinates independent review, integration and resource slots. Reviewed
source `954207e4b19c6896e6a9ab1cd4b18a8bd566af06` passed its native VST3 build and
binary identity/signature readback. This record establishes source/UI/build
evidence, not installed-host automation, listening or release acceptance. L3
owns final downloads and clean macOS 15/26 qualification.

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
  manufacturer/plugin codes. Native readback below confirms the candidate's
  processor class ID and visible name.
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

The [bounded native proof proposal](ENHANCE_THAT_NATIVE_PROOF_PLAN.md) records
the actual generated AU target, exact command/output, registration identity
constraint, available free validators, separate slot needs and stop conditions.
It also outlines exact-binary VST3 automation/state and editor-notification
checks without a live DAW. It is a proposal, not executed qualification.

The VST3-only offline fixture source is prepared under
[`tools/enhance_that_native_probe`](../tools/enhance_that_native_probe/README.md).
It is a separate host with locked artifact hashes, eight-control assertions,
same/fresh-instance and repeated identical-state restoration, and owned evidence
and timeout handling. C++ configure/build and native execution remain held;
source/refusal checks do not establish host behavior or editor notifications.

Separate product metadata checkpoint `08885585` declares
`previousProductName: "CosimoEnhancerLite"` for L3's reviewed identity-gated
rename installer. It must integrate with L3's generic discovery/installation
contract; L1's older local kit parser does not yet accept that field. Actual
L3 discovery against this worktree's product files passes with the current and
prior basenames and all permanent identity fields preserved. No install ran.

The reviewed candidate's VST3 build and binary identity checks passed. Still
needed: enumerate all eight parameters through a native host, exercise
continuous/discrete automation and state restoration, and settle the AU outcome with a bounded
generated-project/free-host proof or explicit defer. Retain Apple Silicon macOS
15 and 26 in scope. Final signing/notarization, downloadable artifacts,
installation/rescan, disk-saved project recall, playback/offline export,
listening and clean supported Macs remain L3/Andrew acceptance surfaces.

## Native build and artifact readback — September 5, 2026

Exact product source: `954207e4b19c6896e6a9ab1cd4b18a8bd566af06`. Bob granted
the serialized native slot after independent source review. Command:
`COSIMO_CMAKE_JOBS=4 npm run fx:prod:build -- enhancer-lite`.

The current candidate compiler archive was installed with the canonical
`installArtifact` path and verified by `inspectTool` using both its archive
receipt and installed payload. Only the local `cmaj` toolchain metadata was
temporarily stamped for this build; its exact original bytes were restored
after success. No toolchain stamp or generated artifact is committed.

| Build provenance | SHA-256 / pin |
| --- | --- |
| Cmajor fork | `7820a453f25e1b6eaf898d0bb2feb7e4ce01c207` |
| Stock JUCE | `501c07674e1ad693085a7e7c398f205c2677f5da` |
| Compiler archive | `e9aa87339bdf1326459cfd67cc940057a5e438b831f02baef2fe0d9d10c54df4` |
| Raw compiler executable | `cd83280092e35ad7e3fa7c2824f52c171ee1ddc3ccad435caaa8a58debdd9c99` |
| Original/restored toolchain file | `ca0864d445f4ffa26598ef68de44c657f87418682f48d71340ce19d77fe32b3e` |
| Temporary toolchain file | `a9774776ec0e8cbbb0f97b8bee4cedad6c20a61b39604d6bb10de50fbc7e030c` |

Built artifact:
`build/enhancer_lite_juce/_build/plugin/EnhanceThat_artefacts/Release/VST3/EnhanceThat.vst3`.
The build-produced factory probe loaded this actual bundle and returned:

- Display name `Enhance That`, bundle ID `dev.cosimo.enhancer-lite`.
- Processor class ID `ABCDEF019182FAEB436F73694373454C`, matching the preserved
  manufacturer/plugin codes.
- Mach-O architectures `x86_64 arm64`.
- Deep strict code-signature verification passed. Signature is **ad hoc**, with
  no Team ID; this is not a notarized or releasable download.
- Binary SHA-256:
  `2675c6bb73a1d293b069fc592f96329d80d5c047c313b1b9b73452361a6a6c86`.
- Canonical `hashInstalledPayload` digest (includes relative names, modes and
  file bytes): `1abaa6e6558f2c407a7f52dd827fce3a9e9f16c27dd4a56bb2dacd550b2049a5`.

The production runtime has no `view.devModule`, and its graph exactly matches
the reviewed source with all eight automation annotations enabled. The native
build verifies the existing CHOC WebView markers. No compiler source rebuild,
plugin installation, DAW or AU-host launch, pluginval, native automation/state
playback or listening occurred in this slot. AU source files listed under the
VST3 target are JUCE's format-guarded compilation units, not a built AU result.
