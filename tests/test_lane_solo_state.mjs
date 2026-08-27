import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { loadUIModule } from "./helpers/load_ui_module.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const laneSoloPromise = loadUIModule(repoRoot, "ui/shared/lane-solo-state.ts");

const laneState = {
    format: "cosimo.lane",
    version: 2,
    devices: {},
    chain: [
        {
            kind: "parallel",
            groupId: "parallel#1",
            enabled: true,
            branches: [[], [], []],
        },
    ],
};

test("selecting another branch switches the exclusive Solo within that group", async () => {
    const solo = await laneSoloPromise;
    const first = solo.toggleLaneBranchSolo(
        solo.createLaneSoloState(),
        laneState,
        "parallel#1",
        0,
    );
    const switched = solo.toggleLaneBranchSolo(first, laneState, "parallel#1", 2);

    assert.deepEqual(switched, { selectedBranchByGroup: { "parallel#1": 2 } });
});

test("tapping the active Solo clears that group", async () => {
    const solo = await laneSoloPromise;
    const selected = solo.toggleLaneBranchSolo(
        solo.createLaneSoloState(),
        laneState,
        "parallel#1",
        1,
    );
    const cleared = solo.toggleLaneBranchSolo(selected, laneState, "parallel#1", 1);

    assert.deepEqual(cleared, solo.createLaneSoloState());
});

test("sequential groups keep independent Solo choices in one runtime upload", async () => {
    const solo = await laneSoloPromise;
    const sequentialGroups = {
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
    const parallelSelected = solo.toggleLaneBranchSolo(
        solo.createLaneSoloState(),
        sequentialGroups,
        "parallel#1",
        2,
    );
    const bothSelected = solo.toggleLaneBranchSolo(
        parallelSelected,
        sequentialGroups,
        "split#2",
        0,
    );

    assert.deepEqual(bothSelected, {
        selectedBranchByGroup: { "parallel#1": 2, "split#2": 0 },
    });
    assert.deepEqual(solo.compileLaneSoloUpload(bothSelected, sequentialGroups), {
        parallelSoloBranches: [3, 0, 0, 0],
        splitSoloBranches: [0, 1, 0, 0],
    });
});

test("every supported Split and Parallel fan-out compiles its last branch exactly", async () => {
    const solo = await laneSoloPromise;
    const cases = [
        { kind: "parallel", branchCount: 2 },
        { kind: "parallel", branchCount: 3 },
        { kind: "parallel", branchCount: 4 },
        { kind: "split", branchCount: 2 },
        { kind: "split", branchCount: 3 },
    ];

    for (const { kind, branchCount } of cases) {
        const groupId = `${kind}#1`;
        const group = {
            kind,
            groupId,
            enabled: true,
            branches: new Array(branchCount).fill(null).map(() => []),
            ...(kind === "split" ? { xoverLowHz: 800, xoverHighHz: 2500 } : {}),
        };
        const state = { ...laneState, chain: [group] };
        const selected = solo.toggleLaneBranchSolo(
            solo.createLaneSoloState(), state, groupId, branchCount - 1,
        );
        const upload = solo.compileLaneSoloUpload(selected, state);

        assert.equal(
            kind === "parallel" ? upload.parallelSoloBranches[0] : upload.splitSoloBranches[0],
            branchCount,
            `${kind} ${branchCount}`,
        );
    }
});

test("deleting a soloed group clears only that group's Solo", async () => {
    const solo = await laneSoloPromise;
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
    const parallelSelected = solo.toggleLaneBranchSolo(
        solo.createLaneSoloState(), twoGroups, "parallel#1", 1,
    );
    const bothSelected = solo.toggleLaneBranchSolo(
        parallelSelected, twoGroups, "split#2", 0,
    );
    const splitOnly = { ...twoGroups, chain: [twoGroups.chain[1]] };

    assert.deepEqual(solo.reconcileLaneSoloState(bothSelected, twoGroups, splitOnly), {
        selectedBranchByGroup: { "split#2": 0 },
    });
});

test("deleting a soloed split band clears only that group's Solo", async () => {
    const solo = await laneSoloPromise;
    const threeBandSplit = {
        ...laneState,
        chain: [
            laneState.chain[0],
            {
                kind: "split",
                groupId: "split#2",
                enabled: true,
                xoverLowHz: 800,
                xoverHighHz: 2500,
                branches: [[], [], []],
            },
        ],
    };
    const parallelSelected = solo.toggleLaneBranchSolo(
        solo.createLaneSoloState(), threeBandSplit, "parallel#1", 0,
    );
    const midSelected = solo.toggleLaneBranchSolo(
        parallelSelected, threeBandSplit, "split#2", 1,
    );
    const withoutMidBand = {
        ...threeBandSplit,
        chain: [
            threeBandSplit.chain[0],
            { ...threeBandSplit.chain[1], branches: [[], []] },
        ],
    };

    assert.deepEqual(solo.reconcileLaneSoloState(midSelected, threeBandSplit, withoutMidBand), {
        selectedBranchByGroup: { "parallel#1": 0 },
    });
});

test("deleting a soloed Parallel branch clears only that group's Solo", async () => {
    const solo = await laneSoloPromise;
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
    const parallelSelected = solo.toggleLaneBranchSolo(
        solo.createLaneSoloState(), twoGroups, "parallel#1", 2,
    );
    const bothSelected = solo.toggleLaneBranchSolo(
        parallelSelected, twoGroups, "split#2", 1,
    );
    const withoutSelectedParallelBranch = {
        ...twoGroups,
        chain: [
            { ...twoGroups.chain[0], branches: [[], []] },
            twoGroups.chain[1],
        ],
    };

    assert.deepEqual(
        solo.reconcileLaneSoloState(bothSelected, twoGroups, withoutSelectedParallelBranch),
        { selectedBranchByGroup: { "split#2": 1 } },
    );
});
