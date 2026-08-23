import {
    BOUNCE_STATE_KEY,
    parseBounceDocument,
    parseBouncePatchDocument,
    readBounceDocumentFromPatch,
} from "./document.mjs";

export const BOUNCE_BANK_GC_LOCK_NAME = "cosimo-bounce-bank-gc-v1";

const EFFECT_PRESET_STATE_KIND = "cosimo.effectPresetState";
const EFFECT_PRESET_STATE_VERSION = 2;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJson(value, label) {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch (cause) {
        throw new Error(`${label} is not valid JSON: ${cause instanceof Error ? cause.message : cause}`);
    }
}

function addBounceDocumentRoots(documentInput, digests) {
    const document = parseBounceDocument(documentInput);
    digests.add(document.digest);
    if (document.revertRef.bankDigest !== null) {
        digests.add(document.revertRef.bankDigest);
    }
}

function addPatchDocumentRoots(documentInput, digests) {
    const patchDocument = parseBouncePatchDocument(documentInput);
    const document = readBounceDocumentFromPatch(patchDocument);
    if (document !== null) addBounceDocumentRoots(document, digests);
}

function scanUserPresetState(rawValue, digests) {
    if (rawValue === null || rawValue === undefined || rawValue === "") return;
    const state = parseJson(rawValue, "effects.presets.v2");
    if (!isRecord(state)
        || state.kind !== EFFECT_PRESET_STATE_KIND
        || state.version !== EFFECT_PRESET_STATE_VERSION
        || !isRecord(state.userPresets)) {
        throw new Error("effects.presets.v2 has an unrecognized schema");
    }
    for (const [effectID, presets] of Object.entries(state.userPresets)) {
        if (!Array.isArray(presets)) {
            throw new Error(`effects.presets.v2 bank ${effectID} is not an array`);
        }
        for (const [index, preset] of presets.entries()) {
            if (!isRecord(preset) || !isRecord(preset.storedState)) {
                throw new Error(`effects.presets.v2 ${effectID}[${index}] is malformed`);
            }
            const bounceValue = preset.storedState[BOUNCE_STATE_KEY];
            if (bounceValue !== null && bounceValue !== undefined && bounceValue !== "") {
                addBounceDocumentRoots(bounceValue, digests);
            }
        }
    }
}

/**
 * Compute the complete browser retention root set. Only the live document's
 * direct Revert bank is retained: nested historical snapshots are beyond the
 * locked single-level contract and become eligible after their DSP slot is
 * overwritten. User presets retain both their audible bank and direct Revert
 * bank so a loaded preset preserves the same one-level behavior.
 */
export function collectBounceBankRetentionRoots({
    livePatchDocument,
    userPresetState = null,
    userPresetStateKnown = true,
    inFlightPatchDocuments = [],
    hasExternalPresetFileStore = false,
} = {}) {
    const digests = new Set();
    const incompleteReasons = [];
    try {
        addPatchDocumentRoots(livePatchDocument, digests);
    } catch (cause) {
        incompleteReasons.push(`live-patch: ${cause instanceof Error ? cause.message : cause}`);
    }
    if (!userPresetStateKnown) {
        incompleteReasons.push("user-preset-state-not-yet-scanned");
    } else {
        try {
            scanUserPresetState(userPresetState, digests);
        } catch (cause) {
            incompleteReasons.push(`user-presets: ${cause instanceof Error ? cause.message : cause}`);
        }
    }
    if (hasExternalPresetFileStore) {
        // Native preset files require a platform store scan in M8. Browser GC
        // never guesses while an unscanned file-backed catalog is present.
        incompleteReasons.push("external-user-preset-files-not-scanned");
    }
    if (!Array.isArray(inFlightPatchDocuments)) {
        incompleteReasons.push("in-flight-state-save-index-is-invalid");
    } else {
        for (const [index, document] of inFlightPatchDocuments.entries()) {
            try {
                addPatchDocumentRoots(document, digests);
            } catch (cause) {
                incompleteReasons.push(
                    `in-flight-state-save-${index}: ${cause instanceof Error ? cause.message : cause}`,
                );
            }
        }
    }
    return Object.freeze({
        complete: incompleteReasons.length === 0,
        digests: Object.freeze([...digests].sort()),
        incompleteReasons: Object.freeze(incompleteReasons),
    });
}

function normalizeDigestSet(values, label) {
    if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
    const result = new Set();
    for (const value of values) {
        if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
            throw new TypeError(`${label} contains an invalid digest`);
        }
        result.add(value);
    }
    return result;
}

function validateStoreEntries(entries) {
    if (!Array.isArray(entries)) throw new Error("Bounce bank store index is not an array");
    for (const entry of entries) {
        if (!isRecord(entry)
            || typeof entry.digest !== "string"
            || !SHA256_PATTERN.test(entry.digest)
            || !Number.isInteger(entry.byteLength)
            || entry.byteLength <= 0) {
            throw new Error("Bounce bank store index contains an unrecognized entry");
        }
    }
    return entries;
}

function skippedResult(reason, roots, before = null) {
    return Object.freeze({
        completed: false,
        reason,
        retainedDigests: roots?.digests ?? Object.freeze([]),
        deletedDigests: Object.freeze([]),
        before,
        after: before,
    });
}

/**
 * Delete only explicitly superseded banks whose former inactive DSP slot was
 * overwritten by the just-committed install. Unknown schema/index/lock state
 * is a conservative retain, never a best-effort unlink.
 */
export async function retireSupersededBounceBanks({
    store,
    candidateDigests = [],
    dspOverwrittenDigests = [],
    lockManager = globalThis.navigator?.locks,
    ...retentionInputs
} = {}) {
    if (!store || typeof store.list !== "function"
        || typeof store.delete !== "function" || typeof store.usage !== "function") {
        throw new TypeError("Bounce bank retirement requires list/delete/usage store methods");
    }
    const candidates = normalizeDigestSet(candidateDigests, "candidateDigests");
    const overwritten = normalizeDigestSet(dspOverwrittenDigests, "dspOverwrittenDigests");
    const roots = collectBounceBankRetentionRoots(retentionInputs);
    if (!roots.complete) {
        return skippedResult(`incomplete-scan: ${roots.incompleteReasons.join("; ")}`, roots);
    }
    if (!lockManager || typeof lockManager.request !== "function") {
        return skippedResult("gc-lock-unavailable", roots);
    }

    let result = null;
    try {
        await lockManager.request(
            BOUNCE_BANK_GC_LOCK_NAME,
            { mode: "exclusive", ifAvailable: true },
            async (lock) => {
                if (lock === null) return;
                const before = await store.usage();
                const entries = validateStoreEntries(await store.list());
                const present = new Set(entries.map((entry) => entry.digest));
                const reachable = new Set(roots.digests);
                const deletedDigests = [];
                for (const digest of [...candidates].sort()) {
                    if (!overwritten.has(digest) || reachable.has(digest) || !present.has(digest)) {
                        continue;
                    }
                    if (await store.delete(digest)) deletedDigests.push(digest);
                }
                const after = await store.usage();
                result = Object.freeze({
                    completed: true,
                    reason: null,
                    retainedDigests: roots.digests,
                    deletedDigests: Object.freeze(deletedDigests),
                    before,
                    after,
                });
            },
        );
    } catch (cause) {
        return skippedResult(
            `gc-failed: ${cause instanceof Error ? cause.message : cause}`,
            roots,
        );
    }
    return result ?? skippedResult("gc-lock-busy", roots);
}

export const bounceBankRetentionInternals = Object.freeze({
    addBounceDocumentRoots,
    scanUserPresetState,
    validateStoreEntries,
});
