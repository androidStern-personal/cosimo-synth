import type { PatchConnectionLike } from "./cmajor-react";
import {
    allRackParameterDescriptors,
    type RackParameterDescriptor,
} from "./rack-parameter-descriptors";
import {
    MSEG_DEFAULT_DEPTH,
    MSEG_RATE_MAX_SECONDS,
    addMsegPoint,
    clamp01,
    clampMsegRateSeconds,
    createDefaultMsegPlayback,
    createDefaultMsegShape,
    deleteMsegPoint,
    msegShapesEqual,
    moveMsegPoint,
    normalizeMsegPlayback,
    normalizeMsegShape,
    renderMsegShape,
    setMsegSegmentCurvePower,
    type MsegPlayback,
    type MsegShape,
    type MsegState,
} from "./mseg";
import {
    MODULATION_SOURCE_IDENTITIES,
    MODULATION_TARGET_IDENTITIES,
    getVoiceModulationParameterKind,
    parseModulationTargetKind as parseCanonicalModulationTargetKind,
    type ModulationSourceId,
    type ModulationSourceKind,
    type ModulationTargetKind,
    type RackModulationTargetKind,
    type VoiceModulationTargetKind,
} from "./modulation-targets";
import { buildModulationRuntimeProgramEvents } from "./modulation-runtime-program";
import { err, ok, type Result } from "./result";
import { getModulationTargetDisplayLabel } from "./target-descriptor";

/** Persisted-state key for the hard-forked modulation contract. */
export const MODULATION_STATE_KEY = "modulation.v6";
/** Current strict persisted modulation envelope version. */
export const MODULATION_STATE_VERSION = 6;
export const MODULATION_MSEG_SLOT_COUNT = 3;
export const MODULATION_ENV_SLOT_COUNT = 3;
export const MODULATION_MSEG_BUFFER_ENDPOINT_ID = "modulationMsegBuffer";
export const MODULATION_MSEG_PLAYBACK_ENDPOINT_ID = "modulationMsegPlayback";
export const MODULATION_MACRO_SLOT_COUNT = 4;

const MSEG_SLOT_NAMES = ["MSEG 1", "MSEG 2", "MSEG 3"] as const;
const MACRO_SLOT_NAMES = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"] as const;
const ENV_SLOT_NAMES = ["Env 1", "Env 2", "Env 3"] as const;
const ENV_MIN_SECONDS = 0.001;
const ENV_MAX_SECONDS = 10.0;
const FILTER_Q_MIN = 0.1;
const FILTER_Q_MAX = 20.0;
const ROUTE_AMOUNT_LIMITS = {
    wavetablePosition: { min: -1.0, max: 1.0 },
    warpAmount: { min: -1.0, max: 1.0 },
    filterCutoffOctaves: { min: -6.0, max: 6.0 },
    filterQ: { min: -(FILTER_Q_MAX - FILTER_Q_MIN), max: FILTER_Q_MAX - FILTER_Q_MIN },
    pitchSemitones: { min: -48.0, max: 48.0 },
    // Additive dB offset over the full parameter span; the engine clamps base + offset.
    ampGainDb: { min: -54.0, max: 54.0 },
    pan: { min: -1.0, max: 1.0 },
    unisonDetune: { min: -1.0, max: 1.0 },
    unisonBlend: { min: -1.0, max: 1.0 },
    unisonWidth: { min: -1.0, max: 1.0 },
    unisonWavetablePositionSpread: { min: -1.0, max: 1.0 },
    unisonWarpSpread: { min: -1.0, max: 1.0 },
    mseg1Morph: { min: -1.0, max: 1.0 },
    mseg2Morph: { min: -1.0, max: 1.0 },
    mseg3Morph: { min: -1.0, max: 1.0 },
    mseg1Rate: { min: -MSEG_RATE_MAX_SECONDS, max: MSEG_RATE_MAX_SECONDS },
    mseg2Rate: { min: -MSEG_RATE_MAX_SECONDS, max: MSEG_RATE_MAX_SECONDS },
    mseg3Rate: { min: -MSEG_RATE_MAX_SECONDS, max: MSEG_RATE_MAX_SECONDS },
    env1Attack: { min: -ENV_MAX_SECONDS, max: ENV_MAX_SECONDS },
    env1Decay: { min: -ENV_MAX_SECONDS, max: ENV_MAX_SECONDS },
    env1Sustain: { min: -1.0, max: 1.0 },
    env1Release: { min: -ENV_MAX_SECONDS, max: ENV_MAX_SECONDS },
    env2Attack: { min: -ENV_MAX_SECONDS, max: ENV_MAX_SECONDS },
    env2Decay: { min: -ENV_MAX_SECONDS, max: ENV_MAX_SECONDS },
    env2Sustain: { min: -1.0, max: 1.0 },
    env2Release: { min: -ENV_MAX_SECONDS, max: ENV_MAX_SECONDS },
    env3Attack: { min: -ENV_MAX_SECONDS, max: ENV_MAX_SECONDS },
    env3Decay: { min: -ENV_MAX_SECONDS, max: ENV_MAX_SECONDS },
    env3Sustain: { min: -1.0, max: 1.0 },
    env3Release: { min: -ENV_MAX_SECONDS, max: ENV_MAX_SECONDS },
} as const;
const ROUTE_AMOUNT_STEPS = {
    wavetablePosition: 0.001,
    warpAmount: 0.001,
    filterCutoffOctaves: 0.001,
    filterQ: 0.001,
    pitchSemitones: 0.01,
    ampGainDb: 0.1,
    pan: 0.001,
    unisonDetune: 0.001,
    unisonBlend: 0.001,
    unisonWidth: 0.001,
    unisonWavetablePositionSpread: 0.001,
    unisonWarpSpread: 0.001,
    mseg1Morph: 0.001,
    mseg2Morph: 0.001,
    mseg3Morph: 0.001,
    mseg1Rate: 0.001,
    mseg2Rate: 0.001,
    mseg3Rate: 0.001,
    env1Attack: 0.001,
    env1Decay: 0.001,
    env1Sustain: 0.001,
    env1Release: 0.001,
    env2Attack: 0.001,
    env2Decay: 0.001,
    env2Sustain: 0.001,
    env2Release: 0.001,
    env3Attack: 0.001,
    env3Decay: 0.001,
    env3Sustain: 0.001,
    env3Release: 0.001,
} as const;

const RACK_MODULATION_PARAMETERS = allRackParameterDescriptors()
    .filter((parameter) => parameter.modulationTargetIndex !== null);
const RACK_MODULATION_PARAMETER_BY_KIND = new Map<RackModulationTargetKind, RackParameterDescriptor>(
    RACK_MODULATION_PARAMETERS.map((parameter) => [`rack.${parameter.endpointID}`, parameter]),
);

export type {
    ModulationSourceKind,
    ModulationTargetKind,
    RackModulationTargetKind,
    VoiceModulationTargetKind,
} from "./modulation-targets";
export type ModulationPolarity = "unipolar" | "bipolar";
export type ModulationReducer = "max" | "mean";

export type ModulationSourceOption = {
    value: ModulationSourceId;
    label: string;
    sourceKind: ModulationSourceKind;
    sourceSlot: number | null;
};

export type ModulationTargetOption = {
    value: ModulationTargetKind;
    label: string;
};

export type ModulationMsegSlot = {
    shapeA: MsegShape;
    shapeB: MsegShape;
    playback: Omit<MsegPlayback, "rate">;
};

