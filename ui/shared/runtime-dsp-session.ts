/** Endpoint whose session id changes whenever the Cmajor DSP instance is rebuilt. */
export const RUNTIME_STATE_ENDPOINT_ID = "runtimeState";

/** Read the DSP session id from unknown runtime-state payloads. */
export function getRuntimeDspSessionId(value: unknown): number {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return 0;
    }
    const dspSessionId = Number(Reflect.get(value, "dspSessionId"));
    return Number.isFinite(dspSessionId) ? Math.trunc(dspSessionId) : 0;
}
