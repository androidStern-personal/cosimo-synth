const DISPLAY_GESTURE_AXIS_LOCK_PX = 12;
const DISPLAY_SWIPE_MIN_COMMIT_PX = 48;
const DISPLAY_SWIPE_COMMIT_RATIO = 0.18;

export function resolveDisplayGestureAxis(deltaX: number, deltaY: number, axisLockThreshold = DISPLAY_GESTURE_AXIS_LOCK_PX) {
    const safeDeltaX = Math.abs(Number(deltaX) || 0);
    const safeDeltaY = Math.abs(Number(deltaY) || 0);

    if (Math.max(safeDeltaX, safeDeltaY) < axisLockThreshold) {
        return "pending";
    }

    return safeDeltaX > safeDeltaY ? "horizontal" : "vertical";
}

export function resolveHorizontalSwipeTarget(startTableIndex: number, deltaX: number, tableCount: number) {
    const safeTableCount = Math.max(1, Math.round(Number(tableCount) || 1));
    const safeStartIndex = Math.min(
        Math.max(Math.round(Number(startTableIndex) || 0), 0),
        safeTableCount - 1,
    );
    const safeDeltaX = Number(deltaX) || 0;
    const direction = safeDeltaX < 0 ? 1 : safeDeltaX > 0 ? -1 : 0;

    if (direction === 0) {
        return {
            direction,
            targetTableIndex: safeStartIndex,
            hasTarget: false,
        };
    }

    const targetTableIndex = Math.min(
        Math.max(safeStartIndex + direction, 0),
        safeTableCount - 1,
    );

    return {
        direction,
        targetTableIndex,
        hasTarget: targetTableIndex !== safeStartIndex,
    };
}

export function shouldCommitHorizontalSwipe(deltaX: number, stageWidth: number) {
    const safeStageWidth = Math.max(0, Number(stageWidth) || 0);
    const commitDistance = Math.max(DISPLAY_SWIPE_MIN_COMMIT_PX, safeStageWidth * DISPLAY_SWIPE_COMMIT_RATIO);

    return Math.abs(Number(deltaX) || 0) >= commitDistance;
}
