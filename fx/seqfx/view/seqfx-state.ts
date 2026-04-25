import {
    STUTTER_DEFAULT_GATE,
    STUTTER_DEFAULT_SHAPE,
    STUTTER_DEFAULT_SLICES,
    STUTTER_DEFAULT_SPEED,
    STUTTER_SLICES_MAX,
    STUTTER_SLICES_MIN,
    STUTTER_SPEED_MAX,
    STUTTER_SPEED_MIN,
} from "./stutter-envelope";

export const SEQFX_STATE_KEY = "seqfx.v6";
export const SEQFX_STEP_COUNT = 32;
export const SEQFX_LANE_COUNT = 4;
export const SEQFX_PATTERN_COUNT = 12;
export const SEQFX_PARAM_COUNT = 8;

export const SEQFX_AUX_RATE_MODES = {
    tempo: "tempo",
    slice: "slice",
} as const;

export const SEQFX_AUX_RATE_MODE_UPLOAD_VALUES = {
    tempo: 0,
    slice: 1,
} as const;

export const SEQFX_AUX_SOURCE_DEFAULT = {
    shape: 0,
    sourceCurve: 0,
    rateMode: SEQFX_AUX_RATE_MODES.slice,
    tempoMultiplier: 4,
    tempoTriplet: false,
    sliceCount: 1,
} as const;

export const SEQFX_AUX_SHAPE_MIN = -1;
export const SEQFX_AUX_SHAPE_MAX = 1;
export const SEQFX_AUX_SOURCE_CURVE_MIN = -1;
export const SEQFX_AUX_SOURCE_CURVE_MAX = 1;
export const SEQFX_AUX_TEMPO_MULTIPLIER_MIN = 1;
export const SEQFX_AUX_TEMPO_MULTIPLIER_MAX = 64;
export const SEQFX_AUX_SLICE_COUNT_MIN = 1;
export const SEQFX_AUX_SLICE_COUNT_MAX = 32;

export const SEQFX_EFFECT_TYPES = {
    empty: 0,
    filter: 1,
    crusher: 2,
    tapeStop: 3,
    stutter: 4,
} as const;

export const SEQFX_LANES = {
    filter: 0,
    crusher: 1,
    tapeStop: 2,
    stutter: 3,
} as const;

export const SEQFX_LANE_NAMES = [
    "Chain 1",
    "Chain 2",
    "Chain 3",
    "Chain 4",
] as const;

export const SEQFX_EFFECT_TYPE_NAMES = {
    [SEQFX_EFFECT_TYPES.empty]: "Empty",
    [SEQFX_EFFECT_TYPES.filter]: "Filter",
    [SEQFX_EFFECT_TYPES.crusher]: "Crusher",
    [SEQFX_EFFECT_TYPES.tapeStop]: "Tape Stop",
    [SEQFX_EFFECT_TYPES.stutter]: "Stutter",
} as const;

export const SEQFX_EFFECT_TYPE_SHORT_NAMES = {
    [SEQFX_EFFECT_TYPES.empty]: "",
    [SEQFX_EFFECT_TYPES.filter]: "FLT",
    [SEQFX_EFFECT_TYPES.crusher]: "CRSH",
    [SEQFX_EFFECT_TYPES.tapeStop]: "TAPE",
    [SEQFX_EFFECT_TYPES.stutter]: "STUT",
} as const;

export type SeqFxLaneIndex = typeof SEQFX_LANES[keyof typeof SEQFX_LANES];
export type SeqFxEffectType = typeof SEQFX_EFFECT_TYPES[keyof typeof SEQFX_EFFECT_TYPES];
export type SeqFxAuxRateMode = typeof SEQFX_AUX_RATE_MODES[keyof typeof SEQFX_AUX_RATE_MODES];

export type SeqFxAuxSource = {
    shape: number;
    sourceCurve: number;
    rateMode: SeqFxAuxRateMode;
    tempoMultiplier: number;
    tempoTriplet: boolean;
    sliceCount: number;
};

export type SeqFxAuxTarget = {
    enabled: boolean;
    end: number;
};

export type SeqFxAuxState = {
    source: SeqFxAuxSource;
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

export type SeqFxLane = {
    steps: SeqFxStep[];
};

export type SeqFxPattern = {
    revision: number;
    lanes: SeqFxLane[];
};

export type SeqFxState = {
    version: 5;
    patterns: SeqFxPattern[];
};

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
    auxShape: number[][];
    auxSourceCurve: number[][];
    auxRateMode: number[][];
    auxTempoMultiplier: number[][];
    auxTempoTriplet: boolean[][];
    auxSliceCount: number[][];
};

export type SeqFxEditTarget = {
    patternIndex: number;
    lane: number;
    steps: number[];
};

export type SeqFxBlock = {
    lane: number;
    startStep: number;
    length: number;
    endStep: number;
    effectType: SeqFxEffectType;
};

export type SeqFxBlockEditTarget = {
    patternIndex: number;
    lane: number;
    startStep: number;
};

export type SeqFxBlockCreateEdit = SeqFxBlockEditTarget & {
    length: number;
    effectType?: number;
};

export type SeqFxBlockResizeEdit = SeqFxBlockEditTarget & {
    length: number;
};

export type SeqFxBlockMoveEdit = SeqFxBlockEditTarget & {
    targetLane?: number;
    targetStartStep: number;
};

export type SeqFxBlockCopyEdit = SeqFxBlockEditTarget & {
    targetLane?: number;
    targetStartStep: number;
};

export type SeqFxBlockCopyPaintEdit = SeqFxBlockEditTarget & {
    targetLane?: number;
    targetStartStep: number;
};

export type SeqFxBlockCopyPaintResult = {
    state: SeqFxState;
    copiedLane: number;
    copiedStartSteps: number[];
};

export type SeqFxBlockDeleteEdit = SeqFxBlockEditTarget;

export type SeqFxBlockSelectionEditTarget = {
    patternIndex: number;
    lane: number;
    blockStartSteps: number[];
};

export type SeqFxBlockSelectionMoveEdit = SeqFxBlockSelectionEditTarget & {
    anchorStartStep: number;
    targetLane?: number;
    targetAnchorStartStep: number;
};

export type SeqFxBlockSelectionMoveResult = {
    state: SeqFxState;
    movedLane: number;
    movedStartSteps: number[];
};

export type SeqFxBlockSelectionCopyEdit = SeqFxBlockSelectionEditTarget & {
    anchorStartStep: number;
    targetLane?: number;
    targetAnchorStartStep: number;
};

export type SeqFxBlockSelectionCopyResult = {
    state: SeqFxState;
    copiedLane: number;
    copiedStartSteps: number[];
};

export type SeqFxBlockSelectionParamEdit = SeqFxBlockSelectionEditTarget & {
    paramIndex: number;
    value: number;
};

export type SeqFxBlockAuxSourceEdit = SeqFxBlockEditTarget & {
    source: Partial<SeqFxAuxSource>;
};

export type SeqFxBlockAuxTargetToggleEdit = SeqFxBlockEditTarget & {
    paramIndex: number;
    enabled?: boolean;
};

export type SeqFxBlockAuxTargetEndEdit = SeqFxBlockEditTarget & {
    paramIndex: number;
    value: number;
};

export type SeqFxBlockSelectionAuxTargetEndEdit = SeqFxBlockSelectionEditTarget & {
    paramIndex: number;
    value: number;
};

export type SeqFxBlockSelectionAuxTargetToggleEdit = SeqFxBlockSelectionEditTarget & {
    paramIndex: number;
    enabled?: boolean;
};

export type SeqFxBlockSelectionMixEdit = SeqFxBlockSelectionEditTarget & {
    value: number;
};

export type SeqFxBlockParamEdit = SeqFxBlockEditTarget & {
    paramIndex: number;
    value: number;
};

export type SeqFxBlockEffectEdit = SeqFxBlockEditTarget & {
    effectType: number;
};

export type SeqFxBlockMixEdit = SeqFxBlockEditTarget & {
    value: number;
};

export type SeqFxCellToggleEdit = {
    patternIndex: number;
    lane: number;
    step: number;
    active?: boolean;
};

export type SeqFxParamEdit = SeqFxEditTarget & {
    paramIndex: number;
    value: number;
};

export type SeqFxMixEdit = SeqFxEditTarget & {
    value: number;
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

export type SeqFxStepValueSnapshotTarget = {
    patternIndex: number;
    lane: number;
    step: number;
};

export type SeqFxStepValuePasteEdit = SeqFxEditTarget & {
    values: SeqFxStepValueSnapshot;
};

const DEFAULT_EFFECT_PARAMS: number[][] = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 2_000, 500, 0.707, 1, 0, 0, 0],
    [8, 1, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 25, 0, 0, 0, 0],
    [STUTTER_DEFAULT_SLICES, STUTTER_DEFAULT_SPEED, STUTTER_DEFAULT_SHAPE, STUTTER_DEFAULT_GATE, 0, 0, 0, 0],
];

const FILTER_PARAM_CUTOFF = 1;
const FILTER_PARAM_LEGACY_END_CUTOFF = 2;

const PARAM_LIMITS: Array<Array<[number, number]>> = [
    [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
    ],
    [
        [0, 2],
        [20, 20_000],
        [20, 20_000],
        [0.1, 20],
        [0.25, 4],
        [0, 0],
        [0, 0],
        [0, 0],
    ],
    [
        [4, 16],
        [1, 64],
        [0, 36],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
    ],
    [
        [0.05, 4],
        [0.25, 4],
        [0.25, 4],
        [0, 100],
        [0, 1],
        [0, 0],
        [0, 0],
        [0, 0],
    ],
    [
        [STUTTER_SLICES_MIN, STUTTER_SLICES_MAX],
        [STUTTER_SPEED_MIN, STUTTER_SPEED_MAX],
        [0, 1],
        [0, 1],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
    ],
];

