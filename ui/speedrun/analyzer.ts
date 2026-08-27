import type { ArticulationsState } from "../shared/articulation-image";
import {
    parseLaneModulationTargetKind,
    type LaneDeviceType,
} from "../shared/lane-modulation-targets";
import { LANE_TYPE_TO_EFFECT_ID } from "../shared/lane-state";
import type {
    LaneChainNodeV2,
    LaneDevicePlacementV2,
    LaneStateV2,
} from "../shared/lane-state-v2";
import { parseLaneInstanceId } from "../shared/lane-state-v2";
import {
    type ModulationRoute,
    type ModulationSourceKind,
} from "../shared/modulation";
import {
    getModulationSourceIdentity,
    MODULATION_SOURCE_IDENTITIES,
    OSCILLATOR_IDS,
    parseModulationSourceIdentity,
    type ModulationSourceId,
    type OscillatorID,
} from "../shared/modulation-targets";
import { OSCILLATOR_VOLUME_MIN_DB } from "../shared/oscillator-defaults";
import {
    getRackEffectDescriptor,
    type RackParameterDescriptor,
} from "../shared/rack-parameter-descriptors";
import type { EffectModuleId } from "../shared/target-descriptor";
import type {
    DefaultsSnapshot,
    EndpointAnnotation,
    PatchDocument,
} from "./patch-io";

export type ParamDiff = {
    readonly endpointID: string;
    readonly from: number;
    readonly to: number;
};

export type LaneParamDiff = ParamDiff & {
    readonly deviceId: string;
};

export type SourceUsage = {
    readonly id: ModulationSourceId;
    readonly sourceKind: ModulationSourceKind;
    readonly sourceSlot: number | null;
    readonly parameterDiffs: ReadonlyArray<ParamDiff>;
    readonly metadataChanged: boolean;
    readonly routes: ReadonlyArray<ModulationRoute>;
    readonly hasConfiguration: boolean;
};

export type OscillatorUsage = {
    readonly id: OscillatorID;
    readonly parameterDiffs: ReadonlyArray<ParamDiff>;
    readonly routes: ReadonlyArray<ModulationRoute>;
    readonly touched: boolean;
};

export type FilterUsage = {
    readonly parameterDiffs: ReadonlyArray<ParamDiff>;
    readonly routes: ReadonlyArray<ModulationRoute>;
};

export type EffectUsage = {
    readonly deviceId: string;
    readonly deviceType: LaneDeviceType;
    readonly effectId: EffectModuleId;
    readonly label: string;
    readonly parameterDiffs: ReadonlyArray<LaneParamDiff>;
    readonly routes: ReadonlyArray<ModulationRoute>;
};

export type OmittedReport = {
    readonly inaudibleOscillators: ReadonlyArray<OscillatorID>;
    readonly disabledDeviceIds: ReadonlyArray<string>;
    readonly inertRouteIds: ReadonlyArray<string>;
    readonly articulationOnlyRouteIds: ReadonlyArray<string>;
    readonly routesOnOmittedTargets: ReadonlyArray<string>;
    readonly defaultParameterIDs: ReadonlyArray<string>;
};

export type PatchAnalysis = {
    readonly allParameterDiffs: ReadonlyArray<ParamDiff>;
    readonly sources: ReadonlyArray<SourceUsage>;
    readonly oscillators: ReadonlyArray<OscillatorUsage>;
    readonly voiceFilter: FilterUsage | null;
    readonly effects: ReadonlyArray<EffectUsage>;
    readonly voiceSetup: ReadonlyArray<ParamDiff>;
    readonly voiceSetupRoutes: ReadonlyArray<ModulationRoute>;
    readonly demonstratedRouteIds: ReadonlySet<string>;
    readonly omitted: OmittedReport;
};

type ActiveLaneDevice = {
    readonly deviceId: string;
    readonly active: boolean;
};

const VOICE_FILTER_ENDPOINTS = ["filterMode", "filterCutoff", "filterQ", "filterMix"] as const;
const VOICE_FILTER_TARGETS = new Set(["filterCutoffOctaves", "filterQ", "filterMix"]);

