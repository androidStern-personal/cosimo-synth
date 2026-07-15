import { ModuleGraphicCanvas } from "./ModuleGraphicCanvas.jsx";
import { drawTrace, readGraphicValue } from "./canvasDrawing.js";

function drawPhaser({ context, frame, values }) {
  const frequency = readGraphicValue(values, "frequency") / 100;
  const depth = 0.12 + (readGraphicValue(values, "depth") / 100) * 0.48;
  const phase = readGraphicValue(values, "phase", 50) / 100;

  drawTrace(context, frame, (t) => {
    const windowing = 0.35 + Math.sin(t * Math.PI) * 0.65;
    const wave = Math.sin((t * 5.5 + frequency * 1.8 + phase) * Math.PI * 2);

    return {
      x: frame.left + t * frame.width,
      y: frame.top + frame.height * (0.5 + wave * depth * windowing),
    };
  });

  drawTrace(
    context,
    frame,
    (t) => ({
      x: frame.left + t * frame.width,
      y: frame.top + frame.height * (
        0.5
        + Math.sin((t * 5.5 + frequency * 1.8 + phase + 0.08) * Math.PI * 2)
          * depth
          * 0.55
      ),
    }),
    { alpha: 0.35, lineWidth: 1 },
  );

  const handleX = frame.left + frequency * frame.width;
  const handleY = frame.top + frame.height * (0.5 - depth * 0.35);
  context.fillRect(handleX - 4, handleY - 4, 8, 8);
}

export function PhaserGraphic(props) {
  return (
    <ModuleGraphicCanvas
      {...props}
      draw={drawPhaser}
      gridLabels
      moduleClassName="module-graphic--phaser"
    />
  );
}
