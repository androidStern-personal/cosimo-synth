# Cosimo Articulation SysEx Architecture Plan

Status: implemented baseline architecture. This document records the realtime
selectorA articulation path now in Cosimo and the decisions that shaped it.

## Goal

Cosimo needs a realtime articulation path that can be driven by FutureDaw's per-note NoteMeta SysEx messages and by local keyswitches.

The product behavior is:

- FutureDaw or a keyswitch selects an articulation for the next musical note.
- That articulation affects the new note immediately at its sample position.
- Already-running notes do not change because of a later keyswitch or NoteMeta message.
- UI slot editing remains separate from playback selection.
- FutureDaw's sound manifest eventually becomes the source of truth for displayed articulation names and selector values when Cosimo is embedded in FutureDaw.

This is a hard cut to the new behavior. No backwards-compatibility layer is required for older local articulation state.

## Current State

Cosimo currently has three relevant pieces:

1. The desktop UI can create articulation slots keyed by `selectorA`.
2. Slot recall currently works like preset recall: it writes many global patch parameters.
3. The Cmajor graph receives normal short MIDI through `std::midi::Message -> std::midi::MPEConverter -> NoteDispatcher -> SharedVoiceEngine`.

That is not enough for per-note articulation. The current path has two hard gaps:

- Raw SysEx cannot reach Cmajor through the normal `midiIn` path. Cmajor's `std::midi::Message` is a short three-byte MIDI message, and the Cmajor patch helper drops messages longer than three bytes.
- Current voice rendering reads global inputs such as wavetable position, warp, filter, pan, MSEG morphs, and route amounts while rendering. Writing those inputs for an articulation would affect running voices, which violates the next-note-only rule for voice-level behavior.

## External Contract: FutureDaw NoteMeta

Cosimo must reuse or exactly mirror FutureDaw's existing NoteMeta wire contract. It must not invent a second SysEx format.

The FutureDaw NoteMeta message is one private 16-byte SysEx:

```text
0:  0xF0
1:  0x7D
2:  0x01
3:  channel, 1..16
4:  note number, 0..127
5:  selectorA, 0..127
6:  selectorB, 0..127
7:  durationSamples byte 0, 7-bit packed
8:  durationSamples byte 1, 7-bit packed
9:  durationSamples byte 2, 7-bit packed
10: durationSamples byte 3, 7-bit packed
11: ageSamples byte 0, 7-bit packed
12: ageSamples byte 1, 7-bit packed
13: ageSamples byte 2, 7-bit packed
14: ageSamples byte 3, 7-bit packed
15: 0xF7
```

FutureDaw emits this message immediately before the accepted note-on, from the same `LoopingMidiNode`, after MPE member-channel assignment. Cosimo must treat that immediate adjacency as the pairing contract.

Duration and age are valid only when:

```text
0 <= ageSamples < durationSamples
durationSamples <= 0x0fffffff
```

Invalid duration/age metadata must not crash the synth and must not produce undefined voice state. The preferred behavior is to drop the NoteMeta payload and handle the note as if no NoteMeta arrived.

## Architecture Overview

The architecture has five modules.

1. `FutureDawNoteMetaBridge`: a thin native Adapter at the JUCE MIDI ingress Seam.
2. `CosimoOrderedInput`: a sample-ordered internal event list for one audio block.
3. `ArticulationNoteMeta`: a typed Cmajor event that carries FutureDaw selector metadata immediately before the original short MIDI note-on.
4. `RealtimeArticulationTable`: a resident `selectorA -> snapshot` table, ready for audio-thread lookup.
5. Voice-latched articulation state inside `NoteDispatcher` and `SharedVoiceEngine`.

The core rule is:

```text
SysEx bytes are native-host transport detail.
Cmajor receives typed note metadata, not raw SysEx.
Voices latch articulation state at note allocation, not through global parameter recall.
```

## Native NoteMeta Bridge

The native bridge runs before MIDI is handed to Cmajor.

It scans incoming host MIDI events in sample order. For events with the same sample position, it preserves the host-provided order. In FutureDaw's internal path, the relevant contract is that the NoteMeta SysEx and note-on come from the same `LoopingMidiNode`; Cosimo does not try to pair metadata across independent upstream sources.