function parameterEpsilon(annotation: EndpointAnnotation): number {
    if (annotation.discrete) return 0;
    const span = annotation.min !== null && annotation.max !== null
        ? Math.abs(annotation.max - annotation.min)
        : 0;
    return Math.max((annotation.step ?? 0) / 2, span * 1e-4);
}

export function parameterValuesDiffer(
    from: number,
    to: number,
    annotation: EndpointAnnotation,
): boolean {
    return annotation.discrete
        ? !Object.is(from, to)
        : Math.abs(to - from) > parameterEpsilon(annotation);
}

function diffParameters(
    document: PatchDocument,
    defaults: DefaultsSnapshot,
): ParamDiff[] {
    return Object.values(defaults.annotations).flatMap((annotation) => {
        const from = defaults.parameters[annotation.endpointID];
        const to = document.parameters[annotation.endpointID];
        return parameterValuesDiffer(from, to, annotation)
            ? [{ endpointID: annotation.endpointID, from, to }]
            : [];
    });
}

function descriptorValuesDiffer(
    from: number,
    to: number,
    descriptor: RackParameterDescriptor,
): boolean {
    if (descriptor.choices !== undefined || Number.isInteger(descriptor.step)) {
        return !Object.is(from, to);
    }
    return Math.abs(to - from) > Math.max(descriptor.step / 2, (descriptor.max - descriptor.min) * 1e-4);
}

function articulationRouteIds(articulations: ArticulationsState): ReadonlySet<string> {
    return new Set(articulations.slots.flatMap((slot) => Object.keys(slot.routeAmounts)));
}

function routeIsOperative(route: ModulationRoute, articulationIds: ReadonlySet<string>): boolean {
    return route.enabled && (route.amount !== 0 || articulationIds.has(route.id));
}

function flattenLaneNodes(
    nodes: ReadonlyArray<LaneChainNodeV2>,
    parentEnabled = true,
): ActiveLaneDevice[] {
    return nodes.flatMap((node): ActiveLaneDevice[] => {
        if (node.kind === "device") {
            return [{ deviceId: node.deviceId, active: parentEnabled && node.enabled }];
        }
        const groupEnabled = parentEnabled && node.enabled;
        return node.branches.flatMap((branch) => branch.map((placement) => ({
            deviceId: placement.deviceId,
            active: groupEnabled && placement.enabled,
        })));
    });
}

function laneDeviceType(state: LaneStateV2, deviceId: string): LaneDeviceType {
    const parsed = parseLaneInstanceId(deviceId);
    if (parsed === null || state.devices[deviceId] === undefined) {
        throw new Error(`Unknown lane device instance ${deviceId}.`);
    }
    return parsed.deviceType;
}

function oscillatorPrefix(oscillatorID: OscillatorID): string {
    return `osc${oscillatorID}`;
}

function oscillatorIsAudible(
    oscillatorID: OscillatorID,
    document: PatchDocument,
    defaults: DefaultsSnapshot,
    anySolo: boolean,
): boolean {
    const prefix = oscillatorPrefix(oscillatorID);
    const mute = document.parameters[`${prefix}Mute`] ?? 1;
    const solo = document.parameters[`${prefix}Solo`] ?? 0;
    const volume = document.parameters[`${prefix}VolumeDb`] ?? -60;
    const volumeAnnotation = defaults.annotations[`${prefix}VolumeDb`];
    const epsilon = volumeAnnotation ? parameterEpsilon(volumeAnnotation) : 0;
    return mute === 0
        && volume > OSCILLATOR_VOLUME_MIN_DB + epsilon
        && (!anySolo || solo === 1);
}

function sourceIdForRoute(route: ModulationRoute): ModulationSourceId {
    return getModulationSourceIdentity(route.sourceKind, route.sourceSlot).id;
}

function sourceParameterIDs(id: ModulationSourceId): ReadonlyArray<string> {
    const match = /^(mseg|env|macro)-(\d)$/.exec(id);
    if (match === null) return [];
    const slot = match[2];
    if (match[1] === "mseg") return [`mseg${slot}Morph`, `mseg${slot}Rate`];
    if (match[1] === "env") {
        return ["Attack", "Decay", "Sustain", "Release"].map((suffix) => `env${slot}${suffix}`);
    }
    return [`macro${slot}`];
}

