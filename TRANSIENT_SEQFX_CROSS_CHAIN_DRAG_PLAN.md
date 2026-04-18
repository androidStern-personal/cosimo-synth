# Transient SeqFX Cross-Chain Drag Plan

This is a transient implementation plan for letting SeqFX blocks move and copy between Chain 1, Chain 2, Chain 3, and Chain 4. It is not a durable project tracker.

## Goal

Plain drag moves blocks between chains.

Option-drag copies blocks between chains.

The moved or copied block keeps:

- effect type
- mix
- all parameter values
- block length
- one trigger on the first step, no triggers on continuation steps

Example:

```text
Chain 1 step 3 Stutter -> drag to Chain 3 step 3
```

Result:

```text
Chain 1 step 3 is empty
Chain 3 step 3 is Stutter
```

This is not a DSP routing change. Cmajor already reads `effectTypes[chain][step]`, so Chain 3 can already run Stutter.

## Current Blocker

The current UI drag path stores one `lane` and resolves pointer X against that same lane for the whole gesture.

Current move path:

```text
handleBlockPointerDown
-> gesture.mode = "move", lane, lastStartStep
-> pointerStepForLane(gesture.lane, event)
-> bridge.moveBlock({ lane, startStep, targetStartStep })
-> applySeqFxBlockMove(...)
```

Current Option-copy path:

```text
handleBlockPointerDown with Option
-> gesture.mode = "copy", lane, sourceStartStep
-> bridge.previewBlockCopyPaint({ lane, startStep, targetStartStep })
-> bridge.copyBlockPaint({ lane, startStep, targetStartStep })
```

The fix is to carry both source lane and target lane through state, bridge, and UI gesture code.

## State Types

Extend the edit types with optional `targetLane`.

```ts
type SeqFxBlockMoveEdit = {
  patternIndex: number;
  lane: number;
  startStep: number;
  targetLane?: number;
  targetStartStep: number;
};

type SeqFxBlockCopyEdit = {
  patternIndex: number;
  lane: number;
  startStep: number;
  targetLane?: number;
  targetStartStep: number;
};

type SeqFxBlockCopyPaintEdit = {
  patternIndex: number;
  lane: number;
  startStep: number;
  targetLane?: number;
  targetStartStep: number;
};

type SeqFxBlockCopyPaintResult = {
  state: SeqFxState;
  copiedLane: number;
  copiedStartSteps: number[];
};

type SeqFxBlockSelectionMoveEdit = {
  patternIndex: number;
  lane: number;
  blockStartSteps: number[];
  anchorStartStep: number;
  targetLane?: number;
  targetAnchorStartStep: number;
};

type SeqFxBlockSelectionMoveResult = {
  state: SeqFxState;
  movedLane: number;
  movedStartSteps: number[];
};

type SeqFxBlockSelectionCopyEdit = {
  patternIndex: number;
  lane: number;
  blockStartSteps: number[];
  anchorStartStep: number;
  targetLane?: number;
  targetAnchorStartStep: number;
};

type SeqFxBlockSelectionCopyResult = {
  state: SeqFxState;
  copiedLane: number;
  copiedStartSteps: number[];
};
```

Keep `targetLane` optional so old same-chain call sites still mean `targetLane = lane`.

No-op checks must compare both lane and step:

```text
same operation no-op = sourceLane == targetLane && sourceStartStep == targetStartStep
```

`Chain 1 step 3 -> Chain 3 step 3` is not a no-op.

## Mutation Safety

Every state operation must preflight before clearing or writing anything.

Preflight means:

```text
resolve source block or source block group
clone source steps
compute every target range
validate every target range
only then clear/write
```

For same-chain moves, target validation may ignore the source block ranges being moved.

For cross-chain moves, target validation ignores nothing in the target chain.

If validation fails:

- pure move/copy functions throw
- copy-paint preview returns the normalized original state with `copiedStartSteps = []`
- bridge methods do not persist state
- bridge methods do not send `patternUpload`
- browser UI leaves source blocks and selection untouched

## Single-Block Move

Update `applySeqFxBlockMove`.

Algorithm:

```text
sourceLane = lane
targetLane = edit.targetLane ?? sourceLane
sourceBlock = block at sourceLane/startStep
clonedSteps = cloneBlockSteps(sourceLane, sourceBlock)

if sourceLane == targetLane && sourceBlock.startStep == targetStartStep:
  return normalized state

assert target fits

if sourceLane == targetLane:
  validate target range, ignoring sourceBlock
else:
  validate target range normally

clear sourceBlock from sourceLane
write clonedSteps to targetLane/targetStartStep
```

Acceptance criteria:

