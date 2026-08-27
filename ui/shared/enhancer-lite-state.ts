import {
    ENHANCER_CURVES,
    ENHANCER_MODES,
    ENHANCER_SATURATION_MODES,
    type EnhancerCurve,
    type EnhancerMode,
    type EnhancerSaturationMode,
} from "./enhancer-state";

/** Self-identifying state document for the isolated one-band prototype. */
export const ENHANCER_LITE_STATE_FORMAT = "cosimo.enhancer-lite";

/** Current persisted Enhancer Lite state version. */
export const ENHANCER_LITE_STATE_VERSION = 1;

/** Complete saved sound and routing state for the one-band prototype. */
export type EnhancerLiteState = {
    readonly format: typeof ENHANCER_LITE_STATE_FORMAT;
    readonly version: 1;
    readonly freqHz: number;
    readonly q: number;
    readonly mode: EnhancerMode;
    readonly midAmount: number;
    readonly sideAmount: number;
    readonly curve: EnhancerCurve;
    readonly saturationMode: EnhancerSaturationMode;
};

/** A saved one-band setting identity. */
export type EnhancerLiteSettingID = Exclude<keyof EnhancerLiteState, "format" | "version">;

/** One static setting in the prototype's host-state contract. */
export type EnhancerLiteSettingDescriptor =
    | {
        readonly kind: "number";
        readonly id: EnhancerLiteSettingID;
        readonly dspEndpointID: string;
        readonly min: number;
        readonly max: number;
        readonly initial: number;
        readonly unit: "Hz" | "";
        readonly exposure: "static-preset";
    }
    | {
        readonly kind: "mode";
        readonly id: EnhancerLiteSettingID;
        readonly dspEndpointID: string;
        readonly initial: EnhancerMode;
        readonly choices: typeof ENHANCER_MODES;
        readonly exposure: "static-preset";
    }
    | {
        readonly kind: "curve";
        readonly id: EnhancerLiteSettingID;
        readonly dspEndpointID: string;
        readonly initial: EnhancerCurve;
        readonly choices: typeof ENHANCER_CURVES;
        readonly exposure: "static-preset";
    }
    | {
        readonly kind: "saturation-mode";
        readonly id: EnhancerLiteSettingID;
        readonly dspEndpointID: string;
        readonly initial: EnhancerSaturationMode;
        readonly choices: typeof ENHANCER_SATURATION_MODES;
        readonly exposure: "static-preset";
    };

/** Numeric values sent to the isolated Cmajor graph. */
export type EnhancerLiteDspSettings = {
    readonly freqHzIn: number;
    readonly qIn: number;
    readonly modeIn: 0 | 1;
    readonly midAmountIn: number;
    readonly sideAmountIn: number;
    readonly curveIn: 0 | 1;
    readonly saturationModeIn: 0 | 1;
};

/** Result of parsing unknown persisted prototype state. */
export type EnhancerLiteStateParseOutcome =
    | { readonly _tag: "ok"; readonly value: EnhancerLiteState }
    | { readonly _tag: "err"; readonly message: string };

type ParseFailure = Extract<EnhancerLiteStateParseOutcome, { readonly _tag: "err" }>;

/** Stable descriptors for every saved, non-modulatable prototype setting. */
export const ENHANCER_LITE_SETTING_DESCRIPTORS = [
    {
        kind: "number",
        id: "freqHz",
        dspEndpointID: "freqHzIn",
        min: 20,
        max: 20_000,
        initial: 130,
        unit: "Hz",
        exposure: "static-preset",
    },
    {
        kind: "number",
        id: "q",
        dspEndpointID: "qIn",
        min: 0.1,
        max: 10,
        initial: 0.71,
        unit: "",
        exposure: "static-preset",
    },
    {
        kind: "mode",
        id: "mode",
        dspEndpointID: "modeIn",
        initial: "stereo",
        choices: ENHANCER_MODES,
        exposure: "static-preset",
    },
    {
        kind: "number",
        id: "midAmount",
        dspEndpointID: "midAmountIn",
        min: 0,
        max: 1,
        initial: 0,
        unit: "",
        exposure: "static-preset",
    },
    {
        kind: "number",
        id: "sideAmount",
        dspEndpointID: "sideAmountIn",
        min: 0,
        max: 1,
        initial: 0,
        unit: "",
        exposure: "static-preset",
    },
    {
        kind: "curve",
        id: "curve",
        dspEndpointID: "curveIn",
        initial: "solid",
        choices: ENHANCER_CURVES,
        exposure: "static-preset",
    },
    {
        kind: "saturation-mode",
        id: "saturationMode",
        dspEndpointID: "saturationModeIn",
        initial: "subtle",
        choices: ENHANCER_SATURATION_MODES,
        exposure: "static-preset",
    },
] as const satisfies ReadonlyArray<EnhancerLiteSettingDescriptor>;

