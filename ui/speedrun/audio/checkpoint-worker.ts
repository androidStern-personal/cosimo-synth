import { renderSpeedrunCheckpoint } from "./checkpoint-renderer";

type WorkerRequest = {
    readonly type?: unknown;
    readonly requestID?: unknown;
    readonly engineModuleURL?: unknown;
    readonly job?: unknown;
};

const workerScope = self as unknown as {
    location: Location;
    addEventListener(type: "message", listener: (event: MessageEvent<WorkerRequest>) => void): void;
    postMessage(message: unknown, transfer: Transferable[]): void;
};

function serializedError(cause: unknown) {
    return {
        name: cause instanceof Error ? cause.name : "Error",
        message: cause instanceof Error ? cause.message : String(cause),
        stack: cause instanceof Error ? cause.stack : undefined,
    };
}

workerScope.addEventListener("message", (event) => {
    const message = event.data;
    void (async () => {
        if (message.type !== "render-root" || typeof message.engineModuleURL !== "string") {
            throw new Error("Speedrun checkpoint worker received an unsupported request.");
        }
        const engineURL = new URL(message.engineModuleURL, workerScope.location.href).href;
        const engineModule = await import(/* @vite-ignore */ engineURL);
        const PerformerClass = engineModule.default ?? engineModule.WavetableSynth;
        const result = await renderSpeedrunCheckpoint(PerformerClass, message.job as never);
        workerScope.postMessage({
            type: "render-root-complete",
            requestID: message.requestID,
            result,
        }, [result.samples.buffer]);
    })().catch((cause: unknown) => {
        workerScope.postMessage({
            type: "render-root-failed",
            requestID: message.requestID,
            error: serializedError(cause),
        }, []);
    });
});
