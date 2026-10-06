const en = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function kr(t) {
  const e = en.find((n) => n.deviceType === t);
  if (e === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${t}`);
  return e;
}
function U(t) {
  return kr(t).laneEndpointID;
}
function tn(t, e) {
  if (!Number.isInteger(e) || e < 1 || e > 5)
    throw new Error(`Effect Output Trim instance is out of range: ${e}`);
  return `${kr(t).hostStem}${e}OutputTrimDb`;
}
function nn() {
  return en.flatMap((t) => Array.from(
    { length: 5 },
    (e, n) => tn(t.deviceType, n + 1)
  ));
}
function _r(t) {
  if (typeof t != "string")
    return null;
  for (const e of en)
    for (let n = 1; n <= 5; n += 1)
      if (t === tn(e.deviceType, n))
        return {
          deviceType: e.deviceType,
          instanceNumber: n,
          laneEndpointID: e.laneEndpointID
        };
  return null;
}
function Dr(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function si(t) {
  const e = (Dr(t, -100, 35) - -100) / 135;
  return e * e;
}
function ci(t) {
  return -100 + Math.sqrt(Dr(t, 0, 1)) * 135;
}
const P = (t, e) => ({ label: t, value: e });
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
}), I = (t, e, n, r, o, i, a, s = {}) => ({
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
  modulationIdentityEndpointID: s.modulationIdentityEndpointID,
  modulationDragStyle: s.modulationDragStyle
});
function W(t, e, n) {
  return I(
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
const li = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], ui = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], di = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: H.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      I("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(P), quick: !0 }),
      I("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      I("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      I("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
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
      I("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [P("Classic", 0), P("Harmonics", 1)] }),
      I("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      I("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      I("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      I("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      I("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      I("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [P("Symmetric", 0), P("Asymmetric", 1), P("Wavefold", 2)] }),
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
      I("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      I("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      I("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      I("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      I("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
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
      I("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(P) }),
      I("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(P) }),
      I("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      I("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      I("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      I("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      I("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
        unit: "Hz",
        scale: "log",
        modulationTargetIndex: 17,
        modulationApplication: "semitones",
        modulationIdentityEndpointID: "chorusRingFineSemitones"
      }),
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
      I("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      I("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      I("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      I("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      I("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
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
      I("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [P("Free", 0), P("Sync", 1)] }),
      I("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      I("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: li.map(P) }),
      I("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      I("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      I("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      I("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      I("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
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
      I("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [P("Free", 0), P("Sync", 1)] }),
      I("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      I("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: ui.map(P) }),
      I("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      I("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      I("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
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
      I("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      I("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      I("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      I("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      W("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], dt = di, Cr = Object.freeze(
  dt.flatMap((t) => t.parameters)
);
new Map(
  Cr.map((t) => [t.endpointID, t])
);
function Nr(t) {
  const e = dt.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function Lr() {
  return Cr;
}
function rn(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const A = ["A", "B", "C"], on = [
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
], fi = [
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
]), mi = Object.freeze([
  ...A.flatMap((t) => on.map(
    (e) => `osc${t}.${e}`
  )),
  ...fi
]);
new Set(
  A.flatMap((t) => on.map(
    (e) => `osc${t}.${e}`
  ))
);
const Pr = Object.freeze(
  mi.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), hi = Lr().filter(
  (t) => t.modulationTargetIndex !== null
), pi = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function an(t) {
  const e = gi(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function gi(t) {
  const e = pi.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const yi = [
  ...hi.map((t) => ({
    kind: an(rn(t)),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Fr = Object.freeze(
  yi.sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), X = Object.freeze([
  ...Pr,
  ...Fr
]), Qe = le.length, Ur = Pr.length, ft = Fr.length, bi = Qe * X.length, vi = new Map(le.map((t) => [t.id, t])), $r = new Map(le.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), Ee = new Map(X.map((t) => [t.kind, t]));
function Ii() {
  if (Qe !== 14 || Ur !== 59 || ft !== 47 || bi !== 1484)
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
  if (vi.size !== Qe || $r.size !== Qe || Ee.size !== X.length)
    throw new Error("Modulation identities must be unique");
}
Ii();
function Br(t, e) {
  const n = $r.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function sn(t) {
  return typeof t != "string" ? null : Ee.has(t) ? t : null;
}
function Si(t) {
  const e = sn(t);
  return e !== null && Ee.get(e)?.group === "voice" ? e : null;
}
function cn(t) {
  const e = sn(t);
  return e !== null && Ee.get(e)?.group === "rack" ? e : null;
}
function Kr(t) {
  const e = Ee.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function zr(t) {
  const e = Ee.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function Ti(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const Vr = 4, Ei = Vr * ft, Ai = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), Ri = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function ue(t) {
  if (typeof t != "string")
    return null;
  const e = Ri.exec(t);
  if (e === null)
    return null;
  const n = e[1], r = Ai.get(n);
  if (r === void 0)
    return null;
  const o = e[3];
  return r.includes(o) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: o
  } : null;
}
function ln(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function jr(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function Hr(t) {
  if (t === null)
    return null;
  const e = jr(t) - 1;
  return e > Vr ? null : e * ft + zr(ln(t));
}
const te = 2048, De = te + 3, Mn = 20, Wr = "MSEG 1";
function qr(t) {
  return t !== null && typeof t == "object" ? t : {};
}
function Gr(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Ce(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function xi(t) {
  return Gr(Number.isFinite(t) ? t : 0, -Mn, Mn);
}
function ie(t) {
  return Gr(Number.isFinite(t) ? t : 0, 0, 1);
}
function Jr(t = Wr) {
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
function Mi(t, e, n) {
  const r = qr(t);
  let o = Number(r.x);
  return Number.isFinite(o) || (o = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (o = ie(o)), {
    x: o,
    y: ie(Number(r.y)),
    curvePower: xi(Number(r.curvePower))
  };
}
function un(t = Jr()) {
  const e = qr(t), n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((o, i) => Mi(o, i, n.length));
  if (!Ce(r[0].x, 0) || !Ce(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let o = 1; o < r.length; o += 1)
    if (r[o].x < r[o - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Wr,
    globalSmooth: !!e.globalSmooth,
    points: r
  };
}
function Oi(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, r = Math.exp(e) - 1;
  return n / r;
}
function wi(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const r = t[n], o = t[n + 1];
    if (e < o.x)
      return { from: r, to: o, laterPointWins: !1 };
    if (Ce(e, o.x)) {
      let i = n + 1;
      for (; i + 1 < t.length && Ce(t[i + 1].x, e); )
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
function ki(t, e) {
  const n = ie(Number(e)), r = wi(t, n);
  if (r.laterPointWins || Ce(r.from.x, r.to.x))
    return r.to.y;
  const o = r.to.x - r.from.x, i = o <= 0 ? 1 : (n - r.from.x) / o, a = ie(Oi(i, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function _i(t, e) {
  return ki(un(t).points, e);
}
function Di(t) {
  const e = new Float32Array(De);
  return Qr(t, e), e;
}
function Qr(t, e) {
  if (e.length !== De) throw new Error("Invalid MSEG destination length.");
  const n = un(t);
  for (let r = 0; r < te; r += 1) {
    const o = r / (te - 1);
    e[r + 1] = _i(n, o);
  }
  e[0] = e[1], e[te + 1] = e[te], e[te + 2] = e[te];
}
const Ci = 0, ne = 2;
function Ft(t) {
  return t !== null && typeof t == "object" ? t : {};
}
function Ni(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Li(...t) {
  return { ...Jr(...t), format: "cosimo.mseg.shape" };
}
function Ut(...t) {
  return { ...un(...t), format: "cosimo.mseg.shape" };
}
function On(t) {
  return JSON.stringify(Ut(t));
}
function wn(t, e) {
  return On(t) === On(e);
}
function Pi(t) {
  const e = Number(t);
  return Ni(
    Number.isFinite(e) ? e : 1,
    Ci,
    ne
  );
}
function $t() {
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
function Fi(t) {
  if (!t || typeof t != "object")
    return null;
  const e = Ft(t), n = ie(Number(e.startX)), r = ie(Number(e.endX));
  return Math.abs(n - r) <= 1e-12 ? null : r < n ? { startX: r, endX: n } : { startX: n, endX: r };
}
function Ui(t = $t()) {
  const e = Ft(t), n = Ft(e.rate), r = Number(n.seconds), o = e.noteOffPolicy, i = o === "finish_loop" || o === "immediate" || o === "ignore" ? o : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: Pi(Number.isFinite(r) ? r : 1)
    },
    loop: Fi(e.loop),
    noteOffPolicy: i,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
const ht = "modulationProgram", $i = "modulationAmount", Xr = le.filter((t) => t.group === "voice").length, Yr = le.filter((t) => t.group === "macro").length, et = Ur, Bi = ft, tt = Bi + Ei, re = Xr * et, me = Yr * et, Ki = Xr * tt, zi = Yr * tt, ee = 512, de = 256, Zr = re + me;
function Vi(t) {
  const e = Br(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function ji(t) {
  const e = Si(t);
  return e === null ? null : Kr(e);
}
function eo(t) {
  const e = ji(t.targetKind), n = cn(t.targetKind);
  let r = n === null ? void 0 : zr(n);
  if (r === void 0) {
    const a = Hr(
      ue(t.targetKind)
    );
    a !== null && (r = a);
  }
  if (e === null && r === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = Br(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (e !== null) {
      const u = s * et + e;
      return {
        path: "macroVoice",
        cellIndex: u,
        sourceIndex: s,
        targetIndex: e,
        articulationCellIndex: re + u
      };
    }
    const c = r ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * tt + c,
      sourceIndex: s,
      targetIndex: c,
      articulationCellIndex: null
    };
  }
  const o = Vi(t);
  if (e !== null) {
    const a = o * et + e;
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
    cellIndex: o * tt + i,
    sourceIndex: o,
    targetIndex: i,
    articulationCellIndex: null
  };
}
function dn(t) {
  return ue(t.targetKind) !== null ? null : eo(t).articulationCellIndex;
}
function Hi(t) {
  if (cn(t.targetKind) !== null)
    return !1;
  const e = ue(t.targetKind);
  return e !== null && Hr(e) === null;
}
function Wi(t) {
  return {
    ...eo(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function to(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (Hi(n))
      continue;
    const r = Wi(n), o = e[r.path];
    if (o.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    o.set(r.cellIndex, r);
  }
  return e;
}
function qi(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function he(t) {
  return [...t.values()].filter(qi).sort((e, n) => e.cellIndex - n.cellIndex);
}
function Ke(t, e, n, r, o) {
  for (let i = 0; i < t.length; i += 1) {
    const a = t[i];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${i}`);
    e[i] = a.cellIndex, n[i] = a.sourceIndex, r[i] = a.targetIndex, o[i] = a.polarity;
  }
}
function pt(t) {
  const e = to(t), n = he(e.voice), r = he(e.macroVoice), o = he(e.voiceRack), i = he(e.macroRack), a = Array.from({ length: re }, () => 0), s = Array.from({ length: re }, () => 0), c = Array.from({ length: re }, () => 0), u = Array.from({ length: re }, () => 0), l = Array.from({ length: re }, () => 0);
  Ke(n, a, s, c, u);
  const m = Array.from({ length: me }, () => 0), d = Array.from({ length: me }, () => 0), f = Array.from({ length: me }, () => 0), p = Array.from({ length: me }, () => 0), g = Array.from({ length: me }, () => 0);
  if (Ke(
    r,
    m,
    d,
    f,
    p
  ), o.length > ee || i.length > de)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${o.length} voice-rack (max ${ee}), ${i.length} macro-rack (max ${de})`
    );
  const b = Array.from({ length: ee }, () => 0), S = Array.from({ length: ee }, () => 0), E = Array.from({ length: ee }, () => 0), h = Array.from({ length: ee }, () => 0), y = Array.from({ length: ee }, () => 0), T = Array.from({ length: Ki }, () => 0);
  Ke(
    o,
    b,
    S,
    E,
    h
  );
  const x = Array.from({ length: de }, () => 0), K = Array.from({ length: de }, () => 0), Y = Array.from({ length: de }, () => 0), Z = Array.from({ length: de }, () => 0), Re = Array.from({ length: zi }, () => 0);
  Ke(
    i,
    x,
    K,
    Y,
    Z
  );
  for (const N of e.voice.values()) l[N.cellIndex] = N.amount;
  for (const N of e.macroVoice.values()) g[N.cellIndex] = N.amount;
  for (const N of e.voiceRack.values()) T[N.cellIndex] = N.amount;
  for (const N of e.macroRack.values()) Re[N.cellIndex] = N.amount;
  for (let N = 0; N < o.length; N += 1) {
    const xn = o[N];
    if (xn === void 0) throw new Error(`Missing compiled voice-rack route at index ${N}`);
    y[N] = xn.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: c,
    voiceRoutePolarities: u,
    voiceRouteAmounts: l,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: m,
    macroVoiceRouteSources: d,
    macroVoiceRouteTargets: f,
    macroVoiceRoutePolarities: p,
    macroVoiceRouteAmounts: g,
    voiceRackRouteCount: o.length,
    voiceRackRouteCells: b,
    voiceRackRouteSources: S,
    voiceRackRouteTargets: E,
    voiceRackRoutePolarities: h,
    voiceRackRouteReducers: y,
    voiceRackRouteAmounts: T,
    macroRackRouteCount: i.length,
    macroRackRouteCells: x,
    macroRackRouteSources: K,
    macroRackRouteTargets: Y,
    macroRackRoutePolarities: Z,
    macroRackRouteAmounts: Re
  };
}
const Gi = ["voice", "macroVoice", "voiceRack", "macroRack"], Ji = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function kn(t) {
  return to(t);
}
function Qi(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function Xi(t, e) {
  if (t === null)
    return [{ endpointID: ht, value: pt(e) }];
  const n = kn(t), r = kn(e), o = [];
  for (const i of Gi) {
    const a = he(n[i]), s = he(r[i]);
    if (a.length !== s.length)
      return [{ endpointID: ht, value: pt(e) }];
    for (let c = 0; c < s.length; c += 1) {
      const u = a[c], l = s[c];
      if (u === void 0 || l === void 0 || !Qi(u, l))
        return [{ endpointID: ht, value: pt(e) }];
      u.amount !== l.amount && o.push({
        endpointID: $i,
        value: {
          pathKind: Ji[i],
          cellIndex: l.cellIndex,
          amount: l.amount
        }
      });
    }
  }
  return o;
}
function Ae(t) {
  return { _tag: "ok", value: t };
}
function ke(t) {
  return { _tag: "err", error: t };
}
function Yi(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Zi(t) {
  throw new Error(t ?? "Invariant violated");
}
const ea = "globalTune", ta = "globalTuneSemitones", q = -24, xe = 24, _n = 0, no = -48, ro = 48, Bt = -48, oo = 6, fn = 0, Dn = (fn - Bt) / (oo - Bt), _e = Object.freeze({
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
function na(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function gt(t) {
  return _e.minimumHz * Math.pow(
    _e.maximumHz / _e.minimumHz,
    na(t, 0, 1)
  );
}
Object.freeze(
  Array.from({ length: fe }, (t, e) => {
    const n = e / (fe - 1), r = gt(n), o = gt(
      Math.max(0, e - 0.5) / (fe - 1)
    ), i = gt(
      Math.min(fe - 1, e + 0.5) / (fe - 1)
    );
    return {
      centerHz: r,
      lowHz: e === 0 ? _e.minimumHz : o,
      highHz: e === fe - 1 ? _e.maximumHz : i
    };
  })
);
const ra = "voiceEnhancerFrequency", oa = "voiceEnhancerQ", ia = "voiceEnhancerAmount", aa = "voiceEnhancerFrequencyOctaves", sa = "voiceEnhancerQ", ca = "voiceEnhancerAmount", io = "voice.enhancerFrequency", la = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: ra,
    targetKind: aa,
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
    endpointID: oa,
    targetKind: sa,
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
    endpointID: ia,
    targetKind: ca,
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
function Cn(t, e) {
  const n = Math.min(t.max, Math.max(t.min, e));
  return t.scale === "log" ? Math.log(n / t.min) / Math.log(t.max / t.min) : (n - t.min) / (t.max - t.min);
}
function ua(t, e) {
  const n = Math.min(1, Math.max(0, e));
  return t.scale === "log" ? t.min * (t.max / t.min) ** n : t.min + (t.max - t.min) * n;
}
function ze(t, e, n, r, o = "percent", i = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: r, format: o, compound: i };
}
const da = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      ze("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      ze("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      ze("mix", "Mix", 100, 100),
      ze("drive", "Drive", 15, 0)
    ]
  }
], Nn = 1e-6;
function B(t, e) {
  if (!Number.isFinite(t) || t < -Nn || t > 1 + Nn)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function nt(t, e) {
  return B(t / 100, `${e} catalog percentage`);
}
function Fe(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function fa(t) {
  return 20 * 1e3 ** t;
}
function ma(t) {
  return B(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function ha(t) {
  return 0.1 * 200 ** t;
}
function pa(t) {
  return B(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function ga(t) {
  return t;
}
function ya(t) {
  return B(t, "filterMix endpoint conversion");
}
function be(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function ba(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: be("filterCutoff", fa, ma),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: be("filterQ", ha, pa),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: be("filterMix", ga, ya),
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
function ao(t) {
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
      return Yi(t);
  }
}
function va(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ia(t, e) {
  const n = Fe(t.moduleId, e.id), r = ao(e.format), o = ba(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: nt(e.defaultPercent, n),
    initialValue: nt(e.initialPercent, n),
    format: r,
    modAmount: va(r),
    binding: o.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: o.articulationParameterId,
    modulationTargetKind: o.modulationTargetKind
  });
}
const Sa = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Dn * 100, defaultPercent: Dn * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Ta(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ea(t, e) {
  const n = `osc${t}`, r = Fe(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: nt(e.defaultPercent, r),
    initialValue: nt(e.initialPercent, r),
    format: ao(e.format),
    modAmount: Ta(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Aa = Object.freeze(
  A.flatMap((t) => Sa.map((e) => Ea(t, e)))
), Ra = Object.freeze({
  targetId: Fe("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: B(
    (_n - q) / (xe - q),
    "Global Tune default"
  ),
  initialValue: B(
    (_n - q) / (xe - q),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: xe },
  modAmount: {
    min: no,
    max: ro,
    unit: "st",
    digits: 2
  },
  binding: be(
    ea,
    (t) => q + (xe - q) * t,
    (t) => B(
      (t - q) / (xe - q),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: ta
});
function xa(t) {
  const e = Fe("voice-enhancer", t.key), n = B(
    Cn(t, t.initial),
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
    binding: be(
      t.endpointID,
      (r) => ua(t, r),
      (r) => B(
        Cn(t, r),
        `${t.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: t.targetKind
  });
}
const Ma = Object.freeze(
  Object.values(la).map(xa)
), Oa = Object.freeze([
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
function wa(t) {
  const e = Fe(t.moduleId, t.targetIdSuffix), n = t.max - t.min, r = (i) => t.min + n * i, o = (i) => B(
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
    binding: be(t.endpointID, r, o),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const ka = Object.freeze(
  Oa.map(wa)
), _a = Object.freeze([
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
function Da(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function yt(t, e) {
  const n = t.valueKind === "effect-output-trim-db" ? si(e) : t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return B(n, `${t.endpointID} endpoint conversion`);
}
function Ca(t, e) {
  return t.valueKind === "effect-output-trim-db" ? ci(e) : t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Na(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function La(t) {
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
function Pa(t) {
  const e = Da(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: yt(t, t.initial),
    initialValue: yt(t, t.initial),
    format: Na(t),
    modAmount: La(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Ca(t, n),
      fromEngine: (n) => yt(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : an(rn(t))
  });
}
const mn = Object.freeze(
  [
    ...dt.flatMap((t) => t.parameters.map(Pa)),
    ..._a,
    Ra,
    ...Ma,
    ...Aa,
    ...ka,
    ...da.flatMap(
      (t) => t.parameters.map(
        (e) => Ia(t, e)
      )
    )
  ]
), Fa = new Map(
  mn.map((t) => [t.targetId, t])
), so = mn.filter(
  (t) => t.modulationTargetKind !== null
), Kt = new Map(
  so.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Fa.size !== mn.length)
  throw new Error("Target descriptor IDs must be unique");
if (so.length !== X.length || Kt.size !== X.length || X.some((t) => Kt.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function bt(t) {
  const e = Kt.get(t);
  return e === void 0 ? Zi(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  dt.map((t) => [t.id, t.label])
);
function Ua(t) {
  const e = jr(t);
  return e === 1 ? "" : ` ${e}`;
}
function $a(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const r = bt(t);
    return `${e[1]} ${r.label.toUpperCase()}`;
  }
  const n = ue(t);
  if (n !== null) {
    const r = bt(ln(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${Ua(n)} ${r.label.toUpperCase()}`;
  }
  return bt(t).label.toUpperCase();
}
const J = "modulation.v6", co = 6, Ue = 3, pe = 3, Ba = 4, Ln = "modulationMsegBuffer", Ka = "modulationMsegPlayback", lo = 4, za = ["MSEG 1", "MSEG 2", "MSEG 3"], uo = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], Va = ["Env 1", "Env 2", "Env 3"], ja = 1e-3, O = 10, Ha = 0.1, Wa = 20, Pn = 10 - 0.1, qa = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Wa - Ha },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: no,
    max: ro
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
  mseg1Rate: { min: -ne, max: ne },
  mseg2Rate: { min: -ne, max: ne },
  mseg3Rate: { min: -ne, max: ne },
  env1Attack: { min: -O, max: O },
  env1Decay: { min: -O, max: O },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -O, max: O },
  env2Attack: { min: -O, max: O },
  env2Decay: { min: -O, max: O },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -O, max: O },
  env3Attack: { min: -O, max: O },
  env3Decay: { min: -O, max: O },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -O, max: O },
  ampAttack: { min: -O, max: O },
  ampDecay: { min: -O, max: O },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -O, max: O },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -Pn, max: Pn },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Ga = Lr().filter((t) => t.modulationTargetIndex !== null), Ja = new Map(
  Ga.map((t) => [
    an(rn(t)),
    t
  ])
);
class vt extends Error {
  name = "ModulationStateParseError";
}
const Qa = {
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
  label: Qa[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const Xa = X.map((t) => ({
  value: t.kind,
  label: $a(t.kind)
}));
Xa.filter((t) => !Za(t.value));
function Ya(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function hn(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function It(t, e) {
  const n = Number(t);
  return hn(Number.isFinite(n) ? n : e, ja, O);
}
function Za(t) {
  return cn(t) !== null;
}
function es(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (t.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function ts(t) {
  const e = ue(t);
  return e !== null ? ln(e) : t;
}
function ns(t) {
  const e = ts(t);
  if (ue(e)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = Ja.get(e);
  return n !== void 0 ? es(n) : qa[Ti(e)];
}
function rs(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function os(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function is(t, e) {
  const n = ns(t), r = Number(e);
  return hn(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function as(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function ss(t) {
  return as(t) ?? "mseg";
}
function cs(t) {
  const e = sn(t);
  return e !== null ? e : ue(t) !== null ? t : null;
}
function ls(t) {
  return cs(t) ?? "oscA.wavetablePosition";
}
function us(t, e) {
  const n = uo[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function ds(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const r = t === "mseg" ? Ue : t === "macro" ? lo : Ba;
  return hn(Number.isFinite(n) ? n : 1, 1, r);
}
function ge(t) {
  return {
    name: Va[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function fo(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, r = ge(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: It(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: It(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: ie(n.sustain ?? r.sustain),
    releaseSeconds: It(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function fs(t, e = 0) {
  return { name: fo(t, e).name };
}
function ms(t, e, n, r) {
  const o = Number(t.amount);
  return {
    id: rs(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: ds(n, t.sourceSlot),
    polarity: os(t.polarity),
    targetKind: r,
    amount: is(r, o),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function hs(t, e = 0) {
  const r = t !== null && typeof t == "object" ? t : {}, o = ss(r.sourceKind), i = ls(r.targetKind);
  return ms(r, e, o, i);
}
function ps(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function gs(t) {
  return (Array.isArray(t) ? t : []).map((n, r) => hs(n, r));
}
function ys(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of t) {
    const o = ps(r);
    if (e.has(r.id) || n.has(o))
      return !1;
    e.add(r.id), n.add(o);
  }
  return !0;
}
function zt(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, s) => zt(a, e[s]));
  const n = t, r = e, o = Object.keys(n), i = Object.keys(r);
  return o.length === i.length && o.every((a) => Ya(r, a) && zt(n[a], r[a]));
}
function mo(t, e) {
  const n = t && typeof t == "object" ? t : {}, r = Li(za[e] ?? `MSEG ${e + 1}`), o = Ut(n.shapeA ?? r), i = Ui({
    ...$t(),
    ...n.playback ?? {},
    rate: $t().rate
  }), { rate: a, ...s } = i;
  return {
    shapeA: o,
    shapeB: Ut(n.shapeB ?? o),
    playback: s
  };
}
function Ne() {
  return {
    format: "cosimo.modulation",
    version: co,
    msegSlots: Array.from({ length: Ue }, (t, e) => mo({}, e)),
    envelopeSlots: Array.from({ length: pe }, (t, e) => ({
      name: ge(e).name
    })),
    routes: [],
    macroNames: uo.slice()
  };
}
function bs(t = Ne()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], r = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], o = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: co,
    msegSlots: Array.from({ length: Ue }, (i, a) => mo(n[a], a)),
    envelopeSlots: Array.from({ length: pe }, (i, a) => fs(r[a], a)),
    routes: gs(e.routes),
    macroNames: Array.from(
      { length: lo },
      (i, a) => us(o[a], a)
    )
  };
}
function St(t) {
  const e = rt(t);
  if (e._tag === "err")
    throw e.error;
  return JSON.stringify(e.value);
}
function rt(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return ke(new vt("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return ke(new vt("Expected valid modulation JSON"));
    }
  }
  const n = bs(e);
  return !zt(e, n) || !ys(n.routes) ? ke(new vt("Expected the current modulation schema")) : Ae(n);
}
function vs(t, e) {
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
function Fn(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(Di(n))
  };
}
function Is(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function Vt(t, e = null, n) {
  const r = [];
  for (let o = 0; o < Ue; o += 1) {
    const i = t.msegSlots[o], a = e?.msegSlots[o];
    (a === void 0 || !wn(a.shapeA, i.shapeA)) && r.push(n ? n(o, 0, i.shapeA) : {
      endpointID: Ln,
      value: Fn(o, 0, i.shapeA)
    }), (a === void 0 || !wn(a.shapeB, i.shapeB)) && r.push(n ? n(o, 1, i.shapeB) : {
      endpointID: Ln,
      value: Fn(o, 1, i.shapeB)
    }), (a === void 0 || !Is(a.playback, i.playback)) && r.push({
      endpointID: Ka,
      value: vs(o, i.playback)
    });
  }
  return r.push(...Xi(e?.routes ?? null, t.routes)), r;
}
const Tt = "articulationSnapshot", w = 128, Un = 48, Ss = 1e6, C = -1, Et = [
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
function pn(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function At(t) {
  return pn(Number.isFinite(t) ? t : 0, 0, 1);
}
function L(t, e, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const o = Number(t);
  return pn(Number.isFinite(o) ? o : e, n, r);
}
function D(t, e, n, r) {
  return pn(Math.round(L(t, e)), n, r);
}
function ho(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function Rt() {
  return Array.from({ length: w }, () => C);
}
function Ts(t) {
  const e = D(t, 0, 0, w - 1), n = Et[e % Et.length], r = Math.floor(e / Et.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function Es() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: fn,
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
function As(t) {
  const e = Es(), n = t && typeof t == "object" ? t : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: L(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: L(n.pan, e.pan, -1, 1),
    octave: D(n.octave, e.octave, -4, 4),
    semitone: D(n.semitone, e.semitone, -12, 12),
    fineCents: L(n.fineCents, e.fineCents, -100, 100),
    volumeDb: L(
      n.volumeDb,
      e.volumeDb,
      Bt,
      oo
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
      At(Number(r[0])),
      At(Number(r[1])),
      At(Number(r[2]))
    ]
  };
}
function Rs(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: L(e.amount, 0, -48, 48)
  } : null;
}
function xs(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(Rs).filter((o) => o !== null) : [], r = /* @__PURE__ */ new Map();
  for (const o of n)
    r.set(o.routeId, o);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: As(e.parameters),
    envelopes: [0, 1, 2].map((o) => fo(
      Array.isArray(e.envelopes) ? e.envelopes[o] : void 0,
      o
    )),
    modRouteAmounts: [...r.values()]
  };
}
function Ms(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, r = D(n.runtimeSlot, e, 0, w - 1), o = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, i = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Ts(r);
  return {
    id: o,
    runtimeSlot: r,
    name: i,
    snapshot: xs(n.snapshot)
  };
}
function Os(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(r) ? {
    note: D(n.note, 0, 0, w - 1),
    articulationId: r
  } : null;
}
function ws(t, e, n, r, o) {
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
function $n(t, e, n, r) {
  const o = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < o.length; s += 1) {
    const c = ws(
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
function ks(t, e) {
  const n = Array.isArray(t) ? t : [], r = /* @__PURE__ */ new Set(), o = [];
  for (const i of n) {
    const a = Os(i, e);
    !a || r.has(a.note) || (r.add(a.note), o.push(a));
  }
  return o;
}
function _s(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), i = [];
  for (let c = 0; c < n.length && i.length < w; c += 1) {
    const u = Ms(n[c], c);
    !u || r.has(u.runtimeSlot) || o.has(u.id) || (r.add(u.runtimeSlot), o.add(u.id), i.push(u));
  }
  const a = typeof e.selectedSlotId == "string" && i.some((c) => c.id === e.selectedSlotId) ? e.selectedSlotId : null, s = new Set(i.map((c) => c.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: ho(e.activeTriggerMode),
    slots: i,
    chainAssignments: $n(e.chainAssignments, s, "chain", 0),
    keyAssignments: ks(e.keyAssignments, s),
    velocityAssignments: $n(e.velocityAssignments, s, "velocity", 1)
  };
}
function Bn(t) {
  const e = (n) => A.map(() => n);
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
    volumeDbs: e(fn),
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
    msegMorphs: Array.from({ length: Ue }, () => 0),
    routeAmounts: Array.from({ length: Zr }, () => 0),
    envelopeAttackSeconds: Array.from({ length: pe }, (n, r) => ge(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: pe }, (n, r) => ge(r).decaySeconds),
    envelopeSustain: Array.from({ length: pe }, (n, r) => ge(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: pe }, (n, r) => ge(r).releaseSeconds)
  };
}
function Kn(t, e, n) {
  for (const r of e) {
    const o = n.get(r.articulationId);
    if (o !== void 0)
      for (let i = r.min; i <= r.max; i += 1)
        t[i] === C && (t[i] = o);
  }
}
function Ds(t) {
  const e = _s(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), r = Rt(), o = Rt(), i = Rt();
  Kn(r, e.chainAssignments, n), Kn(i, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || o[a.note] !== C || (o[a.note] = s);
  }
  return i[0] = C, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: r,
    key: o,
    velocity: i
  };
}
function po(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Ds(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: ho(e.activeMode),
    chain: Array.from({ length: w }, (n, r) => D(e.chain?.[r], C, C, w - 1)),
    key: Array.from({ length: w }, (n, r) => D(e.key?.[r], C, C, w - 1)),
    velocity: Array.from({ length: w }, (n, r) => r === 0 ? C : D(e.velocity?.[r], C, C, w - 1))
  });
}
function Cs(t, e) {
  const n = po(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const F = "articulations.v4", gn = [
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
], yn = [
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
], go = [
  ...A.flatMap((t) => gn.map(
    (e) => `osc${t}.${e}`
  )),
  ...yn
];
class yo extends Error {
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
function R(t) {
  return ke(new yo("malformed", t));
}
function $e(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function bn(t, e, n) {
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
function ot(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < w;
}
function Ns(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function Ls(t) {
  return go.some((e) => e === t);
}
function zn(t, e) {
  if (!$e(t))
    return R(`${e} must be an object`);
  const n = bn(t, ["min", "max"], e);
  return n !== null ? R(n) : ot(t.min) ? ot(t.max) ? t.min > t.max ? R(`${e}.min must be less than or equal to ${e}.max`) : Ae({ min: t.min, max: t.max }) : R(`${e}.max must be an integer in 0..127`) : R(`${e}.min must be an integer in 0..127`);
}
function Ps(t, e) {
  if (!$e(t))
    return R(`${e} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return R(`${e} has a non-string parameter id`);
    if (!Ls(r))
      return R(`${e} has unknown parameter id "${r}"`);
    const o = t[r];
    if (typeof o != "number" || !Number.isFinite(o))
      return R(`${e}.${r} must be a finite number`);
    n[r] = o;
  }
  return Ae(n);
}
function bo(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function vo() {
  return {};
}
function Fs(t, e, n) {
  if (!$e(t))
    return R(`${e} must be an object`);
  const r = vo();
  for (const o of Reflect.ownKeys(t)) {
    if (typeof o != "string")
      return R(`${e} has a non-string route id`);
    const i = t[o];
    if (typeof i != "number" || !Number.isFinite(i) || Math.abs(i) > Un)
      return R(
        `${e}.${o} must be a finite route amount within ±${Un}`
      );
    if (!n.has(o))
      return R(`${e}.${o} does not name a current articulable mapping`);
    bo(r, o, i);
  }
  return Ae(r);
}
function Us(t, e, n) {
  const r = `slots[${e}]`;
  if (!$e(t))
    return R(`${r} must be an object`);
  const o = bn(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (o !== null)
    return R(o);
  if (typeof t.id != "string")
    return R(`${r}.id must be a string`);
  if (!ot(t.runtimeSlot))
    return R(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return R(`${r}.name must be a string`);
  if (typeof t.color != "string")
    return R(`${r}.color must be a string`);
  if (!ot(t.key))
    return R(`${r}.key must be an integer in 0..127`);
  const i = zn(t.velRange, `${r}.velRange`);
  if (i._tag === "err")
    return i;
  const a = zn(t.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = Ps(t.overrides, `${r}.overrides`);
  if (s._tag === "err")
    return s;
  const c = Fs(
    t.routeAmounts,
    `${r}.routeAmounts`,
    n
  );
  return c._tag === "err" ? c : Ae({
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
function $s(t) {
  const e = {};
  for (const n of go) {
    if (!Object.hasOwn(t, n))
      continue;
    const r = t[n];
    r !== void 0 && (e[n] = r);
  }
  return e;
}
function Bs(t) {
  const e = vo();
  for (const [n, r] of Object.entries(t))
    bo(e, n, r);
  return e;
}
const Ks = Object.fromEntries(
  gn.map((t, e) => [t, 2 ** e])
), zs = Object.fromEntries(
  yn.map((t, e) => [t, 2 ** e])
);
function Vn(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function Vs(t, e) {
  return gn.reduce((n, r) => Object.hasOwn(t.overrides, `osc${e}.${r}`) ? n | Ks[r] : n, 0);
}
function js(t) {
  return yn.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | zs[n] : e, 0);
}
function Hs(t, e) {
  const n = (i, a) => Vn(t, `osc${i}.${a}`), r = (i) => Vn(t, i), o = Array.from(
    { length: Zr },
    () => Ss
  );
  for (const [i, a] of Object.entries(t.routeAmounts)) {
    const s = e[i];
    s !== void 0 && (o[s] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: A.map((i) => Vs(t, i)),
    sharedOverrideMask: js(t),
    framePositions: A.map((i) => n(i, "framePosition")),
    pans: A.map((i) => n(i, "pan")),
    octaves: A.map((i) => n(i, "octave")),
    semitones: A.map((i) => n(i, "semitone")),
    fineCents: A.map((i) => n(i, "fineCents")),
    phases: A.map((i) => n(i, "phase")),
    phaseRandoms: A.map((i) => n(i, "phaseRandom")),
    retriggers: A.map((i) => n(i, "retrigger")),
    volumeDbs: A.map((i) => n(i, "volumeDb")),
    mutes: A.map((i) => n(i, "mute")),
    solos: A.map((i) => n(i, "solo")),
    warpModes: A.map((i) => n(i, "warpMode")),
    warpAmounts: A.map((i) => n(i, "warpAmount")),
    filterMode: r("filterMode"),
    filterCutoffHz: r("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: r("filterKeyTrackOffsetSemitones"),
    filterQ: r("filterQ"),
    unisonVoices: A.map((i) => n(i, "unisonVoices")),
    unisonDetunes: A.map((i) => n(i, "unisonDetune")),
    unisonBlends: A.map((i) => n(i, "unisonBlend")),
    unisonWidths: A.map((i) => n(i, "unisonWidth")),
    unisonDetuneModes: A.map((i) => n(i, "unisonDetuneMode")),
    unisonStackModes: A.map((i) => n(i, "unisonStackMode")),
    unisonWavetablePositionSpreads: A.map((i) => n(i, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: A.map((i) => n(i, "unisonWarpSpread")),
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
function Io(t, e) {
  return t.slots.map((n) => Hs(n, e));
}
function So(t, e) {
  if (!$e(t))
    return R("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return R('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return ke(new yo(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = bn(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return R(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return R("selectedSlotId must be null or a string");
  if (!Ns(t.activeTriggerMode))
    return R('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return R("slots must be an array");
  if (t.slots.length > w)
    return R(`slots must contain at most ${w} entries`);
  const r = [], o = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const s = Us(t.slots[a], a, e);
    if (s._tag === "err")
      return s;
    const c = s.value;
    if (o.has(c.id))
      return R(`slots[${a}].id duplicates "${c.id}"`);
    if (i.has(c.runtimeSlot))
      return R(`slots[${a}].runtimeSlot duplicates ${c.runtimeSlot}`);
    o.add(c.id), i.add(c.runtimeSlot), r.push(c);
  }
  return t.selectedSlotId !== null && !o.has(t.selectedSlotId) ? R(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : Ae({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: r
  });
}
function jn(t) {
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
      overrides: $s(e.overrides),
      routeAmounts: Bs(e.routeAmounts)
    }))
  };
}
function mt() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Ws(t) {
  const e = Array.from({ length: w }, () => C), n = Array.from({ length: w }, () => C), r = Array.from({ length: w }, () => C);
  for (const o of t.slots) {
    n[o.key] === C && (n[o.key] = o.runtimeSlot);
    for (let i = o.chainRange.min; i <= o.chainRange.max; i += 1)
      e[i] === C && (e[i] = o.runtimeSlot);
    for (let i = o.velRange.min; i <= o.velRange.max; i += 1)
      r[i] === C && (r[i] = o.runtimeSlot);
  }
  return r[0] = C, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: r
  };
}
const To = 13, vn = 5, Eo = 8, qs = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), In = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    U("globalFilter")
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
    U("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    U("ott")
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
    U("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    U("flanger")
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
    U("phaser")
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
    U("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    U("reverb")
  ]
}), Ao = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), Gs = Object.freeze([
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
]), Js = Object.freeze({
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
function Qs(t) {
  return Math.round(t) === 1 ? -5 : Math.round(t) === 2 ? 12 : Math.round(t) === 3 ? -12 : 7;
}
function Ro(t, e) {
  const n = {};
  for (const s of In[t]) {
    const c = e[s];
    if (typeof c == "number" && Number.isFinite(c)) {
      n[s] = c;
      continue;
    }
    const u = Js[s];
    if (u === void 0)
      throw new Error(`Missing lane parameter value: ${t}.${s}`);
    n[s] = u;
  }
  const o = [
    ...Ao.chorus,
    U("chorus")
  ], i = Object.keys(e);
  return t === "chorus" && i.length === o.length && i.every((s) => o.includes(s)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = Qs(
    Number(e.chorusRingOffsetMode)
  ) + Number(e.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function Sn(t) {
  return In[t];
}
function Xs(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= vn)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * Eo + qs[t];
}
function Ys(t, e) {
  const n = new Array(To).fill(0), r = Ro(t, e);
  return In[t].forEach((o, i) => {
    n[i] = r[o];
  }), n;
}
const Ie = "lane.v1", it = "laneTopology", Se = "laneSlotParams", jt = "laneSlotParamValue", xo = "laneOutputControl", Ht = 16, Zs = 8, Mo = 4, ec = 3, Oo = vn * Eo, wo = 4, tc = 4, nc = Oo, rc = Oo + wo, oc = 0, ic = 1, ac = 2, sc = 3, cc = 4, lc = 5;
function uc(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > Mo)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << Zs;
}
const at = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), st = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), ko = new Map(
  Object.entries(st).map(([t, e]) => [e, t])
), dc = Object.freeze({
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
  at.map((t) => [dc[t], t])
);
const fc = Object.freeze([
  "voice.filterCutoff",
  io,
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
]), mc = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [io]: "enhancer-frequency",
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
  fc.map((t) => [t, Object.freeze({
    id: t,
    family: mc[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const _o = 40, Do = 18e3, Wt = at.map((t) => st[t]), hc = /^([a-zA-Z]+)#([1-9][0-9]*)$/, pc = /^(parallel|split)#([1-9][0-9]*)$/;
function Be(t) {
  if (typeof t != "string")
    return null;
  const e = hc.exec(t);
  if (e === null)
    return null;
  const n = Wt.find((o) => o === e[1]);
  if (n === void 0)
    return null;
  const r = Number(e[2]);
  return r > vn ? null : { deviceType: n, instanceNumber: r };
}
function Co(t) {
  if (typeof t != "string")
    return null;
  const e = pc.exec(t);
  if (e === null)
    return null;
  const n = e[1], r = Number(e[2]);
  return r > (n === "parallel" ? wo : tc) ? null : { groupKind: n, unitNumber: r };
}
function oe(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function ve(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((r) => typeof r == "string" && e.includes(r));
}
function M(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function gc(t, e) {
  const n = Be(t);
  if (n === null)
    return { failure: M(`device id ${t} is not a pool instance`) };
  if (!oe(e) || !ve(e, ["params"]) || !oe(e.params))
    return { failure: M(`device ${t} must be { params }`) };
  const r = Sn(n.deviceType), o = ko.get(n.deviceType);
  if (o === void 0)
    return { failure: M(`device ${t} has no effect descriptor`) };
  const i = Nr(o).parameters.map((f) => f.endpointID), a = e.params, s = Object.keys(a), c = (f) => s.length === f.length && s.every((p) => f.includes(p)), u = U(n.deviceType), l = [
    ...Ao[n.deviceType],
    u
  ], m = [
    ...Gs,
    u
  ];
  if (!(s.includes(u) && (c(r) || c(i) || c(l) || n.deviceType === "chorus" && c(m))))
    return { failure: M(`device ${t} must carry every parameter once`) };
  for (const f of s) {
    const p = a[f];
    if (typeof p != "number" || !Number.isFinite(p))
      return { failure: M(`device ${t}.${f} must be a finite number`) };
  }
  return { record: { params: Ro(n.deviceType, a) } };
}
function yc(t, e) {
  return !oe(t) || t.kind !== "device" ? { failure: M("branches may hold device placements only") } : ve(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: M(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: M(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: M("a device placement is { kind, deviceId, enabled }") };
}
function Hn(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= _o && t <= Do;
}
function No() {
  return { mix: 1, bypassed: !1 };
}
function bc(t) {
  return !oe(t) || !ve(t, ["mix", "bypassed"]) || typeof t.mix != "number" || !Number.isFinite(t.mix) || t.mix < 0 || t.mix > 1 || typeof t.bypassed != "boolean" ? null : { mix: t.mix, bypassed: t.bypassed };
}
function vc(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (l) {
      const m = l instanceof Error ? l.message : String(l);
      return M(`is not valid JSON: ${m}`);
    }
  if (!oe(e) || !ve(e, ["format", "version", "output", "devices", "chain"]))
    return M("must be { format, version, output, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return M("must be cosimo.lane version 2");
  if (!oe(e.devices))
    return M("devices must be an object");
  if (!Array.isArray(e.chain))
    return M("chain must be an array");
  const n = bc(e.output);
  if (n === null)
    return M("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const l of Reflect.ownKeys(e.devices)) {
    if (typeof l != "string")
      return M("device ids must be strings");
    const m = gc(l, e.devices[l]);
    if ("failure" in m)
      return m.failure;
    r[l] = m.record;
  }
  const o = new Set(Object.keys(r)), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let c = 0;
  const u = (l) => {
    const m = yc(l, o);
    return "placement" in m && (i.set(
      m.placement.deviceId,
      (i.get(m.placement.deviceId) ?? 0) + 1
    ), c += 1), m;
  };
  for (const l of e.chain) {
    if (!oe(l))
      return M("chain nodes must be objects");
    if (l.kind === "device") {
      const h = u(l);
      if ("failure" in h)
        return h.failure;
      s.push(h.placement);
      continue;
    }
    if (l.kind !== "parallel" && l.kind !== "split")
      return M(`unknown chain node kind ${String(l.kind)}`);
    const m = l.kind === "split", d = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], p = m ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], g = m && ve(l, d);
    if (!ve(l, p) && !g)
      return M(`a ${l.kind} group is { ${p.join(", ")} }`);
    const b = Co(l.groupId);
    if (b === null || b.groupKind !== l.kind)
      return M(`group id ${String(l.groupId)} does not name a ${l.kind} unit`);
    if (a.has(String(l.groupId)))
      return M(`group ${String(l.groupId)} is used twice`);
    if (a.add(String(l.groupId)), typeof l.enabled != "boolean")
      return M(`group ${String(l.groupId)} needs a boolean enable`);
    const S = m ? ec : Mo;
    if (!Array.isArray(l.branches) || l.branches.length < 2 || l.branches.length > S)
      return M(`group ${String(l.groupId)} needs 2..${S} branches`);
    if (m && (!Hn(l.xoverLowHz) || !Hn(l.xoverHighHz)))
      return M(`group ${String(l.groupId)} crossovers must sit in ${_o}..${Do} Hz`);
    if (m && !g && (typeof l.xoverLowKeyTrackEnabled != "boolean" || typeof l.xoverHighKeyTrackEnabled != "boolean" || typeof l.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverLowKeyTrackOffsetSemitones) || typeof l.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverHighKeyTrackOffsetSemitones)))
      return M(`group ${String(l.groupId)} Key Track state must be finite`);
    c += 1;
    const E = [];
    for (const h of l.branches) {
      if (!Array.isArray(h))
        return M(`group ${String(l.groupId)} branches must be arrays`);
      const y = [];
      for (const T of h) {
        const x = u(T);
        if ("failure" in x)
          return x.failure;
        y.push(x.placement);
      }
      E.push(y);
    }
    s.push(m ? {
      kind: "split",
      groupId: String(l.groupId),
      enabled: l.enabled,
      xoverLowHz: l.xoverLowHz,
      xoverHighHz: l.xoverHighHz,
      xoverLowKeyTrackEnabled: g ? !1 : l.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: g ? 0 : l.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: g ? !1 : l.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: g ? 0 : l.xoverHighKeyTrackOffsetSemitones,
      branches: E
    } : {
      kind: "parallel",
      groupId: String(l.groupId),
      enabled: l.enabled,
      branches: E
    });
  }
  for (const l of o)
    if ((i.get(l) ?? 0) !== 1)
      return M(`device ${l} must be placed exactly once`);
  return c > Ht ? M(`flattens to ${c} wire entries; the topology upload holds ${Ht}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: s } };
}
function Ic() {
  const t = {};
  for (const e of at) {
    const n = st[e];
    t[`${n}#1`] = {
      params: xc(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: No(),
    devices: t,
    chain: at.map((e) => ({
      kind: "device",
      deviceId: `${st[e]}#1`,
      enabled: !1
    }))
  };
}
const Wn = ["distortion#1", "delay#1", "reverb#1"];
function Tn() {
  const t = Ic(), e = {};
  for (const n of Wn) {
    const r = t.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    e[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: No(),
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && Wn.includes(n.deviceId))
  };
}
function Sc(t) {
  if (t === void 0)
    return Tn();
  const e = vc(t);
  return e._tag === "ok" ? e.value : null;
}
function xt(t) {
  return JSON.stringify({
    format: "cosimo.lane",
    version: 2,
    output: t.output,
    devices: t.devices,
    chain: t.chain
  });
}
function Tc(t) {
  return Object.keys(t.devices).map((e) => {
    const n = Be(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => Wt.indexOf(e.parsed.deviceType) - Wt.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function qt(t) {
  const e = Be(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return Xs(e.deviceType, e.instanceNumber - 1);
}
function Lo(t) {
  const e = Co(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? nc : rc) + (e.unitNumber - 1);
}
function Po(t) {
  const e = new Array(Ht).fill(0);
  let n = 0, r = 0;
  const o = (i, a, s) => {
    e[r] = uc(i, a), s && (n |= 1 << r), r += 1;
  };
  for (const i of t.chain) {
    if (i.kind === "device") {
      o(qt(i.deviceId), 0, i.enabled);
      continue;
    }
    o(Lo(i), i.branches.length, i.enabled), i.branches.forEach((a, s) => {
      for (const c of a)
        o(qt(c.deviceId), s + 1, c.enabled);
    });
  }
  return { chainLength: r, slotIds: e, enabledMask: n };
}
function Ec(t) {
  const e = new Array(To).fill(0);
  return e[oc] = t.xoverLowHz, e[ic] = t.xoverHighHz, e[ac] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[sc] = t.xoverLowKeyTrackOffsetSemitones, e[cc] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[lc] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function En(t) {
  const e = [{
    endpointID: xo,
    value: t.output
  }];
  let n = 0;
  for (const r of Tc(t)) {
    const o = Be(r.instanceId);
    if (o === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    e.push({
      endpointID: tn(
        o.deviceType,
        o.instanceNumber
      ),
      value: t.devices[r.instanceId].params[U(o.deviceType)]
    }), n += 1, e.push({
      endpointID: Se,
      value: {
        slotId: qt(r.instanceId),
        deliverySerial: n,
        values: Ys(
          r.deviceType,
          t.devices[r.instanceId].params
        )
      }
    });
  }
  for (const r of t.chain)
    r.kind === "split" && (n += 1, e.push({
      endpointID: Se,
      value: {
        slotId: Lo(r),
        deliverySerial: n,
        values: Ec(r)
      }
    }));
  return e.push({
    endpointID: it,
    value: Po(t)
  }), e;
}
function Ac(t, e, n, r) {
  const o = t.devices[e], i = Be(e);
  if (o === void 0 || i === null || !Sn(i.deviceType).includes(n) || !Number.isFinite(r))
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
function Rc(t, e) {
  let n = t;
  for (const [r, o] of Object.entries(e)) {
    const i = _r(r);
    if (i === null || typeof o != "number" || !Number.isFinite(o))
      continue;
    const a = `${i.deviceType}#${i.instanceNumber}`;
    if (n.devices[a] === void 0)
      continue;
    const s = Math.min(
      35,
      Math.max(-100, o)
    );
    Object.is(n.devices[a]?.params[i.laneEndpointID], s) || (n = Ac(
      n,
      a,
      i.laneEndpointID,
      s
    ) ?? n);
  }
  return n;
}
function xc(t) {
  const e = ko.get(t);
  if (e === void 0)
    throw new Error(`Unknown lane device type: ${t}`);
  const n = Nr(e).parameters;
  return Object.fromEntries(Sn(t).map((r) => [
    r,
    n.find((o) => o.endpointID === r)?.initial ?? 0
  ]));
}
async function qn(t) {
  const e = [];
  for (const n of [...t].reverse())
    try {
      await n.stop?.();
    } catch (r) {
      e.push(r);
    }
  return e;
}
async function Mc(t, e) {
  const n = [];
  try {
    for (const o of e) {
      const i = await o(t);
      n.push(i), await i.start();
    }
  } catch (o) {
    const i = await qn(n);
    throw i.length > 0 ? new AggregateError([o, ...i], "A patch worker service failed to start, and stopping the others also failed.") : o;
  }
  let r = !1;
  return {
    async stop() {
      if (r) return;
      r = !0;
      const o = await qn(n.splice(0));
      if (o.length > 0) throw new AggregateError(o, "Some patch worker services failed to stop.");
    }
  };
}
const Gt = "runtimeState";
function Fo(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const Gn = "runtimeInstallAck", Uo = "runtimeSyncRequest", Jt = 0, Oc = 8e3, ct = /* @__PURE__ */ new WeakMap(), $o = 1e9;
let Ve = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % $o;
function wc(t) {
  return Ve = Ve % $o + 1, t === "modulation" ? -1e9 - Ve : 1e9 + Ve;
}
function kc(t, e) {
  const n = t, r = ct.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  r.add(e), ct.set(n, r);
}
function Jn(t, e) {
  const n = t, r = ct.get(n);
  r?.delete(e), r?.size === 0 && ct.delete(n);
}
const _c = [100, 250, 500, 1e3], je = { _tag: "accepted" }, Dc = { _tag: "superseded" }, Cc = { _tag: "stopped" }, Qn = { _tag: "transport-timeout" };
function Nc(t) {
  const e = t && typeof t == "object" && "event" in t ? t.event : t, n = e && typeof e == "object" && "value" in e ? e.value : e;
  if (!n || typeof n != "object")
    return null;
  const r = n, o = r.dspSessionId, i = r.acceptedModulationSerial, a = r.acceptedArticulationSerial, s = r.rejectedSerial, c = r.rejectionReason, u = r.syncSerial;
  return ![
    o,
    i,
    a,
    s,
    c,
    u
  ].every((m) => typeof m == "number" && Number.isSafeInteger(m) && m >= -2147483648 && m <= 2147483647) || typeof o != "number" || typeof i != "number" || typeof a != "number" || typeof s != "number" || typeof c != "number" || typeof u != "number" || o < 0 || i < 0 || a > 0 || c < 0 ? null : {
    dspSessionId: o,
    acceptedModulationSerial: i,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: c,
    syncSerial: u
  };
}
function Lc(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class Xn {
  #o;
  #n;
  #s;
  #l;
  #h = !1;
  #d = /* @__PURE__ */ new Set();
  #t = null;
  #i = null;
  #c = /* @__PURE__ */ new Set();
  #e = null;
  #f = 0;
  #a = /* @__PURE__ */ new Map();
  #m = 0;
  #r = !1;
  #u = 0;
  #g = /* @__PURE__ */ new Set();
  #T = this.#w.bind(this);
  constructor(e, n) {
    this.#o = e, this.#n = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((o) => Math.max(0, Math.trunc(o))).filter((o) => Number.isFinite(o));
    this.#s = r && r.length > 0 ? r : [..._c], this.#l = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Oc)
    );
  }
  start() {
    if (!this.#r) {
      kc(this.#o, this.#n);
      try {
        this.#m += 1, this.#r = !0, this.#i = null, this.#c.clear(), this.#o.addEndpointListener?.(Gn, this.#T);
      } catch (e) {
        throw this.#r = !1, Jn(this.#o, this.#n), e;
      }
    }
  }
  stop() {
    if (this.#r) {
      this.#r = !1;
      for (const e of this.#d) e();
      this.#o.removeEndpointListener?.(Gn, this.#T), Jn(this.#o, this.#n), this.#a.clear(), this.#i = null, this.#c.clear(), this.#S();
    }
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    if (n !== this.#t) {
      for (const r of this.#d) r();
      this.#t = n, this.#i = null, this.#c.clear(), this.#e?.dspSessionId !== n && (this.#e = null), this.#a.clear(), this.#u += 1, this.#S();
    }
  }
  getAcceptedFrontier() {
    return this.#e?.dspSessionId !== this.#t ? 0 : this.#n === "modulation" ? this.#e.acceptedModulationSerial : this.#e.acceptedArticulationSerial;
  }
  getLatestAck() {
    return this.#e ? { ...this.#e } : null;
  }
  hasSessionBaseline() {
    return this.#t !== null && this.#i === this.#t;
  }
  async waitForSessionBaseline() {
    const e = this.#t, n = this.#m;
    return this.#r ? e === null ? {
      _tag: "unavailable",
      reason: "no-runtime-session"
    } : this.#E(e, n) : {
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
    const n = this.#t, r = this.#m;
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
        if (s._tag === "rejected" && this.#n === "articulation") {
          i ??= s;
          continue;
        }
        if (s._tag !== "accepted")
          return s;
      }
      return i ?? je;
    } finally {
      this.#h = !1;
    }
  }
  #A(e) {
    return this.#n === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #R(e, n) {
    const r = this.#A(e);
    return this.#n === "modulation" ? r >= n : r <= n;
  }
  #x() {
    const e = this.getAcceptedFrontier();
    return this.#n === "modulation" ? e + 1 : e - 1;
  }
  async #E(e, n) {
    if (this.#i === e)
      return je;
    const r = wc(this.#n);
    this.#c.add(r);
    const o = Date.now() + this.#l;
    let i = 0;
    try {
      for (; ; ) {
        const a = this.#p(e, n);
        if (a)
          return a;
        if (this.#i === e)
          return je;
        const s = o - Date.now();
        if (s <= 0)
          return Qn;
        const c = this.#u;
        this.#v(r), await this.#I(
          c,
          Math.min(this.#b(i), s)
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
    const u = async () => {
      this.#p(n, r) || ("submit" in e ? await e.submit({ dspSessionId: n, deliverySerial: o, signal: c }) : this.#O(e.endpointID, Lc(e.value, n, o)));
    };
    try {
      let l = 0, m = 0, d = this.#f;
      for (await u(); ; ) {
        const f = this.#p(n, r);
        if (f)
          return f;
        const p = this.#y(n, o, d);
        if (p !== null)
          return p;
        const g = this.#u;
        await this.#I(
          g,
          this.#b(l)
        );
        const b = this.#y(
          n,
          o,
          d
        );
        if (b !== null)
          return b;
        let S = this.#u;
        for (this.#v(o); ; ) {
          const E = this.#p(n, r);
          if (E)
            return E;
          const h = await this.#I(
            S,
            this.#b(l)
          ), y = this.#y(
            n,
            o,
            d
          );
          if (y !== null)
            return y;
          if (h && this.#e?.dspSessionId === n && this.#e.syncSerial === o) {
            if (m >= 1)
              return Qn;
            d = this.#f, await u(), m += 1, l += 1;
            break;
          }
          if (h) {
            S = this.#u;
            continue;
          }
          h || (l += 1, S = this.#u, this.#v(o));
        }
      }
    } catch (l) {
      const m = this.#p(n, r);
      if (m) return m;
      throw l;
    } finally {
      s(), this.#d.delete(s);
    }
  }
  #y(e, n, r) {
    const o = this.#e;
    if (!o || o.dspSessionId !== e)
      return null;
    const i = this.#a.get(n);
    return i !== void 0 && i.version > r && i.acknowledgement.dspSessionId === e ? (this.#a.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...i.acknowledgement }
    }) : this.#R(o, n) ? (this.#a.delete(n), je) : null;
  }
  #p(e, n) {
    return !this.#r || this.#m !== n ? Cc : this.#t !== e ? Dc : null;
  }
  #b(e) {
    return this.#s[Math.min(
      e,
      this.#s.length - 1
    )];
  }
  #O(e, n) {
    try {
      this.#o.sendEventOrValue?.(
        e,
        n,
        void 0,
        Jt
      );
    } catch {
    }
  }
  #v(e) {
    if (this.#r)
      try {
        this.#o.sendEventOrValue?.(
          Uo,
          e,
          void 0,
          Jt
        );
      } catch {
      }
  }
  #w(e) {
    const n = Nc(e);
    if (!n || this.#t !== null && n.dspSessionId !== this.#t || this.#i === n.dspSessionId && this.#e?.dspSessionId === n.dspSessionId && (n.acceptedModulationSerial < this.#e.acceptedModulationSerial || n.acceptedArticulationSerial > this.#e.acceptedArticulationSerial))
      return;
    if (this.#c.has(n.syncSerial) && (this.#i = n.dspSessionId), this.#e = n, this.#f += 1, this.#n === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#a.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#f
      }); this.#a.size > 16; ) {
        const o = this.#a.keys().next().value;
        if (o === void 0) break;
        this.#a.delete(o);
      }
    this.#u += 1, this.#S();
  }
  #I(e, n) {
    return !this.#r || this.#u !== e ? Promise.resolve(!0) : new Promise((r) => {
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
const Pc = 1e3, Fc = [J, F];
function Yn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Mt(t, e) {
  const n = t && typeof t == "object" ? t : {}, r = n.values && typeof n.values == "object" ? n.values : {};
  if (Yn(r, e)) return r[e];
  if (Yn(n, e)) return n[e];
}
function Ot(t, e) {
  if (t === void 0) return mt();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = So(n, e);
  return r._tag === "ok" ? r.value : null;
}
function Zn(t) {
  return new Set(t.routes.flatMap((e) => dn(e) === null ? [] : [e.id]));
}
function er(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
function tr(t, e) {
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
class Bo {
  constructor(e, n) {
    this.connection = e, this.frameworkInput = n, this.modulationLane = new Xn(e, { laneKind: "modulation" }), this.articulationLane = new Xn(e, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = Ne();
  articulationBank = mt();
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
    return this.frameworkInput ? [F] : Fc;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Gt, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Gt, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
    const n = Mt(e, J), r = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: Ne() } : rt(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${J} is invalid; boot state was not installed.`);
      const a = Mt(e, F), s = Ot(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const o = Mt(e, F), i = Ot(
      o,
      Zn(r.value)
    );
    if (i === null) {
      console.error(`[runtime-state-worker] ${F} is invalid; boot state was not installed.`);
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
      const o = rt(n);
      if (o._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${J}.`);
        return;
      }
      this.modulationState = o.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = Ot(n, Zn(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${F}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = Fo(e);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(Uo, 0, void 0, Jt), this.hasRuntimeState || this.scheduleRecovery());
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
    const e = this.lifecycleEpoch, n = this.runtimeGeneration, r = this.modulationState, o = this.articulationBank, i = this.deliveryObserver, s = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, c = this.frameworkInput?.curveCommand ? Vt(r, s, this.frameworkInput.curveCommand) : Vt(r, s), u = await this.modulationLane.sendBatch(c);
    if (!this.started || e !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", u, r)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const b = tr("modulation", u);
      b && i?.(b), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = r, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, r, o)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const l = this.buildUploadsBySelector(r, o), m = Array.from({ length: w }, (b, S) => {
      const E = l.get(S);
      return E ? er(E) : null;
    }), d = this.lastAppliedArticulationGeneration !== n, f = d && this.articulationLane.getAcceptedFrontier() !== 0, p = [];
    for (let b = 0; b < w; b += 1) {
      const S = l.get(b), E = m[b] !== this.lastAppliedArticulationTokens[b];
      f ? p.push({
        endpointID: Tt,
        value: S ?? Bn(b)
      }) : d ? S && p.push({ endpointID: Tt, value: S }) : E && p.push({
        endpointID: Tt,
        value: S ?? Bn(b)
      });
    }
    const g = await this.articulationLane.sendBatch(p);
    if (!(!this.started || e !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", g, m)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = m;
        const b = Ws(o);
        if (this.frameworkInput) {
          const S = await this.frameworkInput.publishTriggerConfig(b);
          if (!this.started || e !== this.lifecycleEpoch) return;
          S.kind !== "cancelled" && i?.(S);
        } else
          Cs(b, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const S of p) this.lastAppliedArticulationTokens[S.value.selectorA] = void 0;
        const b = tr("articulation", g);
        b && i?.(b);
      }
      this.finishDelivery();
    }
  }
  desiredStateChanged(e, n, r) {
    return e !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const r = Object.fromEntries(e.routes.flatMap((o) => {
      const i = dn(o);
      return i === null ? [] : [[o.id, i]];
    }));
    return new Map(
      Io(n, r).map((o) => [o.selectorA, o])
    );
  }
  acceptOutcome(e, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const o = er(r), i = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== o;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, o), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), i && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Pc));
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
function Uc(t) {
  return new Bo(t);
}
const $c = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function Bc(t) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(t) && !t.includes("__") && !$c.has(t);
}
function Kc(t) {
  return typeof t == "object" && t !== null && "kind" in t && t.kind === "preparation-error" && "error" in t && typeof t.error == "object" && t.error !== null && "kind" in t.error && t.error.kind === "resource" && "message" in t.error && typeof t.error.message == "string";
}
const Ko = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-check"), zo = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-initial");
function v(t, e = {}) {
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
function nr(t) {
  const e = ae({ codec: t.codec, initial: t.initial, lifetime: t.lifetime, history: t.history, preset: t.preset }), n = Object.freeze([...t.dependencies ?? []]);
  if ("kind" in t.engine && t.engine.kind === "shared-data") {
    const i = t.engine, a = t.prepare, s = t.prepare, c = i.length;
    return Object.freeze({ ...e, engine: Object.freeze({
      kind: "shared-prepared",
      dependencies: n,
      storage: Object.freeze({ type: i.type, fixedLength: c ?? null }),
      prepare: c === void 0 ? s : (u, l) => ({
        length: c,
        write: (m) => a(u, m, l)
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
const zc = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.options");
function Vc(t) {
  return Object.keys(t).filter((e) => t[e]?.kind === "stored" && t[e].engine?.kind === "shared-prepared").sort().map((e, n) => ({ key: e, input: n }));
}
function jc(t) {
  return Object.keys(t).filter((e) => t[e]?.preset !== !1);
}
function Hc(t, e = {}) {
  if (e.historyLimit !== void 0 && (!Number.isSafeInteger(e.historyLimit) || e.historyLimit < 0))
    throw new Error("historyLimit must be a non-negative integer.");
  const n = Vc(t);
  if (n.length && (!Number.isSafeInteger(e.memoryBudgetBytes) || (e.memoryBudgetBytes ?? 0) < 4))
    throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
  if (n.some(({ key: i }) => !Bc(i) || i === "Data"))
    throw new Error("Shared state names must be valid Cmajor identifiers.");
  const r = /* @__PURE__ */ new Map();
  for (const [i, a] of Object.entries(t)) {
    if (a.kind !== "parameter") continue;
    const s = r.get(a.endpoint);
    if (s !== void 0)
      throw new Error(`Fields "${s}" and "${i}" both declare parameter "${a.endpoint}". Declare each host parameter once.`);
    r.set(a.endpoint, i);
  }
  for (const i of Object.values(t)) i.kind === "stored" && i[Ko]?.(t);
  const o = { ...t };
  for (const [i, a] of Object.entries(t)) {
    const s = a.kind === "stored" ? a[zo] : void 0;
    s && (o[i] = Object.freeze({ ...a, initial: s(t) }));
  }
  return Object.freeze(Object.defineProperty(o, zc, { value: Object.freeze({ ...e }) }));
}
function z(t) {
  throw new Error(t);
}
function wt(t, e, n) {
  let r = "";
  for (let o = 0; o < n; o += 1) r += String.fromCharCode(t.getUint8(e + o));
  return r;
}
function rr(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function Wc(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function or(t, e) {
  return typeof e == "string" ? Wc(e) : e instanceof ArrayBuffer ? new Uint8Array(e.slice(0)) : ArrayBuffer.isView(e) ? new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength)) : Array.isArray(e) ? Uint8Array.from(e) : z(`The host returned ${t} in a form this kit cannot read.`);
}
function ir(t, e) {
  const n = new DataView(e);
  (n.byteLength < 12 || wt(n, 0, 4) !== "RIFF" || wt(n, 8, 4) !== "WAVE") && z(`${t} is not a WAV file.`);
  let r = 0, o = 0, i = 0, a = 0, s = -1, c = 0;
  for (let l = 12; l + 8 <= n.byteLength; ) {
    const m = wt(n, l, 4), d = n.getUint32(l + 4, !0), f = l + 8;
    m === "fmt " ? (r = n.getUint16(f, !0), o = n.getUint16(f + 2, !0), i = n.getUint32(f + 4, !0), a = n.getUint16(f + 14, !0)) : m === "data" && (s = f, c = Math.min(d, n.byteLength - f)), l = f + d + d % 2;
  }
  (s < 0 || r === 0) && z(`${t} is missing its WAV format or data chunk.`), o !== 1 && z(`${t} has ${o} channels; readAudio reads mono WAV files only.`);
  const u = e.slice(s, s + c);
  if (r === 3 && a === 32) return { sampleRate: i, samples: new Float32Array(u, 0, Math.floor(c / 4)) };
  if (r === 1 && a === 16) {
    const l = new Int16Array(u, 0, Math.floor(c / 2));
    return { sampleRate: i, samples: Float32Array.from(l, (m) => m / 32768) };
  }
  return z(`${t} uses WAV format ${r} at ${a} bits; use 16-bit PCM or 32-bit float.`);
}
function qc(t, e) {
  const n = e ?? {}, r = n.frames;
  (!r || typeof r.length != "number") && z(`The host decoded ${t} without audio frames.`);
  const o = new Float32Array(r.length);
  for (let i = 0; i < r.length; i += 1) {
    const a = r[i];
    typeof a == "number" ? o[i] = a : a && a.length === 1 ? o[i] = Number(a[0]) || 0 : z(`${t} is not mono; readAudio reads mono audio only.`);
  }
  return { sampleRate: Number(n.sampleRate) || 0, samples: o };
}
function ar() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0) return new URL("/", t);
  const e = new URL(import.meta.url);
  return e.pathname = e.pathname.replace(/\/[^/]*$/, "/"), e;
}
function sr(t, e) {
  return e instanceof URL ? e : typeof e == "string" && e.length > 0 ? /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e) ? new URL(e) : new URL(e.replace(/^\//, ""), ar()) : new URL(t, ar());
}
function Gc(t) {
  const e = t ?? {}, n = async (o) => {
    typeof fetch != "function" && z(`Cannot read ${o}: this host has neither a resource bridge nor fetch.`);
    const i = sr(o, e.getResourceAddress?.(o)), a = await fetch(i.toString());
    return a.ok || z(`Could not read ${o} from ${i} (HTTP ${a.status}).`), a.arrayBuffer();
  }, r = async (o) => e.readResource ? or(o, await e.readResource(o)) : new Uint8Array(await n(o));
  return {
    async readText(o) {
      if (!e.readResource) return rr(new Uint8Array(await n(o)));
      const i = await e.readResource(o);
      return typeof i == "string" ? i : typeof i == "object" && i !== null && "text" in i && typeof i.text == "function" ? String(await i.text()) : rr(or(o, i));
    },
    async readJSON(o) {
      return JSON.parse(await this.readText(o));
    },
    readBytes: r,
    async readAudio(o) {
      const i = e.getResourceAddress?.(o);
      return i != null && typeof fetch == "function" ? ir(o, await n(o)) : e.readResourceAsAudioData ? qc(o, await e.readResourceAsAudioData(o)) : ir(o, new Uint8Array(await r(o)).buffer);
    },
    getURL(o) {
      return sr(o, e.getResourceAddress?.(o));
    }
  };
}
const Te = (t) => ({ kind: "ok", value: t }), Le = (t) => ({ kind: "error", message: t }), se = (t) => typeof t == "object" && t !== null && !Array.isArray(t);
function lt(t) {
  if (t === null || typeof t == "boolean" || typeof t == "string") return t;
  if (typeof t == "number") return Number.isFinite(t) ? t : void 0;
  if (Array.isArray(t)) {
    const r = [];
    for (const o of t) {
      const i = lt(o);
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
    const i = lt(o);
    if (i === void 0) return;
    n[r] = i;
  }
  return Object.freeze(n);
}
function Pe(t, e) {
  if (Object.is(t, e)) return !0;
  if (Array.isArray(t) || Array.isArray(e))
    return Array.isArray(t) && Array.isArray(e) && t.length === e.length && t.every((i, a) => Pe(i, e[a]));
  if (!se(t) || !se(e)) return !1;
  const n = t, r = e, o = Object.keys(n);
  return o.length === Object.keys(r).length && o.every((i) => Object.hasOwn(r, i) && Pe(n[i], r[i]));
}
function Jc(t) {
  const e = se(t) ? lt(t) : void 0;
  return e !== void 0 && se(e) ? Te(e) : Le("Preset values must be an object of JSON values.");
}
function Vo(t) {
  if (!se(t) || typeof t.id != "string" || t.id.length === 0 || typeof t.name != "string" || t.name.trim().length === 0)
    return Le("A preset needs a non-empty id and name.");
  const e = Jc(t.values);
  return e.kind === "ok" ? Te(Object.freeze({ id: t.id, name: t.name, values: e.value })) : e;
}
const Qc = {
  parse(t) {
    if (!se(t) || t.version !== 1 || !Array.isArray(t.presets)) return Le("Expected a version 1 preset library.");
    const e = [];
    for (const n of t.presets) {
      const r = Vo(n);
      if (r.kind === "error") return r;
      if (e.some((o) => o.id === r.value.id)) return Le(`Preset id "${r.value.id}" appears twice.`);
      e.push(r.value);
    }
    return Te(Object.freeze({ version: 1, presets: Object.freeze(e) }));
  },
  encode: (t) => t,
  equals: (t, e) => Pe(t, e)
}, cr = {
  parse: (t) => t === null ? Te(null) : Vo(t),
  encode: (t) => t,
  equals: (t, e) => Pe(t, e)
};
function jo(t, e) {
  if (t.kind === "parameter")
    return typeof e == "number" && Number.isFinite(e) ? Te(e) : Le("Expected a finite number.");
  const n = t.codec.parse(e);
  return n.kind === "ok" ? Te(t.codec.encode(n.value)) : n;
}
function Xc(t, e, n) {
  if (e !== void 0 && !t.some((i) => i.id === e))
    throw new Error(`The initial preset "${e}" is not a factory preset. Use the id of one of the factory presets.`);
  const r = jc(n), o = /* @__PURE__ */ new Set();
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
      const c = jo(s, i.values[a]);
      if (c.kind === "error") throw new Error(`Factory preset "${i.name}" has an invalid value for "${a}": ${c.message}`);
    }
  }
}
function Yc(t = {}) {
  const e = Object.freeze((t.factory ?? []).map((a) => Object.freeze({ ...a, values: Object.freeze({ ...a.values }) }))), { initial: n } = t, r = Object.freeze({
    ...ae({ codec: Qc, initial: { version: 1, presets: [] }, lifetime: "user", preset: !1 }),
    factory: e,
    [Ko]: (a) => Xc(e, n, a)
  }), o = ae({ codec: cr, initial: null, preset: !1 }), i = e.find((a) => a.id === n);
  return {
    presetLibrary: r,
    // The initial preset's values are saved in each field's encoded form, which needs the whole definition.
    activePreset: i === void 0 ? o : Object.freeze({
      ...o,
      [zo]: (a) => cr.parse({ id: i.id, name: i.name, values: Zc(a, i) })
    })
  };
}
const lr = /* @__PURE__ */ new WeakMap();
function Zc(t, e) {
  let n = lr.get(e);
  if (!n) {
    const r = {};
    for (const [o, i] of Object.entries(e.values)) {
      const a = t[o], s = a && jo(a, i);
      s?.kind === "ok" && (r[o] = s.value);
    }
    n = Object.freeze(r), lr.set(e, n);
  }
  return n;
}
const el = Object.freeze(["A", "B", "C", "D", "E", "F", "G"]);
function tl(t) {
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
        const i = typeof o == "object" ? lt(Reflect.get(o, "values")) : void 0;
        if (typeof i != "object" || i === null || Array.isArray(i)) return { kind: "error", message: `Snapshot ${r} has invalid values.` };
        n[r] = Object.freeze({ values: i });
      }
      return { kind: "ok", value: Object.freeze(n) };
    },
    encode: (e) => e,
    equals: (e, n) => Pe(e, n)
  };
}
function nl(t) {
  return {
    // A slot that no longer exists is simply no longer active.
    parse: (e) => e === null || typeof e == "string" ? { kind: "ok", value: typeof e == "string" && t.includes(e) ? e : null } : { kind: "error", message: "Expected a snapshot slot name or null." },
    encode: (e) => e,
    equals: Object.is
  };
}
function rl(t = {}) {
  const e = Object.freeze([...t.slots ?? el]);
  if (e.length === 0 || e.some((r) => typeof r != "string" || r.length === 0) || new Set(e).size !== e.length)
    throw new Error("Snapshot slots must be distinct, non-empty names.");
  const n = Object.fromEntries(e.map((r) => [r, null]));
  return {
    snapshotSlots: Object.freeze({ ...ae({ codec: tl(e), initial: n, history: !1, preset: !1 }), slots: e }),
    activeSnapshot: ae({ codec: nl(e), initial: null, preset: !1 })
  };
}
function Ho(t) {
  if (!(t === null || typeof t != "object")) {
    for (const e of Object.values(t)) Ho(e);
    Object.freeze(t);
  }
}
const ol = {
  parse(t) {
    const e = rt(t);
    return e._tag === "err" ? { kind: "error", message: e.error.message } : (Ho(e.value), { kind: "ok", value: e.value });
  },
  encode: St,
  equals: (t, e) => St(t) === St(e)
}, il = [
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
], al = [
  { id: "A", oscillatorIndex: 0 },
  { id: "B", oscillatorIndex: 1 },
  { id: "C", oscillatorIndex: 2 }
];
function sl(t) {
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
function cl(t, e, n) {
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
function ll(t, e, n) {
  const r = `osc${t}.${n}`;
  return Object.freeze({
    parameterKind: n,
    targetKind: r,
    // SAFETY: the oscillator and target suffix are both closed canonical
    // unions, so the interpolated ID belongs to the UI target domain.
    uiTargetID: `osc${t}.${sl(n)}`,
    runtimeTargetIndex: Kr(r),
    oscillatorIndex: e
  });
}
function ul(t, e) {
  const n = Object.freeze(il.map(
    (i) => cl(t, e, i)
  )), r = Object.freeze(on.map(
    (i) => ll(t, e, i)
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
const Xe = Object.freeze(
  al.map(({ id: t, oscillatorIndex: e }) => ul(t, e))
);
function dl() {
  if (Xe.length !== A.length || Xe.some((e, n) => e.id !== A[n] || e.oscillatorIndex !== n))
    throw new Error("Oscillator binding contracts must match frozen A/B/C runtime order");
  const t = Xe.flatMap(
    (e) => e.controls.map((n) => n.endpointID)
  );
  if (new Set(t).size !== t.length)
    throw new Error("Oscillator control endpoint IDs must be unique");
}
dl();
async function fl(t, e, n, r = {}) {
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
const ml = 3, hl = (4 + De) * 4, pl = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [F],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(t) {
    let e = ur(t);
    return {
      apply(n, r) {
        return e.closed && (e = ur(t)), e.apply(n, r);
      },
      stop() {
        e.stop();
      }
    };
  }
};
function ur(t) {
  let e = !1, n = 0, r;
  const o = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
  function s(d) {
    const f = r;
    r = void 0, f ? f(d) : d.kind !== "cancelled" && t.report(d);
  }
  function c() {
    e || (e = !0, m.stop(), s({ kind: "cancelled" }), o.clear());
  }
  function u(d) {
    if (d.kind !== "submitted") {
      d.kind === "failed" && d.error.kind !== "transport" && (s(d), c());
      return;
    }
    o.add(d.completion), d.completion.then((f) => {
      o.delete(d.completion), !(e || f.kind === "sent") && (s(f), c());
    }, (f) => {
      e || (c(), t.fail(f));
    });
  }
  const l = {
    addEndpointListener(d, f) {
      const p = i.get(d) ?? /* @__PURE__ */ new Map();
      p.set(f, t.listen(d, f)), i.set(d, p);
    },
    removeEndpointListener(d, f) {
      i.get(d)?.get(f)?.(), i.get(d)?.delete(f);
    },
    addStoredStateValueListener(d) {
      a.set(d, t.subscribeStored(
        F,
        (f) => d({ key: F, value: f })
      ));
    },
    removeStoredStateValueListener(d) {
      a.get(d)?.(), a.delete(d);
    },
    requestFullStoredState(d) {
      t.readStored(F).then((f) => {
        e || d({ values: { [F]: f } });
      }, (f) => t.fail(f));
    },
    sendEventOrValue(d, f) {
      e || u(t.send({ kind: "event", endpoint: d, value: f }));
    }
  }, m = new Bo(l, {
    onDefect(d) {
      c(), t.fail(d);
    },
    curveCommand: (d, f, p) => ({
      async submit({ dspSessionId: g, deliverySerial: b, signal: S }) {
        const E = await t.prepareData(
          ml + d * 2 + f,
          hl,
          (h) => {
            new Int32Array(h.buffer, h.byteOffset, 4).set([1297302855, g, b, De]), Qr(p, new Float32Array(h.buffer, h.byteOffset + 16, De));
          },
          S
        );
        E.kind === "failed" && (s(E), c());
      }
    }),
    async publishTriggerConfig(d) {
      const p = (await Promise.all(o)).find((b) => b.kind !== "sent");
      if (p) return p.kind === "failed" ? p : { kind: "cancelled" };
      if (e) return { kind: "cancelled" };
      const g = t.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: po(d) });
      return g.kind === "submitted" ? g.completion : g;
    }
  });
  return {
    get closed() {
      return e;
    },
    apply(d, f) {
      if (e || f.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const p = ++n;
      return new Promise((g) => {
        const b = f.signal.onAbort(() => {
          s({ kind: "cancelled" }), c();
        });
        r = (S) => {
          b(), g(S);
        }, m.replaceModulation(d, (S) => {
          p === n && S.kind !== "preparing" && s(S);
        }), m.start();
      });
    },
    stop: c
  };
}
function An(t) {
  if (!(t === null || typeof t != "object")) {
    for (const e of Object.values(t)) An(e);
    Object.freeze(t);
  }
}
const gl = {
  parse(t) {
    const e = Sc(t);
    return e ? (An(e), { kind: "ok", value: e }) : { kind: "error", message: "Invalid rack document." };
  },
  encode: xt,
  equals: (t, e) => xt(t) === xt(e)
}, dr = /* @__PURE__ */ new WeakMap();
function kt(t) {
  if (!Object.isFrozen(t)) return JSON.stringify(jn(t));
  let e = dr.get(t);
  return e === void 0 && dr.set(t, e = JSON.stringify(jn(t))), e;
}
const yl = {
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
    const r = So(e, n);
    return r._tag === "err" ? { kind: "error", message: r.error.message } : (An(r.value), { kind: "ok", value: r.value });
  },
  encode: kt,
  equals: (t, e) => t === e || kt(t) === kt(e)
}, fr = [xo, Se, jt, it], bl = { kind: "sent", proof: "native-publication-processed" };
const vl = {
  eventEndpoints: fr,
  outputEndpoints: ["runtimeState"],
  replacement: "finish",
  create(t) {
    let e, n, r = 0, o = 0, i, a = !1, s = Promise.resolve();
    const c = (d) => En(d).filter((f) => fr.includes(f.endpointID));
    async function u(d, f, p = !1) {
      if (a || f.aborted) return { kind: "cancelled" };
      const g = c(d), b = e && !p ? c(e) : [], S = (y) => y.find((T) => T.endpointID === it)?.value, E = b.length > 0 && JSON.stringify(S(b)) === JSON.stringify(S(g)), h = [];
      for (const y of g) {
        if (!E) {
          h.push(y);
          continue;
        }
        if (y.endpointID !== it)
          if (y.endpointID === Se) {
            const T = y.value, x = b.find((Z) => Z.endpointID === y.endpointID && Z.value.slotId === T.slotId), K = x ? x.value.values : [], Y = T.values.flatMap((Z, Re) => Object.is(Z, K[Re]) ? [] : [Re]);
            Y.length === 1 ? h.push({
              endpointID: jt,
              value: { slotId: T.slotId, paramIndex: Y[0], value: T.values[Y[0]] }
            }) : Y.length > 1 && h.push(y);
          } else JSON.stringify(y.value) !== JSON.stringify(b.find((T) => T.endpointID === y.endpointID)?.value) && h.push(y);
      }
      e = void 0;
      for (const y of h) {
        if (a || f.aborted) return { kind: "cancelled" };
        const T = y.endpointID === Se || y.endpointID === jt ? { ...Object(y.value), deliverySerial: ++r } : y.value, x = t.send({ kind: "event", endpoint: y.endpointID, value: T }), K = x.kind === "submitted" ? await x.completion : x;
        if (K.kind !== "sent") return K;
      }
      return a || f.aborted ? { kind: "cancelled" } : (e = d, bl);
    }
    function l(d, f, p = !1) {
      const g = s.then(() => u(d, f, p));
      return s = g.catch(() => {
      }), g;
    }
    const m = t.listen("runtimeState", (d) => {
      const f = d !== null && typeof d == "object" ? Reflect.get(d, "dspSessionId") : void 0;
      if (typeof f != "number" || f === i) return;
      const p = i !== void 0;
      i = f;
      const g = o;
      p && n && l(n, t.signal, !0).then((b) => {
        b.kind === "failed" && g === o && t.report(b);
      }, t.fail);
    });
    return {
      apply(d, f) {
        return o += 1, n = d, l(d, f.signal);
      },
      stop() {
        a = !0, m();
      }
    };
  }
};
function _t(t, e) {
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
const Il = {
  ..._t("A", 0),
  ..._t("B", 1),
  ..._t("C", 1),
  ...Object.fromEntries(nn().map((t) => [t, 0])),
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
  [J]: Ne(),
  [Ie]: Tn(),
  [F]: mt()
}, Sl = [
  { id: "init", name: "Init", values: Il }
], Wo = "bounce.v1", Tl = "cosimo.bounce", El = 1, qo = "cosimo.patch-document", Go = 1;
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
function Jo(t, e) {
  if (typeof t != "string") return ce(t, e);
  try {
    return ce(JSON.parse(t), e);
  } catch (n) {
    throw new Error(`${e} is not valid JSON: ${n instanceof Error ? n.message : n}`);
  }
}
function Al(t) {
  return JSON.stringify(ce(t));
}
function Rl({ parameters: t, storedState: e } = {}) {
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
    format: qo,
    version: Go,
    parameters: Object.freeze(n),
    storedState: Object.freeze(ce(e, "storedState"))
  });
}
function xl(t) {
  const e = Jo(t, "Bounce patch document");
  return _(
    Q(e) && e.format === qo && e.version === Go,
    "Unsupported Bounce patch document"
  ), _(
    Object.keys(e).sort().join(",") === "format,parameters,storedState,version",
    "Bounce patch document has unexpected fields"
  ), Rl(e);
}
function Qo(t) {
  const e = Jo(t, Wo);
  _(
    Q(e) && e.format === Tl && e.version === El,
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
  const i = xl(e.revertRef.patchDocument);
  return Object.freeze({
    ...ce(e),
    revertRef: Object.freeze({
      bankDigest: o,
      patchDocument: i
    })
  });
}
function Ml(t) {
  return Al(Qo(t));
}
const Ol = v("sourceMode", { preset: !1 });
function Xo(t) {
  if (t !== null && typeof t == "object") {
    for (const e of Object.values(t)) Xo(e);
    Object.freeze(t);
  }
  return t;
}
const mr = /* @__PURE__ */ new WeakMap();
function Dt(t) {
  let e = mr.get(t);
  return e === void 0 && mr.set(t, e = Ml(t)), e;
}
const wl = {
  parse(t) {
    if (t === null) return { kind: "ok", value: null };
    try {
      return { kind: "ok", value: Xo(Qo(t)) };
    } catch (e) {
      return { kind: "error", message: e instanceof Error ? e.message : String(e) };
    }
  },
  encode: (t) => t === null ? null : Dt(t),
  equals: (t, e) => t === e || t !== null && e !== null && Dt(t) === Dt(e)
}, kl = ae({ initial: null, codec: wl, preset: !1 }), _l = Object.freeze({
  ...Object.fromEntries(Xe.flatMap(({ controls: t }) => t.map(({ endpointID: e }) => [e, v(e)]))),
  ...Object.fromEntries(nn().map((t) => [t, v(t)])),
  playMode: v("playMode"),
  glideTime: v("glideTime"),
  macro1: v("macro1"),
  macro2: v("macro2"),
  macro3: v("macro3"),
  macro4: v("macro4"),
  filterMode: v("filterMode"),
  filterCutoff: v("filterCutoff"),
  filterQ: v("filterQ"),
  mseg1Morph: v("mseg1Morph"),
  mseg2Morph: v("mseg2Morph"),
  mseg3Morph: v("mseg3Morph"),
  mseg1Rate: v("mseg1Rate"),
  mseg2Rate: v("mseg2Rate"),
  mseg3Rate: v("mseg3Rate"),
  env1Attack: v("env1Attack"),
  env1Decay: v("env1Decay"),
  env1Sustain: v("env1Sustain"),
  env1Release: v("env1Release"),
  env2Attack: v("env2Attack"),
  env2Decay: v("env2Decay"),
  env2Sustain: v("env2Sustain"),
  env2Release: v("env2Release"),
  env3Attack: v("env3Attack"),
  env3Decay: v("env3Decay"),
  env3Sustain: v("env3Sustain"),
  env3Release: v("env3Release"),
  filterMix: v("filterMix"),
  ampRelease: v("ampRelease"),
  sourceMode: Ol,
  globalTune: v("globalTune"),
  ampAttack: v("ampAttack"),
  ampDecay: v("ampDecay"),
  ampSustain: v("ampSustain"),
  filterCutoffKeyTrackEnabled: v("filterCutoffKeyTrackEnabled"),
  filterCutoffKeyTrackOffsetSemitones: v("filterCutoffKeyTrackOffsetSemitones"),
  voiceEnhancerFrequency: v("voiceEnhancerFrequency"),
  voiceEnhancerQ: v("voiceEnhancerQ"),
  voiceEnhancerAmount: v("voiceEnhancerAmount"),
  voiceEnhancerKeyTrackEnabled: v("voiceEnhancerKeyTrackEnabled"),
  voiceEnhancerKeyTrackOffsetSemitones: v("voiceEnhancerKeyTrackOffsetSemitones"),
  polishEnhancerAmount: v("polishEnhancerAmount"),
  polishCompressionClipAmount: v("polishCompressionClipAmount"),
  polishOutputTrimDb: v("polishOutputTrimDb"),
  polishSafeBassAmount: v("polishSafeBassAmount"),
  polishSafeBassBypass: v("polishSafeBassBypass"),
  polishEnhancerBypass: v("polishEnhancerBypass"),
  polishCompressionClipBypass: v("polishCompressionClipBypass"),
  polishOutputTrimBypass: v("polishOutputTrimBypass")
}), Dl = Hc({
  ..._l,
  [J]: nr({ initial: Ne(), codec: ol, prepare: (t) => t, engine: pl }),
  [Ie]: nr({
    initial: Tn(),
    codec: gl,
    dependencies: nn(),
    prepare: (t, { parameters: e }) => Rc(t, e),
    engine: vl
  }),
  [F]: ae({ initial: mt(), codec: yl }),
  [Wo]: kl,
  ...Yc({ factory: Sl, initial: "init" }),
  ...rl()
}), Cl = { kind: "sent", proof: "native-publication-processed" };
function Nl(t) {
  if (typeof t != "object" || t === null) return;
  const e = Reflect.get(t, "values");
  return typeof e == "object" && e !== null ? Reflect.get(e, Ie) : void 0;
}
function Ll(t, e) {
  const n = Dl[Ie];
  if (n.engine?.kind !== "prepared") throw new Error("The synth's rack field must declare its own delivery.");
  const { prepare: r, delivery: o } = n.engine;
  let i = !1;
  const a = /* @__PURE__ */ new Set(), s = {
    get aborted() {
      return i;
    },
    onAbort(h) {
      return a.add(h), () => a.delete(h);
    }
  }, c = Gc(t), u = [];
  function l(h, y) {
    t.addEndpointListener?.(h, y);
    const T = () => t.removeEndpointListener?.(h, y);
    return u.push(T), T;
  }
  const m = {
    signal: s,
    send(h) {
      if (i) return { kind: "cancelled" };
      if (h.kind !== "event") throw new Error(`The rack delivery sent an undeclared ${h.kind}.`);
      return t.sendEventOrValue?.(h.endpoint, h.value), { kind: "submitted", completion: Promise.resolve(Cl) };
    },
    listen: l,
    readStored: () => Promise.reject(new Error("The rack delivery declares no stored reads.")),
    subscribeStored: () => {
      throw new Error("The rack delivery declares no stored reads.");
    },
    prepareData: () => Promise.reject(new Error("The rack delivery declares no shared data.")),
    report(h) {
      h.kind === "failed" && e.onDefect(new Error(`The rack was not applied: ${h.error.message}`));
    },
    fail: e.onDefect
  }, d = o.create(m);
  let f, p = !1;
  async function g() {
    const h = f === void 0 ? n.initial : n.codec.parse(f);
    if (h.kind === "error") {
      e.onDefect(new Error(`The saved rack could not be read: ${h.message}`));
      return;
    }
    const y = await r(h.value, { resources: c, parameters: {}, reason: "load", signal: s });
    if (i) return;
    if (Kc(y)) {
      e.onDefect(new Error(`The saved rack could not be prepared: ${y.error.message}`));
      return;
    }
    const T = await d.apply(y, { signal: s, send: m.send, listen: l });
    T.kind === "failed" && e.onDefect(new Error(`The rack was not applied: ${T.error.message}`));
  }
  const b = () => {
    !i && p && g().catch(e.onDefect);
  }, S = (h) => {
    p || Fo(h) === 0 || (p = !0, b());
  }, E = (h) => {
    typeof h != "object" || h === null || Reflect.get(h, "key") !== Ie || (f = Reflect.get(h, "value"), b());
  };
  return {
    start() {
      l(Gt, S), t.addStoredStateValueListener?.(E), t.requestFullStoredState?.((h) => {
        f = Nl(h), b();
      });
    },
    stop() {
      if (!i) {
        i = !0;
        for (const h of a) h();
        a.clear(), t.removeStoredStateValueListener?.(E);
        for (const h of u.splice(0)) h();
        return d.stop();
      }
    }
  };
}
function $(t, e) {
  if (!t)
    throw new Error(e);
}
function Ct(t, e, n) {
  let r = "";
  for (let o = 0; o < n; o += 1)
    r += String.fromCharCode(t.getUint8(e + o));
  return r;
}
function Pl(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function Qt(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Yo(t) {
  if (t === null)
    return "null";
  if (t === void 0)
    return "undefined";
  const e = typeof t, n = t?.constructor?.name;
  if (e !== "object")
    return n ? `${e}:${n}` : e;
  const r = Object.keys(t).slice(0, 6), o = r.length > 0 ? ` keys=${r.join(",")}` : "";
  return n ? `${e}:${n}${o}` : `${e}${o}`;
}
function Fl() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Nt(t, e) {
  const n = Fl();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Pl(e))
      return new URL(e);
    const r = e.startsWith("/") ? e.slice(1) : e;
    return new URL(r, n);
  }
  return new URL(t, n);
}
async function hr(t) {
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
  throw new Error(`Unsupported text resource payload (${Yo(t)})`);
}
function Ul(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return Qt(t);
  throw new Error(`Unsupported binary resource payload (${Yo(t)})`);
}
function $l(t) {
  const e = t?.frames;
  $(
    Array.isArray(e) || ArrayBuffer.isView(e),
    "Decoded audio data must provide a frames array"
  );
  const n = Array.from(e), r = new Float32Array(n.length);
  for (let o = 0; o < n.length; o += 1) {
    const i = n[o];
    if (typeof i == "number") {
      r[o] = i;
      continue;
    }
    if (ArrayBuffer.isView(i) || Array.isArray(i)) {
      const a = i;
      $(a.length === 1, "Only mono wavetable source files are supported"), r[o] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: r
  };
}
function Zo(t) {
  const e = new DataView(t);
  $(Ct(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), $(Ct(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, o = null, i = null, a = null, s = null, c = null, u = 12;
  for (; u + 8 <= e.byteLength; ) {
    const m = Ct(e, u, 4), d = e.getUint32(u + 4, !0), f = u + 8;
    m === "fmt " ? (n = e.getUint16(f, !0), r = e.getUint16(f + 2, !0), o = e.getUint32(f + 4, !0), a = e.getUint16(f + 12, !0), i = e.getUint16(f + 14, !0)) : m === "data" && (s = f, c = d), u = f + d + d % 2;
  }
  $(n !== null, "Wave file is missing a fmt chunk"), $(s !== null && c !== null, "Wave file is missing a data chunk"), $(r === 1, "Only mono wavetable bank files are supported");
  let l;
  if (n === 3 && i === 32)
    l = new Float32Array(t.slice(s, s + c));
  else if (n === 1 && i === 16) {
    const m = c / 2, d = new Int16Array(t.slice(s, s + c));
    l = new Float32Array(m);
    for (let f = 0; f < m; f += 1)
      l[f] = d[f] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${i}`);
  return {
    format: n,
    channelCount: r,
    sampleRate: o ?? 0,
    bitsPerSample: i,
    blockAlign: a ?? 0,
    samples: l
  };
}
async function pr(t) {
  $(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return $(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function Xt(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function ei(t) {
  const e = new Uint8Array(t).buffer, n = Zo(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Bl(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (c) => ($(typeof t.readResource == "function", `Resource bridge cannot read ${c}`), t.readResource(c)), o = async (c) => {
    $(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${c}`);
    const u = await t.readResourceAsAudioData(c);
    return $l(u);
  }, i = (c) => {
    const u = t.getResourceAddress?.(c);
    return u ?? null;
  }, a = async (c, u = t.getResourceAddress?.(c)) => {
    const l = Nt(c, u), m = await pr(l), d = Zo(m);
    return {
      sampleRate: d.sampleRate,
      samples: d.samples
    };
  }, s = async (c, u = t.getResourceAddress?.(c)) => {
    const l = Nt(c, u);
    return new Uint8Array(await pr(l));
  };
  return {
    async readText(c) {
      if (e === "bridge" && typeof t.readResource == "function")
        return hr(await r(c));
      const u = i(c);
      return e === "url" && u !== null ? Xt(await s(c, u)) : typeof t.readResource == "function" ? hr(await r(c)) : Xt(await s(c, u));
    },
    async readJSON(c) {
      return JSON.parse(await this.readText(c));
    },
    async readBytes(c) {
      return typeof t.readResource == "function" ? Ul(await r(c)) : s(c);
    },
    async readAudio(c) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return o(c);
      const u = i(c);
      return n === "url" && u !== null ? a(c, u) : typeof t.readResourceAsAudioData == "function" ? o(c) : ei(await this.readBytes(c));
    },
    getURL(c) {
      return Nt(c, t.getResourceAddress?.(c));
    }
  };
}
function Kl(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Bl(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function zl(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, r = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, o = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, i = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return Xt(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (e)
        return Qt(await e(a));
      if (n)
        return Qt(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return o ? o(a) : ei(await this.readBytes(a));
    },
    getURL(a) {
      return i ? i(a) : null;
    }
  };
}
function Vl(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function jl(t) {
  return Vl(t) ? zl(t) : Kl(t);
}
const Ye = 2048;
function Me(t, e) {
  if (!t)
    throw new Error(e);
}
function Hl(t) {
  Me(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, r) => {
    Me(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), Me(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), Me(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), Me(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), e;
}
const Wl = 2048, ut = 11, ql = 256;
function V(t, e) {
  if (!t)
    throw new Error(e);
}
function Gl(t) {
  return t > 0 && (t & t - 1) === 0;
}
const gr = /* @__PURE__ */ new Map();
function Jl(t) {
  const e = gr.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), r = new Uint32Array(t);
  for (let o = 0; o < t; o += 1) {
    let i = 0, a = o;
    for (let s = 0; s < n; s += 1)
      i = i << 1 | a & 1, a >>= 1;
    r[o] = i;
  }
  return gr.set(t, r), r;
}
function ti(t, e, n = !1) {
  const r = t.length;
  V(r === e.length, "FFT real and imaginary buffers must have the same length"), V(Gl(r), "FFT input length must be a power of two");
  const o = Jl(r);
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
    const a = i >> 1, s = (n ? 2 : -2) * Math.PI / i, c = Math.cos(s), u = Math.sin(s);
    for (let l = 0; l < r; l += i) {
      let m = 1, d = 0;
      for (let f = 0; f < a; f += 1) {
        const p = l + f, g = p + a, b = t[g], S = e[g], E = m * b - d * S, h = m * S + d * b, y = t[p], T = e[p];
        t[p] = y + E, e[p] = T + h, t[g] = y - E, e[g] = T - h;
        const x = m * c - d * u;
        d = m * u + d * c, m = x;
      }
    }
  }
  if (n)
    for (let i = 0; i < r; i += 1)
      t[i] /= r, e[i] /= r;
}
function ni(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let i = 0; i < e.length; i += 1)
    n += Number(e[i]) || 0;
  const r = n / Math.max(1, e.length), o = new Float32Array(e.length);
  for (let i = 0; i < e.length; i += 1)
    o[i] = (Number(e[i]) || 0) - r;
  return o;
}
function Ql(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Wl,
  maxFramesPerTable: r = ql
} = {}) {
  const o = Float32Array.from(t);
  V(o.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const i = o.length / n;
  V(i > 0, "Source wavetable files must contain at least one frame"), V(i <= r, `Source wavetable files must contain at most ${r} frames`), e !== void 0 && V(i === e, `Source wavetable frame count mismatch: expected ${e}, got ${i}`);
  const a = [];
  for (let s = 0; s < i; s += 1) {
    const c = s * n, u = c + n;
    a.push(ni(o.slice(c, u)));
  }
  return {
    frameCount: i,
    frames: a
  };
}
function yr(t) {
  const e = ni(t), n = Float64Array.from(e), r = new Float64Array(n.length);
  return ti(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function ri(t, e, {
  mipLevelCount: n = ut
} = {}) {
  const r = t?.real?.length ?? 0;
  V(r > 0, "Spectrum must contain real samples"), V(r === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), V(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const o = Math.min(1 << e, r >> 1), i = new Float64Array(r), a = new Float64Array(r);
  for (let s = 1; s <= o; s += 1) {
    i[s] = t.real[s], a[s] = t.imaginary[s];
    const c = (r - s) % r;
    c !== s && (i[c] = t.real[c], a[c] = t.imaginary[c]);
  }
  return ti(i, a, !0), Float32Array.from(i);
}
const Ze = 256, Oe = 2048, oi = 8, Xl = 12811, Yt = (oi + Ze * Xl) * 4;
function br(t, e, n) {
  const r = Math.fround(t * e);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(r + (r >= 0 ? 0.5 : -0.5)))
  ));
}
function Yl(t, e, n) {
  if (t.byteLength !== Yt || !Number.isInteger(e.frameCount) || e.frameCount < 1 || e.frameCount > Ze)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const r = new Int32Array(t.buffer, t.byteOffset, t.byteLength / 4);
  r.set([
    1465139788,
    1,
    e.dspSessionId,
    e.generation,
    e.tableIndex,
    e.frameCount,
    ut,
    Ze
  ]);
  let o = oi;
  const i = 131071, a = 8191, s = Math.fround(i / 1.5), c = Math.fround(a / 0.5);
  for (let u = 0; u < ut; ++u) {
    const l = Math.min(Oe, Math.max(256, (1 << u) * 32)), m = Oe / l;
    for (let d = 0; d < e.frameCount; ++d) {
      const f = ri(n(d), u), p = o + d * (l + 1);
      for (let g = 0; g <= l; ++g) {
        const b = (g === l ? 0 : g) * m, S = (b + Oe - m) % Oe, E = (b + m) % Oe, h = f[b], y = f[S], T = f[E];
        if (h === void 0 || y === void 0 || T === void 0 || !Number.isFinite(h) || !Number.isFinite(y) || !Number.isFinite(T))
          throw new Error("Wavetable preparation produced invalid samples.");
        const x = Math.fround(0.5 * Math.fround(T - y));
        r[p + g] = br(h, s, i) & 262143 | br(x, c, a) << 18;
      }
    }
    o += (l + 1) * Ze;
  }
}
const Zl = "runtimeSyncRequest", eu = 2147483647, tu = "runtimeState", nu = "retryDesiredTableRequest", ru = "workerLoadFailure", ou = "serviceLoadAbort", iu = "wavetableLoadBegin", au = "wavetableMipFrame", su = "wavetableUploadAck", cu = "wavetableMipRequest", lu = "wavetablePrewarmRequest", uu = "wavetablePrewarmNotification", du = "assets/factory-bank-catalog.json", Zt = 3, fu = 1, mu = Zt * Ye, hu = 1, pu = 2, gu = 3, yu = 1, bu = 2, vu = 2e4, He = hu, vr = pu, Ir = gu, G = yu, Sr = bu, Iu = 48 * 1024 * 1024, Lt = 3;
function Tr(t, e) {
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
function Er(t) {
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
function Ar(t, e, n) {
  const r = t + e;
  return t === 0 || r === n || r % 16 === 0;
}
function Rr(t, e) {
  if (!t)
    throw new Error(e);
}
function Su(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function Tu(t, e) {
  return Hl(await t.readJSON(e));
}
function Eu(t) {
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
function Au(t, e) {
  const n = Math.round(Number(t) || 0);
  return Su(n, 0, Math.max(0, e - 1));
}
function Pt(t, e, n, r, o) {
  return `${t}:${e}:${n}:${r}:${o}`;
}
function Ru(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function xr(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Mr(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function We() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function xu(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class Mu {
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
    this.connection = e, this.delivery = n.delivery ?? "events", this.resourceClient = jl(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? du, this.maxBatchesInFlight = Tr(
      n.maxFramesInFlight,
      fu
    ), this.mipLevelCount = n.mipLevelCount ?? ut, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Iu) || 0)), this.serviceLoadTimeoutMs = Tr(n.serviceLoadTimeoutMs, vu), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
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
    }), this.connection.addEndpointListener?.(tu, this.handleRuntimeState), this.connection.addEndpointListener?.(su, this.handleUploadAck), this.connection.addEndpointListener?.(cu, this.handleMipRequest), this.connection.addEndpointListener?.(lu, this.handlePrewarmRequest), this.connection.addEndpointListener?.(uu, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Zl,
      eu
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Tu(this.resourceClient, this.catalogPath), k("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Lt; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = xr(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: xr(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = Pt(
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
          ...Mr(this.serviceTable.frameCount),
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
          failurePhase: Ir,
          failureReasonCode: Sr
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== Ir || e.failureReasonCode !== Sr ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: r,
    generation: o = 0,
    candidateAttemptSerial: i = 0,
    failurePhase: a = He,
    failureReasonCode: s = G
  }) {
    this.connection.sendEventOrValue?.(ru, {
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
    this.connection.sendEventOrValue?.(ou, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: r,
      tableIndex: o,
      failureReasonCode: i
    });
  }
  emitRetryDesiredTableRequest(e) {
    k("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? Er(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(nu, e);
  }
  async loadTableSource(e, n) {
    const r = await this.ensureCatalogLoaded(), o = Au(e, r.tables.length), i = r.tables[o];
    Rr(i, `Could not resolve table ${o}`);
    const a = Ru(i, Ye, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, k("info", "Using cached wavetable source table", {
        tableIndex: o,
        tableId: i.tableId,
        tableName: i.name,
        sourceWav: i.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const c = We();
    k("info", "Reading wavetable source", {
      tableIndex: o,
      tableId: i.tableId,
      tableName: i.name,
      sourceWav: i.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(i.frameCount) : n
    });
    const u = await this.resourceClient.readAudio(i.sourceWav), l = Ql(u.samples, {
      expectedFrameCount: n === void 0 ? Number(i.frameCount) : n,
      samplesPerFrame: Ye
    });
    return k("info", "Prepared wavetable source table", {
      tableIndex: o,
      tableId: i.tableId,
      tableName: i.name,
      sourceWav: i.sourceWav,
      frameCount: l.frameCount,
      loadDurationMs: Math.round(We() - c)
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
    this.connection.sendEventOrValue?.(iu, {
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
    const n = We();
    try {
      if (await fl(this.connection, {
        input: e.oscillatorIndex,
        byteLength: Yt
      }, (r) => {
        Yl(r, e, (o) => this.getSpectrumForFrame(o));
      }), this.serviceTable !== e || this.knownSessionId !== e.dspSessionId) return;
      k("info", "Submitted shared wavetable", {
        oscillatorIndex: e.oscillatorIndex,
        tableIndex: e.tableIndex,
        generation: e.generation,
        frameCount: e.frameCount,
        preparedBytes: Yt,
        preparationMs: We() - n,
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
        failurePhase: vr,
        failureReasonCode: G
      }), this.serviceTable = null, this.clearMipTransferState(), k("error", "Shared wavetable preparation failed", { detail: qe(r) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(e) {
    k("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: He,
      failureReasonCode: G
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: He,
      failureReasonCode: G
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = He,
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
        detail: qe(i)
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
        detail: qe(a)
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
    for (let e = 0; e < Lt; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, xu(() => {
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
    const n = Eu(e ?? {});
    if (k("info", "Received runtime state", Er(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Lt)
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
          o.spectra[a] || (o.spectra[a] = yr(o.frames[a]));
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
          detail: qe(o)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), r = Math.trunc(Number(e?.oscillatorIndex)), o = Math.trunc(Number(e?.generation)), i = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), s = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.oscillatorIndex || o !== this.serviceTable.generation || i !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const c = Pt(
      n,
      r,
      o,
      i,
      a
    );
    let u = this.mipJobs.get(c);
    return u ? (!u.completed && s > u.urgencyLevel && (u.urgencyLevel = s), u) : (u = {
      key: c,
      dspSessionId: n,
      oscillatorIndex: r,
      generation: o,
      tableIndex: i,
      mipIndex: a,
      urgencyLevel: s,
      ...Mr(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(c, u), u);
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
    const n = e ?? {}, r = Math.trunc(Number(n.dspSessionId)), o = Math.trunc(Number(n.oscillatorIndex)), i = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), c = Math.trunc(Number(n.frameIndexBase)), u = Math.trunc(Number(n.frameCount)), l = Pt(
      r,
      o,
      i,
      a,
      s
    ), m = this.mipJobs.get(l), d = this.serviceTable?.frameCount ?? 0, f = Math.min(
      Zt,
      d - c
    );
    if (!(!m || m.completed || !m.inFlightBatchBases.has(c) || u <= 0 || u !== f)) {
      m.inFlightBatchBases.delete(c);
      for (let p = 0; p < u; p += 1) {
        const g = c + p;
        m.ackedFrames[g] || (m.ackedFrames[g] = 1, m.ackedFrameCount += 1);
      }
      m.ackedFrameCount === d && m.nextFrameIndex >= d && m.inFlightBatchBases.size === 0 && (m.completed = !0, this.activeUploadKey === m.key && (this.activeUploadKey = null)), Ar(c, u, d) && k("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: o,
        generation: i,
        tableIndex: m.tableIndex,
        mipIndex: s,
        frameIndexBase: c,
        batchFrameCount: u,
        ackedFrameCount: m.ackedFrameCount,
        frameCount: d,
        inFlightBatches: m.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (Rr(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = yr(this.serviceTable.frames[e]);
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
        Zt,
        this.serviceTable.frameCount - n
      ), o = new Float32Array(mu);
      try {
        for (let i = 0; i < r; i += 1) {
          const a = n + i, s = this.getSpectrumForFrame(a), c = ri(s, e.mipIndex);
          o.set(c, i * Ye);
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
            failurePhase: vr,
            failureReasonCode: G
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(au, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(o)
      }), Ar(n, r, this.serviceTable.frameCount) && k("info", "Sent wavetable mip batch", {
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
function qe(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Ou(t, e = {}) {
  return new Mu(t, e);
}
function wu(t, e, n) {
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
const Ge = 1600, ku = /* @__PURE__ */ new Set([
  "runtimeState",
  "runtimeInstallAck",
  "effectiveRackState"
]);
function we(t, e, n) {
  const r = `${e}_${n}`, o = t[r];
  if (typeof o != "function")
    throw new Error(`Offline performer is missing ${r}().`);
  return o.bind(t);
}
function _u(t) {
  return t && typeof t == "object" && "event" in t ? t.event : t;
}
function Du(t) {
  return {
    values: {
      [J]: t.modulation,
      [Ie]: t.lane,
      [F]: t.articulations
    }
  };
}
class Cu {
  performer;
  #o;
  #n;
  #s = /* @__PURE__ */ new Map();
  #l = /* @__PURE__ */ new Map();
  #h = /* @__PURE__ */ new Map();
  #d = /* @__PURE__ */ new Map();
  #t = /* @__PURE__ */ new Map();
  #i = /* @__PURE__ */ new Map();
  #c;
  #e;
  #f = null;
  #a = null;
  #m = null;
  #r = 0;
  constructor(e, n, r) {
    this.performer = new e(), this.#c = n, this.#e = new URL("./", r), this.#o = new Map(
      this.performer.getInputEndpoints().map((o) => [o.endpointID, o])
    ), this.#n = new Map(
      this.performer.getOutputEndpoints().map((o) => [o.endpointID, o])
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
    const r = this.#o.get(e);
    if (!r) throw new Error(`Offline performer has no input endpoint ${e}.`);
    if (r.endpointType === "event") {
      we(this.performer, "sendInputEvent", e)(n), this.#t.set(e, (this.#t.get(e) ?? 0) + 1);
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
    const r = this.#s.get(e) ?? /* @__PURE__ */ new Set();
    r.add(n), this.#s.set(e, r);
  }
  removeEndpointListener(e, n) {
    this.#s.get(e)?.delete(n);
  }
  addParameterListener(e, n) {
    const r = this.#l.get(e) ?? /* @__PURE__ */ new Set();
    r.add(n), this.#l.set(e, r);
  }
  removeParameterListener(e, n) {
    this.#l.get(e)?.delete(n);
  }
  requestParameterValue(e) {
    const n = this.#h.get(e);
    if (n !== void 0)
      for (const r of this.#l.get(e) ?? []) r(n);
  }
  requestFullStoredState(e) {
    e(Du(this.#c));
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
      outputEventCounts: new Map(this.#i),
      advancedFrames: this.#r
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
    const r = this.#o.get(e);
    if (!r || r.endpointType !== "value")
      throw new Error(`Offline performer has no value endpoint ${e}.`);
    we(
      this.performer,
      "setInputValue",
      e
    )(n, 0), this.#h.set(e, n);
    for (const o of this.#l.get(e) ?? []) o(n);
  }
  advance(e) {
    if (!Number.isInteger(e) || e < 1 || e > 128)
      throw new Error("OfflineEngineHost advances must contain 1 to 128 frames.");
    this.performer.advance(e), this.#r += e, this.drainOutputEvents();
  }
  drainOutputEvents() {
    const e = /* @__PURE__ */ new Set([
      ...ku,
      ...this.#s.keys()
    ]);
    for (const n of e) {
      const r = this.#n.get(n);
      if (!r || r.endpointType !== "event") continue;
      const o = we(
        this.performer,
        "getOutputEventCount",
        n
      )();
      if (o < 1) continue;
      const i = we(
        this.performer,
        "getOutputEvent",
        n
      ), a = Array.from({ length: o }, (s, c) => _u(i(c)));
      we(
        this.performer,
        "resetOutputEventCount",
        n
      )();
      for (const s of a) {
        this.#i.set(
          n,
          (this.#i.get(n) ?? 0) + 1
        ), this.recordDiagnostic(n, s);
        for (const c of this.#s.get(n) ?? []) c(s);
      }
    }
  }
  recordDiagnostic(e, n) {
    if (!n || typeof n != "object") return;
    const r = n;
    if (e === "runtimeState") {
      const o = Math.trunc(Number(r.oscillatorIndex));
      o >= 0 && o < 3 && this.#d.set(o, r);
    } else e === "runtimeInstallAck" ? this.#f = r : e === "effectiveRackState" && (this.#a = r);
  }
}
const Or = "assets/factory-bank-catalog.json";
function Nu(t) {
  return {
    async readText(e) {
      if (e !== Or) throw new Error(`Speedrun resource bundle has no text ${e}.`);
      return JSON.stringify(t.catalog);
    },
    async readJSON(e) {
      if (e !== Or) throw new Error(`Speedrun resource bundle has no JSON ${e}.`);
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
const Lu = [
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
class ye extends Error {
  constructor(e, n, r = {}) {
    super(`${e} install failed: ${n}`, r), this.lane = e, this.name = "SpeedrunInstallError";
  }
  lane;
}
function Pu(t) {
  let e = 0;
  for (const n of t) {
    if (n.endpointID !== Se || typeof n.value != "object" || n.value === null)
      continue;
    const r = n.value.deliverySerial;
    typeof r == "number" && Number.isFinite(r) && r > 0 && (e = Math.max(e, r));
  }
  return e;
}
function Fu(t) {
  const e = Object.fromEntries(t.modulation.routes.flatMap((r) => {
    const o = dn(r);
    return o === null ? [] : [[r.id, o]];
  })), n = En(t.lane);
  return {
    tableIndices: A.map((r) => Math.round(Number(t.parameters[`osc${r}WavetableSelect`]) || 0)),
    modulationFrontier: Vt(t.modulation, null).length,
    articulationFrontier: Io(
      t.articulations,
      e
    ).length,
    rackChainLength: Po(t.lane).chainLength,
    rackParamSerial: Pu(n)
  };
}
function Uu(t, e) {
  for (let o = 0; o < e.tableIndices.length; o += 1) {
    const i = t.runtimeStates.get(o);
    if (i && i.hasFailure && Number(i.failedTableIndex) === e.tableIndices[o])
      return new ye(
        "wavetable",
        `oscillator ${o + 1} rejected table ${e.tableIndices[o]}.`
      );
  }
  const n = Math.trunc(Number(t.runtimeInstallAck?.rejectedSerial) || 0);
  if (n > 0)
    return new ye("modulation", `runtime serial ${n} was rejected.`);
  if (n < 0)
    return new ye("articulation", `runtime serial ${n} was rejected.`);
  const r = Math.trunc(
    Number(t.effectiveRackState?.laneRejectedUploadCount) || 0
  );
  return r > 0 ? new ye("rack", `${r} topology upload(s) were rejected.`) : null;
}
function wr(t, e) {
  const n = e.tableIndices.every((a, s) => {
    const c = t.runtimeStates.get(s);
    return !!c?.hasActive && Number(c?.activeTableIndex) === a;
  }), r = e.modulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedModulationSerial) >= e.modulationFrontier, o = e.articulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedArticulationSerial) <= -e.articulationFrontier, i = Number(t.effectiveRackState?.laneCommittedChainLength) === e.rackChainLength && Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) >= e.rackParamSerial;
  return n && r && o && i;
}
function $u(t, e) {
  return e.tableIndices.every((n, r) => {
    const o = t.runtimeStates.get(r);
    return !!o?.hasActive && Number(o?.activeTableIndex) === n;
  }) ? e.modulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedModulationSerial) < e.modulationFrontier ? "modulation" : e.articulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedArticulationSerial) > -e.articulationFrontier ? "articulation" : "rack" : "wavetable";
}
function Bu(t) {
  return `${[0, 1, 2].map((n) => {
    const r = t.runtimeStates.get(n);
    return r ? `${n}:${Number(r.activeGeneration) || 0}/${Number(r.generationFrontier) || 0} load=${Number(r.loadingGeneration) || 0} active=${!!r.hasActive}` : `${n}:missing`;
  }).join(", ")}; mod=${Number(t.runtimeInstallAck?.acceptedModulationSerial) || 0} art=${Number(t.runtimeInstallAck?.acceptedArticulationSerial) || 0} rack=${Number(t.effectiveRackState?.laneCommittedChainLength) || 0} params=${Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) || 0} mipSent=${t.inputEventCounts.get("wavetableMipFrame") ?? 0} mipAck=${t.outputEventCounts.get("wavetableUploadAck") ?? 0}`;
}
function ii(t) {
  return t >>> 16 & 255;
}
function ai(t) {
  return t >>> 8 & 127;
}
function Rn(t) {
  return t & 127;
}
function Ku(t, e, n) {
  if (t === null) return null;
  let r;
  try {
    r = JSON.parse(t);
  } catch {
    return null;
  }
  const o = r.activeMode, i = o === "key" ? r.key : o === "vel" ? r.velocity : r.chain;
  if (!Array.isArray(i)) return null;
  const a = o === "key" ? ai(e) : o === "vel" ? Rn(e) : n % 128, s = Math.trunc(Number(i[a]));
  return s >= 0 && s <= 127 ? s : null;
}
function zu(t, e, n, r) {
  const o = ii(e);
  if ((o & 240) === 144 && Rn(e) > 0) {
    const i = Ku(n, e, r);
    i !== null && t.sendEventOrValue("articulationNoteMeta", {
      channel: o & 15,
      noteNumber: ai(e),
      selectorA: i,
      selectorB: 0,
      durationSamples: 0,
      ageSamples: 0
    });
  }
  t.sendMIDIInputEvent("midiIn", e);
}
function Vu(t) {
  return Object.fromEntries(En(t.lane).flatMap((e) => _r(e.endpointID) !== null && typeof e.value == "number" ? [[e.endpointID, e.value]] : []));
}
async function ju() {
  await new Promise((t) => setTimeout(t, 0));
}
async function Hu(t, e) {
  const n = globalThis.performance?.now?.() ?? 0, r = new Cu(t, {
    modulation: e.state.modulation,
    lane: e.state.lane,
    articulations: e.state.articulations
  }, e.resourceBaseURL);
  await r.initialise(e.sessionID, e.sampleRate), r.setInitialParameters({ ...e.state.parameters, ...Vu(e.state) }), r.sendEventOrValue("tempo", { bpm: 120 });
  const o = [], i = await Mc(r, [
    Uc,
    () => Ll(r, {
      onDefect: (h) => {
        o.push(h);
      }
    }),
    () => Ou(r, {
      maxFramesInFlight: 1,
      serviceLoadTimeoutMs: 2e4,
      ...e.resourceBundle ? { resourceClient: Nu(e.resourceBundle) } : {}
    })
  ]), a = Fu(e.state), s = e.maxInstallFrames ?? e.sampleRate * 4;
  let c = 0;
  try {
    for (; c < s; ) {
      if (await r.pump(128), c += 128, o.length > 0) {
        const x = o[0];
        throw new ye("rack", x instanceof Error ? x.message : String(x), { cause: x });
      }
      const y = r.getInstallationState(), T = Uu(y, a);
      if (T) throw T;
      if (wr(y, a)) break;
      c / 128 % 8 === 0 && await ju();
    }
    const h = r.getInstallationState();
    if (!wr(h, a)) {
      const y = $u(h, a);
      throw new ye(
        y,
        `timed out after ${c} virtual frames (${Bu(h)}).`
      );
    }
  } finally {
    await i.stop();
  }
  const u = new Float32Array(e.frameCount * 2), l = wu(e.performance, e.frameCount, e.sampleRate), m = r.getInstallationState().articulationTriggerConfig, d = e.recordTelemetry === !0, f = /* @__PURE__ */ new Map();
  let p = 0, g = 0, b = 0;
  d && (r.sendEventOrValue("filterSpectrumActivity", 1), r.sendEventOrValue("distortionScopeActivity", 1), r.sendEventOrValue("distortionHistoryActivity", 1));
  const S = d ? Lu.map((h) => {
    const y = (T) => {
      const x = Math.floor(g / Ge), K = f.get(x) ?? {};
      K[h] = structuredClone(T), f.set(x, K);
    };
    return r.addEndpointListener(h, y), { endpointID: h, listener: y };
  }) : [];
  try {
    for (; g < e.frameCount; ) {
      for (; p < l.length && l[p].sample === g; ) {
        const x = l[p];
        zu(r, x.code, m, b), (ii(x.code) & 240) === 144 && Rn(x.code) > 0 && (b += 1), p += 1;
      }
      const h = l[p]?.sample ?? e.frameCount, y = (Math.floor(g / Ge) + 1) * Ge, T = Math.min(
        128,
        e.frameCount - g,
        h - g,
        ...d ? [y - g] : []
      );
      if (T < 1)
        throw new Error("Speedrun checkpoint render computed an empty advance.");
      r.render(T, u, g), g += T;
    }
  } finally {
    for (const { endpointID: h, listener: y } of S)
      r.removeEndpointListener(h, y);
  }
  const E = (globalThis.performance?.now?.() ?? n) - n;
  return {
    rootIndex: e.rootIndex,
    rootNote: e.rootNote,
    checkpointIndex: e.checkpointIndex,
    frameCount: e.frameCount,
    samples: u,
    telemetry: {
      frameCount: Math.ceil(e.frameCount / Ge),
      frames: [...f.entries()].sort(([h], [y]) => h - y).map(([h, y]) => ({ frame: h, events: y }))
    },
    metrics: {
      renderedFrameCount: e.frameCount,
      installFrameCount: c,
      elapsedMilliseconds: E,
      realtimeMultiplier: E > 0 ? e.frameCount / (E * e.sampleRate / 1e3) : null
    }
  };
}
const Je = self;
function Wu(t) {
  return {
    name: t instanceof Error ? t.name : "Error",
    message: t instanceof Error ? t.message : String(t),
    stack: t instanceof Error ? t.stack : void 0
  };
}
Je.addEventListener("message", (t) => {
  const e = t.data;
  (async () => {
    if (e.type !== "render-root" || typeof e.engineModuleURL != "string")
      throw new Error("Speedrun checkpoint worker received an unsupported request.");
    const r = await import(new URL(e.engineModuleURL, Je.location.href).href), o = r.default ?? r.WavetableSynth, i = await Hu(
      o,
      e.job
    );
    Je.postMessage({
      type: "render-root-complete",
      requestID: e.requestID,
      result: i
    }, [i.samples.buffer]);
  })().catch((n) => {
    Je.postMessage({
      type: "render-root-failed",
      requestID: e.requestID,
      error: Wu(n)
    }, []);
  });
});
