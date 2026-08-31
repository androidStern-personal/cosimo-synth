const Hi = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function Ln(t) {
  const e = Hi.find((n) => n.deviceType === t);
  if (e === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${t}`);
  return e;
}
function C(t) {
  return Ln(t).laneEndpointID;
}
function Wi(t, e) {
  if (!Number.isInteger(e) || e < 1 || e > 5)
    throw new Error(`Effect Output Trim instance is out of range: ${e}`);
  return `${Ln(t).hostStem}${e}OutputTrimDb`;
}
function Nn(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function qi(t) {
  const e = (Nn(t, -100, 35) - -100) / 135;
  return e * e;
}
function ji(t) {
  return -100 + Math.sqrt(Nn(t, 0, 1)) * 135;
}
const D = (t, e) => ({ label: t, value: e });
function K(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const B = Object.freeze({
  filter: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: K(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), f = (t, e, n, i, r, o, a, s = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: r,
  max: o,
  initial: a,
  step: s.step ?? (o - r) / 1e3,
  scale: s.scale ?? "linear",
  unit: s.unit ?? "",
  choices: s.choices,
  quick: s.quick ?? !1,
  modulationTargetIndex: s.modulationTargetIndex ?? null,
  modulationApplication: s.modulationApplication ?? (s.modulationTargetIndex === void 0 || s.modulationTargetIndex === null ? null : "linear"),
  valueKind: s.valueKind,
  modulationIdentityEndpointID: s.modulationIdentityEndpointID,
  modulationDragStyle: s.modulationDragStyle
});
function $(t, e, n) {
  return f(
    t,
    e,
    "Output Trim",
    "Trim",
    -100,
    35,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const Gi = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Ji = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Qi = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: B.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      f("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(D), quick: !0 }),
      f("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      f("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      f("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      $("filter", "globalFilterOutputTrimDb", 39)
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
      f("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [D("Classic", 0), D("Harmonics", 1)] }),
      f("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      f("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      f("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      f("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      f("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      f("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [D("Symmetric", 0), D("Asymmetric", 1), D("Wavefold", 2)] }),
      $("drive", "distortionOutputTrimDb", 40)
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
      f("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      f("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      f("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      f("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      f("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      $("ott", "ottOutputTrimDb", 41)
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
      f("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(D) }),
      f("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(D) }),
      f("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      f("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      f("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      f("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      f("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
        unit: "Hz",
        scale: "log",
        modulationTargetIndex: 17,
        modulationApplication: "semitones",
        modulationIdentityEndpointID: "chorusRingFineSemitones"
      }),
      $("chorus", "chorusOutputTrimDb", 42)
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
      f("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      f("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      f("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      f("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      f("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
        unit: "ms",
        scale: "log",
        modulationTargetIndex: 36,
        modulationApplication: "octaves"
      }),
      $("flanger", "flangerOutputTrimDb", 43)
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
      f("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [D("Free", 0), D("Sync", 1)] }),
      f("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      f("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Gi.map(D) }),
      f("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      f("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      f("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      f("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      f("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      $("phaser", "phaserOutputTrimDb", 44)
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
      f("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [D("Free", 0), D("Sync", 1)] }),
      f("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      f("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Ji.map(D) }),
      f("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      f("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      f("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      $("delay", "delayOutputTrimDb", 45)
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
      f("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      f("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      f("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      f("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      $("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], Ue = Qi, Cn = Object.freeze(
  Ue.flatMap((t) => t.parameters)
);
new Map(
  Cn.map((t) => [t.endpointID, t])
);
function Pn(t) {
  const e = Ue.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function Fn() {
  return Cn;
}
function St(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const S = ["A", "B", "C"], Un = [
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
], Xi = [
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
  "ampRelease",
  "voiceEnhancerFrequencyOctaves",
  "voiceEnhancerQ",
  "voiceEnhancerAmount"
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
]), Yi = Object.freeze([
  ...S.flatMap((t) => Un.map(
    (e) => `osc${t}.${e}`
  )),
  ...Xi
]);
new Set(
  S.flatMap((t) => Un.map(
    (e) => `osc${t}.${e}`
  ))
);
const Kn = Object.freeze(
  Yi.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), Zi = Fn().filter(
  (t) => t.modulationTargetIndex !== null
), er = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function vt(t) {
  const e = tr(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function tr(t) {
  const e = er.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const nr = [
  ...Zi.map((t) => ({
    kind: vt(St(t)),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Bn = Object.freeze(
  nr.sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), H = Object.freeze([
  ...Kn,
  ...Bn
]), Oe = X.length, $n = Kn.length, Ke = Bn.length, ir = Oe * H.length, rr = new Map(X.map((t) => [t.id, t])), Vn = new Map(X.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), ue = new Map(H.map((t) => [t.kind, t]));
function or() {
  if (Oe !== 14 || $n !== 59 || Ke !== 47 || ir !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = X.filter((i) => i.group === t).sort((i, r) => i.runtimeIndex - r.runtimeIndex);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 59], ["rack", 47]]) {
    const n = H.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (rr.size !== Oe || Vn.size !== Oe || ue.size !== H.length)
    throw new Error("Modulation identities must be unique");
}
or();
function zn(t, e) {
  const n = Vn.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function bt(t) {
  return typeof t != "string" ? null : ue.has(t) ? t : null;
}
function ar(t) {
  const e = bt(t);
  return e !== null && ue.get(e)?.group === "voice" ? e : null;
}
function Tt(t) {
  const e = bt(t);
  return e !== null && ue.get(e)?.group === "rack" ? e : null;
}
function sr(t) {
  const e = ue.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function Hn(t) {
  const e = ue.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function lr(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const Wn = 4, cr = Wn * Ke, ur = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), dr = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function Y(t) {
  if (typeof t != "string")
    return null;
  const e = dr.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = ur.get(n);
  if (i === void 0)
    return null;
  const r = e[3];
  return i.includes(r) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: r
  } : null;
}
function Et(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function qn(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function jn(t) {
  if (t === null)
    return null;
  const e = qn(t) - 1;
  return e > Wn ? null : e * Ke + Hn(Et(t));
}
const z = 2048, mr = z + 3, $t = 20, Gn = "MSEG 1", fr = 0, j = 2, hr = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function Rt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function ce(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function pr(t) {
  return Rt(Number.isFinite(t) ? t : 0, -$t, $t);
}
function Q(t) {
  return Rt(Number.isFinite(t) ? t : 0, 0, 1);
}
function Jn(t = Gn) {
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
function at() {
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
function gr(t) {
  const e = Number(t);
  return Rt(
    Number.isFinite(e) ? e : 1,
    fr,
    j
  );
}
function Ir(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = Q(Number(e.startX)), i = Q(Number(e.endX));
  return ce(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function yr(t = at()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, i = Number(n.seconds), r = e.noteOffPolicy, o = hr.has(r) ? r : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: gr(Number.isFinite(i) ? i : 1)
    },
    loop: Ir(e.loop),
    noteOffPolicy: o,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function Sr(t, e, n) {
  const i = t && typeof t == "object" ? t : {};
  let r = Number(i.x);
  return Number.isFinite(r) || (r = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (r = Q(r)), {
    x: r,
    y: Q(Number(i.y)),
    curvePower: pr(Number(i.curvePower))
  };
}
function ye(t = Jn()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((r, o) => Sr(r, o, n.length));
  if (!ce(i[0].x, 0) || !ce(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let r = 1; r < i.length; r += 1)
    if (i[r].x < i[r - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Gn,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function Vt(t) {
  return JSON.stringify(ye(t));
}
function vr(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function br(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const i = t[n], r = t[n + 1];
    if (e < r.x)
      return { from: i, to: r, laterPointWins: !1 };
    if (ce(e, r.x)) {
      let o = n + 1;
      for (; o + 1 < t.length && ce(t[o + 1].x, e); )
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
function Tr(t, e) {
  const n = Q(Number(e)), i = br(t, n);
  if (i.laterPointWins || ce(i.from.x, i.to.x))
    return i.to.y;
  const r = i.to.x - i.from.x, o = r <= 0 ? 1 : (n - i.from.x) / r, a = Q(vr(o, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * a;
}
function Er(t, e) {
  return Tr(ye(t).points, e);
}
function Rr(t) {
  const e = ye(t), n = new Float32Array(z);
  for (let r = 0; r < z; r += 1) {
    const o = r / (z - 1);
    n[r] = Er(e, o);
  }
  const i = new Float32Array(mr);
  return i[0] = n[0], i.set(n, 1), i[z + 1] = n[z - 1], i[z + 2] = n[z - 1], i;
}
function zt(t, e) {
  return Vt(t) === Vt(e);
}
const $e = "modulationProgram", Ar = "modulationAmount", Qn = X.filter((t) => t.group === "voice").length, Xn = X.filter((t) => t.group === "macro").length, De = $n, xr = Ke, ke = xr + cr, G = Qn * De, te = Xn * De, Mr = Qn * ke, _r = Xn * ke, W = 512, Z = 256, Yn = G + te;
function Or(t) {
  const e = zn(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function wr(t) {
  const e = ar(t);
  return e === null ? null : sr(e);
}
function Zn(t) {
  const e = wr(t.targetKind), n = Tt(t.targetKind);
  let i = n === null ? void 0 : Hn(n);
  if (i === void 0) {
    const a = jn(
      Y(t.targetKind)
    );
    a !== null && (i = a);
  }
  if (e === null && i === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = zn(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (e !== null) {
      const u = s * De + e;
      return {
        path: "macroVoice",
        cellIndex: u,
        sourceIndex: s,
        targetIndex: e,
        articulationCellIndex: G + u
      };
    }
    const l = i ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * ke + l,
      sourceIndex: s,
      targetIndex: l,
      articulationCellIndex: null
    };
  }
  const r = Or(t);
  if (e !== null) {
    const a = r * De + e;
    return {
      path: "voice",
      cellIndex: a,
      sourceIndex: r,
      targetIndex: e,
      articulationCellIndex: a
    };
  }
  const o = i ?? 0;
  return {
    path: "voiceRack",
    cellIndex: r * ke + o,
    sourceIndex: r,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function At(t) {
  return Y(t.targetKind) !== null ? null : Zn(t).articulationCellIndex;
}
function Dr(t) {
  if (Tt(t.targetKind) !== null)
    return !1;
  const e = Y(t.targetKind);
  return e !== null && jn(e) === null;
}
function kr(t) {
  return {
    ...Zn(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function ei(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (Dr(n))
      continue;
    const i = kr(n), r = e[i.path];
    if (r.has(i.cellIndex))
      throw new Error(`Duplicate modulation route cell ${i.path}:${i.cellIndex}`);
    r.set(i.cellIndex, i);
  }
  return e;
}
function Lr(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function ne(t) {
  return [...t.values()].filter(Lr).sort((e, n) => e.cellIndex - n.cellIndex);
}
function Te(t, e, n, i, r) {
  for (let o = 0; o < t.length; o += 1) {
    const a = t[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    e[o] = a.cellIndex, n[o] = a.sourceIndex, i[o] = a.targetIndex, r[o] = a.polarity;
  }
}
function Ve(t) {
  const e = ei(t), n = ne(e.voice), i = ne(e.macroVoice), r = ne(e.voiceRack), o = ne(e.macroRack), a = Array.from({ length: G }, () => 0), s = Array.from({ length: G }, () => 0), l = Array.from({ length: G }, () => 0), u = Array.from({ length: G }, () => 0), c = Array.from({ length: G }, () => 0);
  Te(n, a, s, l, u);
  const d = Array.from({ length: te }, () => 0), p = Array.from({ length: te }, () => 0), m = Array.from({ length: te }, () => 0), h = Array.from({ length: te }, () => 0), I = Array.from({ length: te }, () => 0);
  if (Te(
    i,
    d,
    p,
    m,
    h
  ), r.length > W || o.length > Z)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${r.length} voice-rack (max ${W}), ${o.length} macro-rack (max ${Z})`
    );
  const k = Array.from({ length: W }, () => 0), L = Array.from({ length: W }, () => 0), b = Array.from({ length: W }, () => 0), y = Array.from({ length: W }, () => 0), M = Array.from({ length: W }, () => 0), w = Array.from({ length: Mr }, () => 0);
  Te(
    r,
    k,
    L,
    b,
    y
  );
  const N = Array.from({ length: Z }, () => 0), Pt = Array.from({ length: Z }, () => 0), Ft = Array.from({ length: Z }, () => 0), Ut = Array.from({ length: Z }, () => 0), Kt = Array.from({ length: _r }, () => 0);
  Te(
    o,
    N,
    Pt,
    Ft,
    Ut
  );
  for (const _ of e.voice.values()) c[_.cellIndex] = _.amount;
  for (const _ of e.macroVoice.values()) I[_.cellIndex] = _.amount;
  for (const _ of e.voiceRack.values()) w[_.cellIndex] = _.amount;
  for (const _ of e.macroRack.values()) Kt[_.cellIndex] = _.amount;
  for (let _ = 0; _ < r.length; _ += 1) {
    const Bt = r[_];
    if (Bt === void 0) throw new Error(`Missing compiled voice-rack route at index ${_}`);
    M[_] = Bt.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: l,
    voiceRoutePolarities: u,
    voiceRouteAmounts: c,
    macroVoiceRouteCount: i.length,
    macroVoiceRouteCells: d,
    macroVoiceRouteSources: p,
    macroVoiceRouteTargets: m,
    macroVoiceRoutePolarities: h,
    macroVoiceRouteAmounts: I,
    voiceRackRouteCount: r.length,
    voiceRackRouteCells: k,
    voiceRackRouteSources: L,
    voiceRackRouteTargets: b,
    voiceRackRoutePolarities: y,
    voiceRackRouteReducers: M,
    voiceRackRouteAmounts: w,
    macroRackRouteCount: o.length,
    macroRackRouteCells: N,
    macroRackRouteSources: Pt,
    macroRackRouteTargets: Ft,
    macroRackRoutePolarities: Ut,
    macroRackRouteAmounts: Kt
  };
}
const Nr = ["voice", "macroVoice", "voiceRack", "macroRack"], Cr = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Ht(t) {
  return ei(t);
}
function Pr(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function Fr(t, e) {
  if (t === null)
    return [{ endpointID: $e, value: Ve(e) }];
  const n = Ht(t), i = Ht(e), r = [];
  for (const o of Nr) {
    const a = ne(n[o]), s = ne(i[o]);
    if (a.length !== s.length)
      return [{ endpointID: $e, value: Ve(e) }];
    for (let l = 0; l < s.length; l += 1) {
      const u = a[l], c = s[l];
      if (u === void 0 || c === void 0 || !Pr(u, c))
        return [{ endpointID: $e, value: Ve(e) }];
      u.amount !== c.amount && r.push({
        endpointID: Ar,
        value: {
          pathKind: Cr[o],
          cellIndex: c.cellIndex,
          amount: c.amount
        }
      });
    }
  }
  return r;
}
function de(t) {
  return { _tag: "ok", value: t };
}
function ge(t) {
  return { _tag: "err", error: t };
}
function Ur(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Kr(t) {
  throw new Error(t ?? "Invariant violated");
}
const Br = "globalTune", $r = "globalTuneSemitones", V = -24, me = 24, Wt = 0, ti = -48, ni = 48, st = -48, ii = 6, xt = 0, qt = (xt - st) / (ii - st), Ie = Object.freeze({
  width: 760,
  height: 272,
  left: 42,
  right: 42,
  top: 18,
  bottom: 28,
  minimumHz: 20,
  maximumHz: 2e4,
  minimumGainDb: 0,
  maximumGainDb: 12,
  minimumLevelDbfs: -72,
  maximumLevelDbfs: 0
}), ee = 241;
function Vr(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function ze(t) {
  return Ie.minimumHz * Math.pow(
    Ie.maximumHz / Ie.minimumHz,
    Vr(t, 0, 1)
  );
}
Object.freeze(
  Array.from({ length: ee }, (t, e) => {
    const n = e / (ee - 1), i = ze(n), r = ze(
      Math.max(0, e - 0.5) / (ee - 1)
    ), o = ze(
      Math.min(ee - 1, e + 0.5) / (ee - 1)
    );
    return {
      centerHz: i,
      lowHz: e === 0 ? Ie.minimumHz : r,
      highHz: e === ee - 1 ? Ie.maximumHz : o
    };
  })
);
const zr = "voiceEnhancerFrequency", Hr = "voiceEnhancerQ", Wr = "voiceEnhancerAmount", qr = "voiceEnhancerFrequencyOctaves", jr = "voiceEnhancerQ", Gr = "voiceEnhancerAmount", ri = "voice.enhancerFrequency", Jr = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: zr,
    targetKind: qr,
    label: "Frequency",
    shortLabel: "Freq",
    min: 20,
    max: 2e4,
    initial: 130,
    step: 1,
    scale: "log",
    unit: "Hz",
    modulationApplication: "octaves"
  }),
  q: Object.freeze({
    key: "q",
    endpointID: Hr,
    targetKind: jr,
    label: "Q",
    shortLabel: "Q",
    min: 0.1,
    max: 10,
    initial: 0.71,
    step: 0.01,
    scale: "log",
    unit: "Q",
    modulationApplication: "linear"
  }),
  amount: Object.freeze({
    key: "amount",
    endpointID: Wr,
    targetKind: Gr,
    label: "Amount",
    shortLabel: "Amt",
    min: 0,
    max: 1,
    initial: 0,
    step: 0.01,
    scale: "linear",
    unit: "%",
    modulationApplication: "linear"
  })
});
function jt(t, e) {
  const n = Math.min(t.max, Math.max(t.min, e));
  return t.scale === "log" ? Math.log(n / t.min) / Math.log(t.max / t.min) : (n - t.min) / (t.max - t.min);
}
function Qr(t, e) {
  const n = Math.min(1, Math.max(0, e));
  return t.scale === "log" ? t.min * (t.max / t.min) ** n : t.min + (t.max - t.min) * n;
}
function Ee(t, e, n, i, r = "percent", o = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: o };
}
const Xr = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      Ee("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      Ee("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      Ee("mix", "Mix", 100, 100),
      Ee("drive", "Drive", 15, 0)
    ]
  }
], Gt = 1e-6;
function F(t, e) {
  if (!Number.isFinite(t) || t < -Gt || t > 1 + Gt)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function Le(t, e) {
  return F(t / 100, `${e} catalog percentage`);
}
function Se(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Yr(t) {
  return 20 * 1e3 ** t;
}
function Zr(t) {
  return F(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function eo(t) {
  return 0.1 * 200 ** t;
}
function to(t) {
  return F(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function no(t) {
  return t;
}
function io(t) {
  return F(t, "filterMix endpoint conversion");
}
function se(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function ro(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: se("filterCutoff", Yr, Zr),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: se("filterQ", eo, to),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: se("filterMix", no, io),
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
function oi(t) {
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
      return Ur(t);
  }
}
function oo(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function ao(t, e) {
  const n = Se(t.moduleId, e.id), i = oi(e.format), r = ro(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: Le(e.defaultPercent, n),
    initialValue: Le(e.initialPercent, n),
    format: i,
    modAmount: oo(i),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const so = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: qt * 100, defaultPercent: qt * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function lo(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function co(t, e) {
  const n = `osc${t}`, i = Se(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: Le(e.defaultPercent, i),
    initialValue: Le(e.initialPercent, i),
    format: oi(e.format),
    modAmount: lo(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const uo = Object.freeze(
  S.flatMap((t) => so.map((e) => co(t, e)))
), mo = Object.freeze({
  targetId: Se("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: F(
    (Wt - V) / (me - V),
    "Global Tune default"
  ),
  initialValue: F(
    (Wt - V) / (me - V),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: me },
  modAmount: {
    min: ti,
    max: ni,
    unit: "st",
    digits: 2
  },
  binding: se(
    Br,
    (t) => V + (me - V) * t,
    (t) => F(
      (t - V) / (me - V),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: $r
});
function fo(t) {
  const e = Se("voice-enhancer", t.key), n = F(
    jt(t, t.initial),
    `${t.endpointID} initial value`
  );
  return Object.freeze({
    targetId: e,
    moduleId: "voice-enhancer",
    workspace: "voice",
    label: t.label,
    defaultValue: n,
    initialValue: n,
    format: t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : { kind: "percent" },
    modAmount: t.modulationApplication === "octaves" ? { min: -6, max: 6, unit: "oct", digits: 2 } : t.unit === "Q" ? { min: -9.9, max: 9.9, unit: "Q", digits: 2 } : { min: -100, max: 100, unit: "%", digits: 0 },
    binding: se(
      t.endpointID,
      (i) => Qr(t, i),
      (i) => F(
        jt(t, i),
        `${t.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: t.targetKind
  });
}
const ho = Object.freeze(
  Object.values(Jr).map(fo)
), po = Object.freeze([
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
function go(t) {
  const e = Se(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (o) => t.min + n * o, r = (o) => F(
    (o - t.min) / n,
    `${t.endpointID} endpoint conversion`
  );
  return Object.freeze({
    targetId: e,
    moduleId: t.moduleId,
    workspace: "voice",
    label: t.label,
    defaultValue: r(t.initial),
    initialValue: r(t.initial),
    format: t.format === "time" ? { kind: "time", minSeconds: t.min, maxSeconds: t.max } : { kind: "percent" },
    modAmount: t.format === "time" ? { min: -n, max: n, unit: "s", digits: 3 } : { min: -100, max: 100, unit: "%", digits: 0 },
    binding: se(t.endpointID, i, r),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const Io = Object.freeze(
  po.map(go)
), yo = Object.freeze([
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
function So(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function He(t, e) {
  const n = t.valueKind === "effect-output-trim-db" ? qi(e) : t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return F(n, `${t.endpointID} endpoint conversion`);
}
function vo(t, e) {
  return t.valueKind === "effect-output-trim-db" ? ji(e) : t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function bo(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function To(t) {
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
function Eo(t) {
  const e = So(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: He(t, t.initial),
    initialValue: He(t, t.initial),
    format: bo(t),
    modAmount: To(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => vo(t, n),
      fromEngine: (n) => He(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : vt(St(t))
  });
}
const Mt = Object.freeze(
  [
    ...Ue.flatMap((t) => t.parameters.map(Eo)),
    ...yo,
    mo,
    ...ho,
    ...uo,
    ...Io,
    ...Xr.flatMap(
      (t) => t.parameters.map(
        (e) => ao(t, e)
      )
    )
  ]
), Ro = new Map(
  Mt.map((t) => [t.targetId, t])
), ai = Mt.filter(
  (t) => t.modulationTargetKind !== null
), lt = new Map(
  ai.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Ro.size !== Mt.length)
  throw new Error("Target descriptor IDs must be unique");
if (ai.length !== H.length || lt.size !== H.length || H.some((t) => lt.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function We(t) {
  const e = lt.get(t);
  return e === void 0 ? Kr(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  Ue.map((t) => [t.id, t.label])
);
function Ao(t) {
  const e = qn(t);
  return e === 1 ? "" : ` ${e}`;
}
function xo(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = We(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = Y(t);
  if (n !== null) {
    const i = We(Et(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : i.moduleId.toUpperCase()}${Ao(n)} ${i.label.toUpperCase()}`;
  }
  return We(t).label.toUpperCase();
}
const ie = "modulation.v6", si = 6, ve = 3, re = 3, Mo = 4, Jt = "modulationMsegBuffer", _o = "modulationMsegPlayback", li = 4, Oo = ["MSEG 1", "MSEG 2", "MSEG 3"], ci = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], wo = ["Env 1", "Env 2", "Env 3"], Do = 1e-3, T = 10, ko = 0.1, Lo = 20, Qt = 10 - 0.1, No = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Lo - ko },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: ti,
    max: ni
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
  mseg1Rate: { min: -j, max: j },
  mseg2Rate: { min: -j, max: j },
  mseg3Rate: { min: -j, max: j },
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
  env3Release: { min: -T, max: T },
  ampAttack: { min: -T, max: T },
  ampDecay: { min: -T, max: T },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -T, max: T },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -Qt, max: Qt },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Co = Fn().filter((t) => t.modulationTargetIndex !== null), Po = new Map(
  Co.map((t) => [
    vt(St(t)),
    t
  ])
);
class qe extends Error {
  name = "ModulationStateParseError";
}
const Fo = {
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
  label: Fo[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const Uo = H.map((t) => ({
  value: t.kind,
  label: xo(t.kind)
}));
Uo.filter((t) => !Bo(t.value));
function Ko(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function _t(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function je(t, e) {
  const n = Number(t);
  return _t(Number.isFinite(n) ? n : e, Do, T);
}
function Bo(t) {
  return Tt(t) !== null;
}
function $o(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (t.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function Vo(t) {
  const e = Y(t);
  return e !== null ? Et(e) : t;
}
function zo(t) {
  const e = Vo(t);
  if (Y(e)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = Po.get(e);
  return n !== void 0 ? $o(n) : No[lr(e)];
}
function Ho(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Wo(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function qo(t, e) {
  const n = zo(t), i = Number(e);
  return _t(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function jo(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function Go(t) {
  return jo(t) ?? "mseg";
}
function Jo(t) {
  const e = bt(t);
  return e !== null ? e : Y(t) !== null ? t : null;
}
function Qo(t) {
  return Jo(t) ?? "oscA.wavetablePosition";
}
function Xo(t, e) {
  const n = ci[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function Yo(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? ve : t === "macro" ? li : Mo;
  return _t(Number.isFinite(n) ? n : 1, 1, i);
}
function oe(t) {
  return {
    name: wo[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function ui(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = oe(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: je(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: je(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: Q(n.sustain ?? i.sustain),
    releaseSeconds: je(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function Zo(t, e = 0) {
  return { name: ui(t, e).name };
}
function ea(t, e, n, i) {
  const r = Number(t.amount);
  return {
    id: Ho(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: Yo(n, t.sourceSlot),
    polarity: Wo(t.polarity),
    targetKind: i,
    amount: qo(i, r),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function ta(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, r = Go(i.sourceKind), o = Qo(i.targetKind);
  return ea(i, e, r, o);
}
function na(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function ia(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => ta(n, i));
}
function ra(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const r = na(i);
    if (e.has(i.id) || n.has(r))
      return !1;
    e.add(i.id), n.add(r);
  }
  return !0;
}
function ct(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, s) => ct(a, e[s]));
  const n = t, i = e, r = Object.keys(n), o = Object.keys(i);
  return r.length === o.length && r.every((a) => Ko(i, a) && ct(n[a], i[a]));
}
function di(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = Jn(Oo[e] ?? `MSEG ${e + 1}`), r = ye(n.shapeA ?? i), o = yr({
    ...at(),
    ...n.playback ?? {},
    rate: at().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: r,
    shapeB: ye(n.shapeB ?? r),
    playback: s
  };
}
function ut() {
  return {
    format: "cosimo.modulation",
    version: si,
    msegSlots: Array.from({ length: ve }, (t, e) => di({}, e)),
    envelopeSlots: Array.from({ length: re }, (t, e) => ({
      name: oe(e).name
    })),
    routes: [],
    macroNames: ci.slice()
  };
}
function oa(t = ut()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], r = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: si,
    msegSlots: Array.from({ length: ve }, (o, a) => di(n[a], a)),
    envelopeSlots: Array.from({ length: re }, (o, a) => Zo(i[a], a)),
    routes: ia(e.routes),
    macroNames: Array.from(
      { length: li },
      (o, a) => Xo(r[a], a)
    )
  };
}
function Xt(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return ge(new qe("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return ge(new qe("Expected valid modulation JSON"));
    }
  }
  const n = oa(e);
  return !ct(e, n) || !ra(n.routes) ? ge(new qe("Expected the current modulation schema")) : de(n);
}
function aa(t, e) {
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
function Yt(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(Rr(n))
  };
}
function sa(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function mi(t, e = null) {
  const n = [];
  for (let i = 0; i < ve; i += 1) {
    const r = t.msegSlots[i], o = e?.msegSlots[i];
    (o === void 0 || !zt(o.shapeA, r.shapeA)) && n.push({
      endpointID: Jt,
      value: Yt(i, 0, r.shapeA)
    }), (o === void 0 || !zt(o.shapeB, r.shapeB)) && n.push({
      endpointID: Jt,
      value: Yt(i, 1, r.shapeB)
    }), (o === void 0 || !sa(o.playback, r.playback)) && n.push({
      endpointID: _o,
      value: aa(i, r.playback)
    });
  }
  return n.push(...Fr(e?.routes ?? null, t.routes)), n;
}
const Ge = "articulationSnapshot", E = 128, Zt = 48, la = 1e6, x = -1, Je = [
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
function Ot(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Qe(t) {
  return Ot(Number.isFinite(t) ? t : 0, 0, 1);
}
function O(t, e, n = -Number.MAX_VALUE, i = Number.MAX_VALUE) {
  const r = Number(t);
  return Ot(Number.isFinite(r) ? r : e, n, i);
}
function A(t, e, n, i) {
  return Ot(Math.round(O(t, e)), n, i);
}
function fi(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function Xe() {
  return Array.from({ length: E }, () => x);
}
function ca(t) {
  const e = A(t, 0, 0, E - 1), n = Je[e % Je.length], i = Math.floor(e / Je.length);
  return i === 0 ? n : `${n} ${i + 1}`;
}
function ua() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: xt,
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
function da(t) {
  const e = ua(), n = t && typeof t == "object" ? t : {}, i = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: O(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: O(n.pan, e.pan, -1, 1),
    octave: A(n.octave, e.octave, -4, 4),
    semitone: A(n.semitone, e.semitone, -12, 12),
    fineCents: O(n.fineCents, e.fineCents, -100, 100),
    volumeDb: O(
      n.volumeDb,
      e.volumeDb,
      st,
      ii
    ),
    mute: A(n.mute, e.mute, 0, 1),
    solo: A(n.solo, e.solo, 0, 1),
    warpMode: A(n.warpMode, e.warpMode, 0, 4),
    warpAmount: O(n.warpAmount, e.warpAmount, 0, 1),
    filterMode: A(n.filterMode, e.filterMode, 0, 5),
    filterCutoff: O(n.filterCutoff, e.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: O(
      n.filterKeyTrackOffsetSemitones,
      e.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: O(n.filterQ, e.filterQ, 0.1, 20),
    unisonVoices: A(n.unisonVoices, e.unisonVoices, 1, 8),
    unisonDetune: O(n.unisonDetune, e.unisonDetune, 0, 1),
    unisonBlend: O(n.unisonBlend, e.unisonBlend, 0, 1),
    unisonWidth: O(n.unisonWidth, e.unisonWidth, 0, 1),
    unisonPhase: O(n.unisonPhase, e.unisonPhase, 0, 1),
    unisonRandom: O(n.unisonRandom, e.unisonRandom, 0, 1),
    unisonPhaseMode: A(n.unisonPhaseMode, e.unisonPhaseMode, 0, 1),
    unisonDetuneMode: A(n.unisonDetuneMode, e.unisonDetuneMode, 0, 4),
    unisonStackMode: A(n.unisonStackMode, e.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: O(
      n.unisonWavetablePositionSpread,
      e.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: O(n.unisonWarpSpread, e.unisonWarpSpread, 0, 1),
    msegMorphs: [
      Qe(Number(i[0])),
      Qe(Number(i[1])),
      Qe(Number(i[2]))
    ]
  };
}
function ma(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: O(e.amount, 0, -48, 48)
  } : null;
}
function fa(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(ma).filter((r) => r !== null) : [], i = /* @__PURE__ */ new Map();
  for (const r of n)
    i.set(r.routeId, r);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: da(e.parameters),
    envelopes: [0, 1, 2].map((r) => ui(
      Array.isArray(e.envelopes) ? e.envelopes[r] : void 0,
      r
    )),
    modRouteAmounts: [...i.values()]
  };
}
function ha(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = A(n.runtimeSlot, e, 0, E - 1), r = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${i}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : ca(i);
  return {
    id: r,
    runtimeSlot: i,
    name: o,
    snapshot: fa(n.snapshot)
  };
}
function pa(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(i) ? {
    note: A(n.note, 0, 0, E - 1),
    articulationId: i
  } : null;
}
function ga(t, e, n, i, r) {
  if (!t || typeof t != "object")
    return null;
  const o = t, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let s = A(o.min, r, r, E - 1), l = A(o.max, s, r, E - 1);
  return l < s && ([s, l] = [l, s]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${i}-${n}`,
    articulationId: a,
    min: s,
    max: l
  };
}
function en(t, e, n, i) {
  const r = Array.isArray(t) ? t : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < r.length; s += 1) {
    const l = ga(
      r[s],
      e,
      s,
      n,
      i
    );
    !l || o.has(l.id) || (o.add(l.id), a.push(l));
  }
  return a;
}
function Ia(t, e) {
  const n = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), r = [];
  for (const o of n) {
    const a = pa(o, e);
    !a || i.has(a.note) || (i.add(a.note), r.push(a));
  }
  return r;
}
function ya(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], i = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), o = [];
  for (let l = 0; l < n.length && o.length < E; l += 1) {
    const u = ha(n[l], l);
    !u || i.has(u.runtimeSlot) || r.has(u.id) || (i.add(u.runtimeSlot), r.add(u.id), o.push(u));
  }
  const a = typeof e.selectedSlotId == "string" && o.some((l) => l.id === e.selectedSlotId) ? e.selectedSlotId : null, s = new Set(o.map((l) => l.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: fi(e.activeTriggerMode),
    slots: o,
    chainAssignments: en(e.chainAssignments, s, "chain", 0),
    keyAssignments: Ia(e.keyAssignments, s),
    velocityAssignments: en(e.velocityAssignments, s, "velocity", 1)
  };
}
function tn(t) {
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
    volumeDbs: e(xt),
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
    msegMorphs: Array.from({ length: ve }, () => 0),
    routeAmounts: Array.from({ length: Yn }, () => 0),
    envelopeAttackSeconds: Array.from({ length: re }, (n, i) => oe(i).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: re }, (n, i) => oe(i).decaySeconds),
    envelopeSustain: Array.from({ length: re }, (n, i) => oe(i).sustain),
    envelopeReleaseSeconds: Array.from({ length: re }, (n, i) => oe(i).releaseSeconds)
  };
}
function nn(t, e, n) {
  for (const i of e) {
    const r = n.get(i.articulationId);
    if (r !== void 0)
      for (let o = i.min; o <= i.max; o += 1)
        t[o] === x && (t[o] = r);
  }
}
function Sa(t) {
  const e = ya(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), i = Xe(), r = Xe(), o = Xe();
  nn(i, e.chainAssignments, n), nn(o, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || r[a.note] !== x || (r[a.note] = s);
  }
  return o[0] = x, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: i,
    key: r,
    velocity: o
  };
}
function va(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Sa(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: fi(e.activeMode),
    chain: Array.from({ length: E }, (n, i) => A(e.chain?.[i], x, x, E - 1)),
    key: Array.from({ length: E }, (n, i) => A(e.key?.[i], x, x, E - 1)),
    velocity: Array.from({ length: E }, (n, i) => i === 0 ? x : A(e.velocity?.[i], x, x, E - 1))
  });
}
function ba(t, e) {
  const n = va(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const i = globalThis;
  typeof i.cosimo_set_articulation_trigger_config == "function" && i.cosimo_set_articulation_trigger_config(n);
}
const ae = "articulations.v4", wt = [
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
], Dt = [
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
], Ta = [
  ...S.flatMap((t) => wt.map(
    (e) => `osc${t}.${e}`
  )),
  ...Dt
];
class hi extends Error {
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
  return ge(new hi("malformed", t));
}
function be(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function kt(t, e, n) {
  const i = new Set(e);
  for (const r of e)
    if (!Object.hasOwn(t, r))
      return `${n} is missing field "${r}"`;
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return `${n} has a non-string field key`;
    if (!i.has(r))
      return `${n} has unexpected field "${r}"`;
  }
  return null;
}
function Ne(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < E;
}
function Ea(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function Ra(t) {
  return Ta.some((e) => e === t);
}
function rn(t, e) {
  if (!be(t))
    return g(`${e} must be an object`);
  const n = kt(t, ["min", "max"], e);
  return n !== null ? g(n) : Ne(t.min) ? Ne(t.max) ? t.min > t.max ? g(`${e}.min must be less than or equal to ${e}.max`) : de({ min: t.min, max: t.max }) : g(`${e}.max must be an integer in 0..127`) : g(`${e}.min must be an integer in 0..127`);
}
function Aa(t, e) {
  if (!be(t))
    return g(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return g(`${e} has a non-string parameter id`);
    if (!Ra(i))
      return g(`${e} has unknown parameter id "${i}"`);
    const r = t[i];
    if (typeof r != "number" || !Number.isFinite(r))
      return g(`${e}.${i} must be a finite number`);
    n[i] = r;
  }
  return de(n);
}
function xa(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function Ma() {
  return {};
}
function _a(t, e, n) {
  if (!be(t))
    return g(`${e} must be an object`);
  const i = Ma();
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return g(`${e} has a non-string route id`);
    const o = t[r];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > Zt)
      return g(
        `${e}.${r} must be a finite route amount within ±${Zt}`
      );
    if (!n.has(r))
      return g(`${e}.${r} does not name a current articulable mapping`);
    xa(i, r, o);
  }
  return de(i);
}
function Oa(t, e, n) {
  const i = `slots[${e}]`;
  if (!be(t))
    return g(`${i} must be an object`);
  const r = kt(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    i
  );
  if (r !== null)
    return g(r);
  if (typeof t.id != "string")
    return g(`${i}.id must be a string`);
  if (!Ne(t.runtimeSlot))
    return g(`${i}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return g(`${i}.name must be a string`);
  if (typeof t.color != "string")
    return g(`${i}.color must be a string`);
  if (!Ne(t.key))
    return g(`${i}.key must be an integer in 0..127`);
  const o = rn(t.velRange, `${i}.velRange`);
  if (o._tag === "err")
    return o;
  const a = rn(t.chainRange, `${i}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = Aa(t.overrides, `${i}.overrides`);
  if (s._tag === "err")
    return s;
  const l = _a(
    t.routeAmounts,
    `${i}.routeAmounts`,
    n
  );
  return l._tag === "err" ? l : de({
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
const wa = Object.fromEntries(
  wt.map((t, e) => [t, 2 ** e])
), Da = Object.fromEntries(
  Dt.map((t, e) => [t, 2 ** e])
);
function on(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function ka(t, e) {
  return wt.reduce((n, i) => Object.hasOwn(t.overrides, `osc${e}.${i}`) ? n | wa[i] : n, 0);
}
function La(t) {
  return Dt.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | Da[n] : e, 0);
}
function Na(t, e) {
  const n = (o, a) => on(t, `osc${o}.${a}`), i = (o) => on(t, o), r = Array.from(
    { length: Yn },
    () => la
  );
  for (const [o, a] of Object.entries(t.routeAmounts)) {
    const s = e[o];
    s !== void 0 && (r[s] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: S.map((o) => ka(t, o)),
    sharedOverrideMask: La(t),
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
    filterMode: i("filterMode"),
    filterCutoffHz: i("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: i("filterKeyTrackOffsetSemitones"),
    filterQ: i("filterQ"),
    unisonVoices: S.map((o) => n(o, "unisonVoices")),
    unisonDetunes: S.map((o) => n(o, "unisonDetune")),
    unisonBlends: S.map((o) => n(o, "unisonBlend")),
    unisonWidths: S.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: S.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: S.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: S.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: S.map((o) => n(o, "unisonWarpSpread")),
    msegMorphs: [
      i("msegMorph1"),
      i("msegMorph2"),
      i("msegMorph3")
    ],
    routeAmounts: r,
    envelopeAttackSeconds: [
      i("env1.attackSeconds"),
      i("env2.attackSeconds"),
      i("env3.attackSeconds")
    ],
    envelopeDecaySeconds: [
      i("env1.decaySeconds"),
      i("env2.decaySeconds"),
      i("env3.decaySeconds")
    ],
    envelopeSustain: [
      i("env1.sustain"),
      i("env2.sustain"),
      i("env3.sustain")
    ],
    envelopeReleaseSeconds: [
      i("env1.releaseSeconds"),
      i("env2.releaseSeconds"),
      i("env3.releaseSeconds")
    ]
  };
}
function pi(t, e) {
  return t.slots.map((n) => Na(n, e));
}
function Ca(t, e) {
  if (!be(t))
    return g("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return g('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return ge(new hi(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = kt(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return g(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return g("selectedSlotId must be null or a string");
  if (!Ea(t.activeTriggerMode))
    return g('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return g("slots must be an array");
  if (t.slots.length > E)
    return g(`slots must contain at most ${E} entries`);
  const i = [], r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const s = Oa(t.slots[a], a, e);
    if (s._tag === "err")
      return s;
    const l = s.value;
    if (r.has(l.id))
      return g(`slots[${a}].id duplicates "${l.id}"`);
    if (o.has(l.runtimeSlot))
      return g(`slots[${a}].runtimeSlot duplicates ${l.runtimeSlot}`);
    r.add(l.id), o.add(l.runtimeSlot), i.push(l);
  }
  return t.selectedSlotId !== null && !r.has(t.selectedSlotId) ? g(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : de({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: i
  });
}
function gi() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Pa(t) {
  const e = Array.from({ length: E }, () => x), n = Array.from({ length: E }, () => x), i = Array.from({ length: E }, () => x);
  for (const r of t.slots) {
    n[r.key] === x && (n[r.key] = r.runtimeSlot);
    for (let o = r.chainRange.min; o <= r.chainRange.max; o += 1)
      e[o] === x && (e[o] = r.runtimeSlot);
    for (let o = r.velRange.min; o <= r.velRange.max; o += 1)
      i[o] === x && (i[o] = r.runtimeSlot);
  }
  return i[0] = x, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: i
  };
}
const Ii = 13, Lt = 5, yi = 8, Fa = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), Nt = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    C("globalFilter")
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
    "distortionWetLPKeyTrackOffsetSemitones",
    C("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    C("ott")
  ],
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
    "chorusRingLegacyClampEnabled",
    C("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    C("flanger")
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
    "phaserFrequencyKeyTrackOffsetSemitones",
    C("phaser")
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
    "delayFilterKeyTrackOffsetSemitones",
    C("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    C("reverb")
  ]
}), Si = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), Ua = Object.freeze([
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
]), Ka = Object.freeze({
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
function Ba(t) {
  return Math.round(t) === 1 ? -5 : Math.round(t) === 2 ? 12 : Math.round(t) === 3 ? -12 : 7;
}
function vi(t, e) {
  const n = {};
  for (const s of Nt[t]) {
    const l = e[s];
    if (typeof l == "number" && Number.isFinite(l)) {
      n[s] = l;
      continue;
    }
    const u = Ka[s];
    if (u === void 0)
      throw new Error(`Missing lane parameter value: ${t}.${s}`);
    n[s] = u;
  }
  const r = [
    ...Si.chorus,
    C("chorus")
  ], o = Object.keys(e);
  return t === "chorus" && o.length === r.length && o.every((s) => r.includes(s)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = Ba(
    Number(e.chorusRingOffsetMode)
  ) + Number(e.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function bi(t) {
  return Nt[t];
}
function $a(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= Lt)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * yi + Fa[t];
}
function Va(t, e) {
  const n = new Array(Ii).fill(0), i = vi(t, e);
  return Nt[t].forEach((r, o) => {
    n[o] = i[r];
  }), n;
}
const Ti = "lane.v1", za = "laneTopology", dt = "laneSlotParams", Ha = "laneOutputControl", mt = 16, Wa = 8, Ei = 4, qa = 3, Ri = Lt * yi, Ai = 4, ja = 4, Ga = Ri, Ja = Ri + Ai, Qa = 0, Xa = 1, Ya = 2, Za = 3, es = 4, ts = 5;
function ns(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > Ei)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << Wa;
}
const Ce = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), Pe = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), xi = new Map(
  Object.entries(Pe).map(([t, e]) => [e, t])
), is = Object.freeze({
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
  Ce.map((t) => [is[t], t])
);
const rs = Object.freeze([
  "voice.filterCutoff",
  ri,
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
]), os = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [ri]: "enhancer-frequency",
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
  rs.map((t) => [t, Object.freeze({
    id: t,
    family: os[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const Mi = 40, _i = 18e3, ft = Ce.map((t) => Pe[t]), as = /^([a-zA-Z]+)#([1-9][0-9]*)$/, ss = /^(parallel|split)#([1-9][0-9]*)$/;
function Be(t) {
  if (typeof t != "string")
    return null;
  const e = as.exec(t);
  if (e === null)
    return null;
  const n = ft.find((r) => r === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > Lt ? null : { deviceType: n, instanceNumber: i };
}
function Oi(t) {
  if (typeof t != "string")
    return null;
  const e = ss.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? Ai : ja) ? null : { groupKind: n, unitNumber: i };
}
function J(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function le(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function v(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function ls(t, e) {
  const n = Be(t);
  if (n === null)
    return { failure: v(`device id ${t} is not a pool instance`) };
  if (!J(e) || !le(e, ["params"]) || !J(e.params))
    return { failure: v(`device ${t} must be { params }`) };
  const i = bi(n.deviceType), r = xi.get(n.deviceType);
  if (r === void 0)
    return { failure: v(`device ${t} has no effect descriptor`) };
  const o = Pn(r).parameters.map((m) => m.endpointID), a = e.params, s = Object.keys(a), l = (m) => s.length === m.length && s.every((h) => m.includes(h)), u = C(n.deviceType), c = [
    ...Si[n.deviceType],
    u
  ], d = [
    ...Ua,
    u
  ];
  if (!(s.includes(u) && (l(i) || l(o) || l(c) || n.deviceType === "chorus" && l(d))))
    return { failure: v(`device ${t} must carry every parameter once`) };
  for (const m of s) {
    const h = a[m];
    if (typeof h != "number" || !Number.isFinite(h))
      return { failure: v(`device ${t}.${m} must be a finite number`) };
  }
  return { record: { params: vi(n.deviceType, a) } };
}
function cs(t, e) {
  return !J(t) || t.kind !== "device" ? { failure: v("branches may hold device placements only") } : le(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: v(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: v(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: v("a device placement is { kind, deviceId, enabled }") };
}
function an(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= Mi && t <= _i;
}
function wi() {
  return { mix: 1, bypassed: !1 };
}
function us(t) {
  return !J(t) || !le(t, ["mix", "bypassed"]) || typeof t.mix != "number" || !Number.isFinite(t.mix) || t.mix < 0 || t.mix > 1 || typeof t.bypassed != "boolean" ? null : { mix: t.mix, bypassed: t.bypassed };
}
function ds(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (c) {
      const d = c instanceof Error ? c.message : String(c);
      return v(`is not valid JSON: ${d}`);
    }
  if (!J(e) || !le(e, ["format", "version", "output", "devices", "chain"]))
    return v("must be { format, version, output, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return v("must be cosimo.lane version 2");
  if (!J(e.devices))
    return v("devices must be an object");
  if (!Array.isArray(e.chain))
    return v("chain must be an array");
  const n = us(e.output);
  if (n === null)
    return v("output must be { mix: 0..1, bypassed: boolean }");
  const i = {};
  for (const c of Reflect.ownKeys(e.devices)) {
    if (typeof c != "string")
      return v("device ids must be strings");
    const d = ls(c, e.devices[c]);
    if ("failure" in d)
      return d.failure;
    i[c] = d.record;
  }
  const r = new Set(Object.keys(i)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let l = 0;
  const u = (c) => {
    const d = cs(c, r);
    return "placement" in d && (o.set(
      d.placement.deviceId,
      (o.get(d.placement.deviceId) ?? 0) + 1
    ), l += 1), d;
  };
  for (const c of e.chain) {
    if (!J(c))
      return v("chain nodes must be objects");
    if (c.kind === "device") {
      const y = u(c);
      if ("failure" in y)
        return y.failure;
      s.push(y.placement);
      continue;
    }
    if (c.kind !== "parallel" && c.kind !== "split")
      return v(`unknown chain node kind ${String(c.kind)}`);
    const d = c.kind === "split", p = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], h = d ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], I = d && le(c, p);
    if (!le(c, h) && !I)
      return v(`a ${c.kind} group is { ${h.join(", ")} }`);
    const k = Oi(c.groupId);
    if (k === null || k.groupKind !== c.kind)
      return v(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (a.has(String(c.groupId)))
      return v(`group ${String(c.groupId)} is used twice`);
    if (a.add(String(c.groupId)), typeof c.enabled != "boolean")
      return v(`group ${String(c.groupId)} needs a boolean enable`);
    const L = d ? qa : Ei;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > L)
      return v(`group ${String(c.groupId)} needs 2..${L} branches`);
    if (d && (!an(c.xoverLowHz) || !an(c.xoverHighHz)))
      return v(`group ${String(c.groupId)} crossovers must sit in ${Mi}..${_i} Hz`);
    if (d && !I && (typeof c.xoverLowKeyTrackEnabled != "boolean" || typeof c.xoverHighKeyTrackEnabled != "boolean" || typeof c.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverLowKeyTrackOffsetSemitones) || typeof c.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverHighKeyTrackOffsetSemitones)))
      return v(`group ${String(c.groupId)} Key Track state must be finite`);
    l += 1;
    const b = [];
    for (const y of c.branches) {
      if (!Array.isArray(y))
        return v(`group ${String(c.groupId)} branches must be arrays`);
      const M = [];
      for (const w of y) {
        const N = u(w);
        if ("failure" in N)
          return N.failure;
        M.push(N.placement);
      }
      b.push(M);
    }
    s.push(d ? {
      kind: "split",
      groupId: String(c.groupId),
      enabled: c.enabled,
      xoverLowHz: c.xoverLowHz,
      xoverHighHz: c.xoverHighHz,
      xoverLowKeyTrackEnabled: I ? !1 : c.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: I ? 0 : c.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: I ? !1 : c.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: I ? 0 : c.xoverHighKeyTrackOffsetSemitones,
      branches: b
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: b
    });
  }
  for (const c of r)
    if ((o.get(c) ?? 0) !== 1)
      return v(`device ${c} must be placed exactly once`);
  return l > mt ? v(`flattens to ${l} wire entries; the topology upload holds ${mt}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: i, chain: s } };
}
function ms() {
  const t = {};
  for (const e of Ce) {
    const n = Pe[e];
    t[`${n}#1`] = {
      params: Is(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: wi(),
    devices: t,
    chain: Ce.map((e) => ({
      kind: "device",
      deviceId: `${Pe[e]}#1`,
      enabled: !1
    }))
  };
}
const sn = ["distortion#1", "delay#1", "reverb#1"];
function fs() {
  const t = ms(), e = {};
  for (const n of sn) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: wi(),
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && sn.includes(n.deviceId))
  };
}
function hs(t) {
  if (t === void 0)
    return fs();
  const e = ds(t);
  return e._tag === "ok" ? e.value : null;
}
function ps(t) {
  return Object.keys(t.devices).map((e) => {
    const n = Be(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => ft.indexOf(e.parsed.deviceType) - ft.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function ht(t) {
  const e = Be(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return $a(e.deviceType, e.instanceNumber - 1);
}
function Di(t) {
  const e = Oi(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? Ga : Ja) + (e.unitNumber - 1);
}
function ki(t) {
  const e = new Array(mt).fill(0);
  let n = 0, i = 0;
  const r = (o, a, s) => {
    e[i] = ns(o, a), s && (n |= 1 << i), i += 1;
  };
  for (const o of t.chain) {
    if (o.kind === "device") {
      r(ht(o.deviceId), 0, o.enabled);
      continue;
    }
    r(Di(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const l of a)
        r(ht(l.deviceId), s + 1, l.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function gs(t) {
  const e = new Array(Ii).fill(0);
  return e[Qa] = t.xoverLowHz, e[Xa] = t.xoverHighHz, e[Ya] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[Za] = t.xoverLowKeyTrackOffsetSemitones, e[es] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[ts] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function Li(t) {
  const e = [{
    endpointID: Ha,
    value: t.output
  }];
  let n = 0;
  for (const i of ps(t)) {
    const r = Be(i.instanceId);
    if (r === null)
      throw new Error(`Invalid lane device identity during replay: ${i.instanceId}`);
    e.push({
      endpointID: Wi(
        r.deviceType,
        r.instanceNumber
      ),
      value: t.devices[i.instanceId].params[C(r.deviceType)]
    }), n += 1, e.push({
      endpointID: dt,
      value: {
        slotId: ht(i.instanceId),
        deliverySerial: n,
        values: Va(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  }
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: dt,
      value: {
        slotId: Di(i),
        deliverySerial: n,
        values: gs(i)
      }
    }));
  return e.push({
    endpointID: za,
    value: ki(t)
  }), e;
}
function Is(t) {
  const e = xi.get(t);
  if (e === void 0)
    throw new Error(`Unknown lane device type: ${t}`);
  const n = Pn(e).parameters;
  return Object.fromEntries(bi(t).map((i) => [
    i,
    n.find((r) => r.endpointID === i)?.initial ?? 0
  ]));
}
class ys {
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
        for (const i of [...this.services].reverse())
          try {
            await i.stop?.();
          } catch (r) {
            n.push(r);
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
function Ss(t, e) {
  return new ys(t, e);
}
async function vs(t, e) {
  const n = Ss(t, e);
  return await n.start(), n;
}
const pt = "runtimeState";
function Ni(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const bs = {
  endpointID: pt,
  required: !0,
  mapValue: Ni
}, ln = "runtimeInstallAck", Ts = "runtimeSyncRequest", cn = 0, Es = 8e3, Fe = /* @__PURE__ */ new WeakMap(), Ci = 1e9;
let Re = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Ci;
function Rs(t) {
  return Re = Re % Ci + 1, t === "modulation" ? -1e9 - Re : 1e9 + Re;
}
function As(t, e) {
  const n = t, i = Fe.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), Fe.set(n, i);
}
function un(t, e) {
  const n = t, i = Fe.get(n);
  i?.delete(e), i?.size === 0 && Fe.delete(n);
}
const xs = [100, 250, 500, 1e3], Ae = { _tag: "accepted" }, Ms = { _tag: "superseded" }, _s = { _tag: "stopped" }, dn = { _tag: "transport-timeout" };
function Os(t) {
  const e = t && typeof t == "object" && "event" in t ? t.event : t, n = e && typeof e == "object" && "value" in e ? e.value : e;
  if (!n || typeof n != "object")
    return null;
  const i = n, r = i.dspSessionId, o = i.acceptedModulationSerial, a = i.acceptedArticulationSerial, s = i.rejectedSerial, l = i.rejectionReason, u = i.syncSerial;
  return ![
    r,
    o,
    a,
    s,
    l,
    u
  ].every((d) => typeof d == "number" && Number.isSafeInteger(d) && d >= -2147483648 && d <= 2147483647) || typeof r != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof l != "number" || typeof u != "number" || r < 0 || o < 0 || a > 0 || l < 0 ? null : {
    dspSessionId: r,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: l,
    syncSerial: u
  };
}
function ws(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class mn {
  #r;
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
  #i = !1;
  #s = 0;
  #h = /* @__PURE__ */ new Set();
  #b = this.#_.bind(this);
  constructor(e, n) {
    this.#r = e, this.#e = n.laneKind;
    const i = n.probeDelaysMilliseconds?.map((r) => Math.max(0, Math.trunc(r))).filter((r) => Number.isFinite(r));
    this.#c = i && i.length > 0 ? i : [...xs], this.#u = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Es)
    );
  }
  start() {
    if (!this.#i) {
      As(this.#r, this.#e);
      try {
        this.#m += 1, this.#i = !0, this.#a = null, this.#l.clear(), this.#r.addEndpointListener?.(ln, this.#b);
      } catch (e) {
        throw this.#i = !1, un(this.#r, this.#e), e;
      }
    }
  }
  stop() {
    this.#i && (this.#i = !1, this.#r.removeEndpointListener?.(ln, this.#b), un(this.#r, this.#e), this.#o.clear(), this.#a = null, this.#l.clear(), this.#v());
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
    const e = this.#t, n = this.#m;
    return this.#i ? e === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#T(e, n) : {
      _tag: "unavailable",
      reason: "not-started"
    };
  }
  async sendBatch(e) {
    if (!this.#i)
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
    const n = this.#t, i = this.#m;
    try {
      const r = await this.#T(
        n,
        i
      );
      if (r._tag !== "accepted")
        return r;
      let o = null;
      for (const a of e) {
        const s = await this.#M(
          a,
          n,
          i
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
  #R(e) {
    return this.#e === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #A(e, n) {
    const i = this.#R(e);
    return this.#e === "modulation" ? i >= n : i <= n;
  }
  #x() {
    const e = this.getAcceptedFrontier();
    return this.#e === "modulation" ? e + 1 : e - 1;
  }
  async #T(e, n) {
    if (this.#a === e)
      return Ae;
    const i = Rs(this.#e);
    this.#l.add(i);
    const r = Date.now() + this.#u;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#g(e, n);
        if (a)
          return a;
        if (this.#a === e)
          return Ae;
        const s = r - Date.now();
        if (s <= 0)
          return dn;
        const l = this.#s;
        this.#y(i), await this.#S(
          l,
          Math.min(this.#I(o), s)
        ), o += 1;
      }
    } finally {
      this.#l.delete(i);
    }
  }
  async #M(e, n, i) {
    const r = this.#x(), o = ws(e.value, n, r);
    let a = 0, s = 0, l = this.#d;
    for (this.#E(e.endpointID, o); ; ) {
      const u = this.#g(n, i);
      if (u)
        return u;
      const c = this.#p(n, r, l);
      if (c !== null)
        return c;
      const d = this.#s;
      await this.#S(
        d,
        this.#I(a)
      );
      const p = this.#p(
        n,
        r,
        l
      );
      if (p !== null)
        return p;
      let m = this.#s;
      for (this.#y(r); ; ) {
        const h = this.#g(n, i);
        if (h)
          return h;
        const I = await this.#S(
          m,
          this.#I(a)
        ), k = this.#p(
          n,
          r,
          l
        );
        if (k !== null)
          return k;
        if (I && this.#n?.dspSessionId === n && this.#n.syncSerial === r) {
          if (s >= 1)
            return dn;
          l = this.#d, this.#E(e.endpointID, o), s += 1, a += 1;
          break;
        }
        if (I) {
          m = this.#s;
          continue;
        }
        I || (a += 1, m = this.#s, this.#y(r));
      }
    }
  }
  #p(e, n, i) {
    const r = this.#n;
    if (!r || r.dspSessionId !== e)
      return null;
    const o = this.#o.get(n);
    return o !== void 0 && o.version > i && o.acknowledgement.dspSessionId === e ? (this.#o.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#A(r, n) ? (this.#o.delete(n), Ae) : null;
  }
  #g(e, n) {
    return !this.#i || this.#m !== n ? _s : this.#t !== e ? Ms : null;
  }
  #I(e) {
    return this.#c[Math.min(
      e,
      this.#c.length - 1
    )];
  }
  #E(e, n) {
    try {
      this.#r.sendEventOrValue?.(
        e,
        n,
        void 0,
        cn
      );
    } catch {
    }
  }
  #y(e) {
    if (this.#i)
      try {
        this.#r.sendEventOrValue?.(
          Ts,
          e,
          void 0,
          cn
        );
      } catch {
      }
  }
  #_(e) {
    const n = Os(e);
    if (!n || this.#t !== null && n.dspSessionId !== this.#t)
      return;
    if (this.#l.has(n.syncSerial) && (this.#a = n.dspSessionId), this.#n = n, this.#d += 1, this.#e === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#o.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#d
      }); this.#o.size > 16; ) {
        const r = this.#o.keys().next().value;
        if (r === void 0) break;
        this.#o.delete(r);
      }
    this.#s += 1, this.#v();
  }
  #S(e, n) {
    return !this.#i || this.#s !== e ? Promise.resolve(!0) : new Promise((i) => {
      let r = !1;
      const o = {
        finish: (a) => {
          r || (r = !0, o.timeoutHandle !== null && clearTimeout(o.timeoutHandle), this.#h.delete(o), i(a));
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
const Ds = 1e3, Ye = [ie, ae];
function fn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Ze(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (fn(i, e)) return i[e];
  if (fn(n, e)) return n[e];
}
function et(t, e) {
  if (t === void 0) return gi();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const i = Ca(n, e);
  return i._tag === "ok" ? i.value : null;
}
function hn(t) {
  return new Set(t.routes.flatMap((e) => At(e) === null ? [] : [e.id]));
}
function pn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class ks {
  constructor(e) {
    this.connection = e, this.modulationLane = new mn(e, { laneKind: "modulation" }), this.articulationLane = new mn(e, { laneKind: "articulation" });
  }
  modulationState = ut();
  articulationBank = gi();
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
    { length: E },
    () => null
  );
  recoveryTimer = null;
  lastRejectedToken = /* @__PURE__ */ new Map();
  modulationLane;
  articulationLane;
  handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  handleRuntimeStateBound = this.handleRuntimeState.bind(this);
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(pt, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(pt, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
      for (const n of Ye) this.connection.requestStoredStateValue(n);
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
    const n = Ze(e, ie), i = n === void 0 ? { _tag: "ok", value: ut() } : Xt(n);
    if (i._tag === "err") {
      console.error(`[runtime-state-worker] ${ie} is invalid; boot state was not installed.`);
      const a = Ze(e, ae), s = et(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = i.value, this.hasModulationState = !0;
    const r = Ze(e, ae), o = et(
      r,
      hn(i.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${ae} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = o, this.hasArticulationState = !0;
  }
  handleStoredStateValue(e) {
    if (!this.started || !e || typeof e != "object") return;
    const n = e;
    if (!(typeof n.key != "string" || !Ye.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === Ye.length) {
            const i = Object.fromEntries(this.pendingBootKeys);
            this.applyBootState(i), this.finishBoot();
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
    if (e === ie) {
      const r = Xt(n);
      if (r._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${ie}.`);
        return;
      }
      this.modulationState = r.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const i = et(n, hn(this.modulationState));
    if (i === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${ae}.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = Ni(e);
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
    const e = this.runtimeGeneration, n = this.modulationState, i = this.articulationBank, r = this.lastAppliedModulationGeneration !== e, o = mi(
      n,
      r ? null : this.lastAppliedModulationState
    ), a = await this.modulationLane.sendBatch(o);
    if (!this.acceptOutcome("modulation", a, n)) {
      this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = n, this.lastAppliedModulationGeneration = e, this.desiredStateChanged(e, n, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const s = this.buildUploadsBySelector(n, i), l = Array.from({ length: E }, (m, h) => {
      const I = s.get(h);
      return I ? pn(I) : null;
    }), u = this.lastAppliedArticulationGeneration !== e, c = u && this.articulationLane.getAcceptedFrontier() !== 0, d = [];
    for (let m = 0; m < E; m += 1) {
      const h = s.get(m), I = l[m] !== this.lastAppliedArticulationTokens[m];
      c ? d.push({
        endpointID: Ge,
        value: h ?? tn(m)
      }) : u ? h && d.push({ endpointID: Ge, value: h }) : I && d.push({
        endpointID: Ge,
        value: h ?? tn(m)
      });
    }
    const p = await this.articulationLane.sendBatch(d);
    this.acceptOutcome("articulation", p, l) && (this.lastAppliedArticulationGeneration = e, this.lastAppliedArticulationTokens = l, ba(
      Pa(i),
      this.connection
    ), this.clearRecoveryTimer(), this.lastRejectedToken.clear()), this.finishDelivery();
  }
  desiredStateChanged(e, n, i) {
    return e !== this.runtimeGeneration || n !== this.modulationState || i !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const i = Object.fromEntries(e.routes.flatMap((r) => {
      const o = At(r);
      return o === null ? [] : [[r.id, o]];
    }));
    return new Map(
      pi(n, i).map((r) => [r.selectorA, r])
    );
  }
  acceptOutcome(e, n, i) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const r = pn(i), o = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== r;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, r), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Ds));
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
function Ls(t) {
  return new ks(t);
}
const Ns = 2e3;
function gn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Cs(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return gn(i, e) ? {
    found: !0,
    value: i[e]
  } : gn(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function In(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Ps {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Fs(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = Cs(e, this.options.stateKey);
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
    const i = (r) => {
      this.parameterValues.set(e, r), this.applyRuntimeStateIfReady();
    };
    return this.parameterListeners.set(e, i), i;
  }
  getRuntimeEndpointListener(e) {
    const n = this.runtimeEndpointListeners.get(e.endpointID);
    if (n)
      return n;
    const i = (r) => {
      const o = e.mapValue ? e.mapValue(r) : r;
      this.runtimeEndpointValues.set(e.endpointID, o), this.applyRuntimeStateIfReady();
    };
    return this.runtimeEndpointListeners.set(e.endpointID, i), i;
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
    const i = {
      state: this.state,
      parameters: e,
      runtimeEndpoints: n
    }, r = In(n), o = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(i, o), s = In({
      runtimeEndpoints: n,
      events: a
    });
    if (s === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
      return;
    }
    if (a.length === 0) {
      this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(a, i).then((l) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        l ? (this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(a);
        const u = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, u && this.applyRuntimeStateIfReady();
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
        this.options.sendTimeoutMilliseconds ?? Ns
      );
    this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function Fs(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Us(t, e) {
  return new Ps(t, e);
}
function Ks(t) {
  return Us(t, {
    stateKey: Ti,
    runtimeEndpointDependencies: [bs],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: hs,
    buildRuntimeEvents: ({ state: e }) => [...Li(e)]
  });
}
function P(t, e) {
  if (!t)
    throw new Error(e);
}
function tt(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function Bs(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function gt(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Pi(t) {
  if (t === null)
    return "null";
  if (t === void 0)
    return "undefined";
  const e = typeof t, n = t?.constructor?.name;
  if (e !== "object")
    return n ? `${e}:${n}` : e;
  const i = Object.keys(t).slice(0, 6), r = i.length > 0 ? ` keys=${i.join(",")}` : "";
  return n ? `${e}:${n}${r}` : `${e}${r}`;
}
function $s() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function nt(t, e) {
  const n = $s();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Bs(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
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
  throw new Error(`Unsupported text resource payload (${Pi(t)})`);
}
function Vs(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return gt(t);
  throw new Error(`Unsupported binary resource payload (${Pi(t)})`);
}
function zs(t) {
  const e = t?.frames;
  P(
    Array.isArray(e) || ArrayBuffer.isView(e),
    "Decoded audio data must provide a frames array"
  );
  const n = Array.from(e), i = new Float32Array(n.length);
  for (let r = 0; r < n.length; r += 1) {
    const o = n[r];
    if (typeof o == "number") {
      i[r] = o;
      continue;
    }
    if (ArrayBuffer.isView(o) || Array.isArray(o)) {
      const a = o;
      P(a.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function Fi(t) {
  const e = new DataView(t);
  P(tt(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), P(tt(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, o = null, a = null, s = null, l = null, u = 12;
  for (; u + 8 <= e.byteLength; ) {
    const d = tt(e, u, 4), p = e.getUint32(u + 4, !0), m = u + 8;
    d === "fmt " ? (n = e.getUint16(m, !0), i = e.getUint16(m + 2, !0), r = e.getUint32(m + 4, !0), a = e.getUint16(m + 12, !0), o = e.getUint16(m + 14, !0)) : d === "data" && (s = m, l = p), u = m + p + p % 2;
  }
  P(n !== null, "Wave file is missing a fmt chunk"), P(s !== null && l !== null, "Wave file is missing a data chunk"), P(i === 1, "Only mono wavetable bank files are supported");
  let c;
  if (n === 3 && o === 32)
    c = new Float32Array(t.slice(s, s + l));
  else if (n === 1 && o === 16) {
    const d = l / 2, p = new Int16Array(t.slice(s, s + l));
    c = new Float32Array(d);
    for (let m = 0; m < d; m += 1)
      c[m] = p[m] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${o}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: r ?? 0,
    bitsPerSample: o,
    blockAlign: a ?? 0,
    samples: c
  };
}
async function Sn(t) {
  P(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return P(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function It(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function Ui(t) {
  const e = new Uint8Array(t).buffer, n = Fi(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Hs(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (l) => (P(typeof t.readResource == "function", `Resource bridge cannot read ${l}`), t.readResource(l)), r = async (l) => {
    P(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${l}`);
    const u = await t.readResourceAsAudioData(l);
    return zs(u);
  }, o = (l) => {
    const u = t.getResourceAddress?.(l);
    return u ?? null;
  }, a = async (l, u = t.getResourceAddress?.(l)) => {
    const c = nt(l, u), d = await Sn(c), p = Fi(d);
    return {
      sampleRate: p.sampleRate,
      samples: p.samples
    };
  }, s = async (l, u = t.getResourceAddress?.(l)) => {
    const c = nt(l, u);
    return new Uint8Array(await Sn(c));
  };
  return {
    async readText(l) {
      if (e === "bridge" && typeof t.readResource == "function")
        return yn(await i(l));
      const u = o(l);
      return e === "url" && u !== null ? It(await s(l, u)) : typeof t.readResource == "function" ? yn(await i(l)) : It(await s(l, u));
    },
    async readJSON(l) {
      return JSON.parse(await this.readText(l));
    },
    async readBytes(l) {
      return typeof t.readResource == "function" ? Vs(await i(l)) : s(l);
    },
    async readAudio(l) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(l);
      const u = o(l);
      return n === "url" && u !== null ? a(l, u) : typeof t.readResourceAsAudioData == "function" ? r(l) : Ui(await this.readBytes(l));
    },
    getURL(l) {
      return nt(l, t.getResourceAddress?.(l));
    }
  };
}
function Ws(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Hs(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function qs(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, o = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (i)
        return It(await i(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (i)
        return i(a);
      if (e)
        return gt(await e(a));
      if (n)
        return gt(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return r ? r(a) : Ui(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function js(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Gs(t) {
  return js(t) ? qs(t) : Ws(t);
}
const we = 2048;
function fe(t, e) {
  if (!t)
    throw new Error(e);
}
function Js(t) {
  fe(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    fe(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), fe(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), fe(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), fe(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const Qs = 2048, Ki = 11, Xs = 256;
function U(t, e) {
  if (!t)
    throw new Error(e);
}
function Ys(t) {
  return t > 0 && (t & t - 1) === 0;
}
const vn = /* @__PURE__ */ new Map();
function Zs(t) {
  const e = vn.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let o = 0, a = r;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    i[r] = o;
  }
  return vn.set(t, i), i;
}
function Bi(t, e, n = !1) {
  const i = t.length;
  U(i === e.length, "FFT real and imaginary buffers must have the same length"), U(Ys(i), "FFT input length must be a power of two");
  const r = Zs(i);
  for (let o = 0; o < i; o += 1) {
    const a = r[o];
    if (a <= o)
      continue;
    const s = t[o];
    t[o] = t[a], t[a] = s;
    const l = e[o];
    e[o] = e[a], e[a] = l;
  }
  for (let o = 2; o <= i; o <<= 1) {
    const a = o >> 1, s = (n ? 2 : -2) * Math.PI / o, l = Math.cos(s), u = Math.sin(s);
    for (let c = 0; c < i; c += o) {
      let d = 1, p = 0;
      for (let m = 0; m < a; m += 1) {
        const h = c + m, I = h + a, k = t[I], L = e[I], b = d * k - p * L, y = d * L + p * k, M = t[h], w = e[h];
        t[h] = M + b, e[h] = w + y, t[I] = M - b, e[I] = w - y;
        const N = d * l - p * u;
        p = d * u + p * l, d = N;
      }
    }
  }
  if (n)
    for (let o = 0; o < i; o += 1)
      t[o] /= i, e[o] /= i;
}
function $i(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    r[o] = (Number(e[o]) || 0) - i;
  return r;
}
function el(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Qs,
  maxFramesPerTable: i = Xs
} = {}) {
  const r = Float32Array.from(t);
  U(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = r.length / n;
  U(o > 0, "Source wavetable files must contain at least one frame"), U(o <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && U(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const l = s * n, u = l + n;
    a.push($i(r.slice(l, u)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function bn(t) {
  const e = $i(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return Bi(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function tl(t, e, {
  mipLevelCount: n = Ki
} = {}) {
  const i = t?.real?.length ?? 0;
  U(i > 0, "Spectrum must contain real samples"), U(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), U(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), o = new Float64Array(i), a = new Float64Array(i);
  for (let s = 1; s <= r; s += 1) {
    o[s] = t.real[s], a[s] = t.imaginary[s];
    const l = (i - s) % i;
    l !== s && (o[l] = t.real[l], a[l] = t.imaginary[l]);
  }
  return Bi(o, a, !0), Float32Array.from(o);
}
const nl = "runtimeSyncRequest", il = 2147483647, rl = "runtimeState", ol = "retryDesiredTableRequest", al = "workerLoadFailure", sl = "serviceLoadAbort", ll = "wavetableLoadBegin", cl = "wavetableMipFrame", ul = "wavetableUploadAck", dl = "wavetableMipRequest", ml = "wavetablePrewarmRequest", fl = "wavetablePrewarmNotification", hl = "assets/factory-bank-catalog.json", yt = 3, pl = 1, gl = yt * we, Il = 1, yl = 2, Sl = 3, vl = 1, bl = 2, Tl = 2e4, xe = Il, El = yl, Tn = Sl, q = vl, En = bl, Rl = 48 * 1024 * 1024, it = 3;
function Rn(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function R(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
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
function xn(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function Mn(t, e) {
  if (!t)
    throw new Error(e);
}
function Al(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function xl(t, e) {
  return Js(await t.readJSON(e));
}
function Ml(t) {
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
function _l(t, e) {
  const n = Math.round(Number(t) || 0);
  return Al(n, 0, Math.max(0, e - 1));
}
function rt(t, e, n, i, r) {
  return `${t}:${e}:${n}:${i}:${r}`;
}
function Ol(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function _n(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function On(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function wn() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function wl(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class Dl {
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
    this.connection = e, this.resourceClient = Gs(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? hl, this.maxBatchesInFlight = Rn(
      n.maxFramesInFlight,
      pl
    ), this.mipLevelCount = n.mipLevelCount ?? Ki, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Rl) || 0)), this.serviceLoadTimeoutMs = Rn(n.serviceLoadTimeoutMs, Tl), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, R("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(rl, this.handleRuntimeState), this.connection.addEndpointListener?.(ul, this.handleUploadAck), this.connection.addEndpointListener?.(dl, this.handleMipRequest), this.connection.addEndpointListener?.(ml, this.handlePrewarmRequest), this.connection.addEndpointListener?.(fl, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      nl,
      il
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await xl(this.resourceClient, this.catalogPath), R("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < it; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = _n(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      let n = null, i = null;
      for (const [r, o] of this.tableCache)
        e.has(r) || (!i || o.lastUsedSerial < i.lastUsedSerial) && (n = r, i = o);
      if (!n || !i)
        return;
      this.tableCache.delete(n), this.tableCacheBytes -= i.byteCount;
    }
  }
  rememberLoadedTable(e) {
    const n = this.tableCache.get(e.cacheKey);
    if (n)
      return n.lastUsedSerial = this.cacheUseSerial++, n;
    const i = {
      ...e,
      byteCount: _n(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = rt(
          this.serviceTable.dspSessionId,
          this.serviceTable.oscillatorIndex,
          this.serviceTable.generation,
          this.serviceTable.tableIndex,
          n
        );
        this.mipJobs.has(i) || this.mipJobs.set(i, {
          key: i,
          dspSessionId: this.serviceTable.dspSessionId,
          oscillatorIndex: this.serviceTable.oscillatorIndex,
          generation: this.serviceTable.generation,
          tableIndex: this.serviceTable.tableIndex,
          mipIndex: n,
          urgencyLevel: e,
          ...On(this.serviceTable.frameCount),
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
    const { dspSessionId: e, oscillatorIndex: n, generation: i, tableIndex: r } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== r || !this.serviceLoadHasPendingTransfers()) && (R("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: e,
        oscillatorIndex: n,
        generation: i,
        tableIndex: r,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: e,
          oscillatorIndex: n,
          generation: i,
          tableIndex: r
        },
        {
          failurePhase: Tn,
          failureReasonCode: En
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== Tn || e.failureReasonCode !== En ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = xe,
    failureReasonCode: s = q
  }) {
    this.connection.sendEventOrValue?.(al, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: i,
      generation: r,
      candidateAttemptSerial: o,
      failurePhase: a,
      failureReasonCode: s
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: i,
    tableIndex: r,
    failureReasonCode: o = q
  }) {
    this.connection.sendEventOrValue?.(sl, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(e) {
    R("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? An(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(ol, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), r = _l(e, i.tables.length), o = i.tables[r];
    Mn(o, `Could not resolve table ${r}`);
    const a = Ol(o, we, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, R("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const l = wn();
    R("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const u = await this.resourceClient.readAudio(o.sourceWav), c = el(u.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: we
    });
    return R("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: c.frameCount,
      loadDurationMs: Math.round(wn() - l)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: r,
      tableMeta: o,
      frameCount: c.frameCount,
      frames: c.frames,
      spectra: new Array(c.frameCount)
    });
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.oscillatorIndex === e.oscillatorIndex && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, i) {
    R("info", "Committing desired wavetable load", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      generation: n,
      tableIndex: e.desiredTableIndex,
      tableName: i.tableMeta?.name ?? null,
      frameCount: i.frameCount
    }), this.serviceTable = {
      ...i,
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(ll, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    R("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: xe,
      failureReasonCode: q
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: xe,
      failureReasonCode: q
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = xe,
    failureReasonCode: i = q
  } = {}) {
    R("error", "Service wavetable load failed", {
      kind: e.kind,
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failurePhase: n,
      failureReasonCode: i
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.tableIndex,
      generation: e.generation,
      candidateAttemptSerial: 0,
      failurePhase: n,
      failureReasonCode: i
    }), e.kind === "loading" && this.emitServiceLoadAbort({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.generation,
      tableIndex: e.tableIndex,
      failureReasonCode: i
    });
  }
  async prepareServiceTarget(e, n) {
    if (this.isMatchingServiceTable(e)) {
      this.serviceTable && (this.serviceTable.mode = e.kind);
      const o = this.candidateValidations[e.oscillatorIndex];
      return o && o.dspSessionId === e.dspSessionId && o.generation === e.generation && o.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
    }
    let i = null;
    try {
      i = await this.loadTableSource(e.tableIndex);
    } catch (o) {
      return this.isCurrentRuntimeState(n) && (R("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: ot(o)
      }), this.handleServiceTargetFailure(e)), !1;
    }
    if (!i || !this.isCurrentRuntimeState(n))
      return !1;
    this.serviceTable = {
      ...i,
      mode: e.kind,
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: e.generation,
      desiredIntentSerial: n.desiredIntentSerial
    }, this.clearMipTransferState(), e.kind === "loading" && (this.createFullMipJobsForServiceTable(2), this.pumpUploads());
    const r = this.candidateValidations[e.oscillatorIndex];
    return r && r.dspSessionId === e.dspSessionId && r.generation === e.generation && r.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
  }
  async prepareDesiredLoad(e) {
    const n = e.desiredTableIndex, i = this.candidateValidations[e.oscillatorIndex];
    if (i && i.dspSessionId === e.dspSessionId && i.tableIndex === n && i.desiredIntentSerial === e.desiredIntentSerial)
      return;
    const r = Math.max(
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
        detail: ot(a)
      }), this.handleCandidateLoadFailure(e));
      return;
    }
    !o || !this.isCurrentRuntimeState(e) || this.markCommittedDesiredLoad(e, r, o);
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
    for (let e = 0; e < it; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, wl(() => {
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
    const n = e.oscillatorIndex, i = this.firstRuntimeStateInSession[n] ?? !1;
    this.firstRuntimeStateInSession[n] = !1;
    const r = this.candidateValidations[n];
    if (r && r.dspSessionId === e.dspSessionId && r.generation > e.generationFrontier)
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
          failureReasonCode: q
        }), this.serviceTable = null, this.clearMipTransferState();
        return;
      }
      o.kind === "active" && e.desiredTableIndex !== o.tableIndex && !this.shouldStayIdleOnFailure(e) && !i && await this.prepareDesiredCandidate(e);
      return;
    }
    if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(e)) {
      this.autoRetryConsumedKeys[n] = this.getDesiredRetryKey(e), this.emitRetryDesiredTableRequest(n);
      return;
    }
    e.serviceState !== 0 || this.shouldStayIdleOnFailure(e) || await this.prepareDesiredLoad(e);
  }
  handleRuntimeState(e) {
    const n = Ml(e ?? {});
    if (R("info", "Received runtime state", An(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= it)
      return;
    const i = n.dspSessionId !== this.knownSessionId;
    i && this.resetSessionState(n);
    const r = n.oscillatorIndex, o = this.latestRuntimeStates[r], a = o ? this.getDesiredRetryKey(o) : null, s = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[r] = Math.max(
      this.nextLoadGenerations[r] ?? 1,
      n.generationFrontier + 1
    ), (i || a !== s) && (this.autoRetryConsumedKeys[r] = null), this.latestRuntimeStates[r] = n, this.pendingRuntimeStateOscillators.add(r), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(i))
      try {
        const r = await this.loadTableSource(i);
        for (let a = 0; a < r.frameCount; a += 1)
          r.spectra[a] || (r.spectra[a] = bn(r.frames[a]));
        const o = this.tableCache.get(r.cacheKey);
        o && this.refreshCacheEntryByteCount(o), R("info", "Prewarmed wavetable source table", {
          tableIndex: r.tableIndex,
          tableId: r.tableMeta.tableId,
          tableName: r.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (r) {
        R("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: ot(r)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), r = Math.trunc(Number(e?.generation)), o = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), s = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || r !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const l = rt(
      n,
      i,
      r,
      o,
      a
    );
    let u = this.mipJobs.get(l);
    return u ? (!u.completed && s > u.urgencyLevel && (u.urgencyLevel = s), u) : (u = {
      key: l,
      dspSessionId: n,
      oscillatorIndex: i,
      generation: r,
      tableIndex: o,
      mipIndex: a,
      urgencyLevel: s,
      ...On(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(l, u), u);
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), l = Math.trunc(Number(n.frameIndexBase)), u = Math.trunc(Number(n.frameCount)), c = rt(
      i,
      r,
      o,
      a,
      s
    ), d = this.mipJobs.get(c), p = this.serviceTable?.frameCount ?? 0, m = Math.min(
      yt,
      p - l
    );
    if (!(!d || d.completed || !d.inFlightBatchBases.has(l) || u <= 0 || u !== m)) {
      d.inFlightBatchBases.delete(l);
      for (let h = 0; h < u; h += 1) {
        const I = l + h;
        d.ackedFrames[I] || (d.ackedFrames[I] = 1, d.ackedFrameCount += 1);
      }
      d.ackedFrameCount === p && d.nextFrameIndex >= p && d.inFlightBatchBases.size === 0 && (d.completed = !0, this.activeUploadKey === d.key && (this.activeUploadKey = null)), xn(l, u, p) && R("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: r,
        generation: o,
        tableIndex: d.tableIndex,
        mipIndex: s,
        frameIndexBase: l,
        batchFrameCount: u,
        ackedFrameCount: d.ackedFrameCount,
        frameCount: p,
        inFlightBatches: d.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (Mn(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = bn(this.serviceTable.frames[e]);
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
      const n = e.nextFrameIndex, i = Math.min(
        yt,
        this.serviceTable.frameCount - n
      ), r = new Float32Array(gl);
      try {
        for (let o = 0; o < i; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), l = tl(s, e.mipIndex);
          r.set(l, o * we);
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
            failurePhase: El,
            failureReasonCode: q
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(cl, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(r)
      }), xn(n, i, this.serviceTable.frameCount) && R("info", "Sent wavetable mip batch", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        batchFrameCount: i,
        frameCount: this.serviceTable.frameCount,
        inFlightBatches: e.inFlightBatchBases.size + 1
      }), e.inFlightBatchBases.add(n), e.nextFrameIndex += i, this.armServiceLoadWatchdog();
    }
    e.ackedFrameCount === this.serviceTable.frameCount && e.nextFrameIndex >= this.serviceTable.frameCount && e.inFlightBatchBases.size === 0 && (e.completed = !0, this.activeUploadKey = null, this.pumpUploads());
  }
}
function ot(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function kl(t, e = {}) {
  return new Dl(t, e);
}
function Ll(t, e, n) {
  if (!Number.isFinite(t.durationSec) || t.durationSec <= 0)
    throw new Error("Speedrun performance duration must be positive and finite.");
  const i = Math.max(1, Math.round(t.durationSec * n)), r = t.events.map((a) => ({
    sample: Math.max(0, Math.min(i - 1, Math.round(a.atSec * n))),
    code: Math.trunc(a.code)
  })).sort((a, s) => a.sample - s.sample || a.code - s.code), o = [];
  for (let a = 0; a < e; a += i)
    for (const s of r) {
      const l = a + s.sample;
      l < e && o.push({ sample: l, code: s.code });
    }
  return o;
}
const Me = 1600, Nl = /* @__PURE__ */ new Set([
  "runtimeState",
  "runtimeInstallAck",
  "effectiveRackState"
]);
function he(t, e, n) {
  const i = `${e}_${n}`, r = t[i];
  if (typeof r != "function")
    throw new Error(`Offline performer is missing ${i}().`);
  return r.bind(t);
}
function Cl(t) {
  return t && typeof t == "object" && "event" in t ? t.event : t;
}
function Pl(t) {
  return {
    values: {
      [ie]: t.modulation,
      [Ti]: t.lane,
      [ae]: t.articulations
    }
  };
}
class Fl {
  performer;
  #r;
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
  #i = null;
  #s = 0;
  constructor(e, n, i) {
    this.performer = new e(), this.#n = n, this.#d = new URL("./", i), this.#r = new Map(
      this.performer.getInputEndpoints().map((r) => [r.endpointID, r])
    ), this.#e = new Map(
      this.performer.getOutputEndpoints().map((r) => [r.endpointID, r])
    );
  }
  async initialise(e, n) {
    await this.performer.initialise(e, n);
  }
  setInitialParameters(e) {
    for (const [n, i] of Object.entries(e))
      this.writeValue(n, i);
  }
  sendEventOrValue(e, n) {
    const i = this.#r.get(e);
    if (!i) throw new Error(`Offline performer has no input endpoint ${e}.`);
    if (i.endpointType === "event") {
      he(this.performer, "sendInputEvent", e)(n), this.#a.set(e, (this.#a.get(e) ?? 0) + 1);
      return;
    }
    if (i.endpointType === "value") {
      if (typeof n != "number" || !Number.isFinite(n))
        throw new Error(`Offline value endpoint ${e} requires a finite number.`);
      this.writeValue(e, n);
      return;
    }
    throw new Error(`Offline input ${e} has unsupported type ${i.endpointType}.`);
  }
  sendMIDIInputEvent(e, n) {
    this.sendEventOrValue(e, { message: n });
  }
  addEndpointListener(e, n) {
    const i = this.#c.get(e) ?? /* @__PURE__ */ new Set();
    i.add(n), this.#c.set(e, i);
  }
  removeEndpointListener(e, n) {
    this.#c.get(e)?.delete(n);
  }
  addParameterListener(e, n) {
    const i = this.#u.get(e) ?? /* @__PURE__ */ new Set();
    i.add(n), this.#u.set(e, i);
  }
  removeParameterListener(e, n) {
    this.#u.get(e)?.delete(n);
  }
  requestParameterValue(e) {
    const n = this.#f.get(e);
    if (n !== void 0)
      for (const i of this.#u.get(e) ?? []) i(n);
  }
  requestFullStoredState(e) {
    e(Pl(this.#n));
  }
  getResourceAddress(e) {
    return new URL(e, this.#d);
  }
  sendNativeArticulationTriggerConfig(e) {
    this.#i = e;
  }
  getInstallationState() {
    return {
      runtimeStates: new Map(this.#t),
      runtimeInstallAck: this.#o,
      effectiveRackState: this.#m,
      articulationTriggerConfig: this.#i,
      inputEventCounts: new Map(this.#a),
      outputEventCounts: new Map(this.#l),
      advancedFrames: this.#s
    };
  }
  async pump(e) {
    let n = e;
    for (; n > 0; ) {
      const i = Math.min(128, n);
      this.advance(i), n -= i, await Promise.resolve();
    }
  }
  render(e, n, i) {
    const r = new Float32Array(e), o = new Float32Array(e);
    this.advance(e), this.performer.getOutputFrames_audioOut([r, o], e, 0);
    for (let a = 0; a < e; a += 1) {
      const s = (i + a) * 2;
      n[s] = r[a], n[s + 1] = o[a];
    }
  }
  writeValue(e, n) {
    const i = this.#r.get(e);
    if (!i || i.endpointType !== "value")
      throw new Error(`Offline performer has no value endpoint ${e}.`);
    he(
      this.performer,
      "setInputValue",
      e
    )(n, 0), this.#f.set(e, n);
    for (const r of this.#u.get(e) ?? []) r(n);
  }
  advance(e) {
    if (!Number.isInteger(e) || e < 1 || e > 128)
      throw new Error("OfflineEngineHost advances must contain 1 to 128 frames.");
    this.performer.advance(e), this.#s += e, this.drainOutputEvents();
  }
  drainOutputEvents() {
    const e = /* @__PURE__ */ new Set([
      ...Nl,
      ...this.#c.keys()
    ]);
    for (const n of e) {
      const i = this.#e.get(n);
      if (!i || i.endpointType !== "event") continue;
      const r = he(
        this.performer,
        "getOutputEventCount",
        n
      )();
      if (r < 1) continue;
      const o = he(
        this.performer,
        "getOutputEvent",
        n
      ), a = Array.from({ length: r }, (s, l) => Cl(o(l)));
      he(
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
    const i = n;
    if (e === "runtimeState") {
      const r = Math.trunc(Number(i.oscillatorIndex));
      r >= 0 && r < 3 && this.#t.set(r, i);
    } else e === "runtimeInstallAck" ? this.#o = i : e === "effectiveRackState" && (this.#m = i);
  }
}
const Dn = "assets/factory-bank-catalog.json";
function Ul(t) {
  return {
    async readText(e) {
      if (e !== Dn) throw new Error(`Speedrun resource bundle has no text ${e}.`);
      return JSON.stringify(t.catalog);
    },
    async readJSON(e) {
      if (e !== Dn) throw new Error(`Speedrun resource bundle has no JSON ${e}.`);
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
const Kl = [
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
class pe extends Error {
  constructor(e, n, i = {}) {
    super(`${e} install failed: ${n}`, i), this.lane = e, this.name = "SpeedrunInstallError";
  }
}
function Bl(t) {
  let e = 0;
  for (const n of t) {
    if (n.endpointID !== dt || typeof n.value != "object" || n.value === null)
      continue;
    const i = n.value.deliverySerial;
    typeof i == "number" && Number.isFinite(i) && i > 0 && (e = Math.max(e, i));
  }
  return e;
}
function $l(t) {
  const e = Object.fromEntries(t.modulation.routes.flatMap((i) => {
    const r = At(i);
    return r === null ? [] : [[i.id, r]];
  })), n = Li(t.lane);
  return {
    tableIndices: S.map((i) => Math.round(Number(t.parameters[`osc${i}WavetableSelect`]) || 0)),
    modulationFrontier: mi(t.modulation, null).length,
    articulationFrontier: pi(
      t.articulations,
      e
    ).length,
    rackChainLength: ki(t.lane).chainLength,
    rackParamSerial: Bl(n)
  };
}
function Vl(t, e) {
  for (let r = 0; r < e.tableIndices.length; r += 1) {
    const o = t.runtimeStates.get(r);
    if (o && o.hasFailure && Number(o.failedTableIndex) === e.tableIndices[r])
      return new pe(
        "wavetable",
        `oscillator ${r + 1} rejected table ${e.tableIndices[r]}.`
      );
  }
  const n = Math.trunc(Number(t.runtimeInstallAck?.rejectedSerial) || 0);
  if (n > 0)
    return new pe("modulation", `runtime serial ${n} was rejected.`);
  if (n < 0)
    return new pe("articulation", `runtime serial ${n} was rejected.`);
  const i = Math.trunc(
    Number(t.effectiveRackState?.laneRejectedUploadCount) || 0
  );
  return i > 0 ? new pe("rack", `${i} topology upload(s) were rejected.`) : null;
}
function kn(t, e) {
  const n = e.tableIndices.every((a, s) => {
    const l = t.runtimeStates.get(s);
    return !!l?.hasActive && Number(l?.activeTableIndex) === a;
  }), i = e.modulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedModulationSerial) >= e.modulationFrontier, r = e.articulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedArticulationSerial) <= -e.articulationFrontier, o = Number(t.effectiveRackState?.laneCommittedChainLength) === e.rackChainLength && Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) >= e.rackParamSerial;
  return n && i && r && o;
}
function zl(t, e) {
  return e.tableIndices.every((n, i) => {
    const r = t.runtimeStates.get(i);
    return !!r?.hasActive && Number(r?.activeTableIndex) === n;
  }) ? e.modulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedModulationSerial) < e.modulationFrontier ? "modulation" : e.articulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedArticulationSerial) > -e.articulationFrontier ? "articulation" : "rack" : "wavetable";
}
function Hl(t) {
  return `${[0, 1, 2].map((n) => {
    const i = t.runtimeStates.get(n);
    return i ? `${n}:${Number(i.activeGeneration) || 0}/${Number(i.generationFrontier) || 0} load=${Number(i.loadingGeneration) || 0} active=${!!i.hasActive}` : `${n}:missing`;
  }).join(", ")}; mod=${Number(t.runtimeInstallAck?.acceptedModulationSerial) || 0} art=${Number(t.runtimeInstallAck?.acceptedArticulationSerial) || 0} rack=${Number(t.effectiveRackState?.laneCommittedChainLength) || 0} params=${Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) || 0} mipSent=${t.inputEventCounts.get("wavetableMipFrame") ?? 0} mipAck=${t.outputEventCounts.get("wavetableUploadAck") ?? 0}`;
}
function Vi(t) {
  return t >>> 16 & 255;
}
function zi(t) {
  return t >>> 8 & 127;
}
function Ct(t) {
  return t & 127;
}
function Wl(t, e, n) {
  if (t === null) return null;
  let i;
  try {
    i = JSON.parse(t);
  } catch {
    return null;
  }
  const r = i.activeMode, o = r === "key" ? i.key : r === "vel" ? i.velocity : i.chain;
  if (!Array.isArray(o)) return null;
  const a = r === "key" ? zi(e) : r === "vel" ? Ct(e) : n % 128, s = Math.trunc(Number(o[a]));
  return s >= 0 && s <= 127 ? s : null;
}
function ql(t, e, n, i) {
  const r = Vi(e);
  if ((r & 240) === 144 && Ct(e) > 0) {
    const o = Wl(n, e, i);
    o !== null && t.sendEventOrValue("articulationNoteMeta", {
      channel: r & 15,
      noteNumber: zi(e),
      selectorA: o,
      selectorB: 0,
      durationSamples: 0,
      ageSamples: 0
    });
  }
  t.sendMIDIInputEvent("midiIn", e);
}
async function jl() {
  await new Promise((t) => setTimeout(t, 0));
}
async function Gl(t, e) {
  const n = globalThis.performance?.now?.() ?? 0, i = new Fl(t, {
    modulation: e.state.modulation,
    lane: e.state.lane,
    articulations: e.state.articulations
  }, e.resourceBaseURL);
  await i.initialise(e.sessionID, e.sampleRate), i.setInitialParameters(e.state.parameters), i.sendEventOrValue("tempo", { bpm: 120 });
  const r = await vs(i, [
    Ls,
    Ks,
    () => kl(i, {
      maxFramesInFlight: 1,
      serviceLoadTimeoutMs: 2e4,
      ...e.resourceBundle ? { resourceClient: Ul(e.resourceBundle) } : {}
    })
  ]), o = $l(e.state), a = e.maxInstallFrames ?? e.sampleRate * 4;
  let s = 0;
  try {
    for (; s < a; ) {
      await i.pump(128), s += 128;
      const y = i.getInstallationState(), M = Vl(y, o);
      if (M) throw M;
      if (kn(y, o)) break;
      s / 128 % 8 === 0 && await jl();
    }
    const b = i.getInstallationState();
    if (!kn(b, o)) {
      const y = zl(b, o);
      throw new pe(
        y,
        `timed out after ${s} virtual frames (${Hl(b)}).`
      );
    }
  } finally {
    await r.stop();
  }
  const l = new Float32Array(e.frameCount * 2), u = Ll(e.performance, e.frameCount, e.sampleRate), c = i.getInstallationState().articulationTriggerConfig, d = e.recordTelemetry === !0, p = /* @__PURE__ */ new Map();
  let m = 0, h = 0, I = 0;
  d && (i.sendEventOrValue("filterSpectrumActivity", 1), i.sendEventOrValue("distortionScopeActivity", 1), i.sendEventOrValue("distortionHistoryActivity", 1));
  const k = d ? Kl.map((b) => {
    const y = (M) => {
      const w = Math.floor(h / Me), N = p.get(w) ?? {};
      N[b] = structuredClone(M), p.set(w, N);
    };
    return i.addEndpointListener(b, y), { endpointID: b, listener: y };
  }) : [];
  try {
    for (; h < e.frameCount; ) {
      for (; m < u.length && u[m].sample === h; ) {
        const w = u[m];
        ql(i, w.code, c, I), (Vi(w.code) & 240) === 144 && Ct(w.code) > 0 && (I += 1), m += 1;
      }
      const b = u[m]?.sample ?? e.frameCount, y = (Math.floor(h / Me) + 1) * Me, M = Math.min(
        128,
        e.frameCount - h,
        b - h,
        ...d ? [y - h] : []
      );
      if (M < 1)
        throw new Error("Speedrun checkpoint render computed an empty advance.");
      i.render(M, l, h), h += M;
    }
  } finally {
    for (const { endpointID: b, listener: y } of k)
      i.removeEndpointListener(b, y);
  }
  const L = (globalThis.performance?.now?.() ?? n) - n;
  return {
    rootIndex: e.rootIndex,
    rootNote: e.rootNote,
    checkpointIndex: e.checkpointIndex,
    frameCount: e.frameCount,
    samples: l,
    telemetry: {
      frameCount: Math.ceil(e.frameCount / Me),
      frames: [...p.entries()].sort(([b], [y]) => b - y).map(([b, y]) => ({ frame: b, events: y }))
    },
    metrics: {
      renderedFrameCount: e.frameCount,
      installFrameCount: s,
      elapsedMilliseconds: L,
      realtimeMultiplier: L > 0 ? e.frameCount / (L * e.sampleRate / 1e3) : null
    }
  };
}
const _e = self;
function Jl(t) {
  return {
    name: t instanceof Error ? t.name : "Error",
    message: t instanceof Error ? t.message : String(t),
    stack: t instanceof Error ? t.stack : void 0
  };
}
_e.addEventListener("message", (t) => {
  const e = t.data;
  (async () => {
    if (e.type !== "render-root" || typeof e.engineModuleURL != "string")
      throw new Error("Speedrun checkpoint worker received an unsupported request.");
    const i = await import(new URL(e.engineModuleURL, _e.location.href).href), r = i.default ?? i.WavetableSynth, o = await Gl(
      r,
      e.job
    );
    _e.postMessage({
      type: "render-root-complete",
      requestID: e.requestID,
      result: o
    }, [o.samples.buffer]);
  })().catch((n) => {
    _e.postMessage({
      type: "render-root-failed",
      requestID: e.requestID,
      error: Jl(n)
    }, []);
  });
});
