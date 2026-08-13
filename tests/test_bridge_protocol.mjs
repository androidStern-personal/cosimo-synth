import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import fc from "fast-check";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

if (typeof globalThis.HTMLElement === "undefined") {
    globalThis.HTMLElement = class HTMLElementStub {
        attachShadow() {
            this.shadowRoot = { innerHTML: "" };
            return this.shadowRoot;
        }
    };
}

const repoRoot = path.resolve(import.meta.dirname, "..");

const adapterModulePromise = loadUIModule(repoRoot, "ui/shared/cosimo-bridge-adapter.ts");
const mockModulePromise = loadUIModule(repoRoot, "ui/shared/patch-connection-mock.ts");
const descriptorModulePromise = loadUIModule(repoRoot, "ui/shared/target-descriptor.ts");
const articulationModulePromise = loadUIModule(repoRoot, "ui/shared/articulation-image.ts");
const modulationModulePromise = loadUIModule(repoRoot, "ui/shared/modulation.ts");
const modulationProgramModulePromise = loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts");

async function modules() {
    return {
        adapter: await adapterModulePromise,
        mock: await mockModulePromise,
        descriptors: await descriptorModulePromise,
        articulations: await articulationModulePromise,
        modulation: await modulationModulePromise,
        modulationProgram: await modulationProgramModulePromise,
    };
}

function decodeStoredDocument(value) {
    return typeof value === "string" ? JSON.parse(value) : value;
}

function expectOk(result, label) {
    assert.equal(
        result._tag,
        "ok",
        `${label}: expected ok, got ${result._tag === "err" ? result.error.message : "unknown"}`,
    );
    return result.value;
}

function articulationSlot({
    id,
    runtimeSlot,
    key,
    overrides = {},
    velRange = { min: 0, max: 127 },
    chainRange = { min: 0, max: 127 },
}) {
    return {
        id,
        runtimeSlot,
        name: id,
        color: "#d2a128",
        key,
        velRange,
        chainRange,
        overrides,
        routeAmounts: {},
    };
}

function articulationState(slots = []) {
    return {
        format: "cosimo.articulations",
        version: 3,
        selectedSlotId: slots[0]?.id ?? null,
        activeTriggerMode: "key",
        slots,
    };
}

async function waitForHydration(adapter) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        if (adapter.getSnapshot().connection._tag !== "connecting") return;
        await Promise.resolve();
    }
    assert.fail("adapter did not finish hydration");
}

async function flushMicrotasks(turns = 16) {
    for (let index = 0; index < turns; index += 1) {
        await Promise.resolve();
    }
}

async function createHarness({ storedState = {} } = {}) {
    const loaded = await modules();
    const connection = new loaded.mock.MockPatchConnection({
        name: "Cosimo bridge protocol test",
        version: 1,
    });
    for (const [key, value] of Object.entries(storedState)) {
        connection.setStoredStateValue(key, value);
    }
    const adapter = loaded.adapter.createCosimoBridgeAdapter({ connection });
    await waitForHydration(adapter);
    await flushMicrotasks(64);
    return { ...loaded, connection, adapter };
}

function parseStoredArticulations(harness) {
    const storedValue = harness.connection.getDebugSnapshot().storedState["articulations.v3"];
    const acceptedRouteIds = new Set(storedModulationState(harness).routes.flatMap((route) => (
        harness.modulationProgram.getModulationArticulationCellIndex(route) === null ? [] : [route.id]
    )));
    return expectOk(
        harness.articulations.parseArticulationsV3(decodeStoredDocument(storedValue), acceptedRouteIds),
        "stored articulations.v3",
    );
}

function storedModulationState(harness) {
    const storedValue = harness.connection.getDebugSnapshot().storedState[harness.modulation.MODULATION_STATE_KEY];
    return storedValue === undefined
        ? harness.modulation.createDefaultModulationState()
        : harness.modulation.deserializeModulationState(storedValue);
}

