# Cosimo shared-memory implementation and benchmark

One quiet, serial run per case on 2026-09-11: real Cosimo, QuickJS worker, factory Acid (40 frames), MIDI note 60, 48 kHz, 128-frame blocks.

| Measurement | Old JIT | New JIT | Old compiled DSP | New compiled DSP |
|---|---:|---:|---:|---:|
| Engine desired → active (ms) | 1619.547 | 868.176 | 1664.037 | 869.093 |
| Audio callback p95 (µs) | 347.042 | 269.958 | 356.375 | 286.959 |

Both old/new audio comparisons are byte-identical over 32,768 float32 samples. All four runs had zero input failures, non-finite samples, or callbacks exceeding the block budget.
New native renderer pointers equal the actual JavaScript allocation pointers on all three inputs. The measured edit reserved 13,118,496 bytes and sent zero upload envelopes; the old path sent 154 mip messages (~19.54 MB JSON).

Full numbers and qualifications: [native-results.json](native-results.json). Artifact hashes, dependencies, and observer provenance: [native-identity.json](native-identity.json).
JSON measurement added 53–55 ms of worker-thread work to baseline runs. Peak RSS stayed approximately unchanged and does not isolate JS preparation memory. These are single-run native measurements, not statistical, browser, DAW, or listening acceptance.

From the repository root, verify or replay the preserved binaries:
```sh
python3 docs/benchmarks/cosimo-shared-memory/replay-native.py --verify-only
python3 docs/benchmarks/cosimo-shared-memory/replay-native.py --output build/cosimo-shared-memory-replay
```
Replay requires the recorded local binaries/resources; it refuses changed hashes and writes a new output directory. Run while other builds and benchmarks are idle.

[native-host.cpp](native-host.cpp) is the exact measured host source. [instrument-worker.py](instrument-worker.py) reproduces the benchmark-only QuickJS header hooks; [renderer-observer.h](renderer-observer.h) preserves the unchanged-view pointer observation. The two `*-aot-factory.cpp` files show the actual generated-DSP wrappers.
The preserved build recipes are `build/cosimo_shared_memory_baseline/{compile.sh,compile-aot.sh,current/compile.sh,current/compile-aot.sh}`. They use C++17 `-O2 -g0`, the recorded Cmajor/choc headers, and actual RendererBridge/WarpRenderer sources. `COSIMO_MEASURED_WORKER_HEADER` selects the generated observer header; AOT adds `COSIMO_BENCH_AOT` and its factory source.
Large logs, audio, generated DSP, source snapshots, and diffs remain in `build/cosimo_shared_memory_baseline/`; final evidence is under `final/`. Generated AOT headers came from the same hashed `cosimo_cmajor_external_codegen` binary with the production manifest, `--target cpp --max-frames-per-block 128`. The prebuilt JIT library's exact compiler commit is unverified.

Browser: the same Acid40 change took **893.830 → 34.840 ms** from desired-state observation to active sound (Chrome 147, 48 kHz, 128-frame callbacks). Old sent 154 sample messages; new sent none. Both produced finite nonzero audio. [Old](browser-old.json), [new](browser-new.json), [identity](browser-identity.json), [exact driver](browser-driver.mjs). Separate [pointer audit](browser-pointer-audit.json) and [observation patch](browser-pointer-audit.patch) confirm that all three renderer input addresses equal the JavaScript reservation addresses in the same Wasm memory. Browser timing is one run, not a general speedup guarantee; its coarse callback clock does not establish hardware dropout performance.

Implementation: JavaScript packs directly into a reserved destination through `prepareSharedData`; the framework publishes the completed allocation at a block boundary and retires old storage off the audio thread. Cosimo reads that exact packed allocation through its existing native/Wasm renderer. There is no complete intermediate prepared table or sample-payload upload. The manifest explicitly supplies the capacity budget; the preparation function owns the packed layout.

The full web product build and both TypeScript checks passed. Offline Bounce now prepares directly from captured source frames; deterministic captures matched and nine checked sounds were non-silent. Its unchanged pad48 tail-duration assertion fails on both the archived old implementation and this one; this is not a passing full Bounce suite. Native results use the real full generated/JIT DSP and QuickJS worker in a headless host, not an installed DAW session.

This implementation requires the patched Cmajor/CHOC branches. The published Builder Kit dependency pin and installed plug-ins were not updated. JIT/AOT and web use the same packing algorithm and host-supplied destination API; general plugin-state API completion is outside this transport change.

Patched runtime commits: Cmajor `b9c1e3c` (branch `codex/shared-data-runtime`), CHOC `506c9db`. Final full-product rebuild was rechecked in Chrome: [result](browser-final-product-check.json); zero payload uploads, finite nonzero audio, no reported errors.
