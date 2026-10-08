import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadUIModule } from "../kit/tests/helpers/load_ui_module.mjs";
import { stageCmajorWebRuntime } from "../ui/vite.shared.mjs";
import { createSynthParameterFixture } from "./helpers/synth_parameter_fixture.mjs";
import {
    BOUNCE_PATCH_STORED_STATE_KEYS,
    bouncePatchDocumentChanges,
} from "../bounce/patch-document-adapter.mjs";
import {
    BOUNCE_STATE_KEY,
    LANE_STATE_KEY,
    attachBounceDocument,
    createBouncePatchDocument,
    createNeutralBouncePatchDocument,
    parseBounceDocument,
    serializeBounceDocument,
} from "../bounce/document.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { createMockPluginStateHost } = await loadUIModule(root, "ui/shared/mock-plugin-state-host.ts");
const { createCmajorPluginStateClient } = await loadUIModule(root, "kit/ui/plugin-state-cmajor.ts");
const { soundFieldKeys } = await loadUIModule(root, "kit/ui/plugin-state-definition.ts");
const { synthPluginState } = await loadUIModule(root, "ui/shared/synth-plugin-state.ts");
const { createDefaultLaneStateV2, serializeLaneStateV2 } = await loadUIModule(root, "ui/shared/lane-state-v2.ts");
const runtime = stageCmajorWebRuntime(root, {
    buildDirectory: path.join(root, "build/cmajor_web_runtime-bounce-state-tests"),
    instanceId: String(process.pid),
});
const loadChannel = () => import(pathToFileURL(path.join(runtime, "cmaj-plugin-state-channel.js")).href);

async function until(predicate) {
    const deadline = Date.now() + 2000;
    while (!predicate()) {
        assert.ok(Date.now() < deadline, "the plugin state did not converge");
        await new Promise((resolve) => setImmediate(resolve));
    }
}

function bounceReference(preBouncePatchDocument) {
    return parseBounceDocument({
        format: "cosimo.bounce",
        version: 1,
        digest: "a".repeat(64),
        bankByteLength: 1024,
        roots: [60],
        segments: [{ rootNote: 60, frameOffset: 0, frameCount: 4_800, noteOffFrameOffset: 2_400 }],
        capture: { sampleRate: 48_000, tempoBpm: 120, velocity: 100, holdFrames: 2_400, tailCapFrames: 2_400 },
        generation: 1,
        revertRef: { bankDigest: null, patchDocument: preBouncePatchDocument },
    });
}

/** The current sound as Bounce captures it: host parameters plus the saved documents. */
function capturePatchDocument(snapshot, parameters) {
    return createBouncePatchDocument({
        parameters: Object.fromEntries(parameters),
        storedState: Object.fromEntries(BOUNCE_PATCH_STORED_STATE_KEYS.map((key) => (
            [key, synthPluginState[key].codec.encode(snapshot.fields[key].value)]
        ))),
    });
}

test("neither the source mode nor the bounce reference is part of a preset or snapshot", () => {
    const sound = soundFieldKeys(synthPluginState);
    assert.equal(sound.includes("sourceMode"), false);
    assert.equal(sound.includes(BOUNCE_STATE_KEY), false);
    assert.equal(synthPluginState[BOUNCE_STATE_KEY].kind, "stored");
});

test("loading a bounced sound is one plugin-state edit, and one Undo restores the sound before it", async () => {
    const lane = createDefaultLaneStateV2();
    const enabledLane = { ...lane, chain: lane.chain.map((node) => ({ ...node, enabled: true })) };
    const stored = new Map([[LANE_STATE_KEY, serializeLaneStateV2(enabledLane)]]);
    const { values: parameters, readParameter } = createSynthParameterFixture({ filterMode: 3, sourceMode: 0 });
    const defects = [];
    const host = createMockPluginStateHost({
        loadChannel,
        readParameter,
        writeParameter(endpoint, value) { parameters.set(endpoint, value); },
        storedValues: { read: (key) => stored.get(key), write: (key, value) => { stored.set(key, value); } },
        beginGesture() {}, endGesture() {}, onDefect: (error) => defects.push(String(error)),
    });
    const client = createCmajorPluginStateClient(synthPluginState, host, { onDefect: (error) => defects.push(String(error)) });
    try {
        await host.ready;
        await until(() => client.getSnapshot().kind === "ready");
        const before = client.getSnapshot().state;
        assert.equal(before.fields[BOUNCE_STATE_KEY].value, null);

        const preBounce = capturePatchDocument(before, parameters);
        const reference = bounceReference(preBounce);
        const loaded = attachBounceDocument(createNeutralBouncePatchDocument(preBounce), reference);
        const changes = bouncePatchDocumentChanges(synthPluginState, loaded);
        assert.equal(changes.sourceMode, 1);
        assert.equal(changes.filterMode, 0);
        assert.deepEqual(changes[BOUNCE_STATE_KEY], reference);
        assert.ok(changes[LANE_STATE_KEY].chain.every((node) => node.enabled === false));
        assert.ok(Object.keys(changes).every((key) => Object.hasOwn(synthPluginState, key)));

        const edits = Object.entries(changes).map(([key, value]) => ({ key, value, expectedVersion: before.fields[key].version }));
        assert.equal((await client.dispatch({ kind: "edit-many", edits })).kind, "accepted");
        await until(() => parameters.get("sourceMode") === 1 && stored.get(BOUNCE_STATE_KEY) !== undefined);
        assert.equal(parameters.get("filterMode"), 0);
        assert.equal(stored.get(BOUNCE_STATE_KEY), serializeBounceDocument(reference));
        assert.ok(JSON.parse(stored.get(LANE_STATE_KEY)).chain.every((node) => node.enabled === false));
        assert.equal(client.getSnapshot().state.history.canUndo, true);

        assert.equal((await client.dispatch({ kind: "undo" })).kind, "accepted");
        await until(() => parameters.get("sourceMode") === 0 && stored.get(BOUNCE_STATE_KEY) === null);
        assert.equal(parameters.get("filterMode"), 3);
        assert.equal(stored.get(LANE_STATE_KEY), serializeLaneStateV2(enabledLane));
        assert.equal(client.getSnapshot().state.fields[BOUNCE_STATE_KEY].value, null);
        assert.equal(client.getSnapshot().state.history.canUndo, false, "the whole bounce was one Undo entry");
        assert.deepEqual(defects, []);
    } finally {
        client.stop();
        await host.stop();
    }
});

test("a patch document the synth cannot use is refused before any edit, naming the document", () => {
    const document = createBouncePatchDocument({
        parameters: { sourceMode: 1, notASynthParameter: 4 },
        storedState: { [LANE_STATE_KEY]: "{\"format\":\"cosimo.lane\",\"version\":1}" },
    });
    assert.throws(() => bouncePatchDocumentChanges(synthPluginState, document), /bounced sound's lane\.v1 cannot be loaded/);

    const parametersOnly = createBouncePatchDocument({ parameters: { sourceMode: 1, notASynthParameter: 4 }, storedState: {} });
    assert.deepEqual(bouncePatchDocumentChanges(synthPluginState, parametersOnly), { sourceMode: 1 });
});
