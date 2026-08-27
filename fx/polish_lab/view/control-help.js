export const CONTROL_HELP = Object.freeze({
  bypass: "A/B switch for the whole lab. On passes the dry input unchanged; Off plays the processed chain without changing any settings.",
  amount: "Main intensity macro. It simultaneously adds pre-compressor input gain, compressor makeup, and compressor ratio using the three Macro Wiring ranges.",
  macroCurve: "Shapes the macro as normalized Amount ^ Amount Curve. 1 is linear; above 1 delays most change until high Amount values; below 1 brings the effect in earlier.",
  inputTrimDb: "Base gain after the optional low cut and before the compressor. Amount adds the Input Range on top of this value.",
  outputTrimDb: "Final gain after the clipper and immediately before the plugin output. It does not change how hard the chain is driven.",

  macroInputDriveDb: "Maximum extra pre-compressor gain added by Amount at 100%. The decoded starting range is +35.9712 dB.",
  macroMakeupDb: "Maximum extra compressor makeup gain added by Amount at 100%. The decoded starting range is +4.12 dB.",
  macroRatioTarget: "Compressor ratio approached as Amount reaches 100%. The 1000:1 limiting target is an explicit lab approximation, not a decoded proprietary ratio.",

  lowCutMix: "Blends the unfiltered signal with the high-pass-filtered signal before input gain. 0% is dry; 100% uses only the selected low cut.",
  lowCutHz: "Cutoff frequency of the exploratory high-pass filter before the compressor. Higher values remove more low-frequency energy.",
  lowCutSlope: "Selects how steeply the exploratory low cut removes frequencies below its cutoff: 6, 12, or 24 dB per octave.",

  colorFrequencyHz: "Center frequency of the exploratory parametric color band after the compressor and before the clipper.",
  colorGainDb: "Boosts or cuts the Color Frequency band. 0 dB is flat and makes Color Frequency and Color Q inaudible.",
  colorQ: "Bandwidth of the parametric color band. Higher Q is narrower and more focused; lower Q affects a broader frequency range.",

  thresholdDb: "Signal level where compression begins. Lowering the threshold makes more of the signal trigger gain reduction.",
  ratio: "Base compression ratio above Threshold before Amount moves it toward Ratio Target. Higher ratios hold peaks down more strongly.",
  kneeDb: "Width of the transition around Threshold. 0 dB is a hard knee; higher values ease into compression more gradually.",
  attackMs: "How quickly gain reduction catches a rising signal. Short attacks restrain transients; longer attacks let more initial punch through.",
  releaseMs: "How quickly gain reduction lets go after the signal falls. Short releases recover quickly; long releases sound smoother and steadier.",
  makeupDb: "Base gain added inside the compressed path after gain reduction. Amount adds the Makeup Range on top of this value.",
  detectorMode: "Chooses what drives compression. Peak follows instantaneous peaks; RMS follows averaged signal energy using RMS Window.",
  rmsWindowMs: "Averaging time used by the RMS detector. Longer windows react more smoothly and slowly. This has no effect in Peak mode.",
  detectorHpHz: "High-pass cutoff applied only to the compressor detector. It reduces bass-triggered compression without filtering the audible signal; 0 Hz is off.",
  stereoLink: "Links left and right gain reduction. 100% makes both channels follow the louder detector; 0% lets each channel compress independently.",
  compMix: "Parallel blend at the compressor stage. 0% is the uncompressed stage input; 100% is the compressed signal with makeup gain.",

  clipDriveDb: "Gain immediately before the oversampled transfer curve. More Drive pushes more samples into the shaped and flat parts of the clipper.",
  clipMix: "Parallel blend at the clipper stage. 0% is the time-aligned unclipped signal; 100% is the 4x-oversampled clipped signal.",
  curveP1X: "Input coordinate of the first positive transfer-curve anchor. Lower values make the first bend engage sooner; 1.0 equals digital full scale.",
  curveP1Y: "Output magnitude produced at Knot 1 In. Setting Out below In compresses that level; moving it toward In makes the curve cleaner.",
  curveP1T: "Bends the segment from zero into Knot 1. 0 is straight; positive advances then eases; negative eases then steepens.",
  curveP2X: "Input coordinate of the second positive transfer-curve anchor. It positions the upper bend between Knot 1 and the ceiling.",
  curveP2Y: "Output magnitude produced at Knot 2 In. Lower values flatten the upper part of the curve more strongly.",
  curveP2T: "Bends the segment from Knot 1 into Knot 2. 0 is straight; positive and negative values bend it in opposite directions.",
  curveP3X: "Final input anchor. At and above Ceiling In, the transfer curve stops rising and holds the Ceiling Out value.",
  curveP3Y: "Maximum output magnitude once input reaches Ceiling In. Every larger input is held at this plateau; 1.0 equals digital full scale.",
  curveP3T: "Bends the final segment from Knot 2 into the ceiling. It changes the approach to the plateau without moving either endpoint.",
});

export function getControlHelp(endpointInfo) {
  const endpointID = endpointInfo?.endpointID;
  const specific = CONTROL_HELP[endpointID];

  if (specific)
    return { text: specific, source: "specific" };

  const name = endpointInfo?.annotation?.name || endpointInfo?.name || endpointID || "this parameter";
  return {
    text: `Adjusts ${name}. A detailed explanation has not yet been added for this lab control.`,
    source: "fallback",
  };
}
