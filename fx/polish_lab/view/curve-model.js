export const CURVE_DEFAULTS = Object.freeze({
  curveP1X: 0.799438202247191,
  curveP1Y: 0.7176422093981863,
  curveP1T: 0.42000000000000004,
  curveP2X: 0.9272997032640949,
  curveP2Y: 0.8935926773455377,
  curveP2T: 0,
  curveP3X: 0.9362017804154302,
  curveP3Y: 1,
  curveP3T: -0.7200000000000001,
});

export const CLIPPER_STAGE_DEFAULTS = Object.freeze({
  clipDriveDb: -0.0192,
  clipMix: 100,
});

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

export function finiteOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function sanitizeCurve(values = {}) {
  const source = { ...CURVE_DEFAULTS, ...values };
  const p1x = clamp(finiteOr(source.curveP1X, CURVE_DEFAULTS.curveP1X), 0.01, 1.45);
  const p2x = clamp(finiteOr(source.curveP2X, CURVE_DEFAULTS.curveP2X), p1x + 0.001, 1.48);
  const p3x = clamp(finiteOr(source.curveP3X, CURVE_DEFAULTS.curveP3X), p2x + 0.001, 1.5);
  const p1y = clamp(finiteOr(source.curveP1Y, CURVE_DEFAULTS.curveP1Y), 0, 1.45);
  const p2y = clamp(finiteOr(source.curveP2Y, CURVE_DEFAULTS.curveP2Y), p1y, 1.48);
  const p3y = clamp(finiteOr(source.curveP3Y, CURVE_DEFAULTS.curveP3Y), p2y, 1.5);

  return [
    { x: 0, y: 0, tension: 0 },
    { x: p1x, y: p1y, tension: clamp(finiteOr(source.curveP1T, 0), -1, 1) },
    { x: p2x, y: p2y, tension: clamp(finiteOr(source.curveP2T, 0), -1, 1) },
    { x: p3x, y: p3y, tension: clamp(finiteOr(source.curveP3T, 0), -1, 1) },
  ];
}

export function tensionWarp(position, tension) {
  const u = clamp(position, 0, 1);
  return u + clamp(tension, -1, 1) * u * (1 - u) * (1 - 2 * u);
}

export function evaluateCurve(input, values = {}) {
  if (!Number.isFinite(input))
    throw new TypeError("Curve input must be finite.");

  if (input === 0)
    return 0;

  const sign = input < 0 ? -1 : 1;
  const magnitude = Math.abs(input);
  const points = sanitizeCurve(values);
  const ceiling = points.at(-1);

  if (magnitude >= ceiling.x)
    return sign * ceiling.y;

  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];

    if (magnitude <= right.x) {
      const position = (magnitude - left.x) / (right.x - left.x);
      const shaped = tensionWarp(position, right.tension);
      return sign * (left.y + (right.y - left.y) * shaped);
    }
  }

  return sign * ceiling.y;
}

// Matches ClipCoreChannel plus PolishVoicingProcessor::clip: graph input is
// the signal immediately before Drive, and graph output includes Clip Mix.
export function evaluateClipperTransfer(input, values = {}) {
  const driveDb = clamp(
    finiteOr(values?.get?.("clipDriveDb") ?? values.clipDriveDb, CLIPPER_STAGE_DEFAULTS.clipDriveDb),
    -24,
    36,
  );
  const mix = clamp(
    finiteOr(values?.get?.("clipMix") ?? values.clipMix, CLIPPER_STAGE_DEFAULTS.clipMix) * 0.01,
    0,
    1,
  );
  const curveValues = values instanceof Map ? Object.fromEntries(values) : values;
  const shaped = evaluateCurve(input * (10 ** (driveDb / 20)), curveValues);
  return input + (shaped - input) * mix;
}