/** Display/runtime view assembled from the envelope name plus host parameters. */
export type ModulationEnvelope = {
    name: string;
    attackSeconds: number;
    decaySeconds: number;
    sustain: number;
    releaseSeconds: number;
};

/** The modulation document owns envelope identity only; ADSR values are host parameters. */
export type ModulationEnvelopeSlot = Pick<ModulationEnvelope, "name">;

export type ModulationRoute = {
    id: string;
    enabled: boolean;
    sourceKind: ModulationSourceKind;
    sourceSlot: number | null;
    polarity: ModulationPolarity;
    targetKind: ModulationTargetKind;
    amount: number;
    reducer: ModulationReducer;
};

/** User-selected mapping identity plus optional settings for a route ID assigned by the runtime bridge. */
export type GeneratedModulationRouteInput = Pick<
    ModulationRoute,
    "sourceKind" | "sourceSlot" | "targetKind"
> & Partial<Pick<ModulationRoute, "enabled" | "polarity" | "amount" | "reducer">>;

/** Structural route edits only. Live amounts must use the route-specific canonical binding. */
export type ModulationRouteUpdate = Partial<Omit<ModulationRoute, "id" | "amount">>;

export type ModulationState = {
    format: "cosimo.modulation";
    version: 6;
    msegSlots: ModulationMsegSlot[];
    envelopeSlots: ModulationEnvelopeSlot[];
    routes: ModulationRoute[];
    /** Renameable macro display names (ADR-010); macro VALUES are host parameters. */
    macroNames: string[];
};

export type ModulationStateChangeKind = "general" | "routeAmount";

type ModulationRouteAmountListener = (amount: number | null) => void;

/** Expected boundary failure for a non-current modulation document. */
export class ModulationStateParseError extends Error {
    override readonly name = "ModulationStateParseError";
}

export type ModulationMsegBufferUpload = {
    slot: number;
    shapeIndex: number;
    buffer: number[];
};

export type ModulationMsegPlaybackUpload = {
    slot: number;
    holdFinalValue: boolean;
    rateKind: number;
    loopEnabled: boolean;
    loopStart: number;
    loopEnd: number;
    noteOffPolicy: number;
    legatoRestarts: boolean;
};

export type ModulationRuntimeEvent = {
    endpointID: string;
    value: unknown;
};

const MODULATION_SOURCE_LABELS: Readonly<Record<ModulationSourceId, string>> = {
    "mseg-1": "MSEG 1",
    "mseg-2": "MSEG 2",
    "mseg-3": "MSEG 3",
    "env-1": "ENV 1",
    "env-2": "ENV 2",
    "env-3": "ENV 3",
    velocity: "VEL",
    pressure: "AT",
    slide: "SLIDE",
    "macro-1": "MACRO 1",
    "macro-2": "MACRO 2",
    "macro-3": "MACRO 3",
    "macro-4": "MACRO 4",
};

export const MODULATION_SOURCE_OPTIONS: ModulationSourceOption[] = MODULATION_SOURCE_IDENTITIES.map((identity) => ({
    value: identity.id,
    label: MODULATION_SOURCE_LABELS[identity.id],
    sourceKind: identity.sourceKind,
    sourceSlot: identity.sourceSlot,
}));

export const MODULATION_TARGET_OPTIONS: ModulationTargetOption[] = MODULATION_TARGET_IDENTITIES.map((identity) => ({
    value: identity.kind,
    label: getModulationTargetDisplayLabel(identity.kind),
}));

type StoredStateMessage = {
    key?: unknown;
    value?: unknown;
};

let generatedRouteIdCounter = 1;

function hasOwnValue(record: Record<string, unknown>, key: string) {
    return Object.prototype.hasOwnProperty.call(record, key);
}

function readFullStoredStateValue(storedState: unknown, key: string) {
    const fullState = storedState && typeof storedState === "object"
        ? storedState as Record<string, unknown>
        : {};
    const values = fullState.values && typeof fullState.values === "object"
        ? fullState.values as Record<string, unknown>
        : {};

    if (hasOwnValue(values, key)) {
        return values[key];
    }

    if (hasOwnValue(fullState, key)) {
        return fullState[key];
    }

    return undefined;
}

