# Transient Plan: SeqFX Breathing Beat Gaps And Per-Cell Bar Striping

This is a transient implementation plan for the SeqFX grid. It is not product documentation and should not become a permanent source of truth.

## Desired Behavior

- Beats are delineated by wider gutters between cells.
- Bars are delineated by alternate fill on the individual cell rectangles inside that bar.
- Bar striping must not fill the gutters and must not be implemented as a lane-wide background gradient.
- Bar striping must not use any track-sized visual layer: no `.seqfx-lane-track::before`, no `.seqfx-step-track::before`, no absolute bar-band `div`, no SVG overlay, and no lane-wide background image. The stripe must be a property of each cell element.
- Active blocks remain continuous rectangles and include the real spacing between the cells they span.
- Drag, resize, option-drag copy, double-click delete, selection, and playhead display must keep working.
- The grid remains a fixed visual ruler anchored to step `0`. It is not a host time-signature display and it is not re-anchored to `loopStart`.

## Timing Model

SeqFX already has a `rate` parameter in `fx/seqfx/SeqFx.cmajor`:

- `rate = 0`: one cell is `1/8`, which is `0.5` quarter notes, so `2` cells make one beat.
- `rate = 1`: one cell is `1/16`, which is `0.25` quarter notes, so `4` cells make one beat.
- `rate = 2`: one cell is `1/32`, which is `0.125` quarter notes, so `8` cells make one beat.

The first implementation should assume 4/4 because the current plugin UI does not receive host time signature.

The UI should derive grouping from the snapped `rateIndex`, not by trying to call or duplicate the DSP function at runtime:

- `rateIndex = 0`: `cellsPerBeat = 2`
- `rateIndex = 1`: `cellsPerBeat = 4`
- `rateIndex = 2`: `cellsPerBeat = 8`
- `beatsPerBar = 4`
- `cellsPerBar = cellsPerBeat * beatsPerBar`

That gives:

- `1/8`: 2 cells per beat, 8 cells per bar
- `1/16`: 4 cells per beat, 16 cells per bar
- `1/32`: 8 cells per beat, 32 cells per bar

The visual grid is anchored to absolute step `0`. It should not be derived from `monitorOut.stepProgress`, current playback position, loop start, or loop length. `monitorOut` remains only the playhead source.

When transport stops or `clockMode` changes, keep the last reported playhead step until the DSP reports a new one or clears it. Do not let playhead state alter beat gaps or bar striping.

## Files Expected To Change

- `ui/seqfx/seqfx-runtime-bridge.ts`
- `ui/seqfx/SeqFxPatchView.tsx`
- `ui/seqfx/styles.css`
- `ui/seqfx/harness-main.ts`
- `tests/test_seqfx_runtime_bridge.mjs`
- `tests/test_seqfx_patch_view_browser.mjs`
- generated bundle after build: `fx/seqfx/view/index.js` and `fx/seqfx/view/index.js.map`

Do not use the disposable mockup HTML as production code. It is only a visual reference.

## Runtime Bridge Changes

Add `rate: "rate"` to `SEQFX_ENDPOINTS`.

The bridge should:

- track the current snapped rate index as `0`, `1`, or `2`
- default to `1` before the first parameter callback, matching the DSP default `rate = 1.0f`
- request `rate` during `requestBootState()`
- listen for host/plugin parameter changes to `rate`
- notify the React view when the rate changes

Keep this simple. A separate timing service is not needed.

One practical API shape:

- add `getRateIndex()`
- add `subscribeRate(listener)`
- in `SeqFxPatchView`, keep local `rateIndex` state exactly like the current selected pattern state

The harness should include `rate: 1` in its fake parameters and let tests emit rate changes through the existing fake connection.

That requires a small harness addition. Add an explicit helper such as:

- `emitParameter(endpointID, value)`

The fake connection should store the parameter value and call any registered parameter listeners for that endpoint. This should be a generic parameter path used by `patternSelect`, `rate`, and any future parameter test. Do not special-case only `patternSelect`.

If `rate` changes while a move, resize, or copy gesture is active, the UI should cancel the active gesture and clear `gestureRef` / `gestureState` before using the new geometry. That is simpler and safer than trying to preserve a gesture while the pointer-to-step map changes under the cursor.

The view must reflow when `rateIndex` changes even if the window size does not change. The existing measurement loop only runs on `ResizeObserver` and `window.resize`; the implementation needs an explicit rate-driven recalculation path, or the geometry can stay stale until the host window is resized.

## Grid Geometry Changes

Replace the current uniform geometry helpers:

