/** The tunable inputs to the touch drag's control-display gain. */
export type ModSourceTouchTuning = {
    /** Pointer travel (px) before a drag activates and gain starts ramping. */
    readonly activationPx: number;
    /** Viewport width divisor that sets the viewport-responsive maximum gain. */
    readonly referenceTravelPx: number;
    /** Lower clamp on the maximum gain. */
    readonly gainMin: number;
    /** Upper clamp on the maximum gain. */
    readonly gainMax: number;
    /** Travel (px) over which gain smoothsteps from 1x to the maximum. */
    readonly rampPx: number;
};

/** The shipped values; the dev tuning page may override them at runtime. */
export const MOD_SOURCE_TOUCH_TUNING_DEFAULTS: ModSourceTouchTuning = {
    activationPx: 7,
    referenceTravelPx: 168,
    gainMin: 2.1,
    gainMax: 2.5,
    rampPx: 64,
};

let tuning: ModSourceTouchTuning = MOD_SOURCE_TOUCH_TUNING_DEFAULTS;

export function getModSourceTouchTuning(): ModSourceTouchTuning {
    return tuning;
}

/** Override the drag-feel numbers (dev tuning page); partial values merge. */
export function setModSourceTouchTuning(next: Partial<ModSourceTouchTuning>): void {
    const merged = { ...tuning, ...next };
    const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
    tuning = {
        activationPx: Math.max(0, finite(merged.activationPx, MOD_SOURCE_TOUCH_TUNING_DEFAULTS.activationPx)),
        referenceTravelPx: Math.max(1, finite(merged.referenceTravelPx, MOD_SOURCE_TOUCH_TUNING_DEFAULTS.referenceTravelPx)),
        gainMin: Math.max(1, finite(merged.gainMin, MOD_SOURCE_TOUCH_TUNING_DEFAULTS.gainMin)),
        gainMax: Math.max(1, finite(merged.gainMax, MOD_SOURCE_TOUCH_TUNING_DEFAULTS.gainMax)),
        rampPx: Math.max(1, finite(merged.rampPx, MOD_SOURCE_TOUCH_TUNING_DEFAULTS.rampPx)),
    };
}

/** A point in browser client coordinates. */
export type ModSourceDragPoint = {
    readonly x: number;
    readonly y: number;
};

/** The client-coordinate bounds in which a modulation-source preview center may move. */
export type ModSourceDragViewport = {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
    readonly width: number;
};

/** The inputs that determine the visible and logical hotspot for a source drag. */
export type ResolveModSourceTouchPointInput = {
    readonly pointerType: string;
    readonly start: ModSourceDragPoint;
    readonly previousPointer: ModSourceDragPoint;
    readonly previousPreview: ModSourceDragPoint;
    readonly pointer: ModSourceDragPoint;
    readonly viewport: ModSourceDragViewport;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function smoothStep(progress: number) {
    const clampedProgress = clamp(progress, 0, 1);
    return clampedProgress * clampedProgress * (3 - (2 * clampedProgress));
}

function amplifiedDisplacement(
    start: ModSourceDragPoint,
    pointer: ModSourceDragPoint,
    maximumGain: number,
): ModSourceDragPoint {
    const delta = { x: pointer.x - start.x, y: pointer.y - start.y };
    const distance = Math.hypot(delta.x, delta.y);
    const rampProgress = (distance - tuning.activationPx) / tuning.rampPx;
    const gain = 1 + ((maximumGain - 1) * smoothStep(rampProgress));
    return {
        x: delta.x * gain,
        y: delta.y * gain,
    };
}

/** Returns whether pointer travel has crossed the shared source-drag activation distance. */
export function modSourceDragHasActivated(start: ModSourceDragPoint, pointer: ModSourceDragPoint) {
    return Math.hypot(pointer.x - start.x, pointer.y - start.y) > tuning.activationPx;
}

/**
 * Advances a touch preview with smoothly introduced control-display gain. Mapping
 * consecutive absolute displacements makes the result event-cadence independent;
 * clamping each step discards edge overshoot so reversing direction responds at once.
 * Mouse and pen input remain direct.
 */
export function resolveModSourceTouchPoint({
    pointerType,
    start,
    previousPointer,
    previousPreview,
    pointer,
    viewport,
}: ResolveModSourceTouchPointInput): ModSourceDragPoint {
    if (pointerType !== "touch") {
        return pointer;
    }

    const maximumGain = clamp(
        viewport.width / tuning.referenceTravelPx,
        tuning.gainMin,
        tuning.gainMax,
    );
    const previousDisplacement = amplifiedDisplacement(start, previousPointer, maximumGain);
    const nextDisplacement = amplifiedDisplacement(start, pointer, maximumGain);

    return {
        x: clamp(
            previousPreview.x + nextDisplacement.x - previousDisplacement.x,
            viewport.left,
            viewport.right,
        ),
        y: clamp(
            previousPreview.y + nextDisplacement.y - previousDisplacement.y,
            viewport.top,
            viewport.bottom,
        ),
    };
}
