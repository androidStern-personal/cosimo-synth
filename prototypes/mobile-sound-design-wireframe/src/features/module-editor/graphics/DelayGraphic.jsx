import { ModuleGraphicCanvas } from "./ModuleGraphicCanvas.jsx";
import { readGraphicValue } from "./canvasDrawing.js";

function drawDelay({ context, frame, values }) {
  const time = 0.1 + readGraphicValue(values, "time") / 160;
  const feedback = readGraphicValue(values, "feedback") / 100;

  context.lineWidth = 1.7;
  context.beginPath();
  context.moveTo(frame.left, frame.bottom);

  for (let echo = 0; echo < 7; echo += 1) {
    const x = frame.left + echo * time * frame.width;
    if (x > frame.right) break;

    const amplitude = frame.height * 0.75 * (echo === 0 ? 1 : feedback ** echo);
    context.lineTo(x, frame.bottom);
    context.lineTo(x, frame.bottom - amplitude);
    context.lineTo(x + 2, frame.bottom);
  }

  context.lineTo(frame.right, frame.bottom);
  context.stroke();
}

export function DelayGraphic(props) {
  return (
    <ModuleGraphicCanvas
      {...props}
      draw={drawDelay}
      moduleClassName="module-graphic--delay"
    />
  );
}
