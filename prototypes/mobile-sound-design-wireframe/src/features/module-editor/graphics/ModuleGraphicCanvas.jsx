import { useEffect, useRef } from "react";

import { createPlotFrame, drawPlotGrid } from "./canvasDrawing.js";

const joinClassNames = (...classNames) => classNames.filter(Boolean).join(" ");

export function ModuleGraphicCanvas({
  ariaLabel,
  className,
  draw,
  gridLabels = false,
  moduleClassName,
  values,
  ...canvasProps
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const render = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const ratio = globalThis.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);

      const context = canvas.getContext("2d");
      if (!context) return;

      const computedStyle = getComputedStyle(canvas);
      const readToken = (name, fallback) => (
        computedStyle.getPropertyValue(name).trim() || fallback
      );
      const ink = readToken("--cosimo-color-ink", computedStyle.color);
      const paper = readToken("--cosimo-color-paper", computedStyle.backgroundColor);
      const muted = readToken("--cosimo-color-ink-muted", ink);
      const graph = readToken("--cosimo-color-graph", ink);

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);
      context.strokeStyle = ink;
      context.fillStyle = ink;
      context.lineCap = "round";
      context.lineJoin = "round";

      const frame = createPlotFrame(bounds.width, bounds.height);
      drawPlotGrid(context, frame, { graph, gridLabels, muted });
      draw({ context, frame, values, colors: { graph, ink, muted, paper } });
    };

    render();

    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw, gridLabels, values]);

  return (
    <canvas
      {...canvasProps}
      aria-hidden={ariaLabel ? undefined : "true"}
      aria-label={ariaLabel}
      className={joinClassNames("module-graphic", moduleClassName, className)}
      ref={canvasRef}
      role={ariaLabel ? canvasProps.role || "img" : undefined}
    />
  );
}
