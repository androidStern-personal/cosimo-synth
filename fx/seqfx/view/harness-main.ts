import { createSeqFxPatchView } from "./source";
import { createSeqFxWorkerService } from "../worker/seqfx-worker-service";

type Listener = (value: unknown) => void;

class SeqFxHarnessPatchConnection {
    storedState: Record<string, unknown> = {};
    events: Array<{ endpointID: string; value: unknown }> = [];
    parameters: Record<string, unknown> = {
        patternSelect: 0,
        rate: 1,
    };
    status = {
        details: {
            inputs: [],
        },
    };

    private statusListeners = new Set<Listener>();
    private storedStateListeners = new Set<Listener>();
    private parameterListeners = new Map<string, Set<Listener>>();
    private endpointListeners = new Map<string, Set<Listener>>();

    addStatusListener(listener: Listener) {
        this.statusListeners.add(listener);
    }

    removeStatusListener(listener: Listener) {
        this.statusListeners.delete(listener);
    }

    requestStatusUpdate() {
        for (const listener of this.statusListeners) {
            listener(this.status);
        }
    }

    addStoredStateValueListener(listener: Listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener: Listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback: (state: Record<string, unknown>) => void) {
        callback({
            parameters: { ...this.parameters },
            values: { ...this.storedState },
        });
    }

    requestStoredStateValue(key: string) {
        for (const listener of this.storedStateListeners) {
            listener({ key, value: this.storedState[key] });
        }
    }

    sendStoredStateValue(key: string, value: unknown) {
        this.storedState[key] = value;
        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }
    }

    addParameterListener(endpointID: string, listener: Listener) {
        const listeners = this.parameterListeners.get(endpointID) ?? new Set<Listener>();
        listeners.add(listener);
        this.parameterListeners.set(endpointID, listeners);
    }

    removeParameterListener(endpointID: string, listener: Listener) {
        this.parameterListeners.get(endpointID)?.delete(listener);
    }

    requestParameterValue(endpointID: string) {
        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(this.parameters[endpointID] ?? 0);
        }
    }

    sendEventOrValue(endpointID: string, value: unknown) {
        this.events.push({ endpointID, value });
        this.emitParameter(endpointID, value);
    }

    emitParameter(endpointID: string, value: unknown) {
        this.parameters[endpointID] = value;
        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }

    addEndpointListener(endpointID: string, listener: Listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? new Set<Listener>();
        listeners.add(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID: string, listener: Listener) {
        this.endpointListeners.get(endpointID)?.delete(listener);
    }

    emitEndpoint(endpointID: string, value: unknown) {
        for (const listener of this.endpointListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }

    getSnapshot() {
        return {
            events: [...this.events],
            storedState: { ...this.storedState },
            parameters: { ...this.parameters },
        };
    }
}

declare global {
    interface Window {
        __SEQFX_HARNESS__?: {
            patchConnection: SeqFxHarnessPatchConnection;
            getSnapshot: () => ReturnType<SeqFxHarnessPatchConnection["getSnapshot"]>;
            clearEvents: () => void;
            emitParameter: (endpointID: string, value: unknown) => void;
            emitMonitor: (stepIndex: number) => void;
        };
    }
}

const root = document.getElementById("root");

if (!root) {
    throw new Error("SeqFX harness root is missing.");
}

const patchConnection = new SeqFxHarnessPatchConnection();
const workerService = createSeqFxWorkerService(patchConnection);
workerService.start();
const view = createSeqFxPatchView(patchConnection);
root.appendChild(view);

window.__SEQFX_HARNESS__ = {
    patchConnection,
    getSnapshot: () => patchConnection.getSnapshot(),
    clearEvents: () => {
        patchConnection.events = [];
    },
    emitParameter: (endpointID: string, value: unknown) => {
        patchConnection.emitParameter(endpointID, value);
    },
    emitMonitor: (stepIndex: number) => {
        patchConnection.emitEndpoint("monitorOut", {
            patternIndex: patchConnection.parameters.patternSelect ?? 0,
            stepIndex,
            transportRunning: true,
            stepProgress: 0,
        });
    },
};
