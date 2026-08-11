/**
 * Compiles declarative modulation mappings into the fixed, sparse program consumed
 * by the audio engine. Mapping capacity belongs to the closed source/target domain;
 * per-sample work belongs only to enabled mappings.
 */

import type { ModulationRoute, ModulationTargetKind } from "./modulation";
import {
    allRackParameterDescriptors,
    type RackParameterDescriptor,
} from "./rack-parameter-descriptors";

/** Runtime endpoint for atomically replacing the active modulation program. */
export const MODULATION_PROGRAM_ENDPOINT_ID = "modulationProgram";

/** Runtime endpoint for changing one deterministic cell's base amount. */
export const MODULATION_AMOUNT_ENDPOINT_ID = "modulationAmount";

/** Number of per-voice sources: three MSEGs, three envelopes, velocity, pressure, and slide. */
export const MODULATION_VOICE_SOURCE_COUNT = 9;

/** Number of global Macro sources. */
export const MODULATION_MACRO_SOURCE_COUNT = 4;

/** Number of voice-local destinations. */
export const MODULATION_VOICE_TARGET_COUNT = 12;

/** Number of global rack destinations. */
export const MODULATION_RACK_TARGET_COUNT = 36;

/** Complete voice-source to voice-target mapping domain. */
export const MODULATION_VOICE_ROUTE_CELL_COUNT = MODULATION_VOICE_SOURCE_COUNT * MODULATION_VOICE_TARGET_COUNT;

/** Complete Macro to voice-target mapping domain. */
export const MODULATION_MACRO_VOICE_ROUTE_CELL_COUNT = MODULATION_MACRO_SOURCE_COUNT * MODULATION_VOICE_TARGET_COUNT;

/** Complete voice-source to rack-target mapping domain. */
export const MODULATION_VOICE_RACK_ROUTE_CELL_COUNT = MODULATION_VOICE_SOURCE_COUNT * MODULATION_RACK_TARGET_COUNT;

/** Complete Macro to rack-target mapping domain. */
export const MODULATION_MACRO_RACK_ROUTE_CELL_COUNT = MODULATION_MACRO_SOURCE_COUNT * MODULATION_RACK_TARGET_COUNT;

/** Number of voice-destination cells that can carry per-note articulation amounts. */
export const MODULATION_ARTICULATION_ROUTE_CELL_COUNT = MODULATION_VOICE_ROUTE_CELL_COUNT
    + MODULATION_MACRO_VOICE_ROUTE_CELL_COUNT;

/** Number of legal source/target pairs in Cosimo's closed modulation domain. */
export const MODULATION_MAPPING_CELL_COUNT = MODULATION_VOICE_ROUTE_CELL_COUNT
    + MODULATION_MACRO_VOICE_ROUTE_CELL_COUNT
    + MODULATION_VOICE_RACK_ROUTE_CELL_COUNT
    + MODULATION_MACRO_RACK_ROUTE_CELL_COUNT;

/** The four execution paths have different source lifetime and reduction rules. */
export type ModulationRuntimePath = "voice" | "macroVoice" | "voiceRack" | "macroRack";

/** Deterministic runtime address for one source/target pair. */
export type ModulationRuntimeCell = {
    readonly path: ModulationRuntimePath;
    readonly cellIndex: number;
    readonly sourceIndex: number;
    readonly targetIndex: number;
    readonly articulationCellIndex: number | null;
};

/** Fixed aggregate payload installed atomically by the audio engine. */
export type ModulationRuntimeProgramUpload = {
    readonly voiceRouteCount: number;
    readonly voiceRouteCells: number[];
    readonly voiceRouteSources: number[];
    readonly voiceRouteTargets: number[];
    readonly voiceRoutePolarities: number[];
    readonly voiceRouteAmounts: number[];
    readonly macroVoiceRouteCount: number;
    readonly macroVoiceRouteCells: number[];
    readonly macroVoiceRouteSources: number[];
    readonly macroVoiceRouteTargets: number[];
    readonly macroVoiceRoutePolarities: number[];
    readonly macroVoiceRouteAmounts: number[];
    readonly voiceRackRouteCount: number;
    readonly voiceRackRouteCells: number[];
    readonly voiceRackRouteSources: number[];
    readonly voiceRackRouteTargets: number[];
    readonly voiceRackRoutePolarities: number[];
    readonly voiceRackRouteReducers: number[];
    readonly voiceRackRouteAmounts: number[];
    readonly macroRackRouteCount: number;
    readonly macroRackRouteCells: number[];
    readonly macroRackRouteSources: number[];
    readonly macroRackRouteTargets: number[];
    readonly macroRackRoutePolarities: number[];
    readonly macroRackRouteAmounts: number[];
};

