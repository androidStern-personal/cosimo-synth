/** Self-identifying format of the isolated, T28-embeddable state document. */
export const ENHANCER_STATE_FORMAT = "cosimo.enhancer";

/** Current persisted Enhancer state version. */
export const ENHANCER_STATE_VERSION = 2;

/** The two locked nonlinear character choices. */
export const ENHANCER_CURVES = ["tube", "solid"] as const;

/** A saved Enhancer band character. */
export type EnhancerCurve = typeof ENHANCER_CURVES[number];

/** The independently saved routing domain for each band. */
export const ENHANCER_MODES = ["stereo", "mid-side"] as const;

/** A saved Enhancer band routing domain. */
export type EnhancerMode = typeof ENHANCER_MODES[number];

/** Ten sound settings plus two routing modes, all preset-persisted. */
export type EnhancerState = {
    readonly format: typeof ENHANCER_STATE_FORMAT;
    readonly version: 2;
    readonly b1FreqHz: number;
    readonly b1Q: number;
    readonly b1Mode: EnhancerMode;
    readonly b1MidAmount: number;
    readonly b1SideAmount: number;
    readonly b1Curve: EnhancerCurve;
    readonly b2FreqHz: number;
    readonly b2Q: number;
    readonly b2Mode: EnhancerMode;
    readonly b2MidAmount: number;
    readonly b2SideAmount: number;
    readonly b2Curve: EnhancerCurve;
};

/** A setting identity in the stable T26 persistence contract. */
export type EnhancerSettingID = Exclude<keyof EnhancerState, "format" | "version">;

/** A numeric setting descriptor consumed by the eventual T28 composition/UI. */
export type EnhancerNumberSettingDescriptor = {
    readonly kind: "number";
    readonly id: EnhancerSettingID;
    readonly dspEndpointID: string;
    readonly min: number;
    readonly max: number;
    readonly initial: number;
    readonly unit: "Hz" | "";
    readonly exposure: "static-preset";
};

/** A discrete Tube/Solid descriptor consumed by the eventual T28 composition/UI. */
export type EnhancerCurveSettingDescriptor = {
    readonly kind: "curve";
    readonly id: EnhancerSettingID;
    readonly dspEndpointID: string;
    readonly initial: EnhancerCurve;
    readonly choices: typeof ENHANCER_CURVES;
    readonly exposure: "static-preset";
};

/** A discrete Stereo/Mid-Side routing descriptor. */
export type EnhancerModeSettingDescriptor = {
    readonly kind: "mode";
    readonly id: EnhancerSettingID;
    readonly dspEndpointID: string;
    readonly initial: EnhancerMode;
    readonly choices: typeof ENHANCER_MODES;
    readonly exposure: "static-preset";
};

/** One entry in the fixed Enhancer sound-and-routing contract. */
export type EnhancerSettingDescriptor =
    | EnhancerNumberSettingDescriptor
    | EnhancerModeSettingDescriptor
    | EnhancerCurveSettingDescriptor;

/** Result of parsing unknown persisted Enhancer state. */
export type EnhancerStateParseOutcome =
    | { readonly _tag: "ok"; readonly value: EnhancerState }
    | { readonly _tag: "err"; readonly message: string };

type ParseFailure = Extract<EnhancerStateParseOutcome, { readonly _tag: "err" }>;

type JsonParseOutcome =
    | { readonly _tag: "ok"; readonly value: unknown }
    | ParseFailure;

/** Numeric values forwarded to the isolated Cmajor processor. */
export type EnhancerDspSettings = {
    readonly b1FreqHzIn: number;
    readonly b1QIn: number;
    readonly b1ModeIn: 0 | 1;
    readonly b1MidAmountIn: number;
    readonly b1SideAmountIn: number;
    readonly b1CurveIn: 0 | 1;
    readonly b2FreqHzIn: number;
    readonly b2QIn: number;
    readonly b2ModeIn: 0 | 1;
    readonly b2MidAmountIn: number;
    readonly b2SideAmountIn: number;
    readonly b2CurveIn: 0 | 1;
};

