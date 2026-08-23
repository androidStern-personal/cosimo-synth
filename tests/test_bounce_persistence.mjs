import assert from "node:assert/strict";
import path from "node:path";
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
import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

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

    async move(nextName) {
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

async function bankFixture(frameCount = 64) {
    const samples = new Int16Array(frameCount * 2);
    for (let frame = 0; frame < frameCount; frame += 1) {
        samples[frame * 2] = Math.round(Math.sin(frame / 8) * 2_000);
        samples[(frame * 2) + 1] = Math.round(Math.cos(frame / 9) * 1_800);
    }
    const bank = buildBounceBank({
        sampleRate: 48_000,
        roots: [{ note: 60, samples }],
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

test("OPFS bank persistence verifies staged bytes, atomically renames by digest, and is idempotent", async () => {
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

test("runtime restore verifies metadata and commits sampled mode only after staged install", async () => {
    const fixture = await bankFixture();
    const document = bounceDocument(fixture);
    const log = [];
    const sourceModes = [];
    const connection = { sendEventOrValue() {} };
    const restorer = new BounceRuntimeRestorer({
        connection,
        store: { get: async (digest) => digest === fixture.digest ? fixture.bytes : null },
        sendRuntimeSourceMode(value) { sourceModes.push(value); },
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
                },
                async abort() { log.push("abort"); },
            };
        },
    });

    const state = await restorer.restore(serializeBounceDocument(document));
    assert.equal(state.status, "ready");
    assert.equal(state.digest, fixture.digest);
    assert.deepEqual(log, ["status", "stage", "commit"]);
    assert.deepEqual(sourceModes, [1]);

    await restorer.restore(document);
    assert.deepEqual(log, ["status", "stage", "commit"], "same digest must not reinstall");
});

test("missing or corrupt persisted banks expose typed errors and keep the oscillator fallback", async () => {
    const fixture = await bankFixture();
    const document = bounceDocument(fixture);
    for (const scenario of [
        {
            expectedCode: "missing-bank",
            get: async () => null,
        },
        {
            expectedCode: "corrupt-bank",
            get: async () => {
                throw new BouncePersistenceError("corrupt-bank", "digest mismatch");
            },
        },
    ]) {
        const sourceModes = [];
        let staged = false;
        const restorer = new BounceRuntimeRestorer({
            connection: { sendEventOrValue() {} },
            store: { get: scenario.get },
            sendRuntimeSourceMode(value) { sourceModes.push(value); },
            statusRequest: async () => ({ dspSessionId: 1, sampleRateHz: 48_000 }),
            stageInstall: async () => {
                staged = true;
                throw new Error("must not stage");
            },
        });
        const state = await restorer.restore(document);
        assert.equal(state.status, "error");
        assert.equal(state.error.code, scenario.expectedCode);
        assert.deepEqual(sourceModes, [0]);
        assert.equal(staged, false);
    }
});

class PresetPatchConnection {
    constructor(initialValue) {
        this.initialValue = initialValue;
        this.listeners = new Set();
        this.storedWrites = [];
        this.parameterWrites = [];
    }

    addStoredStateValueListener(listener) { this.listeners.add(listener); }
    removeStoredStateValueListener(listener) { this.listeners.delete(listener); }
    requestFullStoredState(callback) {
        callback({ values: { [BOUNCE_STATE_KEY]: this.initialValue } });
    }
    sendEventOrValue(endpointID, value) { this.parameterWrites.push({ endpointID, value }); }
    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
        this.emit(key, value);
    }
    emit(key, value) {
        for (const listener of this.listeners) listener({ key, value });
    }
}

test("synth preset capture and load carry the bounce.v1 reference, never PCM", async () => {
    const fixture = await bankFixture();
    const document = bounceDocument(fixture);
    const serialized = serializeBounceDocument(document);
    const [bouncePreset, contracts, presets] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/bounce-preset-state.ts"),
        loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts"),
        loadUIModule(repoRoot, "ui/shared/effects/effect-preset-v2.ts"),
    ]);
    const connection = new PresetPatchConnection(serialized);
    const adapter = bouncePreset.createBouncePresetStoredStateAdapter(connection);
    const unsubscribe = adapter.subscribe(() => {});
    const currentContract = contracts.buildCanonicalPluginStateContract({
        effectID: "cosimo-synth",
        parameters: [{
            endpointID: "sourceMode",
            type: "integer",
            min: 0,
            max: 1,
            defaultValue: 0,
        }],
        storedState: [adapter.getContract()],
    });
    const saved = presets.captureEffectPresetV2({
        effectID: "cosimo-synth",
        presetID: "user.bounced",
        label: "Bounced",
        currentContract,
        currentParameterValues: { sourceMode: 1 },
        storedStateAdapters: [adapter],
    });

    assert.equal(saved.storedState[BOUNCE_STATE_KEY], serialized);
    assert.equal(JSON.stringify(saved).includes("pcm"), false);
    connection.emit(BOUNCE_STATE_KEY, null);
    presets.applyEffectPresetV2({
        preset: saved,
        currentContract,
        storedStateAdapters: [adapter],
        patchConnection: connection,
    });
    assert.deepEqual(connection.storedWrites.at(-1), {
        key: BOUNCE_STATE_KEY,
        value: serialized,
    });
    assert.equal(adapter.capture().digest, fixture.digest);
    unsubscribe();
});