/** Small live edit for one deterministic mapping cell. */
export type ModulationRuntimeAmountUpload = {
    readonly pathKind: number;
    readonly cellIndex: number;
    readonly amount: number;
};

/** One modulation-program event sent across the engine runtime seam. */
export type ModulationRuntimeProgramEvent = {
    readonly endpointID: string;
    readonly value: ModulationRuntimeProgramUpload | ModulationRuntimeAmountUpload;
};

type CompiledRoute = ModulationRuntimeCell & {
    readonly enabled: boolean;
    readonly polarity: number;
    readonly reducer: number;
    readonly amount: number;
};

/**
 * Compile and validate the rack catalog's DSP target addresses.
 *
 * @param descriptors - Rack parameters whose non-null indices enter the DSP wire domain.
 * @returns Stable modulation target kinds indexed for runtime compilation.
 */
export function compileRackModulationTargetCatalog(
    descriptors: ReadonlyArray<Pick<RackParameterDescriptor, "endpointID" | "modulationTargetIndex">>,
): ReadonlyMap<string, number> {
    const targetIndexByKind = new Map<string, number>();
    const endpointByTargetIndex = new Map<number, string>();

    for (const descriptor of descriptors) {
        const targetIndex = descriptor.modulationTargetIndex;
        if (targetIndex === null) {
            continue;
        }
        if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= MODULATION_RACK_TARGET_COUNT) {
            throw new Error(
                `Invalid rack modulation target index ${String(targetIndex)} for ${descriptor.endpointID}`,
            );
        }

        const existingEndpointID = endpointByTargetIndex.get(targetIndex);
        if (existingEndpointID !== undefined) {
            throw new Error(
                `Duplicate rack modulation target index ${targetIndex}: ${existingEndpointID} and ${descriptor.endpointID}`,
            );
        }

        endpointByTargetIndex.set(targetIndex, descriptor.endpointID);
        targetIndexByKind.set(`rack.${descriptor.endpointID}`, targetIndex);
    }

    return targetIndexByKind;
}

const rackTargetIndexByKind = compileRackModulationTargetCatalog(allRackParameterDescriptors());

function requireSlot(slot: number | null, maximum: number, sourceKind: string): number {
    if (slot === null || !Number.isInteger(slot) || slot < 1 || slot > maximum) {
        throw new Error(`Invalid ${sourceKind} modulation source slot: ${String(slot)}`);
    }

    return slot - 1;
}

function voiceSourceIndex(route: ModulationRoute): number {
    switch (route.sourceKind) {
        case "mseg":
            return requireSlot(route.sourceSlot, 3, route.sourceKind);
        case "env":
            return 3 + requireSlot(route.sourceSlot, 3, route.sourceKind);
        case "velocity":
            return 6;
        case "pressure":
            return 7;
        case "slide":
            return 8;
        case "macro":
            throw new Error("Macro is not a per-voice modulation source");
    }
}

function voiceTargetIndex(targetKind: ModulationTargetKind): number | null {
    switch (targetKind) {
        case "wavetablePosition": return 0;
        case "warpAmount": return 1;
        case "filterCutoffOctaves": return 2;
        case "filterQ": return 3;
        case "pitchSemitones": return 4;
        case "ampGainDb": return 5;
        case "pan": return 6;
        case "unisonDetune": return 7;
        case "unisonBlend": return 8;
        case "unisonWidth": return 9;
        case "unisonWavetablePositionSpread": return 10;
        case "unisonWarpSpread": return 11;
        default: return null;
    }
}

/**
 * Resolve a normalized mapping to its stable runtime cell.
 *
 * @param route - A normalized declarative mapping.
 * @returns Its execution path and deterministic cell coordinates.
 */