const INTEGER_PARAMS = new Set([
    `${SEQFX_EFFECT_TYPES.filter}:0`,
    `${SEQFX_EFFECT_TYPES.crusher}:0`,
    `${SEQFX_EFFECT_TYPES.crusher}:1`,
    `${SEQFX_EFFECT_TYPES.tapeStop}:4`,
    `${SEQFX_EFFECT_TYPES.stutter}:0`,
]);

const TRIGGER_LATCHED_PARAMS = new Set([
    `${SEQFX_EFFECT_TYPES.tapeStop}:0`,
    `${SEQFX_EFFECT_TYPES.tapeStop}:4`,
    `${SEQFX_EFFECT_TYPES.stutter}:0`,
]);

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(max, Math.max(min, value));
}

function clampIndex(value: number, maxExclusive: number, label: string): number {
    const index = Math.trunc(value);
    if (index < 0 || index >= maxExclusive) {
        throw new RangeError(`${label} ${value} is outside the valid range.`);
    }

    return index;
}

function defaultEffectTypeForLane(lane: number): SeqFxEffectType {
    switch (lane) {
        case SEQFX_LANES.filter:
            return SEQFX_EFFECT_TYPES.filter;
        case SEQFX_LANES.crusher:
            return SEQFX_EFFECT_TYPES.crusher;
        case SEQFX_LANES.tapeStop:
            return SEQFX_EFFECT_TYPES.tapeStop;
        case SEQFX_LANES.stutter:
            return SEQFX_EFFECT_TYPES.stutter;
        default:
            return SEQFX_EFFECT_TYPES.filter;
    }
}

function normalizeEffectType(value: number, fallback: SeqFxEffectType = SEQFX_EFFECT_TYPES.filter): SeqFxEffectType {
    const rounded = Math.round(Number(value));
    if (rounded >= SEQFX_EFFECT_TYPES.empty && rounded <= SEQFX_EFFECT_TYPES.stutter) {
        return rounded as SeqFxEffectType;
    }

    return fallback;
}

function defaultParamsForEffect(effectType: number): number[] {
    const resolved = normalizeEffectType(effectType, SEQFX_EFFECT_TYPES.empty);
    return [...(DEFAULT_EFFECT_PARAMS[resolved] ?? DEFAULT_EFFECT_PARAMS[SEQFX_EFFECT_TYPES.empty])];
}

function normalizeParamVector(effectType: number, params: unknown): number[] {
    const rawParams = Array.isArray(params) ? params : [];
    const defaults = defaultParamsForEffect(effectType);
    return Array.from({ length: SEQFX_PARAM_COUNT }, (_unused, paramIndex) => (
        normalizeParam(effectType, paramIndex, Number(rawParams[paramIndex] ?? defaults[paramIndex]))
    ));
}

function normalizeEffectParamMemory(value: unknown): Partial<Record<SeqFxEffectType, number[]>> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }

    const rawMemory = value as Record<string, unknown>;
    const memory: Partial<Record<SeqFxEffectType, number[]>> = {};

    for (const effectType of [
        SEQFX_EFFECT_TYPES.filter,
        SEQFX_EFFECT_TYPES.crusher,
        SEQFX_EFFECT_TYPES.tapeStop,
        SEQFX_EFFECT_TYPES.stutter,
    ] as const) {
        const rawParams = rawMemory[String(effectType)];
        if (Array.isArray(rawParams)) {
            memory[effectType] = normalizeParamVector(effectType, rawParams);
        }
    }

    return Object.keys(memory).length > 0 ? memory : undefined;
}

function normalizeAuxRateMode(value: unknown): SeqFxAuxRateMode {
    return value === SEQFX_AUX_RATE_MODES.tempo || value === SEQFX_AUX_RATE_MODES.slice
        ? value
        : SEQFX_AUX_SOURCE_DEFAULT.rateMode;
}

function normalizeAuxSource(value: unknown): SeqFxAuxSource {
    const rawSource = value && typeof value === "object" && !Array.isArray(value)
        ? value as Partial<SeqFxAuxSource>
        : {};

    return {
        shape: clamp(Number(rawSource.shape ?? SEQFX_AUX_SOURCE_DEFAULT.shape), SEQFX_AUX_SHAPE_MIN, SEQFX_AUX_SHAPE_MAX),
        sourceCurve: clamp(Number(rawSource.sourceCurve ?? SEQFX_AUX_SOURCE_DEFAULT.sourceCurve), SEQFX_AUX_SOURCE_CURVE_MIN, SEQFX_AUX_SOURCE_CURVE_MAX),
        rateMode: normalizeAuxRateMode(rawSource.rateMode),
        tempoMultiplier: clamp(
            Math.round(Number(rawSource.tempoMultiplier ?? SEQFX_AUX_SOURCE_DEFAULT.tempoMultiplier)),
            SEQFX_AUX_TEMPO_MULTIPLIER_MIN,
            SEQFX_AUX_TEMPO_MULTIPLIER_MAX,
        ),
        tempoTriplet: rawSource.tempoTriplet === true,
        sliceCount: clamp(
            Math.round(Number(rawSource.sliceCount ?? SEQFX_AUX_SOURCE_DEFAULT.sliceCount)),
            SEQFX_AUX_SLICE_COUNT_MIN,
            SEQFX_AUX_SLICE_COUNT_MAX,
        ),
    };
}

export function seqFxAuxRateModeToUploadValue(mode: SeqFxAuxRateMode): number {
    return mode === SEQFX_AUX_RATE_MODES.tempo
        ? SEQFX_AUX_RATE_MODE_UPLOAD_VALUES.tempo
        : SEQFX_AUX_RATE_MODE_UPLOAD_VALUES.slice;
}

function defaultAuxForParams(params: number[], effectType: number = SEQFX_EFFECT_TYPES.empty): SeqFxAuxState {
    const aux: SeqFxAuxState = {
        source: normalizeAuxSource(SEQFX_AUX_SOURCE_DEFAULT),
        targets: Array.from({ length: SEQFX_PARAM_COUNT }, (_unused, paramIndex) => ({
            enabled: false,
            end: Number(params[paramIndex] ?? 0),
        })),
    };

    if (effectType === SEQFX_EFFECT_TYPES.filter) {
        aux.source = normalizeAuxSource({
            ...SEQFX_AUX_SOURCE_DEFAULT,
            shape: 1,
            rateMode: SEQFX_AUX_RATE_MODES.slice,
            sliceCount: 1,
        });
        aux.targets[FILTER_PARAM_CUTOFF] = {
            enabled: true,
            end: normalizeParam(
                SEQFX_EFFECT_TYPES.filter,
                FILTER_PARAM_CUTOFF,
                Number(params[FILTER_PARAM_LEGACY_END_CUTOFF] ?? params[FILTER_PARAM_CUTOFF] ?? 500),
            ),
        };
    }

    return aux;
}

function normalizeAuxState(effectType: number, params: number[], value: unknown): SeqFxAuxState {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return defaultAuxForParams(params, normalizeEffectType(effectType, SEQFX_EFFECT_TYPES.empty));
    }

    const rawAux = value && typeof value === "object" && !Array.isArray(value)
        ? value as Partial<SeqFxAuxState>
        : {};
    const rawTargets = Array.isArray(rawAux.targets) ? rawAux.targets : [];
    const defaultAux = defaultAuxForParams(params, normalizeEffectType(effectType, SEQFX_EFFECT_TYPES.empty));

    return {
        source: normalizeAuxSource(rawAux.source ?? defaultAux.source),
        targets: Array.from({ length: SEQFX_PARAM_COUNT }, (_unused, paramIndex) => {
            const rawTarget = rawTargets[paramIndex] && typeof rawTargets[paramIndex] === "object"
                ? rawTargets[paramIndex] as Partial<SeqFxAuxTarget>
                : {};
            const defaultTarget = defaultAux.targets[paramIndex];
            return {
                enabled: typeof rawTarget.enabled === "boolean" ? rawTarget.enabled : defaultTarget.enabled,
                end: normalizeParam(effectType, paramIndex, Number(rawTarget.end ?? defaultTarget.end)),
            };
        }),
    };
}

function normalizeEffectAuxMemory(
    value: unknown,
    effectParamMemory?: Partial<Record<SeqFxEffectType, number[]>>,
): Partial<Record<SeqFxEffectType, SeqFxAuxState>> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }

    const rawMemory = value as Record<string, unknown>;
    const memory: Partial<Record<SeqFxEffectType, SeqFxAuxState>> = {};

    for (const effectType of [
        SEQFX_EFFECT_TYPES.filter,
        SEQFX_EFFECT_TYPES.crusher,
        SEQFX_EFFECT_TYPES.tapeStop,
        SEQFX_EFFECT_TYPES.stutter,
    ] as const) {
        const params = effectParamMemory?.[effectType] ?? defaultParamsForEffect(effectType);
        const rawAux = rawMemory[String(effectType)];
        if (rawAux && typeof rawAux === "object" && !Array.isArray(rawAux)) {
            memory[effectType] = normalizeAuxState(effectType, params, rawAux);
        }
    }

    return Object.keys(memory).length > 0 ? memory : undefined;
}

