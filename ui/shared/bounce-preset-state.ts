import {
    BOUNCE_DOCUMENT_VERSION,
    BOUNCE_STATE_KEY,
    parseBounceDocument,
    serializeBounceDocument,
} from "../../bounce/document.mjs";
import type { PatchConnectionLike } from "./cmajor-react";
import type { EffectStoredStateAdapter } from "./effects/effect-preset-v2";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFullStoredStateValue(storedState: unknown) {
    if (!isRecord(storedState)) return undefined;
    const nestedValues = isRecord(storedState.values) ? storedState.values : null;
    if (nestedValues && Object.hasOwn(nestedValues, BOUNCE_STATE_KEY)) {
        return nestedValues[BOUNCE_STATE_KEY];
    }
    return Object.hasOwn(storedState, BOUNCE_STATE_KEY)
        ? storedState[BOUNCE_STATE_KEY]
        : undefined;
}

function normalizeBounceReference(value: unknown) {
    if (value === null || value === undefined || value === "") return null;
    return parseBounceDocument(value);
}

function serializeBounceReference(value: unknown) {
    const normalized = normalizeBounceReference(value);
    return normalized === null ? null : serializeBounceDocument(normalized);
}

/** Required synth-preset adapter for the lightweight bounce.v1 bank reference. */
export function createBouncePresetStoredStateAdapter(
    patchConnection: PatchConnectionLike,
): EffectStoredStateAdapter {
    const listeners = new Set<() => void>();
    const pendingEchoes: Array<string | null> = [];
    let currentValue: unknown = null;
    let hydrated = false;
    let hydrationError: Error | null = null;
    let attached = false;
    let awaitingKeyHydration = false;

    const acceptIncoming = (rawValue: unknown, isHydration: boolean) => {
        let normalized: unknown;
        let serialized: string | null;
        try {
            normalized = normalizeBounceReference(rawValue);
            serialized = serializeBounceReference(normalized);
        } catch (error) {
            hydrationError = error instanceof Error ? error : new Error(String(error));
            hydrated = true;
            if (!isHydration) {
                for (const listener of listeners) listener();
            }
            return;
        }

        const echoIndex = pendingEchoes.indexOf(serialized);
        if (echoIndex !== -1) {
            pendingEchoes.splice(echoIndex, 1);
            return;
        }
        currentValue = normalized;
        hydrationError = null;
        hydrated = true;
        if (!isHydration) {
            for (const listener of listeners) listener();
        }
    };

    const handleStoredStateValue = (message: unknown) => {
        const payload = isRecord(message) && isRecord(message.event) ? message.event : message;
        if (!isRecord(payload) || payload.key !== BOUNCE_STATE_KEY) return;
        const isHydration = awaitingKeyHydration;
        awaitingKeyHydration = false;
        acceptIncoming(payload.value, isHydration);
    };

    const attach = () => {
        if (attached) return;
        attached = true;
        patchConnection.addStoredStateValueListener?.(handleStoredStateValue);
        if (typeof patchConnection.requestFullStoredState === "function") {
            patchConnection.requestFullStoredState((storedState) => {
                acceptIncoming(readFullStoredStateValue(storedState), true);
            });
            return;
        }
        if (typeof patchConnection.requestStoredStateValue === "function") {
            awaitingKeyHydration = true;
            patchConnection.requestStoredStateValue(BOUNCE_STATE_KEY);
            return;
        }
        hydrationError = new Error(
            `Cannot hydrate ${BOUNCE_STATE_KEY} because stored-state reads are unavailable.`,
        );
        hydrated = true;
    };

    const detach = () => {
        if (!attached || listeners.size > 0) return;
        patchConnection.removeStoredStateValueListener?.(handleStoredStateValue);
        attached = false;
        awaitingKeyHydration = false;
    };

    return {
        key: BOUNCE_STATE_KEY,
        schemaVersion: BOUNCE_DOCUMENT_VERSION,
        getContract() {
            return {
                key: BOUNCE_STATE_KEY,
                schemaVersion: BOUNCE_DOCUMENT_VERSION,
                required: true,
            };
        },
        capture() {
            if (hydrationError) throw hydrationError;
            if (!hydrated) throw new Error(`${BOUNCE_STATE_KEY} has not hydrated yet.`);
            return normalizeBounceReference(currentValue);
        },
        normalizeForPreset(value: unknown) {
            return normalizeBounceReference(value);
        },
        serializeForPreset(value: unknown) {
            return serializeBounceReference(value);
        },
        apply(value: unknown) {
            if (typeof patchConnection.sendStoredStateValue !== "function") {
                throw new Error(`Cannot apply ${BOUNCE_STATE_KEY} because stored-state writes are unavailable.`);
            }
            const normalized = normalizeBounceReference(value);
            const serialized = serializeBounceReference(normalized);
            const previousValue = currentValue;
            currentValue = normalized;
            hydrationError = null;
            hydrated = true;
            pendingEchoes.push(serialized);
            try {
                patchConnection.sendStoredStateValue(BOUNCE_STATE_KEY, serialized);
            } catch (error) {
                const echoIndex = pendingEchoes.lastIndexOf(serialized);
                if (echoIndex !== -1) pendingEchoes.splice(echoIndex, 1);
                currentValue = previousValue;
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
