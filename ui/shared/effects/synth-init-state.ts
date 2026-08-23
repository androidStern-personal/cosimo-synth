/**
 * Synth-only canonical Init documents and the lane.v1 transaction adapter.
 * Init derives current defaults here; it never reads a hidden preset record.
 */

import type { PatchConnectionLike } from "../cmajor-react";
import {
    ARTICULATIONS_V4_STATE_KEY,
    createEmptyArticulationsState,
    serializeArticulationsV4,
} from "../articulation-image";
import {
    MODULATION_STATE_KEY,
    MODULATION_STATE_VERSION,
    createDefaultModulationState,
    serializeModulationState,
} from "../modulation";
import { LANE_STATE_KEY } from "../lane-state";
import {
    commitLaneStateV2,
    createDefaultLaneStateV2,
    parseLaneStateV2Compat,
    serializeLaneStateV2,
    type LaneStateV2,
} from "../lane-state-v2";
import type { EffectStoredStateAdapter } from "./effect-preset-v2";
import type { EffectPluginStateContract } from "./effect-state-contract";
import type {
    StandaloneEffectInitOnlyStateAdapter,
    StandaloneEffectPresetSynthOptions,
} from "./standalone-effect-presets";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFullStoredStateValue(storedState: unknown, key: string) {
    if (!isRecord(storedState)) {
        return undefined;
    }

    const nestedValues = isRecord(storedState.values) ? storedState.values : null;

    if (nestedValues && Object.hasOwn(nestedValues, key)) {
        return nestedValues[key];
    }

    return Object.hasOwn(storedState, key) ? storedState[key] : undefined;
}

function parseStrictRackState(value: unknown): LaneStateV2 {
    const outcome = parseLaneStateV2Compat(value);

    if (outcome._tag === "err") {
        throw new Error(outcome.message);
    }

    return outcome.value;
}

function cloneRackState(value: LaneStateV2) {
    return parseStrictRackState(serializeLaneStateV2(value));
}

/** Create the strict lane.v1 mirror used only while rack is absent from presets. */
export function createSynthRackInitStateAdapter(
    patchConnection: PatchConnectionLike,
): StandaloneEffectInitOnlyStateAdapter {
    const listeners = new Set<() => void>();
    const pendingEchoes: string[] = [];
    let currentState: LaneStateV2 | null = null;
    let hydrationError: Error | null = null;
    let attached = false;
    let awaitingKeyHydration = false;

    const acceptIncoming = (rawValue: unknown, isHydration: boolean) => {
        if (rawValue === undefined && isHydration) {
            currentState = createDefaultLaneStateV2();
            hydrationError = null;
            return;
        }

        let nextState: LaneStateV2;

        try {
            nextState = parseStrictRackState(rawValue);
        } catch (error) {
            hydrationError = error instanceof Error ? error : new Error(String(error));
            if (!isHydration) {
                for (const listener of listeners) {
                    listener();
                }
            }
            return;
        }

        const serialized = serializeLaneStateV2(nextState);
        const echoIndex = pendingEchoes.indexOf(serialized);

        if (echoIndex !== -1) {
            pendingEchoes.splice(echoIndex, 1);
            return;
        }

        currentState = nextState;
        hydrationError = null;

        if (isHydration) {
            return;
        }

        for (const listener of listeners) {
            listener();
        }
    };

    const handleStoredStateValue = (message: unknown) => {
        if (!isRecord(message) || message.key !== LANE_STATE_KEY) {
            return;
        }

        const isHydration = awaitingKeyHydration;
        awaitingKeyHydration = false;
        acceptIncoming(message.value, isHydration);
    };

    const attach = () => {
        if (attached) {
            return;
        }

        attached = true;
        patchConnection.addStoredStateValueListener?.(handleStoredStateValue);

        if (typeof patchConnection.requestFullStoredState === "function") {
            patchConnection.requestFullStoredState((storedState) => {
                acceptIncoming(readFullStoredStateValue(storedState, LANE_STATE_KEY), true);
            });
            return;
        }

        if (typeof patchConnection.requestStoredStateValue === "function") {
            awaitingKeyHydration = true;
            patchConnection.requestStoredStateValue(LANE_STATE_KEY);
            return;
        }

        hydrationError = new Error(`Cannot hydrate ${LANE_STATE_KEY} because stored-state reads are unavailable.`);
    };

    const detach = () => {
        if (!attached || listeners.size > 0) {
            return;
        }

        patchConnection.removeStoredStateValueListener?.(handleStoredStateValue);
        attached = false;
        awaitingKeyHydration = false;
    };

    return {
        key: LANE_STATE_KEY,
        capture() {
            if (hydrationError) {
                throw hydrationError;
            }

            if (!currentState) {
                throw new Error(`${LANE_STATE_KEY} has not hydrated yet.`);
            }

            return cloneRackState(currentState);
        },
        createDefaultValue() {
            return createDefaultLaneStateV2();
        },
        normalizeForTransaction(value: unknown) {
            return parseStrictRackState(value);
        },
        serializeForTransaction(value: unknown) {
            return serializeLaneStateV2(parseStrictRackState(value));
        },
        apply(value: unknown) {
            if (typeof patchConnection.sendEventOrValue !== "function") {
                throw new Error(`Cannot apply ${LANE_STATE_KEY} because rack runtime writes are unavailable.`);
            }

            if (typeof patchConnection.sendStoredStateValue !== "function") {
                throw new Error(`Cannot apply ${LANE_STATE_KEY} because stored-state writes are unavailable.`);
            }

            const nextState = parseStrictRackState(value);
            const previousState = currentState;
            const serialized = serializeLaneStateV2(nextState);
            currentState = nextState;
            pendingEchoes.push(serialized);

            try {
                commitLaneStateV2(patchConnection, nextState);
                patchConnection.sendStoredStateValue(LANE_STATE_KEY, serialized);
            } catch (error) {
                const echoIndex = pendingEchoes.lastIndexOf(serialized);
                if (echoIndex !== -1) {
                    pendingEchoes.splice(echoIndex, 1);
                }
                currentState = previousState;
                throw error;
            }
        },
        subscribe(listener: () => void) {
            listeners.add(listener);
            attach();

            return () => {
                listeners.delete(listener);
                detach();
            };
        },
    };
}

