import type { ArticulationsState } from "../shared/articulation-image";
import {
    parseLaneModulationTargetKind,
} from "../shared/lane-modulation-targets";
import type { EffectModuleId } from "../shared/target-descriptor";
import {
    deserializeLaneStateV2,
    laneDefaultParamsForType,
    parseLaneInstanceId,
    serializeLaneStateV2,
    type LaneChainNodeV2,
    type LaneStateV2,
} from "../shared/lane-state-v2";
import {
    deserializeModulationState,
    serializeModulationState,
    type ModulationMsegSlot,
    type ModulationRoute,
    type ModulationState,
} from "../shared/modulation";
import {
    getModulationSourceIdentity,
    type ModulationSourceId,
    type OscillatorID,
} from "../shared/modulation-targets";
import {
    formatRackParameterValue,
    getRackEffectDescriptor,
    getRackParameterDescriptor,
} from "../shared/rack-parameter-descriptors";
import { getModulationTargetDisplayLabel } from "../shared/target-descriptor";
import type {
    EffectUsage,
    LaneParamDiff,
    OmittedReport,
    ParamDiff,
    PatchAnalysis,
    SourceUsage,
} from "./analyzer";
import type {
    DefaultsSnapshot,
    EndpointAnnotation,
    PatchDocument,
} from "./patch-io";

export type NavTarget =
    | { readonly tab: "mod"; readonly sourceId: ModulationSourceId }
    | { readonly tab: "voice"; readonly oscillatorId?: OscillatorID; readonly focus?: "filter" }
    | { readonly tab: "fx"; readonly deviceId: string };

export type SurfaceRef = string;
export type OpWeight = "normal" | "rapid";

export type UIOp =
    | { readonly kind: "installLaneBaseline"; readonly lane: LaneStateV2 }
    | { readonly kind: "installModulationBaseline"; readonly modulation: ModulationState }
    | { readonly kind: "navigate"; readonly to: NavTarget }
    | {
        readonly kind: "setParam";
        readonly endpointID: string;
        readonly from: number;
        readonly to: number;
        readonly surface: SurfaceRef;
        readonly weight: OpWeight;
    }
    | {
        readonly kind: "selectWavetable";
        readonly osc: OscillatorID;
        readonly tableIndex: number;
        readonly tableName: string;
    }
    | {
        readonly kind: "toggleEffect";
        readonly deviceId: string;
        readonly effectId: EffectModuleId;
        readonly enabled: true;
    }
    | {
        readonly kind: "setLaneParam";
        readonly deviceId: string;
        readonly endpointID: string;
        readonly from: number;
        readonly to: number;
        readonly surface: SurfaceRef;
        readonly weight: OpWeight;
    }
    | { readonly kind: "mapRoute"; readonly route: ModulationRoute; readonly surface: SurfaceRef }
    | {
        readonly kind: "configureMseg";
        readonly slot: 1 | 2 | 3;
        readonly state: ModulationMsegSlot;
        readonly rate: number;
        readonly morph: number;
    }
    | {
        readonly kind: "setEnvelope";
        readonly slot: 1 | 2 | 3;
        readonly name: string;
        readonly attack: number;
        readonly decay: number;
        readonly sustain: number;
        readonly release: number;
    }
    | {
        readonly kind: "setMacro";
        readonly slot: 1 | 2 | 3 | 4;
        readonly value: number;
        readonly name: string;
    };

export type SpeedrunSectionKind = "source" | "oscillator" | "filter" | "effect";

export type SpeedrunSection = {
    readonly id: string;
    readonly kind: SpeedrunSectionKind;
    readonly title: string;
    readonly ops: ReadonlyArray<UIOp>;
    readonly captions: ReadonlyArray<string>;
    readonly allCaptions: ReadonlyArray<string>;
    /** `null` means navigation/preparation, which begins at section lead-in. */
    readonly opCaptionLines: ReadonlyArray<number | null>;
};