The bridge behavior is:

1. If the event is a valid FutureDaw NoteMeta SysEx, store it as the immediately previous event and do not forward the SysEx to Cmajor.
2. If the next event is a note-on with the same one-based MIDI channel and note number, consume the NoteMeta.
3. If any other event arrives before the matching note-on, clear the pending NoteMeta and forward or handle that event normally.
4. If the event is malformed, wrong size, wrong vendor/type, wrong channel, wrong note, or invalid duration/age, drop the metadata and handle any later note as if no NoteMeta arrived.
5. If the event is a matching note-on, create an ordered `ArticulationNoteMeta` event and forward the original short MIDI note-on.
6. If the event is an ordinary note-on with no matching NoteMeta, leave it on the existing short-MIDI path.

The bridge matches FutureDaw NoteMeta using one-based MIDI channels because the SysEx stores channels as 1..16. Cmajor note events use zero-based channels, so the bridge converts channel `1..16` to `0..15` when creating the Cmajor note-start event.

The bridge must be realtime-safe:

- no JSON parsing on the audio thread
- no UI calls from the audio thread
- no locks in the block processing hot path
- no unbounded allocation in the audio thread
- bounded per-block storage, sized from the host buffer's MIDI event count or a fixed maximum

## Sample-Ordered Cmajor Ingress

The risky part of this migration is not decoding SysEx. It is proving that articulation and note-on enter the Cmajor graph in the same order at the same sample.

The first design considered replacing the matching MIDI note-on with one typed
`ArticulatedNoteOn` event:

```text
ArticulatedNoteOn {
  channel0to15
  pitch
  velocity
  selectorA
  selectorB
  durationSamples
  ageSamples
  hasNoteMeta
}
```

The implemented design keeps the original MIDI note-on and sends a typed
`ArticulationNoteMeta` event before it. `NoteDispatcher` stores pending
metadata by `(channel, noteNumber)` and consumes it when the matching
`MPEConverter` note-on arrives.

That refinement matters because MPE expression still needs the existing MIDI
converter path. Expression events before a note-on remain in the raw short-MIDI
stream, and the note-on still receives the same channel snapshots as an ordinary
note.

The processing driver should reuse Cmajor's existing chunked processing primitives. It should not become a custom DSP scheduler. The intended model is:

1. Build a block-local ordered event list from the host MIDI buffer.
2. Process audio up to the next event sample.
3. Queue typed `ArticulationNoteMeta` events for that sample.
4. Process the chunk starting at that sample with the preserved short-MIDI messages.
5. Continue until the block is complete.

The wrapper uses Cmajor's chunked process API so a metadata event queued before
the chunk is observed at the chunk's first frame. It does not pass raw SysEx
through `midiIn`.

Acceptance depends on proof, not assumption: tests must show the typed articulated note starts at the intended sample and does not affect neighboring notes in the same block.

## Cmajor Dispatch

`NoteDispatcher` remains the place that owns musical note allocation. It already handles poly, mono, legato, sustain, MPE expression snapshots, and voice stealing. Articulation belongs there because selector data must follow the same voice decision as the note.

`NoteDispatcher` receives:

- normal converted note/control/expression events from `MPEConverter`
- `ArticulationNoteMeta` events from the native bridge
- `ArticulatedNoteOn` events for direct typed-note tests and future internal callers

For poly mode:

- a note-on with pending `ArticulationNoteMeta` follows the same allocation rule as a normal `NoteOn`
- if a voice is stolen, the old voice is stopped first
- the selected voice receives one voice-start event carrying note and articulation data

For mono and legato modes:

- held-note state must store the articulation data that arrived with each held note
- when mono priority changes to a different held note, the running voice adopts that note's latched articulation as part of the new note selection
- if the same held note is merely refreshed, behavior follows the existing mono/legato retrigger rules

MPE expression snapshots must still work:

- expression events before the note-on still flow through `MPEConverter`
- `NoteDispatcher` keeps the latest bend, pressure, and slide by channel
- when an articulated note starts, the assigned voice receives the same expression snapshot behavior as an ordinary note

## Voice-Latched Articulation State

