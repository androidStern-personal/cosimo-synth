# SeqFX shared buffer architecture decision

Date: 2026-08-30

This is a measured engineering decision, not a claim about how Effectrix,
Kilohearts, Koala, or another product allocates memory.

## Required windows

- Tape Stop: 20 ms–8 s free, or up to four synced bars. At the supported
  20 BPM floor, four bars are 48 seconds.
- Tape Stop Spin Up can follow that stop with another 48-second phase, so the
  oldest required source may be 96 seconds old.
- Reverse: up to 4 seconds of valid lookback.
- Pitch: 10–120 ms complementary grains over already-warm history.
- Stutter: two bounded one-second capture voices per chain. The one-second cap
  preserves the existing product limit and must be stated when a very slow,
  large block would otherwise imply a longer slice.
- Comb/Vibro/Flange: a separate 250 ms host-rate modulation-delay bank covers
  the 30 Hz Comb floor plus Vibro's slow/deep delay excursion with margin.

## Probe

Command:

```sh
uv run pytest -q tests/test_seqfx_buffer_probe.py
uv run python -m reference_labs.seqfx_buffers.probe \
  --check --output build/seqfx-buffer-probe
```

The probe generates C++ and JavaScript/WASM for each real array layout and
dry-loads it at 44.1, 48, 88.2, 96, and 192 kHz. Exact generated inputs and
`metrics.json` are under the ignored `build/seqfx-buffer-probe/` directory.

| Candidate | Buffer memory | C++ | JS/WASM | All five dry-load rates |
| --- | ---: | --- | --- | --- |
| Current separate one-second Tape/Stutter | 11.719 MiB | pass | pass | pass |
| Naive 96-second host-rate shared history | 575.685 MiB | pass | **fail: Too many array elements** | pass |
| 96-second fixed-48-kHz float history | 145.021 MiB | pass | **fail: Too many array elements** | pass |
| 96-second fixed-48-kHz packed history | 73.243 MiB | pass | **fail: Too many array elements** | pass |
| Tiered, per-chain banks | 39.552 MiB | pass | pass | pass |

The failure is not inferred from memory arithmetic: Cmajor's JavaScript/WASM
generator actually rejects the flattened large arrays. Native dry-load alone
would have hidden that release-surface failure.

## Selected layout

Use four separate per-chain banks instead of one flattened `[chain, sample]`
array:

1. **Primary history:** 16 seconds per chain at 48 kHz, stereo float32.
   Reverse, Pitch, ordinary Tape Stop, and all high-quality fractional reads use
   this tier. It covers four bars at 60 BPM and the full 8-second free range.
2. **Long Tape tier:** 96 seconds per chain at 8 kHz, stereo packed signed
   16-bit in one int32. It exists only for Tape material older than the primary
   tier. Entry is crossfaded and low-pass constrained; it is not used by Pitch
   or Reverse.
3. **Capture voices:** two one-second stereo float32 buffers per chain for
   frozen Stutter captures and bounded retrigger overlap.
4. **Modulation delay:** 250 ms per chain at host-rate stereo float32 for Comb,
   Vibro, and Flange. Feedback is never routed through the rate-converted
   gesture history.

Total buffer storage at the 192 kHz build maximum is 39.552 MiB. Small scalar,
filter, voice, and sequencer state is additional and will be measured again in
the production C++ state after integration.

## Why the quality split is acceptable

- Fixed 48 kHz primary history gives consistent 0–24 kHz source bandwidth at
  every supported host rate instead of allocating four times more memory at
  192 kHz.
- Only a synced Tape gesture longer than 16 seconds can reach the 8 kHz tier.
  Tape replay is then already speed/pitch-reduced; the tier switch must occur
  under an explicit low-pass and complementary crossfade, never as an invisible
  raw quality jump.
- Packed 16-bit is confined to that low-speed long tier. Reverse, Pitch, normal
  Tape settings, Stutter, and feedback/modulation effects stay float32.
- Two Tape/Reverse gesture voices may read the same immutable timeline by
  absolute history age. They do not require duplicate 96-second captures.

## Rejected alternatives

- **Host-rate long history:** rejected for roughly 576 MiB per instance and a
  failed JS/WASM generator.
- **One 48 kHz float tier:** rejected at 145 MiB and the same flattened-array
  codegen failure.
- **Packed 48 kHz everywhere:** rejected because it makes ordinary Reverse and
  Pitch pay a permanent 16-bit quality cost while still using 73 MiB.
- **One flattened tiered array:** rejected because the generator counts the
  flattened elements. Separate per-chain fields are required even when their
  arithmetic memory total is identical.
- **Silent time cap below the displayed sync range:** rejected as dishonest.
  The long tier exists so a four-bar stop at 20 BPM remains a real 48-second
  gesture and a full Stop-plus-Start sequence remains bounded.

## Production gates

- Rate conversion needs deterministic low-pass state and exact absolute-history
  timing at all five sample rates.
- Fractional reads use the separately qualified named interpolator.
- Startup/seek/reset invalidates valid-frame counts; arrays are not cleared in
  an unbounded realtime loop.
- Reading unavailable history yields silence under a complementary fade, never
  stale ring contents.
- The primary/long-tier crossover gets impulse, sine, speech, and discontinuity
  fixtures before Tape Stop acceptance.
- Final C++ state size, JavaScript generation, native build, multiple-instance
  Ableton memory, and ten-minute stress remain release gates.

## Fractional-read qualification

The production patch now names its four-point Catmull-Rom/Hermite reader
`cubicHermite4`; Tape and Stutter no longer carry anonymous inline linear
reads. The independent oracle and measurements live in
`reference_labs/seqfx_buffers/interpolation.py` and are guarded by
`tests/test_seqfx_interpolation.py`.

At 48 kHz with a fractional position of `0.37`, the measured sine-reference
RMS errors were:

| Frequency | Linear RMS error | Hermite RMS error | Improvement |
| ---: | ---: | ---: | ---: |
| 1 kHz | 0.0014124 | 0.000016588 | 85.15x |
| 8 kHz | 0.088295 | 0.0180967 | 4.879x |
| 16 kHz | 0.328924 | 0.205356 | 1.602x |

This does not claim that cubic interpolation alone solves rate-conversion
aliasing. The primary and long Tape tiers still require the explicit low-pass
gates above, and speed-up trajectories need their own antialiasing fixtures.
