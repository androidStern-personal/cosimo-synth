import React, { useMemo } from "react";
import { interpolate } from "remotion";
import "../../../../ui/shared/editor-tokens.css";
import "../../../../ui/shared/editor-tick-slider.css";
import "../../../../ui/shared/filter-range-editor.css";
import "../../../../fx/seqfx/view/crusher-editor.css";
import "../../../../fx/seqfx/view/stutter-envelope-editor.css";
import "../../../../fx/seqfx/view/styles.css";
import {
  SeqFxBlockGlyph,
  SeqFxPatchView,
  type SeqFxPromoControls,
} from "../../../../fx/seqfx/view/SeqFxPatchView";
import type { PatchConnectionLike } from "../../../../ui/shared/cmajor-react";
import {
  SEQFX_EFFECT_TYPES,
  SEQFX_STATE_KEY,
  applySeqFxBlockAuxTargetEndEdit,
  applySeqFxBlockAuxTargetToggle,
  applySeqFxBlockCreate,
  applySeqFxBlockMixEdit,
  applySeqFxBlockParamEdit,
  createDefaultSeqFxState,
  serializeSeqFxState,
  type SeqFxEffectType,
  type SeqFxState,
} from "../../../../fx/seqfx/view/seqfx-state";
import { EFFECTS, EffectKey, easeOut } from "../design";

type SeqFxUiProps = {
  frame: number;
  playheadStep?: number;
  highlightedSteps?: number[];
  showInspector?: boolean;
  inspectorEffect?: EffectKey;
  state?: SeqFxState;
  selectedCell?: { lane: number; step: number };
  showPlayhead?: boolean;
  assembly?: number;
  depth?: number;
  scale?: number;
  compact?: boolean;
};

export const SEQFX_UI_BASE_WIDTH = 1260;
export const SEQFX_UI_BASE_HEIGHT = 760;
const BASE_WIDTH = SEQFX_UI_BASE_WIDTH;
const BASE_HEIGHT = SEQFX_UI_BASE_HEIGHT;

export const EFFECT_TO_SEQFX: Record<EffectKey, SeqFxEffectType> = {
  filter: SEQFX_EFFECT_TYPES.filter,
  crusher: SEQFX_EFFECT_TYPES.crusher,
  tape: SEQFX_EFFECT_TYPES.tapeStop,
  stutter: SEQFX_EFFECT_TYPES.stutter,
};

const INSPECTOR_TARGET: Record<EffectKey, { lane: number; step: number }> = {
  filter: { lane: 0, step: 6 },
  tape: { lane: 1, step: 6 },
  crusher: { lane: 2, step: 6 },
  stutter: { lane: 3, step: 6 },
};

type Listener = (value: unknown) => void;

class PromoPatchConnection implements PatchConnectionLike {
  storedState: Record<string, unknown>;
  parameters: Record<string, unknown> = {
    patternSelect: 0,
    rate: 1,
  };
  status = {
    details: {
      inputs: [],
    },
  };

  private statusListeners = new Set<Listener>();
  private storedStateListeners = new Set<Listener>();
  private parameterListeners = new Map<string, Set<Listener>>();
  private endpointListeners = new Map<string, Set<Listener>>();

  constructor(initialState: SeqFxState) {
    this.storedState = {
      [SEQFX_STATE_KEY]: serializeSeqFxState(initialState),
    };
  }

  addStatusListener(listener: Listener) {
    this.statusListeners.add(listener);
  }

  removeStatusListener(listener: Listener) {
    this.statusListeners.delete(listener);
  }

  requestStatusUpdate() {
    for (const listener of this.statusListeners) {
      listener(this.status);
    }
  }

  addStoredStateValueListener(listener: Listener) {
    this.storedStateListeners.add(listener);
  }

  removeStoredStateValueListener(listener: Listener) {
    this.storedStateListeners.delete(listener);
  }

  requestFullStoredState(callback: (state: Record<string, unknown>) => void) {
    callback({
      parameters: { ...this.parameters },
      values: { ...this.storedState },
    });
  }

  requestStoredStateValue(key: string) {
    for (const listener of this.storedStateListeners) {
      listener({ key, value: this.storedState[key] });
    }
  }

  sendStoredStateValue(key: string, value: unknown) {
    this.storedState[key] = value;
    for (const listener of this.storedStateListeners) {
      listener({ key, value });
    }
  }

  addParameterListener(endpointID: string, listener: Listener) {
    const listeners = this.parameterListeners.get(endpointID) ?? new Set<Listener>();
    listeners.add(listener);
    this.parameterListeners.set(endpointID, listeners);
  }

  removeParameterListener(endpointID: string, listener: Listener) {
    this.parameterListeners.get(endpointID)?.delete(listener);
  }