function cloneEffectParamMemory(memory?: Partial<Record<SeqFxEffectType, number[]>>): Partial<Record<SeqFxEffectType, number[]>> | undefined {
    if (!memory) {
        return undefined;
    }

    const cloned: Partial<Record<SeqFxEffectType, number[]>> = {};
    for (const [effectType, params] of Object.entries(memory)) {
        if (Array.isArray(params)) {
            cloned[Number(effectType) as SeqFxEffectType] = [...params];
        }
    }

    return Object.keys(cloned).length > 0 ? cloned : undefined;
}

function cloneAuxState(aux: SeqFxAuxState): SeqFxAuxState {
    return {
        source: normalizeAuxSource(aux.source),
        targets: Array.from({ length: SEQFX_PARAM_COUNT }, (_unused, paramIndex) => ({
            enabled: aux.targets[paramIndex]?.enabled === true,
            end: Number(aux.targets[paramIndex]?.end ?? 0),
        })),
    };
}

function cloneEffectAuxMemory(memory?: Partial<Record<SeqFxEffectType, SeqFxAuxState>>): Partial<Record<SeqFxEffectType, SeqFxAuxState>> | undefined {
    if (!memory) {
        return undefined;
    }

    const cloned: Partial<Record<SeqFxEffectType, SeqFxAuxState>> = {};
    for (const [effectType, aux] of Object.entries(memory)) {
        if (aux) {
            cloned[Number(effectType) as SeqFxEffectType] = cloneAuxState(aux);
        }
    }

    return Object.keys(cloned).length > 0 ? cloned : undefined;
}

function rememberCurrentEffectParams(step: SeqFxStep): Partial<Record<SeqFxEffectType, number[]>> | undefined {
    const memory = cloneEffectParamMemory(step.effectParams) ?? {};
    if (step.active && step.effectType !== SEQFX_EFFECT_TYPES.empty) {
        memory[step.effectType] = normalizeParamVector(step.effectType, step.params);
    }

    return Object.keys(memory).length > 0 ? memory : undefined;
}

function rememberCurrentEffectAux(step: SeqFxStep): Partial<Record<SeqFxEffectType, SeqFxAuxState>> | undefined {
    const memory = cloneEffectAuxMemory(step.effectAux) ?? {};
    if (step.active && step.effectType !== SEQFX_EFFECT_TYPES.empty) {
        memory[step.effectType] = cloneAuxState(step.aux);
    }

    return Object.keys(memory).length > 0 ? memory : undefined;
}

function rememberedParamsForEffect(step: SeqFxStep, effectType: SeqFxEffectType): number[] {
    return step.effectParams?.[effectType]
        ? [...step.effectParams[effectType]]
        : defaultParamsForEffect(effectType);
}

function rememberedAuxForEffect(step: SeqFxStep, effectType: SeqFxEffectType, params: number[]): SeqFxAuxState {
    return step.effectAux?.[effectType]
        ? normalizeAuxState(effectType, params, step.effectAux[effectType])
        : defaultAuxForParams(params, effectType);
}

function writeStepParamAndTrackAuxEnd(
    step: SeqFxStep,
    effectType: SeqFxEffectType,
    paramIndex: number,
    value: number,
): void {
    const normalizedValue = normalizeParam(effectType, paramIndex, value);
    step.params[paramIndex] = normalizedValue;
    const aux = normalizeAuxState(effectType, step.params, step.aux);
    if (!aux.targets[paramIndex].enabled) {
        aux.targets[paramIndex].end = normalizedValue;
    }
    step.aux = aux;
}

function writeStepAuxSource(step: SeqFxStep, effectType: SeqFxEffectType, source: Partial<SeqFxAuxSource>): void {
    const aux = normalizeAuxState(effectType, step.params, step.aux);
    step.aux = {
        ...aux,
        source: normalizeAuxSource({
            ...aux.source,
            ...source,
        }),
    };
}

function writeStepAuxTargetEnabled(
    step: SeqFxStep,
    effectType: SeqFxEffectType,
    paramIndex: number,
    enabled: boolean,
): void {
    const aux = normalizeAuxState(effectType, step.params, step.aux);
    aux.targets[paramIndex] = {
        ...aux.targets[paramIndex],
        enabled,
    };
    step.aux = aux;
}

function writeStepAuxTargetEnd(
    step: SeqFxStep,
    effectType: SeqFxEffectType,
    paramIndex: number,
    value: number,
): void {
    const aux = normalizeAuxState(effectType, step.params, step.aux);
    aux.targets[paramIndex] = {
        ...aux.targets[paramIndex],
        end: normalizeParam(effectType, paramIndex, value),
    };
    step.aux = aux;
}

function normalizeParam(effectType: number, paramIndex: number, value: number): number {
    const limits = PARAM_LIMITS[effectType]?.[paramIndex] ?? [0, 0];
    const clamped = clamp(Number(value), limits[0], limits[1]);

    if (INTEGER_PARAMS.has(`${effectType}:${paramIndex}`)) {
        return Math.round(clamped);
    }

    return clamped;
}

function normalizeMix(value: number): number {
    return clamp(Number(value), 0, 1);
}

function assertInRange(value: number, min: number, max: number, label: string) {
    if (!Number.isFinite(value)) {
        throw new Error(`${label} must be finite.`);
    }

    if (value < min || value > max) {
        throw new Error(`${label} value ${value} is outside ${min} to ${max}.`);
    }
}

function assertAuxStateValuesInRange(effectType: number, aux: SeqFxAuxState | undefined, label: string) {
    if (!aux || typeof aux !== "object" || Array.isArray(aux)) {
        throw new Error(`${label} aux must be present.`);
    }

    if (!aux.source || typeof aux.source !== "object" || Array.isArray(aux.source)) {
        throw new Error(`${label} aux source must be present.`);
    }

    assertInRange(Number(aux.source.shape), SEQFX_AUX_SHAPE_MIN, SEQFX_AUX_SHAPE_MAX, `${label} aux source shape`);
    assertInRange(Number(aux.source.sourceCurve), SEQFX_AUX_SOURCE_CURVE_MIN, SEQFX_AUX_SOURCE_CURVE_MAX, `${label} aux source curve`);

    if (aux.source.rateMode !== SEQFX_AUX_RATE_MODES.tempo && aux.source.rateMode !== SEQFX_AUX_RATE_MODES.slice) {
        throw new Error(`${label} aux source rate mode must be tempo or slice.`);
    }

    assertInRange(Number(aux.source.tempoMultiplier), SEQFX_AUX_TEMPO_MULTIPLIER_MIN, SEQFX_AUX_TEMPO_MULTIPLIER_MAX, `${label} aux source tempo multiplier`);
    if (!Number.isInteger(aux.source.tempoMultiplier)) {
        throw new Error(`${label} aux source tempo multiplier must be an integer.`);
    }

    if (typeof aux.source.tempoTriplet !== "boolean") {
        throw new Error(`${label} aux source tempo triplet must be boolean.`);
    }

    assertInRange(Number(aux.source.sliceCount), SEQFX_AUX_SLICE_COUNT_MIN, SEQFX_AUX_SLICE_COUNT_MAX, `${label} aux source slice count`);
    if (!Number.isInteger(aux.source.sliceCount)) {
        throw new Error(`${label} aux source slice count must be an integer.`);
    }

    if (!Array.isArray(aux.targets) || aux.targets.length !== SEQFX_PARAM_COUNT) {
        throw new Error(`${label} aux targets must contain ${SEQFX_PARAM_COUNT} targets.`);
    }

    aux.targets.forEach((target, paramIndex) => {
        if (!target || typeof target !== "object" || Array.isArray(target)) {
            throw new Error(`${label} aux target ${paramIndex} is invalid.`);
        }

        if (typeof target.enabled !== "boolean") {
            throw new Error(`${label} aux target ${paramIndex} enabled must be boolean.`);
        }

        const [min, max] = PARAM_LIMITS[effectType]?.[paramIndex] ?? [0, 0];
        const targetLabel = `${label} aux target ${paramIndex} end`;
        assertInRange(Number(target.end), min, max, targetLabel);

        if (INTEGER_PARAMS.has(`${effectType}:${paramIndex}`) && !Number.isInteger(target.end)) {
            throw new Error(`${targetLabel} must be an integer.`);
        }
    });
}

