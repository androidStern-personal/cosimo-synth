import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const [runtime, worker, modulation, program, installChannel] = await Promise.all([
    loadUIModule(repoRoot, "ui/shared/articulations.ts"),
    loadUIModule(repoRoot, "ui/shared/articulation-worker-service.ts"),
    loadUIModule(repoRoot, "ui/shared/modulation.ts"),
    loadUIModule(repoRoot, "ui/shared/modulation-runtime-program.ts"),
    loadUIModule(repoRoot, "ui/shared/runtime-install-channel.ts"),
]);

const {
    ARTICULATION_MAX_SLOTS,
    ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    ARTICULATION_TRIGGER_CONFIG_STATE_KEY,
    addCapturedArticulationToBank,
    assignArticulationToKey,
    assignArticulationToRangePosition,
    buildArticulationTriggerConfig,
    clearArticulationRangeAssignment,
    clearArticulationTriggerAssignments,
    createArticulationSlotFromSnapshot,
    deleteArticulationSlot,
    distributeArticulationRanges,
    duplicateArticulationSlot,
    insertArticulationRangeAtPosition,
    moveArticulationRangeAssignment,
    normalizeArticulationEditorState,
    normalizeArticulationSnapshot,
    renameArticulationSlot,
    resizeArticulationRangeAssignment,
    setArticulationTriggerMode,
    upsertSelectedArticulationSnapshot,
} = runtime;
const { createArticulationWorkerService } = worker;
const {
    createDefaultModulationState,
    deserializeModulationState,
} = modulation;
const { getModulationRuntimeCell } = program;
const { RUNTIME_INSTALL_SEND_TIMEOUT_MS } = installChannel;

const RETIRED_ARTICULATION_STATE_KEY = "articulations.v3";
const WARP_ROUTE_ID = "oscA.warpAmount::mseg-1";
const PAN_ROUTE_ID = "oscA.pan::mseg-1";

async function flushMicrotasks(turns = 8) {
    for (let index = 0; index < turns; index += 1) {
        await Promise.resolve();
    }
}

function createCurrentModulationState(routes = []) {
    return {
        ...createDefaultModulationState(),
        routes: routes.map((route) => ({ reducer: "max", ...route })),
    };
}

function createCurrentArticulationSlot(runtimeSlot, input = {}) {
    return {
        id: input.id ?? `slot-${runtimeSlot}`,
        runtimeSlot,
        name: input.name ?? `Slot ${runtimeSlot}`,
        color: input.color ?? "#d2a128",
        key: input.key ?? 36,
        velRange: input.velRange ?? { min: 0, max: 127 },
        chainRange: input.chainRange ?? { min: 0, max: 127 },
        overrides: input.overrides ?? {},
        routeAmounts: input.routeAmounts ?? {},
    };
}

function createCurrentArticulationState(slots = [], input = {}) {
    return {
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: input.selectedSlotId ?? slots[0]?.id ?? null,
        activeTriggerMode: input.activeTriggerMode ?? "chain",
        slots,
    };
}

class ArticulationWorkerTestConnection {
    constructor(fullStoredState = {}) {
        this.fullStoredState = fullStoredState;
        this.storedStateListeners = new Set();
        this.endpointListeners = new Map();
        this.sentEvents = [];
        this.sentTimeouts = [];
        this.requestedKeys = [];
        this.dspSessionId = 0;
        this.acceptedModulationSerial = 0;
        this.acceptedArticulationSerial = 0;
        this.rejectionPlansByEndpoint = new Map();
    }

    addStoredStateValueListener(listener) {
        this.storedStateListeners.add(listener);
    }

    removeStoredStateValueListener(listener) {
        this.storedStateListeners.delete(listener);
    }

    requestFullStoredState(callback) {
        callback(this.fullStoredState);
    }

    requestStoredStateValue(key) {
        this.requestedKeys.push(key);
        const values = this.fullStoredState?.values ?? this.fullStoredState;
        queueMicrotask(() => this.emitStoredState(key, values?.[key]));
    }

    addEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID, listener) {
        this.endpointListeners.get(endpointID)?.delete(listener);
    }

    sendEventOrValue(endpointID, value, _rampFrames, timeoutMilliseconds) {
        this.sentEvents.push({ endpointID, value });
        this.sentTimeouts.push({ endpointID, timeoutMilliseconds });
        if (endpointID === "runtimeSyncRequest") {
            queueMicrotask(() => this.emitRuntimeInstallAck(value));
            return;
        }

        const deliverySerial = Math.trunc(Number(value?.deliverySerial) || 0);
        const rejectionPlan = this.rejectionPlansByEndpoint.get(endpointID);
        if (rejectionPlan && rejectionPlan.acceptsBeforeRejection <= 0) {
            rejectionPlan.rejectionsRemaining -= 1;
            if (rejectionPlan.rejectionsRemaining <= 0) {
                this.rejectionPlansByEndpoint.delete(endpointID);
            }
            queueMicrotask(() => this.emitEndpoint("runtimeInstallAck", {
                dspSessionId: this.dspSessionId,
                acceptedModulationSerial: this.acceptedModulationSerial,
                acceptedArticulationSerial: this.acceptedArticulationSerial,
                rejectedSerial: deliverySerial,
                rejectionReason: 3,
                syncSerial: 0,
            }));
            return;
        }
        if (rejectionPlan) {
            rejectionPlan.acceptsBeforeRejection -= 1;
        }
        if (deliverySerial < 0) {
            assert.equal(deliverySerial, this.acceptedArticulationSerial - 1);
            this.acceptedArticulationSerial = deliverySerial;
            queueMicrotask(() => this.emitRuntimeInstallAck(0));
        } else if (deliverySerial > 0) {
            assert.equal(deliverySerial, this.acceptedModulationSerial + 1);
            this.acceptedModulationSerial = deliverySerial;
            queueMicrotask(() => this.emitRuntimeInstallAck(0));
        }
    }

    rejectNext(endpointID, acceptsBeforeRejection = 0, rejectionsRemaining = 1) {
        this.rejectionPlansByEndpoint.set(endpointID, {
            acceptsBeforeRejection,
            rejectionsRemaining,
        });
    }

    emitRuntimeInstallAck(syncSerial = 0) {
        this.emitEndpoint("runtimeInstallAck", {
            dspSessionId: this.dspSessionId,
            acceptedModulationSerial: this.acceptedModulationSerial,
            acceptedArticulationSerial: this.acceptedArticulationSerial,
            rejectedSerial: 0,
            rejectionReason: 0,
            syncSerial,
        });
    }

    emitEndpoint(endpointID, value) {
        if (endpointID === "runtimeState") {
            const nextSessionId = Math.trunc(Number(value?.dspSessionId) || 0);
            if (nextSessionId !== this.dspSessionId) {
                this.dspSessionId = nextSessionId;
                this.acceptedModulationSerial = 0;
                this.acceptedArticulationSerial = 0;
            }
        }
        this.endpointListeners.get(endpointID)?.forEach((listener) => listener(value));
    }

    emitStoredState(key, value) {
        this.storedStateListeners.forEach((listener) => listener({ key, value }));
    }
}

