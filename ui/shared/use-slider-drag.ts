import { useCallback, useRef } from "react";
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
    axis: "vertical" | "horizontal";
    min: number;
    max: number;
    trackElement: HTMLDivElement;
    onChange?: (normalized: number) => void;
};

export function useSliderDrag() {
    const dragRef = useRef<DragState | null>(null);

    const handlePointerDown = useCallback((
        event: ReactPointerEvent<HTMLDivElement>,
        trackElement: HTMLDivElement | null,
        binding: PatchControlBinding<number>,
        currentNormalized: number,
        min: number,
        max: number,
        axis: "vertical" | "horizontal",
        onChange?: (normalized: number) => void,
    ) => {
        if (!trackElement) return;
        event.preventDefault();
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
    }, []);

    const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (event.buttons === 0) {
            try {
                drag.trackElement.releasePointerCapture(event.pointerId);
            } catch {
                // Pointer capture may already be released.
            }
            drag.binding.endGesture();
            dragRef.current = null;
            return;
        }
        const rect = drag.trackElement.getBoundingClientRect();
        let nextNormalized: number;
        if (drag.axis === "vertical") {
            const deltaY = drag.startClientY - event.clientY;
            const trackHeight = rect.height;
            nextNormalized = clamp(drag.startNormalized + (deltaY / trackHeight), 0, 1);
        } else {
            const deltaX = event.clientX - rect.left;
            nextNormalized = clamp(deltaX / rect.width, 0, 1);
        }
        if (drag.onChange) {
            drag.onChange(nextNormalized);
        } else {
            const denormalized = drag.min + (nextNormalized * (drag.max - drag.min));
            drag.binding.setValue(denormalized);
        }
    }, []);

    const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || event.pointerId !== drag.pointerId) return;
        try {
            drag.trackElement.releasePointerCapture(event.pointerId);
        } catch {
            // Pointer capture may already be released (e.g. after pointercancel).
        }
        drag.binding.endGesture();
        dragRef.current = null;
    }, []);

    return { handlePointerDown, handlePointerMove, handlePointerUp: endDrag, handlePointerCancel: endDrag };
}
