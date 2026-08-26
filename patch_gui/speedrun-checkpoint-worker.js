const O = (t, e) => ({ label: t, value: e });
function $(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const B = Object.freeze({
  filter: $(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: $(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: $(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: $(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: $(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: $(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: $(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: $(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), m = (t, e, n, r, i, o, a, s = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: r,
  min: i,
  max: o,
  initial: a,
  step: s.step ?? (o - i) / 1e3,
  scale: s.scale ?? "linear",
  unit: s.unit ?? "",
  choices: s.choices,
  quick: s.quick ?? !1,
  modulationTargetIndex: s.modulationTargetIndex ?? null,
  modulationApplication: s.modulationApplication ?? (s.modulationTargetIndex === void 0 || s.modulationTargetIndex === null ? null : "linear"),
  modulationDragStyle: s.modulationDragStyle
}), Or = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], kr = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Dr = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: B.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      m("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(O), quick: !0 }),
      m("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      m("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      m("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: B.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      m("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [O("Classic", 0), O("Harmonics", 1)] }),
      m("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      m("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      m("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      m("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      m("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      m("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [O("Symmetric", 0), O("Asymmetric", 1), O("Wavefold", 2)] })
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: B.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      m("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      m("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      m("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      m("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      m("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 })
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: B.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      m("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(O) }),
      m("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(O) }),
      m("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      m("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      m("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      m("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      m("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(O) }),
      m("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: B.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      m("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      m("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      m("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      m("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 })
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: B.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      m("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [O("Free", 0), O("Sync", 1)] }),
      m("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      m("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Or.map(O) }),
      m("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      m("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      m("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      m("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      m("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 })
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: B.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      m("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [O("Free", 0), O("Sync", 1)] }),
      m("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      m("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: kr.map(O) }),
      m("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      m("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      m("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: B.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      m("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      m("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      m("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      m("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 })
    ]
  }
], Ce = Dr, Rn = Object.freeze(
  Ce.flatMap((t) => t.parameters)
);
new Map(
  Rn.map((t) => [t.endpointID, t])
);
function Tn(t) {
  const e = Ce.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function xn() {
  return Rn;
}
const v = ["A", "B", "C"], En = [
  "wavetablePosition",
  "warpAmount",
  "pitchSemitones",
  "ampGainDb",
  "pan",
  "unisonDetune",
  "unisonBlend",
  "unisonWidth",
  "unisonWavetablePositionSpread",
  "unisonWarpSpread"
], Lr = [
  "filterCutoffOctaves",
  "filterQ",
  "mseg1Morph",
  "mseg2Morph",
  "mseg3Morph",
  "mseg1Rate",
  "mseg2Rate",
  "mseg3Rate",
  "env1Attack",
  "env1Decay",
  "env1Sustain",
  "env1Release",
  "env2Attack",
  "env2Decay",
  "env2Sustain",
  "env2Release",
  "env3Attack",
  "env3Decay",
  "env3Sustain",
  "env3Release",
  "filterMix",
  "globalTuneSemitones"
], X = Object.freeze([
  { id: "mseg-1", sourceKind: "mseg", sourceSlot: 1, group: "voice", runtimeIndex: 0 },
  { id: "mseg-2", sourceKind: "mseg", sourceSlot: 2, group: "voice", runtimeIndex: 1 },
  { id: "mseg-3", sourceKind: "mseg", sourceSlot: 3, group: "voice", runtimeIndex: 2 },
  { id: "env-1", sourceKind: "env", sourceSlot: 1, group: "voice", runtimeIndex: 3 },
  { id: "env-2", sourceKind: "env", sourceSlot: 2, group: "voice", runtimeIndex: 4 },
  { id: "env-3", sourceKind: "env", sourceSlot: 3, group: "voice", runtimeIndex: 5 },
  { id: "macro-1", sourceKind: "macro", sourceSlot: 1, group: "macro", runtimeIndex: 0 },
  { id: "macro-2", sourceKind: "macro", sourceSlot: 2, group: "macro", runtimeIndex: 1 },
  { id: "macro-3", sourceKind: "macro", sourceSlot: 3, group: "macro", runtimeIndex: 2 },
  { id: "macro-4", sourceKind: "macro", sourceSlot: 4, group: "macro", runtimeIndex: 3 },
  { id: "velocity", sourceKind: "velocity", sourceSlot: null, group: "voice", runtimeIndex: 6 },
  { id: "pressure", sourceKind: "pressure", sourceSlot: null, group: "voice", runtimeIndex: 7 },
  { id: "slide", sourceKind: "slide", sourceSlot: null, group: "voice", runtimeIndex: 8 }
]), Nr = Object.freeze([
  ...v.flatMap((t) => En.map(
    (e) => `osc${t}.${e}`
  )),
  ...Lr
]);
new Set(
  v.flatMap((t) => En.map(
    (e) => `osc${t}.${e}`
  ))
);
const Mn = Object.freeze(
  Nr.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), Cr = xn().filter((t) => t.modulationTargetIndex !== null), Pr = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function ft(t) {
  const e = Fr(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function Fr(t) {
  const e = Pr.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const wn = Object.freeze(
  Cr.map((t) => ({
    // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
    // and indexes are both minted only by the rack descriptor catalog.
    kind: ft(t.endpointID),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })).sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), z = Object.freeze([
  ...Mn,
  ...wn
]), Ee = X.length, _n = Mn.length, Pe = wn.length, Ur = Ee * z.length, $r = new Map(X.map((t) => [t.id, t])), On = new Map(X.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), ae = new Map(z.map((t) => [t.kind, t]));
function Br() {
  if (Ee !== 13 || _n !== 52 || Pe !== 36 || Ur !== 1144)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 9], ["macro", 4]]) {
    const n = X.filter((r) => r.group === t);
    if (n.length !== e || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 52], ["rack", 36]]) {
    const n = z.filter((r) => r.group === t);
    if (n.length !== e || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if ($r.size !== Ee || On.size !== Ee || ae.size !== z.length)
    throw new Error("Modulation identities must be unique");
}
Br();
function kn(t, e) {
  const n = On.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function ht(t) {
  return typeof t != "string" ? null : ae.has(t) ? t : null;
}
function Vr(t) {
  const e = ht(t);
  return e !== null && ae.get(e)?.group === "voice" ? e : null;
}
function Dn(t) {
  const e = ht(t);
  return e !== null && ae.get(e)?.group === "rack" ? e : null;
}
function Kr(t) {
  const e = ae.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function Ln(t) {
  const e = ae.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function zr(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const Nn = 4, Wr = Nn * Pe, jr = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]]
]), Gr = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function se(t) {
  if (typeof t != "string")
    return null;
  const e = Gr.exec(t);
  if (e === null)
    return null;
  const n = e[1], r = jr.get(n);
  if (r === void 0)
    return null;
  const i = e[3];
  return r.includes(i) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: i
  } : null;
}
function pt(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function Cn(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function Pn(t) {
  if (t === null)
    return null;
  const e = Cn(t) - 1;
  return e > Nn ? null : e * Pe + Ln(pt(t));
}
const K = 2048, Hr = K + 3, Dt = 20, Fn = "MSEG 1", qr = 0, H = 2, Jr = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function gt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function oe(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function Qr(t) {
  return gt(Number.isFinite(t) ? t : 0, -Dt, Dt);
}
function Q(t) {
  return gt(Number.isFinite(t) ? t : 0, 0, 1);
}
function Un(t = Fn) {
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: t,
    globalSmooth: !1,
    points: [
      { x: 0, y: 0, curvePower: 0 },
      { x: 1, y: 1, curvePower: 0 }
    ]
  };
}
function nt() {
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: 1
    },
    loop: { startX: 0, endX: 1 },
    noteOffPolicy: "finish_loop",
    legatoRestarts: !1,
    holdFinalValue: !0
  };
}
function Xr(t) {
  const e = Number(t);
  return gt(
    Number.isFinite(e) ? e : 1,
    qr,
    H
  );
}
function Yr(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = Q(Number(e.startX)), r = Q(Number(e.endX));
  return oe(n, r) ? null : r < n ? {
    startX: r,
    endX: n
  } : { startX: n, endX: r };
}
function Zr(t = nt()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, r = Number(n.seconds), i = e.noteOffPolicy, o = Jr.has(i) ? i : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: Xr(Number.isFinite(r) ? r : 1)
    },
    loop: Yr(e.loop),
    noteOffPolicy: o,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function ei(t, e, n) {
  const r = t && typeof t == "object" ? t : {};
  let i = Number(r.x);
  return Number.isFinite(i) || (i = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (i = Q(i)), {
    x: i,
    y: Q(Number(r.y)),
    curvePower: Qr(Number(r.curvePower))
  };
}
function pe(t = Un()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => ei(i, o, n.length));
  if (!oe(r[0].x, 0) || !oe(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < r.length; i += 1)
    if (r[i].x < r[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Fn,
    globalSmooth: !!e.globalSmooth,
    points: r
  };
}
function Lt(t) {
  return JSON.stringify(pe(t));
}
function ti(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, r = Math.exp(e) - 1;
  return n / r;
}
function ni(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const r = t[n], i = t[n + 1];
    if (e < i.x)
      return { from: r, to: i, laterPointWins: !1 };
    if (oe(e, i.x)) {
      let o = n + 1;
      for (; o + 1 < t.length && oe(t[o + 1].x, e); )
        o += 1;
      return {
        from: t[o],
        to: t[o],
        laterPointWins: !0
      };
    }
  }
  return {
    from: t[t.length - 1],
    to: t[t.length - 1],
    laterPointWins: !1
  };
}
function ri(t, e) {
  const n = Q(Number(e)), r = ni(t, n);
  if (r.laterPointWins || oe(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = Q(ti(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function ii(t, e) {
  return ri(pe(t).points, e);
}
function oi(t) {
  const e = pe(t), n = new Float32Array(K);
  for (let i = 0; i < K; i += 1) {
    const o = i / (K - 1);
    n[i] = ii(e, o);
  }
  const r = new Float32Array(Hr);
  return r[0] = n[0], r.set(n, 1), r[K + 1] = n[K - 1], r[K + 2] = n[K - 1], r;
}
function Nt(t, e) {
  return Lt(t) === Lt(e);
}
const Ue = "modulationProgram", ai = "modulationAmount", $n = X.filter((t) => t.group === "voice").length, Bn = X.filter((t) => t.group === "macro").length, we = _n, si = Pe, _e = si + Wr, q = $n * we, Z = Bn * we, li = $n * _e, ci = Bn * _e, j = 512, Y = 256, Vn = q + Z;
function ui(t) {
  const e = kn(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function di(t) {
  const e = Vr(t);
  return e === null ? null : Kr(e);
}
function Kn(t) {
  const e = di(t.targetKind), n = Dn(t.targetKind);
  let r = n === null ? void 0 : Ln(n);
  if (r === void 0) {
    const a = Pn(
      se(t.targetKind)
    );
    a !== null && (r = a);
  }
  if (e === null && r === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = kn(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (e !== null) {
      const c = s * we + e;
      return {
        path: "macroVoice",
        cellIndex: c,
        sourceIndex: s,
        targetIndex: e,
        articulationCellIndex: q + c
      };
    }
    const l = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * _e + l,
      sourceIndex: s,
      targetIndex: l,
      articulationCellIndex: null
    };
  }
  const i = ui(t);
  if (e !== null) {
    const a = i * we + e;
    return {
      path: "voice",
      cellIndex: a,
      sourceIndex: i,
      targetIndex: e,
      articulationCellIndex: a
    };
  }
  const o = r ?? 0;
  return {
    path: "voiceRack",
    cellIndex: i * _e + o,
    sourceIndex: i,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function It(t) {
  return se(t.targetKind) !== null ? null : Kn(t).articulationCellIndex;
}
function mi(t) {
  if (Dn(t.targetKind) !== null)
    return !1;
  const e = se(t.targetKind);
  return e !== null && Pn(e) === null;
}
function fi(t) {
  return {
    ...Kn(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function zn(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (mi(n))
      continue;
    const r = fi(n), i = e[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return e;
}
function hi(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function ee(t) {
  return [...t.values()].filter(hi).sort((e, n) => e.cellIndex - n.cellIndex);
}
function ve(t, e, n, r, i) {
  for (let o = 0; o < t.length; o += 1) {
    const a = t[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    e[o] = a.cellIndex, n[o] = a.sourceIndex, r[o] = a.targetIndex, i[o] = a.polarity;
  }
}
function $e(t) {
  const e = zn(t), n = ee(e.voice), r = ee(e.macroVoice), i = ee(e.voiceRack), o = ee(e.macroRack), a = Array.from({ length: q }, () => 0), s = Array.from({ length: q }, () => 0), l = Array.from({ length: q }, () => 0), c = Array.from({ length: q }, () => 0), u = Array.from({ length: q }, () => 0);
  ve(n, a, s, l, c);
  const d = Array.from({ length: Z }, () => 0), h = Array.from({ length: Z }, () => 0), f = Array.from({ length: Z }, () => 0), p = Array.from({ length: Z }, () => 0), I = Array.from({ length: Z }, () => 0);
  if (ve(
    r,
    d,
    h,
    f,
    p
  ), i.length > j || o.length > Y)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${i.length} voice-rack (max ${j}), ${o.length} macro-rack (max ${Y})`
    );
  const D = Array.from({ length: j }, () => 0), N = Array.from({ length: j }, () => 0), S = Array.from({ length: j }, () => 0), A = Array.from({ length: j }, () => 0), k = Array.from({ length: j }, () => 0), L = Array.from({ length: li }, () => 0);
  ve(
    i,
    D,
    N,
    S,
    A
  );
  const W = Array.from({ length: Y }, () => 0), Mt = Array.from({ length: Y }, () => 0), wt = Array.from({ length: Y }, () => 0), _t = Array.from({ length: Y }, () => 0), Ot = Array.from({ length: ci }, () => 0);
  ve(
    o,
    W,
    Mt,
    wt,
    _t
  );
  for (const M of e.voice.values()) u[M.cellIndex] = M.amount;
  for (const M of e.macroVoice.values()) I[M.cellIndex] = M.amount;
  for (const M of e.voiceRack.values()) L[M.cellIndex] = M.amount;
  for (const M of e.macroRack.values()) Ot[M.cellIndex] = M.amount;
  for (let M = 0; M < i.length; M += 1) {
    const kt = i[M];
    if (kt === void 0) throw new Error(`Missing compiled voice-rack route at index ${M}`);
    k[M] = kt.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: l,
    voiceRoutePolarities: c,
    voiceRouteAmounts: u,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: d,
    macroVoiceRouteSources: h,
    macroVoiceRouteTargets: f,
    macroVoiceRoutePolarities: p,
    macroVoiceRouteAmounts: I,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: D,
    voiceRackRouteSources: N,
    voiceRackRouteTargets: S,
    voiceRackRoutePolarities: A,
    voiceRackRouteReducers: k,
    voiceRackRouteAmounts: L,
    macroRackRouteCount: o.length,
    macroRackRouteCells: W,
    macroRackRouteSources: Mt,
    macroRackRouteTargets: wt,
    macroRackRoutePolarities: _t,
    macroRackRouteAmounts: Ot
  };
}
const pi = ["voice", "macroVoice", "voiceRack", "macroRack"], gi = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Ct(t) {
  return zn(t);
}
function Ii(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function vi(t, e) {
  if (t === null)
    return [{ endpointID: Ue, value: $e(e) }];
  const n = Ct(t), r = Ct(e), i = [];
  for (const o of pi) {
    const a = ee(n[o]), s = ee(r[o]);
    if (a.length !== s.length)
      return [{ endpointID: Ue, value: $e(e) }];
    for (let l = 0; l < s.length; l += 1) {
      const c = a[l], u = s[l];
      if (c === void 0 || u === void 0 || !Ii(c, u))
        return [{ endpointID: Ue, value: $e(e) }];
      c.amount !== u.amount && i.push({
        endpointID: ai,
        value: {
          pathKind: gi[o],
          cellIndex: u.cellIndex,
          amount: u.amount
        }
      });
    }
  }
  return i;
}
function le(t) {
  return { _tag: "ok", value: t };
}
function fe(t) {
  return { _tag: "err", error: t };
}
function Si(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function bi(t) {
  throw new Error(t ?? "Invariant violated");
}
const yi = "globalTune", Ai = "globalTuneSemitones", V = -24, ce = 24, Pt = 0, Wn = -48, jn = 48;
function Se(t, e, n, r, i = "percent", o = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const Ri = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      Se("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      Se("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      Se("mix", "Mix", 100, 100),
      Se("drive", "Drive", 15, 0)
    ]
  }
], Ft = 1e-6;
function U(t, e) {
  if (!Number.isFinite(t) || t < -Ft || t > 1 + Ft)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function Oe(t, e) {
  return U(t / 100, `${e} catalog percentage`);
}
function Fe(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Ti(t) {
  return 20 * 1e3 ** t;
}
function xi(t) {
  return U(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Ei(t) {
  return 0.1 * 200 ** t;
}
function Mi(t) {
  return U(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function wi(t) {
  return t;
}
function _i(t) {
  return U(t, "filterMix endpoint conversion");
}
function he(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function Oi(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: he("filterCutoff", Ti, xi),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: he("filterQ", Ei, Mi),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: he("filterMix", wi, _i),
        // T05 scope: articulations do not own Mix yet — capturing it
        // would extend the persisted articulation schema.
        articulationParameterId: null,
        modulationTargetKind: "filterMix"
      };
    default:
      return {
        binding: {
          _tag: "unbacked",
          reason: e === "effects" ? "rack-dsp" : "no-endpoint"
        },
        articulationParameterId: null,
        modulationTargetKind: null
      };
  }
}
function Gn(t) {
  switch (t) {
    case "percent":
      return { kind: "percent" };
    case "frequency":
      return { kind: "frequency", minHz: 20, maxHz: 2e4 };
    case "rate":
      return { kind: "rate", minHz: 0.05, maxHz: 10 };
    case "phase":
      return { kind: "phase" };
    case "signed":
      return { kind: "signed-percent" };
    case "semitone":
      return { kind: "semitone", span: 50 };
    default:
      return Si(t);
  }
}
function ki(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Di(t, e) {
  const n = Fe(t.moduleId, e.id), r = Gn(e.format), i = Oi(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: Oe(e.defaultPercent, n),
    initialValue: Oe(e.initialPercent, n),
    format: r,
    modAmount: ki(r),
    binding: i.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const Li = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: 80, defaultPercent: 80, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Ni(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ci(t, e) {
  const n = `osc${t}`, r = Fe(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: Oe(e.defaultPercent, r),
    initialValue: Oe(e.initialPercent, r),
    format: Gn(e.format),
    modAmount: Ni(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Pi = Object.freeze(
  v.flatMap((t) => Li.map((e) => Ci(t, e)))
), Fi = Object.freeze({
  targetId: Fe("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: U(
    (Pt - V) / (ce - V),
    "Global Tune default"
  ),
  initialValue: U(
    (Pt - V) / (ce - V),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: ce },
  modAmount: {
    min: Wn,
    max: jn,
    unit: "st",
    digits: 2
  },
  binding: he(
    yi,
    (t) => V + (ce - V) * t,
    (t) => U(
      (t - V) / (ce - V),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: Ai
}), Ui = Object.freeze([
  { moduleId: "mseg1", targetIdSuffix: "morph", endpointID: "mseg1Morph", targetKind: "mseg1Morph", label: "MSEG 1 Morph", min: 0, max: 1, initial: 0, format: "percent", articulationParameterId: "msegMorph1" },
  { moduleId: "mseg2", targetIdSuffix: "morph", endpointID: "mseg2Morph", targetKind: "mseg2Morph", label: "MSEG 2 Morph", min: 0, max: 1, initial: 0, format: "percent", articulationParameterId: "msegMorph2" },
  { moduleId: "mseg3", targetIdSuffix: "morph", endpointID: "mseg3Morph", targetKind: "mseg3Morph", label: "MSEG 3 Morph", min: 0, max: 1, initial: 0, format: "percent", articulationParameterId: "msegMorph3" },
  { moduleId: "mseg1", targetIdSuffix: "rate", endpointID: "mseg1Rate", targetKind: "mseg1Rate", label: "MSEG 1 Time", min: 0, max: 2, initial: 1, format: "time", articulationParameterId: null },
  { moduleId: "mseg2", targetIdSuffix: "rate", endpointID: "mseg2Rate", targetKind: "mseg2Rate", label: "MSEG 2 Time", min: 0, max: 2, initial: 1, format: "time", articulationParameterId: null },
  { moduleId: "mseg3", targetIdSuffix: "rate", endpointID: "mseg3Rate", targetKind: "mseg3Rate", label: "MSEG 3 Time", min: 0, max: 2, initial: 1, format: "time", articulationParameterId: null },
  { moduleId: "env1", targetIdSuffix: "attack", endpointID: "env1Attack", targetKind: "env1Attack", label: "ENV 1 Attack", min: 1e-3, max: 10, initial: 0.01, format: "time", articulationParameterId: "env1.attackSeconds" },
  { moduleId: "env1", targetIdSuffix: "decay", endpointID: "env1Decay", targetKind: "env1Decay", label: "ENV 1 Decay", min: 1e-3, max: 10, initial: 0.25, format: "time", articulationParameterId: "env1.decaySeconds" },
  { moduleId: "env1", targetIdSuffix: "sustain", endpointID: "env1Sustain", targetKind: "env1Sustain", label: "ENV 1 Sustain", min: 0, max: 1, initial: 0.5, format: "percent", articulationParameterId: "env1.sustain" },
  { moduleId: "env1", targetIdSuffix: "release", endpointID: "env1Release", targetKind: "env1Release", label: "ENV 1 Release", min: 1e-3, max: 10, initial: 0.2, format: "time", articulationParameterId: "env1.releaseSeconds" },
  { moduleId: "env2", targetIdSuffix: "attack", endpointID: "env2Attack", targetKind: "env2Attack", label: "ENV 2 Attack", min: 1e-3, max: 10, initial: 0.01, format: "time", articulationParameterId: "env2.attackSeconds" },
  { moduleId: "env2", targetIdSuffix: "decay", endpointID: "env2Decay", targetKind: "env2Decay", label: "ENV 2 Decay", min: 1e-3, max: 10, initial: 0.25, format: "time", articulationParameterId: "env2.decaySeconds" },
  { moduleId: "env2", targetIdSuffix: "sustain", endpointID: "env2Sustain", targetKind: "env2Sustain", label: "ENV 2 Sustain", min: 0, max: 1, initial: 0.5, format: "percent", articulationParameterId: "env2.sustain" },
  { moduleId: "env2", targetIdSuffix: "release", endpointID: "env2Release", targetKind: "env2Release", label: "ENV 2 Release", min: 1e-3, max: 10, initial: 0.2, format: "time", articulationParameterId: "env2.releaseSeconds" },
  { moduleId: "env3", targetIdSuffix: "attack", endpointID: "env3Attack", targetKind: "env3Attack", label: "ENV 3 Attack", min: 1e-3, max: 10, initial: 0.01, format: "time", articulationParameterId: "env3.attackSeconds" },
  { moduleId: "env3", targetIdSuffix: "decay", endpointID: "env3Decay", targetKind: "env3Decay", label: "ENV 3 Decay", min: 1e-3, max: 10, initial: 0.25, format: "time", articulationParameterId: "env3.decaySeconds" },
  { moduleId: "env3", targetIdSuffix: "sustain", endpointID: "env3Sustain", targetKind: "env3Sustain", label: "ENV 3 Sustain", min: 0, max: 1, initial: 0.5, format: "percent", articulationParameterId: "env3.sustain" },
  { moduleId: "env3", targetIdSuffix: "release", endpointID: "env3Release", targetKind: "env3Release", label: "ENV 3 Release", min: 1e-3, max: 10, initial: 0.2, format: "time", articulationParameterId: "env3.releaseSeconds" }
]);
function $i(t) {
  const e = Fe(t.moduleId, t.targetIdSuffix), n = t.max - t.min, r = (o) => t.min + n * o, i = (o) => U(
    (o - t.min) / n,
    `${t.endpointID} endpoint conversion`
  );
  return Object.freeze({
    targetId: e,
    moduleId: t.moduleId,
    workspace: "voice",
    label: t.label,
    defaultValue: i(t.initial),
    initialValue: i(t.initial),
    format: t.format === "time" ? { kind: "time", minSeconds: t.min, maxSeconds: t.max } : { kind: "percent" },
    modAmount: t.format === "time" ? { min: -n, max: n, unit: "s", digits: 3 } : { min: -100, max: 100, unit: "%", digits: 0 },
    binding: he(t.endpointID, r, i),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const Bi = Object.freeze(
  Ui.map($i)
);
function Vi(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function Be(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return U(n, `${t.endpointID} endpoint conversion`);
}
function Ki(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function zi(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Wi(t) {
  if (t.scale === "log")
    return { min: -6, max: 6, unit: "oct", digits: 2 };
  if (t.unit === "st") {
    const n = t.max - t.min;
    return { min: -n, max: n, unit: "st", digits: 2 };
  }
  if (t.unit === "dB") {
    const n = t.max - t.min;
    return { min: -n, max: n, unit: "dB", digits: 1 };
  }
  const e = t.max - t.min;
  return { min: -e, max: e, unit: "%", digits: e <= 2 ? 3 : 1 };
}
function ji(t) {
  const e = Vi(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: Be(t, t.initial),
    initialValue: Be(t, t.initial),
    format: zi(t),
    modAmount: Wi(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Ki(t, n),
      fromEngine: (n) => Be(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : ft(t.endpointID)
  });
}
const vt = Object.freeze(
  [
    ...Ce.flatMap((t) => t.parameters.map(ji)),
    Fi,
    ...Pi,
    ...Bi,
    ...Ri.flatMap(
      (t) => t.parameters.map(
        (e) => Di(t, e)
      )
    )
  ]
), Gi = new Map(
  vt.map((t) => [t.targetId, t])
), Hn = vt.filter(
  (t) => t.modulationTargetKind !== null
), rt = new Map(
  Hn.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Gi.size !== vt.length)
  throw new Error("Target descriptor IDs must be unique");
if (Hn.length !== z.length || rt.size !== z.length || z.some((t) => rt.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function Ve(t) {
  const e = rt.get(t);
  return e === void 0 ? bi(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  Ce.map((t) => [t.id, t.label])
);
function Hi(t) {
  const e = Cn(t);
  return e === 1 ? "" : ` ${e}`;
}
function qi(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const r = Ve(t);
    return `${e[1]} ${r.label.toUpperCase()}`;
  }
  const n = se(t);
  if (n !== null) {
    const r = Ve(pt(n));
    return `${r.moduleId.toUpperCase()}${Hi(n)} ${r.label.toUpperCase()}`;
  }
  return Ve(t).label.toUpperCase();
}
const te = "modulation.v6", qn = 6, ge = 3, J = 3, Ut = "modulationMsegBuffer", Ji = "modulationMsegPlayback", Jn = 4, Qi = ["MSEG 1", "MSEG 2", "MSEG 3"], Qn = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], Xi = ["Env 1", "Env 2", "Env 3"], Yi = 1e-3, T = 10, Zi = 0.1, eo = 20, to = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: eo - Zi },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Wn,
    max: jn
  },
  // Additive dB offset over the full parameter span; the engine clamps base + offset.
  ampGainDb: { min: -54, max: 54 },
  pan: { min: -1, max: 1 },
  unisonDetune: { min: -1, max: 1 },
  unisonBlend: { min: -1, max: 1 },
  unisonWidth: { min: -1, max: 1 },
  unisonWavetablePositionSpread: { min: -1, max: 1 },
  unisonWarpSpread: { min: -1, max: 1 },
  mseg1Morph: { min: -1, max: 1 },
  mseg2Morph: { min: -1, max: 1 },
  mseg3Morph: { min: -1, max: 1 },
  mseg1Rate: { min: -H, max: H },
  mseg2Rate: { min: -H, max: H },
  mseg3Rate: { min: -H, max: H },
  env1Attack: { min: -T, max: T },
  env1Decay: { min: -T, max: T },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -T, max: T },
  env2Attack: { min: -T, max: T },
  env2Decay: { min: -T, max: T },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -T, max: T },
  env3Attack: { min: -T, max: T },
  env3Decay: { min: -T, max: T },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -T, max: T }
}, no = xn().filter((t) => t.modulationTargetIndex !== null), Xn = new Map(
  no.map((t) => [ft(t.endpointID), t])
);
class Ke extends Error {
  name = "ModulationStateParseError";
}
const ro = {
  "mseg-1": "MSEG 1",
  "mseg-2": "MSEG 2",
  "mseg-3": "MSEG 3",
  "env-1": "ENV 1",
  "env-2": "ENV 2",
  "env-3": "ENV 3",
  velocity: "VEL",
  pressure: "AT",
  slide: "SLIDE",
  "macro-1": "MACRO 1",
  "macro-2": "MACRO 2",
  "macro-3": "MACRO 3",
  "macro-4": "MACRO 4"
};
X.map((t) => ({
  value: t.id,
  label: ro[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const io = z.map((t) => ({
  value: t.kind,
  label: qi(t.kind)
}));
io.filter((t) => !ao(t.value));
function oo(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function St(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function ze(t, e) {
  const n = Number(t);
  return St(Number.isFinite(n) ? n : e, Yi, T);
}
function ao(t) {
  return Xn.has(t);
}
function so(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function lo(t) {
  const e = se(t);
  return e !== null ? pt(e) : t;
}
function co(t) {
  const e = lo(t), n = Xn.get(e);
  return n !== void 0 ? so(n) : to[zr(e)];
}
function uo(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function mo(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function fo(t, e) {
  const n = co(t), r = Number(e);
  return St(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function ho(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function po(t) {
  return ho(t) ?? "mseg";
}
function go(t) {
  const e = ht(t);
  return e !== null ? e : se(t) !== null ? t : null;
}
function Io(t) {
  return go(t) ?? "oscA.wavetablePosition";
}
function vo(t, e) {
  const n = Qn[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function So(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const r = t === "mseg" ? ge : t === "macro" ? Jn : J;
  return St(Number.isFinite(n) ? n : 1, 1, r);
}
function ne(t) {
  return {
    name: Xi[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Yn(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, r = ne(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: ze(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: ze(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: Q(n.sustain ?? r.sustain),
    releaseSeconds: ze(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function bo(t, e = 0) {
  return { name: Yn(t, e).name };
}
function yo(t, e, n, r) {
  const i = Number(t.amount);
  return {
    id: uo(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: So(n, t.sourceSlot),
    polarity: mo(t.polarity),
    targetKind: r,
    amount: fo(r, i),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function Ao(t, e = 0) {
  const r = t !== null && typeof t == "object" ? t : {}, i = po(r.sourceKind), o = Io(r.targetKind);
  return yo(r, e, i, o);
}
function Ro(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function To(t) {
  return (Array.isArray(t) ? t : []).map((n, r) => Ao(n, r));
}
function xo(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of t) {
    const i = Ro(r);
    if (e.has(r.id) || n.has(i))
      return !1;
    e.add(r.id), n.add(i);
  }
  return !0;
}
function it(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, s) => it(a, e[s]));
  const n = t, r = e, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => oo(r, a) && it(n[a], r[a]));
}
function Zn(t, e) {
  const n = t && typeof t == "object" ? t : {}, r = Un(Qi[e] ?? `MSEG ${e + 1}`), i = pe(n.shapeA ?? r), o = Zr({
    ...nt(),
    ...n.playback ?? {},
    rate: nt().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: i,
    shapeB: pe(n.shapeB ?? i),
    playback: s
  };
}
function ot() {
  return {
    format: "cosimo.modulation",
    version: qn,
    msegSlots: Array.from({ length: ge }, (t, e) => Zn({}, e)),
    envelopeSlots: Array.from({ length: J }, (t, e) => ({
      name: ne(e).name
    })),
    routes: [],
    macroNames: Qn.slice()
  };
}
function Eo(t = ot()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], r = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], i = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: qn,
    msegSlots: Array.from({ length: ge }, (o, a) => Zn(n[a], a)),
    envelopeSlots: Array.from({ length: J }, (o, a) => bo(r[a], a)),
    routes: To(e.routes),
    macroNames: Array.from(
      { length: Jn },
      (o, a) => vo(i[a], a)
    )
  };
}
function $t(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return fe(new Ke("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return fe(new Ke("Expected valid modulation JSON"));
    }
  }
  const n = Eo(e);
  return !it(e, n) || !xo(n.routes) ? fe(new Ke("Expected the current modulation schema")) : le(n);
}
function Mo(t, e) {
  return {
    slot: t + 1,
    holdFinalValue: e.holdFinalValue !== !1,
    rateKind: 0,
    loopEnabled: !!e.loop,
    loopStart: e.loop?.startX ?? 0,
    loopEnd: e.loop?.endX ?? 1,
    noteOffPolicy: e.noteOffPolicy === "immediate" ? 1 : e.noteOffPolicy === "ignore" ? 2 : 0,
    legatoRestarts: !!e.legatoRestarts
  };
}
function Bt(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(oi(n))
  };
}
function wo(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function er(t, e = null) {
  const n = [];
  for (let r = 0; r < ge; r += 1) {
    const i = t.msegSlots[r], o = e?.msegSlots[r];
    (o === void 0 || !Nt(o.shapeA, i.shapeA)) && n.push({
      endpointID: Ut,
      value: Bt(r, 0, i.shapeA)
    }), (o === void 0 || !Nt(o.shapeB, i.shapeB)) && n.push({
      endpointID: Ut,
      value: Bt(r, 1, i.shapeB)
    }), (o === void 0 || !wo(o.playback, i.playback)) && n.push({
      endpointID: Ji,
      value: Mo(r, i.playback)
    });
  }
  return n.push(...vi(e?.routes ?? null, t.routes)), n;
}
const We = "articulationSnapshot", y = 128, Vt = 48, _o = 1e6, E = -1, je = [
  "Bow Forte",
  "Bow Pianissimo",
  "Pluck Round",
  "Pluck Snap",
  "Hammer",
  "Air Pad",
  "Bell Strike",
  "Choke",
  "Tape Hum",
  "Curl Lift",
  "Chatter",
  "Tug Sustain",
  "Velvet Pop",
  "Chrome Bloom",
  "Tin Halo",
  "Sugar Gate"
];
function bt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Ge(t) {
  return bt(Number.isFinite(t) ? t : 0, 0, 1);
}
function _(t, e, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const i = Number(t);
  return bt(Number.isFinite(i) ? i : e, n, r);
}
function x(t, e, n, r) {
  return bt(Math.round(_(t, e)), n, r);
}
function tr(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function He() {
  return Array.from({ length: y }, () => E);
}
function Oo(t) {
  const e = x(t, 0, 0, y - 1), n = je[e % je.length], r = Math.floor(e / je.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function ko() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: -9.542425,
    mute: 0,
    solo: 0,
    warpMode: 0,
    warpAmount: 0,
    filterMode: 0,
    filterCutoff: 1e3,
    filterQ: 0.707107,
    unisonVoices: 1,
    unisonDetune: 0.1,
    unisonBlend: 0.75,
    unisonWidth: 1,
    unisonPhase: 0,
    unisonRandom: 0,
    unisonPhaseMode: 0,
    unisonDetuneMode: 0,
    unisonStackMode: 0,
    unisonWavetablePositionSpread: 0,
    unisonWarpSpread: 0,
    msegMorphs: [0, 0, 0]
  };
}
function Do(t) {
  const e = ko(), n = t && typeof t == "object" ? t : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: _(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: _(n.pan, e.pan, -1, 1),
    octave: x(n.octave, e.octave, -4, 4),
    semitone: x(n.semitone, e.semitone, -12, 12),
    fineCents: _(n.fineCents, e.fineCents, -100, 100),
    volumeDb: _(n.volumeDb, e.volumeDb, -48, 6),
    mute: x(n.mute, e.mute, 0, 1),
    solo: x(n.solo, e.solo, 0, 1),
    warpMode: x(n.warpMode, e.warpMode, 0, 4),
    warpAmount: _(n.warpAmount, e.warpAmount, 0, 1),
    filterMode: x(n.filterMode, e.filterMode, 0, 5),
    filterCutoff: _(n.filterCutoff, e.filterCutoff, 20, 2e4),
    filterQ: _(n.filterQ, e.filterQ, 0.1, 20),
    unisonVoices: x(n.unisonVoices, e.unisonVoices, 1, 8),
    unisonDetune: _(n.unisonDetune, e.unisonDetune, 0, 1),
    unisonBlend: _(n.unisonBlend, e.unisonBlend, 0, 1),
    unisonWidth: _(n.unisonWidth, e.unisonWidth, 0, 1),
    unisonPhase: _(n.unisonPhase, e.unisonPhase, 0, 1),
    unisonRandom: _(n.unisonRandom, e.unisonRandom, 0, 1),
    unisonPhaseMode: x(n.unisonPhaseMode, e.unisonPhaseMode, 0, 1),
    unisonDetuneMode: x(n.unisonDetuneMode, e.unisonDetuneMode, 0, 4),
    unisonStackMode: x(n.unisonStackMode, e.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: _(
      n.unisonWavetablePositionSpread,
      e.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: _(n.unisonWarpSpread, e.unisonWarpSpread, 0, 1),
    msegMorphs: [
      Ge(Number(r[0])),
      Ge(Number(r[1])),
      Ge(Number(r[2]))
    ]
  };
}
function Lo(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: _(e.amount, 0, -48, 48)
  } : null;
}
function No(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(Lo).filter((i) => i !== null) : [], r = /* @__PURE__ */ new Map();
  for (const i of n)
    r.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Do(e.parameters),
    envelopes: [0, 1, 2].map((i) => Yn(
      Array.isArray(e.envelopes) ? e.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...r.values()]
  };
}
function Co(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, r = x(n.runtimeSlot, e, 0, y - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Oo(r);
  return {
    id: i,
    runtimeSlot: r,
    name: o,
    snapshot: No(n.snapshot)
  };
}
function Po(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(r) ? {
    note: x(n.note, 0, 0, y - 1),
    articulationId: r
  } : null;
}
function Fo(t, e, n, r, i) {
  if (!t || typeof t != "object")
    return null;
  const o = t, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let s = x(o.min, i, i, y - 1), l = x(o.max, s, i, y - 1);
  return l < s && ([s, l] = [l, s]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${r}-${n}`,
    articulationId: a,
    min: s,
    max: l
  };
}
function Kt(t, e, n, r) {
  const i = Array.isArray(t) ? t : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < i.length; s += 1) {
    const l = Fo(
      i[s],
      e,
      s,
      n,
      r
    );
    !l || o.has(l.id) || (o.add(l.id), a.push(l));
  }
  return a;
}
function Uo(t, e) {
  const n = Array.isArray(t) ? t : [], r = /* @__PURE__ */ new Set(), i = [];
  for (const o of n) {
    const a = Po(o, e);
    !a || r.has(a.note) || (r.add(a.note), i.push(a));
  }
  return i;
}
function $o(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = [];
  for (let l = 0; l < n.length && o.length < y; l += 1) {
    const c = Co(n[l], l);
    !c || r.has(c.runtimeSlot) || i.has(c.id) || (r.add(c.runtimeSlot), i.add(c.id), o.push(c));
  }
  const a = typeof e.selectedSlotId == "string" && o.some((l) => l.id === e.selectedSlotId) ? e.selectedSlotId : null, s = new Set(o.map((l) => l.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: tr(e.activeTriggerMode),
    slots: o,
    chainAssignments: Kt(e.chainAssignments, s, "chain", 0),
    keyAssignments: Uo(e.keyAssignments, s),
    velocityAssignments: Kt(e.velocityAssignments, s, "velocity", 1)
  };
}
function zt(t) {
  const e = (n) => v.map(() => n);
  return {
    selectorA: t,
    enabled: !1,
    oscillatorOverrideMasks: e(0),
    sharedOverrideMask: 0,
    framePositions: e(0),
    pans: e(0),
    octaves: e(0),
    semitones: e(0),
    fineCents: e(0),
    phases: e(0),
    phaseRandoms: e(0),
    retriggers: e(1),
    volumeDbs: e(-9.542425),
    mutes: e(0),
    solos: e(0),
    warpModes: e(0),
    warpAmounts: e(0),
    filterMode: 0,
    filterCutoffHz: 1e3,
    filterQ: 0.707107,
    unisonVoices: e(1),
    unisonDetunes: e(0.1),
    unisonBlends: e(0.75),
    unisonWidths: e(1),
    unisonDetuneModes: e(0),
    unisonStackModes: e(0),
    unisonWavetablePositionSpreads: e(0),
    unisonWarpSpreads: e(0),
    msegMorphs: Array.from({ length: ge }, () => 0),
    routeAmounts: Array.from({ length: Vn }, () => 0),
    envelopeAttackSeconds: Array.from({ length: J }, (n, r) => ne(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: J }, (n, r) => ne(r).decaySeconds),
    envelopeSustain: Array.from({ length: J }, (n, r) => ne(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: J }, (n, r) => ne(r).releaseSeconds)
  };
}
function Wt(t, e, n) {
  for (const r of e) {
    const i = n.get(r.articulationId);
    if (i !== void 0)
      for (let o = r.min; o <= r.max; o += 1)
        t[o] === E && (t[o] = i);
  }
}
function Bo(t) {
  const e = $o(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), r = He(), i = He(), o = He();
  Wt(r, e.chainAssignments, n), Wt(o, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || i[a.note] !== E || (i[a.note] = s);
  }
  return o[0] = E, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: r,
    key: i,
    velocity: o
  };
}
function Vo(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Bo(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: tr(e.activeMode),
    chain: Array.from({ length: y }, (n, r) => x(e.chain?.[r], E, E, y - 1)),
    key: Array.from({ length: y }, (n, r) => x(e.key?.[r], E, E, y - 1)),
    velocity: Array.from({ length: y }, (n, r) => r === 0 ? E : x(e.velocity?.[r], E, E, y - 1))
  });
}
function Ko(t, e) {
  const n = Vo(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const re = "articulations.v4", yt = [
  "framePosition",
  "pan",
  "octave",
  "semitone",
  "fineCents",
  "phase",
  "phaseRandom",
  "retrigger",
  "volumeDb",
  "mute",
  "solo",
  "warpMode",
  "warpAmount",
  "unisonVoices",
  "unisonDetune",
  "unisonBlend",
  "unisonWidth",
  "unisonDetuneMode",
  "unisonStackMode",
  "unisonWavetablePositionSpread",
  "unisonWarpSpread"
], At = [
  "filterMode",
  "filterCutoffHz",
  "filterQ",
  "msegMorph1",
  "msegMorph2",
  "msegMorph3",
  "env1.attackSeconds",
  "env1.decaySeconds",
  "env1.sustain",
  "env1.releaseSeconds",
  "env2.attackSeconds",
  "env2.decaySeconds",
  "env2.sustain",
  "env2.releaseSeconds",
  "env3.attackSeconds",
  "env3.decaySeconds",
  "env3.sustain",
  "env3.releaseSeconds"
], zo = [
  ...v.flatMap((t) => yt.map(
    (e) => `osc${t}.${e}`
  )),
  ...At
];
class nr extends Error {
  /**
   * `reason` distinguishes the deliberate hard cut from other malformed input;
   * `detail` names the offending field or slot.
   */
  constructor(e, n) {
    super(`articulations.v4 parse failed (${e}): ${n}`), this.reason = e, this.detail = n;
  }
  _tag = "ArticulationsParseError";
}
function g(t) {
  return fe(new nr("malformed", t));
}
function Ie(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Rt(t, e, n) {
  const r = new Set(e);
  for (const i of e)
    if (!Object.hasOwn(t, i))
      return `${n} is missing field "${i}"`;
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return `${n} has a non-string field key`;
    if (!r.has(i))
      return `${n} has unexpected field "${i}"`;
  }
  return null;
}
function ke(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < y;
}
function Wo(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function jo(t) {
  return zo.some((e) => e === t);
}
function jt(t, e) {
  if (!Ie(t))
    return g(`${e} must be an object`);
  const n = Rt(t, ["min", "max"], e);
  return n !== null ? g(n) : ke(t.min) ? ke(t.max) ? t.min > t.max ? g(`${e}.min must be less than or equal to ${e}.max`) : le({ min: t.min, max: t.max }) : g(`${e}.max must be an integer in 0..127`) : g(`${e}.min must be an integer in 0..127`);
}
function Go(t, e) {
  if (!Ie(t))
    return g(`${e} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return g(`${e} has a non-string parameter id`);
    if (!jo(r))
      return g(`${e} has unknown parameter id "${r}"`);
    const i = t[r];
    if (typeof i != "number" || !Number.isFinite(i))
      return g(`${e}.${r} must be a finite number`);
    n[r] = i;
  }
  return le(n);
}
function Ho(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function qo() {
  return {};
}
function Jo(t, e, n) {
  if (!Ie(t))
    return g(`${e} must be an object`);
  const r = qo();
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return g(`${e} has a non-string route id`);
    const o = t[i];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > Vt)
      return g(
        `${e}.${i} must be a finite route amount within ±${Vt}`
      );
    if (!n.has(i))
      return g(`${e}.${i} does not name a current articulable mapping`);
    Ho(r, i, o);
  }
  return le(r);
}
function Qo(t, e, n) {
  const r = `slots[${e}]`;
  if (!Ie(t))
    return g(`${r} must be an object`);
  const i = Rt(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (i !== null)
    return g(i);
  if (typeof t.id != "string")
    return g(`${r}.id must be a string`);
  if (!ke(t.runtimeSlot))
    return g(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return g(`${r}.name must be a string`);
  if (typeof t.color != "string")
    return g(`${r}.color must be a string`);
  if (!ke(t.key))
    return g(`${r}.key must be an integer in 0..127`);
  const o = jt(t.velRange, `${r}.velRange`);
  if (o._tag === "err")
    return o;
  const a = jt(t.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = Go(t.overrides, `${r}.overrides`);
  if (s._tag === "err")
    return s;
  const l = Jo(
    t.routeAmounts,
    `${r}.routeAmounts`,
    n
  );
  return l._tag === "err" ? l : le({
    id: t.id,
    runtimeSlot: t.runtimeSlot,
    name: t.name,
    color: t.color,
    key: t.key,
    velRange: o.value,
    chainRange: a.value,
    overrides: s.value,
    routeAmounts: l.value
  });
}
const Xo = Object.fromEntries(
  yt.map((t, e) => [t, 2 ** e])
), Yo = Object.fromEntries(
  At.map((t, e) => [t, 2 ** e])
);
function Gt(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function Zo(t, e) {
  return yt.reduce((n, r) => Object.hasOwn(t.overrides, `osc${e}.${r}`) ? n | Xo[r] : n, 0);
}
function ea(t) {
  return At.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | Yo[n] : e, 0);
}
function ta(t, e) {
  const n = (o, a) => Gt(t, `osc${o}.${a}`), r = (o) => Gt(t, o), i = Array.from(
    { length: Vn },
    () => _o
  );
  for (const [o, a] of Object.entries(t.routeAmounts)) {
    const s = e[o];
    s !== void 0 && (i[s] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: v.map((o) => Zo(t, o)),
    sharedOverrideMask: ea(t),
    framePositions: v.map((o) => n(o, "framePosition")),
    pans: v.map((o) => n(o, "pan")),
    octaves: v.map((o) => n(o, "octave")),
    semitones: v.map((o) => n(o, "semitone")),
    fineCents: v.map((o) => n(o, "fineCents")),
    phases: v.map((o) => n(o, "phase")),
    phaseRandoms: v.map((o) => n(o, "phaseRandom")),
    retriggers: v.map((o) => n(o, "retrigger")),
    volumeDbs: v.map((o) => n(o, "volumeDb")),
    mutes: v.map((o) => n(o, "mute")),
    solos: v.map((o) => n(o, "solo")),
    warpModes: v.map((o) => n(o, "warpMode")),
    warpAmounts: v.map((o) => n(o, "warpAmount")),
    filterMode: r("filterMode"),
    filterCutoffHz: r("filterCutoffHz"),
    filterQ: r("filterQ"),
    unisonVoices: v.map((o) => n(o, "unisonVoices")),
    unisonDetunes: v.map((o) => n(o, "unisonDetune")),
    unisonBlends: v.map((o) => n(o, "unisonBlend")),
    unisonWidths: v.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: v.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: v.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: v.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: v.map((o) => n(o, "unisonWarpSpread")),
    msegMorphs: [
      r("msegMorph1"),
      r("msegMorph2"),
      r("msegMorph3")
    ],
    routeAmounts: i,
    envelopeAttackSeconds: [
      r("env1.attackSeconds"),
      r("env2.attackSeconds"),
      r("env3.attackSeconds")
    ],
    envelopeDecaySeconds: [
      r("env1.decaySeconds"),
      r("env2.decaySeconds"),
      r("env3.decaySeconds")
    ],
    envelopeSustain: [
      r("env1.sustain"),
      r("env2.sustain"),
      r("env3.sustain")
    ],
    envelopeReleaseSeconds: [
      r("env1.releaseSeconds"),
      r("env2.releaseSeconds"),
      r("env3.releaseSeconds")
    ]
  };
}
function rr(t, e) {
  return t.slots.map((n) => ta(n, e));
}
function na(t, e) {
  if (!Ie(t))
    return g("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return g('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return fe(new nr(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = Rt(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return g(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return g("selectedSlotId must be null or a string");
  if (!Wo(t.activeTriggerMode))
    return g('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return g("slots must be an array");
  if (t.slots.length > y)
    return g(`slots must contain at most ${y} entries`);
  const r = [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const s = Qo(t.slots[a], a, e);
    if (s._tag === "err")
      return s;
    const l = s.value;
    if (i.has(l.id))
      return g(`slots[${a}].id duplicates "${l.id}"`);
    if (o.has(l.runtimeSlot))
      return g(`slots[${a}].runtimeSlot duplicates ${l.runtimeSlot}`);
    i.add(l.id), o.add(l.runtimeSlot), r.push(l);
  }
  return t.selectedSlotId !== null && !i.has(t.selectedSlotId) ? g(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : le({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: r
  });
}
function ir() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function ra(t) {
  const e = Array.from({ length: y }, () => E), n = Array.from({ length: y }, () => E), r = Array.from({ length: y }, () => E);
  for (const i of t.slots) {
    n[i.key] === E && (n[i.key] = i.runtimeSlot);
    for (let o = i.chainRange.min; o <= i.chainRange.max; o += 1)
      e[o] === E && (e[o] = i.runtimeSlot);
    for (let o = i.velRange.min; o <= i.velRange.max; o += 1)
      r[o] === E && (r[o] = i.runtimeSlot);
  }
  return r[0] = E, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: r
  };
}
const or = 8, Tt = 5, ar = 8, ia = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), sr = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
});
function lr(t) {
  return sr[t];
}
function oa(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= Tt)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * ar + ia[t];
}
function aa(t, e) {
  const n = new Array(or).fill(0);
  return sr[t].forEach((r, i) => {
    const o = e[r];
    if (typeof o != "number" || !Number.isFinite(o))
      throw new Error(`Missing lane parameter value: ${t}.${r}`);
    n[i] = o;
  }), n;
}
const w = "lane.v1", sa = "laneTopology", Ht = "laneSlotParams", at = 16, la = 8, cr = 4, ca = 3, ur = Tt * ar, dr = 4, ua = 4, da = ur, ma = ur + dr, fa = 0, ha = 1;
function pa(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > cr)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << la;
}
const C = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), De = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
});
new Map(
  Object.entries(De).map(([t, e]) => [e, t])
);
const ga = Object.freeze({
  filter: 0,
  drive: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
});
new Map(
  C.map((t) => [ga[t], t])
);
function mr() {
  return {
    filter: !1,
    drive: !1,
    ott: !1,
    chorus: !1,
    flanger: !1,
    phaser: !1,
    delay: !1,
    reverb: !1
  };
}
function Ia(t) {
  return Object.fromEntries(
    Tn(t).parameters.map((e) => [e.endpointID, e.initial])
  );
}
function va() {
  return {
    format: "cosimo.lane",
    version: 1,
    order: [...C],
    enabled: mr(),
    params: Object.fromEntries(
      C.map((t) => [t, Ia(t)])
    )
  };
}
function Sa(t) {
  if (typeof t != "string")
    return { _tag: "json", value: t };
  if (t.trim().length === 0)
    return { _tag: "err", message: `${w} must not be empty` };
  try {
    return { _tag: "json", value: JSON.parse(t) };
  } catch (e) {
    const n = e instanceof Error ? e.message : String(e);
    return { _tag: "err", message: `${w} is not valid JSON: ${n}` };
  }
}
function be(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function ba(t) {
  return typeof t != "string" ? null : C.find((e) => e === t) ?? null;
}
function ya(t) {
  const e = Sa(t);
  if (e._tag === "err")
    return e;
  if (!be(e.value))
    return { _tag: "err", message: `${w} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled", "params"]);
  for (const s of Reflect.ownKeys(e.value))
    if (typeof s != "string" || !n.has(s))
      return { _tag: "err", message: `${w} has unexpected field ${String(s)}` };
  if (e.value.format !== "cosimo.lane" || e.value.version !== 1)
    return { _tag: "err", message: `${w} must be cosimo.lane version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== C.length)
    return { _tag: "err", message: `${w}.order must contain every effect once` };
  const r = [], i = /* @__PURE__ */ new Set();
  for (const s of e.value.order) {
    const l = ba(s);
    if (l === null || i.has(l))
      return { _tag: "err", message: `${w}.order is not a complete permutation` };
    i.add(l), r.push(l);
  }
  if (!be(e.value.enabled))
    return { _tag: "err", message: `${w}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== C.length)
    return { _tag: "err", message: `${w}.enabled must contain every effect once` };
  const o = mr();
  for (const s of C) {
    const l = e.value.enabled[s];
    if (typeof l != "boolean")
      return { _tag: "err", message: `${w}.enabled.${s} must be boolean` };
    o[s] = l;
  }
  if (!be(e.value.params))
    return { _tag: "err", message: `${w}.params must be an object` };
  if (Reflect.ownKeys(e.value.params).length !== C.length)
    return { _tag: "err", message: `${w}.params must contain every effect once` };
  const a = {};
  for (const s of C) {
    const l = e.value.params[s];
    if (!be(l))
      return { _tag: "err", message: `${w}.params.${s} must be an object` };
    const c = Tn(s).parameters;
    if (Reflect.ownKeys(l).length !== c.length)
      return { _tag: "err", message: `${w}.params.${s} must contain every parameter once` };
    const u = {};
    for (const d of c) {
      const h = l[d.endpointID];
      if (typeof h != "number" || !Number.isFinite(h))
        return { _tag: "err", message: `${w}.params.${s}.${d.endpointID} must be a finite number` };
      u[d.endpointID] = h;
    }
    a[s] = u;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.lane", version: 1, order: r, enabled: o, params: a }
  };
}
const fr = 40, hr = 18e3, st = C.map((t) => De[t]), Aa = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Ra = /^(parallel|split)#([1-9][0-9]*)$/;
function xt(t) {
  if (typeof t != "string")
    return null;
  const e = Aa.exec(t);
  if (e === null)
    return null;
  const n = st.find((i) => i === e[1]);
  if (n === void 0)
    return null;
  const r = Number(e[2]);
  return r > Tt ? null : { deviceType: n, instanceNumber: r };
}
function pr(t) {
  if (typeof t != "string")
    return null;
  const e = Ra.exec(t);
  if (e === null)
    return null;
  const n = e[1], r = Number(e[2]);
  return r > (n === "parallel" ? dr : ua) ? null : { groupKind: n, unitNumber: r };
}
function ie(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Le(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((r) => typeof r == "string" && e.includes(r));
}
function b(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function Ta(t, e) {
  const n = xt(t);
  if (n === null)
    return { failure: b(`device id ${t} is not a pool instance`) };
  if (!ie(e) || !Le(e, ["params"]) || !ie(e.params))
    return { failure: b(`device ${t} must be { params }`) };
  const r = lr(n.deviceType);
  if (Reflect.ownKeys(e.params).length !== r.length)
    return { failure: b(`device ${t} must carry every parameter once`) };
  const i = {};
  for (const o of r) {
    const a = e.params[o];
    if (typeof a != "number" || !Number.isFinite(a))
      return { failure: b(`device ${t}.${o} must be a finite number`) };
    i[o] = a;
  }
  return { record: { params: i } };
}
function xa(t, e) {
  return !ie(t) || t.kind !== "device" ? { failure: b("branches may hold device placements only") } : Le(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: b(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: b(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: b("a device placement is { kind, deviceId, enabled }") };
}
function qt(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= fr && t <= hr;
}
function Ea(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (c) {
      const u = c instanceof Error ? c.message : String(c);
      return b(`is not valid JSON: ${u}`);
    }
  if (!ie(e) || !Le(e, ["format", "version", "devices", "chain"]))
    return b("must be { format, version, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return b("must be cosimo.lane version 2");
  if (!ie(e.devices))
    return b("devices must be an object");
  if (!Array.isArray(e.chain))
    return b("chain must be an array");
  const n = {};
  for (const c of Reflect.ownKeys(e.devices)) {
    if (typeof c != "string")
      return b("device ids must be strings");
    const u = Ta(c, e.devices[c]);
    if ("failure" in u)
      return u.failure;
    n[c] = u.record;
  }
  const r = new Set(Object.keys(n)), i = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), a = [];
  let s = 0;
  const l = (c) => {
    const u = xa(c, r);
    return "placement" in u && (i.set(
      u.placement.deviceId,
      (i.get(u.placement.deviceId) ?? 0) + 1
    ), s += 1), u;
  };
  for (const c of e.chain) {
    if (!ie(c))
      return b("chain nodes must be objects");
    if (c.kind === "device") {
      const I = l(c);
      if ("failure" in I)
        return I.failure;
      a.push(I.placement);
      continue;
    }
    if (c.kind !== "parallel" && c.kind !== "split")
      return b(`unknown chain node kind ${String(c.kind)}`);
    const u = c.kind === "split", d = u ? ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"] : ["kind", "groupId", "enabled", "branches"];
    if (!Le(c, d))
      return b(`a ${c.kind} group is { ${d.join(", ")} }`);
    const h = pr(c.groupId);
    if (h === null || h.groupKind !== c.kind)
      return b(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (o.has(String(c.groupId)))
      return b(`group ${String(c.groupId)} is used twice`);
    if (o.add(String(c.groupId)), typeof c.enabled != "boolean")
      return b(`group ${String(c.groupId)} needs a boolean enable`);
    const f = u ? ca : cr;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > f)
      return b(`group ${String(c.groupId)} needs 2..${f} branches`);
    if (u && (!qt(c.xoverLowHz) || !qt(c.xoverHighHz)))
      return b(`group ${String(c.groupId)} crossovers must sit in ${fr}..${hr} Hz`);
    s += 1;
    const p = [];
    for (const I of c.branches) {
      if (!Array.isArray(I))
        return b(`group ${String(c.groupId)} branches must be arrays`);
      const D = [];
      for (const N of I) {
        const S = l(N);
        if ("failure" in S)
          return S.failure;
        D.push(S.placement);
      }
      p.push(D);
    }
    a.push(u ? {
      kind: "split",
      groupId: String(c.groupId),
      enabled: c.enabled,
      xoverLowHz: c.xoverLowHz,
      xoverHighHz: c.xoverHighHz,
      branches: p
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: p
    });
  }
  for (const c of r)
    if ((i.get(c) ?? 0) !== 1)
      return b(`device ${c} must be placed exactly once`);
  return s > at ? b(`flattens to ${s} wire entries; the topology upload holds ${at}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, devices: n, chain: a } };
}
function gr(t) {
  const e = {};
  for (const n of C) {
    const r = De[n];
    e[`${r}#1`] = {
      params: Object.fromEntries(lr(r).map((i) => [
        i,
        t.params[n][i] ?? 0
      ]))
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.order.map((n) => ({
      kind: "device",
      deviceId: `${De[n]}#1`,
      enabled: t.enabled[n]
    }))
  };
}
const Jt = ["distortion#1", "delay#1", "reverb#1"];
function Qt() {
  const t = gr(va()), e = {};
  for (const n of Jt) {
    const r = t.devices[n];
    if (r === void 0)
      throw new Error(`The v1 default is missing starter device ${n}`);
    e[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && Jt.includes(n.deviceId))
  };
}
function Ma(t) {
  if (t === void 0)
    return Qt();
  const e = Ea(t);
  if (e._tag === "ok")
    return e.value;
  const n = ya(t);
  return n._tag === "ok" ? gr(n.value) : Qt();
}
function wa(t) {
  return Object.keys(t.devices).map((e) => {
    const n = xt(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => st.indexOf(e.parsed.deviceType) - st.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function lt(t) {
  const e = xt(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return oa(e.deviceType, e.instanceNumber - 1);
}
function Ir(t) {
  const e = pr(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? da : ma) + (e.unitNumber - 1);
}
function vr(t) {
  const e = new Array(at).fill(0);
  let n = 0, r = 0;
  const i = (o, a, s) => {
    e[r] = pa(o, a), s && (n |= 1 << r), r += 1;
  };
  for (const o of t.chain) {
    if (o.kind === "device") {
      i(lt(o.deviceId), 0, o.enabled);
      continue;
    }
    i(Ir(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const l of a)
        i(lt(l.deviceId), s + 1, l.enabled);
    });
  }
  return { chainLength: r, slotIds: e, enabledMask: n };
}
function _a(t) {
  const e = new Array(or).fill(0);
  return e[fa] = t.xoverLowHz, e[ha] = t.xoverHighHz, e;
}
function Sr(t) {
  const e = [];
  let n = 0;
  for (const r of wa(t))
    n += 1, e.push({
      endpointID: Ht,
      value: {
        slotId: lt(r.instanceId),
        deliverySerial: n,
        values: aa(
          r.deviceType,
          t.devices[r.instanceId].params
        )
      }
    });
  for (const r of t.chain)
    r.kind === "split" && (n += 1, e.push({
      endpointID: Ht,
      value: {
        slotId: Ir(r),
        deliverySerial: n,
        values: _a(r)
      }
    }));
  return e.push({
    endpointID: sa,
    value: vr(t)
  }), e;
}
class Oa {
  connection;
  serviceFactories;
  services = [];
  started = !1;
  constructor(e, n) {
    this.connection = e, this.serviceFactories = n;
  }
  async start() {
    if (!this.started) {
      this.started = !0;
      try {
        for (const e of this.serviceFactories) {
          const n = typeof e == "function" ? await e(this.connection) : e;
          this.services.push(n), await n.start();
        }
      } catch (e) {
        const n = [];
        for (const r of [...this.services].reverse())
          try {
            await r.stop?.();
          } catch (i) {
            n.push(i);
          }
        throw this.services.length = 0, this.started = !1, n.length > 0 ? new AggregateError(
          [e, ...n],
          "Patch worker service startup failed and cleanup also failed"
        ) : e;
      }
    }
  }
  async stop() {
    if (this.started) {
      this.started = !1;
      for (const e of [...this.services].reverse())
        await e.stop?.();
      this.services.length = 0;
    }
  }
  getServices() {
    return [...this.services];
  }
}
function ka(t, e) {
  return new Oa(t, e);
}
async function Da(t, e) {
  const n = ka(t, e);
  return await n.start(), n;
}
const ct = "runtimeState";
function br(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const La = {
  endpointID: ct,
  required: !0,
  mapValue: br
}, Xt = "runtimeInstallAck", Na = "runtimeSyncRequest", Yt = 0, Ca = 8e3, Ne = /* @__PURE__ */ new WeakMap(), yr = 1e9;
let ye = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % yr;
function Pa(t) {
  return ye = ye % yr + 1, t === "modulation" ? -1e9 - ye : 1e9 + ye;
}
function Fa(t, e) {
  const n = t, r = Ne.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  r.add(e), Ne.set(n, r);
}
function Zt(t, e) {
  const n = t, r = Ne.get(n);
  r?.delete(e), r?.size === 0 && Ne.delete(n);
}
const Ua = [100, 250, 500, 1e3], Ae = { _tag: "accepted" }, $a = { _tag: "superseded" }, Ba = { _tag: "stopped" }, en = { _tag: "transport-timeout" };
function Va(t) {
  const e = t && typeof t == "object" && "event" in t ? t.event : t, n = e && typeof e == "object" && "value" in e ? e.value : e;
  if (!n || typeof n != "object")
    return null;
  const r = n, i = r.dspSessionId, o = r.acceptedModulationSerial, a = r.acceptedArticulationSerial, s = r.rejectedSerial, l = r.rejectionReason, c = r.syncSerial;
  return ![
    i,
    o,
    a,
    s,
    l,
    c
  ].every((d) => typeof d == "number" && Number.isSafeInteger(d) && d >= -2147483648 && d <= 2147483647) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof l != "number" || typeof c != "number" || i < 0 || o < 0 || a > 0 || l < 0 ? null : {
    dspSessionId: i,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: l,
    syncSerial: c
  };
}
function Ka(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class tn {
  #i;
  #e;
  #c;
  #u;
  #f = !1;
  #t = null;
  #a = null;
  #l = /* @__PURE__ */ new Set();
  #n = null;
  #d = 0;
  #o = /* @__PURE__ */ new Map();
  #m = 0;
  #r = !1;
  #s = 0;
  #h = /* @__PURE__ */ new Set();
  #y = this.#w.bind(this);
  constructor(e, n) {
    this.#i = e, this.#e = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((i) => Math.max(0, Math.trunc(i))).filter((i) => Number.isFinite(i));
    this.#c = r && r.length > 0 ? r : [...Ua], this.#u = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Ca)
    );
  }
  start() {
    if (!this.#r) {
      Fa(this.#i, this.#e);
      try {
        this.#m += 1, this.#r = !0, this.#a = null, this.#l.clear(), this.#i.addEndpointListener?.(Xt, this.#y);
      } catch (e) {
        throw this.#r = !1, Zt(this.#i, this.#e), e;
      }
    }
  }
  stop() {
    this.#r && (this.#r = !1, this.#i.removeEndpointListener?.(Xt, this.#y), Zt(this.#i, this.#e), this.#o.clear(), this.#a = null, this.#l.clear(), this.#b());
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    n !== this.#t && (this.#t = n, this.#a = null, this.#l.clear(), this.#n?.dspSessionId !== n && (this.#n = null), this.#o.clear(), this.#s += 1, this.#b());
  }
  getAcceptedFrontier() {
    return this.#n?.dspSessionId !== this.#t ? 0 : this.#e === "modulation" ? this.#n.acceptedModulationSerial : this.#n.acceptedArticulationSerial;
  }
  getLatestAck() {
    return this.#n ? { ...this.#n } : null;
  }
  hasSessionBaseline() {
    return this.#t !== null && this.#a === this.#t;
  }
  async waitForSessionBaseline() {
    const e = this.#t, n = this.#m;
    return this.#r ? e === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#A(e, n) : {
      _tag: "unavailable",
      reason: "not-started"
    };
  }
  async sendBatch(e) {
    if (!this.#r)
      return {
        _tag: "unavailable",
        reason: "not-started"
      };
    if (this.#f)
      return {
        _tag: "unavailable",
        reason: "batch-in-progress"
      };
    if (this.#t === null)
      return {
        _tag: "unavailable",
        reason: "no-runtime-session"
      };
    this.#f = !0;
    const n = this.#t, r = this.#m;
    try {
      const i = await this.#A(
        n,
        r
      );
      if (i._tag !== "accepted")
        return i;
      let o = null;
      for (const a of e) {
        const s = await this.#M(
          a,
          n,
          r
        );
        if (s._tag === "rejected" && this.#e === "articulation") {
          o ??= s;
          continue;
        }
        if (s._tag !== "accepted")
          return s;
      }
      return o ?? Ae;
    } finally {
      this.#f = !1;
    }
  }
  #T(e) {
    return this.#e === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #x(e, n) {
    const r = this.#T(e);
    return this.#e === "modulation" ? r >= n : r <= n;
  }
  #E() {
    const e = this.getAcceptedFrontier();
    return this.#e === "modulation" ? e + 1 : e - 1;
  }
  async #A(e, n) {
    if (this.#a === e)
      return Ae;
    const r = Pa(this.#e);
    this.#l.add(r);
    const i = Date.now() + this.#u;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#g(e, n);
        if (a)
          return a;
        if (this.#a === e)
          return Ae;
        const s = i - Date.now();
        if (s <= 0)
          return en;
        const l = this.#s;
        this.#v(r), await this.#S(
          l,
          Math.min(this.#I(o), s)
        ), o += 1;
      }
    } finally {
      this.#l.delete(r);
    }
  }
  async #M(e, n, r) {
    const i = this.#E(), o = Ka(e.value, n, i);
    let a = 0, s = 0, l = this.#d;
    for (this.#R(e.endpointID, o); ; ) {
      const c = this.#g(n, r);
      if (c)
        return c;
      const u = this.#p(n, i, l);
      if (u !== null)
        return u;
      const d = this.#s;
      await this.#S(
        d,
        this.#I(a)
      );
      const h = this.#p(
        n,
        i,
        l
      );
      if (h !== null)
        return h;
      let f = this.#s;
      for (this.#v(i); ; ) {
        const p = this.#g(n, r);
        if (p)
          return p;
        const I = await this.#S(
          f,
          this.#I(a)
        ), D = this.#p(
          n,
          i,
          l
        );
        if (D !== null)
          return D;
        if (I && this.#n?.dspSessionId === n && this.#n.syncSerial === i) {
          if (s >= 1)
            return en;
          l = this.#d, this.#R(e.endpointID, o), s += 1, a += 1;
          break;
        }
        if (I) {
          f = this.#s;
          continue;
        }
        I || (a += 1, f = this.#s, this.#v(i));
      }
    }
  }
  #p(e, n, r) {
    const i = this.#n;
    if (!i || i.dspSessionId !== e)
      return null;
    const o = this.#o.get(n);
    return o !== void 0 && o.version > r && o.acknowledgement.dspSessionId === e ? (this.#o.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#x(i, n) ? (this.#o.delete(n), Ae) : null;
  }
  #g(e, n) {
    return !this.#r || this.#m !== n ? Ba : this.#t !== e ? $a : null;
  }
  #I(e) {
    return this.#c[Math.min(
      e,
      this.#c.length - 1
    )];
  }
  #R(e, n) {
    try {
      this.#i.sendEventOrValue?.(
        e,
        n,
        void 0,
        Yt
      );
    } catch {
    }
  }
  #v(e) {
    if (this.#r)
      try {
        this.#i.sendEventOrValue?.(
          Na,
          e,
          void 0,
          Yt
        );
      } catch {
      }
  }
  #w(e) {
    const n = Va(e);
    if (!n || this.#t !== null && n.dspSessionId !== this.#t)
      return;
    if (this.#l.has(n.syncSerial) && (this.#a = n.dspSessionId), this.#n = n, this.#d += 1, this.#e === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#o.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#d
      }); this.#o.size > 16; ) {
        const i = this.#o.keys().next().value;
        if (i === void 0) break;
        this.#o.delete(i);
      }
    this.#s += 1, this.#b();
  }
  #S(e, n) {
    return !this.#r || this.#s !== e ? Promise.resolve(!0) : new Promise((r) => {
      let i = !1;
      const o = {
        finish: (a) => {
          i || (i = !0, o.timeoutHandle !== null && clearTimeout(o.timeoutHandle), this.#h.delete(o), r(a));
        },
        timeoutHandle: null
      };
      o.timeoutHandle = setTimeout(() => o.finish(!1), n), this.#h.add(o);
    });
  }
  #b() {
    for (const e of [...this.#h])
      e.finish(!0);
  }
}
const za = 1e3, qe = [te, re];
function nn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Je(t, e) {
  const n = t && typeof t == "object" ? t : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  if (nn(r, e)) return r[e];
  if (nn(n, e)) return n[e];
}
function Qe(t, e) {
  if (t === void 0) return ir();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = na(n, e);
  return r._tag === "ok" ? r.value : null;
}
function rn(t) {
  return new Set(t.routes.flatMap((e) => It(e) === null ? [] : [e.id]));
}
function on(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Wa {
  constructor(e) {
    this.connection = e, this.modulationLane = new tn(e, { laneKind: "modulation" }), this.articulationLane = new tn(e, { laneKind: "articulation" });
  }
  modulationState = ot();
  articulationBank = ir();
  hasModulationState = !1;
  hasArticulationState = !1;
  hasRuntimeState = !1;
  dspSessionId = 0;
  runtimeGeneration = 0;
  started = !1;
  lifecycleEpoch = 0;
  bootPending = !1;
  pendingBootKeys = null;
  bootEvents = [];
  deliveryInProgress = !1;
  deliveryRefreshPending = !1;
  lastAppliedModulationState = null;
  lastAppliedModulationGeneration = -1;
  lastAppliedArticulationGeneration = -1;
  lastAppliedArticulationTokens = Array.from(
    { length: y },
    () => null
  );
  recoveryTimer = null;
  lastRejectedToken = /* @__PURE__ */ new Map();
  modulationLane;
  articulationLane;
  handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  handleRuntimeStateBound = this.handleRuntimeState.bind(this);
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(ct, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(ct, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
  }
  requestBootState(e) {
    if (this.bootPending = !0, this.bootEvents.length = 0, typeof this.connection.requestFullStoredState == "function") {
      this.connection.requestFullStoredState((n) => {
        !this.started || e !== this.lifecycleEpoch || (this.applyBootState(n), this.finishBoot());
      });
      return;
    }
    if (typeof this.connection.requestStoredStateValue == "function") {
      this.pendingBootKeys = /* @__PURE__ */ new Map();
      for (const n of qe) this.connection.requestStoredStateValue(n);
      return;
    }
    this.applyBootState({}), this.finishBoot();
  }
  finishBoot() {
    const e = this.bootEvents.splice(0);
    this.bootPending = !1, this.pendingBootKeys = null;
    for (const n of e) this.applyLiveStoredState(n.key, n.value);
    this.applyRuntimeStateIfReady();
  }
  applyBootState(e) {
    const n = Je(e, te), r = n === void 0 ? { _tag: "ok", value: ot() } : $t(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${te} is invalid; boot state was not installed.`);
      const a = Je(e, re), s = Qe(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const i = Je(e, re), o = Qe(
      i,
      rn(r.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${re} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = o, this.hasArticulationState = !0;
  }
  handleStoredStateValue(e) {
    if (!this.started || !e || typeof e != "object") return;
    const n = e;
    if (!(typeof n.key != "string" || !qe.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === qe.length) {
            const r = Object.fromEntries(this.pendingBootKeys);
            this.applyBootState(r), this.finishBoot();
          }
          return;
        }
        this.bootEvents.push({ key: n.key, value: n.value });
        return;
      }
      this.applyLiveStoredState(n.key, n.value);
    }
  }
  applyLiveStoredState(e, n) {
    if (e === te) {
      const i = $t(n);
      if (i._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${te}.`);
        return;
      }
      this.modulationState = i.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = Qe(n, rn(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${re}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = br(e);
    if (this.modulationLane.observeRuntime(n), this.articulationLane.observeRuntime(n), !this.hasRuntimeState) {
      this.hasRuntimeState = !0, this.dspSessionId = n, this.applyRuntimeStateIfReady();
      return;
    }
    n !== this.dspSessionId && (this.dspSessionId = n, this.runtimeGeneration += 1, this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.applyRuntimeStateIfReady());
  }
  applyRuntimeStateIfReady() {
    if (!(!this.started || this.bootPending || !this.hasModulationState || !this.hasArticulationState || !this.hasRuntimeState)) {
      if (this.deliveryInProgress) {
        this.deliveryRefreshPending = !0;
        return;
      }
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.deliverRuntimeState().catch((e) => {
        console.error("[runtime-state-worker] Runtime delivery failed unexpectedly.", e), this.scheduleRecovery(), this.finishDelivery();
      });
    }
  }
  async deliverRuntimeState() {
    const e = this.runtimeGeneration, n = this.modulationState, r = this.articulationBank, i = this.lastAppliedModulationGeneration !== e, o = er(
      n,
      i ? null : this.lastAppliedModulationState
    ), a = await this.modulationLane.sendBatch(o);
    if (!this.acceptOutcome("modulation", a, n)) {
      this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = n, this.lastAppliedModulationGeneration = e, this.desiredStateChanged(e, n, r)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const s = this.buildUploadsBySelector(n, r), l = Array.from({ length: y }, (f, p) => {
      const I = s.get(p);
      return I ? on(I) : null;
    }), c = this.lastAppliedArticulationGeneration !== e, u = c && this.articulationLane.getAcceptedFrontier() !== 0, d = [];
    for (let f = 0; f < y; f += 1) {
      const p = s.get(f), I = l[f] !== this.lastAppliedArticulationTokens[f];
      u ? d.push({
        endpointID: We,
        value: p ?? zt(f)
      }) : c ? p && d.push({ endpointID: We, value: p }) : I && d.push({
        endpointID: We,
        value: p ?? zt(f)
      });
    }
    const h = await this.articulationLane.sendBatch(d);
    this.acceptOutcome("articulation", h, l) && (this.lastAppliedArticulationGeneration = e, this.lastAppliedArticulationTokens = l, Ko(
      ra(r),
      this.connection
    ), this.clearRecoveryTimer(), this.lastRejectedToken.clear()), this.finishDelivery();
  }
  desiredStateChanged(e, n, r) {
    return e !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const r = Object.fromEntries(e.routes.flatMap((i) => {
      const o = It(i);
      return o === null ? [] : [[i.id, o]];
    }));
    return new Map(
      rr(n, r).map((i) => [i.selectorA, i])
    );
  }
  acceptOutcome(e, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const i = on(r), o = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== i;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, i), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, za));
  }
  clearRecoveryTimer() {
    this.recoveryTimer !== null && (clearTimeout(this.recoveryTimer), this.recoveryTimer = null);
  }
  finishDelivery() {
    if (this.deliveryInProgress = !1, !this.started) return;
    const e = this.deliveryRefreshPending;
    this.deliveryRefreshPending = !1, e && this.applyRuntimeStateIfReady();
  }
}
function ja(t) {
  return new Wa(t);
}
const Ga = 2e3;
function an(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Ha(t, e) {
  const n = t && typeof t == "object" ? t : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  return an(r, e) ? {
    found: !0,
    value: r[e]
  } : an(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function sn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class qa {
  connection;
  options;
  parameterEndpointIDs;
  runtimeEndpointDependencies;
  parameterValues = /* @__PURE__ */ new Map();
  parameterListeners = /* @__PURE__ */ new Map();
  runtimeEndpointValues = /* @__PURE__ */ new Map();
  runtimeEndpointListeners = /* @__PURE__ */ new Map();
  state = null;
  deliveryInProgress = !1;
  deliveryRefreshPending = !1;
  forceFullReplay = !1;
  hasState = !1;
  started = !1;
  lastAppliedToken = null;
  lastAppliedRuntimeEndpointsToken = null;
  lastAppliedSnapshot = null;
  constructor(e, n) {
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Ja(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
  }
  start() {
    if (!this.started) {
      this.started = !0, this.connection.addStoredStateValueListener?.(this.handleStoredStateValue);
      for (const e of this.parameterEndpointIDs)
        this.connection.addParameterListener?.(e, this.getParameterListener(e)), this.connection.requestParameterValue?.(e);
      for (const e of this.runtimeEndpointDependencies)
        this.connection.addEndpointListener?.(e.endpointID, this.getRuntimeEndpointListener(e));
      this.requestStoredState();
    }
  }
  stop() {
    if (this.started) {
      this.started = !1, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValue);
      for (const e of this.parameterEndpointIDs)
        this.connection.removeParameterListener?.(e, this.getParameterListener(e));
      for (const e of this.runtimeEndpointDependencies)
        this.connection.removeEndpointListener?.(e.endpointID, this.getRuntimeEndpointListener(e));
    }
  }
  /** Rebuild and resend the complete runtime image from the stored snapshot. */
  replayFullRuntimeState() {
    this.started && (this.lastAppliedToken = null, this.lastAppliedRuntimeEndpointsToken = null, this.lastAppliedSnapshot = null, this.forceFullReplay = !0, this.applyRuntimeStateIfReady());
  }
  requestStoredState() {
    if (typeof this.connection.requestFullStoredState == "function") {
      this.connection.requestFullStoredState((e) => {
        const n = Ha(e, this.options.stateKey);
        if (n.found) {
          this.applyStoredValue(n.value);
          return;
        }
        this.options.applyDefaultRuntimeStateWhenMissing && this.applyStoredValue(void 0);
      });
      return;
    }
    if (typeof this.connection.requestStoredStateValue == "function") {
      this.connection.requestStoredStateValue(this.options.stateKey);
      return;
    }
    this.options.applyDefaultRuntimeStateWhenMissing && this.applyStoredValue(void 0);
  }
  handleStoredStateValue(e) {
    if (!e || typeof e != "object")
      return;
    const n = e;
    n.key === this.options.stateKey && (n.value === void 0 && !this.options.applyDefaultRuntimeStateWhenMissing || this.applyStoredValue(n.value));
  }
  getParameterListener(e) {
    const n = this.parameterListeners.get(e);
    if (n)
      return n;
    const r = (i) => {
      this.parameterValues.set(e, i), this.applyRuntimeStateIfReady();
    };
    return this.parameterListeners.set(e, r), r;
  }
  getRuntimeEndpointListener(e) {
    const n = this.runtimeEndpointListeners.get(e.endpointID);
    if (n)
      return n;
    const r = (i) => {
      const o = e.mapValue ? e.mapValue(i) : i;
      this.runtimeEndpointValues.set(e.endpointID, o), this.applyRuntimeStateIfReady();
    };
    return this.runtimeEndpointListeners.set(e.endpointID, r), r;
  }
  applyStoredValue(e) {
    const n = this.options.deserializeStoredState(e);
    n !== null && (this.state = n, this.hasState = !0, this.applyRuntimeStateIfReady());
  }
  applyRuntimeStateIfReady() {
    if (!this.hasState)
      return;
    if (this.deliveryInProgress) {
      this.deliveryRefreshPending = !0;
      return;
    }
    const e = {};
    for (const l of this.parameterEndpointIDs) {
      if (!this.parameterValues.has(l))
        return;
      e[l] = this.parameterValues.get(l);
    }
    const n = {};
    for (const l of this.runtimeEndpointDependencies) {
      if (!this.runtimeEndpointValues.has(l.endpointID)) {
        if (l.required)
          return;
        continue;
      }
      n[l.endpointID] = this.runtimeEndpointValues.get(l.endpointID);
    }
    const r = {
      state: this.state,
      parameters: e,
      runtimeEndpoints: n
    }, i = sn(n), o = !this.forceFullReplay && i === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(r, o), s = sn({
      runtimeEndpoints: n,
      events: a
    });
    if (s === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r;
      return;
    }
    if (a.length === 0) {
      this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(a, r).then((l) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        l ? (this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r) : this.options.onDeliveryFailure?.(a);
        const c = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, c && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        this.options.onDeliveryFailure?.(a);
        const l = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, l && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const l of a)
      this.connection.sendEventOrValue?.(
        l.endpointID,
        l.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? Ga
      );
    this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r;
  }
}
function Ja(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Qa(t, e) {
  return new qa(t, e);
}
function Xa(t) {
  return Qa(t, {
    stateKey: w,
    runtimeEndpointDependencies: [La],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Ma,
    buildRuntimeEvents: ({ state: e }) => [...Sr(e)]
  });
}
function P(t, e) {
  if (!t)
    throw new Error(e);
}
function Xe(t, e, n) {
  let r = "";
  for (let i = 0; i < n; i += 1)
    r += String.fromCharCode(t.getUint8(e + i));
  return r;
}
function Ya(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function ut(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Ar(t) {
  if (t === null)
    return "null";
  if (t === void 0)
    return "undefined";
  const e = typeof t, n = t?.constructor?.name;
  if (e !== "object")
    return n ? `${e}:${n}` : e;
  const r = Object.keys(t).slice(0, 6), i = r.length > 0 ? ` keys=${r.join(",")}` : "";
  return n ? `${e}:${n}${i}` : `${e}${i}`;
}
function Za() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Ye(t, e) {
  const n = Za();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Ya(e))
      return new URL(e);
    const r = e.startsWith("/") ? e.slice(1) : e;
    return new URL(r, n);
  }
  return new URL(t, n);
}
async function ln(t) {
  if (typeof t == "string")
    return t;
  if (t && typeof t.text == "function")
    return t.text();
  if (t instanceof ArrayBuffer)
    return typeof TextDecoder == "function" ? new TextDecoder().decode(new Uint8Array(t)) : String.fromCharCode(...new Uint8Array(t));
  if (ArrayBuffer.isView(t)) {
    const e = new Uint8Array(t.buffer, t.byteOffset, t.byteLength);
    return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
  }
  if (Array.isArray(t)) {
    const e = Uint8Array.from(t);
    return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
  }
  throw new Error(`Unsupported text resource payload (${Ar(t)})`);
}
function es(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return ut(t);
  throw new Error(`Unsupported binary resource payload (${Ar(t)})`);
}
function ts(t) {
  const e = t?.frames;
  P(
    Array.isArray(e) || ArrayBuffer.isView(e),
    "Decoded audio data must provide a frames array"
  );
  const n = Array.from(e), r = new Float32Array(n.length);
  for (let i = 0; i < n.length; i += 1) {
    const o = n[i];
    if (typeof o == "number") {
      r[i] = o;
      continue;
    }
    if (ArrayBuffer.isView(o) || Array.isArray(o)) {
      const a = o;
      P(a.length === 1, "Only mono wavetable source files are supported"), r[i] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: r
  };
}
function Rr(t) {
  const e = new DataView(t);
  P(Xe(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), P(Xe(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, i = null, o = null, a = null, s = null, l = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const d = Xe(e, c, 4), h = e.getUint32(c + 4, !0), f = c + 8;
    d === "fmt " ? (n = e.getUint16(f, !0), r = e.getUint16(f + 2, !0), i = e.getUint32(f + 4, !0), a = e.getUint16(f + 12, !0), o = e.getUint16(f + 14, !0)) : d === "data" && (s = f, l = h), c = f + h + h % 2;
  }
  P(n !== null, "Wave file is missing a fmt chunk"), P(s !== null && l !== null, "Wave file is missing a data chunk"), P(r === 1, "Only mono wavetable bank files are supported");
  let u;
  if (n === 3 && o === 32)
    u = new Float32Array(t.slice(s, s + l));
  else if (n === 1 && o === 16) {
    const d = l / 2, h = new Int16Array(t.slice(s, s + l));
    u = new Float32Array(d);
    for (let f = 0; f < d; f += 1)
      u[f] = h[f] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${o}`);
  return {
    format: n,
    channelCount: r,
    sampleRate: i ?? 0,
    bitsPerSample: o,
    blockAlign: a ?? 0,
    samples: u
  };
}
async function cn(t) {
  P(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return P(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function dt(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function Tr(t) {
  const e = new Uint8Array(t).buffer, n = Rr(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function ns(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (l) => (P(typeof t.readResource == "function", `Resource bridge cannot read ${l}`), t.readResource(l)), i = async (l) => {
    P(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${l}`);
    const c = await t.readResourceAsAudioData(l);
    return ts(c);
  }, o = (l) => {
    const c = t.getResourceAddress?.(l);
    return c ?? null;
  }, a = async (l, c = t.getResourceAddress?.(l)) => {
    const u = Ye(l, c), d = await cn(u), h = Rr(d);
    return {
      sampleRate: h.sampleRate,
      samples: h.samples
    };
  }, s = async (l, c = t.getResourceAddress?.(l)) => {
    const u = Ye(l, c);
    return new Uint8Array(await cn(u));
  };
  return {
    async readText(l) {
      if (e === "bridge" && typeof t.readResource == "function")
        return ln(await r(l));
      const c = o(l);
      return e === "url" && c !== null ? dt(await s(l, c)) : typeof t.readResource == "function" ? ln(await r(l)) : dt(await s(l, c));
    },
    async readJSON(l) {
      return JSON.parse(await this.readText(l));
    },
    async readBytes(l) {
      return typeof t.readResource == "function" ? es(await r(l)) : s(l);
    },
    async readAudio(l) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return i(l);
      const c = o(l);
      return n === "url" && c !== null ? a(l, c) : typeof t.readResourceAsAudioData == "function" ? i(l) : Tr(await this.readBytes(l));
    },
    getURL(l) {
      return Ye(l, t.getResourceAddress?.(l));
    }
  };
}
function rs(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return ns(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function is(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, r = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, i = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, o = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return dt(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (e)
        return ut(await e(a));
      if (n)
        return ut(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return i ? i(a) : Tr(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function os(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function as(t) {
  return os(t) ? is(t) : rs(t);
}
const Me = 2048;
function ue(t, e) {
  if (!t)
    throw new Error(e);
}
function ss(t) {
  ue(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, r) => {
    ue(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), ue(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), ue(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), ue(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), e;
}
const ls = 2048, xr = 11, cs = 256;
function F(t, e) {
  if (!t)
    throw new Error(e);
}
function us(t) {
  return t > 0 && (t & t - 1) === 0;
}
const un = /* @__PURE__ */ new Map();
function ds(t) {
  const e = un.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), r = new Uint32Array(t);
  for (let i = 0; i < t; i += 1) {
    let o = 0, a = i;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return un.set(t, r), r;
}
function Er(t, e, n = !1) {
  const r = t.length;
  F(r === e.length, "FFT real and imaginary buffers must have the same length"), F(us(r), "FFT input length must be a power of two");
  const i = ds(r);
  for (let o = 0; o < r; o += 1) {
    const a = i[o];
    if (a <= o)
      continue;
    const s = t[o];
    t[o] = t[a], t[a] = s;
    const l = e[o];
    e[o] = e[a], e[a] = l;
  }
  for (let o = 2; o <= r; o <<= 1) {
    const a = o >> 1, s = (n ? 2 : -2) * Math.PI / o, l = Math.cos(s), c = Math.sin(s);
    for (let u = 0; u < r; u += o) {
      let d = 1, h = 0;
      for (let f = 0; f < a; f += 1) {
        const p = u + f, I = p + a, D = t[I], N = e[I], S = d * D - h * N, A = d * N + h * D, k = t[p], L = e[p];
        t[p] = k + S, e[p] = L + A, t[I] = k - S, e[I] = L - A;
        const W = d * l - h * c;
        h = d * c + h * l, d = W;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      t[o] /= r, e[o] /= r;
}
function Mr(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const r = n / Math.max(1, e.length), i = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    i[o] = (Number(e[o]) || 0) - r;
  return i;
}
function ms(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = ls,
  maxFramesPerTable: r = cs
} = {}) {
  const i = Float32Array.from(t);
  F(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  F(o > 0, "Source wavetable files must contain at least one frame"), F(o <= r, `Source wavetable files must contain at most ${r} frames`), e !== void 0 && F(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const l = s * n, c = l + n;
    a.push(Mr(i.slice(l, c)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function dn(t) {
  const e = Mr(t), n = Float64Array.from(e), r = new Float64Array(n.length);
  return Er(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function fs(t, e, {
  mipLevelCount: n = xr
} = {}) {
  const r = t?.real?.length ?? 0;
  F(r > 0, "Spectrum must contain real samples"), F(r === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), F(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << e, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let s = 1; s <= i; s += 1) {
    o[s] = t.real[s], a[s] = t.imaginary[s];
    const l = (r - s) % r;
    l !== s && (o[l] = t.real[l], a[l] = t.imaginary[l]);
  }
  return Er(o, a, !0), Float32Array.from(o);
}
const hs = "runtimeSyncRequest", ps = 2147483647, gs = "runtimeState", Is = "retryDesiredTableRequest", vs = "workerLoadFailure", Ss = "serviceLoadAbort", bs = "wavetableLoadBegin", ys = "wavetableMipFrame", As = "wavetableUploadAck", Rs = "wavetableMipRequest", Ts = "wavetablePrewarmRequest", xs = "wavetablePrewarmNotification", Es = "assets/factory-bank-catalog.json", mt = 3, Ms = 1, ws = mt * Me, _s = 1, Os = 2, ks = 3, Ds = 1, Ls = 2, Ns = 2e4, Re = _s, Cs = Os, mn = ks, G = Ds, fn = Ls, Ps = 48 * 1024 * 1024, Ze = 3;
function hn(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function R(t, e, n = null) {
  const r = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (r) {
    if (n && Object.keys(n).length > 0) {
      r(`[wavetable-worker] ${e}`, n);
      return;
    }
    r(`[wavetable-worker] ${e}`);
  }
}
function pn(t) {
  return {
    dspSessionId: t.dspSessionId,
    oscillatorIndex: t.oscillatorIndex,
    desiredIntentSerial: t.desiredIntentSerial,
    desiredTableIndex: t.desiredTableIndex,
    generationFrontier: t.generationFrontier,
    serviceState: t.serviceState,
    active: t.hasActive ? {
      tableIndex: t.activeTableIndex,
      generation: t.activeGeneration
    } : null,
    loading: t.hasLoading ? {
      tableIndex: t.loadingTableIndex,
      generation: t.loadingGeneration
    } : null,
    failure: t.hasFailure ? {
      tableIndex: t.failedTableIndex,
      generation: t.failedGeneration,
      scope: t.failureScope,
      phase: t.failurePhase,
      reason: t.failureReasonCode
    } : null
  };
}
function gn(t, e, n) {
  const r = t + e;
  return t === 0 || r === n || r % 16 === 0;
}
function In(t, e) {
  if (!t)
    throw new Error(e);
}
function Fs(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function Us(t, e) {
  return ss(await t.readJSON(e));
}
function $s(t) {
  return {
    dspSessionId: Math.trunc(Number(t?.dspSessionId) || 0),
    oscillatorIndex: Math.trunc(Number(t?.oscillatorIndex) || 0),
    desiredIntentSerial: Math.trunc(Number(t?.desiredIntentSerial) || 0),
    desiredTableIndex: Math.trunc(Number(t?.desiredTableIndex) || 0),
    generationFrontier: Math.trunc(Number(t?.generationFrontier) || 0),
    serviceState: Math.trunc(Number(t?.serviceState) || 0),
    hasActive: !!t?.hasActive,
    activeTableIndex: Math.trunc(Number(t?.activeTableIndex) || 0),
    activeGeneration: Math.trunc(Number(t?.activeGeneration) || 0),
    hasLoading: !!t?.hasLoading,
    loadingTableIndex: Math.trunc(Number(t?.loadingTableIndex) || 0),
    loadingGeneration: Math.trunc(Number(t?.loadingGeneration) || 0),
    hasFailure: !!t?.hasFailure,
    failedTableIndex: Math.trunc(Number(t?.failedTableIndex) || 0),
    failedGeneration: Math.trunc(Number(t?.failedGeneration) || 0),
    failureScope: Math.trunc(Number(t?.failureScope) || 0),
    failurePhase: Math.trunc(Number(t?.failurePhase) || 0),
    failureReasonCode: Math.trunc(Number(t?.failureReasonCode) || 0)
  };
}
function Bs(t, e) {
  const n = Math.round(Number(t) || 0);
  return Fs(n, 0, Math.max(0, e - 1));
}
function et(t, e, n, r, i) {
  return `${t}:${e}:${n}:${r}:${i}`;
}
function Vs(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function vn(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Sn(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function bn() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Ks(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class zs {
  connection;
  resourceClient;
  catalogPath;
  maxBatchesInFlight;
  mipLevelCount;
  cacheBudgetBytes;
  serviceLoadTimeoutMs;
  setTimeoutFn;
  clearTimeoutFn;
  catalog = null;
  started = !1;
  knownSessionId = 0;
  nextLoadGenerations = [1, 1, 1];
  latestRuntimeStates = [null, null, null];
  firstRuntimeStateInSession = [!0, !0, !0];
  pendingRuntimeStateOscillators = /* @__PURE__ */ new Set();
  runtimeStateDrainRunning = !1;
  runtimeStateDrainScheduled = !1;
  serviceTable = null;
  candidateValidations = [null, null, null];
  mipJobs = /* @__PURE__ */ new Map();
  activeUploadKey = null;
  serviceLoadWatchdogHandle = null;
  autoRetryConsumedKeys = [null, null, null];
  tableCache = /* @__PURE__ */ new Map();
  tableCacheBytes = 0;
  cacheUseSerial = 1;
  constructor(e, n = {}) {
    this.connection = e, this.resourceClient = as(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Es, this.maxBatchesInFlight = hn(
      n.maxFramesInFlight,
      Ms
    ), this.mipLevelCount = n.mipLevelCount ?? xr, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Ps) || 0)), this.serviceLoadTimeoutMs = hn(n.serviceLoadTimeoutMs, Ns), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, R("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(gs, this.handleRuntimeState), this.connection.addEndpointListener?.(As, this.handleUploadAck), this.connection.addEndpointListener?.(Rs, this.handleMipRequest), this.connection.addEndpointListener?.(Ts, this.handlePrewarmRequest), this.connection.addEndpointListener?.(xs, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      hs,
      ps
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Us(this.resourceClient, this.catalogPath), R("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Ze; n += 1)
      this.nextLoadGenerations[n] = 1, this.latestRuntimeStates[n] = null, this.firstRuntimeStateInSession[n] = !0, this.candidateValidations[n] = null, this.autoRetryConsumedKeys[n] = null;
    this.nextLoadGenerations[e.oscillatorIndex] = Math.max(
      1,
      e.generationFrontier + 1
    ), this.serviceTable = null, this.mipJobs.clear(), this.activeUploadKey = null, this.cancelServiceLoadWatchdog();
  }
  clearMipTransferState() {
    this.cancelServiceLoadWatchdog(), this.mipJobs.clear(), this.activeUploadKey = null;
  }
  refreshCacheEntryByteCount(e) {
    this.tableCacheBytes -= e.byteCount, e.byteCount = vn(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
  }
  getPinnedCacheKeys() {
    const e = /* @__PURE__ */ new Set();
    return this.serviceTable?.cacheKey && e.add(this.serviceTable.cacheKey), e;
  }
  evictCacheIfNeeded() {
    if (this.cacheBudgetBytes <= 0)
      return;
    const e = this.getPinnedCacheKeys();
    for (; this.tableCacheBytes > this.cacheBudgetBytes; ) {
      let n = null, r = null;
      for (const [i, o] of this.tableCache)
        e.has(i) || (!r || o.lastUsedSerial < r.lastUsedSerial) && (n = i, r = o);
      if (!n || !r)
        return;
      this.tableCache.delete(n), this.tableCacheBytes -= r.byteCount;
    }
  }
  rememberLoadedTable(e) {
    const n = this.tableCache.get(e.cacheKey);
    if (n)
      return n.lastUsedSerial = this.cacheUseSerial++, n;
    const r = {
      ...e,
      byteCount: vn(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = et(
          this.serviceTable.dspSessionId,
          this.serviceTable.oscillatorIndex,
          this.serviceTable.generation,
          this.serviceTable.tableIndex,
          n
        );
        this.mipJobs.has(r) || this.mipJobs.set(r, {
          key: r,
          dspSessionId: this.serviceTable.dspSessionId,
          oscillatorIndex: this.serviceTable.oscillatorIndex,
          generation: this.serviceTable.generation,
          tableIndex: this.serviceTable.tableIndex,
          mipIndex: n,
          urgencyLevel: e,
          ...Sn(this.serviceTable.frameCount),
          completed: !1
        });
      }
  }
  cancelServiceLoadWatchdog() {
    this.serviceLoadWatchdogHandle !== null && (this.clearTimeoutFn?.(this.serviceLoadWatchdogHandle), this.serviceLoadWatchdogHandle = null);
  }
  serviceLoadHasPendingTransfers() {
    if (!this.serviceTable || this.serviceTable.mode !== "loading")
      return !1;
    for (const e of this.mipJobs.values())
      if (e.dspSessionId === this.serviceTable.dspSessionId && e.generation === this.serviceTable.generation && e.tableIndex === this.serviceTable.tableIndex && !e.completed && (e.inFlightBatchBases.size > 0 || e.nextFrameIndex > 0))
        return !0;
    return !1;
  }
  armServiceLoadWatchdog() {
    if (!this.setTimeoutFn || !this.serviceLoadHasPendingTransfers() || !this.serviceTable) {
      this.cancelServiceLoadWatchdog();
      return;
    }
    const { dspSessionId: e, oscillatorIndex: n, generation: r, tableIndex: i } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== r || this.serviceTable.tableIndex !== i || !this.serviceLoadHasPendingTransfers()) && (R("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: e,
        oscillatorIndex: n,
        generation: r,
        tableIndex: i,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: e,
          oscillatorIndex: n,
          generation: r,
          tableIndex: i
        },
        {
          failurePhase: mn,
          failureReasonCode: fn
        }
      ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain());
    }, this.serviceLoadTimeoutMs), this.serviceLoadWatchdogHandle?.unref?.();
  }
  resolveServiceTarget(e) {
    return e.hasLoading ? {
      kind: "loading",
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.loadingGeneration,
      tableIndex: e.loadingTableIndex
    } : e.hasActive ? {
      kind: "active",
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.activeGeneration,
      tableIndex: e.activeTableIndex
    } : null;
  }
  shouldStayIdleOnFailure(e) {
    return e.hasFailure && e.failedTableIndex === e.desiredTableIndex && e.desiredIntentSerial > 0;
  }
  getDesiredRetryKey(e) {
    return `${e.dspSessionId}:${e.oscillatorIndex}:${e.desiredTableIndex}`;
  }
  shouldAutomaticallyRetryTimeoutFailure(e) {
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== mn || e.failureReasonCode !== fn ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: r,
    generation: i = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = Re,
    failureReasonCode: s = G
  }) {
    this.connection.sendEventOrValue?.(vs, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: r,
      generation: i,
      candidateAttemptSerial: o,
      failurePhase: a,
      failureReasonCode: s
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: r,
    tableIndex: i,
    failureReasonCode: o = G
  }) {
    this.connection.sendEventOrValue?.(Ss, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: r,
      tableIndex: i,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(e) {
    R("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? pn(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(Is, e);
  }
  async loadTableSource(e, n) {
    const r = await this.ensureCatalogLoaded(), i = Bs(e, r.tables.length), o = r.tables[i];
    In(o, `Could not resolve table ${i}`);
    const a = Vs(o, Me, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, R("info", "Using cached wavetable source table", {
        tableIndex: i,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const l = bn();
    R("info", "Reading wavetable source", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const c = await this.resourceClient.readAudio(o.sourceWav), u = ms(c.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: Me
    });
    return R("info", "Prepared wavetable source table", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: u.frameCount,
      loadDurationMs: Math.round(bn() - l)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: i,
      tableMeta: o,
      frameCount: u.frameCount,
      frames: u.frames,
      spectra: new Array(u.frameCount)
    });
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.oscillatorIndex === e.oscillatorIndex && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, r) {
    R("info", "Committing desired wavetable load", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n,
      tableIndex: e.desiredTableIndex,
      tableName: r.tableMeta?.name ?? null,
      frameCount: r.frameCount
    }), this.serviceTable = {
      ...r,
      mode: "loading",
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      desiredIntentSerial: e.desiredIntentSerial
    }, this.candidateValidations[e.oscillatorIndex] = {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(bs, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: r.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    R("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: Re,
      failureReasonCode: G
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: Re,
      failureReasonCode: G
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = Re,
    failureReasonCode: r = G
  } = {}) {
    R("error", "Service wavetable load failed", {
      kind: e.kind,
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failurePhase: n,
      failureReasonCode: r
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.tableIndex,
      generation: e.generation,
      candidateAttemptSerial: 0,
      failurePhase: n,
      failureReasonCode: r
    }), e.kind === "loading" && this.emitServiceLoadAbort({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failureReasonCode: r
    });
  }
  async prepareServiceTarget(e, n) {
    if (this.isMatchingServiceTable(e)) {
      this.serviceTable && (this.serviceTable.mode = e.kind);
      const o = this.candidateValidations[e.oscillatorIndex];
      return o && o.dspSessionId === e.dspSessionId && o.generation === e.generation && o.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
    }
    let r = null;
    try {
      r = await this.loadTableSource(e.tableIndex);
    } catch (o) {
      return this.isCurrentRuntimeState(n) && (R("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: tt(o)
      }), this.handleServiceTargetFailure(e)), !1;
    }
    if (!r || !this.isCurrentRuntimeState(n))
      return !1;
    this.serviceTable = {
      ...r,
      mode: e.kind,
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.generation,
      desiredIntentSerial: n.desiredIntentSerial
    }, this.clearMipTransferState(), e.kind === "loading" && (this.createFullMipJobsForServiceTable(2), this.pumpUploads());
    const i = this.candidateValidations[e.oscillatorIndex];
    return i && i.dspSessionId === e.dspSessionId && i.generation === e.generation && i.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
  }
  async prepareDesiredLoad(e) {
    const n = e.desiredTableIndex, r = this.candidateValidations[e.oscillatorIndex];
    if (r && r.dspSessionId === e.dspSessionId && r.tableIndex === n && r.desiredIntentSerial === e.desiredIntentSerial)
      return;
    const i = Math.max(
      this.nextLoadGenerations[e.oscillatorIndex] ?? 1,
      e.generationFrontier + 1
    );
    let o = null;
    try {
      o = await this.loadTableSource(n);
    } catch (a) {
      this.isCurrentRuntimeState(e) && (R("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: tt(a)
      }), this.handleCandidateLoadFailure(e));
      return;
    }
    !o || !this.isCurrentRuntimeState(e) || this.markCommittedDesiredLoad(e, i, o);
  }
  async prepareDesiredCandidate(e) {
    await this.prepareDesiredLoad(e);
  }
  isCurrentRuntimeState(e) {
    return this.started && e.dspSessionId === this.knownSessionId && this.latestRuntimeStates[e.oscillatorIndex] === e;
  }
  selectPendingRuntimeStateOscillator() {
    if (this.serviceTable?.mode === "loading")
      return this.pendingRuntimeStateOscillators.has(this.serviceTable.oscillatorIndex) ? this.serviceTable.oscillatorIndex : null;
    for (let e = 0; e < Ze; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Ks(() => {
      this.runtimeStateDrainScheduled = !1, this.drainRuntimeStates().catch((e) => {
        console.error(e);
      });
    }));
  }
  async drainRuntimeStates() {
    if (!this.runtimeStateDrainRunning) {
      this.runtimeStateDrainRunning = !0;
      try {
        for (; this.started; ) {
          const e = this.selectPendingRuntimeStateOscillator();
          if (e === null)
            break;
          this.pendingRuntimeStateOscillators.delete(e);
          const n = this.latestRuntimeStates[e];
          if (n && (await this.reconcileRuntimeState(n), this.serviceTable?.mode === "loading"))
            break;
        }
      } finally {
        this.runtimeStateDrainRunning = !1, this.scheduleRuntimeStateDrain();
      }
    }
  }
  async reconcileRuntimeState(e) {
    if (!this.isCurrentRuntimeState(e))
      return;
    const n = e.oscillatorIndex, r = this.firstRuntimeStateInSession[n] ?? !1;
    this.firstRuntimeStateInSession[n] = !1;
    const i = this.candidateValidations[n];
    if (i && i.dspSessionId === e.dspSessionId && i.generation > e.generationFrontier)
      return;
    const o = this.resolveServiceTarget(e);
    if (o) {
      if (!await this.prepareServiceTarget(o, e) || !this.isCurrentRuntimeState(e))
        return;
      if (o.kind === "loading" && e.desiredTableIndex !== o.tableIndex && !this.shouldStayIdleOnFailure(e)) {
        R("warn", "Aborting obsolete wavetable load because the desired table changed", {
          dspSessionId: o.dspSessionId,
          oscillatorIndex: n,
          generation: o.generation,
          staleTableIndex: o.tableIndex,
          desiredTableIndex: e.desiredTableIndex,
          desiredIntentSerial: e.desiredIntentSerial
        }), this.emitServiceLoadAbort({
          dspSessionId: o.dspSessionId,
          oscillatorIndex: n,
          generation: o.generation,
          tableIndex: o.tableIndex,
          failureReasonCode: G
        }), this.serviceTable = null, this.clearMipTransferState();
        return;
      }
      o.kind === "active" && e.desiredTableIndex !== o.tableIndex && !this.shouldStayIdleOnFailure(e) && !r && await this.prepareDesiredCandidate(e);
      return;
    }
    if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(e)) {
      this.autoRetryConsumedKeys[n] = this.getDesiredRetryKey(e), this.emitRetryDesiredTableRequest(n);
      return;
    }
    e.serviceState !== 0 || this.shouldStayIdleOnFailure(e) || await this.prepareDesiredLoad(e);
  }
  handleRuntimeState(e) {
    const n = $s(e ?? {});
    if (R("info", "Received runtime state", pn(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Ze)
      return;
    const r = n.dspSessionId !== this.knownSessionId;
    r && this.resetSessionState(n);
    const i = n.oscillatorIndex, o = this.latestRuntimeStates[i], a = o ? this.getDesiredRetryKey(o) : null, s = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[i] = Math.max(
      this.nextLoadGenerations[i] ?? 1,
      n.generationFrontier + 1
    ), (r || a !== s) && (this.autoRetryConsumedKeys[i] = null), this.latestRuntimeStates[i] = n, this.pendingRuntimeStateOscillators.add(i), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, r = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(r))
      try {
        const i = await this.loadTableSource(r);
        for (let a = 0; a < i.frameCount; a += 1)
          i.spectra[a] || (i.spectra[a] = dn(i.frames[a]));
        const o = this.tableCache.get(i.cacheKey);
        o && this.refreshCacheEntryByteCount(o), R("info", "Prewarmed wavetable source table", {
          tableIndex: i.tableIndex,
          tableId: i.tableMeta.tableId,
          tableName: i.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (i) {
        R("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: r,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: tt(i)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), r = Math.trunc(Number(e?.oscillatorIndex)), i = Math.trunc(Number(e?.generation)), o = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), s = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.oscillatorIndex || i !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const l = et(
      n,
      r,
      i,
      o,
      a
    );
    let c = this.mipJobs.get(l);
    return c ? (!c.completed && s > c.urgencyLevel && (c.urgencyLevel = s), c) : (c = {
      key: l,
      dspSessionId: n,
      oscillatorIndex: r,
      generation: i,
      tableIndex: o,
      mipIndex: a,
      urgencyLevel: s,
      ...Sn(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(l, c), c);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (R("info", "Received wavetable mip request", {
      dspSessionId: n.dspSessionId,
      oscillatorIndex: n.oscillatorIndex,
      generation: n.generation,
      tableIndex: n.tableIndex,
      mipIndex: n.mipIndex,
      urgencyLevel: n.urgencyLevel,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.pumpUploads());
  }
  handleUploadAck(e) {
    const n = e ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), l = Math.trunc(Number(n.frameIndexBase)), c = Math.trunc(Number(n.frameCount)), u = et(
      r,
      i,
      o,
      a,
      s
    ), d = this.mipJobs.get(u), h = this.serviceTable?.frameCount ?? 0, f = Math.min(
      mt,
      h - l
    );
    if (!(!d || d.completed || !d.inFlightBatchBases.has(l) || c <= 0 || c !== f)) {
      d.inFlightBatchBases.delete(l);
      for (let p = 0; p < c; p += 1) {
        const I = l + p;
        d.ackedFrames[I] || (d.ackedFrames[I] = 1, d.ackedFrameCount += 1);
      }
      d.ackedFrameCount === h && d.nextFrameIndex >= h && d.inFlightBatchBases.size === 0 && (d.completed = !0, this.activeUploadKey === d.key && (this.activeUploadKey = null)), gn(l, c, h) && R("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: i,
        generation: o,
        tableIndex: d.tableIndex,
        mipIndex: s,
        frameIndexBase: l,
        batchFrameCount: c,
        ackedFrameCount: d.ackedFrameCount,
        frameCount: h,
        inFlightBatches: d.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (In(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = dn(this.serviceTable.frames[e]);
      const n = this.tableCache.get(this.serviceTable.cacheKey);
      n && this.refreshCacheEntryByteCount(n);
    }
    return this.serviceTable.spectra[e];
  }
  selectNextMipJob() {
    let e = null;
    for (const n of this.mipJobs.values())
      n.completed || (e === null || n.urgencyLevel > e.urgencyLevel) && (e = n);
    return e;
  }
  completeServiceTransferIfReady() {
    if (!this.serviceTable || this.serviceTable.mode !== "loading")
      return !1;
    for (const e of this.mipJobs.values())
      if (!e.completed)
        return !1;
    return this.cancelServiceLoadWatchdog(), this.serviceTable = null, this.mipJobs.clear(), this.activeUploadKey = null, this.scheduleRuntimeStateDrain(), !0;
  }
  pumpUploads() {
    if (!this.serviceTable)
      return;
    let e = this.activeUploadKey ? this.mipJobs.get(this.activeUploadKey) ?? null : null;
    if ((!e || e.completed) && (e = this.selectNextMipJob(), this.activeUploadKey = e?.key ?? null), !e) {
      this.completeServiceTransferIfReady();
      return;
    }
    for (; e.inFlightBatchBases.size < this.maxBatchesInFlight && e.nextFrameIndex < this.serviceTable.frameCount; ) {
      const n = e.nextFrameIndex, r = Math.min(
        mt,
        this.serviceTable.frameCount - n
      ), i = new Float32Array(ws);
      try {
        for (let o = 0; o < r; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), l = fs(s, e.mipIndex);
          i.set(l, o * Me);
        }
      } catch {
        this.handleServiceTargetFailure(
          {
            kind: this.serviceTable.mode ?? "loading",
            dspSessionId: e.dspSessionId,
            oscillatorIndex: e.oscillatorIndex,
            generation: e.generation,
            tableIndex: e.tableIndex
          },
          {
            failurePhase: Cs,
            failureReasonCode: G
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(ys, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(i)
      }), gn(n, r, this.serviceTable.frameCount) && R("info", "Sent wavetable mip batch", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        batchFrameCount: r,
        frameCount: this.serviceTable.frameCount,
        inFlightBatches: e.inFlightBatchBases.size + 1
      }), e.inFlightBatchBases.add(n), e.nextFrameIndex += r, this.armServiceLoadWatchdog();
    }
    e.ackedFrameCount === this.serviceTable.frameCount && e.nextFrameIndex >= this.serviceTable.frameCount && e.inFlightBatchBases.size === 0 && (e.completed = !0, this.activeUploadKey = null, this.pumpUploads());
  }
}
function tt(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Ws(t, e = {}) {
  return new zs(t, e);
}
function js(t, e, n) {
  if (!Number.isFinite(t.durationSec) || t.durationSec <= 0)
    throw new Error("Speedrun performance duration must be positive and finite.");
  const r = Math.max(1, Math.round(t.durationSec * n)), i = t.events.map((a) => ({
    sample: Math.max(0, Math.min(r - 1, Math.round(a.atSec * n))),
    code: Math.trunc(a.code)
  })).sort((a, s) => a.sample - s.sample || a.code - s.code), o = [];
  for (let a = 0; a < e; a += r)
    for (const s of i) {
      const l = a + s.sample;
      l < e && o.push({ sample: l, code: s.code });
    }
  return o;
}
const Te = 1600, Gs = /* @__PURE__ */ new Set([
  "runtimeState",
  "runtimeInstallAck",
  "effectiveRackState"
]);
function de(t, e, n) {
  const r = `${e}_${n}`, i = t[r];
  if (typeof i != "function")
    throw new Error(`Offline performer is missing ${r}().`);
  return i.bind(t);
}
function Hs(t) {
  return t && typeof t == "object" && "event" in t ? t.event : t;
}
function qs(t) {
  return {
    values: {
      [te]: t.modulation,
      [w]: t.lane,
      [re]: t.articulations
    }
  };
}
class Js {
  performer;
  #i;
  #e;
  #c = /* @__PURE__ */ new Map();
  #u = /* @__PURE__ */ new Map();
  #f = /* @__PURE__ */ new Map();
  #t = /* @__PURE__ */ new Map();
  #a = /* @__PURE__ */ new Map();
  #l = /* @__PURE__ */ new Map();
  #n;
  #d;
  #o = null;
  #m = null;
  #r = null;
  #s = 0;
  constructor(e, n, r) {
    this.performer = new e(), this.#n = n, this.#d = new URL("./", r), this.#i = new Map(
      this.performer.getInputEndpoints().map((i) => [i.endpointID, i])
    ), this.#e = new Map(
      this.performer.getOutputEndpoints().map((i) => [i.endpointID, i])
    );
  }
  async initialise(e, n) {
    await this.performer.initialise(e, n);
  }
  setInitialParameters(e) {
    for (const [n, r] of Object.entries(e))
      this.writeValue(n, r);
  }
  sendEventOrValue(e, n) {
    const r = this.#i.get(e);
    if (!r) throw new Error(`Offline performer has no input endpoint ${e}.`);
    if (r.endpointType === "event") {
      de(this.performer, "sendInputEvent", e)(n), this.#a.set(e, (this.#a.get(e) ?? 0) + 1);
      return;
    }
    if (r.endpointType === "value") {
      if (typeof n != "number" || !Number.isFinite(n))
        throw new Error(`Offline value endpoint ${e} requires a finite number.`);
      this.writeValue(e, n);
      return;
    }
    throw new Error(`Offline input ${e} has unsupported type ${r.endpointType}.`);
  }
  sendMIDIInputEvent(e, n) {
    this.sendEventOrValue(e, { message: n });
  }
  addEndpointListener(e, n) {
    const r = this.#c.get(e) ?? /* @__PURE__ */ new Set();
    r.add(n), this.#c.set(e, r);
  }
  removeEndpointListener(e, n) {
    this.#c.get(e)?.delete(n);
  }
  addParameterListener(e, n) {
    const r = this.#u.get(e) ?? /* @__PURE__ */ new Set();
    r.add(n), this.#u.set(e, r);
  }
  removeParameterListener(e, n) {
    this.#u.get(e)?.delete(n);
  }
  requestParameterValue(e) {
    const n = this.#f.get(e);
    if (n !== void 0)
      for (const r of this.#u.get(e) ?? []) r(n);
  }
  requestFullStoredState(e) {
    e(qs(this.#n));
  }
  getResourceAddress(e) {
    return new URL(e, this.#d);
  }
  sendNativeArticulationTriggerConfig(e) {
    this.#r = e;
  }
  getInstallationState() {
    return {
      runtimeStates: new Map(this.#t),
      runtimeInstallAck: this.#o,
      effectiveRackState: this.#m,
      articulationTriggerConfig: this.#r,
      inputEventCounts: new Map(this.#a),
      outputEventCounts: new Map(this.#l),
      advancedFrames: this.#s
    };
  }
  async pump(e) {
    let n = e;
    for (; n > 0; ) {
      const r = Math.min(128, n);
      this.advance(r), n -= r, await Promise.resolve();
    }
  }
  render(e, n, r) {
    const i = new Float32Array(e), o = new Float32Array(e);
    this.advance(e), this.performer.getOutputFrames_audioOut([i, o], e, 0);
    for (let a = 0; a < e; a += 1) {
      const s = (r + a) * 2;
      n[s] = i[a], n[s + 1] = o[a];
    }
  }
  writeValue(e, n) {
    const r = this.#i.get(e);
    if (!r || r.endpointType !== "value")
      throw new Error(`Offline performer has no value endpoint ${e}.`);
    de(
      this.performer,
      "setInputValue",
      e
    )(n, 0), this.#f.set(e, n);
    for (const i of this.#u.get(e) ?? []) i(n);
  }
  advance(e) {
    if (!Number.isInteger(e) || e < 1 || e > 128)
      throw new Error("OfflineEngineHost advances must contain 1 to 128 frames.");
    this.performer.advance(e), this.#s += e, this.drainOutputEvents();
  }
  drainOutputEvents() {
    const e = /* @__PURE__ */ new Set([
      ...Gs,
      ...this.#c.keys()
    ]);
    for (const n of e) {
      const r = this.#e.get(n);
      if (!r || r.endpointType !== "event") continue;
      const i = de(
        this.performer,
        "getOutputEventCount",
        n
      )();
      if (i < 1) continue;
      const o = de(
        this.performer,
        "getOutputEvent",
        n
      ), a = Array.from({ length: i }, (s, l) => Hs(o(l)));
      de(
        this.performer,
        "resetOutputEventCount",
        n
      )();
      for (const s of a) {
        this.#l.set(
          n,
          (this.#l.get(n) ?? 0) + 1
        ), this.recordDiagnostic(n, s);
        for (const l of this.#c.get(n) ?? []) l(s);
      }
    }
  }
  recordDiagnostic(e, n) {
    if (!n || typeof n != "object") return;
    const r = n;
    if (e === "runtimeState") {
      const i = Math.trunc(Number(r.oscillatorIndex));
      i >= 0 && i < 3 && this.#t.set(i, r);
    } else e === "runtimeInstallAck" ? this.#o = r : e === "effectiveRackState" && (this.#m = r);
  }
}
const yn = "assets/factory-bank-catalog.json";
function Qs(t) {
  return {
    async readText(e) {
      if (e !== yn) throw new Error(`Speedrun resource bundle has no text ${e}.`);
      return JSON.stringify(t.catalog);
    },
    async readJSON(e) {
      if (e !== yn) throw new Error(`Speedrun resource bundle has no JSON ${e}.`);
      return t.catalog;
    },
    async readBytes(e) {
      throw new Error(`Speedrun resource bundle does not expose undecoded bytes for ${e}.`);
    },
    async readAudio(e) {
      const n = t.audioByPath[e];
      if (!n) throw new Error(`Speedrun resource bundle has no audio ${e}.`);
      return n;
    },
    getURL() {
      return null;
    }
  };
}
const Xs = [
  "runtimeState",
  "effectiveWavetablePosition",
  "effectiveWarpState",
  "effectiveUnisonState",
  "effectiveFilterState",
  "effectiveMsegState",
  "effectiveModSourceState",
  "filterSpectrum",
  "distortionHistory",
  "distortionScope"
];
class me extends Error {
  constructor(e, n, r = {}) {
    super(`${e} install failed: ${n}`, r), this.lane = e, this.name = "SpeedrunInstallError";
  }
}
function Ys(t) {
  const e = Object.fromEntries(t.modulation.routes.flatMap((r) => {
    const i = It(r);
    return i === null ? [] : [[r.id, i]];
  })), n = Sr(t.lane);
  return {
    tableIndices: v.map((r) => Math.round(Number(t.parameters[`osc${r}WavetableSelect`]) || 0)),
    modulationFrontier: er(t.modulation, null).length,
    articulationFrontier: rr(
      t.articulations,
      e
    ).length,
    rackChainLength: vr(t.lane).chainLength,
    rackParamSerial: Math.max(0, n.length - 1)
  };
}
function Zs(t, e) {
  for (let i = 0; i < e.tableIndices.length; i += 1) {
    const o = t.runtimeStates.get(i);
    if (o && o.hasFailure && Number(o.failedTableIndex) === e.tableIndices[i])
      return new me(
        "wavetable",
        `oscillator ${i + 1} rejected table ${e.tableIndices[i]}.`
      );
  }
  const n = Math.trunc(Number(t.runtimeInstallAck?.rejectedSerial) || 0);
  if (n > 0)
    return new me("modulation", `runtime serial ${n} was rejected.`);
  if (n < 0)
    return new me("articulation", `runtime serial ${n} was rejected.`);
  const r = Math.trunc(
    Number(t.effectiveRackState?.laneRejectedUploadCount) || 0
  );
  return r > 0 ? new me("rack", `${r} topology upload(s) were rejected.`) : null;
}
function An(t, e) {
  const n = e.tableIndices.every((a, s) => {
    const l = t.runtimeStates.get(s);
    return !!l?.hasActive && Number(l?.activeTableIndex) === a;
  }), r = e.modulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedModulationSerial) >= e.modulationFrontier, i = e.articulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedArticulationSerial) <= -e.articulationFrontier, o = Number(t.effectiveRackState?.laneCommittedChainLength) === e.rackChainLength && Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) >= e.rackParamSerial;
  return n && r && i && o;
}
function el(t, e) {
  return e.tableIndices.every((n, r) => {
    const i = t.runtimeStates.get(r);
    return !!i?.hasActive && Number(i?.activeTableIndex) === n;
  }) ? e.modulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedModulationSerial) < e.modulationFrontier ? "modulation" : e.articulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedArticulationSerial) > -e.articulationFrontier ? "articulation" : "rack" : "wavetable";
}
function tl(t) {
  return `${[0, 1, 2].map((n) => {
    const r = t.runtimeStates.get(n);
    return r ? `${n}:${Number(r.activeGeneration) || 0}/${Number(r.generationFrontier) || 0} load=${Number(r.loadingGeneration) || 0} active=${!!r.hasActive}` : `${n}:missing`;
  }).join(", ")}; mod=${Number(t.runtimeInstallAck?.acceptedModulationSerial) || 0} art=${Number(t.runtimeInstallAck?.acceptedArticulationSerial) || 0} rack=${Number(t.effectiveRackState?.laneCommittedChainLength) || 0} params=${Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) || 0} mipSent=${t.inputEventCounts.get("wavetableMipFrame") ?? 0} mipAck=${t.outputEventCounts.get("wavetableUploadAck") ?? 0}`;
}
function wr(t) {
  return t >>> 16 & 255;
}
function _r(t) {
  return t >>> 8 & 127;
}
function Et(t) {
  return t & 127;
}
function nl(t, e, n) {
  if (t === null) return null;
  let r;
  try {
    r = JSON.parse(t);
  } catch {
    return null;
  }
  const i = r.activeMode, o = i === "key" ? r.key : i === "vel" ? r.velocity : r.chain;
  if (!Array.isArray(o)) return null;
  const a = i === "key" ? _r(e) : i === "vel" ? Et(e) : n % 128, s = Math.trunc(Number(o[a]));
  return s >= 0 && s <= 127 ? s : null;
}
function rl(t, e, n, r) {
  const i = wr(e);
  if ((i & 240) === 144 && Et(e) > 0) {
    const o = nl(n, e, r);
    o !== null && t.sendEventOrValue("articulationNoteMeta", {
      channel: i & 15,
      noteNumber: _r(e),
      selectorA: o,
      selectorB: 0,
      durationSamples: 0,
      ageSamples: 0
    });
  }
  t.sendMIDIInputEvent("midiIn", e);
}
async function il() {
  await new Promise((t) => setTimeout(t, 0));
}
async function ol(t, e) {
  const n = globalThis.performance?.now?.() ?? 0, r = new Js(t, {
    modulation: e.state.modulation,
    lane: e.state.lane,
    articulations: e.state.articulations
  }, e.resourceBaseURL);
  await r.initialise(e.sessionID, e.sampleRate), r.setInitialParameters(e.state.parameters), r.sendEventOrValue("tempo", { bpm: 120 });
  const i = await Da(r, [
    ja,
    Xa,
    () => Ws(r, {
      maxFramesInFlight: 1,
      serviceLoadTimeoutMs: 2e4,
      ...e.resourceBundle ? { resourceClient: Qs(e.resourceBundle) } : {}
    })
  ]), o = Ys(e.state), a = e.maxInstallFrames ?? e.sampleRate * 4;
  let s = 0;
  try {
    for (; s < a; ) {
      await r.pump(128), s += 128;
      const A = r.getInstallationState(), k = Zs(A, o);
      if (k) throw k;
      if (An(A, o)) break;
      s / 128 % 8 === 0 && await il();
    }
    const S = r.getInstallationState();
    if (!An(S, o)) {
      const A = el(S, o);
      throw new me(
        A,
        `timed out after ${s} virtual frames (${tl(S)}).`
      );
    }
  } finally {
    await i.stop();
  }
  const l = new Float32Array(e.frameCount * 2), c = js(e.performance, e.frameCount, e.sampleRate), u = r.getInstallationState().articulationTriggerConfig, d = e.recordTelemetry === !0, h = /* @__PURE__ */ new Map();
  let f = 0, p = 0, I = 0;
  const D = d ? Xs.map((S) => {
    const A = (k) => {
      const L = Math.floor(p / Te), W = h.get(L) ?? {};
      W[S] = structuredClone(k), h.set(L, W);
    };
    return r.addEndpointListener(S, A), { endpointID: S, listener: A };
  }) : [];
  try {
    for (; p < e.frameCount; ) {
      for (; f < c.length && c[f].sample === p; ) {
        const L = c[f];
        rl(r, L.code, u, I), (wr(L.code) & 240) === 144 && Et(L.code) > 0 && (I += 1), f += 1;
      }
      const S = c[f]?.sample ?? e.frameCount, A = (Math.floor(p / Te) + 1) * Te, k = Math.min(
        128,
        e.frameCount - p,
        S - p,
        ...d ? [A - p] : []
      );
      if (k < 1)
        throw new Error("Speedrun checkpoint render computed an empty advance.");
      r.render(k, l, p), p += k;
    }
  } finally {
    for (const { endpointID: S, listener: A } of D)
      r.removeEndpointListener(S, A);
  }
  const N = (globalThis.performance?.now?.() ?? n) - n;
  return {
    rootIndex: e.rootIndex,
    rootNote: e.rootNote,
    checkpointIndex: e.checkpointIndex,
    frameCount: e.frameCount,
    samples: l,
    telemetry: {
      frameCount: Math.ceil(e.frameCount / Te),
      frames: [...h.entries()].sort(([S], [A]) => S - A).map(([S, A]) => ({ frame: S, events: A }))
    },
    metrics: {
      renderedFrameCount: e.frameCount,
      installFrameCount: s,
      elapsedMilliseconds: N,
      realtimeMultiplier: N > 0 ? e.frameCount / (N * e.sampleRate / 1e3) : null
    }
  };
}
const xe = self;
function al(t) {
  return {
    name: t instanceof Error ? t.name : "Error",
    message: t instanceof Error ? t.message : String(t),
    stack: t instanceof Error ? t.stack : void 0
  };
}
xe.addEventListener("message", (t) => {
  const e = t.data;
  (async () => {
    if (e.type !== "render-root" || typeof e.engineModuleURL != "string")
      throw new Error("Speedrun checkpoint worker received an unsupported request.");
    const r = await import(new URL(e.engineModuleURL, xe.location.href).href), i = r.default ?? r.WavetableSynth, o = await ol(
      i,
      e.job
    );
    xe.postMessage({
      type: "render-root-complete",
      requestID: e.requestID,
      result: o
    }, [o.samples.buffer]);
  })().catch((n) => {
    xe.postMessage({
      type: "render-root-failed",
      requestID: e.requestID,
      error: al(n)
    }, []);
  });
});
