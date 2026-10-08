import assert from "node:assert/strict";
import test from "node:test";

import { buildBounceBank, encodeBounceBank } from "../bounce/bank-format.mjs";
import {
    BouncePersistenceError,
    BrowserBounceBankStore,
    OPFSBounceBankStore,
} from "../bounce/browser-bank-store.mjs";
import { digestBounceBank } from "../bounce/digest.mjs";
import {
    BOUNCE_STATE_KEY,
    createBouncePatchDocument,
    parseBounceDocument,
    serializeBounceDocument,
} from "../bounce/document.mjs";
import { BounceRuntimeRestorer } from "../bounce/runtime-restorer.mjs";


class FakeFileHandle {
    constructor(directory, name, supportsMove) {
        this.directory = directory;
        this.name = name;
        this.kind = "file";
        this.bytes = new Uint8Array();
        if (!supportsMove) this.move = undefined;
    }

    async getFile() {
        const bytes = this.bytes.slice();
        return {
            size: bytes.byteLength,
            async arrayBuffer() {
                return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            },
        };
    }

    async createWritable() {
        let candidate = new Uint8Array();
        return {
            write: async (value) => {
                candidate = value instanceof Uint8Array
                    ? value.slice()
                    : new Uint8Array(value).slice();
            },
            close: async () => {
                this.bytes = candidate;
            },
        };
    }

    async move(destination, nextName) {
        if (arguments.length < 2) throw new TypeError("Not enough arguments");
        assert.equal(destination, this.directory, "OPFS move must keep the atomic commit in the staging directory");
        this.directory.files.delete(this.name);
        this.name = nextName;
        this.directory.files.set(nextName, this);
    }
}

class FakeDirectoryHandle {
    constructor({ supportsMove = true } = {}) {
        this.files = new Map();
        this.supportsMove = supportsMove;
    }

    async getFileHandle(name, { create = false } = {}) {
        if (this.files.has(name)) return this.files.get(name);
        if (!create) throw new DOMException(`${name} is missing`, "NotFoundError");
        const handle = new FakeFileHandle(this, name, this.supportsMove);
        this.files.set(name, handle);
        return handle;
    }

    async removeEntry(name) {
        if (!this.files.delete(name)) throw new DOMException(`${name} is missing`, "NotFoundError");
    }

    async *entries() {
        yield* this.files.entries();
    }
}

function fakeStorage(options) {
    const directory = new FakeDirectoryHandle(options);
    return {
        directory,
        async getDirectory() {
            return { getDirectoryHandle: async () => directory };
        },
        async estimate() {
            return { usage: 1234, quota: 5678 };
        },
    };
}

class MemoryBankStore {
    constructor() {
        this.values = new Map();
    }

    async put(digest, bytes) {
        const created = !this.values.has(digest);
        this.values.set(digest, bytes.slice());
        return { backend: "memory", created, byteLength: bytes.byteLength };
    }

    async get(digest) { return this.values.get(digest)?.slice() ?? null; }
    async delete(digest) { return this.values.delete(digest); }
    async list() {
        return [...this.values].map(([digest, bytes]) => ({ digest, byteLength: bytes.byteLength }));
    }
    async usage() {
        const list = await this.list();
        return {
            backend: "memory",
            bankBytes: list.reduce((sum, entry) => sum + entry.byteLength, 0),
            bankCount: list.length,
            originUsage: null,
            originQuota: null,
        };
    }
}

async function bankFixture(frameCount = 64, note = 60) {
    const samples = new Int16Array(frameCount * 2);
    for (let frame = 0; frame < frameCount; frame += 1) {
        samples[frame * 2] = Math.round(Math.sin(frame / 8) * 2_000);
        samples[(frame * 2) + 1] = Math.round(Math.cos(frame / 9) * 1_800);
    }
    const bank = buildBounceBank({
        sampleRate: 48_000,
        roots: [{ note, samples }],
    });
    const bytes = encodeBounceBank(bank);
    return { bank, bytes, digest: await digestBounceBank(bytes) };
}

