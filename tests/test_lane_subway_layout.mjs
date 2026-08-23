import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const laneV1Promise = loadUIModule(repoRoot, "ui/shared/lane-state.ts");
const laneV2Promise = loadUIModule(repoRoot, "ui/shared/lane-state-v2.ts");
const layoutPromise = loadUIModule(repoRoot, "ui/shared/lane-subway-layout.ts");

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

test("a serial document is a single teal line of stations between termini", async () => {
    const laneV2 = await laneV2Promise;
    const layout = await layoutPromise;

    const rows = layout.buildSubwayLayout(laneV2.createDefaultLaneStateV2());
    assert.equal(rows.laneCount, 1);
    assert.equal(rows.rows.length, 10); // in + 8 stations + out
    assert.deepEqual(rows.rows[0], { kind: "terminus", label: "in" });
    assert.deepEqual(rows.rows.at(-1), { kind: "terminus", label: "out" });

    const stationRows = rows.rows.slice(1, -1);
    for (const row of stationRows) {
        assert.equal(row.kind, "stations");
        assert.equal(row.cells.length, 1);
        assert.equal(row.cells[0].kind, "station");
        assert.equal(row.cells[0].tint, "infra");
    }
    // The station is the whole identity: code, number, device, enable.
    assert.deepEqual(stationRows[6].cells[0], {
        kind: "station",
        deviceId: "delay#1",
        deviceType: "delay",
        instanceNumber: 1,
        code: "DLY",
        enabled: false,
        tint: "infra",
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
        "terminus", "fork", "stations", "stations", "merge", "stations", "terminus",
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
    assert.deepEqual(firstRow.cells[1], { kind: "ghost", tint: "infra" });
    assert.equal(secondRow.cells[0].deviceId, "delay#2");
    assert.deepEqual(secondRow.cells[1], { kind: "line", tint: "infra", dashed: true });

    assert.deepEqual(built.rows[4].lanes, [
        { tint: "infra", dashed: false },
        { tint: "infra", dashed: true },
    ]);

    // The trunk resumes as a single lane after the merge.
    assert.equal(built.rows[5].cells.length, 1);
    assert.equal(built.rows[5].cells[0].deviceId, "reverb#1");
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
        "terminus", "fork", "stations", "merge", "terminus",
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
    assert.deepEqual(body.cells[1], { kind: "ghost", tint: "mid" });
    assert.equal(body.cells[2].deviceId, "reverb#1");
    assert.equal(body.cells[2].tint, "hi");

    assert.deepEqual(built.rows[3].lanes, [
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
        { kind: "ghost", tint: "lo" },
        { kind: "ghost", tint: "hi" },
    ]);
});