export type MsegEditorControllerLike = {
    getState: () => MsegState;
    setShape: (nextShape: unknown) => void;
    setEditShapeIndex?: (shapeIndex: number) => void;
    setPlayback: (nextPlayback: unknown) => void;
    addPoint: (x: number, y: number) => void;
    movePoint: (pointIndex: number, x: number, y: number) => void;
    deletePoint: (pointIndex: number) => void;
    setSegmentCurvePower: (segmentIndex: number, curvePower: number) => void;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function clampEnvSeconds(value: number, fallback: number) {
    const numeric = Number(value);
    return clamp(Number.isFinite(numeric) ? numeric : fallback, ENV_MIN_SECONDS, ENV_MAX_SECONDS);
}

function formatMagnitude(value: number, digits: number) {
    const numeric = Number.isFinite(value) ? value : 0;
    return Math.abs(numeric).toFixed(digits);
}

function formatSignedNumeric(value: number, digits: number) {
    const numeric = Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
    if (Math.abs(numeric) <= 1e-9) {
        return "0";
    }

    return String(numeric);
}

export function isRackModulationTarget(targetKind: ModulationTargetKind): targetKind is RackModulationTargetKind {
    return RACK_MODULATION_PARAMETER_BY_KIND.has(targetKind as RackModulationTargetKind);
}

export function isVoiceModulationSource(sourceKind: ModulationSourceKind) {
    return sourceKind !== "macro";
}

function getRackRouteAmountLimit(descriptor: RackParameterDescriptor) {
    if (descriptor.modulationApplication === "octaves") {
        return { min: -6, max: 6 };
    }
    const span = descriptor.max - descriptor.min;
    return { min: -span, max: span };
}

function getRouteAmountLimit(targetKind: ModulationTargetKind) {
    const rackParameter = RACK_MODULATION_PARAMETER_BY_KIND.get(targetKind as RackModulationTargetKind);
    if (rackParameter !== undefined) {
        return getRackRouteAmountLimit(rackParameter);
    }
    return ROUTE_AMOUNT_LIMITS[getVoiceModulationParameterKind(targetKind as VoiceModulationTargetKind)];
}

function getRouteAmountStep(targetKind: ModulationTargetKind) {
    const rackParameter = RACK_MODULATION_PARAMETER_BY_KIND.get(targetKind as RackModulationTargetKind);
    if (rackParameter !== undefined) {
        return rackParameter.modulationApplication === "octaves" ? 0.01 : (rackParameter.max - rackParameter.min) / 1000;
    }
    return ROUTE_AMOUNT_STEPS[getVoiceModulationParameterKind(targetKind as VoiceModulationTargetKind)];
}

function getRouteAmountMagnitudeLimit(targetKind: ModulationTargetKind) {
    const limits = getRouteAmountLimit(targetKind);
    return Math.max(Math.abs(limits.min), Math.abs(limits.max));
}

function getRouteAmountSideLimit(targetKind: ModulationTargetKind, amount: number) {
    const limits = getRouteAmountLimit(targetKind);

    if (amount < 0) {
        return Math.abs(limits.min);
    }

    if (amount > 0) {
        return Math.abs(limits.max);
    }

    return getRouteAmountMagnitudeLimit(targetKind);
}

function createGeneratedRouteId() {
    const routeId = `mod-route-auto-${generatedRouteIdCounter}`;
    generatedRouteIdCounter += 1;
    return routeId;
}

function createAvailableGeneratedRouteId(routes: ReadonlyArray<Pick<ModulationRoute, "id">>) {
    const usedRouteIds = new Set(routes.map((route) => route.id));
    let routeId = createGeneratedRouteId();

    while (usedRouteIds.has(routeId)) {
        routeId = createGeneratedRouteId();
    }

    return routeId;
}

function normalizeRouteId(value: unknown, routeIndex: number) {
    if (typeof value === "string" && value.trim()) {
        return value;
    }

    return `mod-route-${routeIndex + 1}`;
}

function normalizePolarity(value: unknown): ModulationPolarity {
    return value === "bipolar" ? "bipolar" : "unipolar";
}

export function getModulationAmountBounds(targetKind: ModulationTargetKind) {
    const limits = getRouteAmountLimit(targetKind);

    return {
        min: limits.min,
        max: limits.max,
        step: getRouteAmountStep(targetKind),
    };
}

export function clampModulationRouteAmount(targetKind: ModulationTargetKind, value: number) {
    const limits = getRouteAmountLimit(targetKind);
    const numeric = Number(value);
    return clamp(Number.isFinite(numeric) ? numeric : 0.0, limits.min, limits.max);
}

export function getModulationAmountDepth(targetKind: ModulationTargetKind, amount: number) {
    const clampedAmount = clampModulationRouteAmount(targetKind, amount);
    const limit = getRouteAmountSideLimit(targetKind, clampedAmount);

    if (limit <= 0) {
        return 0;
    }

    return clamp(Math.abs(clampedAmount) / limit, 0, 1);
}

export function composeModulationAmount(targetKind: ModulationTargetKind, depth: number) {
    const limits = getRouteAmountLimit(targetKind);
    const clampedDepth = clamp(Number.isFinite(depth) ? depth : 0, 0, 1);

    if (Math.abs(clampedDepth - 0.5) <= 1e-9) {
        return 0;
    }

    if (clampedDepth <= 0.5) {
        if (Math.abs(limits.min) <= 1e-9) {
            return 0;
        }

        const negativeRatio = 1 - (clampedDepth / 0.5);
        return clampModulationRouteAmount(targetKind, limits.min * negativeRatio);
    }

    if (Math.abs(limits.max) <= 1e-9) {
        return 0;
    }

    const positiveRatio = (clampedDepth - 0.5) / 0.5;
    return clampModulationRouteAmount(targetKind, limits.max * positiveRatio);
}

export function getModulationAmountSliderPosition(targetKind: ModulationTargetKind, amount: number) {
    const limits = getRouteAmountLimit(targetKind);
    const clampedAmount = clampModulationRouteAmount(targetKind, amount);

    if (Math.abs(clampedAmount) <= 1e-9) {
        return 0.5;
    }

    if (clampedAmount < 0) {
        if (Math.abs(limits.min) <= 1e-9) {
            return 0.5;
        }

        return clamp(0.5 * (1 - (Math.abs(clampedAmount) / Math.abs(limits.min))), 0, 0.5);
    }

    if (Math.abs(limits.max) <= 1e-9) {
        return 0.5;
    }

    return clamp(0.5 + (0.5 * (clampedAmount / limits.max)), 0.5, 1);
}

export function formatModulationAmountReadout(
    targetKind: ModulationTargetKind,
    amount: number,
    polarity: ModulationPolarity = "unipolar",
) {
    const clampedAmount = clampModulationRouteAmount(targetKind, amount);
    const prefix = polarity === "bipolar"
        ? (Math.abs(clampedAmount) <= 1e-9 ? "" : "±")
        : (clampedAmount > 0 ? "+" : clampedAmount < 0 ? "-" : "");
    const rackParameter = RACK_MODULATION_PARAMETER_BY_KIND.get(targetKind as RackModulationTargetKind);
    if (rackParameter !== undefined) {
        if (rackParameter.modulationApplication === "octaves") {
            return `${prefix}${formatMagnitude(clampedAmount, 2)} oct`;
        }
        if (rackParameter.unit === "" && rackParameter.max - rackParameter.min <= 2) {
            return `${prefix}${formatMagnitude(clampedAmount * 100, 0)}%`;
        }
        const unit = rackParameter.unit === "deg" ? "°" : rackParameter.unit;
        return `${prefix}${formatMagnitude(clampedAmount, Math.abs(clampedAmount) < 10 ? 2 : 1)}${unit ? ` ${unit}` : ""}`;
    }

    switch (getVoiceModulationParameterKind(targetKind as VoiceModulationTargetKind)) {
        case "wavetablePosition":
            return `${prefix}${formatMagnitude(clampedAmount * 100, 0)}%`;
        case "warpAmount":
            return `${prefix}${formatMagnitude(clampedAmount * 100, 0)}%`;
        case "unisonDetune":
        case "unisonBlend":
        case "unisonWidth":
        case "unisonWavetablePositionSpread":
        case "unisonWarpSpread":
        case "mseg1Morph":
        case "mseg2Morph":
        case "mseg3Morph":
        case "env1Sustain":
        case "env2Sustain":
        case "env3Sustain":
            return `${prefix}${formatMagnitude(clampedAmount * 100, 0)}%`;
        case "mseg1Rate":
        case "mseg2Rate":
        case "mseg3Rate":
        case "env1Attack":
        case "env1Decay":
        case "env1Release":
        case "env2Attack":
        case "env2Decay":
        case "env2Release":
        case "env3Attack":
        case "env3Decay":
        case "env3Release":
            return `${prefix}${formatMagnitude(clampedAmount, 3)} s`;
        case "filterCutoffOctaves":
            return `${prefix}${formatMagnitude(clampedAmount, 2)} oct`;
        case "filterQ":
            return `${prefix}${formatMagnitude(clampedAmount, 2)} Q`;
        case "pitchSemitones":
            return `${prefix}${formatMagnitude(clampedAmount, 1)} st`;
        case "ampGainDb":
            return `${prefix}${formatMagnitude(clampedAmount, 1)} dB`;
        case "pan": {
            const panPercent = Math.round(Math.abs(clampedAmount) * 100);
            if (panPercent === 0) {
                return "0%";
            }

            if (polarity === "bipolar") {
                return `±${panPercent}%`;
            }

            return `${panPercent}% ${clampedAmount < 0 ? "L" : "R"}`;
        }
        default:
            return `${prefix}${formatMagnitude(clampedAmount, 3)}`;
    }
}

export function formatModulationAmountEditingValue(targetKind: ModulationTargetKind, amount: number) {
    const clampedAmount = clampModulationRouteAmount(targetKind, amount);
    const rackParameter = RACK_MODULATION_PARAMETER_BY_KIND.get(targetKind as RackModulationTargetKind);
    if (rackParameter !== undefined) {
        return formatSignedNumeric(
            rackParameter.unit === "" && rackParameter.max - rackParameter.min <= 2
                ? clampedAmount * 100
                : clampedAmount,
            2,
        );
    }

    switch (getVoiceModulationParameterKind(targetKind as VoiceModulationTargetKind)) {
        case "wavetablePosition":
        case "warpAmount":
        case "unisonDetune":
        case "unisonBlend":
        case "unisonWidth":
        case "unisonWavetablePositionSpread":
        case "unisonWarpSpread":
        case "mseg1Morph":
        case "mseg2Morph":
        case "mseg3Morph":
        case "env1Sustain":
        case "env2Sustain":
        case "env3Sustain":
        case "pan":
            return formatSignedNumeric(clampedAmount * 100, 1);
        case "mseg1Rate":
        case "mseg2Rate":
        case "mseg3Rate":
        case "env1Attack":
        case "env1Decay":
        case "env1Release":
        case "env2Attack":
        case "env2Decay":
        case "env2Release":
        case "env3Attack":
        case "env3Decay":
        case "env3Release":
            return formatSignedNumeric(clampedAmount, 3);
        case "filterCutoffOctaves":
            return formatSignedNumeric(clampedAmount, 2);
        case "filterQ":
            return formatSignedNumeric(clampedAmount, 2);
        case "pitchSemitones":
            return formatSignedNumeric(clampedAmount, 2);
        case "ampGainDb":
            return formatSignedNumeric(clampedAmount, 1);
        default:
            return formatSignedNumeric(clampedAmount, 3);
    }
}

export function parseModulationAmountEditingValue(targetKind: ModulationTargetKind, rawText: string) {
    const normalizedText = String(rawText ?? "")
        .trim()
        .toLowerCase()
        .replace(/,/g, "")
        .replace(/\s+/g, "");

    if (!normalizedText) {
        return null;
    }

    let suffixDirection = 1;
    let numericText = normalizedText;

    const parameterKind = isRackModulationTarget(targetKind)
        ? null
        : getVoiceModulationParameterKind(targetKind as VoiceModulationTargetKind);

    if (parameterKind === "pan") {
        if (numericText.endsWith("l")) {
            suffixDirection = -1;
            numericText = numericText.slice(0, -1);
        } else if (numericText.endsWith("r")) {
            suffixDirection = 1;
            numericText = numericText.slice(0, -1);
        }
    }

    numericText = numericText.replace(/%|oct|st|db|q|s/g, "");
    const numericValue = Number.parseFloat(numericText);

    if (!Number.isFinite(numericValue)) {
        return null;
    }

    const rackParameter = RACK_MODULATION_PARAMETER_BY_KIND.get(targetKind as RackModulationTargetKind);
    if (rackParameter !== undefined) {
        return clampModulationRouteAmount(
            targetKind,
            rackParameter.unit === "" && rackParameter.max - rackParameter.min <= 2
                ? numericValue / 100
                : numericValue,
        );
    }

    if (
        parameterKind === "wavetablePosition"
        || parameterKind === "warpAmount"
        || parameterKind === "unisonDetune"
        || parameterKind === "unisonBlend"
        || parameterKind === "unisonWidth"
        || parameterKind === "unisonWavetablePositionSpread"
        || parameterKind === "unisonWarpSpread"
        || parameterKind === "mseg1Morph"
        || parameterKind === "mseg2Morph"
        || parameterKind === "mseg3Morph"
        || parameterKind === "env1Sustain"
        || parameterKind === "env2Sustain"
        || parameterKind === "env3Sustain"
    ) {
        return clampModulationRouteAmount(targetKind, numericValue / 100);
    }

    if (parameterKind === "pan") {
        const signedValue = /^[+-]/.test(numericText)
            ? numericValue
            : (Math.abs(numericValue) * suffixDirection);
        return clampModulationRouteAmount(targetKind, signedValue / 100);
    }

    return clampModulationRouteAmount(targetKind, numericValue);
}

export function getModulationAmountPercentLabel(targetKind: ModulationTargetKind, amount: number) {
    return `${Math.round(getModulationAmountDepth(targetKind, amount) * 100)}%`;
}

export function getModulationTargetClampHint(targetKind: ModulationTargetKind) {
    if (isRackModulationTarget(targetKind)) {
        return "Rack modulation adds to the base control and clamps to the effect's authored range.";
    }
    switch (getVoiceModulationParameterKind(targetKind as VoiceModulationTargetKind)) {
        case "wavetablePosition":
            return "Wavetable scan still clamps to the table range.";
        case "warpAmount":
            return "Warp amount still clamps to the oscillator's warp range.";
        case "filterCutoffOctaves":
            return "Requested cutoff movement is converted to Hz and still clamps to the filter range.";
        case "filterQ":
            return "Resonance still clamps to the synth's Q range.";
        case "pitchSemitones":
            return "Pitch depth adds on top of note, glide, and bend.";
        case "ampGainDb":
            return "Amplitude still clamps to the synth's gain range.";
        case "pan":
            return "Pan still clamps between full left and full right.";
        case "unisonDetune":
            return "Unison detune still clamps to the oscillator's detune range.";
        case "unisonBlend":
            return "Unison blend still clamps between center-heavy and even spread.";
        case "unisonWidth":
            return "Unison width still clamps between mono and full stereo spread.";
        case "unisonWavetablePositionSpread":
            return "Unison wavetable spread still clamps to the table range.";
        case "unisonWarpSpread":
            return "Unison warp spread still clamps to the oscillator's warp range.";
        case "mseg1Morph":
        case "mseg2Morph":
        case "mseg3Morph":
            return "MSEG morph still clamps between Shape A and Shape B.";
        case "mseg1Rate":
        case "mseg2Rate":
        case "mseg3Rate":
            return "MSEG time still clamps to the source's authored duration range.";
        case "env1Attack":
        case "env1Decay":
        case "env1Release":
        case "env2Attack":
        case "env2Decay":
        case "env2Release":
        case "env3Attack":
        case "env3Decay":
        case "env3Release":
            return "Envelope time still clamps to the envelope stage range.";
        case "env1Sustain":
        case "env2Sustain":
        case "env3Sustain":
            return "Envelope sustain still clamps between silence and full level.";
        default:
            return "";
    }
}

function parseSourceKind(value: unknown): ModulationSourceKind | null {
    if (
        value === "mseg" || value === "env" || value === "velocity"
        || value === "pressure" || value === "slide" || value === "macro"
    ) {
        return value;
    }

    return null;
}

function normalizeSourceKind(value: unknown): ModulationSourceKind {
    return parseSourceKind(value) ?? "mseg";
}

function parseTargetKind(value: unknown): ModulationTargetKind | null {
    return parseCanonicalModulationTargetKind(value);
}

function normalizeTargetKind(value: unknown): ModulationTargetKind {
    return parseTargetKind(value) ?? "oscA.wavetablePosition";
}

export function normalizeMacroName(value: unknown, slotIndex: number): string {
    const fallback = MACRO_SLOT_NAMES[slotIndex] ?? `Macro ${slotIndex + 1}`;
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeSourceSlot(sourceKind: ModulationSourceKind, rawSlot: unknown) {
    const numericSlot = Math.round(Number(rawSlot));

    if (sourceKind === "velocity" || sourceKind === "pressure" || sourceKind === "slide") {
        return null;
    }

    const maxSlot = sourceKind === "mseg"
        ? MODULATION_MSEG_SLOT_COUNT
        : sourceKind === "macro"
            ? MODULATION_MACRO_SLOT_COUNT
            : MODULATION_ENV_SLOT_COUNT;
    return clamp(Number.isFinite(numericSlot) ? numericSlot : 1, 1, maxSlot);
}

export function createDefaultEnvelope(slotIndex: number): ModulationEnvelope {
    return {
        name: ENV_SLOT_NAMES[slotIndex] ?? `Env ${slotIndex + 1}`,
        attackSeconds: 0.01,
        decaySeconds: 0.25,
        sustain: 0.5,
        releaseSeconds: 0.2,
    };
}

export function normalizeEnvelope(value: unknown, slotIndex = 0): ModulationEnvelope {
    const nextValue = value && typeof value === "object" ? value as Partial<ModulationEnvelope> : {};
    const fallback = createDefaultEnvelope(slotIndex);

    return {
        name: typeof nextValue.name === "string" && nextValue.name.trim() ? nextValue.name : fallback.name,
        attackSeconds: clampEnvSeconds(nextValue.attackSeconds ?? fallback.attackSeconds, fallback.attackSeconds),
        decaySeconds: clampEnvSeconds(nextValue.decaySeconds ?? fallback.decaySeconds, fallback.decaySeconds),
        sustain: clamp01(nextValue.sustain ?? fallback.sustain),
        releaseSeconds: clampEnvSeconds(nextValue.releaseSeconds ?? fallback.releaseSeconds, fallback.releaseSeconds),
    };
}

function normalizeEnvelopeSlot(value: unknown, slotIndex = 0): ModulationEnvelopeSlot {
    const normalized = normalizeEnvelope(value, slotIndex);
    return { name: normalized.name };
}

export function createDefaultRoute(overrides: Partial<ModulationRoute> = {}): ModulationRoute {
    return {
        id: overrides.id ?? createGeneratedRouteId(),
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "oscA.wavetablePosition",
        amount: 0,
        reducer: "max",
        ...overrides,
    };
}

function normalizeRouteRecord(
    nextValue: Readonly<Record<string, unknown>>,
    routeIndex: number,
    sourceKind: ModulationSourceKind,
    targetKind: ModulationTargetKind,
): ModulationRoute {
    const numericAmount = Number(nextValue.amount);

    return {
        id: normalizeRouteId(nextValue.id, routeIndex),
        enabled: nextValue.enabled !== false,
        sourceKind,
        sourceSlot: normalizeSourceSlot(sourceKind, nextValue.sourceSlot),
        polarity: normalizePolarity(nextValue.polarity),
        targetKind,
        amount: clampModulationRouteAmount(targetKind, numericAmount),
        reducer: nextValue.reducer === "mean" ? "mean" : "max",
    };
}

export function normalizeRoute(value: unknown, routeIndex = 0): ModulationRoute {
    const isObject = value !== null && typeof value === "object";
    // SAFETY: The object check establishes safe property access; every field is
    // normalized while constructing the returned domain route.
    const nextValue = isObject ? value as Record<string, unknown> : {};
    const sourceKind = normalizeSourceKind(nextValue.sourceKind);
    const targetKind = normalizeTargetKind(nextValue.targetKind);
    return normalizeRouteRecord(nextValue, routeIndex, sourceKind, targetKind);
}

/** Stable product identity for the one legal mapping between a source and target. */
export function modulationRoutePairKey(
    route: Pick<ModulationRoute, "sourceKind" | "sourceSlot" | "targetKind">,
): string {
    return `${route.sourceKind}:${route.sourceSlot ?? 0}->${route.targetKind}`;
}

function normalizeRoutes(value: unknown): ModulationRoute[] {
    const inputRoutes = Array.isArray(value) ? value : [];
    return inputRoutes.map((route, routeIndex) => normalizeRoute(route, routeIndex));
}

function routesHaveUniqueIdentity(routes: ReadonlyArray<ModulationRoute>) {
    const routeIds = new Set<string>();
    const routePairs = new Set<string>();

    for (const route of routes) {
        const pairKey = modulationRoutePairKey(route);
        if (routeIds.has(route.id) || routePairs.has(pairKey)) {
            return false;
        }
        routeIds.add(route.id);
        routePairs.add(pairKey);
    }

    return true;
}

function canonicalJsonValuesEqual(left: unknown, right: unknown): boolean {
    if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
        return Object.is(left, right);
    }

    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
            return false;
        }
        return left.every((value, index) => canonicalJsonValuesEqual(value, right[index]));
    }

    // SAFETY: Both values are non-null, non-array objects. Their keys and each
    // recursively parsed JSON value are compared before accepting the boundary.
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return leftKeys.length === rightKeys.length && leftKeys.every((key) => (
        hasOwnValue(rightRecord, key)
        && canonicalJsonValuesEqual(leftRecord[key], rightRecord[key])
    ));
}