- `cellSizeFromTrackWidth(width)`
- `trackWidthForCellSize(cellSize)`
- `leftForStep(step, cellSize)`
- `stepAtClientX(bounds, clientX, cellSize)`
- `cellStyle(step, cellSize)`
- `blockStyle(startStep, length, cellSize)`
- `stepNumberStyle(step, cellSize)`

with one small geometry model that is computed from:

- `stepCount`
- `cellSize`
- `normalGapPx`
- `beatGapPx`
- `cellsPerBeat`
- `cellsPerBar`

Suggested constants:

- `normalGapPx = 5`
- `beatGapPx = 9`

There should not be a special bar gap; bars are represented by per-cell fill.

Use one prefix-sum position table as the canonical source for every grid coordinate. Rendering, header labels, block spans, pointer hit testing, resize, move, copy, and `pointerGrabOffset` must all read from this same table. Do not leave any path on the old uniform `step * (cellSize + gap)` math.

The geometry model should return:

- `stepLefts: number[]`
- `trackWidth: number`
- `gapAfterStep(step): number`
- `leftForStep(step): number`
- `cellStyle(step): CSSProperties`
- `blockStyle(startStep, length): CSSProperties`
- `stepAtClientX(clientX, bounds): number`
- `isBeatStart(step): boolean`
- `isAltBar(step): boolean`

The model should be memoized in React with `useMemo`.

The geometry API should stay local and small. A separate geometry service is not needed; a helper that returns the position table, track width, gap lookup, hit test, and cell/bar classification is enough.

## Cell Size Calculation

The cell size must account for the extra beat gutters:

```text
cellSize = (availableTrackWidth - totalGapWidth) / stepCount
```

`totalGapWidth` is the sum of all gaps after cells `0` through `stepCount - 2`.

Use `normalGapPx` after ordinary cells and `beatGapPx` after cells whose next cell starts a beat.

Clamp to `SEQFX_MIN_CELL_SIZE_PX`.

Keep the existing horizontal scroll behavior. The track should still use a computed `minWidth`, the grid shell should still scroll when the host window is too narrow, and square cells must not depend on CSS Grid row sizing.

## Hit Testing

The old hit test divides by a uniform pitch. That will be wrong after variable beat gaps.

New hit testing should use the computed `stepLefts`.

Recommended behavior:

- If the pointer is inside a cell rectangle, return that cell.
- If the pointer is inside a gutter, split the gutter between neighboring cells.
- Left half of a gutter snaps to the previous cell.
- Right half of a gutter snaps to the next cell.
- The exact midpoint snaps to the next cell. Use a single explicit comparison, for example `clientX < midpoint ? previous : next`, so there is no hidden off-by-one behavior.
- Clamp before the first cell to step `0`.
- Clamp after the last cell to step `31`.

This matters for resize and move/copy gestures.

## Block Width

Block width must be derived from actual cell positions:

```text
blockLeft = leftForStep(startStep)
lastStep = startStep + length - 1
blockRight = leftForStep(lastStep) + cellSize
blockWidth = blockRight - blockLeft
```

Do not compute block width as `length * cellSize + (length - 1) * normalGapPx`, because that would ignore beat gutters inside multi-cell blocks.

## Per-Cell Bar Striping

Each cell gets an alternate-bar class if it belongs to an odd-numbered bar:

```text
barIndex = floor(step / cellsPerBar)
isAltBar = barIndex % 2 === 1
```

Render this as a cell class, for example:

```text
seqfx-cell is-alt-bar
```

CSS should only change the cell background, not the track background:

```css
.seqfx-cell.is-alt-bar {
    background: rgba(255, 255, 255, 0.07);
}
```

The selected/active block styling must remain stronger than the alternate bar fill. If a covered inactive cell is dimmed by `.is-covered`, the stripe should not make it visually compete with the active block.

The CSS should be written against the real current class names:

- inactive ordinary cell: `.seqfx-cell`
- inactive alternate-bar cell: `.seqfx-cell.is-alt-bar`
- covered cell under an active block: `.seqfx-cell.is-covered`
- selected cell or block: `.is-selected`
- active visible block overlay: `.seqfx-block`

The simplest stacking rule is: base cell fill, alternate bar cell fill on `.seqfx-cell`, transparent inner cell span, covered-cell opacity, selected outline, block overlay. Blocks remain the strongest visual element. The visible active shape comes from `.seqfx-block`, so the alternate bar stripe does not need to remain visible through a covered active block.

Remove or stop relying on the dead `.seqfx-cell.is-active` CSS path while making this change. The current render path uses `.is-covered` for cells beneath blocks and `.seqfx-block` for the visible block.

Decorative timing state must not add focusable DOM. The existing cell and block elements with `role="button"` remain the only interactive grid targets.

