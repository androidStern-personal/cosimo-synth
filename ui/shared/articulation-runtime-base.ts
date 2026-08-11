import {
    type ArticulationVoiceParameterId,
    type PatchVoiceBase,
} from "./articulation-image";
import {
    createDefaultEnvelope,
    type ModulationState,
} from "./modulation";
import { getModulationArticulationCellIndex } from "./modulation-runtime-program";
import { clampNormalizedValue } from "./cosimo-ids";
import { allTargetDescriptors } from "./target-descriptor";

export const UI_PATCH_VALUES_STATE_KEY = "uiPatchValues.v1";

/**
 * Stable projection of modulation state that can actually change a resolved
 * articulation image. Route amounts, polarity, reducer, enabled state, MSEG
 * shapes/playback, and names are deliberately absent.
 */
export function getArticulationModulationDependencyToken(state: ModulationState): string {
    const routeCells = state.routes.flatMap((route) => {
        const cellIndex = getModulationArticulationCellIndex(route);
        return cellIndex === null ? [] : [[route.id, cellIndex] as const];
    }).sort(([leftId, leftCell], [rightId, rightCell]) => (
        leftId.localeCompare(rightId) || leftCell - rightCell
    ));

    return JSON.stringify({
        envelopeSlots: state.envelopeSlots.map((envelope) => [
            envelope.attackSeconds,
            envelope.decaySeconds,
            envelope.sustain,
            envelope.releaseSeconds,
        ]),
        msegMorphs: state.msegSlots.map((slot) => slot.morph),
        routeCells,
    });
}

/** Stable projection of patch values inherited by articulation images. */
export function getArticulationPatchValuesDependencyToken(
    patchValues: Readonly<Record<string, number>>,
): string {
    return JSON.stringify(allTargetDescriptors().flatMap((descriptor) => {
        const parameterID = descriptor.articulationParameterId;
        if (parameterID === null) {
            return [];
        }
        if (descriptor.binding._tag !== "endpoint") {
            throw new Error(`Articulation-capable target ${descriptor.targetId} has no endpoint binding.`);
        }
        return [[
            parameterID,
            descriptor.binding.toEngine(
                clampNormalizedValue(patchValues[descriptor.targetId] ?? descriptor.initialValue),
            ),
        ] as const];
    }));
}

export function createDefaultUiPatchValues(): Record<string, number> {
    return Object.fromEntries(
        allTargetDescriptors().map((descriptor) => [descriptor.targetId, descriptor.initialValue]),
    );
}

export function deserializeUiPatchValues(value: unknown): Record<string, number> {
    let document = value;
    if (typeof document === "string") {
        try {
            document = JSON.parse(document);
        } catch {
            throw new Error(`${UI_PATCH_VALUES_STATE_KEY} is not valid JSON.`);
        }
    }
    if (document === undefined) {
        return createDefaultUiPatchValues();
    }
    if (!document || typeof document !== "object" || Array.isArray(document)) {
        throw new Error(`${UI_PATCH_VALUES_STATE_KEY} must be a flat object.`);
    }

    const record = document as Record<string, unknown>;
    const values: Record<string, number> = {};
    const descriptors = allTargetDescriptors();
    for (const descriptor of descriptors) {
        const rawValue = record[descriptor.targetId];
        if (rawValue === undefined) {
            values[descriptor.targetId] = descriptor.initialValue;
            continue;
        }
        if (typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue < 0 || rawValue > 1) {
            throw new Error(`${UI_PATCH_VALUES_STATE_KEY}.${descriptor.targetId} must be within 0..1.`);
        }
        values[descriptor.targetId] = rawValue;
    }
    return values;
}

/**
 * Resolves already-parsed patch state into the complete voice base inherited by
 * sparse articulation overrides.
 */
export function buildArticulationPatchVoiceBase(
    modulationState: ModulationState,
    patchValues: Readonly<Record<string, number>>,
): PatchVoiceBase {
    const envelope = (slotIndex: number) => (
        modulationState.envelopeSlots[slotIndex] ?? createDefaultEnvelope(slotIndex)
    );
    const parameters: Record<ArticulationVoiceParameterId, number> = {
        framePosition: 0,
        pan: 0,
        warpMode: 0,
        warpAmount: 0,
        filterMode: 0,
        filterCutoffHz: 1000,
        filterQ: 0.707107,
        unisonVoices: 1,
        unisonDetune: 0.1,
        unisonBlend: 0.75,
        unisonWidth: 1,
        unisonPhase: 0,
        unisonRandom: 0,
        unisonPhaseMode: 0,
        unisonDetuneMode: 0,
        unisonStackMode: 0,
        unisonWavetablePositionSpread: 0,
        unisonWarpSpread: 0,
        msegMorph1: modulationState.msegSlots[0]?.morph ?? 0,
        msegMorph2: modulationState.msegSlots[1]?.morph ?? 0,
        msegMorph3: modulationState.msegSlots[2]?.morph ?? 0,
        "env1.attackSeconds": envelope(0).attackSeconds,
        "env1.decaySeconds": envelope(0).decaySeconds,
        "env1.sustain": envelope(0).sustain,
        "env1.releaseSeconds": envelope(0).releaseSeconds,
        "env2.attackSeconds": envelope(1).attackSeconds,
        "env2.decaySeconds": envelope(1).decaySeconds,
        "env2.sustain": envelope(1).sustain,
        "env2.releaseSeconds": envelope(1).releaseSeconds,
        "env3.attackSeconds": envelope(2).attackSeconds,
        "env3.decaySeconds": envelope(2).decaySeconds,
        "env3.sustain": envelope(2).sustain,
        "env3.releaseSeconds": envelope(2).releaseSeconds,
    };

    for (const descriptor of allTargetDescriptors()) {
        const parameterID = descriptor.articulationParameterId;
        if (parameterID === null) {
            continue;
        }
        if (descriptor.binding._tag !== "endpoint") {
            throw new Error(`Articulation-capable target ${descriptor.targetId} has no endpoint binding.`);
        }
        parameters[parameterID] = descriptor.binding.toEngine(
            clampNormalizedValue(patchValues[descriptor.targetId] ?? descriptor.initialValue),
        );
    }

    const runtimeRoutes = modulationState.routes.flatMap((route) => {
        const cellIndex = getModulationArticulationCellIndex(route);
        return cellIndex === null ? [] : [{ route, cellIndex }];
    });
    const routeCells = Object.create(null) as Record<string, number>;
    for (const { route, cellIndex } of runtimeRoutes) {
        routeCells[route.id] = cellIndex;
    }

    return {
        parameters,
        routeAmounts: Object.fromEntries(runtimeRoutes.map(({ route }) => [route.id, route.amount])),
        routeOrder: runtimeRoutes.map(({ route }) => route.id),
        routeCells,
    };
}
