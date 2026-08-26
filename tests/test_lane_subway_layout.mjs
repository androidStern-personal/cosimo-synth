import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const laneV1Promise = loadUIModule(repoRoot, "ui/shared/lane-state.ts");
const laneV2Promise = loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts");
const layoutPromise = loadUIModule(repoRoot, "ui/shared/lane-subway-layout.ts");
const connectorGeometryPromise = loadUIModule(repoRoot, "ui/shared/subway-connector-geometry.ts");

function assertApproximately(actual, expected, tolerance = 1e-9) {
    assert.equal(Math.abs(actual - expected) <= tolerance, true, `${actual} ~= ${expected}`);
}

async function parseDoc(chainAndDevices) {
    const laneV2 = await laneV2Promise;
    const parsed = laneV2.parseLaneStateV2({ format: "cosimo.lane", version: 2, ...chainAndDevices });
    assert.equal(parsed._tag, "ok", parsed._tag === "err" ? parsed.message : "");
    return parsed.value;
}

async function defaultParams(effectId) {
    const laneV1 = await laneV1Promise;
    return { ...laneV1.createDefaultLaneState().params[effectId] };
}

test("compact branch allocation owns both responsive tracks and connector anchors", async () => {
    const geometry = await connectorGeometryPromise;
    assert.equal(geometry.subwayUsesCompactLaneAllocation(176, 3), true);
    assert.equal(geometry.subwayUsesCompactLaneAllocation(240, 3), false);
    assert.equal(geometry.subwayUsesCompactLaneAllocation(319, 4), true);
    assert.equal(geometry.subwayUsesCompactLaneAllocation(320, 4), false);
    assert.equal(geometry.subwayUsesCompactLaneAllocation(0, 3), false);
    assert.throws(() => geometry.subwayUsesCompactLaneAllocation(176, 5), RangeError);
    const threeLane = geometry.subwayCompactLaneAllocation(3, 1);
    assertApproximately(threeLane.trackPercentages[0], (76 / 176) * 100);
    assertApproximately(threeLane.trackPercentages[1], (24 / 176) * 100);
    assertApproximately(threeLane.trackPercentages[2], (76 / 176) * 100);
    assert.deepEqual(threeLane.laneCenters, [(38 / 176) * 100, 50, (138 / 176) * 100]);

    const fourLane = geometry.subwayCompactLaneAllocation(4, 2);
    assert.deepEqual(fourLane.trackPercentages, [25, 25, 25, 25]);
    assert.deepEqual(fourLane.laneCenters, [12.5, 37.5, 62.5, 87.5]);
    assert.equal(
        geometry.subwayForkBranchPathAt(fourLane.laneCenters[2]).endsWith(
            `${fourLane.laneCenters[2]} 40`,
        ),
        true,
    );
    assert.throws(() => geometry.subwayCompactLaneAllocation(5, 0), RangeError);
    assert.throws(() => geometry.subwayCompactLaneAllocation(3, 3), RangeError);
});

test("a serial document is a single teal line of stations between termini", async () => {
    const laneV2 = await laneV2Promise;
    const layout = await layoutPromise;

    const emptyDocument = await parseDoc({ devices: {}, chain: [] });
    assert.deepEqual(layout.buildSubwayLayout(emptyDocument).rows[1], {
        kind: "stations",
        cells: [{
            kind: "ghost",
            tint: "infra",
            dashed: false,
            path: { kind: "trunk", index: 0 },
        }],
    });

    // The fresh default is the starter trio: drive → delay → reverb.
    const rows = layout.buildSubwayLayout(laneV2.createDefaultLaneStateV2());
    assert.equal(rows.laneCount, 1);
    assert.equal(rows.rows.length, 6); // in + 3 stations + add ghost + out
    assert.deepEqual(rows.rows[0], { kind: "terminus", label: "in" });
    assert.deepEqual(rows.rows.at(-1), { kind: "terminus", label: "out" });
    // The line always ends with the trunk's add affordance: a ghost whose
    // path is the end-of-chain insertion point (also a drop target).
    assert.deepEqual(rows.rows.at(-2), {
        kind: "stations",
        cells: [{
            kind: "ghost",
            tint: "infra",
            dashed: false,
            path: { kind: "trunk", index: 3 },
        }],
    });

    const stationRows = rows.rows.slice(1, -2);
    assert.deepEqual(
        stationRows.map((row) => row.cells[0].deviceId),
        ["distortion#1", "delay#1", "reverb#1"],
    );
    for (const row of stationRows) {
        assert.equal(row.kind, "stations");
        assert.equal(row.cells.length, 1);
        assert.equal(row.cells[0].kind, "station");
        assert.equal(row.cells[0].tint, "infra");
    }
    // The station is the whole identity: code, number, device, enable.
    assert.deepEqual(stationRows[1].cells[0], {
        kind: "station",
        deviceId: "delay#1",
        deviceType: "delay",
        instanceNumber: 1,
        code: "DLY",
        enabled: false,
        tint: "infra",
        path: { kind: "trunk", index: 1 },
    });
});