Because those targets are focusable `div` elements, add keyboard activation while touching this code: Enter/Space on a cell should perform the same action as clicking the cell, and Enter/Space on a block should select it. Add a visible `:focus-visible` treatment that does not change the cell or block dimensions.

## Tests

Add or update tests before considering the work done.

Recommended focused tests:

1. Browser geometry test at default `rate = 1`:
   - adjacent cells within a beat have the normal gap
   - the gap after step 4, 8, 12, etc. is wider
   - steps 17-32 have `is-alt-bar`
   - gutters do not have bar-colored background
   - expectations are derived from constants and fixed step anchors, not from neighboring DOM boxes or the same rendered geometry being tested
   - sample actual gutter pixels between cells and compare them with an even-bar cell, an odd-bar cell, and a covered cell in the same screenshot
   - assert there is no track-wide bar decoration element or pseudo-layer

2. Browser interaction test:
   - resizing a block across a beat gap still lands on the intended cell
   - moving a block across a beat gap still lands on the intended target
   - option-drag copy across a beat gap still lands on the intended target
   - double-click delete still works for a block that starts on or spans a beat boundary
   - one-cell active blocks remain square
   - multi-cell block width includes the wider beat gutter
   - clicking exactly at a beat-gutter midpoint snaps to the next cell

3. Rate-change browser test:
   - `rate = 0` makes beat boundaries every 2 cells and bar striping every 8 cells
   - `rate = 1` makes beat boundaries every 4 cells and bar striping every 16 cells
   - `rate = 2` makes beat boundaries every 8 cells and `cellsPerBar = 32`; on the current 32-step grid, this means no alternate bar is visible because every visible step is in bar 0
   - geometry updates after a live rate callback without requiring a window resize
   - if a rate callback arrives mid-gesture, the gesture is cancelled instead of jumping the block

Do the detailed screenshot/pixel visual check at `rate = 1`, where the current 32-step grid shows both an even bar and an alternate bar. Cover the `rate = 0/1/2` mapping with focused geometry assertions; do not require a rate-2 alternate-bar screenshot because there is no second visible bar at 1/32 on a 32-step grid.

4. Runtime bridge test:
   - boot requests the `rate` parameter
   - a rate parameter callback notifies subscribers
   - invalid rate values snap/clamp to `0..2`, including explicit cases for `-1`, `0.49`, `1.5`, `2.01`, `NaN`, and `Infinity`

5. DSP timing probe test:
   - add at least one focused probe that proves the real Cmajor patch advances steps at the three supported rates
   - keep the UI visual grouping anchored to rate index, but verify the DSP timing model still agrees with the public `rate` labels
   - include at least one internal-clock case and one host-clock case; keep swing coverage focused on proving swing changes step durations without changing the visual column spacing contract

Run:

- `node --test tests/test_seqfx_runtime_bridge.mjs`
- `node --test tests/test_seqfx_patch_view_browser.mjs`
- `npm run test:seqfx`

Because this changes Ableton-visible geometry, rebuild and install the VST3, restart Ableton, and inspect the plugin visually before delivery.

Use a concrete Ableton verification sequence:

1. Run `npm run seqfx:plugin:install`.
2. Confirm `~/Library/Audio/Plug-Ins/VST3/CosimoSeqFX.vst3` was overwritten and contains the current UI bundle. Use concrete evidence such as bundle modification time plus a string/class from the generated `fx/seqfx/view/index.js` that is present inside the installed bundle.
3. Fully quit Ableton, then relaunch it so it cannot reuse an old in-memory plugin.
4. Load SeqFX and verify concrete visual facts at all three rates:
   - at `rate = 0`, beat gaps occur every 2 cells and alternate bars begin every 8 cells
   - at `rate = 1`, the step 4-5 gutter is wider than the step 2-3 gutter, and cells 17-32 have alternate cell fill while the gutters stay unstriped
   - at `rate = 2`, beat gaps occur every 8 cells and no alternate bar is visible on the current 32-step grid
5. Exercise resize, move, option-drag copy, double-click delete, and keyboard focus/activation across a beat boundary in Ableton.

## Known Constraints

- The first implementation should use 4/4 bar grouping because no host time signature is currently available in the UI.
- Swing changes step duration in DSP, but the grid should remain evenly spaced; swing is timing feel, not column width.
- Loop start and loop length should not change the visual beat/bar grouping in the first implementation. They affect playback range, not the 32-step ruler.
- The implementation must not reintroduce CSS Grid row sizing for cells and blocks. The fixed explicit geometry was added to keep cells square in Ableton.

## Open Question

If the user later wants true host time signature support, the UI will need a reliable source for beats-per-bar from the host timeline or a plugin parameter. That is not part of this implementation plan.