`SharedVoiceEngine` must gain per-voice arrays for articulation values. On voice start, it copies voice-level fields from the realtime articulation table before triggering envelopes and MSEGs.

Voice-level fields are those that can actually vary per voice:

- wavetable frame position, not wavetable selection
- play mode behavior where applicable to dispatch
- glide behavior at note/retune time
- pan
- warp mode and amount
- filter mode, cutoff, and Q
- MSEG morph values
- modulation envelope configuration
- modulation route amounts, after route identity has been resolved to stable DSP route slots

MSEG shape A and shape B remain patch-level design data. Articulations may recall morph values, but they must not require per-note MSEG shape buffer swaps.

Bus/global fields are not voice-latched:

- distortion bus settings
- chorus bus settings
- OTT/bus-level effect settings
- wavetable table selection and runtime loading state
- modulation routing topology

Bus/global fields may still be included in UI slot recall if the product wants complete preset-like articulation editing. They may affect running notes, which is acceptable for bus-level behavior. They must not be described as next-note-only voice articulation unless the effects are later moved into the voice path.

## Realtime Articulation Table

Cosimo needs a resident table keyed by `selectorA`.

The table has up to 128 entries, matching `selectorA` values `0..127`. A selector is valid only if the table entry is defined. Undefined selectors are ignored: they do not change the current audible articulation selector, and they must not crash or read garbage.

The UI articulation bank is source data for this table in standalone Cosimo. When Cosimo becomes an internal FutureDaw synth, FutureDaw's sound manifest is the source of truth for which selectors exist and what labels FutureDaw displays.

The audio thread sees only normalized, fixed-shape data:

- no slot names
- no browser route IDs
- no JSON
- no variable-length arrays
- no unresolved UI concepts

Route amounts need special handling. The UI currently stores route amounts by `routeId`, while Cmajor renders routes by fixed route index. Before data reaches the audio thread, route amounts must be resolved to stable DSP route slots. If a route cannot be resolved, its amount is omitted from the realtime table.

## Keyswitches

Keyswitches are separate from FutureDaw NoteMeta SysEx, but they resolve to the same `selectorA -> articulation table`.

The keyswitch module must:

1. Define a keyswitch note range or explicit note-to-selector map.
2. Consume keyswitch note-on and note-off before normal voice allocation.
3. Store a pending selector for the next musical note.
4. Clear or update that pending selector according to the latest keyswitch note-on.
5. Apply direct NoteMeta SysEx over the pending keyswitch selector when both could affect the same note.

Keyswitch notes must never allocate voices, alter mono held-note state, trigger envelopes, or create note-offs for voices that were never started.

The first implementation can scope pending keyswitch state to the host-provided MIDI stream. If FutureDaw or another host provides source IDs, the state should be per source. If only a plain JUCE MIDI buffer is available, strict stream order is the contract.

## UI Behavior

Playback selection and editing selection are distinct.

- Visible articulation buttons select the slot being edited.
- Incoming NoteMeta/keyswitch playback does not move the UI by default.
- A later `UI follows playback` setting may update the visible slot when playback selects a different articulation.
- Manual slot selection should make the audible default follow the edited slot for ordinary notes.
- A later NoteMeta or keyswitch event takes over playback selection for subsequent notes.

Slot index is not the playback identity. `selectorA` is the playback identity.

## Failure Behavior

Cosimo fails closed:

- malformed SysEx: ignored
- valid SysEx not followed immediately by matching note-on: ignored
- valid SysEx followed by wrong channel or wrong note: ignored
- note-on before SysEx at the same sample: ordinary note
- unknown selectorA: ignored; current audible articulation selector remains unchanged
- invalid duration/age: ignored; current audible articulation selector remains unchanged
- host reorders same-sample SysEx after note-on: ordinary note

No failure case may leave pending stale metadata for a later note.

## Migration Path

### Slice 1: Contract And Bridge Tests

Add the FutureDaw NoteMeta wire contract to Cosimo native code by reuse or exact mirror.

Deliverables:

- decoder/validator for the 16-byte message
- bridge pairing logic over a block-local ordered MIDI event list
- tests for valid pairing and fail-closed rejection

No Cmajor voice behavior is required in this slice.

### Slice 2: Sample-Ordered Cmajor Note Start

