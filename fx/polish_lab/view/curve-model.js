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

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

export function finiteOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function quadraticBow(position, bend) {
  const u = clamp(position, 0, 1);
  return u + clamp(bend, -1, 1) * u * (1 - u);
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

export const SHAPER_MAX_POINTS = 7;

const SHAPER_SLOT_DEFAULTS = Object.freeze({
  positive: Object.freeze([
    { x: 1, y: 1 },
    { x: 1.08, y: 1 },
    { x: 1.16, y: 1 },
    { x: 1.24, y: 1 },
    { x: 1.32, y: 1 },
    { x: 1.4, y: 1 },
    { x: 1.5, y: 1 },
  ]),
  negative: Object.freeze([
    { x: 1, y: -1 },
    { x: 1.08, y: -1 },
    { x: 1.16, y: -1 },
    { x: 1.24, y: -1 },
    { x: 1.32, y: -1 },
    { x: 1.4, y: -1 },
    { x: 1.5, y: -1 },
  ]),
});

export const SHAPER_ENDPOINTS = Object.freeze([
  "curvePointCount",
  ...Array.from({ length: SHAPER_MAX_POINTS }, (_, offset) => offset + 1)
    .flatMap(index => [`curveP${index}X`, `curveP${index}Y`, `curveB${index}`]),
  "curveNPointCount",
  ...Array.from({ length: SHAPER_MAX_POINTS }, (_, offset) => offset + 1)
    .flatMap(index => [`curveN${index}X`, `curveN${index}Y`, `curveNB${index}`]),
  "morph",
  "morphSide",
  "morphPoint",
  "morphTargetX",
  "morphTargetY",
]);

const shaperResetValues = {
  curvePointCount: 1,
  curveNPointCount: 1,
  morph: 0,
  morphSide: 1,
  morphPoint: 1,
  morphTargetX: 0.72,
  morphTargetY: 1.05,
};
for (let index = 1; index <= SHAPER_MAX_POINTS; index += 1) {
  const positive = SHAPER_SLOT_DEFAULTS.positive[index - 1];
  const negative = SHAPER_SLOT_DEFAULTS.negative[index - 1];
  shaperResetValues[`curveP${index}X`] = positive.x;
  shaperResetValues[`curveP${index}Y`] = positive.y;
  shaperResetValues[`curveB${index}`] = 0;
  shaperResetValues[`curveN${index}X`] = negative.x;
  shaperResetValues[`curveN${index}Y`] = negative.y;
  shaperResetValues[`curveNB${index}`] = 0;
}
export const SHAPER_RESET_VALUES = Object.freeze(shaperResetValues);

function shaperParameter(values, endpointID, fallback) {
  return finiteOr(values?.get?.(endpointID) ?? values?.[endpointID], fallback);
}

export function shapeSideName(side) {
  return side === "negative" || Number(side) < 0 ? "negative" : "positive";
}

export function shapeSideSign(side) {
  return shapeSideName(side) === "negative" ? -1 : 1;
}

export function shapePointCount(values, side) {
  const endpointID = shapeSideName(side) === "negative" ? "curveNPointCount" : "curvePointCount";
  return Math.round(clamp(shaperParameter(values, endpointID, 1), 1, SHAPER_MAX_POINTS));
}

export function shapePointEndpointIDs(side, index) {
  const prefix = shapeSideName(side) === "negative" ? "curveN" : "curveP";
  const bendPrefix = shapeSideName(side) === "negative" ? "curveNB" : "curveB";
  return {
    x: `${prefix}${index}X`,
    y: `${prefix}${index}Y`,
    bend: `${bendPrefix}${index}`,
  };
}

export function rawShapePoint(values, side, index) {
  const sideName = shapeSideName(side);
  const defaults = SHAPER_SLOT_DEFAULTS[sideName][index - 1];
  const endpointIDs = shapePointEndpointIDs(sideName, index);
  return {
    side: sideName,
    index,
    x: shaperParameter(values, endpointIDs.x, defaults.x),
    y: shaperParameter(values, endpointIDs.y, defaults.y),
    bend: shaperParameter(values, endpointIDs.bend, 0),
  };
}

export function morphOwner(values) {
  const side = shapeSideName(shaperParameter(values, "morphSide", 1));
  const requestedIndex = Math.round(clamp(
    shaperParameter(values, "morphPoint", 1),
    1,
    SHAPER_MAX_POINTS,
  ));
  return { side, index: Math.min(requestedIndex, shapePointCount(values, side)) };
}

export function effectiveShapePoints(values, side) {
  const sideName = shapeSideName(side);
  const count = shapePointCount(values, sideName);
  const owner = morphOwner(values);
  const morph = clamp(shaperParameter(values, "morph", 0) * 0.01, 0, 1);
  const points = [{ side: sideName, index: 0, x: 0, y: 0, bend: 0 }];
  let previousX = 0;

  for (let index = 1; index <= count; index += 1) {
    const raw = rawShapePoint(values, sideName, index);
    let x = raw.x;
    let y = raw.y;
    if (owner.side === sideName && owner.index === index) {
      x += (shaperParameter(values, "morphTargetX", x) - x) * morph;
      y += (shaperParameter(values, "morphTargetY", y) - y) * morph;
    }
    const maximumX = 1.5 - 0.001 * (count - index);
    x = clamp(x, previousX + 0.001, maximumX);
    points.push({
      side: sideName,
      index,
      x,
      y: clamp(y, -1.5, 1.5),
      bend: clamp(raw.bend, -1, 1),
    });
    previousX = x;
  }

  return points;
}

export function evaluateBipolarTransfer(input, values = {}) {
  if (!Number.isFinite(Number(input)))
    throw new TypeError("Waveshaper input must be finite.");
  if (Number(input) === 0) return 0;

  const side = Number(input) < 0 ? "negative" : "positive";
  const magnitude = Math.abs(Number(input));
  const points = effectiveShapePoints(values, side);
  const ceiling = points.at(-1);
  if (magnitude >= ceiling.x) return ceiling.y;

  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    if (magnitude <= right.x) {
      const position = (magnitude - left.x) / Math.max(0.001, right.x - left.x);
      const shaped = quadraticBow(position, right.bend);
      return left.y + (right.y - left.y) * shaped;
    }
  }

  return ceiling.y;
}