const ENHANCER_LITE_STATE_KEYS = [
    "format",
    "version",
    ...ENHANCER_LITE_SETTING_DESCRIPTORS.map(({ id }) => id),
] as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactlyStateKeys(record: Readonly<Record<string, unknown>>): boolean {
    const ownKeys = Reflect.ownKeys(record);
    return ownKeys.length === ENHANCER_LITE_STATE_KEYS.length
        && ownKeys.every((key) => (
            typeof key === "string"
            && ENHANCER_LITE_STATE_KEYS.some((candidate) => candidate === key)
        ));
}

function parseNumber(
    record: Readonly<Record<string, unknown>>,
    id: "freqHz" | "q" | "midAmount" | "sideAmount",
    min: number,
    max: number,
): number | ParseFailure {
    const value = record[id];
    if (typeof value !== "number" || !Number.isFinite(value))
        return { _tag: "err", message: `${id} must be a finite number.` };

    if (value < min || value > max)
        return { _tag: "err", message: `${id} must be within ${min}..${max}.` };

    return value;
}

function parseMode(value: unknown): EnhancerMode | ParseFailure {
    return value === "stereo" || value === "mid-side"
        ? value
        : { _tag: "err", message: "mode must be Stereo or Mid/Side." };
}

function parseCurve(value: unknown): EnhancerCurve | ParseFailure {
    return value === "tube" || value === "solid"
        ? value
        : { _tag: "err", message: "curve must be Tube or Solid." };
}

function parseSaturationMode(value: unknown): EnhancerSaturationMode | ParseFailure {
    return value === "subtle" || value === "medium"
        ? value
        : { _tag: "err", message: "saturationMode must be Subtle or Medium." };
}

function isFailure(value: unknown): value is ParseFailure {
    return isRecord(value) && value._tag === "err" && typeof value.message === "string";
}

/** Create the prototype defaults without sharing mutable state. */
export function createDefaultEnhancerLiteState(): EnhancerLiteState {
    return {
        format: ENHANCER_LITE_STATE_FORMAT,
        version: ENHANCER_LITE_STATE_VERSION,
        freqHz: 130,
        q: 0.71,
        mode: "stereo",
        midAmount: 0,
        sideAmount: 0,
        curve: "solid",
        saturationMode: "subtle",
    };
}

/** Parse a JSON string or unknown value into the exact v1 state shape. */
export function parseEnhancerLiteState(input: unknown): EnhancerLiteStateParseOutcome {
    let document = input;
    if (typeof input === "string") {
        try {
            document = JSON.parse(input);
        } catch (cause: unknown) {
            const detail = cause instanceof Error ? cause.message : String(cause);
            return { _tag: "err", message: `Enhancer Lite state is not valid JSON: ${detail}` };
        }
    }

    if (!isRecord(document) || !hasExactlyStateKeys(document))
        return { _tag: "err", message: "Enhancer Lite state has the wrong keys." };

    if (document.format !== ENHANCER_LITE_STATE_FORMAT
        || document.version !== ENHANCER_LITE_STATE_VERSION) {
        return { _tag: "err", message: "Enhancer Lite state format or version is unsupported." };
    }

    const freqHz = parseNumber(document, "freqHz", 20, 20_000);
    const q = parseNumber(document, "q", 0.1, 10);
    const midAmount = parseNumber(document, "midAmount", 0, 1);
    const sideAmount = parseNumber(document, "sideAmount", 0, 1);
    const mode = parseMode(document.mode);
    const curve = parseCurve(document.curve);
    const saturationMode = parseSaturationMode(document.saturationMode);
    for (const result of [freqHz, q, midAmount, sideAmount, mode, curve, saturationMode]) {
        if (isFailure(result))
            return result;
    }

    if (typeof freqHz !== "number"
        || typeof q !== "number"
        || typeof midAmount !== "number"
        || typeof sideAmount !== "number"
        || (mode !== "stereo" && mode !== "mid-side")
        || (curve !== "tube" && curve !== "solid")
        || (saturationMode !== "subtle" && saturationMode !== "medium")) {
        return { _tag: "err", message: "Enhancer Lite state refinement failed." };
    }

    return {
        _tag: "ok",
        value: {
            format: ENHANCER_LITE_STATE_FORMAT,
            version: ENHANCER_LITE_STATE_VERSION,
            freqHz,
            q,
            mode,
            midAmount,
            sideAmount,
            curve,
            saturationMode,
        },
    };
}

/** Serialize an already parsed state document. */
export function serializeEnhancerLiteState(state: EnhancerLiteState): string {
    return JSON.stringify(state);
}

/** Project saved state into the Cmajor graph's endpoint values. */
export function toEnhancerLiteDspSettings(state: EnhancerLiteState): EnhancerLiteDspSettings {
    return {
        freqHzIn: state.freqHz,
        qIn: state.q,
        modeIn: state.mode === "mid-side" ? 1 : 0,
        midAmountIn: state.midAmount,
        sideAmountIn: state.sideAmount,
        curveIn: state.curve === "solid" ? 1 : 0,
        saturationModeIn: state.saturationMode === "medium" ? 1 : 0,
    };
}
