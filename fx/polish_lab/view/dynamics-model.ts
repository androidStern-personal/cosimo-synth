import { clamp, finiteOr, type CurveLabValues } from "./curve-model";

export const COMPRESSOR_DEFAULTS = Object.freeze({
  thresholdDb: 0,
  ratio: 4,
  kneeDb: 6,
  makeupDb: 0,
});

export function effectiveCompressorSettings(values: CurveLabValues) {
  return {
    thresholdDb: clamp(finiteOr(values.thresholdDb, COMPRESSOR_DEFAULTS.thresholdDb), -36, 6),
    ratio: clamp(finiteOr(values.ratio, COMPRESSOR_DEFAULTS.ratio), 1, 100),
    kneeDb: clamp(finiteOr(values.kneeDb, COMPRESSOR_DEFAULTS.kneeDb), 0, 24),
    makeupDb: clamp(finiteOr(values.makeupDb, COMPRESSOR_DEFAULTS.makeupDb), -24, 24),
  };
}

// Algebraically identical to desiredGainReductionDb in PolishVoicingLab.cmajor,
// with detector level already expressed in dB for graph sampling.
export function desiredGainReductionDbForLevel(levelDb: number, thresholdDb: number, ratio: number, kneeDb: number): number {
  const safeRatio = clamp(ratio, 1, 1000);
  const slope = 1 - 1 / safeRatio;
  const distance = levelDb - thresholdDb;
  const safeKnee = clamp(kneeDb, 0, 24);

  if (safeKnee <= 0.0001)
    return distance > 0 ? -slope * distance : 0;

  const halfKnee = safeKnee * 0.5;
  if (distance <= -halfKnee) return 0;
  if (distance >= halfKnee) return -slope * distance;

  const kneeDistance = distance + halfKnee;
  return -slope * kneeDistance * kneeDistance / (2 * safeKnee);
}

export function evaluateCompressorTransfer(inputDb: number, values: CurveLabValues): number {
  const settings = effectiveCompressorSettings(values);
  const reductionDb = desiredGainReductionDbForLevel(inputDb, settings.thresholdDb, settings.ratio, settings.kneeDb);
  return inputDb + reductionDb + settings.makeupDb;
}
