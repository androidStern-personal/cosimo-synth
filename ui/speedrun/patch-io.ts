import {
    ARTICULATIONS_V4_STATE_KEY,
    createEmptyArticulationsState,
    parseArticulationsV4,
    type ArticulationsState,
} from "../shared/articulation-image";
import type { PatchConnectionLike } from "../shared/cmajor-react";
import {
    normalizeEffectPresetV2,
    type EffectPresetV2,
} from "../shared/effects/effect-preset-v2";
import type {
    EffectParameterContract,
    EffectPluginStateContract,
} from "../shared/effects/effect-state-contract";
import { buildSynthPresetMigrations } from "../shared/effects/synth-preset-migrations";
import { LANE_STATE_KEY } from "../shared/lane-state";
import {
    createDefaultLaneStateV2,
    parseLaneStateV2Compat,
    type LaneStateV2,
} from "../shared/lane-state-v2";
import {
    MODULATION_STATE_KEY,
    createDefaultModulationState,
    deserializeModulationState,
    type ModulationState,
} from "../shared/modulation";
import { getModulationArticulationCellIndex } from "../shared/modulation-runtime-program";
import {
    parseSoundShareEnvelope,
    type SoundShareEnvelopeV2,
} from "../shared/sound-share-envelope";

// bounce/document.mjs owns this key; restated here because that module is
// untyped and importing it would add an implicit-any boundary.
const BOUNCE_STATE_KEY = "bounce.v1";

const BROWSER_PATCH_STATE_FORMAT = "cosimo.browserPatchState";
const BROWSER_PATCH_STATE_VERSION = 4;
const SPEEDRUN_BOUNCE_REFUSAL = "Speedrun videos for bounced sounds come later";

export type EndpointAnnotation = {
    readonly endpointID: string;
    readonly name: string;
    readonly min: number | null;
    readonly max: number | null;
    readonly step: number | null;
    readonly unit: string | null;
    readonly text: string | null;
    readonly discrete: boolean;
    readonly defaultValue: number;
};

export type PatchDocument = {
    readonly label: string;
    readonly contractHash: string;
    readonly parameters: Readonly<Record<string, number>>;
    readonly modulation: ModulationState;
    readonly lane: LaneStateV2;
    readonly articulations: ArticulationsState;
};

export type DefaultsSnapshot = {
    readonly contractHash: string;
    readonly parameters: Readonly<Record<string, number>>;
    readonly annotations: Readonly<Record<string, EndpointAnnotation>>;
    readonly modulation: ModulationState;
    readonly lane: LaneStateV2;
    readonly articulations: ArticulationsState;
};

export type ParameterEndpointMetadata = {
    readonly endpointID?: unknown;
    readonly purpose?: unknown;
    readonly annotation?: unknown;
};

export type PatchIntakeOptions = {
    readonly currentContract: EffectPluginStateContract;
    readonly inputEndpoints?: ReadonlyArray<ParameterEndpointMetadata>;
};

export type PatchIntakeErrorTag =
    | "UnknownShape"
    | "MigrationFailed"
    | "InvalidParameters"
    | "InvalidModulation"
    | "InvalidLane"
    | "InvalidArticulations"
    | "BouncedSoundUnsupported"
    | "CaptureUnavailable"
    | "CaptureTimedOut";

export class PatchIntakeError extends Error {
    constructor(
        readonly _tag: PatchIntakeErrorTag,
        message: string,
        options: { readonly cause?: unknown } = {},
    ) {
        super(message, options);
        this.name = "PatchIntakeError";
    }
}

export type PatchIntakeResult =
    | { readonly ok: true; readonly value: { readonly document: PatchDocument; readonly defaults: DefaultsSnapshot } }
    | { readonly ok: false; readonly error: PatchIntakeError };

