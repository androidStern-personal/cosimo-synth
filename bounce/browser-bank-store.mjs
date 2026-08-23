import { digestBounceBank } from "./digest.mjs";

export const BOUNCE_OPFS_DIRECTORY = "cosimo-bounce-banks-v1";
export const BOUNCE_INDEXED_DB_NAME = "cosimo-bounce-banks-v1";
export const BOUNCE_INDEXED_DB_STORE = "banks";

export class BouncePersistenceError extends Error {
    constructor(code, message, options) {
        super(message, options);
        this.name = "BouncePersistenceError";
        this.code = code;
    }
}

function validateDigest(digest) {
    if (typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)) {
        throw new BouncePersistenceError("bad-digest", "Bounce bank key must be lowercase SHA-256");
    }
    return digest;
}

function asBytes(value) {
    if (value instanceof Uint8Array) return value.slice();
    if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
    }
    throw new TypeError("Bounce bank persistence requires bytes");
}

function isNotFound(cause) {
    return cause?.name === "NotFoundError" || cause?.code === "ENOENT";
}

async function assertDigest(digest, bytes, label) {
    const actual = await digestBounceBank(bytes);
    if (actual !== digest) {
        throw new BouncePersistenceError(
            "corrupt-bank",
            `${label} digest mismatch: expected ${digest}, received ${actual}`,
        );
    }
}

function bankFileName(digest) {
    return `bank-${validateDigest(digest)}.csbk`;
}

function stagingFileName(digest) {
    const nonce = globalThis.crypto?.randomUUID?.()
        ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `.staging-${digest}-${nonce}.tmp`;
}

async function fileBytes(handle) {
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
}

/** Content-addressed OPFS store with verified staged write + atomic move. */
export class OPFSBounceBankStore {
    #storage;
    #directoryName;
    #directoryPromise = null;

    constructor({ storage = globalThis.navigator?.storage, directoryName = BOUNCE_OPFS_DIRECTORY } = {}) {
        this.#storage = storage;
        this.#directoryName = directoryName;
    }

