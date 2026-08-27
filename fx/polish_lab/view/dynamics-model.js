export const COMPRESSOR_DEFAULTS = Object.freeze({
  thresholdDb: 0,
  ratio: 4,
  kneeDb: 6,
  makeupDb: 0,
});

export function clampValue(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

export function finiteParameter(parameters, endpointID, fallback) {
  const value = Number(parameters?.get?.(endpointID) ?? parameters?.[endpointID]);
  return Number.isFinite(value) ? value : fallback;
}

export function effectiveCompressorSettings(parameters) {
  return {
    thresholdDb: clampValue(
      finiteParameter(parameters, "thresholdDb", COMPRESSOR_DEFAULTS.thresholdDb),
      -36,
      6,
    ),
    ratio: clampValue(finiteParameter(parameters, "ratio", COMPRESSOR_DEFAULTS.ratio), 1, 100),
    kneeDb: clampValue(finiteParameter(parameters, "kneeDb", COMPRESSOR_DEFAULTS.kneeDb), 0, 24),
    makeupDb: clampValue(
      finiteParameter(parameters, "makeupDb", COMPRESSOR_DEFAULTS.makeupDb),
      -24,
      24,
    ),
  };
}

// Algebraically identical to desiredGainReductionDb in PolishVoicingLab.cmajor,
// with detector level already expressed in dB for graph sampling.
export function desiredGainReductionDbForLevel(levelDb, thresholdDb, ratio, kneeDb) {
  const safeRatio = clampValue(ratio, 1, 1000);
  const slope = 1 - 1 / safeRatio;
  const distance = Number(levelDb) - Number(thresholdDb);
  const safeKnee = clampValue(kneeDb, 0, 24);

  if (safeKnee <= 0.0001)
    return distance > 0 ? -slope * distance : 0;

  const halfKnee = safeKnee * 0.5;
  if (distance <= -halfKnee) return 0;
  if (distance >= halfKnee) return -slope * distance;

  const kneeDistance = distance + halfKnee;
  return -slope * kneeDistance * kneeDistance / (2 * safeKnee);
}

export function evaluateCompressorTransfer(inputDb, parameters) {
  const settings = effectiveCompressorSettings(parameters);
  const reductionDb = desiredGainReductionDbForLevel(
    inputDb,
    settings.thresholdDb,
    settings.ratio,
    settings.kneeDb,
  );
  return Number(inputDb) + reductionDb + settings.makeupDb;
}
