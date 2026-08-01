/**
 * The target descriptor catalog: everything the UI may know about one
 * parameter, in one deep table (docs/COSIMO_IOS_MERGE_ROADMAP.md § API
 * contracts). Callers ask to format, bind, or bound a value — unit math,
 * engine ranges, and endpoint names never leave this module.
 *
 * The UI-canonical scale is NormalizedValue (0..1). Engine units exist only
 * inside each binding's conversion pair and are property-tested to roundtrip.
 */

import { type ArticulationVoiceParameterId } from "./articulation-image";
import { type Brand, type NormalizedValue, type TargetId } from "./cosimo-ids";
import { type ModulationTargetKind } from "./modulation";
import {
    RACK_EFFECT_DESCRIPTORS,
    type RackParameterDescriptor,
} from "./rack-parameter-descriptors";
import { casesHandled, err, ok, shouldNeverHappen, type Result } from "./result";

/** The eight fixed rack effects (ADR-006 v1 inventory; identity ≠ position). */
export type EffectModuleId =
    | "filter"
    | "drive"
    | "ott"
    | "chorus"
    | "flanger"
    | "phaser"
    | "delay"
    | "reverb";

/** The per-note voice modules. */
export type VoiceModuleId = "wavetable" | "voice-filter" | "amp-pan";

/** Any module owning parameters. */
export type ModuleId = EffectModuleId | VoiceModuleId;

/** A real engine endpoint id, minted only by this catalog. */
export type EndpointId = Brand<string, "EndpointId">;

/**
 * How a target's value is displayed. The renderer receives a tagged kind so
 * new units are compile-time exhaustive, never string-matched.
 */
export type ValueFormat =
    | { readonly kind: "percent" }
    | { readonly kind: "frequency"; readonly minHz: number; readonly maxHz: number }
    | { readonly kind: "rate"; readonly minHz: number; readonly maxHz: number }
    | { readonly kind: "phase" }
    | { readonly kind: "signed-percent" }
    | { readonly kind: "semitone"; readonly span: number };

/** Per-target modulation-amount span, in the unit the amount is edited in. */
export type ModAmountSpec = {
    readonly min: number;
    readonly max: number;
    readonly unit: "%" | "oct" | "st" | "dB" | "pan";
    readonly digits: number;
};

/**
 * How a normalized UI value reaches the engine, or an explicit statement that
 * it cannot yet. `unbacked` is a first-class state — the catalog's job is to
 * make gaps visible, never to approximate them away.
 */
export type EndpointBinding =
    | {
          readonly _tag: "endpoint";
          readonly endpointId: EndpointId;
          /** Convert a normalized UI value to the endpoint's engine units. */
          readonly toEngine: (value: NormalizedValue) => number;
          /** Convert an engine-unit value back to the normalized UI scale. */
          readonly fromEngine: (value: number) => NormalizedValue;
      }
    | {
          readonly _tag: "unbacked";
          readonly reason: "rack-dsp" | "no-endpoint" | "compound-sync";
      };

/** One parameter's complete description. */
export type TargetDescriptor = {
    readonly targetId: TargetId;
    readonly moduleId: ModuleId;
    readonly workspace: "voice" | "effects";
    readonly label: string;
    /** The factory-reset value, normalized. */
    readonly defaultValue: NormalizedValue;
    /** The value the demo patch boots with, normalized. */
    readonly initialValue: NormalizedValue;
    readonly format: ValueFormat;
    readonly modAmount: ModAmountSpec;
    readonly binding: EndpointBinding;
    /** The module's rack quick-control parameter. */
    readonly isQuick: boolean;
    /** Tempo-sync compound flag (chorus/flanger/phaser rate, delay time). */
    readonly compound: "sync" | null;
    /**
     * The articulation-override key this target writes (ADR-014), or null for
     * targets articulations cannot own (global effects, unbacked voice params
     * pending their endpoint).
     */
    readonly articulationParameterId: ArticulationVoiceParameterId | null;
    /**
     * The engine modulation-route destination this target maps to, or null
     * when the engine cannot modulate it (rack targets pending rack DSP).
     * Wider than `binding`: tune and level are modulatable (pitchSemitones,
     * ampGainDb) even though they have no base endpoint yet.
     */
    readonly modulationTargetKind: ModulationTargetKind | null;
};

