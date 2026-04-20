# Transient SeqFX Aux Envelope Implementation Plan

This is a transient planning document for adding one block-local aux envelope to
SeqFX effect parameters. It is not implementation code and should not be treated
as a permanent design doc unless we later decide to keep it.

## Goal

Each active non-filter SeqFX block gets one aux envelope. The envelope starts at
the block start, reaches the end of its curve at the block end, and can modulate
any parameter in the active non-filter effect.

For each effect parameter:

- The existing parameter value is the aux start value.
- A new aux end value is stored per block.
- A per-parameter enable flag decides whether the aux envelope affects it.
- The block has one shared curve shape used by all enabled parameters.

Unsafe or awkward non-filter parameters are allowed. Stutter slices, Tape Stop
mode, and other discrete or structural parameters may produce weird results, but
the DSP must still clamp values to legal ranges and avoid invalid buffer access.

Block mix is not part of this pass. It is a block/lane mix value, not an effect
parameter, and Claude's prototype did not include it.

Filter is also not part of this aux pass. The existing Filter block already has
its own start cutoff, end cutoff, and curve sweep, and that sweep is the behavior
we are copying for Crusher, Tape Stop, and Stutter. Do not repurpose
`FILTER_PARAM_CURVE` or change `FilterRangeEditor` in this pass.

## Adversarial Review Decisions

Verified and accepted:

- A `seqfx.v3` state key is a breaking state contract. There must be no
  `seqfx.v2 -> seqfx.v3` migration path, no legacy fallback key lookup, and no
  preset compatibility adapter. Existing `seqfx.v2` saved state and presets may
  intentionally fail to load or boot as a fresh default `seqfx.v3` state.
- Strict v3 loading must reject old-shaped payloads even if they are stored
  under the new `seqfx.v3` key. Do not let a lenient normalizer silently accept a
  v2-shaped object.
- Cmajor `patternUpload` change detection must be block-aware. Checking only the
  current step will miss edits to the block-start aux data while playback is
  mid-block.
- `SeqFxStepValueSnapshot` is the clipboard payload. It must include aux data or
  DOM/keyboard copy-paste will drop envelopes.
- Tape Stop and Stutter structural params need explicit no-restart/no-crash
  rules. They cannot be treated as simple scalar params because current DSP
  derives read windows and tape timing at latch/start time.
- `SeqMonitor` emits around 30 Hz today. The UI phase dot should be smoothed in
  React from monitor anchors instead of expecting audio-rate monitor events.
- Filter and Tape Stop UI work must name the exact live components:
  `ui/shared/filter-range-editor.tsx` is intentionally out of scope for this
  pass; Tape Stop lives in the inline Tape Stop editor in
  `fx/seqfx/view/SeqFxPatchView.tsx`.
- New non-native controls need explicit keyboard and ARIA semantics. The current
  FilterRangeEditor already has accessible slider handles and those patterns
  should be reused.
- Verification must include preset adapter, worker service, runtime bridge,
  browser aux UI, Python DSP probes, and a fresh SeqFX production build when
  preparing a plugin binary.

Verified but intentionally rejected:

- Claude's prototype made Stutter Slices `up`-only because current DSP captures a
  fixed read window. The user explicitly said unsafe sweeps are allowed, so the
  production plan allows both directions and adds a DSP capture/read-length rule
  to keep memory access safe.
- Claude did not prototype Stutter Shape modulation. The user explicitly wants
  every parameter in the active non-filter effect to be controllable, so Shape
  modulation is an intentional prototype deviation. It must reuse Claude's `ModBadge`,
  cyan/coral/yellow, and dual-handle language rather than introducing new chrome.

## Claude Prototype Inputs

Claude's UI prototype lives under:

- `TRANSIENT_SEQFX_AUX_UI_MOCKUPS/HANDOFF.md`
- `TRANSIENT_SEQFX_AUX_UI_MOCKUPS/src/cmps/AuxCurve.tsx`
- `TRANSIENT_SEQFX_AUX_UI_MOCKUPS/src/cmps/EditorTickSlider.tsx`
- `TRANSIENT_SEQFX_AUX_UI_MOCKUPS/src/cmps/CrusherEditor.tsx`
- `TRANSIENT_SEQFX_AUX_UI_MOCKUPS/src/cmps/StutterEnvelopeEditor.tsx`
- `TRANSIENT_SEQFX_AUX_UI_MOCKUPS/src/styles/editor-tokens.css`
- `TRANSIENT_SEQFX_AUX_UI_MOCKUPS/src/styles/editor-tick-slider.css`
- `TRANSIENT_SEQFX_AUX_UI_MOCKUPS/src/styles/crusher-editor.css`
- `TRANSIENT_SEQFX_AUX_UI_MOCKUPS/src/styles/stutter-envelope-editor.css`
- `TRANSIENT_SEQFX_AUX_UI_MOCKUPS/src/styles/app.css`