function sourceMetadataChanged(
    id: ModulationSourceId,
    document: PatchDocument,
    defaults: DefaultsSnapshot,
): boolean {
    const match = /^(mseg|env|macro)-(\d)$/.exec(id);
    if (match === null) return false;
    const index = Number(match[2]) - 1;
    if (match[1] === "mseg") {
        return JSON.stringify(document.modulation.msegSlots[index])
            !== JSON.stringify(defaults.modulation.msegSlots[index]);
    }
    if (match[1] === "env") {
        return document.modulation.envelopeSlots[index]?.name
            !== defaults.modulation.envelopeSlots[index]?.name;
    }
    return document.modulation.macroNames[index] !== defaults.modulation.macroNames[index];
}

function routeTargetOscillator(route: ModulationRoute): OscillatorID | null {
    const match = /^osc([ABC])\./.exec(route.targetKind);
    return match === null ? null : match[1] as OscillatorID;
}

function routeTargetIsVoiceSetup(route: ModulationRoute): boolean {
    return /^(mseg[123](Morph|Rate)|env[123](Attack|Decay|Sustain|Release)|amp(Attack|Decay|Sustain|Release)|globalTuneSemitones)$/.test(route.targetKind);
}

function laneParameterDiffs(
    lane: LaneStateV2,
    deviceId: string,
    effectId: EffectModuleId,
): LaneParamDiff[] {
    const params = lane.devices[deviceId]?.params ?? {};
    return getRackEffectDescriptor(effectId).parameters.flatMap((descriptor) => {
        const to = params[descriptor.endpointID];
        if (typeof to !== "number" || !descriptorValuesDiffer(descriptor.initial, to, descriptor)) return [];
        return [{
            deviceId,
            endpointID: descriptor.endpointID,
            from: descriptor.initial,
            to,
        }];
    });
}