export function assertSeqFxStateValuesInRange(state: SeqFxState) {
    state.patterns.forEach((pattern, patternIndex) => {
        if (!Number.isInteger(pattern.revision) || pattern.revision < 1) {
            throw new Error(`SeqFX pattern ${patternIndex} revision must be a positive integer.`);
        }

        pattern.lanes.forEach((lane, laneIndex) => {
            lane.steps.forEach((step, stepIndex) => {
                const hasEffectType = Object.prototype.hasOwnProperty.call(step, "effectType");
                const fallbackEffectType = defaultEffectTypeForLane(laneIndex);
                const activeEffectType = step.active
                    ? normalizeEffectType(hasEffectType ? step.effectType : fallbackEffectType, fallbackEffectType)
                    : SEQFX_EFFECT_TYPES.empty;

                if (step.active && activeEffectType === SEQFX_EFFECT_TYPES.empty) {
                    throw new Error(`SeqFX pattern ${patternIndex} lane ${laneIndex} step ${stepIndex} active step must have an effect type.`);
                }

                if (!step.active && hasEffectType && step.effectType !== SEQFX_EFFECT_TYPES.empty) {
                    throw new Error(`SeqFX pattern ${patternIndex} lane ${laneIndex} step ${stepIndex} inactive step must be empty.`);
                }

                assertInRange(step.mix, 0, 1, `SeqFX pattern ${patternIndex} lane ${laneIndex} step ${stepIndex} mix`);

                step.params.forEach((param, paramIndex) => {
                    if (!step.active) {
                        assertInRange(param, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, `SeqFX pattern ${patternIndex} lane ${laneIndex} step ${stepIndex} param ${paramIndex}`);
                        return;
                    }

                    const [min, max] = PARAM_LIMITS[activeEffectType]?.[paramIndex] ?? [0, 0];
                    const label = `SeqFX pattern ${patternIndex} lane ${laneIndex} step ${stepIndex} param ${paramIndex}`;

                    assertInRange(param, min, max, label);

                    if (INTEGER_PARAMS.has(`${activeEffectType}:${paramIndex}`) && !Number.isInteger(param)) {
                        throw new Error(`${label} must be an integer.`);
                    }
                });

                const paramsEffectType = activeEffectType === SEQFX_EFFECT_TYPES.empty
                    ? defaultEffectTypeForLane(laneIndex)
                    : activeEffectType;
                const label = `SeqFX pattern ${patternIndex} lane ${laneIndex} step ${stepIndex}`;
                assertAuxStateValuesInRange(paramsEffectType, step.aux, label);

                if (step.effectAux) {
                    for (const [rawEffectType, aux] of Object.entries(step.effectAux)) {
                        const effectType = normalizeEffectType(Number(rawEffectType), SEQFX_EFFECT_TYPES.empty);
                        if (effectType === SEQFX_EFFECT_TYPES.empty) {
                            throw new Error(`${label} effectAux contains an invalid effect type.`);
                        }
                        assertAuxStateValuesInRange(effectType, aux, `${label} effectAux ${effectType}`);
                    }
                }
            });
        });
    });
}

export function isSeqFxTriggerLatchedParam(lane: number, paramIndex: number): boolean {
    return isSeqFxTriggerLatchedParamForEffect(defaultEffectTypeForLane(lane), paramIndex);
}

export function isSeqFxTriggerLatchedParamForEffect(effectType: number, paramIndex: number): boolean {
    return TRIGGER_LATCHED_PARAMS.has(`${effectType}:${paramIndex}`);
}

function createDefaultStep(lane: number): SeqFxStep {
    const defaultEffectType = defaultEffectTypeForLane(lane);
    const params = defaultParamsForEffect(defaultEffectType);
    return {
        active: false,
        trigger: false,
        effectType: SEQFX_EFFECT_TYPES.empty,
        mix: 1,
        params,
        aux: defaultAuxForParams(params, defaultEffectType),
    };
}

function createDefaultPattern(): SeqFxPattern {
    return {
        revision: 1,
        lanes: Array.from({ length: SEQFX_LANE_COUNT }, (_unused, lane) => ({
            steps: Array.from({ length: SEQFX_STEP_COUNT }, () => createDefaultStep(lane)),
        })),
    };
}

export function createDefaultSeqFxState(): SeqFxState {
    return {
        version: 5,
        patterns: Array.from({ length: SEQFX_PATTERN_COUNT }, () => createDefaultPattern()),
    };
}

function cloneState(state: SeqFxState): SeqFxState {
    return {
        version: 5,
        patterns: state.patterns.map((pattern) => ({
            revision: pattern.revision,
            lanes: pattern.lanes.map((lane) => ({
                steps: lane.steps.map((step) => ({
                    active: step.active,
                    trigger: step.trigger,
                    effectType: step.effectType,
                    mix: step.mix,
                    params: [...step.params],
                    aux: cloneAuxState(step.aux),
                    effectParams: cloneEffectParamMemory(step.effectParams),
                    effectAux: cloneEffectAuxMemory(step.effectAux),
                })),
            })),
        })),
    };
}

function normalizeStep(candidate: unknown, lane: number): SeqFxStep {
    const fallback = createDefaultStep(lane);
    const step = candidate && typeof candidate === "object"
        ? candidate as Partial<SeqFxStep>
        : {};
    const rawParams = Array.isArray(step.params) ? step.params : [];
    const effectParams = normalizeEffectParamMemory(step.effectParams);
    const rawActive = step.active === true;
    const fallbackEffectType = defaultEffectTypeForLane(lane);
    const rawEffectType = Object.prototype.hasOwnProperty.call(step, "effectType")
        ? Number(step.effectType)
        : fallbackEffectType;
    const effectType = rawActive
        ? normalizeEffectType(rawEffectType, fallbackEffectType)
        : SEQFX_EFFECT_TYPES.empty;
    const paramsEffectType = effectType === SEQFX_EFFECT_TYPES.empty
        ? fallbackEffectType
        : effectType;

    const params = normalizeParamVector(paramsEffectType, rawParams);
    return {
        active: rawActive && effectType !== SEQFX_EFFECT_TYPES.empty,
        trigger: rawActive && effectType !== SEQFX_EFFECT_TYPES.empty && step.trigger === true,
        effectType,
        mix: normalizeMix(Number(step.mix ?? fallback.mix)),
        params,
        aux: normalizeAuxState(paramsEffectType, params, step.aux),
        effectParams,
        effectAux: normalizeEffectAuxMemory(step.effectAux, effectParams),
    };
}

function repairPatternBlocks(pattern: SeqFxPattern): SeqFxPattern {
    for (let laneIndex = 0; laneIndex < pattern.lanes.length; laneIndex += 1) {
        const lane = pattern.lanes[laneIndex];
        let previousActive = false;
        let previousEffectType: SeqFxEffectType = SEQFX_EFFECT_TYPES.empty;

        for (let stepIndex = 0; stepIndex < lane.steps.length; stepIndex += 1) {
            const step = lane.steps[stepIndex];
            if (!step.active || step.effectType === SEQFX_EFFECT_TYPES.empty) {
                step.active = false;
                step.trigger = false;
                step.effectType = SEQFX_EFFECT_TYPES.empty;
                previousActive = false;
                previousEffectType = SEQFX_EFFECT_TYPES.empty;
                continue;
            }

            if (!previousActive || previousEffectType !== step.effectType) {
                step.trigger = true;
            }

            previousActive = true;
            previousEffectType = step.effectType;
        }
    }

    return pattern;
}

function normalizePattern(candidate: unknown): SeqFxPattern {
    const pattern = candidate && typeof candidate === "object"
        ? candidate as Partial<SeqFxPattern>
        : {};
    const rawLanes = Array.isArray(pattern.lanes) ? pattern.lanes : [];

    return repairPatternBlocks({
        revision: Math.max(1, Math.trunc(Number(pattern.revision ?? 1)) || 1),
        lanes: Array.from({ length: SEQFX_LANE_COUNT }, (_unused, lane) => {
            const rawLane = rawLanes[lane];
            const rawSteps = rawLane && typeof rawLane === "object" && Array.isArray((rawLane as SeqFxLane).steps)
                ? (rawLane as SeqFxLane).steps
                : [];

            return {
                steps: Array.from({ length: SEQFX_STEP_COUNT }, (_unusedStep, step) => (
                    normalizeStep(rawSteps[step], lane)
                )),
            };
        }),
    });
}

export function normalizeSeqFxState(candidate: unknown): SeqFxState {
    if (typeof candidate === "string") {
        try {
            return normalizeSeqFxState(JSON.parse(candidate));
        } catch {
            return createDefaultSeqFxState();
        }
    }

    const rawState = candidate && typeof candidate === "object"
        ? candidate as Partial<SeqFxState>
        : {};
    const rawPatterns = Array.isArray(rawState.patterns) ? rawState.patterns : [];

    return {
        version: 5,
        patterns: Array.from({ length: SEQFX_PATTERN_COUNT }, (_unused, pattern) => (
            normalizePattern(rawPatterns[pattern])
        )),
    };
}

export function serializeSeqFxState(state: SeqFxState): string {
    return JSON.stringify(normalizeSeqFxState(state));
}

function parseStateCandidate(value: unknown): unknown {
    if (typeof value !== "string") {
        return value;
    }

    return JSON.parse(value);
}

function assertStrictSeqFxStateShape(value: unknown): asserts value is SeqFxState {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("SeqFX state must be an object.");
    }

    const state = value as Partial<SeqFxState>;
    if (state.version !== 5 || !Array.isArray(state.patterns)) {
        throw new Error("SeqFX state must contain version 5 patterns.");
    }

    if (state.patterns.length !== SEQFX_PATTERN_COUNT) {
        throw new Error(`SeqFX state patterns must contain ${SEQFX_PATTERN_COUNT} patterns.`);
    }

    state.patterns.forEach((pattern, patternIndex) => {
        if (!pattern || typeof pattern !== "object" || Array.isArray(pattern) || !Array.isArray(pattern.lanes)) {
            throw new Error(`SeqFX pattern ${patternIndex} is invalid.`);
        }

        if (pattern.lanes.length !== SEQFX_LANE_COUNT) {
            throw new Error(`SeqFX pattern ${patternIndex} must contain ${SEQFX_LANE_COUNT} lanes.`);
        }

        pattern.lanes.forEach((lane, laneIndex) => {
            if (!lane || typeof lane !== "object" || Array.isArray(lane) || !Array.isArray(lane.steps)) {
                throw new Error(`SeqFX pattern ${patternIndex} lane ${laneIndex} is invalid.`);
            }

            if (lane.steps.length !== SEQFX_STEP_COUNT) {
                throw new Error(`SeqFX pattern ${patternIndex} lane ${laneIndex} must contain ${SEQFX_STEP_COUNT} steps.`);
            }

            lane.steps.forEach((step, stepIndex) => {
                if (!step || typeof step !== "object" || Array.isArray(step)) {
                    throw new Error(`SeqFX pattern ${patternIndex} lane ${laneIndex} step ${stepIndex} is invalid.`);
                }

                if (!Object.prototype.hasOwnProperty.call(step, "aux")) {
                    throw new Error(`SeqFX pattern ${patternIndex} lane ${laneIndex} step ${stepIndex} must contain aux.`);
                }

                const aux = (step as Partial<SeqFxStep>).aux;
                if (!aux || typeof aux !== "object" || Array.isArray(aux) || !Object.prototype.hasOwnProperty.call(aux, "source")) {
                    throw new Error(`SeqFX pattern ${patternIndex} lane ${laneIndex} step ${stepIndex} aux must contain source.`);
                }
            });
        });
    });
}

