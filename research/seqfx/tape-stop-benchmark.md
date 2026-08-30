# Tape Stop Benchmark and SeqFX Contract

This document separates official product facts, local measurements,
engineering inferences, and SeqFX product decisions. It is the authority for
Tape Stop v2; earlier conversational control proposals are not treated as
competitor facts.

## Availability and measurement status

No benchmark Tape Stop product is installed on this machine. No demo was
installed because installing third-party software is a separate action. As a
result, the product rows below contain official documented behavior only. Their
listening and waveform columns remain explicitly unmeasured.

| Product | Official behavior | Local listening status |
|---|---|---|
| Kilohearts Tape Stop | A `Play` motor state plus separate `Stop Time`, `Start Time`, and `Curve`; stop and start each describe reaching zero/full speed | Not installed; unmeasured |
| Effectrix2 Vinyl | `Time`, `Slope`, Tape Stop, Tape Start, and Tape Stop Msec; time can therefore be musical or absolute | Not installed; unmeasured |
| Looperator Tape Stop | Simulates stopping a recorder/turntable while output remains audible; five named stop profiles; tied steps extend an effect gesture | Not installed; unmeasured |
| Arturia Tape MELLO-FI | Speed and pitch change together; sync range is 1/4 bar through 8 bars; DAW can continue while tape is stopped; Instant Tape Catch-up is optional | Not installed; unmeasured |
| Cableguys TimeShaper 3 | Buffered time scrubbing, tempo-locked tape stops, and smoothing before hard time steps | Not installed; unmeasured |

Sources:

- https://kilohearts.com/products/tape_stop
- https://kilohearts.com/docs/snapins
- https://downloads.sugar-bytes.de/manuals/Effectrix2.pdf
- https://downloads.sugar-bytes.de/manuals/Looperator.pdf
- https://www.arturia.com/products/software-effects/tape-mello-fi/overview
- https://support.arturia.com/hc/en-us/articles/4414426565010-Tape-MELLO-FI-General-Questions
- https://downloads.cableguys.com/Cableguys-ShaperBox-3-Manual.pdf

Primary algorithm reference:

- Vadim Zavalishin and Julian Parker, “Efficient Emulation of Tape-like Delay
  Modulation Behavior,” DAFx-18:
  https://www.dafx.de/paper-archive/2018/papers/DAFx2018_paper_9.pdf

## What the evidence settles

These are documented patterns, not SeqFX inventions:

1. A tape stop is variable-speed replay: speed and pitch fall together.
2. Stop and restart are distinct phases and can have distinct durations.
3. Curve/slope is a first-class control, not a hidden tuning constant.
4. Musical sync and absolute-time operation are both established.
5. A motor can stop while the host transport continues.
6. Instant catch-up is a recognizable optional return behavior.
7. Buffered time scrubbing needs discontinuity smoothing.
8. A step/tie can describe when a sequenced gesture is authored without proving
   that a configured audio gesture must be truncated at that boundary.

The manuals do not settle the exact waveform of every curve, a universal block
release rule, or a universal retrigger voice-steal rule. SeqFX therefore names
those as product decisions below and tests them as its own behavior.

## Rejected current behavior

The v1 processor fades its wet target to zero at a block boundary and returns
to live audio even if the slowdown duration has not completed. It also performs
a near-live read-head jump during catch-up. This directly causes the reported
failure: it is difficult to find a useful setting and the wanted tail is cut
off by the authored cell.

The following are rejected:

- block-end hard lifetime for a one-shot slowdown;
- one hidden duration scale covering stop, hold, and return;
- a read-head teleport presented as motor acceleration;
- a displayed minimum rounded above the actual speed floor;
- overwriting a live read head on retrigger with no bounded transition policy.

## SeqFX Tape Stop v2 product contract

The contract uses established motor vocabulary while adapting it to a block
sequencer. The adaptation is an explicit SeqFX decision.

### Authored event and lifetime

- A block start triggers one tape-stop gesture.
- The gesture's `Stop Time`, not the block's right edge, determines when its
  slowdown reaches rest. A one-cell block can therefore produce a one-beat or
  one-bar tail.
