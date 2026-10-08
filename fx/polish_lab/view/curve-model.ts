/** Parameter values keyed by endpoint; a missing or non-finite value reads as the endpoint's default. */
export type CurveLabValues = { readonly [endpointID: string]: number | undefined };

export type ShapeSide = "positive" | "negative";

export interface ShapePoint {
  readonly side: ShapeSide;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly bend: number;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

export function evaluateBowedOutput(leftY: number, rightY: number, position: number, bend: number): number {
  const u = clamp(position, 0, 1);
  const linear = leftY + (rightY - leftY) * u;
  return linear + clamp(bend, -1, 1) * 4 * u * (1 - u);
}

export const SHAPER_MAX_POINTS = 7;

const SHAPER_SLOT_DEFAULTS: { readonly [Side in ShapeSide]: readonly { readonly x: number; readonly y: number }[] } = Object.freeze({
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

const shaperResetValues: { [endpointID: string]: number } = {
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
/** One ceiling per side, straight segments, every inactive slot at its default, and Morph at 0% with A on the positive ceiling. */
export const SHAPER_RESET_VALUES: CurveLabValues = Object.freeze(shaperResetValues);

export function shapeSideName(side: ShapeSide | number): ShapeSide {
  return side === "negative" || Number(side) < 0 ? "negative" : "positive";
}

export function shapePointCount(values: CurveLabValues, side: ShapeSide): number {
  const endpointID = side === "negative" ? "curveNPointCount" : "curvePointCount";
  return Math.round(clamp(finiteOr(values[endpointID], 1), 1, SHAPER_MAX_POINTS));
}

export function shapePointEndpointIDs(side: ShapeSide, index: number) {
  const prefix = side === "negative" ? "curveN" : "curveP";
  const bendPrefix = side === "negative" ? "curveNB" : "curveB";
  return {
    x: `${prefix}${index}X`,
    y: `${prefix}${index}Y`,
    bend: `${bendPrefix}${index}`,
  };
}

export function rawShapePoint(values: CurveLabValues, side: ShapeSide, index: number): ShapePoint {
  const defaults = SHAPER_SLOT_DEFAULTS[side][index - 1];
  const endpointIDs = shapePointEndpointIDs(side, index);
  return {
    side,
    index,
    x: finiteOr(values[endpointIDs.x], defaults.x),
    y: finiteOr(values[endpointIDs.y], defaults.y),
    bend: finiteOr(values[endpointIDs.bend], 0),
  };
}

export function morphOwner(values: CurveLabValues): { readonly side: ShapeSide; readonly index: number } {
  const side = shapeSideName(finiteOr(values.morphSide, 1));
  const requestedIndex = Math.round(clamp(finiteOr(values.morphPoint, 1), 1, SHAPER_MAX_POINTS));
  return { side, index: Math.min(requestedIndex, shapePointCount(values, side)) };
}

export function effectiveShapePoints(values: CurveLabValues, side: ShapeSide): ShapePoint[] {
  const count = shapePointCount(values, side);
  const owner = morphOwner(values);
  const morph = clamp(finiteOr(values.morph, 0) * 0.01, 0, 1);
  const points: ShapePoint[] = [{ side, index: 0, x: 0, y: 0, bend: 0 }];
  let previousX = 0;

  for (let index = 1; index <= count; index += 1) {
    const raw = rawShapePoint(values, side, index);
    let x = raw.x;
    let y = raw.y;
    if (owner.side === side && owner.index === index) {
      x += (finiteOr(values.morphTargetX, x) - x) * morph;
      y += (finiteOr(values.morphTargetY, y) - y) * morph;
    }
    const maximumX = 1.5 - 0.001 * (count - index);
    x = clamp(x, previousX + 0.001, maximumX);
    points.push({
      side,
      index,
      x,
      y: clamp(y, -1.5, 1.5),
      bend: clamp(raw.bend, -1, 1),
    });
    previousX = x;
  }

  return points;
}

export function evaluateBipolarTransfer(input: number, values: CurveLabValues = {}): number {
  if (!Number.isFinite(input))
    throw new TypeError("Waveshaper input must be finite.");
  if (input === 0) return 0;

  const side = input < 0 ? "negative" : "positive";
  const magnitude = Math.abs(input);
  const points = effectiveShapePoints(values, side);
  const ceiling = points[points.length - 1];
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
