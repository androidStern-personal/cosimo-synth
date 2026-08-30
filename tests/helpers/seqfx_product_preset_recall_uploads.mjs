import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const stateModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");
const bridgeModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-runtime-bridge.ts");
const adapterModule = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-preset-adapter.ts");
const workerModule = await loadUIModule(repoRoot, "fx/seqfx/worker/seqfx-worker-service.ts");

const {
    SEQFX_LANES,
    SEQFX_STATE_KEY,
    applySeqFxBlockCreate,
    applySeqFxBlockParamEdit,
    createDefaultSeqFxState,
    serializeSeqFxState,
} = stateModule;
const { SEQFX_ENDPOINTS, SeqFxRuntimeBridge } = bridgeModule;
const { createSeqFxPresetStateAdapter } = adapterModule;
const { createSeqFxWorkerService } = workerModule;

class ProductPathPatchConnection {
    constructor(storedState) {
        this.storedState = { ...storedState };
        this.parameters = { patternSelect: 0, rate: 2 };
        this.events = [];
        this.storedStateListeners = new Set();
        this.parameterListeners = new Map();
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback) {
        callback({
            parameters: { ...this.parameters },
            values: { ...this.storedState },
        });
    }

    requestStoredStateValue(key) {
        this.emitStoredState(key, this.storedState[key]);
    }

    sendStoredStateValue(key, value) {
        this.storedState[key] = value;
        this.emitStoredState(key, value);
    }

    addParameterListener(endpointID, listener) {
        const listeners = this.parameterListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.parameterListeners.set(endpointID, listeners);
    }

    removeParameterListener(endpointID, listener) {
        this.parameterListeners.get(endpointID)?.delete(listener);
    }

    requestParameterValue(endpointID) {
        this.emitParameter(endpointID, this.parameters[endpointID]);
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
        if (endpointID === SEQFX_ENDPOINTS.patternSelect) {
            this.emitParameter(endpointID, value);
        }
    }

    emitStoredState(key, value) {
        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }
    }

    emitParameter(endpointID, value) {
        this.parameters[endpointID] = value;
        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }
}

function patternUploads(connection) {
    return connection.events
        .filter(({ endpointID }) => endpointID === SEQFX_ENDPOINTS.patternUpload)
        .map(({ value }) => value);
}

let initialState = applySeqFxBlockCreate(createDefaultSeqFxState(), {
    patternIndex: 0,
    lane: SEQFX_LANES.stutter,
    startStep: 0,
    length: 1,
});
for (const [paramIndex, value] of [8, 1, 0, 1].entries()) {
    initialState = applySeqFxBlockParamEdit(initialState, {
        patternIndex: 0,
        lane: SEQFX_LANES.stutter,
        startStep: 0,
        paramIndex,
        value,
    });
}

const recalledState = structuredClone(initialState);
recalledState.patterns[0].revision = initialState.patterns[0].revision + 1;

const connection = new ProductPathPatchConnection({
    [SEQFX_STATE_KEY]: serializeSeqFxState(initialState),
});
const worker = createSeqFxWorkerService(connection);
const bridge = new SeqFxRuntimeBridge(connection);
const adapter = createSeqFxPresetStateAdapter({ bridge, patchConnection: connection });

worker.start();
bridge.attach();
bridge.requestBootState();
const initialUpload = patternUploads(connection).at(-1);

connection.events = [];
adapter.apply(serializeSeqFxState(recalledState));
const replacementUploads = patternUploads(connection);

bridge.detach();
worker.stop();

if (!initialUpload || replacementUploads.length === 0) {
    throw new Error("The SeqFX product preset path did not produce the expected runtime uploads.");
}

process.stdout.write(JSON.stringify({ initialUpload, replacementUploads }));
