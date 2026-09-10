import type { CmajorStateBindingFactory, CmajorStateEffect, CmajorStatePublicationOutcome } from "../../kit/ui/plugin-state-cmajor";
import type { EngineTarget } from "../../kit/ui/plugin-state-engine";
import type { PatchConnectionLike } from "../shared/cmajor-react";
import { MODULATION_STATE_KEY, parseModulationState } from "../shared/modulation";
import { serializeArticulationTriggerConfig } from "../shared/articulations";
import { ModulationArticulationWorkerService } from "./modulation-articulation-worker-service";

/** Adapt the synth's dependent runtime lanes to framework-owned modulation. */
export function createSynthModulationBinding(connection: PatchConnectionLike): CmajorStateBindingFactory {
    return {
        key: MODULATION_STATE_KEY,
        eventEndpoints: ["modulationMsegBuffer", "modulationMsegPlayback", "modulationProgram", "articulationSnapshot", "runtimeSyncRequest"],
        hostEffects: ["cosimo.articulation-trigger-config"],
        create(context) {
            let stopped = false;
            let operation = 0;
            type Document = {
                readonly scope: EngineTarget["scope"];
                readonly service: ModulationArticulationWorkerService;
                readonly closed: boolean;
                setTarget(target: EngineTarget): void;
                close(): void;
            };
            let document: Document | undefined;

            function openDocument(target: EngineTarget): Document {
                const scope = Object.freeze({ ...target.scope });
                let active = true;
                let desiredTarget = target;
                const pending = new Set<Promise<CmajorStatePublicationOutcome>>();
                function close() { if (!active) return; active = false; pending.clear(); service.stop(); }
                function onDefect(error: unknown) {
                    if (!active) return;
                    close();
                    context.onDefect(error);
                }
                const publish = (effect: CmajorStateEffect) => {
                    if (!active) return { kind: "cancelled" } as const;
                    return context.publish(scope, effect);
                };
                const scopedConnection: PatchConnectionLike = {
                    addEndpointListener: (endpoint, listener) => connection.addEndpointListener?.(endpoint, listener),
                    removeEndpointListener: (endpoint, listener) => connection.removeEndpointListener?.(endpoint, listener),
                    addStoredStateValueListener: listener => connection.addStoredStateValueListener?.(listener),
                    removeStoredStateValueListener: listener => connection.removeStoredStateValueListener?.(listener),
                    requestFullStoredState: connection.requestFullStoredState?.bind(connection),
                    requestStoredStateValue: connection.requestStoredStateValue?.bind(connection),
                    sendEventOrValue(endpoint, value) {
                        const submission = publish({ kind: "event", endpoint, value });
                        if (submission.kind === "submitted") {
                            pending.add(submission.completion);
                            // Native refusal may produce no DSP ACK at all.
                            // Own the receipt immediately so the lane can stop
                            // waiting, and keep this distinct from raw handoff loss.
                            void submission.completion.then(outcome => {
                                pending.delete(submission.completion);
                                if (!active || outcome.kind === "sent") return;
                                close();
                                if (outcome.kind === "failed") context.onStatus(desiredTarget, outcome);
                            }, error => {
                                pending.delete(submission.completion);
                                onDefect(error);
                            });
                        }
                        // The lane's frontier recovery remains authoritative for
                        // an uncertain raw send. A definite preflight refusal
                        // cannot be repaired by repeatedly replaying the packet.
                        if (submission.kind === "failed" && submission.error.kind !== "transport") {
                            close();
                            context.onStatus(desiredTarget, submission);
                        }
                    },
                };
                const service = new ModulationArticulationWorkerService(scopedConnection, {
                    onDefect,
                    async publishTriggerConfig(config) {
                        const publications = await Promise.all(pending);
                        pending.clear();
                        const failed = publications.find(outcome => outcome.kind !== "sent");
                        if (failed) return failed;
                        const submission = publish({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: serializeArticulationTriggerConfig(config) });
                        return submission.kind === "submitted" ? submission.completion : submission;
                    },
                });
                return { scope, service, get closed() { return !active; }, setTarget(next) { desiredTarget = next; }, close };
            }

            return {
                replace(input, target) {
                    if (stopped) return;
                    const currentOperation = ++operation;
                    const parsed = parseModulationState(input.value);
                    if (parsed._tag === "err") {
                        context.onStatus(target, { kind: "failed", error: { kind: "engine-rejected", message: "Invalid modulation engine value." } });
                        return;
                    }
                    if (!document || document.closed || document.scope.owner !== target.scope.owner || document.scope.document !== target.scope.document) {
                        document?.close();
                        document = openDocument(target);
                    }
                    const currentDocument = document;
                    currentDocument.setTarget(target);
                    context.onStatus(target, { kind: "preparing" });
                    if (stopped || currentOperation !== operation || currentDocument.closed) return;
                    currentDocument.service.replaceModulation(parsed.value, status => context.onStatus(target, status));
                    if (stopped || currentOperation !== operation || currentDocument.closed) return;
                    currentDocument.service.start();
                },
                cancel() { operation += 1; document?.close(); document = undefined; },
                async stop() { if (stopped) return; stopped = true; operation += 1; document?.close(); document = undefined; },
            };
        },
    };
}
