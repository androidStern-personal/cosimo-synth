const sr = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function Hn(t) {
  const e = sr.find((n) => n.deviceType === t);
  if (e === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${t}`);
  return e;
}
function P(t) {
  return Hn(t).laneEndpointID;
}
function lr(t, e) {
  if (!Number.isInteger(e) || e < 1 || e > 5)
    throw new Error(`Effect Output Trim instance is out of range: ${e}`);
  return `${Hn(t).hostStem}${e}OutputTrimDb`;
}
function Wn(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function cr(t) {
  const e = (Wn(t, -100, 35) - -100) / 135;
  return e * e;
}
function ur(t) {
  return -100 + Math.sqrt(Wn(t, 0, 1)) * 135;
}
const L = (t, e) => ({ label: t, value: e });
function B(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const $ = Object.freeze({
  filter: B(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: B(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: B(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: B(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: B(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: B(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: B(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: B(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), p = (t, e, n, i, r, o, a, s = {}) => ({
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
function V(t, e, n) {
  return p(
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
const dr = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], fr = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], mr = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: $.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      p("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(L), quick: !0 }),
      p("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      p("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      p("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      V("filter", "globalFilterOutputTrimDb", 39)
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: $.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      p("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [L("Classic", 0), L("Harmonics", 1)] }),
      p("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      p("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      p("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      p("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      p("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      p("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [L("Symmetric", 0), L("Asymmetric", 1), L("Wavefold", 2)] }),
      V("drive", "distortionOutputTrimDb", 40)
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: $.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      p("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      p("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      p("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      p("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      p("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      V("ott", "ottOutputTrimDb", 41)
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: $.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      p("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(L) }),
      p("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(L) }),
      p("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      p("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      p("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      p("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      p("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
        unit: "Hz",
        scale: "log",
        modulationTargetIndex: 17,
        modulationApplication: "semitones",
        modulationIdentityEndpointID: "chorusRingFineSemitones"
      }),
      V("chorus", "chorusOutputTrimDb", 42)
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: $.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      p("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      p("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      p("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      p("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      p("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
        unit: "ms",
        scale: "log",
        modulationTargetIndex: 36,
        modulationApplication: "octaves"
      }),
      V("flanger", "flangerOutputTrimDb", 43)
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: $.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      p("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [L("Free", 0), L("Sync", 1)] }),
      p("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      p("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: dr.map(L) }),
      p("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      p("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      p("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      p("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      p("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      V("phaser", "phaserOutputTrimDb", 44)
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: $.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      p("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [L("Free", 0), L("Sync", 1)] }),
      p("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      p("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: fr.map(L) }),
      p("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      p("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      p("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      V("delay", "delayOutputTrimDb", 45)
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: $.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      p("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      p("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      p("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      p("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      V("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], He = mr, qn = Object.freeze(
  He.flatMap((t) => t.parameters)
);
new Map(
  qn.map((t) => [t.endpointID, t])
);
function jn(t) {
  const e = He.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function Gn() {
  return qn;
}
function xt(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const T = ["A", "B", "C"], Jn = [
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
], hr = [
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
], Z = Object.freeze([
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
]), pr = Object.freeze([
  ...T.flatMap((t) => Jn.map(
    (e) => `osc${t}.${e}`
  )),
  ...hr
]);
new Set(
  T.flatMap((t) => Jn.map(
    (e) => `osc${t}.${e}`
  ))
);
const Qn = Object.freeze(
  pr.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), gr = Gn().filter(
  (t) => t.modulationTargetIndex !== null
), yr = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function Mt(t) {
  const e = Ir(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function Ir(t) {
  const e = yr.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const Sr = [
  ...gr.map((t) => ({
    kind: Mt(xt(t)),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Xn = Object.freeze(
  Sr.sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), W = Object.freeze([
  ...Qn,
  ...Xn
]), ke = Z.length, Yn = Qn.length, We = Xn.length, vr = ke * W.length, br = new Map(Z.map((t) => [t.id, t])), Zn = new Map(Z.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), ce = new Map(W.map((t) => [t.kind, t]));
function Tr() {
  if (ke !== 14 || Yn !== 59 || We !== 47 || vr !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = Z.filter((i) => i.group === t).sort((i, r) => i.runtimeIndex - r.runtimeIndex);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 59], ["rack", 47]]) {
    const n = W.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (br.size !== ke || Zn.size !== ke || ce.size !== W.length)
    throw new Error("Modulation identities must be unique");
}
Tr();
function ei(t, e) {
  const n = Zn.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function wt(t) {
  return typeof t != "string" ? null : ce.has(t) ? t : null;
}
function Er(t) {
  const e = wt(t);
  return e !== null && ce.get(e)?.group === "voice" ? e : null;
}
function _t(t) {
  const e = wt(t);
  return e !== null && ce.get(e)?.group === "rack" ? e : null;
}
function Ar(t) {
  const e = ce.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function ti(t) {
  const e = ce.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function Rr(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const ni = 4, xr = ni * We, Mr = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), wr = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function ee(t) {
  if (typeof t != "string")
    return null;
  const e = wr.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Mr.get(n);
  if (i === void 0)
    return null;
  const r = e[3];
  return i.includes(r) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: r
  } : null;
}
function Ot(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function ii(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function ri(t) {
  if (t === null)
    return null;
  const e = ii(t) - 1;
  return e > ni ? null : e * We + ti(Ot(t));
}
const j = 2048, ye = j + 3, Gt = 20, oi = "MSEG 1", _r = 0, G = 2;
function Ie(t) {
  return t !== null && typeof t == "object" ? t : {};
}
function kt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function le(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function Or(t) {
  return kt(Number.isFinite(t) ? t : 0, -Gt, Gt);
}
function Y(t) {
  return kt(Number.isFinite(t) ? t : 0, 0, 1);
}
function ai(t = oi) {
  return {
    format: "mseg.shape",
    version: 1,
    name: t,
    globalSmooth: !1,
    points: [
      { x: 0, y: 0, curvePower: 0 },
      { x: 1, y: 1, curvePower: 0 }
    ]
  };
}
function si() {
  return {
    format: "mseg.playback",
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
function kr(t) {
  const e = Number(t);
  return kt(
    Number.isFinite(e) ? e : 1,
    _r,
    G
  );
}
function Dr(t) {
  if (!t || typeof t != "object")
    return null;
  const e = Ie(t), n = Y(Number(e.startX)), i = Y(Number(e.endX));
  return le(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function Lr(t = si()) {
  const e = Ie(t), n = Ie(e.rate), i = Number(n.seconds), r = e.noteOffPolicy, o = r === "finish_loop" || r === "immediate" || r === "ignore" ? r : "finish_loop";
  return {
    format: "mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: kr(Number.isFinite(i) ? i : 1)
    },
    loop: Dr(e.loop),
    noteOffPolicy: o,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function Nr(t, e, n) {
  const i = Ie(t);
  let r = Number(i.x);
  return Number.isFinite(r) || (r = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (r = Y(r)), {
    x: r,
    y: Y(Number(i.y)),
    curvePower: Or(Number(i.curvePower))
  };
}
function qe(t = ai()) {
  const e = Ie(t), n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((r, o) => Nr(r, o, n.length));
  if (!le(i[0].x, 0) || !le(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let r = 1; r < i.length; r += 1)
    if (i[r].x < i[r - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : oi,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function Jt(t) {
  return JSON.stringify(qe(t));
}
function Cr(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function Pr(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const i = t[n], r = t[n + 1];
    if (e < r.x)
      return { from: i, to: r, laterPointWins: !1 };
    if (le(e, r.x)) {
      let o = n + 1;
      for (; o + 1 < t.length && le(t[o + 1].x, e); )
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
function Fr(t, e) {
  const n = Y(Number(e)), i = Pr(t, n);
  if (i.laterPointWins || le(i.from.x, i.to.x))
    return i.to.y;
  const r = i.to.x - i.from.x, o = r <= 0 ? 1 : (n - i.from.x) / r, a = Y(Cr(o, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * a;
}
function Ur(t, e) {
  return Fr(qe(t).points, e);
}
function Kr(t) {
  const e = new Float32Array(ye);
  return li(t, e), e;
}
function li(t, e) {
  if (e.length !== ye) throw new Error("Invalid MSEG destination length.");
  const n = qe(t);
  for (let i = 0; i < j; i += 1) {
    const r = i / (j - 1);
    e[i + 1] = Ur(n, r);
  }
  e[0] = e[1], e[j + 1] = e[j], e[j + 2] = e[j];
}
function Qt(t, e) {
  return Jt(t) === Jt(e);
}
function Br(...t) {
  return { ...ai(...t), format: "cosimo.mseg.shape" };
}
function Xt(...t) {
  return { ...qe(...t), format: "cosimo.mseg.shape" };
}
function Yt(...t) {
  return { ...si(...t), format: "cosimo.mseg.playback" };
}
function $r(...t) {
  return { ...Lr(...t), format: "cosimo.mseg.playback" };
}
const Ge = "modulationProgram", Vr = "modulationAmount", ci = Z.filter((t) => t.group === "voice").length, ui = Z.filter((t) => t.group === "macro").length, Ne = Yn, zr = We, Ce = zr + xr, J = ci * Ne, ne = ui * Ne, Hr = ci * Ce, Wr = ui * Ce, q = 512, te = 256, di = J + ne;
function qr(t) {
  const e = ei(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function jr(t) {
  const e = Er(t);
  return e === null ? null : Ar(e);
}
function fi(t) {
  const e = jr(t.targetKind), n = _t(t.targetKind);
  let i = n === null ? void 0 : ti(n);
  if (i === void 0) {
    const a = ri(
      ee(t.targetKind)
    );
    a !== null && (i = a);
  }
  if (e === null && i === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = ei(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (e !== null) {
      const u = s * Ne + e;
      return {
        path: "macroVoice",
        cellIndex: u,
        sourceIndex: s,
        targetIndex: e,
        articulationCellIndex: J + u
      };
    }
    const l = i ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * Ce + l,
      sourceIndex: s,
      targetIndex: l,
      articulationCellIndex: null
    };
  }
  const r = qr(t);
  if (e !== null) {
    const a = r * Ne + e;
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
    cellIndex: r * Ce + o,
    sourceIndex: r,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function Dt(t) {
  return ee(t.targetKind) !== null ? null : fi(t).articulationCellIndex;
}
function Gr(t) {
  if (_t(t.targetKind) !== null)
    return !1;
  const e = ee(t.targetKind);
  return e !== null && ri(e) === null;
}
function Jr(t) {
  return {
    ...fi(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function mi(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (Gr(n))
      continue;
    const i = Jr(n), r = e[i.path];
    if (r.has(i.cellIndex))
      throw new Error(`Duplicate modulation route cell ${i.path}:${i.cellIndex}`);
    r.set(i.cellIndex, i);
  }
  return e;
}
function Qr(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function ie(t) {
  return [...t.values()].filter(Qr).sort((e, n) => e.cellIndex - n.cellIndex);
}
function Te(t, e, n, i, r) {
  for (let o = 0; o < t.length; o += 1) {
    const a = t[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    e[o] = a.cellIndex, n[o] = a.sourceIndex, i[o] = a.targetIndex, r[o] = a.polarity;
  }
}
function Je(t) {
  const e = mi(t), n = ie(e.voice), i = ie(e.macroVoice), r = ie(e.voiceRack), o = ie(e.macroRack), a = Array.from({ length: J }, () => 0), s = Array.from({ length: J }, () => 0), l = Array.from({ length: J }, () => 0), u = Array.from({ length: J }, () => 0), c = Array.from({ length: J }, () => 0);
  Te(n, a, s, l, u);
  const f = Array.from({ length: ne }, () => 0), d = Array.from({ length: ne }, () => 0), m = Array.from({ length: ne }, () => 0), h = Array.from({ length: ne }, () => 0), I = Array.from({ length: ne }, () => 0);
  if (Te(
    i,
    f,
    d,
    m,
    h
  ), r.length > q || o.length > te)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${r.length} voice-rack (max ${q}), ${o.length} macro-rack (max ${te})`
    );
  const g = Array.from({ length: q }, () => 0), v = Array.from({ length: q }, () => 0), S = Array.from({ length: q }, () => 0), y = Array.from({ length: q }, () => 0), R = Array.from({ length: q }, () => 0), w = Array.from({ length: Hr }, () => 0);
  Te(
    r,
    g,
    v,
    S,
    y
  );
  const N = Array.from({ length: te }, () => 0), zt = Array.from({ length: te }, () => 0), Ht = Array.from({ length: te }, () => 0), Wt = Array.from({ length: te }, () => 0), qt = Array.from({ length: Wr }, () => 0);
  Te(
    o,
    N,
    zt,
    Ht,
    Wt
  );
  for (const k of e.voice.values()) c[k.cellIndex] = k.amount;
  for (const k of e.macroVoice.values()) I[k.cellIndex] = k.amount;
  for (const k of e.voiceRack.values()) w[k.cellIndex] = k.amount;
  for (const k of e.macroRack.values()) qt[k.cellIndex] = k.amount;
  for (let k = 0; k < r.length; k += 1) {
    const jt = r[k];
    if (jt === void 0) throw new Error(`Missing compiled voice-rack route at index ${k}`);
    R[k] = jt.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: l,
    voiceRoutePolarities: u,
    voiceRouteAmounts: c,
    macroVoiceRouteCount: i.length,
    macroVoiceRouteCells: f,
    macroVoiceRouteSources: d,
    macroVoiceRouteTargets: m,
    macroVoiceRoutePolarities: h,
    macroVoiceRouteAmounts: I,
    voiceRackRouteCount: r.length,
    voiceRackRouteCells: g,
    voiceRackRouteSources: v,
    voiceRackRouteTargets: S,
    voiceRackRoutePolarities: y,
    voiceRackRouteReducers: R,
    voiceRackRouteAmounts: w,
    macroRackRouteCount: o.length,
    macroRackRouteCells: N,
    macroRackRouteSources: zt,
    macroRackRouteTargets: Ht,
    macroRackRoutePolarities: Wt,
    macroRackRouteAmounts: qt
  };
}
const Xr = ["voice", "macroVoice", "voiceRack", "macroRack"], Yr = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Zt(t) {
  return mi(t);
}
function Zr(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function eo(t, e) {
  if (t === null)
    return [{ endpointID: Ge, value: Je(e) }];
  const n = Zt(t), i = Zt(e), r = [];
  for (const o of Xr) {
    const a = ie(n[o]), s = ie(i[o]);
    if (a.length !== s.length)
      return [{ endpointID: Ge, value: Je(e) }];
    for (let l = 0; l < s.length; l += 1) {
      const u = a[l], c = s[l];
      if (u === void 0 || c === void 0 || !Zr(u, c))
        return [{ endpointID: Ge, value: Je(e) }];
      u.amount !== c.amount && r.push({
        endpointID: Vr,
        value: {
          pathKind: Yr[o],
          cellIndex: c.cellIndex,
          amount: c.amount
        }
      });
    }
  }
  return r;
}
function ue(t) {
  return { _tag: "ok", value: t };
}
function ge(t) {
  return { _tag: "err", error: t };
}
function to(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function no(t) {
  throw new Error(t ?? "Invariant violated");
}
const io = "globalTune", ro = "globalTuneSemitones", z = -24, de = 24, en = 0, hi = -48, pi = 48, ft = -48, gi = 6, Lt = 0, tn = (Lt - ft) / (gi - ft), oo = "voiceEnhancerFrequency", ao = "voiceEnhancerQ", so = "voiceEnhancerAmount", lo = "voiceEnhancerFrequencyOctaves", co = "voiceEnhancerQ", uo = "voiceEnhancerAmount", yi = "voice.enhancerFrequency", fo = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: oo,
    targetKind: lo,
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
    endpointID: ao,
    targetKind: co,
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
    endpointID: so,
    targetKind: uo,
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
function nn(t, e) {
  const n = Math.min(t.max, Math.max(t.min, e));
  return t.scale === "log" ? Math.log(n / t.min) / Math.log(t.max / t.min) : (n - t.min) / (t.max - t.min);
}
function mo(t, e) {
  const n = Math.min(1, Math.max(0, e));
  return t.scale === "log" ? t.min * (t.max / t.min) ** n : t.min + (t.max - t.min) * n;
}
function Ee(t, e, n, i, r = "percent", o = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: o };
}
const ho = [
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
], rn = 1e-6;
function U(t, e) {
  if (!Number.isFinite(t) || t < -rn || t > 1 + rn)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function Pe(t, e) {
  return U(t / 100, `${e} catalog percentage`);
}
function Se(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function po(t) {
  return 20 * 1e3 ** t;
}
function go(t) {
  return U(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function yo(t) {
  return 0.1 * 200 ** t;
}
function Io(t) {
  return U(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function So(t) {
  return t;
}
function vo(t) {
  return U(t, "filterMix endpoint conversion");
}
function ae(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function bo(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: ae("filterCutoff", po, go),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: ae("filterQ", yo, Io),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: ae("filterMix", So, vo),
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
function Ii(t) {
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
      return to(t);
  }
}
function To(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Eo(t, e) {
  const n = Se(t.moduleId, e.id), i = Ii(e.format), r = bo(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: Pe(e.defaultPercent, n),
    initialValue: Pe(e.initialPercent, n),
    format: i,
    modAmount: To(i),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const Ao = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: tn * 100, defaultPercent: tn * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Ro(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function xo(t, e) {
  const n = `osc${t}`, i = Se(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: Pe(e.defaultPercent, i),
    initialValue: Pe(e.initialPercent, i),
    format: Ii(e.format),
    modAmount: Ro(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Mo = Object.freeze(
  T.flatMap((t) => Ao.map((e) => xo(t, e)))
), wo = Object.freeze({
  targetId: Se("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: U(
    (en - z) / (de - z),
    "Global Tune default"
  ),
  initialValue: U(
    (en - z) / (de - z),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: de },
  modAmount: {
    min: hi,
    max: pi,
    unit: "st",
    digits: 2
  },
  binding: ae(
    io,
    (t) => z + (de - z) * t,
    (t) => U(
      (t - z) / (de - z),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: ro
});
function _o(t) {
  const e = Se("voice-enhancer", t.key), n = U(
    nn(t, t.initial),
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
    binding: ae(
      t.endpointID,
      (i) => mo(t, i),
      (i) => U(
        nn(t, i),
        `${t.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: t.targetKind
  });
}
const Oo = Object.freeze(
  Object.values(fo).map(_o)
), ko = Object.freeze([
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
function Do(t) {
  const e = Se(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (o) => t.min + n * o, r = (o) => U(
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
    binding: ae(t.endpointID, i, r),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const Lo = Object.freeze(
  ko.map(Do)
), No = Object.freeze([
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
function Co(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function Qe(t, e) {
  const n = t.valueKind === "effect-output-trim-db" ? cr(e) : t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return U(n, `${t.endpointID} endpoint conversion`);
}
function Po(t, e) {
  return t.valueKind === "effect-output-trim-db" ? ur(e) : t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Fo(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Uo(t) {
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
function Ko(t) {
  const e = Co(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: Qe(t, t.initial),
    initialValue: Qe(t, t.initial),
    format: Fo(t),
    modAmount: Uo(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Po(t, n),
      fromEngine: (n) => Qe(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : Mt(xt(t))
  });
}
const Nt = Object.freeze(
  [
    ...He.flatMap((t) => t.parameters.map(Ko)),
    ...No,
    wo,
    ...Oo,
    ...Mo,
    ...Lo,
    ...ho.flatMap(
      (t) => t.parameters.map(
        (e) => Eo(t, e)
      )
    )
  ]
), Bo = new Map(
  Nt.map((t) => [t.targetId, t])
), Si = Nt.filter(
  (t) => t.modulationTargetKind !== null
), mt = new Map(
  Si.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Bo.size !== Nt.length)
  throw new Error("Target descriptor IDs must be unique");
if (Si.length !== W.length || mt.size !== W.length || W.some((t) => mt.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function Xe(t) {
  const e = mt.get(t);
  return e === void 0 ? no(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  He.map((t) => [t.id, t.label])
);
function $o(t) {
  const e = ii(t);
  return e === 1 ? "" : ` ${e}`;
}
function Vo(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = Xe(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = ee(t);
  if (n !== null) {
    const i = Xe(Ot(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : i.moduleId.toUpperCase()}${$o(n)} ${i.label.toUpperCase()}`;
  }
  return Xe(t).label.toUpperCase();
}
const Q = "modulation.v6", vi = 6, ve = 3, re = 3, zo = 4, on = "modulationMsegBuffer", Ho = "modulationMsegPlayback", bi = 4, Wo = ["MSEG 1", "MSEG 2", "MSEG 3"], Ti = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], qo = ["Env 1", "Env 2", "Env 3"], jo = 1e-3, A = 10, Go = 0.1, Jo = 20, an = 10 - 0.1, Qo = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Jo - Go },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: hi,
    max: pi
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
  mseg1Rate: { min: -G, max: G },
  mseg2Rate: { min: -G, max: G },
  mseg3Rate: { min: -G, max: G },
  env1Attack: { min: -A, max: A },
  env1Decay: { min: -A, max: A },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -A, max: A },
  env2Attack: { min: -A, max: A },
  env2Decay: { min: -A, max: A },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -A, max: A },
  env3Attack: { min: -A, max: A },
  env3Decay: { min: -A, max: A },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -A, max: A },
  ampAttack: { min: -A, max: A },
  ampDecay: { min: -A, max: A },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -A, max: A },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -an, max: an },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Xo = Gn().filter((t) => t.modulationTargetIndex !== null), Yo = new Map(
  Xo.map((t) => [
    Mt(xt(t)),
    t
  ])
);
class Ye extends Error {
  name = "ModulationStateParseError";
}
const Zo = {
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
Z.map((t) => ({
  value: t.id,
  label: Zo[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const ea = W.map((t) => ({
  value: t.kind,
  label: Vo(t.kind)
}));
ea.filter((t) => !na(t.value));
function ta(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Ct(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Ze(t, e) {
  const n = Number(t);
  return Ct(Number.isFinite(n) ? n : e, jo, A);
}
function na(t) {
  return _t(t) !== null;
}
function ia(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (t.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function ra(t) {
  const e = ee(t);
  return e !== null ? Ot(e) : t;
}
function oa(t) {
  const e = ra(t);
  if (ee(e)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = Yo.get(e);
  return n !== void 0 ? ia(n) : Qo[Rr(e)];
}
function aa(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function sa(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function la(t, e) {
  const n = oa(t), i = Number(e);
  return Ct(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function ca(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function ua(t) {
  return ca(t) ?? "mseg";
}
function da(t) {
  const e = wt(t);
  return e !== null ? e : ee(t) !== null ? t : null;
}
function fa(t) {
  return da(t) ?? "oscA.wavetablePosition";
}
function ma(t, e) {
  const n = Ti[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function ha(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? ve : t === "macro" ? bi : zo;
  return Ct(Number.isFinite(n) ? n : 1, 1, i);
}
function oe(t) {
  return {
    name: qo[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Ei(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = oe(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: Ze(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: Ze(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: Y(n.sustain ?? i.sustain),
    releaseSeconds: Ze(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function pa(t, e = 0) {
  return { name: Ei(t, e).name };
}
function ga(t, e, n, i) {
  const r = Number(t.amount);
  return {
    id: aa(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: ha(n, t.sourceSlot),
    polarity: sa(t.polarity),
    targetKind: i,
    amount: la(i, r),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function ya(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, r = ua(i.sourceKind), o = fa(i.targetKind);
  return ga(i, e, r, o);
}
function Ia(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function Sa(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => ya(n, i));
}
function va(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const r = Ia(i);
    if (e.has(i.id) || n.has(r))
      return !1;
    e.add(i.id), n.add(r);
  }
  return !0;
}
function ht(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, s) => ht(a, e[s]));
  const n = t, i = e, r = Object.keys(n), o = Object.keys(i);
  return r.length === o.length && r.every((a) => ta(i, a) && ht(n[a], i[a]));
}
function Ai(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = Br(Wo[e] ?? `MSEG ${e + 1}`), r = Xt(n.shapeA ?? i), o = $r({
    ...Yt(),
    ...n.playback ?? {},
    rate: Yt().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: r,
    shapeB: Xt(n.shapeB ?? r),
    playback: s
  };
}
function Fe() {
  return {
    format: "cosimo.modulation",
    version: vi,
    msegSlots: Array.from({ length: ve }, (t, e) => Ai({}, e)),
    envelopeSlots: Array.from({ length: re }, (t, e) => ({
      name: oe(e).name
    })),
    routes: [],
    macroNames: Ti.slice()
  };
}
function ba(t = Fe()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], r = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: vi,
    msegSlots: Array.from({ length: ve }, (o, a) => Ai(n[a], a)),
    envelopeSlots: Array.from({ length: re }, (o, a) => pa(i[a], a)),
    routes: Sa(e.routes),
    macroNames: Array.from(
      { length: bi },
      (o, a) => ma(r[a], a)
    )
  };
}
function et(t) {
  const e = Ue(t);
  if (e._tag === "err")
    throw e.error;
  return JSON.stringify(e.value);
}
function Ue(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return ge(new Ye("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return ge(new Ye("Expected valid modulation JSON"));
    }
  }
  const n = ba(e);
  return !ht(e, n) || !va(n.routes) ? ge(new Ye("Expected the current modulation schema")) : ue(n);
}
function Ta(t, e) {
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
function sn(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(Kr(n))
  };
}
function Ea(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function pt(t, e = null, n) {
  const i = [];
  for (let r = 0; r < ve; r += 1) {
    const o = t.msegSlots[r], a = e?.msegSlots[r];
    (a === void 0 || !Qt(a.shapeA, o.shapeA)) && i.push(n ? n(r, 0, o.shapeA) : {
      endpointID: on,
      value: sn(r, 0, o.shapeA)
    }), (a === void 0 || !Qt(a.shapeB, o.shapeB)) && i.push(n ? n(r, 1, o.shapeB) : {
      endpointID: on,
      value: sn(r, 1, o.shapeB)
    }), (a === void 0 || !Ea(a.playback, o.playback)) && i.push({
      endpointID: Ho,
      value: Ta(r, o.playback)
    });
  }
  return i.push(...eo(e?.routes ?? null, t.routes)), i;
}
const tt = "articulationSnapshot", x = 128, ln = 48, Aa = 1e6, O = -1, nt = [
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
function Pt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function it(t) {
  return Pt(Number.isFinite(t) ? t : 0, 0, 1);
}
function D(t, e, n = -Number.MAX_VALUE, i = Number.MAX_VALUE) {
  const r = Number(t);
  return Pt(Number.isFinite(r) ? r : e, n, i);
}
function _(t, e, n, i) {
  return Pt(Math.round(D(t, e)), n, i);
}
function Ri(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function rt() {
  return Array.from({ length: x }, () => O);
}
function Ra(t) {
  const e = _(t, 0, 0, x - 1), n = nt[e % nt.length], i = Math.floor(e / nt.length);
  return i === 0 ? n : `${n} ${i + 1}`;
}
function xa() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: Lt,
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
function Ma(t) {
  const e = xa(), n = t && typeof t == "object" ? t : {}, i = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: D(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: D(n.pan, e.pan, -1, 1),
    octave: _(n.octave, e.octave, -4, 4),
    semitone: _(n.semitone, e.semitone, -12, 12),
    fineCents: D(n.fineCents, e.fineCents, -100, 100),
    volumeDb: D(
      n.volumeDb,
      e.volumeDb,
      ft,
      gi
    ),
    mute: _(n.mute, e.mute, 0, 1),
    solo: _(n.solo, e.solo, 0, 1),
    warpMode: _(n.warpMode, e.warpMode, 0, 4),
    warpAmount: D(n.warpAmount, e.warpAmount, 0, 1),
    filterMode: _(n.filterMode, e.filterMode, 0, 5),
    filterCutoff: D(n.filterCutoff, e.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: D(
      n.filterKeyTrackOffsetSemitones,
      e.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: D(n.filterQ, e.filterQ, 0.1, 20),
    unisonVoices: _(n.unisonVoices, e.unisonVoices, 1, 8),
    unisonDetune: D(n.unisonDetune, e.unisonDetune, 0, 1),
    unisonBlend: D(n.unisonBlend, e.unisonBlend, 0, 1),
    unisonWidth: D(n.unisonWidth, e.unisonWidth, 0, 1),
    unisonPhase: D(n.unisonPhase, e.unisonPhase, 0, 1),
    unisonRandom: D(n.unisonRandom, e.unisonRandom, 0, 1),
    unisonPhaseMode: _(n.unisonPhaseMode, e.unisonPhaseMode, 0, 1),
    unisonDetuneMode: _(n.unisonDetuneMode, e.unisonDetuneMode, 0, 4),
    unisonStackMode: _(n.unisonStackMode, e.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: D(
      n.unisonWavetablePositionSpread,
      e.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: D(n.unisonWarpSpread, e.unisonWarpSpread, 0, 1),
    msegMorphs: [
      it(Number(i[0])),
      it(Number(i[1])),
      it(Number(i[2]))
    ]
  };
}
function wa(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: D(e.amount, 0, -48, 48)
  } : null;
}
function _a(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(wa).filter((r) => r !== null) : [], i = /* @__PURE__ */ new Map();
  for (const r of n)
    i.set(r.routeId, r);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Ma(e.parameters),
    envelopes: [0, 1, 2].map((r) => Ei(
      Array.isArray(e.envelopes) ? e.envelopes[r] : void 0,
      r
    )),
    modRouteAmounts: [...i.values()]
  };
}
function Oa(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = _(n.runtimeSlot, e, 0, x - 1), r = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${i}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Ra(i);
  return {
    id: r,
    runtimeSlot: i,
    name: o,
    snapshot: _a(n.snapshot)
  };
}
function ka(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(i) ? {
    note: _(n.note, 0, 0, x - 1),
    articulationId: i
  } : null;
}
function Da(t, e, n, i, r) {
  if (!t || typeof t != "object")
    return null;
  const o = t, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let s = _(o.min, r, r, x - 1), l = _(o.max, s, r, x - 1);
  return l < s && ([s, l] = [l, s]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${i}-${n}`,
    articulationId: a,
    min: s,
    max: l
  };
}
function cn(t, e, n, i) {
  const r = Array.isArray(t) ? t : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < r.length; s += 1) {
    const l = Da(
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
function La(t, e) {
  const n = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), r = [];
  for (const o of n) {
    const a = ka(o, e);
    !a || i.has(a.note) || (i.add(a.note), r.push(a));
  }
  return r;
}
function Na(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], i = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), o = [];
  for (let l = 0; l < n.length && o.length < x; l += 1) {
    const u = Oa(n[l], l);
    !u || i.has(u.runtimeSlot) || r.has(u.id) || (i.add(u.runtimeSlot), r.add(u.id), o.push(u));
  }
  const a = typeof e.selectedSlotId == "string" && o.some((l) => l.id === e.selectedSlotId) ? e.selectedSlotId : null, s = new Set(o.map((l) => l.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: Ri(e.activeTriggerMode),
    slots: o,
    chainAssignments: cn(e.chainAssignments, s, "chain", 0),
    keyAssignments: La(e.keyAssignments, s),
    velocityAssignments: cn(e.velocityAssignments, s, "velocity", 1)
  };
}
function un(t) {
  const e = (n) => T.map(() => n);
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
    volumeDbs: e(Lt),
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
    routeAmounts: Array.from({ length: di }, () => 0),
    envelopeAttackSeconds: Array.from({ length: re }, (n, i) => oe(i).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: re }, (n, i) => oe(i).decaySeconds),
    envelopeSustain: Array.from({ length: re }, (n, i) => oe(i).sustain),
    envelopeReleaseSeconds: Array.from({ length: re }, (n, i) => oe(i).releaseSeconds)
  };
}
function dn(t, e, n) {
  for (const i of e) {
    const r = n.get(i.articulationId);
    if (r !== void 0)
      for (let o = i.min; o <= i.max; o += 1)
        t[o] === O && (t[o] = r);
  }
}
function Ca(t) {
  const e = Na(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), i = rt(), r = rt(), o = rt();
  dn(i, e.chainAssignments, n), dn(o, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || r[a.note] !== O || (r[a.note] = s);
  }
  return o[0] = O, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: i,
    key: r,
    velocity: o
  };
}
function xi(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Ca(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: Ri(e.activeMode),
    chain: Array.from({ length: x }, (n, i) => _(e.chain?.[i], O, O, x - 1)),
    key: Array.from({ length: x }, (n, i) => _(e.key?.[i], O, O, x - 1)),
    velocity: Array.from({ length: x }, (n, i) => i === 0 ? O : _(e.velocity?.[i], O, O, x - 1))
  });
}
function Pa(t, e) {
  const n = xi(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const i = globalThis;
  typeof i.cosimo_set_articulation_trigger_config == "function" && i.cosimo_set_articulation_trigger_config(n);
}
const C = "articulations.v4", Ft = [
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
], Ut = [
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
], Fa = [
  ...T.flatMap((t) => Ft.map(
    (e) => `osc${t}.${e}`
  )),
  ...Ut
];
class Mi extends Error {
  /**
   * `reason` distinguishes the deliberate hard cut from other malformed input;
   * `detail` names the offending field or slot.
   */
  constructor(e, n) {
    super(`articulations.v4 parse failed (${e}): ${n}`), this.reason = e, this.detail = n;
  }
  reason;
  detail;
  _tag = "ArticulationsParseError";
}
function b(t) {
  return ge(new Mi("malformed", t));
}
function be(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Kt(t, e, n) {
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
function Ke(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < x;
}
function Ua(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function Ka(t) {
  return Fa.some((e) => e === t);
}
function fn(t, e) {
  if (!be(t))
    return b(`${e} must be an object`);
  const n = Kt(t, ["min", "max"], e);
  return n !== null ? b(n) : Ke(t.min) ? Ke(t.max) ? t.min > t.max ? b(`${e}.min must be less than or equal to ${e}.max`) : ue({ min: t.min, max: t.max }) : b(`${e}.max must be an integer in 0..127`) : b(`${e}.min must be an integer in 0..127`);
}
function Ba(t, e) {
  if (!be(t))
    return b(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return b(`${e} has a non-string parameter id`);
    if (!Ka(i))
      return b(`${e} has unknown parameter id "${i}"`);
    const r = t[i];
    if (typeof r != "number" || !Number.isFinite(r))
      return b(`${e}.${i} must be a finite number`);
    n[i] = r;
  }
  return ue(n);
}
function $a(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function Va() {
  return {};
}
function za(t, e, n) {
  if (!be(t))
    return b(`${e} must be an object`);
  const i = Va();
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return b(`${e} has a non-string route id`);
    const o = t[r];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > ln)
      return b(
        `${e}.${r} must be a finite route amount within ±${ln}`
      );
    if (!n.has(r))
      return b(`${e}.${r} does not name a current articulable mapping`);
    $a(i, r, o);
  }
  return ue(i);
}
function Ha(t, e, n) {
  const i = `slots[${e}]`;
  if (!be(t))
    return b(`${i} must be an object`);
  const r = Kt(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    i
  );
  if (r !== null)
    return b(r);
  if (typeof t.id != "string")
    return b(`${i}.id must be a string`);
  if (!Ke(t.runtimeSlot))
    return b(`${i}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return b(`${i}.name must be a string`);
  if (typeof t.color != "string")
    return b(`${i}.color must be a string`);
  if (!Ke(t.key))
    return b(`${i}.key must be an integer in 0..127`);
  const o = fn(t.velRange, `${i}.velRange`);
  if (o._tag === "err")
    return o;
  const a = fn(t.chainRange, `${i}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = Ba(t.overrides, `${i}.overrides`);
  if (s._tag === "err")
    return s;
  const l = za(
    t.routeAmounts,
    `${i}.routeAmounts`,
    n
  );
  return l._tag === "err" ? l : ue({
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
const Wa = Object.fromEntries(
  Ft.map((t, e) => [t, 2 ** e])
), qa = Object.fromEntries(
  Ut.map((t, e) => [t, 2 ** e])
);
function mn(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function ja(t, e) {
  return Ft.reduce((n, i) => Object.hasOwn(t.overrides, `osc${e}.${i}`) ? n | Wa[i] : n, 0);
}
function Ga(t) {
  return Ut.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | qa[n] : e, 0);
}
function Ja(t, e) {
  const n = (o, a) => mn(t, `osc${o}.${a}`), i = (o) => mn(t, o), r = Array.from(
    { length: di },
    () => Aa
  );
  for (const [o, a] of Object.entries(t.routeAmounts)) {
    const s = e[o];
    s !== void 0 && (r[s] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: T.map((o) => ja(t, o)),
    sharedOverrideMask: Ga(t),
    framePositions: T.map((o) => n(o, "framePosition")),
    pans: T.map((o) => n(o, "pan")),
    octaves: T.map((o) => n(o, "octave")),
    semitones: T.map((o) => n(o, "semitone")),
    fineCents: T.map((o) => n(o, "fineCents")),
    phases: T.map((o) => n(o, "phase")),
    phaseRandoms: T.map((o) => n(o, "phaseRandom")),
    retriggers: T.map((o) => n(o, "retrigger")),
    volumeDbs: T.map((o) => n(o, "volumeDb")),
    mutes: T.map((o) => n(o, "mute")),
    solos: T.map((o) => n(o, "solo")),
    warpModes: T.map((o) => n(o, "warpMode")),
    warpAmounts: T.map((o) => n(o, "warpAmount")),
    filterMode: i("filterMode"),
    filterCutoffHz: i("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: i("filterKeyTrackOffsetSemitones"),
    filterQ: i("filterQ"),
    unisonVoices: T.map((o) => n(o, "unisonVoices")),
    unisonDetunes: T.map((o) => n(o, "unisonDetune")),
    unisonBlends: T.map((o) => n(o, "unisonBlend")),
    unisonWidths: T.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: T.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: T.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: T.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: T.map((o) => n(o, "unisonWarpSpread")),
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
function wi(t, e) {
  return t.slots.map((n) => Ja(n, e));
}
function Qa(t, e) {
  if (!be(t))
    return b("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return b('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return ge(new Mi(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = Kt(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return b(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return b("selectedSlotId must be null or a string");
  if (!Ua(t.activeTriggerMode))
    return b('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return b("slots must be an array");
  if (t.slots.length > x)
    return b(`slots must contain at most ${x} entries`);
  const i = [], r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const s = Ha(t.slots[a], a, e);
    if (s._tag === "err")
      return s;
    const l = s.value;
    if (r.has(l.id))
      return b(`slots[${a}].id duplicates "${l.id}"`);
    if (o.has(l.runtimeSlot))
      return b(`slots[${a}].runtimeSlot duplicates ${l.runtimeSlot}`);
    r.add(l.id), o.add(l.runtimeSlot), i.push(l);
  }
  return t.selectedSlotId !== null && !r.has(t.selectedSlotId) ? b(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : ue({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: i
  });
}
function _i() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Xa(t) {
  const e = Array.from({ length: x }, () => O), n = Array.from({ length: x }, () => O), i = Array.from({ length: x }, () => O);
  for (const r of t.slots) {
    n[r.key] === O && (n[r.key] = r.runtimeSlot);
    for (let o = r.chainRange.min; o <= r.chainRange.max; o += 1)
      e[o] === O && (e[o] = r.runtimeSlot);
    for (let o = r.velRange.min; o <= r.velRange.max; o += 1)
      i[o] === O && (i[o] = r.runtimeSlot);
  }
  return i[0] = O, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: i
  };
}
const Oi = 13, Bt = 5, ki = 8, Ya = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), $t = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    P("globalFilter")
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
    P("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    P("ott")
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
    P("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    P("flanger")
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
    P("phaser")
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
    P("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    P("reverb")
  ]
}), Di = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), Za = Object.freeze([
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
]), es = Object.freeze({
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
function ts(t) {
  return Math.round(t) === 1 ? -5 : Math.round(t) === 2 ? 12 : Math.round(t) === 3 ? -12 : 7;
}
function Li(t, e) {
  const n = {};
  for (const s of $t[t]) {
    const l = e[s];
    if (typeof l == "number" && Number.isFinite(l)) {
      n[s] = l;
      continue;
    }
    const u = es[s];
    if (u === void 0)
      throw new Error(`Missing lane parameter value: ${t}.${s}`);
    n[s] = u;
  }
  const r = [
    ...Di.chorus,
    P("chorus")
  ], o = Object.keys(e);
  return t === "chorus" && o.length === r.length && o.every((s) => r.includes(s)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = ts(
    Number(e.chorusRingOffsetMode)
  ) + Number(e.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function Ni(t) {
  return $t[t];
}
function ns(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= Bt)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * ki + Ya[t];
}
function is(t, e) {
  const n = new Array(Oi).fill(0), i = Li(t, e);
  return $t[t].forEach((r, o) => {
    n[o] = i[r];
  }), n;
}
const Ci = "lane.v1", rs = "laneTopology", gt = "laneSlotParams", os = "laneOutputControl", yt = 16, as = 8, Pi = 4, ss = 3, Fi = Bt * ki, Ui = 4, ls = 4, cs = Fi, us = Fi + Ui, ds = 0, fs = 1, ms = 2, hs = 3, ps = 4, gs = 5;
function ys(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > Pi)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << as;
}
const Be = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), $e = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Ki = new Map(
  Object.entries($e).map(([t, e]) => [e, t])
), Is = Object.freeze({
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
  Be.map((t) => [Is[t], t])
);
const Ss = Object.freeze([
  "voice.filterCutoff",
  yi,
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
]), vs = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [yi]: "enhancer-frequency",
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
  Ss.map((t) => [t, Object.freeze({
    id: t,
    family: vs[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const Bi = 40, $i = 18e3, It = Be.map((t) => $e[t]), bs = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Ts = /^(parallel|split)#([1-9][0-9]*)$/;
function je(t) {
  if (typeof t != "string")
    return null;
  const e = bs.exec(t);
  if (e === null)
    return null;
  const n = It.find((r) => r === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > Bt ? null : { deviceType: n, instanceNumber: i };
}
function Vi(t) {
  if (typeof t != "string")
    return null;
  const e = Ts.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? Ui : ls) ? null : { groupKind: n, unitNumber: i };
}
function X(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function se(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function E(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function Es(t, e) {
  const n = je(t);
  if (n === null)
    return { failure: E(`device id ${t} is not a pool instance`) };
  if (!X(e) || !se(e, ["params"]) || !X(e.params))
    return { failure: E(`device ${t} must be { params }`) };
  const i = Ni(n.deviceType), r = Ki.get(n.deviceType);
  if (r === void 0)
    return { failure: E(`device ${t} has no effect descriptor`) };
  const o = jn(r).parameters.map((m) => m.endpointID), a = e.params, s = Object.keys(a), l = (m) => s.length === m.length && s.every((h) => m.includes(h)), u = P(n.deviceType), c = [
    ...Di[n.deviceType],
    u
  ], f = [
    ...Za,
    u
  ];
  if (!(s.includes(u) && (l(i) || l(o) || l(c) || n.deviceType === "chorus" && l(f))))
    return { failure: E(`device ${t} must carry every parameter once`) };
  for (const m of s) {
    const h = a[m];
    if (typeof h != "number" || !Number.isFinite(h))
      return { failure: E(`device ${t}.${m} must be a finite number`) };
  }
  return { record: { params: Li(n.deviceType, a) } };
}
function As(t, e) {
  return !X(t) || t.kind !== "device" ? { failure: E("branches may hold device placements only") } : se(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: E(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: E(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: E("a device placement is { kind, deviceId, enabled }") };
}
function hn(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= Bi && t <= $i;
}
function zi() {
  return { mix: 1, bypassed: !1 };
}
function Rs(t) {
  return !X(t) || !se(t, ["mix", "bypassed"]) || typeof t.mix != "number" || !Number.isFinite(t.mix) || t.mix < 0 || t.mix > 1 || typeof t.bypassed != "boolean" ? null : { mix: t.mix, bypassed: t.bypassed };
}
function xs(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (c) {
      const f = c instanceof Error ? c.message : String(c);
      return E(`is not valid JSON: ${f}`);
    }
  if (!X(e) || !se(e, ["format", "version", "output", "devices", "chain"]))
    return E("must be { format, version, output, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return E("must be cosimo.lane version 2");
  if (!X(e.devices))
    return E("devices must be an object");
  if (!Array.isArray(e.chain))
    return E("chain must be an array");
  const n = Rs(e.output);
  if (n === null)
    return E("output must be { mix: 0..1, bypassed: boolean }");
  const i = {};
  for (const c of Reflect.ownKeys(e.devices)) {
    if (typeof c != "string")
      return E("device ids must be strings");
    const f = Es(c, e.devices[c]);
    if ("failure" in f)
      return f.failure;
    i[c] = f.record;
  }
  const r = new Set(Object.keys(i)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let l = 0;
  const u = (c) => {
    const f = As(c, r);
    return "placement" in f && (o.set(
      f.placement.deviceId,
      (o.get(f.placement.deviceId) ?? 0) + 1
    ), l += 1), f;
  };
  for (const c of e.chain) {
    if (!X(c))
      return E("chain nodes must be objects");
    if (c.kind === "device") {
      const y = u(c);
      if ("failure" in y)
        return y.failure;
      s.push(y.placement);
      continue;
    }
    if (c.kind !== "parallel" && c.kind !== "split")
      return E(`unknown chain node kind ${String(c.kind)}`);
    const f = c.kind === "split", d = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], h = f ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], I = f && se(c, d);
    if (!se(c, h) && !I)
      return E(`a ${c.kind} group is { ${h.join(", ")} }`);
    const g = Vi(c.groupId);
    if (g === null || g.groupKind !== c.kind)
      return E(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (a.has(String(c.groupId)))
      return E(`group ${String(c.groupId)} is used twice`);
    if (a.add(String(c.groupId)), typeof c.enabled != "boolean")
      return E(`group ${String(c.groupId)} needs a boolean enable`);
    const v = f ? ss : Pi;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > v)
      return E(`group ${String(c.groupId)} needs 2..${v} branches`);
    if (f && (!hn(c.xoverLowHz) || !hn(c.xoverHighHz)))
      return E(`group ${String(c.groupId)} crossovers must sit in ${Bi}..${$i} Hz`);
    if (f && !I && (typeof c.xoverLowKeyTrackEnabled != "boolean" || typeof c.xoverHighKeyTrackEnabled != "boolean" || typeof c.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverLowKeyTrackOffsetSemitones) || typeof c.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverHighKeyTrackOffsetSemitones)))
      return E(`group ${String(c.groupId)} Key Track state must be finite`);
    l += 1;
    const S = [];
    for (const y of c.branches) {
      if (!Array.isArray(y))
        return E(`group ${String(c.groupId)} branches must be arrays`);
      const R = [];
      for (const w of y) {
        const N = u(w);
        if ("failure" in N)
          return N.failure;
        R.push(N.placement);
      }
      S.push(R);
    }
    s.push(f ? {
      kind: "split",
      groupId: String(c.groupId),
      enabled: c.enabled,
      xoverLowHz: c.xoverLowHz,
      xoverHighHz: c.xoverHighHz,
      xoverLowKeyTrackEnabled: I ? !1 : c.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: I ? 0 : c.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: I ? !1 : c.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: I ? 0 : c.xoverHighKeyTrackOffsetSemitones,
      branches: S
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: S
    });
  }
  for (const c of r)
    if ((o.get(c) ?? 0) !== 1)
      return E(`device ${c} must be placed exactly once`);
  return l > yt ? E(`flattens to ${l} wire entries; the topology upload holds ${yt}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: i, chain: s } };
}
function Ms() {
  const t = {};
  for (const e of Be) {
    const n = $e[e];
    t[`${n}#1`] = {
      params: Ds(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: zi(),
    devices: t,
    chain: Be.map((e) => ({
      kind: "device",
      deviceId: `${$e[e]}#1`,
      enabled: !1
    }))
  };
}
const pn = ["distortion#1", "delay#1", "reverb#1"];
function ws() {
  const t = Ms(), e = {};
  for (const n of pn) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: zi(),
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && pn.includes(n.deviceId))
  };
}
function _s(t) {
  if (t === void 0)
    return ws();
  const e = xs(t);
  return e._tag === "ok" ? e.value : null;
}
function Os(t) {
  return Object.keys(t.devices).map((e) => {
    const n = je(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => It.indexOf(e.parsed.deviceType) - It.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function St(t) {
  const e = je(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return ns(e.deviceType, e.instanceNumber - 1);
}
function Hi(t) {
  const e = Vi(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? cs : us) + (e.unitNumber - 1);
}
function Wi(t) {
  const e = new Array(yt).fill(0);
  let n = 0, i = 0;
  const r = (o, a, s) => {
    e[i] = ys(o, a), s && (n |= 1 << i), i += 1;
  };
  for (const o of t.chain) {
    if (o.kind === "device") {
      r(St(o.deviceId), 0, o.enabled);
      continue;
    }
    r(Hi(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const l of a)
        r(St(l.deviceId), s + 1, l.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function ks(t) {
  const e = new Array(Oi).fill(0);
  return e[ds] = t.xoverLowHz, e[fs] = t.xoverHighHz, e[ms] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[hs] = t.xoverLowKeyTrackOffsetSemitones, e[ps] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[gs] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function qi(t) {
  const e = [{
    endpointID: os,
    value: t.output
  }];
  let n = 0;
  for (const i of Os(t)) {
    const r = je(i.instanceId);
    if (r === null)
      throw new Error(`Invalid lane device identity during replay: ${i.instanceId}`);
    e.push({
      endpointID: lr(
        r.deviceType,
        r.instanceNumber
      ),
      value: t.devices[i.instanceId].params[P(r.deviceType)]
    }), n += 1, e.push({
      endpointID: gt,
      value: {
        slotId: St(i.instanceId),
        deliverySerial: n,
        values: is(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  }
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: gt,
      value: {
        slotId: Hi(i),
        deliverySerial: n,
        values: ks(i)
      }
    }));
  return e.push({
    endpointID: rs,
    value: Wi(t)
  }), e;
}
function Ds(t) {
  const e = Ki.get(t);
  if (e === void 0)
    throw new Error(`Unknown lane device type: ${t}`);
  const n = jn(e).parameters;
  return Object.fromEntries(Ni(t).map((i) => [
    i,
    n.find((r) => r.endpointID === i)?.initial ?? 0
  ]));
}
class Ls {
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
    if (!this.started)
      return;
    this.started = !1;
    const e = [];
    for (const n of [...this.services].reverse())
      try {
        await n.stop?.();
      } catch (i) {
        e.push(i);
      }
    if (this.services.length = 0, e.length > 0)
      throw new AggregateError(e, "Patch worker service cleanup failed");
  }
  getServices() {
    return [...this.services];
  }
}
function Ns(t, e) {
  return new Ls(t, e);
}
async function Cs(t, e) {
  const n = Ns(t, e);
  return await n.start(), n;
}
const vt = "runtimeState";
function ji(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const Ps = {
  endpointID: vt,
  required: !0,
  mapValue: ji
}, gn = "runtimeInstallAck", Gi = "runtimeSyncRequest", bt = 0, Fs = 8e3, Ve = /* @__PURE__ */ new WeakMap(), Ji = 1e9;
let Ae = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Ji;
function Us(t) {
  return Ae = Ae % Ji + 1, t === "modulation" ? -1e9 - Ae : 1e9 + Ae;
}
function Ks(t, e) {
  const n = t, i = Ve.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), Ve.set(n, i);
}
function yn(t, e) {
  const n = t, i = Ve.get(n);
  i?.delete(e), i?.size === 0 && Ve.delete(n);
}
const Bs = [100, 250, 500, 1e3], Re = { _tag: "accepted" }, $s = { _tag: "superseded" }, Vs = { _tag: "stopped" }, In = { _tag: "transport-timeout" };
function zs(t) {
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
  ].every((f) => typeof f == "number" && Number.isSafeInteger(f) && f >= -2147483648 && f <= 2147483647) || typeof r != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof l != "number" || typeof u != "number" || r < 0 || o < 0 || a > 0 || l < 0 ? null : {
    dspSessionId: r,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: l,
    syncSerial: u
  };
}
function Hs(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class Sn {
  #r;
  #n;
  #s;
  #c;
  #h = !1;
  #d = /* @__PURE__ */ new Set();
  #t = null;
  #o = null;
  #l = /* @__PURE__ */ new Set();
  #e = null;
  #f = 0;
  #a = /* @__PURE__ */ new Map();
  #m = 0;
  #i = !1;
  #u = 0;
  #g = /* @__PURE__ */ new Set();
  #T = this.#_.bind(this);
  constructor(e, n) {
    this.#r = e, this.#n = n.laneKind;
    const i = n.probeDelaysMilliseconds?.map((r) => Math.max(0, Math.trunc(r))).filter((r) => Number.isFinite(r));
    this.#s = i && i.length > 0 ? i : [...Bs], this.#c = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Fs)
    );
  }
  start() {
    if (!this.#i) {
      Ks(this.#r, this.#n);
      try {
        this.#m += 1, this.#i = !0, this.#o = null, this.#l.clear(), this.#r.addEndpointListener?.(gn, this.#T);
      } catch (e) {
        throw this.#i = !1, yn(this.#r, this.#n), e;
      }
    }
  }
  stop() {
    if (this.#i) {
      this.#i = !1;
      for (const e of this.#d) e();
      this.#r.removeEndpointListener?.(gn, this.#T), yn(this.#r, this.#n), this.#a.clear(), this.#o = null, this.#l.clear(), this.#b();
    }
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    if (n !== this.#t) {
      for (const i of this.#d) i();
      this.#t = n, this.#o = null, this.#l.clear(), this.#e?.dspSessionId !== n && (this.#e = null), this.#a.clear(), this.#u += 1, this.#b();
    }
  }
  getAcceptedFrontier() {
    return this.#e?.dspSessionId !== this.#t ? 0 : this.#n === "modulation" ? this.#e.acceptedModulationSerial : this.#e.acceptedArticulationSerial;
  }
  getLatestAck() {
    return this.#e ? { ...this.#e } : null;
  }
  hasSessionBaseline() {
    return this.#t !== null && this.#o === this.#t;
  }
  async waitForSessionBaseline() {
    const e = this.#t, n = this.#m;
    return this.#i ? e === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#E(e, n) : {
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
    if (this.#h)
      return {
        _tag: "unavailable",
        reason: "batch-in-progress"
      };
    if (this.#t === null)
      return {
        _tag: "unavailable",
        reason: "no-runtime-session"
      };
    this.#h = !0;
    const n = this.#t, i = this.#m;
    try {
      const r = await this.#E(
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
        if (s._tag === "rejected" && this.#n === "articulation") {
          o ??= s;
          continue;
        }
        if (s._tag !== "accepted")
          return s;
      }
      return o ?? Re;
    } finally {
      this.#h = !1;
    }
  }
  #A(e) {
    return this.#n === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #R(e, n) {
    const i = this.#A(e);
    return this.#n === "modulation" ? i >= n : i <= n;
  }
  #x() {
    const e = this.getAcceptedFrontier();
    return this.#n === "modulation" ? e + 1 : e - 1;
  }
  async #E(e, n) {
    if (this.#o === e)
      return Re;
    const i = Us(this.#n);
    this.#l.add(i);
    const r = Date.now() + this.#c;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#p(e, n);
        if (a)
          return a;
        if (this.#o === e)
          return Re;
        const s = r - Date.now();
        if (s <= 0)
          return In;
        const l = this.#u;
        this.#S(i), await this.#v(
          l,
          Math.min(this.#I(o), s)
        ), o += 1;
      }
    } finally {
      this.#l.delete(i);
    }
  }
  async #M(e, n, i) {
    const r = this.#x(), o = /* @__PURE__ */ new Set();
    let a = !1;
    const s = () => {
      a = !0;
      for (const c of o) c();
      o.clear();
    }, l = {
      get aborted() {
        return a;
      },
      onAbort(c) {
        return a ? c() : o.add(c), () => {
          o.delete(c);
        };
      }
    };
    this.#d.add(s);
    const u = async () => {
      this.#p(n, i) || ("submit" in e ? await e.submit({ dspSessionId: n, deliverySerial: r, signal: l }) : this.#w(e.endpointID, Hs(e.value, n, r)));
    };
    try {
      let c = 0, f = 0, d = this.#f;
      for (await u(); ; ) {
        const m = this.#p(n, i);
        if (m)
          return m;
        const h = this.#y(n, r, d);
        if (h !== null)
          return h;
        const I = this.#u;
        await this.#v(
          I,
          this.#I(c)
        );
        const g = this.#y(
          n,
          r,
          d
        );
        if (g !== null)
          return g;
        let v = this.#u;
        for (this.#S(r); ; ) {
          const S = this.#p(n, i);
          if (S)
            return S;
          const y = await this.#v(
            v,
            this.#I(c)
          ), R = this.#y(
            n,
            r,
            d
          );
          if (R !== null)
            return R;
          if (y && this.#e?.dspSessionId === n && this.#e.syncSerial === r) {
            if (f >= 1)
              return In;
            d = this.#f, await u(), f += 1, c += 1;
            break;
          }
          if (y) {
            v = this.#u;
            continue;
          }
          y || (c += 1, v = this.#u, this.#S(r));
        }
      }
    } catch (c) {
      const f = this.#p(n, i);
      if (f) return f;
      throw c;
    } finally {
      s(), this.#d.delete(s);
    }
  }
  #y(e, n, i) {
    const r = this.#e;
    if (!r || r.dspSessionId !== e)
      return null;
    const o = this.#a.get(n);
    return o !== void 0 && o.version > i && o.acknowledgement.dspSessionId === e ? (this.#a.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#R(r, n) ? (this.#a.delete(n), Re) : null;
  }
  #p(e, n) {
    return !this.#i || this.#m !== n ? Vs : this.#t !== e ? $s : null;
  }
  #I(e) {
    return this.#s[Math.min(
      e,
      this.#s.length - 1
    )];
  }
  #w(e, n) {
    try {
      this.#r.sendEventOrValue?.(
        e,
        n,
        void 0,
        bt
      );
    } catch {
    }
  }
  #S(e) {
    if (this.#i)
      try {
        this.#r.sendEventOrValue?.(
          Gi,
          e,
          void 0,
          bt
        );
      } catch {
      }
  }
  #_(e) {
    const n = zs(e);
    if (!n || this.#t !== null && n.dspSessionId !== this.#t || this.#o === n.dspSessionId && this.#e?.dspSessionId === n.dspSessionId && (n.acceptedModulationSerial < this.#e.acceptedModulationSerial || n.acceptedArticulationSerial > this.#e.acceptedArticulationSerial))
      return;
    if (this.#l.has(n.syncSerial) && (this.#o = n.dspSessionId), this.#e = n, this.#f += 1, this.#n === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#a.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#f
      }); this.#a.size > 16; ) {
        const r = this.#a.keys().next().value;
        if (r === void 0) break;
        this.#a.delete(r);
      }
    this.#u += 1, this.#b();
  }
  #v(e, n) {
    return !this.#i || this.#u !== e ? Promise.resolve(!0) : new Promise((i) => {
      let r = !1;
      const o = {
        finish: (a) => {
          r || (r = !0, o.timeoutHandle !== null && clearTimeout(o.timeoutHandle), this.#g.delete(o), i(a));
        },
        timeoutHandle: null
      };
      o.timeoutHandle = setTimeout(() => o.finish(!1), n), this.#g.add(o);
    });
  }
  #b() {
    for (const e of [...this.#g])
      e.finish(!0);
  }
}
const Ws = 1e3, qs = [Q, C];
function vn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function ot(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (vn(i, e)) return i[e];
  if (vn(n, e)) return n[e];
}
function at(t, e) {
  if (t === void 0) return _i();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const i = Qa(n, e);
  return i._tag === "ok" ? i.value : null;
}
function bn(t) {
  return new Set(t.routes.flatMap((e) => Dt(e) === null ? [] : [e.id]));
}
function Tn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
function En(t, e) {
  switch (e._tag) {
    case "accepted":
    case "superseded":
    case "stopped":
      return;
    case "rejected":
      return { kind: "failed", error: { kind: "engine-rejected", message: `The ${t} runtime rejected the update (reason ${e.acknowledgement.rejectionReason}).` } };
    case "transport-timeout":
      return { kind: "failed", error: { kind: "transport", message: `The ${t} runtime did not acknowledge the update.` } };
    case "unavailable":
      return { kind: "failed", error: { kind: "resource", message: `The ${t} runtime is unavailable (${e.reason}).` } };
  }
}
class Qi {
  constructor(e, n) {
    this.connection = e, this.frameworkInput = n, this.modulationLane = new Sn(e, { laneKind: "modulation" }), this.articulationLane = new Sn(e, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = Fe();
  articulationBank = _i();
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
    { length: x },
    () => null
  );
  recoveryTimer = null;
  lastRejectedToken = /* @__PURE__ */ new Map();
  modulationLane;
  articulationLane;
  deliveryObserver;
  handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  handleRuntimeStateBound = this.handleRuntimeState.bind(this);
  /** Replace desired engine data already accepted by the framework, without persisting it. */
  replaceModulation(e, n) {
    if (!this.frameworkInput) throw new Error("Stored modulation input cannot accept framework replacements.");
    this.modulationState = e, this.hasModulationState = !0, this.deliveryObserver = n, this.applyRuntimeStateIfReady();
  }
  get bootKeys() {
    return this.frameworkInput ? [C] : qs;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(vt, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(vt, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
      for (const n of this.bootKeys) this.connection.requestStoredStateValue(n);
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
    const n = ot(e, Q), i = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: Fe() } : Ue(n);
    if (i._tag === "err") {
      console.error(`[runtime-state-worker] ${Q} is invalid; boot state was not installed.`);
      const a = ot(e, C), s = at(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = i.value, this.hasModulationState = !0;
    const r = ot(e, C), o = at(
      r,
      bn(i.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${C} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = o, this.hasArticulationState = !0;
  }
  handleStoredStateValue(e) {
    if (!this.started || !e || typeof e != "object") return;
    const n = e;
    if (!(typeof n.key != "string" || !this.bootKeys.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === this.bootKeys.length) {
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
    if (e === Q) {
      const r = Ue(n);
      if (r._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${Q}.`);
        return;
      }
      this.modulationState = r.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const i = at(n, bn(this.modulationState));
    if (i === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${C}.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = ji(e);
    if (this.modulationLane.observeRuntime(n), this.articulationLane.observeRuntime(n), !this.hasRuntimeState) {
      this.hasRuntimeState = !0, this.dspSessionId = n, this.clearRecoveryTimer(), this.applyRuntimeStateIfReady();
      return;
    }
    n !== this.dspSessionId && (this.dspSessionId = n, this.runtimeGeneration += 1, this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.applyRuntimeStateIfReady());
  }
  applyRuntimeStateIfReady() {
    if (!this.started || this.bootPending || !this.hasModulationState || !this.hasArticulationState)
      return;
    if (!this.hasRuntimeState) {
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(Gi, 0, void 0, bt), this.hasRuntimeState || this.scheduleRecovery());
      return;
    }
    if (this.deliveryInProgress) {
      this.deliveryRefreshPending = !0;
      return;
    }
    this.deliveryInProgress = !0, this.deliveryRefreshPending = !1;
    const e = this.lifecycleEpoch;
    this.deliverRuntimeState().catch((n) => {
      if (!(!this.started || e !== this.lifecycleEpoch)) {
        if (this.frameworkInput) {
          this.stop(), this.frameworkInput.onDefect(n);
          return;
        }
        console.error("[runtime-state-worker] Runtime delivery failed unexpectedly.", n), this.scheduleRecovery(), this.finishDelivery();
      }
    });
  }
  async deliverRuntimeState() {
    const e = this.lifecycleEpoch, n = this.runtimeGeneration, i = this.modulationState, r = this.articulationBank, o = this.deliveryObserver, s = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, l = this.frameworkInput?.curveCommand ? pt(i, s, this.frameworkInput.curveCommand) : pt(i, s), u = await this.modulationLane.sendBatch(l);
    if (!this.started || e !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", u, i)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const g = En("modulation", u);
      g && o?.(g), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = i, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, i, r)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const c = this.buildUploadsBySelector(i, r), f = Array.from({ length: x }, (g, v) => {
      const S = c.get(v);
      return S ? Tn(S) : null;
    }), d = this.lastAppliedArticulationGeneration !== n, m = d && this.articulationLane.getAcceptedFrontier() !== 0, h = [];
    for (let g = 0; g < x; g += 1) {
      const v = c.get(g), S = f[g] !== this.lastAppliedArticulationTokens[g];
      m ? h.push({
        endpointID: tt,
        value: v ?? un(g)
      }) : d ? v && h.push({ endpointID: tt, value: v }) : S && h.push({
        endpointID: tt,
        value: v ?? un(g)
      });
    }
    const I = await this.articulationLane.sendBatch(h);
    if (!(!this.started || e !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", I, f)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = f;
        const g = Xa(r);
        if (this.frameworkInput) {
          const v = await this.frameworkInput.publishTriggerConfig(g);
          if (!this.started || e !== this.lifecycleEpoch) return;
          v.kind !== "cancelled" && o?.(v);
        } else
          Pa(g, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const v of h) this.lastAppliedArticulationTokens[v.value.selectorA] = void 0;
        const g = En("articulation", I);
        g && o?.(g);
      }
      this.finishDelivery();
    }
  }
  desiredStateChanged(e, n, i) {
    return e !== this.runtimeGeneration || n !== this.modulationState || i !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const i = Object.fromEntries(e.routes.flatMap((r) => {
      const o = Dt(r);
      return o === null ? [] : [[r.id, o]];
    }));
    return new Map(
      wi(n, i).map((r) => [r.selectorA, r])
    );
  }
  acceptOutcome(e, n, i) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const r = Tn(i), o = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== r;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, r), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Ws));
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
function js(t) {
  return new Qi(t);
}
const Gs = 2e3;
function An(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Rn(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Js(t, e) {
  if (!Rn(t))
    return { found: !1 };
  const n = Rn(t.values) ? t.values : void 0;
  return n && An(n, e) ? {
    found: !0,
    value: n[e]
  } : An(t, e) ? {
    found: !0,
    value: t[e]
  } : { found: !1 };
}
function xn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Qs {
  connection;
  options;
  parameterEndpointIDs;
  runtimeEndpointDependencies;
  stateKeys;
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
  lifetime = 0;
  lastAppliedToken = null;
  lastAppliedRuntimeEndpointsToken = null;
  lastAppliedSnapshot = null;
  pendingStateKeyIndex = null;
  activeStateKeyIndex = null;
  constructor(e, n) {
    this.connection = e, this.options = n, this.stateKeys = [.../* @__PURE__ */ new Set([n.stateKey, ...n.fallbackStateKeys ?? []])], this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Xs(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
  }
  start() {
    if (!this.started) {
      this.started = !0, this.lifetime += 1, this.deliveryInProgress = !1, this.deliveryRefreshPending = !1, this.lastAppliedToken = null, this.lastAppliedRuntimeEndpointsToken = null, this.lastAppliedSnapshot = null, this.pendingStateKeyIndex = null, this.activeStateKeyIndex = null, this.connection.addStoredStateValueListener?.(this.handleStoredStateValue);
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
      const e = this.lifetime;
      this.connection.requestFullStoredState((n) => {
        if (!(!this.started || e !== this.lifetime)) {
          for (let i = 0; i < this.stateKeys.length; i += 1) {
            const r = Js(n, this.stateKeys[i]);
            if (r.found && r.value != null) {
              this.activeStateKeyIndex = i, this.applyStoredValue(r.value);
              return;
            }
          }
          this.options.applyDefaultRuntimeStateWhenMissing && (this.activeStateKeyIndex = null, this.applyStoredValue(void 0));
        }
      });
      return;
    }
    if (typeof this.connection.requestStoredStateValue == "function") {
      this.requestStateKeyAtIndex(0);
      return;
    }
    this.options.applyDefaultRuntimeStateWhenMissing && this.applyStoredValue(void 0);
  }
  handleStoredStateValue(e) {
    if (!e || typeof e != "object")
      return;
    const n = e;
    if (typeof n.key != "string")
      return;
    const i = this.stateKeys.indexOf(n.key);
    if (i < 0)
      return;
    const r = this.pendingStateKeyIndex === i;
    if (r && (this.pendingStateKeyIndex = null), n.value == null && r && i + 1 < this.stateKeys.length) {
      this.activeStateKeyIndex = null, this.requestStateKeyAtIndex(i + 1);
      return;
    }
    n.value == null && !this.options.applyDefaultRuntimeStateWhenMissing || this.activeStateKeyIndex !== null && i > this.activeStateKeyIndex || (this.activeStateKeyIndex = n.value == null ? null : i, this.applyStoredValue(n.value));
  }
  requestStateKeyAtIndex(e) {
    if (e >= this.stateKeys.length) {
      this.options.applyDefaultRuntimeStateWhenMissing && (this.activeStateKeyIndex = null, this.applyStoredValue(void 0));
      return;
    }
    this.pendingStateKeyIndex = e, this.connection.requestStoredStateValue?.(this.stateKeys[e]);
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
    }, r = xn(n), o = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(i, o), s = xn({
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
      const l = this.lifetime;
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(a, i).then((u) => {
        if (!this.started || l !== this.lifetime)
          return;
        this.deliveryInProgress = !1, u ? (this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(a);
        const c = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, c && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (!this.started || l !== this.lifetime)
          return;
        this.deliveryInProgress = !1, this.options.onDeliveryFailure?.(a);
        const u = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, u && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const l of a)
      this.connection.sendEventOrValue?.(
        l.endpointID,
        l.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? Gs
      );
    this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function Xs(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Ys(t, e) {
  return new Qs(t, e);
}
function Zs(t) {
  return Ys(t, {
    stateKey: Ci,
    runtimeEndpointDependencies: [Ps],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: _s,
    buildRuntimeEvents: ({ state: e }) => [...qi(e)]
  });
}
const el = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function tl(t) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(t) && !t.includes("__") && !el.has(t);
}
function st(t, e = {}) {
  return Object.freeze({ kind: "parameter", endpoint: t, ...e });
}
function nl(t) {
  const e = Object.freeze({ ...t.codec });
  return Object.freeze({
    kind: "stored",
    initial: e.parse(t.initial),
    codec: e,
    ...t.lifetime ? { lifetime: t.lifetime } : {},
    ...t.history !== void 0 ? { history: t.history } : {},
    ...t.engine ? { engine: t.engine } : {}
  });
}
function il(t) {
  const e = nl({ codec: t.codec, initial: t.initial, lifetime: t.lifetime, history: t.history }), n = Object.freeze([...t.dependencies ?? []]);
  if ("kind" in t.engine && t.engine.kind === "shared-data") {
    const o = t.prepare, a = t.engine;
    return Object.freeze({ ...e, engine: Object.freeze({
      kind: "shared-prepared",
      dependencies: n,
      storage: Object.freeze({ type: a.type, fixedLength: typeof a.length == "number" ? a.length : null }),
      measure(s, l) {
        return typeof a.length == "number" ? a.length : a.length(s, l);
      },
      prepare: o
    }) });
  }
  const i = t.prepare, r = t.engine;
  return Object.freeze({ ...e, engine: Object.freeze({
    kind: "prepared",
    dependencies: n,
    prepare: i,
    delivery: r
  }) });
}
const rl = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.options");
function ol(t) {
  return Object.keys(t).filter((e) => t[e]?.kind === "stored" && t[e].engine?.kind === "shared-prepared").sort().map((e, n) => ({ key: e, input: n }));
}
function al(t, e = {}) {
  if (e.historyLimit !== void 0 && (!Number.isSafeInteger(e.historyLimit) || e.historyLimit < 0))
    throw new Error("historyLimit must be a non-negative integer.");
  const n = ol(t);
  if (n.length && (!Number.isSafeInteger(e.memoryBudgetBytes) || (e.memoryBudgetBytes ?? 0) < 4))
    throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
  if (n.some(({ key: i }) => !tl(i) || i === "Data"))
    throw new Error("Shared state names must be valid Cmajor identifiers.");
  return Object.freeze(Object.defineProperty({ ...t }, rl, { value: Object.freeze({ ...e }) }));
}
function F(t, e) {
  if (!t)
    throw new Error(e);
}
function lt(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function sl(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function Tt(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Xi(t) {
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
function ll() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function ct(t, e) {
  const n = ll();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (sl(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function Mn(t) {
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
  throw new Error(`Unsupported text resource payload (${Xi(t)})`);
}
function cl(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return Tt(t);
  throw new Error(`Unsupported binary resource payload (${Xi(t)})`);
}
function ul(t) {
  const e = t?.frames;
  F(
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
      F(a.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function Yi(t) {
  const e = new DataView(t);
  F(lt(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), F(lt(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, o = null, a = null, s = null, l = null, u = 12;
  for (; u + 8 <= e.byteLength; ) {
    const f = lt(e, u, 4), d = e.getUint32(u + 4, !0), m = u + 8;
    f === "fmt " ? (n = e.getUint16(m, !0), i = e.getUint16(m + 2, !0), r = e.getUint32(m + 4, !0), a = e.getUint16(m + 12, !0), o = e.getUint16(m + 14, !0)) : f === "data" && (s = m, l = d), u = m + d + d % 2;
  }
  F(n !== null, "Wave file is missing a fmt chunk"), F(s !== null && l !== null, "Wave file is missing a data chunk"), F(i === 1, "Only mono wavetable bank files are supported");
  let c;
  if (n === 3 && o === 32)
    c = new Float32Array(t.slice(s, s + l));
  else if (n === 1 && o === 16) {
    const f = l / 2, d = new Int16Array(t.slice(s, s + l));
    c = new Float32Array(f);
    for (let m = 0; m < f; m += 1)
      c[m] = d[m] / 32768;
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
async function wn(t) {
  F(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return F(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function Et(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function Zi(t) {
  const e = new Uint8Array(t).buffer, n = Yi(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function dl(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (l) => (F(typeof t.readResource == "function", `Resource bridge cannot read ${l}`), t.readResource(l)), r = async (l) => {
    F(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${l}`);
    const u = await t.readResourceAsAudioData(l);
    return ul(u);
  }, o = (l) => {
    const u = t.getResourceAddress?.(l);
    return u ?? null;
  }, a = async (l, u = t.getResourceAddress?.(l)) => {
    const c = ct(l, u), f = await wn(c), d = Yi(f);
    return {
      sampleRate: d.sampleRate,
      samples: d.samples
    };
  }, s = async (l, u = t.getResourceAddress?.(l)) => {
    const c = ct(l, u);
    return new Uint8Array(await wn(c));
  };
  return {
    async readText(l) {
      if (e === "bridge" && typeof t.readResource == "function")
        return Mn(await i(l));
      const u = o(l);
      return e === "url" && u !== null ? Et(await s(l, u)) : typeof t.readResource == "function" ? Mn(await i(l)) : Et(await s(l, u));
    },
    async readJSON(l) {
      return JSON.parse(await this.readText(l));
    },
    async readBytes(l) {
      return typeof t.readResource == "function" ? cl(await i(l)) : s(l);
    },
    async readAudio(l) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(l);
      const u = o(l);
      return n === "url" && u !== null ? a(l, u) : typeof t.readResourceAsAudioData == "function" ? r(l) : Zi(await this.readBytes(l));
    },
    getURL(l) {
      return ct(l, t.getResourceAddress?.(l));
    }
  };
}
function fl(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return dl(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function ml(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, o = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (i)
        return Et(await i(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (i)
        return i(a);
      if (e)
        return Tt(await e(a));
      if (n)
        return Tt(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return r ? r(a) : Zi(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function hl(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function pl(t) {
  return hl(t) ? ml(t) : fl(t);
}
function er(t) {
  if (!(t === null || typeof t != "object")) {
    for (const e of Object.values(t)) er(e);
    Object.freeze(t);
  }
}
const gl = {
  parse(t) {
    const e = Ue(t);
    return e._tag === "err" ? { kind: "error", message: e.error.message } : (er(e.value), { kind: "ok", value: e.value });
  },
  encode: et,
  equals: (t, e) => et(t) === et(e)
};
async function yl(t, e, n, i = {}) {
  const r = t.sharedData;
  if (!r) throw new Error("This patch host does not support direct shared-data preparation.");
  if (i.signal?.aborted) throw new Error("Shared preparation cancelled.");
  const o = r.reserve(e.input, e.byteLength), a = i.signal?.onAbort(() => r.cancel(o.id));
  try {
    if (n(o), i.signal?.aborted) throw new Error("Shared preparation cancelled.");
    return await r.commit(o.id), { cancel: () => r.cancel(o.id) };
  } catch (s) {
    throw r.cancel(o.id), s;
  } finally {
    a?.();
  }
}
const Il = 3, Sl = (4 + ye) * 4, vl = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [C],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(t) {
    let e = _n(t);
    return {
      apply(n, i) {
        return e.closed && (e = _n(t)), e.apply(n, i);
      },
      stop() {
        e.stop();
      }
    };
  }
};
function _n(t) {
  let e = !1, n = 0, i;
  const r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
  function s(d) {
    const m = i;
    i = void 0, m ? m(d) : d.kind !== "cancelled" && t.report(d);
  }
  function l() {
    e || (e = !0, f.stop(), s({ kind: "cancelled" }), r.clear());
  }
  function u(d) {
    if (d.kind !== "submitted") {
      d.kind === "failed" && d.error.kind !== "transport" && (s(d), l());
      return;
    }
    r.add(d.completion), d.completion.then((m) => {
      r.delete(d.completion), !(e || m.kind === "sent") && (s(m), l());
    }, (m) => {
      e || (l(), t.fail(m));
    });
  }
  const c = {
    addEndpointListener(d, m) {
      const h = o.get(d) ?? /* @__PURE__ */ new Map();
      h.set(m, t.listen(d, m)), o.set(d, h);
    },
    removeEndpointListener(d, m) {
      o.get(d)?.get(m)?.(), o.get(d)?.delete(m);
    },
    addStoredStateValueListener(d) {
      a.set(d, t.subscribeStored(
        C,
        (m) => d({ key: C, value: m })
      ));
    },
    removeStoredStateValueListener(d) {
      a.get(d)?.(), a.delete(d);
    },
    requestFullStoredState(d) {
      t.readStored(C).then((m) => {
        e || d({ values: { [C]: m } });
      }, (m) => t.fail(m));
    },
    sendEventOrValue(d, m) {
      e || u(t.send({ kind: "event", endpoint: d, value: m }));
    }
  }, f = new Qi(c, {
    onDefect(d) {
      l(), t.fail(d);
    },
    curveCommand: (d, m, h) => ({
      async submit({ dspSessionId: I, deliverySerial: g, signal: v }) {
        const S = await t.prepareData(
          Il + d * 2 + m,
          Sl,
          (y) => {
            new Int32Array(y.buffer, y.byteOffset, 4).set([1297302855, I, g, ye]), li(h, new Float32Array(y.buffer, y.byteOffset + 16, ye));
          },
          v
        );
        S.kind === "failed" && (s(S), l());
      }
    }),
    async publishTriggerConfig(d) {
      const h = (await Promise.all(r)).find((g) => g.kind !== "sent");
      if (h) return h.kind === "failed" ? h : { kind: "cancelled" };
      if (e) return { kind: "cancelled" };
      const I = t.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: xi(d) });
      return I.kind === "submitted" ? I.completion : I;
    }
  });
  return {
    get closed() {
      return e;
    },
    apply(d, m) {
      if (e || m.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const h = ++n;
      return new Promise((I) => {
        const g = m.signal.onAbort(() => {
          s({ kind: "cancelled" }), l();
        });
        i = (v) => {
          g(), I(v);
        }, f.replaceModulation(d, (v) => {
          h === n && v.kind !== "preparing" && s(v);
        }), f.start();
      });
    },
    stop: l
  };
}
al({
  playMode: st("playMode"),
  glideTime: st("glideTime"),
  globalTune: st("globalTune"),
  [Q]: il({ initial: Fe(), codec: gl, prepare: (t) => t, engine: vl })
});
const De = 2048;
function fe(t, e) {
  if (!t)
    throw new Error(e);
}
function bl(t) {
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
const Tl = 2048, ze = 11, El = 256;
function K(t, e) {
  if (!t)
    throw new Error(e);
}
function Al(t) {
  return t > 0 && (t & t - 1) === 0;
}
const On = /* @__PURE__ */ new Map();
function Rl(t) {
  const e = On.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let o = 0, a = r;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    i[r] = o;
  }
  return On.set(t, i), i;
}
function tr(t, e, n = !1) {
  const i = t.length;
  K(i === e.length, "FFT real and imaginary buffers must have the same length"), K(Al(i), "FFT input length must be a power of two");
  const r = Rl(i);
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
      let f = 1, d = 0;
      for (let m = 0; m < a; m += 1) {
        const h = c + m, I = h + a, g = t[I], v = e[I], S = f * g - d * v, y = f * v + d * g, R = t[h], w = e[h];
        t[h] = R + S, e[h] = w + y, t[I] = R - S, e[I] = w - y;
        const N = f * l - d * u;
        d = f * u + d * l, f = N;
      }
    }
  }
  if (n)
    for (let o = 0; o < i; o += 1)
      t[o] /= i, e[o] /= i;
}
function nr(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    r[o] = (Number(e[o]) || 0) - i;
  return r;
}
function xl(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Tl,
  maxFramesPerTable: i = El
} = {}) {
  const r = Float32Array.from(t);
  K(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = r.length / n;
  K(o > 0, "Source wavetable files must contain at least one frame"), K(o <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && K(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const l = s * n, u = l + n;
    a.push(nr(r.slice(l, u)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function kn(t) {
  const e = nr(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return tr(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function ir(t, e, {
  mipLevelCount: n = ze
} = {}) {
  const i = t?.real?.length ?? 0;
  K(i > 0, "Spectrum must contain real samples"), K(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), K(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), o = new Float64Array(i), a = new Float64Array(i);
  for (let s = 1; s <= r; s += 1) {
    o[s] = t.real[s], a[s] = t.imaginary[s];
    const l = (i - s) % i;
    l !== s && (o[l] = t.real[l], a[l] = t.imaginary[l]);
  }
  return tr(o, a, !0), Float32Array.from(o);
}
const Le = 256, me = 2048, rr = 8, Ml = 12811, At = (rr + Le * Ml) * 4;
function Dn(t, e, n) {
  const i = Math.fround(t * e);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(i + (i >= 0 ? 0.5 : -0.5)))
  ));
}
function wl(t, e, n) {
  if (t.byteLength !== At || !Number.isInteger(e.frameCount) || e.frameCount < 1 || e.frameCount > Le)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const i = new Int32Array(t.buffer, t.byteOffset, t.byteLength / 4);
  i.set([
    1465139788,
    1,
    e.dspSessionId,
    e.generation,
    e.tableIndex,
    e.frameCount,
    ze,
    Le
  ]);
  let r = rr;
  const o = 131071, a = 8191, s = Math.fround(o / 1.5), l = Math.fround(a / 0.5);
  for (let u = 0; u < ze; ++u) {
    const c = Math.min(me, Math.max(256, (1 << u) * 32)), f = me / c;
    for (let d = 0; d < e.frameCount; ++d) {
      const m = ir(n(d), u), h = r + d * (c + 1);
      for (let I = 0; I <= c; ++I) {
        const g = (I === c ? 0 : I) * f, v = (g + me - f) % me, S = (g + f) % me, y = m[g], R = m[v], w = m[S];
        if (y === void 0 || R === void 0 || w === void 0 || !Number.isFinite(y) || !Number.isFinite(R) || !Number.isFinite(w))
          throw new Error("Wavetable preparation produced invalid samples.");
        const N = Math.fround(0.5 * Math.fround(w - R));
        i[h + I] = Dn(y, s, o) & 262143 | Dn(N, l, a) << 18;
      }
    }
    r += (c + 1) * Le;
  }
}
const _l = "runtimeSyncRequest", Ol = 2147483647, kl = "runtimeState", Dl = "retryDesiredTableRequest", Ll = "workerLoadFailure", Nl = "serviceLoadAbort", Cl = "wavetableLoadBegin", Pl = "wavetableMipFrame", Fl = "wavetableUploadAck", Ul = "wavetableMipRequest", Kl = "wavetablePrewarmRequest", Bl = "wavetablePrewarmNotification", $l = "assets/factory-bank-catalog.json", Rt = 3, Vl = 1, zl = Rt * De, Hl = 1, Wl = 2, ql = 3, jl = 1, Gl = 2, Jl = 2e4, xe = Hl, Ln = Wl, Nn = ql, H = jl, Cn = Gl, Ql = 48 * 1024 * 1024, ut = 3;
function Pn(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function M(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function Fn(t) {
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
function Un(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function Kn(t, e) {
  if (!t)
    throw new Error(e);
}
function Xl(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function Yl(t, e) {
  return bl(await t.readJSON(e));
}
function Zl(t) {
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
function ec(t, e) {
  const n = Math.round(Number(t) || 0);
  return Xl(n, 0, Math.max(0, e - 1));
}
function dt(t, e, n, i, r) {
  return `${t}:${e}:${n}:${i}:${r}`;
}
function tc(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function Bn(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function $n(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function Me() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function nc(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class ic {
  connection;
  delivery;
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
    this.connection = e, this.delivery = n.delivery ?? "events", this.resourceClient = pl(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? $l, this.maxBatchesInFlight = Pn(
      n.maxFramesInFlight,
      Vl
    ), this.mipLevelCount = n.mipLevelCount ?? ze, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Ql) || 0)), this.serviceLoadTimeoutMs = Pn(n.serviceLoadTimeoutMs, Jl), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    if (this.started)
      return this;
    if (this.delivery === "shared" && !this.connection.sharedData)
      throw new Error("Cosimo requires a host with direct shared wavetable preparation.");
    return this.started = !0, M("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(kl, this.handleRuntimeState), this.connection.addEndpointListener?.(Fl, this.handleUploadAck), this.connection.addEndpointListener?.(Ul, this.handleMipRequest), this.connection.addEndpointListener?.(Kl, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Bl, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      _l,
      Ol
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Yl(this.resourceClient, this.catalogPath), M("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < ut; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = Bn(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Bn(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = dt(
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
          ...$n(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== r || !this.serviceLoadHasPendingTransfers()) && (M("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: Nn,
          failureReasonCode: Cn
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== Nn || e.failureReasonCode !== Cn ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = xe,
    failureReasonCode: s = H
  }) {
    this.connection.sendEventOrValue?.(Ll, {
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
    failureReasonCode: o = H
  }) {
    this.connection.sendEventOrValue?.(Nl, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(e) {
    M("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? Fn(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(Dl, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), r = ec(e, i.tables.length), o = i.tables[r];
    Kn(o, `Could not resolve table ${r}`);
    const a = tc(o, De, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, M("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const l = Me();
    M("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const u = await this.resourceClient.readAudio(o.sourceWav), c = xl(u.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: De
    });
    return M("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: c.frameCount,
      loadDurationMs: Math.round(Me() - l)
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
    if (M("info", "Committing desired wavetable load", {
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.delivery === "shared") {
      this.prepareSharedTable();
      return;
    }
    this.connection.sendEventOrValue?.(Cl, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  async prepareSharedTable() {
    const e = this.serviceTable;
    if (!e) return;
    const n = Me();
    try {
      if (await yl(this.connection, {
        input: e.oscillatorIndex,
        byteLength: At
      }, (i) => {
        wl(i, e, (r) => this.getSpectrumForFrame(r));
      }), this.serviceTable !== e || this.knownSessionId !== e.dspSessionId) return;
      M("info", "Submitted shared wavetable", {
        oscillatorIndex: e.oscillatorIndex,
        tableIndex: e.tableIndex,
        generation: e.generation,
        frameCount: e.frameCount,
        preparedBytes: At,
        preparationMs: Me() - n,
        sampleUploadBytes: 0
      });
    } catch (i) {
      if (this.serviceTable !== e || this.knownSessionId !== e.dspSessionId) return;
      const r = this.candidateValidations[e.oscillatorIndex];
      r?.dspSessionId === e.dspSessionId && r.generation === e.generation && r.desiredIntentSerial === e.desiredIntentSerial && (this.candidateValidations[e.oscillatorIndex] = null), this.emitWorkerLoadFailure({
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: 0,
        tableIndex: e.tableIndex,
        candidateAttemptSerial: e.desiredIntentSerial,
        failurePhase: Ln,
        failureReasonCode: H
      }), this.serviceTable = null, this.clearMipTransferState(), M("error", "Shared wavetable preparation failed", { detail: we(i) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(e) {
    M("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: xe,
      failureReasonCode: H
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: xe,
      failureReasonCode: H
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = xe,
    failureReasonCode: i = H
  } = {}) {
    M("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (M("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: we(o)
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
    }, this.clearMipTransferState(), e.kind === "loading" && (this.delivery === "shared" ? await this.prepareSharedTable() : (this.createFullMipJobsForServiceTable(2), this.pumpUploads()));
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
      this.isCurrentRuntimeState(e) && (M("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: we(a)
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
    for (let e = 0; e < ut; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, nc(() => {
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
        M("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: H
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
    const n = Zl(e ?? {});
    if (M("info", "Received runtime state", Fn(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= ut)
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
          r.spectra[a] || (r.spectra[a] = kn(r.frames[a]));
        const o = this.tableCache.get(r.cacheKey);
        o && this.refreshCacheEntryByteCount(o), M("info", "Prewarmed wavetable source table", {
          tableIndex: r.tableIndex,
          tableId: r.tableMeta.tableId,
          tableName: r.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (r) {
        M("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: we(r)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), r = Math.trunc(Number(e?.generation)), o = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), s = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || r !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const l = dt(
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
      ...$n(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(l, u), u);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (M("info", "Received wavetable mip request", {
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), l = Math.trunc(Number(n.frameIndexBase)), u = Math.trunc(Number(n.frameCount)), c = dt(
      i,
      r,
      o,
      a,
      s
    ), f = this.mipJobs.get(c), d = this.serviceTable?.frameCount ?? 0, m = Math.min(
      Rt,
      d - l
    );
    if (!(!f || f.completed || !f.inFlightBatchBases.has(l) || u <= 0 || u !== m)) {
      f.inFlightBatchBases.delete(l);
      for (let h = 0; h < u; h += 1) {
        const I = l + h;
        f.ackedFrames[I] || (f.ackedFrames[I] = 1, f.ackedFrameCount += 1);
      }
      f.ackedFrameCount === d && f.nextFrameIndex >= d && f.inFlightBatchBases.size === 0 && (f.completed = !0, this.activeUploadKey === f.key && (this.activeUploadKey = null)), Un(l, u, d) && M("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: r,
        generation: o,
        tableIndex: f.tableIndex,
        mipIndex: s,
        frameIndexBase: l,
        batchFrameCount: u,
        ackedFrameCount: f.ackedFrameCount,
        frameCount: d,
        inFlightBatches: f.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (Kn(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = kn(this.serviceTable.frames[e]);
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
    if (this.delivery === "shared" || !this.serviceTable)
      return;
    let e = this.activeUploadKey ? this.mipJobs.get(this.activeUploadKey) ?? null : null;
    if ((!e || e.completed) && (e = this.selectNextMipJob(), this.activeUploadKey = e?.key ?? null), !e) {
      this.completeServiceTransferIfReady();
      return;
    }
    for (; e.inFlightBatchBases.size < this.maxBatchesInFlight && e.nextFrameIndex < this.serviceTable.frameCount; ) {
      const n = e.nextFrameIndex, i = Math.min(
        Rt,
        this.serviceTable.frameCount - n
      ), r = new Float32Array(zl);
      try {
        for (let o = 0; o < i; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), l = ir(s, e.mipIndex);
          r.set(l, o * De);
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
            failurePhase: Ln,
            failureReasonCode: H
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Pl, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(r)
      }), Un(n, i, this.serviceTable.frameCount) && M("info", "Sent wavetable mip batch", {
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
function we(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function rc(t, e = {}) {
  return new ic(t, e);
}
function oc(t, e, n) {
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
const _e = 1600, ac = /* @__PURE__ */ new Set([
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
function sc(t) {
  return t && typeof t == "object" && "event" in t ? t.event : t;
}
function lc(t) {
  return {
    values: {
      [Q]: t.modulation,
      [Ci]: t.lane,
      [C]: t.articulations
    }
  };
}
class cc {
  performer;
  #r;
  #n;
  #s = /* @__PURE__ */ new Map();
  #c = /* @__PURE__ */ new Map();
  #h = /* @__PURE__ */ new Map();
  #d = /* @__PURE__ */ new Map();
  #t = /* @__PURE__ */ new Map();
  #o = /* @__PURE__ */ new Map();
  #l;
  #e;
  #f = null;
  #a = null;
  #m = null;
  #i = 0;
  constructor(e, n, i) {
    this.performer = new e(), this.#l = n, this.#e = new URL("./", i), this.#r = new Map(
      this.performer.getInputEndpoints().map((r) => [r.endpointID, r])
    ), this.#n = new Map(
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
      he(this.performer, "sendInputEvent", e)(n), this.#t.set(e, (this.#t.get(e) ?? 0) + 1);
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
    const i = this.#s.get(e) ?? /* @__PURE__ */ new Set();
    i.add(n), this.#s.set(e, i);
  }
  removeEndpointListener(e, n) {
    this.#s.get(e)?.delete(n);
  }
  addParameterListener(e, n) {
    const i = this.#c.get(e) ?? /* @__PURE__ */ new Set();
    i.add(n), this.#c.set(e, i);
  }
  removeParameterListener(e, n) {
    this.#c.get(e)?.delete(n);
  }
  requestParameterValue(e) {
    const n = this.#h.get(e);
    if (n !== void 0)
      for (const i of this.#c.get(e) ?? []) i(n);
  }
  requestFullStoredState(e) {
    e(lc(this.#l));
  }
  getResourceAddress(e) {
    return new URL(e, this.#e);
  }
  sendNativeArticulationTriggerConfig(e) {
    this.#m = e;
  }
  getInstallationState() {
    return {
      runtimeStates: new Map(this.#d),
      runtimeInstallAck: this.#f,
      effectiveRackState: this.#a,
      articulationTriggerConfig: this.#m,
      inputEventCounts: new Map(this.#t),
      outputEventCounts: new Map(this.#o),
      advancedFrames: this.#i
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
    )(n, 0), this.#h.set(e, n);
    for (const r of this.#c.get(e) ?? []) r(n);
  }
  advance(e) {
    if (!Number.isInteger(e) || e < 1 || e > 128)
      throw new Error("OfflineEngineHost advances must contain 1 to 128 frames.");
    this.performer.advance(e), this.#i += e, this.drainOutputEvents();
  }
  drainOutputEvents() {
    const e = /* @__PURE__ */ new Set([
      ...ac,
      ...this.#s.keys()
    ]);
    for (const n of e) {
      const i = this.#n.get(n);
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
      ), a = Array.from({ length: r }, (s, l) => sc(o(l)));
      he(
        this.performer,
        "resetOutputEventCount",
        n
      )();
      for (const s of a) {
        this.#o.set(
          n,
          (this.#o.get(n) ?? 0) + 1
        ), this.recordDiagnostic(n, s);
        for (const l of this.#s.get(n) ?? []) l(s);
      }
    }
  }
  recordDiagnostic(e, n) {
    if (!n || typeof n != "object") return;
    const i = n;
    if (e === "runtimeState") {
      const r = Math.trunc(Number(i.oscillatorIndex));
      r >= 0 && r < 3 && this.#d.set(r, i);
    } else e === "runtimeInstallAck" ? this.#f = i : e === "effectiveRackState" && (this.#a = i);
  }
}
const Vn = "assets/factory-bank-catalog.json";
function uc(t) {
  return {
    async readText(e) {
      if (e !== Vn) throw new Error(`Speedrun resource bundle has no text ${e}.`);
      return JSON.stringify(t.catalog);
    },
    async readJSON(e) {
      if (e !== Vn) throw new Error(`Speedrun resource bundle has no JSON ${e}.`);
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
const dc = [
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
  lane;
}
function fc(t) {
  let e = 0;
  for (const n of t) {
    if (n.endpointID !== gt || typeof n.value != "object" || n.value === null)
      continue;
    const i = n.value.deliverySerial;
    typeof i == "number" && Number.isFinite(i) && i > 0 && (e = Math.max(e, i));
  }
  return e;
}
function mc(t) {
  const e = Object.fromEntries(t.modulation.routes.flatMap((i) => {
    const r = Dt(i);
    return r === null ? [] : [[i.id, r]];
  })), n = qi(t.lane);
  return {
    tableIndices: T.map((i) => Math.round(Number(t.parameters[`osc${i}WavetableSelect`]) || 0)),
    modulationFrontier: pt(t.modulation, null).length,
    articulationFrontier: wi(
      t.articulations,
      e
    ).length,
    rackChainLength: Wi(t.lane).chainLength,
    rackParamSerial: fc(n)
  };
}
function hc(t, e) {
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
function zn(t, e) {
  const n = e.tableIndices.every((a, s) => {
    const l = t.runtimeStates.get(s);
    return !!l?.hasActive && Number(l?.activeTableIndex) === a;
  }), i = e.modulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedModulationSerial) >= e.modulationFrontier, r = e.articulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedArticulationSerial) <= -e.articulationFrontier, o = Number(t.effectiveRackState?.laneCommittedChainLength) === e.rackChainLength && Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) >= e.rackParamSerial;
  return n && i && r && o;
}
function pc(t, e) {
  return e.tableIndices.every((n, i) => {
    const r = t.runtimeStates.get(i);
    return !!r?.hasActive && Number(r?.activeTableIndex) === n;
  }) ? e.modulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedModulationSerial) < e.modulationFrontier ? "modulation" : e.articulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedArticulationSerial) > -e.articulationFrontier ? "articulation" : "rack" : "wavetable";
}
function gc(t) {
  return `${[0, 1, 2].map((n) => {
    const i = t.runtimeStates.get(n);
    return i ? `${n}:${Number(i.activeGeneration) || 0}/${Number(i.generationFrontier) || 0} load=${Number(i.loadingGeneration) || 0} active=${!!i.hasActive}` : `${n}:missing`;
  }).join(", ")}; mod=${Number(t.runtimeInstallAck?.acceptedModulationSerial) || 0} art=${Number(t.runtimeInstallAck?.acceptedArticulationSerial) || 0} rack=${Number(t.effectiveRackState?.laneCommittedChainLength) || 0} params=${Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) || 0} mipSent=${t.inputEventCounts.get("wavetableMipFrame") ?? 0} mipAck=${t.outputEventCounts.get("wavetableUploadAck") ?? 0}`;
}
function or(t) {
  return t >>> 16 & 255;
}
function ar(t) {
  return t >>> 8 & 127;
}
function Vt(t) {
  return t & 127;
}
function yc(t, e, n) {
  if (t === null) return null;
  let i;
  try {
    i = JSON.parse(t);
  } catch {
    return null;
  }
  const r = i.activeMode, o = r === "key" ? i.key : r === "vel" ? i.velocity : i.chain;
  if (!Array.isArray(o)) return null;
  const a = r === "key" ? ar(e) : r === "vel" ? Vt(e) : n % 128, s = Math.trunc(Number(o[a]));
  return s >= 0 && s <= 127 ? s : null;
}
function Ic(t, e, n, i) {
  const r = or(e);
  if ((r & 240) === 144 && Vt(e) > 0) {
    const o = yc(n, e, i);
    o !== null && t.sendEventOrValue("articulationNoteMeta", {
      channel: r & 15,
      noteNumber: ar(e),
      selectorA: o,
      selectorB: 0,
      durationSamples: 0,
      ageSamples: 0
    });
  }
  t.sendMIDIInputEvent("midiIn", e);
}
async function Sc() {
  await new Promise((t) => setTimeout(t, 0));
}
async function vc(t, e) {
  const n = globalThis.performance?.now?.() ?? 0, i = new cc(t, {
    modulation: e.state.modulation,
    lane: e.state.lane,
    articulations: e.state.articulations
  }, e.resourceBaseURL);
  await i.initialise(e.sessionID, e.sampleRate), i.setInitialParameters(e.state.parameters), i.sendEventOrValue("tempo", { bpm: 120 });
  const r = await Cs(i, [
    js,
    Zs,
    () => rc(i, {
      maxFramesInFlight: 1,
      serviceLoadTimeoutMs: 2e4,
      ...e.resourceBundle ? { resourceClient: uc(e.resourceBundle) } : {}
    })
  ]), o = mc(e.state), a = e.maxInstallFrames ?? e.sampleRate * 4;
  let s = 0;
  try {
    for (; s < a; ) {
      await i.pump(128), s += 128;
      const y = i.getInstallationState(), R = hc(y, o);
      if (R) throw R;
      if (zn(y, o)) break;
      s / 128 % 8 === 0 && await Sc();
    }
    const S = i.getInstallationState();
    if (!zn(S, o)) {
      const y = pc(S, o);
      throw new pe(
        y,
        `timed out after ${s} virtual frames (${gc(S)}).`
      );
    }
  } finally {
    await r.stop();
  }
  const l = new Float32Array(e.frameCount * 2), u = oc(e.performance, e.frameCount, e.sampleRate), c = i.getInstallationState().articulationTriggerConfig, f = e.recordTelemetry === !0, d = /* @__PURE__ */ new Map();
  let m = 0, h = 0, I = 0;
  f && (i.sendEventOrValue("filterSpectrumActivity", 1), i.sendEventOrValue("distortionScopeActivity", 1), i.sendEventOrValue("distortionHistoryActivity", 1));
  const g = f ? dc.map((S) => {
    const y = (R) => {
      const w = Math.floor(h / _e), N = d.get(w) ?? {};
      N[S] = structuredClone(R), d.set(w, N);
    };
    return i.addEndpointListener(S, y), { endpointID: S, listener: y };
  }) : [];
  try {
    for (; h < e.frameCount; ) {
      for (; m < u.length && u[m].sample === h; ) {
        const w = u[m];
        Ic(i, w.code, c, I), (or(w.code) & 240) === 144 && Vt(w.code) > 0 && (I += 1), m += 1;
      }
      const S = u[m]?.sample ?? e.frameCount, y = (Math.floor(h / _e) + 1) * _e, R = Math.min(
        128,
        e.frameCount - h,
        S - h,
        ...f ? [y - h] : []
      );
      if (R < 1)
        throw new Error("Speedrun checkpoint render computed an empty advance.");
      i.render(R, l, h), h += R;
    }
  } finally {
    for (const { endpointID: S, listener: y } of g)
      i.removeEndpointListener(S, y);
  }
  const v = (globalThis.performance?.now?.() ?? n) - n;
  return {
    rootIndex: e.rootIndex,
    rootNote: e.rootNote,
    checkpointIndex: e.checkpointIndex,
    frameCount: e.frameCount,
    samples: l,
    telemetry: {
      frameCount: Math.ceil(e.frameCount / _e),
      frames: [...d.entries()].sort(([S], [y]) => S - y).map(([S, y]) => ({ frame: S, events: y }))
    },
    metrics: {
      renderedFrameCount: e.frameCount,
      installFrameCount: s,
      elapsedMilliseconds: v,
      realtimeMultiplier: v > 0 ? e.frameCount / (v * e.sampleRate / 1e3) : null
    }
  };
}
const Oe = self;
function bc(t) {
  return {
    name: t instanceof Error ? t.name : "Error",
    message: t instanceof Error ? t.message : String(t),
    stack: t instanceof Error ? t.stack : void 0
  };
}
Oe.addEventListener("message", (t) => {
  const e = t.data;
  (async () => {
    if (e.type !== "render-root" || typeof e.engineModuleURL != "string")
      throw new Error("Speedrun checkpoint worker received an unsupported request.");
    const i = await import(new URL(e.engineModuleURL, Oe.location.href).href), r = i.default ?? i.WavetableSynth, o = await vc(
      r,
      e.job
    );
    Oe.postMessage({
      type: "render-root-complete",
      requestID: e.requestID,
      result: o
    }, [o.samples.buffer]);
  })().catch((n) => {
    Oe.postMessage({
      type: "render-root-failed",
      requestID: e.requestID,
      error: bc(n)
    }, []);
  });
});