export function analyzePatch(document: PatchDocument, defaults: DefaultsSnapshot): PatchAnalysis {
    const allParameterDiffs = diffParameters(document, defaults);
    const diffsByEndpoint = new Map(allParameterDiffs.map((diff) => [diff.endpointID, diff]));
    const articulationIds = articulationRouteIds(document.articulations);
    const operativeRoutes = document.modulation.routes.filter((route) => routeIsOperative(route, articulationIds));
    const anySolo = OSCILLATOR_IDS.some((oscillatorID) => (
        document.parameters[`${oscillatorPrefix(oscillatorID)}Solo`] === 1
    ));
    const audibleOscillatorIDs = new Set(OSCILLATOR_IDS.filter((oscillatorID) => (
        oscillatorIsAudible(oscillatorID, document, defaults, anySolo)
    )));
    const laneDevices = flattenLaneNodes(document.lane.chain);
    const activeDeviceIDs = new Set(laneDevices.filter((device) => device.active).map((device) => device.deviceId));

    const demonstratedRoutes = operativeRoutes.filter((route) => {
        if (route.amount === 0) return false;
        const oscillatorID = routeTargetOscillator(route);
        if (oscillatorID !== null) return audibleOscillatorIDs.has(oscillatorID);
        if (VOICE_FILTER_TARGETS.has(route.targetKind)) return true;
        if (routeTargetIsVoiceSetup(route)) return audibleOscillatorIDs.size > 0;
        const laneTarget = parseLaneModulationTargetKind(route.targetKind);
        return laneTarget !== null && activeDeviceIDs.has(laneTarget.instanceId);
    });
    const demonstratedRouteIds = new Set(demonstratedRoutes.map((route) => route.id));

    const sources = [...new Set(operativeRoutes.map(sourceIdForRoute))].map((id): SourceUsage => {
        const identity = parseModulationSourceIdentity(id);
        if (identity === null) {
            throw new Error(`Route resolved a non-canonical modulation source: ${id}`);
        }
        const parameterDiffs = sourceParameterIDs(id).flatMap((endpointID) => {
            const diff = diffsByEndpoint.get(endpointID);
            return diff ? [diff] : [];
        });
        const metadataChanged = sourceMetadataChanged(id, document, defaults);
        return {
            id,
            sourceKind: identity.sourceKind,
            sourceSlot: identity.sourceSlot,
            parameterDiffs,
            metadataChanged,
            routes: operativeRoutes.filter((route) => sourceIdForRoute(route) === id),
            hasConfiguration: parameterDiffs.length > 0 || metadataChanged,
        };
    }).sort((left, right) => {
        const sourceOrder = MODULATION_SOURCE_IDENTITIES.map((identity) => identity.id);
        return sourceOrder.indexOf(left.id) - sourceOrder.indexOf(right.id);
    });

    const oscillators = OSCILLATOR_IDS.flatMap((id): OscillatorUsage[] => {
        if (!audibleOscillatorIDs.has(id)) return [];
        const prefix = oscillatorPrefix(id);
        const parameterDiffs = allParameterDiffs.filter((diff) => diff.endpointID.startsWith(prefix));
        const routes = demonstratedRoutes.filter((route) => routeTargetOscillator(route) === id);
        return [{ id, parameterDiffs, routes, touched: parameterDiffs.length > 0 || routes.length > 0 }];
    });

    const filterParameterDiffs = VOICE_FILTER_ENDPOINTS.flatMap((endpointID) => {
        const diff = diffsByEndpoint.get(endpointID);
        return diff ? [diff] : [];
    });
    const filterRoutes = demonstratedRoutes.filter((route) => VOICE_FILTER_TARGETS.has(route.targetKind));
    const voiceFilter = filterParameterDiffs.length > 0 || filterRoutes.length > 0
        ? { parameterDiffs: filterParameterDiffs, routes: filterRoutes }
        : null;

    const effects = laneDevices.flatMap((device): EffectUsage[] => {
        if (!device.active) return [];
        const deviceType = laneDeviceType(document.lane, device.deviceId);
        const effectId = LANE_TYPE_TO_EFFECT_ID.get(deviceType);
        if (effectId === undefined) return [];
        const descriptor = getRackEffectDescriptor(effectId);
        return [{
            deviceId: device.deviceId,
            deviceType,
            effectId,
            label: descriptor.label,
            parameterDiffs: laneParameterDiffs(document.lane, device.deviceId, effectId),
            routes: demonstratedRoutes.filter((route) => (
                parseLaneModulationTargetKind(route.targetKind)?.instanceId === device.deviceId
            )),
        }];
    });

    const claimedParameterIDs = new Set<string>([
        ...OSCILLATOR_IDS.flatMap((id) => allParameterDiffs
            .filter((diff) => diff.endpointID.startsWith(oscillatorPrefix(id)))
            .map((diff) => diff.endpointID)),
        ...VOICE_FILTER_ENDPOINTS,
        ...sources.flatMap((source) => sourceParameterIDs(source.id)),
        ...allParameterDiffs.filter((diff) => /^(mseg[123](Morph|Rate)|env[123](Attack|Decay|Sustain|Release))$/.test(diff.endpointID))
            .map((diff) => diff.endpointID),
    ]);
    const voiceSetup = allParameterDiffs.filter((diff) => !claimedParameterIDs.has(diff.endpointID));
    const voiceSetupRoutes = demonstratedRoutes.filter(routeTargetIsVoiceSetup);
    const routesOnOmittedTargets = operativeRoutes.filter((route) => (
        route.amount !== 0 && !demonstratedRouteIds.has(route.id)
    )).map((route) => route.id);
    const inertRouteIds = document.modulation.routes.filter((route) => (
        !routeIsOperative(route, articulationIds)
    )).map((route) => route.id);

    return {
        allParameterDiffs,
        sources,
        oscillators,
        voiceFilter,
        effects,
        voiceSetup,
        voiceSetupRoutes,
        demonstratedRouteIds,
        omitted: {
            inaudibleOscillators: OSCILLATOR_IDS.filter((id) => !audibleOscillatorIDs.has(id)),
            disabledDeviceIds: laneDevices.filter((device) => !device.active).map((device) => device.deviceId),
            inertRouteIds,
            articulationOnlyRouteIds: operativeRoutes.filter((route) => (
                route.amount === 0 && articulationIds.has(route.id)
            )).map((route) => route.id),
            routesOnOmittedTargets,
            defaultParameterIDs: Object.keys(defaults.parameters).filter((endpointID) => (
                !diffsByEndpoint.has(endpointID)
            )),
        },
    };
}
