import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

async function loadSnapshotBankModule() {
    const bankModule = await loadUIModule(repoRoot, "ui/shared/effects/effect-snapshot-bank.ts");
    const contractModule = await loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts");
    return { ...bankModule, ...contractModule };
}

const status = {
    details: {
        inputs: [
            parameter("mix", { min: 0, max: 100, init: 50 }),
            parameter("tone", { min: 0, max: 10, init: 3 }),
            parameter("hiddenGuard", { min: 0, max: 1, init: 1, hidden: true }),
        ],
    },
};

function parameter(endpointID, annotation = {}) {
    return {
        endpointID,
        purpose: "parameter",
        annotation,
    };
}

async function createSnapshot({
    slotID = "A",
    effectID = "unit",
    parameters = { mix: 11, tone: 4 },
    storedState = {},
    label = "",
} = {}) {
    const { buildPluginStateContract, captureEffectSnapshot } = await loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts")
        .then(async (contractModule) => ({
            ...contractModule,
            ...(await loadUIModule(repoRoot, "ui/shared/effects/effect-snapshots.ts")),
        }));
    const contract = buildPluginStateContract({
        effectID,
        status,
        storedState: Object.keys(storedState).map((key) => ({
            key,
            schemaVersion: 1,
            required: true,
        })),
    });

    return {
        ...captureEffectSnapshot({
            slotID,
            currentContract: contract,
            currentParameterValues: parameters,
            storedStateAdapters: Object.entries(storedState).map(([key, value]) => ({
                key,
                schemaVersion: 1,
                capture: () => value,
                normalizeForPreset: (nextValue) => nextValue,
                serializeForPreset: (nextValue) => nextValue,
            })),
            label,
        }),
        slotID,
    };
}

async function createBankPayload(overrides = {}) {
    const { EFFECT_SNAPSHOT_BANK_KIND, EFFECT_SNAPSHOT_BANK_SCHEMA_VERSION, DEFAULT_EFFECT_SNAPSHOT_SLOT_IDS } = await loadSnapshotBankModule();

    return {
        kind: EFFECT_SNAPSHOT_BANK_KIND,
        version: EFFECT_SNAPSHOT_BANK_SCHEMA_VERSION,
        effectID: "unit",
        activeSlotID: null,
        slots: Object.fromEntries(DEFAULT_EFFECT_SNAPSHOT_SLOT_IDS.map((slotID) => [slotID, null])),
        ...overrides,
    };
}

class FakePatchConnection {
    constructor({
        storedState = {},
        parameterValues = {},
        delayFullStoredState = false,
        delayStoredStateValue = false,
        delayParameterValueEndpoints = [],
        throwOnStoredStateWrites = false,
        disableStoredStateWrites = false,
        throwOnParameterWriteEndpointOnce = null,
    } = {}) {
        this.storedState = { ...storedState };
        this.parameterValues = { mix: 20, tone: 5, hiddenGuard: 1, ...parameterValues };
        this.delayFullStoredState = delayFullStoredState;
        this.delayStoredStateValue = delayStoredStateValue;
        this.delayParameterValueEndpoints = new Set(delayParameterValueEndpoints);
        this.throwOnStoredStateWrites = throwOnStoredStateWrites;
        this.throwOnParameterWriteEndpointOnce = throwOnParameterWriteEndpointOnce;
        this.events = [];
        this.storedWrites = [];
        this.pendingFullStoredStateCallbacks = [];
        this.pendingStoredStateValueRequests = [];
        this.pendingParameterValueRequests = [];
        this.statusListeners = new Set();
        this.parameterListeners = new Map();
        this.storedStateListeners = new Set();

        if (disableStoredStateWrites) {
            this.sendStoredStateValue = undefined;
        }
    }

    addStatusListener(listener) {
        this.statusListeners.add(listener);
    }

    removeStatusListener(listener) {
        this.statusListeners.delete(listener);
    }

