import { allRackParameterDescriptors } from "./rack-parameter-descriptors";

/** Stable oscillator identities in runtime order. */
export const OSCILLATOR_IDS = ["A", "B", "C"] as const;

/** One oscillator's stable product identity. */
export type OscillatorID = typeof OSCILLATOR_IDS[number];

/** Oscillator-local destinations in runtime order within each oscillator. */
export const OSCILLATOR_MODULATION_PARAMETER_KINDS = [
    "wavetablePosition",
    "warpAmount",
    "pitchSemitones",
    "ampGainDb",
    "pan",
    "unisonDetune",
    "unisonBlend",
    "unisonWidth",
    "unisonWavetablePositionSpread",
    "unisonWarpSpread",
] as const;

/** One display/amount policy shared by corresponding A/B/C targets. */
export type OscillatorModulationParameterKind = typeof OSCILLATOR_MODULATION_PARAMETER_KINDS[number];
/** One oscillator-qualified modulation destination. */
export type OscillatorModulationTargetKind = `osc${OscillatorID}.${OscillatorModulationParameterKind}`;

/** Voice-global destinations following the three oscillator-local blocks. */
export const SHARED_VOICE_MODULATION_TARGET_KINDS = [
    "filterCutoffOctaves",
    "filterQ",
    "mseg1Morph",
    "mseg2Morph",
    "mseg3Morph",
    "mseg1Rate",
    "mseg2Rate",
    "mseg3Rate",
    "env1Attack",
    "env1Decay",
    "env1Sustain",
    "env1Release",
    "env2Attack",
    "env2Decay",
    "env2Sustain",
    "env2Release",
    "env3Attack",
    "env3Decay",
    "env3Sustain",
    "env3Release",
    "filterMix",
    "globalTuneSemitones",
    "ampAttack",
    "ampDecay",
    "ampSustain",
    "ampRelease",
] as const;

/** One voice-global modulation destination. */
export type SharedVoiceModulationTargetKind = typeof SHARED_VOICE_MODULATION_TARGET_KINDS[number];
/** Any modulation destination evaluated within a synth voice. */
export type VoiceModulationTargetKind = OscillatorModulationTargetKind | SharedVoiceModulationTargetKind;
/** Policy key for an oscillator-local or shared voice destination. */
export type VoiceModulationParameterKind = OscillatorModulationParameterKind | SharedVoiceModulationTargetKind;
/**
 * Canonical identity for one BASE (ordinal-0) lane destination:
 * `lane.<type>#1.<endpointID>`. The rack.* namespace is DELETED (Effects Lane
 * hard cut): the eight resident devices are lane devices like any other, and
 * their instance-#1 kinds form the static vocabulary that mirrors the
 * engine's 36-wide rackMod bus block. The type name keeps "Rack" because the
 * ENGINE bus keeps that name (rackModTargetCount et al).
 */
export type RackModulationTargetKind = `lane.${string}`;
/** One pool device's parameter (Effects Lane): `lane.<instanceId>.<endpointID>`.
    Instances beyond #1 are per-patch dynamic — never part of the static
    legal-pair domain; grammar and resolution live in
    lane-modulation-targets.ts. */
export type LaneModulationTargetKind = `lane.${string}`;
/** Any canonical voice, rack, or lane modulation destination. */
export type ModulationTargetKind = VoiceModulationTargetKind | RackModulationTargetKind | LaneModulationTargetKind;

/** Runtime behavior family for one modulation source. */
export type ModulationSourceKind = "mseg" | "env" | "velocity" | "pressure" | "slide" | "macro";
/** Source lifetime group used by the sparse runtime. */
export type ModulationSourceGroup = "voice" | "macro";
/** Stable persisted/UI identity for one modulation source. */
export type ModulationSourceId =
    | `mseg-${1 | 2 | 3}`
    | `env-${1 | 2 | 3}`
    | "amp-envelope"
    | "velocity"
    | "pressure"
    | "slide"
    | `macro-${1 | 2 | 3 | 4}`;

