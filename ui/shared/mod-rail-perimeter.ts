/**
 * Pure geometry for the perimeter-docked mobile Mod rail (T10B).
 *
 * The rail docks flush against the left or right screen edge, travels
 * vertically inside a keep-out band (safe areas plus fixed chrome), snaps to
 * three vertical anchors, opens its drawer toward the larger free side, and
 * persists its dock (edge + normalized vertical position) between uses.
 * Everything here is side-effect free so the interaction layer stays thin.
 */

export type RailEdge = "left" | "right";

/** A persisted rail position: which edge, and where along it (0=top, 1=bottom). */
export type RailDock = {
    readonly edge: RailEdge;
    readonly normalizedY: number;
};

export type RailVerticalBounds = {
    readonly min: number;
    readonly max: number;
};

/** The vertical band the rail may occupy, already excluding fixed chrome. */
export type RailViewportBand = {
    readonly height: number;
    readonly insetTop: number;
    readonly insetBottom: number;
};

export type RailDrawerDirection = "down" | "up";

export type RailDrawerMetrics = {
    readonly safeTop: number;
    readonly safeBottom: number;
    readonly collapsedHeight: number;
    readonly desiredHeight: number;
};

export type RailDrawerPlacement = {
    readonly direction: RailDrawerDirection;
    readonly extent: number;
};

export type RailSilhouetteSpec = {
    readonly width: number;
    readonly shoulder: number;
    readonly corner: number;
    readonly height: number;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function railVerticalBounds(band: RailViewportBand, railHeight: number): RailVerticalBounds {
    const min = band.insetTop;
    return {
        min,
        max: Math.max(min, band.height - band.insetBottom - railHeight),
    };
}

export function projectRailTop(normalizedY: number, bounds: RailVerticalBounds): number {
    return bounds.min + ((bounds.max - bounds.min) * clamp(normalizedY, 0, 1));
}

export function normalizeRailTop(top: number, bounds: RailVerticalBounds): number {
    const span = bounds.max - bounds.min;
    if (span <= 0) {
        return 0;
    }
    return clamp((top - bounds.min) / span, 0, 1);
}

/**
 * Choose the edge a released drag settles onto: the nearest screen edge, with
 * the current edge winning the exact-midline tie so a vertical drag never
 * flips sides.
 */
export function settleRailEdge(centerX: number, viewportWidth: number, currentEdge: RailEdge): RailEdge {
    const midline = viewportWidth / 2;
    if (centerX < midline) {
        return "left";
    }
    if (centerX > midline) {
        return "right";
    }
    return currentEdge;
}

/**
 * Snap a vertical position to the top/middle/bottom anchors when it lands
 * within `snapDistance` of one; otherwise keep the clamped position.
 */
export function snapRailTop(
    top: number,
    bounds: RailVerticalBounds,
    snapDistance: number,
): { readonly top: number; readonly snapped: boolean } {
    const clampedTop = clamp(top, bounds.min, bounds.max);
    const middle = bounds.min + ((bounds.max - bounds.min) / 2);
    const anchors = [bounds.min, middle, bounds.max];
    const nearest = anchors.reduce((candidate, anchor) => (
        Math.abs(anchor - clampedTop) < Math.abs(candidate - clampedTop)
            ? anchor
            : candidate
    ), anchors[0] ?? bounds.min);

    if (Math.abs(nearest - clampedTop) <= snapDistance) {
        return { top: nearest, snapped: true };
    }
    return { top: clampedTop, snapped: false };
}

/** The drawer opens toward whichever side actually has room, preferring down. */
export function projectRailDrawerPlacement(tabTop: number, metrics: RailDrawerMetrics): RailDrawerPlacement {
    const spaceAbove = Math.max(0, tabTop - metrics.safeTop);
    const spaceBelow = Math.max(0, metrics.safeBottom - tabTop - metrics.collapsedHeight);
    let direction: RailDrawerDirection = "down";
    if (spaceBelow < metrics.desiredHeight && (spaceAbove >= metrics.desiredHeight || spaceAbove > spaceBelow)) {
        direction = "up";
    }
    return {
        direction,
        extent: Math.min(metrics.desiredHeight, direction === "up" ? spaceAbove : spaceBelow),
    };
}

const RAIL_DOCK_STORAGE_VERSION = 2;

export function serializeRailDock(dock: RailDock): string {
    return JSON.stringify({
        version: RAIL_DOCK_STORAGE_VERSION,
        edge: dock.edge,
        normalizedY: clamp(dock.normalizedY, 0, 1),
    });
}

function isRailEdge(value: unknown): value is RailEdge {
    return value === "left" || value === "right";
}

/**
 * Parse a stored dock. Legacy formats (a bare number, or `{normalizedY}`)
 * predate edge docking and always meant the right edge. Stored state is
 * external input: anything unreadable yields null and the caller applies the
 * default dock.
 */
export function parseStoredRailDock(raw: string | null): RailDock | null {
    if (raw === null) {
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }

    if (typeof parsed === "number") {
        return Number.isFinite(parsed)
            ? { edge: "right", normalizedY: clamp(parsed, 0, 1) }
            : null;
    }

    if (typeof parsed !== "object" || parsed === null) {
        return null;
    }

    const candidate = parsed as { edge?: unknown; normalizedY?: unknown };
    const normalizedY = Number(candidate.normalizedY);
    if (!Number.isFinite(normalizedY)) {
        return null;
    }

    if ("edge" in candidate) {
        if (!isRailEdge(candidate.edge)) {
            return null;
        }
        return { edge: candidate.edge, normalizedY: clamp(normalizedY, 0, 1) };
    }

    return { edge: "right", normalizedY: clamp(normalizedY, 0, 1) };
}

/**
 * The tab-with-shoulders outline: shoulders sweep from the docked screen edge
 * into the body, whose outer corners are rounded. The path is emitted in the
 * silhouette's own coordinate space for the requested edge, so it can be used
 * directly as an SVG path and as a CSS clip-path without transforms.
 */
export function buildRailSilhouettePath(spec: RailSilhouetteSpec, edge: RailEdge = "right"): string {
    const { width, shoulder, height } = spec;
    const bodyTop = shoulder;
    const bodyBottom = height - shoulder;
    const corner = Math.min(spec.corner, (bodyBottom - bodyTop) / 2);

    if (edge === "left") {
        return [
            "M 0 0",
            `A ${shoulder} ${shoulder} 0 0 0 ${shoulder} ${bodyTop}`,
            `H ${width - corner}`,
            `A ${corner} ${corner} 0 0 1 ${width} ${bodyTop + corner}`,
            `V ${bodyBottom - corner}`,
            `A ${corner} ${corner} 0 0 1 ${width - corner} ${bodyBottom}`,
            `H ${shoulder}`,
            `A ${shoulder} ${shoulder} 0 0 0 0 ${height}`,
            "Z",
        ].join(" ");
    }

    return [
        `M ${width} 0`,
        `A ${shoulder} ${shoulder} 0 0 1 ${width - shoulder} ${bodyTop}`,
        `H ${corner}`,
        `A ${corner} ${corner} 0 0 0 0 ${bodyTop + corner}`,
        `V ${bodyBottom - corner}`,
        `A ${corner} ${corner} 0 0 0 ${corner} ${bodyBottom}`,
        `H ${width - shoulder}`,
        `A ${shoulder} ${shoulder} 0 0 1 ${width} ${height}`,
        "Z",
    ].join(" ");
}
