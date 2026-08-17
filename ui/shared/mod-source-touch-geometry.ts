const MOD_SOURCE_DRAG_ACTIVATION_PX = 7;
const MOD_SOURCE_TOUCH_GAIN_REFERENCE_TRAVEL_PX = 168;
const MOD_SOURCE_TOUCH_GAIN_MIN = 2.1;
const MOD_SOURCE_TOUCH_GAIN_MAX = 2.5;
const MOD_SOURCE_TOUCH_GAIN_RAMP_PX = 64;

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
    const rampProgress = (distance - MOD_SOURCE_DRAG_ACTIVATION_PX) / MOD_SOURCE_TOUCH_GAIN_RAMP_PX;
    const gain = 1 + ((maximumGain - 1) * smoothStep(rampProgress));
    return {
        x: delta.x * gain,
        y: delta.y * gain,
    };
}

/** Returns whether pointer travel has crossed the shared source-drag activation distance. */
export function modSourceDragHasActivated(start: ModSourceDragPoint, pointer: ModSourceDragPoint) {
    return Math.hypot(pointer.x - start.x, pointer.y - start.y) > MOD_SOURCE_DRAG_ACTIVATION_PX;
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
        viewport.width / MOD_SOURCE_TOUCH_GAIN_REFERENCE_TRAVEL_PX,
        MOD_SOURCE_TOUCH_GAIN_MIN,
        MOD_SOURCE_TOUCH_GAIN_MAX,
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
