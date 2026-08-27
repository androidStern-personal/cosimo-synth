export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

export function finiteOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function evaluateBowedOutput(leftY, rightY, position, bend) {
  const u = clamp(position, 0, 1);
  const linear = Number(leftY) + (Number(rightY) - Number(leftY)) * u;
  return linear + clamp(bend, -1, 1) * 4 * u * (1 - u);
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
      return evaluateBowedOutput(left.y, right.y, position, right.bend);
    }
  }

  return ceiling.y;
}