test("a parallel group forks teal lanes, ghosts its empty branch, and merges", async () => {
    const layout = await layoutPromise;
    const doc = await parseDoc({
        devices: {
            "delay#1": { params: await defaultParams("delay") },
            "delay#2": { params: await defaultParams("delay") },
            "reverb#1": { params: await defaultParams("reverb") },
        },
        chain: [
            {
                kind: "parallel",
                groupId: "parallel#1",
                enabled: true,
                branches: [
                    [
                        { kind: "device", deviceId: "delay#1", enabled: true },
                        { kind: "device", deviceId: "delay#2", enabled: true },
                    ],
                    [],
                ],
            },
            { kind: "device", deviceId: "reverb#1", enabled: true },
        ],
    });

    const built = layout.buildSubwayLayout(doc);
    assert.equal(built.laneCount, 2);
    assert.deepEqual(built.rows.map((row) => row.kind), [
        "terminus", "fork", "stations", "stations", "stations", "merge", "stations", "stations", "terminus",
    ]);
    assert.deepEqual(built.rows[7].cells, [
        { kind: "ghost", tint: "infra", dashed: false, path: { kind: "trunk", index: 2 } },
    ]);

    const fork = built.rows[1];
    assert.equal(fork.groupKind, "parallel");
    assert.equal(fork.groupId, "parallel#1");
    assert.equal(fork.bypassed, false);
    assert.equal(fork.crossovers, null);
    assert.deepEqual(fork.lanes, [
        { label: "A", tint: "infra", empty: false },
        { label: "B", tint: "infra", empty: true },
    ]);

    // Branch A chains two stations; branch B is a ghost stub then dashed line.
    const [firstRow, secondRow] = [built.rows[2], built.rows[3]];
    assert.equal(firstRow.cells[0].kind, "station");
    assert.equal(firstRow.cells[0].deviceId, "delay#1");
    assert.deepEqual(firstRow.cells[1], {
        kind: "ghost",
        tint: "infra",
        dashed: true,
        path: { kind: "branch", groupId: "parallel#1", branchIndex: 1, index: 0 },
    });
    assert.equal(secondRow.cells[0].deviceId, "delay#2");
    assert.deepEqual(secondRow.cells[1], { kind: "line", tint: "infra", dashed: true });

    // Every populated branch gets the exact append anchor immediately after
    // its last station; the empty branch keeps its first insertion anchor.
    assert.deepEqual(built.rows[4].cells, [
        {
            kind: "ghost",
            tint: "infra",
            dashed: false,
            path: { kind: "branch", groupId: "parallel#1", branchIndex: 0, index: 2 },
        },
        { kind: "line", tint: "infra", dashed: true },
    ]);

    assert.deepEqual(built.rows[5].lanes, [
        { tint: "infra", dashed: false },
        { tint: "infra", dashed: true },
    ]);

    // The trunk resumes as a single lane after the merge.
    assert.equal(built.rows[6].cells.length, 1);
    assert.equal(built.rows[6].cells[0].deviceId, "reverb#1");
});

