# Transient SeqFX Aux Source Refactor Plan

This is a transient implementation plan for replacing the current SeqFX aux
curve source with the new loopable bump/ramp source. It is not a permanent
architecture document.

## Goal

SeqFX keeps one shared aux modulation source per active effect block. That source
can modulate any parameter target already exposed by the existing aux target
system. This pass replaces only the source shape/rate behavior. It does not
redesign parameter targets, inline modulation controls, block editing, or the mod
panel target rows.

The new aux source has:

- `shape`: one bipolar control from `-1` to `1`
  - `-1` is an unrounded falling ramp.
  - `0` is a rounded centered bell.
  - `1` is an unrounded rising ramp.
- `sourceCurve`: one bipolar curve/remap control from `-1` to `1`
  - Negative values deflate the shape.
  - Positive values inflate it aggressively toward a squared-off bump.
- `rateMode`: `"tempo"` or `"slice"`
  - Tempo mode uses `1/16` as the base unit, an integer multiplier, and a
    triplet toggle.
  - Slice mode divides the active block duration by an integer slice count, like
    the Stutter slices concept.

## Breaking State Contract

No migration or fallback is allowed.

- Change `SEQFX_STATE_KEY` from `seqfx.v4` to `seqfx.v5`.
- Change stored `SeqFxState.version` from `3` to `4`.
- Rename strict parsing APIs from `parseStrictSeqFxStateV3` to
  `parseStrictSeqFxStateV4`.
- Runtime bridge, worker service, and preset adapter must request and write only
  `seqfx.v5`.
- If a `seqfx.v5` payload is missing any required aux source fields, strict
  parsing must reject it. It must not silently normalize old aux curve payloads.
- If `seqfx.v5` is absent, the app may boot a fresh default state.

## State Model

Keep the existing aux target architecture. The new state shape is:

```ts
export type SeqFxAuxRateMode = "tempo" | "slice";

export type SeqFxAuxSource = {
    shape: number;
    sourceCurve: number;
    rateMode: SeqFxAuxRateMode;
    tempoMultiplier: number;
    tempoTriplet: boolean;
    sliceCount: number;
};

export type SeqFxAuxState = {
    source: SeqFxAuxSource;
    targets: SeqFxAuxTarget[];
};
```

Ranges and defaults:

- `shape`: clamp `-1..1`, default `0`.
- `sourceCurve`: clamp `-1..1`, default `0`.
- `rateMode`: `"tempo"` or `"slice"`, default `"slice"`.
- `tempoMultiplier`: integer `1..64`, default `4`.
- `tempoTriplet`: boolean, default `false`.
- `sliceCount`: integer `1..32`, default `1`.

`sliceCount = 1` is intentionally allowed for the aux source because it means
one full source cycle over the active block.

State operations that already copy or preserve `aux` must keep doing so with the
new `source` object:

- `createDefaultStep`
- `normalizeStep`
- `normalizeSeqFxState`
- `cloneAuxState`
- `cloneEffectAuxMemory`
- `rememberCurrentEffectAux`
- `rememberedAuxForEffect`
- block create, resize, move, copy, copy-paint, selection move/copy
- block effect switching
- block param edits that update disabled aux target end values
- block aux target toggles and end edits
- clipboard snapshot and paste
- upload building

Add one block-wide source edit helper:

```ts
applySeqFxBlockAuxSourceEdit(state, {
    patternIndex,
    lane,
    startStep,
    source: Partial<SeqFxAuxSource>,
})
```

The helper edits every step in the active block and refreshes `effectAux` for the
active effect, exactly like existing aux target edits.

## Source Shape Math

The production implementation must match the accepted prototype in
`TRANSIENT_SEQFX_AUX_BUMP_PROTOTYPE.html`.

```ts
peakFromShape(shape):
    peak = 0.5 + (shape * 0.5)

rawSkewedBump(x, shape):
    peak = peakFromShape(shape)
    if peak <= 0.000001: return 1 - x
    if peak >= 0.999999: return x
    if x <= peak: return x / peak
    return (1 - x) / (1 - peak)

roundAmount = 1 - abs(shape)
rounded = raw + ((sin(raw * PI * 0.5) - raw) * roundAmount)

if sourceCurve > 0:
    power = 1 + (sourceCurve * 14)
    amount = 1 - pow(1 - rounded, power)
else if sourceCurve < 0:
    power = 1 + (abs(sourceCurve) * 5)
    amount = pow(rounded, power)
else:
    amount = rounded
```

The result is always clamped to `0..1`.

