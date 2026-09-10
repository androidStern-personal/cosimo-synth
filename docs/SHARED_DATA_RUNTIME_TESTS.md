# Shared-data runtime verification

Work lives on `codex/shared-data-runtime` in the kit repo and authored Cmajor
checkout. The production pin and installed plugins are unchanged. This is a
native-JIT and Chrome integration slice, not a complete Cosimo migration or a
multisampler performance qualification.

Verified Cmajor implementation: `ebd03cb` plus the embedded-archive correction
`69a5847`. Existing state regression: **194/194**;
new JavaScript module tests: **17/17**; compiler/archive tests: **4/4**; TypeScript
typecheck passed. Native integration checked **18,486 samples across 9 checkpoints**.
Chrome verified public MSEG editing/Undo and nine disposed connections sharing one
AudioContext across two compiled memory layouts. Main-memory weak references were
collected and the worklet acknowledged releasing its runtime; this does not claim
immediate all-process backing-store reclamation.

| Boundary | Failure / invariant | Test |
|---|---|---|
| Native storage | Concurrent replacement, shared resource accounting, delayed retirement, no audio allocation/free/lock, stop/reset | `tests/native/SharedDataStoreTests.cpp` (normal, ASan/UBSan, TSan) |
| Native worker protocol | Old scopes, incomplete/invalid chunks, budget exhaustion, missing ready reply cleanup, cancellation, exact adoption reply | `tests/native/PatchSharedDataProtocolTests.cpp` |
| Native JIT externals | Real read/size external resolution, additional external provider preserved, bounded reads | `tests/native/PatchSharedDataNativeProbe.cpp` |
| Compiler | Stock and shared output, supplied compiled modules, malformed imports, growth, reset/snapshot isolation | Cmajor `tests/shared_memory_codegen` |
| Browser storage | Actual Worker/Wasm reads, shared allocations, reuse, growth, bounds, stale tickets, exact cancellation, empty clear | `tests/test_shared_data_memory.mjs`, `tests/test_shared_data_concurrent.mjs` |
| Framework port | Real browser bridge, lost ready/written/applied replies, wrong acknowledgements, cleanup, subsequent recovery | `kit/tests/test_plugin_state_shared_data.mjs` |
| Browser connection | Actual AudioWorklet startup/audio, worker-only access, suspended disposal | `tests/test_shared_data_worklet_browser.mjs` |
| Public state + native JIT | Generated QuickJS worker, real Cosimo MSEG renderer, every sample against independent oracle, state/Undo/Redo/reopen/reset | `tests/native/PluginStateSharedDataProbe.cpp` |
| Public state + Chrome | Generated worker, public React hooks, actual Cmajor audio, editable-state persistence, shared Undo/Redo/reopen/reset | `tests/test_shared_mseg_browser.mjs` |

The last two tests use a small test plugin with Cosimo's actual MSEG renderer.
They do not replace Cosimo's modulation bank, articulation delivery or wavetable
engine. Initial defaults can have `persistence.kind = "not-written"`; real edits
must be persisted and independently verified. Tests preserve that distinction.

## Run

Set `COSIMO_PLUGIN_STATE_CMAJOR_SOURCE` to the authored Cmajor checkout containing
this change. Native scripts also require a compatible Cmajor JIT library path.
No installed plugin, default build directory or globally selected toolchain is
changed by these probes.

```sh
npm run test:shared-data:modules
npm run test:shared-data:browser
npm run test:plugin-state
npm run typecheck
node tests/helpers/build_shared_mseg_fixture.mjs
# Use the manifest path printed above:
tests/native/run_plugin_state_shared_data_probe.sh "$COSIMO_PLUGIN_STATE_CMAJOR_SOURCE" "$CMAJOR_RUNTIME_LIBRARY" "$GENERATED_MANIFEST"
```

The browser tests use `CMAJOR_SHARED_GENERATOR`, defaulting to the isolated
`build/shared_data_codegen/source/shared_memory_generator` executable built from
Cmajor's `tests/shared_memory_codegen` CMake project. This calls the real compiler
API; the tests do not rewrite generated code or substitute a fake DSP.

The original packet-delivery tests are retained unchanged. They cover an existing
adapter, and passing them does not establish the new shared-data path. Existing
state tests must run against the authored Cmajor source: the older production pin
also lacks earlier state-channel changes that were already on the state branch.

## Limits to keep explicit

- The public buffer ownership rule is contractual: preparation must not keep
  mutating its returned buffer. JavaScript cannot freeze typed-array elements.
- Browser storage grows and reuses space; it cannot shrink a live Wasm memory.
- The reader adopts versions at block boundaries. Per-note historical resources
  and arbitrary packed integer layouts are not supplied by this stock adapter.
- Native dedicated/AOT plugins, Safari, Firefox, mobile, large multisamplers and
  production audio deadline qualification remain separate work.
