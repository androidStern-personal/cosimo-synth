/**
 * Cosimo Synth parameter entry spec builders. The generic spec model,
 * formatting, and parsing live in kit/ui/parameter-value-entry.ts and are
 * re-exported here so synth consumers keep one import site.
 */

import {
    getRackEffectDescriptor,
    getRackParameterDescriptor,
    getRackParameterDescriptorForModulationEndpoint,
    type RackParameterChoice,
    type RackParameterDescriptor,
} from "./rack-parameter-descriptors";
import { laneMirrorRackKind, parseLaneModulationTargetKind } from "./lane-modulation-targets";
import {
    getModulationAmountBounds,
    isRackModulationTarget,
} from "./modulation";
import {
    getVoiceModulationParameterKind,
    parseVoiceModulationTargetKind,
    type ModulationTargetKind,
    type VoiceModulationTargetKind,
} from "./modulation-targets";
import {
    MOBILE_VOICE_DISPLAY_DESCRIPTORS,
    type MobileVoiceBindableControlID,
} from "./mobile-voice-display-descriptors";
import { getMobileVoiceControlSpec } from "./mobile-voice-parameter-manifest";
import { getModulationTargetDescriptor } from "./target-descriptor";
import {
    requireKeyTrackRange,
    type KeyTrackParameterFamily,
    type KeyTrackRouteStorage,
} from "./key-track";
import {
    AmountParameterEntrySpec,
    FrequencyParameterEntrySpec,
    MillisecondsParameterEntrySpec,
    ModulationAmountBaseBindingSpec,
    ParameterEntrySpec,
    ScalarParameterEntrySpec,
    amountSpec,
    frequencySpec,
    requirePositiveLogarithmicBase,
    scalarSpec,
} from "../../kit/ui/parameter-value-entry";

export * from "../../kit/ui/parameter-value-entry";

function millisecondsSpec(
    descriptor: RackParameterDescriptor,
    currentValue: number,
): MillisecondsParameterEntrySpec {
    return {
        _tag: "milliseconds",
        min: descriptor.min,
        max: descriptor.max,
        step: 0,
        defaultUnit: currentValue < 1_000 ? "ms" : "s",
    };
}

function tempoSyncCompanion(
    descriptor: RackParameterDescriptor,
): RackParameterDescriptor | null {
    const divisionEndpointID = descriptor.endpointID === "delayTime"
        ? "delayDivision"
        : descriptor.endpointID === "phaserRate"
            ? "phaserRateDivision"
            : null;
    if (divisionEndpointID === null) {
        return null;
    }
    return getRackEffectDescriptor(descriptor.effectId).parameters.find(
        (parameter) => parameter.endpointID === divisionEndpointID,
    ) ?? null;
}

/** Derive a base-value entry spec from the authoritative rack descriptor. */
export function parameterEntrySpecForRackParameter(
    descriptor: RackParameterDescriptor,
    currentValue: number,
): ParameterEntrySpec {
    if (descriptor.choices !== undefined) {
        return {
            _tag: "choice",
            min: descriptor.min,
            max: descriptor.max,
            step: descriptor.step,
            defaultUnit: "choice",
            choices: descriptor.choices,
        };
    }

    let spec: FrequencyParameterEntrySpec | MillisecondsParameterEntrySpec | ScalarParameterEntrySpec;
    if (descriptor.unit === "Hz") {
        spec = frequencySpec(
            descriptor.min,
            descriptor.max,
            0,
            descriptor.endpointID === "globalFilterCutoff" ? "log" : null,
        );
    } else if (descriptor.unit === "ms") {
        spec = millisecondsSpec(descriptor, currentValue);
    } else if (descriptor.unit === "%") {
        spec = scalarSpec({ min: descriptor.min, max: descriptor.max, step: 0, unit: "%", digits: 4 });
    } else if (descriptor.unit === "dB") {
        spec = scalarSpec({ min: descriptor.min, max: descriptor.max, step: 0, unit: "dB", digits: 4 });
    } else if (descriptor.unit === "deg") {
        spec = scalarSpec({ min: descriptor.min, max: descriptor.max, step: 0, unit: "°", digits: 4 });
    } else if (descriptor.unit === "st") {
        spec = scalarSpec({ min: descriptor.min, max: descriptor.max, step: 0, unit: "st", digits: 4 });
    } else {
        spec = scalarSpec({
            min: descriptor.min,
            max: descriptor.max,
            step: 0,
            unit: "%",
            canonicalPerDisplayedUnit: 0.01,
            digits: 4,
        });
    }

    const divisionDescriptor = tempoSyncCompanion(descriptor);
    if (divisionDescriptor?.choices === undefined || spec._tag === "scalar") {
        return spec;
    }
    return {
        _tag: "tempoSync",
        min: spec.min,
        max: spec.max,
        step: spec.step,
        defaultUnit: spec.defaultUnit,
        freeSpec: spec,
        divisions: divisionDescriptor.choices,
    };
}