export function parseStrictSeqFxStateV5(value: unknown): SeqFxState {
    const parsed = parseStateCandidate(value);
    assertStrictSeqFxStateShape(parsed);
    assertSeqFxStateValuesInRange(parsed);
    return normalizeSeqFxState(parsed);
}

function withEditedPattern(
    state: SeqFxState,
    patternIndex: number,
    edit: (pattern: SeqFxPattern) => void,
): SeqFxState {
    const next = cloneState(normalizeSeqFxState(state));
    const resolvedPattern = clampIndex(patternIndex, SEQFX_PATTERN_COUNT, "patternIndex");
    edit(next.patterns[resolvedPattern]);
    next.patterns[resolvedPattern].revision += 1;
    return next;
}

function normalizeSteps(steps: number[]): number[] {
    const unique = new Set<number>();
    for (const step of steps) {
        unique.add(clampIndex(step, SEQFX_STEP_COUNT, "step"));
    }

    return [...unique].sort((a, b) => a - b);
}

function normalizeBlockLength(startStep: number, length: number): number {
    const maximum = SEQFX_STEP_COUNT - startStep;
    return Math.min(maximum, Math.max(1, Math.trunc(Number(length)) || 1));
}

function stepIsInsideRange(step: number, startStep: number, length: number): boolean {
    return step >= startStep && step < startStep + length;
}

function getBlockForStep(pattern: SeqFxPattern, lane: number, step: number): SeqFxBlock | null {
    const laneSteps = pattern.lanes[lane]?.steps;
    if (!laneSteps?.[step]?.active) {
        return null;
    }

    const effectType = laneSteps[step].effectType;
    if (effectType === SEQFX_EFFECT_TYPES.empty) {
        return null;
    }

    let startStep = step;
    while (
        startStep > 0
        && laneSteps[startStep].active
        && laneSteps[startStep].effectType === effectType
        && !laneSteps[startStep].trigger
        && laneSteps[startStep - 1].active
        && laneSteps[startStep - 1].effectType === effectType
    ) {
        startStep -= 1;
    }

    let endStep = startStep;
    while (
        endStep + 1 < SEQFX_STEP_COUNT
        && laneSteps[endStep + 1].active
        && laneSteps[endStep + 1].effectType === effectType
        && !laneSteps[endStep + 1].trigger
    ) {
        endStep += 1;
    }

    return {
        lane,
        startStep,
        length: endStep - startStep + 1,
        endStep,
        effectType,
    };
}

function clearBlock(pattern: SeqFxPattern, lane: number, block: SeqFxBlock): void {
    for (let step = block.startStep; step <= block.endStep; step += 1) {
        pattern.lanes[lane].steps[step] = createDefaultStep(lane);
    }
}

function assertBlockFits(startStep: number, length: number): void {
    if (startStep + length > SEQFX_STEP_COUNT) {
        throw new RangeError("SeqFX block target range is outside the valid step range.");
    }
}

function assertBlockRangeAvailable(
    pattern: SeqFxPattern,
    lane: number,
    startStep: number,
    length: number,
    ignoreBlocks: SeqFxBlock | SeqFxBlock[] | null = null,
): void {
    const ignoredBlocks = Array.isArray(ignoreBlocks)
        ? ignoreBlocks
        : ignoreBlocks
            ? [ignoreBlocks]
            : [];
    const laneSteps = pattern.lanes[lane].steps;
    for (let step = startStep; step < startStep + length; step += 1) {
        if (!laneSteps[step].active) {
            continue;
        }

        if (ignoredBlocks.some((block) => stepIsInsideRange(step, block.startStep, block.length))) {
            continue;
        }

        throw new Error("SeqFX blocks cannot overlap in the same lane.");
    }
}

function resolveTargetLane(sourceLane: number, targetLane: number | undefined): number {
    return clampIndex(targetLane ?? sourceLane, SEQFX_LANE_COUNT, "targetLane");
}

function writeBlock(
    pattern: SeqFxPattern,
    lane: number,
    startStep: number,
    length: number,
    template: SeqFxStep,
): void {
    const effectType = template.effectType === SEQFX_EFFECT_TYPES.empty
        ? defaultEffectTypeForLane(lane)
        : template.effectType;
    const defaultParams = defaultParamsForEffect(effectType);
    const effectParams = cloneEffectParamMemory(template.effectParams);
    const params = Array.from({ length: SEQFX_PARAM_COUNT }, (_unused, paramIndex) => (
        normalizeParam(effectType, paramIndex, template.params[paramIndex] ?? defaultParams[paramIndex])
    ));
    const aux = normalizeAuxState(effectType, params, template.aux);
    const effectAux = cloneEffectAuxMemory(template.effectAux);
    for (let offset = 0; offset < length; offset += 1) {
        const step = startStep + offset;
        pattern.lanes[lane].steps[step] = {
            active: true,
            trigger: offset === 0,
            effectType,
            mix: normalizeMix(template.mix),
            params: [...params],
            aux: cloneAuxState(aux),
            effectParams: cloneEffectParamMemory(effectParams),
            effectAux: cloneEffectAuxMemory(effectAux),
        };
    }
}

function cloneBlockSteps(pattern: SeqFxPattern, lane: number, block: SeqFxBlock): SeqFxStep[] {
    return Array.from({ length: block.length }, (_unused, offset) => {
        const source = pattern.lanes[lane].steps[block.startStep + offset];
        return {
            active: true,
            trigger: offset === 0,
            effectType: source.effectType,
            mix: normalizeMix(source.mix),
            params: Array.from({ length: SEQFX_PARAM_COUNT }, (_unusedParam, paramIndex) => (
                normalizeParam(source.effectType, paramIndex, source.params[paramIndex])
            )),
            aux: normalizeAuxState(source.effectType, source.params, source.aux),
            effectParams: cloneEffectParamMemory(source.effectParams),
            effectAux: cloneEffectAuxMemory(source.effectAux),
        };
    });
}

function resolveBlockSelection(pattern: SeqFxPattern, lane: number, blockStartSteps: number[]): SeqFxBlock[] {
    const blockByStart = new Map<number, SeqFxBlock>();

    for (const rawStartStep of blockStartSteps) {
        const requestedStart = clampIndex(rawStartStep, SEQFX_STEP_COUNT, "blockStartStep");
        const block = getBlockForStep(pattern, lane, requestedStart);

        if (!block) {
            throw new Error("Cannot edit a missing SeqFX block selection.");
        }

        blockByStart.set(block.startStep, block);
    }

    return [...blockByStart.values()].sort((left, right) => left.startStep - right.startStep);
}

function writeBlockSteps(
    pattern: SeqFxPattern,
    lane: number,
    startStep: number,
    steps: SeqFxStep[],
): void {
    for (let offset = 0; offset < steps.length; offset += 1) {
        const source = steps[offset];
        pattern.lanes[lane].steps[startStep + offset] = {
            active: true,
            trigger: offset === 0,
            effectType: source.effectType,
            mix: normalizeMix(source.mix),
            params: Array.from({ length: SEQFX_PARAM_COUNT }, (_unusedParam, paramIndex) => (
                normalizeParam(source.effectType, paramIndex, source.params[paramIndex])
            )),
            aux: normalizeAuxState(source.effectType, source.params, source.aux),
            effectParams: cloneEffectParamMemory(source.effectParams),
            effectAux: cloneEffectAuxMemory(source.effectAux),
        };
    }
}

export function getSeqFxLaneBlocks(pattern: SeqFxPattern, lane: number): SeqFxBlock[] {
    const laneIndex = clampIndex(lane, SEQFX_LANE_COUNT, "lane");
    const blocks: SeqFxBlock[] = [];
    let step = 0;

    while (step < SEQFX_STEP_COUNT) {
        const block = getBlockForStep(pattern, laneIndex, step);
        if (!block || block.startStep !== step) {
            step += 1;
            continue;
        }

        blocks.push(block);
        step = block.endStep + 1;
    }

    return blocks;
}

export function getSeqFxBlockAtStep(pattern: SeqFxPattern, lane: number, step: number): SeqFxBlock | null {
    return getBlockForStep(
        pattern,
        clampIndex(lane, SEQFX_LANE_COUNT, "lane"),
        clampIndex(step, SEQFX_STEP_COUNT, "step"),
    );
}

export function applySeqFxBlockCreate(state: SeqFxState, edit: SeqFxBlockCreateEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const startStep = clampIndex(edit.startStep, SEQFX_STEP_COUNT, "startStep");
        const length = normalizeBlockLength(startStep, edit.length);
        const effectType = normalizeEffectType(edit.effectType ?? defaultEffectTypeForLane(lane), defaultEffectTypeForLane(lane));
        assertBlockRangeAvailable(pattern, lane, startStep, length);
        writeBlock(pattern, lane, startStep, length, {
            ...createDefaultStep(lane),
            active: true,
            trigger: true,
            effectType,
            params: defaultParamsForEffect(effectType),
            aux: defaultAuxForParams(defaultParamsForEffect(effectType), effectType),
        });
    });
}

