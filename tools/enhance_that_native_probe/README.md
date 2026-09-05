# Enhance That exact-VST3 fixture

Frozen source `9c201678` was compiled and run in Bob's September 5 native slot.
**Build passed; state qualification failed.** Inventory, analyzer range,
deterministic value changes and finite processing passed; all three state
restore cases retained stale hosted values, and repeated identical-state restore
also retained edited state bytes. The slot is released; further native work,
editor use and AU registration need separate routing. Results are recorded in
[`docs/ENHANCE_THAT_L1.md`](../../docs/ENHANCE_THAT_L1.md). The broader plan is
[`docs/ENHANCE_THAT_NATIVE_PROOF_PLAN.md`](../../docs/ENHANCE_THAT_NATIVE_PROOF_PLAN.md).

This independent stock-JUCE host loads the already-built VST3 from reviewed
source `954207e4`. It never builds the product, installs a bundle, scans global
plug-in directories, creates an editor, opens an audio device or changes the
shared desktop host. The Node runner checks the exact executable and canonical
bundle payload hashes before and after. Its two-minute watchdog signals only
the process group it creates. After timeout it awaits group exit independently
of leader exit, allowing two seconds after SIGTERM and then two seconds after
SIGKILL; surviving members produce an explicit cleanup failure. Output requires a new evidence directory and
includes the actual host executable hash, JSONL assertions, process output and
saved native state blobs.

Checks without native plug-in activity: `node --check tools/enhance_that_native_probe/run.mjs` and
`node --test tools/enhance_that_native_probe/run.test.mjs`. These exercise real
argument/hash/output-location refusals with an inert temporary file. An inert
Node process-group regression also requires cleanup of a SIGTERM-resistant
descendant after its leader exits; it failed before the watchdog repair and
passes afterward. These do not load the candidate or establish C++ build/runtime
correctness. The subsequent actual-candidate run is recorded separately above.

## Assertions and limits

- All eight endpoint-derived Steinberg IDs must be present and unique, with
  their expected titles, units, defaults and automation flags. Four controls
  are continuous; Routing, Character, Intensity and Shape have their exact
  discrete steps and labels. The existing `analyzerEnabledIn` / `Analyzer Enable`
  parameter is required separately by its stable ID, name, empty unit,
  automation flag, continuous host steps, zero default and physical range 0–1.
  Both analyzer range endpoints use strict, finite, fully consumed numeric text
  parsing and exact equality to 0 or 1; these checks do not write analyzer values.
  Only the wrapper's
  actual bypass parameter may appear beyond these nine; other extras fail.
- Host writes traverse five normalized positions for each continuous control
  and every legal discrete selection. Deterministic stereo buffers are
  processed directly at 48 kHz/128 samples. Every output sample must be finite.
  Readback allows `1e-6` normalized error for continuous values and exact
  equality for discrete values. This checks finite processing, not audible
  quality or equivalence to a previous DSP implementation.
- Each transition pumps the message loop and processes at least 32 blocks,
  requiring eight consecutive matching readbacks completed before two seconds.
  The final readback timestamp is asserted and its elapsed milliseconds are
  recorded, so a matching loop body that returns late cannot pass. The outer
  watchdog still bounds a blocked native call. Host
  parameter handles are reacquired after pumping, since a restart can rebuild
  them. The waits accommodate asynchronous dispatch without extending a failed
  deadline or resending expected values during restoration.
- A distinctive non-default sound S is saved, every control is changed, and S
  is restored. All controls are changed again and the **same S bytes** are
  restored again. The first processor is destroyed, a fresh processor is
  created and edited, then S is restored there too. Each restore records its
  input hash, actual values and resulting serialized state. A failed first
  restore remains a failure while later restore cases can supply more evidence.
- Native state bytes are retained unchanged. The fixture does not decode or
  patch private Cmajor serialization. A difference between recaptured and
  input bytes is logged for classification; restored control values determine
  this fixture's state assertions. Separate pluginval strictness 8 also tests
  byte equality. These checks do not prove old-version project migration,
  editor snapshots/preset-file persistence or disk-saved DAW projects.
- Hosted parameter reads can reflect host/controller caches. Passing a host
  write readback alone does not prove a DSP response; fresh-instance recall
  through the saved binary state adds a separate check of the persistence
  path. Sample-accurate scheduling and actual DAW automation remain open.

No begin/end calls are manufactured by this fixture, and no hosted write is
counted as a received editor gesture. Actual editor notifications are outside
this checkpoint and need the separately scheduled real-editor proof.

The analyzer expectation follows the unchanged graph and the reviewed build's
`cmajor_plugin.cpp`: its `inputParameters` and `programDetailsJSON` contain
all nine parameters. `hidden: true` does not exclude the named scalar event in
Cmajor's `EndpointDetails::isParameter()` or `createParameterTree()`.
`PatchParameterProperties` defaults this endpoint to automatable, range 0–1,
initial 0 and non-discrete. Cmajor maps `hidden` to `isMetaParameter()`, but the
pinned JUCE VST3 wrapper does not use that property to hide the parameter.
The eight sound presets and snapshots exclude it; the native parameter
inventory does not. The fixture leaves its value alone and keeps the eight
sound-control array and state assertions unchanged. There is no `Device On`
endpoint in the generated metadata; wrapper bypass is recognized by the host
API's bypass identity, not by a Live-specific display name.

## Commands after Bob allocates a native slot

Run from the owning worktree. The CMake file uses only the existing
`cosimo_add_juce_dependency` seam and pin; it neither fetches nor builds Cmajor.
The native host can be arm64 on this machine; that is not Intel qualification.

```sh
cmake -S tools/enhance_that_native_probe -B build/enhance_that_native_probe \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_OSX_ARCHITECTURES=arm64
cmake --build build/enhance_that_native_probe --parallel 4 \
  --target enhance_that_vst3_probe
```

Use the previously proposed thirty-minute compile cap. Stop for absent pinned
dependencies rather than expanding into a compiler or framework build. No
Portless route or audio device is needed. The runner's evidence parent must
already exist; assign `enhance_l1_evidence` to the owned L1 evidence root, then:

```sh
node tools/enhance_that_native_probe/run.mjs \
  "$PWD/build/enhance_that_native_probe/enhance_that_vst3_probe" \
  "$PWD/build/enhancer_lite_juce/_build/plugin/EnhanceThat_artefacts/Release/VST3/EnhanceThat.vst3" \
  "$enhance_l1_evidence/exact-vst3-probe-01"
```

Do not change locked candidate hashes to accept another binary without a
separate reviewed provenance checkpoint. Do not rerun into an existing evidence
directory, reduce tolerances, resend saved parameters to repair a restore, or
change production/runtime behavior in this fixture. Report a native failure
with its stage, input state hash and observed values to Bob. In particular,
`same-instance-restore-identical-S` exercises the pinned Cmajor hash-deduplication
concern; source inspection alone has not established a defect.

The product's separate `previousProductName` sidecar commit depends on L3's
reviewed discovery/installation contract at integration. This fixture imports
only the existing toolchain hash helper and JUCE dependency seam, so preparing
it does not require modifying or substituting L1's older kit parser.