function nativePercentAmount(
    min: number,
    max: number,
    step: number,
    canonicalPerDisplayedUnit: number,
): AmountParameterEntrySpec {
    return amountSpec({
        min,
        max,
        step,
        defaultUnit: "%",
        canonicalPerDisplayedUnit,
        digits: 3,
        percentMeaning: "native",
        baseValue: null,
        physicalIntervalUnit: null,
    });
}

function voiceAmountSpec(
    targetKind: VoiceModulationTargetKind,
    baseValue: number,
): ParameterEntrySpec {
    const bounds = getModulationAmountBounds(targetKind);
    const parameterKind = getVoiceModulationParameterKind(targetKind);
    switch (parameterKind) {
        case "filterCutoffOctaves":
        case "voiceEnhancerFrequencyOctaves":
            requirePositiveLogarithmicBase(baseValue);
            return amountSpec({
                ...bounds,
                defaultUnit: "oct",
                canonicalPerDisplayedUnit: 1,
                digits: 3,
                percentMeaning: "depth",
                baseValue,
                physicalIntervalUnit: "frequency",
            });
        case "filterQ":
        case "voiceEnhancerQ":
            return amountSpec({ ...bounds, defaultUnit: "Q", canonicalPerDisplayedUnit: 1, digits: 3, percentMeaning: "depth", baseValue: null, physicalIntervalUnit: null });
        case "pitchSemitones":
        case "globalTuneSemitones":
            return amountSpec({ ...bounds, defaultUnit: "st", canonicalPerDisplayedUnit: 1, digits: 3, percentMeaning: "depth", baseValue: null, physicalIntervalUnit: null });
        case "ampGainDb":
            return amountSpec({ ...bounds, defaultUnit: "dB", canonicalPerDisplayedUnit: 1, digits: 3, percentMeaning: "depth", baseValue: null, physicalIntervalUnit: null });
        case "mseg1Rate":
        case "mseg2Rate":
        case "mseg3Rate":
        case "env1Attack":
        case "env1Decay":
        case "env1Release":
        case "env2Attack":
        case "env2Decay":
        case "env2Release":
        case "env3Attack":
        case "env3Decay":
        case "env3Release":
        case "ampAttack":
        case "ampDecay":
        case "ampRelease":
            return amountSpec({ ...bounds, defaultUnit: "s", canonicalPerDisplayedUnit: 1, digits: 3, percentMeaning: "depth", baseValue: null, physicalIntervalUnit: null });
        case "pan":
            return { _tag: "pan", ...bounds, defaultUnit: "%" };
        case "wavetablePosition":
        case "warpAmount":
        case "filterMix":
        case "voiceEnhancerAmount":
        case "unisonDetune":
        case "unisonBlend":
        case "unisonWidth":
        case "unisonWavetablePositionSpread":
        case "unisonWarpSpread":
        case "mseg1Morph":
        case "mseg2Morph":
        case "mseg3Morph":
        case "env1Sustain":
        case "env2Sustain":
        case "env3Sustain":
        case "ampSustain":
            return nativePercentAmount(bounds.min, bounds.max, bounds.step, 0.01);
    }
}

