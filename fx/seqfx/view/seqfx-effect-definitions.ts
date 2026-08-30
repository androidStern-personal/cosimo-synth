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
import { TALK_BOX_VOWELS } from "./talk-box-contract";

export const SEQFX_PARAM_COUNT = 8;

export const SEQFX_EFFECT_TYPES = {
    empty: 0,
    filter: 1,
    crusher: 2,
    tapeStop: 3,
    stutter: 4,
    pitch: 5,
    comb: 6,
    ring: 7,
    reverse: 8,
    talkBox: 9,
    vibro: 10,
    flange: 11,
    dirty: 12,
} as const;

export type SeqFxEffectType = typeof SEQFX_EFFECT_TYPES[keyof typeof SEQFX_EFFECT_TYPES];
export type SeqFxEffectLifecycle = "gated" | "captured" | "gesture" | "tail" | "modulatedDelay";
export type SeqFxParameterScale = "linear" | "log";
export type SeqFxParameterLatch = "continuous" | "trigger";

export type SeqFxParameterDefinition = {
    id: string;
    label: string;
    min: number;
    max: number;
    defaultValue: number;
    step: number;
    unit: "" | "%" | "bits" | "cents" | "dB" | "degrees" | "Hz" | "ms" | "Q" | "semitones" | "x";
    scale: SeqFxParameterScale;
    latch: SeqFxParameterLatch;
    auxEligible: boolean;
    integer: boolean;
    options?: readonly string[];
};

export type SeqFxEffectDefinition = {
    id: SeqFxEffectType;
    key: string;
    name: string;
    shortName: string;
    fontaudioIcon: string;
    lifecycle: SeqFxEffectLifecycle;
    parameters: readonly SeqFxParameterDefinition[];
};

const parameter = (
    id: string,
    label: string,
    min: number,
    max: number,
    defaultValue: number,
    step: number,
    options: Partial<Omit<SeqFxParameterDefinition, "id" | "label" | "min" | "max" | "defaultValue" | "step">> = {},
): SeqFxParameterDefinition => ({
    id,
    label,
    min,
    max,
    defaultValue,
    step,
    unit: "",
    scale: "linear",
    latch: "continuous",
    auxEligible: true,
    integer: false,
    ...options,
});

