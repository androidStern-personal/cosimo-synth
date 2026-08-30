# SeqFX Pitch production decision

Date: 2026-08-30

This decision separates published product behavior from SeqFX engineering. It
does not claim access to Kilohearts or Sugar Bytes source code.

## Established patterns

- [Kilohearts Pitch Shifter](https://kilohearts.com/products/pitch_shifter)
  explicitly describes a grain-delay pitch shifter. Its public vocabulary is
  semitone Pitch, Grain Size, Jitter, Mix, and an optional `Correlate` mode.
  Kilohearts says correlation is clearer for many inputs while warning that it
  can struggle with complex pads and textures. That is strong evidence that a
  useful production grain shifter needs waveform-aware grain joins, not only
  two blind moving delay taps.
- The [Effectrix2 manual](https://downloads.sugar-bytes.de/manuals/Effectrix2.pdf)
  describes overlapping grains, Grain Size, Density, stepped/free Pitch,
  Width, and Jitter. It specifies that Jitter assigns pitch and position when a
  grain is born and holds those values for that grain's lifetime.
- Julius O. Smith's delay-line references describe
  [fractional-delay interpolation](https://www.dsprelated.com/freebooks/pasp/Delay_Line_Signal_Interpolation.html)
  and recommend crossfading between read pointers for
  [large delay changes](https://www.dsprelated.com/freebooks/pasp/Large_Delay_Changes.html).

## Selected SeqFX behavior

Pitch is a two-head, complementary-Hann grain-delay shifter over the shared
fixed-48-kHz float history. Grain phase advances by the selected Grain lifetime
regardless of the requested transposition; each source pointer advances by the
exact `2 ^ (cents / 1200)` ratio. This matters at zero shift: Jitter still gets
new grain births instead of leaving two fixed detunes to drift forever. Cubic
Hermite interpolation is the already-qualified fractional reader.

Blind complementary heads were not accepted. On a 440 Hz fixture with the
default 48 ms grain, the grain-cycle sideband became louder than the requested
note: the prototype measured 898.315 Hz for +12 semitones and 210.754 Hz for
-12. SeqFX now aligns each silent grain birth to the active complementary head
using a bounded normalized waveform search:

- 16 recent stereo sample pairs are compared;
- coarse candidates cover plus or minus 16 ms at the fixed history rate;
- the best candidate receives a one-sample refinement pass;
- silence and unavailable history skip alignment;
- the search runs only at grain birth, never per output sample;
- alignment state is reset deterministically on authoritative lifecycle reset.

This is the always-on clarity path, not a hidden user parameter. The public
surface therefore stays compact while applying the established correlation
lesson. It is independently implemented from the published behavior above.

With initial and subsequent grain alignment, the same automated fixture
measured 879.456 Hz, 219.910 Hz, and 453.003 Hz for +12, -12, and +50 cents;
all are inside the 0.8 Hz production oracle. The target tone is dominant rather
than a grain-rate sideband.

## Public contract

| Control | Range | Runtime behavior |
| --- | --- | --- |
| Pitch | -24 to +24 semitones | Direct edit snaps to semitones; aux is continuous and smoothed |
| Fine | -100 to +100 cents | Continuous, smoothed |
| Grain | 10 to 120 ms | Trigger-latched; not aux eligible |
| Jitter | 0 to 100% | Seeded pitch and source-position values renewed at grain birth |
| Spread | 0 to 100% | Symmetric source-position offset; zero is dual mono |
| Block mix | 0 to 100% | Existing click-safe per-block mix ramp |

An exact zero shift with no Jitter returns the input bit-for-bit. Pitch and Fine
can move continuously under Aux without resetting grain phase. Re-entering the
same active block does not restart the RNG or murder a live grain.

## Timing and lifecycle

SeqFX adds no reported host latency: a selectively sequenced cell cannot delay
the whole dry plugin stream without moving every other cell. Pitch instead
reads already-warm past audio. At the maximum public transposition plus
Grain/Jitter/Spread values, the bounded wet lookback is under 480 ms, including
the 16 ms alignment search and four-point interpolation guards.
`pitchHistoryFade` admits wet audio only after valid history exists.

Stop, seek discontinuity, authoritative pattern replacement, reset, and sample
rate reinitialization invalidate the history/read state. Entry and exit use the
shared transition ramp, and no Pitch tail survives its authored block.

## Automated evidence

`tests/test_seqfx_probe.py` covers:

- measured +12, -12, and +50-cent pitch;
- bit-exact neutral behavior;
- bounded transient lookback and no future read;
- seeded repeatability and distinct Jitter texture;
- dual-mono zero Spread and stereo nonzero Spread;
- identical retrigger continuity;
- Aux sweeps for every continuous control and exclusion of Grain;
- click-safe exit, reset invalidation, finite/bounded output, and four-chain CPU.

The source and packaged browser suites cover the five-control inspector,
four honest modulation rows, sparse-v7 persistence, Fontaudio identity,
complementary-grain block glyph, and horizontal overflow.

## Gates still requiring ears or a host

Automated frequency and lifecycle qualification is not subjective acceptance.
Before release, listen at matched level on drums, bass, voice, sustained chords,
and dense pads; compare default and extreme Grain/Jitter settings with the
Kilohearts and Effectrix references; and verify recall/bypass timing in Ableton.
