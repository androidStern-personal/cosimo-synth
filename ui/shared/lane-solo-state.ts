import type { LaneGroupV2, LaneStateV2 } from "./lane-state-v2";
import { LANE_PARALLEL_UNIT_COUNT, LANE_SPLIT_UNIT_COUNT } from "./lane-state";

/** Runtime-only branch audition state. One group id can name at most one selected branch. */
export type LaneSoloState = {
    readonly selectedBranchByGroup: Readonly<Record<string, number>>;
};

/** Fixed-size runtime event consumed by the Cmajor rack. Zero means no Solo; branches are one-based. */
export type LaneSoloUpload = {
    readonly parallelSoloBranches: ReadonlyArray<number>;
    readonly splitSoloBranches: ReadonlyArray<number>;
};

/** Create the empty audition overlay used by a new synth instance. */
export function createLaneSoloState(): LaneSoloState {
    return { selectedBranchByGroup: {} };
}

/**
 * Select one branch for exclusive audition within its group.
 * Invalid group identities and branch indices are rejected without changing state.
 */
export function toggleLaneBranchSolo(
    state: LaneSoloState,
    laneState: LaneStateV2,
    groupId: string,
    branchIndex: number,
): LaneSoloState | null {
    const group = findLaneGroup(laneState, groupId);
    if (group === undefined || !Number.isInteger(branchIndex)
            || branchIndex < 0 || branchIndex >= group.branches.length) {
        return null;
    }

    if (state.selectedBranchByGroup[groupId] === branchIndex) {
        return {
            selectedBranchByGroup: Object.fromEntries(
                Object.entries(state.selectedBranchByGroup)
                    .filter(([candidateGroupId]) => candidateGroupId !== groupId),
            ),
        };
    }

    return {
        selectedBranchByGroup: {
            ...state.selectedBranchByGroup,
            [groupId]: branchIndex,
        },
    };
}

/** Compile group identities into the fixed per-unit runtime audition event. */
export function compileLaneSoloUpload(
    state: LaneSoloState,
    laneState: LaneStateV2,
): LaneSoloUpload {
    const parallelSoloBranches = new Array<number>(LANE_PARALLEL_UNIT_COUNT).fill(0);
    const splitSoloBranches = new Array<number>(LANE_SPLIT_UNIT_COUNT).fill(0);

    for (const node of laneState.chain) {
        if (node.kind === "device") {
            continue;
        }
        const branchIndex = state.selectedBranchByGroup[node.groupId];
        if (branchIndex === undefined || branchIndex < 0 || branchIndex >= node.branches.length) {
            continue;
        }
        const separatorIndex = node.groupId.indexOf("#");
        const unitIndex = Number(node.groupId.slice(separatorIndex + 1)) - 1;
        const soloBranches = node.kind === "parallel" ? parallelSoloBranches : splitSoloBranches;
        if (!Number.isInteger(unitIndex) || unitIndex < 0 || unitIndex >= soloBranches.length) {
            throw new Error(`Invalid lane group id in audition state: ${node.groupId}`);
        }
        soloBranches[unitIndex] = branchIndex + 1;
    }

    return { parallelSoloBranches, splitSoloBranches };
}

function findLaneGroup(laneState: LaneStateV2, groupId: string): LaneGroupV2 | undefined {
    for (const node of laneState.chain) {
        if (node.kind !== "device" && node.groupId === groupId) {
            return node;
        }
    }
    return undefined;
}

const TWO_SPLIT_BANDS = ["low", "high"] as const;
const THREE_SPLIT_BANDS = ["low", "mid", "high"] as const;

function reconcileBranchIndex(
    previousGroup: LaneGroupV2,
    nextGroup: LaneGroupV2,
    branchIndex: number,
): number | null {
    if (branchIndex < 0 || branchIndex >= previousGroup.branches.length) {
        return null;
    }
    if (previousGroup.kind === "parallel" && nextGroup.kind === "parallel") {
        return branchIndex < nextGroup.branches.length ? branchIndex : null;
    }
    if (previousGroup.kind !== "split" || nextGroup.kind !== "split") {
        return null;
    }

    const previousBands = previousGroup.branches.length === 3 ? THREE_SPLIT_BANDS : TWO_SPLIT_BANDS;
    const nextBands = nextGroup.branches.length === 3 ? THREE_SPLIT_BANDS : TWO_SPLIT_BANDS;
    const selectedBand = previousBands[branchIndex];
    if (selectedBand === undefined) {
        return null;
    }
    const nextBranchIndex = nextBands.findIndex((band) => band === selectedBand);
    return nextBranchIndex < 0 ? null : nextBranchIndex;
}

/**
 * Reconcile audition choices after a rack edit without copying them into the rack document.
 * Removed groups and branches lose only their own choice; surviving groups remain selected.
 */
export function reconcileLaneSoloState(
    state: LaneSoloState,
    previousLaneState: LaneStateV2,
    nextLaneState: LaneStateV2,
): LaneSoloState {
    const selectedBranchByGroup: Record<string, number> = {};

    for (const [groupId, branchIndex] of Object.entries(state.selectedBranchByGroup)) {
        const previousGroup = findLaneGroup(previousLaneState, groupId);
        const nextGroup = findLaneGroup(nextLaneState, groupId);
        if (previousGroup === undefined || nextGroup === undefined
                || previousGroup.kind !== nextGroup.kind) {
            continue;
        }
        const nextBranchIndex = reconcileBranchIndex(previousGroup, nextGroup, branchIndex);
        if (nextBranchIndex !== null) {
            selectedBranchByGroup[groupId] = nextBranchIndex;
        }
    }

    return { selectedBranchByGroup };
}
