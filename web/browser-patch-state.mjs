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
} = {}) {
    const activeStorage = resolveStorage(storage);
    let browserState = readBrowserPatchState({ storage: activeStorage, storageKey });
    let lastAttemptedSerializedState = JSON.stringify(browserState);
    const parameterEndpointIDs = new Set((connection.inputEndpoints ?? []).flatMap((endpoint) => (
        endpoint?.purpose === "parameter" && typeof endpoint.endpointID === "string"
            ? [endpoint.endpointID]
            : []
    )));

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

    const persistParameter = (endpointID, value) => {
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
            sendEventOrValue?.(endpoint.endpointID, browserState.sound.parameters[endpoint.endpointID]);
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
            persistParameter(endpointID, value);
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
        connection.requestParameterValue?.(endpointID);
    }
}