Add the `ArticulatedNoteOn` Cmajor event path and process it at the correct sample.

Deliverables:

- typed Cmajor note metadata event plus matching MIDI note-on attach logic
- native chunked processing proof for exact sample injection
- voice-start telemetry showing sample position, channel, pitch, selectorA, selectorB, duration, and age

This slice may initially latch only selector identity, not the full snapshot.

### Slice 3: Realtime Articulation Table

Upload a normalized fixed-size `selectorA -> snapshot` table to Cmajor.

Deliverables:

- table upload format
- audio-thread-safe resident table
- undefined-selector fallback
- first voice-latched fields, preferably a small set that is easy to prove: MSEG morph and filter cutoff/Q

### Slice 4: Full Voice-Latched Snapshot

Expand voice-latched fields.

Deliverables:

- per-voice arrays for all voice-level articulation values
- envelopes applied before trigger
- MSEG morph applied before trigger/render
- route amounts resolved to DSP route slots
- mono/legato behavior verified

### Slice 5: Keyswitches

Add keyswitch input after the SysEx path is proven.

Deliverables:

- keyswitch map
- swallowed keyswitch note-on/off
- pending next-note selector
- direct NoteMeta precedence

## Implementation Decisions

- Keyswitches currently use MIDI notes `0..23`, mapping directly to `selectorA` values `0..23`.
- The keyswitch selector is latched until another keyswitch changes it. It is not one-shot.
- Direct FutureDaw NoteMeta overrides the active keyswitch selector for its matching note.
- Plain notes with no NoteMeta and no keyswitch use the current live UI/global parameter state.
- FutureDaw `durationSamples` and `ageSamples` are validated and latched for telemetry/state transport. They do not yet seek envelopes or MSEGs into the middle of a note.
- The realtime articulation table uploads all 128 selector slots. Undefined selectors are explicitly disabled.
- The table contains voice-level values only. Bus/global values remain part of UI slot recall, not per-note voice articulation.

## Extremely Stringent Acceptance Criteria

### Contract Acceptance

- A valid FutureDaw NoteMeta message decodes all fields exactly: channel, note number, selectorA, selectorB, durationSamples, and ageSamples.
- The decoder rejects wrong length, wrong vendor byte, wrong type byte, missing `0xF0`, missing `0xF7`, invalid channel, invalid note, and invalid duration/age.
- Cosimo's byte-level contract matches FutureDaw's existing NoteMeta layout. There is no second Cosimo-specific SysEx protocol.
- Channel matching uses one-based MIDI channels from the SysEx and host MIDI event. Cmajor event creation converts to zero-based channels.

### Bridge Ordering Acceptance

- `SysEx A, NoteOn A` at the same sample creates exactly one `ArticulatedNoteOn`.
- `NoteOn A, SysEx A` at the same sample creates no articulated note.
- `SysEx A, Control, NoteOn A` creates no articulated note.
- `SysEx A, PitchBend, NoteOn A` creates no articulated note.
- `SysEx A, SysEx B, NoteOn A` creates no articulated note for A.
- `SysEx A, NoteOn B` creates no articulated note.
- Wrong channel creates no articulated note.
- Wrong note number creates no articulated note.
- Malformed SysEx followed by a matching note-on creates no articulated note.
- Unknown selectorA may create rejection telemetry, but it must not create a voice-latched snapshot and must not change the current audible articulation selector.
- No rejected SysEx remains pending for any later event.

### Same-Sample Cluster Acceptance

Given one block with these same-sample events:

```text
SysEx A, NoteOn A, SysEx B, NoteOn B
```

Cosimo must produce two articulated note starts with selectors A and B in that order.

Given:

```text
SysEx A, SysEx B, NoteOn A, NoteOn B
```

Cosimo must not accidentally pair A with either note. Only B may pair if B immediately precedes its own matching note-on.

### Sample Accuracy Acceptance

- A NoteMeta/note-on pair at sample 64 must create a voice-start telemetry record at sample 64.
- A plain note at sample 63 in the same block must not receive the sample-64 selector.
- A plain note at sample 65 in the same block must not receive the sample-64 selector.
- Two notes in one block at different samples can latch different selectors.
- Two notes at the same sample can latch different selectors if their SysEx/note pairs are ordered correctly.
- The implementation must not use async Cmajor event queues for note-start articulation.