## DSP Upload Contract

Replace `auxCurve` in `SeqPatternUpload` with these source fields:

- `float32[laneCount, stepCount] auxShape`
- `float32[laneCount, stepCount] auxSourceCurve`
- `int32[laneCount, stepCount] auxRateMode`
- `int32[laneCount, stepCount] auxTempoMultiplier`
- `bool[laneCount, stepCount] auxTempoTriplet`
- `int32[laneCount, stepCount] auxSliceCount`

Use constants:

- `auxRateModeTempo = 0`
- `auxRateModeSlice = 1`

Keep existing target fields unchanged:

- `auxEnabled`
- `auxEnd`

The Cmajor upload handler must compare every new source field for both the
current step and the current block-start step before deciding whether to relatch
the current playback state.

## DSP Timing

The aux source loops while the block is active.

Raw cycle phase:

- Tempo mode:
  - `cycleFrames = framesPerQuarter() * 0.25 * tempoMultiplier`
  - If `tempoTriplet`, multiply `cycleFrames` by `2 / 3`.
- Slice mode:
  - `cycleFrames = segmentDurationFrames(lane, blockStart) / sliceCount`

Then:

```cmajor
cyclePhase = wrap(auxAgeFrames[lane] / max(1, cycleFrames));
amount = auxBumpSourceAt(cyclePhase, shape, sourceCurve);
```

Parameter modulation remains:

```cmajor
output = startValue + ((auxEnd - startValue) * amount);
```

Changing source fields during playback should relatch from the current block
age, not restart the source from zero.

## Monitor Contract

Replace the old shaped `auxPhase` monitor value with two values:

- `auxCyclePhase`: raw looping cycle phase `0..1`
- `auxAmount`: shaped source amount `0..1`

The UI thumbnail dot should use `auxCyclePhase` for x-position and `auxAmount`
for y-position. This avoids incorrect display for falling ramps and bell shapes.

## UI Plan

Keep the current inspector structure:

- The effect tabs stay in the inspector header.
- The `Mod` button stays in the inspector header.
- Inline modulation badges and inline range editing stay inside the effect
  editors.
- The mod panel keeps the target rows.

Replace only the old `AuxCurve` source editor with a new aux source editor:

- Thumbnail button:
  - Draws the new bump/ramp curve.
  - Shows a badge with enabled target count.
  - Uses monitor `auxCyclePhase` and `auxAmount` for the moving dot.
- Mod panel source controls:
  - Shape control, `-1..1`.
  - Curve control, `-1..1`.
  - Rate mode toggle: `Tempo` / `Slices`.
  - Tempo mode shows the shared rate control as a `1/16 x N` integer multiplier
    and a triplet toggle.
  - Slice mode shows the same control position as slice count.
  - Hidden tempo and slice values are preserved when switching modes.

Disabled/empty behavior:

- If no block is selected, show the existing “Select a cell” empty state.
- If an empty cell is selected, do not show the mod button.
- If multiple blocks are selected, source edits apply to every selected block
  only if the current inspector code already treats the inspected block as an
  editable representative. Otherwise keep source editing scoped to the inspected
  block for this pass.
- Filter can show the mod button only if the current aux target system already
  allows Filter targets. This pass does not alter Filter’s dedicated sweep UI.

## Tests

Use TDD. Add failing tests before implementation for:

1. State defaults and strict parse:
   - New state key is `seqfx.v5`.
   - Default state version is `4`.
   - Default aux source matches the contract.
   - Strict parser rejects old aux curve payloads under `seqfx.v5`.
2. Upload contract:
   - Upload contains exact new aux source arrays and no `auxCurve`.
   - Inactive steps upload safe defaults.
3. Block-wide source edits:
   - Editing source shape/rate updates every step in the block.
   - `effectAux` preserves source settings when switching effects away and back.
4. Clipboard/copy:
   - Step snapshot and paste preserve the new source object.
5. Browser UI:
   - Mod button thumbnail path changes when shape/curve changes.
   - Target count badge still reflects enabled targets.
   - Inline modulation controls remain available in effect editors.
   - Switching rate mode preserves hidden tempo/slice values.
6. DSP/probe:
   - Shape math samples match independently derived prototype expectations for
     falling ramp, centered bell, rising ramp, positive curve, and negative
     curve.
   - Tempo, triplet, and slice modes produce expected looping phases.
   - Monitor exposes raw phase and shaped amount separately.

Before final delivery, run the changed test suites and audit the new/changed
tests for weak assertions, circular expectations, over-mocking, and phantom
coverage.
