/**
 * Pure geometry for the perimeter-docked mobile Mod rail (T10B).
 *
 * The rail docks flush against the left or right screen edge, travels
 * vertically inside a keep-out band (safe areas plus fixed chrome), snaps to
 * three vertical anchors, opens its drawer toward the larger free side, and
 * persists its dock (edge + normalized vertical position) between uses.
 * Everything here is side-effect free so the interaction layer stays thin.
 */

/** T42's one proportional scale for the complete floating Mod rail. */
export const MOBILE_MOD_RAIL_SCALE = 1.1;

/** Measurable rail geometry in CSS pixels before or after proportional scaling. */
export type MobileModRailGeometry = {
    readonly safeGap: number;
    readonly dragThreshold: number;
    readonly snapDistance: number;
    readonly width: number;
    readonly shoulder: number;
    readonly corner: number;
    readonly tabContentHeight: number;
    readonly drawerFallbackHeight: number;
    readonly module: number;
    readonly gap: number;
    readonly outline: number;
    readonly icon: number;
    readonly secondaryIcon: number;
    readonly label: number;
    readonly sourceNumberWidth: number;
    readonly sourceNumberHeight: number;
    readonly badge: number;
    readonly activityWidth: number;
    readonly activityHeight: number;
    readonly handleDot: number;
    readonly handleGap: number;
    readonly noteDot: number;
    readonly chevron: number;
    readonly chevronStroke: number;
    readonly drawerPaddleTapHeight: number;
    readonly voiceToggleWidth: number;
    readonly ghost: number;
    readonly ghostArt: number;
};

/** The measured pre-T42 geometry retained as the before side of the scale contract. */
export const MOBILE_MOD_RAIL_BASE_GEOMETRY: MobileModRailGeometry = {
    safeGap: 8,
    dragThreshold: 7,
    snapDistance: 28,
    width: 40,
    shoulder: 12,
    corner: 12,
    tabContentHeight: 128,
    drawerFallbackHeight: 234,
    module: 28,
    gap: 10,
    outline: 1,
    icon: 16,
    secondaryIcon: 15,
    label: 8,
    sourceNumberWidth: 9,
    sourceNumberHeight: 11,
    badge: 13,
    activityWidth: 14,
    activityHeight: 2,
    handleDot: 2,
    handleGap: 3,
    noteDot: 4,
    chevron: 7,
    chevronStroke: 1.5,
    drawerPaddleTapHeight: 20,
    voiceToggleWidth: 34,
    ghost: 42,
    ghostArt: 36,
};

/** Derive the complete floating-rail geometry from one coherent coefficient. */
export function scaleMobileModRailGeometry(
    base: MobileModRailGeometry,
    scale: number,
): MobileModRailGeometry {
    return {
        safeGap: base.safeGap * scale,
        dragThreshold: base.dragThreshold * scale,
        snapDistance: base.snapDistance * scale,
        width: base.width * scale,
        shoulder: base.shoulder * scale,
        corner: base.corner * scale,
        tabContentHeight: base.tabContentHeight * scale,
        drawerFallbackHeight: base.drawerFallbackHeight * scale,
        module: base.module * scale,
        gap: base.gap * scale,
        outline: base.outline * scale,
        icon: base.icon * scale,
        secondaryIcon: base.secondaryIcon * scale,
        label: base.label * scale,
        sourceNumberWidth: base.sourceNumberWidth * scale,
        sourceNumberHeight: base.sourceNumberHeight * scale,
        badge: base.badge * scale,
        activityWidth: base.activityWidth * scale,
        activityHeight: base.activityHeight * scale,
        handleDot: base.handleDot * scale,
        handleGap: base.handleGap * scale,
        noteDot: base.noteDot * scale,
        chevron: base.chevron * scale,
        chevronStroke: base.chevronStroke * scale,
        drawerPaddleTapHeight: base.drawerPaddleTapHeight * scale,
        voiceToggleWidth: base.voiceToggleWidth * scale,
        ghost: base.ghost * scale,
        ghostArt: base.ghostArt * scale,
    };
}

/** Shipping T42 geometry, derived once from the measured baseline. */
export const MOBILE_MOD_RAIL_GEOMETRY = scaleMobileModRailGeometry(
    MOBILE_MOD_RAIL_BASE_GEOMETRY,
    MOBILE_MOD_RAIL_SCALE,
);

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

/** Safe initial rail position and the drawer projection available from it. */
export type RailDefaultPlacement = {
    readonly top: number;
    readonly normalizedY: number;
    readonly drawer: RailDrawerPlacement;
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

/**
 * Project the preferred initial dock into a safe expanded placement. When the
 * viewport can fit the full drawer, move only as far as needed to make that
 * true; cramped phones retain the preferred dock and receive the largest safe
 * scrollable drawer extent instead.
 */
export function projectRailDefaultPlacement(
    preferredNormalizedY: number,
    bounds: RailVerticalBounds,
    metrics: RailDrawerMetrics,
): RailDefaultPlacement {
    const preferredTop = projectRailTop(preferredNormalizedY, bounds);
    const preferredDrawer = projectRailDrawerPlacement(preferredTop, metrics);
    if (preferredDrawer.extent >= metrics.desiredHeight) {
        return {
            top: preferredTop,
            normalizedY: normalizeRailTop(preferredTop, bounds),
            drawer: preferredDrawer,
        };
    }

    const candidates: number[] = [];
    const latestDownwardTop = metrics.safeBottom - metrics.collapsedHeight - metrics.desiredHeight;
    if (latestDownwardTop >= bounds.min) {
        candidates.push(clamp(preferredTop, bounds.min, Math.min(bounds.max, latestDownwardTop)));
    }

    const earliestUpwardTop = metrics.safeTop + metrics.desiredHeight;
    if (earliestUpwardTop <= bounds.max) {
        candidates.push(clamp(preferredTop, Math.max(bounds.min, earliestUpwardTop), bounds.max));
    }

    let top = candidates[0] ?? preferredTop;
    for (const candidate of candidates.slice(1)) {
        if (Math.abs(candidate - preferredTop) < Math.abs(top - preferredTop)) {
            top = candidate;
        }
    }

    return {
        top,
        normalizedY: normalizeRailTop(top, bounds),
        drawer: projectRailDrawerPlacement(top, metrics),
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
