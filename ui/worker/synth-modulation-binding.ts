import type { PluginStateDelivery, PluginStateDeliveryOutcome, PluginStateSubmission, PatchConnectionLike } from "../../kit/index";
import { ARTICULATIONS_V4_STATE_KEY } from "../shared/articulation-image";
import { serializeArticulationTriggerConfig } from "../shared/articulations";
import type { ModulationState } from "../shared/modulation";
import { MSEG_PADDED_SAMPLES, renderMsegShapeInto } from "../shared/mseg";
import { SHARED_MSEG_BYTES, SHARED_MSEG_FIRST_INPUT } from "../shared/shared-mseg";
import { ModulationArticulationWorkerService } from "./modulation-articulation-worker-service";

/** One declared bank retains the synth's existing ordered modulation/articulation protocol. */
export const synthModulationDelivery: PluginStateDelivery<ModulationState> = {
    eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
    outputEndpoints: ["runtimeState", "runtimeInstallAck"],
    storedKeys: [ARTICULATIONS_V4_STATE_KEY],
    hostEffects: ["cosimo.articulation-trigger-config"],
    dataInputs: [3, 4, 5, 6, 7, 8],
    replacement: "finish",
    create(document) {
        let coordinator = createCoordinator(document);
        return {
            apply(value, context) {
                if (coordinator.closed) coordinator = createCoordinator(document);
                return coordinator.apply(value, context);
            },
            stop() { coordinator.stop(); },
        };
    },
};

function createCoordinator(document: Parameters<PluginStateDelivery<ModulationState>["create"]>[0]) {
        let stopped = false;
        let delivery = 0;
        let finish: ((outcome: PluginStateDeliveryOutcome) => void) | undefined;
        const pending = new Set<Promise<PluginStateDeliveryOutcome>>();
        const endpointRemovals = new Map<string, Map<(value: unknown) => void, () => void>>();
        const storedRemovals = new Map<(value: unknown) => void, () => void>();
        function report(outcome: PluginStateDeliveryOutcome) {
            const complete = finish; finish = undefined;
            if (complete) complete(outcome);
            else if (outcome.kind !== "cancelled") document.report(outcome);
        }
        function stop() {
            if (stopped) return;
            stopped = true;
            service.stop();
            report({ kind: "cancelled" });
            pending.clear();
        }
        function own(submission: PluginStateSubmission) {
            if (submission.kind !== "submitted") {
                if (submission.kind === "failed" && submission.error.kind !== "transport") {
                    report(submission); stop();
                }
                return;
            }
            pending.add(submission.completion);
            void submission.completion.then(outcome => {
                pending.delete(submission.completion);
                if (stopped || outcome.kind === "sent") return;
                report(outcome); stop();
            }, error => { if (!stopped) { stop(); document.fail(error); } });
        }
        const connection: PatchConnectionLike = {
            addEndpointListener(endpoint, listener) {
                const listeners = endpointRemovals.get(endpoint) ?? new Map();
                listeners.set(listener, document.listen(endpoint, listener)); endpointRemovals.set(endpoint, listeners);
            },
            removeEndpointListener(endpoint, listener) { endpointRemovals.get(endpoint)?.get(listener)?.(); endpointRemovals.get(endpoint)?.delete(listener); },
            addStoredStateValueListener(listener) {
                storedRemovals.set(listener, document.subscribeStored(ARTICULATIONS_V4_STATE_KEY,
                    value => listener({ key: ARTICULATIONS_V4_STATE_KEY, value })));
            },
            removeStoredStateValueListener(listener) { storedRemovals.get(listener)?.(); storedRemovals.delete(listener); },
            requestFullStoredState(callback) {
                void document.readStored(ARTICULATIONS_V4_STATE_KEY).then(value => {
                    if (!stopped) callback({ values: { [ARTICULATIONS_V4_STATE_KEY]: value } });
                }, error => document.fail(error));
            },
            sendEventOrValue(endpoint, value) { if (!stopped) own(document.send({ kind: "event", endpoint, value })); },
        };
        const service = new ModulationArticulationWorkerService(connection, {
            onDefect(error) { stop(); document.fail(error); },
            curveCommand: (slotIndex, shapeIndex, shape) => ({
                async submit({ dspSessionId, deliverySerial, signal }) {
                    const outcome = await document.prepareData(SHARED_MSEG_FIRST_INPUT + slotIndex * 2 + shapeIndex,
                        SHARED_MSEG_BYTES, destination => {
                            new Int32Array(destination.buffer, destination.byteOffset, 4)
                                .set([0x4d534547, dspSessionId, deliverySerial, MSEG_PADDED_SAMPLES]);
                            renderMsegShapeInto(shape, new Float32Array(destination.buffer, destination.byteOffset + 16, MSEG_PADDED_SAMPLES));
                        }, signal);
                    if (outcome.kind === "failed") { report(outcome); stop(); }
                },
            }),
            async publishTriggerConfig(config) {
                const publications = await Promise.all(pending);
                const failed = publications.find(outcome => outcome.kind !== "sent");
                if (failed) return failed.kind === "failed" ? failed : { kind: "cancelled" };
                if (stopped) return { kind: "cancelled" };
                const submission = document.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: serializeArticulationTriggerConfig(config) });
                return submission.kind === "submitted" ? submission.completion : submission;
            },
        });
        return {
            get closed() { return stopped; },
            apply(value: ModulationState, context: Parameters<ReturnType<PluginStateDelivery<ModulationState>["create"]>["apply"]>[1]): Promise<PluginStateDeliveryOutcome> {
                if (stopped || context.signal.aborted) return Promise.resolve({ kind: "cancelled" });
                const currentDelivery = ++delivery;
                return new Promise(resolve => {
                    const removeAbort = context.signal.onAbort(() => { report({ kind: "cancelled" }); stop(); });
                    finish = outcome => { removeAbort(); resolve(outcome); };
                    service.replaceModulation(value, status => {
                        if (currentDelivery === delivery && status.kind !== "preparing") report(status);
                    });
                    service.start();
                });
            },
            stop,
        };
}