/** Pick the first unused cell in the closed 1118-pair domain for generic Add. */
export function createFirstAvailableModulationRoute(
    routes: ReadonlyArray<ModulationRoute>,
): ModulationRoute | null {
    const usedPairs = new Set(routes.map(modulationRoutePairKey));

    for (const source of MODULATION_SOURCE_OPTIONS) {
        for (const target of MODULATION_TARGET_OPTIONS) {
            const candidateShape = {
                sourceKind: source.sourceKind,
                sourceSlot: source.sourceSlot,
                targetKind: target.value,
            };
            if (usedPairs.has(modulationRoutePairKey(candidateShape))) continue;

            return createDefaultRoute({
                ...candidateShape,
                id: createAvailableGeneratedRouteId(routes),
            });
        }
    }

    return null;
}

function normalizeMsegSlot(value: unknown, slotIndex: number): ModulationMsegSlot {
    const nextValue = value && typeof value === "object" ? value as Partial<ModulationMsegSlot> : {};
    const defaultShape = createDefaultMsegShape(MSEG_SLOT_NAMES[slotIndex] ?? `MSEG ${slotIndex + 1}`);
    const shapeA = normalizeMsegShape(nextValue.shapeA ?? defaultShape);

    const normalizedPlayback = normalizeMsegPlayback({
        ...createDefaultMsegPlayback(),
        ...(nextValue.playback ?? {}),
        rate: createDefaultMsegPlayback().rate,
    });
    const { rate: _parameterOwnedRate, ...playback } = normalizedPlayback;

    return {
        shapeA,
        shapeB: normalizeMsegShape(nextValue.shapeB ?? shapeA),
        playback,
    };
}

