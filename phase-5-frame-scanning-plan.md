# Phase 5: Frame Scanning In The Oscillator

Reconstructed on 2026-03-24 after the earlier working-tree copy was deleted. This version is rebuilt from the repo state and `full-proposal.md`, not recovered byte-for-byte.

## What this file is for

Add one user-facing control that moves through frames inside a preloaded wavetable.

This step is only about the oscillator. It is not the full synth shell.

## What already matches this plan

- `cmajor/FixedFrameOscillator.cmajor` already has:
  - `input value float32 framePositionIn [[ name: "Wavetable Position", min: 0.0f, max: 1.0f, init: 0.0f ]]`
  - `readFixedFrameSample(...)`
  - `readFrameBlendSample(...)`
  - frame-position clamping
  - `frameLo`, `frameHi`, `frameT`
- the current test file already covers the intended behavior:
  - `tests/test_fixed_frame_probe.py`

## The behavior

- `0.0` means the first frame
- `1.0` means the last frame
- values between them map to a fractional frame index:

```text
frameIndex = framePosition * (frameCount - 1)
frameLo = floor(frameIndex)
frameHi = min(frameLo + 1, frameCount - 1)
frameT = frameIndex - frameLo
```

- read one sample from `frameLo`
- read one sample from `frameHi`
- linearly blend those two results

The inner sample reads stay cubic. The crossfade between the two frames stays linear.

## What must stay unchanged

- the packed bank layout
- the 2051-sample padded frame format
- the Catmull-Rom read path
- the one-mip-per-octave selector

This step adds frame interpolation on top of the existing bank and mip work. It does not change those parts.

## What to verify

- a single-frame table ignores `framePositionIn`
- `framePositionIn = 0.0` matches frame 0 exactly
- `framePositionIn = 1.0` matches the last frame exactly
- midpoint positions match the Python reference blend exactly
- stepped and swept frame-position curves stay sample-accurate against the Python reference

## Done means

- the oscillator accepts a normalized frame-position input
- the output matches the Python reference for boundary, midpoint, stepped, and sweep cases
- the current fixed-frame probe tests pass
- no new runtime table format is introduced just for scanning

## What this step does not include

- MIDI
- note envelopes
- top-level synth patch wiring
- modulation matrix
- MSEG
