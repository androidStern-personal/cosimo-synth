export type OfflineWorkerLike = {
    postMessage(message: unknown): void;
    addEventListener?: (type: string, listener: (event: unknown) => void) => void;
    removeEventListener?: (type: string, listener: (event: unknown) => void) => void;
    on?: (type: string, listener: (event: unknown) => void) => void;
    off?: (type: string, listener: (event: unknown) => void) => void;
    terminate(): unknown;
};

export function defaultBounceWorkerConcurrency(): number;

export function renderBouncePlanInWorkers<TResult>(options: {
    plan: { readonly jobs: ReadonlyArray<unknown> };
    workerURL: string | URL;
    engineModuleURL: string | URL;
    workerFactory?: (url: string | URL, job: never) => OfflineWorkerLike;
    concurrency?: number;
    signal?: AbortSignal;
    onProgress?: (progress: {
        readonly completedRoots: number;
        readonly totalRoots: number;
        readonly rootNote: number;
    }) => void;
}): Promise<TResult[]>;
