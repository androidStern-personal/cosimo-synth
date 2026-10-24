import type { PatchConnectionLike } from "./cmajor-react";

/** One long-lived part of a patch worker, such as wavetable loading or the plugin state. */
export type PatchWorkerService = {
    start: () => unknown | Promise<unknown>;
    stop?: () => void | Promise<void>;
};

/** Creates one service for the worker's connection. */
export type PatchWorkerServiceFactory = (connection: PatchConnectionLike) => PatchWorkerService | Promise<PatchWorkerService>;

async function stopInReverse(services: readonly PatchWorkerService[]): Promise<unknown[]> {
    const failures: unknown[] = [];
    for (const service of [...services].reverse()) {
        try {
            await service.stop?.();
        } catch (error) {
            failures.push(error);
        }
    }
    return failures;
}

/**
 * Start a patch worker's services in order. If one fails to start, the ones
 * already running are stopped. The returned stop() stops every service in
 * reverse order, even when some of them fail to stop.
 */
export async function startPatchWorkerServices(
    connection: PatchConnectionLike,
    serviceFactories: readonly PatchWorkerServiceFactory[],
): Promise<{ stop: () => Promise<void> }> {
    const services: PatchWorkerService[] = [];
    try {
        for (const createService of serviceFactories) {
            const service = await createService(connection);
            services.push(service);
            await service.start();
        }
    } catch (startError) {
        const failures = await stopInReverse(services);
        if (failures.length > 0) {
            throw new AggregateError([startError, ...failures], "A patch worker service failed to start, and stopping the others also failed.");
        }
        throw startError;
    }

    let stopped = false;
    return {
        async stop() {
            if (stopped) return;
            stopped = true;
            const failures = await stopInReverse(services.splice(0));
            if (failures.length > 0) throw new AggregateError(failures, "Some patch worker services failed to stop.");
        },
    };
}