- The block still owns mix and parameter automation while it is active. When it
  ends, the latched gesture parameters remain authoritative until that gesture
  completes; editing a future block cannot mutate the sounding gesture.
- At full stop, a short DC-safe terminal fade removes the stationary-sample
  residue. The effect never emits a held DC sample as “stopped tape.”

This is a bounded `gesture` lifecycle, not an unbounded `tail` or a hidden dry
signal running underneath it.

### Controls

| Control | Contract |
|---|---|
| Stop Time | Sync values from 1/32 through 4 bars, with 1 cell, 1 beat, and 1 bar as strong snaps; free range 20 ms through 8 s |
| Curve | Continuous centered control spanning front-loaded, linear-speed, and back-loaded deceleration; center is the safe default |
| Return | `Catch Up` or `Spin Up`; names describe audible behavior |
| Start Time | Used only by `Spin Up`; same sync/free timing vocabulary, default faster than Stop Time |
| Character | A bounded high-frequency loss/saturation amount coupled to slow playback; neutral remains clean |
| Mix | Common SeqFX block mix, with equal-power transition at state changes |

There is no separate `Tail` knob. Tail duration is the honest Stop Time. There
is no `Throw/Brake` control in v2: dry-under-tail would add a second mix law and
is unsupported by the gathered product documentation.

### Return behavior

- `Catch Up` is the sequencer default. After the stop gesture reaches its
  terminal fade, the processor crossfades to the current live chain signal. It
  is the SeqFX equivalent of documented instant catch-up, but it is smoothed and
  does not expose a discontinuous read-head teleport.
- `Spin Up` accelerates the captured timeline according to `Start Time` and the
  inverse motor curve, then crossfades to live only when its read position is
  close enough to make the handoff click-safe.
- Neither mode plays a hidden overspeed burst above the documented motor curve.

### Capture, retrigger, and reset

- Each chain keeps rolling history warm before a trigger, so the slowdown has
  valid material immediately.
- Two bounded gesture voices are allowed per chain. A retrigger starts the idle
  voice and crossfades from the prior voice. A third trigger steals the quieter
  or older voice with the same short transition; allocation is fixed and
  realtime-safe.
- Host seek, discontinuous loop jump, authoritative pattern replacement, sample
  rate reset, and explicit reset invalidate captured history and fade safely to
  live input.
- Tempo changes do not retime a gesture already triggered. They affect the next
  synced gesture, matching a latched sequencer event rather than stretching an
  active buffer unpredictably.

The two-voice policy is an engineering decision chosen because it is bounded
and audibly testable; it is not attributed to a benchmark product.

### Variable-speed implementation requirements

- A monotonically increasing read head advances by the motor speed; speed and
  pitch therefore change together.
- Fractional reads use a named interpolator and a rolling buffer sized from the
  supported maximum Stop/Start window.
- Speed-up playback is filtered or quality-limited using the DAFx variable-speed
  guidance; it is not allowed to alias without measurement.
- Entry, terminal fade, return, and retrigger use complementary short windows.
- Every output sample must remain finite at 44.1–192 kHz.

## Executable acceptance fixtures

Production Tape Stop v2 is not accepted until automated renders prove:

1. a one-cell block with a one-beat Stop Time remains audibly slowed beyond the
   cell boundary;
2. impulse spacing and sine zero-crossing rate follow the same speed curve;
3. center Curve is monotonic and reaches the displayed Stop Time within one
   render block tolerance;
4. Catch Up never creates a boundary jump larger than the dry-source screening
   threshold;
5. Spin Up reaches live speed in the displayed Start Time without overspeed;
6. two quick retriggers and a third-trigger steal remain finite and click-safe;
7. an edit to a future block does not change the sounding gesture;
8. seek/reset prevents old buffered speech or impulses from leaking;
9. a tempo change affects only the next synced trigger;
10. state migration maps every legacy Tape Stop vector deterministically and
    records that mapping.

## Listening matrix still requiring a human/product install

If benchmark plugins are later installed with authorization, render the source
set named in the roadmap at 48 kHz and compare trigger timing, curve shape,
terminal behavior, restart, retrigger, and click character. That work may tune
defaults and presets. It may not silently change the contract above without an
updated decision record and fixtures.
