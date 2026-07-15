import { ModuleGraphicCanvas } from "./ModuleGraphicCanvas.jsx";
import { drawTrace, readGraphicValue } from "./canvasDrawing.js";

function drawDrive({ context, frame, values }) {
  const amount = 1.2 + readGraphicValue(values, "amount") / 7;

  drawTrace(context, frame, (t) => {
    const input = t * 2 - 1;
    const output = Math.tanh(input * amount) / Math.tanh(amount);

    return {
      x: frame.left + t * frame.width,
      y: frame.top + (1 - (output + 1) / 2) * frame.height,
    };
  });
}

export function DriveGraphic(props) {
  return (
    <ModuleGraphicCanvas
      {...props}
      draw={drawDrive}
      moduleClassName="module-graphic--drive"
    />
  );
}
