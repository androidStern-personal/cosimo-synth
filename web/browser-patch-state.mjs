export const BROWSER_PATCH_STATE_KEY = "cosimo.web.patch-state.v2";

const BROWSER_PATCH_STATE_FORMAT = "cosimo.browserPatchState";
const BROWSER_PATCH_STATE_VERSION = 2;

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
        return emptyBrowserPatchState();
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

/** Read the browser's exact public-parameter and structured-state snapshot. */
export function readBrowserPatchState({
    storage,
    storageKey = BROWSER_PATCH_STATE_KEY,
} = {}) {
    try {
        return parseBrowserPatchState(JSON.parse(resolveStorage(storage)?.getItem(storageKey) ?? "{}"));
    } catch {
        return emptyBrowserPatchState();
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
} = {}) {
    const activeStorage = resolveStorage(storage);
    let browserState = readBrowserPatchState({ storage: activeStorage, storageKey });
    let lastAttemptedSerializedState = JSON.stringify(browserState);
    const parameterEndpointIDs = new Set((connection.inputEndpoints ?? []).flatMap((endpoint) => (
        endpoint?.purpose === "parameter" && typeof endpoint.endpointID === "string"
            ? [endpoint.endpointID]
            : []
    )));
    const deferredParameters = {};
    const deferredParameterEndpointIDs = new Set();
    const runtimeOnlyParameterEchoes = new Map();

    const persistState = (nextState) => {
        let serializedState;
        try {
            serializedState = JSON.stringify(nextState);
        } catch {
            return;
        }

        browserState = nextState;
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

    for (const endpoint of connection.inputEndpoints ?? []) {
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
    for (const [key, value] of Object.entries(browserState.sound.storedState)) {
        sendStoredStateValue(key, value);
    }
    for (const [key, value] of Object.entries(browserState.auxiliary)) {
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
        browserState,
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