test("articulation snapshots normalize parameter bounds and dedupe route amounts by route id", () => {
    const snapshot = normalizeArticulationSnapshot({
        parameters: {
            wavetablePosition: 2,
            pan: -4,
            warpMode: 99,
            warpAmount: 4,
            filterMode: 99,
            filterCutoff: 5,
            filterQ: 200,
            unisonVoices: 99,
            unisonDetune: 2,
            unisonBlend: -1,
            unisonWidth: 2,
            unisonPhase: 2,
            unisonRandom: 2,
            unisonPhaseMode: 4,
            unisonDetuneMode: 9,
            unisonStackMode: 9,
            unisonWavetablePositionSpread: 2,
            unisonWarpSpread: 2,
            msegMorphs: [-1, 0.375, 9],
        },
        envelopes: [{
            attackSeconds: -1,
            decaySeconds: 99,
            sustain: 2,
            releaseSeconds: 99,
        }],
        modRouteAmounts: [
            { routeId: "route-a", amount: 0.25 },
            { routeId: "route-a", amount: 0.75 },
            { routeId: "route-b", amount: 99 },
            { routeId: "", amount: 0.5 },
        ],
    });

    assert.deepEqual(snapshot.parameters, {
        wavetablePosition: 1,
        pan: -1,
        warpMode: 4,
        warpAmount: 1,
        filterMode: 5,
        filterCutoff: 20,
        filterQ: 20,
        unisonVoices: 8,
        unisonDetune: 1,
        unisonBlend: 0,
        unisonWidth: 1,
        unisonPhase: 1,
        unisonRandom: 1,
        unisonPhaseMode: 1,
        unisonDetuneMode: 4,
        unisonStackMode: 4,
        unisonWavetablePositionSpread: 1,
        unisonWarpSpread: 1,
        msegMorphs: [0, 0.375, 1],
    });
    assert.deepEqual(snapshot.envelopes.map((envelope) => ({
        attackSeconds: envelope.attackSeconds,
        decaySeconds: envelope.decaySeconds,
        sustain: envelope.sustain,
        releaseSeconds: envelope.releaseSeconds,
    })), [
        { attackSeconds: 0.001, decaySeconds: 10, sustain: 1, releaseSeconds: 10 },
        { attackSeconds: 0.01, decaySeconds: 0.25, sustain: 0.5, releaseSeconds: 0.2 },
        { attackSeconds: 0.01, decaySeconds: 0.25, sustain: 0.5, releaseSeconds: 0.2 },
    ]);
    assert.deepEqual(snapshot.modRouteAmounts, [
        { routeId: "route-a", amount: 0.75 },
        { routeId: "route-b", amount: 48 },
    ]);
});

test("articulation editor-state normalization keeps runtime slots unique and trigger maps separate", () => {
    const bank = normalizeArticulationEditorState({
        selectedSlotId: "duplicate-runtime-slot",
        activeTriggerMode: "vel",
        slots: [
            { id: "slot-a", runtimeSlot: 4, name: " Slot A " },
            { id: "duplicate-runtime-slot", runtimeSlot: 4, name: "Duplicate runtime slot" },
            { id: "slot-b", runtimeSlot: 6, name: "" },
            { id: "slot-b", runtimeSlot: 7, name: "Duplicate id" },
            null,
        ],
        chainAssignments: [
            { id: "chain-a", articulationId: "slot-a", min: 12, max: 12 },
            { id: "chain-missing", articulationId: "missing", min: 13, max: 13 },
        ],
        keyAssignments: [
            { articulationId: "slot-a", note: 0 },
            { articulationId: "slot-b", note: 0 },
            { articulationId: "slot-b", note: 1 },
        ],
        velocityAssignments: [
            { id: "vel-b", articulationId: "slot-b", min: 4, max: 2 },
        ],
    });

    assert.equal(bank.selectedSlotId, null);
    assert.equal(bank.activeTriggerMode, "vel");
    assert.deepEqual(bank.slots.map((slot) => ({
        id: slot.id,
        runtimeSlot: slot.runtimeSlot,
        name: slot.name,
    })), [
        { id: "slot-a", runtimeSlot: 4, name: "Slot A" },
        { id: "slot-b", runtimeSlot: 6, name: "Bell Strike" },
    ]);
    assert.deepEqual(bank.chainAssignments, [
        { id: "chain-a", articulationId: "slot-a", min: 12, max: 12 },
    ]);
    assert.deepEqual(bank.keyAssignments, [
        { articulationId: "slot-a", note: 0 },
        { articulationId: "slot-b", note: 1 },
    ]);
    assert.deepEqual(bank.velocityAssignments, [
        { id: "vel-b", articulationId: "slot-b", min: 2, max: 4 },
    ]);
});