The production port should copy Claude's markup and CSS as closely as possible,
changing only imports, production state wiring, missing accessibility pieces,
and non-prototyped effect editors.

This is an in-place refactor of the current production editors, not a wholesale
replacement with the prototype files. The prototype files are references for the
new aux affordances only. Existing production behavior, public props, data-role
test hooks, pointer interactions, keyboard behavior, formatting, preview math,
and non-aux UI must be preserved unless this plan explicitly names a change.

## Current Repo Facts

SeqFX state is currently in `fx/seqfx/view/seqfx-state.ts`:

- `SEQFX_STATE_KEY = "seqfx.v2"`
- 12 patterns, 4 lanes, 32 steps, 8 params per step
- `SeqFxStep` stores `active`, `trigger`, `effectType`, `mix`, `params`, and
  optional `effectParams`
- `SeqPatternUpload` currently sends `activeSteps`, `triggerSteps`,
  `effectTypes`, `mix`, and `params`
- `createSeqFxWorkerService` in `fx/seqfx/worker/seqfx-worker-service.ts`
  mirrors stored state into `patternUpload`

SeqFX DSP is currently in `fx/seqfx/SeqFx.cmajor`:

- The chain is fixed serial processing: Filter, Crusher, Tape Stop, Stutter.
- Filter already has a block-length sweep using block start values,
  `filterAgeFrames`, `filterDurationFrames`, and `curve01`.
- Crusher latches Bits, Hold Frames, and Drive from the block start.
- Tape Stop latches Duration, curves, Catchup, and Mode when the effect starts.
- Stutter latches Slices, Shape, and Gate from the block start; Speed currently
  reads from the current step at latch time.
- `SeqMonitor` currently reports pattern, step, transport state, step progress,
  and step duration, but not block-local aux phase.

## Backwards Compatibility Decision

This feature intentionally breaks old SeqFX stored state and old SeqFX presets.

Do not add:

- `seqfx.v2` fallback reads
- `seqfx.v2 -> seqfx.v3` migrations
- preset migrations for old SeqFX preset payloads
- compatibility shims in `createStoredStateRuntimeMirror`
- compatibility branches in `createSeqFxPresetStateAdapter`

Required behavior:

- Runtime bridge requests only `SEQFX_STATE_KEY = "seqfx.v3"`.
- Worker service mirrors only `seqfx.v3`.
- Preset adapter advertises only key `seqfx.v3`, `schemaVersion: 3`.
- Preset adapter strictly rejects `version !== 3`.
- Runtime bridge and worker service deserialize `seqfx.v3` through a strict v3
  parser, not the old lenient `normalizeSeqFxState` path.
- If `seqfx.v3` exists but is old-shaped or invalid, fail loudly instead of
  repairing it into a default.
- If `seqfx.v3` is missing, boot the new default empty v3 state. Do not inspect,
  read, migrate, or special-case any old key.
- Tests should assert this breaking behavior so legacy support does not creep
  back in accidentally.

## State Model Plan

Add a v3 state shape in `fx/seqfx/view/seqfx-state.ts`.

```ts
export const SEQFX_STATE_KEY = "seqfx.v3";

export type SeqFxAuxCurveShape =
    | "linear"
    | "ease"
    | "exp"
    | "log"
    | "bell"
    | "hold";

export type SeqFxAuxTarget = {
    enabled: boolean;
    end: number;
};

export type SeqFxAuxState = {
    curve: SeqFxAuxCurveShape;
    targets: SeqFxAuxTarget[];
};

export type SeqFxStep = {
    active: boolean;
    trigger: boolean;
    effectType: SeqFxEffectType;
    mix: number;
    params: number[];
    aux: SeqFxAuxState;
    effectParams?: Partial<Record<SeqFxEffectType, number[]>>;
    effectAux?: Partial<Record<SeqFxEffectType, SeqFxAuxState>>;
};

export type SeqFxStepValueSnapshot = {
    lane: number;
    effectType: SeqFxEffectType;
    mix: number;
    params: number[];
    aux: SeqFxAuxState;
    effectParams?: Partial<Record<SeqFxEffectType, number[]>>;
    effectAux?: Partial<Record<SeqFxEffectType, SeqFxAuxState>>;
};

export type SeqFxState = {
    version: 3;
    patterns: SeqFxPattern[];
};
```