export function applySeqFxBlockResize(state: SeqFxState, edit: SeqFxBlockResizeEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const requestedStart = clampIndex(edit.startStep, SEQFX_STEP_COUNT, "startStep");
        const block = getBlockForStep(pattern, lane, requestedStart);

        if (!block) {
            throw new Error("Cannot resize a missing SeqFX block.");
        }

        const length = normalizeBlockLength(block.startStep, edit.length);
        const template = pattern.lanes[lane].steps[block.startStep];
        assertBlockRangeAvailable(pattern, lane, block.startStep, length, block);
        clearBlock(pattern, lane, block);
        writeBlock(pattern, lane, block.startStep, length, template);
    });
}

export function applySeqFxBlockMove(state: SeqFxState, edit: SeqFxBlockMoveEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const sourceLane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const targetLane = resolveTargetLane(sourceLane, edit.targetLane);
        const requestedStart = clampIndex(edit.startStep, SEQFX_STEP_COUNT, "startStep");
        const targetStartStep = clampIndex(edit.targetStartStep, SEQFX_STEP_COUNT, "targetStartStep");
        const block = getBlockForStep(pattern, sourceLane, requestedStart);

        if (!block) {
            throw new Error("Cannot move a missing SeqFX block.");
        }

        if (targetLane === sourceLane && targetStartStep === block.startStep) {
            return;
        }

        assertBlockFits(targetStartStep, block.length);
        assertBlockRangeAvailable(
            pattern,
            targetLane,
            targetStartStep,
            block.length,
            targetLane === sourceLane ? block : null,
        );
        const clonedSteps = cloneBlockSteps(pattern, sourceLane, block);
        clearBlock(pattern, sourceLane, block);
        writeBlockSteps(pattern, targetLane, targetStartStep, clonedSteps);
    });
}

export function applySeqFxBlockCopy(state: SeqFxState, edit: SeqFxBlockCopyEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const sourceLane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const targetLane = resolveTargetLane(sourceLane, edit.targetLane);
        const requestedStart = clampIndex(edit.startStep, SEQFX_STEP_COUNT, "startStep");
        const targetStartStep = clampIndex(edit.targetStartStep, SEQFX_STEP_COUNT, "targetStartStep");
        const block = getBlockForStep(pattern, sourceLane, requestedStart);

        if (!block) {
            throw new Error("Cannot copy a missing SeqFX block.");
        }

        assertBlockFits(targetStartStep, block.length);
        assertBlockRangeAvailable(pattern, targetLane, targetStartStep, block.length);
        writeBlockSteps(pattern, targetLane, targetStartStep, cloneBlockSteps(pattern, sourceLane, block));
    });
}

export function applySeqFxBlockCopyPaint(state: SeqFxState, edit: SeqFxBlockCopyPaintEdit): SeqFxBlockCopyPaintResult {
    const normalizedState = normalizeSeqFxState(state);
    const patternIndex = clampIndex(edit.patternIndex, SEQFX_PATTERN_COUNT, "patternIndex");
    const sourceLane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
    const targetLane = resolveTargetLane(sourceLane, edit.targetLane);
    const requestedStart = clampIndex(edit.startStep, SEQFX_STEP_COUNT, "startStep");
    const targetStartStep = clampIndex(edit.targetStartStep, SEQFX_STEP_COUNT, "targetStartStep");
    const currentPattern = normalizedState.patterns[patternIndex];
    const currentBlock = getBlockForStep(currentPattern, sourceLane, requestedStart);

    if (!currentBlock) {
        throw new Error("Cannot copy a missing SeqFX block.");
    }

    if (targetLane !== sourceLane) {
        try {
            assertBlockFits(targetStartStep, currentBlock.length);
            assertBlockRangeAvailable(currentPattern, targetLane, targetStartStep, currentBlock.length);
        } catch {
            return {
                state: normalizedState,
                copiedLane: targetLane,
                copiedStartSteps: [],
            };
        }

        return {
            state: withEditedPattern(normalizedState, patternIndex, (pattern) => {
                const block = getBlockForStep(pattern, sourceLane, requestedStart);
                if (!block) {
                    throw new Error("Cannot copy a missing SeqFX block.");
                }

                writeBlockSteps(pattern, targetLane, targetStartStep, cloneBlockSteps(pattern, sourceLane, block));
            }),
            copiedLane: targetLane,
            copiedStartSteps: [targetStartStep],
        };
    }

    let copiedStartSteps: number[] = [];
    const nextState = withEditedPattern(normalizedState, patternIndex, (pattern) => {
        const block = getBlockForStep(pattern, sourceLane, requestedStart);

        if (!block) {
            throw new Error("Cannot copy a missing SeqFX block.");
        }

        if (targetStartStep === block.startStep) {
            return;
        }

        const direction = targetStartStep > block.startStep ? 1 : -1;
        const clonedSteps = cloneBlockSteps(pattern, sourceLane, block);

        for (
            let nextStartStep = block.startStep + direction;
            direction > 0 ? nextStartStep <= targetStartStep : nextStartStep >= targetStartStep;
            nextStartStep += direction
        ) {
            try {
                assertBlockFits(nextStartStep, block.length);
                assertBlockRangeAvailable(pattern, sourceLane, nextStartStep, block.length);
                writeBlockSteps(pattern, sourceLane, nextStartStep, clonedSteps);
                copiedStartSteps.push(nextStartStep);
            } catch {
                // Copy-paint skips occupied or out-of-range targets so dragging stays reversible and harmless.
            }
        }
    });

    if (copiedStartSteps.length === 0) {
        return {
            state: normalizedState,
            copiedLane: targetLane,
            copiedStartSteps,
        };
    }

    return {
        state: nextState,
        copiedLane: targetLane,
        copiedStartSteps,
    };
}

export function applySeqFxBlockDelete(state: SeqFxState, edit: SeqFxBlockDeleteEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const startStep = clampIndex(edit.startStep, SEQFX_STEP_COUNT, "startStep");
        const block = getBlockForStep(pattern, lane, startStep);
        if (!block) {
            return;
        }

        clearBlock(pattern, lane, block);
    });
}

export function applySeqFxBlockSelectionDelete(state: SeqFxState, edit: SeqFxBlockSelectionEditTarget): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const blocks = resolveBlockSelection(pattern, lane, edit.blockStartSteps);

        for (const block of blocks) {
            clearBlock(pattern, lane, block);
        }
    });
}

export function applySeqFxBlockSelectionMove(state: SeqFxState, edit: SeqFxBlockSelectionMoveEdit): SeqFxBlockSelectionMoveResult {
    const normalizedState = normalizeSeqFxState(state);
    const patternIndex = clampIndex(edit.patternIndex, SEQFX_PATTERN_COUNT, "patternIndex");
    const sourceLane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
    const targetLane = resolveTargetLane(sourceLane, edit.targetLane);
    const anchorStartStep = clampIndex(edit.anchorStartStep, SEQFX_STEP_COUNT, "anchorStartStep");
    const targetAnchorStartStep = clampIndex(edit.targetAnchorStartStep, SEQFX_STEP_COUNT, "targetAnchorStartStep");
    const currentPattern = normalizedState.patterns[patternIndex];
    const currentBlocks = resolveBlockSelection(currentPattern, sourceLane, edit.blockStartSteps);
    const currentAnchorBlock = getBlockForStep(currentPattern, sourceLane, anchorStartStep);

    if (!currentAnchorBlock || !currentBlocks.some((block) => block.startStep === currentAnchorBlock.startStep)) {
        throw new Error("SeqFX block selection move anchor must be one of the selected blocks.");
    }

    if (targetLane === sourceLane && targetAnchorStartStep === currentAnchorBlock.startStep) {
        return {
            state: normalizedState,
            movedLane: sourceLane,
            movedStartSteps: currentBlocks.map((block) => block.startStep),
        };
    }

    const delta = targetAnchorStartStep - currentAnchorBlock.startStep;
    let movedStartSteps: number[] = [];
    const nextState = withEditedPattern(normalizedState, patternIndex, (pattern) => {
        const blocks = resolveBlockSelection(pattern, sourceLane, edit.blockStartSteps);
        const anchorBlock = getBlockForStep(pattern, sourceLane, anchorStartStep);

        if (!anchorBlock || !blocks.some((block) => block.startStep === anchorBlock.startStep)) {
            throw new Error("SeqFX block selection move anchor must be one of the selected blocks.");
        }

        const clonedBlocks = blocks.map((block) => ({
            block,
            targetStartStep: block.startStep + delta,
            steps: cloneBlockSteps(pattern, sourceLane, block),
        }));

        for (const cloned of clonedBlocks) {
            assertBlockFits(cloned.targetStartStep, cloned.block.length);
            assertBlockRangeAvailable(
                pattern,
                targetLane,
                cloned.targetStartStep,
                cloned.block.length,
                targetLane === sourceLane ? blocks : null,
            );
        }

        for (const { block } of clonedBlocks) {
            clearBlock(pattern, sourceLane, block);
        }

        for (const cloned of clonedBlocks) {
            writeBlockSteps(pattern, targetLane, cloned.targetStartStep, cloned.steps);
            movedStartSteps.push(cloned.targetStartStep);
        }
    });

    return {
        state: nextState,
        movedLane: targetLane,
        movedStartSteps,
    };
}