    requestStatusUpdate() {
        for (const listener of this.statusListeners) {
            listener(status);
        }
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
        if (this.delayParameterValueEndpoints.has(endpointID)) {
            this.pendingParameterValueRequests.push(endpointID);
            return;
        }

        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(this.parameterValues[endpointID]);
        }
    }

    sendEventOrValue(endpointID, value) {
        if (this.throwOnParameterWriteEndpointOnce === endpointID) {
            this.throwOnParameterWriteEndpointOnce = null;
            throw new Error(`parameter write failed for ${endpointID}`);
        }

        this.events.push({ endpointID, value });
        this.setParameterValue(endpointID, value);
    }

    setParameterValue(endpointID, value) {
        this.parameterValues[endpointID] = value;
        for (const listener of this.parameterListeners.get(endpointID) ?? []) {
            listener(value);
        }
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback) {
        const snapshot = { ...this.storedState };

        if (this.delayFullStoredState) {
            this.pendingFullStoredStateCallbacks.push(() => callback(snapshot));
            return;
        }

        callback(snapshot);
    }

    requestStoredStateValue(key) {
        const value = this.storedState[key];

        if (this.delayStoredStateValue) {
            this.pendingStoredStateValueRequests.push(() => this.emitStoredStateValue(key, value));
            return;
        }

        this.emitStoredStateValue(key, value);
    }

    sendStoredStateValue(key, value) {
        if (this.throwOnStoredStateWrites) {
            throw new Error("stored state write failed");
        }

        this.storedState[key] = value;
        this.storedWrites.push({ key, value });
        this.emitStoredStateValue(key, value);
    }

    emitStoredStateValue(key, value) {
        for (const listener of this.storedStateListeners) {
            listener({ key, value });
        }
    }

    flushFullStoredState() {
        for (const callback of this.pendingFullStoredStateCallbacks.splice(0)) {
            callback();
        }
    }

    flushStoredStateValue() {
        for (const callback of this.pendingStoredStateValueRequests.splice(0)) {
            callback();
        }
    }

    flushParameterValue(endpointID) {
        const pending = this.pendingParameterValueRequests;
        this.pendingParameterValueRequests = [];

        for (const pendingEndpointID of pending) {
            if (pendingEndpointID === endpointID) {
                for (const listener of this.parameterListeners.get(endpointID) ?? []) {
                    listener(this.parameterValues[endpointID]);
                }
            } else {
                this.pendingParameterValueRequests.push(pendingEndpointID);
            }
        }
    }
}