- Moving Chain 1 Filter step 2-4 to Chain 3 step 7-9 clears Chain 1 step 2-4.
- Chain 3 step 7-9 becomes Filter, not Chain 3's default Tape Stop.
- Mix and params match the original three steps.
- Same-step cross-chain move works: Chain 1 step 3 to Chain 3 step 3.
- Target collision throws, original state is unchanged, and bridge/browser send no upload.
- Moved blocks have `trigger=true` on the first step, `trigger=false` on continuation steps, and the same `effectType` across the whole block.

## Single-Block Copy

Update `applySeqFxBlockCopy`.

Algorithm:

```text
sourceLane = lane
targetLane = edit.targetLane ?? sourceLane
sourceBlock = block at sourceLane/startStep
clonedSteps = cloneBlockSteps(sourceLane, sourceBlock)

assert target fits
validate target range normally
write clonedSteps to targetLane/targetStartStep
```

Acceptance criteria:

- Copying Chain 2 Crusher step 1 to Chain 4 step 5 leaves Chain 2 step 1 intact.
- Chain 4 step 5 becomes Crusher with the same params.
- Same-step cross-chain copy works: Chain 2 step 1 to Chain 4 step 1.
- Target collision throws, original state is unchanged, and bridge/browser send no upload.

## Option-Drag Copy

Option mode is latched on pointer down.

- Start without Option -> move, even if Option is pressed later.
- Start with Option -> copy, even if Option is released later.

Option-drag on a selected multi-block group copies the selected group if the clicked block is part of that group. Plain drag on that same selected group moves the group. This keeps the modifier meaning consistent: Option changes move into copy, but it does not change the object being operated on.

Add `applySeqFxBlockSelectionCopy`.

Group copy algorithm:

```text
sourceLane = lane
targetLane = edit.targetLane ?? sourceLane
sourceBlocks = selected blocks in sourceLane
anchorBlock = selected block at anchorStartStep
delta = targetAnchorStartStep - anchorBlock.startStep
clonedBlocks = sourceBlocks with targetStartStep = block.startStep + delta

preflight every cloned target range
validation ignores no target ranges because source is not cleared
write every cloned block to targetLane
return copiedLane = targetLane
return copiedStartSteps
```

If any target range is occupied or out of range, selection-copy preview returns the normalized original state and no copied starts. Release then does nothing.

Keep existing same-chain copy-paint behavior:

```text
Chain 2 step 1 Option-drag to Chain 2 step 4
-> copies at Chain 2 steps 2, 3, and 4
```

Cross-chain Option-drag copies one block:

```text
Chain 2 step 1 Option-drag to Chain 4 step 4
-> copies one block at Chain 4 step 4
```

Reason: diagonal cross-chain dragging should not spray intermediate copies into another chain. That would feel accidental.

For selected groups, Option-drag copies the group once. It does not copy-paint the group across intermediate steps.

Update `applySeqFxBlockCopyPaint`.

Algorithm:

```text
if targetLane == sourceLane:
  keep existing signed copy-paint behavior

if targetLane != sourceLane:
  if target is free:
    copy source block once to targetLane/targetStartStep
    return copiedLane = targetLane
    return copiedStartSteps = [targetStartStep]

  if target is occupied or out of range:
    return normalized original state
    return copiedLane = targetLane
    return copiedStartSteps = []
```

Acceptance criteria:

- Same-chain Option-paint remains exact.
- Cross-chain Option-copy previews one block in the target chain.
- Cross-chain Option-copy to the same step number works.
- Cross-chain invalid target shows no valid preview, sends no upload, and keeps the source selected.
- Preview sends no `patternUpload`.
- Valid release sends exactly one upload.
- Option-drag on a selected group copies the whole selected group, preserving gaps, lengths, effect types, mix, and params.
- After valid selected-group copy, selection moves to the copied group.

## Multi-Block Selection Move

Selection remains single-chain only. A selected group can move to another chain as a group.

Update `applySeqFxBlockSelectionMove`.

Algorithm:

```text
sourceLane = lane
targetLane = edit.targetLane ?? sourceLane
sourceBlocks = selected blocks in sourceLane
anchorBlock = selected block at anchorStartStep
delta = targetAnchorStartStep - anchorBlock.startStep
clonedBlocks = sourceBlocks with targetStartStep = block.startStep + delta

preflight every cloned target range

if sourceLane == targetLane:
  validation ignores all selected source block ranges
else:
  validation ignores nothing in targetLane

clear every source block
write every cloned block to targetLane
return movedLane = targetLane
return movedStartSteps
```

Group target clamping must use the whole group, not only the anchor block:

```text
leftExtent = anchorStartStep - minimumSelectedBlockStart
rightExtent = maximumSelectedBlockEnd - anchorStartStep
targetAnchorStartStep clamps to [leftExtent, stepCount - 1 - rightExtent]
```

