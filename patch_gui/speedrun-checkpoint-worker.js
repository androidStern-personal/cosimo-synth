const D = (t, e) => ({ label: t, value: e });
function $(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const K = Object.freeze({
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
  modulationIdentityEndpointID: s.modulationIdentityEndpointID,
  modulationDragStyle: s.modulationDragStyle
}), Cr = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Pr = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Fr = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: K.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      m("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(D), quick: !0 }),
      m("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      m("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      m("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: K.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      m("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [D("Classic", 0), D("Harmonics", 1)] }),
      m("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      m("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      m("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      m("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      m("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      m("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [D("Symmetric", 0), D("Asymmetric", 1), D("Wavefold", 2)] })
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: K.ott,
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
    iconUrl: K.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      m("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(D) }),
      m("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(D) }),
      m("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      m("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      m("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      m("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      m("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
        unit: "Hz",
        scale: "log",
        modulationTargetIndex: 17,
        modulationApplication: "semitones",
        modulationIdentityEndpointID: "chorusRingFineSemitones"
      })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: K.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      m("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      m("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      m("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      m("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      m("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
        unit: "ms",
        scale: "log",
        modulationTargetIndex: 36,
        modulationApplication: "octaves"
      })
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: K.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      m("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [D("Free", 0), D("Sync", 1)] }),
      m("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      m("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Cr.map(D) }),
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
    iconUrl: K.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      m("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [D("Free", 0), D("Sync", 1)] }),
      m("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      m("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Pr.map(D) }),
      m("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      m("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      m("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: K.reverb,
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
], Ce = Fr, Ln = Object.freeze(
  Ce.flatMap((t) => t.parameters)
);
new Map(
  Ln.map((t) => [t.endpointID, t])
);
function ht(t) {
  const e = Ce.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function Dn() {
  return Ln;
}
function pt(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const S = ["A", "B", "C"], Nn = [
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
], Ur = [
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
  "globalTuneSemitones",
  "ampAttack",
  "ampDecay",
  "ampSustain",
  "ampRelease"
], X = Object.freeze([
  { id: "mseg-1", sourceKind: "mseg", sourceSlot: 1, group: "voice", runtimeIndex: 0 },
  { id: "mseg-2", sourceKind: "mseg", sourceSlot: 2, group: "voice", runtimeIndex: 1 },
  { id: "mseg-3", sourceKind: "mseg", sourceSlot: 3, group: "voice", runtimeIndex: 2 },
  { id: "env-1", sourceKind: "env", sourceSlot: 1, group: "voice", runtimeIndex: 3 },
  { id: "env-2", sourceKind: "env", sourceSlot: 2, group: "voice", runtimeIndex: 4 },
  { id: "env-3", sourceKind: "env", sourceSlot: 3, group: "voice", runtimeIndex: 5 },
  { id: "amp-envelope", sourceKind: "env", sourceSlot: 4, group: "voice", runtimeIndex: 9 },
  { id: "macro-1", sourceKind: "macro", sourceSlot: 1, group: "macro", runtimeIndex: 0 },
  { id: "macro-2", sourceKind: "macro", sourceSlot: 2, group: "macro", runtimeIndex: 1 },
  { id: "macro-3", sourceKind: "macro", sourceSlot: 3, group: "macro", runtimeIndex: 2 },
  { id: "macro-4", sourceKind: "macro", sourceSlot: 4, group: "macro", runtimeIndex: 3 },
  { id: "velocity", sourceKind: "velocity", sourceSlot: null, group: "voice", runtimeIndex: 6 },
  { id: "pressure", sourceKind: "pressure", sourceSlot: null, group: "voice", runtimeIndex: 7 },
  { id: "slide", sourceKind: "slide", sourceSlot: null, group: "voice", runtimeIndex: 8 }
]), $r = Object.freeze([
  ...S.flatMap((t) => Nn.map(
    (e) => `osc${t}.${e}`
  )),
  ...Ur
]);
new Set(
  S.flatMap((t) => Nn.map(
    (e) => `osc${t}.${e}`
  ))
);
const Cn = Object.freeze(
  $r.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), Kr = Dn().filter((t) => t.modulationTargetIndex !== null), Br = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function gt(t) {
  const e = Vr(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function Vr(t) {
  const e = Br.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const Pn = Object.freeze(
  [
    ...Kr.map((t) => ({
      // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
      // and indexes are both minted only by the rack descriptor catalog.
      kind: gt(pt(t)),
      group: "rack",
      runtimeIndex: t.modulationTargetIndex
    })).sort((t, e) => t.runtimeIndex - e.runtimeIndex),
    { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
    { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
  ]
), z = Object.freeze([
  ...Cn,
  ...Pn
]), we = X.length, Fn = Cn.length, Pe = Pn.length, zr = we * z.length, Hr = new Map(X.map((t) => [t.id, t])), Un = new Map(X.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), se = new Map(z.map((t) => [t.kind, t]));
function Wr() {
  if (we !== 14 || Fn !== 56 || Pe !== 39 || zr !== 1330)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = X.filter((r) => r.group === t).sort((r, i) => r.runtimeIndex - i.runtimeIndex);
    if (n.length !== e || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 56], ["rack", 39]]) {
    const n = z.filter((r) => r.group === t);
    if (n.length !== e || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (Hr.size !== we || Un.size !== we || se.size !== z.length)
    throw new Error("Modulation identities must be unique");
}
Wr();
function $n(t, e) {
  const n = Un.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function yt(t) {
  return typeof t != "string" ? null : se.has(t) ? t : null;
}
function jr(t) {
  const e = yt(t);
  return e !== null && se.get(e)?.group === "voice" ? e : null;
}
function It(t) {
  const e = yt(t);
  return e !== null && se.get(e)?.group === "rack" ? e : null;
}
function qr(t) {
  const e = se.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function Kn(t) {
  const e = se.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function Gr(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const Bn = 4, Jr = Bn * Pe, Xr = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), Qr = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function Q(t) {
  if (typeof t != "string")
    return null;
  const e = Qr.exec(t);
  if (e === null)
    return null;
  const n = e[1], r = Xr.get(n);
  if (r === void 0)
    return null;
  const i = e[3];
  return r.includes(i) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: i
  } : null;
}
function St(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function Vn(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function zn(t) {
  if (t === null)
    return null;
  const e = Vn(t) - 1;
  return e > Bn ? null : e * Pe + Kn(St(t));
}
const V = 2048, Yr = V + 3, Kt = 20, Hn = "MSEG 1", Zr = 0, q = 2, ei = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function vt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function ae(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function ti(t) {
  return vt(Number.isFinite(t) ? t : 0, -Kt, Kt);
}
function J(t) {
  return vt(Number.isFinite(t) ? t : 0, 0, 1);
}
function Wn(t = Hn) {
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
function ni(t) {
  const e = Number(t);
  return vt(
    Number.isFinite(e) ? e : 1,
    Zr,
    q
  );
}
function ri(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = J(Number(e.startX)), r = J(Number(e.endX));
  return ae(n, r) ? null : r < n ? {
    startX: r,
    endX: n
  } : { startX: n, endX: r };
}
function ii(t = nt()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, r = Number(n.seconds), i = e.noteOffPolicy, o = ei.has(i) ? i : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: ni(Number.isFinite(r) ? r : 1)
    },
    loop: ri(e.loop),
    noteOffPolicy: o,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function oi(t, e, n) {
  const r = t && typeof t == "object" ? t : {};
  let i = Number(r.x);
  return Number.isFinite(i) || (i = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (i = J(i)), {
    x: i,
    y: J(Number(r.y)),
    curvePower: ti(Number(r.curvePower))
  };
}
function ge(t = Wn()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => oi(i, o, n.length));
  if (!ae(r[0].x, 0) || !ae(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < r.length; i += 1)
    if (r[i].x < r[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Hn,
    globalSmooth: !!e.globalSmooth,
    points: r
  };
}
function Bt(t) {
  return JSON.stringify(ge(t));
}
function ai(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, r = Math.exp(e) - 1;
  return n / r;
}
function si(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const r = t[n], i = t[n + 1];
    if (e < i.x)
      return { from: r, to: i, laterPointWins: !1 };
    if (ae(e, i.x)) {
      let o = n + 1;
      for (; o + 1 < t.length && ae(t[o + 1].x, e); )
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
function li(t, e) {
  const n = J(Number(e)), r = si(t, n);
  if (r.laterPointWins || ae(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = J(ai(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function ci(t, e) {
  return li(ge(t).points, e);
}
function ui(t) {
  const e = ge(t), n = new Float32Array(V);
  for (let i = 0; i < V; i += 1) {
    const o = i / (V - 1);
    n[i] = ci(e, o);
  }
  const r = new Float32Array(Yr);
  return r[0] = n[0], r.set(n, 1), r[V + 1] = n[V - 1], r[V + 2] = n[V - 1], r;
}
function Vt(t, e) {
  return Bt(t) === Bt(e);
}
const Ue = "modulationProgram", di = "modulationAmount", jn = X.filter((t) => t.group === "voice").length, qn = X.filter((t) => t.group === "macro").length, ke = Fn, fi = Pe, Oe = fi + Jr, G = jn * ke, Z = qn * ke, mi = jn * Oe, hi = qn * Oe, W = 512, Y = 256, Gn = G + Z;
function pi(t) {
  const e = $n(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function gi(t) {
  const e = jr(t);
  return e === null ? null : qr(e);
}
function Jn(t) {
  const e = gi(t.targetKind), n = It(t.targetKind);
  let r = n === null ? void 0 : Kn(n);
  if (r === void 0) {
    const a = zn(
      Q(t.targetKind)
    );
    a !== null && (r = a);
  }
  if (e === null && r === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = $n(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (e !== null) {
      const c = s * ke + e;
      return {
        path: "macroVoice",
        cellIndex: c,
        sourceIndex: s,
        targetIndex: e,
        articulationCellIndex: G + c
      };
    }
    const l = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * Oe + l,
      sourceIndex: s,
      targetIndex: l,
      articulationCellIndex: null
    };
  }
  const i = pi(t);
  if (e !== null) {
    const a = i * ke + e;
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
    cellIndex: i * Oe + o,
    sourceIndex: i,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function bt(t) {
  return Q(t.targetKind) !== null ? null : Jn(t).articulationCellIndex;
}
function yi(t) {
  if (It(t.targetKind) !== null)
    return !1;
  const e = Q(t.targetKind);
  return e !== null && zn(e) === null;
}
function Ii(t) {
  return {
    ...Jn(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function Xn(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (yi(n))
      continue;
    const r = Ii(n), i = e[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return e;
}
function Si(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function ee(t) {
  return [...t.values()].filter(Si).sort((e, n) => e.cellIndex - n.cellIndex);
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
  const e = Xn(t), n = ee(e.voice), r = ee(e.macroVoice), i = ee(e.voiceRack), o = ee(e.macroRack), a = Array.from({ length: G }, () => 0), s = Array.from({ length: G }, () => 0), l = Array.from({ length: G }, () => 0), c = Array.from({ length: G }, () => 0), d = Array.from({ length: G }, () => 0);
  ve(n, a, s, l, c);
  const u = Array.from({ length: Z }, () => 0), h = Array.from({ length: Z }, () => 0), f = Array.from({ length: Z }, () => 0), p = Array.from({ length: Z }, () => 0), g = Array.from({ length: Z }, () => 0);
  if (ve(
    r,
    u,
    h,
    f,
    p
  ), i.length > W || o.length > Y)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${i.length} voice-rack (max ${W}), ${o.length} macro-rack (max ${Y})`
    );
  const A = Array.from({ length: W }, () => 0), N = Array.from({ length: W }, () => 0), I = Array.from({ length: W }, () => 0), T = Array.from({ length: W }, () => 0), O = Array.from({ length: W }, () => 0), L = Array.from({ length: mi }, () => 0);
  ve(
    i,
    A,
    N,
    I,
    T
  );
  const H = Array.from({ length: Y }, () => 0), Ct = Array.from({ length: Y }, () => 0), Pt = Array.from({ length: Y }, () => 0), Ft = Array.from({ length: Y }, () => 0), Ut = Array.from({ length: hi }, () => 0);
  ve(
    o,
    H,
    Ct,
    Pt,
    Ft
  );
  for (const _ of e.voice.values()) d[_.cellIndex] = _.amount;
  for (const _ of e.macroVoice.values()) g[_.cellIndex] = _.amount;
  for (const _ of e.voiceRack.values()) L[_.cellIndex] = _.amount;
  for (const _ of e.macroRack.values()) Ut[_.cellIndex] = _.amount;
  for (let _ = 0; _ < i.length; _ += 1) {
    const $t = i[_];
    if ($t === void 0) throw new Error(`Missing compiled voice-rack route at index ${_}`);
    O[_] = $t.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: l,
    voiceRoutePolarities: c,
    voiceRouteAmounts: d,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: u,
    macroVoiceRouteSources: h,
    macroVoiceRouteTargets: f,
    macroVoiceRoutePolarities: p,
    macroVoiceRouteAmounts: g,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: A,
    voiceRackRouteSources: N,
    voiceRackRouteTargets: I,
    voiceRackRoutePolarities: T,
    voiceRackRouteReducers: O,
    voiceRackRouteAmounts: L,
    macroRackRouteCount: o.length,
    macroRackRouteCells: H,
    macroRackRouteSources: Ct,
    macroRackRouteTargets: Pt,
    macroRackRoutePolarities: Ft,
    macroRackRouteAmounts: Ut
  };
}
const vi = ["voice", "macroVoice", "voiceRack", "macroRack"], bi = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function zt(t) {
  return Xn(t);
}
function Ti(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function Ri(t, e) {
  if (t === null)
    return [{ endpointID: Ue, value: $e(e) }];
  const n = zt(t), r = zt(e), i = [];
  for (const o of vi) {
    const a = ee(n[o]), s = ee(r[o]);
    if (a.length !== s.length)
      return [{ endpointID: Ue, value: $e(e) }];
    for (let l = 0; l < s.length; l += 1) {
      const c = a[l], d = s[l];
      if (c === void 0 || d === void 0 || !Ti(c, d))
        return [{ endpointID: Ue, value: $e(e) }];
      c.amount !== d.amount && i.push({
        endpointID: di,
        value: {
          pathKind: bi[o],
          cellIndex: d.cellIndex,
          amount: d.amount
        }
      });
    }
  }
  return i;
}
function le(t) {
  return { _tag: "ok", value: t };
}
function me(t) {
  return { _tag: "err", error: t };
}
function Ai(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Ei(t) {
  throw new Error(t ?? "Invariant violated");
}
const xi = "globalTune", Mi = "globalTuneSemitones", B = -24, ce = 24, Ht = 0, Qn = -48, Yn = 48, rt = -48, Zn = 6, Tt = 0, Wt = (Tt - rt) / (Zn - rt);
function be(t, e, n, r, i = "percent", o = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const wi = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      be("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      be("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      be("mix", "Mix", 100, 100),
      be("drive", "Drive", 15, 0)
    ]
  }
], jt = 1e-6;
function U(t, e) {
  if (!Number.isFinite(t) || t < -jt || t > 1 + jt)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function Le(t, e) {
  return U(t / 100, `${e} catalog percentage`);
}
function Fe(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function _i(t) {
  return 20 * 1e3 ** t;
}
function ki(t) {
  return U(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Oi(t) {
  return 0.1 * 200 ** t;
}
function Li(t) {
  return U(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Di(t) {
  return t;
}
function Ni(t) {
  return U(t, "filterMix endpoint conversion");
}
function he(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function Ci(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: he("filterCutoff", _i, ki),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: he("filterQ", Oi, Li),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: he("filterMix", Di, Ni),
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
function er(t) {
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
      return Ai(t);
  }
}
function Pi(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Fi(t, e) {
  const n = Fe(t.moduleId, e.id), r = er(e.format), i = Ci(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: Le(e.defaultPercent, n),
    initialValue: Le(e.initialPercent, n),
    format: r,
    modAmount: Pi(r),
    binding: i.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const Ui = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Wt * 100, defaultPercent: Wt * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function $i(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ki(t, e) {
  const n = `osc${t}`, r = Fe(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: Le(e.defaultPercent, r),
    initialValue: Le(e.initialPercent, r),
    format: er(e.format),
    modAmount: $i(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Bi = Object.freeze(
  S.flatMap((t) => Ui.map((e) => Ki(t, e)))
), Vi = Object.freeze({
  targetId: Fe("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: U(
    (Ht - B) / (ce - B),
    "Global Tune default"
  ),
  initialValue: U(
    (Ht - B) / (ce - B),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: ce },
  modAmount: {
    min: Qn,
    max: Yn,
    unit: "st",
    digits: 2
  },
  binding: he(
    xi,
    (t) => B + (ce - B) * t,
    (t) => U(
      (t - B) / (ce - B),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: Mi
}), zi = Object.freeze([
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
  { moduleId: "env3", targetIdSuffix: "release", endpointID: "env3Release", targetKind: "env3Release", label: "ENV 3 Release", min: 1e-3, max: 10, initial: 0.2, format: "time", articulationParameterId: "env3.releaseSeconds" },
  { moduleId: "ampEnvelope", targetIdSuffix: "attack", endpointID: "ampAttack", targetKind: "ampAttack", label: "Amp Envelope Attack", min: 1e-3, max: 10, initial: 0.01, format: "time", articulationParameterId: null },
  { moduleId: "ampEnvelope", targetIdSuffix: "decay", endpointID: "ampDecay", targetKind: "ampDecay", label: "Amp Envelope Decay", min: 1e-3, max: 10, initial: 1e-3, format: "time", articulationParameterId: null },
  { moduleId: "ampEnvelope", targetIdSuffix: "sustain", endpointID: "ampSustain", targetKind: "ampSustain", label: "Amp Envelope Sustain", min: 0, max: 1, initial: 1, format: "percent", articulationParameterId: null },
  { moduleId: "ampEnvelope", targetIdSuffix: "release", endpointID: "ampRelease", targetKind: "ampRelease", label: "Amp Envelope Release", min: 5e-3, max: 10, initial: 0.2, format: "time", articulationParameterId: null }
]);
function Hi(t) {
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
const Wi = Object.freeze(
  zi.map(Hi)
), ji = Object.freeze([
  { suffix: "low", label: "Low Crossover", kind: "lane.frequencySplit#1.xoverLowHz" },
  { suffix: "high", label: "High Crossover", kind: "lane.frequencySplit#1.xoverHighHz" }
].map(({ suffix: t, label: e, kind: n }) => Object.freeze({
  targetId: `frequency-split.${t}`,
  moduleId: "frequency-split",
  workspace: "effects",
  label: e,
  defaultValue: 0.5,
  initialValue: 0.5,
  format: { kind: "frequency", minHz: 40, maxHz: 18e3 },
  modAmount: { min: -4, max: 4, unit: "oct", digits: 2 },
  binding: { _tag: "unbacked", reason: "no-endpoint" },
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: n
})));
function qi(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function Ke(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return U(n, `${t.endpointID} endpoint conversion`);
}
function Gi(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Ji(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Xi(t) {
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
function Qi(t) {
  const e = qi(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: Ke(t, t.initial),
    initialValue: Ke(t, t.initial),
    format: Ji(t),
    modAmount: Xi(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Gi(t, n),
      fromEngine: (n) => Ke(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : gt(pt(t))
  });
}
const Rt = Object.freeze(
  [
    ...Ce.flatMap((t) => t.parameters.map(Qi)),
    ...ji,
    Vi,
    ...Bi,
    ...Wi,
    ...wi.flatMap(
      (t) => t.parameters.map(
        (e) => Fi(t, e)
      )
    )
  ]
), Yi = new Map(
  Rt.map((t) => [t.targetId, t])
), tr = Rt.filter(
  (t) => t.modulationTargetKind !== null
), it = new Map(
  tr.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Yi.size !== Rt.length)
  throw new Error("Target descriptor IDs must be unique");
if (tr.length !== z.length || it.size !== z.length || z.some((t) => it.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function Be(t) {
  const e = it.get(t);
  return e === void 0 ? Ei(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  Ce.map((t) => [t.id, t.label])
);
function Zi(t) {
  const e = Vn(t);
  return e === 1 ? "" : ` ${e}`;
}
function eo(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const r = Be(t);
    return `${e[1]} ${r.label.toUpperCase()}`;
  }
  const n = Q(t);
  if (n !== null) {
    const r = Be(St(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${Zi(n)} ${r.label.toUpperCase()}`;
  }
  return Be(t).label.toUpperCase();
}
const te = "modulation.v6", nr = 6, Ie = 3, ne = 3, to = 4, qt = "modulationMsegBuffer", no = "modulationMsegPlayback", rr = 4, ro = ["MSEG 1", "MSEG 2", "MSEG 3"], ir = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], io = ["Env 1", "Env 2", "Env 3"], oo = 1e-3, b = 10, ao = 0.1, so = 20, lo = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: so - ao },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Qn,
    max: Yn
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
  mseg1Rate: { min: -q, max: q },
  mseg2Rate: { min: -q, max: q },
  mseg3Rate: { min: -q, max: q },
  env1Attack: { min: -b, max: b },
  env1Decay: { min: -b, max: b },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -b, max: b },
  env2Attack: { min: -b, max: b },
  env2Decay: { min: -b, max: b },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -b, max: b },
  env3Attack: { min: -b, max: b },
  env3Decay: { min: -b, max: b },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -b, max: b },
  ampAttack: { min: -b, max: b },
  ampDecay: { min: -b, max: b },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -b, max: b }
}, co = Dn().filter((t) => t.modulationTargetIndex !== null), uo = new Map(
  co.map((t) => [
    gt(pt(t)),
    t
  ])
);
class Ve extends Error {
  name = "ModulationStateParseError";
}
const fo = {
  "mseg-1": "MSEG 1",
  "mseg-2": "MSEG 2",
  "mseg-3": "MSEG 3",
  "env-1": "ENV 1",
  "env-2": "ENV 2",
  "env-3": "ENV 3",
  "amp-envelope": "AMP ENV",
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
  label: fo[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const mo = z.map((t) => ({
  value: t.kind,
  label: eo(t.kind)
}));
mo.filter((t) => !po(t.value));
function ho(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function At(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function ze(t, e) {
  const n = Number(t);
  return At(Number.isFinite(n) ? n : e, oo, b);
}
function po(t) {
  return It(t) !== null;
}
function go(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (t.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function yo(t) {
  const e = Q(t);
  return e !== null ? St(e) : t;
}
function Io(t) {
  const e = yo(t);
  if (Q(e)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = uo.get(e);
  return n !== void 0 ? go(n) : lo[Gr(e)];
}
function So(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function vo(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function bo(t, e) {
  const n = Io(t), r = Number(e);
  return At(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function To(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function Ro(t) {
  return To(t) ?? "mseg";
}
function Ao(t) {
  const e = yt(t);
  return e !== null ? e : Q(t) !== null ? t : null;
}
function Eo(t) {
  return Ao(t) ?? "oscA.wavetablePosition";
}
function xo(t, e) {
  const n = ir[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function Mo(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const r = t === "mseg" ? Ie : t === "macro" ? rr : to;
  return At(Number.isFinite(n) ? n : 1, 1, r);
}
function re(t) {
  return {
    name: io[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function or(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, r = re(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: ze(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: ze(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: J(n.sustain ?? r.sustain),
    releaseSeconds: ze(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function wo(t, e = 0) {
  return { name: or(t, e).name };
}
function _o(t, e, n, r) {
  const i = Number(t.amount);
  return {
    id: So(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: Mo(n, t.sourceSlot),
    polarity: vo(t.polarity),
    targetKind: r,
    amount: bo(r, i),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function ko(t, e = 0) {
  const r = t !== null && typeof t == "object" ? t : {}, i = Ro(r.sourceKind), o = Eo(r.targetKind);
  return _o(r, e, i, o);
}
function Oo(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function Lo(t) {
  return (Array.isArray(t) ? t : []).map((n, r) => ko(n, r));
}
function Do(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of t) {
    const i = Oo(r);
    if (e.has(r.id) || n.has(i))
      return !1;
    e.add(r.id), n.add(i);
  }
  return !0;
}
function ot(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, s) => ot(a, e[s]));
  const n = t, r = e, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => ho(r, a) && ot(n[a], r[a]));
}
function ar(t, e) {
  const n = t && typeof t == "object" ? t : {}, r = Wn(ro[e] ?? `MSEG ${e + 1}`), i = ge(n.shapeA ?? r), o = ii({
    ...nt(),
    ...n.playback ?? {},
    rate: nt().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: i,
    shapeB: ge(n.shapeB ?? i),
    playback: s
  };
}
function at() {
  return {
    format: "cosimo.modulation",
    version: nr,
    msegSlots: Array.from({ length: Ie }, (t, e) => ar({}, e)),
    envelopeSlots: Array.from({ length: ne }, (t, e) => ({
      name: re(e).name
    })),
    routes: [],
    macroNames: ir.slice()
  };
}
function No(t = at()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], r = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], i = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: nr,
    msegSlots: Array.from({ length: Ie }, (o, a) => ar(n[a], a)),
    envelopeSlots: Array.from({ length: ne }, (o, a) => wo(r[a], a)),
    routes: Lo(e.routes),
    macroNames: Array.from(
      { length: rr },
      (o, a) => xo(i[a], a)
    )
  };
}
function Gt(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return me(new Ve("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return me(new Ve("Expected valid modulation JSON"));
    }
  }
  const n = No(e);
  return !ot(e, n) || !Do(n.routes) ? me(new Ve("Expected the current modulation schema")) : le(n);
}
function Co(t, e) {
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
function Jt(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(ui(n))
  };
}
function Po(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function sr(t, e = null) {
  const n = [];
  for (let r = 0; r < Ie; r += 1) {
    const i = t.msegSlots[r], o = e?.msegSlots[r];
    (o === void 0 || !Vt(o.shapeA, i.shapeA)) && n.push({
      endpointID: qt,
      value: Jt(r, 0, i.shapeA)
    }), (o === void 0 || !Vt(o.shapeB, i.shapeB)) && n.push({
      endpointID: qt,
      value: Jt(r, 1, i.shapeB)
    }), (o === void 0 || !Po(o.playback, i.playback)) && n.push({
      endpointID: no,
      value: Co(r, i.playback)
    });
  }
  return n.push(...Ri(e?.routes ?? null, t.routes)), n;
}
const He = "articulationSnapshot", R = 128, Xt = 48, Fo = 1e6, w = -1, We = [
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
function Et(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function je(t) {
  return Et(Number.isFinite(t) ? t : 0, 0, 1);
}
function k(t, e, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const i = Number(t);
  return Et(Number.isFinite(i) ? i : e, n, r);
}
function M(t, e, n, r) {
  return Et(Math.round(k(t, e)), n, r);
}
function lr(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function qe() {
  return Array.from({ length: R }, () => w);
}
function Uo(t) {
  const e = M(t, 0, 0, R - 1), n = We[e % We.length], r = Math.floor(e / We.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function $o() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: Tt,
    mute: 0,
    solo: 0,
    warpMode: 0,
    warpAmount: 0,
    filterMode: 0,
    filterCutoff: 1e3,
    filterKeyTrackOffsetSemitones: 0,
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
function Ko(t) {
  const e = $o(), n = t && typeof t == "object" ? t : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: k(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: k(n.pan, e.pan, -1, 1),
    octave: M(n.octave, e.octave, -4, 4),
    semitone: M(n.semitone, e.semitone, -12, 12),
    fineCents: k(n.fineCents, e.fineCents, -100, 100),
    volumeDb: k(
      n.volumeDb,
      e.volumeDb,
      rt,
      Zn
    ),
    mute: M(n.mute, e.mute, 0, 1),
    solo: M(n.solo, e.solo, 0, 1),
    warpMode: M(n.warpMode, e.warpMode, 0, 4),
    warpAmount: k(n.warpAmount, e.warpAmount, 0, 1),
    filterMode: M(n.filterMode, e.filterMode, 0, 5),
    filterCutoff: k(n.filterCutoff, e.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: k(
      n.filterKeyTrackOffsetSemitones,
      e.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: k(n.filterQ, e.filterQ, 0.1, 20),
    unisonVoices: M(n.unisonVoices, e.unisonVoices, 1, 8),
    unisonDetune: k(n.unisonDetune, e.unisonDetune, 0, 1),
    unisonBlend: k(n.unisonBlend, e.unisonBlend, 0, 1),
    unisonWidth: k(n.unisonWidth, e.unisonWidth, 0, 1),
    unisonPhase: k(n.unisonPhase, e.unisonPhase, 0, 1),
    unisonRandom: k(n.unisonRandom, e.unisonRandom, 0, 1),
    unisonPhaseMode: M(n.unisonPhaseMode, e.unisonPhaseMode, 0, 1),
    unisonDetuneMode: M(n.unisonDetuneMode, e.unisonDetuneMode, 0, 4),
    unisonStackMode: M(n.unisonStackMode, e.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: k(
      n.unisonWavetablePositionSpread,
      e.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: k(n.unisonWarpSpread, e.unisonWarpSpread, 0, 1),
    msegMorphs: [
      je(Number(r[0])),
      je(Number(r[1])),
      je(Number(r[2]))
    ]
  };
}
function Bo(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: k(e.amount, 0, -48, 48)
  } : null;
}
function Vo(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(Bo).filter((i) => i !== null) : [], r = /* @__PURE__ */ new Map();
  for (const i of n)
    r.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Ko(e.parameters),
    envelopes: [0, 1, 2].map((i) => or(
      Array.isArray(e.envelopes) ? e.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...r.values()]
  };
}
function zo(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, r = M(n.runtimeSlot, e, 0, R - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Uo(r);
  return {
    id: i,
    runtimeSlot: r,
    name: o,
    snapshot: Vo(n.snapshot)
  };
}
function Ho(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(r) ? {
    note: M(n.note, 0, 0, R - 1),
    articulationId: r
  } : null;
}
function Wo(t, e, n, r, i) {
  if (!t || typeof t != "object")
    return null;
  const o = t, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let s = M(o.min, i, i, R - 1), l = M(o.max, s, i, R - 1);
  return l < s && ([s, l] = [l, s]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${r}-${n}`,
    articulationId: a,
    min: s,
    max: l
  };
}
function Qt(t, e, n, r) {
  const i = Array.isArray(t) ? t : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < i.length; s += 1) {
    const l = Wo(
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
function jo(t, e) {
  const n = Array.isArray(t) ? t : [], r = /* @__PURE__ */ new Set(), i = [];
  for (const o of n) {
    const a = Ho(o, e);
    !a || r.has(a.note) || (r.add(a.note), i.push(a));
  }
  return i;
}
function qo(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = [];
  for (let l = 0; l < n.length && o.length < R; l += 1) {
    const c = zo(n[l], l);
    !c || r.has(c.runtimeSlot) || i.has(c.id) || (r.add(c.runtimeSlot), i.add(c.id), o.push(c));
  }
  const a = typeof e.selectedSlotId == "string" && o.some((l) => l.id === e.selectedSlotId) ? e.selectedSlotId : null, s = new Set(o.map((l) => l.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: lr(e.activeTriggerMode),
    slots: o,
    chainAssignments: Qt(e.chainAssignments, s, "chain", 0),
    keyAssignments: jo(e.keyAssignments, s),
    velocityAssignments: Qt(e.velocityAssignments, s, "velocity", 1)
  };
}
function Yt(t) {
  const e = (n) => S.map(() => n);
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
    volumeDbs: e(Tt),
    mutes: e(0),
    solos: e(0),
    warpModes: e(0),
    warpAmounts: e(0),
    filterMode: 0,
    filterCutoffHz: 1e3,
    filterKeyTrackOffsetSemitones: 0,
    filterQ: 0.707107,
    unisonVoices: e(1),
    unisonDetunes: e(0.1),
    unisonBlends: e(0.75),
    unisonWidths: e(1),
    unisonDetuneModes: e(0),
    unisonStackModes: e(0),
    unisonWavetablePositionSpreads: e(0),
    unisonWarpSpreads: e(0),
    msegMorphs: Array.from({ length: Ie }, () => 0),
    routeAmounts: Array.from({ length: Gn }, () => 0),
    envelopeAttackSeconds: Array.from({ length: ne }, (n, r) => re(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: ne }, (n, r) => re(r).decaySeconds),
    envelopeSustain: Array.from({ length: ne }, (n, r) => re(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: ne }, (n, r) => re(r).releaseSeconds)
  };
}
function Zt(t, e, n) {
  for (const r of e) {
    const i = n.get(r.articulationId);
    if (i !== void 0)
      for (let o = r.min; o <= r.max; o += 1)
        t[o] === w && (t[o] = i);
  }
}
function Go(t) {
  const e = qo(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), r = qe(), i = qe(), o = qe();
  Zt(r, e.chainAssignments, n), Zt(o, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || i[a.note] !== w || (i[a.note] = s);
  }
  return o[0] = w, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: r,
    key: i,
    velocity: o
  };
}
function Jo(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Go(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: lr(e.activeMode),
    chain: Array.from({ length: R }, (n, r) => M(e.chain?.[r], w, w, R - 1)),
    key: Array.from({ length: R }, (n, r) => M(e.key?.[r], w, w, R - 1)),
    velocity: Array.from({ length: R }, (n, r) => r === 0 ? w : M(e.velocity?.[r], w, w, R - 1))
  });
}
function Xo(t, e) {
  const n = Jo(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const ie = "articulations.v4", xt = [
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
], Mt = [
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
  "env3.releaseSeconds",
  "filterKeyTrackOffsetSemitones"
], Qo = [
  ...S.flatMap((t) => xt.map(
    (e) => `osc${t}.${e}`
  )),
  ...Mt
];
class cr extends Error {
  /**
   * `reason` distinguishes the deliberate hard cut from other malformed input;
   * `detail` names the offending field or slot.
   */
  constructor(e, n) {
    super(`articulations.v4 parse failed (${e}): ${n}`), this.reason = e, this.detail = n;
  }
  _tag = "ArticulationsParseError";
}
function y(t) {
  return me(new cr("malformed", t));
}
function Se(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function wt(t, e, n) {
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
function De(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < R;
}
function Yo(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function Zo(t) {
  return Qo.some((e) => e === t);
}
function en(t, e) {
  if (!Se(t))
    return y(`${e} must be an object`);
  const n = wt(t, ["min", "max"], e);
  return n !== null ? y(n) : De(t.min) ? De(t.max) ? t.min > t.max ? y(`${e}.min must be less than or equal to ${e}.max`) : le({ min: t.min, max: t.max }) : y(`${e}.max must be an integer in 0..127`) : y(`${e}.min must be an integer in 0..127`);
}
function ea(t, e) {
  if (!Se(t))
    return y(`${e} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return y(`${e} has a non-string parameter id`);
    if (!Zo(r))
      return y(`${e} has unknown parameter id "${r}"`);
    const i = t[r];
    if (typeof i != "number" || !Number.isFinite(i))
      return y(`${e}.${r} must be a finite number`);
    n[r] = i;
  }
  return le(n);
}
function ta(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function na() {
  return {};
}
function ra(t, e, n) {
  if (!Se(t))
    return y(`${e} must be an object`);
  const r = na();
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return y(`${e} has a non-string route id`);
    const o = t[i];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > Xt)
      return y(
        `${e}.${i} must be a finite route amount within ±${Xt}`
      );
    if (!n.has(i))
      return y(`${e}.${i} does not name a current articulable mapping`);
    ta(r, i, o);
  }
  return le(r);
}
function ia(t, e, n) {
  const r = `slots[${e}]`;
  if (!Se(t))
    return y(`${r} must be an object`);
  const i = wt(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (i !== null)
    return y(i);
  if (typeof t.id != "string")
    return y(`${r}.id must be a string`);
  if (!De(t.runtimeSlot))
    return y(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return y(`${r}.name must be a string`);
  if (typeof t.color != "string")
    return y(`${r}.color must be a string`);
  if (!De(t.key))
    return y(`${r}.key must be an integer in 0..127`);
  const o = en(t.velRange, `${r}.velRange`);
  if (o._tag === "err")
    return o;
  const a = en(t.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = ea(t.overrides, `${r}.overrides`);
  if (s._tag === "err")
    return s;
  const l = ra(
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
const oa = Object.fromEntries(
  xt.map((t, e) => [t, 2 ** e])
), aa = Object.fromEntries(
  Mt.map((t, e) => [t, 2 ** e])
);
function tn(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function sa(t, e) {
  return xt.reduce((n, r) => Object.hasOwn(t.overrides, `osc${e}.${r}`) ? n | oa[r] : n, 0);
}
function la(t) {
  return Mt.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | aa[n] : e, 0);
}
function ca(t, e) {
  const n = (o, a) => tn(t, `osc${o}.${a}`), r = (o) => tn(t, o), i = Array.from(
    { length: Gn },
    () => Fo
  );
  for (const [o, a] of Object.entries(t.routeAmounts)) {
    const s = e[o];
    s !== void 0 && (i[s] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: S.map((o) => sa(t, o)),
    sharedOverrideMask: la(t),
    framePositions: S.map((o) => n(o, "framePosition")),
    pans: S.map((o) => n(o, "pan")),
    octaves: S.map((o) => n(o, "octave")),
    semitones: S.map((o) => n(o, "semitone")),
    fineCents: S.map((o) => n(o, "fineCents")),
    phases: S.map((o) => n(o, "phase")),
    phaseRandoms: S.map((o) => n(o, "phaseRandom")),
    retriggers: S.map((o) => n(o, "retrigger")),
    volumeDbs: S.map((o) => n(o, "volumeDb")),
    mutes: S.map((o) => n(o, "mute")),
    solos: S.map((o) => n(o, "solo")),
    warpModes: S.map((o) => n(o, "warpMode")),
    warpAmounts: S.map((o) => n(o, "warpAmount")),
    filterMode: r("filterMode"),
    filterCutoffHz: r("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: r("filterKeyTrackOffsetSemitones"),
    filterQ: r("filterQ"),
    unisonVoices: S.map((o) => n(o, "unisonVoices")),
    unisonDetunes: S.map((o) => n(o, "unisonDetune")),
    unisonBlends: S.map((o) => n(o, "unisonBlend")),
    unisonWidths: S.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: S.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: S.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: S.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: S.map((o) => n(o, "unisonWarpSpread")),
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
function ur(t, e) {
  return t.slots.map((n) => ca(n, e));
}
function ua(t, e) {
  if (!Se(t))
    return y("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return y('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return me(new cr(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = wt(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return y(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return y("selectedSlotId must be null or a string");
  if (!Yo(t.activeTriggerMode))
    return y('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return y("slots must be an array");
  if (t.slots.length > R)
    return y(`slots must contain at most ${R} entries`);
  const r = [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const s = ia(t.slots[a], a, e);
    if (s._tag === "err")
      return s;
    const l = s.value;
    if (i.has(l.id))
      return y(`slots[${a}].id duplicates "${l.id}"`);
    if (o.has(l.runtimeSlot))
      return y(`slots[${a}].runtimeSlot duplicates ${l.runtimeSlot}`);
    i.add(l.id), o.add(l.runtimeSlot), r.push(l);
  }
  return t.selectedSlotId !== null && !i.has(t.selectedSlotId) ? y(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : le({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: r
  });
}
function dr() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function da(t) {
  const e = Array.from({ length: R }, () => w), n = Array.from({ length: R }, () => w), r = Array.from({ length: R }, () => w);
  for (const i of t.slots) {
    n[i.key] === w && (n[i.key] = i.runtimeSlot);
    for (let o = i.chainRange.min; o <= i.chainRange.max; o += 1)
      e[o] === w && (e[o] = i.runtimeSlot);
    for (let o = i.velRange.min; o <= i.velRange.max; o += 1)
      r[o] === w && (r[o] = i.runtimeSlot);
  }
  return r[0] = w, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: r
  };
}
const fr = 12, _t = 5, mr = 8, fa = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), kt = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones"
  ],
  distortion: [
    "distortionMode",
    "distortionDriveDb",
    "distortionKnee",
    "distortionWet",
    "distortionWetHPHz",
    "distortionWetLPHz",
    "distortionType",
    "distortionWetHPKeyTrackEnabled",
    "distortionWetHPKeyTrackOffsetSemitones",
    "distortionWetLPKeyTrackEnabled",
    "distortionWetLPKeyTrackOffsetSemitones"
  ],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: [
    "chorusMix",
    "chorusMotionMode",
    "chorusBloomMode",
    "chorusTone",
    "chorusFeedback",
    "chorusRingAmount",
    "chorusRingOffsetMode",
    "chorusRingFineSemitones",
    "chorusRingFrequencyHz",
    "chorusRingKeyTrackEnabled",
    "chorusRingKeyTrackOffsetSemitones",
    "chorusRingLegacyClampEnabled"
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones"
  ],
  phaser: [
    "phaserRate",
    "phaserRateMode",
    "phaserRateDivision",
    "phaserDepth",
    "phaserFrequency",
    "phaserFeedback",
    "phaserPhase",
    "phaserMix",
    "phaserFrequencyKeyTrackEnabled",
    "phaserFrequencyKeyTrackOffsetSemitones"
  ],
  delay: [
    "delayTime",
    "delayFeedback",
    "delayFilter",
    "delayMix",
    "delayTimeMode",
    "delayDivision",
    "delayTimeKeyTrackEnabled",
    "delayTimeKeyTrackOffsetSemitones",
    "delayFilterKeyTrackEnabled",
    "delayFilterKeyTrackOffsetSemitones"
  ],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), Ot = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), ma = Object.freeze([
  "chorusMix",
  "chorusMotionMode",
  "chorusBloomMode",
  "chorusTone",
  "chorusFeedback",
  "chorusRingAmount",
  "chorusRingOffsetMode",
  "chorusRingFineSemitones",
  "chorusRingFrequencyHz",
  "chorusRingKeyTrackEnabled",
  "chorusRingKeyTrackOffsetSemitones"
]), ha = Object.freeze({
  globalFilterCutoffKeyTrackEnabled: 0,
  globalFilterCutoffKeyTrackOffsetSemitones: 0,
  distortionWetHPKeyTrackEnabled: 0,
  distortionWetHPKeyTrackOffsetSemitones: 0,
  distortionWetLPKeyTrackEnabled: 0,
  distortionWetLPKeyTrackOffsetSemitones: 0,
  chorusRingOffsetMode: 0,
  chorusRingFineSemitones: 0,
  chorusRingFrequencyHz: 28,
  chorusRingKeyTrackEnabled: 0,
  chorusRingKeyTrackOffsetSemitones: 0,
  chorusRingLegacyClampEnabled: 0,
  flangerBaseDelayMs: 0.6,
  flangerBaseDelayKeyTrackEnabled: 0,
  flangerBaseDelayKeyTrackOffsetSemitones: 0,
  phaserFrequencyKeyTrackEnabled: 0,
  phaserFrequencyKeyTrackOffsetSemitones: 0,
  delayTimeKeyTrackEnabled: 0,
  delayTimeKeyTrackOffsetSemitones: 0,
  delayFilterKeyTrackEnabled: 0,
  delayFilterKeyTrackOffsetSemitones: 0
});
function pa(t) {
  return Math.round(t) === 1 ? -5 : Math.round(t) === 2 ? 12 : Math.round(t) === 3 ? -12 : 7;
}
function Lt(t, e) {
  const n = {};
  for (const a of kt[t]) {
    const s = e[a];
    if (typeof s == "number" && Number.isFinite(s)) {
      n[a] = s;
      continue;
    }
    const l = ha[a];
    if (l === void 0)
      throw new Error(`Missing lane parameter value: ${t}.${a}`);
    n[a] = l;
  }
  const r = Ot.chorus, i = Object.keys(e);
  return t === "chorus" && i.length === r.length && i.every((a) => r.includes(a)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = pa(
    Number(e.chorusRingOffsetMode)
  ) + Number(e.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function ga(t) {
  return kt[t];
}
function ya(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= _t)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * mr + fa[t];
}
function Ia(t, e) {
  const n = new Array(fr).fill(0), r = Lt(t, e);
  return kt[t].forEach((i, o) => {
    n[o] = r[i];
  }), n;
}
const x = "lane.v1", Sa = "laneTopology", nn = "laneSlotParams", st = 16, va = 8, hr = 4, ba = 3, pr = _t * mr, gr = 4, Ta = 4, Ra = pr, Aa = pr + gr, Ea = 0, xa = 1, Ma = 2, wa = 3, _a = 4, ka = 5;
function Oa(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > hr)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << va;
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
]), ye = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), La = new Map(
  Object.entries(ye).map(([t, e]) => [e, t])
), Da = Object.freeze({
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
  C.map((t) => [Da[t], t])
);
function yr() {
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
function Na(t) {
  return Object.fromEntries(
    ht(t).parameters.map((e) => [e.endpointID, e.initial])
  );
}
function Ca() {
  return {
    format: "cosimo.lane",
    version: 1,
    order: [...C],
    enabled: yr(),
    params: Object.fromEntries(
      C.map((t) => [t, Na(t)])
    )
  };
}
function Pa(t) {
  if (typeof t != "string")
    return { _tag: "json", value: t };
  if (t.trim().length === 0)
    return { _tag: "err", message: `${x} must not be empty` };
  try {
    return { _tag: "json", value: JSON.parse(t) };
  } catch (e) {
    const n = e instanceof Error ? e.message : String(e);
    return { _tag: "err", message: `${x} is not valid JSON: ${n}` };
  }
}
function Te(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Fa(t) {
  return typeof t != "string" ? null : C.find((e) => e === t) ?? null;
}
function Ua(t) {
  const e = Pa(t);
  if (e._tag === "err")
    return e;
  if (!Te(e.value))
    return { _tag: "err", message: `${x} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled", "params"]);
  for (const s of Reflect.ownKeys(e.value))
    if (typeof s != "string" || !n.has(s))
      return { _tag: "err", message: `${x} has unexpected field ${String(s)}` };
  if (e.value.format !== "cosimo.lane" || e.value.version !== 1)
    return { _tag: "err", message: `${x} must be cosimo.lane version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== C.length)
    return { _tag: "err", message: `${x}.order must contain every effect once` };
  const r = [], i = /* @__PURE__ */ new Set();
  for (const s of e.value.order) {
    const l = Fa(s);
    if (l === null || i.has(l))
      return { _tag: "err", message: `${x}.order is not a complete permutation` };
    i.add(l), r.push(l);
  }
  if (!Te(e.value.enabled))
    return { _tag: "err", message: `${x}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== C.length)
    return { _tag: "err", message: `${x}.enabled must contain every effect once` };
  const o = yr();
  for (const s of C) {
    const l = e.value.enabled[s];
    if (typeof l != "boolean")
      return { _tag: "err", message: `${x}.enabled.${s} must be boolean` };
    o[s] = l;
  }
  if (!Te(e.value.params))
    return { _tag: "err", message: `${x}.params must be an object` };
  if (Reflect.ownKeys(e.value.params).length !== C.length)
    return { _tag: "err", message: `${x}.params must contain every effect once` };
  const a = {};
  for (const s of C) {
    const l = e.value.params[s];
    if (!Te(l))
      return { _tag: "err", message: `${x}.params.${s} must be an object` };
    const d = ht(s).parameters.map((g) => g.endpointID), u = Ot[ye[s]], h = Reflect.ownKeys(l), f = (g) => h.length === g.length && h.every((A) => typeof A == "string" && g.includes(A));
    if (!f(d) && !f(u))
      return { _tag: "err", message: `${x}.params.${s} must contain every parameter once` };
    const p = {};
    for (const g of h) {
      if (typeof g != "string")
        return { _tag: "err", message: `${x}.params.${s} has an invalid parameter key` };
      const A = l[g];
      if (typeof A != "number" || !Number.isFinite(A))
        return { _tag: "err", message: `${x}.params.${s}.${g} must be a finite number` };
      p[g] = A;
    }
    a[s] = p;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.lane", version: 1, order: r, enabled: o, params: a }
  };
}
const $a = Object.freeze([
  "voice.filterCutoff",
  "lane.globalFilterCutoff",
  "lane.distortionWetHPHz",
  "lane.distortionWetLPHz",
  "lane.delayFilter",
  "lane.delayTime",
  "lane.phaserFrequency",
  "lane.chorusRingFrequencyHz",
  "lane.flangerBaseDelayMs",
  "lane.frequencySplitLowHz",
  "lane.frequencySplitHighHz"
]), Ka = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  "lane.globalFilterCutoff": "filter-frequency",
  "lane.distortionWetHPHz": "filter-frequency",
  "lane.distortionWetLPHz": "filter-frequency",
  "lane.delayFilter": "filter-frequency",
  "lane.delayTime": "delay-period",
  "lane.phaserFrequency": "phaser-frequency",
  "lane.chorusRingFrequencyHz": "ring-frequency",
  "lane.flangerBaseDelayMs": "flanger-period",
  "lane.frequencySplitLowHz": "crossover-frequency",
  "lane.frequencySplitHighHz": "crossover-frequency"
});
new Map(
  $a.map((t) => [t, Object.freeze({
    id: t,
    family: Ka[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const Ir = 40, Sr = 18e3, lt = C.map((t) => ye[t]), Ba = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Va = /^(parallel|split)#([1-9][0-9]*)$/;
function Dt(t) {
  if (typeof t != "string")
    return null;
  const e = Ba.exec(t);
  if (e === null)
    return null;
  const n = lt.find((i) => i === e[1]);
  if (n === void 0)
    return null;
  const r = Number(e[2]);
  return r > _t ? null : { deviceType: n, instanceNumber: r };
}
function vr(t) {
  if (typeof t != "string")
    return null;
  const e = Va.exec(t);
  if (e === null)
    return null;
  const n = e[1], r = Number(e[2]);
  return r > (n === "parallel" ? gr : Ta) ? null : { groupKind: n, unitNumber: r };
}
function oe(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function pe(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((r) => typeof r == "string" && e.includes(r));
}
function v(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function za(t, e) {
  const n = Dt(t);
  if (n === null)
    return { failure: v(`device id ${t} is not a pool instance`) };
  if (!oe(e) || !pe(e, ["params"]) || !oe(e.params))
    return { failure: v(`device ${t} must be { params }`) };
  const r = ga(n.deviceType), i = Ot[n.deviceType], o = La.get(n.deviceType);
  if (o === void 0)
    return { failure: v(`device ${t} has no effect descriptor`) };
  const a = ht(o).parameters.map((u) => u.endpointID), s = e.params, l = Object.keys(s), c = (u) => l.length === u.length && l.every((h) => u.includes(h));
  if (!(c(r) || c(i) || n.deviceType === "chorus" && c(ma) || c(a)))
    return { failure: v(`device ${t} must carry every parameter once`) };
  for (const u of l) {
    const h = s[u];
    if (typeof h != "number" || !Number.isFinite(h))
      return { failure: v(`device ${t}.${u} must be a finite number`) };
  }
  return { record: { params: Lt(n.deviceType, s) } };
}
function Ha(t, e) {
  return !oe(t) || t.kind !== "device" ? { failure: v("branches may hold device placements only") } : pe(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: v(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: v(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: v("a device placement is { kind, deviceId, enabled }") };
}
function rn(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= Ir && t <= Sr;
}
function Wa(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (c) {
      const d = c instanceof Error ? c.message : String(c);
      return v(`is not valid JSON: ${d}`);
    }
  if (!oe(e) || !pe(e, ["format", "version", "devices", "chain"]))
    return v("must be { format, version, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return v("must be cosimo.lane version 2");
  if (!oe(e.devices))
    return v("devices must be an object");
  if (!Array.isArray(e.chain))
    return v("chain must be an array");
  const n = {};
  for (const c of Reflect.ownKeys(e.devices)) {
    if (typeof c != "string")
      return v("device ids must be strings");
    const d = za(c, e.devices[c]);
    if ("failure" in d)
      return d.failure;
    n[c] = d.record;
  }
  const r = new Set(Object.keys(n)), i = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), a = [];
  let s = 0;
  const l = (c) => {
    const d = Ha(c, r);
    return "placement" in d && (i.set(
      d.placement.deviceId,
      (i.get(d.placement.deviceId) ?? 0) + 1
    ), s += 1), d;
  };
  for (const c of e.chain) {
    if (!oe(c))
      return v("chain nodes must be objects");
    if (c.kind === "device") {
      const I = l(c);
      if ("failure" in I)
        return I.failure;
      a.push(I.placement);
      continue;
    }
    if (c.kind !== "parallel" && c.kind !== "split")
      return v(`unknown chain node kind ${String(c.kind)}`);
    const d = c.kind === "split", u = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], f = d ? [
      "kind",
      "groupId",
      "enabled",
      "xoverLowHz",
      "xoverHighHz",
      "xoverLowKeyTrackEnabled",
      "xoverLowKeyTrackOffsetSemitones",
      "xoverHighKeyTrackEnabled",
      "xoverHighKeyTrackOffsetSemitones",
      "branches"
    ] : ["kind", "groupId", "enabled", "branches"], p = d && pe(c, u);
    if (!pe(c, f) && !p)
      return v(`a ${c.kind} group is { ${f.join(", ")} }`);
    const g = vr(c.groupId);
    if (g === null || g.groupKind !== c.kind)
      return v(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (o.has(String(c.groupId)))
      return v(`group ${String(c.groupId)} is used twice`);
    if (o.add(String(c.groupId)), typeof c.enabled != "boolean")
      return v(`group ${String(c.groupId)} needs a boolean enable`);
    const A = d ? ba : hr;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > A)
      return v(`group ${String(c.groupId)} needs 2..${A} branches`);
    if (d && (!rn(c.xoverLowHz) || !rn(c.xoverHighHz)))
      return v(`group ${String(c.groupId)} crossovers must sit in ${Ir}..${Sr} Hz`);
    if (d && !p && (typeof c.xoverLowKeyTrackEnabled != "boolean" || typeof c.xoverHighKeyTrackEnabled != "boolean" || typeof c.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverLowKeyTrackOffsetSemitones) || typeof c.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverHighKeyTrackOffsetSemitones)))
      return v(`group ${String(c.groupId)} Key Track state must be finite`);
    s += 1;
    const N = [];
    for (const I of c.branches) {
      if (!Array.isArray(I))
        return v(`group ${String(c.groupId)} branches must be arrays`);
      const T = [];
      for (const O of I) {
        const L = l(O);
        if ("failure" in L)
          return L.failure;
        T.push(L.placement);
      }
      N.push(T);
    }
    a.push(d ? {
      kind: "split",
      groupId: String(c.groupId),
      enabled: c.enabled,
      xoverLowHz: c.xoverLowHz,
      xoverHighHz: c.xoverHighHz,
      xoverLowKeyTrackEnabled: p ? !1 : c.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: p ? 0 : c.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: p ? !1 : c.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: p ? 0 : c.xoverHighKeyTrackOffsetSemitones,
      branches: N
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: N
    });
  }
  for (const c of r)
    if ((i.get(c) ?? 0) !== 1)
      return v(`device ${c} must be placed exactly once`);
  return s > st ? v(`flattens to ${s} wire entries; the topology upload holds ${st}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, devices: n, chain: a } };
}
function br(t) {
  const e = {};
  for (const n of C) {
    const r = ye[n];
    e[`${r}#1`] = {
      params: Lt(r, t.params[n])
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.order.map((n) => ({
      kind: "device",
      deviceId: `${ye[n]}#1`,
      enabled: t.enabled[n]
    }))
  };
}
const on = ["distortion#1", "delay#1", "reverb#1"];
function an() {
  const t = br(Ca()), e = {};
  for (const n of on) {
    const r = t.devices[n];
    if (r === void 0)
      throw new Error(`The v1 default is missing starter device ${n}`);
    e[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && on.includes(n.deviceId))
  };
}
function ja(t) {
  if (t === void 0)
    return an();
  const e = Wa(t);
  if (e._tag === "ok")
    return e.value;
  const n = Ua(t);
  return n._tag === "ok" ? br(n.value) : an();
}
function qa(t) {
  return Object.keys(t.devices).map((e) => {
    const n = Dt(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => lt.indexOf(e.parsed.deviceType) - lt.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function ct(t) {
  const e = Dt(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return ya(e.deviceType, e.instanceNumber - 1);
}
function Tr(t) {
  const e = vr(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? Ra : Aa) + (e.unitNumber - 1);
}
function Rr(t) {
  const e = new Array(st).fill(0);
  let n = 0, r = 0;
  const i = (o, a, s) => {
    e[r] = Oa(o, a), s && (n |= 1 << r), r += 1;
  };
  for (const o of t.chain) {
    if (o.kind === "device") {
      i(ct(o.deviceId), 0, o.enabled);
      continue;
    }
    i(Tr(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const l of a)
        i(ct(l.deviceId), s + 1, l.enabled);
    });
  }
  return { chainLength: r, slotIds: e, enabledMask: n };
}
function Ga(t) {
  const e = new Array(fr).fill(0);
  return e[Ea] = t.xoverLowHz, e[xa] = t.xoverHighHz, e[Ma] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[wa] = t.xoverLowKeyTrackOffsetSemitones, e[_a] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[ka] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function Ar(t) {
  const e = [];
  let n = 0;
  for (const r of qa(t))
    n += 1, e.push({
      endpointID: nn,
      value: {
        slotId: ct(r.instanceId),
        deliverySerial: n,
        values: Ia(
          r.deviceType,
          t.devices[r.instanceId].params
        )
      }
    });
  for (const r of t.chain)
    r.kind === "split" && (n += 1, e.push({
      endpointID: nn,
      value: {
        slotId: Tr(r),
        deliverySerial: n,
        values: Ga(r)
      }
    }));
  return e.push({
    endpointID: Sa,
    value: Rr(t)
  }), e;
}
class Ja {
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
function Xa(t, e) {
  return new Ja(t, e);
}
async function Qa(t, e) {
  const n = Xa(t, e);
  return await n.start(), n;
}
const ut = "runtimeState";
function Er(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const Ya = {
  endpointID: ut,
  required: !0,
  mapValue: Er
}, sn = "runtimeInstallAck", Za = "runtimeSyncRequest", ln = 0, es = 8e3, Ne = /* @__PURE__ */ new WeakMap(), xr = 1e9;
let Re = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % xr;
function ts(t) {
  return Re = Re % xr + 1, t === "modulation" ? -1e9 - Re : 1e9 + Re;
}
function ns(t, e) {
  const n = t, r = Ne.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  r.add(e), Ne.set(n, r);
}
function cn(t, e) {
  const n = t, r = Ne.get(n);
  r?.delete(e), r?.size === 0 && Ne.delete(n);
}
const rs = [100, 250, 500, 1e3], Ae = { _tag: "accepted" }, is = { _tag: "superseded" }, os = { _tag: "stopped" }, un = { _tag: "transport-timeout" };
function as(t) {
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
  ].every((u) => typeof u == "number" && Number.isSafeInteger(u) && u >= -2147483648 && u <= 2147483647) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof l != "number" || typeof c != "number" || i < 0 || o < 0 || a > 0 || l < 0 ? null : {
    dspSessionId: i,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: l,
    syncSerial: c
  };
}
function ss(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class dn {
  #i;
  #e;
  #c;
  #u;
  #m = !1;
  #t = null;
  #a = null;
  #l = /* @__PURE__ */ new Set();
  #n = null;
  #d = 0;
  #o = /* @__PURE__ */ new Map();
  #f = 0;
  #r = !1;
  #s = 0;
  #h = /* @__PURE__ */ new Set();
  #b = this.#w.bind(this);
  constructor(e, n) {
    this.#i = e, this.#e = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((i) => Math.max(0, Math.trunc(i))).filter((i) => Number.isFinite(i));
    this.#c = r && r.length > 0 ? r : [...rs], this.#u = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? es)
    );
  }
  start() {
    if (!this.#r) {
      ns(this.#i, this.#e);
      try {
        this.#f += 1, this.#r = !0, this.#a = null, this.#l.clear(), this.#i.addEndpointListener?.(sn, this.#b);
      } catch (e) {
        throw this.#r = !1, cn(this.#i, this.#e), e;
      }
    }
  }
  stop() {
    this.#r && (this.#r = !1, this.#i.removeEndpointListener?.(sn, this.#b), cn(this.#i, this.#e), this.#o.clear(), this.#a = null, this.#l.clear(), this.#v());
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    n !== this.#t && (this.#t = n, this.#a = null, this.#l.clear(), this.#n?.dspSessionId !== n && (this.#n = null), this.#o.clear(), this.#s += 1, this.#v());
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
    const e = this.#t, n = this.#f;
    return this.#r ? e === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#T(e, n) : {
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
    if (this.#m)
      return {
        _tag: "unavailable",
        reason: "batch-in-progress"
      };
    if (this.#t === null)
      return {
        _tag: "unavailable",
        reason: "no-runtime-session"
      };
    this.#m = !0;
    const n = this.#t, r = this.#f;
    try {
      const i = await this.#T(
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
      this.#m = !1;
    }
  }
  #A(e) {
    return this.#e === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #E(e, n) {
    const r = this.#A(e);
    return this.#e === "modulation" ? r >= n : r <= n;
  }
  #x() {
    const e = this.getAcceptedFrontier();
    return this.#e === "modulation" ? e + 1 : e - 1;
  }
  async #T(e, n) {
    if (this.#a === e)
      return Ae;
    const r = ts(this.#e);
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
          return un;
        const l = this.#s;
        this.#I(r), await this.#S(
          l,
          Math.min(this.#y(o), s)
        ), o += 1;
      }
    } finally {
      this.#l.delete(r);
    }
  }
  async #M(e, n, r) {
    const i = this.#x(), o = ss(e.value, n, i);
    let a = 0, s = 0, l = this.#d;
    for (this.#R(e.endpointID, o); ; ) {
      const c = this.#g(n, r);
      if (c)
        return c;
      const d = this.#p(n, i, l);
      if (d !== null)
        return d;
      const u = this.#s;
      await this.#S(
        u,
        this.#y(a)
      );
      const h = this.#p(
        n,
        i,
        l
      );
      if (h !== null)
        return h;
      let f = this.#s;
      for (this.#I(i); ; ) {
        const p = this.#g(n, r);
        if (p)
          return p;
        const g = await this.#S(
          f,
          this.#y(a)
        ), A = this.#p(
          n,
          i,
          l
        );
        if (A !== null)
          return A;
        if (g && this.#n?.dspSessionId === n && this.#n.syncSerial === i) {
          if (s >= 1)
            return un;
          l = this.#d, this.#R(e.endpointID, o), s += 1, a += 1;
          break;
        }
        if (g) {
          f = this.#s;
          continue;
        }
        g || (a += 1, f = this.#s, this.#I(i));
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
    }) : this.#E(i, n) ? (this.#o.delete(n), Ae) : null;
  }
  #g(e, n) {
    return !this.#r || this.#f !== n ? os : this.#t !== e ? is : null;
  }
  #y(e) {
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
        ln
      );
    } catch {
    }
  }
  #I(e) {
    if (this.#r)
      try {
        this.#i.sendEventOrValue?.(
          Za,
          e,
          void 0,
          ln
        );
      } catch {
      }
  }
  #w(e) {
    const n = as(e);
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
    this.#s += 1, this.#v();
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
  #v() {
    for (const e of [...this.#h])
      e.finish(!0);
  }
}
const ls = 1e3, Ge = [te, ie];
function fn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Je(t, e) {
  const n = t && typeof t == "object" ? t : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  if (fn(r, e)) return r[e];
  if (fn(n, e)) return n[e];
}
function Xe(t, e) {
  if (t === void 0) return dr();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = ua(n, e);
  return r._tag === "ok" ? r.value : null;
}
function mn(t) {
  return new Set(t.routes.flatMap((e) => bt(e) === null ? [] : [e.id]));
}
function hn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class cs {
  constructor(e) {
    this.connection = e, this.modulationLane = new dn(e, { laneKind: "modulation" }), this.articulationLane = new dn(e, { laneKind: "articulation" });
  }
  modulationState = at();
  articulationBank = dr();
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
    { length: R },
    () => null
  );
  recoveryTimer = null;
  lastRejectedToken = /* @__PURE__ */ new Map();
  modulationLane;
  articulationLane;
  handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  handleRuntimeStateBound = this.handleRuntimeState.bind(this);
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(ut, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(ut, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
      for (const n of Ge) this.connection.requestStoredStateValue(n);
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
    const n = Je(e, te), r = n === void 0 ? { _tag: "ok", value: at() } : Gt(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${te} is invalid; boot state was not installed.`);
      const a = Je(e, ie), s = Xe(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const i = Je(e, ie), o = Xe(
      i,
      mn(r.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${ie} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = o, this.hasArticulationState = !0;
  }
  handleStoredStateValue(e) {
    if (!this.started || !e || typeof e != "object") return;
    const n = e;
    if (!(typeof n.key != "string" || !Ge.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === Ge.length) {
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
      const i = Gt(n);
      if (i._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${te}.`);
        return;
      }
      this.modulationState = i.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = Xe(n, mn(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${ie}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = Er(e);
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
    const e = this.runtimeGeneration, n = this.modulationState, r = this.articulationBank, i = this.lastAppliedModulationGeneration !== e, o = sr(
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
    const s = this.buildUploadsBySelector(n, r), l = Array.from({ length: R }, (f, p) => {
      const g = s.get(p);
      return g ? hn(g) : null;
    }), c = this.lastAppliedArticulationGeneration !== e, d = c && this.articulationLane.getAcceptedFrontier() !== 0, u = [];
    for (let f = 0; f < R; f += 1) {
      const p = s.get(f), g = l[f] !== this.lastAppliedArticulationTokens[f];
      d ? u.push({
        endpointID: He,
        value: p ?? Yt(f)
      }) : c ? p && u.push({ endpointID: He, value: p }) : g && u.push({
        endpointID: He,
        value: p ?? Yt(f)
      });
    }
    const h = await this.articulationLane.sendBatch(u);
    this.acceptOutcome("articulation", h, l) && (this.lastAppliedArticulationGeneration = e, this.lastAppliedArticulationTokens = l, Xo(
      da(r),
      this.connection
    ), this.clearRecoveryTimer(), this.lastRejectedToken.clear()), this.finishDelivery();
  }
  desiredStateChanged(e, n, r) {
    return e !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const r = Object.fromEntries(e.routes.flatMap((i) => {
      const o = bt(i);
      return o === null ? [] : [[i.id, o]];
    }));
    return new Map(
      ur(n, r).map((i) => [i.selectorA, i])
    );
  }
  acceptOutcome(e, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const i = hn(r), o = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== i;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, i), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, ls));
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
function us(t) {
  return new cs(t);
}
const ds = 2e3;
function pn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function fs(t, e) {
  const n = t && typeof t == "object" ? t : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  return pn(r, e) ? {
    found: !0,
    value: r[e]
  } : pn(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function gn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class ms {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = hs(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = fs(e, this.options.stateKey);
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
    }, i = gn(n), o = !this.forceFullReplay && i === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(r, o), s = gn({
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
        this.options.sendTimeoutMilliseconds ?? ds
      );
    this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = i, this.lastAppliedSnapshot = r;
  }
}
function hs(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function ps(t, e) {
  return new ms(t, e);
}
function gs(t) {
  return ps(t, {
    stateKey: x,
    runtimeEndpointDependencies: [Ya],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: ja,
    buildRuntimeEvents: ({ state: e }) => [...Ar(e)]
  });
}
function P(t, e) {
  if (!t)
    throw new Error(e);
}
function Qe(t, e, n) {
  let r = "";
  for (let i = 0; i < n; i += 1)
    r += String.fromCharCode(t.getUint8(e + i));
  return r;
}
function ys(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function dt(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Mr(t) {
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
function Is() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Ye(t, e) {
  const n = Is();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (ys(e))
      return new URL(e);
    const r = e.startsWith("/") ? e.slice(1) : e;
    return new URL(r, n);
  }
  return new URL(t, n);
}
async function yn(t) {
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
  throw new Error(`Unsupported text resource payload (${Mr(t)})`);
}
function Ss(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return dt(t);
  throw new Error(`Unsupported binary resource payload (${Mr(t)})`);
}
function vs(t) {
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
function wr(t) {
  const e = new DataView(t);
  P(Qe(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), P(Qe(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, i = null, o = null, a = null, s = null, l = null, c = 12;
  for (; c + 8 <= e.byteLength; ) {
    const u = Qe(e, c, 4), h = e.getUint32(c + 4, !0), f = c + 8;
    u === "fmt " ? (n = e.getUint16(f, !0), r = e.getUint16(f + 2, !0), i = e.getUint32(f + 4, !0), a = e.getUint16(f + 12, !0), o = e.getUint16(f + 14, !0)) : u === "data" && (s = f, l = h), c = f + h + h % 2;
  }
  P(n !== null, "Wave file is missing a fmt chunk"), P(s !== null && l !== null, "Wave file is missing a data chunk"), P(r === 1, "Only mono wavetable bank files are supported");
  let d;
  if (n === 3 && o === 32)
    d = new Float32Array(t.slice(s, s + l));
  else if (n === 1 && o === 16) {
    const u = l / 2, h = new Int16Array(t.slice(s, s + l));
    d = new Float32Array(u);
    for (let f = 0; f < u; f += 1)
      d[f] = h[f] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${o}`);
  return {
    format: n,
    channelCount: r,
    sampleRate: i ?? 0,
    bitsPerSample: o,
    blockAlign: a ?? 0,
    samples: d
  };
}
async function In(t) {
  P(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return P(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function ft(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function _r(t) {
  const e = new Uint8Array(t).buffer, n = wr(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function bs(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (l) => (P(typeof t.readResource == "function", `Resource bridge cannot read ${l}`), t.readResource(l)), i = async (l) => {
    P(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${l}`);
    const c = await t.readResourceAsAudioData(l);
    return vs(c);
  }, o = (l) => {
    const c = t.getResourceAddress?.(l);
    return c ?? null;
  }, a = async (l, c = t.getResourceAddress?.(l)) => {
    const d = Ye(l, c), u = await In(d), h = wr(u);
    return {
      sampleRate: h.sampleRate,
      samples: h.samples
    };
  }, s = async (l, c = t.getResourceAddress?.(l)) => {
    const d = Ye(l, c);
    return new Uint8Array(await In(d));
  };
  return {
    async readText(l) {
      if (e === "bridge" && typeof t.readResource == "function")
        return yn(await r(l));
      const c = o(l);
      return e === "url" && c !== null ? ft(await s(l, c)) : typeof t.readResource == "function" ? yn(await r(l)) : ft(await s(l, c));
    },
    async readJSON(l) {
      return JSON.parse(await this.readText(l));
    },
    async readBytes(l) {
      return typeof t.readResource == "function" ? Ss(await r(l)) : s(l);
    },
    async readAudio(l) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return i(l);
      const c = o(l);
      return n === "url" && c !== null ? a(l, c) : typeof t.readResourceAsAudioData == "function" ? i(l) : _r(await this.readBytes(l));
    },
    getURL(l) {
      return Ye(l, t.getResourceAddress?.(l));
    }
  };
}
function Ts(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return bs(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Rs(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, r = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, i = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, o = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return ft(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (e)
        return dt(await e(a));
      if (n)
        return dt(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return i ? i(a) : _r(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function As(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Es(t) {
  return As(t) ? Rs(t) : Ts(t);
}
const _e = 2048;
function ue(t, e) {
  if (!t)
    throw new Error(e);
}
function xs(t) {
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
const Ms = 2048, kr = 11, ws = 256;
function F(t, e) {
  if (!t)
    throw new Error(e);
}
function _s(t) {
  return t > 0 && (t & t - 1) === 0;
}
const Sn = /* @__PURE__ */ new Map();
function ks(t) {
  const e = Sn.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), r = new Uint32Array(t);
  for (let i = 0; i < t; i += 1) {
    let o = 0, a = i;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return Sn.set(t, r), r;
}
function Or(t, e, n = !1) {
  const r = t.length;
  F(r === e.length, "FFT real and imaginary buffers must have the same length"), F(_s(r), "FFT input length must be a power of two");
  const i = ks(r);
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
    for (let d = 0; d < r; d += o) {
      let u = 1, h = 0;
      for (let f = 0; f < a; f += 1) {
        const p = d + f, g = p + a, A = t[g], N = e[g], I = u * A - h * N, T = u * N + h * A, O = t[p], L = e[p];
        t[p] = O + I, e[p] = L + T, t[g] = O - I, e[g] = L - T;
        const H = u * l - h * c;
        h = u * c + h * l, u = H;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      t[o] /= r, e[o] /= r;
}
function Lr(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const r = n / Math.max(1, e.length), i = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    i[o] = (Number(e[o]) || 0) - r;
  return i;
}
function Os(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Ms,
  maxFramesPerTable: r = ws
} = {}) {
  const i = Float32Array.from(t);
  F(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  F(o > 0, "Source wavetable files must contain at least one frame"), F(o <= r, `Source wavetable files must contain at most ${r} frames`), e !== void 0 && F(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const l = s * n, c = l + n;
    a.push(Lr(i.slice(l, c)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function vn(t) {
  const e = Lr(t), n = Float64Array.from(e), r = new Float64Array(n.length);
  return Or(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function Ls(t, e, {
  mipLevelCount: n = kr
} = {}) {
  const r = t?.real?.length ?? 0;
  F(r > 0, "Spectrum must contain real samples"), F(r === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), F(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << e, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let s = 1; s <= i; s += 1) {
    o[s] = t.real[s], a[s] = t.imaginary[s];
    const l = (r - s) % r;
    l !== s && (o[l] = t.real[l], a[l] = t.imaginary[l]);
  }
  return Or(o, a, !0), Float32Array.from(o);
}
const Ds = "runtimeSyncRequest", Ns = 2147483647, Cs = "runtimeState", Ps = "retryDesiredTableRequest", Fs = "workerLoadFailure", Us = "serviceLoadAbort", $s = "wavetableLoadBegin", Ks = "wavetableMipFrame", Bs = "wavetableUploadAck", Vs = "wavetableMipRequest", zs = "wavetablePrewarmRequest", Hs = "wavetablePrewarmNotification", Ws = "assets/factory-bank-catalog.json", mt = 3, js = 1, qs = mt * _e, Gs = 1, Js = 2, Xs = 3, Qs = 1, Ys = 2, Zs = 2e4, Ee = Gs, el = Js, bn = Xs, j = Qs, Tn = Ys, tl = 48 * 1024 * 1024, Ze = 3;
function Rn(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function E(t, e, n = null) {
  const r = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (r) {
    if (n && Object.keys(n).length > 0) {
      r(`[wavetable-worker] ${e}`, n);
      return;
    }
    r(`[wavetable-worker] ${e}`);
  }
}
function An(t) {
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
function En(t, e, n) {
  const r = t + e;
  return t === 0 || r === n || r % 16 === 0;
}
function xn(t, e) {
  if (!t)
    throw new Error(e);
}
function nl(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function rl(t, e) {
  return xs(await t.readJSON(e));
}
function il(t) {
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
function ol(t, e) {
  const n = Math.round(Number(t) || 0);
  return nl(n, 0, Math.max(0, e - 1));
}
function et(t, e, n, r, i) {
  return `${t}:${e}:${n}:${r}:${i}`;
}
function al(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function Mn(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function wn(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function _n() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function sl(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class ll {
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
    this.connection = e, this.resourceClient = Es(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Ws, this.maxBatchesInFlight = Rn(
      n.maxFramesInFlight,
      js
    ), this.mipLevelCount = n.mipLevelCount ?? kr, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? tl) || 0)), this.serviceLoadTimeoutMs = Rn(n.serviceLoadTimeoutMs, Zs), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, E("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Cs, this.handleRuntimeState), this.connection.addEndpointListener?.(Bs, this.handleUploadAck), this.connection.addEndpointListener?.(Vs, this.handleMipRequest), this.connection.addEndpointListener?.(zs, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Hs, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Ds,
      Ns
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await rl(this.resourceClient, this.catalogPath), E("info", "Loaded wavetable catalog", {
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = Mn(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Mn(e),
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
          ...wn(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== r || this.serviceTable.tableIndex !== i || !this.serviceLoadHasPendingTransfers()) && (E("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: bn,
          failureReasonCode: Tn
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== bn || e.failureReasonCode !== Tn ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: r,
    generation: i = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = Ee,
    failureReasonCode: s = j
  }) {
    this.connection.sendEventOrValue?.(Fs, {
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
    failureReasonCode: o = j
  }) {
    this.connection.sendEventOrValue?.(Us, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: r,
      tableIndex: i,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(e) {
    E("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? An(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(Ps, e);
  }
  async loadTableSource(e, n) {
    const r = await this.ensureCatalogLoaded(), i = ol(e, r.tables.length), o = r.tables[i];
    xn(o, `Could not resolve table ${i}`);
    const a = al(o, _e, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, E("info", "Using cached wavetable source table", {
        tableIndex: i,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const l = _n();
    E("info", "Reading wavetable source", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const c = await this.resourceClient.readAudio(o.sourceWav), d = Os(c.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: _e
    });
    return E("info", "Prepared wavetable source table", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: d.frameCount,
      loadDurationMs: Math.round(_n() - l)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: i,
      tableMeta: o,
      frameCount: d.frameCount,
      frames: d.frames,
      spectra: new Array(d.frameCount)
    });
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.oscillatorIndex === e.oscillatorIndex && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, r) {
    E("info", "Committing desired wavetable load", {
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.($s, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: r.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    E("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: Ee,
      failureReasonCode: j
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: Ee,
      failureReasonCode: j
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = Ee,
    failureReasonCode: r = j
  } = {}) {
    E("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (E("error", "Could not reload committed service wavetable source", {
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
      this.isCurrentRuntimeState(e) && (E("error", "Could not prepare desired wavetable source", {
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
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, sl(() => {
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
        E("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: j
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
    const n = il(e ?? {});
    if (E("info", "Received runtime state", An(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Ze)
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
          i.spectra[a] || (i.spectra[a] = vn(i.frames[a]));
        const o = this.tableCache.get(i.cacheKey);
        o && this.refreshCacheEntryByteCount(o), E("info", "Prewarmed wavetable source table", {
          tableIndex: i.tableIndex,
          tableId: i.tableMeta.tableId,
          tableName: i.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (i) {
        E("warn", "Ignoring wavetable prewarm failure", {
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
      ...wn(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(l, c), c);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (E("info", "Received wavetable mip request", {
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
    const n = e ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), l = Math.trunc(Number(n.frameIndexBase)), c = Math.trunc(Number(n.frameCount)), d = et(
      r,
      i,
      o,
      a,
      s
    ), u = this.mipJobs.get(d), h = this.serviceTable?.frameCount ?? 0, f = Math.min(
      mt,
      h - l
    );
    if (!(!u || u.completed || !u.inFlightBatchBases.has(l) || c <= 0 || c !== f)) {
      u.inFlightBatchBases.delete(l);
      for (let p = 0; p < c; p += 1) {
        const g = l + p;
        u.ackedFrames[g] || (u.ackedFrames[g] = 1, u.ackedFrameCount += 1);
      }
      u.ackedFrameCount === h && u.nextFrameIndex >= h && u.inFlightBatchBases.size === 0 && (u.completed = !0, this.activeUploadKey === u.key && (this.activeUploadKey = null)), En(l, c, h) && E("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: i,
        generation: o,
        tableIndex: u.tableIndex,
        mipIndex: s,
        frameIndexBase: l,
        batchFrameCount: c,
        ackedFrameCount: u.ackedFrameCount,
        frameCount: h,
        inFlightBatches: u.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (xn(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = vn(this.serviceTable.frames[e]);
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
      ), i = new Float32Array(qs);
      try {
        for (let o = 0; o < r; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), l = Ls(s, e.mipIndex);
          i.set(l, o * _e);
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
            failurePhase: el,
            failureReasonCode: j
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Ks, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(i)
      }), En(n, r, this.serviceTable.frameCount) && E("info", "Sent wavetable mip batch", {
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
function cl(t, e = {}) {
  return new ll(t, e);
}
function ul(t, e, n) {
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
const xe = 1600, dl = /* @__PURE__ */ new Set([
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
function fl(t) {
  return t && typeof t == "object" && "event" in t ? t.event : t;
}
function ml(t) {
  return {
    values: {
      [te]: t.modulation,
      [x]: t.lane,
      [ie]: t.articulations
    }
  };
}
class hl {
  performer;
  #i;
  #e;
  #c = /* @__PURE__ */ new Map();
  #u = /* @__PURE__ */ new Map();
  #m = /* @__PURE__ */ new Map();
  #t = /* @__PURE__ */ new Map();
  #a = /* @__PURE__ */ new Map();
  #l = /* @__PURE__ */ new Map();
  #n;
  #d;
  #o = null;
  #f = null;
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
    const n = this.#m.get(e);
    if (n !== void 0)
      for (const r of this.#u.get(e) ?? []) r(n);
  }
  requestFullStoredState(e) {
    e(ml(this.#n));
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
      effectiveRackState: this.#f,
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
    )(n, 0), this.#m.set(e, n);
    for (const i of this.#u.get(e) ?? []) i(n);
  }
  advance(e) {
    if (!Number.isInteger(e) || e < 1 || e > 128)
      throw new Error("OfflineEngineHost advances must contain 1 to 128 frames.");
    this.performer.advance(e), this.#s += e, this.drainOutputEvents();
  }
  drainOutputEvents() {
    const e = /* @__PURE__ */ new Set([
      ...dl,
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
      ), a = Array.from({ length: i }, (s, l) => fl(o(l)));
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
    } else e === "runtimeInstallAck" ? this.#o = r : e === "effectiveRackState" && (this.#f = r);
  }
}
const kn = "assets/factory-bank-catalog.json";
function pl(t) {
  return {
    async readText(e) {
      if (e !== kn) throw new Error(`Speedrun resource bundle has no text ${e}.`);
      return JSON.stringify(t.catalog);
    },
    async readJSON(e) {
      if (e !== kn) throw new Error(`Speedrun resource bundle has no JSON ${e}.`);
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
const gl = [
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
class fe extends Error {
  constructor(e, n, r = {}) {
    super(`${e} install failed: ${n}`, r), this.lane = e, this.name = "SpeedrunInstallError";
  }
}
function yl(t) {
  const e = Object.fromEntries(t.modulation.routes.flatMap((r) => {
    const i = bt(r);
    return i === null ? [] : [[r.id, i]];
  })), n = Ar(t.lane);
  return {
    tableIndices: S.map((r) => Math.round(Number(t.parameters[`osc${r}WavetableSelect`]) || 0)),
    modulationFrontier: sr(t.modulation, null).length,
    articulationFrontier: ur(
      t.articulations,
      e
    ).length,
    rackChainLength: Rr(t.lane).chainLength,
    rackParamSerial: Math.max(0, n.length - 1)
  };
}
function Il(t, e) {
  for (let i = 0; i < e.tableIndices.length; i += 1) {
    const o = t.runtimeStates.get(i);
    if (o && o.hasFailure && Number(o.failedTableIndex) === e.tableIndices[i])
      return new fe(
        "wavetable",
        `oscillator ${i + 1} rejected table ${e.tableIndices[i]}.`
      );
  }
  const n = Math.trunc(Number(t.runtimeInstallAck?.rejectedSerial) || 0);
  if (n > 0)
    return new fe("modulation", `runtime serial ${n} was rejected.`);
  if (n < 0)
    return new fe("articulation", `runtime serial ${n} was rejected.`);
  const r = Math.trunc(
    Number(t.effectiveRackState?.laneRejectedUploadCount) || 0
  );
  return r > 0 ? new fe("rack", `${r} topology upload(s) were rejected.`) : null;
}
function On(t, e) {
  const n = e.tableIndices.every((a, s) => {
    const l = t.runtimeStates.get(s);
    return !!l?.hasActive && Number(l?.activeTableIndex) === a;
  }), r = e.modulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedModulationSerial) >= e.modulationFrontier, i = e.articulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedArticulationSerial) <= -e.articulationFrontier, o = Number(t.effectiveRackState?.laneCommittedChainLength) === e.rackChainLength && Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) >= e.rackParamSerial;
  return n && r && i && o;
}
function Sl(t, e) {
  return e.tableIndices.every((n, r) => {
    const i = t.runtimeStates.get(r);
    return !!i?.hasActive && Number(i?.activeTableIndex) === n;
  }) ? e.modulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedModulationSerial) < e.modulationFrontier ? "modulation" : e.articulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedArticulationSerial) > -e.articulationFrontier ? "articulation" : "rack" : "wavetable";
}
function vl(t) {
  return `${[0, 1, 2].map((n) => {
    const r = t.runtimeStates.get(n);
    return r ? `${n}:${Number(r.activeGeneration) || 0}/${Number(r.generationFrontier) || 0} load=${Number(r.loadingGeneration) || 0} active=${!!r.hasActive}` : `${n}:missing`;
  }).join(", ")}; mod=${Number(t.runtimeInstallAck?.acceptedModulationSerial) || 0} art=${Number(t.runtimeInstallAck?.acceptedArticulationSerial) || 0} rack=${Number(t.effectiveRackState?.laneCommittedChainLength) || 0} params=${Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) || 0} mipSent=${t.inputEventCounts.get("wavetableMipFrame") ?? 0} mipAck=${t.outputEventCounts.get("wavetableUploadAck") ?? 0}`;
}
function Dr(t) {
  return t >>> 16 & 255;
}
function Nr(t) {
  return t >>> 8 & 127;
}
function Nt(t) {
  return t & 127;
}
function bl(t, e, n) {
  if (t === null) return null;
  let r;
  try {
    r = JSON.parse(t);
  } catch {
    return null;
  }
  const i = r.activeMode, o = i === "key" ? r.key : i === "vel" ? r.velocity : r.chain;
  if (!Array.isArray(o)) return null;
  const a = i === "key" ? Nr(e) : i === "vel" ? Nt(e) : n % 128, s = Math.trunc(Number(o[a]));
  return s >= 0 && s <= 127 ? s : null;
}
function Tl(t, e, n, r) {
  const i = Dr(e);
  if ((i & 240) === 144 && Nt(e) > 0) {
    const o = bl(n, e, r);
    o !== null && t.sendEventOrValue("articulationNoteMeta", {
      channel: i & 15,
      noteNumber: Nr(e),
      selectorA: o,
      selectorB: 0,
      durationSamples: 0,
      ageSamples: 0
    });
  }
  t.sendMIDIInputEvent("midiIn", e);
}
async function Rl() {
  await new Promise((t) => setTimeout(t, 0));
}
async function Al(t, e) {
  const n = globalThis.performance?.now?.() ?? 0, r = new hl(t, {
    modulation: e.state.modulation,
    lane: e.state.lane,
    articulations: e.state.articulations
  }, e.resourceBaseURL);
  await r.initialise(e.sessionID, e.sampleRate), r.setInitialParameters(e.state.parameters), r.sendEventOrValue("tempo", { bpm: 120 });
  const i = await Qa(r, [
    us,
    gs,
    () => cl(r, {
      maxFramesInFlight: 1,
      serviceLoadTimeoutMs: 2e4,
      ...e.resourceBundle ? { resourceClient: pl(e.resourceBundle) } : {}
    })
  ]), o = yl(e.state), a = e.maxInstallFrames ?? e.sampleRate * 4;
  let s = 0;
  try {
    for (; s < a; ) {
      await r.pump(128), s += 128;
      const T = r.getInstallationState(), O = Il(T, o);
      if (O) throw O;
      if (On(T, o)) break;
      s / 128 % 8 === 0 && await Rl();
    }
    const I = r.getInstallationState();
    if (!On(I, o)) {
      const T = Sl(I, o);
      throw new fe(
        T,
        `timed out after ${s} virtual frames (${vl(I)}).`
      );
    }
  } finally {
    await i.stop();
  }
  const l = new Float32Array(e.frameCount * 2), c = ul(e.performance, e.frameCount, e.sampleRate), d = r.getInstallationState().articulationTriggerConfig, u = e.recordTelemetry === !0, h = /* @__PURE__ */ new Map();
  let f = 0, p = 0, g = 0;
  const A = u ? gl.map((I) => {
    const T = (O) => {
      const L = Math.floor(p / xe), H = h.get(L) ?? {};
      H[I] = structuredClone(O), h.set(L, H);
    };
    return r.addEndpointListener(I, T), { endpointID: I, listener: T };
  }) : [];
  try {
    for (; p < e.frameCount; ) {
      for (; f < c.length && c[f].sample === p; ) {
        const L = c[f];
        Tl(r, L.code, d, g), (Dr(L.code) & 240) === 144 && Nt(L.code) > 0 && (g += 1), f += 1;
      }
      const I = c[f]?.sample ?? e.frameCount, T = (Math.floor(p / xe) + 1) * xe, O = Math.min(
        128,
        e.frameCount - p,
        I - p,
        ...u ? [T - p] : []
      );
      if (O < 1)
        throw new Error("Speedrun checkpoint render computed an empty advance.");
      r.render(O, l, p), p += O;
    }
  } finally {
    for (const { endpointID: I, listener: T } of A)
      r.removeEndpointListener(I, T);
  }
  const N = (globalThis.performance?.now?.() ?? n) - n;
  return {
    rootIndex: e.rootIndex,
    rootNote: e.rootNote,
    checkpointIndex: e.checkpointIndex,
    frameCount: e.frameCount,
    samples: l,
    telemetry: {
      frameCount: Math.ceil(e.frameCount / xe),
      frames: [...h.entries()].sort(([I], [T]) => I - T).map(([I, T]) => ({ frame: I, events: T }))
    },
    metrics: {
      renderedFrameCount: e.frameCount,
      installFrameCount: s,
      elapsedMilliseconds: N,
      realtimeMultiplier: N > 0 ? e.frameCount / (N * e.sampleRate / 1e3) : null
    }
  };
}
const Me = self;
function El(t) {
  return {
    name: t instanceof Error ? t.name : "Error",
    message: t instanceof Error ? t.message : String(t),
    stack: t instanceof Error ? t.stack : void 0
  };
}
Me.addEventListener("message", (t) => {
  const e = t.data;
  (async () => {
    if (e.type !== "render-root" || typeof e.engineModuleURL != "string")
      throw new Error("Speedrun checkpoint worker received an unsupported request.");
    const r = await import(new URL(e.engineModuleURL, Me.location.href).href), i = r.default ?? r.WavetableSynth, o = await Al(
      i,
      e.job
    );
    Me.postMessage({
      type: "render-root-complete",
      requestID: e.requestID,
      result: o
    }, [o.samples.buffer]);
  })().catch((n) => {
    Me.postMessage({
      type: "render-root-failed",
      requestID: e.requestID,
      error: El(n)
    }, []);
  });
});
