import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { PatchControlBinding } from "./patch-controls";

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

type DragState = {
    pointerId: number;
    startClientY: number;
    startClientX: number;
    startNormalized: number;
    binding: PatchControlBinding<number>;
    axis: "vertical" | "horizontal" | "horizontal-relative";
    min: number;
    max: number;
    trackElement: HTMLElement;
    onChange?: (normalized: number) => void;
};

export function useSliderDrag() {
    const dragRef = useRef<DragState | null>(null);

    const finishDrag = useCallback((pointerId?: number) => {
        const drag = dragRef.current;
        if (!drag || (pointerId !== undefined && drag.pointerId !== pointerId)) {
            return;
        }

        dragRef.current = null;
        try {
            if (drag.trackElement.hasPointerCapture(drag.pointerId)) {
                drag.trackElement.releasePointerCapture(drag.pointerId);
            }
        } catch {
            // Pointer capture may already be released by cancel, blur, or test events.
        }
        drag.binding.endGesture();
    }, []);

    useEffect(() => {
        const handlePointerEnd = (event: PointerEvent) => finishDrag(event.pointerId);
        const handleBlur = () => finishDrag();
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") {
                finishDrag();
            }
        };

        window.addEventListener("pointerup", handlePointerEnd, true);
        window.addEventListener("pointercancel", handlePointerEnd, true);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("pointerup", handlePointerEnd, true);
            window.removeEventListener("pointercancel", handlePointerEnd, true);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            finishDrag();
        };
    }, [finishDrag]);

    const handlePointerDown = useCallback((
        event: ReactPointerEvent<HTMLElement>,
        trackElement: HTMLElement | null,
        binding: PatchControlBinding<number>,
        currentNormalized: number,
        min: number,
        max: number,
        axis: "vertical" | "horizontal" | "horizontal-relative",
        onChange?: (normalized: number) => void,
    ) => {
        if (!trackElement || (event.pointerType === "mouse" && event.button !== 0)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        finishDrag();
        try {
            trackElement.setPointerCapture(event.pointerId);
        } catch {
            // Synthetic pointer events in tests may not own a real pointer.
        }
        binding.beginGesture();
        dragRef.current = {
            pointerId: event.pointerId,
            startClientY: event.clientY,
            startClientX: event.clientX,
            startNormalized: currentNormalized,
            binding,
            axis,
            min,
            max,
            trackElement,
            onChange,
        };
    }, [finishDrag]);

    const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        const drag = dragRef.current;
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (event.pointerType === "mouse" && event.buttons === 0) {
            finishDrag(event.pointerId);
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const rect = drag.trackElement.getBoundingClientRect();
        let nextNormalized: number;
        if (drag.axis === "vertical") {
            const deltaY = drag.startClientY - event.clientY;
            const trackHeight = Math.max(1, rect.height);
            nextNormalized = clamp(drag.startNormalized + (deltaY / trackHeight), 0, 1);
        } else if (drag.axis === "horizontal-relative") {
            const deltaX = event.clientX - drag.startClientX;
            const trackWidth = Math.max(1, rect.width);
            nextNormalized = clamp(drag.startNormalized + (deltaX / trackWidth), 0, 1);
        } else {
            const deltaX = event.clientX - rect.left;
            nextNormalized = clamp(deltaX / Math.max(1, rect.width), 0, 1);
        }
        if (drag.onChange) {
            drag.onChange(nextNormalized);
        } else {
            const denormalized = drag.min + (nextNormalized * (drag.max - drag.min));
            drag.binding.setValue(denormalized);
        }
    }, [finishDrag]);

    const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        finishDrag(event.pointerId);
    }, [finishDrag]);

    return {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp: endDrag,
        handlePointerCancel: endDrag,
        handleLostPointerCapture: finishDrag,
    };
}