Acceptance criteria:

- Moving selected Chain 1 blocks at steps 2 and 8 to Chain 3 step 4 moves them to Chain 3 steps 4 and 10.
- A group with one 3-step block and one 1-step block preserves lengths and gaps.
- A group with mixed effect types, for example Filter and Stutter, preserves each block's effect type and params.
- Collision or out-of-range target leaves every source block untouched and sends no upload.
- UI updates `gesture.currentLane`, selection lane, and inspector lane from `movedLane`.

## UI Target Resolution

Add a target resolver:

```ts
function targetForPointer(event, length, previousTargetLane) {
  targetLane = resolve lane from pointer Y
  pointerStep = stepAtClientX(target lane track bounds, event.clientX)
  targetStartStep = clampBlockStart(pointerStep - grabOffset, length)
  return { targetLane, targetStartStep }
}
```

Use `getBoundingClientRect()` for lane tracks. This handles scroll.

Vertical behavior:

- pointer inside a chain track -> that chain
- pointer above Chain 1 -> Chain 1
- pointer below Chain 4 -> Chain 4
- pointer in the gutter -> keep previous target lane until pointer crosses the midpoint into another chain

This avoids flicker and accidental routing changes while the pointer is in gaps.

Browser tests should drag to target cell centers using bounding boxes. Do not rely on gutter behavior for core tests.

## UI Gesture Changes

Gesture state:

```ts
MoveGesture:
  mode = "move"
  currentLane
  currentStartStep
  length
  grabOffset

CopyGesture:
  mode = "copy"
  sourceLane
  sourceStartStep
  length
  grabOffset
  previewTargetLane
  previewTargetStartStep

SelectionCopyGesture:
  mode = "selectionCopy"
  sourceLane
  blockStartSteps
  anchorStartStep
  grabOffset
  previewTargetLane
  previewTargetAnchorStartStep

BlockSelectionMoveGesture:
  mode = "selectionMove"
  currentLane
  blockStartSteps
  anchorStartStep
  grabOffset
```

Plain single-block drag:

```text
resolve target lane/start
bridge.moveBlock({ lane: currentLane, startStep: currentStartStep, targetLane, targetStartStep })
on success:
  gesture.currentLane = targetLane
  gesture.currentStartStep = targetStartStep
  selection = target chain block
on failure:
  keep block at last valid position
  show invalid ghost at pointer target
```

Option-drag:

```text
resolve target lane/start
if clicked block is part of a selected group:
  bridge.previewBlockSelectionCopy({ lane: sourceLane, blockStartSteps, anchorStartStep, targetLane, targetAnchorStartStep })
else:
  bridge.previewBlockCopyPaint({ lane: sourceLane, startStep: sourceStartStep, targetLane, targetStartStep })
show valid preview if copiedStartSteps is non-empty
show invalid ghost if copiedStartSteps is empty and pointer target is occupied
do not change selection or inspector during preview
on valid release:
  bridge.copyBlockPaint(...) or bridge.copyBlockSelection(...)
  select copied block or group in copiedLane
on invalid release:
  do nothing
  keep source selected
```

Moving from same-chain paint to cross-chain copy clears same-chain paint preview and shows one cross-chain preview. Moving back to the source chain restores same-chain paint preview.

Selected-group drag:

```text
resolve target lane/anchor step using group bounds
bridge.moveBlockSelection({ lane: currentLane, blockStartSteps, anchorStartStep, targetLane, targetAnchorStartStep })
on success:
  gesture.currentLane = movedLane
  gesture.blockStartSteps = movedStartSteps
  gesture.anchorStartStep = targetAnchorStartStep
  selection = moved group in movedLane
on failure:
  keep group at last valid position
  show invalid group ghost at pointer target
```

Preview cleanup:

- replacing target replaces preview
- pointerup clears preview
- Escape clears preview
- pointercancel clears preview
- mouseup outside grid clears preview
- failed release clears preview

## UX Rules

Plain drag:

- The real block follows the pointer into the target chain.
- Occupied target keeps the real block at the last valid position.
- Occupied target shows an invalid ghost and `not-allowed` cursor.
- If release happens over an invalid target after earlier valid movement, selection and inspector stay on the last valid moved position.
- If no valid movement happened, selection and inspector stay on the original source.

Option-drag:

- Source block remains visible.
- Valid preview appears in the target chain.
- Invalid target shows an invalid ghost, not a valid preview.
- Preview sends no upload.
- Release commits once only if the target is valid.
- Invalid release keeps selection and inspector on the original source block or source group.

Selection and inspector:

