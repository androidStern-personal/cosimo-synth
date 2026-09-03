import { inspect } from "node:util";

export const redactedText = "[REDACTED]";

const rawValues = new WeakMap();
const inspectCustom = inspect.custom;

/** Wrap a sensitive string so logs, inspection, and JSON serialization cannot reveal it. */
export function redact(value) {
    if (typeof value !== "string")
        throw new TypeError("Sensitive values must be strings.");

    const wrapped = Object.create(null);
    Object.defineProperties(wrapped, {
        toJSON: { value: () => redactedText },
        toString: { value: () => redactedText },
        [Symbol.toPrimitive]: { value: () => redactedText },
        [inspectCustom]: { value: () => redactedText },
    });
    rawValues.set(wrapped, value);
    return Object.freeze(wrapped);
}

/** Reveal a sensitive string only at the external adapter that must consume it. */
export function reveal(redacted) {
    const value = rawValues.get(redacted);
    if (value === undefined)
        throw new TypeError("Expected a redacted value.");
    return value;
}

/** Convert a raw or already-redacted boundary input into a redacted value immediately. */
export function ensureRedacted(value) {
    return rawValues.has(value) ? value : redact(value);
}