function createAdapter(initialValue = { grid: "initial" }) {
    let value = initialValue;
    const listeners = new Set();

    return {
        adapter: {
            key: "grid.v1",
            schemaVersion: 1,
            capture() {
                return value;
            },
            normalizeForPreset(nextValue) {
                if (!nextValue || typeof nextValue !== "object" || Array.isArray(nextValue)) {
                    throw new Error("Grid state must be an object.");
                }

                return { ...nextValue };
            },
            serializeForPreset(nextValue) {
                return { ...nextValue };
            },
            apply(nextValue) {
                value = { ...nextValue };
                for (const listener of listeners) {
                    listener();
                }
            },
            getContract() {
                return {
                    key: "grid.v1",
                    schemaVersion: 1,
                    required: true,
                };
            },
            subscribe(listener) {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
        },
        setValue(nextValue) {
            value = nextValue;
            for (const listener of listeners) {
                listener();
            }
        },
        getValue() {
            return value;
        },
    };
}

async function createController(options = {}) {
    const { EffectSnapshotBankController, snapshotBankStoredStateKey } = await loadSnapshotBankModule();
    const patchConnection = options.patchConnection ?? new FakePatchConnection(options.patchOptions);
    const controller = new EffectSnapshotBankController({
        effectID: "unit",
        patchConnection,
        storedStateKey: snapshotBankStoredStateKey("unit"),
        storedStateAdapters: options.storedStateAdapters ?? [],
        legacyBankProvider: options.legacyBankProvider,
        readClipboardText: options.readClipboardText,
        writeClipboardText: options.writeClipboardText,
    });

    return { controller, patchConnection, key: snapshotBankStoredStateKey("unit") };
}

test("snapshot_bank_hydrates_existing_stored_bank_without_writing_on_open", async () => {
    const slot = await createSnapshot({ slotID: "B", parameters: { mix: 13, tone: 8 }, label: "saved slot" });
    const bank = await createBankPayload({
        activeSlotID: "B",
        slots: { ...(await createBankPayload()).slots, B: slot },
    });
    const { controller, patchConnection, key } = await createController({
        patchOptions: {
            storedState: { "cosimo.effectSnapshotBank.unit.v1": bank },
        },
    });

    controller.attach();
    const state = controller.getState();

    assert.equal(state.ready, true);
    assert.equal(state.activeSlotID, "B");
    assert.equal(state.slots.B.label, "saved slot");
    assert.deepEqual(state.slots.B.parameters, { mix: 13, tone: 8 });
    assert.deepEqual(patchConnection.storedWrites, []);
    assert.equal(key, "cosimo.effectSnapshotBank.unit.v1");

    controller.detach();
});

test("snapshot_bank_captures_empty_slot_and_persists_full_bank", async () => {
    const { controller, patchConnection, key } = await createController();

    controller.attach();
    const result = controller.selectSlot("A");
    const persisted = patchConnection.storedWrites.at(-1);

    assert.equal(result.ok, true);
    assert.equal(controller.getState().activeSlotID, "A");
    assert.equal(persisted.key, key);
    assert.equal(persisted.value.kind, "cosimo.effectSnapshotBank");
    assert.equal(persisted.value.activeSlotID, "A");
    assert.deepEqual(persisted.value.slots.A.parameters, { mix: 20, tone: 5 });
    assert.equal("hiddenGuard" in persisted.value.slots.A.parameters, false);

    controller.detach();
});

test("snapshot_bank_recalls_filled_slot_and_keeps_other_slots_intact", async () => {
    const slotA = await createSnapshot({ slotID: "A", parameters: { mix: 1, tone: 2 } });
    const slotB = await createSnapshot({ slotID: "B", parameters: { mix: 8, tone: 9 }, label: "do not touch" });
    const bank = await createBankPayload({
        activeSlotID: "B",
        slots: { ...(await createBankPayload()).slots, A: slotA, B: slotB },
    });
    const { controller, patchConnection } = await createController({
        patchOptions: {
            storedState: { "cosimo.effectSnapshotBank.unit.v1": bank },
        },
    });

    controller.attach();
    const result = controller.selectSlot("A");
    const state = controller.getState();

    assert.equal(result.ok, true);
    assert.deepEqual(patchConnection.events.slice(-2), [
        { endpointID: "mix", value: 1 },
        { endpointID: "tone", value: 2 },
    ]);
    assert.equal(state.activeSlotID, "A");
    assert.equal(state.slots.B.label, "do not touch");
    assert.deepEqual(state.slots.B.parameters, { mix: 8, tone: 9 });

    controller.detach();
});

test("snapshot_bank_updates_active_slot_on_parameter_and_adapter_edits", async () => {
    const adapterHarness = createAdapter({ grid: "alpha" });
    const { controller, patchConnection } = await createController({
        storedStateAdapters: [adapterHarness.adapter],
    });

    controller.attach();
    controller.selectSlot("A");
    patchConnection.setParameterValue("mix", 64);
    adapterHarness.setValue({ grid: "beta" });
    const state = controller.getState();

    assert.equal(state.activeSlotID, "A");
    assert.deepEqual(state.slots.A.parameters, { mix: 64, tone: 5 });
    assert.deepEqual(state.slots.A.storedState, { "grid.v1": { grid: "beta" } });
    assert.deepEqual(patchConnection.storedWrites.at(-1).value.slots.A.storedState, {
        "grid.v1": { grid: "beta" },
    });

    controller.detach();
});

test("snapshot_bank_defers_active_slot_adapter_capture_until_all_parameter_values_are_hydrated", async () => {
    const adapterHarness = createAdapter({ grid: "alpha" });
    const slotA = await createSnapshot({
        slotID: "A",
        parameters: { mix: 13, tone: 8 },
        storedState: { "grid.v1": { grid: "alpha" } },
    });
    const bank = await createBankPayload({
        activeSlotID: "A",
        slots: { ...(await createBankPayload()).slots, A: slotA },
    });
    const { controller, patchConnection } = await createController({
        storedStateAdapters: [adapterHarness.adapter],
        patchOptions: {
            storedState: { "cosimo.effectSnapshotBank.unit.v1": bank },
            delayParameterValueEndpoints: ["tone"],
        },
    });

    controller.attach();

    assert.deepEqual(controller.getState().currentValues, { mix: 20 });
    assert.equal(controller.getState().lastError, null);
    assert.deepEqual(patchConnection.storedWrites, []);

    adapterHarness.setValue({ grid: "beta" });
    let state = controller.getState();

    assert.equal(state.lastError, null);
    assert.deepEqual(state.slots.A.parameters, { mix: 13, tone: 8 });
    assert.deepEqual(state.slots.A.storedState, { "grid.v1": { grid: "alpha" } });
    assert.deepEqual(patchConnection.storedWrites, []);

    patchConnection.flushParameterValue("tone");
    state = controller.getState();

    assert.equal(state.lastError, null);
    assert.deepEqual(state.currentValues, { mix: 20, tone: 5 });
    assert.deepEqual(state.slots.A.parameters, { mix: 20, tone: 5 });
    assert.deepEqual(state.slots.A.storedState, { "grid.v1": { grid: "beta" } });
    assert.deepEqual(patchConnection.storedWrites.at(-1).value.slots.A.storedState, {
        "grid.v1": { grid: "beta" },
    });

    controller.detach();
});

test("snapshot_bank_reattaches_parameter_listeners_after_detach_with_same_status_contract", async () => {
    const { controller, patchConnection } = await createController();

    controller.attach();
    controller.selectSlot("A");
    controller.detach();

    assert.equal(controller.getState().ready, false);
    assert.equal(patchConnection.parameterListeners.get("mix")?.size ?? 0, 0);

    controller.attach();
    patchConnection.setParameterValue("mix", 72);
    const state = controller.getState();

    assert.equal(state.ready, true);
    assert.equal(patchConnection.parameterListeners.get("mix")?.size, 1);
    assert.deepEqual(state.slots.A.parameters, { mix: 72, tone: 5 });

    controller.detach();
});

test("snapshot_bank_writes_applied_preset_into_active_slot", async () => {
    const { buildPluginStateContract } = await loadUIModule(repoRoot, "ui/shared/effects/effect-state-contract.ts");
    const contract = buildPluginStateContract({ effectID: "unit", status });
    const { controller } = await createController();

    controller.attach();
    controller.selectSlot("A");
    const result = controller.updateActiveSlotFromPreset({
        kind: "cosimo.effectPreset",
        version: 2,
        effectID: "unit",
        presetID: "factory.unit.big",
        label: "Big",
        contract,
        parameters: { mix: 77, tone: 6 },
        storedState: {},
    });
    const state = controller.getState();

    assert.equal(result.ok, true);
    assert.deepEqual(state.slots.A.parameters, { mix: 77, tone: 6 });
    assert.equal(state.slots.A.label, "Big");

    controller.detach();
});

test("snapshot_bank_empty_slot_capture_rolls_back_when_bank_persistence_throws", async () => {
    const { controller, patchConnection } = await createController({
        patchOptions: {
            throwOnStoredStateWrites: true,
        },
    });

    controller.attach();
    const result = controller.selectSlot("A");
    const state = controller.getState();

    assert.equal(result.ok, false);
    assert.match(result.message, /stored state write failed/i);
    assert.equal(state.activeSlotID, null);
    assert.equal(state.slots.A, null);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);

    controller.detach();
});