test("boot hydrates ready and the acknowledged worker uploads every occupied selector", async (t) => {
    const initialArticulations = articulationState([
        articulationSlot({
            id: "Pluck",
            runtimeSlot: 7,
            key: 24,
            velRange: { min: 0, max: 63 },
            chainRange: { min: 0, max: 63 },
        }),
        articulationSlot({
            id: "Bowed",
            runtimeSlot: 19,
            key: 26,
            velRange: { min: 64, max: 127 },
            chainRange: { min: 64, max: 127 },
        }),
    ]);
    const harness = await createHarness({
        storedState: {
            "articulations.v3": JSON.stringify(initialArticulations),
        },
    });
    t.after(() => harness.adapter.dispose());

    assert.deepEqual(harness.adapter.getSnapshot().connection, { _tag: "ready" });
    const debug = harness.connection.getDebugSnapshot();
    for (const descriptor of harness.descriptors.allTargetDescriptors()) {
        if (descriptor.binding._tag !== "endpoint") continue;
        const upload = debug.sentMessages.find(
            (message) => message.endpointID === descriptor.binding.endpointId,
        );
        assert.notEqual(upload, undefined, `${descriptor.binding.endpointId} was not uploaded`);
        assert.equal(
            upload.value,
            descriptor.binding.toEngine(descriptor.initialValue),
            `${descriptor.binding.endpointId} did not receive its initial engine value`,
        );
    }

    const occupiedSelectors = debug.sentMessages
        .filter((message) => message.endpointID === "articulationSnapshot")
        .map((message) => message.value.selectorA)
        .sort((left, right) => left - right);
    assert.deepEqual(occupiedSelectors, [7, 19]);
});

test("a bound shared-voice base edit persists immediately and the worker updates only inheriting selectors", async (t) => {
    const initialArticulations = articulationState([
        articulationSlot({ id: "Inherits Resonance", runtimeSlot: 4, key: 24 }),
        articulationSlot({
            id: "Owns Resonance",
            runtimeSlot: 9,
            key: 26,
            overrides: { filterQ: 0.21 },
        }),
    ]);
    const harness = await createHarness({
        storedState: { "articulations.v3": JSON.stringify(initialArticulations) },
    });
    t.after(() => harness.adapter.dispose());
    harness.connection.clearDebugLog();

    const resonanceDescriptor = harness.descriptors.getTargetDescriptor(
        expectOk(harness.descriptors.parseTargetId("voice-filter.resonance"), "parse resonance target"),
    );
    harness.adapter.commands.setParameter({
        targetId: "voice-filter.resonance",
        value: 0.73,
        layer: { _tag: "patchBase" },
    });

    const debug = harness.connection.getDebugSnapshot();
    assert.deepEqual(
        debug.sentMessages.filter((message) => message.endpointID === "filterQ"),
        [{ endpointID: "filterQ", value: resonanceDescriptor.binding.toEngine(0.73) }],
    );
    assert.deepEqual(
        debug.sentMessages.filter((message) => message.endpointID === "articulationSnapshot"),
        [],
        "the UI adapter does not publish articulation runtime images",
    );
    await flushMicrotasks();
    assert.deepEqual(
        harness.connection.getDebugSnapshot().sentMessages
            .filter((message) => message.endpointID === "articulationSnapshot")
            .map((message) => message.value.selectorA),
        [4],
    );
});

test("mapping commands project product source ids and target-unit amount scaling", async (t) => {
    const harness = await createHarness();
    t.after(() => harness.adapter.dispose());

    const cutoffMappingId = expectOk(harness.adapter.commands.addMapping({
        targetId: "voice-filter.cutoff",
        sourceId: "envelope-1",
    }), "add cutoff mapping");
    let route = storedModulationState(harness).routes.find((candidate) => candidate.id === cutoffMappingId);
    assert.deepEqual(
        {
            sourceKind: route.sourceKind,
            sourceSlot: route.sourceSlot,
            targetKind: route.targetKind,
        },
        { sourceKind: "env", sourceSlot: 1, targetKind: "filterCutoffOctaves" },
    );

    harness.adapter.commands.setMappingAmount(cutoffMappingId, 3, { _tag: "patchBase" });
    route = storedModulationState(harness).routes.find((candidate) => candidate.id === cutoffMappingId);
    assert.equal(route.amount, 3);

    const percentMappingId = expectOk(harness.adapter.commands.addMapping({
        targetId: "oscA.warpAmount",
        sourceId: "velocity",
    }), "add percent mapping");
    harness.adapter.commands.setMappingAmount(percentMappingId, 50, { _tag: "patchBase" });
    route = storedModulationState(harness).routes.find((candidate) => candidate.id === percentMappingId);
    assert.equal(route.amount, 0.5, "percent target amount must divide by 100");
});

