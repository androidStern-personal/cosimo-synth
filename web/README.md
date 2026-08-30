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

The generated application lives under `build/web/` and is intentionally not committed.

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
