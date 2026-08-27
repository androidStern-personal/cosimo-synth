/**
 * T14/T15: the ONE resolver from a modulation target kind to its BASE
 * parameter's live-editing contract (engine endpoint + unit-aware entry
 * spec + labels). The mappings table's per-row rails and value sheets edit
 * any route's base through this — never a second per-surface table.
 *
 * Sources of truth composed here, never duplicated:
 * - rack targets:      ui/shared/rack-parameter-descriptors (via target kind
 *                      "lane.<instanceId>.<endpointID>")
 * - global filter:     ui/shared/target-descriptor (endpoint-bound entries)
 * - oscillator params: the Voice manifest (controlID <-> parameterKind) plus
 *                      the oscillator binding contract's per-osc endpoints
 * A target with no live endpoint (deliberately unbacked in the catalog)
 * resolves to null: its rail edits the modulation amount only.
 */

import {
    allRackParameterDescriptors,
    type RackParameterDescriptor,
} from "./rack-parameter-descriptors";
import { parseLaneModulationTargetKind } from "./lane-modulation-targets";
import { getModulationTargetDescriptor } from "./target-descriptor";
import {
    OSCILLATOR_IDS,
    type ModulationTargetKind,
    type OscillatorID,
    type OscillatorModulationParameterKind,
} from "./modulation-targets";
import { getOscillatorControlAddress } from "./oscillator-binding";
import { MOBILE_VOICE_PAGES, getMobileVoiceControlSpec } from "./mobile-voice-parameter-manifest";
import {
    parameterEntrySpecForMobileVoiceControl,
    parameterEntrySpecForRackParameter,
    parameterEntrySpecForScalar,
    parameterEntrySpecForSeconds,
    type ParameterEntrySpec,
} from "./parameter-value-entry";
import type { MobileVoiceBindableControlID } from "./mobile-voice-display-descriptors";
import { VOICE_FILTER_KNOB_DESCRIPTORS } from "./voice-filter-descriptors";
import {
    routeAmountOffsets,
    type MobileVoiceRailBand,
} from "./mobile-voice-rail-projection";
import type { ModulationRoute } from "./modulation";
import {
    GLOBAL_TUNE_ENDPOINT_ID,
    GLOBAL_TUNE_INITIAL_SEMITONES,
    GLOBAL_TUNE_MAX_SEMITONES,
    GLOBAL_TUNE_MIN_SEMITONES,
    GLOBAL_TUNE_STEP_SEMITONES,
    GLOBAL_TUNE_TARGET_KIND,
} from "./global-tune";

export type ModulationTargetRailProjection = {
    /** Value -> [0,1] track position in the parameter's own display scale. */
    readonly normalizeValue: (value: number) => number;
    /** The exact inverse: [0,1] track position -> value. The base drag walks
        the display scale through this pair (the knobs' settled rule), so
        equal finger travel is equal octaves on a log track. */
    readonly denormalizeValue: (normalized: number) => number;
    /** ReadoutCellSpec.projectBand-compatible band for one route. */
    readonly projectBand: (
        baseNormalized: number,
        route: Pick<ModulationRoute, "amount" | "polarity">,
    ) => MobileVoiceRailBand;
};

export type ModulationTargetBase = {
    readonly endpointID: string;
    readonly entrySpec: ParameterEntrySpec;
    /** The parameter's short display label (e.g. "Cutoff", "Pan"). */
    readonly label: string;
    /** The canonical initial value when the authority records one. */
    readonly initialValue: number | null;
    /** The rail's display projection: log parameters place their tick
        logarithmically and octave-application amounts travel in octaves —
        never as raw units added to a Hz value. */
    readonly railProjection: ModulationTargetRailProjection;
    /** How vertical (amount) travel maps: "amount-span" walks the amount
        domain linearly; "effective-value" walks the MODULATED value along
        the parameter's own dial (the knobs' settled resonance rule). */
    readonly amountDragStyle: "amount-span" | "effective-value";
};

const RAIL_EPSILON = 1e-9;

