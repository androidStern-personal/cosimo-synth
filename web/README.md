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
