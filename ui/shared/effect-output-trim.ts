/** Finite parameter sentinel whose exact value renders digital silence. */
export const EFFECT_OUTPUT_TRIM_SILENCE_DB = -100;

/** Maximum gain available after one editable effect. */
export const EFFECT_OUTPUT_TRIM_MAX_DB = 35;

/** Effect types that own resident Output Trim parameters, in rack identity order. */
export const EFFECT_OUTPUT_TRIM_DEVICE_TYPES = [
    "globalFilter",
    "distortion",
    "ott",
    "chorus",
    "flanger",
    "phaser",
    "delay",
    "reverb",
] as const;

/** One of the eight editable Effects Lane device types. */
export type EffectOutputTrimDeviceType = typeof EFFECT_OUTPUT_TRIM_DEVICE_TYPES[number];

/** Number of resident instances provisioned for each editable effect type. */
export const EFFECT_OUTPUT_TRIM_RESIDENT_INSTANCE_COUNT = 5;

type EffectOutputTrimIdentitySpec = {
    readonly deviceType: EffectOutputTrimDeviceType;
    readonly laneEndpointID: string;
    readonly hostStem: string;
};

const IDENTITY_SPECS: ReadonlyArray<EffectOutputTrimIdentitySpec> = [
    { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
    { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
    { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
    { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
    { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
    { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
    { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
    { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" },
];

/** Parsed identity carried by one resident Output Trim host parameter. */
export type ParsedEffectOutputTrimHostEndpoint = {
    readonly deviceType: EffectOutputTrimDeviceType;
    readonly instanceNumber: number;
    readonly laneEndpointID: string;
};

function requireIdentitySpec(deviceType: EffectOutputTrimDeviceType): EffectOutputTrimIdentitySpec {
    const spec = IDENTITY_SPECS.find((candidate) => candidate.deviceType === deviceType);
    if (spec === undefined) {
        throw new Error(`Unknown effect Output Trim device type: ${deviceType}`);
    }
    return spec;
}

/** Resolve the lane-document endpoint owned by one effect type. */
export function effectOutputTrimLaneEndpointID(deviceType: EffectOutputTrimDeviceType): string {
    return requireIdentitySpec(deviceType).laneEndpointID;
}

/** Resolve one type-and-instance identity to its stable host parameter ID. */
export function effectOutputTrimHostEndpointID(
    deviceType: EffectOutputTrimDeviceType,
    instanceNumber: number,
): string {
    if (!Number.isInteger(instanceNumber)
            || instanceNumber < 1
            || instanceNumber > EFFECT_OUTPUT_TRIM_RESIDENT_INSTANCE_COUNT) {
        throw new Error(`Effect Output Trim instance is out of range: ${instanceNumber}`);
    }
    return `${requireIdentitySpec(deviceType).hostStem}${instanceNumber}OutputTrimDb`;
}

/** Enumerate the complete append-only resident host-parameter bank. */
export function allEffectOutputTrimHostEndpointIDs(): ReadonlyArray<string> {
    return IDENTITY_SPECS.flatMap((spec) => Array.from(
        { length: EFFECT_OUTPUT_TRIM_RESIDENT_INSTANCE_COUNT },
        (_, index) => effectOutputTrimHostEndpointID(spec.deviceType, index + 1),
    ));
}

/** Parse a host endpoint without accepting Polish, graph-position, or unknown identities. */
export function parseEffectOutputTrimHostEndpointID(
    endpointID: unknown,
): ParsedEffectOutputTrimHostEndpoint | null {
    if (typeof endpointID !== "string") {
        return null;
    }
    for (const spec of IDENTITY_SPECS) {
        for (let instanceNumber = 1;
            instanceNumber <= EFFECT_OUTPUT_TRIM_RESIDENT_INSTANCE_COUNT;
            instanceNumber += 1) {
            if (endpointID === effectOutputTrimHostEndpointID(spec.deviceType, instanceNumber)) {
                return {
                    deviceType: spec.deviceType,
                    instanceNumber,
                    laneEndpointID: spec.laneEndpointID,
                };
            }
        }
    }
    return null;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/**
 * Apply one modulation amount in dB exactly as the rack DSP does.
 *
 * The finite lower endpoint is a latch for digital silence, not merely a
 * number that positive modulation may lift. Other values add the dB offset
 * and clamp to the declared parameter range.
 */
export function effectOutputTrimEffectiveDb(baseDb: number, modulationDb: number): number {
    const clampedBase = clamp(baseDb, EFFECT_OUTPUT_TRIM_SILENCE_DB, EFFECT_OUTPUT_TRIM_MAX_DB);
    if (clampedBase === EFFECT_OUTPUT_TRIM_SILENCE_DB) {
        return EFFECT_OUTPUT_TRIM_SILENCE_DB;
    }
    return clamp(
        clampedBase + modulationDb,
        EFFECT_OUTPUT_TRIM_SILENCE_DB,
        EFFECT_OUTPUT_TRIM_MAX_DB,
    );
}

/**
 * Project an Output Trim dB value onto its control travel.
 *
 * Squaring the linear ratio compresses the otherwise low-value tail: the
 * endpoint remains reachable while ordinary gain-staging values retain most
 * of the dial's precision.
 */
export function effectOutputTrimNormalizedValue(valueDb: number): number {
    const ratio = (
        clamp(valueDb, EFFECT_OUTPUT_TRIM_SILENCE_DB, EFFECT_OUTPUT_TRIM_MAX_DB)
        - EFFECT_OUTPUT_TRIM_SILENCE_DB
    ) / (EFFECT_OUTPUT_TRIM_MAX_DB - EFFECT_OUTPUT_TRIM_SILENCE_DB);
    return ratio * ratio;
}

/** Invert the Output Trim control projection back into its dB domain. */
export function effectOutputTrimValueFromNormalized(normalizedValue: number): number {
    const ratio = Math.sqrt(clamp(normalizedValue, 0, 1));
    return EFFECT_OUTPUT_TRIM_SILENCE_DB
        + (ratio * (EFFECT_OUTPUT_TRIM_MAX_DB - EFFECT_OUTPUT_TRIM_SILENCE_DB));
}
