export const SEQFX_STATE_UPDATE_INTENT_KEY = "seqfx.runtimeUpdateIntent.v1";

type SeqFxStateUpdateIntent = {
    readonly version: 1;
    readonly stateToken: string;
    readonly authoritative: boolean;
};

function tokenSource(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }

    try {
        return JSON.stringify(value) ?? "undefined";
    } catch {
        return String(value);
    }
}

function hash32(value: string, seed: number): string {
    let hash = seed >>> 0;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
}

/**
 * Matches a transient editor intent to the stored-state document that follows it.
 * The bridge clears this transport-only key immediately after the state write; a
 * missing, delayed, or stale intent therefore cannot downgrade a host recall.
 */
export function seqFxStoredStateToken(value: unknown): string {
    const source = tokenSource(value);
    return `${source.length}:${hash32(source, 0x811c9dc5)}:${hash32(source, 0x9e3779b9)}`;
}

export function serializeSeqFxStateUpdateIntent(value: unknown, authoritative: boolean): string {
    const intent: SeqFxStateUpdateIntent = {
        version: 1,
        stateToken: seqFxStoredStateToken(value),
        authoritative,
    };
    return JSON.stringify(intent);
}

export function parseSeqFxStateUpdateIntent(value: unknown): SeqFxStateUpdateIntent | null {
    let candidate = value;
    if (typeof value === "string") {
        try {
            candidate = JSON.parse(value);
        } catch {
            return null;
        }
    }

    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
        return null;
    }

    const record = candidate as Record<string, unknown>;
    if (record["version"] !== 1
        || typeof record["stateToken"] !== "string"
        || typeof record["authoritative"] !== "boolean") {
        return null;
    }

    return {
        version: 1,
        stateToken: record["stateToken"],
        authoritative: record["authoritative"],
    };
}