function bounceDocument(fixture) {
    return parseBounceDocument({
        format: "cosimo.bounce",
        version: 1,
        digest: fixture.digest,
        bankByteLength: fixture.bytes.byteLength,
        roots: [60],
        segments: [{
            rootNote: 60,
            frameOffset: 0,
            frameCount: fixture.bank.totalFrameCount,
            noteOffFrameOffset: Math.max(1, Math.floor(fixture.bank.totalFrameCount / 2)),
        }],
        capture: {
            sampleRate: 48_000,
            tempoBpm: 120,
            velocity: 100,
            holdFrames: Math.max(1, Math.floor(fixture.bank.totalFrameCount / 2)),
            tailCapFrames: Math.max(1, Math.ceil(fixture.bank.totalFrameCount / 2)),
        },
        generation: 1,
        revertRef: {
            bankDigest: null,
            patchDocument: createBouncePatchDocument({
                parameters: { filterMode: 0, sourceMode: 0 },
                storedState: { [BOUNCE_STATE_KEY]: null },
            }),
        },
    });
}

test("OPFS bank persistence uses the WebKit move contract, verifies staged bytes, and is idempotent", async () => {
    const storage = fakeStorage();
    const store = new OPFSBounceBankStore({ storage });
    const fixture = await bankFixture();

    assert.deepEqual(await store.put(fixture.digest, fixture.bytes), {
        backend: "opfs",
        created: true,
        byteLength: fixture.bytes.byteLength,
    });
    assert.deepEqual(await store.get(fixture.digest), fixture.bytes);
    assert.deepEqual(await store.put(fixture.digest, fixture.bytes), {
        backend: "opfs",
        created: false,
        byteLength: fixture.bytes.byteLength,
    });
    assert.equal([...storage.directory.files].some(([name]) => name.startsWith(".staging-")), false);
    assert.deepEqual(await store.list(), [{
        digest: fixture.digest,
        byteLength: fixture.bytes.byteLength,
    }]);
    assert.deepEqual(await store.usage(), {
        backend: "opfs",
        bankBytes: fixture.bytes.byteLength,
        bankCount: 1,
        originUsage: 1234,
        originQuota: 5678,
    });
    assert.equal(await store.delete(fixture.digest), true);
    assert.equal(await store.get(fixture.digest), null);
});

test("OPFS rejects a mislabeled bank and capability-only fallback uses IndexedDB seam", async () => {
    const fixture = await bankFixture();
    const corrupt = fixture.bytes.slice();
    corrupt[corrupt.length - 1] ^= 1;
    const primaryStorage = fakeStorage({ supportsMove: false });
    const fallback = new MemoryBankStore();
    const store = new BrowserBounceBankStore({
        primary: new OPFSBounceBankStore({ storage: primaryStorage }),
        fallback,
    });

    await assert.rejects(
        store.put(fixture.digest, corrupt),
        (error) => error instanceof BouncePersistenceError && error.code === "corrupt-bank",
    );
    const result = await store.put(fixture.digest, fixture.bytes);
    assert.equal(result.backend, "memory");
    assert.deepEqual(await store.get(fixture.digest), fixture.bytes);
    assert.deepEqual(await store.list(), [{
        digest: fixture.digest,
        byteLength: fixture.bytes.byteLength,
    }]);
    assert.equal([...primaryStorage.directory.files].some(([name]) => name.startsWith(".staging-")), false);
});

