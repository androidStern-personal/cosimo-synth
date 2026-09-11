/** Framework-owned writable storage. Only the preparation callback may mutate it. */
export interface SharedDataDestination {
    readonly buffer: ArrayBufferLike;
    readonly byteOffset: number;
    readonly byteLength: number;
}

/** Portable cancellation owned by the caller, including native JavaScript hosts. */
export interface SharedDataCancellation {
    readonly aborted: boolean;
    onAbort(listener: () => void): () => void;
}

/** Internal runtime capability, supplied by the native or browser patch host. */
export interface SharedDataConnection {
    readonly sharedData?: {
        reserve(input: number, byteLength: number): SharedDataDestination & { readonly id: number };
        commit(id: number): unknown;
        cancel(id: number): void;
    };
}

/**
 * Runs preparation directly in the allocation that DSP will read. A successful
 * return submits the complete allocation for publication at an audio block
 * boundary; it does not claim that an audio callback has already adopted it.
 * The callback must finish all writes before returning and must not retain a
 * writable view. No sample payload is copied or sent through messages.
 */
export async function prepareSharedData(
    connection: SharedDataConnection,
    request: { readonly input: number; readonly byteLength: number },
    prepare: (destination: SharedDataDestination) => void,
    options: { readonly signal?: SharedDataCancellation } = {},
): Promise<{ cancel(): void }> {
    const storage = connection.sharedData;
    if (!storage) throw new Error("This patch host does not support direct shared-data preparation.");
    if (options.signal?.aborted) throw new Error("Shared preparation cancelled.");
    const destination = storage.reserve(request.input, request.byteLength);
    const removeAbort = options.signal?.onAbort(() => storage.cancel(destination.id));
    try {
        prepare(destination);
        if (options.signal?.aborted) throw new Error("Shared preparation cancelled.");
        await storage.commit(destination.id);
        // Cancellation can still revoke a queued publication. Once audio has
        // adopted it, the runtime owns its lifetime until the next replacement.
        return { cancel: () => storage.cancel(destination.id) };
    } catch (error: unknown) {
        storage.cancel(destination.id);
        throw error;
    } finally {
        removeAbort?.();
    }
}