  requestParameterValue(endpointID: string) {
    for (const listener of this.parameterListeners.get(endpointID) ?? []) {
      listener(this.parameters[endpointID] ?? 0);
    }
  }

  sendEventOrValue(endpointID: string, value: unknown) {
    this.parameters[endpointID] = value;
    for (const listener of this.parameterListeners.get(endpointID) ?? []) {
      listener(value);
    }
  }

  addEndpointListener(endpointID: string, listener: Listener) {
    const listeners = this.endpointListeners.get(endpointID) ?? new Set<Listener>();
    listeners.add(listener);
    this.endpointListeners.set(endpointID, listeners);
  }

  removeEndpointListener(endpointID: string, listener: Listener) {
    this.endpointListeners.get(endpointID)?.delete(listener);
  }
}

const setBlockParam = (
  state: SeqFxState,
  lane: number,
  startStep: number,
  paramIndex: number,
  value: number,
) =>
  applySeqFxBlockParamEdit(state, {
    patternIndex: 0,
    lane,
    startStep,
    paramIndex,
    value,
  });

const setBlockMix = (state: SeqFxState, lane: number, startStep: number, value: number) =>
  applySeqFxBlockMixEdit(state, {
    patternIndex: 0,
    lane,
    startStep,
    value,
  });

const enableAuxTarget = (
  state: SeqFxState,
  lane: number,
  startStep: number,
  paramIndex: number,
  end: number,
) => {
  const enabled = applySeqFxBlockAuxTargetToggle(state, {
    patternIndex: 0,
    lane,
    startStep,
    paramIndex,
    enabled: true,
  });
  return applySeqFxBlockAuxTargetEndEdit(enabled, {
    patternIndex: 0,
    lane,
    startStep,
    paramIndex,
    value: end,
  });
};

const createBlock = (
  state: SeqFxState,
  lane: number,
  startStep: number,
  length: number,
  effectType: SeqFxEffectType,
) =>
  applySeqFxBlockCreate(state, {
    patternIndex: 0,
    lane,
    startStep,
    length,
    effectType,
  });

export const createSeqFxPromoState = () => {
  let state = createDefaultSeqFxState();

  const blocks: Array<[number, number, number, SeqFxEffectType]> = [
    [0, 0, 3, SEQFX_EFFECT_TYPES.filter],
    [0, 4, 2, SEQFX_EFFECT_TYPES.crusher],
    [0, 6, 1, SEQFX_EFFECT_TYPES.filter],
    [0, 7, 1, SEQFX_EFFECT_TYPES.stutter],
    [0, 10, 3, SEQFX_EFFECT_TYPES.tapeStop],
    [0, 16, 4, SEQFX_EFFECT_TYPES.filter],
    [0, 23, 3, SEQFX_EFFECT_TYPES.crusher],
    [0, 28, 3, SEQFX_EFFECT_TYPES.stutter],
    [1, 1, 3, SEQFX_EFFECT_TYPES.tapeStop],
    [1, 6, 1, SEQFX_EFFECT_TYPES.tapeStop],
    [1, 7, 1, SEQFX_EFFECT_TYPES.crusher],
    [1, 11, 3, SEQFX_EFFECT_TYPES.filter],
    [1, 17, 3, SEQFX_EFFECT_TYPES.stutter],
    [1, 23, 4, SEQFX_EFFECT_TYPES.tapeStop],
    [1, 29, 3, SEQFX_EFFECT_TYPES.crusher],
    [2, 2, 3, SEQFX_EFFECT_TYPES.crusher],
    [2, 6, 1, SEQFX_EFFECT_TYPES.crusher],
    [2, 7, 1, SEQFX_EFFECT_TYPES.tapeStop],
    [2, 12, 4, SEQFX_EFFECT_TYPES.stutter],
    [2, 18, 3, SEQFX_EFFECT_TYPES.filter],
    [2, 24, 3, SEQFX_EFFECT_TYPES.crusher],
    [2, 29, 2, SEQFX_EFFECT_TYPES.stutter],
    [3, 0, 2, SEQFX_EFFECT_TYPES.stutter],
    [3, 4, 2, SEQFX_EFFECT_TYPES.filter],
    [3, 6, 1, SEQFX_EFFECT_TYPES.stutter],
    [3, 7, 1, SEQFX_EFFECT_TYPES.filter],
    [3, 12, 4, SEQFX_EFFECT_TYPES.crusher],
    [3, 19, 3, SEQFX_EFFECT_TYPES.tapeStop],
    [3, 25, 3, SEQFX_EFFECT_TYPES.stutter],
    [3, 29, 2, SEQFX_EFFECT_TYPES.filter],
  ];

  for (const [lane, startStep, length, effectType] of blocks) {
    state = createBlock(state, lane, startStep, length, effectType);
  }

  state = setBlockParam(state, 0, 6, 0, 2);
  state = setBlockParam(state, 0, 6, 1, 620);
  state = setBlockParam(state, 0, 6, 3, 3.6);
  state = enableAuxTarget(state, 0, 6, 1, 8_400);
  state = setBlockMix(state, 0, 6, 0.96);

  state = setBlockParam(state, 1, 6, 1, 1.8);
  state = setBlockParam(state, 1, 6, 4, 0);
  state = setBlockMix(state, 1, 6, 0.9);

  state = setBlockParam(state, 2, 6, 0, 6);
  state = setBlockParam(state, 2, 6, 1, 7);
  state = setBlockParam(state, 2, 6, 2, 18);
  state = setBlockMix(state, 2, 6, 0.88);

  state = setBlockParam(state, 3, 6, 0, 16);
  state = setBlockParam(state, 3, 6, 2, 0.75);
  state = setBlockParam(state, 3, 6, 3, 2);
  state = setBlockMix(state, 3, 6, 1);

  return state;
};

