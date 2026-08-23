import { parentPort } from "node:worker_threads";

import {
    handleBounceRenderRequest,
    serializeBounceWorkerError,
} from "./offline-worker-handler.mjs";

if (parentPort === null) throw new Error("Bounce node worker requires worker_threads");

parentPort.on("message", (message) => {
    void handleBounceRenderRequest(message, import.meta.url)
        .then((response) => parentPort.postMessage(response, [response.result.samples.buffer]))
        .catch((cause) => parentPort.postMessage({
            type: "render-root-failed",
            requestID: message?.requestID,
            error: serializeBounceWorkerError(cause),
        }));
});