export function createDefaultModulationState(): ModulationState {
    return {
        format: "cosimo.modulation",
        version: MODULATION_STATE_VERSION,
        msegSlots: Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, (_, slotIndex) => normalizeMsegSlot({}, slotIndex)),
        envelopeSlots: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => ({
            name: createDefaultEnvelope(slotIndex).name,
        })),
        routes: [],
        macroNames: MACRO_SLOT_NAMES.slice(),
    };
}

export function normalizeModulationState(value: unknown = createDefaultModulationState()): ModulationState {
    const nextValue = value && typeof value === "object" ? value as Partial<ModulationState> : {};
    const inputMsegSlots = Array.isArray(nextValue.msegSlots) ? nextValue.msegSlots : [];
    const inputEnvelopeSlots = Array.isArray(nextValue.envelopeSlots) ? nextValue.envelopeSlots : [];
    const inputMacroNames = Array.isArray(nextValue.macroNames) ? nextValue.macroNames : [];

    return {
        format: "cosimo.modulation",
        version: MODULATION_STATE_VERSION,
        msegSlots: Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, (_, slotIndex) => normalizeMsegSlot(inputMsegSlots[slotIndex], slotIndex)),
        envelopeSlots: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => normalizeEnvelopeSlot(inputEnvelopeSlots[slotIndex], slotIndex)),
        routes: normalizeRoutes(nextValue.routes),
        macroNames: Array.from(
            { length: MODULATION_MACRO_SLOT_COUNT },
            (_, slotIndex) => normalizeMacroName(inputMacroNames[slotIndex], slotIndex),
        ),
    };
}