function buildRailProjection({ min, max, scale, application }: {
    min: number;
    max: number;
    scale: "linear" | "log";
    application: "linear" | "octaves";
}): ModulationTargetRailProjection {
    if (!(max > min) || (scale === "log" && !(min > 0))) {
        throw new Error(`Invalid rail projection domain [${min}, ${max}] (${scale}).`);
    }
    const normalizeValue = (value: number) => {
        const clamped = Math.min(max, Math.max(min, value));
        return scale === "log"
            ? Math.log(clamped / min) / Math.log(max / min)
            : (clamped - min) / (max - min);
    };
    const denormalizeValue = (normalized: number) => {
        const clamped = Math.min(1, Math.max(0, normalized));
        return scale === "log"
            ? min * ((max / min) ** clamped)
            : min + (clamped * (max - min));
    };
    const projectBand = (
        baseNormalized: number,
        route: Pick<ModulationRoute, "amount" | "polarity">,
    ): MobileVoiceRailBand => {
        const clampedBase = Math.min(1, Math.max(0, baseNormalized));
        const baseValue = denormalizeValue(clampedBase);
        const offsets = routeAmountOffsets(route);
        const rawLow = application === "octaves"
            ? baseValue * (2 ** offsets[0])
            : baseValue + offsets[0];
        const rawHigh = application === "octaves"
            ? baseValue * (2 ** offsets[1])
            : baseValue + offsets[1];
        const lowNormalized = normalizeValue(rawLow);
        const highNormalized = normalizeValue(rawHigh);
        const magnitude = Math.abs(route.amount);
        return Object.freeze({
            baseNormalized: clampedBase,
            lowNormalized,
            highNormalized,
            clippedLow: rawLow < min - RAIL_EPSILON,
            clippedHigh: rawHigh > max + RAIL_EPSILON,
            fullyClipped: magnitude > RAIL_EPSILON
                && Math.abs(highNormalized - lowNormalized) <= RAIL_EPSILON,
        });
    };
    return { normalizeValue, denormalizeValue, projectBand };
}

const rackDescriptorsByEndpoint: ReadonlyMap<string, RackParameterDescriptor> = new Map(
    allRackParameterDescriptors().map((descriptor: RackParameterDescriptor) => [descriptor.endpointID, descriptor]),
);

const voiceControlByParameterKind: ReadonlyMap<OscillatorModulationParameterKind, MobileVoiceBindableControlID> = new Map(
    MOBILE_VOICE_PAGES.flatMap((page) => page.cells)
        .flatMap((controlID) => {
            if (controlID === "wavetableSelect") {
                return [];
            }
            const parameterKind = getMobileVoiceControlSpec(controlID).modulationParameterKind;
            return parameterKind === null ? [] : [[parameterKind, controlID] as const];
        }),
);

function parseOscillatorTarget(targetKind: string): {
    oscillatorID: OscillatorID;
    parameterKind: OscillatorModulationParameterKind;
} | null {
    const match = /^osc([A-Z])\.(.+)$/.exec(targetKind);
    if (match === null || !(OSCILLATOR_IDS as ReadonlyArray<string>).includes(match[1])) {
        return null;
    }
    return {
        oscillatorID: match[1] as OscillatorID,
        parameterKind: match[2] as OscillatorModulationParameterKind,
    };
}

