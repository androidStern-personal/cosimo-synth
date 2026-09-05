# Enhance That: bounded native proof proposal

Planning record, September 5, 2026. Bob subsequently authorized the headless
VST3 phases: fixture build passed, but pluginval and focused native state checks
failed. Exact results and slot release are recorded in
[the L1 handoff](ENHANCE_THAT_L1.md). AU and editor phases remain proposed; this
document does not authorize further execution or installation.

Recommended order: qualify the existing VST3 through an offline host first;
then use the already-generated AU target for one bounded feasibility attempt.
Both retain Apple Silicon macOS 15 and 26 as separate acceptance requirements.
Actual Ableton automation recording/playback, saved projects and listening stay
with the separately scheduled host acceptance work.

## Exact candidate and tools

Product source is reviewed `954207e4b19c6896e6a9ab1cd4b18a8bd566af06`.
The subsequent `57f229c9` commit changes documentation only. Existing bundle:

`build/enhancer_lite_juce/_build/plugin/EnhanceThat_artefacts/Release/VST3/EnhanceThat.vst3`

Require the previously recorded binary SHA-256
`2675c6bb73a1d293b069fc592f96329d80d5c047c313b1b9b73452361a6a6c86`
and bundle payload digest
`1abaa6e6558f2c407a7f52dd827fce3a9e9f16c27dd4a56bb2dacd550b2049a5`
before and after proof. Preserve the bundle unchanged and load its absolute
path directly; VST3 proof needs no installation or global plug-in scan.

The installed free validator is
`/Applications/pluginval.app/Contents/MacOS/pluginval`, version **1.0.4**,
executable SHA-256
`32ec60efb9f8161f0b840103f9bd98fa455cd86ec59eb2803133b4382fa4425c`.
Only its help was run during planning. `/usr/bin/auval` is also present.
The source references below use pluginval 1.0.4 and the actual Cmajor/JUCE pins
from the native build, rather than assuming current upstream behavior.

## VST3: offline automation and state

First run one reproducible headless validation against the exact bundle. From
the L1 worktree, with `enhance_l1_evidence` assigned to the owned evidence
directory and its `vst3` child created:

```sh
/Applications/pluginval.app/Contents/MacOS/pluginval \
  --strictness-level 8 --skip-gui-tests --random-seed 954207 \
  --sample-rates 44100,48000,96000 --block-sizes 64,512,1024 \
  --timeout-ms 120000 --verbose \
  --output-dir "$enhance_l1_evidence/vst3" \
  --output-filename enhance-that-vst3.txt \
  --validate "$PWD/build/enhancer_lite_juce/_build/plugin/EnhanceThat_artefacts/Release/VST3/EnhanceThat.vst3"
```

Keep normal subprocess isolation. Reserve at most ten minutes overall, with an
external watchdog limited to this run's process group; the inactivity timeout
alone is not an overall time bound. A failure is recorded and classified before
any rerun. Do not lower strictness to turn a failing result into a pass.