export type SpeedrunRecipe = {
    readonly format: "cosimo.speedrunRecipe";
    readonly version: 1;
    readonly label: string;
    readonly contractHash: string;
    readonly prelude: ReadonlyArray<UIOp>;
    readonly sections: ReadonlyArray<SpeedrunSection>;
    readonly articulations: ArticulationsState;
    readonly omitted: OmittedReport;
};

export type WavetableCatalogEntry = {
    readonly name: string;
};

export type WavetableCatalog = {
    readonly tables: ReadonlyArray<WavetableCatalogEntry>;
};

const OSCILLATOR_ENDPOINT_ORDER = [
    "WavetableSelect",
    "WavetablePosition",
    "WarpMode",
    "WarpAmount",
    "UnisonDetune",
    "UnisonDetuneMode",
    "UnisonVoices",
    "VolumeDb",
    "Pan",
    "Octave",
    "Semitone",
    "FineCents",
    "UnisonBlend",
    "UnisonWidth",
    "UnisonStackMode",
    "UnisonPositionSpread",
    "UnisonWarpSpread",
    "Phase",
    "PhaseRandom",
    "Retrigger",
    "Solo",
    "Mute",
] as const;

const FILTER_ENDPOINT_ORDER = ["filterMode", "filterCutoff", "filterQ", "filterMix"] as const;

function cloneLane(lane: LaneStateV2): LaneStateV2 {
    return deserializeLaneStateV2(serializeLaneStateV2(lane));
}

function cloneModulation(modulation: ModulationState): ModulationState {
    return deserializeModulationState(serializeModulationState(modulation));
}

function cloneArticulations(articulations: ArticulationsState): ArticulationsState {
    return JSON.parse(JSON.stringify(articulations)) as ArticulationsState;
}

function replaceLanePlacements(
    nodes: ReadonlyArray<LaneChainNodeV2>,
    activeDeviceIds: ReadonlySet<string>,
): LaneChainNodeV2[] {
    return nodes.map((node) => {
        if (node.kind === "device") {
            return activeDeviceIds.has(node.deviceId) ? { ...node, enabled: false } : node;
        }
        return {
            ...node,
            branches: node.branches.map((branch) => branch.map((placement) => (
                activeDeviceIds.has(placement.deviceId) ? { ...placement, enabled: false } : placement
            ))),
        };
    });
}

function buildLaneBaseline(document: PatchDocument, analysis: PatchAnalysis): LaneStateV2 {
    const target = cloneLane(document.lane);
    const activeDeviceIds = new Set(analysis.effects.map((effect) => effect.deviceId));
    const demonstratedParams = new Map(analysis.effects.map((effect) => [
        effect.deviceId,
        new Set(effect.parameterDiffs.map((diff) => diff.endpointID)),
    ]));
    const devices = Object.fromEntries(Object.entries(target.devices).map(([deviceId, record]) => {
        if (!activeDeviceIds.has(deviceId)) return [deviceId, record];
        const parsed = parseLaneInstanceId(deviceId);
        if (parsed === null) throw new Error(`Invalid lane device identity ${deviceId}.`);
        const defaults = laneDefaultParamsForType(parsed.deviceType);
        const visible = demonstratedParams.get(deviceId) ?? new Set<string>();
        return [deviceId, {
            params: Object.fromEntries(Object.entries(record.params).map(([endpointID, value]) => [
                endpointID,
                visible.has(endpointID) ? defaults[endpointID] : value,
            ])),
        }];
    }));
    return {
        ...target,
        devices,
        chain: replaceLanePlacements(target.chain, activeDeviceIds),
    };
}