/** Identity and runtime address for one canonical modulation source. */
export type ModulationSourceIdentity = {
    readonly id: ModulationSourceId;
    readonly sourceKind: ModulationSourceKind;
    readonly sourceSlot: number | null;
    readonly group: ModulationSourceGroup;
    readonly runtimeIndex: number;
};

/** Identity and runtime address for one canonical modulation target. */
export type ModulationTargetIdentity = {
    readonly kind: ModulationTargetKind;
    readonly group: "voice" | "rack";
    readonly runtimeIndex: number;
};

/** The complete source domain; display names live with presentation metadata. */
export const MODULATION_SOURCE_IDENTITIES: ReadonlyArray<ModulationSourceIdentity> = Object.freeze([
    { id: "mseg-1", sourceKind: "mseg", sourceSlot: 1, group: "voice", runtimeIndex: 0 },
    { id: "mseg-2", sourceKind: "mseg", sourceSlot: 2, group: "voice", runtimeIndex: 1 },
    { id: "mseg-3", sourceKind: "mseg", sourceSlot: 3, group: "voice", runtimeIndex: 2 },
    { id: "env-1", sourceKind: "env", sourceSlot: 1, group: "voice", runtimeIndex: 3 },
    { id: "env-2", sourceKind: "env", sourceSlot: 2, group: "voice", runtimeIndex: 4 },
    { id: "env-3", sourceKind: "env", sourceSlot: 3, group: "voice", runtimeIndex: 5 },
    { id: "amp-envelope", sourceKind: "env", sourceSlot: 4, group: "voice", runtimeIndex: 9 },
    { id: "macro-1", sourceKind: "macro", sourceSlot: 1, group: "macro", runtimeIndex: 0 },
    { id: "macro-2", sourceKind: "macro", sourceSlot: 2, group: "macro", runtimeIndex: 1 },
    { id: "macro-3", sourceKind: "macro", sourceSlot: 3, group: "macro", runtimeIndex: 2 },
    { id: "macro-4", sourceKind: "macro", sourceSlot: 4, group: "macro", runtimeIndex: 3 },
    { id: "velocity", sourceKind: "velocity", sourceSlot: null, group: "voice", runtimeIndex: 6 },
    { id: "pressure", sourceKind: "pressure", sourceSlot: null, group: "voice", runtimeIndex: 7 },
    { id: "slide", sourceKind: "slide", sourceSlot: null, group: "voice", runtimeIndex: 8 },
]);

/**
 * The complete voice domain in stable runtime order. Existing oscillator and
 * filter indexes are frozen; new destinations are append-only.
 */
export const VOICE_MODULATION_TARGET_KINDS: ReadonlyArray<VoiceModulationTargetKind> = Object.freeze([
    ...OSCILLATOR_IDS.flatMap((oscillatorID) => (
        OSCILLATOR_MODULATION_PARAMETER_KINDS.map(
            (parameterKind) => `osc${oscillatorID}.${parameterKind}` as OscillatorModulationTargetKind,
        )
    )),
    ...SHARED_VOICE_MODULATION_TARGET_KINDS,
]);

const OSCILLATOR_MODULATION_TARGET_KIND_SET = new Set<ModulationTargetKind>(
    OSCILLATOR_IDS.flatMap((oscillatorID) => (
        OSCILLATOR_MODULATION_PARAMETER_KINDS.map(
            (parameterKind) => `osc${oscillatorID}.${parameterKind}` as OscillatorModulationTargetKind,
        )
    )),
);

/** Runtime grammar check used when sampled mode makes all 30 oscillator cells inert. */
export function isOscillatorModulationTargetKind(
    value: unknown,
): value is OscillatorModulationTargetKind {
    return typeof value === "string"
        && OSCILLATOR_MODULATION_TARGET_KIND_SET.has(value as ModulationTargetKind);
}

/** Voice destinations paired with their canonical runtime indexes. */
export const VOICE_MODULATION_TARGET_IDENTITIES: ReadonlyArray<ModulationTargetIdentity> = Object.freeze(
    VOICE_MODULATION_TARGET_KINDS.map((kind, runtimeIndex) => ({ kind, group: "voice" as const, runtimeIndex })),
);