test("new articulation slots choose the first free runtime slot and add can auto-assign the active trigger mode", () => {
    const existingBank = normalizeArticulationEditorState({
        activeTriggerMode: "key",
        slots: [
            { id: "slot-0", runtimeSlot: 0 },
            { id: "slot-2", runtimeSlot: 2 },
        ],
        keyAssignments: [
            { articulationId: "slot-0", note: 0 },
        ],
    });
    const snapshot = normalizeArticulationSnapshot({
        parameters: {
            warpAmount: 0.44,
            msegMorphs: [0.1, 0.2, 0.3],
        },
        modRouteAmounts: [{ routeId: "route-a", amount: 0.5 }],
    });

    const slot = createArticulationSlotFromSnapshot(existingBank, snapshot);

    assert.deepEqual({
        id: slot?.id,
        runtimeSlot: slot?.runtimeSlot,
        name: slot?.name,
        warpAmount: slot?.snapshot.parameters.warpAmount,
        msegMorphs: slot?.snapshot.parameters.msegMorphs,
        routeAmounts: slot?.snapshot.modRouteAmounts,
    }, {
        id: "articulation-1",
        runtimeSlot: 1,
        name: "Bow Pianissimo",
        warpAmount: 0.44,
        msegMorphs: [0.1, 0.2, 0.3],
        routeAmounts: [{ routeId: "route-a", amount: 0.5 }],
    });

    const capturedBank = addCapturedArticulationToBank(existingBank, snapshot);
    assert.equal(capturedBank.selectedSlotId, "articulation-1");
    assert.deepEqual(capturedBank.keyAssignments, [
        { articulationId: "slot-0", note: 0 },
        { articulationId: "articulation-1", note: 1 },
    ]);

    const fullBank = normalizeArticulationEditorState({
        slots: Array.from({ length: ARTICULATION_MAX_SLOTS }, (_, runtimeSlot) => ({
            id: `slot-${runtimeSlot}`,
            runtimeSlot,
        })),
    });

    assert.equal(createArticulationSlotFromSnapshot(fullBank, snapshot), null);
});

test("articulation editing helpers keep sound snapshots separate from trigger mappings", () => {
    const bank = normalizeArticulationEditorState({
        selectedSlotId: "bow",
        activeTriggerMode: "chain",
        slots: [
            {
                id: "bow",
                runtimeSlot: 0,
                name: "Bow Forte",
                snapshot: normalizeArticulationSnapshot({
                    parameters: { warpAmount: 0.11 },
                    modRouteAmounts: [{ routeId: "route-a", amount: 0.25 }],
                }),
            },
            {
                id: "pluck",
                runtimeSlot: 1,
                name: "Pluck Snap",
                snapshot: normalizeArticulationSnapshot({
                    parameters: { warpAmount: 0.44 },
                    modRouteAmounts: [{ routeId: "route-a", amount: 0.5 }],
                }),
            },
        ],
        chainAssignments: [{ id: "chain-bow", articulationId: "bow", min: 10, max: 12 }],
        keyAssignments: [{ articulationId: "bow", note: 0 }],
        velocityAssignments: [{ id: "vel-bow", articulationId: "bow", min: 1, max: 16 }],
    });
    const updatedSnapshot = normalizeArticulationSnapshot({
        parameters: { warpAmount: 0.73, msegMorphs: [0.2, 0.4, 0.6] },
        modRouteAmounts: [{ routeId: "route-a", amount: 0.9 }],
    });

    const updatedBank = upsertSelectedArticulationSnapshot(bank, "bow", updatedSnapshot);
    assert.equal(updatedBank.slots.find((slot) => slot.id === "bow")?.snapshot.parameters.warpAmount, 0.73);
    assert.deepEqual(updatedBank.chainAssignments, bank.chainAssignments);
    assert.deepEqual(updatedBank.keyAssignments, bank.keyAssignments);
    assert.deepEqual(updatedBank.velocityAssignments, bank.velocityAssignments);

    const renamedBank = renameArticulationSlot(updatedBank, "bow", "  Col Legno-ish  ");
    assert.equal(renamedBank.slots.find((slot) => slot.id === "bow")?.name, "Col Legno-ish");

    const duplicatedBank = duplicateArticulationSlot(renamedBank, "pluck");
    const duplicatedSlot = duplicatedBank.slots.find((slot) => slot.id === duplicatedBank.selectedSlotId);
    assert.equal(duplicatedBank.slots.length, 3);
    assert.equal(duplicatedSlot?.runtimeSlot, 2);
    assert.equal(duplicatedSlot?.name, "Pluck Snap Copy");
    assert.equal(duplicatedSlot?.snapshot.parameters.warpAmount, 0.44);
    assert.equal(
        duplicatedBank.chainAssignments.some((assignment) => assignment.articulationId === duplicatedSlot?.id),
        false,
    );
    assert.equal(
        duplicatedBank.keyAssignments.some((assignment) => assignment.articulationId === duplicatedSlot?.id),
        false,
    );
    assert.equal(
        duplicatedBank.velocityAssignments.some((assignment) => assignment.articulationId === duplicatedSlot?.id),
        false,
    );

    const chainReplacedBank = assignArticulationToRangePosition(duplicatedBank, "chain", 11, "pluck");
    assert.deepEqual(chainReplacedBank.chainAssignments, [
        { id: "chain-bow", articulationId: "pluck", min: 10, max: 12 },
    ]);

    const chainInsertedBank = assignArticulationToRangePosition(chainReplacedBank, "chain", 20, duplicatedSlot.id);
    assert.deepEqual(chainInsertedBank.chainAssignments, [
        { id: "chain-bow", articulationId: "pluck", min: 10, max: 12 },
        { id: `chain-${duplicatedSlot.id}-13`, articulationId: duplicatedSlot.id, min: 13, max: 127 },
    ]);

    const distributedBank = distributeArticulationRanges(chainInsertedBank, "chain");
    assert.deepEqual(distributedBank.chainAssignments, [
        { id: "chain-pluck-0", articulationId: "pluck", min: 0, max: 63 },
        { id: `chain-${duplicatedSlot.id}-64`, articulationId: duplicatedSlot.id, min: 64, max: 127 },
    ]);

    const keyedBank = assignArticulationToKey(distributedBank, 0, duplicatedSlot.id);
    assert.deepEqual(keyedBank.keyAssignments, [
        { note: 0, articulationId: duplicatedSlot.id },
    ]);

    const modeBank = setArticulationTriggerMode(keyedBank, "vel");
    assert.equal(modeBank.activeTriggerMode, "vel");

    const deletedBank = deleteArticulationSlot(modeBank, "pluck");
    assert.equal(deletedBank.slots.some((slot) => slot.id === "pluck"), false);
    assert.equal(deletedBank.chainAssignments.some((assignment) => assignment.articulationId === "pluck"), false);
    assert.equal(deletedBank.keyAssignments.some((assignment) => assignment.articulationId === "pluck"), false);
    assert.equal(deletedBank.velocityAssignments.some((assignment) => assignment.articulationId === "pluck"), false);

    const lastRemainingBank = normalizeArticulationEditorState({
        selectedSlotId: "only",
        slots: [{ id: "only", runtimeSlot: 0 }],
        keyAssignments: [{ articulationId: "only", note: 5 }],
    });
    assert.deepEqual(deleteArticulationSlot(lastRemainingBank, "only"), lastRemainingBank);
});

