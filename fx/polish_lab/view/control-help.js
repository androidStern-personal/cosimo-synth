export const CONTROL_HELP = Object.freeze({
  thresholdDb: "Level where compression starts. Lower values compress more of the signal.",
  ratio: "How strongly levels above Threshold are reduced. This always drives the visible curve and DSP directly.",
  kneeDb: "Width of the transition into compression. Zero is sharp; higher values make the bend gentler.",
  attackMs: "How quickly compression catches rising level. Longer times preserve more transient.",
  releaseMs: "How quickly compression lets go after level falls. Longer times recover more smoothly.",
  makeupDb: "Gain added after compression. It moves the compressor curve vertically.",
  morph: "Moves the assigned waveshaper point linearly from its A position to its B position. It changes nothing else.",
});

export function getControlHelp(endpointInfo) {
  const endpointID = endpointInfo?.endpointID;
  return CONTROL_HELP[endpointID];
}