type PrototypeValueFormat = "percent" | "frequency" | "rate" | "phase" | "signed" | "semitone";

type ParameterDefinition = {
    readonly id: string;
    readonly label: string;
    readonly initialPercent: number;
    readonly defaultPercent: number;
    readonly format: PrototypeValueFormat;
    readonly compound: "sync" | null;
};

type ModuleDefinition = {
    readonly moduleId: ModuleId;
    readonly workspace: "voice" | "effects";
    readonly quickParameterId: string;
    readonly parameters: ReadonlyArray<ParameterDefinition>;
};

type BoundEndpointId =
    | "wavetablePosition"
    | "warpAmount"
    | "unisonDetune"
    | "filterCutoff"
    | "filterQ"
    | "pan";

type TargetConnectivity = Pick<
    TargetDescriptor,
    "binding" | "articulationParameterId" | "modulationTargetKind"
>;

function parameter(
    id: string,
    label: string,
    initialPercent: number,
    defaultPercent: number,
    format: PrototypeValueFormat = "percent",
    compound: "sync" | null = null,
): ParameterDefinition {
    return { id, label, initialPercent, defaultPercent, format, compound };
}

const MODULE_DEFINITIONS: ReadonlyArray<ModuleDefinition> = [
    {
        moduleId: "wavetable",
        workspace: "voice",
        quickParameterId: "index",
        parameters: [
            parameter("index", "Index", 44, 0),
            parameter("warp", "Warp", 58, 50),
            parameter("unison", "Unison", 35, 0),
            parameter("tune", "Tune", 50, 50, "semitone"),
        ],
    },
    {
        moduleId: "voice-filter",
        workspace: "voice",
        quickParameterId: "cutoff",
        parameters: [
            parameter("cutoff", "Cutoff", 67, 70, "frequency"),
            parameter("resonance", "Resonance", 25, 0),
            parameter("drive", "Drive", 15, 0),
        ],
    },
    {
        moduleId: "amp-pan",
        workspace: "voice",
        quickParameterId: "level",
        parameters: [
            parameter("level", "Level", 80, 80),
            parameter("pan", "Pan", 50, 50, "signed"),
            parameter("attack", "Attack", 10, 0),
            parameter("release", "Release", 35, 25),
        ],
    },
];

// Engine-reported values carry float jitter (a filter at max may read back as
// 20000.0000001 Hz → 1 + 1e-11 normalized). Jitter inside the tolerance is
// clamped as ordinary boundary translation; anything beyond it is a real
// contract violation and stays a defect.
const NORMALIZED_JITTER_TOLERANCE = 1e-6;

function normalized(value: number, context: string): NormalizedValue {
    if (
        !Number.isFinite(value)
        || value < -NORMALIZED_JITTER_TOLERANCE
        || value > 1 + NORMALIZED_JITTER_TOLERANCE
    ) {
        throw new RangeError(`${context} produced non-normalized value ${value}`);
    }

    // SAFETY: the finite value was checked to be within jitter tolerance of the
    // normalized interval above, and the clamp pins it inside it.
    return Math.min(1, Math.max(0, value)) as NormalizedValue;
}

function normalizePercent(value: number, targetId: TargetId): NormalizedValue {
    return normalized(value / 100, `${targetId} catalog percentage`);
}

function catalogTargetId(moduleId: ModuleId, parameterId: string): TargetId {
    if (parameterId.length === 0 || parameterId.includes(".")) {
        throw new Error(`Invalid catalog parameter id "${parameterId}"`);
    }

    // SAFETY: moduleId is a closed catalog module and parameterId comes only from the private,
    // locked parameter table after the shape check above; their composition is a catalog TargetId.
    return `${moduleId}.${parameterId}` as TargetId;
}

function endpointId(value: BoundEndpointId): EndpointId {
    // SAFETY: BoundEndpointId is the catalog's closed set of real engine endpoint names.
    return value as EndpointId;
}

