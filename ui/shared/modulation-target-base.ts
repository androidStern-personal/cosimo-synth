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
import { laneMirrorRackKind, parseLaneModulationTargetKind } from "./lane-modulation-targets";
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
    parameterEntrySpecForKeyTrackModulationAmount,
    parameterEntrySpecForKeyTrackOffset,
    parameterEntrySpecForFrequency,
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
import {
    getKeyTrackDefinition,
    keyTrackRouteAmountFromSemitones,
    keyTrackRouteAmountToSemitones,
    requireKeyTrackRange,
    type KeyTrackControlDefinition,
    type KeyTrackRouteStorage,
} from "./key-track";
import {
    LANE_SPLIT_DEFAULT_XOVER_HIGH_HZ,
    LANE_SPLIT_DEFAULT_XOVER_LOW_HZ,
    LANE_SPLIT_XOVER_MAX_HZ,
    LANE_SPLIT_XOVER_MIN_HZ,
} from "./lane-state-v2";
import {
    VOICE_ENHANCER_KEY_TRACK_CONTROL_ID,
    VOICE_ENHANCER_KEY_TRACK_ENABLED_ENDPOINT_ID,
    VOICE_ENHANCER_KEY_TRACK_OFFSET_ENDPOINT_ID,
    VOICE_ENHANCER_PARAMETER_DESCRIPTORS,
} from "./voice-enhancer";
import {
    effectOutputTrimEffectiveDb,
    effectOutputTrimNormalizedValue,
    effectOutputTrimValueFromNormalized,
} from "./effect-output-trim";

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
    /** Split-marker fields are lane-document addresses rather than ordinary
        lane-device/host endpoints. Absence means the existing endpoint seam. */
    readonly laneSplitBinding?: {
        readonly groupId: string;
        readonly which: "low" | "high";
    };
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
    /** Optional alternate base presentation for the same canonical route
        identity while its destination is in Key Track mode. */
    readonly keyTrack: ModulationTargetKeyTrackBase | null;
};

export type ModulationTargetKeyTrackBase = {
    readonly definition: KeyTrackControlDefinition;
    readonly storage: KeyTrackRouteStorage;
    readonly binding: {
        readonly kind: "lane";
        readonly descriptor: RackParameterDescriptor;
    } | {
        readonly kind: "lane-split";
        readonly groupId: string;
        readonly which: "low" | "high";
    } | {
        readonly kind: "host";
        readonly enabledEndpointID:
            | "filterCutoffKeyTrackEnabled"
            | typeof VOICE_ENHANCER_KEY_TRACK_ENABLED_ENDPOINT_ID;
        readonly offsetEndpointID:
            | "filterCutoffKeyTrackOffsetSemitones"
            | typeof VOICE_ENHANCER_KEY_TRACK_OFFSET_ENDPOINT_ID;
    };
};

export type KeyTrackModulationTargetBasePresentation = {
    readonly entrySpec: ParameterEntrySpec;
    readonly amountSpec: ParameterEntrySpec;
    readonly railProjection: ModulationTargetRailProjection;
    readonly canonicalAmountBounds: { readonly min: number; readonly max: number };
};

const RAIL_EPSILON = 1e-9;

