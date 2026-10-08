import type { PluginStateDocumentContext, PluginStateSubmission } from "../../kit/index";
import { isPreparationFailure } from "../../kit/ui/plugin-state-definition";
import type { EngineCancellation } from "../../kit/ui/plugin-state-engine";
import { createPatchConnectionResourceClient } from "../../kit/ui/resource-client";
import { synthPatchRoot } from "../shared/patch-root";
import type { PatchConnectionLike } from "../shared/cmajor-react";
import { fullStoredStateValues } from "../shared/full-stored-state";
import { LANE_STATE_KEY } from "../shared/lane-state";
import { getRuntimeDspSessionId, RUNTIME_STATE_ENDPOINT_ID } from "../shared/runtime-dsp-session";
import { synthPluginState } from "../shared/synth-plugin-state";

const sent = { kind: "sent", proof: "native-publication-processed" } as const;

/**
 * Restores the saved rack through the synth's own rack field (its codec, its
 * preparation and synthRackDelivery) on hosts that run the DSP without the kit's
 * native state channel: the browser test page, which owns the modulation lanes
 * itself, and the offline speedrun renderer. The rack is sent once the DSP reports
 * its session and again whenever the saved rack changes; the delivery replays it
 * after a DSP restart. Output Trim host parameters are left to the host, which
 * starts them equal to the rack's own trims.
 */
export function createSynthRackRestore(connection: PatchConnectionLike, options: { readonly onDefect: (error: unknown) => void }) {
    const field = synthPluginState[LANE_STATE_KEY];
    if (field.engine?.kind !== "prepared") throw new Error("The synth's rack field must declare its own delivery.");
    const { prepare, delivery } = field.engine;
    let stopped = false;
    const abortListeners = new Set<() => void>();
    const signal: EngineCancellation = {
        get aborted() { return stopped; },
        onAbort(listener) { abortListeners.add(listener); return () => abortListeners.delete(listener); },
    };
    const resources = createPatchConnectionResourceClient(connection, { patchRoot: synthPatchRoot() });
    const removals: Array<() => void> = [];
    function listen(endpoint: string, listener: (value: unknown) => void) {
        connection.addEndpointListener?.(endpoint, listener);
        const remove = () => connection.removeEndpointListener?.(endpoint, listener);
        removals.push(remove);
        return remove;
    }
    const document: PluginStateDocumentContext = {
        signal,
        send(effect): PluginStateSubmission {
            if (stopped) return { kind: "cancelled" };
            if (effect.kind !== "event") throw new Error(`The rack delivery sent an undeclared ${effect.kind}.`);
            connection.sendEventOrValue?.(effect.endpoint, effect.value);
            return { kind: "submitted", completion: Promise.resolve(sent) };
        },
        listen,
        readStored: () => Promise.reject(new Error("The rack delivery declares no stored reads.")),
        subscribeStored: () => { throw new Error("The rack delivery declares no stored reads."); },
        prepareData: () => Promise.reject(new Error("The rack delivery declares no shared data.")),
        report(status) { if (status.kind === "failed") options.onDefect(new Error(`The rack was not applied: ${status.error.message}`)); },
        fail: options.onDefect,
    };
    const binding = delivery.create(document);
    let saved: unknown;
    let sessionKnown = false;

    async function apply() {
        const parsed = saved === undefined ? field.initial : field.codec.parse(saved);
        if (parsed.kind === "error") { options.onDefect(new Error(`The saved rack could not be read: ${parsed.message}`)); return; }
        const payload = await prepare(parsed.value, { resources, parameters: {}, reason: "load", signal });
        if (stopped) return;
        if (isPreparationFailure(payload)) { options.onDefect(new Error(`The saved rack could not be prepared: ${payload.error.message}`)); return; }
        const outcome = await binding.apply(payload, { signal, send: document.send, listen });
        if (outcome.kind === "failed") options.onDefect(new Error(`The rack was not applied: ${outcome.error.message}`));
    }
    const applyNow = () => { if (!stopped && sessionKnown) apply().catch(options.onDefect); };
    const onRuntimeState = (value: unknown) => {
        if (sessionKnown || getRuntimeDspSessionId(value) === 0) return;
        sessionKnown = true;
        applyNow();
    };
    const onStoredValue = (message: unknown) => {
        if (typeof message !== "object" || message === null || Reflect.get(message, "key") !== LANE_STATE_KEY) return;
        saved = Reflect.get(message, "value");
        applyNow();
    };

    return {
        start() {
            listen(RUNTIME_STATE_ENDPOINT_ID, onRuntimeState);
            connection.addStoredStateValueListener?.(onStoredValue);
            connection.requestFullStoredState?.(fullState => {
                saved = fullStoredStateValues(fullState)[LANE_STATE_KEY];
                applyNow();
            });
        },
        stop() {
            if (stopped) return;
            stopped = true;
            for (const listener of abortListeners) listener();
            abortListeners.clear();
            connection.removeStoredStateValueListener?.(onStoredValue);
            for (const remove of removals.splice(0)) remove();
            return binding.stop();
        },
    };
}
