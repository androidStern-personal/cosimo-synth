import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";
import { hostStatusInputs } from "./helpers/stock_controls_view_harness.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const { default: definition } = await loadUIModule(repoRoot, "fx/seqfx/state.ts");
const { createCmajorPluginStateService } = await loadUIModule(repoRoot, "kit/ui/plugin-state-cmajor.ts");
const { soundFieldKeys } = await loadUIModule(repoRoot, "kit/ui/plugin-state-definition.ts");
const {
    SEQFX_EFFECT_TYPES,
    SEQFX_LANES,
    applySeqFxBlockCreate,
    applySeqFxBlockParamEdit,
    createDefaultSeqFxState,
    seqFxPatternsCodec,
} = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-state.ts");
const { SEQFX_FACTORY_PATTERNS } = await loadUIModule(repoRoot, "fx/seqfx/view/seqfx-factory-content.ts");
const hostParameters = await hostStatusInputs(path.join(repoRoot, "fx/seqfx/SeqFx.cmajor"));

test("state.ts declares each of the DSP's nine automatable parameters once", () => {
    const declared = Object.values(definition).filter((field) => field.kind === "parameter").map((field) => field.endpoint);
    assert.deepEqual([...declared].sort(), hostParameters.map(({ endpointID }) => endpointID).sort());
    assert.equal(new Set(declared).size, declared.length);
});

test("a preset or snapshot holds the global controls and all twelve patterns", () => {
    assert.deepEqual(soundFieldKeys(definition), [
        "enabled", "mix", "selectedPattern", "clock", "manualBpm", "rate", "swing", "loopStart", "loopLength", "patterns",
    ]);
    assert.ok(definition.snapshotSlots && definition.activeSnapshot);
});

test("each factory pattern ships as a factory preset that loads it into the first slot", () => {
    const factory = definition.presetLibrary.factory;
    assert.deepEqual(factory.map(({ id, name }) => ({ id, name })), SEQFX_FACTORY_PATTERNS.map(({ id, name }) => ({ id, name })));
    for (const preset of factory) {
        const [first, ...rest] = preset.values.patterns.patterns;
        assert.ok(first.lanes.some((lane) => lane.steps.some((step) => step.active)), `${preset.name} fills pattern 1`);
        assert.ok(rest.every((pattern) => pattern.lanes.every((lane) => lane.steps.every((step) => !step.active))),
            `${preset.name} leaves patterns 2-12 empty`);
        assert.equal(preset.values.selectedPattern, 0);
    }
});

/** Each init annotation the DSP declares, as the default a factory preset must use. */
test("factory presets set every global control to the DSP's own default", () => {
    const defaults = Object.fromEntries(hostParameters.map(({ endpointID, annotation }) => [endpointID, annotation.init]));
    for (const preset of definition.presetLibrary.factory) {
        for (const [key, field] of Object.entries(definition)) {
            if (field.kind === "parameter") {
                assert.equal(preset.values[key], defaults[field.endpoint], `${preset.name} ${key}`);
            }
        }
    }
});

// The raw PatchConnection seam the generated worker talks through. It acknowledges
// each publication as the native host would; the state service is real.
class RecordingPatchConnection {
    sent = [];
    listeners = new Map();
    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) ?? new Set();
        listeners.add(listener);
        this.listeners.set(type, listeners);
    }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    sendMessageToServer(message) {
        const body = JSON.parse(JSON.stringify(message.message));
        this.sent.push(body);
        if (body.kind === "publish") {
            queueMicrotask(() => this.deliver({ kind: "published", request: body.request, scope: body.scope, result: { kind: "observed" } }));
        }
    }
    deliver(body) { for (const listener of this.listeners.get("kit_state") ?? []) listener(JSON.parse(JSON.stringify(body))); }
    operations() { return this.sent.filter((body) => body.kind === "publish").flatMap((body) => body.operations); }
    uploads() { return this.operations().filter((operation) => operation.kind === "event" && operation.endpoint === "patternUpload").map((operation) => operation.value); }
    storedWrites() { return this.operations().filter((operation) => operation.kind === "stored"); }
    lastUpdate() { return this.sent.filter((body) => body.kind === "update").at(-1); }
}

const scope = { owner: "seqfx-test", document: 0 };
const settle = () => new Promise(setImmediate);

async function openWorker(t, { savedValues = {}, parameterValues = {} } = {}) {
    const connection = new RecordingPatchConnection();
    const defects = [];
    const service = createCmajorPluginStateService(definition, connection, { onDefect: (error) => defects.push(error) });
    t.after(() => service.stop());
    const starting = service.start();
    assert.deepEqual(connection.sent.find((body) => body.kind === "open").eventEndpoints, ["patternUpload"]);
    connection.deliver({ kind: "opened", request: 1, scope, native: {
        parameters: hostParameters.map(({ endpointID, annotation }) => ({
            endpoint: endpointID, value: parameterValues[endpointID] ?? annotation.init,
            min: annotation.min, max: annotation.max, step: annotation.step ?? 0, defaultValue: annotation.init,
        })),
        values: savedValues,
    } });
    await starting;
    await settle();
    let sequence = 0;
    const command = async (body) => {
        connection.deliver({ kind: "command", address: { ...scope, client: 1, sequence: ++sequence }, command: body });
        await settle();
    };
    return { connection, defects, command };
}

function withStutterBlock(state, slices) {
    let next = applySeqFxBlockCreate(state, { patternIndex: 0, lane: SEQFX_LANES.stutter, startStep: 0, length: 1 });
    next = applySeqFxBlockParamEdit(next, { patternIndex: 0, lane: SEQFX_LANES.stutter, startStep: 0, paramIndex: 0, value: slices });
    return next;
}

