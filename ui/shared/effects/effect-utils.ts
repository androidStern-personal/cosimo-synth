// The small data guards shared across the effect preset, snapshot, and
// state-contract modules. Kept dependency-free so any effect module can
// import it without widening its own import graph.

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Throws `${label} must be a non-empty string.`; returns the trimmed value. */
export function requireString(value: unknown, label: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`${label} must be a non-empty string.`);
    }

    return value.trim();
}

export function errorFromUnknown(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}
