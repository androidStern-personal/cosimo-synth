const Gt = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function br(t) {
  const e = Gt.find((n) => n.deviceType === t);
  if (e === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${t}`);
  return e;
}
function K(t) {
  return br(t).laneEndpointID;
}
function Jt(t, e) {
  if (!Number.isInteger(e) || e < 1 || e > 5)
    throw new Error(`Effect Output Trim instance is out of range: ${e}`);
  return `${br(t).hostStem}${e}OutputTrimDb`;
}
function Qt() {
  return Gt.flatMap((t) => Array.from(
    { length: 5 },
    (e, n) => Jt(t.deviceType, n + 1)
  ));
}
function yr(t) {
  if (typeof t != "string")
    return null;
  for (const e of Gt)
    for (let n = 1; n <= 5; n += 1)
      if (t === Jt(e.deviceType, n))
        return {
          deviceType: e.deviceType,
          instanceNumber: n,
          laneEndpointID: e.laneEndpointID
        };
  return null;
}
function Sr(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function Ji(t) {
  const e = (Sr(t, -100, 35) - -100) / 135;
  return e * e;
}
function Qi(t) {
  return -100 + Math.sqrt(Sr(t, 0, 1)) * 135;
}
const F = (t, e) => ({ label: t, value: e });
function j(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const H = Object.freeze({
  filter: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: j(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), S = (t, e, n, r, o, i, a, s = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: r,
  min: o,
  max: i,
  initial: a,
  step: s.step ?? (i - o) / 1e3,
  scale: s.scale ?? "linear",
  unit: s.unit ?? "",
  choices: s.choices,
  quick: s.quick ?? !1,
  modulationTargetIndex: s.modulationTargetIndex ?? null,
  modulationApplication: s.modulationApplication ?? (s.modulationTargetIndex === void 0 || s.modulationTargetIndex === null ? null : "linear"),
  valueKind: s.valueKind,
  modulationDragStyle: s.modulationDragStyle
});
function W(t, e, n) {
  return S(
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
const Xi = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Yi = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Zi = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: H.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      S("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(F), quick: !0 }),
      S("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      S("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      S("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      W("filter", "globalFilterOutputTrimDb", 39)
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: H.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      S("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [F("Classic", 0), F("Harmonics", 1)] }),
      S("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      S("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      S("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      S("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      S("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      S("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [F("Symmetric", 0), F("Asymmetric", 1), F("Wavefold", 2)] }),
      W("drive", "distortionOutputTrimDb", 40)
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: H.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      S("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      S("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      S("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      S("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      S("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      W("ott", "ottOutputTrimDb", 41)
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: H.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      S("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(F) }),
      S("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(F) }),
      S("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      S("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      S("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      S("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      S("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, { unit: "Hz", scale: "log", modulationTargetIndex: 17, modulationApplication: "semitones" }),
      W("chorus", "chorusOutputTrimDb", 42)
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: H.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      S("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      S("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      S("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      S("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      S("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
        unit: "ms",
        scale: "log",
        modulationTargetIndex: 36,
        modulationApplication: "octaves"
      }),
      W("flanger", "flangerOutputTrimDb", 43)
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: H.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      S("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [F("Free", 0), F("Sync", 1)] }),
      S("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      S("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Xi.map(F) }),
      S("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      S("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      S("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      S("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      S("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      W("phaser", "phaserOutputTrimDb", 44)
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: H.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      S("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [F("Free", 0), F("Sync", 1)] }),
      S("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      S("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Yi.map(F) }),
      S("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      S("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      S("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      W("delay", "delayOutputTrimDb", 45)
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: H.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      S("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      S("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      S("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      S("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      W("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], lt = Zi, Tr = Object.freeze(
  lt.flatMap((t) => t.parameters)
);
new Map(
  Tr.map((t) => [t.endpointID, t])
);
function eo(t) {
  const e = lt.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function Er() {
  return Tr;
}
const E = ["A", "B", "C"], Xt = [
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
], to = [
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
], le = Object.freeze([
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
]), no = Object.freeze([
  ...E.flatMap((t) => Xt.map(
    (e) => `osc${t}.${e}`
  )),
  ...to
]);
new Set(
  E.flatMap((t) => Xt.map(
    (e) => `osc${t}.${e}`
  ))
);
const Ar = Object.freeze(
  no.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), ro = Er().filter(
  (t) => t.modulationTargetIndex !== null
), io = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function Yt(t) {
  const e = oo(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function oo(t) {
  const e = io.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const ao = [
  ...ro.map((t) => ({
    kind: Yt(t.endpointID),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Rr = Object.freeze(
  ao.sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), X = Object.freeze([
  ...Ar,
  ...Rr
]), Je = le.length, xr = Ar.length, ut = Rr.length, so = Je * X.length, co = new Map(le.map((t) => [t.id, t])), Mr = new Map(le.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), Te = new Map(X.map((t) => [t.kind, t]));
function lo() {
  if (Je !== 14 || xr !== 59 || ut !== 47 || so !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = le.filter((r) => r.group === t).sort((r, o) => r.runtimeIndex - o.runtimeIndex);
    if (n.length !== e || n.some((r, o) => r.runtimeIndex !== o))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 59], ["rack", 47]]) {
    const n = X.filter((r) => r.group === t);
    if (n.length !== e || n.some((r, o) => r.runtimeIndex !== o))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (co.size !== Je || Mr.size !== Je || Te.size !== X.length)
    throw new Error("Modulation identities must be unique");
}
lo();
function Or(t, e) {
  const n = Mr.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function Zt(t) {
  return typeof t != "string" ? null : Te.has(t) ? t : null;
}
function uo(t) {
  const e = Zt(t);
  return e !== null && Te.get(e)?.group === "voice" ? e : null;
}
function en(t) {
  const e = Zt(t);
  return e !== null && Te.get(e)?.group === "rack" ? e : null;
}
function wr(t) {
  const e = Te.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function kr(t) {
  const e = Te.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function fo(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const _r = 4, mo = _r * ut, ho = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFrequencyHz", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), po = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function ue(t) {
  if (typeof t != "string")
    return null;
  const e = po.exec(t);
  if (e === null)
    return null;
  const n = e[1], r = ho.get(n);
  if (r === void 0)
    return null;
  const o = e[3];
  return r.includes(o) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: o
  } : null;
}
function tn(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function Dr(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function Nr(t) {
  if (t === null)
    return null;
  const e = Dr(t) - 1;
  return e > _r ? null : e * ut + kr(tn(t));
}
const ee = 2048, ie = ee + 3, yn = 20, Cr = "MSEG 1";
function Lr(t) {
  return t !== null && typeof t == "object" ? t : {};
}
function Pr(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function _e(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function go(t) {
  return Pr(Number.isFinite(t) ? t : 0, -yn, yn);
}
function oe(t) {
  return Pr(Number.isFinite(t) ? t : 0, 0, 1);
}
function Fr(t = Cr) {
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
function vo(t, e, n) {
  const r = Lr(t);
  let o = Number(r.x);
  return Number.isFinite(o) || (o = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (o = oe(o)), {
    x: o,
    y: oe(Number(r.y)),
    curvePower: go(Number(r.curvePower))
  };
}
function nn(t = Fr()) {
  const e = Lr(t), n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((o, i) => vo(o, i, n.length));
  if (!_e(r[0].x, 0) || !_e(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let o = 1; o < r.length; o += 1)
    if (r[o].x < r[o - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Cr,
    globalSmooth: !!e.globalSmooth,
    points: r
  };
}
function Io(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, r = Math.exp(e) - 1;
  return n / r;
}
function bo(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const r = t[n], o = t[n + 1];
    if (e < o.x)
      return { from: r, to: o, laterPointWins: !1 };
    if (_e(e, o.x)) {
      let i = n + 1;
      for (; i + 1 < t.length && _e(t[i + 1].x, e); )
        i += 1;
      return {
        from: t[i],
        to: t[i],
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
function yo(t, e) {
  const n = oe(Number(e)), r = bo(t, n);
  if (r.laterPointWins || _e(r.from.x, r.to.x))
    return r.to.y;
  const o = r.to.x - r.from.x, i = o <= 0 ? 1 : (n - r.from.x) / o, a = oe(Io(i, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function So(t, e) {
  return yo(nn(t).points, e);
}
function To(t) {
  const e = new Float32Array(ie);
  return rn(t, e), e;
}
function rn(t, e) {
  if (e.length !== ie) throw new Error("Invalid MSEG destination length.");
  const n = nn(t);
  for (let r = 0; r < ee; r += 1) {
    const o = r / (ee - 1);
    e[r + 1] = So(n, o);
  }
  e[0] = e[1], e[ee + 1] = e[ee], e[ee + 2] = e[ee];
}
const Eo = 0, te = 2;
function Dt(t) {
  return t !== null && typeof t == "object" ? t : {};
}
function Ao(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Ro(...t) {
  return { ...Fr(...t), format: "cosimo.mseg.shape" };
}
function Nt(...t) {
  return { ...nn(...t), format: "cosimo.mseg.shape" };
}
function Sn(t) {
  return JSON.stringify(Nt(t));
}
function Tn(t, e) {
  return Sn(t) === Sn(e);
}
function xo(t) {
  const e = Number(t);
  return Ao(
    Number.isFinite(e) ? e : 1,
    Eo,
    te
  );
}
function Ct() {
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
function Mo(t) {
  if (!t || typeof t != "object")
    return null;
  const e = Dt(t), n = oe(Number(e.startX)), r = oe(Number(e.endX));
  return Math.abs(n - r) <= 1e-12 ? null : r < n ? { startX: r, endX: n } : { startX: n, endX: r };
}
function Oo(t = Ct()) {
  const e = Dt(t), n = Dt(e.rate), r = Number(n.seconds), o = e.noteOffPolicy, i = o === "finish_loop" || o === "immediate" || o === "ignore" ? o : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: xo(Number.isFinite(r) ? r : 1)
    },
    loop: Mo(e.loop),
    noteOffPolicy: i,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
const ft = "modulationProgram", wo = "modulationAmount", Ur = le.filter((t) => t.group === "voice").length, $r = le.filter((t) => t.group === "macro").length, Ze = xr, ko = ut, et = ko + mo, ne = Ur * Ze, me = $r * Ze, _o = Ur * et, Do = $r * et, Z = 512, de = 256, Br = ne + me;
function No(t) {
  const e = Or(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function Co(t) {
  const e = uo(t);
  return e === null ? null : wr(e);
}
function Kr(t) {
  const e = Co(t.targetKind), n = en(t.targetKind);
  let r = n === null ? void 0 : kr(n);
  if (r === void 0) {
    const a = Nr(
      ue(t.targetKind)
    );
    a !== null && (r = a);
  }
  if (e === null && r === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = Or(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (e !== null) {
      const m = s * Ze + e;
      return {
        path: "macroVoice",
        cellIndex: m,
        sourceIndex: s,
        targetIndex: e,
        articulationCellIndex: ne + m
      };
    }
    const c = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * et + c,
      sourceIndex: s,
      targetIndex: c,
      articulationCellIndex: null
    };
  }
  const o = No(t);
  if (e !== null) {
    const a = o * Ze + e;
    return {
      path: "voice",
      cellIndex: a,
      sourceIndex: o,
      targetIndex: e,
      articulationCellIndex: a
    };
  }
  const i = r ?? 0;
  return {
    path: "voiceRack",
    cellIndex: o * et + i,
    sourceIndex: o,
    targetIndex: i,
    articulationCellIndex: null
  };
}
function on(t) {
  return ue(t.targetKind) !== null ? null : Kr(t).articulationCellIndex;
}
function Lo(t) {
  if (en(t.targetKind) !== null)
    return !1;
  const e = ue(t.targetKind);
  return e !== null && Nr(e) === null;
}
function Po(t) {
  return {
    ...Kr(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function zr(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (Lo(n))
      continue;
    const r = Po(n), o = e[r.path];
    if (o.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    o.set(r.cellIndex, r);
  }
  return e;
}
function Fo(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function he(t) {
  return [...t.values()].filter(Fo).sort((e, n) => e.cellIndex - n.cellIndex);
}
function Be(t, e, n, r, o) {
  for (let i = 0; i < t.length; i += 1) {
    const a = t[i];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${i}`);
    e[i] = a.cellIndex, n[i] = a.sourceIndex, r[i] = a.targetIndex, o[i] = a.polarity;
  }
}
function mt(t) {
  const e = zr(t), n = he(e.voice), r = he(e.macroVoice), o = he(e.voiceRack), i = he(e.macroRack), a = Array.from({ length: ne }, () => 0), s = Array.from({ length: ne }, () => 0), c = Array.from({ length: ne }, () => 0), m = Array.from({ length: ne }, () => 0), l = Array.from({ length: ne }, () => 0);
  Be(n, a, s, c, m);
  const d = Array.from({ length: me }, () => 0), u = Array.from({ length: me }, () => 0), f = Array.from({ length: me }, () => 0), v = Array.from({ length: me }, () => 0), b = Array.from({ length: me }, () => 0);
  if (Be(
    r,
    d,
    u,
    f,
    v
  ), o.length > Z || i.length > de)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${o.length} voice-rack (max ${Z}), ${i.length} macro-rack (max ${de})`
    );
  const h = Array.from({ length: Z }, () => 0), T = Array.from({ length: Z }, () => 0), R = Array.from({ length: Z }, () => 0), p = Array.from({ length: Z }, () => 0), g = Array.from({ length: Z }, () => 0), y = Array.from({ length: _o }, () => 0);
  Be(
    o,
    h,
    T,
    R,
    p
  );
  const O = Array.from({ length: de }, () => 0), P = Array.from({ length: de }, () => 0), B = Array.from({ length: de }, () => 0), Y = Array.from({ length: de }, () => 0), Ae = Array.from({ length: Do }, () => 0);
  Be(
    i,
    O,
    P,
    B,
    Y
  );
  for (const C of e.voice.values()) l[C.cellIndex] = C.amount;
  for (const C of e.macroVoice.values()) b[C.cellIndex] = C.amount;
  for (const C of e.voiceRack.values()) y[C.cellIndex] = C.amount;
  for (const C of e.macroRack.values()) Ae[C.cellIndex] = C.amount;
  for (let C = 0; C < o.length; C += 1) {
    const bn = o[C];
    if (bn === void 0) throw new Error(`Missing compiled voice-rack route at index ${C}`);
    g[C] = bn.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: c,
    voiceRoutePolarities: m,
    voiceRouteAmounts: l,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: d,
    macroVoiceRouteSources: u,
    macroVoiceRouteTargets: f,
    macroVoiceRoutePolarities: v,
    macroVoiceRouteAmounts: b,
    voiceRackRouteCount: o.length,
    voiceRackRouteCells: h,
    voiceRackRouteSources: T,
    voiceRackRouteTargets: R,
    voiceRackRoutePolarities: p,
    voiceRackRouteReducers: g,
    voiceRackRouteAmounts: y,
    macroRackRouteCount: i.length,
    macroRackRouteCells: O,
    macroRackRouteSources: P,
    macroRackRouteTargets: B,
    macroRackRoutePolarities: Y,
    macroRackRouteAmounts: Ae
  };
}
const Uo = ["voice", "macroVoice", "voiceRack", "macroRack"], $o = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function En(t) {
  return zr(t);
}
function Bo(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function Ko(t, e) {
  if (t === null)
    return [{ endpointID: ft, value: mt(e) }];
  const n = En(t), r = En(e), o = [];
  for (const i of Uo) {
    const a = he(n[i]), s = he(r[i]);
    if (a.length !== s.length)
      return [{ endpointID: ft, value: mt(e) }];
    for (let c = 0; c < s.length; c += 1) {
      const m = a[c], l = s[c];
      if (m === void 0 || l === void 0 || !Bo(m, l))
        return [{ endpointID: ft, value: mt(e) }];
      m.amount !== l.amount && o.push({
        endpointID: wo,
        value: {
          pathKind: $o[i],
          cellIndex: l.cellIndex,
          amount: l.amount
        }
      });
    }
  }
  return o;
}
function Ee(t) {
  return { _tag: "ok", value: t };
}
function we(t) {
  return { _tag: "err", error: t };
}
function zo(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Vo(t) {
  throw new Error(t ?? "Invariant violated");
}
const jo = "globalTune", Ho = "globalTuneSemitones", q = -24, Re = 24, An = 0, Vr = -48, jr = 48, Lt = -48, Hr = 6, an = 0, Rn = (an - Lt) / (Hr - Lt), ke = Object.freeze({
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
}), fe = 241;
function Wo(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function ht(t) {
  return ke.minimumHz * Math.pow(
    ke.maximumHz / ke.minimumHz,
    Wo(t, 0, 1)
  );
}
Object.freeze(
  Array.from({ length: fe }, (t, e) => {
    const n = e / (fe - 1), r = ht(n), o = ht(
      Math.max(0, e - 0.5) / (fe - 1)
    ), i = ht(
      Math.min(fe - 1, e + 0.5) / (fe - 1)
    );
    return {
      centerHz: r,
      lowHz: e === 0 ? ke.minimumHz : o,
      highHz: e === fe - 1 ? ke.maximumHz : i
    };
  })
);
const qo = "voiceEnhancerFrequency", Go = "voiceEnhancerQ", Jo = "voiceEnhancerAmount", Qo = "voiceEnhancerFrequencyOctaves", Xo = "voiceEnhancerQ", Yo = "voiceEnhancerAmount", Wr = "voice.enhancerFrequency", Zo = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: qo,
    targetKind: Qo,
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
    endpointID: Go,
    targetKind: Xo,
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
    endpointID: Jo,
    targetKind: Yo,
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
function xn(t, e) {
  const n = Math.min(t.max, Math.max(t.min, e));
  return t.scale === "log" ? Math.log(n / t.min) / Math.log(t.max / t.min) : (n - t.min) / (t.max - t.min);
}
function ea(t, e) {
  const n = Math.min(1, Math.max(0, e));
  return t.scale === "log" ? t.min * (t.max / t.min) ** n : t.min + (t.max - t.min) * n;
}
function Ke(t, e, n, r, o = "percent", i = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: r, format: o, compound: i };
}
const ta = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults,
      // 1000 Hz and Q 0.707107, so an instance sounds the same whether or
      // not its editor is open.
      Ke("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      Ke("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's filterMix default 1.0.
      Ke("mix", "Mix", 100, 100),
      Ke("drive", "Drive", 15, 0)
    ]
  }
], Mn = 1e-6;
function $(t, e) {
  if (!Number.isFinite(t) || t < -Mn || t > 1 + Mn)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function tt(t, e) {
  return $(t / 100, `${e} catalog percentage`);
}
function Pe(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function na(t) {
  return 20 * 1e3 ** t;
}
function ra(t) {
  return $(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function ia(t) {
  return 0.1 * 200 ** t;
}
function oa(t) {
  return $(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function aa(t) {
  return t;
}
function sa(t) {
  return $(t, "filterMix endpoint conversion");
}
function Ie(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function ca(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: Ie("filterCutoff", na, ra),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: Ie("filterQ", ia, oa),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: Ie("filterMix", aa, sa),
        // Articulations do not own Mix: capturing it would extend
        // the persisted articulation schema.
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
function qr(t) {
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
      return zo(t);
  }
}
function la(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function ua(t, e) {
  const n = Pe(t.moduleId, e.id), r = qr(e.format), o = ca(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: tt(e.defaultPercent, n),
    initialValue: tt(e.initialPercent, n),
    format: r,
    modAmount: la(r),
    binding: o.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: o.articulationParameterId,
    modulationTargetKind: o.modulationTargetKind
  });
}
const da = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Rn * 100, defaultPercent: Rn * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function fa(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function ma(t, e) {
  const n = `osc${t}`, r = Pe(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: tt(e.defaultPercent, r),
    initialValue: tt(e.initialPercent, r),
    format: qr(e.format),
    modAmount: fa(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const ha = Object.freeze(
  E.flatMap((t) => da.map((e) => ma(t, e)))
), pa = Object.freeze({
  targetId: Pe("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: $(
    (An - q) / (Re - q),
    "Global Tune default"
  ),
  initialValue: $(
    (An - q) / (Re - q),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: Re },
  modAmount: {
    min: Vr,
    max: jr,
    unit: "st",
    digits: 2
  },
  binding: Ie(
    jo,
    (t) => q + (Re - q) * t,
    (t) => $(
      (t - q) / (Re - q),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: Ho
});
function ga(t) {
  const e = Pe("voice-enhancer", t.key), n = $(
    xn(t, t.initial),
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
    binding: Ie(
      t.endpointID,
      (r) => ea(t, r),
      (r) => $(
        xn(t, r),
        `${t.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: t.targetKind
  });
}
const va = Object.freeze(
  Object.values(Zo).map(ga)
), Ia = Object.freeze([
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
function ba(t) {
  const e = Pe(t.moduleId, t.targetIdSuffix), n = t.max - t.min, r = (i) => t.min + n * i, o = (i) => $(
    (i - t.min) / n,
    `${t.endpointID} endpoint conversion`
  );
  return Object.freeze({
    targetId: e,
    moduleId: t.moduleId,
    workspace: "voice",
    label: t.label,
    defaultValue: o(t.initial),
    initialValue: o(t.initial),
    format: t.format === "time" ? { kind: "time", minSeconds: t.min, maxSeconds: t.max } : { kind: "percent" },
    modAmount: t.format === "time" ? { min: -n, max: n, unit: "s", digits: 3 } : { min: -100, max: 100, unit: "%", digits: 0 },
    binding: Ie(t.endpointID, r, o),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const ya = Object.freeze(
  Ia.map(ba)
), Sa = Object.freeze([
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
function Ta(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function pt(t, e) {
  const n = t.valueKind === "effect-output-trim-db" ? Ji(e) : t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return $(n, `${t.endpointID} endpoint conversion`);
}
function Ea(t, e) {
  return t.valueKind === "effect-output-trim-db" ? Qi(e) : t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Aa(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Ra(t) {
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
function xa(t) {
  const e = Ta(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: pt(t, t.initial),
    initialValue: pt(t, t.initial),
    format: Aa(t),
    modAmount: Ra(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Ea(t, n),
      fromEngine: (n) => pt(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : Yt(t.endpointID)
  });
}
const sn = Object.freeze(
  [
    ...lt.flatMap((t) => t.parameters.map(xa)),
    ...Sa,
    pa,
    ...va,
    ...ha,
    ...ya,
    ...ta.flatMap(
      (t) => t.parameters.map(
        (e) => ua(t, e)
      )
    )
  ]
), Ma = new Map(
  sn.map((t) => [t.targetId, t])
), Gr = sn.filter(
  (t) => t.modulationTargetKind !== null
), Pt = new Map(
  Gr.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Ma.size !== sn.length)
  throw new Error("Target descriptor IDs must be unique");
if (Gr.length !== X.length || Pt.size !== X.length || X.some((t) => Pt.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function gt(t) {
  const e = Pt.get(t);
  return e === void 0 ? Vo(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  lt.map((t) => [t.id, t.label])
);
function Oa(t) {
  const e = Dr(t);
  return e === 1 ? "" : ` ${e}`;
}
function wa(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const r = gt(t);
    return `${e[1]} ${r.label.toUpperCase()}`;
  }
  const n = ue(t);
  if (n !== null) {
    const r = gt(tn(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${Oa(n)} ${r.label.toUpperCase()}`;
  }
  return gt(t).label.toUpperCase();
}
const J = "modulation.v6", Jr = 6, Fe = 3, pe = 3, ka = 4, On = "modulationMsegBuffer", _a = "modulationMsegPlayback", Qr = 4, Da = ["MSEG 1", "MSEG 2", "MSEG 3"], Xr = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], Na = ["Env 1", "Env 2", "Env 3"], Ca = 1e-3, M = 10, La = 0.1, Pa = 20, wn = 10 - 0.1, Fa = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Pa - La },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Vr,
    max: jr
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
  mseg1Rate: { min: -te, max: te },
  mseg2Rate: { min: -te, max: te },
  mseg3Rate: { min: -te, max: te },
  env1Attack: { min: -M, max: M },
  env1Decay: { min: -M, max: M },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -M, max: M },
  env2Attack: { min: -M, max: M },
  env2Decay: { min: -M, max: M },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -M, max: M },
  env3Attack: { min: -M, max: M },
  env3Decay: { min: -M, max: M },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -M, max: M },
  ampAttack: { min: -M, max: M },
  ampDecay: { min: -M, max: M },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -M, max: M },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -wn, max: wn },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Ua = Er().filter((t) => t.modulationTargetIndex !== null), $a = new Map(
  Ua.map((t) => [
    Yt(t.endpointID),
    t
  ])
);
class vt extends Error {
  name = "ModulationStateParseError";
}
const Ba = {
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
le.map((t) => ({
  value: t.id,
  label: Ba[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const Ka = X.map((t) => ({
  value: t.kind,
  label: wa(t.kind)
}));
Ka.filter((t) => !Va(t.value));
function za(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function cn(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function It(t, e) {
  const n = Number(t);
  return cn(Number.isFinite(n) ? n : e, Ca, M);
}
function Va(t) {
  return en(t) !== null;
}
function ja(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (t.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function Ha(t) {
  const e = ue(t);
  return e !== null ? tn(e) : t;
}
function Wa(t) {
  const e = Ha(t);
  if (ue(e)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = $a.get(e);
  return n !== void 0 ? ja(n) : Fa[fo(e)];
}
function qa(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Ga(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function Ja(t, e) {
  const n = Wa(t), r = Number(e);
  return cn(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function Qa(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function Xa(t) {
  return Qa(t) ?? "mseg";
}
function Ya(t) {
  const e = Zt(t);
  return e !== null ? e : ue(t) !== null ? t : null;
}
function Za(t) {
  return Ya(t) ?? "oscA.wavetablePosition";
}
function es(t, e) {
  const n = Xr[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function ts(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const r = t === "mseg" ? Fe : t === "macro" ? Qr : ka;
  return cn(Number.isFinite(n) ? n : 1, 1, r);
}
function ge(t) {
  return {
    name: Na[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Yr(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, r = ge(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: It(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: It(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: oe(n.sustain ?? r.sustain),
    releaseSeconds: It(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function ns(t, e = 0) {
  return { name: Yr(t, e).name };
}
function rs(t, e, n, r) {
  const o = Number(t.amount);
  return {
    id: qa(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: ts(n, t.sourceSlot),
    polarity: Ga(t.polarity),
    targetKind: r,
    amount: Ja(r, o),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function is(t, e = 0) {
  const r = t !== null && typeof t == "object" ? t : {}, o = Xa(r.sourceKind), i = Za(r.targetKind);
  return rs(r, e, o, i);
}
function os(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function as(t) {
  return (Array.isArray(t) ? t : []).map((n, r) => is(n, r));
}
function ss(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of t) {
    const o = os(r);
    if (e.has(r.id) || n.has(o))
      return !1;
    e.add(r.id), n.add(o);
  }
  return !0;
}
function Ft(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, s) => Ft(a, e[s]));
  const n = t, r = e, o = Object.keys(n), i = Object.keys(r);
  return o.length === i.length && o.every((a) => za(r, a) && Ft(n[a], r[a]));
}
function Zr(t, e) {
  const n = t && typeof t == "object" ? t : {}, r = Ro(Da[e] ?? `MSEG ${e + 1}`), o = Nt(n.shapeA ?? r), i = Oo({
    ...Ct(),
    ...n.playback ?? {},
    rate: Ct().rate
  }), { rate: a, ...s } = i;
  return {
    shapeA: o,
    shapeB: Nt(n.shapeB ?? o),
    playback: s
  };
}
function De() {
  return {
    format: "cosimo.modulation",
    version: Jr,
    msegSlots: Array.from({ length: Fe }, (t, e) => Zr({}, e)),
    envelopeSlots: Array.from({ length: pe }, (t, e) => ({
      name: ge(e).name
    })),
    routes: [],
    macroNames: Xr.slice()
  };
}
function cs(t = De()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], r = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], o = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: Jr,
    msegSlots: Array.from({ length: Fe }, (i, a) => Zr(n[a], a)),
    envelopeSlots: Array.from({ length: pe }, (i, a) => ns(r[a], a)),
    routes: as(e.routes),
    macroNames: Array.from(
      { length: Qr },
      (i, a) => es(o[a], a)
    )
  };
}
function bt(t) {
  const e = nt(t);
  if (e._tag === "err")
    throw e.error;
  return JSON.stringify(e.value);
}
function nt(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return we(new vt("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return we(new vt("Expected valid modulation JSON"));
    }
  }
  const n = cs(e);
  return !Ft(e, n) || !ss(n.routes) ? we(new vt("Expected the current modulation schema")) : Ee(n);
}
function ls(t, e) {
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
function kn(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(To(n))
  };
}
function us(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function Ut(t, e = null, n) {
  const r = [];
  for (let o = 0; o < Fe; o += 1) {
    const i = t.msegSlots[o], a = e?.msegSlots[o];
    (a === void 0 || !Tn(a.shapeA, i.shapeA)) && r.push(n ? n(o, 0, i.shapeA) : {
      endpointID: On,
      value: kn(o, 0, i.shapeA)
    }), (a === void 0 || !Tn(a.shapeB, i.shapeB)) && r.push(n ? n(o, 1, i.shapeB) : {
      endpointID: On,
      value: kn(o, 1, i.shapeB)
    }), (a === void 0 || !us(a.playback, i.playback)) && r.push({
      endpointID: _a,
      value: ls(o, i.playback)
    });
  }
  return r.push(...Ko(e?.routes ?? null, t.routes)), r;
}
const yt = "articulationSnapshot", w = 128, _n = 48, ds = 1e6, N = -1, St = [
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
function ln(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Tt(t) {
  return ln(Number.isFinite(t) ? t : 0, 0, 1);
}
function L(t, e, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const o = Number(t);
  return ln(Number.isFinite(o) ? o : e, n, r);
}
function D(t, e, n, r) {
  return ln(Math.round(L(t, e)), n, r);
}
function ei(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function Et() {
  return Array.from({ length: w }, () => N);
}
function fs(t) {
  const e = D(t, 0, 0, w - 1), n = St[e % St.length], r = Math.floor(e / St.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function ms() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: an,
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
function hs(t) {
  const e = ms(), n = t && typeof t == "object" ? t : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: L(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: L(n.pan, e.pan, -1, 1),
    octave: D(n.octave, e.octave, -4, 4),
    semitone: D(n.semitone, e.semitone, -12, 12),
    fineCents: L(n.fineCents, e.fineCents, -100, 100),
    volumeDb: L(
      n.volumeDb,
      e.volumeDb,
      Lt,
      Hr
    ),
    mute: D(n.mute, e.mute, 0, 1),
    solo: D(n.solo, e.solo, 0, 1),
    warpMode: D(n.warpMode, e.warpMode, 0, 4),
    warpAmount: L(n.warpAmount, e.warpAmount, 0, 1),
    filterMode: D(n.filterMode, e.filterMode, 0, 5),
    filterCutoff: L(n.filterCutoff, e.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: L(
      n.filterKeyTrackOffsetSemitones,
      e.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: L(n.filterQ, e.filterQ, 0.1, 20),
    unisonVoices: D(n.unisonVoices, e.unisonVoices, 1, 8),
    unisonDetune: L(n.unisonDetune, e.unisonDetune, 0, 1),
    unisonBlend: L(n.unisonBlend, e.unisonBlend, 0, 1),
    unisonWidth: L(n.unisonWidth, e.unisonWidth, 0, 1),
    unisonPhase: L(n.unisonPhase, e.unisonPhase, 0, 1),
    unisonRandom: L(n.unisonRandom, e.unisonRandom, 0, 1),
    unisonPhaseMode: D(n.unisonPhaseMode, e.unisonPhaseMode, 0, 1),
    unisonDetuneMode: D(n.unisonDetuneMode, e.unisonDetuneMode, 0, 4),
    unisonStackMode: D(n.unisonStackMode, e.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: L(
      n.unisonWavetablePositionSpread,
      e.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: L(n.unisonWarpSpread, e.unisonWarpSpread, 0, 1),
    msegMorphs: [
      Tt(Number(r[0])),
      Tt(Number(r[1])),
      Tt(Number(r[2]))
    ]
  };
}
function ps(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: L(e.amount, 0, -48, 48)
  } : null;
}
function gs(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(ps).filter((o) => o !== null) : [], r = /* @__PURE__ */ new Map();
  for (const o of n)
    r.set(o.routeId, o);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: hs(e.parameters),
    envelopes: [0, 1, 2].map((o) => Yr(
      Array.isArray(e.envelopes) ? e.envelopes[o] : void 0,
      o
    )),
    modRouteAmounts: [...r.values()]
  };
}
function vs(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, r = D(n.runtimeSlot, e, 0, w - 1), o = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, i = typeof n.name == "string" && n.name.trim() ? n.name.trim() : fs(r);
  return {
    id: o,
    runtimeSlot: r,
    name: i,
    snapshot: gs(n.snapshot)
  };
}
function Is(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(r) ? {
    note: D(n.note, 0, 0, w - 1),
    articulationId: r
  } : null;
}
function bs(t, e, n, r, o) {
  if (!t || typeof t != "object")
    return null;
  const i = t, a = typeof i.articulationId == "string" ? i.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let s = D(i.min, o, o, w - 1), c = D(i.max, s, o, w - 1);
  return c < s && ([s, c] = [c, s]), {
    id: typeof i.id == "string" && i.id.trim() ? i.id.trim() : `${r}-${n}`,
    articulationId: a,
    min: s,
    max: c
  };
}
function Dn(t, e, n, r) {
  const o = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < o.length; s += 1) {
    const c = bs(
      o[s],
      e,
      s,
      n,
      r
    );
    !c || i.has(c.id) || (i.add(c.id), a.push(c));
  }
  return a;
}
function ys(t, e) {
  const n = Array.isArray(t) ? t : [], r = /* @__PURE__ */ new Set(), o = [];
  for (const i of n) {
    const a = Is(i, e);
    !a || r.has(a.note) || (r.add(a.note), o.push(a));
  }
  return o;
}
function Ss(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), i = [];
  for (let c = 0; c < n.length && i.length < w; c += 1) {
    const m = vs(n[c], c);
    !m || r.has(m.runtimeSlot) || o.has(m.id) || (r.add(m.runtimeSlot), o.add(m.id), i.push(m));
  }
  const a = typeof e.selectedSlotId == "string" && i.some((c) => c.id === e.selectedSlotId) ? e.selectedSlotId : null, s = new Set(i.map((c) => c.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: ei(e.activeTriggerMode),
    slots: i,
    chainAssignments: Dn(e.chainAssignments, s, "chain", 0),
    keyAssignments: ys(e.keyAssignments, s),
    velocityAssignments: Dn(e.velocityAssignments, s, "velocity", 1)
  };
}
function Nn(t) {
  const e = (n) => E.map(() => n);
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
    volumeDbs: e(an),
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
    msegMorphs: Array.from({ length: Fe }, () => 0),
    routeAmounts: Array.from({ length: Br }, () => 0),
    envelopeAttackSeconds: Array.from({ length: pe }, (n, r) => ge(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: pe }, (n, r) => ge(r).decaySeconds),
    envelopeSustain: Array.from({ length: pe }, (n, r) => ge(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: pe }, (n, r) => ge(r).releaseSeconds)
  };
}
function Cn(t, e, n) {
  for (const r of e) {
    const o = n.get(r.articulationId);
    if (o !== void 0)
      for (let i = r.min; i <= r.max; i += 1)
        t[i] === N && (t[i] = o);
  }
}
function Ts(t) {
  const e = Ss(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), r = Et(), o = Et(), i = Et();
  Cn(r, e.chainAssignments, n), Cn(i, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || o[a.note] !== N || (o[a.note] = s);
  }
  return i[0] = N, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: r,
    key: o,
    velocity: i
  };
}
function ti(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Ts(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: ei(e.activeMode),
    chain: Array.from({ length: w }, (n, r) => D(e.chain?.[r], N, N, w - 1)),
    key: Array.from({ length: w }, (n, r) => D(e.key?.[r], N, N, w - 1)),
    velocity: Array.from({ length: w }, (n, r) => r === 0 ? N : D(e.velocity?.[r], N, N, w - 1))
  });
}
function ni(t, e) {
  const n = ti(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const U = "articulations.v4", un = [
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
], dn = [
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
], ri = [
  ...E.flatMap((t) => un.map(
    (e) => `osc${t}.${e}`
  )),
  ...dn
];
class ii extends Error {
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
function A(t) {
  return we(new ii("malformed", t));
}
function Ue(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function fn(t, e, n) {
  const r = new Set(e);
  for (const o of e)
    if (!Object.hasOwn(t, o))
      return `${n} is missing field "${o}"`;
  for (const o of Reflect.ownKeys(t)) {
    if (typeof o != "string")
      return `${n} has a non-string field key`;
    if (!r.has(o))
      return `${n} has unexpected field "${o}"`;
  }
  return null;
}
function rt(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < w;
}
function Es(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function As(t) {
  return ri.some((e) => e === t);
}
function Ln(t, e) {
  if (!Ue(t))
    return A(`${e} must be an object`);
  const n = fn(t, ["min", "max"], e);
  return n !== null ? A(n) : rt(t.min) ? rt(t.max) ? t.min > t.max ? A(`${e}.min must be less than or equal to ${e}.max`) : Ee({ min: t.min, max: t.max }) : A(`${e}.max must be an integer in 0..127`) : A(`${e}.min must be an integer in 0..127`);
}
function Rs(t, e) {
  if (!Ue(t))
    return A(`${e} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return A(`${e} has a non-string parameter id`);
    if (!As(r))
      return A(`${e} has unknown parameter id "${r}"`);
    const o = t[r];
    if (typeof o != "number" || !Number.isFinite(o))
      return A(`${e}.${r} must be a finite number`);
    n[r] = o;
  }
  return Ee(n);
}
function oi(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function ai() {
  return {};
}
function xs(t, e, n) {
  if (!Ue(t))
    return A(`${e} must be an object`);
  const r = ai();
  for (const o of Reflect.ownKeys(t)) {
    if (typeof o != "string")
      return A(`${e} has a non-string route id`);
    const i = t[o];
    if (typeof i != "number" || !Number.isFinite(i) || Math.abs(i) > _n)
      return A(
        `${e}.${o} must be a finite route amount within ±${_n}`
      );
    if (!n.has(o))
      return A(`${e}.${o} does not name a current articulable mapping`);
    oi(r, o, i);
  }
  return Ee(r);
}
function Ms(t, e, n) {
  const r = `slots[${e}]`;
  if (!Ue(t))
    return A(`${r} must be an object`);
  const o = fn(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (o !== null)
    return A(o);
  if (typeof t.id != "string")
    return A(`${r}.id must be a string`);
  if (!rt(t.runtimeSlot))
    return A(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return A(`${r}.name must be a string`);
  if (typeof t.color != "string")
    return A(`${r}.color must be a string`);
  if (!rt(t.key))
    return A(`${r}.key must be an integer in 0..127`);
  const i = Ln(t.velRange, `${r}.velRange`);
  if (i._tag === "err")
    return i;
  const a = Ln(t.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = Rs(t.overrides, `${r}.overrides`);
  if (s._tag === "err")
    return s;
  const c = xs(
    t.routeAmounts,
    `${r}.routeAmounts`,
    n
  );
  return c._tag === "err" ? c : Ee({
    id: t.id,
    runtimeSlot: t.runtimeSlot,
    name: t.name,
    color: t.color,
    key: t.key,
    velRange: i.value,
    chainRange: a.value,
    overrides: s.value,
    routeAmounts: c.value
  });
}
function Os(t) {
  const e = {};
  for (const n of ri) {
    if (!Object.hasOwn(t, n))
      continue;
    const r = t[n];
    r !== void 0 && (e[n] = r);
  }
  return e;
}
function ws(t) {
  const e = ai();
  for (const [n, r] of Object.entries(t))
    oi(e, n, r);
  return e;
}
const ks = Object.fromEntries(
  un.map((t, e) => [t, 2 ** e])
), _s = Object.fromEntries(
  dn.map((t, e) => [t, 2 ** e])
);
function Pn(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function Ds(t, e) {
  return un.reduce((n, r) => Object.hasOwn(t.overrides, `osc${e}.${r}`) ? n | ks[r] : n, 0);
}
function Ns(t) {
  return dn.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | _s[n] : e, 0);
}
function Cs(t, e) {
  const n = (i, a) => Pn(t, `osc${i}.${a}`), r = (i) => Pn(t, i), o = Array.from(
    { length: Br },
    () => ds
  );
  for (const [i, a] of Object.entries(t.routeAmounts)) {
    const s = e[i];
    s !== void 0 && (o[s] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: E.map((i) => Ds(t, i)),
    sharedOverrideMask: Ns(t),
    framePositions: E.map((i) => n(i, "framePosition")),
    pans: E.map((i) => n(i, "pan")),
    octaves: E.map((i) => n(i, "octave")),
    semitones: E.map((i) => n(i, "semitone")),
    fineCents: E.map((i) => n(i, "fineCents")),
    phases: E.map((i) => n(i, "phase")),
    phaseRandoms: E.map((i) => n(i, "phaseRandom")),
    retriggers: E.map((i) => n(i, "retrigger")),
    volumeDbs: E.map((i) => n(i, "volumeDb")),
    mutes: E.map((i) => n(i, "mute")),
    solos: E.map((i) => n(i, "solo")),
    warpModes: E.map((i) => n(i, "warpMode")),
    warpAmounts: E.map((i) => n(i, "warpAmount")),
    filterMode: r("filterMode"),
    filterCutoffHz: r("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: r("filterKeyTrackOffsetSemitones"),
    filterQ: r("filterQ"),
    unisonVoices: E.map((i) => n(i, "unisonVoices")),
    unisonDetunes: E.map((i) => n(i, "unisonDetune")),
    unisonBlends: E.map((i) => n(i, "unisonBlend")),
    unisonWidths: E.map((i) => n(i, "unisonWidth")),
    unisonDetuneModes: E.map((i) => n(i, "unisonDetuneMode")),
    unisonStackModes: E.map((i) => n(i, "unisonStackMode")),
    unisonWavetablePositionSpreads: E.map((i) => n(i, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: E.map((i) => n(i, "unisonWarpSpread")),
    msegMorphs: [
      r("msegMorph1"),
      r("msegMorph2"),
      r("msegMorph3")
    ],
    routeAmounts: o,
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
function si(t, e) {
  return t.slots.map((n) => Cs(n, e));
}
function ci(t, e) {
  if (!Ue(t))
    return A("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return A('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return we(new ii(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = fn(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return A(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return A("selectedSlotId must be null or a string");
  if (!Es(t.activeTriggerMode))
    return A('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return A("slots must be an array");
  if (t.slots.length > w)
    return A(`slots must contain at most ${w} entries`);
  const r = [], o = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const s = Ms(t.slots[a], a, e);
    if (s._tag === "err")
      return s;
    const c = s.value;
    if (o.has(c.id))
      return A(`slots[${a}].id duplicates "${c.id}"`);
    if (i.has(c.runtimeSlot))
      return A(`slots[${a}].runtimeSlot duplicates ${c.runtimeSlot}`);
    o.add(c.id), i.add(c.runtimeSlot), r.push(c);
  }
  return t.selectedSlotId !== null && !o.has(t.selectedSlotId) ? A(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : Ee({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: r
  });
}
function Fn(t) {
  return {
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: t.slots.map((e) => ({
      id: e.id,
      runtimeSlot: e.runtimeSlot,
      name: e.name,
      color: e.color,
      key: e.key,
      velRange: { min: e.velRange.min, max: e.velRange.max },
      chainRange: { min: e.chainRange.min, max: e.chainRange.max },
      overrides: Os(e.overrides),
      routeAmounts: ws(e.routeAmounts)
    }))
  };
}
function dt() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Ls(t) {
  const e = Array.from({ length: w }, () => N), n = Array.from({ length: w }, () => N), r = Array.from({ length: w }, () => N);
  for (const o of t.slots) {
    n[o.key] === N && (n[o.key] = o.runtimeSlot);
    for (let i = o.chainRange.min; i <= o.chainRange.max; i += 1)
      e[i] === N && (e[i] = o.runtimeSlot);
    for (let i = o.velRange.min; i <= o.velRange.max; i += 1)
      r[i] === N && (r[i] = o.runtimeSlot);
  }
  return r[0] = N, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: r
  };
}
const li = 12, mn = 5, ui = 8, Ps = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), di = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    K("globalFilter")
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
    K("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    K("ott")
  ],
  chorus: [
    "chorusMix",
    "chorusMotionMode",
    "chorusBloomMode",
    "chorusTone",
    "chorusFeedback",
    "chorusRingAmount",
    "chorusRingFrequencyHz",
    "chorusRingKeyTrackEnabled",
    "chorusRingKeyTrackOffsetSemitones",
    K("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    K("flanger")
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
    K("phaser")
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
    K("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    K("reverb")
  ]
});
function hn(t) {
  return di[t];
}
function Fs(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= mn)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * ui + Ps[t];
}
function Us(t, e) {
  const n = new Array(li).fill(0);
  return di[t].forEach((r, o) => {
    const i = e[r];
    if (typeof i != "number" || !Number.isFinite(i))
      throw new Error(`Missing lane parameter value: ${t}.${r}`);
    n[o] = i;
  }), n;
}
const be = "lane.v1", it = "laneTopology", ye = "laneSlotParams", $t = "laneSlotParamValue", fi = "laneOutputControl", Bt = 16, $s = 8, mi = 4, Bs = 3, hi = mn * ui, pi = 4, Ks = 4, zs = hi, Vs = hi + pi, js = 0, Hs = 1, Ws = 2, qs = 3, Gs = 4, Js = 5;
function Qs(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > mi)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << $s;
}
const Kt = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), ot = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Xs = new Map(
  Object.entries(ot).map(([t, e]) => [e, t])
), Ys = Object.freeze([
  "voice.filterCutoff",
  Wr,
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
]), Zs = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [Wr]: "enhancer-frequency",
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
  Ys.map((t) => [t, Object.freeze({
    id: t,
    family: Zs[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const gi = 40, vi = 18e3, zt = Kt.map((t) => ot[t]), ec = /^([a-zA-Z]+)#([1-9][0-9]*)$/, tc = /^(parallel|split)#([1-9][0-9]*)$/;
function $e(t) {
  if (typeof t != "string")
    return null;
  const e = ec.exec(t);
  if (e === null)
    return null;
  const n = zt.find((o) => o === e[1]);
  if (n === void 0)
    return null;
  const r = Number(e[2]);
  return r > mn ? null : { deviceType: n, instanceNumber: r };
}
function Ii(t) {
  if (typeof t != "string")
    return null;
  const e = tc.exec(t);
  if (e === null)
    return null;
  const n = e[1], r = Number(e[2]);
  return r > (n === "parallel" ? pi : Ks) ? null : { groupKind: n, unitNumber: r };
}
function re(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Ne(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((r) => typeof r == "string" && e.includes(r));
}
function x(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function nc(t, e) {
  const n = $e(t);
  if (n === null)
    return { failure: x(`device id ${t} is not a pool instance`) };
  if (!re(e) || !Ne(e, ["params"]) || !re(e.params))
    return { failure: x(`device ${t} must be { params }`) };
  const r = hn(n.deviceType), o = e.params;
  if (Object.keys(o).length !== r.length || !r.every((s) => Object.hasOwn(o, s)))
    return { failure: x(`device ${t} must carry every parameter once`) };
  const a = {};
  for (const s of r) {
    const c = o[s];
    if (typeof c != "number" || !Number.isFinite(c))
      return { failure: x(`device ${t}.${s} must be a finite number`) };
    a[s] = c;
  }
  return { record: { params: a } };
}
function rc(t, e) {
  return !re(t) || t.kind !== "device" ? { failure: x("branches may hold device placements only") } : Ne(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: x(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: x(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: x("a device placement is { kind, deviceId, enabled }") };
}
function Un(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= gi && t <= vi;
}
function bi() {
  return { mix: 1, bypassed: !1 };
}
function ic(t) {
  return !re(t) || !Ne(t, ["mix", "bypassed"]) || typeof t.mix != "number" || !Number.isFinite(t.mix) || t.mix < 0 || t.mix > 1 || typeof t.bypassed != "boolean" ? null : { mix: t.mix, bypassed: t.bypassed };
}
function oc(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (l) {
      const d = l instanceof Error ? l.message : String(l);
      return x(`is not valid JSON: ${d}`);
    }
  if (!re(e) || !Ne(e, ["format", "version", "output", "devices", "chain"]))
    return x("must be { format, version, output, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return x("must be cosimo.lane version 2");
  if (!re(e.devices))
    return x("devices must be an object");
  if (!Array.isArray(e.chain))
    return x("chain must be an array");
  const n = ic(e.output);
  if (n === null)
    return x("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const l of Reflect.ownKeys(e.devices)) {
    if (typeof l != "string")
      return x("device ids must be strings");
    const d = nc(l, e.devices[l]);
    if ("failure" in d)
      return d.failure;
    r[l] = d.record;
  }
  const o = new Set(Object.keys(r)), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let c = 0;
  const m = (l) => {
    const d = rc(l, o);
    return "placement" in d && (i.set(
      d.placement.deviceId,
      (i.get(d.placement.deviceId) ?? 0) + 1
    ), c += 1), d;
  };
  for (const l of e.chain) {
    if (!re(l))
      return x("chain nodes must be objects");
    if (l.kind === "device") {
      const h = m(l);
      if ("failure" in h)
        return h.failure;
      s.push(h.placement);
      continue;
    }
    if (l.kind !== "parallel" && l.kind !== "split")
      return x(`unknown chain node kind ${String(l.kind)}`);
    const d = l.kind === "split", u = d ? [
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
    ] : ["kind", "groupId", "enabled", "branches"];
    if (!Ne(l, u))
      return x(`a ${l.kind} group is { ${u.join(", ")} }`);
    const f = Ii(l.groupId);
    if (f === null || f.groupKind !== l.kind)
      return x(`group id ${String(l.groupId)} does not name a ${l.kind} unit`);
    if (a.has(String(l.groupId)))
      return x(`group ${String(l.groupId)} is used twice`);
    if (a.add(String(l.groupId)), typeof l.enabled != "boolean")
      return x(`group ${String(l.groupId)} needs a boolean enable`);
    const v = d ? Bs : mi;
    if (!Array.isArray(l.branches) || l.branches.length < 2 || l.branches.length > v)
      return x(`group ${String(l.groupId)} needs 2..${v} branches`);
    if (d && (!Un(l.xoverLowHz) || !Un(l.xoverHighHz)))
      return x(`group ${String(l.groupId)} crossovers must sit in ${gi}..${vi} Hz`);
    if (d && (typeof l.xoverLowKeyTrackEnabled != "boolean" || typeof l.xoverHighKeyTrackEnabled != "boolean" || typeof l.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverLowKeyTrackOffsetSemitones) || typeof l.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverHighKeyTrackOffsetSemitones)))
      return x(`group ${String(l.groupId)} Key Track state must be finite`);
    c += 1;
    const b = [];
    for (const h of l.branches) {
      if (!Array.isArray(h))
        return x(`group ${String(l.groupId)} branches must be arrays`);
      const T = [];
      for (const R of h) {
        const p = m(R);
        if ("failure" in p)
          return p.failure;
        T.push(p.placement);
      }
      b.push(T);
    }
    s.push(d ? {
      kind: "split",
      groupId: String(l.groupId),
      enabled: l.enabled,
      xoverLowHz: l.xoverLowHz,
      xoverHighHz: l.xoverHighHz,
      xoverLowKeyTrackEnabled: l.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: l.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: l.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: l.xoverHighKeyTrackOffsetSemitones,
      branches: b
    } : {
      kind: "parallel",
      groupId: String(l.groupId),
      enabled: l.enabled,
      branches: b
    });
  }
  for (const l of o)
    if ((i.get(l) ?? 0) !== 1)
      return x(`device ${l} must be placed exactly once`);
  return c > Bt ? x(`flattens to ${c} wire entries; the topology upload holds ${Bt}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: s } };
}
function ac() {
  const t = {};
  for (const e of Kt) {
    const n = ot[e];
    t[`${n}#1`] = {
      params: fc(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: bi(),
    devices: t,
    chain: Kt.map((e) => ({
      kind: "device",
      deviceId: `${ot[e]}#1`,
      enabled: !1
    }))
  };
}
const $n = ["distortion#1", "delay#1", "reverb#1"];
function pn() {
  const t = ac(), e = {};
  for (const n of $n) {
    const r = t.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    e[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: bi(),
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && $n.includes(n.deviceId))
  };
}
function sc(t) {
  if (t === void 0)
    return pn();
  const e = oc(t);
  return e._tag === "ok" ? e.value : null;
}
function At(t) {
  return JSON.stringify({
    format: "cosimo.lane",
    version: 2,
    output: t.output,
    devices: t.devices,
    chain: t.chain
  });
}
function cc(t) {
  return Object.keys(t.devices).map((e) => {
    const n = $e(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => zt.indexOf(e.parsed.deviceType) - zt.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function Vt(t) {
  const e = $e(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return Fs(e.deviceType, e.instanceNumber - 1);
}
function yi(t) {
  const e = Ii(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? zs : Vs) + (e.unitNumber - 1);
}
function Si(t) {
  const e = new Array(Bt).fill(0);
  let n = 0, r = 0;
  const o = (i, a, s) => {
    e[r] = Qs(i, a), s && (n |= 1 << r), r += 1;
  };
  for (const i of t.chain) {
    if (i.kind === "device") {
      o(Vt(i.deviceId), 0, i.enabled);
      continue;
    }
    o(yi(i), i.branches.length, i.enabled), i.branches.forEach((a, s) => {
      for (const c of a)
        o(Vt(c.deviceId), s + 1, c.enabled);
    });
  }
  return { chainLength: r, slotIds: e, enabledMask: n };
}
function lc(t) {
  const e = new Array(li).fill(0);
  return e[js] = t.xoverLowHz, e[Hs] = t.xoverHighHz, e[Ws] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[qs] = t.xoverLowKeyTrackOffsetSemitones, e[Gs] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[Js] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function gn(t) {
  const e = [{
    endpointID: fi,
    value: t.output
  }];
  let n = 0;
  for (const r of cc(t)) {
    const o = $e(r.instanceId);
    if (o === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    e.push({
      endpointID: Jt(
        o.deviceType,
        o.instanceNumber
      ),
      value: t.devices[r.instanceId].params[K(o.deviceType)]
    }), n += 1, e.push({
      endpointID: ye,
      value: {
        slotId: Vt(r.instanceId),
        deliverySerial: n,
        values: Us(
          r.deviceType,
          t.devices[r.instanceId].params
        )
      }
    });
  }
  for (const r of t.chain)
    r.kind === "split" && (n += 1, e.push({
      endpointID: ye,
      value: {
        slotId: yi(r),
        deliverySerial: n,
        values: lc(r)
      }
    }));
  return e.push({
    endpointID: it,
    value: Si(t)
  }), e;
}
function uc(t, e, n, r) {
  const o = t.devices[e], i = $e(e);
  if (o === void 0 || i === null || !hn(i.deviceType).includes(n) || !Number.isFinite(r))
    return null;
  const a = { ...o.params, [n]: r };
  return i.deviceType === "delay" && n === "delayTimeMode" && r >= 0.5 && (a.delayTimeKeyTrackEnabled = 0), {
    ...t,
    devices: {
      ...t.devices,
      [e]: { params: a }
    }
  };
}
function dc(t, e) {
  let n = t;
  for (const [r, o] of Object.entries(e)) {
    const i = yr(r);
    if (i === null || typeof o != "number" || !Number.isFinite(o))
      continue;
    const a = `${i.deviceType}#${i.instanceNumber}`;
    if (n.devices[a] === void 0)
      continue;
    const s = Math.min(
      35,
      Math.max(-100, o)
    );
    Object.is(n.devices[a]?.params[i.laneEndpointID], s) || (n = uc(
      n,
      a,
      i.laneEndpointID,
      s
    ) ?? n);
  }
  return n;
}
function fc(t) {
  const e = Xs.get(t);
  if (e === void 0)
    throw new Error(`Unknown lane device type: ${t}`);
  const n = eo(e).parameters;
  return Object.fromEntries(hn(t).map((r) => [
    r,
    n.find((o) => o.endpointID === r)?.initial ?? 0
  ]));
}
async function Bn(t) {
  const e = [];
  for (const n of [...t].reverse())
    try {
      await n.stop?.();
    } catch (r) {
      e.push(r);
    }
  return e;
}
async function mc(t, e) {
  const n = [];
  try {
    for (const o of e) {
      const i = await o(t);
      n.push(i), await i.start();
    }
  } catch (o) {
    const i = await Bn(n);
    throw i.length > 0 ? new AggregateError([o, ...i], "A patch worker service failed to start, and stopping the others also failed.") : o;
  }
  let r = !1;
  return {
    async stop() {
      if (r) return;
      r = !0;
      const o = await Bn(n.splice(0));
      if (o.length > 0) throw new AggregateError(o, "Some patch worker services failed to stop.");
    }
  };
}
async function Ti(t, e, n, r = {}) {
  const o = t.sharedData;
  if (!o) throw new Error("This patch host does not support direct shared-data preparation.");
  if (r.signal?.aborted) throw new Error("Shared preparation cancelled.");
  const i = o.reserve(e.input, e.byteLength), a = r.signal?.onAbort(() => o.cancel(i.id));
  try {
    if (n(i), r.signal?.aborted) throw new Error("Shared preparation cancelled.");
    return await o.commit(i.id), { cancel: () => o.cancel(i.id) };
  } catch (s) {
    throw o.cancel(i.id), s;
  } finally {
    a?.();
  }
}
const Ei = 3, Ai = (4 + ie) * 4;
function hc(t, e, n) {
  return Ti(t, {
    input: Ei + e.slotIndex * 2 + e.shapeIndex,
    byteLength: Ai
  }, (r) => {
    new Int32Array(r.buffer, r.byteOffset, 4).set([1297302855, e.dspSessionId, e.deliverySerial, ie]), rn(e.shape, new Float32Array(
      r.buffer,
      r.byteOffset + 16,
      ie
    ));
  }, { signal: n });
}
function pc(t, e, n, r) {
  return {
    submit: async ({ dspSessionId: o, deliverySerial: i, signal: a }) => {
      const s = await hc(
        t,
        { slotIndex: e, shapeIndex: n, shape: r, dspSessionId: o, deliverySerial: i },
        a
      );
      a.onAbort(s.cancel);
    }
  };
}
function Ri(t) {
  if (typeof t != "object" || t === null) return {};
  const e = Reflect.get(t, "values");
  return typeof e == "object" && e !== null && !Array.isArray(e) ? e : {};
}
const jt = "runtimeState";
function xi(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const Kn = "runtimeInstallAck", Mi = "runtimeSyncRequest", Ht = 0, gc = 8e3, at = /* @__PURE__ */ new WeakMap(), Oi = 1e9;
let ze = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Oi;
function vc(t) {
  return ze = ze % Oi + 1, t === "modulation" ? -1e9 - ze : 1e9 + ze;
}
function Ic(t, e) {
  const n = t, r = at.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  r.add(e), at.set(n, r);
}
function zn(t, e) {
  const n = t, r = at.get(n);
  r?.delete(e), r?.size === 0 && at.delete(n);
}
const bc = [100, 250, 500, 1e3], Ve = { _tag: "accepted" }, yc = { _tag: "superseded" }, Sc = { _tag: "stopped" }, Vn = { _tag: "transport-timeout" };
function Tc(t) {
  const e = t && typeof t == "object" && "event" in t ? t.event : t, n = e && typeof e == "object" && "value" in e ? e.value : e;
  if (!n || typeof n != "object")
    return null;
  const r = n, o = r.dspSessionId, i = r.acceptedModulationSerial, a = r.acceptedArticulationSerial, s = r.rejectedSerial, c = r.rejectionReason, m = r.syncSerial;
  return ![
    o,
    i,
    a,
    s,
    c,
    m
  ].every((d) => typeof d == "number" && Number.isSafeInteger(d) && d >= -2147483648 && d <= 2147483647) || typeof o != "number" || typeof i != "number" || typeof a != "number" || typeof s != "number" || typeof c != "number" || typeof m != "number" || o < 0 || i < 0 || a > 0 || c < 0 ? null : {
    dspSessionId: o,
    acceptedModulationSerial: i,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: c,
    syncSerial: m
  };
}
function Ec(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class jn {
  #i;
  #t;
  #m;
  #l;
  #s = !1;
  #d = /* @__PURE__ */ new Set();
  #n = null;
  #o = null;
  #c = /* @__PURE__ */ new Set();
  #e = null;
  #f = 0;
  #r = /* @__PURE__ */ new Map();
  #p = 0;
  #a = !1;
  #u = 0;
  #g = /* @__PURE__ */ new Set();
  #T = this.#w.bind(this);
  constructor(e, n) {
    this.#i = e, this.#t = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((o) => Math.max(0, Math.trunc(o))).filter((o) => Number.isFinite(o));
    this.#m = r && r.length > 0 ? r : [...bc], this.#l = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? gc)
    );
  }
  start() {
    if (!this.#a) {
      Ic(this.#i, this.#t);
      try {
        this.#p += 1, this.#a = !0, this.#o = null, this.#c.clear(), this.#i.addEndpointListener?.(Kn, this.#T);
      } catch (e) {
        throw this.#a = !1, zn(this.#i, this.#t), e;
      }
    }
  }
  stop() {
    if (this.#a) {
      this.#a = !1;
      for (const e of this.#d) e();
      this.#i.removeEndpointListener?.(Kn, this.#T), zn(this.#i, this.#t), this.#r.clear(), this.#o = null, this.#c.clear(), this.#S();
    }
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    if (n !== this.#n) {
      for (const r of this.#d) r();
      this.#n = n, this.#o = null, this.#c.clear(), this.#e?.dspSessionId !== n && (this.#e = null), this.#r.clear(), this.#u += 1, this.#S();
    }
  }
  getAcceptedFrontier() {
    return this.#e?.dspSessionId !== this.#n ? 0 : this.#t === "modulation" ? this.#e.acceptedModulationSerial : this.#e.acceptedArticulationSerial;
  }
  getLatestAck() {
    return this.#e ? { ...this.#e } : null;
  }
  hasSessionBaseline() {
    return this.#n !== null && this.#o === this.#n;
  }
  async waitForSessionBaseline() {
    const e = this.#n, n = this.#p;
    return this.#a ? e === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#E(e, n) : {
      _tag: "unavailable",
      reason: "not-started"
    };
  }
  async sendBatch(e) {
    if (!this.#a)
      return {
        _tag: "unavailable",
        reason: "not-started"
      };
    if (this.#s)
      return {
        _tag: "unavailable",
        reason: "batch-in-progress"
      };
    if (this.#n === null)
      return {
        _tag: "unavailable",
        reason: "no-runtime-session"
      };
    this.#s = !0;
    const n = this.#n, r = this.#p;
    try {
      const o = await this.#E(
        n,
        r
      );
      if (o._tag !== "accepted")
        return o;
      let i = null;
      for (const a of e) {
        const s = await this.#M(
          a,
          n,
          r
        );
        if (s._tag === "rejected" && this.#t === "articulation") {
          i ??= s;
          continue;
        }
        if (s._tag !== "accepted")
          return s;
      }
      return i ?? Ve;
    } finally {
      this.#s = !1;
    }
  }
  #A(e) {
    return this.#t === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #R(e, n) {
    const r = this.#A(e);
    return this.#t === "modulation" ? r >= n : r <= n;
  }
  #x() {
    const e = this.getAcceptedFrontier();
    return this.#t === "modulation" ? e + 1 : e - 1;
  }
  async #E(e, n) {
    if (this.#o === e)
      return Ve;
    const r = vc(this.#t);
    this.#c.add(r);
    const o = Date.now() + this.#l;
    let i = 0;
    try {
      for (; ; ) {
        const a = this.#h(e, n);
        if (a)
          return a;
        if (this.#o === e)
          return Ve;
        const s = o - Date.now();
        if (s <= 0)
          return Vn;
        const c = this.#u;
        this.#b(r), await this.#y(
          c,
          Math.min(this.#I(i), s)
        ), i += 1;
      }
    } finally {
      this.#c.delete(r);
    }
  }
  async #M(e, n, r) {
    const o = this.#x(), i = /* @__PURE__ */ new Set();
    let a = !1;
    const s = () => {
      a = !0;
      for (const l of i) l();
      i.clear();
    }, c = {
      get aborted() {
        return a;
      },
      onAbort(l) {
        return a ? l() : i.add(l), () => {
          i.delete(l);
        };
      }
    };
    this.#d.add(s);
    const m = async () => {
      this.#h(n, r) || ("submit" in e ? await e.submit({ dspSessionId: n, deliverySerial: o, signal: c }) : this.#O(e.endpointID, Ec(e.value, n, o)));
    };
    try {
      let l = 0, d = 0, u = this.#f;
      for (await m(); ; ) {
        const f = this.#h(n, r);
        if (f)
          return f;
        const v = this.#v(n, o, u);
        if (v !== null)
          return v;
        const b = this.#u;
        await this.#y(
          b,
          this.#I(l)
        );
        const h = this.#v(
          n,
          o,
          u
        );
        if (h !== null)
          return h;
        let T = this.#u;
        for (this.#b(o); ; ) {
          const R = this.#h(n, r);
          if (R)
            return R;
          const p = await this.#y(
            T,
            this.#I(l)
          ), g = this.#v(
            n,
            o,
            u
          );
          if (g !== null)
            return g;
          if (p && this.#e?.dspSessionId === n && this.#e.syncSerial === o) {
            if (d >= 1)
              return Vn;
            u = this.#f, await m(), d += 1, l += 1;
            break;
          }
          if (p) {
            T = this.#u;
            continue;
          }
          p || (l += 1, T = this.#u, this.#b(o));
        }
      }
    } catch (l) {
      const d = this.#h(n, r);
      if (d) return d;
      throw l;
    } finally {
      s(), this.#d.delete(s);
    }
  }
  #v(e, n, r) {
    const o = this.#e;
    if (!o || o.dspSessionId !== e)
      return null;
    const i = this.#r.get(n);
    return i !== void 0 && i.version > r && i.acknowledgement.dspSessionId === e ? (this.#r.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...i.acknowledgement }
    }) : this.#R(o, n) ? (this.#r.delete(n), Ve) : null;
  }
  #h(e, n) {
    return !this.#a || this.#p !== n ? Sc : this.#n !== e ? yc : null;
  }
  #I(e) {
    return this.#m[Math.min(
      e,
      this.#m.length - 1
    )];
  }
  #O(e, n) {
    try {
      this.#i.sendEventOrValue?.(
        e,
        n,
        void 0,
        Ht
      );
    } catch {
    }
  }
  #b(e) {
    if (this.#a)
      try {
        this.#i.sendEventOrValue?.(
          Mi,
          e,
          void 0,
          Ht
        );
      } catch {
      }
  }
  #w(e) {
    const n = Tc(e);
    if (!n || this.#n !== null && n.dspSessionId !== this.#n || this.#o === n.dspSessionId && this.#e?.dspSessionId === n.dspSessionId && (n.acceptedModulationSerial < this.#e.acceptedModulationSerial || n.acceptedArticulationSerial > this.#e.acceptedArticulationSerial))
      return;
    if (this.#c.has(n.syncSerial) && (this.#o = n.dspSessionId), this.#e = n, this.#f += 1, this.#t === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#r.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#f
      }); this.#r.size > 16; ) {
        const o = this.#r.keys().next().value;
        if (o === void 0) break;
        this.#r.delete(o);
      }
    this.#u += 1, this.#S();
  }
  #y(e, n) {
    return !this.#a || this.#u !== e ? Promise.resolve(!0) : new Promise((r) => {
      let o = !1;
      const i = {
        finish: (a) => {
          o || (o = !0, i.timeoutHandle !== null && clearTimeout(i.timeoutHandle), this.#g.delete(i), r(a));
        },
        timeoutHandle: null
      };
      i.timeoutHandle = setTimeout(() => i.finish(!1), n), this.#g.add(i);
    });
  }
  #S() {
    for (const e of [...this.#g])
      e.finish(!0);
  }
}
const Ac = 1e3, Rc = [J, U];
function Rt(t, e) {
  if (t === void 0) return dt();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = ci(n, e);
  return r._tag === "ok" ? r.value : null;
}
function Hn(t) {
  return new Set(t.routes.flatMap((e) => on(e) === null ? [] : [e.id]));
}
function Wn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
function qn(t, e) {
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
class wi {
  constructor(e, n) {
    this.connection = e, this.frameworkInput = n, this.modulationLane = new jn(e, { laneKind: "modulation" }), this.articulationLane = new jn(e, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = De();
  articulationBank = dt();
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
    { length: w },
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
    return this.frameworkInput ? [U] : Rc;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(jt, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(jt, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
  }
  requestBootState(e) {
    if (this.bootPending = !0, this.bootEvents.length = 0, typeof this.connection.requestFullStoredState == "function") {
      this.connection.requestFullStoredState((n) => {
        !this.started || e !== this.lifecycleEpoch || (this.applyBootState(Ri(n)), this.finishBoot());
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
    const n = e[J], r = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: De() } : nt(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${J} is invalid; boot state was not installed.`);
      const a = e[U], s = Rt(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const o = e[U], i = Rt(
      o,
      Hn(r.value)
    );
    if (i === null) {
      console.error(`[runtime-state-worker] ${U} is invalid; boot state was not installed.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0;
  }
  handleStoredStateValue(e) {
    if (!this.started || !e || typeof e != "object") return;
    const n = e;
    if (!(typeof n.key != "string" || !this.bootKeys.includes(n.key))) {
      if (this.bootPending) {
        if (this.pendingBootKeys !== null) {
          if (this.pendingBootKeys.set(n.key, n.value), this.pendingBootKeys.size === this.bootKeys.length) {
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
    if (e === J) {
      const o = nt(n);
      if (o._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${J}.`);
        return;
      }
      this.modulationState = o.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = Rt(n, Hn(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${U}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = xi(e);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(Mi, 0, void 0, Ht), this.hasRuntimeState || this.scheduleRecovery());
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
    const e = this.lifecycleEpoch, n = this.runtimeGeneration, r = this.modulationState, o = this.articulationBank, i = this.deliveryObserver, s = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, c = this.frameworkInput?.curveCommand ? Ut(r, s, this.frameworkInput.curveCommand) : Ut(r, s), m = await this.modulationLane.sendBatch(c);
    if (!this.started || e !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", m, r)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const h = qn("modulation", m);
      h && i?.(h), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = r, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, r, o)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const l = this.buildUploadsBySelector(r, o), d = Array.from({ length: w }, (h, T) => {
      const R = l.get(T);
      return R ? Wn(R) : null;
    }), u = this.lastAppliedArticulationGeneration !== n, f = u && this.articulationLane.getAcceptedFrontier() !== 0, v = [];
    for (let h = 0; h < w; h += 1) {
      const T = l.get(h), R = d[h] !== this.lastAppliedArticulationTokens[h];
      f ? v.push({
        endpointID: yt,
        value: T ?? Nn(h)
      }) : u ? T && v.push({ endpointID: yt, value: T }) : R && v.push({
        endpointID: yt,
        value: T ?? Nn(h)
      });
    }
    const b = await this.articulationLane.sendBatch(v);
    if (!(!this.started || e !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", b, d)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = d;
        const h = Ls(o);
        if (this.frameworkInput) {
          const T = await this.frameworkInput.publishTriggerConfig(h);
          if (!this.started || e !== this.lifecycleEpoch) return;
          T.kind !== "cancelled" && i?.(T);
        } else
          ni(h, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const T of v) this.lastAppliedArticulationTokens[T.value.selectorA] = void 0;
        const h = qn("articulation", b);
        h && i?.(h);
      }
      this.finishDelivery();
    }
  }
  desiredStateChanged(e, n, r) {
    return e !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const r = Object.fromEntries(e.routes.flatMap((o) => {
      const i = on(o);
      return i === null ? [] : [[o.id, i]];
    }));
    return new Map(
      si(n, r).map((o) => [o.selectorA, o])
    );
  }
  acceptOutcome(e, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const o = Wn(r), i = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== o;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, o), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), i && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Ac));
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
const xc = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function Mc(t) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(t) && !t.includes("__") && !xc.has(t);
}
function Oc(t) {
  return typeof t == "object" && t !== null && "kind" in t && t.kind === "preparation-error" && "error" in t && typeof t.error == "object" && t.error !== null && "kind" in t.error && t.error.kind === "resource" && "message" in t.error && typeof t.error.message == "string";
}
const ki = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-check"), _i = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-initial");
function I(t, e = {}) {
  return Object.freeze({ kind: "parameter", endpoint: t, ...e });
}
function ae(t) {
  if (t.lifetime === "user" && t.history === !0)
    throw new Error("A user-lifetime value is shared across projects and cannot take part in Undo. Remove history: true.");
  const e = Object.freeze({ ...t.codec }), n = t.lifetime === "user" ? !1 : t.history;
  return Object.freeze({
    kind: "stored",
    initial: e.parse(t.initial),
    codec: e,
    ...t.lifetime ? { lifetime: t.lifetime } : {},
    ...n !== void 0 ? { history: n } : {},
    ...t.preset === !1 ? { preset: !1 } : {},
    ...t.engine ? { engine: t.engine } : {}
  });
}
function Gn(t) {
  const e = ae({ codec: t.codec, initial: t.initial, lifetime: t.lifetime, history: t.history, preset: t.preset }), n = Object.freeze([...t.dependencies ?? []]);
  if ("kind" in t.engine && t.engine.kind === "shared-data") {
    const i = t.engine, a = t.prepare, s = t.prepare, c = i.length;
    return Object.freeze({ ...e, engine: Object.freeze({
      kind: "shared-prepared",
      dependencies: n,
      storage: Object.freeze({ type: i.type, fixedLength: c ?? null }),
      prepare: c === void 0 ? s : (m, l) => ({
        length: c,
        write: (d) => a(m, d, l)
      })
    }) });
  }
  const r = t.prepare, o = t.engine;
  return Object.freeze({ ...e, engine: Object.freeze({
    kind: "prepared",
    dependencies: n,
    prepare: r,
    delivery: o
  }) });
}
const wc = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.options");
function kc(t) {
  return Object.keys(t).filter((e) => t[e]?.kind === "stored" && t[e].engine?.kind === "shared-prepared").sort().map((e, n) => ({ key: e, input: n }));
}
function _c(t) {
  return Object.keys(t).filter((e) => t[e]?.preset !== !1);
}
function Dc(t, e = {}) {
  if (e.historyLimit !== void 0 && (!Number.isSafeInteger(e.historyLimit) || e.historyLimit < 0))
    throw new Error("historyLimit must be a non-negative integer.");
  const n = kc(t);
  if (n.length && (!Number.isSafeInteger(e.memoryBudgetBytes) || (e.memoryBudgetBytes ?? 0) < 4))
    throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
  if (n.some(({ key: i }) => !Mc(i) || i === "Data"))
    throw new Error("Shared state names must be valid Cmajor identifiers.");
  const r = /* @__PURE__ */ new Map();
  for (const [i, a] of Object.entries(t)) {
    if (a.kind !== "parameter") continue;
    const s = r.get(a.endpoint);
    if (s !== void 0)
      throw new Error(`Fields "${s}" and "${i}" both declare parameter "${a.endpoint}". Declare each host parameter once.`);
    r.set(a.endpoint, i);
  }
  for (const i of Object.values(t)) i.kind === "stored" && i[ki]?.(t);
  const o = { ...t };
  for (const [i, a] of Object.entries(t)) {
    const s = a.kind === "stored" ? a[_i] : void 0;
    s && (o[i] = Object.freeze({ ...a, initial: s(t) }));
  }
  return Object.freeze(Object.defineProperty(o, wc, { value: Object.freeze({ ...e }) }));
}
function z(t) {
  throw new Error(t);
}
function xt(t, e, n) {
  let r = "";
  for (let o = 0; o < n; o += 1) r += String.fromCharCode(t.getUint8(e + o));
  return r;
}
function Jn(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function Nc(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Qn(t, e) {
  return typeof e == "string" ? Nc(e) : e instanceof ArrayBuffer ? new Uint8Array(e.slice(0)) : ArrayBuffer.isView(e) ? new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength)) : Array.isArray(e) ? Uint8Array.from(e) : z(`The host returned ${t} in a form this kit cannot read.`);
}
function Xn(t, e) {
  const n = new DataView(e);
  (n.byteLength < 12 || xt(n, 0, 4) !== "RIFF" || xt(n, 8, 4) !== "WAVE") && z(`${t} is not a WAV file.`);
  let r = 0, o = 0, i = 0, a = 0, s = -1, c = 0;
  for (let l = 12; l + 8 <= n.byteLength; ) {
    const d = xt(n, l, 4), u = n.getUint32(l + 4, !0), f = l + 8;
    d === "fmt " ? (r = n.getUint16(f, !0), o = n.getUint16(f + 2, !0), i = n.getUint32(f + 4, !0), a = n.getUint16(f + 14, !0)) : d === "data" && (s = f, c = Math.min(u, n.byteLength - f)), l = f + u + u % 2;
  }
  (s < 0 || r === 0) && z(`${t} is missing its WAV format or data chunk.`), o !== 1 && z(`${t} has ${o} channels; readAudio reads mono WAV files only.`);
  const m = e.slice(s, s + c);
  if (r === 3 && a === 32) return { sampleRate: i, samples: new Float32Array(m, 0, Math.floor(c / 4)) };
  if (r === 1 && a === 16) {
    const l = new Int16Array(m, 0, Math.floor(c / 2));
    return { sampleRate: i, samples: Float32Array.from(l, (d) => d / 32768) };
  }
  return z(`${t} uses WAV format ${r} at ${a} bits; use 16-bit PCM or 32-bit float.`);
}
function Cc(t, e) {
  const n = e ?? {}, r = n.frames;
  (!r || typeof r.length != "number") && z(`The host decoded ${t} without audio frames.`);
  const o = new Float32Array(r.length);
  for (let i = 0; i < r.length; i += 1) {
    const a = r[i];
    typeof a == "number" ? o[i] = a : a && a.length === 1 ? o[i] = Number(a[0]) || 0 : z(`${t} is not mono; readAudio reads mono audio only.`);
  }
  return { sampleRate: Number(n.sampleRate) || 0, samples: o };
}
function Lc() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && URL.canParse("/", t)) return new URL("/", t);
  const e = new URL(import.meta.url);
  return e.pathname = e.pathname.replace(/\/[^/]*$/, "/"), e;
}
function Yn(t, e, n) {
  return e instanceof URL ? e : typeof e == "string" && e.length > 0 ? /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e) ? new URL(e) : new URL(e.replace(/^\//, ""), n()) : new URL(t, n());
}
function Di(t, e = {}) {
  const n = t ?? {};
  let r = e.patchRoot;
  const o = () => r ??= Lc(), i = async (s, c = n.getResourceAddress?.(s)) => {
    typeof fetch != "function" && z(`Cannot read ${s}: this host has neither a resource bridge nor fetch.`);
    const m = Yn(s, c, o), l = await fetch(m.toString());
    return l.ok || z(`Could not read ${s} from ${m} (HTTP ${l.status}).`), l.arrayBuffer();
  }, a = async (s) => n.readResource ? Qn(s, await n.readResource(s)) : new Uint8Array(await i(s));
  return {
    async readText(s) {
      if (!n.readResource) return Jn(new Uint8Array(await i(s)));
      const c = await n.readResource(s);
      return typeof c == "string" ? c : typeof c == "object" && c !== null && "text" in c && typeof c.text == "function" ? String(await c.text()) : Jn(Qn(s, c));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    readBytes: a,
    async readAudio(s) {
      const c = n.getResourceAddress?.(s);
      return c != null && typeof fetch == "function" ? Xn(s, await i(s, c)) : n.readResourceAsAudioData ? Cc(s, await n.readResourceAsAudioData(s)) : Xn(s, new Uint8Array(await a(s)).buffer);
    },
    getURL(s) {
      return Yn(s, n.getResourceAddress?.(s), o);
    }
  };
}
function Ni() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0) return new URL("/", t);
  const e = new URL(import.meta.url);
  return e.pathname = e.pathname.replace(/[^/]*\/[^/]*$/, ""), e;
}
const Se = (t) => ({ kind: "ok", value: t }), Ce = (t) => ({ kind: "error", message: t }), se = (t) => typeof t == "object" && t !== null && !Array.isArray(t);
function st(t) {
  if (t === null || typeof t == "boolean" || typeof t == "string") return t;
  if (typeof t == "number") return Number.isFinite(t) ? t : void 0;
  if (Array.isArray(t)) {
    const r = [];
    for (const o of t) {
      const i = st(o);
      if (i === void 0) return;
      r.push(i);
    }
    return Object.freeze(r);
  }
  if (!se(t)) return;
  const e = Object.getPrototypeOf(t);
  if (e !== Object.prototype && e !== null) return;
  const n = {};
  for (const [r, o] of Object.entries(t)) {
    const i = st(o);
    if (i === void 0) return;
    n[r] = i;
  }
  return Object.freeze(n);
}
function Le(t, e) {
  if (Object.is(t, e)) return !0;
  if (Array.isArray(t) || Array.isArray(e))
    return Array.isArray(t) && Array.isArray(e) && t.length === e.length && t.every((i, a) => Le(i, e[a]));
  if (!se(t) || !se(e)) return !1;
  const n = t, r = e, o = Object.keys(n);
  return o.length === Object.keys(r).length && o.every((i) => Object.hasOwn(r, i) && Le(n[i], r[i]));
}
function Pc(t) {
  const e = se(t) ? st(t) : void 0;
  return e !== void 0 && se(e) ? Se(e) : Ce("Preset values must be an object of JSON values.");
}
function Ci(t) {
  if (!se(t) || typeof t.id != "string" || t.id.length === 0 || typeof t.name != "string" || t.name.trim().length === 0)
    return Ce("A preset needs a non-empty id and name.");
  const e = Pc(t.values);
  return e.kind === "ok" ? Se(Object.freeze({ id: t.id, name: t.name, values: e.value })) : e;
}
const Fc = {
  parse(t) {
    if (!se(t) || t.version !== 1 || !Array.isArray(t.presets)) return Ce("Expected a version 1 preset library.");
    const e = [];
    for (const n of t.presets) {
      const r = Ci(n);
      if (r.kind === "error") return r;
      if (e.some((o) => o.id === r.value.id)) return Ce(`Preset id "${r.value.id}" appears twice.`);
      e.push(r.value);
    }
    return Se(Object.freeze({ version: 1, presets: Object.freeze(e) }));
  },
  encode: (t) => t,
  equals: (t, e) => Le(t, e)
}, Zn = {
  parse: (t) => t === null ? Se(null) : Ci(t),
  encode: (t) => t,
  equals: (t, e) => Le(t, e)
};
function Li(t, e) {
  if (t.kind === "parameter")
    return typeof e == "number" && Number.isFinite(e) ? Se(e) : Ce("Expected a finite number.");
  const n = t.codec.parse(e);
  return n.kind === "ok" ? Se(t.codec.encode(n.value)) : n;
}
function Uc(t, e, n) {
  if (e !== void 0 && !t.some((i) => i.id === e))
    throw new Error(`The initial preset "${e}" is not a factory preset. Use the id of one of the factory presets.`);
  const r = _c(n), o = /* @__PURE__ */ new Set();
  for (const i of t) {
    if (typeof i.id != "string" || i.id.length === 0 || typeof i.name != "string" || i.name.trim().length === 0)
      throw new Error("Every factory preset needs a non-empty id and name.");
    if (o.has(i.id)) throw new Error(`Factory preset id "${i.id}" is used twice. Give each factory preset its own id.`);
    o.add(i.id);
    for (const a of Object.keys(i.values))
      if (!r.includes(a))
        throw new Error(`Factory preset "${i.name}" sets "${a}", which is not a sound field. Remove it or correct the field name.`);
    for (const a of r) {
      const s = n[a];
      if (!s) continue;
      if (!Object.hasOwn(i.values, a))
        throw new Error(`Factory preset "${i.name}" is missing "${a}". Give it a value, or declare the field with preset: false.`);
      const c = Li(s, i.values[a]);
      if (c.kind === "error") throw new Error(`Factory preset "${i.name}" has an invalid value for "${a}": ${c.message}`);
    }
  }
}
function $c(t = {}) {
  const e = Object.freeze((t.factory ?? []).map((a) => Object.freeze({ ...a, values: Object.freeze({ ...a.values }) }))), { initial: n } = t, r = Object.freeze({
    ...ae({ codec: Fc, initial: { version: 1, presets: [] }, lifetime: "user", preset: !1 }),
    factory: e,
    [ki]: (a) => Uc(e, n, a)
  }), o = ae({ codec: Zn, initial: null, preset: !1 }), i = e.find((a) => a.id === n);
  return {
    presetLibrary: r,
    // The initial preset's values are saved in each field's encoded form, which needs the whole definition.
    activePreset: i === void 0 ? o : Object.freeze({
      ...o,
      [_i]: (a) => Zn.parse({ id: i.id, name: i.name, values: Bc(a, i) })
    })
  };
}
const er = /* @__PURE__ */ new WeakMap();
function Bc(t, e) {
  let n = er.get(e);
  if (!n) {
    const r = {};
    for (const [o, i] of Object.entries(e.values)) {
      const a = t[o], s = a && Li(a, i);
      s?.kind === "ok" && (r[o] = s.value);
    }
    n = Object.freeze(r), er.set(e, n);
  }
  return n;
}
const Kc = Object.freeze(["A", "B", "C", "D", "E", "F", "G"]);
function zc(t) {
  return {
    // Slots a plugin update removed are dropped and new slots start empty, so older projects still load.
    parse(e) {
      if (typeof e != "object" || e === null || Array.isArray(e)) return { kind: "error", message: "Expected snapshot slots." };
      const n = {};
      for (const r of t) {
        const o = Object.hasOwn(e, r) ? Reflect.get(e, r) : void 0;
        if (o == null) {
          n[r] = null;
          continue;
        }
        const i = typeof o == "object" ? st(Reflect.get(o, "values")) : void 0;
        if (typeof i != "object" || i === null || Array.isArray(i)) return { kind: "error", message: `Snapshot ${r} has invalid values.` };
        n[r] = Object.freeze({ values: i });
      }
      return { kind: "ok", value: Object.freeze(n) };
    },
    encode: (e) => e,
    equals: (e, n) => Le(e, n)
  };
}
function Vc(t) {
  return {
    // A slot that no longer exists is simply no longer active.
    parse: (e) => e === null || typeof e == "string" ? { kind: "ok", value: typeof e == "string" && t.includes(e) ? e : null } : { kind: "error", message: "Expected a snapshot slot name or null." },
    encode: (e) => e,
    equals: Object.is
  };
}
function jc(t = {}) {
  const e = Object.freeze([...t.slots ?? Kc]);
  if (e.length === 0 || e.some((r) => typeof r != "string" || r.length === 0) || new Set(e).size !== e.length)
    throw new Error("Snapshot slots must be distinct, non-empty names.");
  const n = Object.fromEntries(e.map((r) => [r, null]));
  return {
    snapshotSlots: Object.freeze({ ...ae({ codec: zc(e), initial: n, history: !1, preset: !1 }), slots: e }),
    activeSnapshot: ae({ codec: Vc(e), initial: null, preset: !1 })
  };
}
function Pi(t) {
  if (!(t === null || typeof t != "object")) {
    for (const e of Object.values(t)) Pi(e);
    Object.freeze(t);
  }
}
const Hc = {
  parse(t) {
    const e = nt(t);
    return e._tag === "err" ? { kind: "error", message: e.error.message } : (Pi(e.value), { kind: "ok", value: e.value });
  },
  encode: bt,
  equals: (t, e) => bt(t) === bt(e)
}, Wc = [
  {
    controlID: "wavetableSelect",
    endpointSuffix: "WavetableSelect",
    articulationParameterID: null
  },
  {
    controlID: "framePosition",
    endpointSuffix: "WavetablePosition",
    articulationParameterID: "framePosition"
  },
  { controlID: "pan", endpointSuffix: "Pan", articulationParameterID: "pan" },
  { controlID: "octave", endpointSuffix: "Octave", articulationParameterID: "octave" },
  { controlID: "semitone", endpointSuffix: "Semitone", articulationParameterID: "semitone" },
  { controlID: "fineCents", endpointSuffix: "FineCents", articulationParameterID: "fineCents" },
  { controlID: "phase", endpointSuffix: "Phase", articulationParameterID: "phase" },
  {
    controlID: "phaseRandom",
    endpointSuffix: "PhaseRandom",
    articulationParameterID: "phaseRandom"
  },
  { controlID: "retrigger", endpointSuffix: "Retrigger", articulationParameterID: "retrigger" },
  { controlID: "volumeDb", endpointSuffix: "VolumeDb", articulationParameterID: "volumeDb" },
  { controlID: "mute", endpointSuffix: "Mute", articulationParameterID: "mute" },
  { controlID: "solo", endpointSuffix: "Solo", articulationParameterID: "solo" },
  { controlID: "warpMode", endpointSuffix: "WarpMode", articulationParameterID: "warpMode" },
  { controlID: "warpAmount", endpointSuffix: "WarpAmount", articulationParameterID: "warpAmount" },
  {
    controlID: "unisonVoices",
    endpointSuffix: "UnisonVoices",
    articulationParameterID: "unisonVoices"
  },
  {
    controlID: "unisonDetune",
    endpointSuffix: "UnisonDetune",
    articulationParameterID: "unisonDetune"
  },
  {
    controlID: "unisonBlend",
    endpointSuffix: "UnisonBlend",
    articulationParameterID: "unisonBlend"
  },
  {
    controlID: "unisonWidth",
    endpointSuffix: "UnisonWidth",
    articulationParameterID: "unisonWidth"
  },
  {
    controlID: "unisonDetuneMode",
    endpointSuffix: "UnisonDetuneMode",
    articulationParameterID: "unisonDetuneMode"
  },
  {
    controlID: "unisonStackMode",
    endpointSuffix: "UnisonStackMode",
    articulationParameterID: "unisonStackMode"
  },
  {
    controlID: "unisonWavetablePositionSpread",
    endpointSuffix: "UnisonPositionSpread",
    articulationParameterID: "unisonWavetablePositionSpread"
  },
  {
    controlID: "unisonWarpSpread",
    endpointSuffix: "UnisonWarpSpread",
    articulationParameterID: "unisonWarpSpread"
  }
], qc = [
  { id: "A", oscillatorIndex: 0 },
  { id: "B", oscillatorIndex: 1 },
  { id: "C", oscillatorIndex: 2 }
];
function Gc(t) {
  switch (t) {
    case "wavetablePosition":
      return "framePosition";
    case "ampGainDb":
      return "volumeDb";
    case "warpAmount":
    case "pitchSemitones":
    case "pan":
    case "unisonDetune":
    case "unisonBlend":
    case "unisonWidth":
    case "unisonWavetablePositionSpread":
    case "unisonWarpSpread":
      return t;
  }
}
function Jc(t, e, n) {
  const r = n.articulationParameterID === null ? null : `osc${t}.${n.articulationParameterID}`;
  return Object.freeze({
    controlID: n.controlID,
    // SAFETY: both interpolated pieces come from closed unions above, so
    // their concatenation is exactly one OscillatorControlEndpointID.
    endpointID: `osc${t}${n.endpointSuffix}`,
    oscillatorIndex: e,
    articulationParameterID: r
  });
}
function Qc(t, e, n) {
  const r = `osc${t}.${n}`;
  return Object.freeze({
    parameterKind: n,
    targetKind: r,
    // SAFETY: the oscillator and target suffix are both closed canonical
    // unions, so the interpolated ID belongs to the UI target domain.
    uiTargetID: `osc${t}.${Gc(n)}`,
    runtimeTargetIndex: wr(r),
    oscillatorIndex: e
  });
}
function Xc(t, e) {
  const n = Object.freeze(Wc.map(
    (i) => Jc(t, e, i)
  )), r = Object.freeze(Xt.map(
    (i) => Qc(t, e, i)
  )), o = Object.freeze(n.flatMap(
    (i) => i.articulationParameterID === null ? [] : [i.articulationParameterID]
  ));
  return Object.freeze({
    id: t,
    oscillatorIndex: e,
    tableStatus: Object.freeze({ endpointID: "runtimeState", oscillatorIndex: e }),
    controls: n,
    modulationTargets: r,
    articulationParameterIDs: o
  });
}
const Qe = Object.freeze(
  qc.map(({ id: t, oscillatorIndex: e }) => Xc(t, e))
);
function Yc() {
  if (Qe.length !== E.length || Qe.some((e, n) => e.id !== E[n] || e.oscillatorIndex !== n))
    throw new Error("Oscillator binding contracts must match frozen A/B/C runtime order");
  const t = Qe.flatMap(
    (e) => e.controls.map((n) => n.endpointID)
  );
  if (new Set(t).size !== t.length)
    throw new Error("Oscillator control endpoint IDs must be unique");
}
Yc();
const Zc = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [U],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(t) {
    let e = tr(t);
    return {
      apply(n, r) {
        return e.closed && (e = tr(t)), e.apply(n, r);
      },
      stop() {
        e.stop();
      }
    };
  }
};
function tr(t) {
  let e = !1, n = 0, r;
  const o = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
  function s(u) {
    const f = r;
    r = void 0, f ? f(u) : u.kind !== "cancelled" && t.report(u);
  }
  function c() {
    e || (e = !0, d.stop(), s({ kind: "cancelled" }), o.clear());
  }
  function m(u) {
    if (u.kind !== "submitted") {
      u.kind === "failed" && u.error.kind !== "transport" && (s(u), c());
      return;
    }
    o.add(u.completion), u.completion.then((f) => {
      o.delete(u.completion), !(e || f.kind === "sent") && (s(f), c());
    }, (f) => {
      e || (c(), t.fail(f));
    });
  }
  const l = {
    addEndpointListener(u, f) {
      const v = i.get(u) ?? /* @__PURE__ */ new Map();
      v.set(f, t.listen(u, f)), i.set(u, v);
    },
    removeEndpointListener(u, f) {
      i.get(u)?.get(f)?.(), i.get(u)?.delete(f);
    },
    addStoredStateValueListener(u) {
      a.set(u, t.subscribeStored(
        U,
        (f) => u({ key: U, value: f })
      ));
    },
    removeStoredStateValueListener(u) {
      a.get(u)?.(), a.delete(u);
    },
    requestFullStoredState(u) {
      t.readStored(U).then((f) => {
        e || u({ values: { [U]: f } });
      }, (f) => t.fail(f));
    },
    sendEventOrValue(u, f) {
      e || m(t.send({ kind: "event", endpoint: u, value: f }));
    }
  }, d = new wi(l, {
    onDefect(u) {
      c(), t.fail(u);
    },
    curveCommand: (u, f, v) => ({
      async submit({ dspSessionId: b, deliverySerial: h, signal: T }) {
        const R = await t.prepareData(
          Ei + u * 2 + f,
          Ai,
          (p) => {
            new Int32Array(p.buffer, p.byteOffset, 4).set([1297302855, b, h, ie]), rn(v, new Float32Array(p.buffer, p.byteOffset + 16, ie));
          },
          T
        );
        R.kind === "failed" && (s(R), c());
      }
    }),
    async publishTriggerConfig(u) {
      const v = (await Promise.all(o)).find((h) => h.kind !== "sent");
      if (v) return v.kind === "failed" ? v : { kind: "cancelled" };
      if (e) return { kind: "cancelled" };
      const b = t.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: ti(u) });
      return b.kind === "submitted" ? b.completion : b;
    }
  });
  return {
    get closed() {
      return e;
    },
    apply(u, f) {
      if (e || f.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const v = ++n;
      return new Promise((b) => {
        const h = f.signal.onAbort(() => {
          s({ kind: "cancelled" }), c();
        });
        r = (T) => {
          h(), b(T);
        }, d.replaceModulation(u, (T) => {
          v === n && T.kind !== "preparing" && s(T);
        }), d.start();
      });
    },
    stop: c
  };
}
function vn(t) {
  if (!(t === null || typeof t != "object")) {
    for (const e of Object.values(t)) vn(e);
    Object.freeze(t);
  }
}
const el = {
  parse(t) {
    const e = sc(t);
    return e ? (vn(e), { kind: "ok", value: e }) : { kind: "error", message: "Invalid rack document." };
  },
  encode: At,
  equals: (t, e) => At(t) === At(e)
}, nr = /* @__PURE__ */ new WeakMap();
function Mt(t) {
  if (!Object.isFrozen(t)) return JSON.stringify(Fn(t));
  let e = nr.get(t);
  return e === void 0 && nr.set(t, e = JSON.stringify(Fn(t))), e;
}
const tl = {
  parse(t) {
    let e = t;
    if (typeof e == "string")
      try {
        e = JSON.parse(e);
      } catch {
        return { kind: "error", message: "Invalid articulation JSON." };
      }
    const n = /* @__PURE__ */ new Set();
    if (e !== null && typeof e == "object" && Array.isArray(Reflect.get(e, "slots")))
      for (const o of Reflect.get(e, "slots")) {
        if (o === null || typeof o != "object") continue;
        const i = Reflect.get(o, "routeAmounts");
        if (i !== null && typeof i == "object")
          for (const a of Object.keys(i)) n.add(a);
      }
    const r = ci(e, n);
    return r._tag === "err" ? { kind: "error", message: r.error.message } : (vn(r.value), { kind: "ok", value: r.value });
  },
  encode: Mt,
  equals: (t, e) => t === e || Mt(t) === Mt(e)
}, rr = [fi, ye, $t, it], nl = { kind: "sent", proof: "native-publication-processed" };
const rl = {
  eventEndpoints: rr,
  outputEndpoints: ["runtimeState"],
  replacement: "finish",
  create(t) {
    let e, n, r = 0, o = 0, i, a = !1, s = Promise.resolve();
    const c = (u) => gn(u).filter((f) => rr.includes(f.endpointID));
    async function m(u, f, v = !1) {
      if (a || f.aborted) return { kind: "cancelled" };
      const b = c(u), h = e && !v ? c(e) : [], T = (g) => g.find((y) => y.endpointID === it)?.value, R = h.length > 0 && JSON.stringify(T(h)) === JSON.stringify(T(b)), p = [];
      for (const g of b) {
        if (!R) {
          p.push(g);
          continue;
        }
        if (g.endpointID !== it)
          if (g.endpointID === ye) {
            const y = g.value, O = h.find((Y) => Y.endpointID === g.endpointID && Y.value.slotId === y.slotId), P = O ? O.value.values : [], B = y.values.flatMap((Y, Ae) => Object.is(Y, P[Ae]) ? [] : [Ae]);
            B.length === 1 ? p.push({
              endpointID: $t,
              value: { slotId: y.slotId, paramIndex: B[0], value: y.values[B[0]] }
            }) : B.length > 1 && p.push(g);
          } else JSON.stringify(g.value) !== JSON.stringify(h.find((y) => y.endpointID === g.endpointID)?.value) && p.push(g);
      }
      e = void 0;
      for (const g of p) {
        if (a || f.aborted) return { kind: "cancelled" };
        const y = g.endpointID === ye || g.endpointID === $t ? { ...Object(g.value), deliverySerial: ++r } : g.value, O = t.send({ kind: "event", endpoint: g.endpointID, value: y }), P = O.kind === "submitted" ? await O.completion : O;
        if (P.kind !== "sent") return P;
      }
      return a || f.aborted ? { kind: "cancelled" } : (e = u, nl);
    }
    function l(u, f, v = !1) {
      const b = s.then(() => m(u, f, v));
      return s = b.catch(() => {
      }), b;
    }
    const d = t.listen("runtimeState", (u) => {
      const f = u !== null && typeof u == "object" ? Reflect.get(u, "dspSessionId") : void 0;
      if (typeof f != "number" || f === i) return;
      const v = i !== void 0;
      i = f;
      const b = o;
      v && n && l(n, t.signal, !0).then((h) => {
        h.kind === "failed" && b === o && t.report(h);
      }, t.fail);
    });
    return {
      apply(u, f) {
        return o += 1, n = u, l(u, f.signal);
      },
      stop() {
        a = !0, d();
      }
    };
  }
};
function Ot(t, e) {
  return {
    [`osc${t}WavetableSelect`]: 35,
    [`osc${t}WavetablePosition`]: 0,
    [`osc${t}Pan`]: 0,
    [`osc${t}Octave`]: 0,
    [`osc${t}Semitone`]: 0,
    [`osc${t}FineCents`]: 0,
    [`osc${t}Phase`]: 0,
    [`osc${t}PhaseRandom`]: 0,
    [`osc${t}Retrigger`]: 1,
    [`osc${t}VolumeDb`]: 0,
    [`osc${t}Mute`]: e,
    [`osc${t}Solo`]: 0,
    [`osc${t}WarpMode`]: 0,
    [`osc${t}WarpAmount`]: 0,
    [`osc${t}UnisonVoices`]: 1,
    [`osc${t}UnisonDetune`]: 0.1,
    [`osc${t}UnisonBlend`]: 0.75,
    [`osc${t}UnisonWidth`]: 1,
    [`osc${t}UnisonDetuneMode`]: 0,
    [`osc${t}UnisonStackMode`]: 0,
    [`osc${t}UnisonPositionSpread`]: 0,
    [`osc${t}UnisonWarpSpread`]: 0
  };
}
const il = {
  ...Ot("A", 0),
  ...Ot("B", 1),
  ...Ot("C", 1),
  ...Object.fromEntries(Qt().map((t) => [t, 0])),
  playMode: 0,
  glideTime: 0,
  globalTune: 0,
  macro1: 0,
  macro2: 0,
  macro3: 0,
  macro4: 0,
  filterMode: 1,
  filterCutoff: 1e3,
  filterQ: 0.707107,
  filterMix: 1,
  filterCutoffKeyTrackEnabled: 0,
  filterCutoffKeyTrackOffsetSemitones: 0,
  mseg1Morph: 0,
  mseg2Morph: 0,
  mseg3Morph: 0,
  mseg1Rate: 1,
  mseg2Rate: 1,
  mseg3Rate: 1,
  env1Attack: 0.01,
  env1Decay: 0.25,
  env1Sustain: 0.5,
  env1Release: 0.2,
  env2Attack: 0.01,
  env2Decay: 0.25,
  env2Sustain: 0.5,
  env2Release: 0.2,
  env3Attack: 0.01,
  env3Decay: 0.25,
  env3Sustain: 0.5,
  env3Release: 0.2,
  ampAttack: 0.01,
  ampDecay: 1e-3,
  ampSustain: 1,
  ampRelease: 0.2,
  voiceEnhancerFrequency: 130,
  voiceEnhancerQ: 0.71,
  voiceEnhancerAmount: 0,
  voiceEnhancerKeyTrackEnabled: 0,
  voiceEnhancerKeyTrackOffsetSemitones: 0,
  polishEnhancerAmount: 0,
  polishCompressionClipAmount: 0,
  polishOutputTrimDb: 0,
  polishSafeBassAmount: 0,
  polishSafeBassBypass: 0,
  polishEnhancerBypass: 0,
  polishCompressionClipBypass: 0,
  polishOutputTrimBypass: 0,
  [J]: De(),
  [be]: pn(),
  [U]: dt()
}, ol = [
  { id: "init", name: "Init", values: il }
], Fi = "bounce.v1", al = "cosimo.bounce", sl = 1, Ui = "cosimo.patch-document", $i = 1;
function _(t, e) {
  if (!t) throw new Error(e);
}
function Q(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function ce(t, e = "value") {
  return t === null || typeof t == "boolean" || typeof t == "string" ? t : typeof t == "number" ? (_(Number.isFinite(t), `${e} must be finite JSON data`), t) : Array.isArray(t) ? t.map((n, r) => ce(n, `${e}[${r}]`)) : (_(Q(t), `${e} must be JSON-compatible`), Object.fromEntries(
    Object.keys(t).sort().map((n) => [n, ce(t[n], `${e}.${n}`)])
  ));
}
function Bi(t, e) {
  if (typeof t != "string") return ce(t, e);
  try {
    return ce(JSON.parse(t), e);
  } catch (n) {
    throw new Error(`${e} is not valid JSON: ${n instanceof Error ? n.message : n}`);
  }
}
function cl(t) {
  return JSON.stringify(ce(t));
}
function ll({ parameters: t, storedState: e } = {}) {
  _(Q(t), "Bounce patch parameters must be an object"), _(Q(e), "Bounce patch storedState must be an object");
  const n = {};
  for (const r of Object.keys(t).sort()) {
    const o = t[r];
    _(
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(r),
      `Invalid Bounce parameter endpoint ${r}`
    ), _(
      typeof o == "number" && Number.isFinite(o),
      `Bounce parameter ${r} must be finite`
    ), n[r] = o;
  }
  return Object.freeze({
    format: Ui,
    version: $i,
    parameters: Object.freeze(n),
    storedState: Object.freeze(ce(e, "storedState"))
  });
}
function ul(t) {
  const e = Bi(t, "Bounce patch document");
  return _(
    Q(e) && e.format === Ui && e.version === $i,
    "Unsupported Bounce patch document"
  ), _(
    Object.keys(e).sort().join(",") === "format,parameters,storedState,version",
    "Bounce patch document has unexpected fields"
  ), ll(e);
}
function Ki(t) {
  const e = Bi(t, Fi);
  _(
    Q(e) && e.format === al && e.version === sl,
    "Unsupported bounce.v1 document"
  );
  const n = [
    "bankByteLength",
    "capture",
    "digest",
    "format",
    "generation",
    "revertRef",
    "roots",
    "segments",
    "version"
  ];
  _(
    Object.keys(e).sort().join(",") === n.sort().join(","),
    "bounce.v1 has unexpected fields"
  ), _(
    typeof e.digest == "string" && /^[0-9a-f]{64}$/.test(e.digest),
    "bounce.v1 digest must be lowercase SHA-256"
  ), _(
    Number.isInteger(e.generation) && e.generation > 0,
    "bounce.v1 generation must be positive"
  ), _(
    Number.isInteger(e.bankByteLength) && e.bankByteLength > 0,
    "bounce.v1 bankByteLength must be positive"
  ), _(
    Array.isArray(e.roots) && e.roots.length > 0 && e.roots.every((a) => Number.isInteger(a) && a >= 0 && a <= 127),
    "bounce.v1 roots are invalid"
  ), _(
    Array.isArray(e.segments) && e.segments.length === e.roots.length,
    "bounce.v1 segments must match roots"
  );
  let r = 0;
  e.segments.forEach((a, s) => {
    _(
      Q(a) && a.rootNote === e.roots[s] && a.frameOffset === r && Number.isInteger(a.frameCount) && a.frameCount > 0 && Number.isInteger(a.noteOffFrameOffset) && a.noteOffFrameOffset > 0 && a.noteOffFrameOffset < a.frameCount,
      `bounce.v1 segment ${s} is invalid`
    ), r += a.frameCount;
  }), _(
    Q(e.capture) && Number.isInteger(e.capture.sampleRate) && e.capture.sampleRate > 0 && typeof e.capture.tempoBpm == "number" && e.capture.tempoBpm > 0 && e.capture.velocity === 100 && Number.isInteger(e.capture.holdFrames) && e.capture.holdFrames > 0 && Number.isInteger(e.capture.tailCapFrames) && e.capture.tailCapFrames > 0,
    "bounce.v1 capture metadata is invalid"
  ), _(Q(e.revertRef), "bounce.v1 revertRef is invalid");
  const o = e.revertRef.bankDigest;
  _(
    o === null || typeof o == "string" && /^[0-9a-f]{64}$/.test(o),
    "bounce.v1 revert bank digest is invalid"
  );
  const i = ul(e.revertRef.patchDocument);
  return Object.freeze({
    ...ce(e),
    revertRef: Object.freeze({
      bankDigest: o,
      patchDocument: i
    })
  });
}
function dl(t) {
  return cl(Ki(t));
}
const fl = I("sourceMode", { preset: !1 });
function zi(t) {
  if (t !== null && typeof t == "object") {
    for (const e of Object.values(t)) zi(e);
    Object.freeze(t);
  }
  return t;
}
const ir = /* @__PURE__ */ new WeakMap();
function wt(t) {
  let e = ir.get(t);
  return e === void 0 && ir.set(t, e = dl(t)), e;
}
const ml = {
  parse(t) {
    if (t === null) return { kind: "ok", value: null };
    try {
      return { kind: "ok", value: zi(Ki(t)) };
    } catch (e) {
      return { kind: "error", message: e instanceof Error ? e.message : String(e) };
    }
  },
  encode: (t) => t === null ? null : wt(t),
  equals: (t, e) => t === e || t !== null && e !== null && wt(t) === wt(e)
}, hl = ae({ initial: null, codec: ml, preset: !1 }), pl = Object.freeze({
  ...Object.fromEntries(Qe.flatMap(({ controls: t }) => t.map(({ endpointID: e }) => [e, I(e)]))),
  ...Object.fromEntries(Qt().map((t) => [t, I(t)])),
  playMode: I("playMode"),
  glideTime: I("glideTime"),
  macro1: I("macro1"),
  macro2: I("macro2"),
  macro3: I("macro3"),
  macro4: I("macro4"),
  filterMode: I("filterMode"),
  filterCutoff: I("filterCutoff"),
  filterQ: I("filterQ"),
  mseg1Morph: I("mseg1Morph"),
  mseg2Morph: I("mseg2Morph"),
  mseg3Morph: I("mseg3Morph"),
  mseg1Rate: I("mseg1Rate"),
  mseg2Rate: I("mseg2Rate"),
  mseg3Rate: I("mseg3Rate"),
  env1Attack: I("env1Attack"),
  env1Decay: I("env1Decay"),
  env1Sustain: I("env1Sustain"),
  env1Release: I("env1Release"),
  env2Attack: I("env2Attack"),
  env2Decay: I("env2Decay"),
  env2Sustain: I("env2Sustain"),
  env2Release: I("env2Release"),
  env3Attack: I("env3Attack"),
  env3Decay: I("env3Decay"),
  env3Sustain: I("env3Sustain"),
  env3Release: I("env3Release"),
  filterMix: I("filterMix"),
  ampRelease: I("ampRelease"),
  sourceMode: fl,
  globalTune: I("globalTune"),
  ampAttack: I("ampAttack"),
  ampDecay: I("ampDecay"),
  ampSustain: I("ampSustain"),
  filterCutoffKeyTrackEnabled: I("filterCutoffKeyTrackEnabled"),
  filterCutoffKeyTrackOffsetSemitones: I("filterCutoffKeyTrackOffsetSemitones"),
  voiceEnhancerFrequency: I("voiceEnhancerFrequency"),
  voiceEnhancerQ: I("voiceEnhancerQ"),
  voiceEnhancerAmount: I("voiceEnhancerAmount"),
  voiceEnhancerKeyTrackEnabled: I("voiceEnhancerKeyTrackEnabled"),
  voiceEnhancerKeyTrackOffsetSemitones: I("voiceEnhancerKeyTrackOffsetSemitones"),
  polishEnhancerAmount: I("polishEnhancerAmount"),
  polishCompressionClipAmount: I("polishCompressionClipAmount"),
  polishOutputTrimDb: I("polishOutputTrimDb"),
  polishSafeBassAmount: I("polishSafeBassAmount"),
  polishSafeBassBypass: I("polishSafeBassBypass"),
  polishEnhancerBypass: I("polishEnhancerBypass"),
  polishCompressionClipBypass: I("polishCompressionClipBypass"),
  polishOutputTrimBypass: I("polishOutputTrimBypass")
}), gl = Dc({
  ...pl,
  [J]: Gn({ initial: De(), codec: Hc, prepare: (t) => t, engine: Zc }),
  [be]: Gn({
    initial: pn(),
    codec: el,
    dependencies: Qt(),
    prepare: (t, { parameters: e }) => dc(t, e),
    engine: rl
  }),
  [U]: ae({ initial: dt(), codec: tl }),
  [Fi]: hl,
  ...$c({ factory: ol, initial: "init" }),
  ...jc()
}), vl = { kind: "sent", proof: "native-publication-processed" };
function Il(t, e) {
  const n = gl[be];
  if (n.engine?.kind !== "prepared") throw new Error("The synth's rack field must declare its own delivery.");
  const { prepare: r, delivery: o } = n.engine;
  let i = !1;
  const a = /* @__PURE__ */ new Set(), s = {
    get aborted() {
      return i;
    },
    onAbort(p) {
      return a.add(p), () => a.delete(p);
    }
  }, c = Di(t, { patchRoot: Ni() }), m = [];
  function l(p, g) {
    t.addEndpointListener?.(p, g);
    const y = () => t.removeEndpointListener?.(p, g);
    return m.push(y), y;
  }
  const d = {
    signal: s,
    send(p) {
      if (i) return { kind: "cancelled" };
      if (p.kind !== "event") throw new Error(`The rack delivery sent an undeclared ${p.kind}.`);
      return t.sendEventOrValue?.(p.endpoint, p.value), { kind: "submitted", completion: Promise.resolve(vl) };
    },
    listen: l,
    readStored: () => Promise.reject(new Error("The rack delivery declares no stored reads.")),
    subscribeStored: () => {
      throw new Error("The rack delivery declares no stored reads.");
    },
    prepareData: () => Promise.reject(new Error("The rack delivery declares no shared data.")),
    report(p) {
      p.kind === "failed" && e.onDefect(new Error(`The rack was not applied: ${p.error.message}`));
    },
    fail: e.onDefect
  }, u = o.create(d);
  let f, v = !1;
  async function b() {
    const p = f === void 0 ? n.initial : n.codec.parse(f);
    if (p.kind === "error") {
      e.onDefect(new Error(`The saved rack could not be read: ${p.message}`));
      return;
    }
    const g = await r(p.value, { resources: c, parameters: {}, reason: "load", signal: s });
    if (i) return;
    if (Oc(g)) {
      e.onDefect(new Error(`The saved rack could not be prepared: ${g.error.message}`));
      return;
    }
    const y = await u.apply(g, { signal: s, send: d.send, listen: l });
    y.kind === "failed" && e.onDefect(new Error(`The rack was not applied: ${y.error.message}`));
  }
  const h = () => {
    !i && v && b().catch(e.onDefect);
  }, T = (p) => {
    v || xi(p) === 0 || (v = !0, h());
  }, R = (p) => {
    typeof p != "object" || p === null || Reflect.get(p, "key") !== be || (f = Reflect.get(p, "value"), h());
  };
  return {
    start() {
      l(jt, T), t.addStoredStateValueListener?.(R), t.requestFullStoredState?.((p) => {
        f = Ri(p)[be], h();
      });
    },
    stop() {
      if (!i) {
        i = !0;
        for (const p of a) p();
        a.clear(), t.removeStoredStateValueListener?.(R);
        for (const p of m.splice(0)) p();
        return u.stop();
      }
    }
  };
}
const Xe = 2048;
function xe(t, e) {
  if (!t)
    throw new Error(e);
}
function bl(t) {
  xe(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, r) => {
    xe(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), xe(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), xe(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), xe(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), e;
}
const yl = 2048, ct = 11, Sl = 256;
function V(t, e) {
  if (!t)
    throw new Error(e);
}
function Tl(t) {
  return t > 0 && (t & t - 1) === 0;
}
const or = /* @__PURE__ */ new Map();
function El(t) {
  const e = or.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), r = new Uint32Array(t);
  for (let o = 0; o < t; o += 1) {
    let i = 0, a = o;
    for (let s = 0; s < n; s += 1)
      i = i << 1 | a & 1, a >>= 1;
    r[o] = i;
  }
  return or.set(t, r), r;
}
function Vi(t, e, n = !1) {
  const r = t.length;
  V(r === e.length, "FFT real and imaginary buffers must have the same length"), V(Tl(r), "FFT input length must be a power of two");
  const o = El(r);
  for (let i = 0; i < r; i += 1) {
    const a = o[i];
    if (a <= i)
      continue;
    const s = t[i];
    t[i] = t[a], t[a] = s;
    const c = e[i];
    e[i] = e[a], e[a] = c;
  }
  for (let i = 2; i <= r; i <<= 1) {
    const a = i >> 1, s = (n ? 2 : -2) * Math.PI / i, c = Math.cos(s), m = Math.sin(s);
    for (let l = 0; l < r; l += i) {
      let d = 1, u = 0;
      for (let f = 0; f < a; f += 1) {
        const v = l + f, b = v + a, h = t[b], T = e[b], R = d * h - u * T, p = d * T + u * h, g = t[v], y = e[v];
        t[v] = g + R, e[v] = y + p, t[b] = g - R, e[b] = y - p;
        const O = d * c - u * m;
        u = d * m + u * c, d = O;
      }
    }
  }
  if (n)
    for (let i = 0; i < r; i += 1)
      t[i] /= r, e[i] /= r;
}
function ji(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let i = 0; i < e.length; i += 1)
    n += Number(e[i]) || 0;
  const r = n / Math.max(1, e.length), o = new Float32Array(e.length);
  for (let i = 0; i < e.length; i += 1)
    o[i] = (Number(e[i]) || 0) - r;
  return o;
}
function Al(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = yl,
  maxFramesPerTable: r = Sl
} = {}) {
  const o = Float32Array.from(t);
  V(o.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const i = o.length / n;
  V(i > 0, "Source wavetable files must contain at least one frame"), V(i <= r, `Source wavetable files must contain at most ${r} frames`), e !== void 0 && V(i === e, `Source wavetable frame count mismatch: expected ${e}, got ${i}`);
  const a = [];
  for (let s = 0; s < i; s += 1) {
    const c = s * n, m = c + n;
    a.push(ji(o.slice(c, m)));
  }
  return {
    frameCount: i,
    frames: a
  };
}
function ar(t) {
  const e = ji(t), n = Float64Array.from(e), r = new Float64Array(n.length);
  return Vi(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function Hi(t, e, {
  mipLevelCount: n = ct
} = {}) {
  const r = t?.real?.length ?? 0;
  V(r > 0, "Spectrum must contain real samples"), V(r === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), V(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const o = Math.min(1 << e, r >> 1), i = new Float64Array(r), a = new Float64Array(r);
  for (let s = 1; s <= o; s += 1) {
    i[s] = t.real[s], a[s] = t.imaginary[s];
    const c = (r - s) % r;
    c !== s && (i[c] = t.real[c], a[c] = t.imaginary[c]);
  }
  return Vi(i, a, !0), Float32Array.from(i);
}
const Ye = 256, Me = 2048, Wi = 8, Rl = 12811, Wt = (Wi + Ye * Rl) * 4;
function sr(t, e, n) {
  const r = Math.fround(t * e);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(r + (r >= 0 ? 0.5 : -0.5)))
  ));
}
function xl(t, e, n) {
  if (t.byteLength !== Wt || !Number.isInteger(e.frameCount) || e.frameCount < 1 || e.frameCount > Ye)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const r = new Int32Array(t.buffer, t.byteOffset, t.byteLength / 4);
  r.set([
    1465139788,
    1,
    e.dspSessionId,
    e.generation,
    e.tableIndex,
    e.frameCount,
    ct,
    Ye
  ]);
  let o = Wi;
  const i = 131071, a = 8191, s = Math.fround(i / 1.5), c = Math.fround(a / 0.5);
  for (let m = 0; m < ct; ++m) {
    const l = Math.min(Me, Math.max(256, (1 << m) * 32)), d = Me / l;
    for (let u = 0; u < e.frameCount; ++u) {
      const f = Hi(n(u), m), v = o + u * (l + 1);
      for (let b = 0; b <= l; ++b) {
        const h = (b === l ? 0 : b) * d, T = (h + Me - d) % Me, R = (h + d) % Me, p = f[h], g = f[T], y = f[R];
        if (p === void 0 || g === void 0 || y === void 0 || !Number.isFinite(p) || !Number.isFinite(g) || !Number.isFinite(y))
          throw new Error("Wavetable preparation produced invalid samples.");
        const O = Math.fround(0.5 * Math.fround(y - g));
        r[v + b] = sr(p, s, i) & 262143 | sr(O, c, a) << 18;
      }
    }
    o += (l + 1) * Ye;
  }
}
const Ml = "runtimeSyncRequest", Ol = 2147483647, wl = "runtimeState", kl = "retryDesiredTableRequest", _l = "workerLoadFailure", Dl = "serviceLoadAbort", Nl = "wavetableLoadBegin", Cl = "wavetableMipFrame", Ll = "wavetableUploadAck", Pl = "wavetableMipRequest", Fl = "wavetablePrewarmRequest", Ul = "wavetablePrewarmNotification", $l = "assets/factory-bank-catalog.json", qt = 3, Bl = 1, Kl = qt * Xe, zl = 1, Vl = 2, jl = 3, Hl = 1, Wl = 2, ql = 2e4, je = zl, cr = Vl, lr = jl, G = Hl, ur = Wl, Gl = 48 * 1024 * 1024, kt = 3;
function dr(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function k(t, e, n = null) {
  const r = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (r) {
    if (n && Object.keys(n).length > 0) {
      r(`[wavetable-worker] ${e}`, n);
      return;
    }
    r(`[wavetable-worker] ${e}`);
  }
}
function fr(t) {
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
function mr(t, e, n) {
  const r = t + e;
  return t === 0 || r === n || r % 16 === 0;
}
function hr(t, e) {
  if (!t)
    throw new Error(e);
}
function Jl(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function Ql(t, e) {
  return bl(await t.readJSON(e));
}
function Xl(t) {
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
function Yl(t, e) {
  const n = Math.round(Number(t) || 0);
  return Jl(n, 0, Math.max(0, e - 1));
}
function _t(t, e, n, r, o) {
  return `${t}:${e}:${n}:${r}:${o}`;
}
function Zl(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function pr(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function gr(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function He() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function eu(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class tu {
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
    this.connection = e, this.delivery = n.delivery ?? "events", this.resourceClient = n.resourceClient ?? Di(e, { patchRoot: Ni() }), this.catalogPath = n.catalogPath ?? $l, this.maxBatchesInFlight = dr(
      n.maxFramesInFlight,
      Bl
    ), this.mipLevelCount = n.mipLevelCount ?? ct, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Gl) || 0)), this.serviceLoadTimeoutMs = dr(n.serviceLoadTimeoutMs, ql), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    if (this.started)
      return this;
    if (this.delivery === "shared" && !this.connection.sharedData)
      throw new Error("Cosimo requires a host with direct shared wavetable preparation.");
    return this.started = !0, k("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(wl, this.handleRuntimeState), this.connection.addEndpointListener?.(Ll, this.handleUploadAck), this.connection.addEndpointListener?.(Pl, this.handleMipRequest), this.connection.addEndpointListener?.(Fl, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Ul, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Ml,
      Ol
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Ql(this.resourceClient, this.catalogPath), k("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < kt; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = pr(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      for (const [o, i] of this.tableCache)
        e.has(o) || (!r || i.lastUsedSerial < r.lastUsedSerial) && (n = o, r = i);
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
      byteCount: pr(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = _t(
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
          ...gr(this.serviceTable.frameCount),
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
    const { dspSessionId: e, oscillatorIndex: n, generation: r, tableIndex: o } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== r || this.serviceTable.tableIndex !== o || !this.serviceLoadHasPendingTransfers()) && (k("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: e,
        oscillatorIndex: n,
        generation: r,
        tableIndex: o,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: e,
          oscillatorIndex: n,
          generation: r,
          tableIndex: o
        },
        {
          failurePhase: lr,
          failureReasonCode: ur
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== lr || e.failureReasonCode !== ur ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: r,
    generation: o = 0,
    candidateAttemptSerial: i = 0,
    failurePhase: a = je,
    failureReasonCode: s = G
  }) {
    this.connection.sendEventOrValue?.(_l, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: r,
      generation: o,
      candidateAttemptSerial: i,
      failurePhase: a,
      failureReasonCode: s
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: r,
    tableIndex: o,
    failureReasonCode: i = G
  }) {
    this.connection.sendEventOrValue?.(Dl, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: r,
      tableIndex: o,
      failureReasonCode: i
    });
  }
  emitRetryDesiredTableRequest(e) {
    k("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? fr(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(kl, e);
  }
  async loadTableSource(e, n) {
    const r = await this.ensureCatalogLoaded(), o = Yl(e, r.tables.length), i = r.tables[o];
    hr(i, `Could not resolve table ${o}`);
    const a = Zl(i, Xe, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, k("info", "Using cached wavetable source table", {
        tableIndex: o,
        tableId: i.tableId,
        tableName: i.name,
        sourceWav: i.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const c = He();
    k("info", "Reading wavetable source", {
      tableIndex: o,
      tableId: i.tableId,
      tableName: i.name,
      sourceWav: i.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(i.frameCount) : n
    });
    const m = await this.resourceClient.readAudio(i.sourceWav), l = Al(m.samples, {
      expectedFrameCount: n === void 0 ? Number(i.frameCount) : n,
      samplesPerFrame: Xe
    });
    return k("info", "Prepared wavetable source table", {
      tableIndex: o,
      tableId: i.tableId,
      tableName: i.name,
      sourceWav: i.sourceWav,
      frameCount: l.frameCount,
      loadDurationMs: Math.round(He() - c)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: o,
      tableMeta: i,
      frameCount: l.frameCount,
      frames: l.frames,
      spectra: new Array(l.frameCount)
    });
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.oscillatorIndex === e.oscillatorIndex && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, r) {
    if (k("info", "Committing desired wavetable load", {
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.delivery === "shared") {
      this.prepareSharedTable();
      return;
    }
    this.connection.sendEventOrValue?.(Nl, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: r.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  async prepareSharedTable() {
    const e = this.serviceTable;
    if (!e) return;
    const n = He();
    try {
      if (await Ti(this.connection, {
        input: e.oscillatorIndex,
        byteLength: Wt
      }, (r) => {
        xl(r, e, (o) => this.getSpectrumForFrame(o));
      }), this.serviceTable !== e || this.knownSessionId !== e.dspSessionId) return;
      k("info", "Submitted shared wavetable", {
        oscillatorIndex: e.oscillatorIndex,
        tableIndex: e.tableIndex,
        generation: e.generation,
        frameCount: e.frameCount,
        preparedBytes: Wt,
        preparationMs: He() - n,
        sampleUploadBytes: 0
      });
    } catch (r) {
      if (this.serviceTable !== e || this.knownSessionId !== e.dspSessionId) return;
      const o = this.candidateValidations[e.oscillatorIndex];
      o?.dspSessionId === e.dspSessionId && o.generation === e.generation && o.desiredIntentSerial === e.desiredIntentSerial && (this.candidateValidations[e.oscillatorIndex] = null), this.emitWorkerLoadFailure({
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: 0,
        tableIndex: e.tableIndex,
        candidateAttemptSerial: e.desiredIntentSerial,
        failurePhase: cr,
        failureReasonCode: G
      }), this.serviceTable = null, this.clearMipTransferState(), k("error", "Shared wavetable preparation failed", { detail: We(r) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(e) {
    k("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: je,
      failureReasonCode: G
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: je,
      failureReasonCode: G
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = je,
    failureReasonCode: r = G
  } = {}) {
    k("error", "Service wavetable load failed", {
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
      const i = this.candidateValidations[e.oscillatorIndex];
      return i && i.dspSessionId === e.dspSessionId && i.generation === e.generation && i.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
    }
    let r = null;
    try {
      r = await this.loadTableSource(e.tableIndex);
    } catch (i) {
      return this.isCurrentRuntimeState(n) && (k("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: We(i)
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
    }, this.clearMipTransferState(), e.kind === "loading" && (this.delivery === "shared" ? await this.prepareSharedTable() : (this.createFullMipJobsForServiceTable(2), this.pumpUploads()));
    const o = this.candidateValidations[e.oscillatorIndex];
    return o && o.dspSessionId === e.dspSessionId && o.generation === e.generation && o.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
  }
  async prepareDesiredLoad(e) {
    const n = e.desiredTableIndex, r = this.candidateValidations[e.oscillatorIndex];
    if (r && r.dspSessionId === e.dspSessionId && r.tableIndex === n && r.desiredIntentSerial === e.desiredIntentSerial)
      return;
    const o = Math.max(
      this.nextLoadGenerations[e.oscillatorIndex] ?? 1,
      e.generationFrontier + 1
    );
    let i = null;
    try {
      i = await this.loadTableSource(n);
    } catch (a) {
      this.isCurrentRuntimeState(e) && (k("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: We(a)
      }), this.handleCandidateLoadFailure(e));
      return;
    }
    !i || !this.isCurrentRuntimeState(e) || this.markCommittedDesiredLoad(e, o, i);
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
    for (let e = 0; e < kt; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, eu(() => {
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
    const o = this.candidateValidations[n];
    if (o && o.dspSessionId === e.dspSessionId && o.generation > e.generationFrontier)
      return;
    const i = this.resolveServiceTarget(e);
    if (i) {
      if (!await this.prepareServiceTarget(i, e) || !this.isCurrentRuntimeState(e))
        return;
      if (i.kind === "loading" && e.desiredTableIndex !== i.tableIndex && !this.shouldStayIdleOnFailure(e)) {
        k("warn", "Aborting obsolete wavetable load because the desired table changed", {
          dspSessionId: i.dspSessionId,
          oscillatorIndex: n,
          generation: i.generation,
          staleTableIndex: i.tableIndex,
          desiredTableIndex: e.desiredTableIndex,
          desiredIntentSerial: e.desiredIntentSerial
        }), this.emitServiceLoadAbort({
          dspSessionId: i.dspSessionId,
          oscillatorIndex: n,
          generation: i.generation,
          tableIndex: i.tableIndex,
          failureReasonCode: G
        }), this.serviceTable = null, this.clearMipTransferState();
        return;
      }
      i.kind === "active" && e.desiredTableIndex !== i.tableIndex && !this.shouldStayIdleOnFailure(e) && !r && await this.prepareDesiredCandidate(e);
      return;
    }
    if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(e)) {
      this.autoRetryConsumedKeys[n] = this.getDesiredRetryKey(e), this.emitRetryDesiredTableRequest(n);
      return;
    }
    e.serviceState !== 0 || this.shouldStayIdleOnFailure(e) || await this.prepareDesiredLoad(e);
  }
  handleRuntimeState(e) {
    const n = Xl(e ?? {});
    if (k("info", "Received runtime state", fr(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= kt)
      return;
    const r = n.dspSessionId !== this.knownSessionId;
    r && this.resetSessionState(n);
    const o = n.oscillatorIndex, i = this.latestRuntimeStates[o], a = i ? this.getDesiredRetryKey(i) : null, s = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[o] = Math.max(
      this.nextLoadGenerations[o] ?? 1,
      n.generationFrontier + 1
    ), (r || a !== s) && (this.autoRetryConsumedKeys[o] = null), this.latestRuntimeStates[o] = n, this.pendingRuntimeStateOscillators.add(o), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, r = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(r))
      try {
        const o = await this.loadTableSource(r);
        for (let a = 0; a < o.frameCount; a += 1)
          o.spectra[a] || (o.spectra[a] = ar(o.frames[a]));
        const i = this.tableCache.get(o.cacheKey);
        i && this.refreshCacheEntryByteCount(i), k("info", "Prewarmed wavetable source table", {
          tableIndex: o.tableIndex,
          tableId: o.tableMeta.tableId,
          tableName: o.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (o) {
        k("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: r,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: We(o)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), r = Math.trunc(Number(e?.oscillatorIndex)), o = Math.trunc(Number(e?.generation)), i = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), s = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.oscillatorIndex || o !== this.serviceTable.generation || i !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const c = _t(
      n,
      r,
      o,
      i,
      a
    );
    let m = this.mipJobs.get(c);
    return m ? (!m.completed && s > m.urgencyLevel && (m.urgencyLevel = s), m) : (m = {
      key: c,
      dspSessionId: n,
      oscillatorIndex: r,
      generation: o,
      tableIndex: i,
      mipIndex: a,
      urgencyLevel: s,
      ...gr(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(c, m), m);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (k("info", "Received wavetable mip request", {
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
    const n = e ?? {}, r = Math.trunc(Number(n.dspSessionId)), o = Math.trunc(Number(n.oscillatorIndex)), i = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), c = Math.trunc(Number(n.frameIndexBase)), m = Math.trunc(Number(n.frameCount)), l = _t(
      r,
      o,
      i,
      a,
      s
    ), d = this.mipJobs.get(l), u = this.serviceTable?.frameCount ?? 0, f = Math.min(
      qt,
      u - c
    );
    if (!(!d || d.completed || !d.inFlightBatchBases.has(c) || m <= 0 || m !== f)) {
      d.inFlightBatchBases.delete(c);
      for (let v = 0; v < m; v += 1) {
        const b = c + v;
        d.ackedFrames[b] || (d.ackedFrames[b] = 1, d.ackedFrameCount += 1);
      }
      d.ackedFrameCount === u && d.nextFrameIndex >= u && d.inFlightBatchBases.size === 0 && (d.completed = !0, this.activeUploadKey === d.key && (this.activeUploadKey = null)), mr(c, m, u) && k("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: o,
        generation: i,
        tableIndex: d.tableIndex,
        mipIndex: s,
        frameIndexBase: c,
        batchFrameCount: m,
        ackedFrameCount: d.ackedFrameCount,
        frameCount: u,
        inFlightBatches: d.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (hr(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = ar(this.serviceTable.frames[e]);
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
      const n = e.nextFrameIndex, r = Math.min(
        qt,
        this.serviceTable.frameCount - n
      ), o = new Float32Array(Kl);
      try {
        for (let i = 0; i < r; i += 1) {
          const a = n + i, s = this.getSpectrumForFrame(a), c = Hi(s, e.mipIndex);
          o.set(c, i * Xe);
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
            failurePhase: cr,
            failureReasonCode: G
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Cl, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(o)
      }), mr(n, r, this.serviceTable.frameCount) && k("info", "Sent wavetable mip batch", {
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
function We(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function nu(t, e = {}) {
  return new tu(t, e);
}
function ru(t, e, n) {
  if (!Number.isFinite(t.durationSec) || t.durationSec <= 0)
    throw new Error("Speedrun performance duration must be positive and finite.");
  const r = Math.max(1, Math.round(t.durationSec * n)), o = t.events.map((a) => ({
    sample: Math.max(0, Math.min(r - 1, Math.round(a.atSec * n))),
    code: Math.trunc(a.code)
  })).sort((a, s) => a.sample - s.sample || a.code - s.code), i = [];
  for (let a = 0; a < e; a += r)
    for (const s of o) {
      const c = a + s.sample;
      c < e && i.push({ sample: c, code: s.code });
    }
  return i;
}
const qe = 1600, iu = /* @__PURE__ */ new Set([
  "runtimeState",
  "runtimeInstallAck",
  "effectiveRackState"
]);
function Oe(t, e, n) {
  const r = `${e}_${n}`, o = t[r];
  if (typeof o != "function")
    throw new Error(`Offline performer is missing ${r}().`);
  return o.bind(t);
}
function ou(t) {
  return t && typeof t == "object" && "event" in t ? t.event : t;
}
function au(t) {
  return {
    values: {
      [J]: t.modulation,
      [be]: t.lane,
      [U]: t.articulations
    }
  };
}
class su {
  performer;
  sharedData;
  #i;
  #t;
  #m;
  #l = /* @__PURE__ */ new Map();
  #s = /* @__PURE__ */ new Map();
  #d = /* @__PURE__ */ new Map();
  #n = /* @__PURE__ */ new Map();
  #o;
  #c;
  #e = null;
  #f = null;
  #r = null;
  constructor(e, n, r) {
    this.#i = e, this.performer = e.performer, this.sharedData = e.sharedData, this.#o = n, this.#c = new URL("./", r), this.#t = new Map(
      this.performer.getInputEndpoints().map((o) => [o.endpointID, o])
    ), this.#m = new Map(
      this.performer.getOutputEndpoints().map((o) => [o.endpointID, o])
    );
  }
  /** Release the engine and its shared memory. */
  dispose() {
    this.#i.dispose();
  }
  setInitialParameters(e) {
    for (const [n, r] of Object.entries(e))
      this.writeValue(n, r);
  }
  sendEventOrValue(e, n) {
    const r = this.#t.get(e);
    if (!r) throw new Error(`Offline performer has no input endpoint ${e}.`);
    if (r.endpointType === "event") {
      Oe(this.performer, "sendInputEvent", e)(n);
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
    const r = this.#l.get(e) ?? /* @__PURE__ */ new Set();
    r.add(n), this.#l.set(e, r);
  }
  removeEndpointListener(e, n) {
    this.#l.get(e)?.delete(n);
  }
  addParameterListener(e, n) {
    const r = this.#s.get(e) ?? /* @__PURE__ */ new Set();
    r.add(n), this.#s.set(e, r);
  }
  removeParameterListener(e, n) {
    this.#s.get(e)?.delete(n);
  }
  requestParameterValue(e) {
    const n = this.#d.get(e);
    if (n !== void 0)
      for (const r of this.#s.get(e) ?? []) r(n);
  }
  requestFullStoredState(e) {
    e(au(this.#o));
  }
  getResourceAddress(e) {
    return new URL(e, this.#c);
  }
  sendNativeArticulationTriggerConfig(e) {
    this.#r = e;
  }
  getInstallationState() {
    return {
      runtimeStates: new Map(this.#n),
      runtimeInstallAck: this.#e,
      effectiveRackState: this.#f,
      articulationTriggerConfig: this.#r
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
    const o = new Float32Array(e), i = new Float32Array(e);
    this.advance(e), this.performer.getOutputFrames_audioOut([o, i], e, 0);
    for (let a = 0; a < e; a += 1) {
      const s = (r + a) * 2;
      n[s] = o[a], n[s + 1] = i[a];
    }
  }
  writeValue(e, n) {
    const r = this.#t.get(e);
    if (!r || r.endpointType !== "value")
      throw new Error(`Offline performer has no value endpoint ${e}.`);
    Oe(
      this.performer,
      "setInputValue",
      e
    )(n, 0), this.#d.set(e, n);
    for (const o of this.#s.get(e) ?? []) o(n);
  }
  advance(e) {
    if (!Number.isInteger(e) || e < 1 || e > 128)
      throw new Error("OfflineEngineHost advances must contain 1 to 128 frames.");
    this.performer.advance(e), this.drainOutputEvents();
  }
  drainOutputEvents() {
    const e = /* @__PURE__ */ new Set([
      ...iu,
      ...this.#l.keys()
    ]);
    for (const n of e) {
      const r = this.#m.get(n);
      if (!r || r.endpointType !== "event") continue;
      const o = Oe(
        this.performer,
        "getOutputEventCount",
        n
      )();
      if (o < 1) continue;
      const i = Oe(
        this.performer,
        "getOutputEvent",
        n
      ), a = Array.from({ length: o }, (s, c) => ou(i(c)));
      Oe(
        this.performer,
        "resetOutputEventCount",
        n
      )();
      for (const s of a) {
        this.recordDiagnostic(n, s);
        for (const c of this.#l.get(n) ?? []) c(s);
      }
    }
  }
  recordDiagnostic(e, n) {
    if (!n || typeof n != "object") return;
    const r = n;
    if (e === "runtimeState") {
      const o = Math.trunc(Number(r.oscillatorIndex));
      o >= 0 && o < 3 && this.#n.set(o, r);
    } else e === "runtimeInstallAck" ? this.#e = r : e === "effectiveRackState" && (this.#f = r);
  }
}
const vr = "assets/factory-bank-catalog.json";
function cu(t) {
  return {
    async readText(e) {
      if (e !== vr) throw new Error(`Speedrun resource bundle has no text ${e}.`);
      return JSON.stringify(t.catalog);
    },
    async readJSON(e) {
      if (e !== vr) throw new Error(`Speedrun resource bundle has no JSON ${e}.`);
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
const lu = [
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
class ve extends Error {
  constructor(e, n, r = {}) {
    super(`${e} install failed: ${n}`, r), this.lane = e, this.name = "SpeedrunInstallError";
  }
  lane;
}
function uu(t) {
  let e = 0;
  for (const n of t) {
    if (n.endpointID !== ye || typeof n.value != "object" || n.value === null)
      continue;
    const r = n.value.deliverySerial;
    typeof r == "number" && Number.isFinite(r) && r > 0 && (e = Math.max(e, r));
  }
  return e;
}
function du(t) {
  const e = Object.fromEntries(t.modulation.routes.flatMap((r) => {
    const o = on(r);
    return o === null ? [] : [[r.id, o]];
  })), n = gn(t.lane);
  return {
    tableIndices: E.map((r) => Math.round(Number(t.parameters[`osc${r}WavetableSelect`]) || 0)),
    modulationFrontier: Ut(t.modulation, null).length,
    articulationFrontier: si(
      t.articulations,
      e
    ).length,
    rackChainLength: Si(t.lane).chainLength,
    rackParamSerial: uu(n)
  };
}
function fu(t, e) {
  for (let o = 0; o < e.tableIndices.length; o += 1) {
    const i = t.runtimeStates.get(o);
    if (i && i.hasFailure && Number(i.failedTableIndex) === e.tableIndices[o])
      return new ve(
        "wavetable",
        `oscillator ${o + 1} rejected table ${e.tableIndices[o]}.`
      );
  }
  const n = Math.trunc(Number(t.runtimeInstallAck?.rejectedSerial) || 0);
  if (n > 0)
    return new ve("modulation", `runtime serial ${n} was rejected.`);
  if (n < 0)
    return new ve("articulation", `runtime serial ${n} was rejected.`);
  const r = Math.trunc(
    Number(t.effectiveRackState?.laneRejectedUploadCount) || 0
  );
  return r > 0 ? new ve("rack", `${r} topology upload(s) were rejected.`) : null;
}
function Ir(t, e) {
  const n = e.tableIndices.every((a, s) => {
    const c = t.runtimeStates.get(s);
    return !!c?.hasActive && Number(c?.activeTableIndex) === a;
  }), r = e.modulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedModulationSerial) >= e.modulationFrontier, o = e.articulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedArticulationSerial) <= -e.articulationFrontier, i = Number(t.effectiveRackState?.laneCommittedChainLength) === e.rackChainLength && Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) >= e.rackParamSerial;
  return n && r && o && i;
}
function mu(t, e) {
  return e.tableIndices.every((n, r) => {
    const o = t.runtimeStates.get(r);
    return !!o?.hasActive && Number(o?.activeTableIndex) === n;
  }) ? e.modulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedModulationSerial) < e.modulationFrontier ? "modulation" : e.articulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedArticulationSerial) > -e.articulationFrontier ? "articulation" : "rack" : "wavetable";
}
function hu(t) {
  return `${[0, 1, 2].map((n) => {
    const r = t.runtimeStates.get(n);
    return r ? `${n}:${Number(r.activeGeneration) || 0}/${Number(r.generationFrontier) || 0} load=${Number(r.loadingGeneration) || 0} active=${!!r.hasActive}` : `${n}:missing`;
  }).join(", ")}; mod=${Number(t.runtimeInstallAck?.acceptedModulationSerial) || 0} art=${Number(t.runtimeInstallAck?.acceptedArticulationSerial) || 0} rack=${Number(t.effectiveRackState?.laneCommittedChainLength) || 0} params=${Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) || 0}`;
}
function qi(t) {
  return t >>> 16 & 255;
}
function Gi(t) {
  return t >>> 8 & 127;
}
function In(t) {
  return t & 127;
}
function pu(t, e, n) {
  if (t === null) return null;
  let r;
  try {
    r = JSON.parse(t);
  } catch {
    return null;
  }
  const o = r.activeMode, i = o === "key" ? r.key : o === "vel" ? r.velocity : r.chain;
  if (!Array.isArray(i)) return null;
  const a = o === "key" ? Gi(e) : o === "vel" ? In(e) : n % 128, s = Math.trunc(Number(i[a]));
  return s >= 0 && s <= 127 ? s : null;
}
function gu(t, e, n, r) {
  const o = qi(e);
  if ((o & 240) === 144 && In(e) > 0) {
    const i = pu(n, e, r);
    i !== null && t.sendEventOrValue("articulationNoteMeta", {
      channel: o & 15,
      noteNumber: Gi(e),
      selectorA: i,
      selectorB: 0,
      durationSamples: 0,
      ageSamples: 0
    });
  }
  t.sendMIDIInputEvent("midiIn", e);
}
function vu(t) {
  return Object.fromEntries(gn(t.lane).flatMap((e) => yr(e.endpointID) !== null && typeof e.value == "number" ? [[e.endpointID, e.value]] : []));
}
async function Iu() {
  await new Promise((t) => setTimeout(t, 0));
}
async function bu(t, e) {
  const n = new su(await t.createOfflinePerformer(e.sessionID, e.sampleRate), {
    modulation: e.state.modulation,
    lane: e.state.lane,
    articulations: e.state.articulations
  }, e.resourceBaseURL);
  try {
    return await yu(n, e);
  } finally {
    n.dispose();
  }
}
async function yu(t, e) {
  const n = globalThis.performance?.now?.() ?? 0;
  t.setInitialParameters({ ...e.state.parameters, ...vu(e.state) }), t.sendEventOrValue("tempo", { bpm: 120 });
  const r = [], o = (g) => (y) => {
    r.push(new ve(g, y instanceof Error ? y.message : String(y), { cause: y }));
  }, i = new wi(t, {
    curveCommand: (g, y, O) => pc(t, g, y, O),
    async publishTriggerConfig(g) {
      return ni(g, t), { kind: "sent", proof: "native-publication-processed" };
    },
    onDefect: o("modulation")
  });
  i.replaceModulation(e.state.modulation, (g) => {
    g.kind === "failed" && o("modulation")(g.error.message);
  });
  const a = await mc(t, [
    () => i,
    () => Il(t, { onDefect: o("rack") }),
    () => nu(t, {
      delivery: "shared",
      serviceLoadTimeoutMs: 2e4,
      ...e.resourceBundle ? { resourceClient: cu(e.resourceBundle) } : {}
    })
  ]), s = du(e.state), c = e.maxInstallFrames ?? e.sampleRate * 4;
  let m = 0;
  try {
    for (; m < c; ) {
      if (await t.pump(128), m += 128, r.length > 0) throw r[0];
      const y = t.getInstallationState(), O = fu(y, s);
      if (O) throw O;
      if (Ir(y, s)) break;
      m / 128 % 8 === 0 && await Iu();
    }
    const g = t.getInstallationState();
    if (!Ir(g, s)) {
      const y = mu(g, s);
      throw new ve(
        y,
        `timed out after ${m} virtual frames (${hu(g)}).`
      );
    }
  } finally {
    await a.stop();
  }
  const l = new Float32Array(e.frameCount * 2), d = ru(e.performance, e.frameCount, e.sampleRate), u = t.getInstallationState().articulationTriggerConfig, f = e.recordTelemetry === !0, v = /* @__PURE__ */ new Map();
  let b = 0, h = 0, T = 0;
  f && (t.sendEventOrValue("filterSpectrumActivity", 1), t.sendEventOrValue("distortionScopeActivity", 1), t.sendEventOrValue("distortionHistoryActivity", 1));
  const R = f ? lu.map((g) => {
    const y = (O) => {
      const P = Math.floor(h / qe), B = v.get(P) ?? {};
      B[g] = structuredClone(O), v.set(P, B);
    };
    return t.addEndpointListener(g, y), { endpointID: g, listener: y };
  }) : [];
  try {
    for (; h < e.frameCount; ) {
      for (; b < d.length && d[b].sample === h; ) {
        const P = d[b];
        gu(t, P.code, u, T), (qi(P.code) & 240) === 144 && In(P.code) > 0 && (T += 1), b += 1;
      }
      const g = d[b]?.sample ?? e.frameCount, y = (Math.floor(h / qe) + 1) * qe, O = Math.min(
        128,
        e.frameCount - h,
        g - h,
        ...f ? [y - h] : []
      );
      if (O < 1)
        throw new Error("Speedrun checkpoint render computed an empty advance.");
      t.render(O, l, h), h += O;
    }
  } finally {
    for (const { endpointID: g, listener: y } of R)
      t.removeEndpointListener(g, y);
  }
  const p = (globalThis.performance?.now?.() ?? n) - n;
  return {
    rootIndex: e.rootIndex,
    rootNote: e.rootNote,
    checkpointIndex: e.checkpointIndex,
    frameCount: e.frameCount,
    samples: l,
    telemetry: {
      frameCount: Math.ceil(e.frameCount / qe),
      frames: [...v.entries()].sort(([g], [y]) => g - y).map(([g, y]) => ({ frame: g, events: y }))
    },
    metrics: {
      renderedFrameCount: e.frameCount,
      installFrameCount: m,
      elapsedMilliseconds: p,
      realtimeMultiplier: p > 0 ? e.frameCount / (p * e.sampleRate / 1e3) : null
    }
  };
}
const Ge = self;
function Su(t) {
  return {
    name: t instanceof Error ? t.name : "Error",
    message: t instanceof Error ? t.message : String(t),
    stack: t instanceof Error ? t.stack : void 0
  };
}
Ge.addEventListener("message", (t) => {
  const e = t.data;
  (async () => {
    if (e.type !== "render-root" || typeof e.engineModuleURL != "string")
      throw new Error("Speedrun checkpoint worker received an unsupported request.");
    const r = await import(new URL(e.engineModuleURL, Ge.location.href).href), o = r.default ?? r.WavetableSynth, i = await bu(
      o,
      e.job
    );
    Ge.postMessage({
      type: "render-root-complete",
      requestID: e.requestID,
      result: i
    }, [i.samples.buffer]);
  })().catch((n) => {
    Ge.postMessage({
      type: "render-root-failed",
      requestID: e.requestID,
      error: Su(n)
    }, []);
  });
});