type BarePatch = {
    readonly label: string;
    readonly parameters: Readonly<Record<string, unknown>>;
    readonly storedState: Readonly<Record<string, unknown>>;
    readonly laneValue: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readEndpointAnnotation(
    parameter: EffectParameterContract,
    inputEndpoints: ReadonlyArray<ParameterEndpointMetadata>,
): EndpointAnnotation {
    const endpoint = inputEndpoints.find((candidate) => candidate.endpointID === parameter.endpointID);
    const rawAnnotation = endpoint && isRecord(endpoint.annotation) ? endpoint.annotation : {};
    const defaultValue = finiteNumber(parameter.defaultValue);
    if (defaultValue === null) {
        throw new PatchIntakeError(
            "InvalidParameters",
            `Speedrun parameter ${parameter.endpointID} must have a numeric default.`,
        );
    }

    return {
        endpointID: parameter.endpointID,
        name: typeof rawAnnotation.name === "string" && rawAnnotation.name.trim().length > 0
            ? rawAnnotation.name.trim()
            : parameter.endpointID,
        min: finiteNumber(rawAnnotation.min ?? parameter.min),
        max: finiteNumber(rawAnnotation.max ?? parameter.max),
        step: finiteNumber(rawAnnotation.step ?? parameter.step),
        unit: typeof rawAnnotation.unit === "string" ? rawAnnotation.unit : null,
        text: typeof rawAnnotation.text === "string"
            ? rawAnnotation.text
            : parameter.text ?? null,
        discrete: rawAnnotation.discrete === true
            || parameter.discrete === true
            || parameter.type === "integer",
        defaultValue,
    };
}

export function createDefaultsSnapshot({
    currentContract,
    inputEndpoints = [],
}: PatchIntakeOptions): DefaultsSnapshot {
    const annotations = Object.fromEntries(currentContract.parameters.map((parameter) => {
        const annotation = readEndpointAnnotation(parameter, inputEndpoints);
        return [parameter.endpointID, annotation];
    }));
    const parameters = Object.fromEntries(Object.values(annotations).map((annotation) => (
        [annotation.endpointID, annotation.defaultValue]
    )));

    return {
        contractHash: currentContract.hash,
        parameters,
        annotations,
        modulation: createDefaultModulationState(),
        lane: createDefaultLaneStateV2(),
        articulations: createEmptyArticulationsState(),
    };
}

function decimalSafe(value: number): number {
    return Number(value.toPrecision(15));
}

function normalizeParameterValue(value: unknown, annotation: EndpointAnnotation): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new PatchIntakeError(
            "InvalidParameters",
            `${annotation.endpointID} must be a finite number.`,
        );
    }

    let normalized = value;
    if (annotation.min !== null) normalized = Math.max(annotation.min, normalized);
    if (annotation.max !== null) normalized = Math.min(annotation.max, normalized);
    if (annotation.discrete) {
        const step = annotation.step && annotation.step > 0 ? annotation.step : 1;
        const origin = annotation.min ?? 0;
        normalized = origin + Math.round((normalized - origin) / step) * step;
        if (annotation.min !== null) normalized = Math.max(annotation.min, normalized);
        if (annotation.max !== null) normalized = Math.min(annotation.max, normalized);
        normalized = decimalSafe(normalized);
    }
    return normalized;
}

function normalizeBareParameters(
    rawParameters: Readonly<Record<string, unknown>>,
    defaults: DefaultsSnapshot,
): Record<string, number> {
    const knownEndpointIDs = new Set(Object.keys(defaults.annotations));
    const unknownEndpointIDs = Object.keys(rawParameters).filter((endpointID) => !knownEndpointIDs.has(endpointID));
    if (unknownEndpointIDs.length > 0) {
        throw new PatchIntakeError(
            "InvalidParameters",
            `Unknown speedrun parameter: ${unknownEndpointIDs.join(", ")}.`,
        );
    }

    return Object.fromEntries(Object.values(defaults.annotations).map((annotation) => [
        annotation.endpointID,
        normalizeParameterValue(
            Object.hasOwn(rawParameters, annotation.endpointID)
                ? rawParameters[annotation.endpointID]
                : annotation.defaultValue,
            annotation,
        ),
    ]));
}

function exactPresetParameters(
    preset: EffectPresetV2,
    defaults: DefaultsSnapshot,
): Record<string, number> {
    return Object.fromEntries(Object.values(defaults.annotations).map((annotation) => {
        const value = preset.parameters[annotation.endpointID];
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new PatchIntakeError(
                "InvalidParameters",
                `${annotation.endpointID} must be a finite number.`,
            );
        }
        return [annotation.endpointID, value];
    }));
}