test("articulation range editor operations separate replace fill insert move resize and clear", () => {
    const bank = normalizeArticulationEditorState({
        selectedSlotId: "bow",
        slots: [
            { id: "bow", runtimeSlot: 0 },
            { id: "pluck", runtimeSlot: 1 },
            { id: "air", runtimeSlot: 2 },
        ],
        chainAssignments: [
            { id: "chain-bow-full", articulationId: "bow", min: 0, max: 127 },
        ],
    });

    const insertedBank = insertArticulationRangeAtPosition(bank, "chain", 64, "pluck");
    assert.deepEqual(insertedBank.chainAssignments, [
        { id: "chain-bow-full", articulationId: "bow", min: 0, max: 63 },
        { id: "chain-pluck-64", articulationId: "pluck", min: 64, max: 64 },
    ]);

    const resizedBank = resizeArticulationRangeAssignment(
        insertedBank,
        "chain",
        { id: "chain-pluck-64", articulationId: "pluck", min: 64, max: 64 },
        "max",
        70,
    );
    assert.deepEqual(resizedBank.chainAssignments, [
        { id: "chain-bow-full", articulationId: "bow", min: 0, max: 63 },
        { id: "chain-pluck-64", articulationId: "pluck", min: 64, max: 70 },
    ]);

    const movedBank = moveArticulationRangeAssignment(
        resizedBank,
        "chain",
        { id: "chain-pluck-64", articulationId: "pluck", min: 64, max: 70 },
        90,
    );
    assert.deepEqual(movedBank.chainAssignments, [
        { id: "chain-bow-full", articulationId: "bow", min: 0, max: 63 },
        { id: "chain-pluck-64", articulationId: "pluck", min: 87, max: 93 },
    ]);

    const filledGapBank = assignArticulationToRangePosition(movedBank, "chain", 100, "air");
    assert.deepEqual(filledGapBank.chainAssignments, [
        { id: "chain-bow-full", articulationId: "bow", min: 0, max: 63 },
        { id: "chain-pluck-64", articulationId: "pluck", min: 87, max: 93 },
        { id: "chain-air-94", articulationId: "air", min: 94, max: 127 },
    ]);

    const replacedBank = assignArticulationToRangePosition(filledGapBank, "chain", 100, "pluck");
    assert.deepEqual(replacedBank.chainAssignments, [
        { id: "chain-bow-full", articulationId: "bow", min: 0, max: 63 },
        { id: "chain-air-94", articulationId: "pluck", min: 94, max: 127 },
    ]);

    const clearedBank = clearArticulationRangeAssignment(
        replacedBank,
        "chain",
        { id: "chain-pluck-64", articulationId: "pluck", min: 87, max: 93 },
    );
    assert.deepEqual(clearedBank.chainAssignments, [
        { id: "chain-bow-full", articulationId: "bow", min: 0, max: 63 },
        { id: "chain-air-94", articulationId: "pluck", min: 94, max: 127 },
    ]);

    assert.deepEqual(clearArticulationTriggerAssignments(clearedBank, "chain").chainAssignments, []);
});

test("articulation range edits keep one range per articulation and resize through neighbors", () => {
    const bank = normalizeArticulationEditorState({
        selectedSlotId: "bow",
        slots: [
            { id: "bow", runtimeSlot: 0 },
            { id: "pluck", runtimeSlot: 1 },
            { id: "air", runtimeSlot: 2 },
        ],
        chainAssignments: [
            { id: "chain-bow", articulationId: "bow", min: 0, max: 63 },
            { id: "chain-pluck", articulationId: "pluck", min: 64, max: 95 },
            { id: "chain-air", articulationId: "air", min: 96, max: 127 },
        ],
    });

    const movedPluckByInsert = insertArticulationRangeAtPosition(bank, "chain", 110, "pluck");
    assert.deepEqual(movedPluckByInsert.chainAssignments, [
        { id: "chain-bow", articulationId: "bow", min: 0, max: 63 },
        { id: "chain-pluck-110", articulationId: "pluck", min: 110, max: 110 },
        { id: "chain-air", articulationId: "air", min: 111, max: 127 },
    ]);

    const replacedAirWithBow = assignArticulationToRangePosition(bank, "chain", 100, "bow");
    assert.deepEqual(replacedAirWithBow.chainAssignments, [
        { id: "chain-pluck", articulationId: "pluck", min: 64, max: 95 },
        { id: "chain-air", articulationId: "bow", min: 96, max: 127 },
    ]);

    const movedPluckThroughAir = moveArticulationRangeAssignment(
        bank,
        "chain",
        { id: "chain-pluck", articulationId: "pluck", min: 64, max: 95 },
        122,
    );
    assert.deepEqual(movedPluckThroughAir.chainAssignments, [
        { id: "chain-bow", articulationId: "bow", min: 0, max: 63 },
        { id: "chain-pluck", articulationId: "pluck", min: 96, max: 127 },
    ]);

    const expandedBow = resizeArticulationRangeAssignment(
        bank,
        "chain",
        { id: "chain-bow", articulationId: "bow", min: 0, max: 63 },
        "max",
        80,
    );
    assert.deepEqual(expandedBow.chainAssignments, [
        { id: "chain-bow", articulationId: "bow", min: 0, max: 80 },
        { id: "chain-pluck", articulationId: "pluck", min: 81, max: 95 },
        { id: "chain-air", articulationId: "air", min: 96, max: 127 },
    ]);

    const expandedAir = resizeArticulationRangeAssignment(
        bank,
        "chain",
        { id: "chain-air", articulationId: "air", min: 96, max: 127 },
        "min",
        72,
    );
    assert.deepEqual(expandedAir.chainAssignments, [
        { id: "chain-bow", articulationId: "bow", min: 0, max: 63 },
        { id: "chain-pluck", articulationId: "pluck", min: 64, max: 71 },
        { id: "chain-air", articulationId: "air", min: 72, max: 127 },
    ]);
});

 test("articulation trigger compiler emits the active mode and separate Chain Key Vel maps", () => {
    const bank = normalizeArticulationEditorState({
        activeTriggerMode: "vel",
        slots: [
            { id: "bow", runtimeSlot: 3 },
            { id: "pluck", runtimeSlot: 9 },
        ],
        chainAssignments: [
            { id: "chain-bow", articulationId: "bow", min: 12, max: 12 },
            { id: "chain-pluck", articulationId: "pluck", min: 20, max: 22 },
        ],
        keyAssignments: [
            { articulationId: "bow", note: 0 },
            { articulationId: "pluck", note: 1 },
        ],
        velocityAssignments: [
            { id: "vel-bow", articulationId: "bow", min: 1, max: 32 },
            { id: "vel-pluck", articulationId: "pluck", min: 64, max: 64 },
        ],
    });

    const config = buildArticulationTriggerConfig(bank);

    assert.equal(config.activeMode, "vel");
    assert.equal(config.chain[12], 3);
    assert.equal(config.chain[20], 9);
    assert.equal(config.chain[22], 9);
    assert.equal(config.chain[23], -1);
    assert.equal(config.key[0], 3);
    assert.equal(config.key[1], 9);
    assert.equal(config.velocity[0], -1);
    assert.equal(config.velocity[1], 3);
    assert.equal(config.velocity[32], 3);
    assert.equal(config.velocity[64], 9);
    assert.equal(config.velocity[65], -1);
});

