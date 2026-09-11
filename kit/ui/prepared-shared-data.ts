/** Framework-owned writable storage. Only the preparation callback may mutate it. */
export interface SharedDataDestination {
    readonly buffer: ArrayBufferLike;
    readonly byteOffset: number;
    readonly byteLength: number;
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
): Promise<void> {
    const storage = connection.sharedData;
    if (!storage) throw new Error("This patch host does not support direct shared-data preparation.");
    const destination = storage.reserve(request.input, request.byteLength);
    try {
        prepare(destination);
        await storage.commit(destination.id);
    } catch (error: unknown) {
        storage.cancel(destination.id);
        throw error;
    }
}
