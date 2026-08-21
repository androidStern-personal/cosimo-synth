import {
    type ModulationRoute,
    type ModulationSourceKind,
    type ModulationTargetKind,
    type RackModulationTargetKind,
} from "./modulation";
import type { RackParameterDescriptor } from "./rack-parameter-descriptors";

export type RackRouteSource = {
    readonly sourceKind: ModulationSourceKind;
    readonly sourceSlot: number | null;
};

export type RackRouteRelationship = "ineligible" | "no-source" | "unmapped" | "mapped" | "route-bypassed";
export type RackRouteCreation = "ineligible" | "no-source" | "existing" | "creatable" | "pending";
export type RackRouteEffectiveness = "active" | "effect-bypassed" | "target-suspended";
export type RackRouteBadge = "hidden" | "solid" | "hollow";

export type RackRoutePresentation = {
    readonly relationship: RackRouteRelationship;
    readonly currentRoute: ModulationRoute | null;
    readonly currentRouteIndex: number;
    readonly targetRouteCount: number;
    readonly hasEnabledTargetRoute: boolean;
    readonly badge: RackRouteBadge;
    readonly creation: RackRouteCreation;
    readonly effectiveness: RackRouteEffectiveness;
};

type RackRoutePresentationInput = {
    readonly routes: ReadonlyArray<ModulationRoute>;
    readonly armedSource: RackRouteSource | null;
    readonly targetKind: RackModulationTargetKind | null;
    readonly effectEnabled: boolean;
    readonly targetEffective: boolean;
    readonly pending: boolean;
};

function routeMatchesSource(route: ModulationRoute, source: RackRouteSource) {
    return route.sourceKind === source.sourceKind && route.sourceSlot === source.sourceSlot;
}

/** Canonical source-target creation guard shared by rack drop, explicit create, and the matrix. */
export function getModulationRouteCreation(input: {
    readonly routes: ReadonlyArray<ModulationRoute>;
    readonly source: RackRouteSource | null;
    readonly targetKind: ModulationTargetKind | null;
    readonly pending: boolean;
}): RackRouteCreation {
    if (input.source === null) {
        return input.targetKind === null ? "ineligible" : "no-source";
    }
    if (input.targetKind === null) {
        return "ineligible";
    }
    const source = input.source;
    if (input.routes.some((route) => (
        route.targetKind === input.targetKind && routeMatchesSource(route, source)
    ))) {
        return "existing";
    }
    if (input.pending) {
        return "pending";
    }
    return "creatable";
}

