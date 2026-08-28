export const BROWSER_PATCH_STATE_KEY = "cosimo.web.patch-state.v2";

const BROWSER_PATCH_STATE_FORMAT = "cosimo.browserPatchState";
// T28 Polish hard-cuts the complete sound. Earlier snapshots are discarded whole.
const BROWSER_PATCH_STATE_VERSION = 4;
const REQUIRED_SOUND_STORED_STATE_KEYS = Object.freeze([
    "modulation.v6",
    "articulations.v4",
    "bounce.v1",
    "lane.v1",
]);

function resolveStorage(storage) {
    if (storage !== undefined) return storage;

    try {
        return globalThis.localStorage;
    } catch {
        return undefined;
    }
}

function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function emptyBrowserPatchState() {
    return {
        format: BROWSER_PATCH_STATE_FORMAT,
        version: BROWSER_PATCH_STATE_VERSION,
        sound: {
            parameters: {},
            storedState: {},
        },
        auxiliary: {},
    };
}

function parseBrowserPatchState(value) {
    if (!isRecord(value)
        || value.format !== BROWSER_PATCH_STATE_FORMAT
        || value.version !== BROWSER_PATCH_STATE_VERSION
        || !isRecord(value.sound)
        || !isRecord(value.sound.parameters)
        || !isRecord(value.sound.storedState)
        || !isRecord(value.auxiliary)) {
        return null;
    }

    const parameters = {};
    for (const [endpointID, parameterValue] of Object.entries(value.sound.parameters)) {
        if (typeof parameterValue === "number" && Number.isFinite(parameterValue)) {
            parameters[endpointID] = parameterValue;
        }
    }

    return {
        format: BROWSER_PATCH_STATE_FORMAT,
        version: BROWSER_PATCH_STATE_VERSION,
        sound: {
            parameters,
            storedState: { ...value.sound.storedState },
        },
        auxiliary: { ...value.auxiliary },
    };
}

function isCompleteSoundSnapshot(state, parameterEndpointIDs, requiredStoredStateKeys) {
    if (state === null || parameterEndpointIDs.size === 0) return false;

    const savedParameterEndpointIDs = Object.keys(state.sound.parameters);
    if (savedParameterEndpointIDs.length !== parameterEndpointIDs.size
        || savedParameterEndpointIDs.some((endpointID) => !parameterEndpointIDs.has(endpointID))) {
        return false;
    }

    return requiredStoredStateKeys.every((key) => (
        Object.prototype.hasOwnProperty.call(state.sound.storedState, key)
        && state.sound.storedState[key] !== undefined
    ));
}

/** Decode v4 storage; the installer validates live completeness before use. */
export function readBrowserPatchState({
    storage,
    storageKey = BROWSER_PATCH_STATE_KEY,
} = {}) {
    try {
        const serializedState = resolveStorage(storage)?.getItem(storageKey);
        if (serializedState === null || serializedState === undefined) return null;
        return parseBrowserPatchState(JSON.parse(serializedState));
    } catch {
        return null;
    }
}

/**
 * Restores public parameters first, then structured state, and keeps the same
 * two public ports durable. The previous flat v1 sound bag is intentionally
 * ignored: this is the hard-cut state contract.
 */
