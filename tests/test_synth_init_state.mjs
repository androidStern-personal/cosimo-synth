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
    ];
    const options = initState.createSynthPresetInitOptions(connection, storedStateAdapters);
    const canonical = options.createCanonicalStoredState({
        storedState: [
            { key: "articulations.v4", schemaVersion: 4, required: true },
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
    assert.deepEqual(options.initOnlyStateAdapters.map((adapter) => adapter.key), ["lane.v1"]);
    assert.throws(() => options.createCanonicalStoredState({
        storedState: [{ key: "unknown.v1", schemaVersion: 1, required: true }],
    }), /no canonical Init document.*unknown\.v1/i);
    assert.throws(() => options.createCanonicalStoredState({
        storedState: [{ key: "modulation.v6", schemaVersion: 7, required: true }],
    }), /canonical Init document modulation\.v6 is version 6, not 7/i);
});

test("the Init-only rack adapter strictly hydrates, applies runtime and stored state, and suppresses its own echo", async () => {
    const [initState, rack] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/effects/synth-init-state.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state.ts"),
    ]);
    const initialRack = {
        ...rack.createDefaultLaneState(),
        order: [...rack.createDefaultLaneState().order].reverse(),
        enabled: { ...rack.createDefaultLaneState().enabled, chorus: true },
    };
    const connection = new RackPatchConnection(rack.serializeLaneState(initialRack));
    const adapter = initState.createSynthRackInitStateAdapter(connection);
    let notifications = 0;
    const unsubscribe = adapter.subscribe(() => {
        notifications += 1;
    });

    assert.deepEqual(adapter.capture(), initialRack);
    assert.deepEqual(adapter.createDefaultValue(), rack.createDefaultLaneState());
    assert.deepEqual(
        adapter.normalizeForTransaction(rack.serializeLaneState(initialRack)),
        initialRack,
    );

    const nextRack = rack.createDefaultLaneState();
    adapter.apply(nextRack);
    assert.deepEqual(
        connection.events.map((event) => event.endpointID),
        [...Array(8).fill("laneSlotParams"), "laneTopology"],
    );
    assert.equal(connection.storedWrites.length, 1);
    assert.deepEqual(JSON.parse(connection.storedWrites[0].value), nextRack);
    assert.equal(notifications, 0);

    connection.emitStoredState("lane.v1", rack.serializeLaneState(initialRack));
    assert.equal(notifications, 1);
    assert.deepEqual(adapter.capture(), initialRack);
    unsubscribe();
});

test("the rack adapter rejects corrupt hydration instead of silently retaining or defaulting it", async () => {
    const initState = await loadUIModule(repoRoot, "ui/shared/effects/synth-init-state.ts");
    const connection = new RackPatchConnection("{not-json");
    const adapter = initState.createSynthRackInitStateAdapter(connection);
    const unsubscribe = adapter.subscribe(() => {});

    assert.throws(() => adapter.capture(), /lane\.v1 is not valid JSON/i);
    unsubscribe();
});

test("out-of-order rack installation echoes cannot replace the newest loaded rack or mark it edited", async () => {
    const [initState, rack] = await Promise.all([
        loadUIModule(repoRoot, "ui/shared/effects/synth-init-state.ts"),
        loadUIModule(repoRoot, "ui/shared/lane-state.ts"),
    ]);
    const firstRack = {
        ...rack.createDefaultLaneState(),
        enabled: { ...rack.createDefaultLaneState().enabled, delay: true },
    };
    const secondRack = {
        ...rack.createDefaultLaneState(),
        enabled: { ...rack.createDefaultLaneState().enabled, reverb: true },
    };
    const userRack = {
        ...rack.createDefaultLaneState(),
        enabled: { ...rack.createDefaultLaneState().enabled, chorus: true },
    };
    const connection = new RackPatchConnection(rack.serializeLaneState(rack.createDefaultLaneState()));
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

    connection.emitStoredState("lane.v1", rack.serializeLaneState(userRack));
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
    assert.match(presetHost, /synth: createSynthPresetInitOptions\(patchConnection, storedStateAdapters\)/);
});