export const createEmptySeqFxPromoState = () => createDefaultSeqFxState();

export type RecursiveSeqFxPromoBlockSpec = {
  lane: number;
  startStep: number;
  length: number;
  effect: Extract<EffectKey, "tape" | "stutter">;
};

const recursiveBlockSpecs: RecursiveSeqFxPromoBlockSpec[] = [
  { lane: 0, startStep: 0, length: 4, effect: "tape" },
  { lane: 1, startStep: 2, length: 4, effect: "stutter" },
  { lane: 2, startStep: 4, length: 4, effect: "tape" },
  { lane: 3, startStep: 6, length: 4, effect: "stutter" },
];

const tuneRecursiveBlock = (state: SeqFxState, block: RecursiveSeqFxPromoBlockSpec) => {
  if (block.effect === "tape") {
    const isFirstTape = block.lane === 0 && block.startStep === 0;
    let tuned = setBlockMix(state, block.lane, block.startStep, isFirstTape ? 0.94 : 0.9);
    tuned = setBlockParam(tuned, block.lane, block.startStep, 1, isFirstTape ? 1.9 : 1.35);
    return setBlockParam(tuned, block.lane, block.startStep, 4, 0);
  }

  const isFirstStutter = block.lane === 1 && block.startStep === 2;
  let tuned = setBlockMix(state, block.lane, block.startStep, 1);
  tuned = setBlockParam(tuned, block.lane, block.startStep, 0, isFirstStutter ? 16 : 24);
  return setBlockParam(tuned, block.lane, block.startStep, 2, isFirstStutter ? 0.68 : 0.48);
};

export const createRecursiveSeqFxPromoStateForBlocks = (
  activeBlocks: RecursiveSeqFxPromoBlockSpec[] = recursiveBlockSpecs,
) => {
  let state = createDefaultSeqFxState();

  for (const block of activeBlocks) {
    state = createBlock(state, block.lane, block.startStep, block.length, EFFECT_TO_SEQFX[block.effect]);
    state = tuneRecursiveBlock(state, block);
  }

  return state;
};

export const createRecursiveSeqFxPromoState = () => createRecursiveSeqFxPromoStateForBlocks();

const PROMO_STATE = createSeqFxPromoState();

const demoParamsForEffect = (effect: EffectKey) => {
  const target = INSPECTOR_TARGET[effect];
  return PROMO_STATE.patterns[0].lanes[target.lane].steps[target.step].params;
};

const selectionForEffect = (effect: EffectKey) => {
  const target = INSPECTOR_TARGET[effect];
  return {
    lane: target.lane,
    steps: [target.step],
    blockStartSteps: [target.step],
  };
};

const auxMonitorForFrame = (frame: number) => {
  const phase = ((frame % 60) + 60) % 60 / 60;
  return {
    cyclePhase: [phase, (phase + 0.2) % 1, (phase + 0.45) % 1, (phase + 0.68) % 1],
    amount: [0.86, 0.42, 0.68, 0.74],
    durationMs: [188, 220, 96, 144],
  };
};