function identityToEngine(value: NormalizedValue): number {
    return value;
}

function identityFromEngine(value: number): NormalizedValue {
    return normalized(value, "identity endpoint conversion");
}

function frequencyToEngine(value: NormalizedValue): number {
    return 20 * 1000 ** value;
}

function frequencyFromEngine(value: number): NormalizedValue {
    return normalized(Math.log(value / 20) / Math.log(1000), "filterCutoff endpoint conversion");
}

function resonanceToEngine(value: NormalizedValue): number {
    return 0.1 * 200 ** value;
}

function resonanceFromEngine(value: number): NormalizedValue {
    return normalized(Math.log(value / 0.1) / Math.log(200), "filterQ endpoint conversion");
}

function panToEngine(value: NormalizedValue): number {
    return value * 2 - 1;
}

function panFromEngine(value: number): NormalizedValue {
    return normalized((value + 1) / 2, "pan endpoint conversion");
}

function boundEndpoint(
    id: BoundEndpointId,
    toEngine: (value: NormalizedValue) => number,
    fromEngine: (value: number) => NormalizedValue,
): EndpointBinding {
    return { _tag: "endpoint", endpointId: endpointId(id), toEngine, fromEngine };
}

function connectivityFor(targetId: TargetId, workspace: "voice" | "effects"): TargetConnectivity {
    switch (targetId) {
        case "wavetable.index":
            return {
                binding: boundEndpoint("wavetablePosition", identityToEngine, identityFromEngine),
                articulationParameterId: "framePosition",
                modulationTargetKind: "wavetablePosition",
            };
        case "wavetable.warp":
            return {
                binding: boundEndpoint("warpAmount", identityToEngine, identityFromEngine),
                articulationParameterId: "warpAmount",
                modulationTargetKind: "warpAmount",
            };
        case "wavetable.unison":
            return {
                binding: boundEndpoint("unisonDetune", identityToEngine, identityFromEngine),
                articulationParameterId: "unisonDetune",
                modulationTargetKind: "unisonDetune",
            };
        case "voice-filter.cutoff":
            return {
                binding: boundEndpoint("filterCutoff", frequencyToEngine, frequencyFromEngine),
                articulationParameterId: "filterCutoffHz",
                modulationTargetKind: "filterCutoffOctaves",
            };
        case "voice-filter.resonance":
            return {
                binding: boundEndpoint("filterQ", resonanceToEngine, resonanceFromEngine),
                articulationParameterId: "filterQ",
                modulationTargetKind: "filterQ",
            };
        case "amp-pan.pan":
            return {
                binding: boundEndpoint("pan", panToEngine, panFromEngine),
                articulationParameterId: "pan",
                modulationTargetKind: "pan",
            };
        case "wavetable.tune":
            return {
                binding: { _tag: "unbacked", reason: "no-endpoint" },
                articulationParameterId: null,
                modulationTargetKind: "pitchSemitones",
            };
        case "amp-pan.level":
            return {
                binding: { _tag: "unbacked", reason: "no-endpoint" },
                articulationParameterId: null,
                modulationTargetKind: "ampGainDb",
            };
        default:
            return {
                binding: {
                    _tag: "unbacked",
                    reason: workspace === "effects" ? "rack-dsp" : "no-endpoint",
                },
                articulationParameterId: null,
                modulationTargetKind: null,
            };
    }
}

function valueFormat(format: PrototypeValueFormat): ValueFormat {
    switch (format) {
        case "percent":
            return { kind: "percent" };
        case "frequency":
            return { kind: "frequency", minHz: 20, maxHz: 20_000 };
        case "rate":
            return { kind: "rate", minHz: 0.05, maxHz: 10 };
        case "phase":
            return { kind: "phase" };
        case "signed":
            return { kind: "signed-percent" };
        case "semitone":
            return { kind: "semitone", span: 50 };
        default:
            return casesHandled(format);
    }
}