test("snapshot_bank_mutations_fail_when_bank_persistence_writer_is_unavailable", async () => {
    const { controller, patchConnection } = await createController({
        patchOptions: {
            disableStoredStateWrites: true,
        },
    });

    controller.attach();
    const result = controller.selectSlot("A");
    const state = controller.getState();

    assert.equal(result.ok, false);
    assert.match(result.message, /stored-state writes are unavailable/i);
    assert.equal(state.activeSlotID, null);
    assert.equal(state.slots.A, null);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);

    controller.detach();
});

test("snapshot_bank_recall_fails_before_sound_writes_when_bank_persistence_throws", async () => {
    const slotA = await createSnapshot({ slotID: "A", parameters: { mix: 1, tone: 2 } });
    const bank = await createBankPayload({
        activeSlotID: null,
        slots: { ...(await createBankPayload()).slots, A: slotA },
    });
    const { controller, patchConnection } = await createController({
        patchOptions: {
            storedState: { "cosimo.effectSnapshotBank.unit.v1": bank },
            throwOnStoredStateWrites: true,
        },
    });

    controller.attach();
    patchConnection.events = [];
    const result = controller.selectSlot("A");
    const state = controller.getState();

    assert.equal(result.ok, false);
    assert.match(result.message, /stored state write failed/i);
    assert.equal(state.activeSlotID, null);
    assert.deepEqual(state.slots.A.parameters, { mix: 1, tone: 2 });
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);

    controller.detach();
});

