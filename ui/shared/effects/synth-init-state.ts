/**
 * Synth-only canonical Init documents and the rack.v1 transaction adapter.
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
import {
    RACK_STATE_KEY,
    commitRackState,
    createDefaultRackState,
    parseRackState,
    serializeRackState,
    type RackState,
} from "../rack-state";
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

function parseStrictRackState(value: unknown): RackState {
    const outcome = parseRackState(value);

    if (outcome._tag === "err") {
        throw new Error(outcome.message);
    }

    return outcome.value;
}

function cloneRackState(value: RackState) {
    return parseStrictRackState(serializeRackState(value));
}

/** Create the strict rack.v1 mirror used only while rack is absent from presets. */
export function createSynthRackInitStateAdapter(
    patchConnection: PatchConnectionLike,
): StandaloneEffectInitOnlyStateAdapter {
    const listeners = new Set<() => void>();
    const pendingEchoes: string[] = [];
    let currentState: RackState | null = null;
    let hydrationError: Error | null = null;
    let attached = false;
    let awaitingKeyHydration = false;

    const acceptIncoming = (rawValue: unknown, isHydration: boolean) => {
        if (rawValue === undefined && isHydration) {
            currentState = createDefaultRackState();
            hydrationError = null;
            return;
        }

        let nextState: RackState;

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

        const serialized = serializeRackState(nextState);
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
        if (!isRecord(message) || message.key !== RACK_STATE_KEY) {
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
                acceptIncoming(readFullStoredStateValue(storedState, RACK_STATE_KEY), true);
            });
            return;
        }

        if (typeof patchConnection.requestStoredStateValue === "function") {
            awaitingKeyHydration = true;
            patchConnection.requestStoredStateValue(RACK_STATE_KEY);
            return;
        }

        hydrationError = new Error(`Cannot hydrate ${RACK_STATE_KEY} because stored-state reads are unavailable.`);
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
        key: RACK_STATE_KEY,
        capture() {
            if (hydrationError) {
                throw hydrationError;
            }

            if (!currentState) {
                throw new Error(`${RACK_STATE_KEY} has not hydrated yet.`);
            }

            return cloneRackState(currentState);
        },
        createDefaultValue() {
            return createDefaultRackState();
        },
        normalizeForTransaction(value: unknown) {
            return parseStrictRackState(value);
        },
        serializeForTransaction(value: unknown) {
            return serializeRackState(parseStrictRackState(value));
        },
        apply(value: unknown) {
            if (typeof patchConnection.sendEventOrValue !== "function") {
                throw new Error(`Cannot apply ${RACK_STATE_KEY} because rack runtime writes are unavailable.`);
            }

            if (typeof patchConnection.sendStoredStateValue !== "function") {
                throw new Error(`Cannot apply ${RACK_STATE_KEY} because stored-state writes are unavailable.`);
            }

            const nextState = parseStrictRackState(value);
            const previousState = currentState;
            const serialized = serializeRackState(nextState);
            currentState = nextState;
            pendingEchoes.push(serialized);

            try {
                commitRackState(patchConnection, nextState);
                patchConnection.sendStoredStateValue(RACK_STATE_KEY, serialized);
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
        [RACK_STATE_KEY]: {
            schemaVersion: 1,
            create: () => serializeRackState(createDefaultRackState()),
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
    const rackIsPresetOwned = storedStateAdapters.some((adapter) => adapter.key === RACK_STATE_KEY);

    return {
        createCanonicalStoredState,
        initOnlyStateAdapters: rackIsPresetOwned
            ? []
            : [createSynthRackInitStateAdapter(patchConnection)],
    };
}