export function resolveModulationTargetBase(targetKind: ModulationTargetKind): ModulationTargetBase | null {
    const parsedLane = parseLaneModulationTargetKind(targetKind);
    if (parsedLane !== null) {
        // T6: every instance has its own lane.v2 document slot, and the base
        // CONTRACT (endpoint, spec, labels) is the type's. Which slot a
        // binding edits comes from the deviceId its caller threads through
        // useLaneOrHostParameterBinding.
        const endpointID = parsedLane.endpointID;
        const descriptor = rackDescriptorsByEndpoint.get(endpointID);
        if (descriptor === undefined) {
            throw new Error(`Rack modulation target "${targetKind}" has no rack descriptor.`);
        }
        const entrySpec = parameterEntrySpecForRackParameter(descriptor, descriptor.initial);
        return {
            endpointID,
            entrySpec,
            label: descriptor.label,
            initialValue: descriptor.initial,
            railProjection: buildRailProjection({
                min: entrySpec.min,
                max: entrySpec.max,
                scale: descriptor.scale,
                application: descriptor.modulationApplication ?? "linear",
            }),
            amountDragStyle: descriptor.modulationDragStyle ?? "amount-span",
        };
    }

    const oscillatorTarget = parseOscillatorTarget(targetKind);
    if (oscillatorTarget !== null) {
        const controlID = voiceControlByParameterKind.get(oscillatorTarget.parameterKind);
        if (controlID === undefined) {
            // Engine-only oscillator destinations without a presented base
            // control edit amount-only from the table.
            return null;
        }
        const address = getOscillatorControlAddress(oscillatorTarget.oscillatorID, controlID);
        const entrySpec = parameterEntrySpecForMobileVoiceControl(controlID);
        return {
            endpointID: address.endpointID,
            entrySpec,
            label: getMobileVoiceControlSpec(controlID).fullLabel,
            initialValue: null,
            railProjection: buildRailProjection({
                min: entrySpec.min,
                max: entrySpec.max,
                scale: "linear",
                application: "linear",
            }),
            amountDragStyle: "amount-span",
        };
    }

    // Catalog-owned targets: endpoint-bound entries resolve; deliberately
    // unbacked ones do not.
    const descriptor = getModulationTargetDescriptor(targetKind);
    const binding = descriptor.binding;
    if (binding._tag !== "endpoint") {
        return null;
    }
    if (/^(?:mseg[123]|env[123]|ampEnvelope)$/.test(descriptor.moduleId)) {
        const initialValue = binding.toEngine(descriptor.initialValue);
        let entrySpec: ParameterEntrySpec;
        if (descriptor.format.kind === "percent") {
            entrySpec = parameterEntrySpecForScalar({
                min: 0,
                max: 1,
                step: 0.001,
                unit: "%",
                canonicalPerDisplayedUnit: 0.01,
                digits: 3,
            });
        } else if (descriptor.format.kind === "time") {
            entrySpec = parameterEntrySpecForSeconds({
                minSeconds: descriptor.format.minSeconds,
                maxSeconds: descriptor.format.maxSeconds,
                stepSeconds: 0.001,
                currentSeconds: initialValue,
            });
        } else {
            throw new Error(`Generator target "${targetKind}" has no percent/time entry format.`);
        }
        return {
            endpointID: binding.endpointId,
            entrySpec,
            label: descriptor.label,
            initialValue,
            railProjection: buildRailProjection({
                min: entrySpec.min,
                max: entrySpec.max,
                scale: "linear",
                application: "linear",
            }),
            amountDragStyle: "amount-span",
        };
    }
    if (targetKind === GLOBAL_TUNE_TARGET_KIND) {
        const entrySpec = parameterEntrySpecForScalar({
            min: GLOBAL_TUNE_MIN_SEMITONES,
            max: GLOBAL_TUNE_MAX_SEMITONES,
            step: GLOBAL_TUNE_STEP_SEMITONES,
            unit: "st",
            digits: 2,
        });
        return {
            endpointID: GLOBAL_TUNE_ENDPOINT_ID,
            entrySpec,
            label: descriptor.label,
            initialValue: GLOBAL_TUNE_INITIAL_SEMITONES,
            railProjection: buildRailProjection({
                min: GLOBAL_TUNE_MIN_SEMITONES,
                max: GLOBAL_TUNE_MAX_SEMITONES,
                scale: "linear",
                application: "linear",
            }),
            amountDragStyle: "amount-span",
        };
    }
    const voiceFilterDescriptor = Object.values(VOICE_FILTER_KNOB_DESCRIPTORS)
        .find((candidate) => candidate.endpointID === binding.endpointId);
    if (voiceFilterDescriptor !== undefined) {
        const entrySpec = parameterEntrySpecForRackParameter(voiceFilterDescriptor, voiceFilterDescriptor.initial);
        return {
            endpointID: voiceFilterDescriptor.endpointID,
            entrySpec,
            label: voiceFilterDescriptor.label,
            initialValue: voiceFilterDescriptor.initial,
            railProjection: buildRailProjection({
                min: entrySpec.min,
                max: entrySpec.max,
                scale: voiceFilterDescriptor.scale,
                application: voiceFilterDescriptor.modulationApplication ?? "linear",
            }),
            amountDragStyle: voiceFilterDescriptor.modulationDragStyle ?? "amount-span",
        };
    }
    return null;
}