function buildModulationBaseline(
    document: PatchDocument,
    defaults: DefaultsSnapshot,
    analysis: PatchAnalysis,
): ModulationState {
    const baseline = cloneModulation(document.modulation);
    const configuredSources = analysis.sources.filter((source) => source.hasConfiguration);
    for (const source of configuredSources) {
        if (source.sourceKind === "mseg" && source.sourceSlot !== null) {
            baseline.msegSlots[source.sourceSlot - 1] = cloneModulation(defaults.modulation).msegSlots[source.sourceSlot - 1];
        } else if (source.sourceKind === "env" && source.sourceSlot !== null) {
            baseline.envelopeSlots[source.sourceSlot - 1] = {
                ...defaults.modulation.envelopeSlots[source.sourceSlot - 1],
            };
        } else if (source.sourceKind === "macro" && source.sourceSlot !== null) {
            baseline.macroNames[source.sourceSlot - 1] = defaults.modulation.macroNames[source.sourceSlot - 1];
        }
    }
    baseline.routes = baseline.routes.filter((route) => !analysis.demonstratedRouteIds.has(route.id));
    return baseline;
}

function sourceLabel(route: ModulationRoute): string {
    const identity = getModulationSourceIdentity(route.sourceKind, route.sourceSlot);
    return identity.id.replace("-", " ").toUpperCase();
}

function signedAmount(value: number): string {
    if (value === 0) return "0";
    const absolute = Math.abs(value);
    const digits = absolute >= 10 ? 1 : 2;
    return `${value > 0 ? "+" : ""}${value.toFixed(digits).replace(/\.0+$/, "")}`;
}

function formatEndpointValue(annotation: EndpointAnnotation, value: number): string {
    if (annotation.text && annotation.discrete) {
        const choices = annotation.text.split("|");
        return choices[Math.round(value)] ?? String(Math.round(value));
    }
    if (annotation.unit === "%") return `${Math.round(value * (annotation.max === 1 ? 100 : 1))}%`;
    if (annotation.unit === "Hz") return value >= 1_000 ? `${(value / 1_000).toFixed(2)}kHz` : `${Math.round(value)}Hz`;
    if (annotation.unit === "s") return value < 1 ? `${Math.round(value * 1_000)}ms` : `${value.toFixed(2)}s`;
    if (annotation.unit === "dB") return `${value.toFixed(1)}dB`;
    if (annotation.unit === "cents") return `${Math.round(value)}ct`;
    if (annotation.discrete) return String(Math.round(value));
    return String(Number(value.toFixed(3)));
}

function captionForOp(op: UIOp, defaults: DefaultsSnapshot): string | null {
    switch (op.kind) {
        case "installLaneBaseline":
        case "installModulationBaseline":
        case "navigate":
            return null;
        case "setParam": {
            const annotation = defaults.annotations[op.endpointID];
            return annotation
                ? `${annotation.name} ${formatEndpointValue(annotation, op.to)}`
                : `${op.endpointID} ${op.to}`;
        }
        case "selectWavetable": return `Wavetable “${op.tableName}”`;
        case "toggleEffect": return "On";
        case "setLaneParam": {
            const parsed = parseLaneModulationTargetKind(`lane.${op.deviceId}.${op.endpointID}`);
            if (parsed === null) return `${op.endpointID} ${op.to}`;
            const parameter = getRackParameterDescriptor(op.endpointID);
            return parameter
                ? `${parameter.label} ${formatRackParameterValue(parameter, op.to)}`
                : `${op.endpointID} ${op.to}`;
        }
        case "mapRoute": return `${sourceLabel(op.route)} → ${getModulationTargetDisplayLabel(op.route.targetKind)} ${signedAmount(op.route.amount)}`;
        case "configureMseg": return `MSEG ${op.slot} shape and playback`;
        case "setEnvelope": return `ENV ${op.slot} ${op.name}`;
        case "setMacro": return `MACRO ${op.slot} ${op.name} ${Number(op.value.toFixed(2))}`;
    }
}

