/**
 * Effects Lane slot parameter wire layout (B3 parameter cut).
 *
 * Since the parameter cut there are NO per-effect host endpoints: every
 * device parameter — ordinal 0 included — rides the two record events on
 * wt::EffectsRack:
 *
 *   laneSlotParams      { slotId, deliverySerial, values[12] }  bulk restore
 *   laneSlotParamValue  { slotId, paramIndex, deliverySerial, value }  live edit
 *
 * A slot's record is POSITIONAL: `values[paramIndex]` for the device type's
 * parameter at that index. The layouts below mirror the engine's
 * lane<Type>Param* constants one for one (EffectsRack.cmajor) and are the
 * single TS source of truth for paramIndex; they are derived into records,
 * never hand-numbered at call sites.
 */

import type { LaneDeviceType } from "./lane-modulation-targets";

/** Engine laneSlotParamCount: every record carries this many values. */
export const LANE_SLOT_PARAM_COUNT = 12;

/** Engine lanePoolInstanceCount: ordinals 0..4 exist per device type. */
export const LANE_SLOT_ORDINAL_COUNT = 5;

/** Engine rackModuleCount: slot = ordinal * 8 + type wire id. */
export const LANE_SLOT_TYPE_COUNT = 8;

const LANE_TYPE_WIRE_IDS: Readonly<Record<LaneDeviceType, number>> = Object.freeze({
    globalFilter: 0,
    distortion: 1,
    ott: 2,
    chorus: 3,
    flanger: 4,
    phaser: 5,
    delay: 6,
    reverb: 7,
});

/** Positional record layout per device type (index IS the wire paramIndex). */
const LANE_DEVICE_PARAM_LAYOUT: Readonly<Record<LaneDeviceType, ReadonlyArray<string>>> = Object.freeze({
    globalFilter: [
        "globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive",
        "globalFilterCutoffKeyTrackEnabled", "globalFilterCutoffKeyTrackOffsetSemitones",
    ],
    distortion: [
        "distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType",
        "distortionWetHPKeyTrackEnabled", "distortionWetHPKeyTrackOffsetSemitones",
        "distortionWetLPKeyTrackEnabled", "distortionWetLPKeyTrackOffsetSemitones",
    ],
    ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
    chorus: [
        "chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones",
        "chorusRingFrequencyHz", "chorusRingKeyTrackEnabled", "chorusRingKeyTrackOffsetSemitones", "chorusRingLegacyClampEnabled",
    ],
    flanger: [
        "flangerRate", "flangerDepth", "flangerFeedback", "flangerMix",
        "flangerBaseDelayMs", "flangerBaseDelayKeyTrackEnabled", "flangerBaseDelayKeyTrackOffsetSemitones",
    ],
    phaser: [
        "phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix",
        "phaserFrequencyKeyTrackEnabled", "phaserFrequencyKeyTrackOffsetSemitones",
    ],
    delay: [
        "delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision",
        "delayTimeKeyTrackEnabled", "delayTimeKeyTrackOffsetSemitones",
        "delayFilterKeyTrackEnabled", "delayFilterKeyTrackOffsetSemitones",
    ],
    reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"],
});

/** Exact per-device records written before T50 appended Key Track state. */
export const LEGACY_LANE_DEVICE_PARAM_ENDPOINTS: Readonly<Record<LaneDeviceType, ReadonlyArray<string>>> = Object.freeze({
    globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
    distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
    ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
    chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
    flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
    phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
    delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
    reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"],
});

/** The first T50 record shape, before the hidden Chorus compatibility bit. */
export const PRE_CHORUS_LEGACY_CLAMP_ENDPOINTS: ReadonlyArray<string> = Object.freeze([
    "chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones",
    "chorusRingFrequencyHz", "chorusRingKeyTrackEnabled", "chorusRingKeyTrackOffsetSemitones",
]);

