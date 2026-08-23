import assert from "node:assert/strict";
import test from "node:test";

import { buildBounceBank, encodeBounceBank } from "../bounce/bank-format.mjs";
import { digestBounceBank } from "../bounce/capture.mjs";
import {
    createBounceCapturePlan,
    createBounceCaptureSnapshot,
} from "../bounce/capture-plan.mjs";
import {
    ARTICULATIONS_STATE_KEY,
    BOUNCE_STATE_KEY,
    LANE_STATE_KEY,
    MODULATION_STATE_KEY,
    createBouncePatchDocument,
    readBounceDocumentFromPatch,
    serializeBouncePatchDocument,
} from "../bounce/document.mjs";
import {
    BounceTransitionCoordinator,
    BounceTransitionError,
} from "../bounce/transition.mjs";

function oldPatchDocument() {
    const modulation = {
        format: "cosimo.modulation",
        version: 6,
        msegSlots: [{ id: "preserved-mseg" }],
        envelopeSlots: [{ name: "Slow air" }],
        routes: [{ id: "route-1", sourceKind: "macro", targetKind: "filterMix" }],
        macroNames: ["Motion", "Air", "Edge", "Space"],
    };
    const lane = {
        format: "cosimo.lane",
        version: 1,
        order: ["filter", "drive", "ott", "chorus", "flanger", "phaser", "delay", "reverb"],
        enabled: {
            filter: true,
            drive: false,
            ott: true,
            chorus: false,
            flanger: false,
            phaser: false,
            delay: true,
            reverb: true,
        },
        params: { marker: 0.731 },
    };
    const articulations = {
        format: "cosimo.articulations",
        version: 4,
        selectedSlotId: "pad",
        activeTriggerMode: "key",
        slots: [{
            id: "pad",
            runtimeSlot: 2,
            name: "Pad",
            color: "blue",
            key: 24,
            velRange: { min: 1, max: 127 },
            chainRange: { min: 0, max: 127 },
            overrides: {
                "oscA.warpAmount": 0.4,
                filterMode: 2,
                filterCutoffHz: 4_000,
                "env1.releaseSeconds": 2.5,
            },
            routeAmounts: { "route-1": 0.8 },
        }],
    };
    return createBouncePatchDocument({
        parameters: {
            ampRelease: 1.7,
            env1Release: 2.5,
            filterCutoff: 4_200,
            filterMode: 3,
            glideTime: 0.37,
            macro1: 0.62,
            mseg1Rate: 1.2,
            oscAWarpAmount: 0.44,
            playMode: 2,
            sourceMode: 0,
        },
        storedState: {
            [MODULATION_STATE_KEY]: JSON.stringify(modulation),
            [LANE_STATE_KEY]: JSON.stringify(lane),
            [ARTICULATIONS_STATE_KEY]: JSON.stringify(articulations),
            [BOUNCE_STATE_KEY]: null,
        },
    });
}

async function candidateCapture() {
    const snapshot = createBounceCaptureSnapshot({
        sampleRate: 8_000,
        tempoBpm: 137,
        parameters: { sourceMode: 0 },
    });
    const plan = createBounceCapturePlan(snapshot, {
        roots: [60],
        holdSeconds: 0.01,
        tailCapSeconds: 0.01,
    });
    const samples = new Int16Array(160 * 2);
    for (let frame = 0; frame < 160; frame += 1) {
        samples[frame * 2] = Math.round(Math.sin(frame / 7) * 1_000);
        samples[(frame * 2) + 1] = Math.round(Math.cos(frame / 9) * 900);
    }
    const bank = buildBounceBank({ sampleRate: 8_000, roots: [{ note: 60, samples }] });
    const bytes = encodeBounceBank(bank);
    return {
        plan,
        bank,
        bytes,
        digest: await digestBounceBank(bytes),
        segments: [{
            rootNote: 60,
            frameOffset: 0,
            frameCount: 160,
            noteOffFrameOffset: 80,
            tailFrameCount: 80,
        }],
        metrics: [],
    };
}

function stagedHandle(log) {
    let settled = false;
    return {
        async commit(apply) {
            assert.equal(settled, false);
            settled = true;
            log.push("commit-bank");
            await apply();
        },
        async abort() {
            if (!settled) {
                settled = true;
                log.push("abort-bank");
            }
        },
    };
}

function createTestCoordinator({ capture, persistBank, stageBankInstall, verifyCapture, applied, log }) {
    return new BounceTransitionCoordinator({
        capture,
        persistBank: persistBank ?? (async () => log.push("persist")),
        stageBankInstall: stageBankInstall ?? (async () => {
            log.push("stage-bank");
            return stagedHandle(log);
        }),
        verifyCapture: verifyCapture ?? (async () => log.push("verify")),
        applyPatchDocument(document) {
            log.push("apply-document");
            applied.push(document);
        },
    });
}