test("mapping amount conversion roundtrips for every modulatable target", async (t) => {
    const harness = await createHarness();
    t.after(() => harness.adapter.dispose());
    const descriptors = harness.descriptors.allTargetDescriptors()
        .filter((descriptor) => descriptor.modulationTargetKind !== null);

    for (const descriptor of descriptors) {
        const mappingId = expectOk(harness.adapter.commands.addMapping({
            targetId: descriptor.targetId,
            sourceId: "velocity",
        }), `add ${descriptor.targetId} mapping`);
        const routeBounds = harness.modulation.getModulationAmountBounds(
            descriptor.modulationTargetKind,
        );
        harness.adapter.commands.setMappingAmount(
            mappingId,
            descriptor.modAmount.min,
            { _tag: "patchBase" },
        );
        let storedRoute = storedModulationState(harness).routes
            .find((route) => route.id === mappingId);
        assert.equal(
            storedRoute.amount,
            routeBounds.min,
            `${descriptor.targetId}: negative spec edge must reach the negative route edge`,
        );
        harness.adapter.commands.setMappingAmount(
            mappingId,
            descriptor.modAmount.max,
            { _tag: "patchBase" },
        );
        storedRoute = storedModulationState(harness).routes
            .find((route) => route.id === mappingId);
        assert.equal(
            storedRoute.amount,
            routeBounds.max,
            `${descriptor.targetId}: positive spec edge must reach the positive route edge`,
        );
        fc.assert(
            fc.property(
                fc.double({
                    min: descriptor.modAmount.min,
                    max: descriptor.modAmount.max,
                    noNaN: true,
                    noDefaultInfinity: true,
                }),
                (amount) => {
                    harness.adapter.commands.setMappingAmount(mappingId, amount, { _tag: "patchBase" });
                    const projected = harness.adapter.getSnapshot().patch.mappings
                        .find((mapping) => mapping.id === mappingId);
                    assert.notEqual(projected, undefined);
                    assert.ok(
                        Math.abs(projected.amount - amount) <= 1e-9,
                        `${descriptor.targetId}: ${amount} roundtripped as ${projected.amount}`,
                    );
                },
            ),
            { numRuns: 50 },
        );
        harness.adapter.commands.removeMapping(mappingId);
    }
});

test("macro value events and macro-name persistence use their engine protocols", async (t) => {
    const harness = await createHarness();
    t.after(() => harness.adapter.dispose());
    harness.connection.clearDebugLog();

    harness.adapter.commands.setMacroValue("macro-1", 0.31);
    assert.deepEqual(
        harness.connection.getDebugSnapshot().sentMessages,
        [{ endpointID: "macro1", value: 0.31 }],
    );

    harness.adapter.commands.renameMacro("macro-1", "Shimmer");
    assert.equal(storedModulationState(harness).macroNames[0], "Shimmer");
});

test("articulation add, override, and clear persist v3 for sole-owner worker publication", async (t) => {
    const harness = await createHarness();
    t.after(() => harness.adapter.dispose());
    harness.connection.clearDebugLog();

    const articulationId = expectOk(harness.adapter.commands.addArticulation(), "add articulation");
    let stored = parseStoredArticulations(harness);
    let slot = stored.slots.find((candidate) => candidate.id === articulationId);
    assert.notEqual(slot, undefined);
    const selector = slot.runtimeSlot;
    assert.deepEqual(
        harness.connection.getDebugSnapshot().sentMessages
            .filter((message) => message.endpointID === "articulationSnapshot"),
        [],
        "the adapter only persists the declarative change",
    );
    await flushMicrotasks();
    assert.deepEqual(
        harness.connection.getDebugSnapshot().sentMessages
            .filter((message) => message.endpointID === "articulationSnapshot")
            .map((message) => message.value.selectorA),
        [selector],
    );

    harness.connection.clearDebugLog();
    const resonanceDescriptor = harness.descriptors.getTargetDescriptor(
        expectOk(harness.descriptors.parseTargetId("voice-filter.resonance"), "parse resonance target"),
    );
    harness.adapter.commands.setParameter({
        targetId: "voice-filter.resonance",
        value: 0.42,
        layer: { _tag: "articulationOverride", articulationId },
    });
    stored = parseStoredArticulations(harness);
    slot = stored.slots.find((candidate) => candidate.id === articulationId);
    assert.equal(slot.overrides.filterQ, resonanceDescriptor.binding.toEngine(0.42));
    assert.deepEqual(
        harness.connection.getDebugSnapshot().sentMessages
            .filter((message) => message.endpointID === "articulationSnapshot"),
        [],
    );
    await flushMicrotasks();
    assert.deepEqual(
        harness.connection.getDebugSnapshot().sentMessages
            .filter((message) => message.endpointID === "articulationSnapshot")
            .map((message) => message.value.selectorA),
        [selector],
    );

    harness.connection.clearDebugLog();
    harness.adapter.commands.clearArticulationBaseOverride("voice-filter.resonance", articulationId);
    stored = parseStoredArticulations(harness);
    slot = stored.slots.find((candidate) => candidate.id === articulationId);
    assert.equal(Object.hasOwn(slot.overrides, "filterQ"), false);
    assert.deepEqual(
        harness.connection.getDebugSnapshot().sentMessages
            .filter((message) => message.endpointID === "articulationSnapshot"),
        [],
    );
    await flushMicrotasks();
    assert.deepEqual(
        harness.connection.getDebugSnapshot().sentMessages
            .filter((message) => message.endpointID === "articulationSnapshot")
            .map((message) => message.value.selectorA),
        [selector],
    );
});