export function getModulationRuntimeCell(route: ModulationRoute): ModulationRuntimeCell {
    const voiceTarget = voiceTargetIndex(route.targetKind);
    const rackTarget = rackTargetIndexByKind.get(route.targetKind);

    if (voiceTarget === null && rackTarget === undefined) {
        throw new Error(`Unknown modulation target: ${route.targetKind}`);
    }

    if (route.sourceKind === "macro") {
        const sourceIndex = requireSlot(route.sourceSlot, MODULATION_MACRO_SOURCE_COUNT, route.sourceKind);
        if (voiceTarget !== null) {
            const cellIndex = sourceIndex * MODULATION_VOICE_TARGET_COUNT + voiceTarget;
            return {
                path: "macroVoice",
                cellIndex,
                sourceIndex,
                targetIndex: voiceTarget,
                articulationCellIndex: MODULATION_VOICE_ROUTE_CELL_COUNT + cellIndex,
            };
        }

        const targetIndex = rackTarget ?? 0;
        return {
            path: "macroRack",
            cellIndex: sourceIndex * MODULATION_RACK_TARGET_COUNT + targetIndex,
            sourceIndex,
            targetIndex,
            articulationCellIndex: null,
        };
    }

    const sourceIndex = voiceSourceIndex(route);
    if (voiceTarget !== null) {
        const cellIndex = sourceIndex * MODULATION_VOICE_TARGET_COUNT + voiceTarget;
        return {
            path: "voice",
            cellIndex,
            sourceIndex,
            targetIndex: voiceTarget,
            articulationCellIndex: cellIndex,
        };
    }

    const targetIndex = rackTarget ?? 0;
    return {
        path: "voiceRack",
        cellIndex: sourceIndex * MODULATION_RACK_TARGET_COUNT + targetIndex,
        sourceIndex,
        targetIndex,
        articulationCellIndex: null,
    };
}

/**
 * Resolve the stable per-note articulation cell for a mapping.
 * Rack destinations are global and therefore return `null`.
 *
 * @param route - A normalized declarative mapping.
 * @returns The per-note articulation cell, or `null` when unsupported.
 */
export function getModulationArticulationCellIndex(route: ModulationRoute): number | null {
    return getModulationRuntimeCell(route).articulationCellIndex;
}

function compileRoute(route: ModulationRoute): CompiledRoute {
    return {
        ...getModulationRuntimeCell(route),
        enabled: route.enabled,
        polarity: route.polarity === "bipolar" ? 1 : 0,
        reducer: route.reducer === "mean" ? 2 : 1,
        amount: route.amount,
    };
}

type CompiledRoutesByPath = Record<ModulationRuntimePath, Map<number, CompiledRoute>>;

function createCompiledRoutesByPath(routes: ReadonlyArray<ModulationRoute>): CompiledRoutesByPath {
    const routesByPath: CompiledRoutesByPath = {
        voice: new Map(),
        macroVoice: new Map(),
        voiceRack: new Map(),
        macroRack: new Map(),
    };

    for (const route of routes) {
        const compiled = compileRoute(route);
        const pathRoutes = routesByPath[compiled.path];
        if (pathRoutes.has(compiled.cellIndex)) {
            throw new Error(`Duplicate modulation route cell ${compiled.path}:${compiled.cellIndex}`);
        }
        pathRoutes.set(compiled.cellIndex, compiled);
    }

    return routesByPath;
}

function routeExecutesAtRuntime(route: CompiledRoute): boolean {
    if (!route.enabled) return false;
    if (route.path === "voiceRack" || route.path === "macroRack") return route.amount !== 0;
    return true;
}

function sortedActiveRoutes(routesByCell: ReadonlyMap<number, CompiledRoute>): CompiledRoute[] {
    return [...routesByCell.values()]
        .filter(routeExecutesAtRuntime)
        .sort((left, right) => left.cellIndex - right.cellIndex);
}

function copyActiveRouteFields(
    routes: ReadonlyArray<CompiledRoute>,
    cells: number[],
    sources: number[],
    targets: number[],
    polarities: number[],
): void {
    for (let index = 0; index < routes.length; index += 1) {
        const route = routes[index];
        if (route === undefined) {
            throw new Error(`Missing compiled modulation route at index ${index}`);
        }
        cells[index] = route.cellIndex;
        sources[index] = route.sourceIndex;
        targets[index] = route.targetIndex;
        polarities[index] = route.polarity;
    }
}

/**
 * Compile stored mappings into an allocation-free, active-only runtime program.
 * Duplicate source/target pairs are invalid and never reach the engine.
 * Enabled zero-amount voice mappings remain active for per-note articulation.
 * Rack/global mappings have no articulation override, so zero depth has no runtime instruction.
 *
 * @param routes - Normalized declarative mappings in stored order.
 * @returns One fixed aggregate payload for atomic engine installation.
 */
