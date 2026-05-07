import test from "node:test";
import assert from "node:assert/strict";

import {
    ARTICULATION_MAX_SLOTS,
    ARTICULATION_SNAPSHOT_ENDPOINT_ID,
    ARTICULATION_STATE_KEY,
    buildArticulationRuntimeUploads,
    createArticulationSlotFromSnapshot,
    normalizeArticulationBank,
    normalizeArticulationSnapshot,
} from "../patch_gui/articulations.js";
import { createArticulationWorkerService } from "../patch_gui/articulation-worker-service.js";

class ArticulationWorkerTestConnection {
    constructor(fullStoredState = {}) {
        this.fullStoredState = fullStoredState;
        this.storedStateListeners = new Set();
        this.endpointListeners = new Map();
        this.sentEvents = [];
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

    addEndpointListener(endpointID, listener) {
        const listeners = this.endpointListeners.get(endpointID) ?? new Set();
        listeners.add(listener);
        this.endpointListeners.set(endpointID, listeners);
    }

    removeEndpointListener(endpointID, listener) {
        this.endpointListeners.get(endpointID)?.delete(listener);
    }

    sendEventOrValue(endpointID, value) {
        this.sentEvents.push({ endpointID, value });
    }

    emitEndpoint(endpointID, value) {
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
            playMode: 12,
            glideTime: -1,
            pan: -4,
            warpMode: 99,
            warpAmount: 4,
            filterMode: 99,
            filterCutoff: 5,
            filterQ: 200,
            msegMorphs: [-1, 0.375, 9],
            distortionMode: 9,
            distortionDriveDb: 99,
            distortionKnee: -3,
            distortionWet: 7,
            distortionWetHPHz: 1,
            distortionWetLPHz: 99_000,
            chorusEnabled: 9,
            chorusMix: 9,
            chorusMotionMode: 9,
            chorusBloomMode: 9,
            chorusTone: -1,
            chorusFeedback: 9,
            chorusRingAmount: 9,
            chorusRingOffsetMode: 9,
            chorusRingFineSemitones: 9,
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
        playMode: 2,
        glideTime: 0,
        pan: -1,
        warpMode: 4,
        warpAmount: 1,
        filterMode: 5,
        filterCutoff: 20,
        filterQ: 20,
        msegMorphs: [0, 0.375, 1],
        distortionMode: 1,
        distortionDriveDb: 36,
        distortionKnee: 0,
        distortionWet: 1,
        distortionWetHPHz: 20,
        distortionWetLPHz: 20_000,
        chorusEnabled: 1,
        chorusMix: 1,
        chorusMotionMode: 3,
        chorusBloomMode: 4,
        chorusTone: 0,
        chorusFeedback: 0.95,
        chorusRingAmount: 1,
        chorusRingOffsetMode: 3,
        chorusRingFineSemitones: 2,
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

test("articulation bank normalization keeps selectorA slots unique and drops invalid selections", () => {
    const bank = normalizeArticulationBank(JSON.stringify({
        selectedSlotId: "duplicate-selector",
        slots: [
            { id: "slot-a", selectorA: 4, name: " Slot A " },
            { id: "duplicate-selector", selectorA: 4, name: "Duplicate selector" },
            { id: "slot-b", selectorA: 6, name: "" },
            { id: "slot-b", selectorA: 7, name: "Duplicate id" },
            null,
        ],
    }));

    assert.equal(bank.format, "cosimo.articulations");
    assert.equal(bank.version, 1);
    assert.equal(bank.selectedSlotId, null);
    assert.deepEqual(bank.slots.map((slot) => ({
        id: slot.id,
        selectorA: slot.selectorA,
        name: slot.name,
    })), [
        { id: "slot-a", selectorA: 4, name: "Slot A" },
        { id: "slot-b", selectorA: 6, name: "Art 7" },
    ]);
});

test("new articulation slots choose the first free selectorA and respect the slot cap", () => {
    const existingBank = normalizeArticulationBank({
        slots: [
            { id: "slot-0", selectorA: 0 },
            { id: "slot-2", selectorA: 2 },
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
        selectorA: slot?.selectorA,
        name: slot?.name,
        warpAmount: slot?.snapshot.parameters.warpAmount,
        msegMorphs: slot?.snapshot.parameters.msegMorphs,
        routeAmounts: slot?.snapshot.modRouteAmounts,
    }, {
        id: "articulation-1",
        selectorA: 1,
        name: "Art 2",
        warpAmount: 0.44,
        msegMorphs: [0.1, 0.2, 0.3],
        routeAmounts: [{ routeId: "route-a", amount: 0.5 }],
    });

    const fullBank = normalizeArticulationBank({
        slots: Array.from({ length: ARTICULATION_MAX_SLOTS }, (_, selectorA) => ({
            id: `slot-${selectorA}`,
            selectorA,
        })),
    });

    assert.equal(createArticulationSlotFromSnapshot(fullBank, snapshot), null);
});

test("articulation runtime uploads resolve selectorA slots and route-id amounts to fixed DSP route slots", () => {
    const bank = normalizeArticulationBank({
        slots: [{
            id: "bright",
            selectorA: 5,
            snapshot: normalizeArticulationSnapshot({
                parameters: {
                    wavetablePosition: 0.42,
                    pan: -0.25,
                    warpMode: 3,
                    warpAmount: 0.66,
                    filterMode: 2,
                    filterCutoff: 3456,
                    filterQ: 4.5,
                    msegMorphs: [0.1, 0.2, 0.3],
                },
                envelopes: [{
                    attackSeconds: 0.15,
                    decaySeconds: 0.25,
                    sustain: 0.35,
                    releaseSeconds: 0.45,
                }],
                modRouteAmounts: [
                    { routeId: "route-a", amount: 0.8 },
                    { routeId: "missing-route", amount: 0.9 },
                    { routeId: "route-b", amount: 99 },
                ],
            }),
        }],
    });

    const uploads = buildArticulationRuntimeUploads(bank, [
        {
            id: "route-a",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "warpAmount",
            amount: 0.1,
        },
        {
            id: "route-c",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "pan",
            amount: -0.2,
        },
        {
            id: "route-b",
            enabled: true,
            sourceKind: "env",
            sourceSlot: 2,
            polarity: "bipolar",
            targetKind: "filterQ",
            amount: 1,
        },
    ]);

    assert.equal(uploads.length, ARTICULATION_MAX_SLOTS);
    assert.deepEqual({
        selectorA: uploads[4].selectorA,
        enabled: uploads[4].enabled,
        routeAmounts: uploads[4].routeAmounts.slice(0, 3),
    }, {
        selectorA: 4,
        enabled: false,
        routeAmounts: [0, 0, 0],
    });
    assert.deepEqual({
        selectorA: uploads[5].selectorA,
        enabled: uploads[5].enabled,
        framePosition: uploads[5].framePosition,
        pan: uploads[5].pan,
        warpMode: uploads[5].warpMode,
        warpAmount: uploads[5].warpAmount,
        filterMode: uploads[5].filterMode,
        filterCutoffHz: uploads[5].filterCutoffHz,
        filterQ: uploads[5].filterQ,
        msegMorphs: uploads[5].msegMorphs,
        routeAmounts: uploads[5].routeAmounts.slice(0, 4),
        envelopeAttackSeconds: uploads[5].envelopeAttackSeconds,
        envelopeDecaySeconds: uploads[5].envelopeDecaySeconds,
        envelopeSustain: uploads[5].envelopeSustain,
        envelopeReleaseSeconds: uploads[5].envelopeReleaseSeconds,
    }, {
        selectorA: 5,
        enabled: true,
        framePosition: 0.42,
        pan: -0.25,
        warpMode: 3,
        warpAmount: 0.66,
        filterMode: 2,
        filterCutoffHz: 3456,
        filterQ: 4.5,
        msegMorphs: [0.1, 0.2, 0.3],
        routeAmounts: [0.8, -0.2, 19.9, 0],
        envelopeAttackSeconds: [0.15, 0.01, 0.01],
        envelopeDecaySeconds: [0.25, 0.25, 0.25],
        envelopeSustain: [0.35, 0.5, 0.5],
        envelopeReleaseSeconds: [0.45, 0.2, 0.2],
    });
});

test("articulation worker mirrors stored articulations to runtime without GUI ownership", () => {
    const bank = normalizeArticulationBank({
        slots: [{
            id: "slot-3",
            selectorA: 3,
            snapshot: normalizeArticulationSnapshot({
                parameters: {
                    wavetablePosition: 0.72,
                    warpAmount: 0.44,
                    filterCutoff: 5432,
                    msegMorphs: [0.2, 0.4, 0.6],
                },
                modRouteAmounts: [{ routeId: "route-a", amount: 0.75 }],
            }),
        }],
    });
    const modulationState = {
        format: "cosimo.modulation",
        version: 2,
        routes: [{
            id: "route-a",
            enabled: true,
            sourceKind: "mseg",
            sourceSlot: 1,
            polarity: "unipolar",
            targetKind: "warpAmount",
            amount: 0.1,
        }],
    };
    const connection = new ArticulationWorkerTestConnection({
        values: {
            [ARTICULATION_STATE_KEY]: JSON.stringify(bank),
            "modulation.v2": JSON.stringify(modulationState),
        },
    });
    const service = createArticulationWorkerService(connection);

    service.start();
    assert.deepEqual(connection.sentEvents, []);

    connection.emitEndpoint("runtimeState", { dspSessionId: 11 });

    const runtimeUploads = connection.sentEvents.filter(({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID);
    assert.equal(runtimeUploads.length, ARTICULATION_MAX_SLOTS);
    assert.deepEqual({
        selectorA: runtimeUploads[3].value.selectorA,
        enabled: runtimeUploads[3].value.enabled,
        framePosition: runtimeUploads[3].value.framePosition,
        warpAmount: runtimeUploads[3].value.warpAmount,
        filterCutoffHz: runtimeUploads[3].value.filterCutoffHz,
        msegMorphs: runtimeUploads[3].value.msegMorphs,
        routeAmount0: runtimeUploads[3].value.routeAmounts[0],
        disabledSelector4: runtimeUploads[4].value.enabled,
    }, {
        selectorA: 3,
        enabled: true,
        framePosition: 0.72,
        warpAmount: 0.44,
        filterCutoffHz: 5432,
        msegMorphs: [0.2, 0.4, 0.6],
        routeAmount0: 0.75,
        disabledSelector4: false,
    });

    connection.sentEvents = [];
    connection.emitEndpoint("runtimeState", { dspSessionId: 11 });
    assert.deepEqual(connection.sentEvents, []);

    connection.emitEndpoint("runtimeState", { dspSessionId: 12 });
    assert.equal(
        connection.sentEvents.filter(({ endpointID }) => endpointID === ARTICULATION_SNAPSHOT_ENDPOINT_ID).length,
        ARTICULATION_MAX_SLOTS,
    );

    service.stop();
});
