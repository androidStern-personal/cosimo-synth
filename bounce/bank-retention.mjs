import {
    BOUNCE_STATE_KEY,
    parseBounceDocument,
    parseBouncePatchDocument,
    readBounceDocumentFromPatch,
} from "./document.mjs";

export const BOUNCE_BANK_GC_LOCK_NAME = "cosimo-bounce-bank-gc-v1";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
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

/**
 * Compute the complete browser retention root set. Only the live document's
 * direct Revert bank is retained: nested historical snapshots are beyond the
 * locked single-level contract and become eligible after their DSP slot is
 * overwritten. Presets and snapshots never hold a bounce document, so the live
 * patch and the state saves still in flight are the only roots.
 */
export function collectBounceBankRetentionRoots({
    livePatchDocument,
    inFlightPatchDocuments = [],
} = {}) {
    const digests = new Set();
    const incompleteReasons = [];
    try {
        addPatchDocumentRoots(livePatchDocument, digests);
    } catch (cause) {
        incompleteReasons.push(`live-patch: ${cause instanceof Error ? cause.message : cause}`);
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