const APPENDED_LANE_PARAM_DEFAULTS: Readonly<Record<string, number>> = Object.freeze({
    globalFilterCutoffKeyTrackEnabled: 0,
    globalFilterCutoffKeyTrackOffsetSemitones: 0,
    distortionWetHPKeyTrackEnabled: 0,
    distortionWetHPKeyTrackOffsetSemitones: 0,
    distortionWetLPKeyTrackEnabled: 0,
    distortionWetLPKeyTrackOffsetSemitones: 0,
    chorusRingOffsetMode: 0,
    chorusRingFineSemitones: 0,
    chorusRingFrequencyHz: 28,
    chorusRingKeyTrackEnabled: 0,
    chorusRingKeyTrackOffsetSemitones: 0,
    chorusRingLegacyClampEnabled: 0,
    flangerBaseDelayMs: 0.6,
    flangerBaseDelayKeyTrackEnabled: 0,
    flangerBaseDelayKeyTrackOffsetSemitones: 0,
    phaserFrequencyKeyTrackEnabled: 0,
    phaserFrequencyKeyTrackOffsetSemitones: 0,
    delayTimeKeyTrackEnabled: 0,
    delayTimeKeyTrackOffsetSemitones: 0,
    delayFilterKeyTrackEnabled: 0,
    delayFilterKeyTrackOffsetSemitones: 0,
});

function legacyChorusRingOffsetSemitones(mode: number): number {
    if (Math.round(mode) === 1) return -5;
    if (Math.round(mode) === 2) return 12;
    if (Math.round(mode) === 3) return -12;
    return 7;
}

/**
 * Expand any validated pre-T50/presentation record to the append-only wire
 * layout. The old Chorus mode + fine fields are retained at their deployed
 * indexes and translated to an enabled tracked offset, preserving its sound.
 */
export function materializeLaneDeviceParams(
    deviceType: LaneDeviceType,
    input: Readonly<Record<string, unknown>>,
): Record<string, number> {
    const params: Record<string, number> = {};
    for (const endpointID of LANE_DEVICE_PARAM_LAYOUT[deviceType]) {
        const value = input[endpointID];
        if (typeof value === "number" && Number.isFinite(value)) {
            params[endpointID] = value;
            continue;
        }
        const fallback = APPENDED_LANE_PARAM_DEFAULTS[endpointID];
        if (fallback === undefined) {
            throw new Error(`Missing lane parameter value: ${deviceType}.${endpointID}`);
        }
        params[endpointID] = fallback;
    }

    const legacyChorusEndpoints = LEGACY_LANE_DEVICE_PARAM_ENDPOINTS.chorus;
    const inputEndpoints = Object.keys(input);
    const isLegacyChorus = deviceType === "chorus"
        && inputEndpoints.length === legacyChorusEndpoints.length
        && inputEndpoints.every((endpointID) => legacyChorusEndpoints.includes(endpointID));
    if (isLegacyChorus) {
        params.chorusRingKeyTrackEnabled = 1;
        params.chorusRingKeyTrackOffsetSemitones = legacyChorusRingOffsetSemitones(
            Number(input.chorusRingOffsetMode),
        ) + Number(input.chorusRingFineSemitones);
        params.chorusRingLegacyClampEnabled = 1;
    }
    return params;
}

/** The full parameter vocabulary of one device type, in wire order. */
export function laneDeviceParamEndpoints(deviceType: LaneDeviceType): ReadonlyArray<string> {
    return LANE_DEVICE_PARAM_LAYOUT[deviceType];
}

/** The wire paramIndex of one parameter, or null for an unknown endpoint. */
export function getLaneSlotParamIndex(deviceType: LaneDeviceType, endpointID: string): number | null {
    const index = LANE_DEVICE_PARAM_LAYOUT[deviceType].indexOf(endpointID);
    return index >= 0 ? index : null;
}

/** The engine slot id for one placed device: ordinal * 8 + type wire id. */
export function getLaneSlotId(deviceType: LaneDeviceType, ordinal: number): number {
    if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= LANE_SLOT_ORDINAL_COUNT) {
        throw new Error(`Lane ordinal out of range: ${ordinal}`);
    }
    return (ordinal * LANE_SLOT_TYPE_COUNT) + LANE_TYPE_WIRE_IDS[deviceType];
}

/** Build one complete positional record from a device's parameter values. */
export function buildLaneSlotParamValues(
    deviceType: LaneDeviceType,
    params: Readonly<Record<string, number>>,
): number[] {
    const values = new Array<number>(LANE_SLOT_PARAM_COUNT).fill(0);
    const materialized = materializeLaneDeviceParams(deviceType, params);
    LANE_DEVICE_PARAM_LAYOUT[deviceType].forEach((endpointID, index) => {
        values[index] = materialized[endpointID];
    });
    return values;
}