function finalizeSection(
    section: Omit<SpeedrunSection, "captions" | "allCaptions" | "opCaptionLines">,
    defaults: DefaultsSnapshot,
): SpeedrunSection {
    let captionIndex = 0;
    const allCaptions: string[] = [];
    const opCaptionLines = section.ops.map((op) => {
        const caption = captionForOp(op, defaults);
        if (caption === null) return null;
        const line = captionIndex;
        captionIndex += 1;
        allCaptions.push(caption);
        return line;
    });
    const captions = allCaptions.length <= 8
        ? allCaptions
        : [...allCaptions.slice(0, 7), `…+${allCaptions.length - 7} more`];
    const weightedOps = section.ops.map((op, index): UIOp => {
        const line = opCaptionLines[index];
        if (line === null || line < 7) return op;
        if (op.kind === "setParam" || op.kind === "setLaneParam") return { ...op, weight: "rapid" };
        return op;
    });
    return {
        ...section,
        ops: weightedOps,
        captions,
        allCaptions,
        opCaptionLines: opCaptionLines.map((line) => line === null ? null : Math.min(line, 7)),
    };
}

function setParamOp(diff: ParamDiff, surface: string): UIOp {
    return {
        kind: "setParam",
        endpointID: diff.endpointID,
        from: diff.from,
        to: diff.to,
        surface,
        weight: "normal",
    };
}

function routeSurface(route: ModulationRoute): SurfaceRef {
    const oscillator = /^osc([ABC])\.(.+)$/.exec(route.targetKind);
    if (oscillator !== null) return `mobile-voice-cell-${oscillator[1]}-${oscillator[2]}`;
    if (["filterCutoffOctaves", "filterQ", "filterMix"].includes(route.targetKind)) {
        return "filter-graph-drop-surface";
    }
    const lane = parseLaneModulationTargetKind(route.targetKind);
    return lane
        ? `rack-parameter-surface-${lane.instanceId}-${lane.endpointID}`
        : `modulation-target-surface-${route.targetKind}`;
}

function mapRouteOp(route: ModulationRoute): UIOp {
    return { kind: "mapRoute", route: { ...route }, surface: routeSurface(route) };
}

function compileSourceSection(
    source: SourceUsage,
    document: PatchDocument,
    defaults: DefaultsSnapshot,
): SpeedrunSection {
    const slot = source.sourceSlot;
    if (slot === null) throw new Error(`${source.id} has no configurable slot.`);
    const ops: UIOp[] = [{ kind: "navigate", to: { tab: "mod", sourceId: source.id } }];
    if (source.sourceKind === "mseg") {
        ops.push({
            kind: "configureMseg",
            slot: slot as 1 | 2 | 3,
            state: cloneModulation(document.modulation).msegSlots[slot - 1],
            rate: document.parameters[`mseg${slot}Rate`],
            morph: document.parameters[`mseg${slot}Morph`],
        });
    } else if (source.sourceKind === "env") {
        ops.push({
            kind: "setEnvelope",
            slot: slot as 1 | 2 | 3,
            name: document.modulation.envelopeSlots[slot - 1].name,
            attack: document.parameters[`env${slot}Attack`],
            decay: document.parameters[`env${slot}Decay`],
            sustain: document.parameters[`env${slot}Sustain`],
            release: document.parameters[`env${slot}Release`],
        });
    } else if (source.sourceKind === "macro") {
        ops.push({
            kind: "setMacro",
            slot: slot as 1 | 2 | 3 | 4,
            value: document.parameters[`macro${slot}`],
            name: document.modulation.macroNames[slot - 1],
        });
    }
    return finalizeSection({
        id: `source-${source.id}`,
        kind: "source",
        title: source.id.replace("-", " ").toUpperCase(),
        ops,
    }, defaults);
}

function endpointOrder(endpointID: string, oscillatorID: OscillatorID): number {
    const suffix = endpointID.slice(`osc${oscillatorID}`.length);
    const index = OSCILLATOR_ENDPOINT_ORDER.indexOf(suffix as typeof OSCILLATOR_ENDPOINT_ORDER[number]);
    return index === -1 ? OSCILLATOR_ENDPOINT_ORDER.length : index;
}

