import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateModule = await loadUIModule(repoRoot, "fx/spectral_chord_resonator/view/spectral-partial-state.ts");
const workerModule = await loadUIModule(repoRoot, "fx/spectral_chord_resonator/worker/spectral-worker-service.ts");

const {
    SPECTRAL_PARTIAL_STATE_KEY,
    applySpectralPartialPreset,
    createDefaultSpectralPartialState,
    serializeSpectralPartialState,
} = stateModule;

const {
    createSpectralWorkerService,
} = workerModule;

class FakePatchConnection {
    constructor(storedState = {}) {
        this.storedState = { ...storedState };
        this.events = [];
        this.storedWrites = [];
        this.storedStateListeners = new Set();
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback) {
        callback({ values: { ...this.storedState } });
    }

    requestStoredStateValue(key) {
        for (const listener of this.storedStateListeners) {
            listener({ key, value: this.storedState[key] });
        }
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
    }
}

test("spectral_worker_uploads_saved_partial_shape_without_writing_stored_state", () => {
    const square = applySpectralPartialPreset(createDefaultSpectralPartialState(), "square");
    const connection = new FakePatchConnection({
        [SPECTRAL_PARTIAL_STATE_KEY]: serializeSpectralPartialState(square),
    });
    const worker = createSpectralWorkerService(connection);

    worker.start();

    assert.deepEqual(connection.storedWrites, []);
    assert.equal(connection.events.length, 1);
    assert.equal(connection.events[0].endpointID, "partialShapeUpload");
    assert.equal(connection.events[0].value.count, square.count);
    assert.equal(connection.events[0].value.strengths[1], 0);
});
