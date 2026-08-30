# SeqFX Stutter v2 production decision

Date: 2026-08-30

Status: implemented and automatically qualified; subjective listening and
Ableton timing/recall remain Phase 8 gates.

This record separates official product behavior from the SeqFX adaptation. It
does not claim to reproduce another product's private capture or crossfade
algorithm.

## Documented product patterns

### Ableton Beat Repeat

The official [Live 12 audio-effect reference](https://www.ableton.com/en/manual/live-audio-effect-reference/#beat-repeat)
documents an immediate capture-and-repeat pattern: `Repeat` captures material
when engaged, `Grid` chooses the captured slice size, and the slice repeats for
the configured `Gate` duration or until Repeat is released. It also distinguishes
dry-plus-repeat, insert, and repeat-only mix modes.

This establishes that a beat repeat may legitimately spend its first slice
recording current input before the first repeat. It does not require lookback or
plugin-wide latency.

### Sugar Bytes Effectrix2

The official [Effectrix2 manual](https://downloads.sugar-bytes.de/manuals/Effectrix2.pdf)
describes Looper B as a buffer repeated according to `Size`, with explicit
playback-speed start/end, curve, decay, swing, volume, and dry/wet controls. Its
capture modes distinguish a normal loop, continuously recaptured audio, and an
endless frozen loop.

This establishes loop-size and resampled-speed vocabulary and, importantly,
makes recapture policy an explicit product behavior rather than an accidental
buffer overwrite.

### Sugar Bytes Looperator

The official [Looperator manual](https://downloads.sugar-bytes.de/manuals/Looperator.pdf)
describes forward/reverse loop styles, repeat counts, and ties that extend one
effect across contiguous sequencer steps. It frames the Looper as rhythmic
repetition of sliced input, not a free-running delay.

This establishes that the authored step region and repeat structure should stay
visibly related. SeqFX's block-relative `Slices` control already provides that
relationship.

### Koala FX

The official [Koala FX page](https://www.elf-audio.com/koalafx/) names Stutter and
advertises smooth cuts and crossfades, but publishes no parameter ranges or
capture timing. Koala is therefore authority for the requested effect identity,
not for undocumented internals.

## Product choice

SeqFX Stutter remains a **capture-first, block-relative beat repeat**:

1. A block trigger captures the first `block duration / Slices` region, capped
   at one second by the qualified capture-bank architecture.
2. The first repeat begins when that region is complete. There is no lookback,
   future read, or hidden host latency.
3. The captured region repeats until block exit while Speed, Shape, Gate, Mix,
   and eligible Aux movement remain live.
4. A retrigger records a fresh first slice in the second bank while the previous
   completed loop remains audible.
5. When the new capture is complete, the two banks crossfade over 96 frames.
6. A third trigger reuses a pending capture first, otherwise the inactive or
   quieter/older bank. It never allocates a third voice or overwrites the loop
   carrying the output.
7. Block exit fades to dry through the same bounded handoff instead of dropping
   the capture at the cell boundary.

The inspector states the capture-first, one-second, retrigger behavior literally.

## Controls retained

| Parameter | Contract | Lifecycle |
| --- | --- | --- |
| Slices | 2–32 divisions of the authored block; capture uses the largest needed first slice and is capped at one second | Trigger-latched base; Aux eligible for safe subdivision |
| Speed | 0.5x–2x resampled playback | Continuous; Aux eligible |
| Shape | Morph through Gate, Triangle, Bell, Ramp Down, and Ramp Up cut envelopes | Continuous; Aux eligible |
| Gate | Audible fraction of every cut | Continuous; Aux eligible |
| Block Mix | Common SeqFX dry/wet law | Continuous |

No extra Sync/Free mode is added. The SeqFX block is already host-musical, and
`Slices` expresses repeat length relative to its visible duration. Adding a
second timing system would make the same job harder to author without improving
the established capture-first behavior.

Reverse and alternating playback are omitted. Reverse has its own effect ID and
lookback contract; hiding it inside Stutter would make both effects less legible.

## DSP and resource design

- Two separate one-second host-rate stereo arrays are allocated per chain.
  Keeping them as `stutterHistory0` and `stutterHistory1` preserves the
  flattened-array codegen limit proven in `buffer-architecture.md`.
- Each voice owns capture/read length, phase, gain, generation, and a frozen
  copy of the controls that were live when it stopped being the current voice.
  A pending retrigger therefore cannot change the outgoing loop's gate, speed,
  or slice structure before the handoff.
- The current voice continues to accept Aux movement. Downward Slices
  modulation never reads beyond the largest slice captured at trigger.
- Four-point cubic Hermite interpolation and the existing at-most-5-ms loop-wrap
  crossfade remain in place across 0.5x–2x playback.
- The capture-first pass remains audible only when there is no completed loop.
  During retrigger capture, the previous loop replaces that raw pass.
- Pattern authority, reset, seek, transport discontinuity, and bypass flush
  invalidate both voice flags immediately. Buffer arrays need not be cleared on
  the audio thread because no stale voice can read them afterward.

## Rejected alternatives

### Keep the single capture buffer

Rejected because every retrigger resets the write head and immediately stops the
active repeat. The failure is audible and was reproduced by a red test before
the two-bank implementation.

### Read pre-trigger lookback

Rejected because Ableton's established immediate Beat Repeat contract validates
capture-first behavior, existing SeqFX projects already use it, and Reverse owns
the explicit past-lookback identity.

### Add Sync/Free length controls

Rejected for this version because block-relative Slices already tracks visible
musical time and survives block resize. A second timing mode adds surface area
without resolving a demonstrated musical problem.

### Add reverse, ping-pong, probability, or random variation

Rejected because they overlap Reverse or broaden Stutter beyond the requested
focused effect. The existing four controls already cover repeat density,
resampled pitch/rate, articulation shape, and duty cycle.

### Let a completed loop outlive the block

Rejected because Stutter is an authored captured block, not a tail effect. The
96-frame exit fade removes the click while keeping the region literal.

## Automatic evidence

Generated-runtime fixtures cover:

- the first repeat beginning only after the first slice is captured;
- repeated source identity and capture behavior at transport start;
- Gate and all five Shape anchors, including live Aux changes;
- 0.5x–2x playback and click-screened wrap interpolation;
- downward Slices modulation staying within captured material;
- a fast second and third trigger preserving the outgoing loop until the next
  capture is ready;
- click-screened two-bank handoff and block exit;
- authoritative reset invalidating both capture voices;
- four simultaneous chains at maximum Slices/Speed remaining finite and inside
  the generated-JavaScript budget;
- exact two-bank source contract and successful JavaScript generation.

Source and packaged browser fixtures cover the established four-control editor,
literal capture/retrigger note, Aux targets, responsive layout, persistence,
and parameter-derived block glyph.

## Unperformed gates

- A/B listening against locally licensed Effectrix/Looperator and Ableton Beat
  Repeat instances.
- Human review of retriggers on drums, vocals, sustained harmony, and exposed
  block exits.
- Ableton insert, transport, automation, save/reopen, and multiple-instance
  acceptance.
- Native CPU and memory measurements for multiple simultaneous instances.

Those remain Phase 8 gates; automatic click screens and finite-output tests do
not substitute for listening.
