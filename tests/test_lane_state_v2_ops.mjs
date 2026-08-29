import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const laneV1Promise = loadUIModule(repoRoot, "ui/shared/lane-state.ts");
const laneV2Promise = loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts");

// A three-device serial doc (delay, reverb, chorus on the trunk) — the
// starting point every structural op test builds from.
async function makeSerialDoc() {
    const laneV1 = await laneV1Promise;
    const laneV2 = await laneV2Promise;
    const params = laneV1.createDefaultLaneState().params;
    const parsed = laneV2.parseLaneStateV2({
        format: "cosimo.lane",
        version: 2,
        output: { mix: 1, bypassed: false },
        devices: {
            "delay#1": { params: { ...params.delay } },
            "reverb#1": { params: { ...params.reverb } },
            "chorus#1": { params: { ...params.chorus } },
        },
        chain: [
            { kind: "device", deviceId: "delay#1", enabled: true },
            { kind: "device", deviceId: "reverb#1", enabled: false },
            { kind: "device", deviceId: "chorus#1", enabled: true },
        ],
    });
    assert.equal(parsed._tag, "ok");
    return parsed.value;
}

test("device paths round-trip through the wire codec and locate placements", async () => {
    const laneV2 = await laneV2Promise;
    const doc = await makeSerialDoc();

    assert.deepEqual(laneV2.findLaneDevicePath(doc, "reverb#1"), { kind: "trunk", index: 1 });
    assert.equal(laneV2.findLaneDevicePath(doc, "ott#1"), null);

    const trunkPath = { kind: "trunk", index: 2 };
    const branchPath = { kind: "branch", groupId: "split#1", branchIndex: 1, index: 0 };
    assert.deepEqual(laneV2.parseLaneDevicePath(laneV2.encodeLaneDevicePath(trunkPath)), trunkPath);
    assert.deepEqual(laneV2.parseLaneDevicePath(laneV2.encodeLaneDevicePath(branchPath)), branchPath);
    assert.equal(laneV2.parseLaneDevicePath("garbage"), null);
    assert.equal(laneV2.parseLaneDevicePath("branch:split#1:x:0"), null);
});

test("moveLaneDevice splices along the trunk with stable neighbor semantics", async () => {
    const laneV2 = await laneV2Promise;
    const doc = await makeSerialDoc();

    // Move the last device to the front.
    const moved = laneV2.moveLaneDevice(doc, "chorus#1", { kind: "trunk", index: 0 });
    assert.deepEqual(moved.chain.map((node) => node.deviceId), ["chorus#1", "delay#1", "reverb#1"]);
    // Enables ride the placement.
    assert.equal(moved.chain[0].enabled, true);
    assert.equal(moved.chain[2].enabled, false);

    // Moving forward past its own slot: the index addresses the CURRENT
    // rendered structure, so landing on the last position works.
    const toEnd = laneV2.moveLaneDevice(doc, "delay#1", { kind: "trunk", index: 2 });
    assert.deepEqual(toEnd.chain.map((node) => node.deviceId), ["reverb#1", "chorus#1", "delay#1"]);

    // A no-op move returns an equal document.
    assert.deepEqual(laneV2.moveLaneDevice(doc, "delay#1", { kind: "trunk", index: 0 }), doc);

    // Unknown device or an out-of-range branch target rejects with null.
    assert.equal(laneV2.moveLaneDevice(doc, "ott#1", { kind: "trunk", index: 0 }), null);
    assert.equal(
        laneV2.moveLaneDevice(doc, "delay#1", { kind: "branch", groupId: "split#9", branchIndex: 0, index: 0 }),
        null,
    );
});