test("the restorer applies the saved source mode exactly once, inside the verified install's commit", async () => {
    const fixture = await bankFixture();
    const document = bounceDocument(fixture);
    const log = [];
    const restorer = new BounceRuntimeRestorer({
        connection: { sendEventOrValue() {} },
        store: { get: async (digest) => digest === fixture.digest ? fixture.bytes : null },
        applySavedSourceMode() { log.push("apply saved source mode"); },
        statusRequest: async () => {
            log.push("status");
            return { dspSessionId: 77, sampleRateHz: 48_000 };
        },
        stageInstall: async (_connection, bank, options) => {
            log.push("stage");
            assert.equal(bank.totalFrameCount, fixture.bank.totalFrameCount);
            assert.equal(options.dspSessionId, 77);
            assert.ok(options.generation >= document.generation);
            return {
                async commit(apply) {
                    log.push("commit");
                    await apply();
                    log.push("committed");
                },
                async abort() { log.push("abort"); },
            };
        },
    });

    const state = await restorer.restore(serializeBounceDocument(document));
    assert.equal(state.status, "ready");
    assert.equal(state.digest, fixture.digest);
    assert.deepEqual(log, ["status", "stage", "commit", "apply saved source mode", "committed"]);

    await restorer.restore(document);
    assert.equal(log.length, 5, "the same digest neither reinstalls nor applies again");

    const cleared = await restorer.restore(null);
    assert.equal(cleared.status, "oscillator");
    assert.equal(log.length, 5, "a cleared document writes nothing; the state editor owns that edit");
});

test("the restorer requires the callback that applies the saved source mode", () => {
    assert.throws(
        () => new BounceRuntimeRestorer({ connection: { sendEventOrValue() {} }, store: { get: async () => null } }),
        TypeError,
    );
});

test("a verified live Bounce transaction suppresses the matching stored-state re-install", async () => {
    const fixture = await bankFixture();
    const document = bounceDocument(fixture);
    let storeReads = 0;
    let stageCalls = 0;
    let applied = 0;
    const restorer = new BounceRuntimeRestorer({
        connection: { sendEventOrValue() {} },
        store: {
            async get() {
                storeReads += 1;
                return fixture.bytes;
            },
        },
        applySavedSourceMode() { applied += 1; },
        statusRequest: async () => ({ dspSessionId: 1, sampleRateHz: 48_000 }),
        stageInstall: async () => {
            stageCalls += 1;
            throw new Error("the live transaction already installed this bank");
        },
    });

    const accepted = restorer.acceptCommittedDocument(serializeBounceDocument(document));
    assert.equal(accepted.status, "ready");
    assert.equal(accepted.digest, fixture.digest);

    const echoed = await restorer.restore(document);
    assert.equal(echoed.status, "ready");
    assert.equal(echoed.digest, fixture.digest);
    assert.equal(storeReads, 0);
    assert.equal(stageCalls, 0);
    assert.equal(applied, 0);
});

test("every restore failure reports a typed error and writes nothing to the engine", async () => {
    const fixture = await bankFixture();
    const otherRoot = await bankFixture(64, 62);
    const document = bounceDocument(fixture);
    for (const scenario of [
        { expectedCode: "invalid-document", value: { format: "cosimo.bounce", version: 1 } },
        { expectedCode: "missing-bank", get: async () => null },
        {
            expectedCode: "corrupt-bank",
            get: async () => {
                throw new BouncePersistenceError("corrupt-bank", "digest mismatch");
            },
        },
        { expectedCode: "byte-length-mismatch", get: async () => fixture.bytes.slice(1) },
        { expectedCode: "metadata-mismatch", get: async () => otherRoot.bytes },
        {
            expectedCode: "restore-failed",
            get: async () => fixture.bytes,
            stageInstall: async () => { throw new Error("the engine refused the staged bank"); },
        },
    ]) {
        let applied = 0;
        let staged = false;
        const writes = [];
        const restorer = new BounceRuntimeRestorer({
            connection: { sendEventOrValue(endpointID, value) { writes.push([endpointID, value]); } },
            store: { get: scenario.get ?? (async () => fixture.bytes) },
            applySavedSourceMode() { applied += 1; },
            statusRequest: async () => ({ dspSessionId: 1, sampleRateHz: 48_000 }),
            stageInstall: scenario.stageInstall ?? (async () => {
                staged = true;
                throw new Error("must not stage");
            }),
        });
        const state = await restorer.restore(scenario.value ?? document);
        assert.equal(state.status, "error", scenario.expectedCode);
        assert.equal(state.error.code, scenario.expectedCode);
        assert.equal(applied, 0, scenario.expectedCode);
        assert.deepEqual(writes, [], scenario.expectedCode);
        assert.equal(staged, false, scenario.expectedCode);
    }
});
