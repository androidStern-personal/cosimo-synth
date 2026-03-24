# Phase 2: Immutable Factory Wavetable Bank

Reconstructed on 2026-03-24 after the earlier working-tree copy was deleted. This version is rebuilt from the repo state and `full-proposal.md`, not recovered byte-for-byte.

## What this file is for

Build the offline path that turns raw wavetable frames into one immutable bank that Cmajor can read as shared external data.

This is the step that gives us:

- one packed sample blob for all factory tables
- one metadata object that tells Cmajor where each table starts
- one simple read path inside the oscillator
- one reference path in Python and one probe path in Cmajor that can be compared exactly

## What already matches this plan

- `wtbank.py` already has the right data model:
  - `MIP_COUNT = 11`
  - `PADDED_FRAME_SIZE = 2051`
  - contiguous `sample_blob`
  - per-table `frame_count` and `sample_offset`
- `cmajor/FixedFrameOscillator.cmajor` already reads a shared `external Bank factoryBank`
- the current tests already prove the core packed-bank assumptions:
  - `tests/test_wtbank.py`
  - `tests/test_wtbank_cmajor.py`
  - `tests/test_mip_selection.py`

## The bank shape

- 2048 samples per frame
- 11 mip levels per frame
- padded frame layout is `[last, frame[0..2047], first, second]`
- packed order is mip-major inside each table:
  - all frames for mip 0
  - then all frames for mip 1
  - continue through mip 10
- each table stores:
  - `frameCount`
  - `sampleOffset`

## The offline build path

1. Take source frames as a 2-D float array shaped `[numFrames, 2048]`.
2. Remove DC per frame before building mips.
3. Run `rfft`.
4. For each mip level, keep only the allowed harmonic band.
5. Run `irfft` back to 2048 samples.
6. Add the 3 wrap samples.
7. Concatenate every padded frame into one flat float32 blob.
8. Emit:
   - `factory-bank.wav`
   - `factory-bank.json`

## What to keep simple

- Keep all FFT work in Python.
- Keep the runtime bank read-only.
- Keep the Cmajor side as a reader only.
- Do not add mutable wavetable upload in this step.
- Do not add per-voice copies of bank data.

## Verification

- Python should be the reference implementation for packing and mip generation.
- Cmajor should only prove that it can read the emitted bank correctly.
- The exact comparison should stay:
  - Python emits assets
  - a tiny Cmajor probe patch reads specific packed samples
  - `cmaj test` compares those samples against a golden WAV

## Done means

- `wtbank.py` builds a valid packed bank for at least the current fixture tables.
- `factory-bank.wav` and `factory-bank.json` can be embedded in a patch manifest.
- `cmajor/FixedFrameOscillator.cmajor` can read from `wt::factoryBank` with no repacking at runtime.
- the packed-bank integration test passes under `cmaj test`.
- the read path at the frame seam matches the Python reference exactly.

## What this step does not include

- wavetable-position scanning
- MIDI note playback
- GUI editing
- user wavetable import
- MSEG
