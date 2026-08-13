# Warp atlas diagnostic

This developer tool keeps the archived 67.9 MiB warp-basis atlas available for
direct comparison without adding it to the product, preset state, automation,
or normal startup. The normal invocation has no atlas path, allocates no atlas
storage, and calls the existing `WarpRenderer` atlas overload with an empty
view.

The canonical external asset is exactly 71,170,064 bytes with SHA-256:

`faf3a9d7cb967ae1a572b4ff5dfdfb874641c0f942eabec1c789566b527f2157`

The tool validates both values before it prepares source tables or renderer
state. The asset remains outside Git and must be supplied explicitly.

## Run it

Runtime-only is the default:

```sh
python3 tools/warp_atlas_diagnostic/run_warp_atlas_diagnostic.py \
  --output-dir /tmp/cosimo-warp-runtime
```

Supplying `--atlas` enables the renderer's existing automatic eligibility and
64-frame handoff behavior. This is the live diagnostic form of the startup
flag. Before capture, it observes one complete atlas-to-runtime-to-atlas
transition through that unmodified state machine:

```sh
python3 tools/warp_atlas_diagnostic/run_warp_atlas_diagnostic.py \
  --atlas /path/to/warp-basis-atlas.i16 \
  --output-dir /tmp/cosimo-warp-auto
```

For a pure paired capture, add `--compare`:

```sh
python3 tools/warp_atlas_diagnostic/run_warp_atlas_diagnostic.py \
  --compare \
  --atlas /path/to/warp-basis-atlas.i16 \
  --output-dir /tmp/cosimo-warp-comparison
```

The comparison writes one runtime-only and one atlas-only WAV for every case,
plus `comparison.json`. That report contains per-case audio differences and CPU
time, along with process RSS. It deliberately has no similarity pass threshold.
`--quick` shortens the capture for loader and harness checks.

## Comparison contract

- Both processes use the same compiled sine table, control schedule, initial
  renderer phase, warm-up, sample rate, and oversampling.
- Runtime-only supplies an empty atlas view. Atlas-only uses the existing family
  state latch to hold the eligible family at an atlas mix of one; it verifies
  that no crossover occurred on every rendered frame.
- The matrix covers bend, PWM, asymmetry, and mirror at their neutral/centred and
  extreme control positions. Mirror has no identity amount, so its centred
  position is the neutral control case.
- Two PWM captures straddle an atlas output-mip pitch boundary.
- The normal auto-handoff mode does not touch the family latch. No renderer core
  or bridge behavior is replaced by this tool.

The runner builds from the checked-in renderer and vendored xsimd headers. On
macOS it uses CommonCrypto for the startup SHA-256 check. It does not contain an
atlas generator or a copy of the archived binary; those are evidence inputs,
not runtime dependencies.
