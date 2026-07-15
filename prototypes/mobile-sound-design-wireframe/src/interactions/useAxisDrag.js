import { useRef } from "react";

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

/**
 * Shared pointer contract for Cosimo's two-axis parameter surfaces.
 * Presentation components provide semantic callbacks; this hook owns pointer
 * capture, axis locking, thresholds, and click suppression.
 */
export function useAxisDrag({
  xValue,
  yValue,
  xMinimum = 0,
  xMaximum = 100,
  yMinimum = -100,
  yMaximum = 100,
  threshold = 5,
  onBegin,
  onXChange,
  onYChange,
  onCommit,
  onAxisLock,
}) {
  const gesture = useRef(null);
  const suppressClick = useRef(false);

  const finish = (event, cancelled = false) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!cancelled && current.axis) onCommit?.(current.axis);
    suppressClick.current = Boolean(current.axis);
    gesture.current = null;
  };

  return {
    onClickCapture(event) {
      if (!suppressClick.current) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = false;
    },
    onPointerDown(event) {
      const bounds = event.currentTarget.getBoundingClientRect();
      gesture.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        width: Math.max(bounds.width, 44),
        height: Math.max(bounds.height, 44),
        xValue,
        yValue,
        axis: null,
      };
      suppressClick.current = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      onBegin?.();
    },
    onPointerMove(event) {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - current.startX;
      const deltaY = event.clientY - current.startY;
      if (!current.axis) {
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) return;
        const preferredAxis = Math.abs(deltaX) >= Math.abs(deltaY) ? "x" : "y";
        const preferredAxisIsSupported = preferredAxis === "x" ? onXChange : onYChange;
        if (!preferredAxisIsSupported) return;
        current.axis = preferredAxis;
        onAxisLock?.(current.axis);
      }
      if (current.axis === "x" && onXChange) {
        const range = xMaximum - xMinimum;
        onXChange(clamp(current.xValue + (deltaX / current.width) * range, xMinimum, xMaximum));
      }
      if (current.axis === "y" && onYChange) {
        const range = yMaximum - yMinimum;
        onYChange(clamp(current.yValue - (deltaY / current.height) * range, yMinimum, yMaximum));
      }
    },
    onPointerUp(event) {
      finish(event);
    },
    onPointerCancel(event) {
      finish(event, true);
    },
  };
}