function createCanonicalStoredState(currentContract: EffectPluginStateContract) {
    const factories: Readonly<Record<string, { readonly schemaVersion: number; readonly create: () => unknown }>> = {
        [MODULATION_STATE_KEY]: {
            schemaVersion: MODULATION_STATE_VERSION,
            create: () => serializeModulationState(createDefaultModulationState()),
        },
        [ARTICULATIONS_V4_STATE_KEY]: {
            schemaVersion: 4,
            create: () => serializeArticulationsV4(createEmptyArticulationsState()),
        },
        [LANE_STATE_KEY]: {
            // The slot name predates the tree document; the value inside is
            // self-versioned lane.v2 (the compat parse still reads v1).
            schemaVersion: 2,
            create: () => serializeLaneStateV2(createDefaultLaneStateV2()),
        },
    };
    const storedState: Record<string, unknown> = {};

    for (const entry of currentContract.storedState) {
        const factory = factories[entry.key];

        if (!factory) {
            throw new Error(`There is no canonical Init document for ${entry.key}.`);
        }

        if (entry.schemaVersion !== factory.schemaVersion) {
            throw new Error(
                `Canonical Init document ${entry.key} is version ${factory.schemaVersion}, not ${entry.schemaVersion}.`,
            );
        }

        storedState[entry.key] = factory.create();
    }

    return storedState;
}

/** Build the synth opt-in without changing standalone-effect preset behavior. */
export function createSynthPresetInitOptions(
    patchConnection: PatchConnectionLike,
    storedStateAdapters: ReadonlyArray<Pick<EffectStoredStateAdapter, "key">>,
): StandaloneEffectPresetSynthOptions {
    const rackIsPresetOwned = storedStateAdapters.some((adapter) => adapter.key === LANE_STATE_KEY);

    return {
        createCanonicalStoredState,
        initOnlyStateAdapters: rackIsPresetOwned
            ? []
            : [createSynthRackInitStateAdapter(patchConnection)],
    };
}
