# State and shared-data verification

Current source is on `codex/shared-data-runtime`. The kit pins Cmajor
`7816a2984c98c7d0bed03954de023d3a8ead29a5`, including the generated embedded
assets. Installed plugins and published release artifacts are separate from this
source qualification.

## Evidence

| Boundary | What is checked | Evidence |
|---|---|---|
| Public state/history | Stale setters, own queued gestures, automation, exact Undo/Redo, instance-only state, field errors and guarded retry | `npm run test:plugin-state` (205 assertions at extraction) |
| Direct preparation + real shared store | Old audio survives partial failed writes, cancellation through adoption, budget refusal/reuse, per-input receipts, retry without extra history | `tests/test_plugin_state_direct_data.mjs`, `tests/test_shared_data_preparation.mjs` |
| Storage/native readers | Concurrency, complete block snapshots, bounded reads, reclamation and invalid native settings under sanitizers | `tests/native/PatchSharedDataProtocolTests.cpp`, `tests/native/NativeValueTests.cpp`, shared-store tests |
| Normal author build | Named resources, generated nested C++ types, record defaults/validation, keyword/type collisions | `tests/test_native_value_codegen.mjs` (native ASan/UBSan, generated Wasm in Node and Chromium) |
| Public API in real native DSP | Generated QuickJS worker; 18,486 MSEG samples across nine state/history/reopen/restore checkpoints in JIT and compiled native; generated C++ settings getter during audio processing | `tests/native/PluginStateSharedDataProbe.cpp` |
| Public API in browser audio | Generated worker, React controls, actual Cmajor AudioWorklet audio, saving, Undo/Redo, reopen and project replacement | `tests/test_shared_mseg_browser.mjs` |
| Bundled editor and DSP | Add/move/bend/delete/cancel; curve timing/interpolation, held replacement, looping and note-off | `kit/tests/test_mseg_editor_browser.mjs`, `tests/test_mseg_dsp.mjs` |
| Cosimo integration | Exact amount-only delta, persistent runtime refresh, obsolete replies, headless saved-state restoration and bounded recovery | `tests/test_synth_modulation_binding*.mjs`, `tests/test_wavetable_worker.mjs` |
| Actual Cosimo audio/performance | Shared wavetable loading and held-note MSEG updates; six byte-identical JIT/AOT/Wasm audio comparisons against `2bcff19d`; CPU −0.67% to +0.99%, unchanged DSP memory | `docs/benchmarks/cosimo-shared-mseg/extraction-results.json` |

The control tests explicitly model native saved-state storage and domain DSP ACKs.
They do not claim that recording a send proves audio processing. Native and browser
DSP runs provide that evidence separately. Application-signal and stale-reply
regressions were independently reviewed; removing the stale-observer guard was
also shown to make its regression fail.

## Run

Set `COSIMO_PLUGIN_STATE_CMAJOR_SOURCE` to the authored/pinned Cmajor source.
The existing isolated compiler is selected with `CMAJOR_SHARED_GENERATOR`.

```sh
npm run test:plugin-state
npm run test:shared-data
npm run test:shared-data:browser
npm run typecheck
node tests/helpers/build_shared_mseg_fixture.mjs
# Use the generated manifest printed by the build; this is the real author build.
tests/native/run_plugin_state_shared_data_probe.sh "$COSIMO_PLUGIN_STATE_CMAJOR_SOURCE" "$CMAJOR_RUNTIME_LIBRARY" "$GENERATED_MANIFEST"
tests/native/run_plugin_state_shared_data_probe.sh "$COSIMO_PLUGIN_STATE_CMAJOR_SOURCE" "$CMAJOR_RUNTIME_LIBRARY" "$GENERATED_MANIFEST" aot
```

The legacy packet-port test remains intact as
`kit/tests/plugin_state_shared_data_native.test.mjs` and runs in the explicit
platform gate. It needs Cmajor source, so it is excluded from the customer's
ordinary unit-test discovery, using the existing native-gate filename convention.
No assertions were removed or skipped to make customer tests pass.

The final storage writer is synchronous and may not retain its writable view.
Browser memory retains its high-water allocation until disposal. Shared block
reads do not imply per-note historical resource retention, and source assets for
Undo remain the author's responsibility. These are source/runtime checks, not an
installed DAW, physical-device, listening or release qualification.
