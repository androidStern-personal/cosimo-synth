import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

class RackPatchConnection {
    constructor(initialRack) {
        this.initialRack = initialRack;
        this.listeners = new Set();
        this.events = [];
        this.storedWrites = [];
        this.deferStoredEchoes = false;
        this.pendingStoredEchoes = [];
    }

    addStoredStateValueListener(listener) {
        this.listeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.listeners.delete(listener);
    }

    requestFullStoredState(callback) {
        callback({ values: { "lane.v1": this.initialRack } });
    }

    sendEventOrValue(endpointID, value) {
        this.events.push({ endpointID, value });
    }

    sendStoredStateValue(key, value) {
        this.storedWrites.push({ key, value });
        if (this.deferStoredEchoes) {
            this.pendingStoredEchoes.push({ key, value });
            return;
        }
        this.emitStoredState(key, value);
    }

    emitStoredState(key, value) {
        for (const listener of this.listeners) {
            listener({ key, value });
        }
    }
}

test("production synth Init options derive canonical documents from the current adapter contract", async () => {
    const [initState, modulation, articulations] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/effects/synth-init-state.ts"),
        loadUIModule(repoRoot, "ui/shared/modulation.ts"),
        loadUIModule(repoRoot, "ui/shared/articulation-image.ts"),
    ]);
    const connection = new RackPatchConnection(undefined);
    const storedStateAdapters = [
        { key: "modulation.v6" },
        { key: "articulations.v4" },
        { key: "bounce.v1" },
    ];
    const options = initState.createSynthPresetInitOptions(connection, storedStateAdapters);
    const canonical = options.createCanonicalStoredState({
        storedState: [
            { key: "articulations.v4", schemaVersion: 4, required: true },
            { key: "bounce.v1", schemaVersion: 1, required: true },
            { key: "modulation.v6", schemaVersion: 6, required: true },
        ],
    });

    assert.deepEqual(
        modulation.parseModulationState(canonical["modulation.v6"]).value,
        modulation.createDefaultModulationState(),
    );
    assert.deepEqual(
        articulations.parseArticulationsV4(canonical["articulations.v4"], new Set()).value,
        articulations.createEmptyArticulationsState(),
    );
    assert.equal(canonical["bounce.v1"], null);
    assert.deepEqual(options.initOnlyStateAdapters.map((adapter) => adapter.key), ["lane.v1"]);
    assert.throws(() => options.createCanonicalStoredState({
        storedState: [{ key: "unknown.v1", schemaVersion: 1, required: true }],
    }), /no canonical Init document.*unknown\.v1/i);
    assert.throws(() => options.createCanonicalStoredState({
        storedState: [{ key: "modulation.v6", schemaVersion: 7, required: true }],
    }), /canonical Init document modulation\.v6 is version 6, not 7/i);
});

test("the Init-only rack adapter strictly hydrates, applies runtime and stored state, and suppresses its own echo", async () => {
    const [initState, laneV2] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/effects/synth-init-state.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
    ]);
    const full = laneV2.createFullDefaultLaneStateV2();
    const initialRack = {
        ...full,
        chain: [...full.chain].reverse().map((node) => (
            node.deviceId === "chorus#1" ? { ...node, enabled: true } : node
        )),
    };
    const connection = new RackPatchConnection(laneV2.serializeLaneStateV2(initialRack));
    const adapter = initState.createSynthRackInitStateAdapter(connection);
    let notifications = 0;
    const unsubscribe = adapter.subscribe(() => {
        notifications += 1;
    });

    assert.deepEqual(adapter.capture(), initialRack);
    assert.deepEqual(adapter.createDefaultValue(), laneV2.createDefaultLaneStateV2());
    assert.deepEqual(adapter.createDefaultValue().output, { mix: 1, bypassed: false });
    assert.deepEqual(
        adapter.normalizeForTransaction(laneV2.serializeLaneStateV2(initialRack)),
        initialRack,
    );

    const nextRack = laneV2.setLaneOutputBypassed(
        laneV2.setLaneOutputMix(laneV2.createDefaultLaneStateV2(), 0.37),
        true,
    );
    adapter.apply(nextRack);
    // The output control lands before the starter trio's records/topology, so
    // a bypassed or partial-Mix preset cannot flash full-wet while it restores.
    assert.deepEqual(
        connection.events.map((event) => event.endpointID),
        [
            "laneOutputControl",
            "laneDistortion1OutputTrimDb", "laneSlotParams",
            "laneDelay1OutputTrimDb", "laneSlotParams",
            "laneReverb1OutputTrimDb", "laneSlotParams",
            "laneTopology",
        ],
    );
    assert.deepEqual(connection.events[0].value, { mix: 0.37, bypassed: true });
    assert.equal(connection.storedWrites.length, 1);
    assert.deepEqual(JSON.parse(connection.storedWrites[0].value), nextRack);
    assert.equal(notifications, 0);

    connection.emitStoredState("lane.v1", laneV2.serializeLaneStateV2(initialRack));
    assert.equal(notifications, 1);
    assert.deepEqual(adapter.capture(), initialRack);
    unsubscribe();
});

