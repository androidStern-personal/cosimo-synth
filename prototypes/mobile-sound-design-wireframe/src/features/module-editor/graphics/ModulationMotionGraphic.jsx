import { ModuleGraphicCanvas } from "./ModuleGraphicCanvas.jsx";
import { drawTrace, readGraphicValue } from "./canvasDrawing.js";

function drawMotion({ context, frame, values }) {
  const depth = readGraphicValue(values, "depth") / 100;
  const rate = readGraphicValue(values, "rate") / 100;

  [0, 0.16, 0.31].forEach((offset, index) => {
    drawTrace(
      context,
      frame,
      (t) => ({
        x: frame.left + t * frame.width,
        y: frame.top + frame.height * (
          0.5
          + Math.sin((t * (2.2 + rate * 2) + offset) * Math.PI * 2)
            * (0.12 + depth * 0.2)
        ),
      }),
      { steps: 100, alpha: 1 - index * 0.27, lineWidth: 1.5 - index * 0.2 },
    );
  });
}

export function ChorusGraphic(props) {
  return (
    <ModuleGraphicCanvas
      {...props}
      draw={drawMotion}
      moduleClassName="module-graphic--chorus"
    />
  );
}

export function FlangerGraphic(props) {
  return (
    <ModuleGraphicCanvas
      {...props}
      draw={drawMotion}
      moduleClassName="module-graphic--flanger"
    />
  );
}