test("a split group tints its bands, reads out crossovers, and marks bypass", async () => {
    const layout = await layoutPromise;
    const doc = await parseDoc({
        devices: {
            "ott#1": { params: await defaultParams("ott") },
            "reverb#1": { params: await defaultParams("reverb") },
        },
        chain: [
            {
                kind: "split",
                groupId: "split#1",
                enabled: false,
                xoverLowHz: 250,
                xoverHighHz: 2500,
                branches: [
                    [{ kind: "device", deviceId: "ott#1", enabled: true }],
                    [],
                    [{ kind: "device", deviceId: "reverb#1", enabled: true }],
                ],
            },
        ],
    });

    const built = layout.buildSubwayLayout(doc);
    assert.equal(built.laneCount, 3);
    assert.deepEqual(built.rows.map((row) => row.kind), [
        "terminus", "fork", "stations", "stations", "merge", "stations", "terminus",
    ]);
    assert.deepEqual(built.rows[5].cells, [
        { kind: "ghost", tint: "infra", dashed: false, path: { kind: "trunk", index: 1 } },
    ]);

    const fork = built.rows[1];
    assert.equal(fork.groupKind, "split");
    assert.equal(fork.bypassed, true);
    assert.deepEqual(fork.crossovers, { lowHz: 250, highHz: 2500 });
    assert.deepEqual(fork.lanes, [
        { label: "LO", tint: "lo", empty: false },
        { label: "MID", tint: "mid", empty: true },
        { label: "HI", tint: "hi", empty: false },
    ]);

    const body = built.rows[2];
    assert.equal(body.cells[0].deviceId, "ott#1");
    assert.equal(body.cells[0].tint, "lo");
    assert.deepEqual(body.cells[1], {
        kind: "ghost",
        tint: "mid",
        dashed: true,
        path: { kind: "branch", groupId: "split#1", branchIndex: 1, index: 0 },
    });
    assert.equal(body.cells[2].deviceId, "reverb#1");
    assert.equal(body.cells[2].tint, "hi");

    assert.deepEqual(built.rows[3].cells, [
        {
            kind: "ghost",
            tint: "lo",
            dashed: false,
            path: { kind: "branch", groupId: "split#1", branchIndex: 0, index: 1 },
        },
        { kind: "line", tint: "mid", dashed: true },
        {
            kind: "ghost",
            tint: "hi",
            dashed: false,
            path: { kind: "branch", groupId: "split#1", branchIndex: 2, index: 1 },
        },
    ]);

    assert.deepEqual(built.rows[4].lanes, [
        { tint: "lo", dashed: false },
        { tint: "mid", dashed: true },
        { tint: "hi", dashed: false },
    ]);
});

test("a two-band split has no high crossover readout, and empty groups still render", async () => {
    const layout = await layoutPromise;
    const doc = await parseDoc({
        devices: {},
        chain: [
            {
                kind: "split",
                groupId: "split#1",
                enabled: true,
                xoverLowHz: 800,
                xoverHighHz: 2500,
                branches: [[], []],
            },
        ],
    });

    const built = layout.buildSubwayLayout(doc);
    const fork = built.rows[1];
    assert.deepEqual(fork.crossovers, { lowHz: 800, highHz: null });
    assert.deepEqual(fork.lanes.map((lane) => lane.label), ["LO", "HI"]);
    assert.deepEqual(fork.lanes.map((lane) => lane.tint), ["lo", "hi"]);

    // A group with no devices at all still shows one ghost row per lane —
    // the add affordance the accepted mock draws.
    const body = built.rows[2];
    assert.equal(body.kind, "stations");
    assert.deepEqual(body.cells, [
        {
            kind: "ghost",
            tint: "lo",
            dashed: true,
            path: { kind: "branch", groupId: "split#1", branchIndex: 0, index: 0 },
        },
        {
            kind: "ghost",
            tint: "hi",
            dashed: true,
            path: { kind: "branch", groupId: "split#1", branchIndex: 1, index: 0 },
        },
    ]);
});
