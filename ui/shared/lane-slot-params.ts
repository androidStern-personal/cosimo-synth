/**
 * Effects Lane slot parameter wire layout (B3 parameter cut).
 *
 * Since the parameter cut, ordinary effect parameters ride the two record
 * events on wt::EffectsRack. T78's Output Trim is the one deliberate
 * exception: its lane-record value is also mirrored to a real type+instance
 * host endpoint for automation.
 *
 *   laneSlotParams      { slotId, deliverySerial, values[13] }  bulk restore
 *   laneSlotParamValue  { slotId, paramIndex, deliverySerial, value }  live edit
 *
 * A slot's record is POSITIONAL: `values[paramIndex]` for the device type's
 * parameter at that index. The layouts below mirror the engine's
 * lane<Type>Param* constants one for one (EffectsRack.cmajor) and are the
 * single TS source of truth for paramIndex; they are derived into records,
 * never hand-numbered at call sites.
 */

import type { LaneDeviceType } from "./lane-modulation-targets";
import { effectOutputTrimLaneEndpointID } from "./effect-output-trim";

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
        effectOutputTrimLaneEndpointID("globalFilter"),
    ],
    distortion: [
        "distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType",
        "distortionWetHPKeyTrackEnabled", "distortionWetHPKeyTrackOffsetSemitones",
        "distortionWetLPKeyTrackEnabled", "distortionWetLPKeyTrackOffsetSemitones",
        effectOutputTrimLaneEndpointID("distortion"),
    ],
    ott: [
        "ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch",
        effectOutputTrimLaneEndpointID("ott"),
    ],
    chorus: [
        "chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones",
        "chorusRingFrequencyHz", "chorusRingKeyTrackEnabled", "chorusRingKeyTrackOffsetSemitones",
        effectOutputTrimLaneEndpointID("chorus"),
    ],
    flanger: [
        "flangerRate", "flangerDepth", "flangerFeedback", "flangerMix",
        "flangerBaseDelayMs", "flangerBaseDelayKeyTrackEnabled", "flangerBaseDelayKeyTrackOffsetSemitones",
        effectOutputTrimLaneEndpointID("flanger"),
    ],
    phaser: [
        "phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix",
        "phaserFrequencyKeyTrackEnabled", "phaserFrequencyKeyTrackOffsetSemitones",
        effectOutputTrimLaneEndpointID("phaser"),
    ],
    delay: [
        "delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision",
        "delayTimeKeyTrackEnabled", "delayTimeKeyTrackOffsetSemitones",
        "delayFilterKeyTrackEnabled", "delayFilterKeyTrackOffsetSemitones",
        effectOutputTrimLaneEndpointID("delay"),
    ],
    reverb: [
        "reverbSize", "reverbDecay", "reverbDamping", "reverbMix",
        effectOutputTrimLaneEndpointID("reverb"),
    ],
});

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
    LANE_DEVICE_PARAM_LAYOUT[deviceType].forEach((endpointID, index) => {
        const value = params[endpointID];
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new Error(`Missing lane parameter value: ${deviceType}.${endpointID}`);
        }
        values[index] = value;
    });
    return values;
}
