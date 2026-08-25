/** Horizontal graph space reserved so outer branch pills stay inside the map. */
export const SUBWAY_LANE_GUTTER_PERCENT = 14;

/** Horizontal graph space occupied by the compact branch-rail corridor. */
export const SUBWAY_LANE_SPAN_PERCENT = 72;

/** Shared normalized SVG width for fork and merge connector geometry. */
export const SUBWAY_CONNECTOR_VIEWBOX_WIDTH = 100;

/** Shared normalized SVG height; the merge reverses the fork in this space. */
export const SUBWAY_CONNECTOR_VIEWBOX_HEIGHT = 40;

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
    const laneX = subwayLaneCenterPercent(laneIndex, laneCount);
    return `M 50 20 C 50 30 ${laneX} 30 ${laneX} 40`;
}

/**
 * Build the fork curve in reverse so one branch reaches the merge junction.
 *
 * @throws {RangeError} When the requested lane is outside the rendered group.
 */
export function subwayMergeBranchPath(laneIndex: number, laneCount: number): string {
    const laneX = subwayLaneCenterPercent(laneIndex, laneCount);
    return `M ${laneX} 0 C ${laneX} 10 50 10 50 20`;
}