State rules:

- `params[paramIndex]` is the aux start value.
- `aux.targets[paramIndex].end` is the aux end value.
- `aux.targets[paramIndex].enabled` gates modulation for that parameter.
- Default v3 steps include aux data from construction time.
- Strict v3 preset validation requires aux data to be present and shaped
  correctly. Do not accept v2-style preset payloads with missing aux.
- `effectAux` remembers per-effect aux state when a block changes effect type,
  mirroring the existing `effectParams` behavior.
- Aux target arrays must always normalize to `SEQFX_PARAM_COUNT`.
- Aux end values use the same parameter limits and integer rounding as start
  values.
- Split strict external parsing from internal normalization:
  - `parseStrictSeqFxStateV3` is used by the runtime bridge, worker service, and
    preset adapter. It rejects missing aux, wrong version, wrong matrix shape,
    and out-of-range values.
  - `normalizeSeqFxState` may remain useful for internal edit operations, but it
    must not be used as the external stored-state/preset acceptance gate.

State operations that must copy or preserve aux:

- `createDefaultStep`
- `createDefaultSeqFxState`
- `normalizeStep`
- `normalizeSeqFxState`
- `serializeSeqFxState`
- `cloneState`
- `rememberCurrentEffectParams` must get an aux counterpart
- `rememberedParamsForEffect` must get an aux counterpart
- `writeBlock`
- `cloneBlockSteps`
- `writeBlockSteps`
- `applySeqFxBlockCreate`
- `applySeqFxBlockResize`
- `applySeqFxBlockMove`
- `applySeqFxBlockCopy`
- `applySeqFxBlockCopyPaint`
- `applySeqFxBlockSelectionMove`
- `applySeqFxBlockSelectionCopy`
- `applySeqFxBlockParamEdit`
- `applySeqFxBlockSelectionParamEdit`
- `applySeqFxBlockEffectEdit`
- `getSeqFxStepValueSnapshot`
- `applySeqFxStepValuePaste`
- `buildSeqPatternUpload`

Clipboard/copy-paste rules:

- `SeqFxStepValueSnapshot` is the cell clipboard payload.
- `getSeqFxStepValueSnapshot` must include `aux` and `effectAux`.
- `applySeqFxStepValuePaste` must paste `aux` and `effectAux`.
- `SeqFxPatchView` DOM clipboard and keyboard copy/paste paths should continue
  using the bridge snapshot methods. Do not create a second aux-specific
  clipboard format.

Add explicit edit helpers:

- `applySeqFxBlockAuxCurveEdit`
- `applySeqFxBlockAuxTargetToggle`
- `applySeqFxBlockAuxTargetEndEdit`
- `applySeqFxBlockSelectionAuxCurveEdit`
- `applySeqFxBlockSelectionAuxTargetToggle`
- `applySeqFxBlockSelectionAuxTargetEndEdit`

Runtime bridge methods in `fx/seqfx/view/seqfx-runtime-bridge.ts`:

- `setBlockAuxCurve`
- `toggleBlockAuxTarget`
- `setBlockAuxTargetEnd`
- selection variants only if the UI exposes multi-block aux editing

Preset adapter changes in `fx/seqfx/view/seqfx-preset-adapter.ts`:

- Change the advertised contract to key `seqfx.v3`, `schemaVersion: 3`.
- Change strict validation from `version === 2` to `version === 3`.
- Require `aux` and `effectAux` shapes in strict preset validation.
- Keep the exact-contract behavior. Do not migrate old preset payloads.

## Upload Plan

Extend `SeqPatternUpload` in TypeScript:

```ts
export type SeqPatternUpload = {
    patternIndex: number;
    revision: number;
    authoritative: boolean;
    activeSteps: boolean[][];
    triggerSteps: boolean[][];
    effectTypes: number[][];
    mix: number[][];
    params: number[][][];
    auxEnabled: boolean[][][];
    auxEnd: number[][][];
    auxCurve: number[][];
};
```

Curve encoding:

- `0 = linear`
- `1 = ease`
- `2 = exp`
- `3 = log`
- `4 = bell`
- `5 = hold`

Upload rules:

- `buildSeqPatternUpload` sends normalized aux arrays for every lane, step, and
  param.
- Inactive steps still send valid defaults.
- The worker service does not need a separate endpoint. It already calls
  `buildSeqPatternUpload`.
- `patternUpload` revision handling stays unchanged, but current-cell-change
  detection in Cmajor must include aux arrays.

## DSP Plan

Extend `seqfx::SeqPatternUpload` in `fx/seqfx/SeqFx.cmajor`:

```cmajor
bool[laneCount, stepCount, paramCount] auxEnabled;
float32[laneCount, stepCount, paramCount] auxEnd;
int32[laneCount, stepCount] auxCurve;
```

Add processor storage:

```cmajor
bool[seqfx::laneCount, seqfx::stepCount, seqfx::paramCount] stepAuxEnabled;
float32[seqfx::laneCount, seqfx::stepCount, seqfx::paramCount] stepAuxEnd;
int32[seqfx::laneCount, seqfx::stepCount] stepAuxCurve;
float32[seqfx::laneCount] auxAgeFrames;
float32[seqfx::laneCount] auxDurationFrames;
int32[seqfx::laneCount] auxBlockStartStep;
```

Add Cmajor helpers:

```cmajor
float32 auxCurve01 (int32 shape, float32 phase)
float32 auxRawPhaseForLane (wrap<seqfx::laneCount> lane)
float32 auxShapedPhaseForLane (wrap<seqfx::laneCount> lane)
float32 auxParamValue (
    wrap<seqfx::laneCount> lane,
    int32 paramIndex,
    float32 startValue,
    float32 minValue,
    float32 maxValue
)
int32 auxParamInt (
    wrap<seqfx::laneCount> lane,
    int32 paramIndex,
    float32 startValue,
    int32 minValue,
    int32 maxValue
)
```

If Cmajor rejects a generic helper that indexes `stepAuxEnabled` or
`stepAuxEnd` with a dynamic `paramIndex`, implement effect-specific helpers or a
small `if paramIndex == ...` switch instead. Do not let a generic helper
requirement block the DSP implementation.

Curve math must match `sampleAuxCurve` in the production `AuxCurve.tsx`.

Block phase behavior:

- On every active lane latch, set `auxBlockStartStep[lane]` to the block start.
- Set `auxAgeFrames[lane]` from `elapsedFramesFromBlockStart`.
- Set `auxDurationFrames[lane]` from `segmentDurationFrames`.
- During processing, phase is `auxAgeFrames / max(1, auxDurationFrames)`.
- Increment `auxAgeFrames` while the lane remains active.

Effect behavior:

Filter:

- No DSP behavior change in this pass.
- Keep the current filter sweep exactly: `params[1]` start cutoff, `params[2]`
  end cutoff, `params[4]` curve power, `filterAgeFrames`,
  `filterDurationFrames`, `curve01`, and log interpolation.
- Do not remap `FILTER_PARAM_CURVE` into the new shared aux curve.
- Do not add Filter mode/Q aux modulation in this pass. Filter is the model for
  the new aux behavior, not a target for this first aux implementation.

Crusher:

- Bits uses `auxParamInt(lane, 0, crusherBitsStart, 4, 16)`.
- Hold Frames uses `auxParamInt(lane, 1, crusherHoldStart, 1, 64)`.
- Drive uses `auxParamValue(lane, 2, crusherDriveStart, 0, 36)`.
- Drive modulation must not re-arm `crusherNeedsRecapture` every sample. Drive
  is applied to the incoming sample before clipping, but live drive movement does
  not reset the held sample lifecycle.
- If effective Hold changes while running, recapture behavior must remain finite
  and not stall the hold counter. A hold change may take effect at the next
  capture boundary or clamp the current counter, but it must not reset every
  sample.
- Bits modulation affects quantization levels only and does not force recapture.

Tape Stop:

- Duration Scale, Stop Curve, Release Curve, Catchup Percent, and Mode can all
  use aux.
- Mode rounds to `0` or `1` during processing.
- Weird mid-block mode changes are allowed.
- Existing tape history reads must remain wrapped and finite.
- Do not restart Tape Stop on every structural aux change. Instead, compute the
  effective duration scale, curves, catchup percent, and mode during
  `processTapeStop`.
