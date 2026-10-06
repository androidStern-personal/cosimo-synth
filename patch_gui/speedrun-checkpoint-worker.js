const Zt = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function Or(t) {
  const e = Zt.find((n) => n.deviceType === t);
  if (e === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${t}`);
  return e;
}
function K(t) {
  return Or(t).laneEndpointID;
}
function en(t, e) {
  if (!Number.isInteger(e) || e < 1 || e > 5)
    throw new Error(`Effect Output Trim instance is out of range: ${e}`);
  return `${Or(t).hostStem}${e}OutputTrimDb`;
}
function tn() {
  return Zt.flatMap((t) => Array.from(
    { length: 5 },
    (e, n) => en(t.deviceType, n + 1)
  ));
}
function wr(t) {
  if (typeof t != "string")
    return null;
  for (const e of Zt)
    for (let n = 1; n <= 5; n += 1)
      if (t === en(e.deviceType, n))
        return {
          deviceType: e.deviceType,
          instanceNumber: n,
          laneEndpointID: e.laneEndpointID
        };
  return null;
}
function Mr(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function eo(t) {
  const e = (Mr(t, -100, 35) - -100) / 135;
  return e * e;
}
function to(t) {
  return -100 + Math.sqrt(Mr(t, 0, 1)) * 135;
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
}), I = (t, e, n, r, i, o, a, s = {}) => ({
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
const no = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], ro = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], io = [
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
      I("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: no.map(P) }),
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
      I("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: ro.map(P) }),
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
], ut = io, kr = Object.freeze(
  ut.flatMap((t) => t.parameters)
);
new Map(
  kr.map((t) => [t.endpointID, t])
);
function oo(t) {
  const e = ut.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function _r() {
  return kr;
}
function nn(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const A = ["A", "B", "C"], rn = [
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
], ao = [
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
]), so = Object.freeze([
  ...A.flatMap((t) => rn.map(
    (e) => `osc${t}.${e}`
  )),
  ...ao
]);
new Set(
  A.flatMap((t) => rn.map(
    (e) => `osc${t}.${e}`
  ))
);
const Dr = Object.freeze(
  so.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), co = _r().filter(
  (t) => t.modulationTargetIndex !== null
), lo = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function on(t) {
  const e = uo(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function uo(t) {
  const e = lo.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const fo = [
  ...co.map((t) => ({
    kind: on(nn(t)),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Nr = Object.freeze(
  fo.sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), X = Object.freeze([
  ...Dr,
  ...Nr
]), Qe = le.length, Cr = Dr.length, dt = Nr.length, mo = Qe * X.length, ho = new Map(le.map((t) => [t.id, t])), Lr = new Map(le.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), Ee = new Map(X.map((t) => [t.kind, t]));
function po() {
  if (Qe !== 14 || Cr !== 59 || dt !== 47 || mo !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = le.filter((r) => r.group === t).sort((r, i) => r.runtimeIndex - i.runtimeIndex);
    if (n.length !== e || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 59], ["rack", 47]]) {
    const n = X.filter((r) => r.group === t);
    if (n.length !== e || n.some((r, i) => r.runtimeIndex !== i))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (ho.size !== Qe || Lr.size !== Qe || Ee.size !== X.length)
    throw new Error("Modulation identities must be unique");
}
po();
function Pr(t, e) {
  const n = Lr.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function an(t) {
  return typeof t != "string" ? null : Ee.has(t) ? t : null;
}
function go(t) {
  const e = an(t);
  return e !== null && Ee.get(e)?.group === "voice" ? e : null;
}
function sn(t) {
  const e = an(t);
  return e !== null && Ee.get(e)?.group === "rack" ? e : null;
}
function Fr(t) {
  const e = Ee.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function Ur(t) {
  const e = Ee.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function yo(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const $r = 4, vo = $r * dt, bo = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), Io = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function ue(t) {
  if (typeof t != "string")
    return null;
  const e = Io.exec(t);
  if (e === null)
    return null;
  const n = e[1], r = bo.get(n);
  if (r === void 0)
    return null;
  const i = e[3];
  return r.includes(i) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: i
  } : null;
}
function cn(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function Br(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function Kr(t) {
  if (t === null)
    return null;
  const e = Br(t) - 1;
  return e > $r ? null : e * dt + Ur(cn(t));
}
const te = 2048, De = te + 3, Rn = 20, zr = "MSEG 1";
function Vr(t) {
  return t !== null && typeof t == "object" ? t : {};
}
function jr(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Ne(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function So(t) {
  return jr(Number.isFinite(t) ? t : 0, -Rn, Rn);
}
function oe(t) {
  return jr(Number.isFinite(t) ? t : 0, 0, 1);
}
function Hr(t = zr) {
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
function To(t, e, n) {
  const r = Vr(t);
  let i = Number(r.x);
  return Number.isFinite(i) || (i = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (i = oe(i)), {
    x: i,
    y: oe(Number(r.y)),
    curvePower: So(Number(r.curvePower))
  };
}
function ln(t = Hr()) {
  const e = Vr(t), n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const r = n.map((i, o) => To(i, o, n.length));
  if (!Ne(r[0].x, 0) || !Ne(r[r.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let i = 1; i < r.length; i += 1)
    if (r[i].x < r[i - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : zr,
    globalSmooth: !!e.globalSmooth,
    points: r
  };
}
function Eo(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, r = Math.exp(e) - 1;
  return n / r;
}
function Ao(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const r = t[n], i = t[n + 1];
    if (e < i.x)
      return { from: r, to: i, laterPointWins: !1 };
    if (Ne(e, i.x)) {
      let o = n + 1;
      for (; o + 1 < t.length && Ne(t[o + 1].x, e); )
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
function Ro(t, e) {
  const n = oe(Number(e)), r = Ao(t, n);
  if (r.laterPointWins || Ne(r.from.x, r.to.x))
    return r.to.y;
  const i = r.to.x - r.from.x, o = i <= 0 ? 1 : (n - r.from.x) / i, a = oe(Eo(o, r.from.curvePower));
  return r.from.y + (r.to.y - r.from.y) * a;
}
function xo(t, e) {
  return Ro(ln(t).points, e);
}
function Oo(t) {
  const e = new Float32Array(De);
  return Wr(t, e), e;
}
function Wr(t, e) {
  if (e.length !== De) throw new Error("Invalid MSEG destination length.");
  const n = ln(t);
  for (let r = 0; r < te; r += 1) {
    const i = r / (te - 1);
    e[r + 1] = xo(n, i);
  }
  e[0] = e[1], e[te + 1] = e[te], e[te + 2] = e[te];
}
const wo = 0, ne = 2;
function Lt(t) {
  return t !== null && typeof t == "object" ? t : {};
}
function Mo(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function ko(...t) {
  return { ...Hr(...t), format: "cosimo.mseg.shape" };
}
function Pt(...t) {
  return { ...ln(...t), format: "cosimo.mseg.shape" };
}
function xn(t) {
  return JSON.stringify(Pt(t));
}
function On(t, e) {
  return xn(t) === xn(e);
}
function _o(t) {
  const e = Number(t);
  return Mo(
    Number.isFinite(e) ? e : 1,
    wo,
    ne
  );
}
function Ft() {
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
function Do(t) {
  if (!t || typeof t != "object")
    return null;
  const e = Lt(t), n = oe(Number(e.startX)), r = oe(Number(e.endX));
  return Math.abs(n - r) <= 1e-12 ? null : r < n ? { startX: r, endX: n } : { startX: n, endX: r };
}
function No(t = Ft()) {
  const e = Lt(t), n = Lt(e.rate), r = Number(n.seconds), i = e.noteOffPolicy, o = i === "finish_loop" || i === "immediate" || i === "ignore" ? i : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: _o(Number.isFinite(r) ? r : 1)
    },
    loop: Do(e.loop),
    noteOffPolicy: o,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
const mt = "modulationProgram", Co = "modulationAmount", qr = le.filter((t) => t.group === "voice").length, Gr = le.filter((t) => t.group === "macro").length, et = Cr, Lo = dt, tt = Lo + vo, re = qr * et, me = Gr * et, Po = qr * tt, Fo = Gr * tt, ee = 512, de = 256, Jr = re + me;
function Uo(t) {
  const e = Pr(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function $o(t) {
  const e = go(t);
  return e === null ? null : Fr(e);
}
function Qr(t) {
  const e = $o(t.targetKind), n = sn(t.targetKind);
  let r = n === null ? void 0 : Ur(n);
  if (r === void 0) {
    const a = Kr(
      ue(t.targetKind)
    );
    a !== null && (r = a);
  }
  if (e === null && r === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = Pr(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (e !== null) {
      const d = s * et + e;
      return {
        path: "macroVoice",
        cellIndex: d,
        sourceIndex: s,
        targetIndex: e,
        articulationCellIndex: re + d
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
  const i = Uo(t);
  if (e !== null) {
    const a = i * et + e;
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
    cellIndex: i * tt + o,
    sourceIndex: i,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function un(t) {
  return ue(t.targetKind) !== null ? null : Qr(t).articulationCellIndex;
}
function Bo(t) {
  if (sn(t.targetKind) !== null)
    return !1;
  const e = ue(t.targetKind);
  return e !== null && Kr(e) === null;
}
function Ko(t) {
  return {
    ...Qr(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function Xr(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (Bo(n))
      continue;
    const r = Ko(n), i = e[r.path];
    if (i.has(r.cellIndex))
      throw new Error(`Duplicate modulation route cell ${r.path}:${r.cellIndex}`);
    i.set(r.cellIndex, r);
  }
  return e;
}
function zo(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function he(t) {
  return [...t.values()].filter(zo).sort((e, n) => e.cellIndex - n.cellIndex);
}
function Ke(t, e, n, r, i) {
  for (let o = 0; o < t.length; o += 1) {
    const a = t[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    e[o] = a.cellIndex, n[o] = a.sourceIndex, r[o] = a.targetIndex, i[o] = a.polarity;
  }
}
function ht(t) {
  const e = Xr(t), n = he(e.voice), r = he(e.macroVoice), i = he(e.voiceRack), o = he(e.macroRack), a = Array.from({ length: re }, () => 0), s = Array.from({ length: re }, () => 0), c = Array.from({ length: re }, () => 0), d = Array.from({ length: re }, () => 0), l = Array.from({ length: re }, () => 0);
  Ke(n, a, s, c, d);
  const m = Array.from({ length: me }, () => 0), u = Array.from({ length: me }, () => 0), f = Array.from({ length: me }, () => 0), v = Array.from({ length: me }, () => 0), p = Array.from({ length: me }, () => 0);
  if (Ke(
    r,
    m,
    u,
    f,
    v
  ), i.length > ee || o.length > de)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${i.length} voice-rack (max ${ee}), ${o.length} macro-rack (max ${de})`
    );
  const y = Array.from({ length: ee }, () => 0), S = Array.from({ length: ee }, () => 0), E = Array.from({ length: ee }, () => 0), h = Array.from({ length: ee }, () => 0), g = Array.from({ length: ee }, () => 0), T = Array.from({ length: Po }, () => 0);
  Ke(
    i,
    y,
    S,
    E,
    h
  );
  const x = Array.from({ length: de }, () => 0), B = Array.from({ length: de }, () => 0), Y = Array.from({ length: de }, () => 0), Z = Array.from({ length: de }, () => 0), Re = Array.from({ length: Fo }, () => 0);
  Ke(
    o,
    x,
    B,
    Y,
    Z
  );
  for (const C of e.voice.values()) l[C.cellIndex] = C.amount;
  for (const C of e.macroVoice.values()) p[C.cellIndex] = C.amount;
  for (const C of e.voiceRack.values()) T[C.cellIndex] = C.amount;
  for (const C of e.macroRack.values()) Re[C.cellIndex] = C.amount;
  for (let C = 0; C < i.length; C += 1) {
    const An = i[C];
    if (An === void 0) throw new Error(`Missing compiled voice-rack route at index ${C}`);
    g[C] = An.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: c,
    voiceRoutePolarities: d,
    voiceRouteAmounts: l,
    macroVoiceRouteCount: r.length,
    macroVoiceRouteCells: m,
    macroVoiceRouteSources: u,
    macroVoiceRouteTargets: f,
    macroVoiceRoutePolarities: v,
    macroVoiceRouteAmounts: p,
    voiceRackRouteCount: i.length,
    voiceRackRouteCells: y,
    voiceRackRouteSources: S,
    voiceRackRouteTargets: E,
    voiceRackRoutePolarities: h,
    voiceRackRouteReducers: g,
    voiceRackRouteAmounts: T,
    macroRackRouteCount: o.length,
    macroRackRouteCells: x,
    macroRackRouteSources: B,
    macroRackRouteTargets: Y,
    macroRackRoutePolarities: Z,
    macroRackRouteAmounts: Re
  };
}
const Vo = ["voice", "macroVoice", "voiceRack", "macroRack"], jo = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function wn(t) {
  return Xr(t);
}
function Ho(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function Wo(t, e) {
  if (t === null)
    return [{ endpointID: mt, value: ht(e) }];
  const n = wn(t), r = wn(e), i = [];
  for (const o of Vo) {
    const a = he(n[o]), s = he(r[o]);
    if (a.length !== s.length)
      return [{ endpointID: mt, value: ht(e) }];
    for (let c = 0; c < s.length; c += 1) {
      const d = a[c], l = s[c];
      if (d === void 0 || l === void 0 || !Ho(d, l))
        return [{ endpointID: mt, value: ht(e) }];
      d.amount !== l.amount && i.push({
        endpointID: Co,
        value: {
          pathKind: jo[o],
          cellIndex: l.cellIndex,
          amount: l.amount
        }
      });
    }
  }
  return i;
}
function Ae(t) {
  return { _tag: "ok", value: t };
}
function ke(t) {
  return { _tag: "err", error: t };
}
function qo(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Go(t) {
  throw new Error(t ?? "Invariant violated");
}
const Jo = "globalTune", Qo = "globalTuneSemitones", q = -24, xe = 24, Mn = 0, Yr = -48, Zr = 48, Ut = -48, ei = 6, dn = 0, kn = (dn - Ut) / (ei - Ut), _e = Object.freeze({
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
function Xo(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function pt(t) {
  return _e.minimumHz * Math.pow(
    _e.maximumHz / _e.minimumHz,
    Xo(t, 0, 1)
  );
}
Object.freeze(
  Array.from({ length: fe }, (t, e) => {
    const n = e / (fe - 1), r = pt(n), i = pt(
      Math.max(0, e - 0.5) / (fe - 1)
    ), o = pt(
      Math.min(fe - 1, e + 0.5) / (fe - 1)
    );
    return {
      centerHz: r,
      lowHz: e === 0 ? _e.minimumHz : i,
      highHz: e === fe - 1 ? _e.maximumHz : o
    };
  })
);
const Yo = "voiceEnhancerFrequency", Zo = "voiceEnhancerQ", ea = "voiceEnhancerAmount", ta = "voiceEnhancerFrequencyOctaves", na = "voiceEnhancerQ", ra = "voiceEnhancerAmount", ti = "voice.enhancerFrequency", ia = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: Yo,
    targetKind: ta,
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
    endpointID: Zo,
    targetKind: na,
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
    endpointID: ea,
    targetKind: ra,
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
function _n(t, e) {
  const n = Math.min(t.max, Math.max(t.min, e));
  return t.scale === "log" ? Math.log(n / t.min) / Math.log(t.max / t.min) : (n - t.min) / (t.max - t.min);
}
function oa(t, e) {
  const n = Math.min(1, Math.max(0, e));
  return t.scale === "log" ? t.min * (t.max / t.min) ** n : t.min + (t.max - t.min) * n;
}
function ze(t, e, n, r, i = "percent", o = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: r, format: i, compound: o };
}
const aa = [
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
], Dn = 1e-6;
function $(t, e) {
  if (!Number.isFinite(t) || t < -Dn || t > 1 + Dn)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function nt(t, e) {
  return $(t / 100, `${e} catalog percentage`);
}
function Fe(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function sa(t) {
  return 20 * 1e3 ** t;
}
function ca(t) {
  return $(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function la(t) {
  return 0.1 * 200 ** t;
}
function ua(t) {
  return $(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function da(t) {
  return t;
}
function fa(t) {
  return $(t, "filterMix endpoint conversion");
}
function ve(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function ma(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: ve("filterCutoff", sa, ca),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: ve("filterQ", la, ua),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: ve("filterMix", da, fa),
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
function ni(t) {
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
      return qo(t);
  }
}
function ha(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function pa(t, e) {
  const n = Fe(t.moduleId, e.id), r = ni(e.format), i = ma(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: nt(e.defaultPercent, n),
    initialValue: nt(e.initialPercent, n),
    format: r,
    modAmount: ha(r),
    binding: i.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: i.articulationParameterId,
    modulationTargetKind: i.modulationTargetKind
  });
}
const ga = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: kn * 100, defaultPercent: kn * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function ya(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function va(t, e) {
  const n = `osc${t}`, r = Fe(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: r,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: nt(e.defaultPercent, r),
    initialValue: nt(e.initialPercent, r),
    format: ni(e.format),
    modAmount: ya(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const ba = Object.freeze(
  A.flatMap((t) => ga.map((e) => va(t, e)))
), Ia = Object.freeze({
  targetId: Fe("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: $(
    (Mn - q) / (xe - q),
    "Global Tune default"
  ),
  initialValue: $(
    (Mn - q) / (xe - q),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: xe },
  modAmount: {
    min: Yr,
    max: Zr,
    unit: "st",
    digits: 2
  },
  binding: ve(
    Jo,
    (t) => q + (xe - q) * t,
    (t) => $(
      (t - q) / (xe - q),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: Qo
});
function Sa(t) {
  const e = Fe("voice-enhancer", t.key), n = $(
    _n(t, t.initial),
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
    binding: ve(
      t.endpointID,
      (r) => oa(t, r),
      (r) => $(
        _n(t, r),
        `${t.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: t.targetKind
  });
}
const Ta = Object.freeze(
  Object.values(ia).map(Sa)
), Ea = Object.freeze([
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
function Aa(t) {
  const e = Fe(t.moduleId, t.targetIdSuffix), n = t.max - t.min, r = (o) => t.min + n * o, i = (o) => $(
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
    binding: ve(t.endpointID, r, i),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const Ra = Object.freeze(
  Ea.map(Aa)
), xa = Object.freeze([
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
function Oa(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function gt(t, e) {
  const n = t.valueKind === "effect-output-trim-db" ? eo(e) : t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return $(n, `${t.endpointID} endpoint conversion`);
}
function wa(t, e) {
  return t.valueKind === "effect-output-trim-db" ? to(e) : t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Ma(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function ka(t) {
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
function _a(t) {
  const e = Oa(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: gt(t, t.initial),
    initialValue: gt(t, t.initial),
    format: Ma(t),
    modAmount: ka(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => wa(t, n),
      fromEngine: (n) => gt(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : on(nn(t))
  });
}
const fn = Object.freeze(
  [
    ...ut.flatMap((t) => t.parameters.map(_a)),
    ...xa,
    Ia,
    ...Ta,
    ...ba,
    ...Ra,
    ...aa.flatMap(
      (t) => t.parameters.map(
        (e) => pa(t, e)
      )
    )
  ]
), Da = new Map(
  fn.map((t) => [t.targetId, t])
), ri = fn.filter(
  (t) => t.modulationTargetKind !== null
), $t = new Map(
  ri.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Da.size !== fn.length)
  throw new Error("Target descriptor IDs must be unique");
if (ri.length !== X.length || $t.size !== X.length || X.some((t) => $t.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function yt(t) {
  const e = $t.get(t);
  return e === void 0 ? Go(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  ut.map((t) => [t.id, t.label])
);
function Na(t) {
  const e = Br(t);
  return e === 1 ? "" : ` ${e}`;
}
function Ca(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const r = yt(t);
    return `${e[1]} ${r.label.toUpperCase()}`;
  }
  const n = ue(t);
  if (n !== null) {
    const r = yt(cn(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : r.moduleId.toUpperCase()}${Na(n)} ${r.label.toUpperCase()}`;
  }
  return yt(t).label.toUpperCase();
}
const J = "modulation.v6", ii = 6, Ue = 3, pe = 3, La = 4, Nn = "modulationMsegBuffer", Pa = "modulationMsegPlayback", oi = 4, Fa = ["MSEG 1", "MSEG 2", "MSEG 3"], ai = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], Ua = ["Env 1", "Env 2", "Env 3"], $a = 1e-3, w = 10, Ba = 0.1, Ka = 20, Cn = 10 - 0.1, za = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Ka - Ba },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Yr,
    max: Zr
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
  env1Attack: { min: -w, max: w },
  env1Decay: { min: -w, max: w },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -w, max: w },
  env2Attack: { min: -w, max: w },
  env2Decay: { min: -w, max: w },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -w, max: w },
  env3Attack: { min: -w, max: w },
  env3Decay: { min: -w, max: w },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -w, max: w },
  ampAttack: { min: -w, max: w },
  ampDecay: { min: -w, max: w },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -w, max: w },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -Cn, max: Cn },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Va = _r().filter((t) => t.modulationTargetIndex !== null), ja = new Map(
  Va.map((t) => [
    on(nn(t)),
    t
  ])
);
class vt extends Error {
  name = "ModulationStateParseError";
}
const Ha = {
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
  label: Ha[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const Wa = X.map((t) => ({
  value: t.kind,
  label: Ca(t.kind)
}));
Wa.filter((t) => !Ga(t.value));
function qa(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function mn(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function bt(t, e) {
  const n = Number(t);
  return mn(Number.isFinite(n) ? n : e, $a, w);
}
function Ga(t) {
  return sn(t) !== null;
}
function Ja(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (t.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function Qa(t) {
  const e = ue(t);
  return e !== null ? cn(e) : t;
}
function Xa(t) {
  const e = Qa(t);
  if (ue(e)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = ja.get(e);
  return n !== void 0 ? Ja(n) : za[yo(e)];
}
function Ya(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Za(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function es(t, e) {
  const n = Xa(t), r = Number(e);
  return mn(Number.isFinite(r) ? r : 0, n.min, n.max);
}
function ts(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function ns(t) {
  return ts(t) ?? "mseg";
}
function rs(t) {
  const e = an(t);
  return e !== null ? e : ue(t) !== null ? t : null;
}
function is(t) {
  return rs(t) ?? "oscA.wavetablePosition";
}
function os(t, e) {
  const n = ai[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function as(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const r = t === "mseg" ? Ue : t === "macro" ? oi : La;
  return mn(Number.isFinite(n) ? n : 1, 1, r);
}
function ge(t) {
  return {
    name: Ua[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function si(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, r = ge(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : r.name,
    attackSeconds: bt(n.attackSeconds ?? r.attackSeconds, r.attackSeconds),
    decaySeconds: bt(n.decaySeconds ?? r.decaySeconds, r.decaySeconds),
    sustain: oe(n.sustain ?? r.sustain),
    releaseSeconds: bt(n.releaseSeconds ?? r.releaseSeconds, r.releaseSeconds)
  };
}
function ss(t, e = 0) {
  return { name: si(t, e).name };
}
function cs(t, e, n, r) {
  const i = Number(t.amount);
  return {
    id: Ya(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: as(n, t.sourceSlot),
    polarity: Za(t.polarity),
    targetKind: r,
    amount: es(r, i),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function ls(t, e = 0) {
  const r = t !== null && typeof t == "object" ? t : {}, i = ns(r.sourceKind), o = is(r.targetKind);
  return cs(r, e, i, o);
}
function us(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function ds(t) {
  return (Array.isArray(t) ? t : []).map((n, r) => ls(n, r));
}
function fs(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const r of t) {
    const i = us(r);
    if (e.has(r.id) || n.has(i))
      return !1;
    e.add(r.id), n.add(i);
  }
  return !0;
}
function Bt(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, s) => Bt(a, e[s]));
  const n = t, r = e, i = Object.keys(n), o = Object.keys(r);
  return i.length === o.length && i.every((a) => qa(r, a) && Bt(n[a], r[a]));
}
function ci(t, e) {
  const n = t && typeof t == "object" ? t : {}, r = ko(Fa[e] ?? `MSEG ${e + 1}`), i = Pt(n.shapeA ?? r), o = No({
    ...Ft(),
    ...n.playback ?? {},
    rate: Ft().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: i,
    shapeB: Pt(n.shapeB ?? i),
    playback: s
  };
}
function Ce() {
  return {
    format: "cosimo.modulation",
    version: ii,
    msegSlots: Array.from({ length: Ue }, (t, e) => ci({}, e)),
    envelopeSlots: Array.from({ length: pe }, (t, e) => ({
      name: ge(e).name
    })),
    routes: [],
    macroNames: ai.slice()
  };
}
function ms(t = Ce()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], r = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], i = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: ii,
    msegSlots: Array.from({ length: Ue }, (o, a) => ci(n[a], a)),
    envelopeSlots: Array.from({ length: pe }, (o, a) => ss(r[a], a)),
    routes: ds(e.routes),
    macroNames: Array.from(
      { length: oi },
      (o, a) => os(i[a], a)
    )
  };
}
function It(t) {
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
  const n = ms(e);
  return !Bt(e, n) || !fs(n.routes) ? ke(new vt("Expected the current modulation schema")) : Ae(n);
}
function hs(t, e) {
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
function Ln(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(Oo(n))
  };
}
function ps(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function Kt(t, e = null, n) {
  const r = [];
  for (let i = 0; i < Ue; i += 1) {
    const o = t.msegSlots[i], a = e?.msegSlots[i];
    (a === void 0 || !On(a.shapeA, o.shapeA)) && r.push(n ? n(i, 0, o.shapeA) : {
      endpointID: Nn,
      value: Ln(i, 0, o.shapeA)
    }), (a === void 0 || !On(a.shapeB, o.shapeB)) && r.push(n ? n(i, 1, o.shapeB) : {
      endpointID: Nn,
      value: Ln(i, 1, o.shapeB)
    }), (a === void 0 || !ps(a.playback, o.playback)) && r.push({
      endpointID: Pa,
      value: hs(i, o.playback)
    });
  }
  return r.push(...Wo(e?.routes ?? null, t.routes)), r;
}
const St = "articulationSnapshot", M = 128, Pn = 48, gs = 1e6, N = -1, Tt = [
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
function hn(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Et(t) {
  return hn(Number.isFinite(t) ? t : 0, 0, 1);
}
function L(t, e, n = -Number.MAX_VALUE, r = Number.MAX_VALUE) {
  const i = Number(t);
  return hn(Number.isFinite(i) ? i : e, n, r);
}
function D(t, e, n, r) {
  return hn(Math.round(L(t, e)), n, r);
}
function li(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function At() {
  return Array.from({ length: M }, () => N);
}
function ys(t) {
  const e = D(t, 0, 0, M - 1), n = Tt[e % Tt.length], r = Math.floor(e / Tt.length);
  return r === 0 ? n : `${n} ${r + 1}`;
}
function vs() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: dn,
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
function bs(t) {
  const e = vs(), n = t && typeof t == "object" ? t : {}, r = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: L(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: L(n.pan, e.pan, -1, 1),
    octave: D(n.octave, e.octave, -4, 4),
    semitone: D(n.semitone, e.semitone, -12, 12),
    fineCents: L(n.fineCents, e.fineCents, -100, 100),
    volumeDb: L(
      n.volumeDb,
      e.volumeDb,
      Ut,
      ei
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
      Et(Number(r[0])),
      Et(Number(r[1])),
      Et(Number(r[2]))
    ]
  };
}
function Is(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: L(e.amount, 0, -48, 48)
  } : null;
}
function Ss(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(Is).filter((i) => i !== null) : [], r = /* @__PURE__ */ new Map();
  for (const i of n)
    r.set(i.routeId, i);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: bs(e.parameters),
    envelopes: [0, 1, 2].map((i) => si(
      Array.isArray(e.envelopes) ? e.envelopes[i] : void 0,
      i
    )),
    modRouteAmounts: [...r.values()]
  };
}
function Ts(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, r = D(n.runtimeSlot, e, 0, M - 1), i = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${r}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : ys(r);
  return {
    id: i,
    runtimeSlot: r,
    name: o,
    snapshot: Ss(n.snapshot)
  };
}
function Es(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, r = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(r) ? {
    note: D(n.note, 0, 0, M - 1),
    articulationId: r
  } : null;
}
function As(t, e, n, r, i) {
  if (!t || typeof t != "object")
    return null;
  const o = t, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let s = D(o.min, i, i, M - 1), c = D(o.max, s, i, M - 1);
  return c < s && ([s, c] = [c, s]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${r}-${n}`,
    articulationId: a,
    min: s,
    max: c
  };
}
function Fn(t, e, n, r) {
  const i = Array.isArray(t) ? t : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < i.length; s += 1) {
    const c = As(
      i[s],
      e,
      s,
      n,
      r
    );
    !c || o.has(c.id) || (o.add(c.id), a.push(c));
  }
  return a;
}
function Rs(t, e) {
  const n = Array.isArray(t) ? t : [], r = /* @__PURE__ */ new Set(), i = [];
  for (const o of n) {
    const a = Es(o, e);
    !a || r.has(a.note) || (r.add(a.note), i.push(a));
  }
  return i;
}
function xs(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), o = [];
  for (let c = 0; c < n.length && o.length < M; c += 1) {
    const d = Ts(n[c], c);
    !d || r.has(d.runtimeSlot) || i.has(d.id) || (r.add(d.runtimeSlot), i.add(d.id), o.push(d));
  }
  const a = typeof e.selectedSlotId == "string" && o.some((c) => c.id === e.selectedSlotId) ? e.selectedSlotId : null, s = new Set(o.map((c) => c.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: li(e.activeTriggerMode),
    slots: o,
    chainAssignments: Fn(e.chainAssignments, s, "chain", 0),
    keyAssignments: Rs(e.keyAssignments, s),
    velocityAssignments: Fn(e.velocityAssignments, s, "velocity", 1)
  };
}
function Un(t) {
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
    volumeDbs: e(dn),
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
    routeAmounts: Array.from({ length: Jr }, () => 0),
    envelopeAttackSeconds: Array.from({ length: pe }, (n, r) => ge(r).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: pe }, (n, r) => ge(r).decaySeconds),
    envelopeSustain: Array.from({ length: pe }, (n, r) => ge(r).sustain),
    envelopeReleaseSeconds: Array.from({ length: pe }, (n, r) => ge(r).releaseSeconds)
  };
}
function $n(t, e, n) {
  for (const r of e) {
    const i = n.get(r.articulationId);
    if (i !== void 0)
      for (let o = r.min; o <= r.max; o += 1)
        t[o] === N && (t[o] = i);
  }
}
function Os(t) {
  const e = xs(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), r = At(), i = At(), o = At();
  $n(r, e.chainAssignments, n), $n(o, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || i[a.note] !== N || (i[a.note] = s);
  }
  return o[0] = N, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: r,
    key: i,
    velocity: o
  };
}
function ui(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Os(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: li(e.activeMode),
    chain: Array.from({ length: M }, (n, r) => D(e.chain?.[r], N, N, M - 1)),
    key: Array.from({ length: M }, (n, r) => D(e.key?.[r], N, N, M - 1)),
    velocity: Array.from({ length: M }, (n, r) => r === 0 ? N : D(e.velocity?.[r], N, N, M - 1))
  });
}
function ws(t, e) {
  const n = ui(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const r = globalThis;
  typeof r.cosimo_set_articulation_trigger_config == "function" && r.cosimo_set_articulation_trigger_config(n);
}
const F = "articulations.v4", pn = [
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
], gn = [
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
], di = [
  ...A.flatMap((t) => pn.map(
    (e) => `osc${t}.${e}`
  )),
  ...gn
];
class fi extends Error {
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
  return ke(new fi("malformed", t));
}
function $e(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function yn(t, e, n) {
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
function it(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < M;
}
function Ms(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function ks(t) {
  return di.some((e) => e === t);
}
function Bn(t, e) {
  if (!$e(t))
    return R(`${e} must be an object`);
  const n = yn(t, ["min", "max"], e);
  return n !== null ? R(n) : it(t.min) ? it(t.max) ? t.min > t.max ? R(`${e}.min must be less than or equal to ${e}.max`) : Ae({ min: t.min, max: t.max }) : R(`${e}.max must be an integer in 0..127`) : R(`${e}.min must be an integer in 0..127`);
}
function _s(t, e) {
  if (!$e(t))
    return R(`${e} must be an object`);
  const n = {};
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return R(`${e} has a non-string parameter id`);
    if (!ks(r))
      return R(`${e} has unknown parameter id "${r}"`);
    const i = t[r];
    if (typeof i != "number" || !Number.isFinite(i))
      return R(`${e}.${r} must be a finite number`);
    n[r] = i;
  }
  return Ae(n);
}
function mi(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function hi() {
  return {};
}
function Ds(t, e, n) {
  if (!$e(t))
    return R(`${e} must be an object`);
  const r = hi();
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return R(`${e} has a non-string route id`);
    const o = t[i];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > Pn)
      return R(
        `${e}.${i} must be a finite route amount within ±${Pn}`
      );
    if (!n.has(i))
      return R(`${e}.${i} does not name a current articulable mapping`);
    mi(r, i, o);
  }
  return Ae(r);
}
function Ns(t, e, n) {
  const r = `slots[${e}]`;
  if (!$e(t))
    return R(`${r} must be an object`);
  const i = yn(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    r
  );
  if (i !== null)
    return R(i);
  if (typeof t.id != "string")
    return R(`${r}.id must be a string`);
  if (!it(t.runtimeSlot))
    return R(`${r}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return R(`${r}.name must be a string`);
  if (typeof t.color != "string")
    return R(`${r}.color must be a string`);
  if (!it(t.key))
    return R(`${r}.key must be an integer in 0..127`);
  const o = Bn(t.velRange, `${r}.velRange`);
  if (o._tag === "err")
    return o;
  const a = Bn(t.chainRange, `${r}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = _s(t.overrides, `${r}.overrides`);
  if (s._tag === "err")
    return s;
  const c = Ds(
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
    velRange: o.value,
    chainRange: a.value,
    overrides: s.value,
    routeAmounts: c.value
  });
}
function Cs(t) {
  const e = {};
  for (const n of di) {
    if (!Object.hasOwn(t, n))
      continue;
    const r = t[n];
    r !== void 0 && (e[n] = r);
  }
  return e;
}
function Ls(t) {
  const e = hi();
  for (const [n, r] of Object.entries(t))
    mi(e, n, r);
  return e;
}
const Ps = Object.fromEntries(
  pn.map((t, e) => [t, 2 ** e])
), Fs = Object.fromEntries(
  gn.map((t, e) => [t, 2 ** e])
);
function Kn(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function Us(t, e) {
  return pn.reduce((n, r) => Object.hasOwn(t.overrides, `osc${e}.${r}`) ? n | Ps[r] : n, 0);
}
function $s(t) {
  return gn.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | Fs[n] : e, 0);
}
function Bs(t, e) {
  const n = (o, a) => Kn(t, `osc${o}.${a}`), r = (o) => Kn(t, o), i = Array.from(
    { length: Jr },
    () => gs
  );
  for (const [o, a] of Object.entries(t.routeAmounts)) {
    const s = e[o];
    s !== void 0 && (i[s] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: A.map((o) => Us(t, o)),
    sharedOverrideMask: $s(t),
    framePositions: A.map((o) => n(o, "framePosition")),
    pans: A.map((o) => n(o, "pan")),
    octaves: A.map((o) => n(o, "octave")),
    semitones: A.map((o) => n(o, "semitone")),
    fineCents: A.map((o) => n(o, "fineCents")),
    phases: A.map((o) => n(o, "phase")),
    phaseRandoms: A.map((o) => n(o, "phaseRandom")),
    retriggers: A.map((o) => n(o, "retrigger")),
    volumeDbs: A.map((o) => n(o, "volumeDb")),
    mutes: A.map((o) => n(o, "mute")),
    solos: A.map((o) => n(o, "solo")),
    warpModes: A.map((o) => n(o, "warpMode")),
    warpAmounts: A.map((o) => n(o, "warpAmount")),
    filterMode: r("filterMode"),
    filterCutoffHz: r("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: r("filterKeyTrackOffsetSemitones"),
    filterQ: r("filterQ"),
    unisonVoices: A.map((o) => n(o, "unisonVoices")),
    unisonDetunes: A.map((o) => n(o, "unisonDetune")),
    unisonBlends: A.map((o) => n(o, "unisonBlend")),
    unisonWidths: A.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: A.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: A.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: A.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: A.map((o) => n(o, "unisonWarpSpread")),
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
function pi(t, e) {
  return t.slots.map((n) => Bs(n, e));
}
function gi(t, e) {
  if (!$e(t))
    return R("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return R('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return ke(new fi(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = yn(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return R(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return R("selectedSlotId must be null or a string");
  if (!Ms(t.activeTriggerMode))
    return R('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return R("slots must be an array");
  if (t.slots.length > M)
    return R(`slots must contain at most ${M} entries`);
  const r = [], i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const s = Ns(t.slots[a], a, e);
    if (s._tag === "err")
      return s;
    const c = s.value;
    if (i.has(c.id))
      return R(`slots[${a}].id duplicates "${c.id}"`);
    if (o.has(c.runtimeSlot))
      return R(`slots[${a}].runtimeSlot duplicates ${c.runtimeSlot}`);
    i.add(c.id), o.add(c.runtimeSlot), r.push(c);
  }
  return t.selectedSlotId !== null && !i.has(t.selectedSlotId) ? R(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : Ae({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: r
  });
}
function zn(t) {
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
      overrides: Cs(e.overrides),
      routeAmounts: Ls(e.routeAmounts)
    }))
  };
}
function ft() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Ks(t) {
  const e = Array.from({ length: M }, () => N), n = Array.from({ length: M }, () => N), r = Array.from({ length: M }, () => N);
  for (const i of t.slots) {
    n[i.key] === N && (n[i.key] = i.runtimeSlot);
    for (let o = i.chainRange.min; o <= i.chainRange.max; o += 1)
      e[o] === N && (e[o] = i.runtimeSlot);
    for (let o = i.velRange.min; o <= i.velRange.max; o += 1)
      r[o] === N && (r[o] = i.runtimeSlot);
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
const yi = 13, vn = 5, vi = 8, zs = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), bi = Object.freeze({
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
    "chorusRingOffsetMode",
    "chorusRingFineSemitones",
    "chorusRingFrequencyHz",
    "chorusRingKeyTrackEnabled",
    "chorusRingKeyTrackOffsetSemitones",
    "chorusRingLegacyClampEnabled",
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
function bn(t) {
  return bi[t];
}
function Vs(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= vn)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * vi + zs[t];
}
function js(t, e) {
  const n = new Array(yi).fill(0);
  return bi[t].forEach((r, i) => {
    const o = e[r];
    if (typeof o != "number" || !Number.isFinite(o))
      throw new Error(`Missing lane parameter value: ${t}.${r}`);
    n[i] = o;
  }), n;
}
const Ie = "lane.v1", ot = "laneTopology", Se = "laneSlotParams", zt = "laneSlotParamValue", Ii = "laneOutputControl", Vt = 16, Hs = 8, Si = 4, Ws = 3, Ti = vn * vi, Ei = 4, qs = 4, Gs = Ti, Js = Ti + Ei, Qs = 0, Xs = 1, Ys = 2, Zs = 3, ec = 4, tc = 5;
function nc(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > Si)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << Hs;
}
const jt = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), at = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), rc = new Map(
  Object.entries(at).map(([t, e]) => [e, t])
), ic = Object.freeze([
  "voice.filterCutoff",
  ti,
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
]), oc = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [ti]: "enhancer-frequency",
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
  ic.map((t) => [t, Object.freeze({
    id: t,
    family: oc[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const Ai = 40, Ri = 18e3, Ht = jt.map((t) => at[t]), ac = /^([a-zA-Z]+)#([1-9][0-9]*)$/, sc = /^(parallel|split)#([1-9][0-9]*)$/;
function Be(t) {
  if (typeof t != "string")
    return null;
  const e = ac.exec(t);
  if (e === null)
    return null;
  const n = Ht.find((i) => i === e[1]);
  if (n === void 0)
    return null;
  const r = Number(e[2]);
  return r > vn ? null : { deviceType: n, instanceNumber: r };
}
function xi(t) {
  if (typeof t != "string")
    return null;
  const e = sc.exec(t);
  if (e === null)
    return null;
  const n = e[1], r = Number(e[2]);
  return r > (n === "parallel" ? Ei : qs) ? null : { groupKind: n, unitNumber: r };
}
function ie(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function be(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((r) => typeof r == "string" && e.includes(r));
}
function O(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function cc(t, e) {
  const n = Be(t);
  if (n === null)
    return { failure: O(`device id ${t} is not a pool instance`) };
  if (!ie(e) || !be(e, ["params"]) || !ie(e.params))
    return { failure: O(`device ${t} must be { params }`) };
  const r = bn(n.deviceType), i = e.params;
  if (Object.keys(i).length !== r.length || !r.every((s) => Object.hasOwn(i, s)))
    return { failure: O(`device ${t} must carry every parameter once`) };
  const a = {};
  for (const s of r) {
    const c = i[s];
    if (typeof c != "number" || !Number.isFinite(c))
      return { failure: O(`device ${t}.${s} must be a finite number`) };
    a[s] = c;
  }
  return { record: { params: a } };
}
function lc(t, e) {
  return !ie(t) || t.kind !== "device" ? { failure: O("branches may hold device placements only") } : be(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: O(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: O(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: O("a device placement is { kind, deviceId, enabled }") };
}
function Vn(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= Ai && t <= Ri;
}
function Oi() {
  return { mix: 1, bypassed: !1 };
}
function uc(t) {
  return !ie(t) || !be(t, ["mix", "bypassed"]) || typeof t.mix != "number" || !Number.isFinite(t.mix) || t.mix < 0 || t.mix > 1 || typeof t.bypassed != "boolean" ? null : { mix: t.mix, bypassed: t.bypassed };
}
function dc(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (l) {
      const m = l instanceof Error ? l.message : String(l);
      return O(`is not valid JSON: ${m}`);
    }
  if (!ie(e) || !be(e, ["format", "version", "output", "devices", "chain"]))
    return O("must be { format, version, output, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return O("must be cosimo.lane version 2");
  if (!ie(e.devices))
    return O("devices must be an object");
  if (!Array.isArray(e.chain))
    return O("chain must be an array");
  const n = uc(e.output);
  if (n === null)
    return O("output must be { mix: 0..1, bypassed: boolean }");
  const r = {};
  for (const l of Reflect.ownKeys(e.devices)) {
    if (typeof l != "string")
      return O("device ids must be strings");
    const m = cc(l, e.devices[l]);
    if ("failure" in m)
      return m.failure;
    r[l] = m.record;
  }
  const i = new Set(Object.keys(r)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let c = 0;
  const d = (l) => {
    const m = lc(l, i);
    return "placement" in m && (o.set(
      m.placement.deviceId,
      (o.get(m.placement.deviceId) ?? 0) + 1
    ), c += 1), m;
  };
  for (const l of e.chain) {
    if (!ie(l))
      return O("chain nodes must be objects");
    if (l.kind === "device") {
      const h = d(l);
      if ("failure" in h)
        return h.failure;
      s.push(h.placement);
      continue;
    }
    if (l.kind !== "parallel" && l.kind !== "split")
      return O(`unknown chain node kind ${String(l.kind)}`);
    const m = l.kind === "split", u = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], v = m ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], p = m && be(l, u);
    if (!be(l, v) && !p)
      return O(`a ${l.kind} group is { ${v.join(", ")} }`);
    const y = xi(l.groupId);
    if (y === null || y.groupKind !== l.kind)
      return O(`group id ${String(l.groupId)} does not name a ${l.kind} unit`);
    if (a.has(String(l.groupId)))
      return O(`group ${String(l.groupId)} is used twice`);
    if (a.add(String(l.groupId)), typeof l.enabled != "boolean")
      return O(`group ${String(l.groupId)} needs a boolean enable`);
    const S = m ? Ws : Si;
    if (!Array.isArray(l.branches) || l.branches.length < 2 || l.branches.length > S)
      return O(`group ${String(l.groupId)} needs 2..${S} branches`);
    if (m && (!Vn(l.xoverLowHz) || !Vn(l.xoverHighHz)))
      return O(`group ${String(l.groupId)} crossovers must sit in ${Ai}..${Ri} Hz`);
    if (m && !p && (typeof l.xoverLowKeyTrackEnabled != "boolean" || typeof l.xoverHighKeyTrackEnabled != "boolean" || typeof l.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverLowKeyTrackOffsetSemitones) || typeof l.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(l.xoverHighKeyTrackOffsetSemitones)))
      return O(`group ${String(l.groupId)} Key Track state must be finite`);
    c += 1;
    const E = [];
    for (const h of l.branches) {
      if (!Array.isArray(h))
        return O(`group ${String(l.groupId)} branches must be arrays`);
      const g = [];
      for (const T of h) {
        const x = d(T);
        if ("failure" in x)
          return x.failure;
        g.push(x.placement);
      }
      E.push(g);
    }
    s.push(m ? {
      kind: "split",
      groupId: String(l.groupId),
      enabled: l.enabled,
      xoverLowHz: l.xoverLowHz,
      xoverHighHz: l.xoverHighHz,
      xoverLowKeyTrackEnabled: p ? !1 : l.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: p ? 0 : l.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: p ? !1 : l.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: p ? 0 : l.xoverHighKeyTrackOffsetSemitones,
      branches: E
    } : {
      kind: "parallel",
      groupId: String(l.groupId),
      enabled: l.enabled,
      branches: E
    });
  }
  for (const l of i)
    if ((o.get(l) ?? 0) !== 1)
      return O(`device ${l} must be placed exactly once`);
  return c > Vt ? O(`flattens to ${c} wire entries; the topology upload holds ${Vt}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: r, chain: s } };
}
function fc() {
  const t = {};
  for (const e of jt) {
    const n = at[e];
    t[`${n}#1`] = {
      params: vc(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Oi(),
    devices: t,
    chain: jt.map((e) => ({
      kind: "device",
      deviceId: `${at[e]}#1`,
      enabled: !1
    }))
  };
}
const jn = ["distortion#1", "delay#1", "reverb#1"];
function In() {
  const t = fc(), e = {};
  for (const n of jn) {
    const r = t.devices[n];
    if (r === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    e[n] = r;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Oi(),
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && jn.includes(n.deviceId))
  };
}
function mc(t) {
  if (t === void 0)
    return In();
  const e = dc(t);
  return e._tag === "ok" ? e.value : null;
}
function Rt(t) {
  return JSON.stringify({
    format: "cosimo.lane",
    version: 2,
    output: t.output,
    devices: t.devices,
    chain: t.chain
  });
}
function hc(t) {
  return Object.keys(t.devices).map((e) => {
    const n = Be(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => Ht.indexOf(e.parsed.deviceType) - Ht.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function Wt(t) {
  const e = Be(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return Vs(e.deviceType, e.instanceNumber - 1);
}
function wi(t) {
  const e = xi(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? Gs : Js) + (e.unitNumber - 1);
}
function Mi(t) {
  const e = new Array(Vt).fill(0);
  let n = 0, r = 0;
  const i = (o, a, s) => {
    e[r] = nc(o, a), s && (n |= 1 << r), r += 1;
  };
  for (const o of t.chain) {
    if (o.kind === "device") {
      i(Wt(o.deviceId), 0, o.enabled);
      continue;
    }
    i(wi(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const c of a)
        i(Wt(c.deviceId), s + 1, c.enabled);
    });
  }
  return { chainLength: r, slotIds: e, enabledMask: n };
}
function pc(t) {
  const e = new Array(yi).fill(0);
  return e[Qs] = t.xoverLowHz, e[Xs] = t.xoverHighHz, e[Ys] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[Zs] = t.xoverLowKeyTrackOffsetSemitones, e[ec] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[tc] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function Sn(t) {
  const e = [{
    endpointID: Ii,
    value: t.output
  }];
  let n = 0;
  for (const r of hc(t)) {
    const i = Be(r.instanceId);
    if (i === null)
      throw new Error(`Invalid lane device identity during replay: ${r.instanceId}`);
    e.push({
      endpointID: en(
        i.deviceType,
        i.instanceNumber
      ),
      value: t.devices[r.instanceId].params[K(i.deviceType)]
    }), n += 1, e.push({
      endpointID: Se,
      value: {
        slotId: Wt(r.instanceId),
        deliverySerial: n,
        values: js(
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
        slotId: wi(r),
        deliverySerial: n,
        values: pc(r)
      }
    }));
  return e.push({
    endpointID: ot,
    value: Mi(t)
  }), e;
}
function gc(t, e, n, r) {
  const i = t.devices[e], o = Be(e);
  if (i === void 0 || o === null || !bn(o.deviceType).includes(n) || !Number.isFinite(r))
    return null;
  const a = { ...i.params, [n]: r };
  return o.deviceType === "delay" && n === "delayTimeMode" && r >= 0.5 && (a.delayTimeKeyTrackEnabled = 0), {
    ...t,
    devices: {
      ...t.devices,
      [e]: { params: a }
    }
  };
}
function yc(t, e) {
  let n = t;
  for (const [r, i] of Object.entries(e)) {
    const o = wr(r);
    if (o === null || typeof i != "number" || !Number.isFinite(i))
      continue;
    const a = `${o.deviceType}#${o.instanceNumber}`;
    if (n.devices[a] === void 0)
      continue;
    const s = Math.min(
      35,
      Math.max(-100, i)
    );
    Object.is(n.devices[a]?.params[o.laneEndpointID], s) || (n = gc(
      n,
      a,
      o.laneEndpointID,
      s
    ) ?? n);
  }
  return n;
}
function vc(t) {
  const e = rc.get(t);
  if (e === void 0)
    throw new Error(`Unknown lane device type: ${t}`);
  const n = oo(e).parameters;
  return Object.fromEntries(bn(t).map((r) => [
    r,
    n.find((i) => i.endpointID === r)?.initial ?? 0
  ]));
}
async function Hn(t) {
  const e = [];
  for (const n of [...t].reverse())
    try {
      await n.stop?.();
    } catch (r) {
      e.push(r);
    }
  return e;
}
async function bc(t, e) {
  const n = [];
  try {
    for (const i of e) {
      const o = await i(t);
      n.push(o), await o.start();
    }
  } catch (i) {
    const o = await Hn(n);
    throw o.length > 0 ? new AggregateError([i, ...o], "A patch worker service failed to start, and stopping the others also failed.") : i;
  }
  let r = !1;
  return {
    async stop() {
      if (r) return;
      r = !0;
      const i = await Hn(n.splice(0));
      if (i.length > 0) throw new AggregateError(i, "Some patch worker services failed to stop.");
    }
  };
}
const qt = "runtimeState";
function ki(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const Wn = "runtimeInstallAck", _i = "runtimeSyncRequest", Gt = 0, Ic = 8e3, st = /* @__PURE__ */ new WeakMap(), Di = 1e9;
let Ve = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Di;
function Sc(t) {
  return Ve = Ve % Di + 1, t === "modulation" ? -1e9 - Ve : 1e9 + Ve;
}
function Tc(t, e) {
  const n = t, r = st.get(n) ?? /* @__PURE__ */ new Set();
  if (r.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  r.add(e), st.set(n, r);
}
function qn(t, e) {
  const n = t, r = st.get(n);
  r?.delete(e), r?.size === 0 && st.delete(n);
}
const Ec = [100, 250, 500, 1e3], je = { _tag: "accepted" }, Ac = { _tag: "superseded" }, Rc = { _tag: "stopped" }, Gn = { _tag: "transport-timeout" };
function xc(t) {
  const e = t && typeof t == "object" && "event" in t ? t.event : t, n = e && typeof e == "object" && "value" in e ? e.value : e;
  if (!n || typeof n != "object")
    return null;
  const r = n, i = r.dspSessionId, o = r.acceptedModulationSerial, a = r.acceptedArticulationSerial, s = r.rejectedSerial, c = r.rejectionReason, d = r.syncSerial;
  return ![
    i,
    o,
    a,
    s,
    c,
    d
  ].every((m) => typeof m == "number" && Number.isSafeInteger(m) && m >= -2147483648 && m <= 2147483647) || typeof i != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof c != "number" || typeof d != "number" || i < 0 || o < 0 || a > 0 || c < 0 ? null : {
    dspSessionId: i,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: c,
    syncSerial: d
  };
}
function Oc(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class Jn {
  #i;
  #n;
  #s;
  #l;
  #h = !1;
  #d = /* @__PURE__ */ new Set();
  #t = null;
  #o = null;
  #c = /* @__PURE__ */ new Set();
  #e = null;
  #f = 0;
  #a = /* @__PURE__ */ new Map();
  #m = 0;
  #r = !1;
  #u = 0;
  #g = /* @__PURE__ */ new Set();
  #T = this.#M.bind(this);
  constructor(e, n) {
    this.#i = e, this.#n = n.laneKind;
    const r = n.probeDelaysMilliseconds?.map((i) => Math.max(0, Math.trunc(i))).filter((i) => Number.isFinite(i));
    this.#s = r && r.length > 0 ? r : [...Ec], this.#l = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? Ic)
    );
  }
  start() {
    if (!this.#r) {
      Tc(this.#i, this.#n);
      try {
        this.#m += 1, this.#r = !0, this.#o = null, this.#c.clear(), this.#i.addEndpointListener?.(Wn, this.#T);
      } catch (e) {
        throw this.#r = !1, qn(this.#i, this.#n), e;
      }
    }
  }
  stop() {
    if (this.#r) {
      this.#r = !1;
      for (const e of this.#d) e();
      this.#i.removeEndpointListener?.(Wn, this.#T), qn(this.#i, this.#n), this.#a.clear(), this.#o = null, this.#c.clear(), this.#S();
    }
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    if (n !== this.#t) {
      for (const r of this.#d) r();
      this.#t = n, this.#o = null, this.#c.clear(), this.#e?.dspSessionId !== n && (this.#e = null), this.#a.clear(), this.#u += 1, this.#S();
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
      const i = await this.#E(
        n,
        r
      );
      if (i._tag !== "accepted")
        return i;
      let o = null;
      for (const a of e) {
        const s = await this.#O(
          a,
          n,
          r
        );
        if (s._tag === "rejected" && this.#n === "articulation") {
          o ??= s;
          continue;
        }
        if (s._tag !== "accepted")
          return s;
      }
      return o ?? je;
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
    if (this.#o === e)
      return je;
    const r = Sc(this.#n);
    this.#c.add(r);
    const i = Date.now() + this.#l;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#p(e, n);
        if (a)
          return a;
        if (this.#o === e)
          return je;
        const s = i - Date.now();
        if (s <= 0)
          return Gn;
        const c = this.#u;
        this.#b(r), await this.#I(
          c,
          Math.min(this.#v(o), s)
        ), o += 1;
      }
    } finally {
      this.#c.delete(r);
    }
  }
  async #O(e, n, r) {
    const i = this.#x(), o = /* @__PURE__ */ new Set();
    let a = !1;
    const s = () => {
      a = !0;
      for (const l of o) l();
      o.clear();
    }, c = {
      get aborted() {
        return a;
      },
      onAbort(l) {
        return a ? l() : o.add(l), () => {
          o.delete(l);
        };
      }
    };
    this.#d.add(s);
    const d = async () => {
      this.#p(n, r) || ("submit" in e ? await e.submit({ dspSessionId: n, deliverySerial: i, signal: c }) : this.#w(e.endpointID, Oc(e.value, n, i)));
    };
    try {
      let l = 0, m = 0, u = this.#f;
      for (await d(); ; ) {
        const f = this.#p(n, r);
        if (f)
          return f;
        const v = this.#y(n, i, u);
        if (v !== null)
          return v;
        const p = this.#u;
        await this.#I(
          p,
          this.#v(l)
        );
        const y = this.#y(
          n,
          i,
          u
        );
        if (y !== null)
          return y;
        let S = this.#u;
        for (this.#b(i); ; ) {
          const E = this.#p(n, r);
          if (E)
            return E;
          const h = await this.#I(
            S,
            this.#v(l)
          ), g = this.#y(
            n,
            i,
            u
          );
          if (g !== null)
            return g;
          if (h && this.#e?.dspSessionId === n && this.#e.syncSerial === i) {
            if (m >= 1)
              return Gn;
            u = this.#f, await d(), m += 1, l += 1;
            break;
          }
          if (h) {
            S = this.#u;
            continue;
          }
          h || (l += 1, S = this.#u, this.#b(i));
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
    const i = this.#e;
    if (!i || i.dspSessionId !== e)
      return null;
    const o = this.#a.get(n);
    return o !== void 0 && o.version > r && o.acknowledgement.dspSessionId === e ? (this.#a.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#R(i, n) ? (this.#a.delete(n), je) : null;
  }
  #p(e, n) {
    return !this.#r || this.#m !== n ? Rc : this.#t !== e ? Ac : null;
  }
  #v(e) {
    return this.#s[Math.min(
      e,
      this.#s.length - 1
    )];
  }
  #w(e, n) {
    try {
      this.#i.sendEventOrValue?.(
        e,
        n,
        void 0,
        Gt
      );
    } catch {
    }
  }
  #b(e) {
    if (this.#r)
      try {
        this.#i.sendEventOrValue?.(
          _i,
          e,
          void 0,
          Gt
        );
      } catch {
      }
  }
  #M(e) {
    const n = xc(e);
    if (!n || this.#t !== null && n.dspSessionId !== this.#t || this.#o === n.dspSessionId && this.#e?.dspSessionId === n.dspSessionId && (n.acceptedModulationSerial < this.#e.acceptedModulationSerial || n.acceptedArticulationSerial > this.#e.acceptedArticulationSerial))
      return;
    if (this.#c.has(n.syncSerial) && (this.#o = n.dspSessionId), this.#e = n, this.#f += 1, this.#n === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#a.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#f
      }); this.#a.size > 16; ) {
        const i = this.#a.keys().next().value;
        if (i === void 0) break;
        this.#a.delete(i);
      }
    this.#u += 1, this.#S();
  }
  #I(e, n) {
    return !this.#r || this.#u !== e ? Promise.resolve(!0) : new Promise((r) => {
      let i = !1;
      const o = {
        finish: (a) => {
          i || (i = !0, o.timeoutHandle !== null && clearTimeout(o.timeoutHandle), this.#g.delete(o), r(a));
        },
        timeoutHandle: null
      };
      o.timeoutHandle = setTimeout(() => o.finish(!1), n), this.#g.add(o);
    });
  }
  #S() {
    for (const e of [...this.#g])
      e.finish(!0);
  }
}
const wc = 1e3, Mc = [J, F];
function kc(t) {
  if (!t || typeof t != "object") return {};
  const { values: e } = t;
  return e && typeof e == "object" ? e : {};
}
function xt(t, e) {
  if (t === void 0) return ft();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const r = gi(n, e);
  return r._tag === "ok" ? r.value : null;
}
function Qn(t) {
  return new Set(t.routes.flatMap((e) => un(e) === null ? [] : [e.id]));
}
function Xn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
function Yn(t, e) {
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
class Ni {
  constructor(e, n) {
    this.connection = e, this.frameworkInput = n, this.modulationLane = new Jn(e, { laneKind: "modulation" }), this.articulationLane = new Jn(e, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = Ce();
  articulationBank = ft();
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
    { length: M },
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
    return this.frameworkInput ? [F] : Mc;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(qt, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(qt, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
  }
  requestBootState(e) {
    if (this.bootPending = !0, this.bootEvents.length = 0, typeof this.connection.requestFullStoredState == "function") {
      this.connection.requestFullStoredState((n) => {
        !this.started || e !== this.lifecycleEpoch || (this.applyBootState(kc(n)), this.finishBoot());
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
    const n = e[J], r = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: Ce() } : rt(n);
    if (r._tag === "err") {
      console.error(`[runtime-state-worker] ${J} is invalid; boot state was not installed.`);
      const a = e[F], s = xt(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = r.value, this.hasModulationState = !0;
    const i = e[F], o = xt(
      i,
      Qn(r.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${F} is invalid; boot state was not installed.`);
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
      const i = rt(n);
      if (i._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${J}.`);
        return;
      }
      this.modulationState = i.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const r = xt(n, Qn(this.modulationState));
    if (r === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${F}.`);
      return;
    }
    this.articulationBank = r, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = ki(e);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(_i, 0, void 0, Gt), this.hasRuntimeState || this.scheduleRecovery());
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
    const e = this.lifecycleEpoch, n = this.runtimeGeneration, r = this.modulationState, i = this.articulationBank, o = this.deliveryObserver, s = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, c = this.frameworkInput?.curveCommand ? Kt(r, s, this.frameworkInput.curveCommand) : Kt(r, s), d = await this.modulationLane.sendBatch(c);
    if (!this.started || e !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", d, r)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const y = Yn("modulation", d);
      y && o?.(y), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = r, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, r, i)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const l = this.buildUploadsBySelector(r, i), m = Array.from({ length: M }, (y, S) => {
      const E = l.get(S);
      return E ? Xn(E) : null;
    }), u = this.lastAppliedArticulationGeneration !== n, f = u && this.articulationLane.getAcceptedFrontier() !== 0, v = [];
    for (let y = 0; y < M; y += 1) {
      const S = l.get(y), E = m[y] !== this.lastAppliedArticulationTokens[y];
      f ? v.push({
        endpointID: St,
        value: S ?? Un(y)
      }) : u ? S && v.push({ endpointID: St, value: S }) : E && v.push({
        endpointID: St,
        value: S ?? Un(y)
      });
    }
    const p = await this.articulationLane.sendBatch(v);
    if (!(!this.started || e !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", p, m)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = m;
        const y = Ks(i);
        if (this.frameworkInput) {
          const S = await this.frameworkInput.publishTriggerConfig(y);
          if (!this.started || e !== this.lifecycleEpoch) return;
          S.kind !== "cancelled" && o?.(S);
        } else
          ws(y, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const S of v) this.lastAppliedArticulationTokens[S.value.selectorA] = void 0;
        const y = Yn("articulation", p);
        y && o?.(y);
      }
      this.finishDelivery();
    }
  }
  desiredStateChanged(e, n, r) {
    return e !== this.runtimeGeneration || n !== this.modulationState || r !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const r = Object.fromEntries(e.routes.flatMap((i) => {
      const o = un(i);
      return o === null ? [] : [[i.id, o]];
    }));
    return new Map(
      pi(n, r).map((i) => [i.selectorA, i])
    );
  }
  acceptOutcome(e, n, r) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const i = Xn(r), o = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== i;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, i), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, wc));
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
function _c(t) {
  return new Ni(t);
}
const Dc = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function Nc(t) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(t) && !t.includes("__") && !Dc.has(t);
}
function Cc(t) {
  return typeof t == "object" && t !== null && "kind" in t && t.kind === "preparation-error" && "error" in t && typeof t.error == "object" && t.error !== null && "kind" in t.error && t.error.kind === "resource" && "message" in t.error && typeof t.error.message == "string";
}
const Ci = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-check"), Li = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.definition-initial");
function b(t, e = {}) {
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
function Zn(t) {
  const e = ae({ codec: t.codec, initial: t.initial, lifetime: t.lifetime, history: t.history, preset: t.preset }), n = Object.freeze([...t.dependencies ?? []]);
  if ("kind" in t.engine && t.engine.kind === "shared-data") {
    const o = t.engine, a = t.prepare, s = t.prepare, c = o.length;
    return Object.freeze({ ...e, engine: Object.freeze({
      kind: "shared-prepared",
      dependencies: n,
      storage: Object.freeze({ type: o.type, fixedLength: c ?? null }),
      prepare: c === void 0 ? s : (d, l) => ({
        length: c,
        write: (m) => a(d, m, l)
      })
    }) });
  }
  const r = t.prepare, i = t.engine;
  return Object.freeze({ ...e, engine: Object.freeze({
    kind: "prepared",
    dependencies: n,
    prepare: r,
    delivery: i
  }) });
}
const Lc = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.options");
function Pc(t) {
  return Object.keys(t).filter((e) => t[e]?.kind === "stored" && t[e].engine?.kind === "shared-prepared").sort().map((e, n) => ({ key: e, input: n }));
}
function Fc(t) {
  return Object.keys(t).filter((e) => t[e]?.preset !== !1);
}
function Uc(t, e = {}) {
  if (e.historyLimit !== void 0 && (!Number.isSafeInteger(e.historyLimit) || e.historyLimit < 0))
    throw new Error("historyLimit must be a non-negative integer.");
  const n = Pc(t);
  if (n.length && (!Number.isSafeInteger(e.memoryBudgetBytes) || (e.memoryBudgetBytes ?? 0) < 4))
    throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
  if (n.some(({ key: o }) => !Nc(o) || o === "Data"))
    throw new Error("Shared state names must be valid Cmajor identifiers.");
  const r = /* @__PURE__ */ new Map();
  for (const [o, a] of Object.entries(t)) {
    if (a.kind !== "parameter") continue;
    const s = r.get(a.endpoint);
    if (s !== void 0)
      throw new Error(`Fields "${s}" and "${o}" both declare parameter "${a.endpoint}". Declare each host parameter once.`);
    r.set(a.endpoint, o);
  }
  for (const o of Object.values(t)) o.kind === "stored" && o[Ci]?.(t);
  const i = { ...t };
  for (const [o, a] of Object.entries(t)) {
    const s = a.kind === "stored" ? a[Li] : void 0;
    s && (i[o] = Object.freeze({ ...a, initial: s(t) }));
  }
  return Object.freeze(Object.defineProperty(i, Lc, { value: Object.freeze({ ...e }) }));
}
function z(t) {
  throw new Error(t);
}
function Ot(t, e, n) {
  let r = "";
  for (let i = 0; i < n; i += 1) r += String.fromCharCode(t.getUint8(e + i));
  return r;
}
function er(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function $c(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function tr(t, e) {
  return typeof e == "string" ? $c(e) : e instanceof ArrayBuffer ? new Uint8Array(e.slice(0)) : ArrayBuffer.isView(e) ? new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength)) : Array.isArray(e) ? Uint8Array.from(e) : z(`The host returned ${t} in a form this kit cannot read.`);
}
function nr(t, e) {
  const n = new DataView(e);
  (n.byteLength < 12 || Ot(n, 0, 4) !== "RIFF" || Ot(n, 8, 4) !== "WAVE") && z(`${t} is not a WAV file.`);
  let r = 0, i = 0, o = 0, a = 0, s = -1, c = 0;
  for (let l = 12; l + 8 <= n.byteLength; ) {
    const m = Ot(n, l, 4), u = n.getUint32(l + 4, !0), f = l + 8;
    m === "fmt " ? (r = n.getUint16(f, !0), i = n.getUint16(f + 2, !0), o = n.getUint32(f + 4, !0), a = n.getUint16(f + 14, !0)) : m === "data" && (s = f, c = Math.min(u, n.byteLength - f)), l = f + u + u % 2;
  }
  (s < 0 || r === 0) && z(`${t} is missing its WAV format or data chunk.`), i !== 1 && z(`${t} has ${i} channels; readAudio reads mono WAV files only.`);
  const d = e.slice(s, s + c);
  if (r === 3 && a === 32) return { sampleRate: o, samples: new Float32Array(d, 0, Math.floor(c / 4)) };
  if (r === 1 && a === 16) {
    const l = new Int16Array(d, 0, Math.floor(c / 2));
    return { sampleRate: o, samples: Float32Array.from(l, (m) => m / 32768) };
  }
  return z(`${t} uses WAV format ${r} at ${a} bits; use 16-bit PCM or 32-bit float.`);
}
function Bc(t, e) {
  const n = e ?? {}, r = n.frames;
  (!r || typeof r.length != "number") && z(`The host decoded ${t} without audio frames.`);
  const i = new Float32Array(r.length);
  for (let o = 0; o < r.length; o += 1) {
    const a = r[o];
    typeof a == "number" ? i[o] = a : a && a.length === 1 ? i[o] = Number(a[0]) || 0 : z(`${t} is not mono; readAudio reads mono audio only.`);
  }
  return { sampleRate: Number(n.sampleRate) || 0, samples: i };
}
function rr() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0) return new URL("/", t);
  const e = new URL(import.meta.url);
  return e.pathname = e.pathname.replace(/\/[^/]*$/, "/"), e;
}
function ir(t, e) {
  return e instanceof URL ? e : typeof e == "string" && e.length > 0 ? /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e) ? new URL(e) : new URL(e.replace(/^\//, ""), rr()) : new URL(t, rr());
}
function Kc(t) {
  const e = t ?? {}, n = async (i) => {
    typeof fetch != "function" && z(`Cannot read ${i}: this host has neither a resource bridge nor fetch.`);
    const o = ir(i, e.getResourceAddress?.(i)), a = await fetch(o.toString());
    return a.ok || z(`Could not read ${i} from ${o} (HTTP ${a.status}).`), a.arrayBuffer();
  }, r = async (i) => e.readResource ? tr(i, await e.readResource(i)) : new Uint8Array(await n(i));
  return {
    async readText(i) {
      if (!e.readResource) return er(new Uint8Array(await n(i)));
      const o = await e.readResource(i);
      return typeof o == "string" ? o : typeof o == "object" && o !== null && "text" in o && typeof o.text == "function" ? String(await o.text()) : er(tr(i, o));
    },
    async readJSON(i) {
      return JSON.parse(await this.readText(i));
    },
    readBytes: r,
    async readAudio(i) {
      const o = e.getResourceAddress?.(i);
      return o != null && typeof fetch == "function" ? nr(i, await n(i)) : e.readResourceAsAudioData ? Bc(i, await e.readResourceAsAudioData(i)) : nr(i, new Uint8Array(await r(i)).buffer);
    },
    getURL(i) {
      return ir(i, e.getResourceAddress?.(i));
    }
  };
}
const Te = (t) => ({ kind: "ok", value: t }), Le = (t) => ({ kind: "error", message: t }), se = (t) => typeof t == "object" && t !== null && !Array.isArray(t);
function ct(t) {
  if (t === null || typeof t == "boolean" || typeof t == "string") return t;
  if (typeof t == "number") return Number.isFinite(t) ? t : void 0;
  if (Array.isArray(t)) {
    const r = [];
    for (const i of t) {
      const o = ct(i);
      if (o === void 0) return;
      r.push(o);
    }
    return Object.freeze(r);
  }
  if (!se(t)) return;
  const e = Object.getPrototypeOf(t);
  if (e !== Object.prototype && e !== null) return;
  const n = {};
  for (const [r, i] of Object.entries(t)) {
    const o = ct(i);
    if (o === void 0) return;
    n[r] = o;
  }
  return Object.freeze(n);
}
function Pe(t, e) {
  if (Object.is(t, e)) return !0;
  if (Array.isArray(t) || Array.isArray(e))
    return Array.isArray(t) && Array.isArray(e) && t.length === e.length && t.every((o, a) => Pe(o, e[a]));
  if (!se(t) || !se(e)) return !1;
  const n = t, r = e, i = Object.keys(n);
  return i.length === Object.keys(r).length && i.every((o) => Object.hasOwn(r, o) && Pe(n[o], r[o]));
}
function zc(t) {
  const e = se(t) ? ct(t) : void 0;
  return e !== void 0 && se(e) ? Te(e) : Le("Preset values must be an object of JSON values.");
}
function Pi(t) {
  if (!se(t) || typeof t.id != "string" || t.id.length === 0 || typeof t.name != "string" || t.name.trim().length === 0)
    return Le("A preset needs a non-empty id and name.");
  const e = zc(t.values);
  return e.kind === "ok" ? Te(Object.freeze({ id: t.id, name: t.name, values: e.value })) : e;
}
const Vc = {
  parse(t) {
    if (!se(t) || t.version !== 1 || !Array.isArray(t.presets)) return Le("Expected a version 1 preset library.");
    const e = [];
    for (const n of t.presets) {
      const r = Pi(n);
      if (r.kind === "error") return r;
      if (e.some((i) => i.id === r.value.id)) return Le(`Preset id "${r.value.id}" appears twice.`);
      e.push(r.value);
    }
    return Te(Object.freeze({ version: 1, presets: Object.freeze(e) }));
  },
  encode: (t) => t,
  equals: (t, e) => Pe(t, e)
}, or = {
  parse: (t) => t === null ? Te(null) : Pi(t),
  encode: (t) => t,
  equals: (t, e) => Pe(t, e)
};
function Fi(t, e) {
  if (t.kind === "parameter")
    return typeof e == "number" && Number.isFinite(e) ? Te(e) : Le("Expected a finite number.");
  const n = t.codec.parse(e);
  return n.kind === "ok" ? Te(t.codec.encode(n.value)) : n;
}
function jc(t, e, n) {
  if (e !== void 0 && !t.some((o) => o.id === e))
    throw new Error(`The initial preset "${e}" is not a factory preset. Use the id of one of the factory presets.`);
  const r = Fc(n), i = /* @__PURE__ */ new Set();
  for (const o of t) {
    if (typeof o.id != "string" || o.id.length === 0 || typeof o.name != "string" || o.name.trim().length === 0)
      throw new Error("Every factory preset needs a non-empty id and name.");
    if (i.has(o.id)) throw new Error(`Factory preset id "${o.id}" is used twice. Give each factory preset its own id.`);
    i.add(o.id);
    for (const a of Object.keys(o.values))
      if (!r.includes(a))
        throw new Error(`Factory preset "${o.name}" sets "${a}", which is not a sound field. Remove it or correct the field name.`);
    for (const a of r) {
      const s = n[a];
      if (!s) continue;
      if (!Object.hasOwn(o.values, a))
        throw new Error(`Factory preset "${o.name}" is missing "${a}". Give it a value, or declare the field with preset: false.`);
      const c = Fi(s, o.values[a]);
      if (c.kind === "error") throw new Error(`Factory preset "${o.name}" has an invalid value for "${a}": ${c.message}`);
    }
  }
}
function Hc(t = {}) {
  const e = Object.freeze((t.factory ?? []).map((a) => Object.freeze({ ...a, values: Object.freeze({ ...a.values }) }))), { initial: n } = t, r = Object.freeze({
    ...ae({ codec: Vc, initial: { version: 1, presets: [] }, lifetime: "user", preset: !1 }),
    factory: e,
    [Ci]: (a) => jc(e, n, a)
  }), i = ae({ codec: or, initial: null, preset: !1 }), o = e.find((a) => a.id === n);
  return {
    presetLibrary: r,
    // The initial preset's values are saved in each field's encoded form, which needs the whole definition.
    activePreset: o === void 0 ? i : Object.freeze({
      ...i,
      [Li]: (a) => or.parse({ id: o.id, name: o.name, values: Wc(a, o) })
    })
  };
}
const ar = /* @__PURE__ */ new WeakMap();
function Wc(t, e) {
  let n = ar.get(e);
  if (!n) {
    const r = {};
    for (const [i, o] of Object.entries(e.values)) {
      const a = t[i], s = a && Fi(a, o);
      s?.kind === "ok" && (r[i] = s.value);
    }
    n = Object.freeze(r), ar.set(e, n);
  }
  return n;
}
const qc = Object.freeze(["A", "B", "C", "D", "E", "F", "G"]);
function Gc(t) {
  return {
    // Slots a plugin update removed are dropped and new slots start empty, so older projects still load.
    parse(e) {
      if (typeof e != "object" || e === null || Array.isArray(e)) return { kind: "error", message: "Expected snapshot slots." };
      const n = {};
      for (const r of t) {
        const i = Object.hasOwn(e, r) ? Reflect.get(e, r) : void 0;
        if (i == null) {
          n[r] = null;
          continue;
        }
        const o = typeof i == "object" ? ct(Reflect.get(i, "values")) : void 0;
        if (typeof o != "object" || o === null || Array.isArray(o)) return { kind: "error", message: `Snapshot ${r} has invalid values.` };
        n[r] = Object.freeze({ values: o });
      }
      return { kind: "ok", value: Object.freeze(n) };
    },
    encode: (e) => e,
    equals: (e, n) => Pe(e, n)
  };
}
function Jc(t) {
  return {
    // A slot that no longer exists is simply no longer active.
    parse: (e) => e === null || typeof e == "string" ? { kind: "ok", value: typeof e == "string" && t.includes(e) ? e : null } : { kind: "error", message: "Expected a snapshot slot name or null." },
    encode: (e) => e,
    equals: Object.is
  };
}
function Qc(t = {}) {
  const e = Object.freeze([...t.slots ?? qc]);
  if (e.length === 0 || e.some((r) => typeof r != "string" || r.length === 0) || new Set(e).size !== e.length)
    throw new Error("Snapshot slots must be distinct, non-empty names.");
  const n = Object.fromEntries(e.map((r) => [r, null]));
  return {
    snapshotSlots: Object.freeze({ ...ae({ codec: Gc(e), initial: n, history: !1, preset: !1 }), slots: e }),
    activeSnapshot: ae({ codec: Jc(e), initial: null, preset: !1 })
  };
}
function Ui(t) {
  if (!(t === null || typeof t != "object")) {
    for (const e of Object.values(t)) Ui(e);
    Object.freeze(t);
  }
}
const Xc = {
  parse(t) {
    const e = rt(t);
    return e._tag === "err" ? { kind: "error", message: e.error.message } : (Ui(e.value), { kind: "ok", value: e.value });
  },
  encode: It,
  equals: (t, e) => It(t) === It(e)
}, Yc = [
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
], Zc = [
  { id: "A", oscillatorIndex: 0 },
  { id: "B", oscillatorIndex: 1 },
  { id: "C", oscillatorIndex: 2 }
];
function el(t) {
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
function tl(t, e, n) {
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
function nl(t, e, n) {
  const r = `osc${t}.${n}`;
  return Object.freeze({
    parameterKind: n,
    targetKind: r,
    // SAFETY: the oscillator and target suffix are both closed canonical
    // unions, so the interpolated ID belongs to the UI target domain.
    uiTargetID: `osc${t}.${el(n)}`,
    runtimeTargetIndex: Fr(r),
    oscillatorIndex: e
  });
}
function rl(t, e) {
  const n = Object.freeze(Yc.map(
    (o) => tl(t, e, o)
  )), r = Object.freeze(rn.map(
    (o) => nl(t, e, o)
  )), i = Object.freeze(n.flatMap(
    (o) => o.articulationParameterID === null ? [] : [o.articulationParameterID]
  ));
  return Object.freeze({
    id: t,
    oscillatorIndex: e,
    tableStatus: Object.freeze({ endpointID: "runtimeState", oscillatorIndex: e }),
    controls: n,
    modulationTargets: r,
    articulationParameterIDs: i
  });
}
const Xe = Object.freeze(
  Zc.map(({ id: t, oscillatorIndex: e }) => rl(t, e))
);
function il() {
  if (Xe.length !== A.length || Xe.some((e, n) => e.id !== A[n] || e.oscillatorIndex !== n))
    throw new Error("Oscillator binding contracts must match frozen A/B/C runtime order");
  const t = Xe.flatMap(
    (e) => e.controls.map((n) => n.endpointID)
  );
  if (new Set(t).size !== t.length)
    throw new Error("Oscillator control endpoint IDs must be unique");
}
il();
async function ol(t, e, n, r = {}) {
  const i = t.sharedData;
  if (!i) throw new Error("This patch host does not support direct shared-data preparation.");
  if (r.signal?.aborted) throw new Error("Shared preparation cancelled.");
  const o = i.reserve(e.input, e.byteLength), a = r.signal?.onAbort(() => i.cancel(o.id));
  try {
    if (n(o), r.signal?.aborted) throw new Error("Shared preparation cancelled.");
    return await i.commit(o.id), { cancel: () => i.cancel(o.id) };
  } catch (s) {
    throw i.cancel(o.id), s;
  } finally {
    a?.();
  }
}
const al = 3, sl = (4 + De) * 4, cl = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [F],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(t) {
    let e = sr(t);
    return {
      apply(n, r) {
        return e.closed && (e = sr(t)), e.apply(n, r);
      },
      stop() {
        e.stop();
      }
    };
  }
};
function sr(t) {
  let e = !1, n = 0, r;
  const i = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
  function s(u) {
    const f = r;
    r = void 0, f ? f(u) : u.kind !== "cancelled" && t.report(u);
  }
  function c() {
    e || (e = !0, m.stop(), s({ kind: "cancelled" }), i.clear());
  }
  function d(u) {
    if (u.kind !== "submitted") {
      u.kind === "failed" && u.error.kind !== "transport" && (s(u), c());
      return;
    }
    i.add(u.completion), u.completion.then((f) => {
      i.delete(u.completion), !(e || f.kind === "sent") && (s(f), c());
    }, (f) => {
      e || (c(), t.fail(f));
    });
  }
  const l = {
    addEndpointListener(u, f) {
      const v = o.get(u) ?? /* @__PURE__ */ new Map();
      v.set(f, t.listen(u, f)), o.set(u, v);
    },
    removeEndpointListener(u, f) {
      o.get(u)?.get(f)?.(), o.get(u)?.delete(f);
    },
    addStoredStateValueListener(u) {
      a.set(u, t.subscribeStored(
        F,
        (f) => u({ key: F, value: f })
      ));
    },
    removeStoredStateValueListener(u) {
      a.get(u)?.(), a.delete(u);
    },
    requestFullStoredState(u) {
      t.readStored(F).then((f) => {
        e || u({ values: { [F]: f } });
      }, (f) => t.fail(f));
    },
    sendEventOrValue(u, f) {
      e || d(t.send({ kind: "event", endpoint: u, value: f }));
    }
  }, m = new Ni(l, {
    onDefect(u) {
      c(), t.fail(u);
    },
    curveCommand: (u, f, v) => ({
      async submit({ dspSessionId: p, deliverySerial: y, signal: S }) {
        const E = await t.prepareData(
          al + u * 2 + f,
          sl,
          (h) => {
            new Int32Array(h.buffer, h.byteOffset, 4).set([1297302855, p, y, De]), Wr(v, new Float32Array(h.buffer, h.byteOffset + 16, De));
          },
          S
        );
        E.kind === "failed" && (s(E), c());
      }
    }),
    async publishTriggerConfig(u) {
      const v = (await Promise.all(i)).find((y) => y.kind !== "sent");
      if (v) return v.kind === "failed" ? v : { kind: "cancelled" };
      if (e) return { kind: "cancelled" };
      const p = t.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: ui(u) });
      return p.kind === "submitted" ? p.completion : p;
    }
  });
  return {
    get closed() {
      return e;
    },
    apply(u, f) {
      if (e || f.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const v = ++n;
      return new Promise((p) => {
        const y = f.signal.onAbort(() => {
          s({ kind: "cancelled" }), c();
        });
        r = (S) => {
          y(), p(S);
        }, m.replaceModulation(u, (S) => {
          v === n && S.kind !== "preparing" && s(S);
        }), m.start();
      });
    },
    stop: c
  };
}
function Tn(t) {
  if (!(t === null || typeof t != "object")) {
    for (const e of Object.values(t)) Tn(e);
    Object.freeze(t);
  }
}
const ll = {
  parse(t) {
    const e = mc(t);
    return e ? (Tn(e), { kind: "ok", value: e }) : { kind: "error", message: "Invalid rack document." };
  },
  encode: Rt,
  equals: (t, e) => Rt(t) === Rt(e)
}, cr = /* @__PURE__ */ new WeakMap();
function wt(t) {
  if (!Object.isFrozen(t)) return JSON.stringify(zn(t));
  let e = cr.get(t);
  return e === void 0 && cr.set(t, e = JSON.stringify(zn(t))), e;
}
const ul = {
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
      for (const i of Reflect.get(e, "slots")) {
        if (i === null || typeof i != "object") continue;
        const o = Reflect.get(i, "routeAmounts");
        if (o !== null && typeof o == "object")
          for (const a of Object.keys(o)) n.add(a);
      }
    const r = gi(e, n);
    return r._tag === "err" ? { kind: "error", message: r.error.message } : (Tn(r.value), { kind: "ok", value: r.value });
  },
  encode: wt,
  equals: (t, e) => t === e || wt(t) === wt(e)
}, lr = [Ii, Se, zt, ot], dl = { kind: "sent", proof: "native-publication-processed" };
const fl = {
  eventEndpoints: lr,
  outputEndpoints: ["runtimeState"],
  replacement: "finish",
  create(t) {
    let e, n, r = 0, i = 0, o, a = !1, s = Promise.resolve();
    const c = (u) => Sn(u).filter((f) => lr.includes(f.endpointID));
    async function d(u, f, v = !1) {
      if (a || f.aborted) return { kind: "cancelled" };
      const p = c(u), y = e && !v ? c(e) : [], S = (g) => g.find((T) => T.endpointID === ot)?.value, E = y.length > 0 && JSON.stringify(S(y)) === JSON.stringify(S(p)), h = [];
      for (const g of p) {
        if (!E) {
          h.push(g);
          continue;
        }
        if (g.endpointID !== ot)
          if (g.endpointID === Se) {
            const T = g.value, x = y.find((Z) => Z.endpointID === g.endpointID && Z.value.slotId === T.slotId), B = x ? x.value.values : [], Y = T.values.flatMap((Z, Re) => Object.is(Z, B[Re]) ? [] : [Re]);
            Y.length === 1 ? h.push({
              endpointID: zt,
              value: { slotId: T.slotId, paramIndex: Y[0], value: T.values[Y[0]] }
            }) : Y.length > 1 && h.push(g);
          } else JSON.stringify(g.value) !== JSON.stringify(y.find((T) => T.endpointID === g.endpointID)?.value) && h.push(g);
      }
      e = void 0;
      for (const g of h) {
        if (a || f.aborted) return { kind: "cancelled" };
        const T = g.endpointID === Se || g.endpointID === zt ? { ...Object(g.value), deliverySerial: ++r } : g.value, x = t.send({ kind: "event", endpoint: g.endpointID, value: T }), B = x.kind === "submitted" ? await x.completion : x;
        if (B.kind !== "sent") return B;
      }
      return a || f.aborted ? { kind: "cancelled" } : (e = u, dl);
    }
    function l(u, f, v = !1) {
      const p = s.then(() => d(u, f, v));
      return s = p.catch(() => {
      }), p;
    }
    const m = t.listen("runtimeState", (u) => {
      const f = u !== null && typeof u == "object" ? Reflect.get(u, "dspSessionId") : void 0;
      if (typeof f != "number" || f === o) return;
      const v = o !== void 0;
      o = f;
      const p = i;
      v && n && l(n, t.signal, !0).then((y) => {
        y.kind === "failed" && p === i && t.report(y);
      }, t.fail);
    });
    return {
      apply(u, f) {
        return i += 1, n = u, l(u, f.signal);
      },
      stop() {
        a = !0, m();
      }
    };
  }
};
function Mt(t, e) {
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
const ml = {
  ...Mt("A", 0),
  ...Mt("B", 1),
  ...Mt("C", 1),
  ...Object.fromEntries(tn().map((t) => [t, 0])),
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
  [J]: Ce(),
  [Ie]: In(),
  [F]: ft()
}, hl = [
  { id: "init", name: "Init", values: ml }
], $i = "bounce.v1", pl = "cosimo.bounce", gl = 1, Bi = "cosimo.patch-document", Ki = 1;
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
function zi(t, e) {
  if (typeof t != "string") return ce(t, e);
  try {
    return ce(JSON.parse(t), e);
  } catch (n) {
    throw new Error(`${e} is not valid JSON: ${n instanceof Error ? n.message : n}`);
  }
}
function yl(t) {
  return JSON.stringify(ce(t));
}
function vl({ parameters: t, storedState: e } = {}) {
  _(Q(t), "Bounce patch parameters must be an object"), _(Q(e), "Bounce patch storedState must be an object");
  const n = {};
  for (const r of Object.keys(t).sort()) {
    const i = t[r];
    _(
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(r),
      `Invalid Bounce parameter endpoint ${r}`
    ), _(
      typeof i == "number" && Number.isFinite(i),
      `Bounce parameter ${r} must be finite`
    ), n[r] = i;
  }
  return Object.freeze({
    format: Bi,
    version: Ki,
    parameters: Object.freeze(n),
    storedState: Object.freeze(ce(e, "storedState"))
  });
}
function bl(t) {
  const e = zi(t, "Bounce patch document");
  return _(
    Q(e) && e.format === Bi && e.version === Ki,
    "Unsupported Bounce patch document"
  ), _(
    Object.keys(e).sort().join(",") === "format,parameters,storedState,version",
    "Bounce patch document has unexpected fields"
  ), vl(e);
}
function Vi(t) {
  const e = zi(t, $i);
  _(
    Q(e) && e.format === pl && e.version === gl,
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
  const i = e.revertRef.bankDigest;
  _(
    i === null || typeof i == "string" && /^[0-9a-f]{64}$/.test(i),
    "bounce.v1 revert bank digest is invalid"
  );
  const o = bl(e.revertRef.patchDocument);
  return Object.freeze({
    ...ce(e),
    revertRef: Object.freeze({
      bankDigest: i,
      patchDocument: o
    })
  });
}
function Il(t) {
  return yl(Vi(t));
}
const Sl = b("sourceMode", { preset: !1 });
function ji(t) {
  if (t !== null && typeof t == "object") {
    for (const e of Object.values(t)) ji(e);
    Object.freeze(t);
  }
  return t;
}
const ur = /* @__PURE__ */ new WeakMap();
function kt(t) {
  let e = ur.get(t);
  return e === void 0 && ur.set(t, e = Il(t)), e;
}
const Tl = {
  parse(t) {
    if (t === null) return { kind: "ok", value: null };
    try {
      return { kind: "ok", value: ji(Vi(t)) };
    } catch (e) {
      return { kind: "error", message: e instanceof Error ? e.message : String(e) };
    }
  },
  encode: (t) => t === null ? null : kt(t),
  equals: (t, e) => t === e || t !== null && e !== null && kt(t) === kt(e)
}, El = ae({ initial: null, codec: Tl, preset: !1 }), Al = Object.freeze({
  ...Object.fromEntries(Xe.flatMap(({ controls: t }) => t.map(({ endpointID: e }) => [e, b(e)]))),
  ...Object.fromEntries(tn().map((t) => [t, b(t)])),
  playMode: b("playMode"),
  glideTime: b("glideTime"),
  macro1: b("macro1"),
  macro2: b("macro2"),
  macro3: b("macro3"),
  macro4: b("macro4"),
  filterMode: b("filterMode"),
  filterCutoff: b("filterCutoff"),
  filterQ: b("filterQ"),
  mseg1Morph: b("mseg1Morph"),
  mseg2Morph: b("mseg2Morph"),
  mseg3Morph: b("mseg3Morph"),
  mseg1Rate: b("mseg1Rate"),
  mseg2Rate: b("mseg2Rate"),
  mseg3Rate: b("mseg3Rate"),
  env1Attack: b("env1Attack"),
  env1Decay: b("env1Decay"),
  env1Sustain: b("env1Sustain"),
  env1Release: b("env1Release"),
  env2Attack: b("env2Attack"),
  env2Decay: b("env2Decay"),
  env2Sustain: b("env2Sustain"),
  env2Release: b("env2Release"),
  env3Attack: b("env3Attack"),
  env3Decay: b("env3Decay"),
  env3Sustain: b("env3Sustain"),
  env3Release: b("env3Release"),
  filterMix: b("filterMix"),
  ampRelease: b("ampRelease"),
  sourceMode: Sl,
  globalTune: b("globalTune"),
  ampAttack: b("ampAttack"),
  ampDecay: b("ampDecay"),
  ampSustain: b("ampSustain"),
  filterCutoffKeyTrackEnabled: b("filterCutoffKeyTrackEnabled"),
  filterCutoffKeyTrackOffsetSemitones: b("filterCutoffKeyTrackOffsetSemitones"),
  voiceEnhancerFrequency: b("voiceEnhancerFrequency"),
  voiceEnhancerQ: b("voiceEnhancerQ"),
  voiceEnhancerAmount: b("voiceEnhancerAmount"),
  voiceEnhancerKeyTrackEnabled: b("voiceEnhancerKeyTrackEnabled"),
  voiceEnhancerKeyTrackOffsetSemitones: b("voiceEnhancerKeyTrackOffsetSemitones"),
  polishEnhancerAmount: b("polishEnhancerAmount"),
  polishCompressionClipAmount: b("polishCompressionClipAmount"),
  polishOutputTrimDb: b("polishOutputTrimDb"),
  polishSafeBassAmount: b("polishSafeBassAmount"),
  polishSafeBassBypass: b("polishSafeBassBypass"),
  polishEnhancerBypass: b("polishEnhancerBypass"),
  polishCompressionClipBypass: b("polishCompressionClipBypass"),
  polishOutputTrimBypass: b("polishOutputTrimBypass")
}), Rl = Uc({
  ...Al,
  [J]: Zn({ initial: Ce(), codec: Xc, prepare: (t) => t, engine: cl }),
  [Ie]: Zn({
    initial: In(),
    codec: ll,
    dependencies: tn(),
    prepare: (t, { parameters: e }) => yc(t, e),
    engine: fl
  }),
  [F]: ae({ initial: ft(), codec: ul }),
  [$i]: El,
  ...Hc({ factory: hl, initial: "init" }),
  ...Qc()
}), xl = { kind: "sent", proof: "native-publication-processed" };
function Ol(t) {
  if (typeof t != "object" || t === null) return;
  const e = Reflect.get(t, "values");
  return typeof e == "object" && e !== null ? Reflect.get(e, Ie) : void 0;
}
function wl(t, e) {
  const n = Rl[Ie];
  if (n.engine?.kind !== "prepared") throw new Error("The synth's rack field must declare its own delivery.");
  const { prepare: r, delivery: i } = n.engine;
  let o = !1;
  const a = /* @__PURE__ */ new Set(), s = {
    get aborted() {
      return o;
    },
    onAbort(h) {
      return a.add(h), () => a.delete(h);
    }
  }, c = Kc(t), d = [];
  function l(h, g) {
    t.addEndpointListener?.(h, g);
    const T = () => t.removeEndpointListener?.(h, g);
    return d.push(T), T;
  }
  const m = {
    signal: s,
    send(h) {
      if (o) return { kind: "cancelled" };
      if (h.kind !== "event") throw new Error(`The rack delivery sent an undeclared ${h.kind}.`);
      return t.sendEventOrValue?.(h.endpoint, h.value), { kind: "submitted", completion: Promise.resolve(xl) };
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
  }, u = i.create(m);
  let f, v = !1;
  async function p() {
    const h = f === void 0 ? n.initial : n.codec.parse(f);
    if (h.kind === "error") {
      e.onDefect(new Error(`The saved rack could not be read: ${h.message}`));
      return;
    }
    const g = await r(h.value, { resources: c, parameters: {}, reason: "load", signal: s });
    if (o) return;
    if (Cc(g)) {
      e.onDefect(new Error(`The saved rack could not be prepared: ${g.error.message}`));
      return;
    }
    const T = await u.apply(g, { signal: s, send: m.send, listen: l });
    T.kind === "failed" && e.onDefect(new Error(`The rack was not applied: ${T.error.message}`));
  }
  const y = () => {
    !o && v && p().catch(e.onDefect);
  }, S = (h) => {
    v || ki(h) === 0 || (v = !0, y());
  }, E = (h) => {
    typeof h != "object" || h === null || Reflect.get(h, "key") !== Ie || (f = Reflect.get(h, "value"), y());
  };
  return {
    start() {
      l(qt, S), t.addStoredStateValueListener?.(E), t.requestFullStoredState?.((h) => {
        f = Ol(h), y();
      });
    },
    stop() {
      if (!o) {
        o = !0;
        for (const h of a) h();
        a.clear(), t.removeStoredStateValueListener?.(E);
        for (const h of d.splice(0)) h();
        return u.stop();
      }
    }
  };
}
function U(t, e) {
  if (!t)
    throw new Error(e);
}
function _t(t, e, n) {
  let r = "";
  for (let i = 0; i < n; i += 1)
    r += String.fromCharCode(t.getUint8(e + i));
  return r;
}
function Ml(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function Jt(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Hi(t) {
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
function kl() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Dt(t, e) {
  const n = kl();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Ml(e))
      return new URL(e);
    const r = e.startsWith("/") ? e.slice(1) : e;
    return new URL(r, n);
  }
  return new URL(t, n);
}
async function dr(t) {
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
  throw new Error(`Unsupported text resource payload (${Hi(t)})`);
}
function _l(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return Jt(t);
  throw new Error(`Unsupported binary resource payload (${Hi(t)})`);
}
function Dl(t) {
  const e = t?.frames;
  U(
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
      U(a.length === 1, "Only mono wavetable source files are supported"), r[i] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: r
  };
}
function Wi(t) {
  const e = new DataView(t);
  U(_t(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), U(_t(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, r = null, i = null, o = null, a = null, s = null, c = null, d = 12;
  for (; d + 8 <= e.byteLength; ) {
    const m = _t(e, d, 4), u = e.getUint32(d + 4, !0), f = d + 8;
    m === "fmt " ? (n = e.getUint16(f, !0), r = e.getUint16(f + 2, !0), i = e.getUint32(f + 4, !0), a = e.getUint16(f + 12, !0), o = e.getUint16(f + 14, !0)) : m === "data" && (s = f, c = u), d = f + u + u % 2;
  }
  U(n !== null, "Wave file is missing a fmt chunk"), U(s !== null && c !== null, "Wave file is missing a data chunk"), U(r === 1, "Only mono wavetable bank files are supported");
  let l;
  if (n === 3 && o === 32)
    l = new Float32Array(t.slice(s, s + c));
  else if (n === 1 && o === 16) {
    const m = c / 2, u = new Int16Array(t.slice(s, s + c));
    l = new Float32Array(m);
    for (let f = 0; f < m; f += 1)
      l[f] = u[f] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${o}`);
  return {
    format: n,
    channelCount: r,
    sampleRate: i ?? 0,
    bitsPerSample: o,
    blockAlign: a ?? 0,
    samples: l
  };
}
async function fr(t) {
  U(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return U(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function Qt(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function qi(t) {
  const e = new Uint8Array(t).buffer, n = Wi(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Nl(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const r = async (c) => (U(typeof t.readResource == "function", `Resource bridge cannot read ${c}`), t.readResource(c)), i = async (c) => {
    U(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${c}`);
    const d = await t.readResourceAsAudioData(c);
    return Dl(d);
  }, o = (c) => {
    const d = t.getResourceAddress?.(c);
    return d ?? null;
  }, a = async (c, d = t.getResourceAddress?.(c)) => {
    const l = Dt(c, d), m = await fr(l), u = Wi(m);
    return {
      sampleRate: u.sampleRate,
      samples: u.samples
    };
  }, s = async (c, d = t.getResourceAddress?.(c)) => {
    const l = Dt(c, d);
    return new Uint8Array(await fr(l));
  };
  return {
    async readText(c) {
      if (e === "bridge" && typeof t.readResource == "function")
        return dr(await r(c));
      const d = o(c);
      return e === "url" && d !== null ? Qt(await s(c, d)) : typeof t.readResource == "function" ? dr(await r(c)) : Qt(await s(c, d));
    },
    async readJSON(c) {
      return JSON.parse(await this.readText(c));
    },
    async readBytes(c) {
      return typeof t.readResource == "function" ? _l(await r(c)) : s(c);
    },
    async readAudio(c) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return i(c);
      const d = o(c);
      return n === "url" && d !== null ? a(c, d) : typeof t.readResourceAsAudioData == "function" ? i(c) : qi(await this.readBytes(c));
    },
    getURL(c) {
      return Dt(c, t.getResourceAddress?.(c));
    }
  };
}
function Cl(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Nl(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Ll(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, r = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, i = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, o = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (r)
        return Qt(await r(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (r)
        return r(a);
      if (e)
        return Jt(await e(a));
      if (n)
        return Jt(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return i ? i(a) : qi(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function Pl(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Fl(t) {
  return Pl(t) ? Ll(t) : Cl(t);
}
const Ye = 2048;
function Oe(t, e) {
  if (!t)
    throw new Error(e);
}
function Ul(t) {
  Oe(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, r) => {
    Oe(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${r} must provide tableId`
    ), Oe(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${r} must provide name`
    ), Oe(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${r} must provide a positive frameCount`
    ), Oe(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${r} must provide sourceWav`
    );
  }), e;
}
const $l = 2048, lt = 11, Bl = 256;
function V(t, e) {
  if (!t)
    throw new Error(e);
}
function Kl(t) {
  return t > 0 && (t & t - 1) === 0;
}
const mr = /* @__PURE__ */ new Map();
function zl(t) {
  const e = mr.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), r = new Uint32Array(t);
  for (let i = 0; i < t; i += 1) {
    let o = 0, a = i;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    r[i] = o;
  }
  return mr.set(t, r), r;
}
function Gi(t, e, n = !1) {
  const r = t.length;
  V(r === e.length, "FFT real and imaginary buffers must have the same length"), V(Kl(r), "FFT input length must be a power of two");
  const i = zl(r);
  for (let o = 0; o < r; o += 1) {
    const a = i[o];
    if (a <= o)
      continue;
    const s = t[o];
    t[o] = t[a], t[a] = s;
    const c = e[o];
    e[o] = e[a], e[a] = c;
  }
  for (let o = 2; o <= r; o <<= 1) {
    const a = o >> 1, s = (n ? 2 : -2) * Math.PI / o, c = Math.cos(s), d = Math.sin(s);
    for (let l = 0; l < r; l += o) {
      let m = 1, u = 0;
      for (let f = 0; f < a; f += 1) {
        const v = l + f, p = v + a, y = t[p], S = e[p], E = m * y - u * S, h = m * S + u * y, g = t[v], T = e[v];
        t[v] = g + E, e[v] = T + h, t[p] = g - E, e[p] = T - h;
        const x = m * c - u * d;
        u = m * d + u * c, m = x;
      }
    }
  }
  if (n)
    for (let o = 0; o < r; o += 1)
      t[o] /= r, e[o] /= r;
}
function Ji(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const r = n / Math.max(1, e.length), i = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    i[o] = (Number(e[o]) || 0) - r;
  return i;
}
function Vl(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = $l,
  maxFramesPerTable: r = Bl
} = {}) {
  const i = Float32Array.from(t);
  V(i.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = i.length / n;
  V(o > 0, "Source wavetable files must contain at least one frame"), V(o <= r, `Source wavetable files must contain at most ${r} frames`), e !== void 0 && V(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const c = s * n, d = c + n;
    a.push(Ji(i.slice(c, d)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function hr(t) {
  const e = Ji(t), n = Float64Array.from(e), r = new Float64Array(n.length);
  return Gi(n, r, !1), n[0] = 0, r[0] = 0, {
    real: n,
    imaginary: r
  };
}
function Qi(t, e, {
  mipLevelCount: n = lt
} = {}) {
  const r = t?.real?.length ?? 0;
  V(r > 0, "Spectrum must contain real samples"), V(r === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), V(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const i = Math.min(1 << e, r >> 1), o = new Float64Array(r), a = new Float64Array(r);
  for (let s = 1; s <= i; s += 1) {
    o[s] = t.real[s], a[s] = t.imaginary[s];
    const c = (r - s) % r;
    c !== s && (o[c] = t.real[c], a[c] = t.imaginary[c]);
  }
  return Gi(o, a, !0), Float32Array.from(o);
}
const Ze = 256, we = 2048, Xi = 8, jl = 12811, Xt = (Xi + Ze * jl) * 4;
function pr(t, e, n) {
  const r = Math.fround(t * e);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(r + (r >= 0 ? 0.5 : -0.5)))
  ));
}
function Hl(t, e, n) {
  if (t.byteLength !== Xt || !Number.isInteger(e.frameCount) || e.frameCount < 1 || e.frameCount > Ze)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const r = new Int32Array(t.buffer, t.byteOffset, t.byteLength / 4);
  r.set([
    1465139788,
    1,
    e.dspSessionId,
    e.generation,
    e.tableIndex,
    e.frameCount,
    lt,
    Ze
  ]);
  let i = Xi;
  const o = 131071, a = 8191, s = Math.fround(o / 1.5), c = Math.fround(a / 0.5);
  for (let d = 0; d < lt; ++d) {
    const l = Math.min(we, Math.max(256, (1 << d) * 32)), m = we / l;
    for (let u = 0; u < e.frameCount; ++u) {
      const f = Qi(n(u), d), v = i + u * (l + 1);
      for (let p = 0; p <= l; ++p) {
        const y = (p === l ? 0 : p) * m, S = (y + we - m) % we, E = (y + m) % we, h = f[y], g = f[S], T = f[E];
        if (h === void 0 || g === void 0 || T === void 0 || !Number.isFinite(h) || !Number.isFinite(g) || !Number.isFinite(T))
          throw new Error("Wavetable preparation produced invalid samples.");
        const x = Math.fround(0.5 * Math.fround(T - g));
        r[v + p] = pr(h, s, o) & 262143 | pr(x, c, a) << 18;
      }
    }
    i += (l + 1) * Ze;
  }
}
const Wl = "runtimeSyncRequest", ql = 2147483647, Gl = "runtimeState", Jl = "retryDesiredTableRequest", Ql = "workerLoadFailure", Xl = "serviceLoadAbort", Yl = "wavetableLoadBegin", Zl = "wavetableMipFrame", eu = "wavetableUploadAck", tu = "wavetableMipRequest", nu = "wavetablePrewarmRequest", ru = "wavetablePrewarmNotification", iu = "assets/factory-bank-catalog.json", Yt = 3, ou = 1, au = Yt * Ye, su = 1, cu = 2, lu = 3, uu = 1, du = 2, fu = 2e4, He = su, gr = cu, yr = lu, G = uu, vr = du, mu = 48 * 1024 * 1024, Nt = 3;
function br(t, e) {
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
function Ir(t) {
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
function Sr(t, e, n) {
  const r = t + e;
  return t === 0 || r === n || r % 16 === 0;
}
function Tr(t, e) {
  if (!t)
    throw new Error(e);
}
function hu(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function pu(t, e) {
  return Ul(await t.readJSON(e));
}
function gu(t) {
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
function yu(t, e) {
  const n = Math.round(Number(t) || 0);
  return hu(n, 0, Math.max(0, e - 1));
}
function Ct(t, e, n, r, i) {
  return `${t}:${e}:${n}:${r}:${i}`;
}
function vu(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function Er(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Ar(t) {
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
function bu(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class Iu {
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
    this.connection = e, this.delivery = n.delivery ?? "events", this.resourceClient = Fl(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? iu, this.maxBatchesInFlight = br(
      n.maxFramesInFlight,
      ou
    ), this.mipLevelCount = n.mipLevelCount ?? lt, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? mu) || 0)), this.serviceLoadTimeoutMs = br(n.serviceLoadTimeoutMs, fu), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
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
    }), this.connection.addEndpointListener?.(Gl, this.handleRuntimeState), this.connection.addEndpointListener?.(eu, this.handleUploadAck), this.connection.addEndpointListener?.(tu, this.handleMipRequest), this.connection.addEndpointListener?.(nu, this.handlePrewarmRequest), this.connection.addEndpointListener?.(ru, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Wl,
      ql
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await pu(this.resourceClient, this.catalogPath), k("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < Nt; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = Er(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Er(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(r.cacheKey, r), this.tableCacheBytes += r.byteCount, this.evictCacheIfNeeded(), r;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const r = Ct(
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
          ...Ar(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== r || this.serviceTable.tableIndex !== i || !this.serviceLoadHasPendingTransfers()) && (k("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: yr,
          failureReasonCode: vr
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== yr || e.failureReasonCode !== vr ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: r,
    generation: i = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = He,
    failureReasonCode: s = G
  }) {
    this.connection.sendEventOrValue?.(Ql, {
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
    this.connection.sendEventOrValue?.(Xl, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: r,
      tableIndex: i,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(e) {
    k("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? Ir(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(Jl, e);
  }
  async loadTableSource(e, n) {
    const r = await this.ensureCatalogLoaded(), i = yu(e, r.tables.length), o = r.tables[i];
    Tr(o, `Could not resolve table ${i}`);
    const a = vu(o, Ye, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, k("info", "Using cached wavetable source table", {
        tableIndex: i,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const c = We();
    k("info", "Reading wavetable source", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const d = await this.resourceClient.readAudio(o.sourceWav), l = Vl(d.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: Ye
    });
    return k("info", "Prepared wavetable source table", {
      tableIndex: i,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: l.frameCount,
      loadDurationMs: Math.round(We() - c)
    }), this.rememberLoadedTable({
      cacheKey: a,
      tableIndex: i,
      tableMeta: o,
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
    this.connection.sendEventOrValue?.(Yl, {
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
      if (await ol(this.connection, {
        input: e.oscillatorIndex,
        byteLength: Xt
      }, (r) => {
        Hl(r, e, (i) => this.getSpectrumForFrame(i));
      }), this.serviceTable !== e || this.knownSessionId !== e.dspSessionId) return;
      k("info", "Submitted shared wavetable", {
        oscillatorIndex: e.oscillatorIndex,
        tableIndex: e.tableIndex,
        generation: e.generation,
        frameCount: e.frameCount,
        preparedBytes: Xt,
        preparationMs: We() - n,
        sampleUploadBytes: 0
      });
    } catch (r) {
      if (this.serviceTable !== e || this.knownSessionId !== e.dspSessionId) return;
      const i = this.candidateValidations[e.oscillatorIndex];
      i?.dspSessionId === e.dspSessionId && i.generation === e.generation && i.desiredIntentSerial === e.desiredIntentSerial && (this.candidateValidations[e.oscillatorIndex] = null), this.emitWorkerLoadFailure({
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: 0,
        tableIndex: e.tableIndex,
        candidateAttemptSerial: e.desiredIntentSerial,
        failurePhase: gr,
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
      const o = this.candidateValidations[e.oscillatorIndex];
      return o && o.dspSessionId === e.dspSessionId && o.generation === e.generation && o.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
    }
    let r = null;
    try {
      r = await this.loadTableSource(e.tableIndex);
    } catch (o) {
      return this.isCurrentRuntimeState(n) && (k("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: qe(o)
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
      this.isCurrentRuntimeState(e) && (k("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: qe(a)
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
    for (let e = 0; e < Nt; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, bu(() => {
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
        k("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
    const n = gu(e ?? {});
    if (k("info", "Received runtime state", Ir(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= Nt)
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
          i.spectra[a] || (i.spectra[a] = hr(i.frames[a]));
        const o = this.tableCache.get(i.cacheKey);
        o && this.refreshCacheEntryByteCount(o), k("info", "Prewarmed wavetable source table", {
          tableIndex: i.tableIndex,
          tableId: i.tableMeta.tableId,
          tableName: i.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (i) {
        k("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: r,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: qe(i)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), r = Math.trunc(Number(e?.oscillatorIndex)), i = Math.trunc(Number(e?.generation)), o = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), s = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || r !== this.serviceTable.oscillatorIndex || i !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const c = Ct(
      n,
      r,
      i,
      o,
      a
    );
    let d = this.mipJobs.get(c);
    return d ? (!d.completed && s > d.urgencyLevel && (d.urgencyLevel = s), d) : (d = {
      key: c,
      dspSessionId: n,
      oscillatorIndex: r,
      generation: i,
      tableIndex: o,
      mipIndex: a,
      urgencyLevel: s,
      ...Ar(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(c, d), d);
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
    const n = e ?? {}, r = Math.trunc(Number(n.dspSessionId)), i = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), c = Math.trunc(Number(n.frameIndexBase)), d = Math.trunc(Number(n.frameCount)), l = Ct(
      r,
      i,
      o,
      a,
      s
    ), m = this.mipJobs.get(l), u = this.serviceTable?.frameCount ?? 0, f = Math.min(
      Yt,
      u - c
    );
    if (!(!m || m.completed || !m.inFlightBatchBases.has(c) || d <= 0 || d !== f)) {
      m.inFlightBatchBases.delete(c);
      for (let v = 0; v < d; v += 1) {
        const p = c + v;
        m.ackedFrames[p] || (m.ackedFrames[p] = 1, m.ackedFrameCount += 1);
      }
      m.ackedFrameCount === u && m.nextFrameIndex >= u && m.inFlightBatchBases.size === 0 && (m.completed = !0, this.activeUploadKey === m.key && (this.activeUploadKey = null)), Sr(c, d, u) && k("info", "Acknowledged wavetable mip batch", {
        dspSessionId: r,
        oscillatorIndex: i,
        generation: o,
        tableIndex: m.tableIndex,
        mipIndex: s,
        frameIndexBase: c,
        batchFrameCount: d,
        ackedFrameCount: m.ackedFrameCount,
        frameCount: u,
        inFlightBatches: m.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (Tr(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = hr(this.serviceTable.frames[e]);
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
        Yt,
        this.serviceTable.frameCount - n
      ), i = new Float32Array(au);
      try {
        for (let o = 0; o < r; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), c = Qi(s, e.mipIndex);
          i.set(c, o * Ye);
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
            failurePhase: gr,
            failureReasonCode: G
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Zl, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: r,
        samples: Array.from(i)
      }), Sr(n, r, this.serviceTable.frameCount) && k("info", "Sent wavetable mip batch", {
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
function Su(t, e = {}) {
  return new Iu(t, e);
}
function Tu(t, e, n) {
  if (!Number.isFinite(t.durationSec) || t.durationSec <= 0)
    throw new Error("Speedrun performance duration must be positive and finite.");
  const r = Math.max(1, Math.round(t.durationSec * n)), i = t.events.map((a) => ({
    sample: Math.max(0, Math.min(r - 1, Math.round(a.atSec * n))),
    code: Math.trunc(a.code)
  })).sort((a, s) => a.sample - s.sample || a.code - s.code), o = [];
  for (let a = 0; a < e; a += r)
    for (const s of i) {
      const c = a + s.sample;
      c < e && o.push({ sample: c, code: s.code });
    }
  return o;
}
const Ge = 1600, Eu = /* @__PURE__ */ new Set([
  "runtimeState",
  "runtimeInstallAck",
  "effectiveRackState"
]);
function Me(t, e, n) {
  const r = `${e}_${n}`, i = t[r];
  if (typeof i != "function")
    throw new Error(`Offline performer is missing ${r}().`);
  return i.bind(t);
}
function Au(t) {
  return t && typeof t == "object" && "event" in t ? t.event : t;
}
function Ru(t) {
  return {
    values: {
      [J]: t.modulation,
      [Ie]: t.lane,
      [F]: t.articulations
    }
  };
}
class xu {
  performer;
  #i;
  #n;
  #s = /* @__PURE__ */ new Map();
  #l = /* @__PURE__ */ new Map();
  #h = /* @__PURE__ */ new Map();
  #d = /* @__PURE__ */ new Map();
  #t = /* @__PURE__ */ new Map();
  #o = /* @__PURE__ */ new Map();
  #c;
  #e;
  #f = null;
  #a = null;
  #m = null;
  #r = 0;
  constructor(e, n, r) {
    this.performer = new e(), this.#c = n, this.#e = new URL("./", r), this.#i = new Map(
      this.performer.getInputEndpoints().map((i) => [i.endpointID, i])
    ), this.#n = new Map(
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
      Me(this.performer, "sendInputEvent", e)(n), this.#t.set(e, (this.#t.get(e) ?? 0) + 1);
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
    e(Ru(this.#c));
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
    Me(
      this.performer,
      "setInputValue",
      e
    )(n, 0), this.#h.set(e, n);
    for (const i of this.#l.get(e) ?? []) i(n);
  }
  advance(e) {
    if (!Number.isInteger(e) || e < 1 || e > 128)
      throw new Error("OfflineEngineHost advances must contain 1 to 128 frames.");
    this.performer.advance(e), this.#r += e, this.drainOutputEvents();
  }
  drainOutputEvents() {
    const e = /* @__PURE__ */ new Set([
      ...Eu,
      ...this.#s.keys()
    ]);
    for (const n of e) {
      const r = this.#n.get(n);
      if (!r || r.endpointType !== "event") continue;
      const i = Me(
        this.performer,
        "getOutputEventCount",
        n
      )();
      if (i < 1) continue;
      const o = Me(
        this.performer,
        "getOutputEvent",
        n
      ), a = Array.from({ length: i }, (s, c) => Au(o(c)));
      Me(
        this.performer,
        "resetOutputEventCount",
        n
      )();
      for (const s of a) {
        this.#o.set(
          n,
          (this.#o.get(n) ?? 0) + 1
        ), this.recordDiagnostic(n, s);
        for (const c of this.#s.get(n) ?? []) c(s);
      }
    }
  }
  recordDiagnostic(e, n) {
    if (!n || typeof n != "object") return;
    const r = n;
    if (e === "runtimeState") {
      const i = Math.trunc(Number(r.oscillatorIndex));
      i >= 0 && i < 3 && this.#d.set(i, r);
    } else e === "runtimeInstallAck" ? this.#f = r : e === "effectiveRackState" && (this.#a = r);
  }
}
const Rr = "assets/factory-bank-catalog.json";
function Ou(t) {
  return {
    async readText(e) {
      if (e !== Rr) throw new Error(`Speedrun resource bundle has no text ${e}.`);
      return JSON.stringify(t.catalog);
    },
    async readJSON(e) {
      if (e !== Rr) throw new Error(`Speedrun resource bundle has no JSON ${e}.`);
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
const wu = [
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
function Mu(t) {
  let e = 0;
  for (const n of t) {
    if (n.endpointID !== Se || typeof n.value != "object" || n.value === null)
      continue;
    const r = n.value.deliverySerial;
    typeof r == "number" && Number.isFinite(r) && r > 0 && (e = Math.max(e, r));
  }
  return e;
}
function ku(t) {
  const e = Object.fromEntries(t.modulation.routes.flatMap((r) => {
    const i = un(r);
    return i === null ? [] : [[r.id, i]];
  })), n = Sn(t.lane);
  return {
    tableIndices: A.map((r) => Math.round(Number(t.parameters[`osc${r}WavetableSelect`]) || 0)),
    modulationFrontier: Kt(t.modulation, null).length,
    articulationFrontier: pi(
      t.articulations,
      e
    ).length,
    rackChainLength: Mi(t.lane).chainLength,
    rackParamSerial: Mu(n)
  };
}
function _u(t, e) {
  for (let i = 0; i < e.tableIndices.length; i += 1) {
    const o = t.runtimeStates.get(i);
    if (o && o.hasFailure && Number(o.failedTableIndex) === e.tableIndices[i])
      return new ye(
        "wavetable",
        `oscillator ${i + 1} rejected table ${e.tableIndices[i]}.`
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
function xr(t, e) {
  const n = e.tableIndices.every((a, s) => {
    const c = t.runtimeStates.get(s);
    return !!c?.hasActive && Number(c?.activeTableIndex) === a;
  }), r = e.modulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedModulationSerial) >= e.modulationFrontier, i = e.articulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedArticulationSerial) <= -e.articulationFrontier, o = Number(t.effectiveRackState?.laneCommittedChainLength) === e.rackChainLength && Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) >= e.rackParamSerial;
  return n && r && i && o;
}
function Du(t, e) {
  return e.tableIndices.every((n, r) => {
    const i = t.runtimeStates.get(r);
    return !!i?.hasActive && Number(i?.activeTableIndex) === n;
  }) ? e.modulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedModulationSerial) < e.modulationFrontier ? "modulation" : e.articulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedArticulationSerial) > -e.articulationFrontier ? "articulation" : "rack" : "wavetable";
}
function Nu(t) {
  return `${[0, 1, 2].map((n) => {
    const r = t.runtimeStates.get(n);
    return r ? `${n}:${Number(r.activeGeneration) || 0}/${Number(r.generationFrontier) || 0} load=${Number(r.loadingGeneration) || 0} active=${!!r.hasActive}` : `${n}:missing`;
  }).join(", ")}; mod=${Number(t.runtimeInstallAck?.acceptedModulationSerial) || 0} art=${Number(t.runtimeInstallAck?.acceptedArticulationSerial) || 0} rack=${Number(t.effectiveRackState?.laneCommittedChainLength) || 0} params=${Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) || 0} mipSent=${t.inputEventCounts.get("wavetableMipFrame") ?? 0} mipAck=${t.outputEventCounts.get("wavetableUploadAck") ?? 0}`;
}
function Yi(t) {
  return t >>> 16 & 255;
}
function Zi(t) {
  return t >>> 8 & 127;
}
function En(t) {
  return t & 127;
}
function Cu(t, e, n) {
  if (t === null) return null;
  let r;
  try {
    r = JSON.parse(t);
  } catch {
    return null;
  }
  const i = r.activeMode, o = i === "key" ? r.key : i === "vel" ? r.velocity : r.chain;
  if (!Array.isArray(o)) return null;
  const a = i === "key" ? Zi(e) : i === "vel" ? En(e) : n % 128, s = Math.trunc(Number(o[a]));
  return s >= 0 && s <= 127 ? s : null;
}
function Lu(t, e, n, r) {
  const i = Yi(e);
  if ((i & 240) === 144 && En(e) > 0) {
    const o = Cu(n, e, r);
    o !== null && t.sendEventOrValue("articulationNoteMeta", {
      channel: i & 15,
      noteNumber: Zi(e),
      selectorA: o,
      selectorB: 0,
      durationSamples: 0,
      ageSamples: 0
    });
  }
  t.sendMIDIInputEvent("midiIn", e);
}
function Pu(t) {
  return Object.fromEntries(Sn(t.lane).flatMap((e) => wr(e.endpointID) !== null && typeof e.value == "number" ? [[e.endpointID, e.value]] : []));
}
async function Fu() {
  await new Promise((t) => setTimeout(t, 0));
}
async function Uu(t, e) {
  const n = globalThis.performance?.now?.() ?? 0, r = new xu(t, {
    modulation: e.state.modulation,
    lane: e.state.lane,
    articulations: e.state.articulations
  }, e.resourceBaseURL);
  await r.initialise(e.sessionID, e.sampleRate), r.setInitialParameters({ ...e.state.parameters, ...Pu(e.state) }), r.sendEventOrValue("tempo", { bpm: 120 });
  const i = [], o = await bc(r, [
    _c,
    () => wl(r, {
      onDefect: (h) => {
        i.push(h);
      }
    }),
    () => Su(r, {
      maxFramesInFlight: 1,
      serviceLoadTimeoutMs: 2e4,
      ...e.resourceBundle ? { resourceClient: Ou(e.resourceBundle) } : {}
    })
  ]), a = ku(e.state), s = e.maxInstallFrames ?? e.sampleRate * 4;
  let c = 0;
  try {
    for (; c < s; ) {
      if (await r.pump(128), c += 128, i.length > 0) {
        const x = i[0];
        throw new ye("rack", x instanceof Error ? x.message : String(x), { cause: x });
      }
      const g = r.getInstallationState(), T = _u(g, a);
      if (T) throw T;
      if (xr(g, a)) break;
      c / 128 % 8 === 0 && await Fu();
    }
    const h = r.getInstallationState();
    if (!xr(h, a)) {
      const g = Du(h, a);
      throw new ye(
        g,
        `timed out after ${c} virtual frames (${Nu(h)}).`
      );
    }
  } finally {
    await o.stop();
  }
  const d = new Float32Array(e.frameCount * 2), l = Tu(e.performance, e.frameCount, e.sampleRate), m = r.getInstallationState().articulationTriggerConfig, u = e.recordTelemetry === !0, f = /* @__PURE__ */ new Map();
  let v = 0, p = 0, y = 0;
  u && (r.sendEventOrValue("filterSpectrumActivity", 1), r.sendEventOrValue("distortionScopeActivity", 1), r.sendEventOrValue("distortionHistoryActivity", 1));
  const S = u ? wu.map((h) => {
    const g = (T) => {
      const x = Math.floor(p / Ge), B = f.get(x) ?? {};
      B[h] = structuredClone(T), f.set(x, B);
    };
    return r.addEndpointListener(h, g), { endpointID: h, listener: g };
  }) : [];
  try {
    for (; p < e.frameCount; ) {
      for (; v < l.length && l[v].sample === p; ) {
        const x = l[v];
        Lu(r, x.code, m, y), (Yi(x.code) & 240) === 144 && En(x.code) > 0 && (y += 1), v += 1;
      }
      const h = l[v]?.sample ?? e.frameCount, g = (Math.floor(p / Ge) + 1) * Ge, T = Math.min(
        128,
        e.frameCount - p,
        h - p,
        ...u ? [g - p] : []
      );
      if (T < 1)
        throw new Error("Speedrun checkpoint render computed an empty advance.");
      r.render(T, d, p), p += T;
    }
  } finally {
    for (const { endpointID: h, listener: g } of S)
      r.removeEndpointListener(h, g);
  }
  const E = (globalThis.performance?.now?.() ?? n) - n;
  return {
    rootIndex: e.rootIndex,
    rootNote: e.rootNote,
    checkpointIndex: e.checkpointIndex,
    frameCount: e.frameCount,
    samples: d,
    telemetry: {
      frameCount: Math.ceil(e.frameCount / Ge),
      frames: [...f.entries()].sort(([h], [g]) => h - g).map(([h, g]) => ({ frame: h, events: g }))
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
function $u(t) {
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
    const r = await import(new URL(e.engineModuleURL, Je.location.href).href), i = r.default ?? r.WavetableSynth, o = await Uu(
      i,
      e.job
    );
    Je.postMessage({
      type: "render-root-complete",
      requestID: e.requestID,
      result: o
    }, [o.samples.buffer]);
  })().catch((n) => {
    Je.postMessage({
      type: "render-root-failed",
      requestID: e.requestID,
      error: $u(n)
    }, []);
  });
});
