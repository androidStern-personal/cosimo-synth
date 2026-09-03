/** Binary inputs accepted by browser persistence stores. */
export type BouncePersistenceBytes = ArrayBuffer | ArrayBufferView<ArrayBufferLike>;

/** One content-addressed bank entry in persistence. */
export type BounceBankStoreEntry = {
    readonly digest: string;
    readonly byteLength: number;
};

/** Result of an idempotent content-addressed put. */
export type BounceBankPutResult = {
    readonly backend: "opfs" | "indexeddb";
    readonly created: boolean;
    readonly byteLength: number;
};

/** Storage usage evidence used by conservative bank retirement. */
export type BounceBankStoreUsage = {
    readonly backend: string;
    readonly bankBytes: number;
    readonly bankCount: number;
    readonly originUsage: number | null;
    readonly originQuota: number | null;
};

/** Store seam shared by OPFS, IndexedDB, and the fallback coordinator. */
export type BounceBankStore = {
    get(digest: string): Promise<Uint8Array<ArrayBuffer> | null>;
    has(digest: string): Promise<boolean>;
    put(digest: string, value: BouncePersistenceBytes): Promise<BounceBankPutResult>;
    delete(digest: string): Promise<boolean>;
    list(): Promise<ReadonlyArray<BounceBankStoreEntry>>;
    usage(): Promise<BounceBankStoreUsage>;
};

/** OPFS directory name for content-addressed Bounce banks. */
export const BOUNCE_OPFS_DIRECTORY: "cosimo-bounce-banks-v1";
/** IndexedDB database name for the fallback bank store. */
export const BOUNCE_INDEXED_DB_NAME: "cosimo-bounce-banks-v1";
/** IndexedDB object-store name for fallback bank bytes. */
export const BOUNCE_INDEXED_DB_STORE: "banks";

/** Typed persistence failure raised by browser bank stores. */
export class BouncePersistenceError extends Error {
    readonly code: string;
    constructor(code: string, message: string, options?: ErrorOptions);
}

/** Content-addressed OPFS store with verified staged writes. */
export class OPFSBounceBankStore implements BounceBankStore {
    constructor(options?: {
        readonly storage?: StorageManager;
        readonly directoryName?: string;
    });
    get(digest: string): Promise<Uint8Array<ArrayBuffer> | null>;
    has(digest: string): Promise<boolean>;
    put(digest: string, value: BouncePersistenceBytes): Promise<BounceBankPutResult>;
    delete(digest: string): Promise<boolean>;
    list(): Promise<ReadonlyArray<BounceBankStoreEntry>>;
    usage(): Promise<BounceBankStoreUsage>;
}

/** IndexedDB fallback store for browsers without atomic OPFS moves. */
export class IndexedDBBounceBankStore implements BounceBankStore {
    constructor(options?: {
        readonly indexedDB?: IDBFactory;
        readonly databaseName?: string;
    });
    get(digest: string): Promise<Uint8Array<ArrayBuffer> | null>;
    has(digest: string): Promise<boolean>;
    put(digest: string, value: BouncePersistenceBytes): Promise<BounceBankPutResult>;
    delete(digest: string): Promise<boolean>;
    list(): Promise<ReadonlyArray<BounceBankStoreEntry>>;
    usage(): Promise<BounceBankStoreUsage>;
}

/** OPFS-first store that falls back only for unsupported OPFS capabilities. */
export class BrowserBounceBankStore implements BounceBankStore {
    constructor(options?: {
        readonly primary?: BounceBankStore;
        readonly fallback?: BounceBankStore;
    });
    get(digest: string): Promise<Uint8Array<ArrayBuffer> | null>;
    has(digest: string): Promise<boolean>;
    put(digest: string, value: BouncePersistenceBytes): Promise<BounceBankPutResult>;
    delete(digest: string): Promise<boolean>;
    list(): Promise<ReadonlyArray<BounceBankStoreEntry>>;
    usage(): Promise<BounceBankStoreUsage>;
}

/** Create the default OPFS-first browser bank store. */
export function createBrowserBounceBankStore(options?: {
    readonly primary?: BounceBankStore;
    readonly fallback?: BounceBankStore;
}): BrowserBounceBankStore;