- Preview does not change selection or inspector.
- Valid move/copy selects the target block or group.
- Invalid plain-move release keeps selection on the last valid moved position, or the original source if nothing moved.
- Invalid Option-copy release keeps the source selection and inspector.
- After cross-chain move/copy, inspector shows the moved/copied effect type, not the target chain default.

Accessibility:

- Final block labels reflect target chain and original effect:

```text
Chain 3 Stutter block 3
Chain 4 Crusher block 5-7
```

- Add screen-reader-only drag status:

```text
Moving Stutter block to Chain 3 step 5
Cannot drop on Chain 3 step 5 because the target is occupied
Copied Crusher block to Chain 4 step 8
```

- Keep keyboard focus on the selected block after commit or failed drop.

Resize:

- Resize remains source-chain only.
- Dragging a resize handle diagonally over another chain only resizes in the source chain.
- It must not create, move, or copy a block in the target chain.

## Tests

Add state tests in `tests/test_seqfx_state.mjs`:

- cross-chain move preserves effect, mix, params, length, triggers, and effectTypes
- cross-chain copy preserves source and writes target
- same-step cross-chain move and copy
- invalid cross-chain move/copy leaves original state unchanged
- same-chain calls without `targetLane` still work
- same-chain partial self-overlap move still works
- same-chain collision behavior is unchanged
- same-chain copy-paint still creates intermediate copies
- cross-chain copy-paint copies once
- invalid cross-chain copy-paint returns original state and no copied starts
- selected group cross-chain move preserves mixed lengths and gaps
- selected group cross-chain move preserves mixed effect types and params
- selected group cross-chain copy preserves mixed lengths, gaps, effect types, mix, and params
- invalid selected-group copy returns original state and no copied starts
- group target clamps at far left and far right, same-chain and cross-chain

Add bridge tests in `tests/test_seqfx_runtime_bridge.mjs`:

- cross-chain move uploads source cleared and target `effectTypes`
- cross-chain copy uploads source and target, with one non-authoritative upload
- invalid cross-chain move/copy sends zero uploads and persists nothing
- cross-chain preview sends zero uploads
- valid cross-chain copy release sends exactly one upload
- selected-group copy preview sends zero uploads
- selected-group copy release sends exactly one upload only when the whole group was copied

Add browser tests in `tests/test_seqfx_patch_view_browser.mjs`:

- plain drag Chain 1 multi-step Filter block to Chain 3 and inspect final upload
- Option-drag Chain 2 Crusher block to Chain 4 and inspect preview, upload count, and final upload
- same-step cross-chain move and Option-copy
- selected group drag to another chain and verify selection follows target chain
- selected group Option-drag to another chain copies the whole group and selects the copy
- occupied target shows invalid feedback; release sends no upload and source remains
- plain move invalid release after a previous valid move keeps selection on the last valid moved position
- Option-copy invalid release keeps selection on the original source
- Option-copy preview leaves inspector on source until release, then inspector moves to target
- started-as-move ignores Option pressed later
- started-as-copy remains copy if Option is released later
- Escape, pointercancel, and mouseup outside grid clear previews and send no uploads
- resize handle dragged diagonally over another chain only resizes source chain

Browser tests must inspect the last `patternUpload`, not only aria labels. Assert:

- `activeSteps`
- `triggerSteps`
- `effectTypes`
- `mix`
- at least one non-default param

Use multi-step blocks in browser tests so continuation cells are proven.

Run:

```text
node --test tests/test_seqfx_state.mjs tests/test_seqfx_runtime_bridge.mjs tests/test_seqfx_preset_adapter.mjs
node --test tests/test_seqfx_patch_view_browser.mjs
npm run fx:build -- seqfx
uv run pytest tests/test_seqfx_probe.py -q
cmaj play --dry-run --stop-on-error fx/seqfx/SeqFx.cmajorpatch
npm run test:effect-presets
```

## Implementation Order

1. Add failing state tests for cross-chain move/copy/copy-paint/group move.
2. Add failing state tests for selected-group copy.
3. Update state edit types and pure state functions.
4. Add bridge tests for valid and invalid cross-chain edits.
5. Update bridge method types.
6. Add pointer target resolution and vertical hysteresis in `SeqFxPatchView.tsx`.
7. Update single-block move gesture.
8. Update selected-block group move.
9. Update Option-drag single-block and selected-group copy preview/release.
10. Add invalid feedback, cancellation, and accessibility status.
11. Add browser tests.
12. Run all verification commands.

## Non-Goals

- No Cmajor routing change.
- No new effect type.
- No automatic effect conversion to target chain defaults.
- No cross-chain resize.
- No multi-chain selection. Selection stays within one chain, but that selected group can move to another chain.
