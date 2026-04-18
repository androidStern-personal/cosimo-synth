# Transient Plan: SeqFX Tape Stop Speed Graph

This is a transient implementation plan for the SeqFX tape stop lane only. It deliberately excludes the broader knob-vs-number-input refactor for filter, crusher, and stutter controls.

## Goal

Replace the confusing tape stop inspector controls with a graph-first speed envelope editor. The user should see the playback-speed curve that happens across the selected painted block.

## User Model

- The graph X axis is the selected block duration.
- The graph Y axis is tape playback speed.
- `1.0x` speed means the tape is aligned with the dry timeline.
- Near-zero speed means the tape is effectively stopped, but the DSP should never use literal zero speed.
- Speed above `1.0x` means catch-up: the tape runs fast enough to repay the timeline distance lost while slowing down.
- Tape can run in either `Stop` mode or `Spin-up` mode:
  - `Stop` starts at `1.0x` and slows toward the speed floor.
  - `Spin-up` starts near the speed floor and rises to `1.0x`.

## Parameter Mapping

Keep the existing four tape parameter slots, but change their user-facing meaning:

- Param 0: `Stop Point`
  - Stored as the existing multiplier value, range `0.05` to `4.0`.
  - Display as percent, `5%` to `400%`.
  - `100%` reaches near-zero at the end of the selected block.
  - `50%` reaches near-zero halfway through the selected block.
  - `200%` would reach near-zero after twice the selected block length, so the visible block only shows the first half of the slowdown.

- Param 1: `Curve`
  - Keep the existing name and range, `0.25` to `4.0`.
  - Controls the power curve of the slowdown.

- Param 2: `Catch-up Curve`
  - Repurpose the old `End` fade/hold parameter.
  - New range is `0.25` to `4.0`.
  - Existing stored `0` or `1` end-mode values should normalize to `1.0`, not become extreme curve values.

- Param 3: `Catch-up Length`
  - Reinterpret the old `Release` parameter as requested catch-up length in percent of the selected block.
  - Range `0%` to `100%`.
  - The catch-up request is independent from the first curve end. It starts at `100% - Catch-up Length` unless that would overlap the first curve.
  - If the first curve ends later than the requested catch-up start, the realized catch-up start is pushed later to the first curve end.
  - Example: `Stop Point 10%` and `Catch-up Length 10%` leaves an 80% middle hold section.

- Param 4: `Mode`
  - `0` is `Stop`.
  - `1` is `Spin-up`.
  - Existing patterns default to `Stop`.

## DSP Envelope

Use a small speed floor, e.g. `0.005x`, instead of zero.

Stop phase:

```text
stopFrames = blockFrames * stopPointMultiplier
speed = floor + (1 - floor) * pow(max(0, 1 - elapsed / stopFrames), curve)
```

Spin-up phase:

```text
rampEndFrames = blockFrames * stopPointMultiplier
speed = floor + (1 - floor) * pow(clamp(elapsed / rampEndFrames), curve)
```

Catch-up phase:

- Catch-up only exists if the first curve end is inside the block.
- Requested catch-up frames come from `Catch-up Length %`.
- Requested catch-up starts at `blockFrames - requestedCatchupFrames`.
- Realized catch-up starts at `max(firstCurveEndFrames, requestedCatchupStartFrames)`.
- Compute the timeline deficit accumulated before catch-up starts by integrating the active stop or spin-up curve.
- In `Stop` mode, catch-up uses a visible base ramp from floor to `1.0x` plus a hidden sync hump.
- In `Spin-up` mode, catch-up uses a visible flat `1.0x` base plus a hidden sync hump.
- Scale the hump so the area above the speed curve repays the computed deficit by the end of the block.
- Clamp the final speed to a safe maximum, e.g. `8.0x`.

If the clamp is hit, the curve may not fully catch up; that is preferable to unsafe overspeed.

## UI

Add a tape-stop-specific inspector section:

- SVG graph showing the realized speed curve over the selected block.
- A filled/outlined path for speed over time.
- A visible stop-point handle when the stop point is inside the selected block.
- A visual marker when the stop point is beyond the block edge.
- A catch-up region marker at the end of the graph when catch-up is active.
- Controls below the graph:
  - Mode: `Stop` / `Spin-up`
  - Stop Point `%`
  - Curve
  - Catch-up Length `%`
  - Catch-up Curve

The first pass can use focused local controls in the tape stop section. It does not need to solve the global knob component problem.

## Acceptance Criteria

- The Tape Stop inspector no longer shows `Duration`, `End`, or the old `Release` meaning.
- It shows a speed graph for selected tape stop blocks.
- It lets the user switch between Stop and Spin-up modes.
- Stop Point is displayed as percent but still writes param `0` as multiplier.
- Curve still writes param `1`.
- Catch-up Curve writes param `2`.
- Catch-up Length writes param `3` as percent and accepts `0`.
- Mode writes param `4` as `0` or `1`.
- Old serialized tape stop `End` values normalize to catch-up curve `1.0`.
- The DSP never intentionally uses zero tape speed.
- Spin-up mode starts near the speed floor and reaches `1.0x` at the ramp end.
- Independent Stop Point and Catch-up Length values can leave a hold section between them.
- If Stop Point overlaps the requested catch-up window, catch-up starts later rather than overlapping the first curve.
- The DSP catch-up phase can run above `1.0x` and returns to approximately timeline alignment by the block end when not clamped.
- Browser tests verify the graph appears and inspector edits upload the expected tape stop parameters.
- State tests verify the new parameter limits and legacy end-mode normalization.
- Cmajor render tests continue to prove tape stop lowers zero-crossing rate during the active block.