- Derived timing that is currently calculated in `startTapeStop`
  (`tapeStopPointFrames`, `tapeCatchupStartFrames`, `tapeCatchupFrames`) must be
  recomputed safely from the effective values or split into stable latch-time
  and live effective parts.
- `tapeCatchupJumped` must remain one-shot per block. If aux moves the catchup
  boundary backwards/forwards, the DSP may produce weird audio, but it must not
  repeatedly jump every sample.

Stutter:

- Slices, Speed, Shape, and Gate can all use aux.
- Slices rounds to an integer.
- Do not recapture on every Slices change.
- At block start, compute a capture target length from both the start and end
  slice counts when Slices aux is enabled. Use the larger requested read window
  so down-sweeps have enough captured audio when possible.
- During playback, compute effective read length from the current effective
  slice count and clamp it to the captured window.
- If requested read length exceeds captured length, clamp or wrap safely; weird
  audio is acceptable, invalid memory access is not.

Pattern upload relatch behavior:

- Current Cmajor compares only the current step when deciding whether a
  non-authoritative upload changed the sounding cell.
- Aux data is block-start data, so `patternUpload` must compare both the current
  step and `blockStartStep(lane, currentStep)` for each active lane.
- The comparison must include `auxEnabled`, `auxEnd`, and `auxCurve`.
- Editing aux on a block start while playback is mid-block must update the
  sounding block without restarting transport.

## Monitor And Preview Plan

Extend `seqfx::SeqMonitor`:

```cmajor
float32[laneCount] auxPhase;
float32[laneCount] auxDurationMs;
```

Rules:

- `auxPhase[lane]` is raw block-local phase, clamped `0..1`.
- `auxDurationMs[lane]` is the full current block duration for the lane.
- Cmajor monitor output remains a low-rate UI anchor. Do not try to emit
  audio-rate monitor events for the curve dot.
- React stores the latest monitor anchor with a browser timestamp, then uses
  `requestAnimationFrame` to interpolate raw phase between monitor events.
- React samples the selected block's curve locally using the same
  `sampleAuxCurve` implementation as the DSP.
- Editor preview components receive shaped phase.
- If playback is stopped or the selected block is not the currently sounding
  block, the preview phase falls back to `0`.

## UI Shared Primitive Plan

Production targets:

- `ui/shared/editor-tick-slider.tsx`
- `ui/shared/editor-tick-slider.css`
- `ui/shared/editor-tokens.css`

Copy from Claude:

- `ModBadge`
- `ModulationDirection` type if still useful for display, but do not use it to
  forbid user sweeps.
- `EditorTickSliderModulation`
- Modulated tick classes:
  - `is-mod-start`
  - `is-mod-end`
  - `is-mod-between`
- CSS variables:
  - `--editor-accent-range: #f2d16b`
  - `--editor-accent-range-ink: #1c1c1c`

Required production changes beyond Claude:

- Use `<div>` as the outer wrapper instead of `<label>`.
- Add `aria-label={label}` to native range inputs.
- Add keyboard support for modulated drag surfaces.
- Keep the exact stable grid:

```css
grid-template-columns: 68px minmax(0, 1fr) 120px;
```

Unmodulated mode:

- Current fill-from-zero behavior stays.
- Existing visual behavior stays.
- Existing `data-role` hooks and native range behavior stay unless explicitly
  replaced by an accessible two-handle modulated path.

Modulated mode:

- One cyan start cell.
- One coral end cell.
- Yellow cells between.
- No fill-from-zero.
- Dual chip readout: start chip, arrow, end chip.
- Clicking the label toggles modulation.
- Dragging the rail moves whichever handle is nearest.

Two-handle accessibility model:

- The pointer drag surface may remain `role="presentation"`, matching Claude's
  prototype, but it is not the keyboard focus target.
- Every modulated two-handle control renders two focusable slider handles:
  start and end.
- Start handle:
  - `role="slider"`
  - `tabIndex=0`
  - `aria-label="{label} modulation start"`
  - `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-valuetext`
- End handle:
  - `role="slider"`
  - `tabIndex=0`
  - `aria-label="{label} modulation end"`
  - `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-valuetext`
- Keyboard bindings:
  - `ArrowLeft` / `ArrowDown`: decrement by one step
  - `ArrowRight` / `ArrowUp`: increment by one step
  - `Shift + Arrow`: increment by ten steps where that makes sense
  - `Home`: minimum
  - `End`: maximum