const rackModulationParameters = allRackParameterDescriptors()
    .filter((parameter) => parameter.modulationTargetIndex !== null);

const LANE_DEVICE_TYPE_PREFIXES = [
    "globalFilter", "distortion", "ott", "chorus", "flanger", "phaser", "delay", "reverb",
] as const;

/** The canonical base-instance lane kind for one effect endpoint. Every
    effect endpoint is prefixed by its device type name, so the type is
    derived, never hand-mapped. */
export function laneBaseKindForRackEndpoint(endpointID: string): RackModulationTargetKind {
    const kind = maybeLaneBaseKindForRackEndpoint(endpointID);
    if (kind === null) {
        throw new Error(`Effect endpoint has no device-type prefix: ${endpointID}`);
    }
    return kind;
}

/** The base-instance lane kind, or null for a non-effect endpoint (shared
    surfaces sometimes drive voice endpoints through the same components). */
export function maybeLaneBaseKindForRackEndpoint(endpointID: string): RackModulationTargetKind | null {
    const deviceType = LANE_DEVICE_TYPE_PREFIXES.find((prefix) => endpointID.startsWith(prefix));
    return deviceType === undefined ? null : `lane.${deviceType}#1.${endpointID}`;
}

/** Base-instance lane destinations paired with their descriptor-owned runtime indexes. */
export const RACK_MODULATION_TARGET_IDENTITIES: ReadonlyArray<ModulationTargetIdentity> = Object.freeze(
    rackModulationParameters.map((parameter) => ({
        // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
        // and indexes are both minted only by the rack descriptor catalog.
        kind: laneBaseKindForRackEndpoint(parameter.endpointID),
        group: "rack" as const,
        runtimeIndex: parameter.modulationTargetIndex as number,
    })).sort((left, right) => left.runtimeIndex - right.runtimeIndex),
);

/** Every canonical modulation target, with voice and rack indexes kept in separate runtime groups. */
export const MODULATION_TARGET_IDENTITIES: ReadonlyArray<ModulationTargetIdentity> = Object.freeze([
    ...VOICE_MODULATION_TARGET_IDENTITIES,
    ...RACK_MODULATION_TARGET_IDENTITIES,
]);

/** Number of canonical sources. */
export const MODULATION_SOURCE_COUNT = MODULATION_SOURCE_IDENTITIES.length;
/** Number of oscillator-local and shared voice destinations. */
export const MODULATION_VOICE_TARGET_COUNT = VOICE_MODULATION_TARGET_IDENTITIES.length;
/** Number of authored rack destinations. */
export const MODULATION_RACK_TARGET_COUNT = RACK_MODULATION_TARGET_IDENTITIES.length;
/** Complete legal source-target domain size. */
export const MODULATION_LEGAL_PAIR_COUNT = MODULATION_SOURCE_COUNT * MODULATION_TARGET_IDENTITIES.length;

const sourceIdentityById = new Map(MODULATION_SOURCE_IDENTITIES.map((identity) => [identity.id, identity]));
const sourceIdentityByAddress = new Map(MODULATION_SOURCE_IDENTITIES.map((identity) => [
    `${identity.sourceKind}:${identity.sourceSlot ?? 0}`,
    identity,
]));
const targetIdentityByKind = new Map(MODULATION_TARGET_IDENTITIES.map((identity) => [identity.kind, identity]));

