import {
    ARTICULATIONS_STATE_KEY,
    BOUNCE_STATE_KEY,
    LANE_STATE_KEY,
    MODULATION_STATE_KEY,
    createBouncePatchDocument,
    parseBouncePatchDocument,
} from "./document.mjs";

export const BOUNCE_PATCH_STORED_STATE_KEYS = Object.freeze([
    MODULATION_STATE_KEY,
    ARTICULATIONS_STATE_KEY,
    LANE_STATE_KEY,
    BOUNCE_STATE_KEY,
]);
export const BOUNCE_PATCH_IO_TIMEOUT_MS = 8_000;

function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fullStoredStateValues(value) {
    if (!isRecord(value)) return {};
    return isRecord(value.values) ? value.values : value;
}

function withTimeout(executor, timeoutMilliseconds, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMilliseconds);
        const finish = (callback) => (value) => {
            clearTimeout(timer);
            callback(value);
        };
        try {
            executor(finish(resolve), finish(reject));
        } catch (cause) {
            clearTimeout(timer);
            reject(cause);
        }
    });
}

export function parameterIDsFromPatchStatus(status) {
    const inputs = isRecord(status) && isRecord(status.details) && Array.isArray(status.details.inputs)
        ? status.details.inputs
        : null;
    if (inputs === null) throw new Error("Cmajor status details.inputs are unavailable");
    const endpointIDs = inputs.filter((endpoint) => (
        isRecord(endpoint) && endpoint.purpose === "parameter" && typeof endpoint.endpointID === "string"
    )).map((endpoint) => endpoint.endpointID);
    if (!endpointIDs.includes("sourceMode") || !endpointIDs.includes("filterMode")) {
        throw new Error("Cmajor status is missing Bounce parameters");
    }
    return [...new Set(endpointIDs)].sort();
}

async function requestParameterIDs(connection, timeoutMilliseconds) {
    if (typeof connection.addStatusListener !== "function"
        || typeof connection.removeStatusListener !== "function"
        || typeof connection.requestStatusUpdate !== "function") {
        throw new Error("Patch status reads are unavailable");
    }
    return withTimeout((resolve) => {
        const listener = (status) => {
            connection.removeStatusListener(listener);
            resolve(parameterIDsFromPatchStatus(status));
        };
        connection.addStatusListener(listener);
        connection.requestStatusUpdate();
    }, timeoutMilliseconds, "Bounce patch status");
}

async function requestParameterValues(connection, endpointIDs, timeoutMilliseconds) {
    if (typeof connection.addParameterListener !== "function"
        || typeof connection.removeParameterListener !== "function"
        || typeof connection.requestParameterValue !== "function") {
        throw new Error("Patch parameter reads are unavailable");
    }
    return withTimeout((resolve, reject) => {
        const values = {};
        const listeners = new Map();
        const cleanup = () => {
            for (const [endpointID, listener] of listeners) {
                connection.removeParameterListener(endpointID, listener);
            }
        };
        for (const endpointID of endpointIDs) {
            const listener = (value) => {
                if (typeof value !== "number" || !Number.isFinite(value)) {
                    cleanup();
                    reject(new Error(`Patch parameter ${endpointID} returned a non-finite value`));
                    return;
                }
                values[endpointID] = value;
                if (Object.keys(values).length === endpointIDs.length) {
                    cleanup();
                    resolve(values);
                }
            };
            listeners.set(endpointID, listener);
            connection.addParameterListener(endpointID, listener);
        }
        for (const endpointID of endpointIDs) connection.requestParameterValue(endpointID);
    }, timeoutMilliseconds, "Bounce patch parameters");
}

async function requestStoredState(
    connection,
    storedStateKeys,
    timeoutMilliseconds,
    storedStateDefaults,
) {
    if (typeof connection.requestFullStoredState !== "function") {
        throw new Error("Full patch stored-state reads are unavailable");
    }
    return withTimeout((resolve, reject) => {
        connection.requestFullStoredState((state) => {
            try {
                const values = fullStoredStateValues(state);
                const selected = {};
                for (const key of storedStateKeys) {
                    selected[key] = Object.hasOwn(values, key)
                        ? values[key]
                        : (Object.hasOwn(storedStateDefaults, key)
                            ? storedStateDefaults[key]
                            : (key === BOUNCE_STATE_KEY ? null : undefined));
                    if (selected[key] === undefined) {
                        throw new Error(`Patch stored state is missing ${key}`);
                    }
                }
                resolve(selected);
            } catch (cause) {
                reject(cause);
            }
        });
    }, timeoutMilliseconds, "Bounce patch stored state");
}

/** Read every host parameter and structured document at one logical press time. */
export async function captureLiveBouncePatchDocument(connection, {
    parameterIDs = null,
    storedStateKeys = BOUNCE_PATCH_STORED_STATE_KEYS,
    storedStateDefaults = {},
    timeoutMilliseconds = BOUNCE_PATCH_IO_TIMEOUT_MS,
} = {}) {
    const resolvedParameterIDs = parameterIDs
        ? [...new Set(parameterIDs)].sort()
        : await requestParameterIDs(connection, timeoutMilliseconds);
    // Listeners are attached before requests; Promise.all makes the two state
    // domains part of one immutable logical snapshot even though the host APIs
    // answer asynchronously.
    const [parameters, storedState] = await Promise.all([
        requestParameterValues(connection, resolvedParameterIDs, timeoutMilliseconds),
        requestStoredState(
            connection,
            storedStateKeys,
            timeoutMilliseconds,
            storedStateDefaults,
        ),
    ]);
    return createBouncePatchDocument({ parameters, storedState });
}

/** Queue a whole document; Source Mode is last so its selected source is ready. */
export function applyLiveBouncePatchDocument(connection, documentInput) {
    const document = parseBouncePatchDocument(documentInput);
    if (typeof connection.sendEventOrValue !== "function"
        || typeof connection.sendStoredStateValue !== "function") {
        throw new Error("Patch document writes are unavailable");
    }
    for (const [endpointID, value] of Object.entries(document.parameters)) {
        if (endpointID !== "sourceMode") {
            connection.sendEventOrValue(endpointID, value, 0, 0);
        }
    }
    for (const [key, value] of Object.entries(document.storedState)) {
        connection.sendStoredStateValue(key, value);
    }
    connection.sendEventOrValue("sourceMode", document.parameters.sourceMode, 0, 0);
}

export const bouncePatchDocumentAdapterInternals = Object.freeze({
    fullStoredStateValues,
});
