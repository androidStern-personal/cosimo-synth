/** The graph spends its full measured width on branch ownership. */
export const SUBWAY_LANE_GUTTER_PERCENT = 0;

/** Horizontal graph space occupied by the branch-rail corridor. */
export const SUBWAY_LANE_SPAN_PERCENT = 100;

/** Shared normalized SVG width for fork and merge connector geometry. */
export const SUBWAY_CONNECTOR_VIEWBOX_WIDTH = 100;

/** Shared normalized SVG height; the merge reverses the fork in this space. */
export const SUBWAY_CONNECTOR_VIEWBOX_HEIGHT = 40;

export type SubwayCompactLaneAllocation = {
    /** CSS grid tracks and connector rails are projections of these values. */
    readonly trackPercentages: ReadonlyArray<number>;
    readonly laneCenters: ReadonlyArray<number>;
    readonly gridTemplate: string;
};

/**
 * Decide responsive branch geometry from the rendered graph content width.
 * This is deliberately not a viewport query: the same synth can be embedded
 * in a narrow plugin column inside a wide host window.
 */
export function subwayUsesCompactLaneAllocation(graphWidth: number, laneCount: number): boolean {
    if (!Number.isFinite(graphWidth) || graphWidth <= 0) {
        return false;
    }
    if (!Number.isInteger(laneCount) || laneCount < 2 || laneCount > 4) {
        throw new RangeError(`Invalid responsive subway lane count ${laneCount}`);
    }
    return graphWidth <= (laneCount === 4 ? 319 : 239);
}

/**
 * Own the phone graph's unequal branch allocation in one place.
 *
 * At the 176 px phone floor the weights are physical. Two lanes get 88 px
 * each. Three readable bands reserve 76 px for each outer chip and leave a
 * 24 px MID rail (the chips alternate vertical tiers). Four Parallel lanes
 * get four exact 44 px action tracks while the focused detail chip alternates
 * tiers with compact siblings. CSS tracks, SVG endpoints, and later drag
 * previews all consume this one projection.
 *
 * @throws {RangeError} When the group or focused branch is unsupported.
 */
export function subwayCompactLaneAllocation(
    laneCount: number,
    focusedBranchIndex: number,
): SubwayCompactLaneAllocation {
    if (!Number.isInteger(laneCount)
            || laneCount < 2
            || laneCount > 4
            || !Number.isInteger(focusedBranchIndex)
            || focusedBranchIndex < 0
            || focusedBranchIndex >= laneCount) {
        throw new RangeError(`Invalid compact subway focus ${focusedBranchIndex} of ${laneCount}`);
    }

    const weights = laneCount === 2
        ? [88, 88]
        : laneCount === 3
            ? [76, 24, 76]
            : [44, 44, 44, 44];
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = 0;
    const trackPercentages = weights.map((weight) => (weight / total) * 100);
    const laneCenters = weights.map((weight) => {
        const center = ((cursor + (weight / 2)) / total) * SUBWAY_CONNECTOR_VIEWBOX_WIDTH;
        cursor += weight;
        return center;
    });
    return {
        trackPercentages,
        laneCenters,
        gridTemplate: trackPercentages.map((percentage) => `${percentage}%`).join(" "),
    };
}

/** One trunk reaches the fork junction before any branch diverges. */
export const SUBWAY_FORK_TRUNK_PATH = "M 50 0 L 50 20";

/** Every merged branch reaches one junction before the trunk leaves it. */
export const SUBWAY_MERGE_TRUNK_PATH = "M 50 20 L 50 40";

/**
 * Resolve one branch rail's horizontal center in normalized graph space.
 *
 * @throws {RangeError} When the requested lane is outside the rendered group.
 */
export function subwayLaneCenterPercent(laneIndex: number, laneCount: number): number {
    if (!Number.isInteger(laneIndex)
            || !Number.isInteger(laneCount)
            || laneCount < 1
            || laneIndex < 0
            || laneIndex >= laneCount) {
        throw new RangeError(`Invalid subway lane ${laneIndex} of ${laneCount}`);
    }
    return SUBWAY_LANE_GUTTER_PERCENT
        + (SUBWAY_LANE_SPAN_PERCENT * ((laneIndex + 0.5) / laneCount));
}

/**
 * Build one smooth branch path leaving the common fork junction.
 *
 * @throws {RangeError} When the requested lane is outside the rendered group.
 */
export function subwayForkBranchPath(laneIndex: number, laneCount: number): string {
    return subwayForkBranchPathAt(subwayLaneCenterPercent(laneIndex, laneCount));
}

/** Build one smooth fork path ending at an explicitly allocated rail center. */
export function subwayForkBranchPathAt(laneCenterPercent: number): string {
    if (!Number.isFinite(laneCenterPercent)
            || laneCenterPercent < 0
            || laneCenterPercent > SUBWAY_CONNECTOR_VIEWBOX_WIDTH) {
        throw new RangeError(`Invalid subway lane center ${laneCenterPercent}`);
    }
    return `M 50 20 C 50 30 ${laneCenterPercent} 30 ${laneCenterPercent} 40`;
}

/**
 * Build the fork curve in reverse so one branch reaches the merge junction.
 *
 * @throws {RangeError} When the requested lane is outside the rendered group.
 */
export function subwayMergeBranchPath(laneIndex: number, laneCount: number): string {
    return subwayMergeBranchPathAt(subwayLaneCenterPercent(laneIndex, laneCount));
}

/** Build one smooth merge path beginning at an explicitly allocated rail center. */
export function subwayMergeBranchPathAt(laneCenterPercent: number): string {
    if (!Number.isFinite(laneCenterPercent)
            || laneCenterPercent < 0
            || laneCenterPercent > SUBWAY_CONNECTOR_VIEWBOX_WIDTH) {
        throw new RangeError(`Invalid subway lane center ${laneCenterPercent}`);
    }
    return `M ${laneCenterPercent} 0 C ${laneCenterPercent} 10 50 10 50 20`;
}
