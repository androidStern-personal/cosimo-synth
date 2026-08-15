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
] as const;

/** One voice-global modulation destination. */
export type SharedVoiceModulationTargetKind = typeof SHARED_VOICE_MODULATION_TARGET_KINDS[number];
/** Any modulation destination evaluated within a synth voice. */
export type VoiceModulationTargetKind = OscillatorModulationTargetKind | SharedVoiceModulationTargetKind;
/** Policy key for an oscillator-local or shared voice destination. */
export type VoiceModulationParameterKind = OscillatorModulationParameterKind | SharedVoiceModulationTargetKind;
/** Canonical identity for one authored rack destination. */
export type RackModulationTargetKind = `rack.${string}`;
/** Any canonical voice or rack modulation destination. */
export type ModulationTargetKind = VoiceModulationTargetKind | RackModulationTargetKind;

/** Runtime behavior family for one modulation source. */
export type ModulationSourceKind = "mseg" | "env" | "velocity" | "pressure" | "slide" | "macro";
/** Source lifetime group used by the sparse runtime. */
export type ModulationSourceGroup = "voice" | "macro";
/** Stable persisted/UI identity for one modulation source. */
export type ModulationSourceId =
    | `mseg-${1 | 2 | 3}`
    | `env-${1 | 2 | 3}`
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
 * filter indexes are frozen; continuous MSEG/envelope controls are appended.
 */
export const VOICE_MODULATION_TARGET_KINDS: ReadonlyArray<VoiceModulationTargetKind> = Object.freeze([
    ...OSCILLATOR_IDS.flatMap((oscillatorID) => (
        OSCILLATOR_MODULATION_PARAMETER_KINDS.map(
            (parameterKind) => `osc${oscillatorID}.${parameterKind}` as OscillatorModulationTargetKind,
        )
    )),
    ...SHARED_VOICE_MODULATION_TARGET_KINDS,
]);

/** Voice destinations paired with their canonical runtime indexes. */
export const VOICE_MODULATION_TARGET_IDENTITIES: ReadonlyArray<ModulationTargetIdentity> = Object.freeze(
    VOICE_MODULATION_TARGET_KINDS.map((kind, runtimeIndex) => ({ kind, group: "voice" as const, runtimeIndex })),
);

const rackModulationParameters = allRackParameterDescriptors()
    .filter((parameter) => parameter.modulationTargetIndex !== null);

/** Rack destinations paired with their descriptor-owned runtime indexes. */
export const RACK_MODULATION_TARGET_IDENTITIES: ReadonlyArray<ModulationTargetIdentity> = Object.freeze(
    rackModulationParameters.map((parameter) => ({
        // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
        // and indexes are both minted only by the rack descriptor catalog.
        kind: `rack.${parameter.endpointID}` as RackModulationTargetKind,
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
    if (MODULATION_SOURCE_COUNT !== 13
        || MODULATION_VOICE_TARGET_COUNT !== 50
        || MODULATION_RACK_TARGET_COUNT !== 36
        || MODULATION_LEGAL_PAIR_COUNT !== 1118) {
        throw new Error("Modulation identity catalog has an unexpected domain size");
    }

    for (const [group, expectedCount] of [["voice", 9], ["macro", 4]] as const) {
        const identities = MODULATION_SOURCE_IDENTITIES.filter((identity) => identity.group === group);
        const indexes = identities.map((identity) => identity.runtimeIndex).sort((left, right) => left - right);
        if (identities.length !== expectedCount || indexes.some((index, position) => index !== position)) {
            throw new Error(`Modulation ${group} source indexes must be unique and contiguous`);
        }
    }

    for (const [group, expectedCount] of [["voice", 50], ["rack", 36]] as const) {
        const identities = MODULATION_TARGET_IDENTITIES.filter((identity) => identity.group === group);
        const indexes = identities.map((identity) => identity.runtimeIndex).sort((left, right) => left - right);
        if (identities.length !== expectedCount || indexes.some((index, position) => index !== position)) {
            throw new Error(`Modulation ${group} target indexes must be unique and contiguous`);
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

/** Parse an untrusted rack target without accepting unknown `rack.*` strings. */
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