test("articulation worker mirrors stored articulations to runtime without GUI ownership", async () => {
    const bank = createCurrentArticulationState([
        createCurrentArticulationSlot(3, {
            overrides: {
                "oscA.framePosition": 0.72,
                "oscA.warpAmount": 0.44,
                filterCutoffHz: 5432,
                msegMorph1: 0.2,
                msegMorph2: 0.4,
                msegMorph3: 0.6,
            },
            routeAmounts: { [WARP_ROUTE_ID]: 0.75 },
        }),
    ]);
    const modulationState = createCurrentModulationState([{
            id: WARP_ROUTE_ID,
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "oscA.warpAmount",
            amount: 0.1,
    }]);
    const connection = new ArticulationWorkerTestConnection({
        values: {
            "articulations.v4": JSON.stringify(bank),
            "modulation.v4": JSON.stringify(modulationState),
        },
    });
    const service = createArticulationWorkerService(connection);

    service.start();
    assert.equal(connection.sentEvents.filter(
        ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    ).length, 0, "large snapshots wait for a known DSP session");
    connection.emitEndpoint("runtimeState", { dspSessionId: 11 });
    await flushMicrotasks(512);
    const runtimeUploads = connection.sentEvents.filter(({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID);
    assert.equal(runtimeUploads.length, 1);
    const slot3Upload = runtimeUploads.find(({ value }) => value.selectorA === 3);
    assert.ok(slot3Upload);
    assert.deepEqual({
        selectorA: slot3Upload.value.selectorA,
        enabled: slot3Upload.value.enabled,
        framePositions: slot3Upload.value.framePositions,
        warpAmounts: slot3Upload.value.warpAmounts,
        filterCutoffHz: slot3Upload.value.filterCutoffHz,
        msegMorphs: slot3Upload.value.msegMorphs,
        routeAmount: slot3Upload.value.routeAmounts[
            getModulationRuntimeCell(modulationState.routes[0]).articulationCellIndex
        ],
    }, {
        selectorA: 3,
        enabled: true,
        framePositions: [0.72, 0, 0],
        warpAmounts: [0.44, 0, 0],
        filterCutoffHz: 5432,
        msegMorphs: [0.2, 0.4, 0.6],
        routeAmount: 0.75,
    });
    assert.equal(runtimeUploads.filter(({ value }) => value.enabled).length, 1);
    assert.equal(runtimeUploads.every(
        ({ value }) => value.dspSessionId === 11 && value.deliverySerial < 0,
    ), true);
    assert.equal(connection.sentTimeouts.every(
        ({ timeoutMilliseconds }) => timeoutMilliseconds === RUNTIME_INSTALL_SEND_TIMEOUT_MS,
    ), true);

    connection.sentEvents = [];
    connection.sentTimeouts = [];
    connection.emitEndpoint("runtimeState", { dspSessionId: 11 });
    await flushMicrotasks();
    assert.deepEqual(connection.sentEvents, []);

    connection.emitEndpoint("runtimeState", { dspSessionId: 11 });
    await flushMicrotasks();
    assert.deepEqual(connection.sentEvents, []);

    for (let editIndex = 0; editIndex < 625; editIndex += 1) {
        connection.emitStoredState("modulation.v4", JSON.stringify({
            ...modulationState,
            routes: modulationState.routes.map((route) => ({
                ...route,
                amount: editIndex % 2 === 0 ? 0.1 : 0.9,
            })),
        }));
    }
    assert.deepEqual(
        connection.sentEvents,
        [],
        "base amount edits remain sparse and do not rebake articulation images",
    );

    const panModulationState = {
        ...modulationState,
        routes: modulationState.routes.map((route) => ({
            ...route,
            id: PAN_ROUTE_ID,
            targetKind: "oscA.pan",
        })),
    };
    connection.emitStoredState("modulation.v4", JSON.stringify(panModulationState));
    await flushMicrotasks();
    const topologyUploads = connection.sentEvents.filter(
        ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    );
    assert.equal(topologyUploads.length, 1);
    assert.equal(topologyUploads[0].value.selectorA, 3);
    const panCell = getModulationRuntimeCell(panModulationState.routes[0]).articulationCellIndex;
    assert.equal(topologyUploads[0].value.routeAmounts[panCell], 1_000_000);

    connection.sentEvents = [];
    const changedBank = {
        ...bank,
        slots: bank.slots.map((slot) => ({
            ...slot,
            routeAmounts: { [PAN_ROUTE_ID]: -0.25 },
        })),
    };
    connection.emitStoredState("articulations.v4", JSON.stringify(changedBank));
    await flushMicrotasks();
    const overrideUploads = connection.sentEvents.filter(
        ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    );
    assert.equal(overrideUploads.length, 1);
    assert.equal(overrideUploads[0].value.selectorA, 3);
    assert.equal(overrideUploads[0].value.routeAmounts[panCell], -0.25);

    connection.sentEvents = [];
    connection.sentTimeouts = [];
    connection.emitEndpoint("runtimeState", { dspSessionId: 12 });
    await flushMicrotasks(512);
    assert.equal(
        connection.sentEvents.filter(({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID).length,
        1,
    );
    assert.equal(connection.sentTimeouts.every(
        ({ timeoutMilliseconds }) => timeoutMilliseconds === RUNTIME_INSTALL_SEND_TIMEOUT_MS,
    ), true);

    service.stop();
});

test("a rejected articulation batch gets one full-state reconciliation", async () => {
    const bank = createCurrentArticulationState([
        createCurrentArticulationSlot(0, { overrides: { "oscA.warpAmount": 0.1 } }),
        createCurrentArticulationSlot(1, { overrides: { "oscA.warpAmount": 0.2 } }),
        createCurrentArticulationSlot(2, { overrides: { "oscA.warpAmount": 0.3 } }),
    ]);
    const connection = new ArticulationWorkerTestConnection({
        values: {
            "articulations.v4": JSON.stringify(bank),
            "modulation.v4": JSON.stringify(createCurrentModulationState()),
        },
    });
    const service = createArticulationWorkerService(connection);
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        service.start();
        connection.emitEndpoint("runtimeState", { dspSessionId: 31 });
        await flushMicrotasks(512);
        const initialSnapshotCount = connection.sentEvents.filter(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        ).length;
        assert.equal(initialSnapshotCount, 3);

        const changedBank = {
            ...bank,
            slots: bank.slots.map((slot, slotIndex) => ({
                ...slot,
                overrides: { ...slot.overrides, "oscA.warpAmount": 0.7 + (slotIndex * 0.1) },
            })),
        };
        connection.rejectNext(ARTICULATION_SNAPSHOT_ENDPOINT_ID, 1);
        connection.emitStoredState("articulations.v4", JSON.stringify(changedBank));
        await flushMicrotasks(512);

        assert.equal(connection.sentEvents.filter(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        ).length, initialSnapshotCount + 3, "the valid selector after a rejection is not starved");
        const firstAttempt = connection.sentEvents.filter(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        ).slice(-3);
        assert.deepEqual(firstAttempt.map(({ value }) => value.selectorA), [0, 1, 2]);
        assert.ok(Math.abs(firstAttempt[2].value.warpAmounts[0] - 0.9) < 1e-12);

        await new Promise((resolve) => setTimeout(resolve, 1_100));
        await flushMicrotasks(1_024);

        const snapshots = connection.sentEvents.filter(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        );
        assert.equal(snapshots.length, initialSnapshotCount + 6, "one replay reconciles all changed slots");
        const replayedSnapshots = snapshots.slice(-3);
        assert.deepEqual(replayedSnapshots.map(({ value }) => value.selectorA), [0, 1, 2]);
        assert.ok(Math.abs(replayedSnapshots[0].value.warpAmounts[0] - 0.7) < 1e-12);
        assert.ok(Math.abs(replayedSnapshots[1].value.warpAmounts[0] - 0.8) < 1e-12);
        assert.ok(Math.abs(replayedSnapshots[2].value.warpAmounts[0] - 0.9) < 1e-12);
    } finally {
        service.stop();
        console.error = originalConsoleError;
    }
});

test("repeated articulation rejection stops after one reconciliation attempt", async () => {
    const bank = createCurrentArticulationState([
        createCurrentArticulationSlot(0, { overrides: { "oscA.warpAmount": 0.1 } }),
    ]);
    const connection = new ArticulationWorkerTestConnection({
        values: {
            "articulations.v4": JSON.stringify(bank),
            "modulation.v4": JSON.stringify(createCurrentModulationState()),
        },
    });
    const service = createArticulationWorkerService(connection);
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        service.start();
        connection.emitEndpoint("runtimeState", { dspSessionId: 32 });
        await flushMicrotasks(512);
        const initialSnapshotCount = connection.sentEvents.filter(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        ).length;
        assert.equal(initialSnapshotCount, 1);

        const changedBank = {
            ...bank,
            slots: bank.slots.map((slot) => ({
                ...slot,
                overrides: { ...slot.overrides, "oscA.warpAmount": 0.9 },
            })),
        };
        connection.rejectNext(ARTICULATION_SNAPSHOT_ENDPOINT_ID, 0, 2);
        connection.emitStoredState("articulations.v4", JSON.stringify(changedBank));
        await flushMicrotasks(512);
        assert.equal(connection.sentEvents.filter(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        ).length, initialSnapshotCount + 1, "the changed snapshot is rejected once");

        await new Promise((resolve) => setTimeout(resolve, 2_200));
        await flushMicrotasks(1_024);

        assert.equal(connection.sentEvents.filter(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        ).length, initialSnapshotCount + 2, "one rejected reconciliation does not start a retry loop");

        const distinctBank = {
            ...changedBank,
            slots: changedBank.slots.map((slot) => ({
                ...slot,
                overrides: { ...slot.overrides, "oscA.warpAmount": 0.6 },
            })),
        };
        connection.rejectNext(ARTICULATION_SNAPSHOT_ENDPOINT_ID);
        connection.emitStoredState("articulations.v4", JSON.stringify(distinctBank));
        await flushMicrotasks(512);
        assert.equal(connection.sentEvents.filter(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        ).length, initialSnapshotCount + 3, "a distinct snapshot gets its own first attempt");

        await new Promise((resolve) => setTimeout(resolve, 1_100));
        await flushMicrotasks(1_024);

        const snapshots = connection.sentEvents.filter(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        );
        assert.equal(snapshots.length, initialSnapshotCount + 4, "a distinct rejection gets one reconciliation");
        assert.ok(Math.abs(snapshots.at(-1).value.warpAmounts[0] - 0.6) < 1e-12);
    } finally {
        service.stop();
        console.error = originalConsoleError;
    }
});

test("headless articulation restore resolves the accepted sparse v4 model", async () => {
    const articulationStateV4 = {
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: "slot-5",
        activeTriggerMode: "key",
        slots: [{
            id: "slot-5",
            runtimeSlot: 5,
            name: "Slot 5",
            color: "#d2a128",
            key: 36,
            velRange: { min: 0, max: 127 },
            chainRange: { min: 0, max: 127 },
            overrides: { "oscA.warpAmount": 0.42 },
            routeAmounts: { [WARP_ROUTE_ID]: 0.66 },
        }],
    };
    const connection = new ArticulationWorkerTestConnection({
        values: {
            "articulations.v4": JSON.stringify(articulationStateV4),
            "modulation.v4": JSON.stringify(createCurrentModulationState([{
                    id: WARP_ROUTE_ID,
                    enabled: true,
                    sourceKind: "mseg",
                    sourceSlot: 1,
                    polarity: "unipolar",
                    targetKind: "oscA.warpAmount",
                    amount: 0.1,
            }])),
        },
    });
    const service = createArticulationWorkerService(connection);

    service.start();
    connection.emitEndpoint("runtimeState", { dspSessionId: 20 });
    await flushMicrotasks(64);

    const snapshotEvents = connection.sentEvents.filter(
        ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    );
    assert.equal(snapshotEvents.length, 1);
    assert.equal(snapshotEvents[0].value.selectorA, 5);
    assert.equal(snapshotEvents[0].value.warpAmounts[0], 0.42);
    const routeCell = getModulationRuntimeCell({
        id: WARP_ROUTE_ID,
        enabled: true,
        sourceKind: "mseg",
        sourceSlot: 1,
        polarity: "unipolar",
        targetKind: "oscA.warpAmount",
        amount: 0.1,
    }).articulationCellIndex;
    assert.notEqual(routeCell, null);
    assert.equal(snapshotEvents[0].value.routeAmounts[routeCell], 0.66);
    assert.equal(snapshotEvents[0].value.dspSessionId, 20);
    assert.equal(snapshotEvents[0].value.deliverySerial, -1);

    service.stop();
});

test("cold rejected modulation uses the accepted default dependency before articulation resolution", async () => {
    const articulationState = createCurrentArticulationState([
        createCurrentArticulationSlot(4, {
            id: "strict-slot",
            overrides: { "oscA.warpAmount": 0.42 },
            routeAmounts: {},
        }),
    ]);
    const connection = new ArticulationWorkerTestConnection({
        values: {
            "articulations.v4": JSON.stringify(articulationState),
            "modulation.v4": JSON.stringify({ format: "legacy", routes: [] }),
        },
    });
    const service = createArticulationWorkerService(connection);
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        service.start();
        connection.emitEndpoint("runtimeState", { dspSessionId: 43 });
        await flushMicrotasks(128);
        const initialUpload = connection.sentEvents.find(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        );
        assert.equal(initialUpload.value.selectorA, 4);
        assert.equal(initialUpload.value.warpAmounts[0], 0.42);
        connection.sentEvents = [];

        connection.emitStoredState(
            "modulation.v4",
            JSON.stringify(createCurrentModulationState([])),
        );
        await flushMicrotasks(128);

        assert.equal(connection.sentEvents.length, 0, "the equivalent valid default does not republish");
    } finally {
        service.stop();
        console.error = originalConsoleError;
    }
});

test("headless hydration and live writes both reject whole phantom-route documents", async () => {
    const modulationState = createCurrentModulationState([
            {
                id: "oscA.framePosition::mseg-1",
                enabled: true,
                sourceKind: "mseg",
                sourceSlot: 1,
                polarity: "unipolar",
                targetKind: "oscA.wavetablePosition",
                amount: 1,
                reducer: "max",
            },
            {
                id: "phaser.phaserPhase::macro-1",
                enabled: true,
                sourceKind: "macro",
                sourceSlot: 1,
                polarity: "bipolar",
                targetKind: "rack.phaserPhase",
                amount: 180,
                reducer: "max",
            },
    ]);
    const validSlot = createCurrentArticulationSlot(5, {
        id: "current-articulation",
        routeAmounts: { "oscA.framePosition::mseg-1": 0.75 },
    });
    const validArticulationState = createCurrentArticulationState([validSlot]);
    const invalidArticulationState = createCurrentArticulationState([{
        ...validSlot,
        routeAmounts: { ...validSlot.routeAmounts, "phaser.phaserPhase::macro-1": 0.5 },
    }]);
    const connection = new ArticulationWorkerTestConnection({
        values: {
            "modulation.v4": JSON.stringify(modulationState),
            "articulations.v4": JSON.stringify(invalidArticulationState),
        },
    });
    const service = createArticulationWorkerService(connection);
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        service.start();
        connection.emitEndpoint("runtimeState", { dspSessionId: 41 });
        await flushMicrotasks(512);

        assert.equal(connection.sentEvents.some(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        ), false, "invalid hydration keeps the initial empty bank");

        connection.emitStoredState("articulations.v4", JSON.stringify(validArticulationState));
        await flushMicrotasks(64);
        const acceptedUpload = connection.sentEvents.find(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        );
        assert.equal(acceptedUpload.value.selectorA, 5);
        const voiceCell = getModulationRuntimeCell(modulationState.routes[0]).articulationCellIndex;
        assert.equal(acceptedUpload.value.routeAmounts[voiceCell], 0.75);

        connection.sentEvents = [];
        connection.emitStoredState("articulations.v4", JSON.stringify(invalidArticulationState));
        await flushMicrotasks(64);
        assert.equal(
            connection.sentEvents.some(
                ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
            ),
            false,
            "the same invalid payload is rejected live without replacing the accepted bank",
        );

        connection.emitEndpoint("runtimeState", { dspSessionId: 42 });
        await flushMicrotasks(64);
        const replay = connection.sentEvents.find(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        );
        assert.equal(replay.value.selectorA, 5);
        assert.equal(replay.value.routeAmounts[voiceCell], 0.75);
    } finally {
        service.stop();
        console.error = originalConsoleError;
    }
});

