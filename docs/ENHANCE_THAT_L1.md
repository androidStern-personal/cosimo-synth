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
and timeout handling. The frozen fixture was subsequently compiled and run;
the state qualification failure is recorded below. Editor notifications remain
unproven, and further native execution requires Bob's routing.

Separate product metadata checkpoint `08885585` declares
`previousProductName: "CosimoEnhancerLite"` for L3's reviewed identity-gated
rename installer. It must integrate with L3's generic discovery/installation
contract; L1's older local kit parser does not yet accept that field. Actual
L3 discovery against this worktree's product files passes with the current and
prior basenames and all permanent identity fields preserved. No install ran.

The reviewed candidate's VST3 build, binary identity and focused native
parameter/value/finite-processing checks passed. State qualification failed as
recorded below. Still needed: resolve and requalify native state restoration,
prove actual editor notifications, and settle the AU outcome with a bounded
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

## Headless native qualification — September 5, 2026

**Overall result: FAIL on state restoration.** Bob authorized three serialized
phases using frozen fixture source `9c201678b62fe5dc33006f86b09d3e6e8403e500`
and the unchanged product bundle built from `954207e4`. The owned native slot
was released after all processes exited. No repair or rerun occurred.

| Phase | Actual result |
| --- | --- |
| pluginval 1.0.4, strictness 8, GUI skipped | Exit 1 in 1.5 seconds; seven state-restoration assertions failed. No reported processing/automation matrix failure, timeout or crash. |
| arm64 fixture configure/build, four jobs | Exit 0 in 27.2 seconds, including juceaide. One dependency deprecation warning. No Cmajor build or metadata stamp. |
| Exact VST3 fixture run | Exit 1; 813 assertions, 27 failures, all in three restore cases. No timeout or crash. |

The validator used seed `954207` (logged as `0xe8f5f`), sample rates
44100/48000/96000 and blocks 64/512/1024. Its seven immediate restoration
failures named Analyzer Enable, Frequency, Q, Amount / Mid, Side, Character
and Shape. The failure was retained without lowering strictness.

The compiled fixture passed the actual eight sound parameters' stable IDs,
titles/units, defaults, automation flags, physical ranges and discrete choices.
It also passed the existing Analyzer Enable contract: ID `303068736`, default
0, physical 0–1, automatable and non-discrete in the host. The sole remaining
parameter was JUCE's actual Bypass (`1652125811`). Deterministic continuous and
discrete changes and all directly processed finite-output checks passed.

State evidence distinguishes two observable seams. Each restore used exactly
the same 683-byte saved state S. No expected values were resent during restore:

| Restore case | Host readback after two seconds | Recaptured native state |
| --- | --- | --- |
| Same instance, first restore of S after edits | All eight values remain edited | Exactly S |
| Same instance, edit again then restore identical S | All eight values remain edited | Exactly the edited state |
| Fresh instance, edit then restore S | All eight values remain edited | Exactly S |

Each case failed eight value assertions and its settling deadline, accounting
for all 27 failures. Final readbacks completed at approximately 2003 ms with
zero matching blocks. Thus the host-readback failure persists through the
fixture's explicit message-loop/processing window; it is not only the
validator's immediate read timing. The first/fresh serialized-state recovery
and repeated-state failure must remain distinct findings. They are consistent
with notification and identical-state reapplication concerns, but the root
cause and audible DSP consequences have not been established.

- Saved S SHA-256:
  `778baf9cef9de6788d30948ed0879b19d0f4c4b61594d6573ad8e4f21fb1e226`.
- Edited-state SHA-256:
  `5de7261a3947ecee08f90ec5dd0ab8247df902fd4793c23520ce6cc6f2a3f9aa`.
- Actual arm64 host executable SHA-256:
  `ddf30acc49a4031715d01bd1b79c386cd605a4e911aedd4124d9b17a7be17fb3`.

Local evidence root:
`/Users/winterfell/.codex/visualizations/2026/09/05/01a07068-7376-7012-a350-a5999d5bd51c/l1/`.
`native-proof-9c201678/pluginval/` and `fixture-build/` contain command logs and
phase results. `exact-vst3-probe-01/` contains candidate/probe hashes, process
output, result JSON and `probe/` with JSONL assertions and the unmodified state
blobs. Validator/build process groups were verified gone, and no owned fixture
process remained. The build occupied about 80 MiB and evidence under 0.4 MiB,
within the 2 GiB allowance; final free space was 46.07 GiB.

Candidate binary/payload and original toolchain hashes still match the build
record. No product, generated bundle or framework change, installation, editor
GUI, AU registration, DAW, audio-device or listening activity occurred. Actual
editor gestures, DAW scheduling/projects, clean macOS 15/26 acceptance and final
packaging remain separate gates. New diagnosis/repair and any native retry must
be routed after this released slot.

The subsequent [state source repair checkpoint](ENHANCE_THAT_STATE_REPAIR.md)
traces the deduplication and notification failures and freezes a one-header
Cmajor repair plus a real gain/DSP regression in L1's owned clone. The repair
subsequently passed L2 source review and the [isolated native gain
A/B](ENHANCE_THAT_STATE_AB_RESULTS.md): exactly 31 predicted baseline failures,
104/104 corrected assertions, identical generated C++. The slot is released;
product retry remains separately routed. The failed binary and original evidence
are preserved.

The [repaired-product qualification proposal](ENHANCE_THAT_PRODUCT_QUALIFICATION_PLAN.md)
prepares an isolated diagnostic VST3, exact fixture pin review, product audio
boundary and separate JIT/global-toolchain work. Its scripts are prepared only;
no product-native allocation or pin advance is implied.