export function compileModulationRuntimeProgram(
    routes: ReadonlyArray<ModulationRoute>,
): ModulationRuntimeProgramUpload {
    const routesByPath = createCompiledRoutesByPath(routes);

    const voiceRoutes = sortedActiveRoutes(routesByPath.voice);
    const macroVoiceRoutes = sortedActiveRoutes(routesByPath.macroVoice);
    const voiceRackRoutes = sortedActiveRoutes(routesByPath.voiceRack);
    const macroRackRoutes = sortedActiveRoutes(routesByPath.macroRack);

    const voiceRouteCells = Array.from({ length: MODULATION_VOICE_ROUTE_CELL_COUNT }, () => 0);
    const voiceRouteSources = Array.from({ length: MODULATION_VOICE_ROUTE_CELL_COUNT }, () => 0);
    const voiceRouteTargets = Array.from({ length: MODULATION_VOICE_ROUTE_CELL_COUNT }, () => 0);
    const voiceRoutePolarities = Array.from({ length: MODULATION_VOICE_ROUTE_CELL_COUNT }, () => 0);
    const voiceRouteAmounts = Array.from({ length: MODULATION_VOICE_ROUTE_CELL_COUNT }, () => 0);
    copyActiveRouteFields(voiceRoutes, voiceRouteCells, voiceRouteSources, voiceRouteTargets, voiceRoutePolarities);

    const macroVoiceRouteCells = Array.from({ length: MODULATION_MACRO_VOICE_ROUTE_CELL_COUNT }, () => 0);
    const macroVoiceRouteSources = Array.from({ length: MODULATION_MACRO_VOICE_ROUTE_CELL_COUNT }, () => 0);
    const macroVoiceRouteTargets = Array.from({ length: MODULATION_MACRO_VOICE_ROUTE_CELL_COUNT }, () => 0);
    const macroVoiceRoutePolarities = Array.from({ length: MODULATION_MACRO_VOICE_ROUTE_CELL_COUNT }, () => 0);
    const macroVoiceRouteAmounts = Array.from({ length: MODULATION_MACRO_VOICE_ROUTE_CELL_COUNT }, () => 0);
    copyActiveRouteFields(
        macroVoiceRoutes,
        macroVoiceRouteCells,
        macroVoiceRouteSources,
        macroVoiceRouteTargets,
        macroVoiceRoutePolarities,
    );

    const voiceRackRouteCells = Array.from({ length: MODULATION_VOICE_RACK_ROUTE_CELL_COUNT }, () => 0);
    const voiceRackRouteSources = Array.from({ length: MODULATION_VOICE_RACK_ROUTE_CELL_COUNT }, () => 0);
    const voiceRackRouteTargets = Array.from({ length: MODULATION_VOICE_RACK_ROUTE_CELL_COUNT }, () => 0);
    const voiceRackRoutePolarities = Array.from({ length: MODULATION_VOICE_RACK_ROUTE_CELL_COUNT }, () => 0);
    const voiceRackRouteReducers = Array.from({ length: MODULATION_VOICE_RACK_ROUTE_CELL_COUNT }, () => 0);
    const voiceRackRouteAmounts = Array.from({ length: MODULATION_VOICE_RACK_ROUTE_CELL_COUNT }, () => 0);
    copyActiveRouteFields(
        voiceRackRoutes,
        voiceRackRouteCells,
        voiceRackRouteSources,
        voiceRackRouteTargets,
        voiceRackRoutePolarities,
    );

    const macroRackRouteCells = Array.from({ length: MODULATION_MACRO_RACK_ROUTE_CELL_COUNT }, () => 0);
    const macroRackRouteSources = Array.from({ length: MODULATION_MACRO_RACK_ROUTE_CELL_COUNT }, () => 0);
    const macroRackRouteTargets = Array.from({ length: MODULATION_MACRO_RACK_ROUTE_CELL_COUNT }, () => 0);
    const macroRackRoutePolarities = Array.from({ length: MODULATION_MACRO_RACK_ROUTE_CELL_COUNT }, () => 0);
    const macroRackRouteAmounts = Array.from({ length: MODULATION_MACRO_RACK_ROUTE_CELL_COUNT }, () => 0);
    copyActiveRouteFields(
        macroRackRoutes,
        macroRackRouteCells,
        macroRackRouteSources,
        macroRackRouteTargets,
        macroRackRoutePolarities,
    );

    for (const route of routesByPath.voice.values()) voiceRouteAmounts[route.cellIndex] = route.amount;
    for (const route of routesByPath.macroVoice.values()) macroVoiceRouteAmounts[route.cellIndex] = route.amount;
    for (const route of routesByPath.voiceRack.values()) voiceRackRouteAmounts[route.cellIndex] = route.amount;
    for (const route of routesByPath.macroRack.values()) macroRackRouteAmounts[route.cellIndex] = route.amount;
    for (let index = 0; index < voiceRackRoutes.length; index += 1) {
        const route = voiceRackRoutes[index];
        if (route === undefined) throw new Error(`Missing compiled voice-rack route at index ${index}`);
        voiceRackRouteReducers[index] = route.reducer;
    }

    return {
        voiceRouteCount: voiceRoutes.length,
        voiceRouteCells,
        voiceRouteSources,
        voiceRouteTargets,
        voiceRoutePolarities,
        voiceRouteAmounts,
        macroVoiceRouteCount: macroVoiceRoutes.length,
        macroVoiceRouteCells,
        macroVoiceRouteSources,
        macroVoiceRouteTargets,
        macroVoiceRoutePolarities,
        macroVoiceRouteAmounts,
        voiceRackRouteCount: voiceRackRoutes.length,
        voiceRackRouteCells,
        voiceRackRouteSources,
        voiceRackRouteTargets,
        voiceRackRoutePolarities,
        voiceRackRouteReducers,
        voiceRackRouteAmounts,
        macroRackRouteCount: macroRackRoutes.length,
        macroRackRouteCells,
        macroRackRouteSources,
        macroRackRouteTargets,
        macroRackRoutePolarities,
        macroRackRouteAmounts,
    };
}