export function serializeModulationState(state: ModulationState) {
    const parsedState = parseModulationState(state);
    if (parsedState._tag === "err") {
        throw parsedState.error;
    }
    return JSON.stringify(parsedState.value);
}

/** Parse exactly the current persisted modulation schema without repair or migration. */
export function parseModulationState(value: unknown): Result<ModulationState, ModulationStateParseError> {
    let parsedValue = value;
    if (typeof value === "string") {
        if (value.trim() === "") {
            return err(new ModulationStateParseError("Expected a modulation document"));
        }
        try {
            parsedValue = JSON.parse(value);
        } catch {
            return err(new ModulationStateParseError("Expected valid modulation JSON"));
        }
    }

    const normalizedState = normalizeModulationState(parsedValue);
    if (
        !canonicalJsonValuesEqual(parsedValue, normalizedState)
        || !routesHaveUniqueIdentity(normalizedState.routes)
    ) {
        return err(new ModulationStateParseError("Expected the current modulation schema"));
    }

    return ok(normalizedState);
}

export function deserializeModulationState(value: unknown): ModulationState {
    const parsedState = parseModulationState(value);
    if (parsedState._tag === "err") {
        throw parsedState.error;
    }
    return parsedState.value;
}

function modulationStatesEqual(left: ModulationState, right: ModulationState) {
    return serializeModulationState(left) === serializeModulationState(right);
}

function toStoredStateEchoToken(value: unknown) {
    if (typeof value === "string") {
        return value;
    }
    try {
        return `${typeof value}:${JSON.stringify(value)}`;
    } catch {
        return `${typeof value}:${String(value)}`;
    }
}

function toMsegPlaybackUpload(slotIndex: number, playback: Omit<MsegPlayback, "rate">): ModulationMsegPlaybackUpload {
    return {
        slot: slotIndex + 1,
        holdFinalValue: playback.holdFinalValue !== false,
        rateKind: 0,
        loopEnabled: Boolean(playback.loop),
        loopStart: playback.loop?.startX ?? 0,
        loopEnd: playback.loop?.endX ?? 1,
        noteOffPolicy:
            playback.noteOffPolicy === "immediate"
                ? 1
                : playback.noteOffPolicy === "ignore"
                    ? 2
                    : 0,
        legatoRestarts: Boolean(playback.legatoRestarts),
    };
}

function toMsegBufferUpload(slotIndex: number, shapeIndex: number, shape: MsegShape): ModulationMsegBufferUpload {
    return {
        slot: slotIndex + 1,
        shapeIndex,
        buffer: Array.from(renderMsegShape(shape)),
    };
}

function msegPlaybackPoliciesEqual(left: Omit<MsegPlayback, "rate">, right: Omit<MsegPlayback, "rate">) {
    return left.holdFinalValue === right.holdFinalValue
        && left.noteOffPolicy === right.noteOffPolicy
        && left.legatoRestarts === right.legatoRestarts
        && JSON.stringify(left.loop) === JSON.stringify(right.loop);
}

export function buildModulationRuntimeEvents(
    state: ModulationState,
    previousState: ModulationState | null = null,
): ModulationRuntimeEvent[] {
    const events: ModulationRuntimeEvent[] = [];

    for (let slotIndex = 0; slotIndex < MODULATION_MSEG_SLOT_COUNT; slotIndex += 1) {
        const slot = state.msegSlots[slotIndex];
        const previousSlot = previousState?.msegSlots[slotIndex];
        if (previousSlot === undefined || !msegShapesEqual(previousSlot.shapeA, slot.shapeA)) {
            events.push({
                endpointID: MODULATION_MSEG_BUFFER_ENDPOINT_ID,
                value: toMsegBufferUpload(slotIndex, 0, slot.shapeA),
            });
        }
        if (previousSlot === undefined || !msegShapesEqual(previousSlot.shapeB, slot.shapeB)) {
            events.push({
                endpointID: MODULATION_MSEG_BUFFER_ENDPOINT_ID,
                value: toMsegBufferUpload(slotIndex, 1, slot.shapeB),
            });
        }
        if (previousSlot === undefined || !msegPlaybackPoliciesEqual(previousSlot.playback, slot.playback)) {
            events.push({
                endpointID: MODULATION_MSEG_PLAYBACK_ENDPOINT_ID,
                value: toMsegPlaybackUpload(slotIndex, slot.playback),
            });
        }
    }

    events.push(...buildModulationRuntimeProgramEvents(previousState?.routes ?? null, state.routes));
    return events;
}

export function getModulationSourceOptionValue(route: Pick<ModulationRoute, "sourceKind" | "sourceSlot">) {
    const match = MODULATION_SOURCE_OPTIONS.find((option) => (
        option.sourceKind === route.sourceKind
        && option.sourceSlot === route.sourceSlot
    ));

    return match?.value ?? MODULATION_SOURCE_OPTIONS[0].value;
}

export function applyModulationSourceOption(
    route: ModulationRoute,
    sourceValue: string,
): ModulationRoute {
    const option = MODULATION_SOURCE_OPTIONS.find((candidate) => candidate.value === sourceValue)
        ?? MODULATION_SOURCE_OPTIONS[0];

    return {
        ...route,
        sourceKind: option.sourceKind,
        sourceSlot: option.sourceSlot,
    };
}

class ModulationMsegSlotController implements MsegEditorControllerLike {
    private readonly bridge: ModulationRuntimeBridge;
    private readonly slotIndex: number;

    constructor(bridge: ModulationRuntimeBridge, slotIndex: number) {
        this.bridge = bridge;
        this.slotIndex = slotIndex;
    }

    getState(): MsegState {
        const slot = this.bridge.getState().msegSlots[this.slotIndex];
        const editShapeIndex = this.bridge.getMsegSlotEditShapeIndex(this.slotIndex);
        const shape = editShapeIndex === 1 ? slot.shapeB : slot.shapeA;
        const referenceShape = editShapeIndex === 1 ? slot.shapeA : slot.shapeB;

        return {
            shape,
            shapeA: slot.shapeA,
            shapeB: slot.shapeB,
            referenceShape,
            editShapeIndex,
            playback: {
                ...slot.playback,
                rate: createDefaultMsegPlayback().rate,
            },
            depth: MSEG_DEFAULT_DEPTH,
        };
    }

    setShape(nextShape: unknown) {
        this.bridge.setMsegSlotShape(this.slotIndex, this.bridge.getMsegSlotEditShapeIndex(this.slotIndex), nextShape);
    }

    setEditShapeIndex(shapeIndex: number) {
        this.bridge.setMsegSlotEditShapeIndex(this.slotIndex, shapeIndex);
    }

    setPlayback(nextPlayback: unknown) {
        this.bridge.setMsegSlotPlayback(this.slotIndex, nextPlayback);
    }

    addPoint(x: number, y: number) {
        this.setShape(addMsegPoint(this.getState().shape, x, y));
    }

    movePoint(pointIndex: number, x: number, y: number) {
        this.setShape(moveMsegPoint(this.getState().shape, pointIndex, x, y));
    }

    deletePoint(pointIndex: number) {
        this.setShape(deleteMsegPoint(this.getState().shape, pointIndex));
    }

    setSegmentCurvePower(segmentIndex: number, curvePower: number) {
        this.setShape(setMsegSegmentCurvePower(this.getState().shape, segmentIndex, curvePower));
    }
}

