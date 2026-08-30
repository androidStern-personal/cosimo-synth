# SeqFX Vibro decision and implementation evidence

Date: 2026-08-30

## Authority

Documented facts:

- Koala FX publicly names one combined `Vibrato/Flanger` effect. Its public
  page does not publish the internal delay curve, timing ranges, feedback,
  stereo law, or defaults. <https://www.elf-audio.com/koalafx/>
- Julius O. Smith's *Physical Audio Signal Processing* describes vibrato as a
  quasi-periodic frequency shift made with a modulated delay line, because a
  time-varying delay induces Doppler shift. It also identifies interpolation as
  necessary for smoothly varying delay without zipper noise.
  <https://www.dsprelated.com/freebooks/pasp/Vibrato_Simulation.html>
  <https://www.dsprelated.com/freebooks/pasp/Delay_Line_Signal_Interpolation.html>
- Kilohearts documents Chorus as delayed voices mixed with the source, with
  average Delay, Depth, Rate, Spread, voice count, and Mix. Its Flanger mixes a
  slightly delayed signal with dry, adds Feedback, and can add phase-offset
  motion. <https://kilohearts.com/products/chorus>
  <https://kilohearts.com/products/flanger>
- Effectrix2 documents a combined Chorus/Flanger modulation page with Sync and
  Free Rate, Depth with selectable curves, delay Offset, normal/inverse
  Feedback, and Width. It identifies roughly 1–20 ms as flanging and 20–50 ms
  as chorus territory. <https://downloads.sugar-bytes.de/manuals/Effectrix2.pdf>

Those sources establish the family distinction used here: pure wet
time-varying delay creates vibrato; adding direct dry creates chorus/flanging;
short delay and feedback strengthen the flange identity. They do not reveal
Koala's private implementation.

## SeqFX product decision

Vibro is a block-sequenced, wet-only Doppler effect at append-only ID 10. It
does not mix a second dry path inside its algorithm and has no feedback. The
common Block Mix remains available outside the effect. Flange stays a separate
ID and will own dry-plus-short-delay combing and feedback.

The public controls are:

- Rate: 0.05–12 Hz in Free mode;
- Depth: 0–100 cents, defined as the exact half peak-to-peak pitch span;
- Wave: Sine or Triangle, trigger-latched;
- Spread: 0–180 degrees of right-channel modulation phase;
- Timing: Sync or Free, trigger-latched;
- Division: 1/32, 1/16, 1/8, 1/4, 1/2, or 1 Bar per cycle in Sync mode;
- the common Block Mix.

Rate, Depth, and Spread are Aux eligible. Wave, Timing, and Division latch at a
block trigger. Rate remains visible in Sync mode with a literal inspector hint
that Division and host tempo then own the actual rate. A future inspector
hierarchy may conditionally dim it, but the state and DSP meanings do not
change.

The roadmap's optional Drift control was rejected: it was conditional on a
listening win, and no listening evidence exists that justifies another control
or a seeded-randomness lifecycle. Timing and Division use the available public
slots instead and implement the established Sync/Free vocabulary directly.

## Pitch-depth and delay law

Let the requested half peak-to-peak depth be `c` cents. The implementation uses

```text
delta = tanh(c * ln(2) / 1200)
```

as the peak read-rate deviation around one sample per sample. This makes the
ratio between the fastest and slowest read rates exactly `2^(2c/1200)`, so the
displayed `c` is the exact half of the peak-to-peak pitch interval. A periodic
delay must return to its starting position and therefore average a read rate of
one. That creates a tiny geometric-center offset; trying to remove it would
make the read head drift indefinitely.

For Sine, the delay is the analytic integral of sinusoidal read-rate motion.
For Triangle, the delay is the analytic integral of a triangle read-rate wave;
the pitch motion is therefore triangular rather than merely drawing a triangle
in delay space. Both shapes use the same `delta`, so their displayed depth is
comparable.

These equations, the exact depth definition, the 4-sample safety offset, and
the six-division subset are Cosimo engineering choices. They are not claimed
competitor matches.

## History, stereo, and lifecycle

Vibro has a 400 ms raw stereo host-rate history per chain and reads it with the
qualified four-point Hermite interpolator. The original 250 ms architecture
estimate was corrected before checkpointing: at 48 kHz, 0.05 Hz and 100 cents
need about 8,815 samples of sinusoidal delay amplitude, or about 367 ms
peak-to-peak delay range including offset. A 400 ms bank preserves the stated
range without silently clipping it.

The raw pre-Vibro chain signal is always written to history, so there is no
feedback and the delay is warm before a normal authored block. Missing startup
or reset history returns dry and then enters through a 96-frame availability
fade. An authoritative reset invalidates the frame count and phase; stale ring
contents cannot become audible.

Spread offsets only the right modulation phase. Zero degrees yields identical
dual-mono output; 180 degrees yields opposite motion with a useful nonzero mono
fold. The phase free-runs while transport processing advances and is not reset
by ordinary repeated block triggers. Continuous controls smooth over 25 ms,
Wave changes crossfade over 96 frames, and common block entry/exit also uses 96
frames. Zero Depth is exact pass-through. Vibro has no tail after block exit.

## Automated evidence

`tests/test_seqfx_probe.py` proves:

- Free Rate and displayed half peak-to-peak Depth against a ramp/read-rate
  oracle;
- Sync Rate against host BPM and Division;
- bit-exact zero-Depth pass-through;
- dual-mono output at zero Spread and useful stereo plus mono fold at 180°;
- distinct Sine and Triangle motion with matched displayed depth;
- click-safe block exit with no tail; and
- click-safe transition when the slowest/deepest cold history first becomes
  available.

`tests/test_seqfx_effect_definitions.mjs` locks the six-control contract,
trigger/Aux policy, wet-only seams, and official vendored Fontaudio
`fad-modtri` identity. `tests/test_seqfx_patch_view_browser.mjs` proves all six
controls sequence and persist through sparse v7 state, only Rate/Depth/Spread
appear as Aux targets, and the block glyph displays both stereo trajectories.
The packaged shadow-root test repeats the inspector, modulation, glyph, and
overflow checks against the production bundle.

Checkpoint qualification passed 130 combined DSP/buffer/interpolation/Comb-lab
tests, 110 non-browser state and contract tests, all 60 source-browser tests,
all 7 packaged-browser tests, the production UI/worker build, and Cmajor
dry-load at 32, 44.1, 48, 88.2, and 96 kHz.

Subjective listening, factory-preset tuning, native CPU, Ableton recall, and
release qualification remain shared later-roadmap gates and are not inferred
from these automated tests.