test("a new instance sends the empty first pattern as a replacement, without saving anything", async (t) => {
    const { connection, defects } = await openWorker(t);
    const [upload] = connection.uploads();
    assert.equal(connection.uploads().length, 1);
    assert.equal(upload.patternIndex, 0);
    assert.equal(upload.authoritative, true, "a fresh project clears whatever the DSP had captured");
    assert.ok(upload.activeSteps.flat().every((active) => active === false));
    assert.deepEqual(connection.storedWrites(), []);
    assert.deepEqual(defects, []);
});

test("a project's saved patterns reach the DSP for the selected pattern", async (t) => {
    const saved = withStutterBlock(createDefaultSeqFxState(), 8);
    const { connection, defects } = await openWorker(t, { savedValues: { patterns: seqFxPatternsCodec.encode(saved) } });
    const upload = connection.uploads().at(-1);
    assert.equal(upload.activeSteps[SEQFX_LANES.stutter][0], true);
    assert.equal(upload.effectTypes[SEQFX_LANES.stutter][0], SEQFX_EFFECT_TYPES.stutter);
    assert.equal(upload.params[SEQFX_LANES.stutter][0][0], 8);
    assert.deepEqual(defects, []);
});

test("an edit is saved, sent as an ordinary update, and undone through the same path", async (t) => {
    const { connection, defects, command } = await openWorker(t);
    const edited = withStutterBlock(createDefaultSeqFxState(), 8);
    await command({ kind: "edit", key: "patterns", value: seqFxPatternsCodec.encode(edited) });
    const editUpload = connection.uploads().at(-1);
    assert.equal(editUpload.authoritative, false, "an edit relatches without clearing captured audio");
    assert.equal(editUpload.activeSteps[SEQFX_LANES.stutter][0], true);
    assert.deepEqual(connection.storedWrites().at(-1), { kind: "stored", key: "patterns", value: seqFxPatternsCodec.encode(edited) });
    assert.equal(connection.lastUpdate().state.history.canUndo, true);

    await command({ kind: "undo" });
    const undoUpload = connection.uploads().at(-1);
    assert.equal(undoUpload.authoritative, false);
    assert.equal(undoUpload.activeSteps[SEQFX_LANES.stutter][0], false);
    assert.ok(undoUpload.revision > editUpload.revision, "the DSP accepts the restored pattern as newer");
    assert.deepEqual(defects, []);
});

test("a recalled preset or snapshot replaces the sound and clears captured audio", async (t) => {
    const { connection, defects, command } = await openWorker(t);
    await command({ kind: "edit", key: "patterns", value: seqFxPatternsCodec.encode(withStutterBlock(createDefaultSeqFxState(), 8)) });
    const before = connection.uploads().length;
    const recalled = withStutterBlock(createDefaultSeqFxState(), 4);
    await command({ kind: "edit-many", recall: true, edits: [{ key: "patterns", value: seqFxPatternsCodec.encode(recalled) }] });
    const uploads = connection.uploads().slice(before);
    assert.equal(uploads.length, 1, "one recall sends the selected pattern once");
    assert.equal(uploads[0].authoritative, true);
    assert.equal(uploads[0].params[SEQFX_LANES.stutter][0][0], 4);
    assert.deepEqual(defects, []);
});

test("selecting another pattern sends that pattern as an ordinary update", async (t) => {
    const saved = createDefaultSeqFxState();
    const withSecondPattern = applySeqFxBlockCreate(saved, { patternIndex: 3, lane: SEQFX_LANES.filter, startStep: 2, length: 2 });
    const { connection, defects } = await openWorker(t, { savedValues: { patterns: seqFxPatternsCodec.encode(withSecondPattern) } });
    const before = connection.uploads().at(-1);
    connection.deliver({ kind: "parameter", scope, endpoint: "patternSelect", value: 3, intent: 0, origin: "external", observation: 1 });
    await settle();
    const after = connection.uploads().at(-1);
    assert.equal(after.patternIndex, 3);
    assert.equal(after.authoritative, false);
    assert.equal(after.activeSteps[SEQFX_LANES.filter][2], true);
    assert.ok(after.revision > before.revision);
    assert.deepEqual(defects, []);
});

test("a drag across many pattern values records one Undo entry", async (t) => {
    const { connection, defects, command } = await openWorker(t);
    await command({ kind: "begin", keys: ["patterns"], gesture: 1 });
    for (const slices of [2, 4, 8]) {
        await command({ kind: "edit", key: "patterns", gesture: 1, value: seqFxPatternsCodec.encode(withStutterBlock(createDefaultSeqFxState(), slices)) });
    }
    await command({ kind: "end", keys: ["patterns"], gesture: 1 });
    assert.equal(connection.uploads().at(-1).params[SEQFX_LANES.stutter][0][0], 8);
    await command({ kind: "undo" });
    assert.equal(connection.uploads().at(-1).activeSteps[SEQFX_LANES.stutter][0], false, "one Undo returns to before the drag");
    assert.equal(connection.lastUpdate().state.history.canUndo, false);
    assert.deepEqual(defects, []);
});

test("unreadable saved patterns are reported, never sent to the DSP or replaced by defaults", async (t) => {
    const { connection, defects } = await openWorker(t, { savedValues: { patterns: { version: 8, patterns: [] } } });
    assert.deepEqual(connection.uploads(), []);
    assert.deepEqual(connection.storedWrites(), []);
    assert.deepEqual(defects, []);
});
