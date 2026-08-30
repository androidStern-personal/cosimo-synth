# Tape Stop v2 implementation evidence

Date: 2026-08-30

This checkpoint implements the behavior contract frozen in
`research/seqfx/tape-stop-benchmark.md`. Competitor claims remain limited to the
official documentation recorded there. No competitor listening result is
invented: the named products were not installed in this worktree.

## Shipped behavior in this checkpoint

- A block trigger starts a one-shot motor gesture. The configured gesture owns
  its lifetime and is not killed when the triggering block ends.
- Stop Time is selectable from 1/32 through sixteen beats, plus the exact current
  cell duration. Free timing covers 20–8000 ms.
- Curve changes the speed trajectory while preserving Stop Time.
- Crossfade to Live returns through a 10 ms click-safe handoff. It never
  secretly overspeeds the captured material.
- Spin Up restarts the captured material from stopped speed to 1x over its
  separately configured Start Time. Entry and the final live handoff are bounded
  to at most 10 ms rather than scaling to ten percent of long gestures. Spin Up
  does not claim to catch the captured timeline up to the moving live head.
- Tempo, timing, curve, return, character, mix, and start/stop durations are
  latched when the gesture starts. Later edits affect the next trigger.
- Two bounded playback voices let a retrigger crossfade away from an existing
  gesture. A third trigger steals the quieter voice, then the older voice.
- Character is neutral at zero. Above zero it adds bounded, speed-linked
  high-frequency loss and rational saturation.
- Reset, discontinuous seek, authoritative pattern replacement, disable, and
  completed bypass fade invalidate history and active voices.

## History and interpolation

Each of four chains owns:

- 16 seconds of stereo float history at a fixed 48 kHz primary rate;
- 96 seconds of packed stereo int16 history at a fixed 8 kHz coarse rate;
- absolute 64-bit write/read positions;
- cubic Hermite reads in both tiers; and
- a 14.5–15.5 second crossfade between the primary and coarse histories.

The layout is intentionally split into one fixed array per chain. The Cmajor
JavaScript generator rejected the equivalent nested aggregate during the buffer
probe; the selected representation compiles to C++, WebAssembly, and JavaScript.
The architecture and interpolation measurements are recorded in
`research/seqfx/buffer-architecture.md`.

## Compatibility mapping

Legacy v5 Tape Stop state did not store tempo or sample rate. Its migration is
therefore explicitly canonical, not falsely described as sample-accurate:

- 120 BPM and a 1/16-note cell establish 125 ms per legacy cell;
- old duration scale becomes Free Stop milliseconds;
- old curve power becomes the logarithmic v2 curve control;
- old Stop becomes Crossfade to Live and old Spin Up remains Spin Up;
- old catch-up percentage becomes Free Start milliseconds; and
- Character starts neutral while old Tape aux targets are disabled.

The original `seqfx.v6` value remains untouched while the bridge writes the
migrated `seqfx.v7` state.

## Automated evidence

The focused Cmajor and state suites prove:

- a one-cell trigger has wet output after its block has ended;
- pitch/speed falls over the stop;
- trigger-latched controls ignore mid-gesture aux motion;
- exit, adjacent retrigger, and third-trigger stealing stay finite and bounded;
- a tempo edit does not retime an active synced gesture;
- reset invalidates history;
- Crossfade to Live does not play faster than the dry timeline;
- 20 ms and 8000 ms Free stops remain distinctly short and long;
- Character is finite, bounded, and audibly changes the slow-tape waveform;
- a 48-second synced stop crosses into packed coarse history without silence or
  a discontinuity; and
- the v2 inspector persists all eight parameters, conditionally exposes Start
  Time and free milliseconds, hides invalid live modulation, and does not
  overflow its container.

Commands run for this checkpoint:

```text
cmaj play --dry-run --stop-on-error --sample-rate=<44100|48000|88200|96000|192000> fx/seqfx/SeqFx.cmajorpatch
cmaj generate --target=javascript --output=/tmp/seqfx-v2.js fx/seqfx/SeqFx.cmajorpatch
uv run pytest -q tests/test_seqfx_probe.py tests/test_seqfx_buffer_probe.py tests/test_seqfx_interpolation.py
node --test tests/test_seqfx_sparse_state.mjs tests/test_seqfx_effect_definitions.mjs tests/test_seqfx_state.mjs
node --test tests/test_seqfx_patch_view_browser.mjs
npm run fx:build -- seqfx
```

At checkpoint time, the Python DSP/buffer/interpolation set passes 68/68 and the
selected state/definition set passes 43/43. The browser suite passes 54/55; its
only failure is the pre-existing React Grab dev-marker assertion, while all Tape
Stop v2 browser cases pass. Cmajor dry-run passes at all five listed sample
rates, and JavaScript generation produces a 1,321,001-byte runtime source file.

## Gates still open

- Deliberate listening against drums, sustained harmony, and voice in the built
  VST3 has not yet been performed.
- Direct competitor listening is still unavailable because the named products
  are not installed/licensed here.
- Ableton recall, strict plugin validation, signed/notarized packaging, and clean
  install qualification belong to the final roadmap phase and are not implied
  by this source-level checkpoint.