test("wrap creates a group around a trunk device and moves cross lanes into it", async () => {
    const laneV2 = await laneV2Promise;
    const doc = await makeSerialDoc();

    const wrapped = laneV2.wrapLaneDeviceInGroup(doc, "reverb#1", "split");
    assert.equal(wrapped.chain.length, 3);
    const group = wrapped.chain[1];
    assert.equal(group.kind, "split");
    assert.equal(group.groupId, "split#1");
    assert.equal(group.enabled, true);
    assert.equal(group.xoverLowHz, 800);
    assert.equal(group.xoverHighHz, 2500);
    assert.deepEqual(group.branches.map((branch) => branch.map((p) => p.deviceId)), [["reverb#1"], []]);
    // The wrapped placement keeps its enable state.
    assert.equal(group.branches[0][0].enabled, false);
    // The document still validates end to end.
    assert.equal(laneV2.parseLaneStateV2(JSON.parse(laneV2.serializeLaneStateV2(wrapped)))._tag, "ok");

    // Drag another trunk device INTO the empty high band.
    const crossed = laneV2.moveLaneDevice(wrapped, "chorus#1", {
        kind: "branch", groupId: "split#1", branchIndex: 1, index: 0,
    });
    assert.deepEqual(crossed.chain.map((node) => node.kind), ["device", "split"]);
    assert.deepEqual(
        crossed.chain[1].branches.map((branch) => branch.map((p) => p.deviceId)),
        [["reverb#1"], ["chorus#1"]],
    );
    assert.deepEqual(laneV2.findLaneDevicePath(crossed, "chorus#1"),
                     { kind: "branch", groupId: "split#1", branchIndex: 1, index: 0 });

    // And back out to the trunk.
    const backOut = laneV2.moveLaneDevice(crossed, "reverb#1", { kind: "trunk", index: 0 });
    assert.equal(backOut.chain[0].deviceId, "reverb#1");
    assert.deepEqual(backOut.chain[2].branches.map((branch) => branch.length), [0, 1]);

    // A trunk device still wraps; a device already inside a group cannot
    // (the wire cannot nest); group ids allocate the smallest free unit.
    assert.notEqual(laneV2.wrapLaneDeviceInGroup(crossed, "delay#1", "parallel"), null);
    assert.equal(laneV2.wrapLaneDeviceInGroup(crossed, "reverb#1", "parallel"), null);
    const second = laneV2.wrapLaneDeviceInGroup(wrapped, "delay#1", "split");
    assert.equal(second.chain[0].groupId, "split#2");
    assert.equal(laneV2.wrapLaneDeviceInGroup(crossed, "chorus#1", "split"), null);
});

test("dissolve splices members serially back into the trunk", async () => {
    const laneV2 = await laneV2Promise;
    const doc = await makeSerialDoc();
    const wrapped = laneV2.wrapLaneDeviceInGroup(doc, "reverb#1", "parallel");
    const crossed = laneV2.moveLaneDevice(wrapped, "chorus#1", {
        kind: "branch", groupId: "parallel#1", branchIndex: 1, index: 0,
    });

    const dissolved = laneV2.dissolveLaneGroup(crossed, "parallel#1");
    assert.deepEqual(dissolved.chain.map((node) => node.deviceId), ["delay#1", "reverb#1", "chorus#1"]);
    assert.equal(laneV2.dissolveLaneGroup(doc, "parallel#1"), null);
});

