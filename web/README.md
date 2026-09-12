# Cosimo browser proof

Build the real Cmajor synth, desktop React view, wavetable service, and full local factory bank:

```sh
npm run web:build
```

Serve the generated proof at `http://127.0.0.1:8123`:

```sh
npm run web:serve
```

Run the end-to-end proof, including a real MIDI note and non-silent WebAssembly audio assertion:

```sh
npm run test:web:poc
```

The public page keeps the instrument in a phone-width viewport (430px maximum),
with a gradient backdrop and desktop-only phone recommendation. `synth.html` is
the bare instrument host; the public shell and bare host both receive audio checks.

The generated application lives under `build/web/` and is intentionally not committed.

## Vercel hosting

The shared-memory web synth is deployed at https://synth.song-machines.com/ in
the `cosimo-synth` Vercel project under `andrew-sterns-projects`.
This is separate from the `song-machines` website project.

One command builds, packages the approved public assets, verifies real keyboard
interaction and non-silent browser audio, and deploys that exact directory:

```sh
npm run web:deploy -- --prod
```

Omit `--prod` for a Vercel preview. Use `--dry-run` to build and verify without
uploading. Production updates the existing `cosimo-synth` project; never upload
the repository root. `web/vercel.json` supplies shared-memory isolation headers.
The output is `build/vercel-shared-memory/`.

All builds use `kit/cmake/CosimoDependencies.cmake`. To test unpublished Cmajor
changes, set **one** environment variable to an absolute checkout path:

```sh
COSIMO_CMAJOR_SOURCE=/absolute/path/to/cmajor npm run web:deploy -- --dry-run
```

That source is used by the compiler, headers, and browser support files through
CMake. Unset it to return to the pinned revision, including when reusing build
caches. Production deployment rejects a local source override. There is no
browser-only source-copy option.

## On-device performance HUD

Append `?perf=1` to the app URL (before any `#p=` share fragment) to enable the
AudioWorklet's render-load counters and a small overlay in the top-left corner.
This works on the deployed site too, so dropouts can be diagnosed directly on a
phone. Unlike `?test`, it changes nothing else about the runtime.

The HUD shows the context sample rate, render-quantum size and context state,
then the most recent ~256-block window's average/max DSP load (as a fraction of
the render-quantum budget), cumulative peak load, over-budget block and definite
deadline-miss counts, and late worklet callbacks (`late cb` — the system starving
the audio thread, as opposed to our DSP overrunning it). Tap the HUD to reset
the cumulative counters.
