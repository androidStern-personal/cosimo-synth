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

/**
 * Read every host parameter at the press and pair them with the plugin's
 * current stored documents, as one immutable patch document.
 */
export async function captureLiveBouncePatchDocument(connection, {
    storedState,
    parameterIDs = null,
    timeoutMilliseconds = BOUNCE_PATCH_IO_TIMEOUT_MS,
}) {
    for (const key of BOUNCE_PATCH_STORED_STATE_KEYS) {
        if (!Object.hasOwn(storedState, key)) throw new Error(`The current sound is missing ${key}`);
    }
    const resolvedParameterIDs = parameterIDs
        ? [...new Set(parameterIDs)].sort()
        : await requestParameterIDs(connection, timeoutMilliseconds);
    const parameters = await requestParameterValues(connection, resolvedParameterIDs, timeoutMilliseconds);
    return createBouncePatchDocument({ parameters, storedState });
}

/**
 * The plugin-state edit that makes a patch document the current sound: every
 * declared parameter the document holds, and every declared stored field it
 * holds, parsed by that field's codec.
 */
export function bouncePatchDocumentChanges(definition, documentInput) {
    const document = parseBouncePatchDocument(documentInput);
    const changes = {};
    for (const [key, field] of Object.entries(definition)) {
        if (field.kind === "parameter") {
            if (Object.hasOwn(document.parameters, field.endpoint)) changes[key] = document.parameters[field.endpoint];
            continue;
        }
        if (!Object.hasOwn(document.storedState, key)) continue;
        const parsed = field.codec.parse(document.storedState[key]);
        if (parsed.kind === "error") throw new Error(`The bounced sound's ${key} cannot be loaded: ${parsed.message}`);
        changes[key] = parsed.value;
    }
    return changes;
}