- The same model applies to tick rows, Crusher Drive, Stutter Gate, Stutter
  Shape, and Tape Stop modulated handles.
- Browser tests must exercise at least one pointer path and one keyboard path.

## AuxCurve UI Plan

Add a production component based on Claude's `AuxCurve.tsx`.

Production target:

- `fx/seqfx/view/AuxCurve.tsx` or `ui/shared/aux-curve.tsx`

Copy:

- Shape button markup.
- Curve preview SVG.
- `sampleAuxCurve`.
- CSS class names:
  - `aux-curve`
  - `aux-curve__head`
  - `aux-curve__title`
  - `aux-curve__sub`
  - `aux-curve__shapes`
  - `aux-curve__preview`
  - `aux-pv-line`
  - `aux-pv-dot`

Production adaptation:

- The phase dot follows live `monitorOut.auxPhase`.
- The prototype's manual `Phase` scrubber should not change DSP. Hide it for
  the first production pass unless the user explicitly wants an audition-only
  scrubber.
- Render one Aux Curve control per selected block, not one per parameter.

## Crusher UI Plan

Production targets:

- `fx/seqfx/view/CrusherEditor.tsx`
- `fx/seqfx/view/crusher-editor.css`

Copy Claude's structure:

- `CrusherModulation`
- `CrusherModulatedParam`
- `lerp`
- Effective preview values from shaped aux phase
- Bits and Hold use `EditorTickSlider` modulation props.
- Drive label becomes a button with `ModBadge`.
- Drive row uses:
  - cyan start thumb
  - coral end thumb
  - yellow range fill
  - dual chip readout
  - `DriveModulationDragSurface`

Production adaptation:

- Remove directional clamping.
- Add keyboard support for drive end/start adjustment.
- Keep preview math aligned with `crusher-preview.ts` and Cmajor hard-clamp
  quantization.
- Preserve existing Crusher preview layout, labels, data roles, and unmodulated
  Drive behavior that are not part of Claude's aux additions.

## Stutter UI Plan

Production targets:

- `fx/seqfx/view/StutterEnvelopeEditor.tsx`
- `fx/seqfx/view/stutter-envelope-editor.css`

Copy Claude's structure for:

- Gate modulation on the plot.
- `GATE` toggle pill with `ModBadge`.
- Gate cyan start line/handle.
- Gate coral end line/handle.
- Gate yellow bridge region.
- Gate chip with `start -> end`.
- Slices and Speed via modulated `EditorTickSlider`.

Add missing Shape modulation:

- Claude intentionally omitted Shape, but the requirement is every effect
  parameter.
- This is an intentional deviation from the prototype.
- Add a `SHAPE` label/button with `ModBadge`.
- The morph rail gets cyan start thumb, coral end thumb, and yellow range fill.
- Shape readout shows start and end labels or normalized numbers.
- Dragging the morph rail picks the nearest start/end handle.
- Shape uses the same aux curve as Gate/Slices/Speed.

Production adaptation:

- Remove directional clamping from Slices because the user explicitly wants
  unsafe sweeps available. The DSP must handle safe capture/read clamping.
- Keep all pointer hit targets at least as easy to grab as the current single
  gate handle.
- Add keyboard support for gate and shape modulation handles.
- Preserve existing Stutter plot, morph-track free-drag behavior when Shape aux
  is off, labels, data roles, and unmodulated Slices/Speed/Gate behavior that are
  not part of Claude's aux additions.

## Filter UI Plan

Filter UI is intentionally unchanged in this pass.

Rules:

- Do not modify `ui/shared/filter-range-editor.tsx`.
- Do not remove, rename, or repurpose `FILTER_PARAM_CURVE`.
- The existing filter inspector in `fx/seqfx/view/SeqFxPatchView.tsx` keeps its
  current mode, cutoff range, resonance, and curve behavior.
- A future request to add aux modulation to Filter Mode/Q/Curve should get a
  separate plan, because it is not covered by Claude's prototype and it touches
  the already-working filter sweep model.

## Tape Stop UI Plan

Production target:

- The inline `TapeStopEnvelopeEditor` and `TapeStopRangeControl` in
  `fx/seqfx/view/SeqFxPatchView.tsx`
- The Tape Stop styles in `fx/seqfx/view/styles.css`

Claude did not prototype Tape Stop. Use Claude's primitives rather than adding
a new visual language.

Rules:

- Each Tape Stop parameter row gets a clickable label with `ModBadge`.
- Duration Scale, Stop Curve, Release Curve, and Catchup Percent use dual chips
  and two-handle range behavior.
- Mode uses `ModBadge` and a discrete Stop/Spin-up start/end readout.
- If the current Tape Stop graph already draws parameter handles, modulated
  handles use cyan for start, coral for end, and yellow connector/region.
- `TapeStopRangeControl` must switch from `<label>` to `<div>` only if it adds a
  nested button; native range inputs then need explicit `aria-label`.
- The existing graph handles need keyboard support before or during aux work.
  New aux handles must not be pointer-only.
- Preserve the existing Tape Stop graph, mode select behavior, range labels,
  data roles, pointer drag math, readouts, and unmodulated range behavior unless
  an aux-specific change is explicitly named above.

## SeqFxPatchView Wiring Plan

Production target:

- `fx/seqfx/view/SeqFxPatchView.tsx`
- `fx/seqfx/view/harness-main.ts`
- `tests/test_seqfx_patch_view_browser.mjs`

Responsibilities:

- Find the selected block from the current pattern, lane, and step.
- Read the selected block's active effect, params, and aux.
- Pass modulation props into the active effect editor.
- Route label toggles to `bridge.toggleBlockAuxTarget`.
- Route end-value drags to `bridge.setBlockAuxTargetEnd`.
- Route curve buttons to `bridge.setBlockAuxCurve`.
- Compute shaped preview phase from monitor raw phase plus block curve.
- Keep start-value edits on the existing `setBlockParam` path.
- Update `harness-main.ts` so browser tests can emit `monitorOut.auxPhase` and
  `monitorOut.auxDurationMs`.
- Update browser test fixtures and constants from `seqfx.v2` to `seqfx.v3`.

Toggle behavior:

- Turning modulation on seeds the end value from the current start value if no
  usable end value exists.
- Turning modulation off leaves the end value stored.
- Changing the start value does not overwrite end.

## Acceptance Criteria

State acceptance:

- Existing `seqfx.v2` states are not migrated.
- Missing `seqfx.v3` stored state boots a fresh default v3 state without reading
  old keys.
- Presets containing `seqfx.v2` stored state are rejected by the exact v3
  preset contract.
- `seqfx-preset-adapter.ts` advertises only key `seqfx.v3`, schema version `3`.
- `tests/test_seqfx_preset_adapter.mjs` asserts old v2 presets are rejected.
- `tests/test_seqfx_worker_service.mjs` asserts old v2 stored state is ignored.
- Runtime bridge and worker service use strict v3 parsing for existing
  `seqfx.v3` values; a v2-shaped object under the v3 key is rejected, not
  repaired.
- Every normalized active step has valid aux state.
- Aux target arrays are exactly `SEQFX_PARAM_COUNT` long.
- Aux end values clamp and round like start params.
- Effect switching preserves per-effect aux memory.
- Block copy/move/resize/copy-paint preserves aux.
- Step value copy/paste preserves aux.
- Preset save/load and JSON copy/paste preserve aux.
- `buildSeqPatternUpload` includes aux arrays for every lane, step, and param.

DSP acceptance:

- Aux phase starts at `0` at block start.
- Aux phase reaches `1` at block end.
- Aux phase spans the full stretched block duration, not a single step.
- All Crusher, Tape Stop, and Stutter parameters can be enabled for aux
  modulation.
- Filter behavior remains unchanged from the current filter sweep.
- Discrete params round during processing.
- Filter cutoff remains log-interpolated.
- Crusher Drive modulation does not repeatedly re-arm held-sample recapture.
- Cmajor and TypeScript curve functions match for all six shapes.
- DSP output stays finite for extreme legal aux start/end combinations.
- Stutter slice modulation cannot read outside captured buffer storage.
- Pattern upload current-cell-change detection includes aux changes.
- Editing the playing block updates runtime behavior without restarting the
  transport.

UI acceptance:

- Claude's `ModBadge` markup is preserved.
- Off badge is dashed gray.
- On badge is yellow with Claude's glow.
- Tick row grid is exactly `68px minmax(0, 1fr) 120px`.
- Unmodulated controls look unchanged.
- Modulated tick rows show cyan start, coral end, yellow between.
- Modulated tick rows do not fill from zero.
- Clicking a parameter label toggles modulation.
- Dragging a modulated rail moves the nearest handle.
- Drag-release does not accidentally toggle modulation.
- Native inputs have accessible names after label-to-div conversion.
- Modulated custom drag surfaces are keyboard reachable.
- Crusher Drive matches Claude's twin-thumb/yellow-fill design.
- Stutter Gate matches Claude's `GATE` pill and plot overlay.
- Stutter Shape gets matching two-handle modulation treatment.
- Aux Curve appears once for the selected block.
- Aux Curve phase dot follows live block-local phase.
- No large new inspector panel or overlay appears beyond Claude's pattern.

Verification acceptance:

- `node --test tests/test_seqfx_state.mjs`
- `node --test tests/test_seqfx_runtime_bridge.mjs`
- `node --test tests/test_seqfx_worker_service.mjs`
- `node --test tests/test_seqfx_preset_adapter.mjs`
- `node --test tests/test_seqfx_patch_view_browser.mjs`
- `node --test tests/test_seqfx_crusher_preview.mjs`
- `PYTHONPATH=. uv run pytest -q tests/test_seqfx_probe.py`
- `cmaj generate --target=javascript --output=/tmp/seqfx-aux-check.cjs fx/seqfx/SeqFx.cmajorpatch`
- `npx tsc --noEmit`
- `git diff --check`
- Before any plugin install or Ableton validation, run a fresh
  `npm run fx:prod:build -- seqfx`. Do not treat `cmaj generate` as proof that
  the shipped VST3 binary is fresh.

Required new test coverage:

- State tests for aux defaults, strict v3 shape, aux end clamping/rounding,
  effectAux memory, block copy/move/resize/copy-paint, and
  `SeqFxStepValueSnapshot` copy/paste.
- State and browser tests for selected-block group move and selected-block group
  copy must assert aux survives for every moved/copied block.
- Runtime bridge tests for `setBlockAuxCurve`, `toggleBlockAuxTarget`,
  `setBlockAuxTargetEnd`, stored-state writes, and aux-aware pattern uploads.
- Worker service tests proving only `seqfx.v3` is read and `seqfx.v2` is ignored.
- Runtime/worker tests proving a v2-shaped payload stored under `seqfx.v3` fails
  strict parsing instead of being normalized.
- Preset adapter tests proving the contract is `seqfx.v3`/schema `3`, v2 presets
  are rejected, and v3 aux payloads are preserved.
- Browser tests for enabling aux from a label `ModBadge`, dragging start/end,
  keyboard-adjusting a modulated handle, checking upload aux arrays, and moving
  the Aux Curve phase dot from monitor anchors.
- Python probes for a long block aux sweep, a rounded discrete parameter sweep,
  and a Stutter Slices down-sweep safety case.

For any actual implementation, user-facing SeqFX drag and visual UI behavior
must be verified with the browser harness, not just Cmajor generation or unit
tests.

## Adversarial Review Log

Round 1:

- DSP/runtime reviewer found stateful Tape Stop/Stutter structural parameter
  risks, Filter Curve ambiguity, 30 Hz monitor limitations, and v3 contract
  gaps.
- State/runtime reviewer found block-aware relatch risk, missing aux
  constructors/effect memory, and clipboard snapshot omissions.
- UI reviewer found Slices/Shape prototype deviations, vague Filter/Tape
  component boundaries, and incomplete accessibility semantics.
- Verification reviewer found missing preset adapter, worker, bridge, browser,
  probe, and production-build checks.

Round 1 action:

- Accepted the concrete repo-verified issues.
- Rejected only the criticisms that conflicted with the user decision to allow
  unsafe non-filter sweeps.
- Updated the plan with strict v3 state, no legacy support, block-aware relatch,
  structural DSP safety rules, exact UI targets, explicit ARIA/keyboard rules,
  and expanded verification.

User override:

- The user explicitly rejected fallback and migration paths. The plan now breaks
  old SeqFX compatibility on purpose and does not inspect old state keys.

Round 2:

- Reviewers found that Filter was still ambiguously in scope, strict v3 parsing
  could still be bypassed by the lenient normalizer, the browser harness needed
  aux monitor fields, and Crusher Drive could re-arm recapture every sample.

Round 2 action:

- Removed Filter from aux scope.
- Added strict external v3 parsing.
- Added harness/browser fixture updates.
- Added Crusher Drive no-recapture-thrash rule.

Final check:

- Final adversarial reviewer reported: "No remaining blockers found."