function rackAmountSpec(
    targetKind: ModulationTargetKind,
    descriptor: RackParameterDescriptor,
    baseValue: number,
): AmountParameterEntrySpec {
    const bounds = getModulationAmountBounds(targetKind);
    if (descriptor.modulationApplication === "octaves") {
        requirePositiveLogarithmicBase(baseValue);
        return amountSpec({
            ...bounds,
            defaultUnit: "oct",
            canonicalPerDisplayedUnit: 1,
            digits: 3,
            percentMeaning: "depth",
            baseValue,
            physicalIntervalUnit: descriptor.unit === "ms" ? "milliseconds" : "frequency",
        });
    }
    if (descriptor.modulationApplication === "semitones") {
        return amountSpec({
            ...bounds,
            defaultUnit: "st",
            canonicalPerDisplayedUnit: 1,
            digits: 4,
            percentMeaning: "depth",
            baseValue: null,
            physicalIntervalUnit: null,
        });
    }
    if (descriptor.unit === "" && descriptor.max - descriptor.min <= 2) {
        return nativePercentAmount(bounds.min, bounds.max, bounds.step, 0.01);
    }
    if (descriptor.unit === "%") {
        return nativePercentAmount(bounds.min, bounds.max, bounds.step, 1);
    }
    const defaultUnit = descriptor.unit === "deg"
        ? "°"
        : descriptor.unit === ""
            ? "Q"
            : descriptor.unit;
    return amountSpec({
        ...bounds,
        defaultUnit,
        canonicalPerDisplayedUnit: 1,
        digits: 3,
        percentMeaning: "depth",
        baseValue: null,
        physicalIntervalUnit: null,
    });
}

/** A lane parameter's amount language is its device type's canonical (#1)
    language — pool instances defer to the same-named base-module target. */
function laneAmountAuthorityKind(targetKind: ModulationTargetKind): ModulationTargetKind {
    const parsedLane = parseLaneModulationTargetKind(targetKind);
    return parsedLane !== null ? laneMirrorRackKind(parsedLane) : targetKind;
}

/** Derive a modulation-amount spec from the canonical target and route limit table. */
export function parameterEntrySpecForModulationAmount(
    targetKind: ModulationTargetKind,
    baseValue: number,
): ParameterEntrySpec {
    const voiceTargetKind = parseVoiceModulationTargetKind(targetKind);
    if (voiceTargetKind !== null) {
        return voiceAmountSpec(voiceTargetKind, baseValue);
    }
    if (parseLaneModulationTargetKind(targetKind)?.deviceType === "frequencySplit") {
        return amountSpec({
            min: -4,
            max: 4,
            step: 0,
            defaultUnit: "oct",
            canonicalPerDisplayedUnit: 1,
            digits: 4,
            percentMeaning: "depth",
            baseValue: null,
            physicalIntervalUnit: null,
        });
    }
    if (!isRackModulationTarget(laneAmountAuthorityKind(targetKind))) {
        throw new Error(`Unknown modulation target "${targetKind}".`);
    }
    const descriptor = getRackParameterDescriptorForModulationEndpoint(
        parseLaneModulationTargetKind(targetKind)?.endpointID ?? "",
    );
    if (descriptor === null || descriptor.modulationTargetIndex === null) {
        throw new Error(`Unknown rack modulation target "${targetKind}".`);
    }
    return rackAmountSpec(targetKind, descriptor, baseValue);
}

/**
 * Resolve the live base endpoint needed by logarithmic modulation amounts.
 * Linear amounts have no base dependency and deliberately return null.
 */
