import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";
import { hostStatusInputs } from "./helpers/stock_controls_view_harness.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const { default: definition } = await loadUIModule(repoRoot, "fx/spectral_chord_resonator/state.ts");
const { createCmajorPluginStateService } = await loadUIModule(repoRoot, "kit/ui/plugin-state-cmajor.ts");
const { soundFieldKeys } = await loadUIModule(repoRoot, "kit/ui/plugin-state-definition.ts");
const { defaultPartialShape, partialShapeCodec, withStrength, withTemplate } = await loadUIModule(repoRoot, "fx/spectral_chord_resonator/view/partial-shape.ts");
const hostParameters = await hostStatusInputs(path.join(repoRoot, "fx/spectral_chord_resonator/SpectralChordResonator.cmajor"));

test("state.ts declares every host parameter once, with the slot-zero guard first and outside every sound", () => {
    const parameterFields = Object.entries(definition).filter(([, field]) => field.kind === "parameter");
    assert.deepEqual(parameterFields.map(([, field]) => field.endpoint), hostParameters.map(({ endpointID }) => endpointID),
        "one field per annotated host parameter, in the patch's order");
    assert.equal(hostParameters[0].endpointID, "hostSlot0Guard");
    assert.equal(Object.keys(definition)[0], "hostSlot0Guard");
    assert.equal(definition.hostSlot0Guard.preset, false);
});

test("a preset or snapshot holds the eleven visible parameters and the partial shape", () => {
    assert.deepEqual(soundFieldKeys(definition), [
        "magFeedback", "phaseFeedback", "damping", "magCeiling", "depth", "lowCutHz", "maskWidthCents", "maskFloor",
        "voiceMode", "polyphony", "voiceReleaseSeconds", "spectralMode", "partialShape",
    ]);
    assert.deepEqual(definition.presetLibrary.factory, [], "Spectral ships no factory presets");
    assert.ok(definition.snapshotSlots && definition.activeSnapshot);
});

// The raw PatchConnection seam the generated worker talks through. It records
// outgoing messages and delivers native replies; the state service is real.
class RecordingPatchConnection {
    sent = [];
    listeners = new Map();
    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
    }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    sendMessageToServer(message) { this.sent.push(JSON.parse(JSON.stringify(message))); }
    deliver(body) { for (const listener of this.listeners.get("kit_state") ?? []) listener(JSON.parse(JSON.stringify(body))); }
    bodies(kind) { return this.sent.filter(message => message.type === "kit_state" && message.message.kind === kind).map(message => message.message); }
    uploads() {
        return this.bodies("publish").flatMap(publication => publication.operations)
            .filter(operation => operation.kind === "event" && operation.endpoint === "partialShapeUpload")
            .map(operation => operation.value);
    }
    storedWrites() { return this.bodies("publish").flatMap(publication => publication.operations).filter(operation => operation.kind === "stored"); }
}

const scope = { owner: "spectral-test", document: 0 };
const settle = () => new Promise(setImmediate);

async function openWorker(t, savedValues = {}) {
    const connection = new RecordingPatchConnection();
    const defects = [];
    const service = createCmajorPluginStateService(definition, connection, { onDefect: error => defects.push(error) });
    t.after(() => service.stop());
    const starting = service.start();
    assert.deepEqual(connection.bodies("open")[0].eventEndpoints, ["partialShapeUpload"]);
    connection.deliver({ kind: "opened", request: 1, scope, native: {
        parameters: hostParameters.map(({ endpointID, annotation }) => ({ endpoint: endpointID, value: annotation.init,
            min: annotation.min, max: annotation.max, step: annotation.step ?? 0, defaultValue: annotation.init })),
        values: savedValues,
    } });
    await starting;
    await settle();
    return { connection, defects };
}

test("a new instance sends the default saw shape to the DSP without saving anything", async t => {
    const { connection, defects } = await openWorker(t);
    assert.deepEqual(connection.uploads(), [{ count: 32, strengths: [...defaultPartialShape.strengths] }]);
    assert.deepEqual(connection.storedWrites(), []);
    assert.deepEqual(defects, []);
});

test("a project's saved shape reaches the DSP when the plugin opens", async t => {
    const square = withTemplate(defaultPartialShape, "square");
    const { connection, defects } = await openWorker(t, { partialShape: partialShapeCodec.encode(square) });
    assert.equal(connection.uploads().length, 1);
    assert.equal(connection.uploads()[0].strengths[1], 0, "the square shape has no even harmonics");
    assert.deepEqual(connection.storedWrites(), []);
    assert.deepEqual(defects, []);
});

test("a partial edit is saved with the project, sent to the DSP and undoable", async t => {
    const { connection, defects } = await openWorker(t);
    const edited = withStrength(defaultPartialShape, 3, 0.9);
    connection.deliver({ kind: "command", address: { ...scope, client: 1, sequence: 1 },
        command: { kind: "edit", key: "partialShape", value: partialShapeCodec.encode(edited) } });
    await settle();
    assert.equal(connection.uploads().at(-1).strengths[3], 0.9);
    assert.deepEqual(connection.storedWrites().at(-1), { kind: "stored", key: "partialShape", value: partialShapeCodec.encode(edited) });
    assert.equal(connection.bodies("update").at(-1).state.history.canUndo, true);
    assert.deepEqual(defects, []);
});