function decodeJSONString(value: unknown): unknown {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function parseLane(value: unknown, defaults: DefaultsSnapshot): LaneStateV2 {
    if (value === undefined) return defaults.lane;
    const parsed = parseLaneStateV2Compat(value);
    if (parsed._tag === "err") {
        throw new PatchIntakeError("InvalidLane", parsed.message);
    }
    return parsed.value;
}

function parseModulation(value: unknown, defaults: DefaultsSnapshot): ModulationState {
    if (value === undefined) return defaults.modulation;
    try {
        return deserializeModulationState(value);
    } catch (cause) {
        throw new PatchIntakeError(
            "InvalidModulation",
            cause instanceof Error ? cause.message : "The modulation document is invalid.",
            { cause },
        );
    }
}

function parseArticulations(
    value: unknown,
    modulation: ModulationState,
    defaults: DefaultsSnapshot,
): ArticulationsState {
    if (value === undefined) return defaults.articulations;
    const acceptedRouteIds = new Set(modulation.routes.flatMap((route) => (
        getModulationArticulationCellIndex(route) === null ? [] : [route.id]
    )));
    const parsed = parseArticulationsV4(decodeJSONString(value), acceptedRouteIds);
    if (parsed._tag === "err") {
        throw new PatchIntakeError("InvalidArticulations", parsed.error.message, { cause: parsed.error });
    }
    return parsed.value;
}

function ensureOscillatorMode(parameters: Readonly<Record<string, number>>, bounceState: unknown): void {
    if (parameters.sourceMode === 1 || (bounceState !== null && bounceState !== undefined)) {
        throw new PatchIntakeError("BouncedSoundUnsupported", SPEEDRUN_BOUNCE_REFUSAL);
    }
}

function requireShareLane(envelope: SoundShareEnvelopeV2): unknown {
    const keys = Object.keys(envelope.supplementalStoredState);
    if (keys.length !== 1 || keys[0] !== LANE_STATE_KEY) {
        throw new PatchIntakeError(
            "InvalidLane",
            `Shared sound must carry exactly ${LANE_STATE_KEY} as supplemental state.`,
        );
    }
    return envelope.supplementalStoredState[LANE_STATE_KEY];
}

function browserOrBarePatch(input: Record<string, unknown>): BarePatch | null {
    if (input.format === BROWSER_PATCH_STATE_FORMAT) {
        if (input.version !== BROWSER_PATCH_STATE_VERSION || !isRecord(input.sound)) return null;
        if (!isRecord(input.sound.parameters) || !isRecord(input.sound.storedState)) return null;
        return {
            label: "Current Sound",
            parameters: input.sound.parameters,
            storedState: input.sound.storedState,
            laneValue: input.sound.storedState[LANE_STATE_KEY],
        };
    }
    if (!isRecord(input.parameters) || !isRecord(input.storedState)) return null;
    return {
        label: typeof input.label === "string" && input.label.trim().length > 0
            ? input.label.trim()
            : "Current Sound",
        parameters: input.parameters,
        storedState: input.storedState,
        laneValue: input.storedState[LANE_STATE_KEY],
    };
}

function buildDocumentFromParts({
    label,
    parameters,
    storedState,
    laneValue,
    defaults,
}: {
    readonly label: string;
    readonly parameters: Record<string, number>;
    readonly storedState: Readonly<Record<string, unknown>>;
    readonly laneValue: unknown;
    readonly defaults: DefaultsSnapshot;
}): PatchDocument {
    const modulation = parseModulation(storedState[MODULATION_STATE_KEY], defaults);
    const articulations = parseArticulations(
        storedState[ARTICULATIONS_V4_STATE_KEY],
        modulation,
        defaults,
    );
    ensureOscillatorMode(parameters, storedState[BOUNCE_STATE_KEY]);
    return {
        label,
        contractHash: defaults.contractHash,
        parameters,
        modulation,
        lane: parseLane(laneValue, defaults),
        articulations,
    };
}

function errorFromUnknown(cause: unknown): PatchIntakeError {
    if (cause instanceof PatchIntakeError) return cause;
    return new PatchIntakeError(
        "MigrationFailed",
        cause instanceof Error ? cause.message : "The patch could not be normalized.",
        { cause },
    );
}

export function intakePatch(input: unknown, options: PatchIntakeOptions): PatchIntakeResult {
    try {
        const defaults = createDefaultsSnapshot(options);
        if (!isRecord(input)) {
            throw new PatchIntakeError("UnknownShape", "Speedrun patch input must be an object.");
        }

        const parsedEnvelope = input.format === "cosimo.soundShare"
            ? parseSoundShareEnvelope(input)
            : null;
        if (parsedEnvelope !== null) {
            if (!parsedEnvelope.ok) throw parsedEnvelope.error;
            const preset = normalizeEffectPresetV2(parsedEnvelope.value.preset, {
                currentContract: options.currentContract,
                migrations: buildSynthPresetMigrations(options.currentContract),
            });
            return {
                ok: true,
                value: {
                    defaults,
                    document: buildDocumentFromParts({
                        label: preset.label,
                        parameters: exactPresetParameters(preset, defaults),
                        storedState: preset.storedState,
                        laneValue: requireShareLane(parsedEnvelope.value),
                        defaults,
                    }),
                },
            };
        }

        if (input.kind === "cosimo.effectPreset") {
            const preset = normalizeEffectPresetV2(input, {
                currentContract: options.currentContract,
                migrations: buildSynthPresetMigrations(options.currentContract),
            });
            return {
                ok: true,
                value: {
                    defaults,
                    document: buildDocumentFromParts({
                        label: preset.label,
                        parameters: exactPresetParameters(preset, defaults),
                        storedState: preset.storedState,
                        laneValue: undefined,
                        defaults,
                    }),
                },
            };
        }

        const bare = browserOrBarePatch(input);
        if (bare === null) {
            throw new PatchIntakeError("UnknownShape", "Unknown speedrun patch input shape.");
        }
        const allowedStoredKeys = new Set([
            MODULATION_STATE_KEY,
            ARTICULATIONS_V4_STATE_KEY,
            BOUNCE_STATE_KEY,
            LANE_STATE_KEY,
        ]);
        const unknownStoredKeys = Object.keys(bare.storedState).filter((key) => !allowedStoredKeys.has(key));
        if (unknownStoredKeys.length > 0) {
            throw new PatchIntakeError(
                "UnknownShape",
                `Unknown speedrun stored state: ${unknownStoredKeys.join(", ")}.`,
            );
        }
        return {
            ok: true,
            value: {
                defaults,
                document: buildDocumentFromParts({
                    label: bare.label,
                    parameters: normalizeBareParameters(bare.parameters, defaults),
                    storedState: bare.storedState,
                    laneValue: bare.laneValue,
                    defaults,
                }),
            },
        };
    } catch (cause) {
        return { ok: false, error: errorFromUnknown(cause) };
    }
}

function storedStateValues(input: unknown): Record<string, unknown> {
    if (!isRecord(input)) return {};
    return isRecord(input.values) ? { ...input.values } : { ...input };
}

function soundStoredState(input: Readonly<Record<string, unknown>>): Record<string, unknown> {
    return Object.fromEntries([
        MODULATION_STATE_KEY,
        ARTICULATIONS_V4_STATE_KEY,
        BOUNCE_STATE_KEY,
        LANE_STATE_KEY,
    ].flatMap((key) => Object.hasOwn(input, key) ? [[key, input[key]]] : []));
}

function captureStoredState(connection: PatchConnectionLike, timeoutMs: number): Promise<Record<string, unknown>> {
    if (typeof connection.requestFullStoredState !== "function") {
        return Promise.reject(new PatchIntakeError(
            "CaptureUnavailable",
            "Current patch capture requires full stored-state reads.",
        ));
    }
    return new Promise((resolve, reject) => {
        const timeout = globalThis.setTimeout(() => reject(new PatchIntakeError(
            "CaptureTimedOut",
            "Timed out while reading current stored state.",
        )), timeoutMs);
        connection.requestFullStoredState?.((value) => {
            globalThis.clearTimeout(timeout);
            resolve(storedStateValues(value));
        });
    });
}

function captureParameters(
    connection: PatchConnectionLike,
    currentContract: EffectPluginStateContract,
    timeoutMs: number,
): Promise<Record<string, unknown>> {
    if (
        typeof connection.addParameterListener !== "function"
        || typeof connection.requestParameterValue !== "function"
    ) {
        return Promise.reject(new PatchIntakeError(
            "CaptureUnavailable",
            "Current patch capture requires parameter reads.",
        ));
    }
    return new Promise((resolve, reject) => {
        const values: Record<string, unknown> = {};
        const listeners = new Map<string, (value: unknown) => void>();
        const cleanup = () => {
            for (const [endpointID, listener] of listeners) {
                connection.removeParameterListener?.(endpointID, listener);
            }
        };
        const timeout = globalThis.setTimeout(() => {
            cleanup();
            reject(new PatchIntakeError(
                "CaptureTimedOut",
                "Timed out while reading current parameter values.",
            ));
        }, timeoutMs);

        const completeIfReady = () => {
            if (Object.keys(values).length !== currentContract.parameters.length) return;
            globalThis.clearTimeout(timeout);
            cleanup();
            resolve(values);
        };
        for (const parameter of currentContract.parameters) {
            const listener = (value: unknown) => {
                values[parameter.endpointID] = value;
                completeIfReady();
            };
            listeners.set(parameter.endpointID, listener);
            connection.addParameterListener?.(parameter.endpointID, listener);
        }
        for (const parameter of currentContract.parameters) {
            connection.requestParameterValue?.(parameter.endpointID);
        }
    });
}

/** Read the exact sound currently attached to a patch connection, without writing to it. */
export async function captureCurrentPatch(
    connection: PatchConnectionLike,
    options: PatchIntakeOptions & { readonly label?: string; readonly timeoutMs?: number },
): Promise<PatchIntakeResult> {
    const timeoutMs = options.timeoutMs ?? 3_000;
    try {
        const [parameters, storedState] = await Promise.all([
            captureParameters(connection, options.currentContract, timeoutMs),
            captureStoredState(connection, timeoutMs),
        ]);
        return intakePatch({
            label: options.label ?? "Current Sound",
            parameters,
            storedState: soundStoredState(storedState),
        }, options);
    } catch (cause) {
        return { ok: false, error: errorFromUnknown(cause) };
    }
}
