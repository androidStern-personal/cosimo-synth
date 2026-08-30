# SeqFX lifecycle and reset contract

Date: 2026-08-30

## Chain lifecycle

Each chain now reports an explicit state rather than leaving entry and exit as
an accidental consequence of effect-local booleans:

- `idle`: no foreground effect and the exit transition is complete;
- `entering`: a new effect or explicit retrigger is inside the common 96-frame
  transition window;
- `active`: the foreground effect is established;
- `released`: the authored block ended and the short foreground transition is
  completing;
- `resetting`: captured and effect-local state has been invalidated before the
  current step is relatched.

The monitor event exposes both the stable effect ID and lifecycle state per
chain. `tests/test_seqfx_probe.py` proves the observable
enter/active/release/idle sequence.

This foundation does not pretend that a released foreground block and a
long-lived gesture are the same thing. Tape Stop and the captured effects add
their bounded gesture voices on top of this state machine; that routing remains
part of P3.5 and the effect implementation phases.

## Edit authority

- A non-authoritative edit is compared with the current cell and the latched
  block start. A future-only edit does not relatch or reset the sounding block.
- A non-authoritative edit to the sounding block relatches the changed
  parameters without discarding an unchanged capture.
- An authoritative replacement invalidates captured/effect history before the
  current step is relatched. This is the state-load/preset boundary and old
  audio must not survive it.

The live Stutter test now marks its edit non-authoritative explicitly. A
separate authoritative replacement fixture proves that a previous Stutter
capture cannot continue sounding.

## Reset authority

Captured/effect state is invalidated on:

- explicit reset;
- host play-to-stop transition;
- discontinuous host position (sample timeline or quarter-note timeline);
- clock source, rate, loop start, or loop length change;
- selected-pattern change;
- authoritative replacement of the selected pattern;
- completed plugin-disable fade.

Invalidation resets valid-frame counts and state flags; it does not clear large
arrays in a realtime loop. A read cannot become valid again until new input has
actually been written or captured.

Expected host-position updates are distinguished from seeks using the elapsed
processor frame count. A tempo event deliberately clears the comparison anchor
instead of declaring a seek. Active synced gestures will latch their trigger
tempo; future triggers use the new tempo.

## Click policy

- Global bypass uses a 96-frame crossfade, then flushes captured state only
  after the output is fully dry.
- A reset or seek crossfades from the last processed sample into the newly
  relatched signal for 96 frames.
- Future-only edits do neither.

Focused render fixtures cover bypass discontinuity, explicit reset, host seek,
authoritative replacement, future Filter edits, and future Stutter edits.
