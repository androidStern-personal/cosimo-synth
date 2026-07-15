import { useRef } from "react";

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

export function resolveDragAxis(deltaX, deltaY, threshold = 5) {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) return null;
  return Math.abs(deltaX) >= Math.abs(deltaY) ? "x" : "y";
}

export function calculateDragValue({
  startValue,
  delta,
  extent,
  minimum,
  maximum,
  inverted = false,
}) {
  const range = maximum - minimum;
  const direction = inverted ? -1 : 1;
  return clamp(
    startValue + direction * (delta / Math.max(extent, 44)) * range,
    minimum,
    maximum,
  );
}

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
  onCancel,
  onAxisLock,
  onUnsupportedAxis,
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
    if (cancelled) onCancel?.(current.axis);
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
      if (event.pointerType === "mouse" && event.button !== 0) return;
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
        const preferredAxis = resolveDragAxis(deltaX, deltaY, threshold);
        if (!preferredAxis) return;
        const preferredAxisIsSupported = preferredAxis === "x" ? onXChange : onYChange;
        if (!preferredAxisIsSupported) {
          current.axis = preferredAxis;
          onAxisLock?.(current.axis);
          onUnsupportedAxis?.(current.axis);
          return;
        }
        current.axis = preferredAxis;
        onAxisLock?.(current.axis);
      }
      if (current.axis === "x" && onXChange) {
        onXChange(calculateDragValue({
          startValue: current.xValue,
          delta: deltaX,
          extent: current.width,
          minimum: xMinimum,
          maximum: xMaximum,
        }));
      }
      if (current.axis === "y" && onYChange) {
        onYChange(calculateDragValue({
          startValue: current.yValue,
          delta: deltaY,
          extent: current.height,
          minimum: yMinimum,
          maximum: yMaximum,
          inverted: true,
        }));
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