const runtimePaths: ReadonlyArray<ModulationRuntimePath> = ["voice", "macroVoice", "voiceRack", "macroRack"];

const pathKindByRuntimePath: Readonly<Record<ModulationRuntimePath, number>> = {
    voice: 1,
    macroVoice: 2,
    voiceRack: 3,
    macroRack: 4,
};

function compileRoutesByPath(
    routes: ReadonlyArray<ModulationRoute>,
): CompiledRoutesByPath {
    return createCompiledRoutesByPath(routes);
}

function routeTopologyMatches(previous: CompiledRoute, next: CompiledRoute): boolean {
    return previous.cellIndex === next.cellIndex
        && previous.sourceIndex === next.sourceIndex
        && previous.targetIndex === next.targetIndex
        && previous.polarity === next.polarity
        && previous.reducer === next.reducer;
}

/**
 * Compile the smallest safe runtime update between two declarative route sets.
 * Structural edits produce one atomic program install; pure amount edits produce
 * one small deterministic-cell event each.
 *
 * @param previousRoutes - Last successfully applied routes, or null at engine boot.
 * @param nextRoutes - Newly stored routes.
 * @returns Runtime events required to make the engine match `nextRoutes`.
 */
export function buildModulationRuntimeProgramEvents(
    previousRoutes: ReadonlyArray<ModulationRoute> | null,
    nextRoutes: ReadonlyArray<ModulationRoute>,
): ModulationRuntimeProgramEvent[] {
    if (previousRoutes === null) {
        return [{ endpointID: MODULATION_PROGRAM_ENDPOINT_ID, value: compileModulationRuntimeProgram(nextRoutes) }];
    }

    // Classify the edit before allocating any fixed-size transport arrays. The
    // common knob-drag path therefore stays proportional to stored mappings and
    // emits only the changed cells.
    const previousRoutesByPath = compileRoutesByPath(previousRoutes);
    const nextRoutesByPath = compileRoutesByPath(nextRoutes);
    const events: ModulationRuntimeProgramEvent[] = [];

    for (const path of runtimePaths) {
        const previousActiveRoutes = sortedActiveRoutes(previousRoutesByPath[path]);
        const nextActiveRoutes = sortedActiveRoutes(nextRoutesByPath[path]);
        if (previousActiveRoutes.length !== nextActiveRoutes.length) {
            return [{ endpointID: MODULATION_PROGRAM_ENDPOINT_ID, value: compileModulationRuntimeProgram(nextRoutes) }];
        }

        for (let activeIndex = 0; activeIndex < nextActiveRoutes.length; activeIndex += 1) {
            const previousRoute = previousActiveRoutes[activeIndex];
            const nextRoute = nextActiveRoutes[activeIndex];
            if (previousRoute === undefined || nextRoute === undefined || !routeTopologyMatches(previousRoute, nextRoute)) {
                return [{ endpointID: MODULATION_PROGRAM_ENDPOINT_ID, value: compileModulationRuntimeProgram(nextRoutes) }];
            }

            if (previousRoute.amount !== nextRoute.amount) {
                events.push({
                    endpointID: MODULATION_AMOUNT_ENDPOINT_ID,
                    value: {
                        pathKind: pathKindByRuntimePath[path],
                        cellIndex: nextRoute.cellIndex,
                        amount: nextRoute.amount,
                    },
                });
            }
        }
    }

    return events;
}
