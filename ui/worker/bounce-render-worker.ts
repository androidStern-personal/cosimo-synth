import {
    handleBounceRenderRequest,
    serializeBounceWorkerError,
} from "../../bounce/offline-worker-handler.mjs";

const workerScope = self as unknown as {
    location: Location;
    addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
    postMessage(message: unknown, transfer: Transferable[]): void;
};

workerScope.addEventListener("message", (event) => {
    const message = event.data;
    void handleBounceRenderRequest(message, workerScope.location.href)
        .then((response) => {
            workerScope.postMessage(response, [response.result.samples.buffer]);
        })
        .catch((cause: unknown) => {
            workerScope.postMessage({
                type: "render-root-failed",
                requestID: message?.requestID,
                error: serializeBounceWorkerError(cause),
            }, []);
        });
});
