import { renderBounceRoot } from "./offline-render-core.mjs";

export async function handleBounceRenderRequest(message, baseURL) {
    if (message?.type !== "render-root") {
        throw new Error("Bounce worker received an unsupported message");
    }
    const engineURL = new URL(message.engineModuleURL, baseURL).href;
    const engineModule = await import(/* @vite-ignore */ engineURL);
    const CmajorClass = engineModule.default ?? engineModule.WavetableSynth;
    const result = await renderBounceRoot(CmajorClass, message.plan, message.job);
    return {
        type: "render-root-complete",
        requestID: message.requestID,
        result,
    };
}

export function serializeBounceWorkerError(cause) {
    return {
        name: cause instanceof Error ? cause.name : "Error",
        message: cause instanceof Error ? cause.message : String(cause),
        stack: cause instanceof Error ? cause.stack : undefined,
    };
}
