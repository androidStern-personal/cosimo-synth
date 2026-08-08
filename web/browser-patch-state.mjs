export const BROWSER_PATCH_STATE_KEY = "cosimo.web.patch-state.v1";

function resolveStorage(storage) {
    if (storage !== undefined) {
        return storage;
    }

    try {
        return globalThis.localStorage;
    } catch {
        return undefined;
    }
}

function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Reads the last browser-owned patch snapshot. Browser storage is an optional
 * durability layer: unavailable, blocked, or corrupt storage behaves like an
 * empty snapshot and must never prevent the synth from starting.
 */
export function readBrowserPatchState({
    storage,
    storageKey = BROWSER_PATCH_STATE_KEY,
} = {}) {
    try {
        const parsed = JSON.parse(resolveStorage(storage)?.getItem(storageKey) ?? "{}");
        return isRecord(parsed) ? { ...parsed } : {};
    } catch {
        return {};
    }
}

/**
 * Adds browser durability around the patch connection's stored-state port.
 * Runtime delivery is authoritative; persistence failures are deliberately
 * swallowed so Safari privacy/quota policy cannot break a live control write.
 */
export function installBrowserPatchStatePersistence(connection, {
    storage,
    storageKey = BROWSER_PATCH_STATE_KEY,
} = {}) {
    const activeStorage = resolveStorage(storage);
    let browserState = readBrowserPatchState({ storage: activeStorage, storageKey });
    let lastAttemptedSerializedState;

    try {
        lastAttemptedSerializedState = JSON.stringify(browserState);
    } catch {
        lastAttemptedSerializedState = undefined;
    }

    const sendStoredStateValue = connection.sendStoredStateValue.bind(connection);
    const persistValue = (key, value) => {
        const nextState = { ...browserState };
        if (value === undefined) {
            delete nextState[key];
        } else {
            nextState[key] = value;
        }

        let serializedState;
        try {
            serializedState = JSON.stringify(nextState);
        } catch {
            return;
        }

        browserState = nextState;
        if (serializedState === lastAttemptedSerializedState) {
            return;
        }
        lastAttemptedSerializedState = serializedState;

        try {
            activeStorage?.setItem(storageKey, serializedState);
        } catch {
            // Runtime state remains authoritative when persistence is blocked.
        }
    };

    for (const [key, value] of Object.entries(browserState)) {
        sendStoredStateValue(key, value);
    }

    connection.sendStoredStateValue = (key, value) => {
        persistValue(key, value);
        sendStoredStateValue(key, value);
    };
    connection.addStoredStateValueListener?.((message) => {
        const storedStateMessage = message?.event ?? message;
        if (typeof storedStateMessage?.key === "string") {
            persistValue(storedStateMessage.key, storedStateMessage.value);
        }
    });
}
