export const SEQFX_STATE_KEY = "seqfx.v1";
export const SEQFX_STEP_COUNT = 32;
export const SEQFX_LANE_COUNT = 4;
export const SEQFX_PATTERN_COUNT = 12;
export const SEQFX_PARAM_COUNT = 8;

export const SEQFX_LANES = {
    filter: 0,
    crusher: 1,
    tapeStop: 2,
    stutter: 3,
} as const;

export const SEQFX_LANE_NAMES = [
    "Filter",
    "Crusher",
    "Tape Stop",
    "Stutter",
] as const;

export type SeqFxLaneIndex = typeof SEQFX_LANES[keyof typeof SEQFX_LANES];

export type SeqFxStep = {
    active: boolean;
    trigger: boolean;
    mix: number;
    params: number[];
};

export type SeqFxLane = {
    steps: SeqFxStep[];
};

export type SeqFxPattern = {
    revision: number;
    lanes: SeqFxLane[];
};

export type SeqFxState = {
    version: 1;
    patterns: SeqFxPattern[];
};

export type SeqPatternUpload = {
    patternIndex: number;
    revision: number;
    authoritative: boolean;
    activeSteps: boolean[][];
    triggerSteps: boolean[][];
    mix: number[][];
    params: number[][][];
};

export type SeqFxEditTarget = {
    patternIndex: number;
    lane: number;
    steps: number[];
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

const DEFAULT_LANE_PARAMS: number[][] = [
    [0, 2_000, 500, 0.707, 1, 0, 0, 0],
    [8, 1, 0, 0, 0, 0, 0, 0],
    [1, 1, 0, 30, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0, 0, 0],
];

const PARAM_LIMITS: Array<Array<[number, number]>> = [
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
        [0, 1],
        [1, 250],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
    ],
    [
        [0, 5],
        [0.5, 2],
        [0, 1],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
    ],
];

const INTEGER_PARAMS = new Set([
    `${SEQFX_LANES.filter}:0`,
    `${SEQFX_LANES.crusher}:0`,
    `${SEQFX_LANES.crusher}:1`,
    `${SEQFX_LANES.tapeStop}:2`,
    `${SEQFX_LANES.stutter}:0`,
    `${SEQFX_LANES.stutter}:2`,
]);

const TRIGGER_LATCHED_PARAMS = new Set([
    `${SEQFX_LANES.tapeStop}:0`,
    `${SEQFX_LANES.stutter}:0`,
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

function normalizeParam(lane: number, paramIndex: number, value: number): number {
    const limits = PARAM_LIMITS[lane]?.[paramIndex] ?? [0, 0];
    const clamped = clamp(Number(value), limits[0], limits[1]);

    if (INTEGER_PARAMS.has(`${lane}:${paramIndex}`)) {
        return Math.round(clamped);
    }

    return clamped;
}

function normalizeMix(value: number): number {
    return clamp(Number(value), 0, 1);
}

export function isSeqFxTriggerLatchedParam(lane: number, paramIndex: number): boolean {
    return TRIGGER_LATCHED_PARAMS.has(`${lane}:${paramIndex}`);
}

function createDefaultStep(lane: number): SeqFxStep {
    return {
        active: false,
        trigger: false,
        mix: 1,
        params: [...(DEFAULT_LANE_PARAMS[lane] ?? new Array(SEQFX_PARAM_COUNT).fill(0))],
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
        version: 1,
        patterns: Array.from({ length: SEQFX_PATTERN_COUNT }, () => createDefaultPattern()),
    };
}

function cloneState(state: SeqFxState): SeqFxState {
    return {
        version: 1,
        patterns: state.patterns.map((pattern) => ({
            revision: pattern.revision,
            lanes: pattern.lanes.map((lane) => ({
                steps: lane.steps.map((step) => ({
                    active: step.active,
                    trigger: step.trigger,
                    mix: step.mix,
                    params: [...step.params],
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

    return {
        active: step.active === true,
        trigger: step.trigger === true,
        mix: normalizeMix(Number(step.mix ?? fallback.mix)),
        params: Array.from({ length: SEQFX_PARAM_COUNT }, (_unused, paramIndex) => (
            normalizeParam(lane, paramIndex, Number(rawParams[paramIndex] ?? fallback.params[paramIndex]))
        )),
    };
}

function normalizePattern(candidate: unknown): SeqFxPattern {
    const pattern = candidate && typeof candidate === "object"
        ? candidate as Partial<SeqFxPattern>
        : {};
    const rawLanes = Array.isArray(pattern.lanes) ? pattern.lanes : [];

    return {
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
    };
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
        version: 1,
        patterns: Array.from({ length: SEQFX_PATTERN_COUNT }, (_unused, pattern) => (
            normalizePattern(rawPatterns[pattern])
        )),
    };
}

export function serializeSeqFxState(state: SeqFxState): string {
    return JSON.stringify(normalizeSeqFxState(state));
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

export function applySeqFxCellToggle(state: SeqFxState, edit: SeqFxCellToggleEdit): SeqFxState {
    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const lane = clampIndex(edit.lane, SEQFX_LANE_COUNT, "lane");
        const step = clampIndex(edit.step, SEQFX_STEP_COUNT, "step");
        const target = pattern.lanes[lane].steps[step];
        const active = edit.active ?? !target.active;
        target.active = active;
        target.trigger = active ? true : false;
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
    const triggerLatched = isSeqFxTriggerLatchedParam(lane, paramIndex);

    if (triggerLatched && steps.length > 1) {
        throw new Error("Trigger-latched SeqFX parameters can only be edited on one selected cell.");
    }

    return withEditedPattern(state, edit.patternIndex, (pattern) => {
        const value = normalizeParam(lane, paramIndex, edit.value);

        for (const step of steps) {
            const target = pattern.lanes[lane].steps[step];
            target.params[paramIndex] = value;
            if (triggerLatched) {
                target.active = true;
                target.trigger = true;
            }
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
        mix: pattern.lanes.map((lane) => lane.steps.map((step) => step.mix)),
        params: pattern.lanes.map((lane) => lane.steps.map((step) => [...step.params])),
    };
}
