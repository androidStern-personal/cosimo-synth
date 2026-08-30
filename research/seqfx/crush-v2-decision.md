# Crush v2 decision and implementation evidence

Date: 2026-08-30

This checkpoint replaces SeqFX's opaque hold-frame Crusher surface with an
evidence-backed converter model while preserving persisted effect ID `2` and
the old sound through an explicit compatibility mode.

## Documented product facts

- [Kilohearts Bitcrush](https://kilohearts.com/products/bitcrush) exposes Rate,
  Bits, Dither, ADC Q, DAC Q, and Mix. Its public range gives Rate a 200 Hz
  minimum. This establishes separate pre- and post-converter quality controls
  rather than one unexplained Tone knob.
- [Sugar Bytes Effectrix2's manual](https://downloads.sugar-bytes.de/manuals/Effectrix2.pdf)
  documents Bit Depth modes named Normal, High, Low, Clip, and Progressive and
  Sample Rate modes named Normal, Dynamic, Absurd, and Smooth. This establishes
  smoothed and progressive reduction as mature character categories; it does
  not disclose their internal equations.
- [Ableton Live's Redux documentation](https://www.ableton.com/en/manual/live-audio-effect-reference/#redux)
  exposes Rate, Jitter, pre/post filtering, Bits, Shape, and DC Shift. This
  independently supports treating rate reduction, resolution reduction,
  converter filtering, and DC behavior as separate concerns.

No competitor was installed or measured in this worktree. The facts above are
limited to public documentation and are not claims of sample-for-sample
matching.

## Engineering decisions

- `Original` maps Rate to `round(hostSampleRate / Rate)` and exactly preserves
  the shipped clip, gain, hold, quantize, and mix order at 48 kHz. Legacy v5
  `Hold Frames` maps to `48000 / holdFrames`, including aux endpoints.
- `Classic` uses a phase accumulator so the displayed Rate remains the same
  converter frequency at 48 and 96 kHz. Drive is applied before clipping,
  repairing the old ordering without changing `Original`.
- `Smooth` uses smoothstep interpolation between captured samples. It keeps the
  reduction identity but widens the useful low-rate region by removing the
  brittle staircase edge.
- `Progressive` independently interprets Effectrix2's documented category as
  quantized capture-to-capture differences. A bounded accumulator and DC
  blocker prevent drift. This is an engineering inference, not reverse
  engineering of Sugar Bytes' algorithm.
- ADC Q and DAC Q continuously blend first-order anti-alias/reconstruction
  filtering around a cutoff derived from the converter Rate. Neutral zero is
  the raw aliased converter. A separate Tone control was rejected because it
  overlaps this established converter vocabulary.
- Dither is deterministic TPDF with fixed per-chain/channel seeds. It defaults
  off and is only generated at capture boundaries.
- Character is trigger-latched. Bits, Rate, Drive, ADC Q, DAC Q, and Dither are
  safe aux targets.

## Automated evidence

The focused fixtures prove:

- the `Original` 48 kHz output matches the shipped Crusher oracle;
- a 12 kHz Rate produces the same capture frequency at 48 and 96 kHz;
- `Smooth` has more moving samples and smaller discontinuities than `Classic`;
- deterministic dither repeats exactly and lowers quantization-error
  correlation on the low-level fixture, and an authoritative reset restarts
  its seeded sequence;
- ADC Q/DAC Q reduce measured alias energy at a 4 kHz converter rate;
- `Progressive` is distinct, finite, bounded to 1.2, and DC controlled;
- v5 state and aux endpoints migrate to the canonical Rate mapping;
- all seven controls persist through the source inspector and redraw its honest
  preview; and
- the production shadow-root inspector retains its layout and modulation
  controls.

Commands run for this checkpoint:

```text
cmaj play --dry-run --stop-on-error --sample-rate=<44100|48000|88200|96000|192000> fx/seqfx/SeqFx.cmajorpatch
cmaj generate --target=javascript --output=<temporary>/seqfx-crush.js fx/seqfx/SeqFx.cmajorpatch
uv run pytest -q tests/test_seqfx_probe.py tests/test_seqfx_buffer_probe.py tests/test_seqfx_interpolation.py
node --test tests/test_seqfx_effect_definitions.mjs tests/test_seqfx_sparse_state.mjs tests/test_seqfx_state.mjs tests/test_seqfx_runtime_bridge.mjs tests/test_seqfx_preset_adapter.mjs tests/test_seqfx_worker_service.mjs tests/test_seqfx_crusher_preview.mjs
node --test tests/test_seqfx_patch_view_browser.mjs
npm run fx:build -- seqfx
node --test --test-name-pattern='SeqFX packaged shadow-root flow renders the selected crusher and stutter inspectors' tests/test_seqfx_production_view_browser.mjs
```

At checkpoint time, the combined DSP/buffer/interpolation suite passes 76/76;
the selected state/definition/preview suite passes 87/87; Cmajor dry-run passes
at all five sample rates; and JavaScript generation produces a 1,342,623-byte
runtime source file. The browser suite passes 54/55. Its sole failure remains
the pre-existing React Grab dev-marker assertion; all Crush tests pass. The
focused packaged inspector test passes.

## Gates still open

- Deliberate listening on drums, bass, chord, and speech in the built VST3 has
  not yet been performed.
- Direct competitor listening is unavailable because the named products were
  not installed or licensed here.
- Strict plugin validation, Ableton recall, signing/notarization, and clean
  install qualification remain Phase 8 gates and are not implied by this
  source-level checkpoint.