    async #directory() {
        if (!this.#storage || typeof this.#storage.getDirectory !== "function") {
            throw new BouncePersistenceError("opfs-unavailable", "Origin Private File System is unavailable");
        }
        this.#directoryPromise ??= this.#storage.getDirectory()
            .then((root) => root.getDirectoryHandle(this.#directoryName, { create: true }));
        return this.#directoryPromise;
    }

    async get(digestInput) {
        const digest = validateDigest(digestInput);
        const directory = await this.#directory();
        let handle;
        try {
            handle = await directory.getFileHandle(bankFileName(digest));
        } catch (cause) {
            if (isNotFound(cause)) return null;
            throw cause;
        }
        const bytes = await fileBytes(handle);
        await assertDigest(digest, bytes, "Persisted Bounce bank");
        return bytes;
    }

    async has(digest) {
        return (await this.get(digest)) !== null;
    }

    async put(digestInput, value) {
        const digest = validateDigest(digestInput);
        const bytes = asBytes(value);
        await assertDigest(digest, bytes, "Candidate Bounce bank");
        const directory = await this.#directory();
        const existing = await this.get(digest);
        if (existing !== null) {
            return Object.freeze({ backend: "opfs", created: false, byteLength: existing.byteLength });
        }

        const temporaryName = stagingFileName(digest);
        const temporary = await directory.getFileHandle(temporaryName, { create: true });
        try {
            const writable = await temporary.createWritable({ keepExistingData: false });
            await writable.write(bytes);
            await writable.close();
            const stagedBytes = await fileBytes(temporary);
            await assertDigest(digest, stagedBytes, "Staged Bounce bank");
            if (typeof temporary.move !== "function") {
                throw new BouncePersistenceError(
                    "opfs-atomic-move-unavailable",
                    "OPFS atomic move is unavailable; use the IndexedDB fallback",
                );
            }
            try {
                // WebKit requires the destination directory even for a
                // same-directory rename; Chromium accepts this form too.
                await temporary.move(directory, bankFileName(digest));
            } catch (cause) {
                // A racing content-addressed writer may have won. Its bytes
                // are acceptable only if the exact digest verifies.
                const raced = await this.get(digest).catch(() => null);
                if (raced === null) throw cause;
                await directory.removeEntry(temporaryName).catch(() => {});
                return Object.freeze({ backend: "opfs", created: false, byteLength: raced.byteLength });
            }
            const committed = await this.get(digest);
            if (committed === null) {
                throw new BouncePersistenceError("opfs-commit-missing", "Committed OPFS bank disappeared");
            }
            return Object.freeze({ backend: "opfs", created: true, byteLength: committed.byteLength });
        } catch (cause) {
            await directory.removeEntry(temporaryName).catch(() => {});
            throw cause;
        }
    }

    async delete(digestInput) {
        const directory = await this.#directory();
        try {
            await directory.removeEntry(bankFileName(validateDigest(digestInput)));
            return true;
        } catch (cause) {
            if (isNotFound(cause)) return false;
            throw cause;
        }
    }

    async list() {
        const directory = await this.#directory();
        const entries = [];
        for await (const [name, handle] of directory.entries()) {
            const match = /^bank-([0-9a-f]{64})\.csbk$/.exec(name);
            if (!match || handle.kind !== "file") continue;
            const file = await handle.getFile();
            entries.push({ digest: match[1], byteLength: file.size });
        }
        return entries.sort((left, right) => left.digest.localeCompare(right.digest));
    }

    async usage() {
        const entries = await this.list();
        const estimate = typeof this.#storage?.estimate === "function"
            ? await this.#storage.estimate()
            : {};
        return Object.freeze({
            backend: "opfs",
            bankBytes: entries.reduce((sum, entry) => sum + entry.byteLength, 0),
            bankCount: entries.length,
            originUsage: Number(estimate.usage) || null,
            originQuota: Number(estimate.quota) || null,
        });
    }
}

function requestPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    });
}

export class IndexedDBBounceBankStore {
    #indexedDB;
    #databaseName;
    #databasePromise = null;

    constructor({ indexedDB = globalThis.indexedDB, databaseName = BOUNCE_INDEXED_DB_NAME } = {}) {
        this.#indexedDB = indexedDB;
        this.#databaseName = databaseName;
    }

