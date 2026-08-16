# ADR-002: Global Effects Modulation Domain

Status: accepted.

## Context

Cosimo's effects rack processes the stereo voice sum. A global effect therefore has
one parameter value at each audio frame, while MPE pressure, MPE slide, velocity,
note-triggered envelopes, and note-triggered MSEGs may simultaneously have a
different value for every active note.

There is no mathematically neutral way to apply several per-note values to one
global parameter. Latest-note selection, maximum, average, sum, and
amplitude-weighted average are different musical behaviors.

Established synthesizers expose this boundary differently:

- Surge distinguishes voice and scene modulation and permits only scene-level
  sources to modulate global effect parameters:
  <https://surge-synthesizer.github.io/manual/#voice-modulators-vs-scene-modulators>
- Serum 2 permits per-voice sources on its summed-output FX rack and documents the
  resulting new-note retriggering as monophonic/paraphonic behavior:
  <https://xferrecords.com/manual/serum-2>

## Decision

Modulation sources and destinations have an explicit processing domain:

- `voice`: one independent value per allocated note;
- `global`: one value for the whole synth.

A global effects parameter accepts only a global modulation source. Cosimo does not
silently reinterpret a voice source as latest-note, maximum, average, or any other
global value.

Where voice expression should control the global rack, the voice-to-global mapping
must carry an explicit reducer policy alongside its amount, polarity, and other
mapping settings. The policy is persisted as part of that mapping; it is not one
synth-wide MPE preference. The UI may describe the resulting relationship as, for
example, `Pressure (Maximum Held) -> Reverb Mix`.

V1 will support these mapping-level reducers. Reducer selection is an advanced
mapping setting with a source-appropriate default; it is not required interaction
during ordinary modulation assignment.

The reducer is selected from a small closed set rather than supplied as an arbitrary
algorithm. V1 supports exactly:

- `maximum`: the strongest participating voice controls the destination;
- `mean`: participating voices contribute equally.

`maximum` is the default. A mapping from a voice source to a global target is
invalid unless it contains one of these reducer policies.

## Why This Is Recommended

- The UI tells the truth about the audible behavior.
- Adding or releasing a note cannot silently change an undocumented aggregation
  rule.
- Different expressive gestures may use different musically appropriate reducers.
- One pressure mapping can use maximum while another uses an average without
  creating duplicate modulation sources or a global mode conflict.
- The DSP has one deterministic global modulation value regardless of polyphony.
- The distinction generalizes beyond MPE to velocity, key tracking, envelopes, and
  MSEGs.

## Deferred Or Rejected Behaviors

V1 does not support focused/latest-voice selection, amplitude-weighted mean, sum,
minimum, or whichever voice most recently changed the source. These can be
reconsidered only in response to a concrete musical need.

Reducer output will use the synth's active allocated voices and ordinary parameter
smoothing. More specialized held-note, sustain, or release membership policies are
out of scope until a concrete musical need appears.
