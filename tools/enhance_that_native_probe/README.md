# Enhance That VST3 probe

This stock-JUCE console host loads the explicitly selected `EnhanceThat.vst3`.
It checks plugin identity, parameter metadata, host writes, finite stereo
processing and saved-state restoration. It does not build or install the plugin,
create an editor, open an audio device or modify the tested bundle.

From the source checkout:

```sh
cmake -S tools/enhance_that_native_probe -B build/enhance_that_native_probe \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_OSX_ARCHITECTURES=arm64
cmake --build build/enhance_that_native_probe --parallel 4 \
  --target enhance_that_vst3_probe
```

Set `selected_vst3` to the absolute path of the current product bundle and
`probe_results` to a fresh absolute output directory, then run directly:

```sh
mkdir "$probe_results"
"$PWD/build/enhance_that_native_probe/enhance_that_vst3_probe" \
  "$selected_vst3" "$probe_results"
```

Use ordinary bounded command execution (two minutes for the probe) and wait
for its process to exit. There is no separate Node runner or per-build source
hash edit. The executable records the observed bundle path and binary SHA-256,
checks that the binary is unchanged afterward, and exits nonzero on failure.
The output parent must exist; an existing `probe/` child is refused. Both input
paths are resolved before writing; an output inside or equal to the selected
bundle is refused, including symlink aliases. Keep the JSONL assertions and
saved native state blobs, including failed runs.

The assertions cover:

- Eight permanent sound parameter IDs, titles, units, defaults, automation flags,
  continuous ranges and discrete choices; the analyzer parameter is checked
  separately and left unchanged. Only the actual wrapper bypass may be extra.
- All legal discrete values and five normalized continuous positions; finite
  stereo output at 48 kHz/128 frames. Continuous readback tolerance is `1e-6`;
  discrete values are exact.
- Save S, edit all controls to T, restore S; edit again and restore the identical
  S bytes; destroy/recreate the processor and restore S once more. Restoration
  never sends compensating parameter writes or invents editor gestures.
- Each transition processes at least 32 blocks and needs eight consecutive
  matching readbacks within two seconds. State bytes and observed values are
  retained even when an earlier restore fails.

Hosted readback and finite processing do not establish UI gesture recording,
product audio equivalence, disk-saved DAW recall or listening acceptance. Keep
those customer checks separate in [the release guide](../../docs/ENHANCE_THAT_RELEASE.md).
The original failed product run and the [state A/B result](../../docs/ENHANCE_THAT_STATE_AB_RESULTS.md)
remain historical evidence.
