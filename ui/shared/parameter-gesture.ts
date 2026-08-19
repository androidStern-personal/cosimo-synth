/**
 * The one parameter-drag contract (ADR-024 movement semantics, ADR-025
 * presentation): rolling dominant-axis classification with horizontal = base
 * value and vertical = modulation amount, rAF-batched writes, scroll-lock
 * protection, long-press before activation, and one idempotent finish path
 * for release and every cancellation channel.
 *
 * Every draggable parameter control — the voice readout cells, the wavetable
 * graph, and every knob — consumes THIS controller. Control-specific meaning
 * (value conversion, detents, haptics, HUD content, host gesture brackets)
 * lives in the consumer's channels; movement behavior must never fork per
 * control again.
 */

import { useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";

import {
    applyRollingAxisSample,
    createRollingAxisState,
    type RollingAxis,
    type RollingAxisPointerType,
    type RollingAxisState,
} from "./rolling-axis-classifier";

/** ADR-024 calibration: finger travel crossing a base range end to end. */
export const PARAMETER_GESTURE_BASE_PIXELS_PER_FULL_RANGE = 220;
/** ADR-024 calibration: finger travel crossing a modulation span end to end. */
export const PARAMETER_GESTURE_MODULATION_PIXELS_PER_FULL_SPAN = 360;
/** Hold-still delay before a gesture becomes a parameter menu request. */
export const PARAMETER_GESTURE_LONG_PRESS_MS = 500;

export type ParameterGestureFinishReason = "release" | "cancel";

export type ParameterGestureChannel = {
    /** Starting position in this channel's own normalized 0..1 span. */
    readonly startNormalized: number;
    /** Finger travel that crosses the channel's full span, in CSS pixels. */
    readonly pixelsPerFullSpan: number;
    /** Motion direction multiplier (graph axes may invert); default 1. */
    readonly direction?: 1 | -1;
    /**
     * Applies one integrated position. The accumulator moves freely across
     * the clamped 0..1 span; consumers own value conversion, snapping,
     * detents, and haptics. null keeps the axis inert: it still classifies
     * and reports ownership, but never writes (ADR-024: an unmapped vertical
     * axis is inert and the HUD explains why).
     */
    readonly write: ((normalized: number) => void) | null;
    /** This axis took ownership (activation, or a rolling switch into it). */
    readonly onActivate?: () => void;
    /** Ownership rolled to the other axis. */
    readonly onDeactivate?: () => void;
};

export type ParameterGesturePlan = {
    readonly pointerId: number;
    readonly pointerType: RollingAxisPointerType;
    readonly element: HTMLElement;
    readonly startClientX: number;
    readonly startClientY: number;
    readonly horizontal: ParameterGestureChannel | null;
    readonly vertical: ParameterGestureChannel | null;
    /** Runs after the final flushed write; close host gestures and HUDs here. */
    readonly onFinish?: (reason: ParameterGestureFinishReason, ownedAxis: RollingAxis | null) => void;
    /** Fires INSTEAD of the gesture when held still before any axis activates. */
    readonly onLongPress?: (clientX: number, clientY: number) => void;
    readonly resolveScrollLockTargets?: () => ReadonlyArray<HTMLElement>;
};

type ActiveParameterGesture = {
    readonly plan: ParameterGesturePlan;
    classifier: RollingAxisState;
    ownedAxis: RollingAxis | null;
    horizontalNormalized: number;
    verticalNormalized: number;
    pendingCommit: boolean;
    rafHandle: number | null;
    longPressTimer: number | null;
    readonly scrollLocks: ReadonlyArray<{ readonly element: HTMLElement; readonly top: number; readonly left: number }>;
    readonly windowScroll: { readonly x: number; readonly y: number };
    removeListeners: () => void;
};

export function pointerTypeOfEvent(event: PointerEvent | ReactPointerEvent<HTMLElement>): RollingAxisPointerType {
    return event.pointerType === "touch" ? "touch" : event.pointerType === "pen" ? "pen" : "mouse";
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

export type ParameterGestureController = {
    /** Begin a drag from a pointerdown. One active gesture at a time. */
    readonly startGesture: (event: ReactPointerEvent<HTMLElement>, plan: Omit<ParameterGesturePlan,
        "pointerId" | "pointerType" | "element" | "startClientX" | "startClientY">) => void;
    /** Cancel any active gesture (rebinds, unmount, ownership changes). */
    readonly cancelGesture: () => void;
    readonly isGestureActive: () => boolean;
};

export function useParameterGesture(): ParameterGestureController {
    const gestureRef = useRef<ActiveParameterGesture | null>(null);

    const commitGestureFrame = useCallback(() => {
        const gesture = gestureRef.current;
        if (gesture === null || !gesture.pendingCommit) {
            return;
        }
        gesture.pendingCommit = false;
        const axis = gesture.ownedAxis;
        if (axis === null) {
            return;
        }
        const channel = axis === "horizontal" ? gesture.plan.horizontal : gesture.plan.vertical;
        const normalized = axis === "horizontal" ? gesture.horizontalNormalized : gesture.verticalNormalized;
        channel?.write?.(normalized);
    }, []);

    const scheduleGestureCommit = useCallback(() => {
        const gesture = gestureRef.current;
        if (gesture === null) {
            return;
        }
        gesture.pendingCommit = true;
        if (gesture.rafHandle !== null) {
            return;
        }
        gesture.rafHandle = window.requestAnimationFrame(() => {
            const current = gestureRef.current;
            if (current !== null) {
                current.rafHandle = null;
            }
            commitGestureFrame();
        });
    }, [commitGestureFrame]);

    const restoreScrollLocks = useCallback((gesture: ActiveParameterGesture) => {
        for (const lock of gesture.scrollLocks) {
            if (lock.element.scrollTop !== lock.top) {
                lock.element.scrollTop = lock.top;
            }
            if (lock.element.scrollLeft !== lock.left) {
                lock.element.scrollLeft = lock.left;
            }
        }
        if (window.scrollX !== gesture.windowScroll.x || window.scrollY !== gesture.windowScroll.y) {
            window.scrollTo(gesture.windowScroll.x, gesture.windowScroll.y);
        }
    }, []);

    /** Idempotent single finish path for release AND every cancellation. */
    const finishGesture = useCallback((reason: ParameterGestureFinishReason) => {
        const gesture = gestureRef.current;
        if (gesture === null) {
            return;
        }
        gestureRef.current = null;

        if (gesture.longPressTimer !== null) {
            window.clearTimeout(gesture.longPressTimer);
        }
        if (gesture.rafHandle !== null) {
            window.cancelAnimationFrame(gesture.rafHandle);
            gesture.rafHandle = null;
        }
        // Flush the final integrated delta before finish closes host gestures.
        if (reason === "release" && gesture.pendingCommit) {
            gestureRef.current = gesture;
            commitGestureFrame();
            gestureRef.current = null;
        }
        gesture.removeListeners();
        try {
            if (gesture.plan.element.hasPointerCapture(gesture.plan.pointerId)) {
                gesture.plan.element.releasePointerCapture(gesture.plan.pointerId);
            }
        } catch {
            // Capture may already be gone after cancellation; not terminal.
        }
        restoreScrollLocks(gesture);
        gesture.plan.onFinish?.(reason, gesture.ownedAxis);
    }, [commitGestureFrame, restoreScrollLocks]);

    const finishGestureRef = useRef(finishGesture);
    finishGestureRef.current = finishGesture;

    useEffect(() => () => {
        finishGestureRef.current("cancel");
    }, []);

    const applyGestureSample = useCallback((event: PointerEvent) => {
        const gesture = gestureRef.current;
        if (gesture === null || event.pointerId !== gesture.plan.pointerId) {
            return;
        }
        if (event.pointerType === "mouse" && event.buttons === 0) {
            // Only mouse treats zero buttons as an implicit release; Safari
            // touch moves legitimately report buttons === 0.
            finishGestureRef.current("release");
            return;
        }
        event.preventDefault();

        const coalesced = typeof event.getCoalescedEvents === "function"
            ? event.getCoalescedEvents()
            : [];
        const samples = coalesced.length > 0 ? coalesced : [event];

        for (const sample of samples) {
            const result = applyRollingAxisSample(gesture.classifier, {
                x: sample.clientX,
                y: sample.clientY,
                time: Number(sample.timeStamp) || performance.now(),
                pointerType: gesture.plan.pointerType,
            });
            gesture.classifier = result.state;

            if (result.transition === "activate" || result.transition === "switch") {
                if (gesture.longPressTimer !== null) {
                    window.clearTimeout(gesture.longPressTimer);
                    gesture.longPressTimer = null;
                }
                const nextAxis = result.state.mode as RollingAxis;
                const previousAxis = gesture.ownedAxis;
                if (previousAxis !== null && previousAxis !== nextAxis) {
                    const previousChannel = previousAxis === "horizontal"
                        ? gesture.plan.horizontal
                        : gesture.plan.vertical;
                    previousChannel?.onDeactivate?.();
                }
                gesture.ownedAxis = nextAxis;
                const channel = nextAxis === "horizontal" ? gesture.plan.horizontal : gesture.plan.vertical;
                channel?.onActivate?.();
                continue;
            }

            const application = result.application;
            if (application === null || gesture.ownedAxis === null) {
                continue;
            }
            const channel = gesture.ownedAxis === "horizontal" ? gesture.plan.horizontal : gesture.plan.vertical;
            if (channel === null || channel.write === null) {
                // Inert axis: motion classifies but never writes or banks debt.
                continue;
            }
            const delta = gesture.ownedAxis === "horizontal" ? application.dx : application.dy;
            const step = (delta * (channel.direction ?? 1)) / channel.pixelsPerFullSpan;
            if (gesture.ownedAxis === "horizontal") {
                gesture.horizontalNormalized = clamp01(gesture.horizontalNormalized + step);
            } else {
                gesture.verticalNormalized = clamp01(gesture.verticalNormalized + step);
            }
            gesture.pendingCommit = true;
        }

        if (gesture.pendingCommit) {
            scheduleGestureCommit();
        }
    }, [scheduleGestureCommit]);

    const startGesture = useCallback<ParameterGestureController["startGesture"]>((event, planInput) => {
        if (gestureRef.current !== null) {
            return;
        }
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const element = event.currentTarget;
        try {
            element.setPointerCapture(event.pointerId);
        } catch {
            // Window fallbacks continue the gesture when capture is rejected.
        }

        const plan: ParameterGesturePlan = {
            ...planInput,
            pointerId: event.pointerId,
            pointerType: pointerTypeOfEvent(event),
            element,
            startClientX: event.clientX,
            startClientY: event.clientY,
        };

        const scrollLocks = (plan.resolveScrollLockTargets?.() ?? []).map((lockElement) => ({
            element: lockElement,
            top: lockElement.scrollTop,
            left: lockElement.scrollLeft,
        }));

        const handleMove = (moveEvent: PointerEvent) => applyGestureSample(moveEvent);
        const handleUp = (upEvent: PointerEvent) => {
            if (gestureRef.current !== null && upEvent.pointerId === plan.pointerId) {
                finishGestureRef.current("release");
            }
        };
        const handleCancel = (cancelEvent: PointerEvent) => {
            if (gestureRef.current !== null && cancelEvent.pointerId === plan.pointerId) {
                finishGestureRef.current("cancel");
            }
        };
        const handleBlur = () => finishGestureRef.current("cancel");
        const handleVisibility = () => {
            if (document.visibilityState !== "visible") {
                finishGestureRef.current("cancel");
            }
        };
        const handleViewportInvalidation = () => finishGestureRef.current("cancel");
        const handleNativeTouchMove = (touchEvent: TouchEvent) => {
            // Non-passive Safari fallback: an owned parameter gesture must
            // never be promoted into page scroll midway through the drag.
            if (gestureRef.current === null) {
                return;
            }
            if (touchEvent.cancelable) {
                touchEvent.preventDefault();
            }
            restoreScrollLocks(gestureRef.current);
        };
        const handleNativeTouchEnd = (touchEvent: TouchEvent) => {
            if (gestureRef.current !== null && touchEvent.touches.length === 0) {
                finishGestureRef.current("release");
            }
        };
        const handleNativeTouchCancel = (touchEvent: TouchEvent) => {
            if (gestureRef.current !== null && touchEvent.touches.length === 0) {
                finishGestureRef.current("cancel");
            }
        };

        window.addEventListener("pointermove", handleMove, { passive: false });
        window.addEventListener("pointerup", handleUp, true);
        window.addEventListener("pointercancel", handleCancel, true);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("orientationchange", handleViewportInvalidation);
        window.addEventListener("resize", handleViewportInvalidation);
        document.addEventListener("touchmove", handleNativeTouchMove, { capture: true, passive: false });
        document.addEventListener("touchend", handleNativeTouchEnd, true);
        document.addEventListener("touchcancel", handleNativeTouchCancel, true);

        const removeListeners = () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp, true);
            window.removeEventListener("pointercancel", handleCancel, true);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("orientationchange", handleViewportInvalidation);
            window.removeEventListener("resize", handleViewportInvalidation);
            document.removeEventListener("touchmove", handleNativeTouchMove, true);
            document.removeEventListener("touchend", handleNativeTouchEnd, true);
            document.removeEventListener("touchcancel", handleNativeTouchCancel, true);
        };

        const longPressTimer = plan.onLongPress
            ? window.setTimeout(() => {
                const gesture = gestureRef.current;
                if (gesture === null || gesture.ownedAxis !== null) {
                    return;
                }
                finishGestureRef.current("cancel");
                plan.onLongPress?.(plan.startClientX, plan.startClientY);
            }, PARAMETER_GESTURE_LONG_PRESS_MS)
            : null;

        gestureRef.current = {
            plan,
            classifier: createRollingAxisState(event.clientX, event.clientY),
            ownedAxis: null,
            horizontalNormalized: plan.horizontal?.startNormalized ?? 0,
            verticalNormalized: plan.vertical?.startNormalized ?? 0,
            pendingCommit: false,
            rafHandle: null,
            longPressTimer,
            scrollLocks,
            windowScroll: { x: window.scrollX, y: window.scrollY },
            removeListeners,
        };
    }, [applyGestureSample, restoreScrollLocks]);

    const cancelGesture = useCallback(() => {
        finishGestureRef.current("cancel");
    }, []);

    const isGestureActive = useCallback(() => gestureRef.current !== null, []);

    // A stable identity: consumers hang cancel-on-rebind effects off this
    // object, and a fresh identity per render would cancel every gesture.
    return useMemo(
        () => ({ startGesture, cancelGesture, isGestureActive }),
        [cancelGesture, isGestureActive, startGesture],
    );
}
