# Transient SeqFX Serial Chain Refactor Plan

This is a transient implementation plan for changing Cosimo SeqFX from four fixed effect rows into four serial chains. It is not a durable project tracker. Update it while implementing and remove or replace it once the refactor lands.

## Target Behavior

The plugin has one stereo input, four serial chains, and one stereo output:

```text
input -> chain 1 -> chain 2 -> chain 3 -> chain 4 -> output
```

Each chain has 32 sequencer steps. Each chain step can be empty or can run exactly one effect:

```text
empty
filter
crusher
tape stop
stutter
```

Example at step 3:

```text
chain 1 = stutter
chain 2 = filter
chain 3 = crusher
chain 4 = empty
```

The effective audio path at that moment is:

```text
input -> stutter -> filter -> crusher -> output
```

Example at step 4:

```text
chain 1 = stutter
chain 2 = filter
chain 3 = tape stop
chain 4 = empty
```

The effective audio path at that moment is:

```text
input -> stutter -> filter -> tape stop -> output
```

The existing fixed-row model is wrong for this target. The current rows named Filter, Crusher, Tape Stop, and Stutter become Chain 1, Chain 2, Chain 3, and Chain 4. The selected effect type moves into the block/cell data.

## Cmajor Feasibility Constraints

Cmajor graph routing is static. Do not build this by rewiring graph connections at runtime.

The implementation must stay inside one fixed Cmajor processor shape:

```text
stage = input
stage = processSelectedChainEffect(chain 0, stage)
stage = processSelectedChainEffect(chain 1, stage)
stage = processSelectedChainEffect(chain 2, stage)
stage = processSelectedChainEffect(chain 3, stage)
output = globalWetDry(input, stage)
```

Each chain owns independent DSP state for each effect family. A stutter in chain 1 and a stutter in chain 3 must have separate capture buffers and playback state because they are different serial positions in the audio path.

Memory limit: keep one-second Tape Stop and one-second Stutter buffers per chain for v1. A local probe showed four chains with independent one-second Tape/Stutter buffers can generate to the Cmajor JavaScript target. A larger eight-slot generic time-effect model hit `Too many array elements`, so do not add arbitrary effect slots in this refactor.

Latency must remain zero-added-latency for v1. Do not add lookahead stutter or step-dependent latency.

## Data Model

Rename the public concept from lane to chain where practical. Keep numeric count at four.

New Cmajor upload shape:

```cmajor
struct SeqPatternUpload
{
    int32 patternIndex;
    int32 revision;
    bool authoritative;

    bool[chainCount, stepCount] activeSteps;
    bool[chainCount, stepCount] triggerSteps;
    int32[chainCount, stepCount] effectTypes;

    float32[chainCount, stepCount] mix;
    float32[chainCount, stepCount, paramCount] params;
}
```

Effect type constants:

```text
0 empty
1 filter
2 crusher
3 tape stop
4 stutter
```

Normalize the selected effect in both UI state and DSP:

```text
selectedEffect = activeSteps[chain, step] ? clamp(effectTypes[chain, step], 0, 4) : 0
selectedEffect == 0 means empty
```

State invariant:

- inactive steps must store `effectType = empty`
- active steps must store exactly one non-empty `effectType` in `1..4`
- invalid stored-state effect types normalize to empty if inactive, or to the block default if active
- invalid preset effect types are rejected rather than silently loaded

`triggerSteps[chain, step]` starts or restarts a block. Adjacent steps in the same chain with the same effect type and no trigger are one continuous block.

`effectTypes[chain, step]` is copied across every step in a block. Blocks cannot contain mixed effect types. Changing a block's effect changes the type for all steps in that block.

`params[chain, step, paramIndex]` stores the parameter vector for the selected effect type. The meaning of `params` depends on `effectTypes`.

## Parameter Map

Use one shared eight-float parameter vector. Interpret it by effect type.

Filter:

```text
0 mode: 0 lowpass, 1 highpass, 2 bandpass
1 start cutoff Hz, clamped 20 to min(20000, sampleRate * 0.45)
2 end cutoff Hz, clamped 20 to min(20000, sampleRate * 0.45)
3 resonance Q, clamped 0.1 to 20
4 curve, clamped 0.25 to 4
5-7 reserved
```

Crusher:

```text
0 bit depth, integer 4 to 16
1 hold frames, integer 1 to 64
2 drive dB, clamped 0 to 36
3-7 reserved
```

Tape Stop:

```text
0 duration scale, clamped 0.05 to 4
1 stop/start curve, clamped 0.25 to 4
2 catchup curve, clamped 0.25 to 4
3 catchup length percent, clamped 0 to 100
4 mode, integer 0 stop / 1 spin up
5-7 reserved
```