function routeOrder(route: ModulationRoute): number {
    const target = route.targetKind.split(".").at(-1) ?? route.targetKind;
    const aliases: Record<string, string> = {
        wavetablePosition: "WavetablePosition",
        warpAmount: "WarpAmount",
        unisonDetune: "UnisonDetune",
        ampGainDb: "VolumeDb",
        pan: "Pan",
        pitchSemitones: "Semitone",
        unisonBlend: "UnisonBlend",
        unisonWidth: "UnisonWidth",
        unisonWavetablePositionSpread: "UnisonPositionSpread",
        unisonWarpSpread: "UnisonWarpSpread",
    };
    const suffix = aliases[target] ?? target;
    const index = OSCILLATOR_ENDPOINT_ORDER.indexOf(suffix as typeof OSCILLATOR_ENDPOINT_ORDER[number]);
    return index === -1 ? OSCILLATOR_ENDPOINT_ORDER.length : index;
}

function compileOscillatorSection(
    oscillator: PatchAnalysis["oscillators"][number],
    first: boolean,
    analysis: PatchAnalysis,
    document: PatchDocument,
    defaults: DefaultsSnapshot,
    catalog: WavetableCatalog,
): SpeedrunSection {
    const prefix = `osc${oscillator.id}`;
    const ops: UIOp[] = [{ kind: "navigate", to: { tab: "voice", oscillatorId: oscillator.id } }];
    if (first) {
        ops.push(...analysis.voiceSetup.map((diff) => setParamOp(diff, `voice-setup-${diff.endpointID}`)));
    }
    for (const diff of [...oscillator.parameterDiffs].sort((left, right) => (
        endpointOrder(left.endpointID, oscillator.id) - endpointOrder(right.endpointID, oscillator.id)
    ))) {
        if (diff.endpointID === `${prefix}WavetableSelect`) {
            const tableIndex = Math.round(diff.to);
            ops.push({
                kind: "selectWavetable",
                osc: oscillator.id,
                tableIndex,
                tableName: catalog.tables[tableIndex]?.name ?? `Table ${tableIndex}`,
            });
        } else {
            ops.push(setParamOp(diff, `mobile-voice-cell-${oscillator.id}-${diff.endpointID.slice(prefix.length)}`));
        }
    }
    ops.push(...[...oscillator.routes].sort((left, right) => routeOrder(left) - routeOrder(right)).map(mapRouteOp));
    if (first) ops.push(...analysis.voiceSetupRoutes.map(mapRouteOp));
    return finalizeSection({
        id: `oscillator-${oscillator.id}`,
        kind: "oscillator",
        title: `OSC ${oscillator.id}`,
        ops,
    }, defaults);
}

function compileFilterSection(
    analysis: NonNullable<PatchAnalysis["voiceFilter"]>,
    defaults: DefaultsSnapshot,
): SpeedrunSection {
    const diffs = [...analysis.parameterDiffs].sort((left, right) => (
        FILTER_ENDPOINT_ORDER.indexOf(left.endpointID as typeof FILTER_ENDPOINT_ORDER[number])
        - FILTER_ENDPOINT_ORDER.indexOf(right.endpointID as typeof FILTER_ENDPOINT_ORDER[number])
    ));
    return finalizeSection({
        id: "voice-filter",
        kind: "filter",
        title: "FILTER",
        ops: [
            { kind: "navigate", to: { tab: "voice", focus: "filter" } },
            ...diffs.map((diff) => setParamOp(diff, `voice-filter-${diff.endpointID}`)),
            ...analysis.routes.map(mapRouteOp),
        ],
    }, defaults);
}

function laneParamOp(diff: LaneParamDiff): UIOp {
    return {
        kind: "setLaneParam",
        deviceId: diff.deviceId,
        endpointID: diff.endpointID,
        from: diff.from,
        to: diff.to,
        surface: `rack-parameter-surface-${diff.deviceId}-${diff.endpointID}`,
        weight: "normal",
    };
}

