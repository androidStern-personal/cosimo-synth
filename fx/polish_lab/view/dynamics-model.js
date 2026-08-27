export const COMPRESSOR_DEFAULTS = Object.freeze({
  amount: 0,
  macroCurve: 1,
  thresholdDb: 0,
  ratio: 11.4155251,
  kneeDb: 0,
  makeupDb: -0.04,
  macroMakeupDb: 4.12,
  macroRatioTarget: 1000,
  compMix: 100,
});

export function clampValue(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

export function finiteParameter(parameters, endpointID, fallback) {
  const value = Number(parameters?.get?.(endpointID) ?? parameters?.[endpointID]);
  return Number.isFinite(value) ? value : fallback;
}

export function effectiveCompressorSettings(parameters) {
  const amount = clampValue(finiteParameter(parameters, "amount", COMPRESSOR_DEFAULTS.amount) * 0.01, 0, 1);
  const macroCurve = clampValue(
    finiteParameter(parameters, "macroCurve", COMPRESSOR_DEFAULTS.macroCurve),
    0.25,
    4,
  );
  const macro = amount ** macroCurve;
  const baseRatio = finiteParameter(parameters, "ratio", COMPRESSOR_DEFAULTS.ratio);
  const ratioTarget = finiteParameter(parameters, "macroRatioTarget", COMPRESSOR_DEFAULTS.macroRatioTarget);

  return {
    macro,
    thresholdDb: clampValue(
      finiteParameter(parameters, "thresholdDb", COMPRESSOR_DEFAULTS.thresholdDb),
      -36,
      6,
    ),
    ratio: clampValue(baseRatio + (ratioTarget - baseRatio) * macro, 1, 1000),
    kneeDb: clampValue(finiteParameter(parameters, "kneeDb", COMPRESSOR_DEFAULTS.kneeDb), 0, 24),
    makeupDb: clampValue(
      finiteParameter(parameters, "makeupDb", COMPRESSOR_DEFAULTS.makeupDb)
        + finiteParameter(parameters, "macroMakeupDb", COMPRESSOR_DEFAULTS.macroMakeupDb) * macro,
      -36,
      36,
    ),
    mix: clampValue(finiteParameter(parameters, "compMix", COMPRESSOR_DEFAULTS.compMix) * 0.01, 0, 1),
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
  const processedGain = 10 ** ((reductionDb + settings.makeupDb) / 20);
  const mixedGain = 1 + (processedGain - 1) * settings.mix;
  return Number(inputDb) + 20 * Math.log10(Math.max(mixedGain, 1e-6));
}