const definitions = [
    {
        id: SEQFX_EFFECT_TYPES.empty,
        key: "empty",
        name: "Empty",
        shortName: "",
        fontaudioIcon: "",
        lifecycle: "gated",
        parameters: [],
    },
    {
        id: SEQFX_EFFECT_TYPES.filter,
        key: "filter",
        name: "Filter",
        shortName: "FLT",
        fontaudioIcon: "fad-filter-lowpass",
        lifecycle: "gated",
        parameters: [
            parameter("mode", "Mode", 0, 2, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Low Pass", "High Pass", "Band Pass"] }),
            parameter("cutoff", "Cutoff", 20, 20_000, 2_000, 1, { unit: "Hz", scale: "log" }),
            parameter("legacyEndCutoff", "End Cutoff", 20, 20_000, 500, 1, { unit: "Hz", scale: "log" }),
            parameter("resonance", "Resonance", 0.1, 20, 0.707, 0.001, { unit: "Q", scale: "log" }),
            parameter("durationScale", "Duration", 0.25, 4, 1, 0.01, { unit: "x" }),
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.crusher,
        key: "crush",
        name: "Crush",
        shortName: "CRSH",
        fontaudioIcon: "fad-digital0",
        lifecycle: "gated",
        parameters: [
            parameter("bits", "Bits", 2, 16, 8, 1, { unit: "bits", integer: true }),
            parameter("rateHz", "Rate", 200, 48_000, 48_000, 1, { unit: "Hz", scale: "log" }),
            parameter("drive", "Drive", 0, 36, 0, 0.1, { unit: "dB" }),
            parameter("character", "Character", 0, 3, 1, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                options: ["Original", "Classic", "Smooth", "Progressive"],
            }),
            parameter("adcQuality", "ADC Q", 0, 1, 0, 0.01, { unit: "%" }),
            parameter("dacQuality", "DAC Q", 0, 1, 0, 0.01, { unit: "%" }),
            parameter("dither", "Dither", 0, 1, 0, 0.01, { unit: "%" }),
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.tapeStop,
        key: "tapeStop",
        name: "Tape Stop",
        shortName: "TAPE",
        fontaudioIcon: "fad-stop",
        lifecycle: "gesture",
        parameters: [
            parameter("stopDivision", "Stop Time", 0, 8, 8, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                options: ["1/32", "1/16", "1/8", "1/4", "1/2", "1 Bar", "2 Bars", "4 Bars", "1 Cell"],
            }),
            parameter("curve", "Curve", -1, 1, 0, 0.01, { latch: "trigger", auxEligible: false }),
            parameter("returnMode", "Return", 0, 1, 0, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                options: ["Catch Up", "Spin Up"],
            }),
            parameter("startDivision", "Start Time", 0, 8, 1, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                options: ["1/32", "1/16", "1/8", "1/4", "1/2", "1 Bar", "2 Bars", "4 Bars", "1 Cell"],
            }),
            parameter("character", "Character", 0, 1, 0, 0.01, { unit: "%", latch: "trigger", auxEligible: false }),
            parameter("timingMode", "Timing", 0, 1, 0, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                options: ["Sync", "Free"],
            }),
            parameter("freeStopMs", "Free Stop", 20, 8_000, 500, 1, {
                unit: "ms",
                scale: "log",
                latch: "trigger",
                auxEligible: false,
            }),
            parameter("freeStartMs", "Free Start", 20, 8_000, 125, 1, {
                unit: "ms",
                scale: "log",
                latch: "trigger",
                auxEligible: false,
            }),
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.stutter,
        key: "stutter",
        name: "Stutter",
        shortName: "STUT",
        fontaudioIcon: "fad-repeat",
        lifecycle: "captured",
        parameters: [
            parameter("slices", "Slices", STUTTER_SLICES_MIN, STUTTER_SLICES_MAX, STUTTER_DEFAULT_SLICES, 1, { latch: "trigger", integer: true }),
            parameter("speed", "Speed", STUTTER_SPEED_MIN, STUTTER_SPEED_MAX, STUTTER_DEFAULT_SPEED, 0.01, { unit: "x" }),
            parameter("shape", "Shape", 0, 1, STUTTER_DEFAULT_SHAPE, 0.01),
            parameter("gate", "Gate", 0, 1, STUTTER_DEFAULT_GATE, 0.01, { unit: "%" }),
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.pitch,
        key: "pitch",
        name: "Pitch",
        shortName: "PTCH",
        fontaudioIcon: "fad-arrows-vert",
        lifecycle: "captured",
        parameters: [
            parameter("semitones", "Pitch", -24, 24, 0, 1, { unit: "semitones", integer: true }),
            parameter("cents", "Fine", -100, 100, 0, 1, { unit: "cents", integer: true }),
            parameter("grainMs", "Grain", 10, 120, 48, 0.1, { unit: "ms", scale: "log", latch: "trigger", auxEligible: false }),
            parameter("jitter", "Jitter", 0, 1, 0, 0.01, { unit: "%" }),
            parameter("spread", "Spread", 0, 1, 0.35, 0.01, { unit: "%" }),
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.comb,
        key: "comb",
        name: "Comb",
        shortName: "COMB",
        fontaudioIcon: "fad-filter-notch",
        lifecycle: "tail",
        parameters: [
            parameter("tuneHz", "Tune", 30, 8_000, 220, 0.01, { unit: "Hz", scale: "log" }),
            parameter("decaySeconds", "Decay", 0.02, 8, 1.4, 0.01, { scale: "log" }),
            parameter("polarity", "Polarity", 0, 1, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Positive", "Negative"] }),
            parameter("dispersion", "Dispersion", 0, 1, 0.55, 0.01, { unit: "%" }),
            parameter("dampingHz", "Damping", 500, 20_000, 7_500, 1, { unit: "Hz", scale: "log" }),
            parameter("motion", "Motion", 0, 1, 0.12, 0.01, { unit: "%" }),
            parameter("drive", "Drive", 0, 1, 0.18, 0.01, { unit: "%" }),
            parameter("width", "Width", 0, 1, 0.65, 0.01, { unit: "%" }),
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.ring,
        key: "ring",
        name: "Ring",
        shortName: "RING",
        fontaudioIcon: "fad-modsine",
        lifecycle: "gated",
        parameters: [
            parameter("frequencyHz", "Frequency", 0.1, 12_000, 180, 0.01, { unit: "Hz", scale: "log" }),
            parameter("waveform", "Wave", 0, 3, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Sine", "Triangle", "Square", "Noise"] }),
            parameter("motion", "Motion", 0, 1, 0, 0.01, { unit: "%" }),
            parameter("rateHz", "Rate", 0.02, 20, 0.5, 0.01, { unit: "Hz", scale: "log" }),
            parameter("spread", "Spread", 0, 1, 0.08, 0.01, { unit: "%" }),
            parameter("bias", "Bias", -1, 1, 0, 0.01, { unit: "%" }),
            parameter("rectify", "Rectify", -1, 1, 0, 0.01, { unit: "%" }),
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.reverse,
        key: "reverse",
        name: "Reverse",
        shortName: "REV",
        fontaudioIcon: "fad-backward",
        lifecycle: "gesture",
        parameters: [
            parameter("windowSeconds", "Lookback", 0.02, 4, 0.25, 0.001, { scale: "log", latch: "trigger" }),
            parameter("crossfade", "Crossfade", 0.005, 0.2, 0.04, 0.001, { unit: "%" }),
            parameter("timingMode", "Timing", 0, 1, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Sync", "Free"] }),
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.talkBox,
        key: "talkBox",
        name: "Talk Box",
        shortName: "TALK",
        fontaudioIcon: "fad-microphone",
        lifecycle: "gated",
        parameters: [
            parameter("fromVowel", "From", 0, 4, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: TALK_BOX_VOWELS }),
            parameter("toVowel", "To", 0, 4, 3, 1, { latch: "trigger", auxEligible: false, integer: true, options: TALK_BOX_VOWELS }),
            parameter("morph", "Morph", 0, 1, 0, 0.01, { unit: "%" }),
            parameter("resonance", "Resonance", 1, 20, 6, 0.01, { unit: "Q", scale: "log" }),
            parameter("lows", "Lows", 0, 1, 0.3, 0.01, { unit: "%" }),
            parameter("highs", "Highs", 0, 1, 0.15, 0.01, { unit: "%" }),
            parameter("driveDb", "Drive", 0, 12, 0, 0.1, { unit: "dB" }),
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.vibro,
        key: "vibro",
        name: "Vibro",
        shortName: "VIB",
        fontaudioIcon: "fad-modtri",
        lifecycle: "modulatedDelay",
        parameters: [
            parameter("rateHz", "Rate", 0.05, 12, 4.5, 0.01, { unit: "Hz", scale: "log" }),
            parameter("depthCents", "Depth", 0, 100, 28, 0.1, { unit: "cents" }),
            parameter("waveform", "Wave", 0, 1, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Sine", "Triangle"] }),
            parameter("spreadDegrees", "Spread", 0, 180, 90, 1, { unit: "degrees" }),
            parameter("timingMode", "Timing", 0, 1, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Sync", "Free"] }),
            parameter("division", "Division", 0, 5, 2, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                options: ["1/32", "1/16", "1/8", "1/4", "1/2", "1 Bar"],
            }),
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.flange,
        key: "flange",
        name: "Flange",
        shortName: "FLNG",
        fontaudioIcon: "fad-phase",
        lifecycle: "modulatedDelay",
        parameters: [
            parameter("delayMs", "Delay", 0.2, 10, 1.2, 0.01, { unit: "ms", scale: "log" }),
            parameter("depthMs", "Depth", 0, 10, 3.5, 0.01, { unit: "ms" }),
            parameter("rateHz", "Rate", 0.02, 10, 0.28, 0.01, { unit: "Hz", scale: "log" }),
            parameter("feedback", "Feedback", 0, 0.95, 0.55, 0.01, { unit: "%" }),
            parameter("spreadDegrees", "Spread", 0, 180, 120, 1, { unit: "degrees" }),
            parameter("polarity", "Polarity", 0, 1, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Normal", "Inverse"] }),
            parameter("timingMode", "Timing", 0, 1, 1, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Sync", "Free"] }),
            parameter("division", "Division", 0, 6, 5, 1, {
                latch: "trigger",
                auxEligible: false,
                integer: true,
                options: ["1/16", "1/8", "1/4", "1/2", "1 Bar", "2 Bars", "4 Bars"],
            }),
        ],
    },
    {
        id: SEQFX_EFFECT_TYPES.dirty,
        key: "dirty",
        name: "Dirty",
        shortName: "DIRT",
        fontaudioIcon: "fad-hardclipcurve",
        lifecycle: "gated",
        parameters: [
            parameter("driveDb", "Drive", 0, 36, 12, 0.1, { unit: "dB" }),
            parameter("character", "Character", 0, 3, 0, 1, { latch: "trigger", auxEligible: false, integer: true, options: ["Soft", "Hard", "Fold", "Bias"] }),
            parameter("bias", "Bias", -1, 1, 0, 0.01, { unit: "%" }),
            parameter("dynamics", "Dynamics", 0, 1, 0.65, 0.01, { unit: "%" }),
            parameter("toneHz", "Tone", 500, 20_000, 12_000, 1, { unit: "Hz", scale: "log" }),
            parameter("trimDb", "Trim", -18, 6, -6, 0.1, { unit: "dB" }),
        ],
    },
] as const satisfies readonly SeqFxEffectDefinition[];

export const SEQFX_EFFECT_DEFINITIONS: readonly SeqFxEffectDefinition[] = definitions;
export const SEQFX_EFFECT_IDS = definitions.map((definition) => definition.id) as readonly SeqFxEffectType[];
export const SEQFX_SELECTABLE_EFFECT_IDS = SEQFX_EFFECT_IDS.filter(
    (effectType) => effectType !== SEQFX_EFFECT_TYPES.empty,
);

const definitionByID = new Map<SeqFxEffectType, SeqFxEffectDefinition>(
    definitions.map((definition) => [definition.id, definition]),
);

export const SEQFX_EFFECT_TYPE_NAMES = Object.fromEntries(
    definitions.map((definition) => [definition.id, definition.name]),
) as Record<SeqFxEffectType, string>;

export const SEQFX_EFFECT_TYPE_SHORT_NAMES = Object.fromEntries(
    definitions.map((definition) => [definition.id, definition.shortName]),
) as Record<SeqFxEffectType, string>;

export function isSeqFxEffectType(value: unknown): value is SeqFxEffectType {
    return typeof value === "number" && Number.isInteger(value) && definitionByID.has(value as SeqFxEffectType);
}

export function getSeqFxEffectDefinition(effectType: number): SeqFxEffectDefinition {
    return definitionByID.get(effectType as SeqFxEffectType) ?? definitionByID.get(SEQFX_EFFECT_TYPES.empty)!;
}

export function getSeqFxDefaultParams(effectType: number): number[] {
    const definition = getSeqFxEffectDefinition(effectType);
    return Array.from({ length: SEQFX_PARAM_COUNT }, (_unused, index) => (
        definition.parameters[index]?.defaultValue ?? 0
    ));
}

export function getSeqFxParamLimits(effectType: number, paramIndex: number): readonly [number, number] {
    const definition = getSeqFxEffectDefinition(effectType);
    const parameterDefinition = definition.parameters[paramIndex];
    return parameterDefinition
        ? [parameterDefinition.min, parameterDefinition.max]
        : [0, 0];
}

export function isSeqFxIntegerParam(effectType: number, paramIndex: number): boolean {
    return getSeqFxEffectDefinition(effectType).parameters[paramIndex]?.integer ?? false;
}

export function isSeqFxTriggerLatchedDefinition(effectType: number, paramIndex: number): boolean {
    return getSeqFxEffectDefinition(effectType).parameters[paramIndex]?.latch === "trigger";
}