test("M4 publishes one neutral bounce.v1 transaction and Revert restores exact document equality", async () => {
    const before = oldPatchDocument();
    const capture = await candidateCapture();
    const log = [];
    const applied = [];
    const coordinator = createTestCoordinator({ capture: async () => capture, applied, log });
    const result = await coordinator.bounce({ preBouncePatchDocument: before });

    assert.deepEqual(log, ["persist", "stage-bank", "verify", "commit-bank", "apply-document"]);
    assert.equal(applied.length, 1);
    const after = applied[0];
    assert.equal(after.parameters.sourceMode, 1);
    assert.equal(after.parameters.filterMode, 0);
    for (const key of [
        "ampRelease", "env1Release", "filterCutoff", "glideTime", "macro1",
        "mseg1Rate", "oscAWarpAmount", "playMode",
    ]) {
        assert.equal(after.parameters[key], before.parameters[key], `${key} must be preserved`);
    }
    const beforeModulation = JSON.parse(before.storedState[MODULATION_STATE_KEY]);
    const afterModulation = JSON.parse(after.storedState[MODULATION_STATE_KEY]);
    assert.deepEqual(afterModulation.routes, []);
    assert.deepEqual(afterModulation.msegSlots, beforeModulation.msegSlots);
    assert.deepEqual(afterModulation.envelopeSlots, beforeModulation.envelopeSlots);
    assert.deepEqual(afterModulation.macroNames, beforeModulation.macroNames);
    const afterLane = JSON.parse(after.storedState[LANE_STATE_KEY]);
    assert.equal(Object.values(afterLane.enabled).every((value) => value === false), true);
    assert.equal(afterLane.params.marker, 0.731);
    const afterArticulations = JSON.parse(after.storedState[ARTICULATIONS_STATE_KEY]);
    assert.deepEqual(afterArticulations.slots[0].routeAmounts, {});
    assert.equal(Object.hasOwn(afterArticulations.slots[0].overrides, "filterMode"), false);
    assert.equal(afterArticulations.slots[0].overrides["oscA.warpAmount"], 0.4);
    assert.equal(afterArticulations.slots[0].overrides["env1.releaseSeconds"], 2.5);

    const bounce = readBounceDocumentFromPatch(after);
    assert.equal(bounce.digest, capture.digest);
    assert.equal(bounce.generation, 1);
    assert.deepEqual(bounce.roots, [60]);
    assert.equal(bounce.capture.sampleRate, 8_000);
    assert.equal(bounce.capture.tempoBpm, 137);
    assert.equal(bounce.segments[0].noteOffFrameOffset, 80);
    assert.equal(bounce.revertRef.bankDigest, null);
    assert.equal(
        serializeBouncePatchDocument(bounce.revertRef.patchDocument),
        serializeBouncePatchDocument(before),
    );
    assert.equal(result.patchDocument, after);

    const reverted = await coordinator.revert(after);
    assert.equal(
        serializeBouncePatchDocument(reverted),
        serializeBouncePatchDocument(before),
    );
    assert.equal(
        serializeBouncePatchDocument(applied.at(-1)),
        serializeBouncePatchDocument(before),
    );
});

test("cancel during worker capture leaves persistence, live bank, and document untouched", async () => {
    const before = oldPatchDocument();
    const log = [];
    const applied = [];
    const coordinator = createTestCoordinator({
        applied,
        log,
        capture: ({ signal }) => new Promise((_, reject) => {
            signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")));
        }),
    });
    const bouncePromise = coordinator.bounce({ preBouncePatchDocument: before });
    queueMicrotask(() => coordinator.cancel());
    await assert.rejects(bouncePromise, (error) => (
        error instanceof BounceTransitionError && error.code === "cancelled"
    ));
    assert.deepEqual(log, []);
    assert.deepEqual(applied, []);
    assert.equal(serializeBouncePatchDocument(before), serializeBouncePatchDocument(oldPatchDocument()));
});

test("bad digest is rejected before persistence or a live install", async () => {
    const capture = await candidateCapture();
    const log = [];
    const applied = [];
    const coordinator = createTestCoordinator({
        capture: async () => ({ ...capture, digest: "0".repeat(64) }),
        applied,
        log,
    });
    await assert.rejects(
        coordinator.bounce({ preBouncePatchDocument: oldPatchDocument() }),
        (error) => error.code === "bad-digest",
    );
    assert.deepEqual(log, []);
    assert.deepEqual(applied, []);
});

test("install timeout after persistence never flips the old sound", async () => {
    const capture = await candidateCapture();
    const before = oldPatchDocument();
    const log = [];
    const applied = [];
    const coordinator = createTestCoordinator({
        capture: async () => capture,
        applied,
        log,
        stageBankInstall: async () => {
            const error = new Error("ack missing");
            error.code = "timeout";
            throw error;
        },
    });
    await assert.rejects(
        coordinator.bounce({ preBouncePatchDocument: before }),
        (error) => error.code === "install-timeout",
    );
    assert.deepEqual(log, ["persist"]);
    assert.deepEqual(applied, []);
    assert.equal(serializeBouncePatchDocument(before), serializeBouncePatchDocument(oldPatchDocument()));
});

test("verification failure aborts the inactive bank without publishing a document", async () => {
    const capture = await candidateCapture();
    const log = [];
    const applied = [];
    const coordinator = createTestCoordinator({
        capture: async () => capture,
        applied,
        log,
        verifyCapture: async () => { throw new Error("sanity render mismatch"); },
    });
    await assert.rejects(
        coordinator.bounce({ preBouncePatchDocument: oldPatchDocument() }),
        (error) => error.code === "verify-failed",
    );
    assert.deepEqual(log, ["persist", "stage-bank", "abort-bank"]);
    assert.deepEqual(applied, []);
});