export class ModulationRuntimeBridge {
    private readonly patchConnection: PatchConnectionLike;
    private state = createDefaultModulationState();
    private routeAmountsById = new Map(this.state.routes.map((route) => [route.id, route.amount]));
    private routeIndexesById = new Map(this.state.routes.map((route, routeIndex) => [route.id, routeIndex]));
    private readonly pendingStoredStateEchoes = new Map<string, Map<string, number>>();
    private readonly stateListeners = new Set<(
        state: ModulationState,
        changeKind: ModulationStateChangeKind,
    ) => void>();
    private readonly routeAmountListenersById = new Map<string, Set<ModulationRouteAmountListener>>();
    private readonly msegSlotEditShapeIndexes = Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, () => 0 as 0 | 1);
    private readonly slotControllers = Array.from(
        { length: MODULATION_MSEG_SLOT_COUNT },
        (_, slotIndex) => new ModulationMsegSlotController(this, slotIndex),
    );

    constructor(patchConnection: PatchConnectionLike) {
        this.patchConnection = patchConnection;
        this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
    }

    attach() {
        this.patchConnection.addStoredStateValueListener?.(this.handleStoredStateValue);
    }

    detach() {
        this.patchConnection.removeStoredStateValueListener?.(this.handleStoredStateValue);
    }

    requestBootState() {
        if (typeof this.patchConnection.requestFullStoredState === "function") {
            this.patchConnection.requestFullStoredState((storedState) => {
                this.applyStoredState(readFullStoredStateValue(storedState, MODULATION_STATE_KEY));
            });
            return;
        }

        if (typeof this.patchConnection.requestStoredStateValue === "function") {
            this.patchConnection.requestStoredStateValue(MODULATION_STATE_KEY);
            return;
        }

        this.emitStateChange();
    }

    getState() {
        return this.state;
    }

    subscribe(listener: (state: ModulationState, changeKind: ModulationStateChangeKind) => void) {
        this.stateListeners.add(listener);
    }

    unsubscribe(listener: (state: ModulationState, changeKind: ModulationStateChangeKind) => void) {
        this.stateListeners.delete(listener);
    }

    /** Read one route amount from the canonical bridge state by stable route identity. */
    getRouteAmount(routeId: string): number | null {
        return this.routeAmountsById.get(routeId) ?? null;
    }

    /** Subscribe to canonical amount changes for one route without observing the full modulation document. */
    subscribeRouteAmount(routeId: string, listener: ModulationRouteAmountListener): () => void {
        const listeners = this.routeAmountListenersById.get(routeId) ?? new Set<ModulationRouteAmountListener>();
        listeners.add(listener);
        this.routeAmountListenersById.set(routeId, listeners);

        return () => {
            listeners.delete(listener);
            if (listeners.size === 0) {
                this.routeAmountListenersById.delete(routeId);
            }
        };
    }

    /** Set one canonical route amount by stable identity while retaining the hot-path amount event. */
    setRouteAmountById(routeId: string, nextAmount: number): boolean {
        const routeIndex = this.routeIndexesById.get(routeId);
        return routeIndex === undefined ? false : this.setRouteAmount(routeIndex, nextAmount);
    }

    getMsegSlotController(slotIndex: number) {
        return this.slotControllers[clamp(Math.round(slotIndex), 0, MODULATION_MSEG_SLOT_COUNT - 1)];
    }

    getMsegSlotEditShapeIndex(slotIndex: number) {
        return this.msegSlotEditShapeIndexes[clamp(Math.round(slotIndex), 0, MODULATION_MSEG_SLOT_COUNT - 1)];
    }

    setMsegSlotEditShapeIndex(slotIndex: number, shapeIndex: number) {
        const normalizedSlotIndex = clamp(Math.round(slotIndex), 0, MODULATION_MSEG_SLOT_COUNT - 1);
        const normalizedShapeIndex = Math.round(Number(shapeIndex)) === 1 ? 1 : 0;

        if (this.msegSlotEditShapeIndexes[normalizedSlotIndex] === normalizedShapeIndex) {
            return;
        }

        this.msegSlotEditShapeIndexes[normalizedSlotIndex] = normalizedShapeIndex;
        this.emitStateChange();
    }

    setState(nextState: unknown): boolean {
        const parsedState = parseModulationState(nextState);
        if (parsedState._tag === "err") {
            return false;
        }
        const normalizedState = parsedState.value;

        if (modulationStatesEqual(this.state, normalizedState)) {
            return true;
        }

        this.replaceCanonicalState(normalizedState, true);
        return true;
    }

    setMsegSlotShape(slotIndex: number, shapeIndex: number, nextShape: unknown) {
        const normalizedShape = normalizeMsegShape(nextShape);
        const currentSlot = this.state.msegSlots[slotIndex];
        const currentShape = Math.round(Number(shapeIndex)) === 1 ? currentSlot.shapeB : currentSlot.shapeA;

        if (msegShapesEqual(currentShape, normalizedShape)) {
            return;
        }

        this.updateState((previousState) => {
            const nextMsegSlots = previousState.msegSlots.map((slot, index) => (
                index === slotIndex
                    ? Math.round(Number(shapeIndex)) === 1
                        ? { ...slot, shapeB: normalizedShape }
                        : { ...slot, shapeA: normalizedShape }
                    : slot
            ));

            return {
                ...previousState,
                msegSlots: nextMsegSlots,
            };
        });
    }

    setMsegSlotPlayback(slotIndex: number, nextPlayback: unknown) {
        const normalizedPlayback = normalizeMsegPlayback(nextPlayback);
        const { rate: _parameterOwnedRate, ...playback } = normalizedPlayback;
        const currentSlot = this.state.msegSlots[slotIndex];

        if (msegPlaybackPoliciesEqual(currentSlot.playback, playback)) {
            return;
        }

        this.updateState((previousState) => {
            const nextMsegSlots = previousState.msegSlots.map((slot, index) => (
                index === slotIndex
                    ? { ...slot, playback }
                    : slot
            ));

            return {
                ...previousState,
                msegSlots: nextMsegSlots,
            };
        });
    }

    setEnvelope(slotIndex: number, nextEnvelope: unknown) {
        const normalizedEnvelope = normalizeEnvelopeSlot(nextEnvelope, slotIndex);
        const currentEnvelope = this.state.envelopeSlots[slotIndex];

        if (JSON.stringify(currentEnvelope) === JSON.stringify(normalizedEnvelope)) {
            return;
        }

        this.updateState((previousState) => ({
            ...previousState,
            envelopeSlots: previousState.envelopeSlots.map((envelope, index) => (
                index === slotIndex ? normalizedEnvelope : envelope
            )),
        }));
    }

    replaceRoutes(nextRoutes: unknown) {
        const normalizedRoutes = normalizeRoutes(nextRoutes);

        if (JSON.stringify(this.state.routes) === JSON.stringify(normalizedRoutes)) {
            return;
        }

        this.updateState((previousState) => ({
            ...previousState,
            routes: normalizedRoutes,
        }));
    }

    setRoute(routeIndex: number, nextRoute: unknown): boolean {
        if (routeIndex < 0 || routeIndex >= this.state.routes.length) {
            return false;
        }

        const normalizedRoute = normalizeRoute(nextRoute, routeIndex);
        const currentRoutes = [...this.state.routes];
        const conflicts = currentRoutes.some((route, index) => index !== routeIndex && (
            route.id === normalizedRoute.id
            || modulationRoutePairKey(route) === modulationRoutePairKey(normalizedRoute)
        ));
        if (conflicts) return false;

        if (JSON.stringify(currentRoutes[routeIndex]) === JSON.stringify(normalizedRoute)) {
            return true;
        }

        currentRoutes[routeIndex] = normalizedRoute;
        this.replaceRoutes(currentRoutes);
        return true;
    }

    /** Hot-path amount edit: the route is already normalized, so avoid rebuilding every mapping. */
    setRouteAmount(routeIndex: number, nextAmount: number): boolean {
        const currentRoute = this.state.routes[routeIndex];
        if (currentRoute === undefined) {
            return false;
        }
        const amount = clampModulationRouteAmount(currentRoute.targetKind, nextAmount);
        if (currentRoute.amount === amount) {
            return true;
        }

        const routes = [...this.state.routes];
        routes[routeIndex] = { ...currentRoute, amount };
        this.state = { ...this.state, routes };
        this.routeAmountsById.set(currentRoute.id, amount);
        this.persistState();
        this.emitStateChange("routeAmount");
        this.emitRouteAmountChange(currentRoute.id);
        return true;
    }

    /** Add a route with a caller-owned identity, rejecting duplicate identities or source-target pairs. */
    addRoute(nextRoute: unknown): ModulationRoute | null {
        const normalizedRoute = normalizeRoute(nextRoute, this.state.routes.length);
        const pairKey = modulationRoutePairKey(normalizedRoute);
        if (this.state.routes.some((route) => (
            route.id === normalizedRoute.id || modulationRoutePairKey(route) === pairKey
        ))) return null;

        this.replaceRoutes([...this.state.routes, normalizedRoute]);
        return normalizedRoute;
    }

    /** Create and add a route whose generated identity is free in the canonical route set. */
    addGeneratedRoute(overrides: GeneratedModulationRouteInput): ModulationRoute | null {
        return this.addRoute(createDefaultRoute({
            ...overrides,
            id: createAvailableGeneratedRouteId(this.state.routes),
        }));
    }

    removeRoute(routeIndex: number) {
        if (routeIndex < 0 || routeIndex >= this.state.routes.length) {
            return;
        }

        const nextRoutes = this.state.routes.filter((_, index) => index !== routeIndex);
        this.replaceRoutes(nextRoutes);
    }

    private updateState(update: (previousState: ModulationState) => ModulationState) {
        const nextState = normalizeModulationState(update(this.state));

        if (modulationStatesEqual(this.state, nextState)) {
            return;
        }

        this.replaceCanonicalState(nextState, true);
    }

    private applyStoredState(rawValue: unknown) {
        if (rawValue === undefined) {
            this.emitStateChange();
            return;
        }

        const parsedState = parseModulationState(rawValue);
        if (parsedState._tag === "err") {
            return;
        }

        this.replaceCanonicalState(parsedState.value, false);
    }

    private handleStoredStateValue(message: unknown) {
        if (!message || typeof message !== "object") {
            return;
        }

        const nextMessage = message as StoredStateMessage;
        if (typeof nextMessage.key === "string" && this.consumePendingStoredStateEcho(nextMessage.key, nextMessage.value)) {
            return;
        }

        if (nextMessage.key === MODULATION_STATE_KEY) {
            this.applyStoredState(nextMessage.value);
        }
    }

    private persistState() {
        if (typeof this.patchConnection.sendStoredStateValue !== "function") {
            return;
        }

        // Every state entry point normalizes before assignment. Persist the
        // trusted state directly so live amount edits perform one stringify,
        // not another full-domain normalize plus stringify.
        const persistedModulationState = JSON.stringify(this.state);
        this.rememberPendingStoredStateEcho(MODULATION_STATE_KEY, persistedModulationState);
        try {
            this.patchConnection.sendStoredStateValue(MODULATION_STATE_KEY, persistedModulationState);
        } catch (error) {
            this.consumePendingStoredStateEcho(MODULATION_STATE_KEY, persistedModulationState);
            throw error;
        }
    }

    private emitStateChange(changeKind: ModulationStateChangeKind = "general") {
        const stateSnapshot = {
            ...this.state,
            msegSlots: [...this.state.msegSlots],
            envelopeSlots: [...this.state.envelopeSlots],
            routes: [...this.state.routes],
        };
        this.stateListeners.forEach((listener) => listener(stateSnapshot, changeKind));
    }

    private replaceCanonicalState(nextState: ModulationState, shouldPersist: boolean) {
        const previousRouteAmountsById = this.routeAmountsById;
        this.state = nextState;
        this.routeAmountsById = new Map(nextState.routes.map((route) => [route.id, route.amount]));
        this.routeIndexesById = new Map(nextState.routes.map((route, routeIndex) => [route.id, routeIndex]));
        if (shouldPersist) {
            this.persistState();
        }
        this.emitStateChange();
        this.routeAmountListenersById.forEach((_listeners, routeId) => {
            const previousAmount = previousRouteAmountsById.get(routeId) ?? null;
            const nextAmount = this.routeAmountsById.get(routeId) ?? null;
            if (!Object.is(previousAmount, nextAmount)) {
                this.emitRouteAmountChange(routeId);
            }
        });
    }

    private emitRouteAmountChange(routeId: string) {
        const amount = this.getRouteAmount(routeId);
        this.routeAmountListenersById.get(routeId)?.forEach((listener) => listener(amount));
    }

    private rememberPendingStoredStateEcho(key: string, value: unknown) {
        const token = toStoredStateEchoToken(value);
        const pendingByToken = this.pendingStoredStateEchoes.get(key) ?? new Map<string, number>();
        pendingByToken.set(token, (pendingByToken.get(token) ?? 0) + 1);
        this.pendingStoredStateEchoes.set(key, pendingByToken);
    }

    private consumePendingStoredStateEcho(key: string, value: unknown) {
        const pendingByToken = this.pendingStoredStateEchoes.get(key);

        if (!pendingByToken) {
            return false;
        }

        const token = toStoredStateEchoToken(value);
        const pendingCount = pendingByToken.get(token) ?? 0;

        if (pendingCount <= 0) {
            return false;
        }

        if (pendingCount === 1) {
            pendingByToken.delete(token);
        } else {
            pendingByToken.set(token, pendingCount - 1);
        }

        if (pendingByToken.size === 0) {
            this.pendingStoredStateEchoes.delete(key);
        }

        return true;
    }
}

