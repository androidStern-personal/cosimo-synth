# Phase 6: One Real MSEG Path Into The Existing Oscillator

Reconstructed on 2026-03-24 after the earlier working-tree copy was deleted. This version is rebuilt from the repo state, the proposal, and the earlier planning discussion, not recovered byte-for-byte.

## What this file is for

Add one concrete MSEG path that fits the architecture already in this repo:

- JS pre-renders the curve into a float buffer
- Cmajor stores that buffer in shared read-only control memory
- Cmajor reads it with the same padded-buffer and interpolation style already used by the wavetable code
- one routed destination proves the path end to end

The first destination should be `Wavetable Position`.

## Why keep it this narrow

The repo already has:

- an offline immutable bank pipeline
- a packed sample-blob read pattern
- a tested oscillator with frame scanning

The repo does not yet need a giant modulation system to prove MSEG works. The smallest honest step is to feed one MSEG source into one existing destination and compare it against a reference.

## The architecture to keep

- 8 shared MSEG slots
- one pre-rendered float buffer per slot
- one fixed buffer length for v1
- no bezier math in the realtime Cmajor path
- no per-voice copy of the MSEG buffer data

The GUI owns curve editing and buffer generation. The DSP side owns buffer playback only.

## The DSP side

Use a small shared store that looks like the current bank work:

- slot metadata
- flat float buffer storage
- deterministic indexing

For playback:

- keep a phase accumulator per running MSEG reader
- map phase into the pre-rendered buffer
- interpolate from adjacent samples
- output one normalized modulation value

The simplest first implementation is one-cycle normalized playback with a fixed 8192-sample buffer per slot, matching the proposal.

## The first route to ship

Ship exactly this first:

- source: `MSEG 1`
- destination: `Wavetable Position`

That lets phase 6 reuse the existing oscillator work directly. You can hear the route immediately without also needing filter, FX, or a larger routing UI.

## Routing plan

Keep the shape of a route table, but prove it with a tiny route set first.

- start with a fixed route list inside a probe or minimal synth patch
- expose depth as a normal scalar
- add the general route-table editor later, after the core source and destination path is proven

## Verification

Use the same testing pattern the repo already uses:

- Python builds the reference control curve
- Cmajor receives the same buffer
- `cmaj test` or an equivalent probe renders the result
- compare Cmajor output against the Python reference

The important thing to prove is not “there is an MSEG UI.” The important thing to prove is that the buffer transport, indexing, interpolation, and routing depth all behave exactly as intended.

## Done means

- Cmajor accepts at least one pre-rendered MSEG buffer
- the buffer can be assigned to a known slot
- a reader can play that slot deterministically
- the reader modulates wavetable position in the existing oscillator path
- the result matches a Python reference run closely enough to treat the path as correct

## What this step does not include

- a full modulation-matrix UI
- 32 general routes exposed to the host
- live user wavetable import
- per-voice filter modulation
- making MSEG “the” modulation system

The point here is simpler: prove one real MSEG-to-oscillator path using the data layout and testing style the repo already has.
