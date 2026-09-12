import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { deriveMsegSegmentCurvePower, findMsegPointHitIndex, findMsegSegmentHitIndex,
    msegEditorCoordinatesToPoint, type MsegPoint, type MsegSurfaceOrientation } from "./mseg";

export const MSEG_DRAG_THRESHOLD_PX = 8;
type Shape = { readonly points: MsegPoint[] };
/** Mutations execute inside the owner's gesture queue, retaining its acceptance and selection timing. */
export type MsegGestureController<Result> = {
    getShape(): Shape | null | undefined;
    addPoint(x: number, y: number): Result;
    movePoint(index: number, x: number, y: number): Result;
    deletePoint(index: number): Result;
    setSegmentCurvePower(index: number, power: number): Result;
};
type Timers = {
    setTimeout(callback: () => void, delay: number): number;
    clearTimeout(handle: number): void;
};
const browserTimers: Timers = {
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: handle => window.clearTimeout(handle),
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type ActiveMsegPointPointerState = {
    kind: "point-drag";
    pointerId: number;
    pointIndex: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
    deleteOnRelease: boolean;
};

type ActiveMsegPendingSegmentPointerState = {
    kind: "pending-segment";
    pointerId: number;
    segmentIndex: number;
    startClientX: number;
    startClientY: number;
    holdTimeoutId: number | null;
};

type ActiveMsegCurvePointerState = {
    kind: "curve-drag";
    pointerId: number;
    segmentIndex: number;
};

type ActiveMsegPointerState =
    | ActiveMsegPointPointerState
    | ActiveMsegPendingSegmentPointerState
    | ActiveMsegCurvePointerState;


/** Shared point/segment interaction policy. Presentation and history remain with the owner. */
export function useMsegGestures<Result>({
    shape, controller, surfaceRef, edit, finishGesture,
    orientation = "horizontal", curveEditActivationMode = "immediate", curveEditHoldDelayMs = 350,
    onCurveEditHoldActivated = null, timers = browserTimers,
}: {
    shape: Shape | null;
    controller: RefObject<MsegGestureController<Result> | null>;
    surfaceRef: RefObject<SVGSVGElement | null>;
    edit(action: () => Result | undefined, grouped?: boolean): void;
    /** Cancellation discards unsent intent; it does not roll back accepted edits. */
    finishGesture(cancelled?: boolean): unknown;
    orientation?: MsegSurfaceOrientation;
    curveEditActivationMode?: "immediate" | "hold-or-drag";
    curveEditHoldDelayMs?: number;
    onCurveEditHoldActivated?: (() => void) | null;
    timers?: Timers;
}) {
    const [selectedPointIndex, setSelectedPointIndex] = useState(0);
    const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState(-1);
    const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
    const activePointerRef = useRef<ActiveMsegPointerState | null>(null);

    const clearPendingSegmentTimer = useCallback((pointerState: ActiveMsegPointerState | null) => {
        if (pointerState?.kind === "pending-segment" && pointerState.holdTimeoutId !== null) {
            timers.clearTimeout(pointerState.holdTimeoutId);
            pointerState.holdTimeoutId = null;
        }
    }, [timers]);

    const cancelActivePointer = useCallback((pointerId?: number) => {
        const activePointer = activePointerRef.current;
        if (!activePointer || (pointerId !== undefined && activePointer.pointerId !== pointerId)) {
            return;
        }

        activePointerRef.current = null;
        clearPendingSegmentTimer(activePointer);
        void finishGesture(true);
        try {
            if (surfaceRef.current?.hasPointerCapture(activePointer.pointerId)) {
                surfaceRef.current.releasePointerCapture(activePointer.pointerId);
            }
        } catch {
            // Capture may already be gone after cancellation, blur, or unmount.
        }
        setHoveredSegmentIndex(-1);
        setActiveSegmentIndex(-1);
    }, [clearPendingSegmentTimer, surfaceRef, finishGesture]);

    useEffect(() => {
        if (!shape) {
            return;
        }

        setSelectedPointIndex((previousIndex) => clamp(
            previousIndex,
            0,
            Math.max(0, shape.points.length - 1),
        ));
    }, [shape]);

    const resolvePointerLocation = useCallback((clientX: number, clientY: number) => {
        if (!shape || !surfaceRef.current) {
            return null;
        }

        const bounds = surfaceRef.current.getBoundingClientRect();
        const localX = clientX - bounds.left;
        const localY = clientY - bounds.top;
        const currentShape = controller.current?.getShape() ?? shape;
        const pointIndex = findMsegPointHitIndex(
            currentShape,
            localX,
            localY,
            bounds.width,
            bounds.height,
            undefined,
            { orientation },
        );
        const segmentIndex = pointIndex >= 0
            ? -1
            : findMsegSegmentHitIndex(
                currentShape,
                localX,
                localY,
                bounds.width,
                bounds.height,
                undefined,
                { orientation },
            );

        return {
            bounds,
            localX,
            localY,
            pointIndex,
            segmentIndex,
        };
    }, [controller, shape, orientation, surfaceRef]);

    const updateHoveredSegmentIndex = useCallback((clientX: number, clientY: number) => {
        const pointerLocation = resolvePointerLocation(clientX, clientY);
        setHoveredSegmentIndex(pointerLocation?.segmentIndex ?? -1);
        return pointerLocation;
    }, [resolvePointerLocation]);

    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                cancelActivePointer();
            }
        };
        const handleBlur = () => cancelActivePointer();
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                cancelActivePointer();
            }
        };

        window.addEventListener("keydown", handleEscapeKey);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            window.removeEventListener("keydown", handleEscapeKey);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            cancelActivePointer();
        };
    }, [cancelActivePointer]);

    const applyCurveEditFromClientCoordinates = useCallback((segmentIndex: number, clientX: number, clientY: number) => {
        if (!surfaceRef.current || !controller.current) {
            return;
        }

        const currentShape = controller.current.getShape() ?? shape;
        if (!currentShape) {
            return;
        }

        const bounds = surfaceRef.current.getBoundingClientRect();
        const point = msegEditorCoordinatesToPoint(
            clientX - bounds.left,
            clientY - bounds.top,
            bounds.width,
            bounds.height,
            { orientation },
        );
        const curvePower = deriveMsegSegmentCurvePower(currentShape, segmentIndex, point.x, point.y);
        const currentController = controller.current;
        edit(() => currentController?.setSegmentCurvePower(segmentIndex, curvePower), true);
    }, [edit, controller, shape, orientation, surfaceRef]);

    const addPoint = useCallback((x: number, y: number) => {
        const currentController = controller.current;
        if (!currentController) return;
        edit(() => {
            const result = currentController.addPoint(x, y);
            const points = currentController.getShape()?.points ?? [];
            const index = points.findIndex(point => Math.abs(point.x - x) <= 1e-6 && Math.abs(point.y - y) <= 1e-6);
            if (index >= 0) setSelectedPointIndex(index);
            return result;
        });
    }, [edit, controller]);

    const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.button !== 0 || activePointerRef.current || !shape || !surfaceRef.current) {
            return;
        }

        const pointerLocation = updateHoveredSegmentIndex(event.clientX, event.clientY);
        if (!pointerLocation) {
            return;
        }

        if (pointerLocation.pointIndex >= 0) {
            setSelectedPointIndex(pointerLocation.pointIndex);
            setActiveSegmentIndex(-1);
            activePointerRef.current = {
                kind: "point-drag",
                pointerId: event.pointerId,
                pointIndex: pointerLocation.pointIndex,
                startClientX: event.clientX,
                startClientY: event.clientY,
                moved: false,
                deleteOnRelease:
                    pointerLocation.pointIndex > 0 &&
                    pointerLocation.pointIndex < shape.points.length - 1,
            };
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // Window-level termination still owns unsupported or synthetic pointers.
            }
            event.preventDefault();
            return;
        }

        if (pointerLocation.segmentIndex >= 0) {
            setActiveSegmentIndex(pointerLocation.segmentIndex);
            setHoveredSegmentIndex(pointerLocation.segmentIndex);
            if (curveEditActivationMode === "immediate") {
                activePointerRef.current = {
                    kind: "curve-drag",
                    pointerId: event.pointerId,
                    segmentIndex: pointerLocation.segmentIndex,
                };
            } else {
                const holdTimeoutId = timers.setTimeout(() => {
                    const activePointer = activePointerRef.current;
                    if (
                        !activePointer
                        || activePointer.kind !== "pending-segment"
                        || activePointer.pointerId !== event.pointerId
                    ) {
                        return;
                    }

                    activePointerRef.current = {
                        kind: "curve-drag",
                        pointerId: activePointer.pointerId,
                        segmentIndex: activePointer.segmentIndex,
                    };
                    setActiveSegmentIndex(activePointer.segmentIndex);
                    setHoveredSegmentIndex(activePointer.segmentIndex);
                    onCurveEditHoldActivated?.();
                }, curveEditHoldDelayMs);

                activePointerRef.current = {
                    kind: "pending-segment",
                    pointerId: event.pointerId,
                    segmentIndex: pointerLocation.segmentIndex,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    holdTimeoutId,
                };
            }

            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // Window-level termination still owns unsupported or synthetic pointers.
            }
            event.preventDefault();
            return;
        }

        const point = msegEditorCoordinatesToPoint(
            pointerLocation.localX,
            pointerLocation.localY,
            pointerLocation.bounds.width,
            pointerLocation.bounds.height,
            { orientation },
        );
        addPoint(point.x, point.y);

        setActiveSegmentIndex(-1);
        event.preventDefault();
    }, [
        addPoint,
        curveEditActivationMode,
        edit,
        curveEditHoldDelayMs,
        controller,
        shape,
        onCurveEditHoldActivated,
        timers,
        orientation,
        surfaceRef,
        updateHoveredSegmentIndex,
    ]);

    const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        const activePointer = activePointerRef.current;
        if (!activePointer || activePointer.pointerId !== event.pointerId || !surfaceRef.current) {
            updateHoveredSegmentIndex(event.clientX, event.clientY);
            return;
        }

        if (activePointer.kind === "curve-drag") {
            applyCurveEditFromClientCoordinates(activePointer.segmentIndex, event.clientX, event.clientY);
            setActiveSegmentIndex(activePointer.segmentIndex);
            setHoveredSegmentIndex(activePointer.segmentIndex);
            event.preventDefault();
            return;
        }

        if (activePointer.kind === "pending-segment") {
            const movementDistance = Math.hypot(
                event.clientX - activePointer.startClientX,
                event.clientY - activePointer.startClientY,
            );

            if (movementDistance < MSEG_DRAG_THRESHOLD_PX) {
                return;
            }

            clearPendingSegmentTimer(activePointer);
            activePointerRef.current = {
                kind: "curve-drag",
                pointerId: activePointer.pointerId,
                segmentIndex: activePointer.segmentIndex,
            };
            setActiveSegmentIndex(activePointer.segmentIndex);
            setHoveredSegmentIndex(activePointer.segmentIndex);
            applyCurveEditFromClientCoordinates(activePointer.segmentIndex, event.clientX, event.clientY);
            event.preventDefault();
            return;
        }

        const movementDistance = Math.hypot(
            event.clientX - activePointer.startClientX,
            event.clientY - activePointer.startClientY,
        );

        if (!activePointer.moved && movementDistance < MSEG_DRAG_THRESHOLD_PX) {
            return;
        }

        const bounds = surfaceRef.current.getBoundingClientRect();
        const point = msegEditorCoordinatesToPoint(
            event.clientX - bounds.left,
            event.clientY - bounds.top,
            bounds.width,
            bounds.height,
            { orientation },
        );
        if (!activePointer.moved) {
            activePointerRef.current = {
                ...activePointer,
                moved: true,
            };
        }
        const currentController = controller.current;
        edit(() => currentController?.movePoint(activePointer.pointIndex, point.x, point.y), true);
        setSelectedPointIndex(activePointer.pointIndex);
        setHoveredSegmentIndex(-1);
        setActiveSegmentIndex(-1);
        event.preventDefault();
    }, [
        applyCurveEditFromClientCoordinates,
        edit,
        clearPendingSegmentTimer,
        controller,
        orientation,
        surfaceRef,
        updateHoveredSegmentIndex,
    ]);

    const handlePointerLeave = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        if (activePointerRef.current?.pointerId === event.pointerId) {
            return;
        }

        setHoveredSegmentIndex(-1);
    }, []);

    const handlePointerUp = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
        const activePointer = activePointerRef.current;
        if (!activePointer || activePointer.pointerId !== event.pointerId) {
            return;
        }

        if (event.type !== "pointerup") {
            cancelActivePointer(event.pointerId);
            event.preventDefault();
            return;
        }

        void finishGesture();
        const pointerState = activePointer;
        activePointerRef.current = null;
        setActiveSegmentIndex(-1);
        try {
            if (surfaceRef.current?.hasPointerCapture(event.pointerId)) {
                surfaceRef.current.releasePointerCapture(event.pointerId);
            }
        } catch {
            // Capture may already be gone after a platform cancellation.
        }

        if (pointerState.kind === "pending-segment") {
            clearPendingSegmentTimer(pointerState);
            if (surfaceRef.current) {
                const bounds = surfaceRef.current.getBoundingClientRect();
                const point = msegEditorCoordinatesToPoint(
                    event.clientX - bounds.left,
                    event.clientY - bounds.top,
                    bounds.width,
                    bounds.height,
                    { orientation },
                );
                addPoint(point.x, point.y);
            }
            event.preventDefault();
            setHoveredSegmentIndex(resolvePointerLocation(event.clientX, event.clientY)?.segmentIndex ?? -1);
            return;
        }

        if (pointerState.kind === "curve-drag") {
            setHoveredSegmentIndex(resolvePointerLocation(event.clientX, event.clientY)?.segmentIndex ?? -1);
            event.preventDefault();
            return;
        }

        if (!pointerState.moved && pointerState.deleteOnRelease && controller.current) {
            const currentController = controller.current;
            edit(() => {
                const result = currentController.deletePoint(pointerState.pointIndex);
                const pointCount = currentController.getShape()?.points.length ?? 0;
                setSelectedPointIndex(clamp(pointerState.pointIndex - 1, 0, Math.max(0, pointCount - 1)));
                return result;
            });
        }

        setHoveredSegmentIndex(resolvePointerLocation(event.clientX, event.clientY)?.segmentIndex ?? -1);
        event.preventDefault();
    }, [
        addPoint,
        cancelActivePointer,
        edit,
        finishGesture,
        clearPendingSegmentTimer,
        controller,
        orientation,
        resolvePointerLocation,
        surfaceRef,
    ]);

    return { selectedPointIndex, hoveredSegmentIndex, activeSegmentIndex,
        cancelGesture: cancelActivePointer, handlePointerDown, handlePointerMove, handlePointerLeave, handlePointerUp };
}