export function buildDisplayedMsegState(bridge: ModulationRuntimeBridge, slotIndex: number): MsegState {
    return bridge.getMsegSlotController(slotIndex).getState();
}

type SharedRuntimeBridgeEntry = {
    bridge: ModulationRuntimeBridge;
    refCount: number;
};

const sharedRuntimeBridges = new WeakMap<PatchConnectionLike, SharedRuntimeBridgeEntry>();

export function acquireModulationRuntimeBridge(patchConnection: PatchConnectionLike) {
    const existingEntry = sharedRuntimeBridges.get(patchConnection);

    if (existingEntry) {
        existingEntry.refCount += 1;
        return existingEntry.bridge;
    }

    const bridge = new ModulationRuntimeBridge(patchConnection);
    bridge.attach();
    bridge.requestBootState();
    sharedRuntimeBridges.set(patchConnection, {
        bridge,
        refCount: 1,
    });
    return bridge;
}

export function releaseModulationRuntimeBridge(patchConnection: PatchConnectionLike) {
    const entry = sharedRuntimeBridges.get(patchConnection);

    if (!entry) {
        return;
    }

    entry.refCount -= 1;

    if (entry.refCount > 0) {
        return;
    }

    entry.bridge.detach();
    sharedRuntimeBridges.delete(patchConnection);
}