export function installBrowserPatchStatePersistence(connection, {
    storage,
    storageKey = BROWSER_PATCH_STATE_KEY,
    deferParameterRestore = () => false,
    requiredStoredStateKeys = REQUIRED_SOUND_STORED_STATE_KEYS,
} = {}) {
    const activeStorage = resolveStorage(storage);
    const parameterEndpointIDs = new Set((connection.inputEndpoints ?? []).flatMap((endpoint) => (
        endpoint?.purpose === "parameter" && typeof endpoint.endpointID === "string"
            && !(isRecord(endpoint.annotation) && endpoint.annotation.hidden === true)
            ? [endpoint.endpointID]
            : []
    )));
    const savedBrowserState = readBrowserPatchState({ storage: activeStorage, storageKey });
    const hasAcceptedSavedSound = isCompleteSoundSnapshot(
        savedBrowserState,
        parameterEndpointIDs,
        requiredStoredStateKeys,
    );
    let browserState = hasAcceptedSavedSound ? savedBrowserState : emptyBrowserPatchState();
    let acceptedBrowserState = browserState;
    let lastAttemptedSerializedState = hasAcceptedSavedSound
        ? JSON.stringify(browserState)
        : null;
    let hasCapturedFullStoredState = hasAcceptedSavedSound;
    const deferredParameters = {};
    const deferredParameterEndpointIDs = new Set();
    const runtimeOnlyParameterEchoes = new Map();

    const persistState = (nextState) => {
        browserState = nextState;
        if (!isCompleteSoundSnapshot(
            browserState,
            parameterEndpointIDs,
            requiredStoredStateKeys,
        ) || !hasCapturedFullStoredState) {
            return;
        }

        let serializedState;
        try {
            serializedState = JSON.stringify(browserState);
        } catch {
            return;
        }

        acceptedBrowserState = browserState;
        if (serializedState === lastAttemptedSerializedState) return;
        lastAttemptedSerializedState = serializedState;

        try {
            activeStorage?.setItem(storageKey, serializedState);
        } catch {
            // Runtime state remains authoritative when persistence is blocked.
        }
    };

    const persistParameter = (endpointID, value, { explicitWrite = false } = {}) => {
        const suppressed = runtimeOnlyParameterEchoes.get(endpointID) ?? [];
        const now = Date.now();
        const matchIndex = suppressed.findIndex((entry) => entry.value === value && entry.expiresAt >= now);
        if (matchIndex !== -1) {
            suppressed.splice(matchIndex, 1);
            if (suppressed.length === 0) runtimeOnlyParameterEchoes.delete(endpointID);
            return;
        }
        const liveSuppressed = suppressed.filter((entry) => entry.expiresAt >= now);
        if (liveSuppressed.length > 0) runtimeOnlyParameterEchoes.set(endpointID, liveSuppressed);
        else runtimeOnlyParameterEchoes.delete(endpointID);
        if (deferredParameterEndpointIDs.has(endpointID)) {
            if (!explicitWrite) return;
            deferredParameterEndpointIDs.delete(endpointID);
        }
        if (!parameterEndpointIDs.has(endpointID)
            || typeof value !== "number"
            || !Number.isFinite(value)
            || browserState.sound.parameters[endpointID] === value) {
            return;
        }

        persistState({
            ...browserState,
            sound: {
                ...browserState.sound,
                parameters: { ...browserState.sound.parameters, [endpointID]: value },
            },
        });
    };

    const persistStoredValue = (key, value) => {
        if (key === "effects.presets.v2") {
            const auxiliary = { ...browserState.auxiliary };
            if (value === undefined) delete auxiliary[key];
            else auxiliary[key] = value;
            persistState({ ...browserState, auxiliary });
            return;
        }

        const storedState = { ...browserState.sound.storedState };
        if (value === undefined) delete storedState[key];
        else storedState[key] = value;
        persistState({
            ...browserState,
            sound: { ...browserState.sound, storedState },
        });
    };

    const sendEventOrValue = connection.sendEventOrValue?.bind(connection);
    const sendStoredStateValue = connection.sendStoredStateValue.bind(connection);

    for (const endpoint of hasAcceptedSavedSound ? connection.inputEndpoints ?? [] : []) {
        if (endpoint?.purpose !== "parameter" || typeof endpoint.endpointID !== "string") continue;
        if (Object.prototype.hasOwnProperty.call(browserState.sound.parameters, endpoint.endpointID)) {
            const value = browserState.sound.parameters[endpoint.endpointID];
            if (deferParameterRestore(endpoint.endpointID, value, browserState)) {
                deferredParameters[endpoint.endpointID] = value;
                deferredParameterEndpointIDs.add(endpoint.endpointID);
            } else {
                sendEventOrValue?.(endpoint.endpointID, value);
            }
        }
    }
    for (const [key, value] of Object.entries(
        hasAcceptedSavedSound ? browserState.sound.storedState : {},
    )) {
        sendStoredStateValue(key, value);
    }
    for (const [key, value] of Object.entries(hasAcceptedSavedSound ? browserState.auxiliary : {})) {
        sendStoredStateValue(key, value);
    }

    if (sendEventOrValue) {
        connection.sendEventOrValue = (endpointID, value, ...rest) => {
            const result = sendEventOrValue(endpointID, value, ...rest);
            persistParameter(endpointID, value, { explicitWrite: true });
            return result;
        };
    }
    connection.sendStoredStateValue = (key, value) => {
        const result = sendStoredStateValue(key, value);
        persistStoredValue(key, value);
        return result;
    };

    connection.addStoredStateValueListener?.((message) => {
        const storedStateMessage = message?.event ?? message;
        if (typeof storedStateMessage?.key === "string") {
            persistStoredValue(storedStateMessage.key, storedStateMessage.value);
        }
    });

    connection.requestFullStoredState?.((fullStoredState) => {
        if (!isRecord(fullStoredState)) return;

        const storedState = {};
        const auxiliary = { ...browserState.auxiliary };
        for (const [key, value] of Object.entries(fullStoredState)) {
            if (key === "effects.presets.v2") {
                if (value === undefined) delete auxiliary[key];
                else auxiliary[key] = value;
                continue;
            }
            if (value !== undefined) storedState[key] = value;
        }
        hasCapturedFullStoredState = true;
        persistState({
            ...browserState,
            sound: { ...browserState.sound, storedState },
            auxiliary,
        });
    });

    for (const endpointID of parameterEndpointIDs) {
        connection.addParameterListener?.(endpointID, (value) => persistParameter(endpointID, value));
        // A deferred sampled source intentionally leaves the engine at its
        // safe oscillator default until OPFS restore commits. Reading that
        // temporary default must not overwrite the durable sampled intent.
        if (!Object.hasOwn(deferredParameters, endpointID)) {
            connection.requestParameterValue?.(endpointID);
        }
    }

    return Object.freeze({
        get browserState() {
            return acceptedBrowserState;
        },
        deferredParameters: Object.freeze({ ...deferredParameters }),
        sendRuntimeEventOrValue(endpointID, value, ...rest) {
            if (parameterEndpointIDs.has(endpointID)) {
                const queue = runtimeOnlyParameterEchoes.get(endpointID) ?? [];
                queue.push({ value, expiresAt: Date.now() + 5_000 });
                runtimeOnlyParameterEchoes.set(endpointID, queue);
            }
            return sendEventOrValue?.(endpointID, value, ...rest);
        },
    });
}