test("split crossovers and branch counts edit within the wire's bounds", async () => {
    const laneV2 = await laneV2Promise;
    const doc = await makeSerialDoc();
    const wrapped = laneV2.wrapLaneDeviceInGroup(doc, "reverb#1", "split");

    const retuned = laneV2.setLaneSplitCrossoverHz(wrapped, "split#1", "low", 425);
    assert.equal(retuned.chain[1].xoverLowHz, 425);
    assert.equal(laneV2.setLaneSplitCrossoverHz(wrapped, "split#1", "high", 25000), null);
    assert.equal(laneV2.setLaneSplitCrossoverHz(wrapped, "split#9", "low", 425), null);

    // 2 -> 3 bands inserts an EMPTY middle band: LO and HI device sets are
    // stable, and the new band arrives silent between them.
    const threeBand = laneV2.setLaneGroupBranchCount(wrapped, "split#1", 3);
    assert.deepEqual(threeBand.chain[1].branches.map((branch) => branch.length), [1, 0, 0]);
    const occupiedHigh = laneV2.moveLaneDevice(threeBand, "chorus#1", {
        kind: "branch", groupId: "split#1", branchIndex: 2, index: 0,
    });
    assert.deepEqual(occupiedHigh.chain[1].branches.map((branch) => branch.length), [1, 0, 1]);

    // 3 -> 2 removes the middle band and only when it is EMPTY.
    const backToTwo = laneV2.setLaneGroupBranchCount(occupiedHigh, "split#1", 2);
    assert.deepEqual(backToTwo.chain[1].branches.map((branch) => branch.length), [1, 1]);
    const occupiedMid = laneV2.moveLaneDevice(occupiedHigh, "chorus#1", {
        kind: "branch", groupId: "split#1", branchIndex: 1, index: 0,
    });
    assert.equal(laneV2.setLaneGroupBranchCount(occupiedMid, "split#1", 2), null);

    // Splits cap at three bands; parallels at four branches, shrink only
    // when the last branch is empty.
    assert.equal(laneV2.setLaneGroupBranchCount(threeBand, "split#1", 4), null);
    const parallel = laneV2.wrapLaneDeviceInGroup(doc, "delay#1", "parallel");
    const wide = laneV2.setLaneGroupBranchCount(parallel, "parallel#1", 4);
    assert.equal(wide.chain[0].branches.length, 4);
    assert.equal(laneV2.setLaneGroupBranchCount(wide, "parallel#1", 5), null);
    assert.equal(laneV2.setLaneGroupBranchCount(wide, "parallel#1", 3).chain[0].branches.length, 3);
});

test("enable and parameter setters address devices and groups by identity", async () => {
    const laneV2 = await laneV2Promise;
    const doc = await makeSerialDoc();

    const enabled = laneV2.setLaneDeviceEnabled(doc, "reverb#1", true);
    assert.equal(enabled.chain[1].enabled, true);
    assert.equal(laneV2.getLaneDeviceEnabled(enabled, "reverb#1"), true);
    assert.equal(laneV2.getLaneDeviceEnabled(doc, "reverb#1"), false);
    assert.equal(laneV2.setLaneDeviceEnabled(doc, "ott#1", true), null);

    const wrapped = laneV2.wrapLaneDeviceInGroup(doc, "reverb#1", "split");
    // Placement enables reach into branches too.
    const branchEnabled = laneV2.setLaneDeviceEnabled(wrapped, "reverb#1", true);
    assert.equal(branchEnabled.chain[1].branches[0][0].enabled, true);

    const bypassed = laneV2.setLaneGroupEnabled(wrapped, "split#1", false);
    assert.equal(bypassed.chain[1].enabled, false);
    assert.equal(laneV2.setLaneGroupEnabled(wrapped, "parallel#1", false), null);

    const edited = laneV2.setLaneDeviceParam(doc, "delay#1", "delayTime", 125);
    assert.equal(edited.devices["delay#1"].params.delayTime, 125);
    assert.equal(doc.devices["delay#1"].params.delayTime !== 125, true);
    assert.equal(laneV2.setLaneDeviceParam(doc, "delay#1", "nope", 1), null);
});

test("wrap respects the wire-length cap", async () => {
    const laneV1 = await laneV1Promise;
    const laneV2 = await laneV2Promise;
    // The legacy eight-device doc plus three wraps = 8 + 3 markers = 11;
    // wire capacity allows one more group of each kind until 16 entries.
    // (The fresh default is the starter trio now, so the cap math builds
    // on the v1 upgrade explicitly.)
    let doc = laneV2.upgradeLaneStateV1(laneV1.createDefaultLaneState());
    for (const id of ["globalFilter#1", "distortion#1", "ott#1", "chorus#1"]) {
        doc = laneV2.wrapLaneDeviceInGroup(doc, id, "parallel");
        assert.notEqual(doc, null);
    }
    // 8 devices + 4 parallel markers = 12; four splits would pass 16.
    for (const id of ["flanger#1", "phaser#1", "delay#1", "reverb#1"]) {
        const next = laneV2.wrapLaneDeviceInGroup(doc, id, "split");
        if (next === null) {
            // The cap refused before the document could overflow the upload.
            assert.equal(laneV2.compileLaneTopologyUpload(doc).chainLength <= 16, true);
            return;
        }
        doc = next;
    }
    assert.equal(laneV2.compileLaneTopologyUpload(doc).chainLength, 16);
});

