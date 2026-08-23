/**
 * Effects Lane modulation target kinds (M1).
 *
 * `lane.<instanceId>.<endpointID>` names ONE pool device's parameter — e.g.
 * `lane.delay#2.delayTime`. Lane kinds are per-patch DYNAMIC: they exist only
 * while their device instance does, so they never join the static legal-pair
 * domain; the compiler resolves them through the patch's slot assignments
 * into the pool block of the one rackMod bus.
 *
 * The pool block MIRRORS the static vocabulary one for one (engine:
 * laneModPoolTargetCount = rackModStaticTargetCount): a pool parameter's bus
 * index is the static count plus its mirror target's static index, derived —
 * never hand-numbered — so the two vocabularies cannot drift. A lane device
 * speaks its type's canonical modulation language: units, limits, clamping,
 * and readout formatting all defer to the same-named base-module target.
 */

import {
    MODULATION_RACK_TARGET_COUNT,
    getRackModulationTargetIndex,
    type RackModulationTargetKind,
} from "./modulation-targets";

/** Additional resident instances per effect type (engine lanePoolSetCount). */
export const MODULATION_LANE_POOL_SET_COUNT = 4;

/** Pool lanes on the rackMod bus: one full mirror of the static vocabulary
    per pool set. */
export const MODULATION_LANE_POOL_TARGET_COUNT =
    MODULATION_LANE_POOL_SET_COUNT * MODULATION_RACK_TARGET_COUNT;

export type LaneDeviceType =
    | "globalFilter" | "distortion" | "ott" | "chorus"
    | "flanger" | "phaser" | "delay" | "reverb";

export type ParsedLaneModulationTarget = {
    readonly instanceId: string;
    readonly deviceType: LaneDeviceType;
    readonly endpointID: string;
};

/** One live lane device: the per-patch unit the dynamic target domain is
    built from. lane.v1 pins exactly one instance-#1 device per type; the
    device-instance tree arrives with the add/remove UX. */
export type LaneDeviceInstance = {
    readonly instanceId: string;
    readonly deviceType: LaneDeviceType;
};

/** instanceId -> SLOT ordinal (0..MODULATION_LANE_POOL_SET_COUNT): ordinal 0
    is the base block (the resident instance-#1 devices), ordinals 1.. are the
    pool sets. Ordinals beyond the pool resolve to no slot. */
export type LaneSlotAssignments = ReadonlyMap<string, number>;

/** Modulatable pool endpoints per device type; the mirror target is always
    the instance-#1 base target. */
const LANE_DEVICE_ENDPOINTS: ReadonlyMap<LaneDeviceType, ReadonlyArray<string>> = new Map([
    ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"]],
    ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"]],
    ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"]],
    ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones"]],
    ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"]],
    ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"]],
    ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix"]],
    ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]],
]);

const LANE_KIND_PATTERN = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;

/** Parse an untrusted lane target without accepting unknown devices/params. */
export function parseLaneModulationTargetKind(value: unknown): ParsedLaneModulationTarget | null {
    if (typeof value !== "string") {
        return null;
    }
    const match = LANE_KIND_PATTERN.exec(value);
    if (match === null) {
        return null;
    }
    const deviceType = match[1] as LaneDeviceType;
    const endpoints = LANE_DEVICE_ENDPOINTS.get(deviceType);
    if (endpoints === undefined) {
        return null;
    }
    const endpointID = match[3];
    if (!endpoints.includes(endpointID)) {
        return null;
    }
    return {
        instanceId: `${deviceType}#${match[2]}`,
        deviceType,
        endpointID,
    };
}

/** The base-instance (#1) target that owns this lane parameter's language. */
export function laneMirrorRackKind(parsed: ParsedLaneModulationTarget): RackModulationTargetKind {
    return `lane.${parsed.deviceType}#1.${parsed.endpointID}`;
}

/** The instance's display number: `delay#2` -> 2. Total for parsed targets —
    the grammar only admits positive integers after the `#`. */
export function laneInstanceNumber(parsed: ParsedLaneModulationTarget): number {
    return Number(parsed.instanceId.slice(parsed.instanceId.indexOf("#") + 1));
}

/** One device's modulation target kinds, in the canonical catalog order the
    static vocabulary uses (pinned by the resident-domain invariant test). */
export function getLaneDeviceModulationTargetKinds(
    device: LaneDeviceInstance,
): ReadonlyArray<string> {
    const endpoints = LANE_DEVICE_ENDPOINTS.get(device.deviceType);
    if (endpoints === undefined) {
        throw new Error(`Unknown lane device type: ${device.deviceType}`);
    }
    return endpoints.map((endpointID) => `lane.${device.instanceId}.${endpointID}`);
}

/**
 * Resolve a parsed lane target to its engine bus index through the patch's
 * slot assignments: index = slotOrdinal * static count + the mirror target's
 * static index (ordinal 0 = the base block). Null = the instance holds no
 * slot (device deleted or beyond the pool): the route stays stored but
 * compiles to nothing.
 */
export function getLaneModulationTargetIndex(
    parsed: ParsedLaneModulationTarget | null,
    assignments: LaneSlotAssignments,
): number | null {
    if (parsed === null) {
        return null;
    }
    const ordinal = assignments.get(parsed.instanceId);
    if (ordinal === undefined || !Number.isInteger(ordinal)
            || ordinal < 0 || ordinal > MODULATION_LANE_POOL_SET_COUNT) {
        return null;
    }
    return (ordinal * MODULATION_RACK_TARGET_COUNT)
        + getRackModulationTargetIndex(laneMirrorRackKind(parsed));
}
