# SeqFX Reverse production decision

Date: 2026-08-30

Status: implemented and automatically qualified; subjective listening and
Ableton timing/recall remain Phase 8 gates.

This record separates documented product facts, SeqFX measurements, and the
engineering adaptation. It does not claim to reproduce a competitor's private
algorithm.

## Documented facts

### Sugar Bytes Effectrix

The official [Effectrix manual](https://downloads.sugar-bytes.de/manuals/Effectrix.pdf)
describes Reverse as a looper that plays backward while a Reverse step is
active. Its public controls are Size in tempo values, Fade for smoothing loop
ends, and Decay for making the loop disappear before the effect step ends.

That establishes three relevant sequencer patterns:

- Reverse is an active-step looper rather than an unbounded one-shot tail.
- Window length belongs in musical time.
- Boundary smoothing and within-step decay are separate controls.

### Kilohearts Reverser

The official [Kilohearts Essentials documentation](https://kilohearts.com/docs/snapins)
describes repeated delayed reversed sections mixed with dry audio. It exposes
Delay Time, Sync, Crossfade as a percentage of section length, and Mix.

That establishes:

- repeated finite sections rather than one frozen region;
- synchronized and free timing;
- proportional crossfade vocabulary;
- a common dry/wet mix.

Kilohearts' delayed capture contract is not silently attributed to SeqFX.
SeqFX makes a different latency tradeoff below.

## Product choice

SeqFX Reverse is a **zero-added-latency rolling lookback looper**:

1. At a trigger it reads the immediately preceding, already-recorded window
   backward.
2. While the authored block remains active, it rolls into newly recorded
   lookback windows instead of repeating the first window forever.
3. It returns to dry at block exit and has no public tail.
4. A cold start remains dry until a complete requested history window exists.
5. The inspector states that behavior literally; it does not imply future
   lookahead.

This is an engineering adaptation of the established Reverse-looper pattern.
It is not a measured claim about Effectrix or Kilohearts internals.

## Controls

| Parameter | Contract | Lifecycle |
| --- | --- | --- |
| Length | 1/32, 1/16, 1/8, 1/4, or 1 Cell | Trigger-latched |
| Crossfade | 0–25% of each reversed section | Continuous; Aux eligible; applied at rolling boundaries |
| Timing | Sync or Free | Trigger-latched |
| Free Length | 20–4000 ms | Trigger-latched |
| Decay | point within the authored block where Reverse has faded back to dry; 100% keeps the whole block | Continuous; Aux eligible |
| Block Mix | Common SeqFX dry/wet law | Continuous |

Playback speed is fixed at -1. Pitch owns transposition and Stutter owns
variable repeat speed.

## Four-second quality boundary

The selected shared-buffer architecture provides 16 seconds per chain at a
fixed 48 kHz float rate. A four-second Reverse window can remain valid for its
complete backward playback: the oldest source sample is at most eight seconds
old when read. Longer windows would require either a copied capture, a larger
float tier, or the low-bandwidth 8 kHz Tape-only tier.

The sync menu therefore stops at 1/4 note plus 1 Cell, and Free Length stops at
four seconds. This is deliberately narrower than advertising bar lengths that
cannot retain high-quality source audio at every supported tempo. The existing
8 kHz long tier remains Tape-only.

## DSP and lifecycle

- The raw per-chain input is written into the fixed-48-kHz history before lane
  effects process it.
- Reverse uses four-point cubic Hermite reads and decrements its absolute
  history position by `48000 / hostSampleRate` per output frame.
- Two bounded voices overlap rolling windows and retriggers. A new trigger
  preserves the current voice while the quieter/older slot becomes the next
  section; a third trigger reuses only one of those two slots.
- Voice gains move complementarily over the selected proportional crossfade.
  Reusing a live slot also interpolates from its last output instead of
  teleporting its read head at full gain.
- Block exit fades through the common transition law and then returns dry; no
  reversed audio is exposed as a tail.
- Authoritative pattern replacement, transport discontinuity, pattern switch,
  reset, bypass flush, and seek invalidate the history counters and both
  voices. Arrays are not cleared on the audio thread; invalid samples are
  unreachable.
- The algorithm reports no host latency because it reads only past audio.

## Rejected alternatives

### Capture, then play one window later

This matches Kilohearts' documented delayed behavior but makes a selectively
sequenced cell sound one window late unless the entire plugin delays dry audio.
Rejected for the first SeqFX product contract; the UI and documentation state
the chosen past-lookback behavior.

### Fixed plugin-wide lookahead

This could align a future region to the authored block but would delay every
chain, including dry and unrelated effects, by the maximum Reverse window.
Rejected because the latency cost is disproportionate to a sparse step effect.

### One frozen window for an arbitrarily long block

Rejected because it turns Reverse into a static repeat and eventually lets the
rolling history overwrite its source. Rolling sections are both the established
looper pattern and the bounded-memory behavior.

### Playback-speed control

Rejected because it obscures the identities of Pitch, Stutter, and Reverse.

### Bar-length Reverse through the Tape long tier

Rejected because the 8 kHz packed tier was selected only for already-slow Tape
gestures. Routing ordinary Reverse through it would create an undocumented
bandwidth change.

## Automatic evidence

The focused generated-runtime tests cover:

- the immediately preceding numbered/ramped cell in reverse order;
- no future-audio read;
- fresh rolling windows rather than a frozen first capture;
- hard versus 20% smoothed boundaries;
- exact 125 ms Free Length;
- one-cell timing at 48 and 96 kHz with fixed-48-kHz history;
- cold-start dry fallback;
- block-relative Decay and no output tail;
- retrigger plus a third bounded trigger;
- Crossfade and Decay Aux sweeps only;
- authoritative reset/history invalidation;
- four simultaneous chain stress and finite output.

Source and packaged browser tests cover the 12-effect picker, official vendored
Fontaudio `fad-backward` identity, all five controls, literal past-audio note,
two eligible Mod targets, sparse-v7 persistence, block glyph, and inspector
overflow.

## Unperformed gates

- A/B listening against locally licensed Effectrix and Kilohearts instances.
- Spoken-count subjective timing acceptance.
- Ableton insert, transport, automation, save/reopen, and multiple-instance
  acceptance.
- Human click/noise review on drums, speech, sustained harmony, and exposed
  tails.

Those remain named Phase 8 gates; automated correlation and discontinuity
screens do not substitute for listening.
