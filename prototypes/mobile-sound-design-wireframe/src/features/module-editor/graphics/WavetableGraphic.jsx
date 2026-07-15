import { ModuleGraphicCanvas } from "./ModuleGraphicCanvas.jsx";
import { drawTrace, readGraphicValue } from "./canvasDrawing.js";

function drawWavetable({ context, frame, values }) {
  const index = readGraphicValue(values, "index") / 100;
  const warp = readGraphicValue(values, "warp") / 100;
  const harmonic = 2 + Math.round(index * 4);

  drawTrace(context, frame, (t) => {
    const angle = t * Math.PI * 2;
    const wave = Math.sin(angle) * 0.62
      + Math.sin(angle * harmonic) * (0.08 + warp * 0.22);

    return {
      x: frame.left + t * frame.width,
      y: frame.top + frame.height * (0.5 - wave * 0.5),
    };
  });
}

export function WavetableGraphic(props) {
  return (
    <ModuleGraphicCanvas
      {...props}
      draw={drawWavetable}
      moduleClassName="module-graphic--wavetable"
    />
  );
}