function assertCanonicalIdentities(): void {
    if (MODULATION_SOURCE_COUNT !== 14
        || MODULATION_VOICE_TARGET_COUNT !== 56
        || MODULATION_RACK_TARGET_COUNT !== 36
        || MODULATION_LEGAL_PAIR_COUNT !== 1288) {
        throw new Error("Unexpected modulation domain size");
    }

    for (const [group, expectedCount] of [["voice", 10], ["macro", 4]] as const) {
        const identities = MODULATION_SOURCE_IDENTITIES
            .filter((identity) => identity.group === group)
            .sort((left, right) => left.runtimeIndex - right.runtimeIndex);
        if (identities.length !== expectedCount
            || identities.some((identity, position) => identity.runtimeIndex !== position)) {
            throw new Error(`Bad modulation ${group} source indexes`);
        }
    }

    for (const [group, expectedCount] of [["voice", 56], ["rack", 36]] as const) {
        const identities = MODULATION_TARGET_IDENTITIES.filter((identity) => identity.group === group);
        if (identities.length !== expectedCount
            || identities.some((identity, position) => identity.runtimeIndex !== position)) {
            throw new Error(`Bad modulation ${group} target indexes`);
        }
    }

    if (sourceIdentityById.size !== MODULATION_SOURCE_COUNT
        || sourceIdentityByAddress.size !== MODULATION_SOURCE_COUNT
        || targetIdentityByKind.size !== MODULATION_TARGET_IDENTITIES.length) {
        throw new Error("Modulation identities must be unique");
    }
}

assertCanonicalIdentities();

/** Parse an untrusted source ID against the canonical source domain. */
export function parseModulationSourceIdentity(value: unknown): ModulationSourceIdentity | null {
    if (typeof value !== "string") return null;
    // SAFETY: The map performs the runtime membership check before an identity is returned.
    return sourceIdentityById.get(value as ModulationSourceId) ?? null;
}

/** Resolve a normalized route source to its canonical identity and runtime group. */
export function getModulationSourceIdentity(
    sourceKind: ModulationSourceKind,
    sourceSlot: number | null,
): ModulationSourceIdentity {
    const identity = sourceIdentityByAddress.get(`${sourceKind}:${sourceSlot ?? 0}`);
    if (identity === undefined) {
        throw new Error(`Unknown modulation source: ${sourceKind}:${sourceSlot ?? 0}`);
    }
    return identity;
}

/** Parse an untrusted target kind without legacy aliases. */
export function parseModulationTargetKind(value: unknown): ModulationTargetKind | null {
    if (typeof value !== "string") return null;
    return targetIdentityByKind.has(value as ModulationTargetKind) ? value as ModulationTargetKind : null;
}

/** Parse an untrusted voice target without legacy aliases. */
export function parseVoiceModulationTargetKind(value: unknown): VoiceModulationTargetKind | null {
    const targetKind = parseModulationTargetKind(value);
    return targetKind !== null && targetIdentityByKind.get(targetKind)?.group === "voice"
        ? targetKind as VoiceModulationTargetKind
        : null;
}

/** Parse an untrusted base lane target against the static vocabulary. */
export function parseRackModulationTargetKind(value: unknown): RackModulationTargetKind | null {
    const targetKind = parseModulationTargetKind(value);
    return targetKind !== null && targetIdentityByKind.get(targetKind)?.group === "rack"
        ? targetKind as RackModulationTargetKind
        : null;
}

/** Return the stable runtime target index for a canonical voice destination. */
export function getVoiceModulationTargetIndex(targetKind: VoiceModulationTargetKind): number {
    const identity = targetIdentityByKind.get(targetKind);
    if (identity?.group !== "voice") throw new Error(`Unknown voice modulation target: ${targetKind}`);
    return identity.runtimeIndex;
}

/** Return the stable runtime target index for a canonical rack destination. */
export function getRackModulationTargetIndex(targetKind: RackModulationTargetKind): number {
    const identity = targetIdentityByKind.get(targetKind);
    if (identity?.group !== "rack") throw new Error(`Unknown rack modulation target: ${targetKind}`);
    return identity.runtimeIndex;
}

/** Return the oscillator-local or shared parameter kind for a voice target. */
export function getVoiceModulationParameterKind(
    targetKind: VoiceModulationTargetKind,
): VoiceModulationParameterKind {
    const separatorIndex = targetKind.indexOf(".");
    return separatorIndex >= 0
        ? targetKind.slice(separatorIndex + 1) as OscillatorModulationParameterKind
        : targetKind as SharedVoiceModulationTargetKind;
}

/** All canonical sources may address all canonical targets. */
export function isLegalModulationPair(sourceId: unknown, targetKind: unknown): boolean {
    return parseModulationSourceIdentity(sourceId) !== null && parseModulationTargetKind(targetKind) !== null;
}