function modAmountSpec(format: ValueFormat, targetId: TargetId): ModAmountSpec {
    if (format.kind === "frequency") {
        return { min: -6, max: 6, unit: "oct", digits: 1 };
    }
    if (format.kind === "semitone") {
        return { min: -48, max: 48, unit: "st", digits: 0 };
    }
    if (targetId === "amp-pan.level") {
        return { min: -48, max: 6, unit: "dB", digits: 0 };
    }
    if (targetId === "amp-pan.pan") {
        return { min: -100, max: 100, unit: "pan", digits: 0 };
    }
    return { min: -100, max: 100, unit: "%", digits: 0 };
}

function createDescriptor(
    moduleDefinition: ModuleDefinition,
    parameterDefinition: ParameterDefinition,
): TargetDescriptor {
    const targetId = catalogTargetId(moduleDefinition.moduleId, parameterDefinition.id);
    const format = valueFormat(parameterDefinition.format);
    const connectivity = connectivityFor(targetId, moduleDefinition.workspace);

    return Object.freeze({
        targetId,
        moduleId: moduleDefinition.moduleId,
        workspace: moduleDefinition.workspace,
        label: parameterDefinition.label,
        defaultValue: normalizePercent(parameterDefinition.defaultPercent, targetId),
        initialValue: normalizePercent(parameterDefinition.initialPercent, targetId),
        format,
        modAmount: modAmountSpec(format, targetId),
        binding: connectivity.binding,
        isQuick: moduleDefinition.quickParameterId === parameterDefinition.id,
        compound: parameterDefinition.compound,
        articulationParameterId: connectivity.articulationParameterId,
        modulationTargetKind: connectivity.modulationTargetKind,
    });
}

function rackTargetId(parameter: RackParameterDescriptor): TargetId {
    // SAFETY: effect identity and endpoint id both come from the closed rack catalog.
    return `${parameter.effectId}.${parameter.endpointID}` as TargetId;
}

function rackNormalizedFromEngine(parameter: RackParameterDescriptor, value: number): NormalizedValue {
    const normalizedValue = parameter.scale === "log"
        ? Math.log(value / parameter.min) / Math.log(parameter.max / parameter.min)
        : (value - parameter.min) / (parameter.max - parameter.min);
    return normalized(normalizedValue, `${parameter.endpointID} endpoint conversion`);
}

function rackEngineFromNormalized(parameter: RackParameterDescriptor, value: NormalizedValue) {
    return parameter.scale === "log"
        ? parameter.min * (parameter.max / parameter.min) ** value
        : parameter.min + (parameter.max - parameter.min) * value;
}

function rackValueFormat(parameter: RackParameterDescriptor): ValueFormat {
    if (parameter.unit === "Hz") {
        return { kind: "frequency", minHz: parameter.min, maxHz: parameter.max };
    }
    if (parameter.unit === "deg") {
        return { kind: "phase" };
    }
    if (parameter.unit === "st") {
        return { kind: "semitone", span: Math.max(Math.abs(parameter.min), Math.abs(parameter.max)) };
    }
    if (parameter.min < 0 && parameter.max > 0) {
        return { kind: "signed-percent" };
    }
    return { kind: "percent" };
}

function rackModAmountSpec(parameter: RackParameterDescriptor): ModAmountSpec {
    if (parameter.scale === "log") {
        return { min: -6, max: 6, unit: "oct", digits: 2 };
    }
    if (parameter.unit === "st") {
        const span = parameter.max - parameter.min;
        return { min: -span, max: span, unit: "st", digits: 2 };
    }
    if (parameter.unit === "dB") {
        const span = parameter.max - parameter.min;
        return { min: -span, max: span, unit: "dB", digits: 1 };
    }
    const span = parameter.max - parameter.min;
    return { min: -span, max: span, unit: "%", digits: span <= 2 ? 3 : 1 };
}

