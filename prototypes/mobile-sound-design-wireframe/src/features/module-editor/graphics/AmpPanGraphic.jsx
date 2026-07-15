import { ModuleGraphicCanvas } from "./ModuleGraphicCanvas.jsx";
import { readGraphicValue } from "./canvasDrawing.js";

function drawAmpPan({ context, frame, values }) {
  const level = readGraphicValue(values, "level") / 100;
  const pan = (readGraphicValue(values, "pan") - 50) / 50;
  const leftLevel = level * (pan > 0 ? 1 - pan : 1);
  const rightLevel = level * (pan < 0 ? 1 + pan : 1);

  [leftLevel, rightLevel].forEach((channel, index) => {
    const y = frame.top + frame.height * (0.35 + index * 0.3);

    context.save();
    context.lineWidth = 5;
    context.globalAlpha = 0.25;
    context.beginPath();
    context.moveTo(frame.left, y);
    context.lineTo(frame.right, y);
    context.stroke();

    context.globalAlpha = 1;
    context.beginPath();
    context.moveTo(frame.left, y);
    context.lineTo(frame.left + frame.width * channel, y);
    context.stroke();
    context.restore();
  });
}

export function AmpPanGraphic(props) {
  return (
    <ModuleGraphicCanvas
      {...props}
      draw={drawAmpPan}
      moduleClassName="module-graphic--amp-pan"
    />
  );
}