export function modulationAmountBaseBindingSpec(
    targetKind: ModulationTargetKind,
): ModulationAmountBaseBindingSpec | null {
    const voiceTargetKind = parseVoiceModulationTargetKind(targetKind);
    if (parseLaneModulationTargetKind(targetKind)?.deviceType === "frequencySplit") {
        return null;
    }
    const authorityKind = laneAmountAuthorityKind(targetKind);
    const needsBase = voiceTargetKind === "filterCutoffOctaves"
        || (isRackModulationTarget(authorityKind)
            && getRackParameterDescriptorForModulationEndpoint(
                parseLaneModulationTargetKind(targetKind)?.endpointID ?? "",
            )?.modulationApplication === "octaves");
    if (!needsBase) {
        return null;
    }

    const descriptor = getModulationTargetDescriptor(authorityKind);
    if (descriptor.binding._tag !== "endpoint") {
        throw new Error(`Logarithmic modulation target "${targetKind}" has no base endpoint.`);
    }
    return {
        endpointID: descriptor.binding.endpointId,
        initialValue: descriptor.binding.toEngine(descriptor.initialValue),
    };
}

/** Derive a time spec whose bare-number unit matches the value currently displayed. */

export function parameterEntrySpecForKeyTrackOffset(
    family: KeyTrackParameterFamily,
): ParameterEntrySpec {
    const range = requireKeyTrackRange(family);
    return scalarSpec({
        min: range.knobMin,
        max: range.knobMax,
        step: 0,
        unit: "st",
        digits: 4,
    });
}

/**
 * Key Track route entry always speaks semitones/cents. The spec's bounds and
 * conversion preserve the route's deployed octave or semitone storage.
 */
export function parameterEntrySpecForKeyTrackModulationAmount(
    family: KeyTrackParameterFamily,
    storage: KeyTrackRouteStorage,
): ParameterEntrySpec {
    const range = requireKeyTrackRange(family);
    const canonicalPerDisplayedUnit = storage === "octaves" ? 1 / 12 : 1;
    return amountSpec({
        min: range.routeMin * canonicalPerDisplayedUnit,
        max: range.routeMax * canonicalPerDisplayedUnit,
        step: 0,
        defaultUnit: "st",
        canonicalPerDisplayedUnit,
        digits: 4,
        percentMeaning: "depth",
        baseValue: null,
        physicalIntervalUnit: null,
    });
}

/** Derive exact-entry behavior from the authoritative mobile Voice display contract. */
export function parameterEntrySpecForMobileVoiceControl(
    controlID: MobileVoiceBindableControlID,
): ParameterEntrySpec {
    const display = MOBILE_VOICE_DISPLAY_DESCRIPTORS[controlID];
    const control = getMobileVoiceControlSpec(controlID);
    if (control.format === "pan") {
        return { _tag: "pan", min: display.min, max: display.max, step: display.step, defaultUnit: "%" };
    }
    if (control.format === "voices") {
        return scalarSpec({ ...display, unit: "x", digits: 0 });
    }
    if (control.format === "detuneCents") {
        return scalarSpec({ ...display, unit: "ct", canonicalPerDisplayedUnit: 0.02, digits: 2 });
    }
    if (control.format === "percent") {
        return scalarSpec({ ...display, unit: "%", canonicalPerDisplayedUnit: 0.01, digits: 3 });
    }
    if (control.format === "octave") {
        return scalarSpec({ ...display, unit: "oct", digits: 0 });
    }
    if (control.format === "semitone") {
        return scalarSpec({ ...display, unit: "st", digits: 0 });
    }
    if (control.format === "cents") {
        return scalarSpec({ ...display, unit: "ct", digits: 0 });
    }
    if (control.format === "decibels") {
        return scalarSpec({ ...display, unit: "dB", digits: 1 });
    }
    if (display.choices !== undefined) {
        return {
            _tag: "choice",
            min: display.min,
            max: display.max,
            step: display.step,
            defaultUnit: "choice",
            choices: display.choices.map((label, value) => ({ label, value })),
        };
    }
    throw new Error(`Mobile Voice control "${controlID}" has no exact-entry format.`);
}