test("malformed current articulation state is ignored without reading a v3 fallback", async () => {
    const retiredBank = normalizeArticulationEditorState({
        slots: [{ id: "legacy-slot", runtimeSlot: 9 }],
    });
    const connection = new ArticulationWorkerTestConnection({
        values: {
            "articulations.v4": "{not-json",
            [RETIRED_ARTICULATION_STATE_KEY]: JSON.stringify(retiredBank),
            "modulation.v4": JSON.stringify(createCurrentModulationState()),
        },
    });
    const service = createArticulationWorkerService(connection);
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        service.start();
        connection.emitEndpoint("runtimeState", { dspSessionId: 23 });
        await flushMicrotasks(64);

        assert.equal(connection.sentEvents.some(
            ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
        ), false);
    } finally {
        console.error = originalConsoleError;
        service.stop();
    }
});

test("retired uiPatchValues documents are ignored during articulation restore", async () => {
    const connection = new ArticulationWorkerTestConnection({
        values: {
            "articulations.v4": JSON.stringify({
                format: "cosimo.articulations",
                version: 4,
                selectedSlotId: "future-safe-slot",
                activeTriggerMode: "chain",
                slots: [{
                    id: "future-safe-slot",
                    runtimeSlot: 10,
                    name: "Future safe",
                    color: "#d2a128",
                    key: 36,
                    velRange: { min: 0, max: 127 },
                    chainRange: { min: 0, max: 127 },
                    overrides: {},
                    routeAmounts: {},
                }],
            }),
            "uiPatchValues.v2": JSON.stringify({
                "oscA.framePosition": 0.25,
                "future-build.renamed-target": 0.75,
            }),
            "modulation.v4": JSON.stringify(createCurrentModulationState()),
        },
    });
    const service = createArticulationWorkerService(connection);

    service.start();
    connection.emitEndpoint("runtimeState", { dspSessionId: 24 });
    await flushMicrotasks(64);

    const upload = connection.sentEvents.find(
        ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    );
    assert.ok(upload);
    assert.equal(upload.value.selectorA, 10);
    assert.deepEqual(upload.value.framePositions, [0, 0, 0]);
    assert.deepEqual(upload.value.oscillatorOverrideMasks, [0, 0, 0]);

    service.stop();
});