test("audition begin and end send paired MIDI note-on/note-off events", async (t) => {
    const harness = await createHarness();
    t.after(() => harness.adapter.dispose());
    harness.adapter.commands.setAuditionNote("C4");
    harness.connection.clearDebugLog();

    harness.adapter.commands.beginTrigger();
    harness.adapter.commands.endTrigger();

    const expectedNote = 72;
    assert.deepEqual(harness.connection.getDebugSnapshot().midiInputEvents, [
        { endpointID: "midiIn", value: (0x90 << 16) | (expectedNote << 8) | 100 },
        { endpointID: "midiIn", value: (0x80 << 16) | (expectedNote << 8) },
    ]);
});

test("a version-2 articulation document is rejected as malformed current state", async (t) => {
    const retiredPayload = {
        format: "cosimo.articulations",
        version: 2,
        selectedSlotId: null,
        activeTriggerMode: "chain",
        slots: [],
        chainAssignments: [],
        keyAssignments: [],
        velocityAssignments: [],
    };
    const originalError = console.error;
    console.error = () => {};
    let harness;
    try {
        harness = await createHarness({
            storedState: { "articulations.v3": JSON.stringify(retiredPayload) },
        });
    } finally {
        console.error = originalError;
    }
    t.after(() => harness.adapter.dispose());

    const connection = harness.adapter.getSnapshot().connection;
    assert.equal(connection._tag, "detached");
    assert.match(connection.reason, /version must be exactly 3/);
});

test("full state roundtrip: a second bridge over the first one's stored state is snapshot-identical", async () => {
    const first = await createHarness();
    first.adapter.commands.setParameter({
        targetId: "oscA.framePosition",
        value: 0.77,
        layer: { _tag: "patchBase" },
    });
    const a1 = first.adapter.commands.addArticulation();
    assert.equal(a1._tag, "ok");
    first.adapter.commands.setArticulationKey(a1.value, 40);
    first.adapter.commands.setParameter({
        targetId: "voice-filter.resonance", value: 0.61,
        layer: { _tag: "articulationOverride", articulationId: a1.value },
    });
    const m = first.adapter.commands.addMapping({ targetId: "voice-filter.cutoff", sourceId: "envelope-1" });
    assert.equal(m._tag, "ok");
    first.adapter.commands.setMappingAmount(m.value, 3, { _tag: "patchBase" });
    const rack = first.adapter.commands.addMapping({ targetId: "phaser.phaserDepth", sourceId: "macro-1" });
    assert.equal(rack._tag, "ok");
    first.adapter.commands.setEffectEnabled("delay", false);
    first.adapter.commands.renameMacro("macro-1", "Shimmer");

    const storedState = { ...first.connection.getDebugSnapshot().storedState };
    const second = await createHarness({ storedState });

    const before = first.adapter.getSnapshot();
    const after = second.adapter.getSnapshot();
    assert.deepEqual(after.patch, before.patch, "the reborn adapter's patch must be identical");
});
