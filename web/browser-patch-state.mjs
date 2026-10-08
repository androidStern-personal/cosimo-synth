export const BROWSER_PATCH_STATE_KEY = "cosimo.web.patch-state.v2";

const BROWSER_PATCH_STATE_FORMAT = "cosimo.browserPatchState";
// A saved state of any other version is discarded whole.
const BROWSER_PATCH_STATE_VERSION = 5;

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
    };
}

function parseBrowserPatchState(value) {
    if (!isRecord(value)
        || value.format !== BROWSER_PATCH_STATE_FORMAT
        || value.version !== BROWSER_PATCH_STATE_VERSION
        || !isRecord(value.sound)
        || !isRecord(value.sound.parameters)
        || !isRecord(value.sound.storedState)) {
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
    };
}

/**
 * A sound is complete when it holds every visible parameter. Its stored state needs no
 * particular key: the synth stores a field only once it is edited, so a missing key is
 * a field still at its default.
 */
function isCompleteSoundSnapshot(state, parameterEndpointIDs) {
    if (state === null || parameterEndpointIDs.size === 0) return false;

    const savedParameterEndpointIDs = Object.keys(state.sound.parameters);
    return savedParameterEndpointIDs.length === parameterEndpointIDs.size
        && savedParameterEndpointIDs.every((endpointID) => parameterEndpointIDs.has(endpointID));
}

/** Decode v5 storage; the installer validates live completeness before use. */
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
 * Restores the saved sound, parameters first and then stored state, and saves
 * every later parameter and stored-state write once the engine has reported every
 * parameter and its whole stored state. A saved parameter that deferParameterRestore
 * holds back reaches the engine only through applyDeferredParameter.
 */
export function installBrowserPatchStatePersistence(connection, {
    storage,
    storageKey = BROWSER_PATCH_STATE_KEY,
    deferParameterRestore = () => false,
} = {}) {
    const activeStorage = resolveStorage(storage);
    const parameterEndpointIDs = new Set((connection.inputEndpoints ?? []).flatMap((endpoint) => (
        endpoint?.purpose === "parameter" && typeof endpoint.endpointID === "string"
            && !(isRecord(endpoint.annotation) && endpoint.annotation.hidden === true)
            ? [endpoint.endpointID]
            : []
    )));
    const savedBrowserState = readBrowserPatchState({ storage: activeStorage, storageKey });
    const hasAcceptedSavedSound = isCompleteSoundSnapshot(savedBrowserState, parameterEndpointIDs);
    let browserState = hasAcceptedSavedSound ? savedBrowserState : emptyBrowserPatchState();
    let acceptedBrowserState = browserState;
    let lastAttemptedSerializedState = hasAcceptedSavedSound
        ? JSON.stringify(browserState)
        : null;
    let hasCapturedFullStoredState = hasAcceptedSavedSound;
    const deferredParameters = new Map();

    const persistState = (nextState) => {
        browserState = nextState;
        if (!hasCapturedFullStoredState || !isCompleteSoundSnapshot(browserState, parameterEndpointIDs)) return;

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
        if (deferredParameters.has(endpointID)) {
            // While a saved value is held back, the engine reports its default, which is
            // not the saved sound. Only a deliberate write replaces the held value.
            if (!explicitWrite) return;
            deferredParameters.delete(endpointID);
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
                deferredParameters.set(endpoint.endpointID, value);
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
        if (typeof message?.key === "string") persistStoredValue(message.key, message.value);
    });

    // Cmajor replies with { parameters: [...], values: {...} }; the stored state is
    // in values, and the parameters are captured through their own listeners below.
    connection.requestFullStoredState?.((fullState) => {
        if (!isRecord(fullState?.values)) return;

        const storedState = {};
        for (const [key, value] of Object.entries(fullState.values)) {
            if (value !== undefined) storedState[key] = value;
        }
        hasCapturedFullStoredState = true;
        persistState({
            ...browserState,
            sound: { ...browserState.sound, storedState },
        });
    });

    for (const endpointID of parameterEndpointIDs) {
        connection.addParameterListener?.(endpointID, (value) => persistParameter(endpointID, value));
        // A held-back endpoint is not read: the engine would answer with its default.
        if (!deferredParameters.has(endpointID)) {
            connection.requestParameterValue?.(endpointID);
        }
    }

    return Object.freeze({
        get browserState() {
            return acceptedBrowserState;
        },
        /** Sends the saved value held back for this endpoint, once; does nothing when none is held. */
        applyDeferredParameter(endpointID) {
            if (!deferredParameters.has(endpointID)) return;
            const value = deferredParameters.get(endpointID);
            deferredParameters.delete(endpointID);
            sendEventOrValue?.(endpointID, value);
        },
    });
}