test("separate stored-key boot requests only the current articulation schema", async () => {
    const connection = new ArticulationWorkerTestConnection({
        values: {
            "articulations.v4": JSON.stringify({
                format: "cosimo.articulations",
                version: 4,
                selectedSlotId: "v4-slot",
                activeTriggerMode: "key",
                slots: [{
                    id: "v4-slot",
                    runtimeSlot: 17,
                    name: "V4 Slot",
                    color: "#d2a128",
                    key: 36,
                    velRange: { min: 0, max: 127 },
                    chainRange: { min: 0, max: 127 },
                    overrides: { "oscA.warpAmount": 0.37 },
                    routeAmounts: {},
                }],
            }),
            [RETIRED_ARTICULATION_STATE_KEY]: JSON.stringify(normalizeArticulationEditorState({
                slots: [{ id: "legacy-slot", runtimeSlot: 3 }],
            })),
            "modulation.v4": JSON.stringify(createCurrentModulationState()),
        },
    });
    connection.requestFullStoredState = undefined;
    const service = createArticulationWorkerService(connection);

    service.start();
    connection.emitEndpoint("runtimeState", { dspSessionId: 21 });
    await flushMicrotasks(64);

    const snapshotEvents = connection.sentEvents.filter(
        ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    );
    assert.deepEqual(
        snapshotEvents.map(({ value }) => value.selectorA),
        [17],
    );
    assert.equal(snapshotEvents[0].value.warpAmounts[0], 0.37);
    assert.deepEqual(connection.requestedKeys.sort(), [
        "articulations.v4",
        "modulation.v4",
    ]);

    service.stop();
});