Stutter:

```text
0 slice count, integer 2 to 32
1 playback speed, clamped 0.5 to 2
2-7 reserved
```

## Block Semantics

A block is a contiguous run in one chain with:

```text
active = true
same effect type
one trigger on the first step
continuation steps with trigger = false
```

All block scans in UI state and DSP must stop when they hit:

- an inactive cell
- a trigger cell after the first cell
- the current loop boundary
- a step whose selected effect type differs from the block start effect type

This rule matters even when malformed uploads omit a trigger on an adjacent different-effect step. Different effects are different blocks.

Same chain, adjacent same effect:

```text
step 3 stutter trigger=true
step 4 stutter trigger=false
```

This is one two-step stutter block.

Same chain, adjacent same effect with a trigger:

```text
step 3 stutter trigger=true
step 4 stutter trigger=true
```

This is two one-step stutter blocks. Step 4 recaptures/restarts.

Same chain, adjacent different effect:

```text
step 3 filter
step 4 tape stop
```

This is an effect-type transition. The chain must crossfade from the old effect output to the new effect output over a short fixed window.

Malformed data repair:

- if a continuation cell has a different effect type than the previous active cell, normalization starts a new block by setting that cell's trigger to true
- if an active cell has `effectType = empty`, normalization clears the cell
- if an inactive cell has a non-empty effect type, normalization clears the effect type

## Transition Rules

Use a short chain-local transition ramp when the selected effect type changes or the chain moves between active and empty.

Default transition length:

```text
2 to 5 ms, fixed in DSP
```

For the first implementation, use each effect family's existing mix ramp:

```text
old selected effect mix target -> 0
new selected effect mix target -> step mix
```

The previous effect can keep processing only while its mix is fading to zero. After the ramp, only the new selected effect has non-zero mix. This avoids extra full Tape Stop or Stutter buffers and keeps the Cmajor graph static.

Do not allocate duplicate full Tape Stop or Stutter buffers for transitions. Same-effect retriggers use the existing effect restart blend. Different-effect transitions rely on the old effect ramping out and the new effect ramping in over a short fixed sample window.

Special cases:

- Empty to effect: fade dry chain input to the new effect output.
- Effect to empty: fade old effect output to dry chain input.
- Filter mode change inside a filter block: keep the existing filter mode-fade protection or reuse the chain transition.
- Tape Stop activation: start Tape Stop at the new trigger and fade it in.
- Stutter activation: capture the first slice; during capture the output is live input, then repeats after the capture slice.
- Transport stop, host jump, pattern switch, loop change, and authoritative upload: release time effects and reset transition state so old buffers cannot spill into the wrong musical position.
- Ordinary non-authoritative pattern edit upload: do not release all time effects. Compare the current step's chain/effect/mix/params before and after copying the upload. Only relatch when the current selected cell changed. Editing a future step must not kill the current Tape Stop or Stutter.

## DSP Refactor

Current `fx/seqfx/SeqFx.cmajor` has one global Filter, one global Crusher, one global Tape Stop, and one global Stutter. Replace this with arrays indexed by chain.

Required state shape:

```text
currentEffectType[4]
previousEffectType[4]
transitionAge[4]
transitionFrames[4]
lastChainOutput[4]

filter state per chain, stereo
crusher state per chain
tape history per chain
stutter history per chain
tape runtime variables per chain
stutter runtime variables per chain
```

Processing shape:

```text
dry = audioIn
stage = dry

if clock running:
  stage = processChain(0, stage)
  stage = processChain(1, stage)
  stage = processChain(2, stage)
  stage = processChain(3, stage)
else:
  write history for chain 0..3 as needed for warmup

audioOut = mix(dry, stage, globalMix)
```

For each chain, only the selected effect should run during steady state. During a transition, run the old and new effect for the crossfade window only.

Continuous history writes:

- Tape Stop history must be written for every chain so a Tape Stop block can start cleanly at any chain position.
- In `processChain(chain, stageIn)`, write `stageIn` to that chain's Tape Stop history before running the selected effect. Do not write the chain's own crossfaded output back into its Tape Stop history.
- Stutter history is the capture buffer for its own triggered block, not a rolling history. It only writes during capture.
- Stutter capture records the chain input at that serial position.

Host and loop changes:

- track snapped previous `loopStart`, `loopLength`, `rate`, and `swing`
- when loop or rate changes, clamp `currentStep` into the new loop, release time effects, clear transitions, and relatch
- host position sync must compute both step index and fractional step progress from `std::timeline::Position.quarterNote`
- host jumps inside the same step still release time effects when the discontinuity exceeds a small threshold
- landing on a continuation cell after a host jump must not trigger Tape Stop or Stutter unless that cell is a trigger

Parameter latching:

- block-latched parameters are read from the block start step
- continuation steps should not silently automate inside a block unless the UI explicitly supports per-step automation later
- for this refactor, all selected effect params are block-latched

## UI Refactor

Rows become chain rows:

```text
Chain 1
Chain 2
Chain 3
Chain 4
```

Each block displays its selected effect type and should be visually distinguishable by effect.

Replace the old fixed path label with:

```text
Input -> Chain 1 -> Chain 2 -> Chain 3 -> Chain 4 -> Mix
```

Add a visible draw-effect selector with:

```text
Filter
Crusher
Tape Stop
Stutter
```

Creating a block uses the selected draw effect. If no draw effect was chosen yet, default to Filter. The inspector must also have an effect selector for the selected block.

The inspector title should name the chain and step/block:

```text
Chain 2 step 4
Chain 3 block 8-11
```

The inspector must show controls for the selected block's effect type only:

```text
Filter controls for a filter block
Crusher controls for a crusher block
Tape Stop controls for a tape stop block
Stutter controls for a stutter block
```

Changing a block's effect type:

- Updates every step in that block to the new effect type.
- Preserves block-local parameter memory keyed by effect type where practical. Upload only the selected effect's eight-float vector to Cmajor.
- If per-effect block-local parameter memory is too large for the first implementation, the UI must not silently discard tuned values. It must either preserve the previous selected effect's params in state or provide a clear undo path in the same edit session.
- Marks the first step as trigger and continuations as non-trigger.
- Sends one complete selected-pattern upload.

Block display:

- every visible block must show a compact effect label, such as `FLT`, `CRSH`, `TAPE`, or `STUT`
- accessible names must include chain, effect, and step range, for example `Chain 2 Tape Stop block 8-11`
- color may reinforce effect type, but color alone is not enough

Copy, move, resize, paste, and delete:

- preserve `effectType`, mix, trigger layout, and effect params when preserving a block
- clear `effectType` when clearing a block
- block detection must use effect type, so adjacent different effects never merge into one block
- cross-chain copy is allowed because effect type belongs to the block, not the row
- cross-chain move can remain out of scope if the UI does not expose it, but paste/copy helpers must not reject a block solely because the target chain is different

UI performance:

- drag previews should not write stored state on every pointermove
- commit resize/move/copy-paint once on pointerup, or coalesce commits to one per animation frame
- playhead updates should be step-rate or requestAnimationFrame-coalesced
- block/row rendering should be memoized enough that monitor ticks do not rerender the inspector and every block unnecessarily

## State Migration

Current stored state key:

```text
seqfx.v1
```

Use a new stored state key:

```text
seqfx.v2
```

Migration from v1 to v2:

- Old lane 0 active blocks become Chain 1 blocks with `effectType = filter`.
- Old lane 1 active blocks become Chain 2 blocks with `effectType = crusher`.
- Old lane 2 active blocks become Chain 3 blocks with `effectType = tape stop`.
- Old lane 3 active blocks become Chain 4 blocks with `effectType = stutter`.

This preserves the old fixed processing order for migrated presets:

```text
old filter row -> Chain 1 filter
old crusher row -> Chain 2 crusher
old tape row -> Chain 3 tape stop
old stutter row -> Chain 4 stutter
```

Future edits can change each chain's selected effect type.

Preset contract:

- move SeqFX preset stored state to `seqfx.v2`
- import old `seqfx.v1` preset state through the migration path
- preserve active cells, trigger cells, mix, params, and mapped effect type exactly for old rows
- reject malformed v2 preset effect types instead of silently changing the sound

## TDD Plan

Add failing tests before implementation.

State tests:

- Default v2 state has four chains, 32 steps, and every step has `effectType = empty`.
- Creating a block writes one trigger plus continuation cells and a default effect type.
- Changing a block effect type copies the new type across the whole block and resets params to that effect's defaults.
- `buildSeqPatternUpload` includes `effectTypes`.
- v1 migration maps old fixed lanes to v2 chains with the corresponding effect type.
- Same-chain overlap is still rejected.
- Chain 2 Tape Stop params clamp as Tape Stop params, not old Crusher row params.
- Chain 3 Filter params clamp as Filter params, not old Tape Stop row params.
- Adjacent different-effect active cells are detected as separate blocks even when the second cell's trigger is false.
- Resize, move, copy, copy-paint, delete, value paste, group move, preset capture, and preset apply preserve or clear `effectType` exactly.
- Chain 4 step 32 can hold a non-default effect, and blocks that would run past step 32 are rejected or clipped consistently.

Runtime bridge tests:

- Boot uploads one complete v2 selected-pattern payload with `effectTypes`.
- Editing a selected block effect type persists state and uploads the complete selected pattern.
- Stored v1 state is normalized to v2 and uploaded as v2.
- Editing a future step does not force a hard reset of the current running step in the upload protocol.

