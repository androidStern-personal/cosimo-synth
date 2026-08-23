import type { LaneDeviceType } from "./lane-modulation-targets";
import {
    parseLaneInstanceId,
    type LaneDevicePathV2,
    type LaneDevicePlacementV2,
    type LaneGroupV2,
    type LaneStateV2,
} from "./lane-state-v2";

/**
 * The subway-map layout model (M3, locked direction: canvas "FX Rack Subway
 * Map"). A lane.v2 document becomes a vertical script of ROWS the renderer
 * draws top to bottom — the WHOLE topology always in view, devices shrunk to
 * station pills. This model is geometry-free: lanes are indices (the
 * renderer spaces them around the trunk), rows are semantic (station body,
 * fork, merge, terminus), and interaction state (selection, drag) is the
 * view's overlay, never stored here.
 *
 * Vocabulary from the accepted mocks: lines are INFRA TEAL; frequency bands
 * are the one semantic color exception (lo/mid/hi tints). A parallel fork is
 * a dot junction with lettered lanes; a split is a diamond with band-labeled
 * lanes and crossover readouts. An empty branch is a dashed lane opened by a
 * GHOST add-stub station; a bypassed group keeps its stations (members still
 * advance in the engine) and the view dims the whole section.
 */

export type SubwayTint = "infra" | "lo" | "mid" | "hi";

export type SubwayStationCell = {
    readonly kind: "station";
    readonly deviceId: string;
    readonly deviceType: LaneDeviceType;
    readonly instanceNumber: number;
    readonly code: string;
    readonly enabled: boolean;
    readonly tint: SubwayTint;
    /** The placement's document coordinates — also its drop-target path. */
    readonly path: LaneDevicePathV2;
};

export type SubwayLineCell = {
    readonly kind: "line";
    readonly tint: SubwayTint;
    readonly dashed: boolean;
};

export type SubwayGhostCell = {
    readonly kind: "ghost";
    readonly tint: SubwayTint;
    /** The empty branch's insertion point for adds and cross-lane drops. */
    readonly path: LaneDevicePathV2;
};

export type SubwayCell = SubwayStationCell | SubwayLineCell | SubwayGhostCell;

export type SubwayForkLane = {
    readonly label: string;
    readonly tint: SubwayTint;
    readonly empty: boolean;
};

export type SubwayMergeLane = {
    readonly tint: SubwayTint;
    readonly dashed: boolean;
};

export type SubwayRow =
    | { readonly kind: "terminus"; readonly label: "in" | "out" }
    | { readonly kind: "stations"; readonly cells: ReadonlyArray<SubwayCell> }
    | {
        readonly kind: "fork";
        readonly groupId: string;
        readonly groupKind: "parallel" | "split";
        readonly bypassed: boolean;
        readonly lanes: ReadonlyArray<SubwayForkLane>;
        readonly crossovers: { readonly lowHz: number; readonly highHz: number | null } | null;
      }
    | { readonly kind: "merge"; readonly lanes: ReadonlyArray<SubwayMergeLane> };

export type SubwayLayout = {
    readonly rows: ReadonlyArray<SubwayRow>;
    readonly laneCount: number;
};

/** Station pill codes, per the mocks ("DLY 2"): code here, number separate. */
export const SUBWAY_STATION_CODES: Readonly<Record<LaneDeviceType, string>> = Object.freeze({
    globalFilter: "FLT",
    distortion: "DRV",
    ott: "OTT",
    chorus: "CHO",
    flanger: "FLG",
    phaser: "PHA",
    delay: "DLY",
    reverb: "RVB",
});

const PARALLEL_LANE_LABELS = ["A", "B", "C", "D"] as const;
const SPLIT_LANE_LABELS: Readonly<Record<number, ReadonlyArray<string>>> = Object.freeze({
    2: ["LO", "HI"],
    3: ["LO", "MID", "HI"],
});
const SPLIT_LANE_TINTS: Readonly<Record<number, ReadonlyArray<SubwayTint>>> = Object.freeze({
    2: ["lo", "hi"],
    3: ["lo", "mid", "hi"],
});

