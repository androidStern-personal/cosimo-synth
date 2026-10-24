# Real Cosimo MSEG shared-memory measurements

Measured 2026-09-11 against baseline `cbcb1229a880b305a18bbeb1a152691e42f72739`. The full Cosimo engine now reads one shared A/B curve per MSEG slot instead of copying each 2,051-float curve into 16 voice readers. This reduces edit delivery work and engine storage. These measurements do **not** establish a steady playback CPU improvement.

| Full engine / held notes | Before µs/block | After µs/block | Change |
|---|---:|---:|---:|
| Native JIT / 1 | 168.01 | 172.11 | +2.44% |
| Native JIT / 8 | 602.68 | 606.07 | +0.56% |
| Compiled native / 1 | 188.29 | 186.77 | −0.81% |
| Compiled native / 8 | 605.17 | 603.17 | −0.33% |
| Offline Wasm / 1 | 286.94 | 294.13 | +2.50% |
| Offline Wasm / 8 | 675.88 | 684.57 | +1.29% |

48 kHz, 128-frame blocks; the block deadline is 2,666.67 µs. Each cell is the median of nine groups of 1,024 renders after warmup. Cases ran serially with builds and other render tests idle. Changes are small and mixed across runtimes; there is no statistical confidence interval or general speedup claim. The Wasm host is Node's real generated offline engine, not AudioWorklet callback timing.

For 100 curve edits, offline Wasm's one-note baseline separately spent median **101.25 µs rendering** and **81.50 µs delivering the sample event**. The production `prepareOfflineMseg` path spent **101.00 µs preparing directly in shared storage and submitting it combined**. With eight notes, corresponding medians were 148.21 + 84.71 µs before and 150.96 µs combined after. These are separate medians, not a computed end-to-end median. Both paths adopted before the following block. Native fixture delivery similarly fell from approximately 19 µs to 5–6 µs; that diagnostic includes JSON fixture extraction/coercion, and is not native UI-to-audio latency. The actual native JavaScript ownership proof is separate below.

Each before/after capture contains **131,072 finite, nonzero float32 samples** with audible MSEG→oscillator A pan modulation. The sequence holds one or eight notes through A/B morph changes, replacement of shape A, and loop-bound changes. Compiled-native captures are byte-identical. Native JIT and Wasm differ by at most **8.95e−8** in any sample; RMS differences are below 8.5e−10. This is automated numerical evidence, not listening acceptance.

Actual generated memory requirements fell from **86,507,520 to 85,721,088 bytes** for DSP and **87,563,872 to 86,777,504 bytes** including the renderer. The manifest also adds 98,640 bytes of retained capacity for live and pending MSEG allocations. Six active curves occupy 49,320 shared bytes. [Memory details](memory.json) distinguish generated requirements and configured capacity; none of these are a whole-plugin RSS measurement.

The actual browser worker edited stored MSEG source while a note was held: DSP acceptance advanced from serial 10 to 20, one modulation route was installed, **zero sample-buffer events** were sent, audio RMS was 0.05854, and the browser reported no errors. [Browser result](live-browser.json). The real built application was served with cross-origin isolation headers, which shared Wasm memory requires.

Native JIT and compiled-native worker proofs run the full production QuickJS worker and production preparation helper. Instrumentation records JavaScript reservation addresses and the addresses read inside the real native MSEG sample function. Startup installs all six curves; a further shape replacement is acknowledged while a note is held. [Native worker evidence](native-worker.json) records the actual allocations and ACKs, separate from CPU timings.

## Replay and provenance

[Results](results.json), [raw distributions](raw), and [hashes/settings](identity.json) preserve the evidence. `build/shared-mseg-proof/before/` preserves the baseline web build, generated C++, Cmajor and renderer sources; `after/` preserves the measured candidate. Large generated files, captured floats and binaries stay under `build/shared-mseg-proof/`.

Run from the repository root:

```sh
node docs/benchmarks/cosimo-shared-mseg/probe.mjs build/shared-mseg-proof/before/web build/shared-mseg-proof/replay-before before 1
node docs/benchmarks/cosimo-shared-mseg/probe.mjs build/shared-mseg-proof/after/web build/shared-mseg-proof/replay-after after 1
build/shared-mseg-proof/before-jit build/native_plugin_state_runtime/lib/libCmajPerformer.dylib build/shared-mseg-proof/before/WavetableSynth.cmajorpatch build/shared-mseg-proof/fixtures build/shared-mseg-proof/replay-native-before before 1
build/shared-mseg-proof/after-jit build/native_plugin_state_runtime/lib/libCmajPerformer.dylib build/shared-mseg-proof/after/WavetableSynth.cmajorpatch build/shared-mseg-proof/fixtures build/shared-mseg-proof/replay-native-after after 1
```

Use `before-aot`/`after-aot` for compiled native and replace final `1` with `8` for polyphony. The native harness uses actual shared storage/read scopes and actual production renderer externals, with fixtures prepared by the production wavetable algorithm and baseline MSEG algorithm. CPU timing excludes output copying. [Native host](native-host.cpp), [native compile recipe](compile-native.sh), [Wasm probe](probe.mjs), and [fixture preparation](fixtures.mjs) are provided. Native worker proof sources and binaries are preserved under `build/shared-mseg-proof/native-worker/`; [worker compile recipe](compile-worker-proof.sh) rebuilds those exact sources.

These are headless engine and live-browser qualifications. No installed DAW, audio-device deadline, listening, mobile, deployment, or dependency-publication acceptance is claimed.

## Focused checks and existing failures

TypeScript checking and 68 existing runtime-lane, MSEG, and capture-plan checks passed. Native shared-block checks passed with AddressSanitizer and UndefinedBehaviorSanitizer, including interpolation, nested renderer scopes, replacement, retirement, and lookup counts. Independent review reproduced cancellation through the real shared runtime: stopping or replacing the session revoked a submitted curve before audio adopted it.

Five broader failures also reproduce with untouched baseline source and the saved old engine: three modulation bridge cases call an absent `replaceStoredValue` on their runtime fixture; Bounce's pad-tail assertion and recursive legacy-wavetable recipe fail unchanged. No assertions were weakened. The existing browser test server omits the cross-origin isolation headers, so the actual live-browser proof above used a server with those required headers.


## Reusable module extraction regression

The subsequent kit extraction was compared with commit `2bcff19d917a474cb1245c59a622e5d362455204`, which already uses shared MSEG storage. All six baseline/candidate pairs produced byte-identical audio: 131,072 finite, nonzero float32 samples each, with one or eight held notes through A/B morph, curve replacement and loop changes. The saved baseline Cmajor sources and native shared reader were checked against that commit before replay.

| Engine / held notes | Baseline µs/block | Extracted µs/block | Change |
|---|---:|---:|---:|
| Native JIT / 1 | 162.00 | 162.68 | +0.42% |
| Native JIT / 8 | 579.33 | 575.45 | −0.67% |
| Compiled native / 1 | 179.10 | 179.90 | +0.45% |
| Compiled native / 8 | 581.59 | 584.30 | +0.47% |
| Offline Wasm / 1 | 272.55 | 275.24 | +0.99% |
| Offline Wasm / 8 | 646.30 | 644.60 | −0.26% |

The same 48 kHz / 128-frame / nine-group harness ran serially with builds idle. These small mixed differences do not establish a speedup or a material playback regression. DSP memory requirements remain 1,308 pages / 85,721,088 bytes. Production Wasm curve preparation and submission together measured 93.37 → 91.46 µs with one note and 127.67 → 125.21 µs with eight notes.

[Extraction results and timing distributions](extraction-results.json) retain settings and hashes. Exact candidate binaries, web modules, raw captures and replay scripts remain under `build/mseg-extraction-proof/`; the older migration baseline remains untouched. This is automated headless engine evidence, separate from live-browser, installed-host and listening acceptance.