/** Stable descriptors for all static, saved, non-modulatable settings. */
export const ENHANCER_SETTING_DESCRIPTORS = [
    {
        kind: "number",
        id: "b1FreqHz",
        dspEndpointID: "b1FreqHzIn",
        min: 30,
        max: 16000,
        initial: 130,
        unit: "Hz",
        exposure: "static-preset",
    },
    {
        kind: "number",
        id: "b1Q",
        dspEndpointID: "b1QIn",
        min: 0.3,
        max: 8,
        initial: 0.71,
        unit: "",
        exposure: "static-preset",
    },
    {
        kind: "mode",
        id: "b1Mode",
        dspEndpointID: "b1ModeIn",
        initial: "stereo",
        choices: ENHANCER_MODES,
        exposure: "static-preset",
    },
    {
        kind: "number",
        id: "b1MidAmount",
        dspEndpointID: "b1MidAmountIn",
        min: 0,
        max: 1,
        initial: 0,
        unit: "",
        exposure: "static-preset",
    },
    {
        kind: "number",
        id: "b1SideAmount",
        dspEndpointID: "b1SideAmountIn",
        min: 0,
        max: 1,
        initial: 0,
        unit: "",
        exposure: "static-preset",
    },
    {
        kind: "curve",
        id: "b1Curve",
        dspEndpointID: "b1CurveIn",
        initial: "solid",
        choices: ENHANCER_CURVES,
        exposure: "static-preset",
    },
    {
        kind: "number",
        id: "b2FreqHz",
        dspEndpointID: "b2FreqHzIn",
        min: 30,
        max: 16000,
        initial: 9000,
        unit: "Hz",
        exposure: "static-preset",
    },
    {
        kind: "number",
        id: "b2Q",
        dspEndpointID: "b2QIn",
        min: 0.3,
        max: 8,
        initial: 0.71,
        unit: "",
        exposure: "static-preset",
    },
    {
        kind: "mode",
        id: "b2Mode",
        dspEndpointID: "b2ModeIn",
        initial: "stereo",
        choices: ENHANCER_MODES,
        exposure: "static-preset",
    },
    {
        kind: "number",
        id: "b2MidAmount",
        dspEndpointID: "b2MidAmountIn",
        min: 0,
        max: 1,
        initial: 0,
        unit: "",
        exposure: "static-preset",
    },
    {
        kind: "number",
        id: "b2SideAmount",
        dspEndpointID: "b2SideAmountIn",
        min: 0,
        max: 1,
        initial: 0,
        unit: "",
        exposure: "static-preset",
    },
    {
        kind: "curve",
        id: "b2Curve",
        dspEndpointID: "b2CurveIn",
        initial: "tube",
        choices: ENHANCER_CURVES,
        exposure: "static-preset",
    },
] as const satisfies ReadonlyArray<EnhancerSettingDescriptor>;

const ENHANCER_STATE_KEYS = [
    "format",
    "version",
    ...ENHANCER_SETTING_DESCRIPTORS.map(({ id }) => id),
] as const;

const ENHANCER_V1_STATE_KEYS = [
    "format",
    "version",
    ...ENHANCER_SETTING_DESCRIPTORS
        .filter(({ kind }) => kind !== "mode")
        .map(({ id }) => id),
] as const;

type NumberParseOutcome =
    | { readonly _tag: "ok"; readonly value: number }
    | { readonly _tag: "err"; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNumberInRange(
    record: Readonly<Record<string, unknown>>,
    id: string,
    min: number,
    max: number,
): NumberParseOutcome {
    const value = record[id];
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return { _tag: "err", message: `${id} must be a finite number.` };
    }
    if (value < min || value > max) {
        return { _tag: "err", message: `${id} must be within ${min}..${max}.` };
    }
    return { _tag: "ok", value };
}

function parseCurve(value: unknown, id: string): EnhancerCurve | ParseFailure {
    if (value === "tube" || value === "solid") {
        return value;
    }
    return { _tag: "err", message: `${id} must be Tube or Solid.` };
}

function parseMode(value: unknown, id: string): EnhancerMode | ParseFailure {
    if (value === "stereo" || value === "mid-side") {
        return value;
    }
    return { _tag: "err", message: `${id} must be Stereo or Mid/Side.` };
}

function hasExactlyKeys(
    record: Readonly<Record<string, unknown>>,
    expectedKeys: ReadonlyArray<string>,
): boolean {
    const ownKeys = Reflect.ownKeys(record);
    return ownKeys.length === expectedKeys.length
        && ownKeys.every((key) => (
            typeof key === "string" && expectedKeys.some((candidate) => candidate === key)
        ));
}

function parseJson(input: string): JsonParseOutcome {
    try {
        return { _tag: "ok", value: JSON.parse(input) };
    } catch (cause: unknown) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        return { _tag: "err", message: `Enhancer state is not valid JSON: ${detail}` };
    }
}

/** Create the locked T26 defaults without sharing mutable state. */
export function createDefaultEnhancerState(): EnhancerState {
    return {
        format: ENHANCER_STATE_FORMAT,
        version: ENHANCER_STATE_VERSION,
        b1FreqHz: 130,
        b1Q: 0.71,
        b1Mode: "stereo",
        b1MidAmount: 0,
        b1SideAmount: 0,
        b1Curve: "solid",
        b2FreqHz: 9000,
        b2Q: 0.71,
        b2Mode: "stereo",
        b2MidAmount: 0,
        b2SideAmount: 0,
        b2Curve: "tube",
    };
}