test("addLaneDevice allocates instances, defaults params, and lands on the path", async () => {
    const laneV2 = await laneV2Promise;
    const doc = await makeSerialDoc();

    // A second delay lands at the end of the trunk with instance #2 and the
    // type's descriptor defaults, enabled from birth.
    const added = laneV2.addLaneDevice(doc, "delay", { kind: "trunk", index: 3 });
    assert.equal(added.chain[3].deviceId, "delay#2");
    assert.equal(added.chain[3].enabled, true);
    assert.equal(added.devices["delay#2"].params.delayTime, 375);
    assert.equal(laneV2.parseLaneStateV2(JSON.parse(laneV2.serializeLaneStateV2(added)))._tag, "ok");

    // Into a band: the new device claims the ghost's insertion point.
    const wrapped = laneV2.wrapLaneDeviceInGroup(doc, "reverb#1", "split");
    const banded = laneV2.addLaneDevice(wrapped, "ott", {
        kind: "branch", groupId: "split#1", branchIndex: 1, index: 0,
    });
    assert.deepEqual(
        banded.chain[1].branches.map((branch) => branch.map((p) => p.deviceId)),
        [["reverb#1"], ["ott#1"]],
    );

    // Allocation reuses the smallest free number.
    const third = laneV2.addLaneDevice(added, "delay", { kind: "trunk", index: 0 });
    assert.equal(third.chain[0].deviceId, "delay#3");
    const afterRemove = laneV2.removeLaneDevice(third, "delay#2");
    const refilled = laneV2.addLaneDevice(afterRemove, "delay", { kind: "trunk", index: 0 });
    assert.equal(refilled.chain[0].deviceId, "delay#2");

    // The pool caps at five instances per type.
    let stacked = doc;
    for (let count = 0; count < 4; count += 1) {
        stacked = laneV2.addLaneDevice(stacked, "flanger", { kind: "trunk", index: 0 });
        assert.notEqual(stacked, null);
    }
    stacked = laneV2.addLaneDevice(stacked, "flanger", { kind: "trunk", index: 0 });
    assert.notEqual(stacked, null);
    assert.equal(laneV2.addLaneDevice(stacked, "flanger", { kind: "trunk", index: 0 }), null);

    // And the wire stays inside one topology upload.
    const laneV1 = await laneV1Promise;
    let full = laneV2.upgradeLaneStateV1(laneV1.createDefaultLaneState());
    for (const deviceType of ["delay", "delay", "delay", "delay", "reverb", "reverb", "reverb", "reverb"]) {
        full = laneV2.addLaneDevice(full, deviceType, { kind: "trunk", index: 0 });
        assert.notEqual(full, null, deviceType);
    }
    assert.equal(laneV2.compileLaneTopologyUpload(full).chainLength, 16);
    assert.equal(laneV2.addLaneDevice(full, "chorus", { kind: "trunk", index: 0 }), null);

    // A bad target rejects.
    assert.equal(laneV2.addLaneDevice(doc, "delay", {
        kind: "branch", groupId: "split#9", branchIndex: 0, index: 0,
    }), null);
});