### Cmajor Dispatch Acceptance

- `NoteDispatcher` applies the same voice allocation rules to articulated notes and ordinary notes.
- Articulated note-on in poly mode can steal the same voice an ordinary note would have stolen.
- Voice stealing sends the previous note-off before the new voice-start state is applied.
- MPE bend, pressure, and slide snapshots already seen on the note's channel are applied to the articulated note just as they are for ordinary notes.
- Ordinary notes with no selector continue to behave as they did before this migration.

### Voice Latch Acceptance

- On articulated voice start, `SharedVoiceEngine` copies selected voice-level fields before envelope and MSEG trigger events.
- Changing the active UI slot or receiving a later keyswitch does not change an already-running voice's latched voice-level values.
- A later NoteMeta event affects only notes started after that event.
- Undefined selectorA does not read uninitialized table data and does not change the current audible articulation selector.
- MSEG morph changes are latched per voice.
- MSEG shape buffers are not swapped per note.
- Route amount snapshots are applied only after route identity has been resolved to DSP route slots.

### Mono And Legato Acceptance

- A keyswitch or NoteMeta before a mono note affects that note's held-note articulation state.
- When mono priority changes to a different held note, the running voice adopts that held note's articulation as part of the new note selection.
- Releasing a held mono note does not leak its articulation to the next selected held note.
- Legato glide/retrigger behavior remains governed by the existing play mode, but the selected note's articulation state is still the source for that note.

### Keyswitch Acceptance

- Keyswitch note-on is swallowed and never starts a voice.
- Keyswitch note-off is swallowed and never stops a voice.
- Keyswitches do not alter mono held-note state.
- Keyswitches do not trigger envelopes, MSEGs, or note-start telemetry.
- A keyswitch selector applies to the next musical note without direct NoteMeta.
- Direct NoteMeta on a note overrides pending keyswitch selector for that note.
- After a musical note consumes a pending keyswitch selector, later ordinary notes follow the configured pending/latched keyswitch policy; that policy must be explicit in the implementation notes before coding.

### Realtime Safety Acceptance

- The audio thread does not parse JSON.
- The audio thread does not call UI code.
- The audio thread does not lock on UI-owned state.
- The audio thread does not allocate unbounded memory per MIDI event.
- Articulation table updates are prepared off the audio thread and swapped into audio-visible state atomically or at a safe block boundary.
- Invalid table uploads leave the previous valid table active or switch to a defined empty table. They never produce partial table state.

### UI Acceptance

- Manual slot selection changes the visible editing slot.
- Manual slot selection makes ordinary-note playback use that slot as the default audible articulation.
- Incoming NoteMeta or keyswitch playback does not move the visible UI slot unless `UI follows playback` is enabled.
- Playback selection is by selectorA, not slot order.
- Reordering or renaming slots does not change selectorA playback behavior.

### Regression Acceptance

- Existing ordinary MIDI note playback still works.
- Existing MPE expression behavior still works for ordinary notes.
- Existing MPE expression behavior works for articulated notes.
- Existing articulation slot UI tests still pass after state shape changes are intentionally updated.
- Existing MSEG morph UI and graph rendering behavior still pass.
- Existing desktop native dev launch still works after desktop UI changes.

## Decisions That Must Not Drift

- No raw SysEx enters Cmajor through `midiIn`.
- No second SysEx format.
- No global parameter replay for next-note voice articulation.
- No UI state lookup from the audio thread.
- No hidden keyswitch voices.
- No claim of per-note bus effects until the bus effects are redesigned as per-voice processing.

## Closed Implementation Decisions

1. Keyswitch range: MIDI notes `0..23` map to `selectorA` values `0..23`.
2. Keyswitch persistence: the most recent keyswitch remains active until another keyswitch or direct NoteMeta changes the next-note selector.
3. Plain-note default: no selector means the note uses the current live parameter state.
4. Voice-level fields: wavetable position, pan, warp, filter, MSEG morphs, modulation envelopes, and resolved modulation route amounts are latched per voice.
5. `ageSamples`: transported and latched, but not yet used to start envelopes or MSEGs mid-phase.