test("the rack adapter rejects corrupt hydration instead of silently retaining or defaulting it", async () => {
    const initState = await loadUIModule(repoRoot, "ui/shared/effects/synth-init-state.ts");
    const connection = new RackPatchConnection("{not-json");
    const adapter = initState.createSynthRackInitStateAdapter(connection);
    const unsubscribe = adapter.subscribe(() => {});

    assert.throws(() => adapter.capture(), /lane\.v2 is not valid JSON/i);
    unsubscribe();
});

test("rack preset and share intake reject lane-v1 and missing T78 trims before any write", async () => {
    const [initState, laneV1, laneV2] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/effects/synth-init-state.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
    ]);
    const current = laneV2.createDefaultLaneStateV2();
    const connection = new RackPatchConnection(laneV2.serializeLaneStateV2(current));
    const adapter = initState.createSynthRackInitStateAdapter(connection);
    const unsubscribe = adapter.subscribe(() => {});

    const laneV1Document = laneV1.serializeLaneState(laneV1.createDefaultLaneState());
    const missingTrimDocument = JSON.parse(laneV2.serializeLaneStateV2(current));
    delete missingTrimDocument.devices["delay#1"].params.delayOutputTrimDb;

    for (const rejected of [laneV1Document, missingTrimDocument]) {
        assert.throws(() => adapter.normalizeForTransaction(rejected), /lane\.v2/i);
        assert.throws(() => adapter.apply(rejected), /lane\.v2/i);
        assert.deepEqual(connection.events, [], "rejection must precede every runtime parameter write");
        assert.deepEqual(connection.storedWrites, [], "rejection must precede every stored-state write");
        assert.deepEqual(adapter.capture(), current, "rejection must leave the accepted sound untouched");
    }

    unsubscribe();
});

test("out-of-order rack installation echoes cannot replace the newest loaded rack or mark it edited", async () => {
    const [initState, laneV2] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/effects/synth-init-state.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts"),
    ]);
    const base = laneV2.createDefaultLaneStateV2();
    const firstRack = laneV2.setLaneDeviceEnabled(base, "delay#1", true);
    const secondRack = laneV2.setLaneDeviceEnabled(base, "reverb#1", true);
    const userRack = laneV2.setLaneDeviceEnabled(base, "distortion#1", true);
    assert.notEqual(firstRack, null);
    assert.notEqual(secondRack, null);
    assert.notEqual(userRack, null);
    const connection = new RackPatchConnection(laneV2.serializeLaneStateV2(base));
    connection.deferStoredEchoes = true;
    const adapter = initState.createSynthRackInitStateAdapter(connection);
    let notifications = 0;
    const unsubscribe = adapter.subscribe(() => {
        notifications += 1;
    });

    adapter.apply(firstRack);
    adapter.apply(secondRack);
    for (const echo of connection.pendingStoredEchoes.splice(0).reverse()) {
        connection.emitStoredState(echo.key, echo.value);
    }
    assert.equal(notifications, 0);
    assert.deepEqual(adapter.capture(), secondRack);

    connection.emitStoredState("lane.v1", laneV2.serializeLaneStateV2(userRack));
    assert.equal(notifications, 1);
    assert.deepEqual(adapter.capture(), userRack);
    unsubscribe();
});

test("the desktop synth preset-bar wiring opts into canonical Init without changing shared effect bars", async () => {
    const source = await fs.readFile(
        path.join(repoRoot, "ui/desktop/DesktopPatchView.tsx"),
        "utf8",
    );
    const presetHostStart = source.indexOf("function SynthPresetBarHost(");
    const presetHostEnd = source.indexOf("\n}\n", presetHostStart);
    const presetHost = source.slice(presetHostStart, presetHostEnd);

    assert.match(source, /import \{ createSynthPresetInitOptions \} from "\.\.\/shared\/effects\/synth-init-state";/);
    assert.match(
        presetHost,
        /synth: createSynthPresetInitOptions\(patchConnection, storedStateAdapters, \{[\s\S]*getShippedWavetableTables/,
    );
});
