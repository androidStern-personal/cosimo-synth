import assert from "node:assert/strict";
import test from "node:test";

import {
    collectBounceBankRetentionRoots,
    retireSupersededBounceBanks,
} from "../bounce/bank-retention.mjs";
import {
    BOUNCE_STATE_KEY,
    createBouncePatchDocument,
    parseBounceDocument,
    serializeBounceDocument,
} from "../bounce/document.mjs";

const digest = (digit) => digit.repeat(64);

function patchWithBounce(document = null) {
    return createBouncePatchDocument({
        parameters: { filterMode: 0, sourceMode: document === null ? 0 : 1 },
        storedState: {
            [BOUNCE_STATE_KEY]: document === null ? null : serializeBounceDocument(document),
        },
    });
}

function bounceDocument({ currentDigest, generation, previousDigest = null, previousPatch }) {
    return parseBounceDocument({
        format: "cosimo.bounce",
        version: 1,
        digest: currentDigest,
        bankByteLength: 1_024,
        roots: [60],
        segments: [{
            rootNote: 60,
            frameOffset: 0,
            frameCount: 200,
            noteOffFrameOffset: 100,
        }],
        capture: {
            sampleRate: 48_000,
            tempoBpm: 120,
            velocity: 100,
            holdFrames: 100,
            tailCapFrames: 100,
        },
        generation,
        revertRef: {
            bankDigest: previousDigest,
            patchDocument: previousPatch,
        },
    });
}

function generations() {
    const oscillator = patchWithBounce();
    const first = bounceDocument({
        currentDigest: digest("1"),
        generation: 1,
        previousPatch: oscillator,
    });
    const firstPatch = patchWithBounce(first);
    const second = bounceDocument({
        currentDigest: digest("2"),
        generation: 2,
        previousDigest: digest("1"),
        previousPatch: firstPatch,
    });
    const secondPatch = patchWithBounce(second);
    const third = bounceDocument({
        currentDigest: digest("3"),
        generation: 3,
        previousDigest: digest("2"),
        previousPatch: secondPatch,
    });
    return { first, firstPatch, second, secondPatch, third, thirdPatch: patchWithBounce(third) };
}

class MemoryStore {
    constructor(digests) {
        this.values = new Map(digests.map((value) => [value, 1_024]));
    }
    async list() {
        return [...this.values].map(([entryDigest, byteLength]) => ({
            digest: entryDigest,
            byteLength,
        }));
    }
    async delete(entryDigest) { return this.values.delete(entryDigest); }
    async usage() {
        return {
            backend: "memory",
            bankCount: this.values.size,
            bankBytes: [...this.values.values()].reduce((sum, value) => sum + value, 0),
            originUsage: null,
            originQuota: null,
        };
    }
}

const acquiredLockManager = {
    request: async (_name, _options, callback) => callback({ name: "test-lock" }),
};

test("retention keeps only the live and direct single-level Revert roots", () => {
    const { thirdPatch } = generations();
    const roots = collectBounceBankRetentionRoots({
        livePatchDocument: thirdPatch,
        userPresetState: null,
    });
    assert.equal(roots.complete, true);
    assert.deepEqual(roots.digests, [digest("2"), digest("3")]);
    assert.equal(roots.digests.includes(digest("1")), false,
        "the nested generation-1 snapshot is beyond single-level Revert");
});

test("retirement deletes only unreachable candidates whose inactive DSP slot was overwritten", async () => {
    const { thirdPatch } = generations();
    const store = new MemoryStore([digest("1"), digest("2"), digest("3"), digest("4")]);
    const result = await retireSupersededBounceBanks({
        store,
        candidateDigests: [digest("1"), digest("4")],
        dspOverwrittenDigests: [digest("1")],
        livePatchDocument: thirdPatch,
        userPresetState: null,
        lockManager: acquiredLockManager,
    });
    assert.equal(result.completed, true);
    assert.deepEqual(result.deletedDigests, [digest("1")]);
    assert.equal(result.before.bankCount, 4);
    assert.equal(result.after.bankCount, 3);
    assert.deepEqual([...store.values.keys()].sort(), [digest("2"), digest("3"), digest("4")]);
});

test("user presets and in-flight state saves are retention roots", async () => {
    const { first, firstPatch, thirdPatch } = generations();
    const userPresetState = JSON.stringify({
        kind: "cosimo.effectPresetState",
        version: 2,
        userPresets: {
            synth: [{ storedState: { [BOUNCE_STATE_KEY]: serializeBounceDocument(first) } }],
        },
        activePresetByEffect: {},
    });
    const store = new MemoryStore([digest("1"), digest("2"), digest("3")]);
    const result = await retireSupersededBounceBanks({
        store,
        candidateDigests: [digest("1")],
        dspOverwrittenDigests: [digest("1")],
        livePatchDocument: thirdPatch,
        userPresetState,
        inFlightPatchDocuments: [firstPatch],
        lockManager: acquiredLockManager,
    });
    assert.equal(result.completed, true);
    assert.deepEqual(result.deletedDigests, []);
    assert.ok(result.retainedDigests.includes(digest("1")));
});

test("unrecognized preset state, external files, bad store indexes, and lock contention retain", async () => {
    const { thirdPatch } = generations();
    for (const options of [
        { userPresetState: { kind: "future", version: 99 } },
        { userPresetState: null, hasExternalPresetFileStore: true },
    ]) {
        const store = new MemoryStore([digest("1"), digest("2"), digest("3")]);
        const result = await retireSupersededBounceBanks({
            store,
            candidateDigests: [digest("1")],
            dspOverwrittenDigests: [digest("1")],
            livePatchDocument: thirdPatch,
            lockManager: acquiredLockManager,
            ...options,
        });
        assert.equal(result.completed, false);
        assert.equal(store.values.has(digest("1")), true);
    }

    const malformedStore = new MemoryStore([digest("1")]);
    malformedStore.list = async () => [{ digest: "future-index-entry", byteLength: 1 }];
    const malformed = await retireSupersededBounceBanks({
        store: malformedStore,
        candidateDigests: [digest("1")],
        dspOverwrittenDigests: [digest("1")],
        livePatchDocument: thirdPatch,
        lockManager: acquiredLockManager,
    });
    assert.equal(malformed.completed, false);
    assert.equal(malformedStore.values.has(digest("1")), true);

    const busyStore = new MemoryStore([digest("1")]);
    const busy = await retireSupersededBounceBanks({
        store: busyStore,
        candidateDigests: [digest("1")],
        dspOverwrittenDigests: [digest("1")],
        livePatchDocument: thirdPatch,
        lockManager: { request: async (_name, _options, callback) => callback(null) },
    });
    assert.equal(busy.reason, "gc-lock-busy");
    assert.equal(busyStore.values.has(digest("1")), true);
});