This checks processing and host-driven changes across the selected matrix.
Pluginval's parameter restoration tolerance is 0.1 normalized; level 8 also
compares saved-state bytes. Its GUI automation changes hosted parameters rather
than operating the WebView. These tests cannot by themselves establish exact
eight-control recall or UI-originated gesture notifications.
[Versioned test implementation](https://raw.githubusercontent.com/Tracktion/pluginval/v1.0.4/Source/tests/BasicTests.cpp).

For those product-specific assertions, propose a small disposable JUCE host
fixture, in an L1-owned build directory. Adapt the existing
`tools/desktop_native/Source/T78VST3AutomationProbe.cpp` loading pattern, without
altering that synth probe or the shared desktop build. Use pinned stock JUCE,
no framework edits, and no audio device: feed deterministic buffers directly
to the loaded plug-in and pump its message loop for asynchronous restoration.
The fixture loads the already-built binary; it does not regenerate the product.

Required observations:

| Endpoint | Title | Domain and default |
| --- | --- | --- |
| `freqHzIn` | Frequency | 20–20000 Hz; 130 Hz |
| `qIn` | Q | 0.1–10; 0.71 |
| `modeIn` | Routing | Stereo / Mid/Side; Stereo |
| `midAmountIn` | Amount / Mid | 0–1; 0 |
| `sideAmountIn` | Side | 0–1; 0 |
| `curveIn` | Character | Tube / Solid; Solid |
| `saturationModeIn` | Intensity | Subtle / Medium; Subtle |
| `shapeIn` | Shape | Low / Bell / High; Bell |

- Read actual hosted Steinberg parameter IDs, titles, automation flags, ranges,
  defaults and discrete steps. Require all eight unique endpoint-derived IDs
  with automation enabled. Require the existing `analyzerEnabledIn` parameter
  separately with its preserved host metadata; it is outside the eight-control
  sound model. Report wrapper bypass separately and reject other unexpected
  parameters. The analyzer's `hidden` annotation does not remove it from native
  enumeration in the pinned Cmajor/JUCE path.
  Derive expected numeric IDs using the pinned JUCE conversion, as T78 does,
  not from the host's parameter order.
- Drive continuous controls through endpoints and interior values, and every
  legal discrete value, while processing deterministic stereo input. Require
  finite output, settled value readback and correct discrete labels. Compare
  continuous normalized values within a declared float tolerance of `1e-6`,
  and discrete selections exactly. Record any text-format precision separately.
- Save a distinctive non-default sound S; edit all eight controls; restore S
  in the same instance and in a fresh instance. Also edit again and restore the
  **identical bytes of S again**. Assert every value after the message loop and
  audio processing settle, with a bounded two-second wait per transition.
  Retain state bytes and observed values; byte differences need classification,
  not an assumption that every serialization difference changes the sound.
- The repeated-S case is motivated by pinned Cmajor's
  `include/cmajor/helpers/cmaj_JUCEPlugin.h`: `setStateInformation` suppresses
  an identical `lastLoadedStateHash`, and the inspected parameter edit path
  does not clear it. This is an untested source concern, not a native failure.
  If reproduced, return the exact sequence and trace to Bob before expanding
  scope into runtime repair.

These checks establish native host-driven values and binary state behavior.
They do not establish sample-accurate DAW scheduling, automation recording,
old-version project migration, preset-file persistence or listening acceptance.

## VST3: actual editor notification path, without Ableton

The same disposable host can optionally show the actual VST3 editor in its own
window and attach listeners to the hosted parameters. This needs a separate
native UI slot, but no live DAW session or audio hardware. Pinned JUCE's
`juce_VST3PluginFormatImpl.h` forwards received VST3 `beginEdit`, `performEdit`
and `endEdit` into those hosted parameter notifications.

Operate the real WebView controls, recording endpoint/host ID, event order and
values. Require one begin, one or more values, one end for each touched endpoint
for continuous drags, discrete selections and standalone key edits. Repeat the
reviewed readout/graph overlap case: hold the pointer, issue repeated arrow
keys, continue the drag, release/cancel, then make an independent key edit.
Require no nested gesture or early end, no notification recursion, and a fresh
gesture for the subsequent edit. Also drive a value from the host and check
the editor readout, then close/reopen the editor and check the retained sound.

During UI-originated cases the fixture must only observe notifications; it
must not call `beginChangeGesture`/`setValueNotifyingHost` and count its own
outgoing calls as proof of received editor messages. Browser message-contract
tests already passed, but do not substitute for this binary boundary. Compiling
the generated processor directly into a message probe would likewise provide
only wrapper-source evidence, so it is not proposed as a binary substitute.

## AU: existing generated target, no source change required

The actual generated `build/enhancer_lite_juce/CMakeLists.txt` already declares
`FORMATS Standalone AU AUv3 VST3`, and its configured build has `EnhanceThat_AU`.
No generated CMake edit, framework change or CLI expansion is needed. Build only:

```sh
cmake --build build/enhancer_lite_juce/_build \
  --config Release --parallel 4 --target EnhanceThat_AU
```

Expected output:
`build/enhancer_lite_juce/_build/plugin/EnhanceThat_artefacts/Release/AU/EnhanceThat.component`.
The AU metadata directory already exists from configuration; it currently is
not evidence of a compiled AU executable. The target links the existing
`libEnhanceThat_SharedCode.a` and stock JUCE AU wrapper.

Use the same guarded cmaj-only temporary toolchain stamp/restore procedure as
the completed VST3 build if configuration regenerates. Bob's slot must cover
that local metadata mutation explicitly. Verify compiler and payload receipts;
restore the exact original toolchain bytes on success or failure. No compiler
source build or new dependency pin is part of this attempt.

Before loading, require the binary, both expected architectures, strict ad-hoc
signature verification, full payload digest and these component identifiers:
bundle ID `dev.cosimo.enhancer-lite`, type `aufx`, subtype `CsEL`, manufacturer
`Cosi`, factory `EnhanceThatAUFactory`. The generated plist currently names the
component `Cosimo: EnhanceThat`; record actual host presentation as an open AU
branding detail, rather than silently editing the bundle or claiming the AU is
ready to ship. The generator's deployment target does not qualify an older OS.

AU loading requires its own controlled registration/install slot. JUCE reads a
component file's identity and then calls `AudioComponentFindNext`; passing the
build path does **not** ensure that exact file is loaded if another registered
component shares its identity. This holds in the pinned host source and the
installed validator's JUCE 8.0.3
[AU loader](https://raw.githubusercontent.com/juce-framework/JUCE/8.0.3/modules/juce_audio_processors/format_types/juce_AudioUnitPluginFormat.mm).

Preflight the relevant user/system Components directories for both bundle ID
and AU identity, recording paths/hashes. If unambiguous and the install slot is
granted, stage only this candidate in the user Components directory and verify
its installed hash and the actual loaded module path/hash. Preserve and restore
the preflight baseline. A conflicting or stale registration stops the attempt;
do not replace a foreign component, delete shared caches or terminate another
task's host/registrar. An unresolved loaded path is an inconclusive result.

Free validation for the verified registered candidate:

```sh
/usr/bin/auval -strict -v aufx CsEL Cosi
/Applications/pluginval.app/Contents/MacOS/pluginval \
  --strictness-level 5 --skip-gui-tests --random-seed 954207 \
  --sample-rates 44100,48000,96000 --block-sizes 64,512,1024 \
  --timeout-ms 120000 --verbose \
  --output-dir "$enhance_l1_evidence/au" \
  --output-filename enhance-that-au.txt \
  --validate 'AudioUnit:Effects/aufx,CsEL,Cosi'
```

Run the explicit auval diagnostic only if useful for registration/readback;
pluginval level 5 already invokes auval. Avoid duplicate validation just to
increase the check count. This is an initial AU feasibility gate, not the
stronger VST3 state result. If it passes, enable stock JUCE's AU hosting in the
same disposable host fixture and repeat the focused value/state/editor cases
above against the verified component. Real WebView edits matter because the
recorded generic-AU failure was on a value-notification path. Merely opening an
editor or passing auval does not settle that case.

Pluginval is already installed and provides a free host/validator. Stock JUCE
also includes the free AudioPluginHost source, but no installed copy was found
in the two Applications directories checked. Building another general host is
unnecessary if the focused fixture is viable. No Logic access check is needed.

## Slot request, bounds and decision

| Phase | Resource needed | Proposed bound / stop |
| --- | --- | --- |
| VST3 pluginval | Native CPU/validator slot; exact bundle read-only | One run, ten-minute wall limit, 120-second inactivity limit |
| Focused host fixture | L1-owned build dir, pinned stock JUCE, four compiler jobs | Thirty-minute build cap; stop on missing dependency or required framework change |
| VST3 editor cases | Disposable host/editor UI slot | Fifteen minutes; stop on crash, recursion or reproducible notification/state failure |
| AU build | Generated native build dir and local metadata stamp; four jobs | One build, fifteen-minute cap; stop below 3 GiB free or on source/pin drift |
| AU registration + proof | User Components/registration and disposable host UI slot | Twenty minutes after build; one clean attempt, at most one evidence-driven rerun |

Serialize all of these with Bob; avoid L2 builds and L5 audio work. Timeouts
terminate only this proof's owned processes and retain logs. Use no audio
device. Any harness ambiguity is reported separately from a product failure.

AU can advance only with exact-candidate loading and the focused tests passing;
final names, packaging and clean macOS 15/26 qualification remain outstanding.
If registration, stock-wrapper behavior, build resources or the UI notification
path cannot be settled within these bounds, report the concrete blocker and
recommend **AU deferred, VST3-only beta**, with all AU/Logic compatibility claims
removed consistently by their owners. Do not expand into a JUCE fork, production
CLI work, paid host, account action or open-ended investigation. An AU defer
does not reduce retained macOS 15/26 scope.