function stationCell(
    placement: LaneDevicePlacementV2,
    tint: SubwayTint,
    path: LaneDevicePathV2,
): SubwayStationCell {
    const parsed = parseLaneInstanceId(placement.deviceId);
    if (parsed === null) {
        throw new Error(`Invalid lane instance id in state: ${placement.deviceId}`);
    }
    return {
        kind: "station",
        deviceId: placement.deviceId,
        deviceType: parsed.deviceType,
        instanceNumber: parsed.instanceNumber,
        code: SUBWAY_STATION_CODES[parsed.deviceType],
        enabled: placement.enabled,
        tint,
        path,
    };
}

function groupRows(group: LaneGroupV2): SubwayRow[] {
    const branchCount = group.branches.length;
    const tints: ReadonlyArray<SubwayTint> = group.kind === "split"
        ? SPLIT_LANE_TINTS[branchCount]
        : Array<SubwayTint>(branchCount).fill("infra");
    const labels: ReadonlyArray<string> = group.kind === "split"
        ? SPLIT_LANE_LABELS[branchCount]
        : PARALLEL_LANE_LABELS.slice(0, branchCount);

    const rows: SubwayRow[] = [{
        kind: "fork",
        groupId: group.groupId,
        groupKind: group.kind,
        bypassed: !group.enabled,
        lanes: group.branches.map((branch, index) => ({
            label: labels[index],
            tint: tints[index],
            empty: branch.length === 0,
        })),
        crossovers: group.kind === "split"
            ? {
                lowHz: group.xoverLowHz,
                // The high crossover only exists once there is a band above it.
                highHz: branchCount === 3 ? group.xoverHighHz : null,
              }
            : null,
    }];

    // The body is as tall as the longest branch — and never shorter than one
    // row, so an all-empty group still shows its ghost add-stubs. A lane past
    // its branch's last station carries the line onward; an empty lane opens
    // with a ghost and continues dashed.
    const bodyRowCount = Math.max(1, ...group.branches.map((branch) => branch.length));
    for (let rowIndex = 0; rowIndex < bodyRowCount; rowIndex += 1) {
        rows.push({
            kind: "stations",
            cells: group.branches.map((branch, laneIndex): SubwayCell => {
                const branchPath = (index: number): LaneDevicePathV2 => (
                    { kind: "branch", groupId: group.groupId, branchIndex: laneIndex, index }
                );
                if (rowIndex < branch.length) {
                    return stationCell(branch[rowIndex], tints[laneIndex], branchPath(rowIndex));
                }
                if (branch.length === 0 && rowIndex === 0) {
                    return { kind: "ghost", tint: tints[laneIndex], path: branchPath(0) };
                }
                return { kind: "line", tint: tints[laneIndex], dashed: branch.length === 0 };
            }),
        });
    }

    rows.push({
        kind: "merge",
        lanes: group.branches.map((branch, laneIndex) => ({
            tint: tints[laneIndex],
            dashed: branch.length === 0,
        })),
    });

    return rows;
}

/** Build the complete subway script for one lane.v2 document. */
export function buildSubwayLayout(state: LaneStateV2): SubwayLayout {
    const rows: SubwayRow[] = [{ kind: "terminus", label: "in" }];
    let laneCount = 1;

    for (const [nodeIndex, node] of state.chain.entries()) {
        if (node.kind === "device") {
            rows.push({
                kind: "stations",
                cells: [stationCell(node, "infra", { kind: "trunk", index: nodeIndex })],
            });
            continue;
        }
        laneCount = Math.max(laneCount, node.branches.length);
        rows.push(...groupRows(node));
    }

    // The line always ends with the trunk's add affordance: a ghost whose
    // path is the end-of-chain insertion point — the tap target for adding
    // a device and the drop target for moving one to the end.
    rows.push({
        kind: "stations",
        cells: [{ kind: "ghost", tint: "infra", path: { kind: "trunk", index: state.chain.length } }],
    });

    rows.push({ kind: "terminus", label: "out" });
    return { rows, laneCount };
}
