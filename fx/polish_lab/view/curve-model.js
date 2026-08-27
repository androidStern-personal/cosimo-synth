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

export const CURVE_EDITOR_MAX_POINTS = 7;

export const CURVE_EDITOR_DEFAULTS = Object.freeze({
  curveEditorEnabled: false,
  curveEditorInitialized: false,
  curvePointCount: 3,
  curveP4X: 1.05,
  curveP4Y: 1,
  curveP5X: 1.2,
  curveP5Y: 1,
  curveP6X: 1.35,
  curveP6Y: 1,
  curveP7X: 1.5,
  curveP7Y: 1,
  curveB1: 0,
  curveB2: 0,
  curveB3: 0,
  curveB4: 0,
  curveB5: 0,
  curveB6: 0,
  curveB7: 0,
  curveAmountPoint: 0,
  curveAmountTargetX: CURVE_DEFAULTS.curveP1X,
  curveAmountTargetY: CURVE_DEFAULTS.curveP1Y,
});

export const CURVE_EDITOR_ENDPOINTS = Object.freeze([
  "curveEditorEnabled",
  "curveEditorInitialized",
  "curvePointCount",
  "curveP4X", "curveP4Y",
  "curveP5X", "curveP5Y",
  "curveP6X", "curveP6Y",
  "curveP7X", "curveP7Y",
  "curveB1", "curveB2", "curveB3", "curveB4", "curveB5", "curveB6", "curveB7",
  "curveAmountPoint", "curveAmountTargetX", "curveAmountTargetY",
]);

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

export function finiteOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function parameterValue(values, endpointID, fallback) {
  return finiteOr(values?.get?.(endpointID) ?? values?.[endpointID], fallback);
}

function pointDefault(index, axis) {
  return index <= 3
    ? CURVE_DEFAULTS[`curveP${index}${axis}`]
    : CURVE_EDITOR_DEFAULTS[`curveP${index}${axis}`];
}

export function isCurveEditorEnabled(values = {}) {
  const value = values?.get?.("curveEditorEnabled") ?? values?.curveEditorEnabled;
  return value === true || Number(value) >= 0.5;
}

export function editorPointCount(values = {}) {
  return Math.round(clamp(
    parameterValue(values, "curvePointCount", CURVE_EDITOR_DEFAULTS.curvePointCount),
    2,
    CURVE_EDITOR_MAX_POINTS,
  ));
}

export function editorAmount(values = {}) {
  const amount = clamp(parameterValue(values, "amount", 0) * 0.01, 0, 1);
  const amountCurve = clamp(parameterValue(values, "macroCurve", 1), 0.25, 4);
  return amount ** amountCurve;
}

export function effectiveEditorCurve(values = {}) {
  const count = editorPointCount(values);
  const amountPoint = Math.round(clamp(
    parameterValue(values, "curveAmountPoint", CURVE_EDITOR_DEFAULTS.curveAmountPoint),
    0,
    count,
  ));
  const amount = editorAmount(values);
  const points = [{ x: 0, y: 0, bend: 0 }];

  for (let index = 1; index <= count; index += 1) {
    let x = parameterValue(values, `curveP${index}X`, pointDefault(index, "X"));
    let y = parameterValue(values, `curveP${index}Y`, pointDefault(index, "Y"));
    if (index === amountPoint) {
      const targetX = parameterValue(values, "curveAmountTargetX", x);
      const targetY = parameterValue(values, "curveAmountTargetY", y);
      x += (targetX - x) * amount;
      y += (targetY - y) * amount;
    }

    const previous = points[index - 1];
    const maximumX = 1.5 - 0.001 * (count - index);
    points.push({
      x: clamp(x, index === 1 ? 0.01 : previous.x + 0.001, maximumX),
      y: clamp(y, previous.y, 1.5),
      bend: clamp(parameterValue(values, `curveB${index}`, 0), -1, 1),
    });
  }

  return points;
}

export function quadraticBow(position, bend) {
  const u = clamp(position, 0, 1);
  return u + clamp(bend, -1, 1) * u * (1 - u);
}

export function evaluateEditableCurve(input, values = {}) {
  if (!Number.isFinite(input))
    throw new TypeError("Curve input must be finite.");

  if (input === 0)
    return 0;

  const sign = input < 0 ? -1 : 1;
  const magnitude = Math.abs(input);
  const points = effectiveEditorCurve(values);
  const ceiling = points.at(-1);
  if (magnitude >= ceiling.x)
    return sign * ceiling.y;

  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    if (magnitude <= right.x) {
      const position = (magnitude - left.x) / (right.x - left.x);
      const shaped = quadraticBow(position, right.bend);
      return sign * (left.y + (right.y - left.y) * shaped);
    }
  }

  return sign * ceiling.y;
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
  const driven = input * (10 ** (driveDb / 20));
  const shaped = isCurveEditorEnabled(values)
    ? evaluateEditableCurve(driven, values)
    : evaluateCurve(driven, curveValues);
  return input + (shaped - input) * mix;
}