function compileEffectSection(effect: EffectUsage, defaults: DefaultsSnapshot): SpeedrunSection {
    const descriptor = getRackEffectDescriptor(effect.effectId);
    const parameterOrder = new Map(descriptor.parameters.map((parameter, index) => [
        parameter.endpointID,
        (parameter.quick ? 0 : descriptor.parameters.length) + index,
    ]));
    const diffs = [...effect.parameterDiffs].sort((left, right) => (
        (parameterOrder.get(left.endpointID) ?? 1_000) - (parameterOrder.get(right.endpointID) ?? 1_000)
    ));
    return finalizeSection({
        id: `effect-${effect.deviceId}`,
        kind: "effect",
        title: effect.deviceId.endsWith("#1") ? effect.label.toUpperCase() : `${effect.label.toUpperCase()} ${effect.deviceId.split("#")[1]}`,
        ops: [
            { kind: "navigate", to: { tab: "fx", deviceId: effect.deviceId } },
            { kind: "toggleEffect", deviceId: effect.deviceId, effectId: effect.effectId, enabled: true },
            ...diffs.map(laneParamOp),
            ...effect.routes.map(mapRouteOp),
        ],
    }, defaults);
}

function visibleParameterIDs(sections: ReadonlyArray<SpeedrunSection>): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const op of sections.flatMap((section) => section.ops)) {
        if (op.kind === "setParam") ids.add(op.endpointID);
        else if (op.kind === "selectWavetable") ids.add(`osc${op.osc}WavetableSelect`);
        else if (op.kind === "configureMseg") {
            ids.add(`mseg${op.slot}Rate`);
            ids.add(`mseg${op.slot}Morph`);
        } else if (op.kind === "setEnvelope") {
            for (const suffix of ["Attack", "Decay", "Sustain", "Release"]) ids.add(`env${op.slot}${suffix}`);
        } else if (op.kind === "setMacro") ids.add(`macro${op.slot}`);
    }
    return ids;
}

export function compileRecipe(
    analysis: PatchAnalysis,
    document: PatchDocument,
    defaults: DefaultsSnapshot,
    catalog: WavetableCatalog,
): SpeedrunRecipe {
    const sourceSections = analysis.sources
        .filter((source) => source.hasConfiguration)
        .map((source) => compileSourceSection(source, document, defaults));
    const oscillatorSections = analysis.oscillators.map((oscillator, index) => (
        compileOscillatorSection(oscillator, index === 0, analysis, document, defaults, catalog)
    ));
    const filterSections = analysis.voiceFilter ? [compileFilterSection(analysis.voiceFilter, defaults)] : [];
    const effectSections = analysis.effects.map((effect) => compileEffectSection(effect, defaults));
    const sections = [...sourceSections, ...oscillatorSections, ...filterSections, ...effectSections];
    const visibleIDs = visibleParameterIDs(sections);
    const hiddenParameterOps = analysis.allParameterDiffs
        .filter((diff) => !visibleIDs.has(diff.endpointID))
        .map((diff) => setParamOp(diff, `speedrun-prelude-${diff.endpointID}`));

    return {
        format: "cosimo.speedrunRecipe",
        version: 1,
        label: document.label,
        contractHash: document.contractHash,
        prelude: [
            { kind: "installLaneBaseline", lane: buildLaneBaseline(document, analysis) },
            { kind: "installModulationBaseline", modulation: buildModulationBaseline(document, defaults, analysis) },
            ...hiddenParameterOps,
        ],
        sections,
        articulations: cloneArticulations(document.articulations),
        omitted: analysis.omitted,
    };
}

export function targetParameterIDsForOp(op: UIOp): ReadonlyArray<string> {
    switch (op.kind) {
        case "setParam": return [op.endpointID];
        case "selectWavetable": return [`osc${op.osc}WavetableSelect`];
        case "configureMseg": return [`mseg${op.slot}Rate`, `mseg${op.slot}Morph`];
        case "setEnvelope": return ["Attack", "Decay", "Sustain", "Release"].map((suffix) => `env${op.slot}${suffix}`);
        case "setMacro": return [`macro${op.slot}`];
        default: return [];
    }
}