DSP render tests:

- Chain 1 stutter plus Chain 2 filter plus Chain 3 crusher processes in serial chain order.
- The chain-order render must be measurably close to `input -> stutter -> filter -> crusher -> output` and measurably far from the old fixed `input -> filter -> crusher -> stutter -> output`.
- Same effect in different chains has independent state: Stutter in chain 1 and Stutter in chain 3 do not share capture buffers.
- Tape Stop history is independent across chains.
- Filter state or mode fade is independent across chains.
- Adjacent different effects in one chain do not click above the dry signal's allowed boundary jump.
- Adjacent same-effect continuation does not retrigger unless `triggerSteps` is true.
- Contradictory uploads, such as inactive with non-empty effect type or active with empty effect type, normalize to empty in DSP behavior.
- Adjacent different effects with missing trigger still form two blocks.
- Same-effect Stutter retrigger does not allocate a second full buffer and does not click.
- Uploading an edit to a future step while current Stutter is running does not interrupt the current repeat.
- Host jump inside the same step releases stale time-effect state.
- Loop start placed inside a continuation block does not trigger Tape Stop or Stutter unless that cell is a trigger.
- Effect to empty, empty to effect, and different effect to different effect all transition without non-finite output or stale buffer spill.
- Empty chain steps pass audio unchanged.
- Global mix 0 remains dry even when every chain is active.
- Cmajor JavaScript generation succeeds with four chains and one-second Tape/Stutter buffers.
- A stress render with all four chains active and alternating effect types every step stays finite and completes within an agreed local budget at 48 kHz. If 96 kHz generation/rendering is available, run the same stress case at 96 kHz.

Browser/UI tests:

- Grid rows are labeled Chain 1 through Chain 4.
- The fixed signal path label is gone and replaced by `Input -> Chain 1 -> Chain 2 -> Chain 3 -> Chain 4 -> Mix`.
- Fixed effect row names do not appear as row labels; they only appear in effect selectors, block labels, and effect controls.
- Creating a block shows the block's effect label.
- Inspector can change a Chain 2 block from Filter to Tape Stop and stored state/upload reflect `effectType = tape stop`.
- Inspector shows only controls for the selected effect type.
- Existing block resize/move/copy/delete interactions still preserve one trigger per block.
- Dragging a block across many steps does not send one stored-state write per pointermove.

## Acceptance Criteria

Implementation is not complete until:

- `input -> chain 1 -> chain 2 -> chain 3 -> chain 4 -> output` is proven by a DSP render test where changing chain order changes the measured output.
- A step with Chain 1 Stutter, Chain 2 Filter, and Chain 3 Crusher audibly/renderably differs from Filter -> Crusher -> Stutter.
- Stutter in Chain 1 and Stutter in Chain 3 use independent capture state.
- Tape Stop and Filter also have chain-local state; at least one render test proves this for each.
- Every uploaded pattern has four chains, each chain has 32 steps, and each step has exactly one effect type: `0` only when inactive, `1..4` only when active.
- Adjacent different effects in the same chain crossfade without a click larger than the measured dry signal boundary jump threshold.
- Same-effect continuation across adjacent steps continues one block unless the later step is a trigger.
- Empty steps and global mix 0 pass dry audio through.
- The UI no longer names rows Filter, Crusher, Tape Stop, and Stutter. It names rows Chain 1, Chain 2, Chain 3, and Chain 4.
- The UI shows each block's effect type in visible and accessible text.
- Stored v1 SeqFX data normalizes into v2 without crashing or losing visible blocks.
- `cmaj play --dry-run --stop-on-error fx/seqfx/SeqFx.cmajorpatch` passes.
- `cmaj generate --target=javascript fx/seqfx/SeqFx.cmajorpatch` passes.
- These exact verification commands pass:

```text
node --test tests/test_seqfx_state.mjs tests/test_seqfx_runtime_bridge.mjs tests/test_seqfx_preset_adapter.mjs
node --test tests/test_seqfx_patch_view_browser.mjs
uv run pytest tests/test_seqfx_probe.py
cmaj play --dry-run --stop-on-error fx/seqfx/SeqFx.cmajorpatch
cmaj generate --target=javascript --output=/tmp/seqfx.cjs fx/seqfx/SeqFx.cmajorpatch
```

- Changed tests pass the audit-test-integrity checklist.

## Explicit Non-Goals

- No arbitrary number of effect slots per chain.
- No draggable effect order inside a chain.
- No runtime Cmajor graph rewiring.
- No lookahead stutter.
- No step-dependent plugin latency.
- No new durable process documents beyond this transient plan.