/** Parse a strict, complete Enhancer state document from persistence. */
export function parseEnhancerState(input: unknown): EnhancerStateParseOutcome {
    let document = input;
    if (typeof input === "string") {
        const jsonOutcome = parseJson(input);
        if (jsonOutcome._tag === "err") {
            return jsonOutcome;
        }
        document = jsonOutcome.value;
    }
    if (!isRecord(document)) {
        return { _tag: "err", message: "Enhancer state must be an object." };
    }

    if (document.format !== ENHANCER_STATE_FORMAT) {
        return { _tag: "err", message: `Enhancer state format must be ${ENHANCER_STATE_FORMAT}.` };
    }
    const isLegacyV1 = document.version === 1;
    if (!isLegacyV1 && document.version !== ENHANCER_STATE_VERSION) {
        return { _tag: "err", message: `Enhancer state version must be 1 or ${ENHANCER_STATE_VERSION}.` };
    }
    const expectedKeys = isLegacyV1 ? ENHANCER_V1_STATE_KEYS : ENHANCER_STATE_KEYS;
    if (!hasExactlyKeys(document, expectedKeys)) {
        return {
            _tag: "err",
            message: isLegacyV1
                ? "Enhancer v1 state must contain exactly format, version, and its ten sound settings."
                : "Enhancer state must contain exactly format, version, ten sound settings, and two routing modes.",
        };
    }

    const b1FreqHz = parseNumberInRange(document, "b1FreqHz", 30, 16000);
    const b1Q = parseNumberInRange(document, "b1Q", 0.3, 8);
    const b1MidAmount = parseNumberInRange(document, "b1MidAmount", 0, 1);
    const b1SideAmount = parseNumberInRange(document, "b1SideAmount", 0, 1);
    const b2FreqHz = parseNumberInRange(document, "b2FreqHz", 30, 16000);
    const b2Q = parseNumberInRange(document, "b2Q", 0.3, 8);
    const b2MidAmount = parseNumberInRange(document, "b2MidAmount", 0, 1);
    const b2SideAmount = parseNumberInRange(document, "b2SideAmount", 0, 1);
    const numberOutcomes = [
        b1FreqHz,
        b1Q,
        b1MidAmount,
        b1SideAmount,
        b2FreqHz,
        b2Q,
        b2MidAmount,
        b2SideAmount,
    ];
    const numberFailure = numberOutcomes.find((outcome) => outcome._tag === "err");
    if (numberFailure !== undefined && numberFailure._tag === "err") {
        return numberFailure;
    }

    const b1Curve = parseCurve(document.b1Curve, "b1Curve");
    if (typeof b1Curve !== "string") {
        return b1Curve;
    }
    const b2Curve = parseCurve(document.b2Curve, "b2Curve");
    if (typeof b2Curve !== "string") {
        return b2Curve;
    }
    const b1Mode = isLegacyV1 ? "mid-side" : parseMode(document.b1Mode, "b1Mode");
    if (typeof b1Mode !== "string") {
        return b1Mode;
    }
    const b2Mode = isLegacyV1 ? "mid-side" : parseMode(document.b2Mode, "b2Mode");
    if (typeof b2Mode !== "string") {
        return b2Mode;
    }

    if (b1FreqHz._tag === "err" || b1Q._tag === "err"
        || b1MidAmount._tag === "err" || b1SideAmount._tag === "err"
        || b2FreqHz._tag === "err" || b2Q._tag === "err"
        || b2MidAmount._tag === "err" || b2SideAmount._tag === "err") {
        return { _tag: "err", message: "Enhancer numeric state parsing failed." };
    }

    return {
        _tag: "ok",
        value: {
            format: ENHANCER_STATE_FORMAT,
            version: ENHANCER_STATE_VERSION,
            b1FreqHz: b1FreqHz.value,
            b1Q: b1Q.value,
            b1Mode,
            b1MidAmount: b1MidAmount.value,
            b1SideAmount: b1SideAmount.value,
            b1Curve,
            b2FreqHz: b2FreqHz.value,
            b2Q: b2Q.value,
            b2Mode,
            b2MidAmount: b2MidAmount.value,
            b2SideAmount: b2SideAmount.value,
            b2Curve,
        },
    };
}

/** Serialize an already parsed Enhancer state document. */
export function serializeEnhancerState(state: EnhancerState): string {
    return JSON.stringify({
        format: state.format,
        version: state.version,
        b1FreqHz: state.b1FreqHz,
        b1Q: state.b1Q,
        b1Mode: state.b1Mode,
        b1MidAmount: state.b1MidAmount,
        b1SideAmount: state.b1SideAmount,
        b1Curve: state.b1Curve,
        b2FreqHz: state.b2FreqHz,
        b2Q: state.b2Q,
        b2Mode: state.b2Mode,
        b2MidAmount: state.b2MidAmount,
        b2SideAmount: state.b2SideAmount,
        b2Curve: state.b2Curve,
    });
}

/** Project persisted character names and values onto the Cmajor input contract. */
export function toEnhancerDspSettings(state: EnhancerState): EnhancerDspSettings {
    return {
        b1FreqHzIn: state.b1FreqHz,
        b1QIn: state.b1Q,
        b1ModeIn: state.b1Mode === "mid-side" ? 1 : 0,
        b1MidAmountIn: state.b1MidAmount,
        b1SideAmountIn: state.b1SideAmount,
        b1CurveIn: state.b1Curve === "solid" ? 1 : 0,
        b2FreqHzIn: state.b2FreqHz,
        b2QIn: state.b2Q,
        b2ModeIn: state.b2Mode === "mid-side" ? 1 : 0,
        b2MidAmountIn: state.b2MidAmount,
        b2SideAmountIn: state.b2SideAmount,
        b2CurveIn: state.b2Curve === "solid" ? 1 : 0,
    };
}