test("live writes to the retired v3 key are ignored", async () => {
    const retiredBank = normalizeArticulationEditorState({
        slots: [{ id: "legacy-slot", runtimeSlot: 3 }],
    });
    const connection = new ArticulationWorkerTestConnection({
        "modulation.v4": JSON.stringify(createCurrentModulationState()),
    });
    connection.requestFullStoredState = undefined;
    const service = createArticulationWorkerService(connection);

    service.start();
    connection.emitEndpoint("runtimeState", { dspSessionId: 22 });
    await flushMicrotasks(64);
    connection.emitStoredState(RETIRED_ARTICULATION_STATE_KEY, JSON.stringify(retiredBank));
    await flushMicrotasks(64);
    assert.equal(connection.sentEvents.some(
        ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    ), false);

    service.stop();
});

test("same-DSP worker reattachment clears selectors the new worker cannot know", async () => {
    const connection = new ArticulationWorkerTestConnection({
        values: {
            "articulations.v4": JSON.stringify(createCurrentArticulationState()),
            "modulation.v4": JSON.stringify(createCurrentModulationState()),
        },
    });
    connection.dspSessionId = 23;
    connection.acceptedArticulationSerial = -9;
    const service = createArticulationWorkerService(connection);

    service.start();
    connection.emitEndpoint("runtimeState", { dspSessionId: 23 });
    await flushMicrotasks(512);

    const snapshotEvents = connection.sentEvents.filter(
        ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    );
    assert.equal(snapshotEvents.length, ARTICULATION_MAX_SLOTS);
    assert.equal(snapshotEvents.every(({ value }) => !value.enabled), true);
    assert.deepEqual(
        snapshotEvents.map(({ value }) => value.deliverySerial),
        Array.from({ length: ARTICULATION_MAX_SLOTS }, (_, index) => -(index + 10)),
    );

    service.stop();
});

test("a full 128-slot articulation restore is acknowledged one image at a time", async () => {
    const bank = createCurrentArticulationState(Array.from(
        { length: ARTICULATION_MAX_SLOTS },
        (_, runtimeSlot) => createCurrentArticulationSlot(runtimeSlot),
    ));
    const connection = new ArticulationWorkerTestConnection({
        values: {
            "articulations.v4": JSON.stringify(bank),
            "modulation.v4": JSON.stringify(createCurrentModulationState()),
        },
    });
    const service = createArticulationWorkerService(connection);

    service.start();
    connection.emitEndpoint("runtimeState", { dspSessionId: 19 });
    await flushMicrotasks(512);

    const snapshotEvents = connection.sentEvents.filter(
        ({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    );
    assert.equal(snapshotEvents.length, ARTICULATION_MAX_SLOTS);
    assert.equal(snapshotEvents.every(
        ({ endpointID, value }, selectorA) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID
            && value.enabled
            && value.selectorA === selectorA
            && value.dspSessionId === 19
            && value.deliverySerial === -(selectorA + 1),
    ), true);
    assert.equal(connection.sentTimeouts.every(
        ({ timeoutMilliseconds }) => timeoutMilliseconds === RUNTIME_INSTALL_SEND_TIMEOUT_MS,
    ), true);

    service.stop();
});