test("removeLaneDevice drops the placement and the record, wherever it sits", async () => {
    const laneV2 = await laneV2Promise;
    const doc = await makeSerialDoc();

    const removed = laneV2.removeLaneDevice(doc, "reverb#1");
    assert.deepEqual(removed.chain.map((node) => node.deviceId), ["delay#1", "chorus#1"]);
    assert.equal(removed.devices["reverb#1"], undefined);
    assert.equal(laneV2.parseLaneStateV2(JSON.parse(laneV2.serializeLaneStateV2(removed)))._tag, "ok");

    // From inside a branch too; the group survives with an empty band.
    const wrapped = laneV2.wrapLaneDeviceInGroup(doc, "reverb#1", "split");
    const removedFromBand = laneV2.removeLaneDevice(wrapped, "reverb#1");
    assert.deepEqual(removedFromBand.chain[1].branches.map((branch) => branch.length), [0, 0]);
    assert.equal(removedFromBand.devices["reverb#1"], undefined);

    // Removing everything leaves the legal empty chain (the dry instrument).
    let empty = doc;
    for (const deviceId of ["delay#1", "reverb#1", "chorus#1"]) {
        empty = laneV2.removeLaneDevice(empty, deviceId);
    }
    assert.deepEqual(empty.chain, []);
    assert.equal(laneV2.parseLaneStateV2(JSON.parse(laneV2.serializeLaneStateV2(empty)))._tag, "ok");
    assert.equal(laneV2.compileLaneTopologyUpload(empty).chainLength, 0);

    assert.equal(laneV2.removeLaneDevice(doc, "ott#1"), null);
});

test("replaceLaneDevice preserves the exact trunk or branch path and resets defaults", async () => {
    const laneV2 = await laneV2Promise;
    const doc = await makeSerialDoc();

    const edited = laneV2.setLaneDeviceParam(doc, "delay#1", "delayTime", 987);
    const sameType = laneV2.replaceLaneDevice(edited, "delay#1", "delay");
    assert.deepEqual(laneV2.findLaneDevicePath(sameType, "delay#1"), { kind: "trunk", index: 0 });
    assert.equal(sameType.devices["delay#1"].params.delayTime, 375);
    assert.deepEqual(sameType.devices["delay#1"].params, laneV2.laneDefaultParamsForType("delay"));

    const trunkSwap = laneV2.replaceLaneDevice(doc, "reverb#1", "flanger");
    assert.deepEqual(laneV2.findLaneDevicePath(trunkSwap, "flanger#1"), { kind: "trunk", index: 1 });
    assert.equal(trunkSwap.chain[1].enabled, true);
    assert.equal(trunkSwap.devices["reverb#1"], undefined);
    assert.deepEqual(trunkSwap.devices["flanger#1"].params, laneV2.laneDefaultParamsForType("flanger"));

    const parallel = laneV2.wrapLaneDeviceInGroup(doc, "reverb#1", "parallel");
    const populatedParallel = laneV2.moveLaneDevice(parallel, "chorus#1", {
        kind: "branch", groupId: "parallel#1", branchIndex: 1, index: 0,
    });
    const parallelSwap = laneV2.replaceLaneDevice(populatedParallel, "chorus#1", "ott");
    assert.deepEqual(laneV2.findLaneDevicePath(parallelSwap, "ott#1"), {
        kind: "branch", groupId: "parallel#1", branchIndex: 1, index: 0,
    });
    assert.equal(parallelSwap.devices["chorus#1"], undefined);

    const split = laneV2.wrapLaneDeviceInGroup(doc, "reverb#1", "split");
    const splitSwap = laneV2.replaceLaneDevice(split, "reverb#1", "phaser");
    assert.deepEqual(laneV2.findLaneDevicePath(splitSwap, "phaser#1"), {
        kind: "branch", groupId: "split#1", branchIndex: 0, index: 0,
    });
    assert.equal(splitSwap.devices["reverb#1"], undefined);
    assert.equal(laneV2.replaceLaneDevice(doc, "ott#1", "delay"), null);
});

test("the chain walk lists device ids in dispatch order for host surfaces", async () => {
    const laneV2 = await laneV2Promise;
    const doc = await makeSerialDoc();
    const wrapped = laneV2.wrapLaneDeviceInGroup(doc, "reverb#1", "parallel");
    const crossed = laneV2.moveLaneDevice(wrapped, "chorus#1", {
        kind: "branch", groupId: "parallel#1", branchIndex: 1, index: 0,
    });

    assert.deepEqual(laneV2.listLaneChainDeviceIds(doc), ["delay#1", "reverb#1", "chorus#1"]);
    assert.deepEqual(laneV2.listLaneChainDeviceIds(crossed), ["delay#1", "reverb#1", "chorus#1"]);
});