export function applySeqFxBlockSelectionCopy(state: SeqFxState, edit: SeqFxBlockSelectionCopyEdit): SeqFxBlockSelectionCopyResult {
    const normalizedState = normalizeSeqFxState(state);
    const patternIndex = clampIndex(edit.patternIndex, SEQFX_PATTERN_COUNT, "patternIndex");
    const sourceLane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
    const targetLane = resolveTargetLane(sourceLane, edit.targetLane);
    const anchorStartStep = clampIndex(edit.anchorStartStep, SEQFX_STEP_COUNT, "anchorStartStep");
    const targetAnchorStartStep = clampIndex(edit.targetAnchorStartStep, SEQFX_STEP_COUNT, "targetAnchorStartStep");
    const currentPattern = normalizedState.patterns[patternIndex];
    const currentBlocks = resolveBlockSelection(currentPattern, sourceLane, edit.blockStartSteps);
    const currentAnchorBlock = getBlockForStep(currentPattern, sourceLane, anchorStartStep);

    if (!currentAnchorBlock || !currentBlocks.some((block) => block.startStep === currentAnchorBlock.startStep)) {
        throw new Error("SeqFX block selection copy anchor must be one of the selected blocks.");
    }

    if (targetLane === sourceLane && targetAnchorStartStep === currentAnchorBlock.startStep) {
        return {
            state: normalizedState,
            copiedLane: targetLane,
            copiedStartSteps: [],
        };
    }

    const delta = targetAnchorStartStep - currentAnchorBlock.startStep;
    const plannedBlocks = currentBlocks.map((block) => ({
        block,
        targetStartStep: block.startStep + delta,
    }));

    try {
        for (const planned of plannedBlocks) {
            assertBlockFits(planned.targetStartStep, planned.block.length);
            assertBlockRangeAvailable(currentPattern, targetLane, planned.targetStartStep, planned.block.length);
        }
    } catch {
        return {
            state: normalizedState,
            copiedLane: targetLane,
            copiedStartSteps: [],
        };
    }

    const copiedStartSteps: number[] = [];
    const nextState = withEditedPattern(normalizedState, patternIndex, (pattern) => {
        const blocks = resolveBlockSelection(pattern, sourceLane, edit.blockStartSteps);
        const anchorBlock = getBlockForStep(pattern, sourceLane, anchorStartStep);

        if (!anchorBlock || !blocks.some((block) => block.startStep === anchorBlock.startStep)) {
            throw new Error("SeqFX block selection copy anchor must be one of the selected blocks.");
        }

        for (const block of blocks) {
            const targetStartStep = block.startStep + delta;
            writeBlockSteps(pattern, targetLane, targetStartStep, cloneBlockSteps(pattern, sourceLane, block));
            copiedStartSteps.push(targetStartStep);
        }
    });

    return {
        state: nextState,
        copiedLane: targetLane,
        copiedStartSteps,
    };
}

export function applySeqFxBlockSelectionMixEdit(state: SeqFxState, edit: SeqFxBlockSelectionMixEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const mix = normalizeMix(edit.value);
        const blocks = resolveBlockSelection(pattern, lane, edit.blockStartSteps);

        for (const block of blocks) {
            for (let step = block.startStep; step <= block.endStep; step += 1) {
                pattern.lanes[lane].steps[step].mix = mix;
            }
        }
    });
}

export function applySeqFxBlockSelectionParamEdit(state: SeqFxState, edit: SeqFxBlockSelectionParamEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const paramIndex = clampIndex(edit.paramIndex, SEQFX_PARAM_COUNT, "paramIndex");
        const blocks = resolveBlockSelection(pattern, lane, edit.blockStartSteps);

        for (const block of blocks) {
            const value = normalizeParam(block.effectType, paramIndex, edit.value);
            for (let step = block.startStep; step <= block.endStep; step += 1) {
                const target = pattern.lanes[lane].steps[step];
                writeStepParamAndTrackAuxEnd(target, block.effectType, paramIndex, value);
                target.effectParams = rememberCurrentEffectParams(target);
                target.effectAux = rememberCurrentEffectAux(target);
            }
        }
    });
}

export function applySeqFxBlockMixEdit(state: SeqFxState, edit: SeqFxBlockMixEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const startStep = clampIndex(edit.startStep, SEQFX_STEP_COUNT, "startStep");
        const block = getBlockForStep(pattern, lane, startStep);
        if (!block) {
            throw new Error("Cannot edit mix for a missing SeqFX block.");
        }

        const mix = normalizeMix(edit.value);
        for (let step = block.startStep; step <= block.endStep; step += 1) {
            pattern.lanes[lane].steps[step].mix = mix;
        }
    });
}

export function applySeqFxBlockParamEdit(state: SeqFxState, edit: SeqFxBlockParamEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const startStep = clampIndex(edit.startStep, SEQFX_STEP_COUNT, "startStep");
        const paramIndex = clampIndex(edit.paramIndex, SEQFX_PARAM_COUNT, "paramIndex");
        const block = getBlockForStep(pattern, lane, startStep);
        if (!block) {
            throw new Error("Cannot edit parameter for a missing SeqFX block.");
        }

        const value = normalizeParam(block.effectType, paramIndex, edit.value);
        for (let step = block.startStep; step <= block.endStep; step += 1) {
            const target = pattern.lanes[lane].steps[step];
            writeStepParamAndTrackAuxEnd(target, block.effectType, paramIndex, value);
            target.effectParams = rememberCurrentEffectParams(target);
            target.effectAux = rememberCurrentEffectAux(target);
        }
    });
}

export function applySeqFxBlockAuxSourceEdit(state: SeqFxState, edit: SeqFxBlockAuxSourceEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const startStep = clampIndex(edit.startStep, SEQFX_STEP_COUNT, "startStep");
        const block = getBlockForStep(pattern, lane, startStep);
        if (!block) {
            throw new Error("Cannot edit aux source for a missing SeqFX block.");
        }

        for (let step = block.startStep; step <= block.endStep; step += 1) {
            const target = pattern.lanes[lane].steps[step];
            writeStepAuxSource(target, block.effectType, edit.source);
            target.effectAux = rememberCurrentEffectAux(target);
        }
    });
}

export function applySeqFxBlockAuxTargetToggle(state: SeqFxState, edit: SeqFxBlockAuxTargetToggleEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const startStep = clampIndex(edit.startStep, SEQFX_STEP_COUNT, "startStep");
        const paramIndex = clampIndex(edit.paramIndex, SEQFX_PARAM_COUNT, "paramIndex");
        const block = getBlockForStep(pattern, lane, startStep);
        if (!block) {
            throw new Error("Cannot toggle aux target for a missing SeqFX block.");
        }

        for (let step = block.startStep; step <= block.endStep; step += 1) {
            const target = pattern.lanes[lane].steps[step];
            const aux = normalizeAuxState(block.effectType, target.params, target.aux);
            writeStepAuxTargetEnabled(target, block.effectType, paramIndex, edit.enabled ?? !aux.targets[paramIndex].enabled);
            target.effectAux = rememberCurrentEffectAux(target);
        }
    });
}

export function applySeqFxBlockAuxTargetEndEdit(state: SeqFxState, edit: SeqFxBlockAuxTargetEndEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const startStep = clampIndex(edit.startStep, SEQFX_STEP_COUNT, "startStep");
        const paramIndex = clampIndex(edit.paramIndex, SEQFX_PARAM_COUNT, "paramIndex");
        const block = getBlockForStep(pattern, lane, startStep);
        if (!block) {
            throw new Error("Cannot edit aux target end for a missing SeqFX block.");
        }

        for (let step = block.startStep; step <= block.endStep; step += 1) {
            const target = pattern.lanes[lane].steps[step];
            writeStepAuxTargetEnd(target, block.effectType, paramIndex, edit.value);
            target.effectAux = rememberCurrentEffectAux(target);
        }
    });
}

export function applySeqFxBlockSelectionAuxTargetEndEdit(
    state: SeqFxState,
    edit: SeqFxBlockSelectionAuxTargetEndEdit,
): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const paramIndex = clampIndex(edit.paramIndex, SEQFX_PARAM_COUNT, "paramIndex");
        const blocks = resolveBlockSelection(pattern, lane, edit.blockStartSteps);

        for (const block of blocks) {
            for (let step = block.startStep; step <= block.endStep; step += 1) {
                const target = pattern.lanes[lane].steps[step];
                writeStepAuxTargetEnd(target, block.effectType, paramIndex, edit.value);
                target.effectAux = rememberCurrentEffectAux(target);
            }
        }
    });
}

export function applySeqFxBlockSelectionAuxTargetToggle(
    state: SeqFxState,
    edit: SeqFxBlockSelectionAuxTargetToggleEdit,
): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const paramIndex = clampIndex(edit.paramIndex, SEQFX_PARAM_COUNT, "paramIndex");
        const blocks = resolveBlockSelection(pattern, lane, edit.blockStartSteps);

        for (const block of blocks) {
            for (let step = block.startStep; step <= block.endStep; step += 1) {
                const target = pattern.lanes[lane].steps[step];
                const aux = normalizeAuxState(block.effectType, target.params, target.aux);
                writeStepAuxTargetEnabled(target, block.effectType, paramIndex, edit.enabled ?? !aux.targets[paramIndex].enabled);
                target.effectAux = rememberCurrentEffectAux(target);
            }
        }
    });
}