function createRackTargetDescriptor(parameter: RackParameterDescriptor): TargetDescriptor {
    const targetId = rackTargetId(parameter);
    return Object.freeze({
        targetId,
        moduleId: parameter.effectId,
        workspace: "effects" as const,
        label: parameter.label,
        defaultValue: rackNormalizedFromEngine(parameter, parameter.initial),
        initialValue: rackNormalizedFromEngine(parameter, parameter.initial),
        format: rackValueFormat(parameter),
        modAmount: rackModAmountSpec(parameter),
        binding: {
            _tag: "endpoint" as const,
            endpointId: parameter.endpointID as EndpointId,
            toEngine: (value: NormalizedValue) => rackEngineFromNormalized(parameter, value),
            fromEngine: (value: number) => rackNormalizedFromEngine(parameter, value),
        },
        isQuick: parameter.quick,
        compound: parameter.endpointID === "phaserRate" || parameter.endpointID === "delayTime"
            ? "sync" as const
            : null,
        articulationParameterId: null,
        modulationTargetKind: parameter.modulationTargetIndex === null
            ? null
            : `rack.${parameter.endpointID}` as ModulationTargetKind,
    });
}

const TARGET_DESCRIPTORS: ReadonlyArray<TargetDescriptor> = Object.freeze(
    [
        ...RACK_EFFECT_DESCRIPTORS.flatMap((effect) => effect.parameters.map(createRackTargetDescriptor)),
        ...MODULE_DEFINITIONS.flatMap((moduleDefinition) =>
            moduleDefinition.parameters.map((parameterDefinition) =>
                createDescriptor(moduleDefinition, parameterDefinition),
            ),
        ),
    ],
);

const TARGET_DESCRIPTOR_BY_ID = new Map<string, TargetDescriptor>(
    TARGET_DESCRIPTORS.map((descriptor) => [descriptor.targetId, descriptor]),
);

/** The target string was not a known parameter. */
export class UnknownTarget extends Error {
    readonly _tag = "UnknownTarget" as const;

    constructor(readonly input: string) {
        super(`Unknown target "${input}"`);
    }
}

/**
 * Parse an untrusted target string against the catalog.
 *
 * @param input - The raw target string ("module.param").
 * @returns The branded id, or UnknownTarget.
 */
export function parseTargetId(input: string): Result<TargetId, UnknownTarget> {
    const descriptor = TARGET_DESCRIPTOR_BY_ID.get(input);
    return descriptor === undefined ? err(new UnknownTarget(input)) : ok(descriptor.targetId);
}

/**
 * Look up a parsed target's descriptor — total by construction.
 *
 * @param targetId - A target id minted by {@link parseTargetId}.
 * @returns The descriptor.
 */
export function getTargetDescriptor(targetId: TargetId): TargetDescriptor {
    const descriptor = TARGET_DESCRIPTOR_BY_ID.get(targetId);
    if (descriptor === undefined) {
        return shouldNeverHappen(`Parsed target "${targetId}" is absent from its owning catalog`);
    }

    return descriptor;
}

/**
 * Every descriptor, in stable module/parameter order.
 *
 * @returns Every bound rack and voice descriptor.
 */
export function allTargetDescriptors(): ReadonlyArray<TargetDescriptor> {
    return TARGET_DESCRIPTORS;
}

/**
 * Render a normalized value in the target's display unit.
 *
 * @param descriptor - The target's descriptor.
 * @param value - The normalized value to render.
 * @returns The formatted display string (e.g. "1.45 kHz", "+12 st", "64%").
 */
export function formatTargetValue(descriptor: TargetDescriptor, value: NormalizedValue): string {
    const prototypeValue = value * 100;

    switch (descriptor.format.kind) {
        case "percent":
            return `${Math.round(prototypeValue)}%`;
        case "frequency": {
            const { minHz, maxHz } = descriptor.format;
            const hz = Math.round(minHz * (maxHz / minHz) ** value);
            return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${hz} Hz`;
        }
        case "rate": {
            const { minHz, maxHz } = descriptor.format;
            return `${(minHz + value * (maxHz - minHz)).toFixed(2)} Hz`;
        }
        case "phase":
            return `${Math.round((prototypeValue / 100) * 360)}°`;
        case "signed-percent":
            return `${Math.round((prototypeValue - 50) * 2)}%`;
        case "semitone":
            return `${prototypeValue >= 50 ? "+" : ""}${Math.round((prototypeValue - 50) / 2)} st`;
        default:
            return casesHandled(descriptor.format);
    }
}
