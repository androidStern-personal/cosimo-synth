export const clampGraphicValue = (value, minimum = 0, maximum = 100) =>
  Math.max(minimum, Math.min(maximum, value));

export function readGraphicValue(values, parameterId, fallback = 50) {
  const value = Number(values?.[parameterId]);
  return Number.isFinite(value) ? clampGraphicValue(value) : fallback;
}

export function createPlotFrame(width, height) {
  const left = 32;
  const right = width - 12;
  const top = 24;
  const bottom = height - 26;

  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

export function drawPlotGrid(context, frame, { graph, gridLabels = false, muted } = {}) {
  context.save();
  context.strokeStyle = graph || context.strokeStyle;
  context.lineWidth = 1;
  context.setLineDash([2, 3]);

  for (let index = 1; index < 4; index += 1) {
    const x = frame.left + (frame.width * index) / 4;
    const y = frame.top + (frame.height * index) / 4;

    context.beginPath();
    context.moveTo(x, frame.top);
    context.lineTo(x, frame.bottom);
    context.stroke();

    context.beginPath();
    context.moveTo(frame.left, y);
    context.lineTo(frame.right, y);
    context.stroke();
  }

  context.setLineDash([]);
  context.beginPath();
  context.moveTo(frame.left, frame.top + frame.height / 2);
  context.lineTo(frame.right, frame.top + frame.height / 2);
  context.stroke();

  if (gridLabels) {
    context.fillStyle = muted || context.fillStyle;
    context.font = '10px "Cosimo Instrument Mono", monospace';
    context.textAlign = "right";
    context.fillText("+1.0", frame.left - 4, frame.top + 3);
    context.fillText("0", frame.left - 4, frame.top + frame.height / 2 + 3);
    context.fillText("-1.0", frame.left - 4, frame.bottom);
    context.textAlign = "center";
    ["0°", "90°", "180°", "270°", "360°"].forEach((label, index) => {
      context.fillText(label, frame.left + frame.width * (index / 4), frame.bottom + 14);
    });
  }

  context.restore();
}

export function drawTrace(
  context,
  frame,
  pointForStep,
  { steps = 120, alpha = 1, lineWidth = 1.8 } = {},
) {
  context.save();
  context.globalAlpha = alpha;
  context.lineWidth = lineWidth;
  context.beginPath();

  for (let step = 0; step <= steps; step += 1) {
    const point = pointForStep(step / steps, frame);
    if (step === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }

  context.stroke();
  context.restore();
}
