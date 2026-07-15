import { ModuleGraphicCanvas } from "./ModuleGraphicCanvas.jsx";
import { drawTrace, readGraphicValue } from "./canvasDrawing.js";

function drawReverb({ context, frame, values }) {
  const size = readGraphicValue(values, "size") / 100;
  const decay = 1.5 + size * 5;

  drawTrace(
    context,
    frame,
    (t) => ({
      x: frame.left + t * frame.width,
      y: frame.top + frame.height * (
        0.5 + Math.sin(t * 90) * Math.exp(-t * decay) * 0.45
      ),
    }),
    { steps: 160 },
  );
}

export function ReverbGraphic(props) {
  return (
    <ModuleGraphicCanvas
      {...props}
      draw={drawReverb}
      moduleClassName="module-graphic--reverb"
    />
  );
}