test("snapshot_bank_recall_restores_bank_and_sound_when_parameter_apply_fails_mid_write", async () => {
    const slotA = await createSnapshot({ slotID: "A", parameters: { mix: 1, tone: 2 } });
    const bank = await createBankPayload({
        activeSlotID: null,
        slots: { ...(await createBankPayload()).slots, A: slotA },
    });
    const { controller, patchConnection } = await createController({
        patchOptions: {
            storedState: { "cosimo.effectSnapshotBank.unit.v1": bank },
            throwOnParameterWriteEndpointOnce: "tone",
        },
    });

    controller.attach();
    patchConnection.events = [];
    const result = controller.selectSlot("A");
    const state = controller.getState();

    assert.equal(result.ok, false);
    assert.match(result.message, /parameter write failed for tone/i);
    assert.equal(state.activeSlotID, null);
    assert.deepEqual(state.currentValues, { mix: 20, tone: 5 });
    assert.deepEqual(patchConnection.parameterValues, { mix: 20, tone: 5, hiddenGuard: 1 });
    assert.deepEqual(patchConnection.events, [
        { endpointID: "mix", value: 1 },
        { endpointID: "mix", value: 20 },
        { endpointID: "tone", value: 5 },
    ]);
    assert.equal(patchConnection.storedWrites.at(-1).value.activeSlotID, null);

    controller.detach();
});

test("snapshot_bank_import_fails_before_sound_writes_when_bank_persistence_throws", async () => {
    const importedSlot = await createSnapshot({ slotID: "A", parameters: { mix: 3, tone: 4 }, label: "imported" });
    const { controller, patchConnection } = await createController({
        patchOptions: {
            throwOnStoredStateWrites: true,
        },
    });

    controller.attach();
    const result = controller.importSnapshotText("A", JSON.stringify(importedSlot));
    const state = controller.getState();

    assert.equal(result.ok, false);
    assert.match(result.message, /stored state write failed/i);
    assert.equal(state.activeSlotID, null);
    assert.equal(state.slots.A, null);
    assert.deepEqual(patchConnection.events, []);
    assert.deepEqual(patchConnection.storedWrites, []);

    controller.detach();
});

test("snapshot_bank_import_restores_bank_and_sound_when_parameter_apply_fails_mid_write", async () => {
    const importedSlot = await createSnapshot({ slotID: "A", parameters: { mix: 3, tone: 4 }, label: "imported" });
    const { controller, patchConnection } = await createController({
        patchOptions: {
            throwOnParameterWriteEndpointOnce: "tone",
        },
    });

    controller.attach();
    const result = controller.importSnapshotText("A", JSON.stringify(importedSlot));
    const state = controller.getState();

    assert.equal(result.ok, false);
    assert.match(result.message, /parameter write failed for tone/i);
    assert.equal(state.activeSlotID, null);
    assert.equal(state.slots.A, null);
    assert.deepEqual(state.currentValues, { mix: 20, tone: 5 });
    assert.deepEqual(patchConnection.parameterValues, { mix: 20, tone: 5, hiddenGuard: 1 });
    assert.deepEqual(patchConnection.events, [
        { endpointID: "mix", value: 3 },
        { endpointID: "mix", value: 20 },
        { endpointID: "tone", value: 5 },
    ]);
    assert.equal(patchConnection.storedWrites.at(-1).value.activeSlotID, null);
    assert.equal(patchConnection.storedWrites.at(-1).value.slots.A, null);

    controller.detach();
});

test("snapshot_bank_ignores_stale_boot_reply_after_user_mutates_state", async () => {
    const staleSlot = await createSnapshot({ slotID: "A", parameters: { mix: 1, tone: 1 } });
    const staleBank = await createBankPayload({
        activeSlotID: "A",
        slots: { ...(await createBankPayload()).slots, A: staleSlot },
    });
    const { controller, patchConnection } = await createController({
        patchOptions: {
            storedState: { "cosimo.effectSnapshotBank.unit.v1": staleBank },
            delayFullStoredState: true,
        },
    });

    controller.attach();
    controller.selectSlot("B");
    patchConnection.flushFullStoredState();
    const state = controller.getState();

    assert.equal(state.activeSlotID, "B");
    assert.deepEqual(state.slots.B.parameters, { mix: 20, tone: 5 });
    assert.equal(state.slots.A, null);

    controller.detach();
});

test("snapshot_bank_rejects_malformed_stored_bank_without_uploading_empty_replacement", async () => {
    const { controller, patchConnection } = await createController({
        patchOptions: {
            storedState: {
                "cosimo.effectSnapshotBank.unit.v1": {
                    kind: "wrong.kind",
                    version: 1,
                    effectID: "unit",
                    activeSlotID: "A",
                    slots: {},
                },
            },
        },
    });

    controller.attach();
    const state = controller.getState();

    assert.equal(state.activeSlotID, null);
    assert.match(state.lastError, /snapshot bank kind/i);
    assert.deepEqual(patchConnection.storedWrites, []);

    controller.detach();
});