const layerStyle = (assembly: number, index: number, depth: number): React.CSSProperties => {
  const local = interpolate(assembly, [index * 0.11, index * 0.11 + 0.48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
  const z = interpolate(local, [0, 1], [220 + index * 70 + depth, index * 9]);
  const y = interpolate(local, [0, 1], [44 - index * 7, 0]);
  const x = interpolate(local, [0, 1], [index % 2 === 0 ? -42 : 38, 0]);
  const rotateX = interpolate(local, [0, 1], [index % 2 === 0 ? -5 : 4, 0]);
  return {
    opacity: local,
    transform: `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rotateX}deg)`,
  };
};

const realUiClips = [
  { id: "top", x: 0, y: 0, width: BASE_WIDTH, height: 132 },
  { id: "grid", x: 0, y: 118, width: 770, height: BASE_HEIGHT - 118 },
  { id: "inspector", x: 750, y: 118, width: BASE_WIDTH - 750, height: BASE_HEIGHT - 118 },
] as const;

export const SeqFxUi = ({
  frame,
  playheadStep = 0,
  showInspector = true,
  inspectorEffect = "filter",
  state = PROMO_STATE,
  selectedCell,
  showPlayhead = true,
  assembly = 1,
  depth = 0,
  scale = 1,
  compact = false,
}: SeqFxUiProps) => {
  const connection = useMemo(() => new PromoPatchConnection(state), [state]);
  const selected = selectedCell ?? selectionForEffect(inspectorEffect);
  const promoControls: SeqFxPromoControls = {
    state,
    selectedPattern: 0,
    rateIndex: compact ? 0 : 1,
    selectedCell: { lane: selected.lane, step: "steps" in selected ? selected.steps[0] : selected.step },
    selection:
      "steps" in selected
        ? selected
        : {
            lane: selected.lane,
            steps: [selected.step],
            blockStartSteps: [selected.step],
          },
    playheadStep,
    inspectorMode: frame % 150 > 104 ? "mod" : "effect",
    auxMonitor: auxMonitorForFrame(frame),
    hidePresetBar: true,
  };

  return (
    <div
      className="seqfx-ui seqfx-real-stage"
      style={{
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
        transform: `scale(${scale}) translateZ(0)`,
      }}
    >
      <div className="seqfx-real-backing" />
      {realUiClips.map((clip, index) => {
        if (!showInspector && clip.id === "inspector") {
          return null;
        }

        return (
          <div
            className="seqfx-real-layer"
            key={clip.id}
            style={{
              ...layerStyle(assembly, index, depth),
              left: clip.x,
              top: clip.y,
              width: showInspector ? clip.width : clip.id === "grid" ? BASE_WIDTH : clip.width,
              height: clip.height,
            }}
          >
            <div
              className="seqfx-real-layer__source"
              style={{
                left: -clip.x,
                top: -clip.y,
              }}
            >
              <RealSeqFxView
                connection={connection}
                controls={promoControls}
                showInspector={showInspector}
              />
            </div>
          </div>
        );
      })}
      {showPlayhead ? (
        <PlayheadRail playheadStep={playheadStep} showInspector={showInspector} frame={frame} />
      ) : null}
    </div>
  );
};

const RealSeqFxView = ({
  connection,
  controls,
  showInspector,
}: {
  connection: PatchConnectionLike;
  controls: SeqFxPromoControls;
  showInspector: boolean;
}) => (
  <div className={`seqfx-real-scope${showInspector ? "" : " seqfx-real-hide-inspector"}`}>
    <SeqFxPatchView patchConnection={connection} promoControls={controls} />
  </div>
);

const PlayheadRail = ({
  playheadStep,
  showInspector,
  frame,
}: {
  playheadStep: number;
  showInspector: boolean;
  frame: number;
}) => {
  const column = playheadStep % 16;
  const row = playheadStep >= 16 ? 1 : 0;
  const gridX = 52 + column * 43.1;
  const gridY = 214 + row * 334;
  const pulse = 0.65 + Math.sin(frame * 0.32) * 0.25;

  return (
    <div
      className="seqfx-real-playhead"
      style={{
        left: gridX,
        top: gridY,
        height: 232,
        opacity: showInspector ? 0.94 : 0.82,
        boxShadow: `0 0 ${24 + pulse * 28}px rgba(242,209,107,0.72)`,
      }}
    />
  );
};

export const RealSeqFxBlockPill = ({
  effect,
  width = 372,
  height = 72,
}: {
  effect: EffectKey;
  width?: number;
  height?: number;
}) => {
  const effectType = EFFECT_TO_SEQFX[effect];
  const info = EFFECTS[effect];
  return (
    <div
      className="seqfx-real-pill seqfx-block"
      data-effect={effectType}
      style={{ width, height }}
    >
      <span className="seqfx-block-fill">
        <SeqFxBlockGlyph
          effectType={effectType}
          params={demoParamsForEffect(effect)}
          segmentLength={Math.max(2, Math.round(width / 112))}
        />
      </span>
      <span className="seqfx-real-pill__name">{info.label}</span>
    </div>
  );
};