    async #database() {
        if (!this.#indexedDB?.open) {
            throw new BouncePersistenceError("indexeddb-unavailable", "IndexedDB is unavailable");
        }
        this.#databasePromise ??= new Promise((resolve, reject) => {
            const request = this.#indexedDB.open(this.#databaseName, 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(BOUNCE_INDEXED_DB_STORE)) {
                    request.result.createObjectStore(BOUNCE_INDEXED_DB_STORE);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error("Could not open Bounce IndexedDB"));
        });
        return this.#databasePromise;
    }

    async #store(mode) {
        const database = await this.#database();
        return database.transaction(BOUNCE_INDEXED_DB_STORE, mode).objectStore(BOUNCE_INDEXED_DB_STORE);
    }

    async get(digestInput) {
        const digest = validateDigest(digestInput);
        const value = await requestPromise((await this.#store("readonly")).get(digest));
        if (value === undefined) return null;
        const bytes = asBytes(value);
        await assertDigest(digest, bytes, "IndexedDB Bounce bank");
        return bytes;
    }

    async has(digest) { return (await this.get(digest)) !== null; }

    async put(digestInput, value) {
        const digest = validateDigest(digestInput);
        const bytes = asBytes(value);
        await assertDigest(digest, bytes, "Candidate Bounce bank");
        const existed = await this.has(digest);
        await requestPromise((await this.#store("readwrite")).put(bytes, digest));
        return Object.freeze({ backend: "indexeddb", created: !existed, byteLength: bytes.byteLength });
    }

    async delete(digestInput) {
        const digest = validateDigest(digestInput);
        const existed = await this.has(digest);
        await requestPromise((await this.#store("readwrite")).delete(digest));
        return existed;
    }

    async list() {
        const database = await this.#database();
        const store = database.transaction(BOUNCE_INDEXED_DB_STORE, "readonly")
            .objectStore(BOUNCE_INDEXED_DB_STORE);
        // Queue both requests before yielding so the transaction cannot become
        // inactive between the key and value reads.
        const keysRequest = store.getAllKeys();
        const valuesRequest = store.getAll();
        const [keys, values] = await Promise.all([
            requestPromise(keysRequest),
            requestPromise(valuesRequest),
        ]);
        return keys.map((digest, index) => ({
            digest: String(digest),
            byteLength: asBytes(values[index]).byteLength,
        })).sort((left, right) => left.digest.localeCompare(right.digest));
    }

    async usage() {
        const entries = await this.list();
        return Object.freeze({
            backend: "indexeddb",
            bankBytes: entries.reduce((sum, entry) => sum + entry.byteLength, 0),
            bankCount: entries.length,
            originUsage: null,
            originQuota: null,
        });
    }
}

/** OPFS primary, IndexedDB only when the primary capability is unavailable. */
export class BrowserBounceBankStore {
    #primary;
    #fallback;
    #fallbackDigests = new Set();

    constructor({ primary = new OPFSBounceBankStore(), fallback = new IndexedDBBounceBankStore() } = {}) {
        this.#primary = primary;
        this.#fallback = fallback;
    }

    #shouldFallback(cause) {
        return cause?.code === "opfs-unavailable"
            || cause?.code === "opfs-atomic-move-unavailable";
    }

    async put(digest, bytes) {
        try {
            return await this.#primary.put(digest, bytes);
        } catch (cause) {
            if (!this.#shouldFallback(cause)) throw cause;
            this.#fallbackDigests.add(digest);
            return this.#fallback.put(digest, bytes);
        }
    }

    async get(digest) {
        if (!this.#fallbackDigests.has(digest)) {
            try {
                const value = await this.#primary.get(digest);
                if (value !== null) return value;
            } catch (cause) {
                if (!this.#shouldFallback(cause)) throw cause;
            }
        }
        return this.#fallback.get(digest);
    }

    async has(digest) { return (await this.get(digest)) !== null; }

    async list() {
        const [primary, fallback] = await Promise.allSettled([
            this.#primary.list(),
            this.#fallback.list(),
        ]);
        const entries = new Map();
        for (const outcome of [primary, fallback]) {
            if (outcome.status !== "fulfilled") continue;
            for (const entry of outcome.value) entries.set(entry.digest, entry);
        }
        return [...entries.values()].sort((left, right) => left.digest.localeCompare(right.digest));
    }

    async delete(digest) {
        const outcomes = await Promise.allSettled([
            this.#primary.delete(digest),
            this.#fallback.delete(digest),
        ]);
        this.#fallbackDigests.delete(digest);
        return outcomes.some((outcome) => outcome.status === "fulfilled" && outcome.value === true);
    }

    async usage() {
        const [primary, fallback] = await Promise.allSettled([
            this.#primary.usage(),
            this.#fallback.usage(),
        ]);
        const values = [primary, fallback]
            .filter((outcome) => outcome.status === "fulfilled")
            .map((outcome) => outcome.value);
        return Object.freeze({
            backend: values.map((value) => value.backend).join("+") || "unavailable",
            bankBytes: values.reduce((sum, value) => sum + value.bankBytes, 0),
            bankCount: values.reduce((sum, value) => sum + value.bankCount, 0),
            originUsage: values.find((value) => value.originUsage !== null)?.originUsage ?? null,
            originQuota: values.find((value) => value.originQuota !== null)?.originQuota ?? null,
        });
    }
}

export function createBrowserBounceBankStore(options) {
    return new BrowserBounceBankStore(options);
}
