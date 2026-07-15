import { ModuleGraphicCanvas } from "./ModuleGraphicCanvas.jsx";
import { clampGraphicValue, drawTrace, readGraphicValue } from "./canvasDrawing.js";

function drawFilter({ context, frame, values }) {
  const cutoff = readGraphicValue(values, "cutoff") / 100;
  const resonance = readGraphicValue(values, "resonance", 20) / 100;

  drawTrace(context, frame, (t) => {
    const lowPass = 1 / (1 + Math.exp((t - cutoff) * 18));
    const peak = resonance * 0.34 * Math.exp(-((t - cutoff) ** 2) / 0.0035);
    const response = clampGraphicValue(lowPass + peak, 0, 1.12);

    return {
      x: frame.left + t * frame.width,
      y: frame.bottom - response * frame.height * 0.82,
    };
  });
}

export function FilterGraphic(props) {
  return (
    <ModuleGraphicCanvas
      {...props}
      draw={drawFilter}
      moduleClassName="module-graphic--filter"
    />
  );
}
