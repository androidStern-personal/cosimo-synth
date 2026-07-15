import { ModuleGraphicCanvas } from "./ModuleGraphicCanvas.jsx";
import { drawTrace, readGraphicValue } from "./canvasDrawing.js";

function drawOTT({ context, frame, values }) {
  const depth = readGraphicValue(values, "depth") / 100;

  [0.25, 0.5, 0.75].forEach((band, index) => {
    drawTrace(
      context,
      frame,
      (t) => ({
        x: frame.left + t * frame.width,
        y: frame.top + frame.height * (
          band + Math.tanh((t - 0.5) * (2 + depth * 5)) * 0.12
        ),
      }),
      { steps: 80, alpha: 1 - index * 0.18, lineWidth: 1.5 },
    );
  });
}

export function OTTGraphic(props) {
  return (
    <ModuleGraphicCanvas
      {...props}
      draw={drawOTT}
      moduleClassName="module-graphic--ott"
    />
  );
}
