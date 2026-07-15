import { useRef } from "react";

import { AmpPanGraphic } from "./AmpPanGraphic.jsx";
import { DelayGraphic } from "./DelayGraphic.jsx";
import { DriveGraphic } from "./DriveGraphic.jsx";
import { FilterGraphic } from "./FilterGraphic.jsx";
import { ChorusGraphic, FlangerGraphic } from "./ModulationMotionGraphic.jsx";
import { OTTGraphic } from "./OTTGraphic.jsx";
import { PhaserGraphic } from "./PhaserGraphic.jsx";
import { ReverbGraphic } from "./ReverbGraphic.jsx";
import { WavetableGraphic } from "./WavetableGraphic.jsx";
import { clampGraphicValue } from "./canvasDrawing.js";

const AXIS_LOCK_THRESHOLD = 5;

export const MODULE_GRAPHIC_REGISTRY = Object.freeze({
  filter: Object.freeze({ Graphic: FilterGraphic, axes: ["cutoff", "resonance"] }),
  "voice-filter": Object.freeze({ Graphic: FilterGraphic, axes: ["cutoff", "resonance"] }),
  drive: Object.freeze({ Graphic: DriveGraphic, axes: ["amount", "tone"] }),
  ott: Object.freeze({ Graphic: OTTGraphic, axes: ["depth", "time"] }),
  chorus: Object.freeze({ Graphic: ChorusGraphic, axes: ["rate", "depth"] }),
  flanger: Object.freeze({ Graphic: FlangerGraphic, axes: ["rate", "depth"] }),
  phaser: Object.freeze({ Graphic: PhaserGraphic, axes: ["frequency", "depth"] }),
  delay: Object.freeze({ Graphic: DelayGraphic, axes: ["time", "feedback"] }),
  reverb: Object.freeze({ Graphic: ReverbGraphic, axes: ["size", "decay"] }),
  wavetable: Object.freeze({ Graphic: WavetableGraphic, axes: ["warp", "index"] }),
  "amp-pan": Object.freeze({ Graphic: AmpPanGraphic, axes: ["pan", "level"] }),
});

export function getModuleGraphicDefinition(moduleId) {
  return MODULE_GRAPHIC_REGISTRY[moduleId] || null;
}

export function ModuleGraphicSurface({
  ariaLabel,
  className,
  moduleId,
  onAxesChange,
  onGraphicFocus,
  values,
}) {
  const gesture = useRef(null);
  const definition = getModuleGraphicDefinition(moduleId);

  if (!definition) return null;

  const { Graphic, axes } = definition;
  const emitAxisChange = (event, phase, axis) => {
    if (!onAxesChange) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const horizontal = clampGraphicValue(
      ((event.clientX - bounds.left) / bounds.width) * 100,
    );
    const vertical = clampGraphicValue(
      (1 - (event.clientY - bounds.top) / bounds.height) * 100,
    );

    const parameterId = axis === "horizontal" ? axes[0] : axes[1];
    const value = axis === "horizontal" ? horizontal : vertical;
    onAxesChange({
      moduleId,
      phase,
      activeAxis: axis,
      parameterId,
      changes: { [parameterId]: value },
      sourceEvent: event,
    });
  };

  const interactionProps = onAxesChange
    ? {
        onPointerDown: (event) => {
          gesture.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            axis: null,
            started: false,
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        onPointerMove: (event) => {
          const current = gesture.current;
          if (!current || current.pointerId !== event.pointerId) return;
          if (!current.axis) {
            const deltaX = event.clientX - current.startX;
            const deltaY = event.clientY - current.startY;
            if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < AXIS_LOCK_THRESHOLD) return;
            current.axis = Math.abs(deltaX) >= Math.abs(deltaY) ? "horizontal" : "vertical";
            const parameterId = current.axis === "horizontal" ? axes[0] : axes[1];
            onGraphicFocus?.({ moduleId, axes: [...axes], activeAxis: current.axis, parameterId });
          }
          emitAxisChange(event, current.started ? "change" : "start", current.axis);
          current.started = true;
        },
        onPointerUp: (event) => {
          const current = gesture.current;
          if (!current || current.pointerId !== event.pointerId) return;
          if (current.axis) {
            emitAxisChange(event, "end", current.axis);
          } else {
            onGraphicFocus?.({
              moduleId,
              axes: [...axes],
              activeAxis: "horizontal",
              parameterId: axes[0],
            });
          }
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          gesture.current = null;
        },
        onPointerCancel: (event) => {
          if (gesture.current?.pointerId !== event.pointerId) return;
          gesture.current = null;
        },
        role: "group",
      }
    : {};

  return (
    <Graphic
      {...interactionProps}
      ariaLabel={ariaLabel}
      className={className}
      values={values}
    />
  );
}
