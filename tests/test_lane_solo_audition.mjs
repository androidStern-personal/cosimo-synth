import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const auditionPromise = loadUIModule(repoRoot, "ui/shared/lane-solo-audition.ts");

const laneState = {
    format: "cosimo.lane",
    version: 2,
    devices: {},
    chain: [
        {
            kind: "parallel",
            groupId: "parallel#1",
            enabled: true,
            branches: [[], []],
        },
    ],
};

test("Solo lives on the running patch connection and writes only its runtime event", async () => {
    const audition = await auditionPromise;
    const runtimeWrites = [];
    const storedWrites = [];
    const connection = {
        sendEventOrValue(endpointID, value) {
            runtimeWrites.push({ endpointID, value });
        },
        sendStoredStateValue(key, value) {
            storedWrites.push({ key, value });
        },
    };

    audition.toggleLaneSoloAudition(connection, laneState, "parallel#1", 1);

    assert.deepEqual(audition.readLaneSoloAudition(connection), {
        selectedBranchByGroup: { "parallel#1": 1 },
    });
    assert.deepEqual(runtimeWrites, [{
        endpointID: "laneSolo",
        value: {
            parallelSoloBranches: [2, 0, 0, 0],
            splitSoloBranches: [0, 0, 0, 0],
        },
    }]);
    assert.deepEqual(storedWrites, []);
});

test("ordinary remount-style reads retain Solo on the same synth connection", async () => {
    const audition = await auditionPromise;
    const firstConnection = { sendEventOrValue() {} };
    const secondConnection = { sendEventOrValue() {} };

    audition.toggleLaneSoloAudition(firstConnection, laneState, "parallel#1", 0);

    assert.deepEqual(audition.readLaneSoloAudition(firstConnection), {
        selectedBranchByGroup: { "parallel#1": 0 },
    });
    assert.deepEqual(audition.readLaneSoloAudition(secondConnection), {
        selectedBranchByGroup: {},
    });
});

test("Init or preset reset clears every group with one zero runtime event", async () => {
    const audition = await auditionPromise;
    const runtimeWrites = [];
    const connection = {
        sendEventOrValue(endpointID, value) {
            runtimeWrites.push({ endpointID, value });
        },
    };
    const twoGroups = {
        ...laneState,
        chain: [
            laneState.chain[0],
            {
                kind: "split",
                groupId: "split#2",
                enabled: true,
                xoverLowHz: 800,
                xoverHighHz: 2500,
                branches: [[], []],
            },
        ],
    };

    audition.toggleLaneSoloAudition(connection, twoGroups, "parallel#1", 1);
    audition.toggleLaneSoloAudition(connection, twoGroups, "split#2", 0);
    assert.equal(audition.clearLaneSoloAudition(connection), true);

    assert.deepEqual(audition.readLaneSoloAudition(connection), {
        selectedBranchByGroup: {},
    });
    assert.deepEqual(runtimeWrites.at(-1), {
        endpointID: "laneSolo",
        value: {
            parallelSoloBranches: [0, 0, 0, 0],
            splitSoloBranches: [0, 0, 0, 0],
        },
    });
    assert.equal(audition.clearLaneSoloAudition(connection), false);
    assert.equal(runtimeWrites.length, 3);
});

test("rack deletion reconciliation clears only the affected group at runtime", async () => {
    const audition = await auditionPromise;
    const runtimeWrites = [];
    const connection = {
        sendEventOrValue(endpointID, value) {
            runtimeWrites.push({ endpointID, value });
        },
    };
    const twoGroups = {
        ...laneState,
        chain: [
            laneState.chain[0],
            {
                kind: "split",
                groupId: "split#2",
                enabled: true,
                xoverLowHz: 800,
                xoverHighHz: 2500,
                branches: [[], []],
            },
        ],
    };
    audition.toggleLaneSoloAudition(connection, twoGroups, "parallel#1", 1);
    audition.toggleLaneSoloAudition(connection, twoGroups, "split#2", 0);

    const splitOnly = { ...twoGroups, chain: [twoGroups.chain[1]] };
    audition.reconcileLaneSoloAudition(connection, twoGroups, splitOnly);

    assert.deepEqual(audition.readLaneSoloAudition(connection), {
        selectedBranchByGroup: { "split#2": 0 },
    });
    assert.deepEqual(runtimeWrites.at(-1)?.value, {
        parallelSoloBranches: [0, 0, 0, 0],
        splitSoloBranches: [0, 1, 0, 0],
    });
});