/** Project persistent route topology into the rack's source-relative visual semantics. */
export function projectRackRoutePresentation(input: RackRoutePresentationInput): RackRoutePresentation {
    const targetRoutes = input.targetKind === null
        ? []
        : input.routes.filter((route) => route.targetKind === input.targetKind);
    const hasEnabledTargetRoute = targetRoutes.some((route) => route.enabled);
    const badge: RackRouteBadge = targetRoutes.length === 0
        ? "hidden"
        : hasEnabledTargetRoute ? "solid" : "hollow";
    const effectiveness: RackRouteEffectiveness = !input.effectEnabled
        ? "effect-bypassed"
        : input.targetEffective ? "active" : "target-suspended";

    if (input.targetKind === null) {
        return {
            relationship: "ineligible",
            currentRoute: null,
            currentRouteIndex: -1,
            targetRouteCount: 0,
            hasEnabledTargetRoute: false,
            badge: "hidden",
            creation: "ineligible",
            effectiveness,
        };
    }

    if (input.armedSource === null) {
        return {
            relationship: "no-source",
            currentRoute: null,
            currentRouteIndex: -1,
            targetRouteCount: targetRoutes.length,
            hasEnabledTargetRoute,
            badge,
            creation: "no-source",
            effectiveness,
        };
    }

    const armedSource = input.armedSource;
    const currentRouteIndex = input.routes.findIndex((route) => (
        route.targetKind === input.targetKind && routeMatchesSource(route, armedSource)
    ));
    const currentRoute = currentRouteIndex < 0 ? null : input.routes[currentRouteIndex] ?? null;
    const relationship: RackRouteRelationship = currentRoute === null
        ? "unmapped"
        : currentRoute.enabled ? "mapped" : "route-bypassed";
    const creation = getModulationRouteCreation({
        routes: input.routes,
        source: input.armedSource,
        targetKind: input.targetKind,
        pending: input.pending,
    });

    return {
        relationship,
        currentRoute,
        currentRouteIndex,
        targetRouteCount: targetRoutes.length,
        hasEnabledTargetRoute,
        badge,
        creation,
        effectiveness,
    };
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function normalizeDisplayedValue(descriptor: RackParameterDescriptor, value: number) {
    const clamped = clamp(value, descriptor.min, descriptor.max);
    if (descriptor.scale === "log") {
        return Math.log(clamped / descriptor.min) / Math.log(descriptor.max / descriptor.min);
    }
    return (clamped - descriptor.min) / (descriptor.max - descriptor.min);
}

function applyRouteOffset(descriptor: RackParameterDescriptor, baseValue: number, offset: number) {
    const rawValue = descriptor.modulationApplication === "octaves"
        ? baseValue * (2 ** offset)
        : baseValue + offset;
    return clamp(rawValue, descriptor.min, descriptor.max);
}

/**
 * The live light's knob position for a clamped [0,1] source value, applied
 * exactly as the rack DSP does: bipolar sources map onto [-1,+1], the offset
 * applies linearly or in octaves per the descriptor, and the result clamps
 * to the descriptor range before log/linear display normalization.
 */
export function projectRackRouteLiveNormalized(
    descriptor: RackParameterDescriptor,
    baseValue: number,
    route: Pick<ModulationRoute, "amount" | "polarity">,
    sourceValue01: number,
): number {
    const clampedBase = clamp(baseValue, descriptor.min, descriptor.max);
    const s = clamp(sourceValue01, 0, 1);
    const offset = route.amount * (route.polarity === "bipolar" ? (s * 2) - 1 : s);
    return normalizeDisplayedValue(descriptor, applyRouteOffset(descriptor, clampedBase, offset));
}

export type RackRouteTravel = {
    readonly values: readonly [number, number];
    readonly normalized: readonly [number, number];
    readonly baseNormalized: number;
    readonly hasVisibleTravel: boolean;
    readonly nonzeroRouteFullyClipped: boolean;
};

/** Compute one route's full source-domain contribution exactly as the rack DSP applies it. */
export function projectRackRouteTravel(
    descriptor: RackParameterDescriptor,
    baseValue: number,
    route: Pick<ModulationRoute, "amount" | "polarity">,
): RackRouteTravel {
    const clampedBase = clamp(baseValue, descriptor.min, descriptor.max);
    const magnitude = Math.abs(route.amount);
    const offsets: readonly [number, number] = route.polarity === "bipolar"
        ? [-magnitude, magnitude]
        : route.amount < 0 ? [route.amount, 0] : [0, route.amount];
    const firstValue = applyRouteOffset(descriptor, clampedBase, offsets[0]);
    const secondValue = applyRouteOffset(descriptor, clampedBase, offsets[1]);
    const values: readonly [number, number] = firstValue <= secondValue
        ? [firstValue, secondValue]
        : [secondValue, firstValue];
    const normalized: readonly [number, number] = [
        normalizeDisplayedValue(descriptor, values[0]),
        normalizeDisplayedValue(descriptor, values[1]),
    ];
    const hasVisibleTravel = Math.abs(normalized[1] - normalized[0]) > 1e-9;

    return {
        values,
        normalized,
        baseNormalized: normalizeDisplayedValue(descriptor, clampedBase),
        hasVisibleTravel,
        nonzeroRouteFullyClipped: magnitude > 1e-9 && !hasVisibleTravel,
    };
}