function buildRailProjection({ min, max, scale, application, valueKind }: {
    min: number;
    max: number;
    scale: "linear" | "log";
    application: "linear" | "octaves" | "semitones";
    valueKind?: RackParameterDescriptor["valueKind"];
}): ModulationTargetRailProjection {
    if (!(max > min) || (scale === "log" && !(min > 0))) {
        throw new Error(`Invalid rail projection domain [${min}, ${max}] (${scale}).`);
    }
    const normalizeValue = (value: number) => {
        const clamped = Math.min(max, Math.max(min, value));
        if (valueKind === "effect-output-trim-db") {
            return effectOutputTrimNormalizedValue(clamped);
        }
        return scale === "log"
            ? Math.log(clamped / min) / Math.log(max / min)
            : (clamped - min) / (max - min);
    };
    const denormalizeValue = (normalized: number) => {
        const clamped = Math.min(1, Math.max(0, normalized));
        if (valueKind === "effect-output-trim-db") {
            return effectOutputTrimValueFromNormalized(clamped);
        }
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
        const applyOffset = (offset: number) => valueKind === "effect-output-trim-db"
            ? effectOutputTrimEffectiveDb(baseValue, offset)
            : application === "octaves"
                ? baseValue * (2 ** offset)
                : application === "semitones"
                    ? baseValue * (2 ** (offset / 12))
                    : baseValue + offset;
        const rawLow = applyOffset(offsets[0]);
        const rawHigh = applyOffset(offsets[1]);
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

/** Present a tracked target as one continuous semitone-offset rail while
    retaining its deployed route amount storage unchanged. */
export function keyTrackModulationTargetBasePresentation(
    keyTrack: ModulationTargetKeyTrackBase,
): KeyTrackModulationTargetBasePresentation {
    const range = requireKeyTrackRange(keyTrack.definition.family);
    const normalizeValue = (value: number) => (
        (Math.min(range.knobMax, Math.max(range.knobMin, value)) - range.knobMin)
        / (range.knobMax - range.knobMin)
    );
    const denormalizeValue = (normalized: number) => (
        range.knobMin
        + (Math.min(1, Math.max(0, normalized)) * (range.knobMax - range.knobMin))
    );
    const projectBand: ModulationTargetRailProjection["projectBand"] = (
        baseNormalized,
        route,
    ) => {
        const clampedBase = Math.min(1, Math.max(0, baseNormalized));
        const baseOffset = denormalizeValue(clampedBase);
        const offsets = routeAmountOffsets(route).map((amount) => (
            keyTrackRouteAmountToSemitones(amount, keyTrack.storage)
        ));
        const rawLow = baseOffset + offsets[0];
        const rawHigh = baseOffset + offsets[1];
        return Object.freeze({
            baseNormalized: clampedBase,
            lowNormalized: normalizeValue(rawLow),
            highNormalized: normalizeValue(rawHigh),
            clippedLow: rawLow < range.knobMin - RAIL_EPSILON,
            clippedHigh: rawHigh > range.knobMax + RAIL_EPSILON,
            fullyClipped: Math.abs(route.amount) > RAIL_EPSILON
                && Math.abs(normalizeValue(rawHigh) - normalizeValue(rawLow)) <= RAIL_EPSILON,
        });
    };
    return {
        entrySpec: parameterEntrySpecForKeyTrackOffset(keyTrack.definition.family),
        amountSpec: parameterEntrySpecForKeyTrackModulationAmount(
            keyTrack.definition.family,
            keyTrack.storage,
        ),
        railProjection: { normalizeValue, denormalizeValue, projectBand },
        canonicalAmountBounds: {
            min: keyTrackRouteAmountFromSemitones(range.routeMin, keyTrack.storage),
            max: keyTrackRouteAmountFromSemitones(range.routeMax, keyTrack.storage),
        },
    };
}

const rackDescriptorsByEndpoint: ReadonlyMap<string, RackParameterDescriptor> = new Map(
    allRackParameterDescriptors().flatMap((descriptor: RackParameterDescriptor) => [
        [descriptor.endpointID, descriptor] as const,
        ...(
            descriptor.modulationIdentityEndpointID === undefined
                ? []
                : [[descriptor.modulationIdentityEndpointID, descriptor] as const]
        ),
    ]),
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
        if (parsedLane.deviceType === "frequencySplit") {
            const which: "low" | "high" = parsedLane.endpointID === "xoverLowHz" ? "low" : "high";
            const groupId = parsedLane.instanceId.replace(/^frequencySplit#/, "split#");
            const initialValue = which === "low"
                ? LANE_SPLIT_DEFAULT_XOVER_LOW_HZ
                : LANE_SPLIT_DEFAULT_XOVER_HIGH_HZ;
            const entrySpec = parameterEntrySpecForFrequency({
                minHz: LANE_SPLIT_XOVER_MIN_HZ,
                maxHz: LANE_SPLIT_XOVER_MAX_HZ,
                stepHz: 1,
                allowLogPercent: true,
            });
            const definition = getKeyTrackDefinition(
                which === "low" ? "lane.frequencySplitLowHz" : "lane.frequencySplitHighHz",
            );
            if (definition === null) {
                throw new Error(`Frequency Split ${which} crossover is missing its Key Track definition.`);
            }
            const laneSplitBinding = { groupId, which };
            return {
                endpointID: parsedLane.endpointID,
                laneSplitBinding,
                entrySpec,
                label: getModulationTargetDescriptor(laneMirrorRackKind(parsedLane)).label,
                initialValue,
                railProjection: buildRailProjection({
                    min: entrySpec.min,
                    max: entrySpec.max,
                    scale: "log",
                    application: "octaves",
                }),
                amountDragStyle: "amount-span",
                keyTrack: {
                    definition,
                    storage: "octaves",
                    binding: { kind: "lane-split", ...laneSplitBinding },
                },
            };
        }
        // T6: every instance has its own lane.v2 document slot, and the base
        // CONTRACT (endpoint, spec, labels) is the type's. Which slot a
        // binding edits comes from the deviceId its caller threads through
        // useLaneOrHostParameterBinding.
        const descriptor = rackDescriptorsByEndpoint.get(parsedLane.endpointID);
        if (descriptor === undefined) {
            throw new Error(`Rack modulation target "${targetKind}" has no rack descriptor.`);
        }
        const entrySpec = parameterEntrySpecForRackParameter(descriptor, descriptor.initial);
        const keyTrackDefinition = getKeyTrackDefinition(`lane.${descriptor.endpointID}`);
        return {
            endpointID: descriptor.endpointID,
            entrySpec,
            label: descriptor.label,
            initialValue: descriptor.initial,
            railProjection: buildRailProjection({
                min: entrySpec.min,
                max: entrySpec.max,
                scale: descriptor.scale,
                application: descriptor.modulationApplication ?? "linear",
                valueKind: descriptor.valueKind,
            }),
            amountDragStyle: descriptor.modulationDragStyle ?? "amount-span",
            keyTrack: keyTrackDefinition === null ? null : {
                definition: keyTrackDefinition,
                storage: descriptor.modulationApplication === "semitones" ? "semitones" : "octaves",
                binding: { kind: "lane", descriptor },
            },
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
            keyTrack: null,
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
            keyTrack: null,
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
            keyTrack: null,
        };
    }
    const voiceEnhancerDescriptor = Object.values(VOICE_ENHANCER_PARAMETER_DESCRIPTORS)
        .find((candidate) => candidate.endpointID === binding.endpointId);
    if (voiceEnhancerDescriptor !== undefined) {
        const entrySpec = voiceEnhancerDescriptor.unit === "Hz"
            ? parameterEntrySpecForFrequency({
                minHz: voiceEnhancerDescriptor.min,
                maxHz: voiceEnhancerDescriptor.max,
                stepHz: voiceEnhancerDescriptor.step,
                allowLogPercent: true,
            })
            : parameterEntrySpecForScalar({
                min: voiceEnhancerDescriptor.min,
                max: voiceEnhancerDescriptor.max,
                step: voiceEnhancerDescriptor.step,
                unit: voiceEnhancerDescriptor.unit,
                canonicalPerDisplayedUnit: voiceEnhancerDescriptor.unit === "%" ? 0.01 : 1,
                digits: voiceEnhancerDescriptor.unit === "Q" ? 2 : 3,
            });
        return {
            endpointID: voiceEnhancerDescriptor.endpointID,
            entrySpec,
            label: voiceEnhancerDescriptor.label,
            initialValue: voiceEnhancerDescriptor.initial,
            railProjection: buildRailProjection({
                min: voiceEnhancerDescriptor.min,
                max: voiceEnhancerDescriptor.max,
                scale: voiceEnhancerDescriptor.scale,
                application: voiceEnhancerDescriptor.modulationApplication,
            }),
            amountDragStyle: voiceEnhancerDescriptor.key === "q" ? "effective-value" : "amount-span",
            keyTrack: voiceEnhancerDescriptor.key === "frequency"
                ? (() => {
                    const definition = getKeyTrackDefinition(VOICE_ENHANCER_KEY_TRACK_CONTROL_ID);
                    if (definition === null) {
                        throw new Error("Voice Enhancer Frequency is missing its Key Track definition.");
                    }
                    return {
                        definition,
                        storage: "octaves" as const,
                        binding: {
                            kind: "host" as const,
                            enabledEndpointID: VOICE_ENHANCER_KEY_TRACK_ENABLED_ENDPOINT_ID,
                            offsetEndpointID: VOICE_ENHANCER_KEY_TRACK_OFFSET_ENDPOINT_ID,
                        },
                    };
                })()
                : null,
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
            keyTrack: targetKind === "filterCutoffOctaves"
                ? (() => {
                    const definition = getKeyTrackDefinition("voice.filterCutoff");
                    if (definition === null) {
                        throw new Error("Voice Filter Cutoff is missing its Key Track definition.");
                    }
                    return {
                        definition,
                        storage: "octaves" as const,
                        binding: {
                            kind: "host" as const,
                            enabledEndpointID: "filterCutoffKeyTrackEnabled" as const,
                            offsetEndpointID: "filterCutoffKeyTrackOffsetSemitones" as const,
                        },
                    };
                })()
                : null,
        };
    }
    return null;
}