export function applySeqFxBlockEffectEdit(state: SeqFxState, edit: SeqFxBlockEffectEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const startStep = clampIndex(edit.startStep, SEQFX_STEP_COUNT, "startStep");
        const effectType = normalizeEffectType(edit.effectType, defaultEffectTypeForLane(lane));
        if (effectType === SEQFX_EFFECT_TYPES.empty) {
            throw new Error("SeqFX block effect must not be empty.");
        }

        const block = getBlockForStep(pattern, lane, startStep);
        if (!block) {
            throw new Error("Cannot edit effect for a missing SeqFX block.");
        }

        for (let step = block.startStep; step <= block.endStep; step += 1) {
            const target = pattern.lanes[lane].steps[step];
            const effectParams = rememberCurrentEffectParams(target);
            const effectAux = rememberCurrentEffectAux(target);
            target.effectParams = effectParams;
            target.effectAux = effectAux;
            target.effectType = effectType;
            target.trigger = step === block.startStep;
            target.params = rememberedParamsForEffect(target, effectType);
            target.aux = rememberedAuxForEffect(target, effectType, target.params);
            target.effectParams = rememberCurrentEffectParams(target);
            target.effectAux = rememberCurrentEffectAux(target);
        }
    });
}

export function applySeqFxCellToggle(state: SeqFxState, edit: SeqFxCellToggleEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const step = clampIndex(edit.step, SEQFX_STEP_COUNT, "step");
        const target = pattern.lanes[lane].steps[step];
        const active = edit.active ?? !target.active;

        if (active) {
            if (target.active) {
                return;
            }

            assertBlockRangeAvailable(pattern, lane, step, 1);
            writeBlock(pattern, lane, step, 1, createDefaultStep(lane));
            return;
        }

        const block = getBlockForStep(pattern, lane, step);
        if (block) {
            clearBlock(pattern, lane, block);
        }
    });
}

export function applySeqFxMixEdit(state: SeqFxState, edit: SeqFxMixEdit): SeqFxState {
    const steps = normalizeSteps(edit.steps);

    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const mix = normalizeMix(edit.value);

        for (const step of steps) {
            pattern.lanes[lane].steps[step].mix = mix;
        }
    });
}

export function applySeqFxParamEdit(state: SeqFxState, edit: SeqFxParamEdit): SeqFxState {
    const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
    const paramIndex = clampIndex(edit.paramIndex, SEQFX_PARAM_COUNT, "paramIndex");
    const steps = normalizeSteps(edit.steps);
    const normalizedState = normalizeSeqFxState(state);
    const patternIndex = clampIndex(edit.patternIndex, SEQFX_PATTERN_COUNT, "patternIndex");
    const firstStep = normalizedState.patterns[patternIndex].lanes[lane].steps[steps[0]];
    const editEffectType = firstStep.active && firstStep.effectType !== SEQFX_EFFECT_TYPES.empty
        ? firstStep.effectType
        : defaultEffectTypeForLane(lane);
    const triggerLatched = isSeqFxTriggerLatchedParamForEffect(editEffectType, paramIndex);

    if (triggerLatched && steps.length > 1) {
        throw new Error("Trigger-latched SeqFX parameters can only be edited on one selected cell.");
    }

    return withEditedPattern(normalizedState, edit.patternIndex, (pattern) => {
        for (const step of steps) {
            const target = pattern.lanes[lane].steps[step];
            const effectType = target.active && target.effectType !== SEQFX_EFFECT_TYPES.empty
                ? target.effectType
                : defaultEffectTypeForLane(lane);
            const value = normalizeParam(effectType, paramIndex, edit.value);
            if (!target.active && triggerLatched) {
                target.effectType = effectType;
                target.params = defaultParamsForEffect(effectType);
                target.aux = defaultAuxForParams(target.params, effectType);
            }
            writeStepParamAndTrackAuxEnd(target, effectType, paramIndex, value);
            if (triggerLatched) {
                target.active = true;
                target.trigger = true;
            }
            target.effectParams = rememberCurrentEffectParams(target);
            target.effectAux = rememberCurrentEffectAux(target);
        }
    });
}

export function getSeqFxStepValueSnapshot(state: SeqFxState, target: SeqFxStepValueSnapshotTarget): SeqFxStepValueSnapshot {
    const normalized = normalizeSeqFxState(state);
    const patternIndex = clampIndex(target.patternIndex, SEQFX_PATTERN_COUNT, "patternIndex");
    const lane = clampIndex(target.lane, SEQFX_LANE_COUNT, "lane");
    const step = clampIndex(target.step, SEQFX_STEP_COUNT, "step");
    const source = normalized.patterns[patternIndex].lanes[lane].steps[step];

    return {
        lane,
        effectType: source.effectType,
        mix: normalizeMix(source.mix),
        params: Array.from({ length: SEQFX_PARAM_COUNT }, (_unused, paramIndex) => (
            normalizeParam(source.effectType === SEQFX_EFFECT_TYPES.empty ? defaultEffectTypeForLane(lane) : source.effectType, paramIndex, source.params[paramIndex])
        )),
        aux: cloneAuxState(source.aux),
        effectParams: cloneEffectParamMemory(source.effectParams),
        effectAux: cloneEffectAuxMemory(source.effectAux),
    };
}

export function applySeqFxStepValuePaste(state: SeqFxState, edit: SeqFxStepValuePasteEdit): SeqFxState {
    const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
    const steps = normalizeSteps(edit.steps);

    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const effectType = edit.values.effectType === SEQFX_EFFECT_TYPES.empty
            ? defaultEffectTypeForLane(lane)
            : normalizeEffectType(edit.values.effectType, defaultEffectTypeForLane(lane));
        const mix = normalizeMix(edit.values.mix);
        const params = Array.from({ length: SEQFX_PARAM_COUNT }, (_unused, paramIndex) => (
            normalizeParam(effectType, paramIndex, edit.values.params[paramIndex])
        ));
        const aux = normalizeAuxState(effectType, params, edit.values.aux);
        const effectParams = cloneEffectParamMemory(edit.values.effectParams);
        const effectAux = cloneEffectAuxMemory(edit.values.effectAux);

        for (const step of steps) {
            const target = pattern.lanes[lane].steps[step];
            target.mix = mix;
            target.effectType = target.active ? effectType : SEQFX_EFFECT_TYPES.empty;
            target.params = [...params];
            target.effectParams = target.active ? cloneEffectParamMemory(effectParams) : undefined;
            target.aux = target.active
                ? cloneAuxState(aux)
                : defaultAuxForParams(defaultParamsForEffect(defaultEffectTypeForLane(lane)), defaultEffectTypeForLane(lane));
            target.effectAux = target.active ? cloneEffectAuxMemory(effectAux) : undefined;
        }
    });
}

export function buildSeqPatternUpload(
    state: SeqFxState,
    options: { patternIndex: number; authoritative: boolean },
): SeqPatternUpload {
    const normalized = normalizeSeqFxState(state);
    const patternIndex = clampIndex(options.patternIndex, SEQFX_PATTERN_COUNT, "patternIndex");
    const pattern = normalized.patterns[patternIndex];

    return {
        patternIndex,
        revision: pattern.revision,
        authoritative: options.authoritative,
        activeSteps: pattern.lanes.map((lane) => lane.steps.map((step) => step.active)),
        triggerSteps: pattern.lanes.map((lane) => lane.steps.map((step) => step.trigger)),
        effectTypes: pattern.lanes.map((lane) => lane.steps.map((step) => step.active ? step.effectType : SEQFX_EFFECT_TYPES.empty)),
        mix: pattern.lanes.map((lane) => lane.steps.map((step) => step.mix)),
        params: pattern.lanes.map((lane) => lane.steps.map((step) => [...step.params])),
        auxEnabled: pattern.lanes.map((lane) => lane.steps.map((step) => (
            Array.from({ length: SEQFX_PARAM_COUNT }, (_unused, paramIndex) => (
                step.active && step.aux.targets[paramIndex]?.enabled === true
            ))
        ))),
        auxEnd: pattern.lanes.map((lane, laneIndex) => lane.steps.map((step) => {
            const effectType = step.active && step.effectType !== SEQFX_EFFECT_TYPES.empty
                ? step.effectType
                : defaultEffectTypeForLane(laneIndex);
            return Array.from({ length: SEQFX_PARAM_COUNT }, (_unused, paramIndex) => (
                normalizeParam(effectType, paramIndex, step.aux.targets[paramIndex]?.end ?? step.params[paramIndex] ?? 0)
            ));
        })),
        auxShape: pattern.lanes.map((lane) => lane.steps.map((step) => (
            step.active ? normalizeAuxSource(step.aux.source).shape : SEQFX_AUX_SOURCE_DEFAULT.shape
        ))),
        auxSourceCurve: pattern.lanes.map((lane) => lane.steps.map((step) => (
            step.active ? normalizeAuxSource(step.aux.source).sourceCurve : SEQFX_AUX_SOURCE_DEFAULT.sourceCurve
        ))),
        auxRateMode: pattern.lanes.map((lane) => lane.steps.map((step) => (
            step.active ? seqFxAuxRateModeToUploadValue(normalizeAuxSource(step.aux.source).rateMode) : SEQFX_AUX_RATE_MODE_UPLOAD_VALUES.slice
        ))),
        auxTempoMultiplier: pattern.lanes.map((lane) => lane.steps.map((step) => (
            step.active ? normalizeAuxSource(step.aux.source).tempoMultiplier : SEQFX_AUX_SOURCE_DEFAULT.tempoMultiplier
        ))),
        auxTempoTriplet: pattern.lanes.map((lane) => lane.steps.map((step) => (
            step.active ? normalizeAuxSource(step.aux.source).tempoTriplet : SEQFX_AUX_SOURCE_DEFAULT.tempoTriplet
        ))),
        auxSliceCount: pattern.lanes.map((lane) => lane.steps.map((step) => (
            step.active ? normalizeAuxSource(step.aux.source).sliceCount : SEQFX_AUX_SOURCE_DEFAULT.sliceCount
        ))),
    };
}
