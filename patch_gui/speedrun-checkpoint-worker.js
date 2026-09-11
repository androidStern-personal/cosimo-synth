const Zi = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function Kn(t) {
  const e = Zi.find((n) => n.deviceType === t);
  if (e === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${t}`);
  return e;
}
function C(t) {
  return Kn(t).laneEndpointID;
}
function er(t, e) {
  if (!Number.isInteger(e) || e < 1 || e > 5)
    throw new Error(`Effect Output Trim instance is out of range: ${e}`);
  return `${Kn(t).hostStem}${e}OutputTrimDb`;
}
function Bn(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function tr(t) {
  const e = (Bn(t, -100, 35) - -100) / 135;
  return e * e;
}
function nr(t) {
  return -100 + Math.sqrt(Bn(t, 0, 1)) * 135;
}
const L = (t, e) => ({ label: t, value: e });
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
}), h = (t, e, n, i, r, o, a, s = {}) => ({
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
  return h(
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
const ir = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], rr = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], or = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: B.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      h("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(L), quick: !0 }),
      h("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      h("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      h("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
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
      h("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [L("Classic", 0), L("Harmonics", 1)] }),
      h("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      h("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      h("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      h("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      h("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      h("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [L("Symmetric", 0), L("Asymmetric", 1), L("Wavefold", 2)] }),
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
      h("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      h("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      h("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      h("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      h("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
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
      h("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(L) }),
      h("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(L) }),
      h("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      h("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      h("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      h("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      h("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
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
      h("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      h("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      h("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      h("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      h("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
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
      h("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [L("Free", 0), L("Sync", 1)] }),
      h("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      h("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: ir.map(L) }),
      h("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      h("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      h("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      h("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      h("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
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
      h("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [L("Free", 0), L("Sync", 1)] }),
      h("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      h("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: rr.map(L) }),
      h("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      h("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      h("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
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
      h("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      h("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      h("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      h("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      $("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], ze = or, $n = Object.freeze(
  ze.flatMap((t) => t.parameters)
);
new Map(
  $n.map((t) => [t.endpointID, t])
);
function Vn(t) {
  const e = ze.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function zn() {
  return $n;
}
function At(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const v = ["A", "B", "C"], Hn = [
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
], ar = [
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
]), sr = Object.freeze([
  ...v.flatMap((t) => Hn.map(
    (e) => `osc${t}.${e}`
  )),
  ...ar
]);
new Set(
  v.flatMap((t) => Hn.map(
    (e) => `osc${t}.${e}`
  ))
);
const Wn = Object.freeze(
  sr.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), lr = zn().filter(
  (t) => t.modulationTargetIndex !== null
), cr = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function Rt(t) {
  const e = ur(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function ur(t) {
  const e = cr.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const dr = [
  ...lr.map((t) => ({
    kind: Rt(At(t)),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], qn = Object.freeze(
  dr.sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), W = Object.freeze([
  ...Wn,
  ...qn
]), we = Z.length, jn = Wn.length, He = qn.length, fr = we * W.length, mr = new Map(Z.map((t) => [t.id, t])), Gn = new Map(Z.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), ce = new Map(W.map((t) => [t.kind, t]));
function hr() {
  if (we !== 14 || jn !== 59 || He !== 47 || fr !== 1484)
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
  if (mr.size !== we || Gn.size !== we || ce.size !== W.length)
    throw new Error("Modulation identities must be unique");
}
hr();
function Jn(t, e) {
  const n = Gn.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function xt(t) {
  return typeof t != "string" ? null : ce.has(t) ? t : null;
}
function pr(t) {
  const e = xt(t);
  return e !== null && ce.get(e)?.group === "voice" ? e : null;
}
function Mt(t) {
  const e = xt(t);
  return e !== null && ce.get(e)?.group === "rack" ? e : null;
}
function gr(t) {
  const e = ce.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function Qn(t) {
  const e = ce.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function Ir(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const Xn = 4, yr = Xn * He, Sr = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), vr = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function ee(t) {
  if (typeof t != "string")
    return null;
  const e = vr.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Sr.get(n);
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
function Yn(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function Zn(t) {
  if (t === null)
    return null;
  const e = Yn(t) - 1;
  return e > Xn ? null : e * He + Qn(Ot(t));
}
const H = 2048, br = H + 3, qt = 20, ei = "MSEG 1", Tr = 0, j = 2, Er = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function _t(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function le(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function Ar(t) {
  return _t(Number.isFinite(t) ? t : 0, -qt, qt);
}
function Y(t) {
  return _t(Number.isFinite(t) ? t : 0, 0, 1);
}
function ti(t = ei) {
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
function ut() {
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
function Rr(t) {
  const e = Number(t);
  return _t(
    Number.isFinite(e) ? e : 1,
    Tr,
    j
  );
}
function xr(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = Y(Number(e.startX)), i = Y(Number(e.endX));
  return le(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function Mr(t = ut()) {
  const e = t && typeof t == "object" ? t : {}, n = e.rate && typeof e.rate == "object" ? e.rate : {}, i = Number(n.seconds), r = e.noteOffPolicy, o = Er.has(r) ? r : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: Rr(Number.isFinite(i) ? i : 1)
    },
    loop: xr(e.loop),
    noteOffPolicy: o,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function Or(t, e, n) {
  const i = t && typeof t == "object" ? t : {};
  let r = Number(i.x);
  return Number.isFinite(r) || (r = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (r = Y(r)), {
    x: r,
    y: Y(Number(i.y)),
    curvePower: Ar(Number(i.curvePower))
  };
}
function Ie(t = ti()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((r, o) => Or(r, o, n.length));
  if (!le(i[0].x, 0) || !le(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let r = 1; r < i.length; r += 1)
    if (i[r].x < i[r - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : ei,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function jt(t) {
  return JSON.stringify(Ie(t));
}
function _r(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function wr(t, e) {
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
function kr(t, e) {
  const n = Y(Number(e)), i = wr(t, n);
  if (i.laterPointWins || le(i.from.x, i.to.x))
    return i.to.y;
  const r = i.to.x - i.from.x, o = r <= 0 ? 1 : (n - i.from.x) / r, a = Y(_r(o, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * a;
}
function Dr(t, e) {
  return kr(Ie(t).points, e);
}
function Lr(t) {
  const e = Ie(t), n = new Float32Array(H);
  for (let r = 0; r < H; r += 1) {
    const o = r / (H - 1);
    n[r] = Dr(e, o);
  }
  const i = new Float32Array(br);
  return i[0] = n[0], i.set(n, 1), i[H + 1] = n[H - 1], i[H + 2] = n[H - 1], i;
}
function Gt(t, e) {
  return jt(t) === jt(e);
}
const qe = "modulationProgram", Nr = "modulationAmount", ni = Z.filter((t) => t.group === "voice").length, ii = Z.filter((t) => t.group === "macro").length, Le = jn, Cr = He, Ne = Cr + yr, G = ni * Le, ne = ii * Le, Pr = ni * Ne, Fr = ii * Ne, q = 512, te = 256, ri = G + ne;
function Ur(t) {
  const e = Jn(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function Kr(t) {
  const e = pr(t);
  return e === null ? null : gr(e);
}
function oi(t) {
  const e = Kr(t.targetKind), n = Mt(t.targetKind);
  let i = n === null ? void 0 : Qn(n);
  if (i === void 0) {
    const a = Zn(
      ee(t.targetKind)
    );
    a !== null && (i = a);
  }
  if (e === null && i === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = Jn(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (e !== null) {
      const u = s * Le + e;
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
      cellIndex: s * Ne + l,
      sourceIndex: s,
      targetIndex: l,
      articulationCellIndex: null
    };
  }
  const r = Ur(t);
  if (e !== null) {
    const a = r * Le + e;
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
    cellIndex: r * Ne + o,
    sourceIndex: r,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function wt(t) {
  return ee(t.targetKind) !== null ? null : oi(t).articulationCellIndex;
}
function Br(t) {
  if (Mt(t.targetKind) !== null)
    return !1;
  const e = ee(t.targetKind);
  return e !== null && Zn(e) === null;
}
function $r(t) {
  return {
    ...oi(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function ai(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (Br(n))
      continue;
    const i = $r(n), r = e[i.path];
    if (r.has(i.cellIndex))
      throw new Error(`Duplicate modulation route cell ${i.path}:${i.cellIndex}`);
    r.set(i.cellIndex, i);
  }
  return e;
}
function Vr(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function ie(t) {
  return [...t.values()].filter(Vr).sort((e, n) => e.cellIndex - n.cellIndex);
}
function be(t, e, n, i, r) {
  for (let o = 0; o < t.length; o += 1) {
    const a = t[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    e[o] = a.cellIndex, n[o] = a.sourceIndex, i[o] = a.targetIndex, r[o] = a.polarity;
  }
}
function je(t) {
  const e = ai(t), n = ie(e.voice), i = ie(e.macroVoice), r = ie(e.voiceRack), o = ie(e.macroRack), a = Array.from({ length: G }, () => 0), s = Array.from({ length: G }, () => 0), l = Array.from({ length: G }, () => 0), u = Array.from({ length: G }, () => 0), c = Array.from({ length: G }, () => 0);
  be(n, a, s, l, u);
  const d = Array.from({ length: ne }, () => 0), p = Array.from({ length: ne }, () => 0), f = Array.from({ length: ne }, () => 0), g = Array.from({ length: ne }, () => 0), m = Array.from({ length: ne }, () => 0);
  if (be(
    i,
    d,
    p,
    f,
    g
  ), r.length > q || o.length > te)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${r.length} voice-rack (max ${q}), ${o.length} macro-rack (max ${te})`
    );
  const S = Array.from({ length: q }, () => 0), M = Array.from({ length: q }, () => 0), T = Array.from({ length: q }, () => 0), I = Array.from({ length: q }, () => 0), R = Array.from({ length: q }, () => 0), O = Array.from({ length: Pr }, () => 0);
  be(
    r,
    S,
    M,
    T,
    I
  );
  const N = Array.from({ length: te }, () => 0), $t = Array.from({ length: te }, () => 0), Vt = Array.from({ length: te }, () => 0), zt = Array.from({ length: te }, () => 0), Ht = Array.from({ length: Fr }, () => 0);
  be(
    o,
    N,
    $t,
    Vt,
    zt
  );
  for (const k of e.voice.values()) c[k.cellIndex] = k.amount;
  for (const k of e.macroVoice.values()) m[k.cellIndex] = k.amount;
  for (const k of e.voiceRack.values()) O[k.cellIndex] = k.amount;
  for (const k of e.macroRack.values()) Ht[k.cellIndex] = k.amount;
  for (let k = 0; k < r.length; k += 1) {
    const Wt = r[k];
    if (Wt === void 0) throw new Error(`Missing compiled voice-rack route at index ${k}`);
    R[k] = Wt.reducer;
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
    macroVoiceRouteTargets: f,
    macroVoiceRoutePolarities: g,
    macroVoiceRouteAmounts: m,
    voiceRackRouteCount: r.length,
    voiceRackRouteCells: S,
    voiceRackRouteSources: M,
    voiceRackRouteTargets: T,
    voiceRackRoutePolarities: I,
    voiceRackRouteReducers: R,
    voiceRackRouteAmounts: O,
    macroRackRouteCount: o.length,
    macroRackRouteCells: N,
    macroRackRouteSources: $t,
    macroRackRouteTargets: Vt,
    macroRackRoutePolarities: zt,
    macroRackRouteAmounts: Ht
  };
}
const zr = ["voice", "macroVoice", "voiceRack", "macroRack"], Hr = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function Jt(t) {
  return ai(t);
}
function Wr(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function qr(t, e) {
  if (t === null)
    return [{ endpointID: qe, value: je(e) }];
  const n = Jt(t), i = Jt(e), r = [];
  for (const o of zr) {
    const a = ie(n[o]), s = ie(i[o]);
    if (a.length !== s.length)
      return [{ endpointID: qe, value: je(e) }];
    for (let l = 0; l < s.length; l += 1) {
      const u = a[l], c = s[l];
      if (u === void 0 || c === void 0 || !Wr(u, c))
        return [{ endpointID: qe, value: je(e) }];
      u.amount !== c.amount && r.push({
        endpointID: Nr,
        value: {
          pathKind: Hr[o],
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
function jr(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Gr(t) {
  throw new Error(t ?? "Invariant violated");
}
const Jr = "globalTune", Qr = "globalTuneSemitones", V = -24, de = 24, Qt = 0, si = -48, li = 48, dt = -48, ci = 6, kt = 0, Xt = (kt - dt) / (ci - dt), Xr = "voiceEnhancerFrequency", Yr = "voiceEnhancerQ", Zr = "voiceEnhancerAmount", eo = "voiceEnhancerFrequencyOctaves", to = "voiceEnhancerQ", no = "voiceEnhancerAmount", ui = "voice.enhancerFrequency", io = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: Xr,
    targetKind: eo,
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
    endpointID: Yr,
    targetKind: to,
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
    endpointID: Zr,
    targetKind: no,
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
function Yt(t, e) {
  const n = Math.min(t.max, Math.max(t.min, e));
  return t.scale === "log" ? Math.log(n / t.min) / Math.log(t.max / t.min) : (n - t.min) / (t.max - t.min);
}
function ro(t, e) {
  const n = Math.min(1, Math.max(0, e));
  return t.scale === "log" ? t.min * (t.max / t.min) ** n : t.min + (t.max - t.min) * n;
}
function Te(t, e, n, i, r = "percent", o = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: o };
}
const oo = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      Te("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      Te("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      Te("mix", "Mix", 100, 100),
      Te("drive", "Drive", 15, 0)
    ]
  }
], Zt = 1e-6;
function F(t, e) {
  if (!Number.isFinite(t) || t < -Zt || t > 1 + Zt)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function Ce(t, e) {
  return F(t / 100, `${e} catalog percentage`);
}
function ye(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function ao(t) {
  return 20 * 1e3 ** t;
}
function so(t) {
  return F(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function lo(t) {
  return 0.1 * 200 ** t;
}
function co(t) {
  return F(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function uo(t) {
  return t;
}
function fo(t) {
  return F(t, "filterMix endpoint conversion");
}
function ae(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function mo(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: ae("filterCutoff", ao, so),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: ae("filterQ", lo, co),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: ae("filterMix", uo, fo),
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
function di(t) {
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
      return jr(t);
  }
}
function ho(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function po(t, e) {
  const n = ye(t.moduleId, e.id), i = di(e.format), r = mo(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: Ce(e.defaultPercent, n),
    initialValue: Ce(e.initialPercent, n),
    format: i,
    modAmount: ho(i),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const go = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Xt * 100, defaultPercent: Xt * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Io(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function yo(t, e) {
  const n = `osc${t}`, i = ye(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: Ce(e.defaultPercent, i),
    initialValue: Ce(e.initialPercent, i),
    format: di(e.format),
    modAmount: Io(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const So = Object.freeze(
  v.flatMap((t) => go.map((e) => yo(t, e)))
), vo = Object.freeze({
  targetId: ye("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: F(
    (Qt - V) / (de - V),
    "Global Tune default"
  ),
  initialValue: F(
    (Qt - V) / (de - V),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: de },
  modAmount: {
    min: si,
    max: li,
    unit: "st",
    digits: 2
  },
  binding: ae(
    Jr,
    (t) => V + (de - V) * t,
    (t) => F(
      (t - V) / (de - V),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: Qr
});
function bo(t) {
  const e = ye("voice-enhancer", t.key), n = F(
    Yt(t, t.initial),
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
      (i) => ro(t, i),
      (i) => F(
        Yt(t, i),
        `${t.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: t.targetKind
  });
}
const To = Object.freeze(
  Object.values(io).map(bo)
), Eo = Object.freeze([
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
function Ao(t) {
  const e = ye(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (o) => t.min + n * o, r = (o) => F(
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
const Ro = Object.freeze(
  Eo.map(Ao)
), xo = Object.freeze([
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
function Mo(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function Ge(t, e) {
  const n = t.valueKind === "effect-output-trim-db" ? tr(e) : t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return F(n, `${t.endpointID} endpoint conversion`);
}
function Oo(t, e) {
  return t.valueKind === "effect-output-trim-db" ? nr(e) : t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function _o(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function wo(t) {
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
function ko(t) {
  const e = Mo(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: Ge(t, t.initial),
    initialValue: Ge(t, t.initial),
    format: _o(t),
    modAmount: wo(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Oo(t, n),
      fromEngine: (n) => Ge(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : Rt(At(t))
  });
}
const Dt = Object.freeze(
  [
    ...ze.flatMap((t) => t.parameters.map(ko)),
    ...xo,
    vo,
    ...To,
    ...So,
    ...Ro,
    ...oo.flatMap(
      (t) => t.parameters.map(
        (e) => po(t, e)
      )
    )
  ]
), Do = new Map(
  Dt.map((t) => [t.targetId, t])
), fi = Dt.filter(
  (t) => t.modulationTargetKind !== null
), ft = new Map(
  fi.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Do.size !== Dt.length)
  throw new Error("Target descriptor IDs must be unique");
if (fi.length !== W.length || ft.size !== W.length || W.some((t) => ft.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function Je(t) {
  const e = ft.get(t);
  return e === void 0 ? Gr(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  ze.map((t) => [t.id, t.label])
);
function Lo(t) {
  const e = Yn(t);
  return e === 1 ? "" : ` ${e}`;
}
function No(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = Je(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = ee(t);
  if (n !== null) {
    const i = Je(Ot(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : i.moduleId.toUpperCase()}${Lo(n)} ${i.label.toUpperCase()}`;
  }
  return Je(t).label.toUpperCase();
}
const Q = "modulation.v6", mi = 6, Se = 3, re = 3, Co = 4, en = "modulationMsegBuffer", Po = "modulationMsegPlayback", hi = 4, Fo = ["MSEG 1", "MSEG 2", "MSEG 3"], pi = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], Uo = ["Env 1", "Env 2", "Env 3"], Ko = 1e-3, E = 10, Bo = 0.1, $o = 20, tn = 10 - 0.1, Vo = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: $o - Bo },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: si,
    max: li
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
  env1Attack: { min: -E, max: E },
  env1Decay: { min: -E, max: E },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -E, max: E },
  env2Attack: { min: -E, max: E },
  env2Decay: { min: -E, max: E },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -E, max: E },
  env3Attack: { min: -E, max: E },
  env3Decay: { min: -E, max: E },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -E, max: E },
  ampAttack: { min: -E, max: E },
  ampDecay: { min: -E, max: E },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -E, max: E },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -tn, max: tn },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, zo = zn().filter((t) => t.modulationTargetIndex !== null), Ho = new Map(
  zo.map((t) => [
    Rt(At(t)),
    t
  ])
);
class Qe extends Error {
  name = "ModulationStateParseError";
}
const Wo = {
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
  label: Wo[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const qo = W.map((t) => ({
  value: t.kind,
  label: No(t.kind)
}));
qo.filter((t) => !Go(t.value));
function jo(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Lt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function Xe(t, e) {
  const n = Number(t);
  return Lt(Number.isFinite(n) ? n : e, Ko, E);
}
function Go(t) {
  return Mt(t) !== null;
}
function Jo(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (t.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function Qo(t) {
  const e = ee(t);
  return e !== null ? Ot(e) : t;
}
function Xo(t) {
  const e = Qo(t);
  if (ee(e)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = Ho.get(e);
  return n !== void 0 ? Jo(n) : Vo[Ir(e)];
}
function Yo(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Zo(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function ea(t, e) {
  const n = Xo(t), i = Number(e);
  return Lt(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function ta(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function na(t) {
  return ta(t) ?? "mseg";
}
function ia(t) {
  const e = xt(t);
  return e !== null ? e : ee(t) !== null ? t : null;
}
function ra(t) {
  return ia(t) ?? "oscA.wavetablePosition";
}
function oa(t, e) {
  const n = pi[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function aa(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? Se : t === "macro" ? hi : Co;
  return Lt(Number.isFinite(n) ? n : 1, 1, i);
}
function oe(t) {
  return {
    name: Uo[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function gi(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = oe(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: Xe(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: Xe(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: Y(n.sustain ?? i.sustain),
    releaseSeconds: Xe(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function sa(t, e = 0) {
  return { name: gi(t, e).name };
}
function la(t, e, n, i) {
  const r = Number(t.amount);
  return {
    id: Yo(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: aa(n, t.sourceSlot),
    polarity: Zo(t.polarity),
    targetKind: i,
    amount: ea(i, r),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function ca(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, r = na(i.sourceKind), o = ra(i.targetKind);
  return la(i, e, r, o);
}
function ua(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function da(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => ca(n, i));
}
function fa(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const r = ua(i);
    if (e.has(i.id) || n.has(r))
      return !1;
    e.add(i.id), n.add(r);
  }
  return !0;
}
function mt(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, s) => mt(a, e[s]));
  const n = t, i = e, r = Object.keys(n), o = Object.keys(i);
  return r.length === o.length && r.every((a) => jo(i, a) && mt(n[a], i[a]));
}
function Ii(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = ti(Fo[e] ?? `MSEG ${e + 1}`), r = Ie(n.shapeA ?? i), o = Mr({
    ...ut(),
    ...n.playback ?? {},
    rate: ut().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: r,
    shapeB: Ie(n.shapeB ?? r),
    playback: s
  };
}
function Pe() {
  return {
    format: "cosimo.modulation",
    version: mi,
    msegSlots: Array.from({ length: Se }, (t, e) => Ii({}, e)),
    envelopeSlots: Array.from({ length: re }, (t, e) => ({
      name: oe(e).name
    })),
    routes: [],
    macroNames: pi.slice()
  };
}
function ma(t = Pe()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], r = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: mi,
    msegSlots: Array.from({ length: Se }, (o, a) => Ii(n[a], a)),
    envelopeSlots: Array.from({ length: re }, (o, a) => sa(i[a], a)),
    routes: da(e.routes),
    macroNames: Array.from(
      { length: hi },
      (o, a) => oa(r[a], a)
    )
  };
}
function Ye(t) {
  const e = Fe(t);
  if (e._tag === "err")
    throw e.error;
  return JSON.stringify(e.value);
}
function Fe(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return ge(new Qe("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return ge(new Qe("Expected valid modulation JSON"));
    }
  }
  const n = ma(e);
  return !mt(e, n) || !fa(n.routes) ? ge(new Qe("Expected the current modulation schema")) : ue(n);
}
function ha(t, e) {
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
function nn(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(Lr(n))
  };
}
function pa(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function yi(t, e = null) {
  const n = [];
  for (let i = 0; i < Se; i += 1) {
    const r = t.msegSlots[i], o = e?.msegSlots[i];
    (o === void 0 || !Gt(o.shapeA, r.shapeA)) && n.push({
      endpointID: en,
      value: nn(i, 0, r.shapeA)
    }), (o === void 0 || !Gt(o.shapeB, r.shapeB)) && n.push({
      endpointID: en,
      value: nn(i, 1, r.shapeB)
    }), (o === void 0 || !pa(o.playback, r.playback)) && n.push({
      endpointID: Po,
      value: ha(i, r.playback)
    });
  }
  return n.push(...qr(e?.routes ?? null, t.routes)), n;
}
const Ze = "articulationSnapshot", A = 128, rn = 48, ga = 1e6, w = -1, et = [
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
function Nt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function tt(t) {
  return Nt(Number.isFinite(t) ? t : 0, 0, 1);
}
function D(t, e, n = -Number.MAX_VALUE, i = Number.MAX_VALUE) {
  const r = Number(t);
  return Nt(Number.isFinite(r) ? r : e, n, i);
}
function _(t, e, n, i) {
  return Nt(Math.round(D(t, e)), n, i);
}
function Si(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function nt() {
  return Array.from({ length: A }, () => w);
}
function Ia(t) {
  const e = _(t, 0, 0, A - 1), n = et[e % et.length], i = Math.floor(e / et.length);
  return i === 0 ? n : `${n} ${i + 1}`;
}
function ya() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: kt,
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
function Sa(t) {
  const e = ya(), n = t && typeof t == "object" ? t : {}, i = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: D(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: D(n.pan, e.pan, -1, 1),
    octave: _(n.octave, e.octave, -4, 4),
    semitone: _(n.semitone, e.semitone, -12, 12),
    fineCents: D(n.fineCents, e.fineCents, -100, 100),
    volumeDb: D(
      n.volumeDb,
      e.volumeDb,
      dt,
      ci
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
      tt(Number(i[0])),
      tt(Number(i[1])),
      tt(Number(i[2]))
    ]
  };
}
function va(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: D(e.amount, 0, -48, 48)
  } : null;
}
function ba(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(va).filter((r) => r !== null) : [], i = /* @__PURE__ */ new Map();
  for (const r of n)
    i.set(r.routeId, r);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Sa(e.parameters),
    envelopes: [0, 1, 2].map((r) => gi(
      Array.isArray(e.envelopes) ? e.envelopes[r] : void 0,
      r
    )),
    modRouteAmounts: [...i.values()]
  };
}
function Ta(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = _(n.runtimeSlot, e, 0, A - 1), r = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${i}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Ia(i);
  return {
    id: r,
    runtimeSlot: i,
    name: o,
    snapshot: ba(n.snapshot)
  };
}
function Ea(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(i) ? {
    note: _(n.note, 0, 0, A - 1),
    articulationId: i
  } : null;
}
function Aa(t, e, n, i, r) {
  if (!t || typeof t != "object")
    return null;
  const o = t, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let s = _(o.min, r, r, A - 1), l = _(o.max, s, r, A - 1);
  return l < s && ([s, l] = [l, s]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${i}-${n}`,
    articulationId: a,
    min: s,
    max: l
  };
}
function on(t, e, n, i) {
  const r = Array.isArray(t) ? t : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < r.length; s += 1) {
    const l = Aa(
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
function Ra(t, e) {
  const n = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), r = [];
  for (const o of n) {
    const a = Ea(o, e);
    !a || i.has(a.note) || (i.add(a.note), r.push(a));
  }
  return r;
}
function xa(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], i = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), o = [];
  for (let l = 0; l < n.length && o.length < A; l += 1) {
    const u = Ta(n[l], l);
    !u || i.has(u.runtimeSlot) || r.has(u.id) || (i.add(u.runtimeSlot), r.add(u.id), o.push(u));
  }
  const a = typeof e.selectedSlotId == "string" && o.some((l) => l.id === e.selectedSlotId) ? e.selectedSlotId : null, s = new Set(o.map((l) => l.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: Si(e.activeTriggerMode),
    slots: o,
    chainAssignments: on(e.chainAssignments, s, "chain", 0),
    keyAssignments: Ra(e.keyAssignments, s),
    velocityAssignments: on(e.velocityAssignments, s, "velocity", 1)
  };
}
function an(t) {
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
    volumeDbs: e(kt),
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
    msegMorphs: Array.from({ length: Se }, () => 0),
    routeAmounts: Array.from({ length: ri }, () => 0),
    envelopeAttackSeconds: Array.from({ length: re }, (n, i) => oe(i).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: re }, (n, i) => oe(i).decaySeconds),
    envelopeSustain: Array.from({ length: re }, (n, i) => oe(i).sustain),
    envelopeReleaseSeconds: Array.from({ length: re }, (n, i) => oe(i).releaseSeconds)
  };
}
function sn(t, e, n) {
  for (const i of e) {
    const r = n.get(i.articulationId);
    if (r !== void 0)
      for (let o = i.min; o <= i.max; o += 1)
        t[o] === w && (t[o] = r);
  }
}
function Ma(t) {
  const e = xa(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), i = nt(), r = nt(), o = nt();
  sn(i, e.chainAssignments, n), sn(o, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || r[a.note] !== w || (r[a.note] = s);
  }
  return o[0] = w, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: i,
    key: r,
    velocity: o
  };
}
function Oa(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Ma(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: Si(e.activeMode),
    chain: Array.from({ length: A }, (n, i) => _(e.chain?.[i], w, w, A - 1)),
    key: Array.from({ length: A }, (n, i) => _(e.key?.[i], w, w, A - 1)),
    velocity: Array.from({ length: A }, (n, i) => i === 0 ? w : _(e.velocity?.[i], w, w, A - 1))
  });
}
function _a(t, e) {
  const n = Oa(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const i = globalThis;
  typeof i.cosimo_set_articulation_trigger_config == "function" && i.cosimo_set_articulation_trigger_config(n);
}
const J = "articulations.v4", Ct = [
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
], Pt = [
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
], wa = [
  ...v.flatMap((t) => Ct.map(
    (e) => `osc${t}.${e}`
  )),
  ...Pt
];
class vi extends Error {
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
function y(t) {
  return ge(new vi("malformed", t));
}
function ve(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Ft(t, e, n) {
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
function Ue(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < A;
}
function ka(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function Da(t) {
  return wa.some((e) => e === t);
}
function ln(t, e) {
  if (!ve(t))
    return y(`${e} must be an object`);
  const n = Ft(t, ["min", "max"], e);
  return n !== null ? y(n) : Ue(t.min) ? Ue(t.max) ? t.min > t.max ? y(`${e}.min must be less than or equal to ${e}.max`) : ue({ min: t.min, max: t.max }) : y(`${e}.max must be an integer in 0..127`) : y(`${e}.min must be an integer in 0..127`);
}
function La(t, e) {
  if (!ve(t))
    return y(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return y(`${e} has a non-string parameter id`);
    if (!Da(i))
      return y(`${e} has unknown parameter id "${i}"`);
    const r = t[i];
    if (typeof r != "number" || !Number.isFinite(r))
      return y(`${e}.${i} must be a finite number`);
    n[i] = r;
  }
  return ue(n);
}
function Na(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function Ca() {
  return {};
}
function Pa(t, e, n) {
  if (!ve(t))
    return y(`${e} must be an object`);
  const i = Ca();
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return y(`${e} has a non-string route id`);
    const o = t[r];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > rn)
      return y(
        `${e}.${r} must be a finite route amount within ±${rn}`
      );
    if (!n.has(r))
      return y(`${e}.${r} does not name a current articulable mapping`);
    Na(i, r, o);
  }
  return ue(i);
}
function Fa(t, e, n) {
  const i = `slots[${e}]`;
  if (!ve(t))
    return y(`${i} must be an object`);
  const r = Ft(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    i
  );
  if (r !== null)
    return y(r);
  if (typeof t.id != "string")
    return y(`${i}.id must be a string`);
  if (!Ue(t.runtimeSlot))
    return y(`${i}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return y(`${i}.name must be a string`);
  if (typeof t.color != "string")
    return y(`${i}.color must be a string`);
  if (!Ue(t.key))
    return y(`${i}.key must be an integer in 0..127`);
  const o = ln(t.velRange, `${i}.velRange`);
  if (o._tag === "err")
    return o;
  const a = ln(t.chainRange, `${i}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = La(t.overrides, `${i}.overrides`);
  if (s._tag === "err")
    return s;
  const l = Pa(
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
const Ua = Object.fromEntries(
  Ct.map((t, e) => [t, 2 ** e])
), Ka = Object.fromEntries(
  Pt.map((t, e) => [t, 2 ** e])
);
function cn(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function Ba(t, e) {
  return Ct.reduce((n, i) => Object.hasOwn(t.overrides, `osc${e}.${i}`) ? n | Ua[i] : n, 0);
}
function $a(t) {
  return Pt.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | Ka[n] : e, 0);
}
function Va(t, e) {
  const n = (o, a) => cn(t, `osc${o}.${a}`), i = (o) => cn(t, o), r = Array.from(
    { length: ri },
    () => ga
  );
  for (const [o, a] of Object.entries(t.routeAmounts)) {
    const s = e[o];
    s !== void 0 && (r[s] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: v.map((o) => Ba(t, o)),
    sharedOverrideMask: $a(t),
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
    filterMode: i("filterMode"),
    filterCutoffHz: i("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: i("filterKeyTrackOffsetSemitones"),
    filterQ: i("filterQ"),
    unisonVoices: v.map((o) => n(o, "unisonVoices")),
    unisonDetunes: v.map((o) => n(o, "unisonDetune")),
    unisonBlends: v.map((o) => n(o, "unisonBlend")),
    unisonWidths: v.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: v.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: v.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: v.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: v.map((o) => n(o, "unisonWarpSpread")),
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
function bi(t, e) {
  return t.slots.map((n) => Va(n, e));
}
function za(t, e) {
  if (!ve(t))
    return y("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return y('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return ge(new vi(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = Ft(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return y(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return y("selectedSlotId must be null or a string");
  if (!ka(t.activeTriggerMode))
    return y('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return y("slots must be an array");
  if (t.slots.length > A)
    return y(`slots must contain at most ${A} entries`);
  const i = [], r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const s = Fa(t.slots[a], a, e);
    if (s._tag === "err")
      return s;
    const l = s.value;
    if (r.has(l.id))
      return y(`slots[${a}].id duplicates "${l.id}"`);
    if (o.has(l.runtimeSlot))
      return y(`slots[${a}].runtimeSlot duplicates ${l.runtimeSlot}`);
    r.add(l.id), o.add(l.runtimeSlot), i.push(l);
  }
  return t.selectedSlotId !== null && !r.has(t.selectedSlotId) ? y(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : ue({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: i
  });
}
function Ti() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Ha(t) {
  const e = Array.from({ length: A }, () => w), n = Array.from({ length: A }, () => w), i = Array.from({ length: A }, () => w);
  for (const r of t.slots) {
    n[r.key] === w && (n[r.key] = r.runtimeSlot);
    for (let o = r.chainRange.min; o <= r.chainRange.max; o += 1)
      e[o] === w && (e[o] = r.runtimeSlot);
    for (let o = r.velRange.min; o <= r.velRange.max; o += 1)
      i[o] === w && (i[o] = r.runtimeSlot);
  }
  return i[0] = w, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: i
  };
}
const Ei = 13, Ut = 5, Ai = 8, Wa = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), Kt = Object.freeze({
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
}), Ri = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), qa = Object.freeze([
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
]), ja = Object.freeze({
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
function Ga(t) {
  return Math.round(t) === 1 ? -5 : Math.round(t) === 2 ? 12 : Math.round(t) === 3 ? -12 : 7;
}
function xi(t, e) {
  const n = {};
  for (const s of Kt[t]) {
    const l = e[s];
    if (typeof l == "number" && Number.isFinite(l)) {
      n[s] = l;
      continue;
    }
    const u = ja[s];
    if (u === void 0)
      throw new Error(`Missing lane parameter value: ${t}.${s}`);
    n[s] = u;
  }
  const r = [
    ...Ri.chorus,
    C("chorus")
  ], o = Object.keys(e);
  return t === "chorus" && o.length === r.length && o.every((s) => r.includes(s)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = Ga(
    Number(e.chorusRingOffsetMode)
  ) + Number(e.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function Mi(t) {
  return Kt[t];
}
function Ja(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= Ut)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * Ai + Wa[t];
}
function Qa(t, e) {
  const n = new Array(Ei).fill(0), i = xi(t, e);
  return Kt[t].forEach((r, o) => {
    n[o] = i[r];
  }), n;
}
const Oi = "lane.v1", Xa = "laneTopology", ht = "laneSlotParams", Ya = "laneOutputControl", pt = 16, Za = 8, _i = 4, es = 3, wi = Ut * Ai, ki = 4, ts = 4, ns = wi, is = wi + ki, rs = 0, os = 1, as = 2, ss = 3, ls = 4, cs = 5;
function us(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > _i)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << Za;
}
const Ke = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), Be = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Di = new Map(
  Object.entries(Be).map(([t, e]) => [e, t])
), ds = Object.freeze({
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
  Ke.map((t) => [ds[t], t])
);
const fs = Object.freeze([
  "voice.filterCutoff",
  ui,
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
]), ms = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [ui]: "enhancer-frequency",
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
  fs.map((t) => [t, Object.freeze({
    id: t,
    family: ms[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const Li = 40, Ni = 18e3, gt = Ke.map((t) => Be[t]), hs = /^([a-zA-Z]+)#([1-9][0-9]*)$/, ps = /^(parallel|split)#([1-9][0-9]*)$/;
function We(t) {
  if (typeof t != "string")
    return null;
  const e = hs.exec(t);
  if (e === null)
    return null;
  const n = gt.find((r) => r === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > Ut ? null : { deviceType: n, instanceNumber: i };
}
function Ci(t) {
  if (typeof t != "string")
    return null;
  const e = ps.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? ki : ts) ? null : { groupKind: n, unitNumber: i };
}
function X(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function se(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function b(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function gs(t, e) {
  const n = We(t);
  if (n === null)
    return { failure: b(`device id ${t} is not a pool instance`) };
  if (!X(e) || !se(e, ["params"]) || !X(e.params))
    return { failure: b(`device ${t} must be { params }`) };
  const i = Mi(n.deviceType), r = Di.get(n.deviceType);
  if (r === void 0)
    return { failure: b(`device ${t} has no effect descriptor`) };
  const o = Vn(r).parameters.map((f) => f.endpointID), a = e.params, s = Object.keys(a), l = (f) => s.length === f.length && s.every((g) => f.includes(g)), u = C(n.deviceType), c = [
    ...Ri[n.deviceType],
    u
  ], d = [
    ...qa,
    u
  ];
  if (!(s.includes(u) && (l(i) || l(o) || l(c) || n.deviceType === "chorus" && l(d))))
    return { failure: b(`device ${t} must carry every parameter once`) };
  for (const f of s) {
    const g = a[f];
    if (typeof g != "number" || !Number.isFinite(g))
      return { failure: b(`device ${t}.${f} must be a finite number`) };
  }
  return { record: { params: xi(n.deviceType, a) } };
}
function Is(t, e) {
  return !X(t) || t.kind !== "device" ? { failure: b("branches may hold device placements only") } : se(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: b(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: b(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: b("a device placement is { kind, deviceId, enabled }") };
}
function un(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= Li && t <= Ni;
}
function Pi() {
  return { mix: 1, bypassed: !1 };
}
function ys(t) {
  return !X(t) || !se(t, ["mix", "bypassed"]) || typeof t.mix != "number" || !Number.isFinite(t.mix) || t.mix < 0 || t.mix > 1 || typeof t.bypassed != "boolean" ? null : { mix: t.mix, bypassed: t.bypassed };
}
function Ss(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (c) {
      const d = c instanceof Error ? c.message : String(c);
      return b(`is not valid JSON: ${d}`);
    }
  if (!X(e) || !se(e, ["format", "version", "output", "devices", "chain"]))
    return b("must be { format, version, output, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return b("must be cosimo.lane version 2");
  if (!X(e.devices))
    return b("devices must be an object");
  if (!Array.isArray(e.chain))
    return b("chain must be an array");
  const n = ys(e.output);
  if (n === null)
    return b("output must be { mix: 0..1, bypassed: boolean }");
  const i = {};
  for (const c of Reflect.ownKeys(e.devices)) {
    if (typeof c != "string")
      return b("device ids must be strings");
    const d = gs(c, e.devices[c]);
    if ("failure" in d)
      return d.failure;
    i[c] = d.record;
  }
  const r = new Set(Object.keys(i)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let l = 0;
  const u = (c) => {
    const d = Is(c, r);
    return "placement" in d && (o.set(
      d.placement.deviceId,
      (o.get(d.placement.deviceId) ?? 0) + 1
    ), l += 1), d;
  };
  for (const c of e.chain) {
    if (!X(c))
      return b("chain nodes must be objects");
    if (c.kind === "device") {
      const I = u(c);
      if ("failure" in I)
        return I.failure;
      s.push(I.placement);
      continue;
    }
    if (c.kind !== "parallel" && c.kind !== "split")
      return b(`unknown chain node kind ${String(c.kind)}`);
    const d = c.kind === "split", p = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], g = d ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], m = d && se(c, p);
    if (!se(c, g) && !m)
      return b(`a ${c.kind} group is { ${g.join(", ")} }`);
    const S = Ci(c.groupId);
    if (S === null || S.groupKind !== c.kind)
      return b(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (a.has(String(c.groupId)))
      return b(`group ${String(c.groupId)} is used twice`);
    if (a.add(String(c.groupId)), typeof c.enabled != "boolean")
      return b(`group ${String(c.groupId)} needs a boolean enable`);
    const M = d ? es : _i;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > M)
      return b(`group ${String(c.groupId)} needs 2..${M} branches`);
    if (d && (!un(c.xoverLowHz) || !un(c.xoverHighHz)))
      return b(`group ${String(c.groupId)} crossovers must sit in ${Li}..${Ni} Hz`);
    if (d && !m && (typeof c.xoverLowKeyTrackEnabled != "boolean" || typeof c.xoverHighKeyTrackEnabled != "boolean" || typeof c.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverLowKeyTrackOffsetSemitones) || typeof c.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverHighKeyTrackOffsetSemitones)))
      return b(`group ${String(c.groupId)} Key Track state must be finite`);
    l += 1;
    const T = [];
    for (const I of c.branches) {
      if (!Array.isArray(I))
        return b(`group ${String(c.groupId)} branches must be arrays`);
      const R = [];
      for (const O of I) {
        const N = u(O);
        if ("failure" in N)
          return N.failure;
        R.push(N.placement);
      }
      T.push(R);
    }
    s.push(d ? {
      kind: "split",
      groupId: String(c.groupId),
      enabled: c.enabled,
      xoverLowHz: c.xoverLowHz,
      xoverHighHz: c.xoverHighHz,
      xoverLowKeyTrackEnabled: m ? !1 : c.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: m ? 0 : c.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: m ? !1 : c.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: m ? 0 : c.xoverHighKeyTrackOffsetSemitones,
      branches: T
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: T
    });
  }
  for (const c of r)
    if ((o.get(c) ?? 0) !== 1)
      return b(`device ${c} must be placed exactly once`);
  return l > pt ? b(`flattens to ${l} wire entries; the topology upload holds ${pt}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: i, chain: s } };
}
function vs() {
  const t = {};
  for (const e of Ke) {
    const n = Be[e];
    t[`${n}#1`] = {
      params: Rs(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Pi(),
    devices: t,
    chain: Ke.map((e) => ({
      kind: "device",
      deviceId: `${Be[e]}#1`,
      enabled: !1
    }))
  };
}
const dn = ["distortion#1", "delay#1", "reverb#1"];
function bs() {
  const t = vs(), e = {};
  for (const n of dn) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Pi(),
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && dn.includes(n.deviceId))
  };
}
function Ts(t) {
  if (t === void 0)
    return bs();
  const e = Ss(t);
  return e._tag === "ok" ? e.value : null;
}
function Es(t) {
  return Object.keys(t.devices).map((e) => {
    const n = We(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => gt.indexOf(e.parsed.deviceType) - gt.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function It(t) {
  const e = We(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return Ja(e.deviceType, e.instanceNumber - 1);
}
function Fi(t) {
  const e = Ci(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? ns : is) + (e.unitNumber - 1);
}
function Ui(t) {
  const e = new Array(pt).fill(0);
  let n = 0, i = 0;
  const r = (o, a, s) => {
    e[i] = us(o, a), s && (n |= 1 << i), i += 1;
  };
  for (const o of t.chain) {
    if (o.kind === "device") {
      r(It(o.deviceId), 0, o.enabled);
      continue;
    }
    r(Fi(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const l of a)
        r(It(l.deviceId), s + 1, l.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function As(t) {
  const e = new Array(Ei).fill(0);
  return e[rs] = t.xoverLowHz, e[os] = t.xoverHighHz, e[as] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[ss] = t.xoverLowKeyTrackOffsetSemitones, e[ls] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[cs] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function Ki(t) {
  const e = [{
    endpointID: Ya,
    value: t.output
  }];
  let n = 0;
  for (const i of Es(t)) {
    const r = We(i.instanceId);
    if (r === null)
      throw new Error(`Invalid lane device identity during replay: ${i.instanceId}`);
    e.push({
      endpointID: er(
        r.deviceType,
        r.instanceNumber
      ),
      value: t.devices[i.instanceId].params[C(r.deviceType)]
    }), n += 1, e.push({
      endpointID: ht,
      value: {
        slotId: It(i.instanceId),
        deliverySerial: n,
        values: Qa(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  }
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: ht,
      value: {
        slotId: Fi(i),
        deliverySerial: n,
        values: As(i)
      }
    }));
  return e.push({
    endpointID: Xa,
    value: Ui(t)
  }), e;
}
function Rs(t) {
  const e = Di.get(t);
  if (e === void 0)
    throw new Error(`Unknown lane device type: ${t}`);
  const n = Vn(e).parameters;
  return Object.fromEntries(Mi(t).map((i) => [
    i,
    n.find((r) => r.endpointID === i)?.initial ?? 0
  ]));
}
class xs {
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
function Ms(t, e) {
  return new xs(t, e);
}
async function Os(t, e) {
  const n = Ms(t, e);
  return await n.start(), n;
}
const yt = "runtimeState";
function Bi(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const _s = {
  endpointID: yt,
  required: !0,
  mapValue: Bi
}, fn = "runtimeInstallAck", $i = "runtimeSyncRequest", St = 0, ws = 8e3, $e = /* @__PURE__ */ new WeakMap(), Vi = 1e9;
let Ee = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Vi;
function ks(t) {
  return Ee = Ee % Vi + 1, t === "modulation" ? -1e9 - Ee : 1e9 + Ee;
}
function Ds(t, e) {
  const n = t, i = $e.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), $e.set(n, i);
}
function mn(t, e) {
  const n = t, i = $e.get(n);
  i?.delete(e), i?.size === 0 && $e.delete(n);
}
const Ls = [100, 250, 500, 1e3], Ae = { _tag: "accepted" }, Ns = { _tag: "superseded" }, Cs = { _tag: "stopped" }, hn = { _tag: "transport-timeout" };
function Ps(t) {
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
function Fs(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class pn {
  #r;
  #t;
  #c;
  #u;
  #m = !1;
  #n = null;
  #o = null;
  #l = /* @__PURE__ */ new Set();
  #e = null;
  #d = 0;
  #a = /* @__PURE__ */ new Map();
  #f = 0;
  #i = !1;
  #s = 0;
  #h = /* @__PURE__ */ new Set();
  #b = this.#O.bind(this);
  constructor(e, n) {
    this.#r = e, this.#t = n.laneKind;
    const i = n.probeDelaysMilliseconds?.map((r) => Math.max(0, Math.trunc(r))).filter((r) => Number.isFinite(r));
    this.#c = i && i.length > 0 ? i : [...Ls], this.#u = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? ws)
    );
  }
  start() {
    if (!this.#i) {
      Ds(this.#r, this.#t);
      try {
        this.#f += 1, this.#i = !0, this.#o = null, this.#l.clear(), this.#r.addEndpointListener?.(fn, this.#b);
      } catch (e) {
        throw this.#i = !1, mn(this.#r, this.#t), e;
      }
    }
  }
  stop() {
    this.#i && (this.#i = !1, this.#r.removeEndpointListener?.(fn, this.#b), mn(this.#r, this.#t), this.#a.clear(), this.#o = null, this.#l.clear(), this.#v());
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    n !== this.#n && (this.#n = n, this.#o = null, this.#l.clear(), this.#e?.dspSessionId !== n && (this.#e = null), this.#a.clear(), this.#s += 1, this.#v());
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
    const e = this.#n, n = this.#f;
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
    if (this.#m)
      return {
        _tag: "unavailable",
        reason: "batch-in-progress"
      };
    if (this.#n === null)
      return {
        _tag: "unavailable",
        reason: "no-runtime-session"
      };
    this.#m = !0;
    const n = this.#n, i = this.#f;
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
        if (s._tag === "rejected" && this.#t === "articulation") {
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
    return this.#t === "modulation" ? e.acceptedModulationSerial : e.acceptedArticulationSerial;
  }
  #R(e, n) {
    const i = this.#A(e);
    return this.#t === "modulation" ? i >= n : i <= n;
  }
  #x() {
    const e = this.getAcceptedFrontier();
    return this.#t === "modulation" ? e + 1 : e - 1;
  }
  async #T(e, n) {
    if (this.#o === e)
      return Ae;
    const i = ks(this.#t);
    this.#l.add(i);
    const r = Date.now() + this.#u;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#g(e, n);
        if (a)
          return a;
        if (this.#o === e)
          return Ae;
        const s = r - Date.now();
        if (s <= 0)
          return hn;
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
    const r = this.#x(), o = Fs(e.value, n, r);
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
      let f = this.#s;
      for (this.#y(r); ; ) {
        const g = this.#g(n, i);
        if (g)
          return g;
        const m = await this.#S(
          f,
          this.#I(a)
        ), S = this.#p(
          n,
          r,
          l
        );
        if (S !== null)
          return S;
        if (m && this.#e?.dspSessionId === n && this.#e.syncSerial === r) {
          if (s >= 1)
            return hn;
          l = this.#d, this.#E(e.endpointID, o), s += 1, a += 1;
          break;
        }
        if (m) {
          f = this.#s;
          continue;
        }
        m || (a += 1, f = this.#s, this.#y(r));
      }
    }
  }
  #p(e, n, i) {
    const r = this.#e;
    if (!r || r.dspSessionId !== e)
      return null;
    const o = this.#a.get(n);
    return o !== void 0 && o.version > i && o.acknowledgement.dspSessionId === e ? (this.#a.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#R(r, n) ? (this.#a.delete(n), Ae) : null;
  }
  #g(e, n) {
    return !this.#i || this.#f !== n ? Cs : this.#n !== e ? Ns : null;
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
        St
      );
    } catch {
    }
  }
  #y(e) {
    if (this.#i)
      try {
        this.#r.sendEventOrValue?.(
          $i,
          e,
          void 0,
          St
        );
      } catch {
      }
  }
  #O(e) {
    const n = Ps(e);
    if (!n || this.#n !== null && n.dspSessionId !== this.#n || this.#o === n.dspSessionId && this.#e?.dspSessionId === n.dspSessionId && (n.acceptedModulationSerial < this.#e.acceptedModulationSerial || n.acceptedArticulationSerial > this.#e.acceptedArticulationSerial))
      return;
    if (this.#l.has(n.syncSerial) && (this.#o = n.dspSessionId), this.#e = n, this.#d += 1, this.#t === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#a.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#d
      }); this.#a.size > 16; ) {
        const r = this.#a.keys().next().value;
        if (r === void 0) break;
        this.#a.delete(r);
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
const Us = 1e3, Ks = [Q, J];
function gn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function it(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (gn(i, e)) return i[e];
  if (gn(n, e)) return n[e];
}
function rt(t, e) {
  if (t === void 0) return Ti();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const i = za(n, e);
  return i._tag === "ok" ? i.value : null;
}
function In(t) {
  return new Set(t.routes.flatMap((e) => wt(e) === null ? [] : [e.id]));
}
function yn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
function Sn(t, e) {
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
class Bs {
  constructor(e, n) {
    this.connection = e, this.frameworkInput = n, this.modulationLane = new pn(e, { laneKind: "modulation" }), this.articulationLane = new pn(e, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = Pe();
  articulationBank = Ti();
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
    { length: A },
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
    return this.frameworkInput ? [J] : Ks;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(yt, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(yt, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
    const n = it(e, Q), i = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: Pe() } : Fe(n);
    if (i._tag === "err") {
      console.error(`[runtime-state-worker] ${Q} is invalid; boot state was not installed.`);
      const a = it(e, J), s = rt(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = i.value, this.hasModulationState = !0;
    const r = it(e, J), o = rt(
      r,
      In(i.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${J} is invalid; boot state was not installed.`);
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
      const r = Fe(n);
      if (r._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${Q}.`);
        return;
      }
      this.modulationState = r.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const i = rt(n, In(this.modulationState));
    if (i === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${J}.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = Bi(e);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.($i, 0, void 0, St), this.hasRuntimeState || this.scheduleRecovery());
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
    const e = this.lifecycleEpoch, n = this.runtimeGeneration, i = this.modulationState, r = this.articulationBank, o = this.deliveryObserver, a = this.lastAppliedModulationGeneration !== n, s = yi(
      i,
      a ? null : this.lastAppliedModulationState
    ), l = await this.modulationLane.sendBatch(s);
    if (!this.started || e !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", l, i)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const m = Sn("modulation", l);
      m && o?.(m), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = i, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, i, r)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const u = this.buildUploadsBySelector(i, r), c = Array.from({ length: A }, (m, S) => {
      const M = u.get(S);
      return M ? yn(M) : null;
    }), d = this.lastAppliedArticulationGeneration !== n, p = d && this.articulationLane.getAcceptedFrontier() !== 0, f = [];
    for (let m = 0; m < A; m += 1) {
      const S = u.get(m), M = c[m] !== this.lastAppliedArticulationTokens[m];
      p ? f.push({
        endpointID: Ze,
        value: S ?? an(m)
      }) : d ? S && f.push({ endpointID: Ze, value: S }) : M && f.push({
        endpointID: Ze,
        value: S ?? an(m)
      });
    }
    const g = await this.articulationLane.sendBatch(f);
    if (!(!this.started || e !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", g, c)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = c;
        const m = Ha(r);
        if (this.frameworkInput) {
          const S = await this.frameworkInput.publishTriggerConfig(m);
          if (!this.started || e !== this.lifecycleEpoch) return;
          S.kind !== "cancelled" && o?.(S);
        } else
          _a(m, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const S of f) this.lastAppliedArticulationTokens[S.value.selectorA] = void 0;
        const m = Sn("articulation", g);
        m && o?.(m);
      }
      this.finishDelivery();
    }
  }
  desiredStateChanged(e, n, i) {
    return e !== this.runtimeGeneration || n !== this.modulationState || i !== this.articulationBank;
  }
  buildUploadsBySelector(e, n) {
    const i = Object.fromEntries(e.routes.flatMap((r) => {
      const o = wt(r);
      return o === null ? [] : [[r.id, o]];
    }));
    return new Map(
      bi(n, i).map((r) => [r.selectorA, r])
    );
  }
  acceptOutcome(e, n, i) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const r = yn(i), o = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== r;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, r), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Us));
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
function $s(t) {
  return new Bs(t);
}
const Vs = 2e3;
function vn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function bn(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function zs(t, e) {
  if (!bn(t))
    return { found: !1 };
  const n = bn(t.values) ? t.values : void 0;
  return n && vn(n, e) ? {
    found: !0,
    value: n[e]
  } : vn(t, e) ? {
    found: !0,
    value: t[e]
  } : { found: !1 };
}
function Tn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Hs {
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
    this.connection = e, this.options = n, this.stateKeys = [.../* @__PURE__ */ new Set([n.stateKey, ...n.fallbackStateKeys ?? []])], this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Ws(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
            const r = zs(n, this.stateKeys[i]);
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
    }, r = Tn(n), o = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(i, o), s = Tn({
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
        this.options.sendTimeoutMilliseconds ?? Vs
      );
    this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function Ws(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function qs(t, e) {
  return new Hs(t, e);
}
function js(t) {
  return qs(t, {
    stateKey: Oi,
    runtimeEndpointDependencies: [_s],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Ts,
    buildRuntimeEvents: ({ state: e }) => [...Ki(e)]
  });
}
function ot(t) {
  return Object.freeze({ kind: "parameter", endpoint: t });
}
function Gs(t) {
  const e = Object.freeze({ ...t.codec });
  return Object.freeze({ kind: "stored", initial: e.parse(t.initial), codec: e, ...t.engine ? { engine: t.engine } : {} });
}
function Js(t) {
  return Object.freeze({ ...t });
}
function P(t, e) {
  if (!t)
    throw new Error(e);
}
function at(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function Qs(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function vt(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function zi(t) {
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
function Xs() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function st(t, e) {
  const n = Xs();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Qs(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function En(t) {
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
  throw new Error(`Unsupported text resource payload (${zi(t)})`);
}
function Ys(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return vt(t);
  throw new Error(`Unsupported binary resource payload (${zi(t)})`);
}
function Zs(t) {
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
function Hi(t) {
  const e = new DataView(t);
  P(at(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), P(at(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, o = null, a = null, s = null, l = null, u = 12;
  for (; u + 8 <= e.byteLength; ) {
    const d = at(e, u, 4), p = e.getUint32(u + 4, !0), f = u + 8;
    d === "fmt " ? (n = e.getUint16(f, !0), i = e.getUint16(f + 2, !0), r = e.getUint32(f + 4, !0), a = e.getUint16(f + 12, !0), o = e.getUint16(f + 14, !0)) : d === "data" && (s = f, l = p), u = f + p + p % 2;
  }
  P(n !== null, "Wave file is missing a fmt chunk"), P(s !== null && l !== null, "Wave file is missing a data chunk"), P(i === 1, "Only mono wavetable bank files are supported");
  let c;
  if (n === 3 && o === 32)
    c = new Float32Array(t.slice(s, s + l));
  else if (n === 1 && o === 16) {
    const d = l / 2, p = new Int16Array(t.slice(s, s + l));
    c = new Float32Array(d);
    for (let f = 0; f < d; f += 1)
      c[f] = p[f] / 32768;
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
async function An(t) {
  P(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return P(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function bt(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function Wi(t) {
  const e = new Uint8Array(t).buffer, n = Hi(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function el(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (l) => (P(typeof t.readResource == "function", `Resource bridge cannot read ${l}`), t.readResource(l)), r = async (l) => {
    P(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${l}`);
    const u = await t.readResourceAsAudioData(l);
    return Zs(u);
  }, o = (l) => {
    const u = t.getResourceAddress?.(l);
    return u ?? null;
  }, a = async (l, u = t.getResourceAddress?.(l)) => {
    const c = st(l, u), d = await An(c), p = Hi(d);
    return {
      sampleRate: p.sampleRate,
      samples: p.samples
    };
  }, s = async (l, u = t.getResourceAddress?.(l)) => {
    const c = st(l, u);
    return new Uint8Array(await An(c));
  };
  return {
    async readText(l) {
      if (e === "bridge" && typeof t.readResource == "function")
        return En(await i(l));
      const u = o(l);
      return e === "url" && u !== null ? bt(await s(l, u)) : typeof t.readResource == "function" ? En(await i(l)) : bt(await s(l, u));
    },
    async readJSON(l) {
      return JSON.parse(await this.readText(l));
    },
    async readBytes(l) {
      return typeof t.readResource == "function" ? Ys(await i(l)) : s(l);
    },
    async readAudio(l) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(l);
      const u = o(l);
      return n === "url" && u !== null ? a(l, u) : typeof t.readResourceAsAudioData == "function" ? r(l) : Wi(await this.readBytes(l));
    },
    getURL(l) {
      return st(l, t.getResourceAddress?.(l));
    }
  };
}
function tl(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return el(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function nl(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, o = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (i)
        return bt(await i(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (i)
        return i(a);
      if (e)
        return vt(await e(a));
      if (n)
        return vt(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return r ? r(a) : Wi(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function il(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function rl(t) {
  return il(t) ? nl(t) : tl(t);
}
function qi(t) {
  if (!(t === null || typeof t != "object")) {
    for (const e of Object.values(t)) qi(e);
    Object.freeze(t);
  }
}
const ol = {
  parse(t) {
    const e = Fe(t);
    return e._tag === "err" ? { kind: "error", message: e.error.message } : (qi(e.value), { kind: "ok", value: e.value });
  },
  encode: Ye,
  equals: (t, e) => Ye(t) === Ye(e)
};
Js({
  playMode: ot("playMode"),
  glideTime: ot("glideTime"),
  globalTune: ot("globalTune"),
  [Q]: Gs({ initial: Pe(), codec: ol })
});
const ke = 2048;
function fe(t, e) {
  if (!t)
    throw new Error(e);
}
function al(t) {
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
const sl = 2048, Ve = 11, ll = 256;
function U(t, e) {
  if (!t)
    throw new Error(e);
}
function cl(t) {
  return t > 0 && (t & t - 1) === 0;
}
const Rn = /* @__PURE__ */ new Map();
function ul(t) {
  const e = Rn.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let o = 0, a = r;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    i[r] = o;
  }
  return Rn.set(t, i), i;
}
function ji(t, e, n = !1) {
  const i = t.length;
  U(i === e.length, "FFT real and imaginary buffers must have the same length"), U(cl(i), "FFT input length must be a power of two");
  const r = ul(i);
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
      for (let f = 0; f < a; f += 1) {
        const g = c + f, m = g + a, S = t[m], M = e[m], T = d * S - p * M, I = d * M + p * S, R = t[g], O = e[g];
        t[g] = R + T, e[g] = O + I, t[m] = R - T, e[m] = O - I;
        const N = d * l - p * u;
        p = d * u + p * l, d = N;
      }
    }
  }
  if (n)
    for (let o = 0; o < i; o += 1)
      t[o] /= i, e[o] /= i;
}
function Gi(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    r[o] = (Number(e[o]) || 0) - i;
  return r;
}
function dl(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = sl,
  maxFramesPerTable: i = ll
} = {}) {
  const r = Float32Array.from(t);
  U(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = r.length / n;
  U(o > 0, "Source wavetable files must contain at least one frame"), U(o <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && U(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const l = s * n, u = l + n;
    a.push(Gi(r.slice(l, u)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function xn(t) {
  const e = Gi(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return ji(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function Ji(t, e, {
  mipLevelCount: n = Ve
} = {}) {
  const i = t?.real?.length ?? 0;
  U(i > 0, "Spectrum must contain real samples"), U(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), U(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), o = new Float64Array(i), a = new Float64Array(i);
  for (let s = 1; s <= r; s += 1) {
    o[s] = t.real[s], a[s] = t.imaginary[s];
    const l = (i - s) % i;
    l !== s && (o[l] = t.real[l], a[l] = t.imaginary[l]);
  }
  return ji(o, a, !0), Float32Array.from(o);
}
async function fl(t, e, n) {
  const i = t.sharedData;
  if (!i) throw new Error("This patch host does not support direct shared-data preparation.");
  const r = i.reserve(e.input, e.byteLength);
  try {
    n(r), await i.commit(r.id);
  } catch (o) {
    throw i.cancel(r.id), o;
  }
}
const De = 256, me = 2048, Qi = 8, ml = 12811, Tt = (Qi + De * ml) * 4;
function Mn(t, e, n) {
  const i = Math.fround(t * e);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(i + (i >= 0 ? 0.5 : -0.5)))
  ));
}
function hl(t, e, n) {
  if (t.byteLength !== Tt || !Number.isInteger(e.frameCount) || e.frameCount < 1 || e.frameCount > De)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const i = new Int32Array(t.buffer, t.byteOffset, t.byteLength / 4);
  i.set([
    1465139788,
    1,
    e.dspSessionId,
    e.generation,
    e.tableIndex,
    e.frameCount,
    Ve,
    De
  ]);
  let r = Qi;
  const o = 131071, a = 8191, s = Math.fround(o / 1.5), l = Math.fround(a / 0.5);
  for (let u = 0; u < Ve; ++u) {
    const c = Math.min(me, Math.max(256, (1 << u) * 32)), d = me / c;
    for (let p = 0; p < e.frameCount; ++p) {
      const f = Ji(n(p), u), g = r + p * (c + 1);
      for (let m = 0; m <= c; ++m) {
        const S = (m === c ? 0 : m) * d, M = (S + me - d) % me, T = (S + d) % me, I = f[S], R = f[M], O = f[T];
        if (I === void 0 || R === void 0 || O === void 0 || !Number.isFinite(I) || !Number.isFinite(R) || !Number.isFinite(O))
          throw new Error("Wavetable preparation produced invalid samples.");
        const N = Math.fround(0.5 * Math.fround(O - R));
        i[g + m] = Mn(I, s, o) & 262143 | Mn(N, l, a) << 18;
      }
    }
    r += (c + 1) * De;
  }
}
const pl = "runtimeSyncRequest", gl = 2147483647, Il = "runtimeState", yl = "retryDesiredTableRequest", Sl = "workerLoadFailure", vl = "serviceLoadAbort", bl = "wavetableLoadBegin", Tl = "wavetableMipFrame", El = "wavetableUploadAck", Al = "wavetableMipRequest", Rl = "wavetablePrewarmRequest", xl = "wavetablePrewarmNotification", Ml = "assets/factory-bank-catalog.json", Et = 3, Ol = 1, _l = Et * ke, wl = 1, kl = 2, Dl = 3, Ll = 1, Nl = 2, Cl = 2e4, Re = wl, On = kl, _n = Dl, z = Ll, wn = Nl, Pl = 48 * 1024 * 1024, lt = 3;
function kn(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function x(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function Dn(t) {
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
function Ln(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function Nn(t, e) {
  if (!t)
    throw new Error(e);
}
function Fl(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function Ul(t, e) {
  return al(await t.readJSON(e));
}
function Kl(t) {
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
function Bl(t, e) {
  const n = Math.round(Number(t) || 0);
  return Fl(n, 0, Math.max(0, e - 1));
}
function ct(t, e, n, i, r) {
  return `${t}:${e}:${n}:${i}:${r}`;
}
function $l(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function Cn(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Pn(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function xe() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Vl(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class zl {
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
    this.connection = e, this.delivery = n.delivery ?? "events", this.resourceClient = rl(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Ml, this.maxBatchesInFlight = kn(
      n.maxFramesInFlight,
      Ol
    ), this.mipLevelCount = n.mipLevelCount ?? Ve, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Pl) || 0)), this.serviceLoadTimeoutMs = kn(n.serviceLoadTimeoutMs, Cl), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    if (this.started)
      return this;
    if (this.delivery === "shared" && !this.connection.sharedData)
      throw new Error("Cosimo requires a host with direct shared wavetable preparation.");
    return this.started = !0, x("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Il, this.handleRuntimeState), this.connection.addEndpointListener?.(El, this.handleUploadAck), this.connection.addEndpointListener?.(Al, this.handleMipRequest), this.connection.addEndpointListener?.(Rl, this.handlePrewarmRequest), this.connection.addEndpointListener?.(xl, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      pl,
      gl
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Ul(this.resourceClient, this.catalogPath), x("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < lt; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = Cn(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Cn(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = ct(
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
          ...Pn(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== r || !this.serviceLoadHasPendingTransfers()) && (x("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: _n,
          failureReasonCode: wn
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== _n || e.failureReasonCode !== wn ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = Re,
    failureReasonCode: s = z
  }) {
    this.connection.sendEventOrValue?.(Sl, {
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
    failureReasonCode: o = z
  }) {
    this.connection.sendEventOrValue?.(vl, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(e) {
    x("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? Dn(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(yl, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), r = Bl(e, i.tables.length), o = i.tables[r];
    Nn(o, `Could not resolve table ${r}`);
    const a = $l(o, ke, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, x("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const l = xe();
    x("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const u = await this.resourceClient.readAudio(o.sourceWav), c = dl(u.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: ke
    });
    return x("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: c.frameCount,
      loadDurationMs: Math.round(xe() - l)
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
    if (x("info", "Committing desired wavetable load", {
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
    this.connection.sendEventOrValue?.(bl, {
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
    const n = xe();
    try {
      if (await fl(this.connection, {
        input: e.oscillatorIndex,
        byteLength: Tt
      }, (i) => {
        hl(i, e, (r) => this.getSpectrumForFrame(r));
      }), this.serviceTable !== e || this.knownSessionId !== e.dspSessionId) return;
      x("info", "Submitted shared wavetable", {
        oscillatorIndex: e.oscillatorIndex,
        tableIndex: e.tableIndex,
        generation: e.generation,
        frameCount: e.frameCount,
        preparedBytes: Tt,
        preparationMs: xe() - n,
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
        failurePhase: On,
        failureReasonCode: z
      }), this.serviceTable = null, this.clearMipTransferState(), x("error", "Shared wavetable preparation failed", { detail: Me(i) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(e) {
    x("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: Re,
      failureReasonCode: z
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: Re,
      failureReasonCode: z
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = Re,
    failureReasonCode: i = z
  } = {}) {
    x("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (x("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: Me(o)
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
      this.isCurrentRuntimeState(e) && (x("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: Me(a)
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
    for (let e = 0; e < lt; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Vl(() => {
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
        x("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: z
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
    const n = Kl(e ?? {});
    if (x("info", "Received runtime state", Dn(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= lt)
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
          r.spectra[a] || (r.spectra[a] = xn(r.frames[a]));
        const o = this.tableCache.get(r.cacheKey);
        o && this.refreshCacheEntryByteCount(o), x("info", "Prewarmed wavetable source table", {
          tableIndex: r.tableIndex,
          tableId: r.tableMeta.tableId,
          tableName: r.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (r) {
        x("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: Me(r)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), r = Math.trunc(Number(e?.generation)), o = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), s = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || r !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const l = ct(
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
      ...Pn(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(l, u), u);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (x("info", "Received wavetable mip request", {
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), l = Math.trunc(Number(n.frameIndexBase)), u = Math.trunc(Number(n.frameCount)), c = ct(
      i,
      r,
      o,
      a,
      s
    ), d = this.mipJobs.get(c), p = this.serviceTable?.frameCount ?? 0, f = Math.min(
      Et,
      p - l
    );
    if (!(!d || d.completed || !d.inFlightBatchBases.has(l) || u <= 0 || u !== f)) {
      d.inFlightBatchBases.delete(l);
      for (let g = 0; g < u; g += 1) {
        const m = l + g;
        d.ackedFrames[m] || (d.ackedFrames[m] = 1, d.ackedFrameCount += 1);
      }
      d.ackedFrameCount === p && d.nextFrameIndex >= p && d.inFlightBatchBases.size === 0 && (d.completed = !0, this.activeUploadKey === d.key && (this.activeUploadKey = null)), Ln(l, u, p) && x("info", "Acknowledged wavetable mip batch", {
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
    if (Nn(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = xn(this.serviceTable.frames[e]);
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
        Et,
        this.serviceTable.frameCount - n
      ), r = new Float32Array(_l);
      try {
        for (let o = 0; o < i; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), l = Ji(s, e.mipIndex);
          r.set(l, o * ke);
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
            failurePhase: On,
            failureReasonCode: z
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Tl, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(r)
      }), Ln(n, i, this.serviceTable.frameCount) && x("info", "Sent wavetable mip batch", {
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
function Me(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Hl(t, e = {}) {
  return new zl(t, e);
}
function Wl(t, e, n) {
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
const Oe = 1600, ql = /* @__PURE__ */ new Set([
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
function jl(t) {
  return t && typeof t == "object" && "event" in t ? t.event : t;
}
function Gl(t) {
  return {
    values: {
      [Q]: t.modulation,
      [Oi]: t.lane,
      [J]: t.articulations
    }
  };
}
class Jl {
  performer;
  #r;
  #t;
  #c = /* @__PURE__ */ new Map();
  #u = /* @__PURE__ */ new Map();
  #m = /* @__PURE__ */ new Map();
  #n = /* @__PURE__ */ new Map();
  #o = /* @__PURE__ */ new Map();
  #l = /* @__PURE__ */ new Map();
  #e;
  #d;
  #a = null;
  #f = null;
  #i = null;
  #s = 0;
  constructor(e, n, i) {
    this.performer = new e(), this.#e = n, this.#d = new URL("./", i), this.#r = new Map(
      this.performer.getInputEndpoints().map((r) => [r.endpointID, r])
    ), this.#t = new Map(
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
      he(this.performer, "sendInputEvent", e)(n), this.#o.set(e, (this.#o.get(e) ?? 0) + 1);
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
    const n = this.#m.get(e);
    if (n !== void 0)
      for (const i of this.#u.get(e) ?? []) i(n);
  }
  requestFullStoredState(e) {
    e(Gl(this.#e));
  }
  getResourceAddress(e) {
    return new URL(e, this.#d);
  }
  sendNativeArticulationTriggerConfig(e) {
    this.#i = e;
  }
  getInstallationState() {
    return {
      runtimeStates: new Map(this.#n),
      runtimeInstallAck: this.#a,
      effectiveRackState: this.#f,
      articulationTriggerConfig: this.#i,
      inputEventCounts: new Map(this.#o),
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
    )(n, 0), this.#m.set(e, n);
    for (const r of this.#u.get(e) ?? []) r(n);
  }
  advance(e) {
    if (!Number.isInteger(e) || e < 1 || e > 128)
      throw new Error("OfflineEngineHost advances must contain 1 to 128 frames.");
    this.performer.advance(e), this.#s += e, this.drainOutputEvents();
  }
  drainOutputEvents() {
    const e = /* @__PURE__ */ new Set([
      ...ql,
      ...this.#c.keys()
    ]);
    for (const n of e) {
      const i = this.#t.get(n);
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
      ), a = Array.from({ length: r }, (s, l) => jl(o(l)));
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
      r >= 0 && r < 3 && this.#n.set(r, i);
    } else e === "runtimeInstallAck" ? this.#a = i : e === "effectiveRackState" && (this.#f = i);
  }
}
const Fn = "assets/factory-bank-catalog.json";
function Ql(t) {
  return {
    async readText(e) {
      if (e !== Fn) throw new Error(`Speedrun resource bundle has no text ${e}.`);
      return JSON.stringify(t.catalog);
    },
    async readJSON(e) {
      if (e !== Fn) throw new Error(`Speedrun resource bundle has no JSON ${e}.`);
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
const Xl = [
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
function Yl(t) {
  let e = 0;
  for (const n of t) {
    if (n.endpointID !== ht || typeof n.value != "object" || n.value === null)
      continue;
    const i = n.value.deliverySerial;
    typeof i == "number" && Number.isFinite(i) && i > 0 && (e = Math.max(e, i));
  }
  return e;
}
function Zl(t) {
  const e = Object.fromEntries(t.modulation.routes.flatMap((i) => {
    const r = wt(i);
    return r === null ? [] : [[i.id, r]];
  })), n = Ki(t.lane);
  return {
    tableIndices: v.map((i) => Math.round(Number(t.parameters[`osc${i}WavetableSelect`]) || 0)),
    modulationFrontier: yi(t.modulation, null).length,
    articulationFrontier: bi(
      t.articulations,
      e
    ).length,
    rackChainLength: Ui(t.lane).chainLength,
    rackParamSerial: Yl(n)
  };
}
function ec(t, e) {
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
function Un(t, e) {
  const n = e.tableIndices.every((a, s) => {
    const l = t.runtimeStates.get(s);
    return !!l?.hasActive && Number(l?.activeTableIndex) === a;
  }), i = e.modulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedModulationSerial) >= e.modulationFrontier, r = e.articulationFrontier === 0 || Number(t.runtimeInstallAck?.acceptedArticulationSerial) <= -e.articulationFrontier, o = Number(t.effectiveRackState?.laneCommittedChainLength) === e.rackChainLength && Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) >= e.rackParamSerial;
  return n && i && r && o;
}
function tc(t, e) {
  return e.tableIndices.every((n, i) => {
    const r = t.runtimeStates.get(i);
    return !!r?.hasActive && Number(r?.activeTableIndex) === n;
  }) ? e.modulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedModulationSerial) < e.modulationFrontier ? "modulation" : e.articulationFrontier > 0 && Number(t.runtimeInstallAck?.acceptedArticulationSerial) > -e.articulationFrontier ? "articulation" : "rack" : "wavetable";
}
function nc(t) {
  return `${[0, 1, 2].map((n) => {
    const i = t.runtimeStates.get(n);
    return i ? `${n}:${Number(i.activeGeneration) || 0}/${Number(i.generationFrontier) || 0} load=${Number(i.loadingGeneration) || 0} active=${!!i.hasActive}` : `${n}:missing`;
  }).join(", ")}; mod=${Number(t.runtimeInstallAck?.acceptedModulationSerial) || 0} art=${Number(t.runtimeInstallAck?.acceptedArticulationSerial) || 0} rack=${Number(t.effectiveRackState?.laneCommittedChainLength) || 0} params=${Number(t.effectiveRackState?.laneParamsAcknowledgedSerial) || 0} mipSent=${t.inputEventCounts.get("wavetableMipFrame") ?? 0} mipAck=${t.outputEventCounts.get("wavetableUploadAck") ?? 0}`;
}
function Xi(t) {
  return t >>> 16 & 255;
}
function Yi(t) {
  return t >>> 8 & 127;
}
function Bt(t) {
  return t & 127;
}
function ic(t, e, n) {
  if (t === null) return null;
  let i;
  try {
    i = JSON.parse(t);
  } catch {
    return null;
  }
  const r = i.activeMode, o = r === "key" ? i.key : r === "vel" ? i.velocity : i.chain;
  if (!Array.isArray(o)) return null;
  const a = r === "key" ? Yi(e) : r === "vel" ? Bt(e) : n % 128, s = Math.trunc(Number(o[a]));
  return s >= 0 && s <= 127 ? s : null;
}
function rc(t, e, n, i) {
  const r = Xi(e);
  if ((r & 240) === 144 && Bt(e) > 0) {
    const o = ic(n, e, i);
    o !== null && t.sendEventOrValue("articulationNoteMeta", {
      channel: r & 15,
      noteNumber: Yi(e),
      selectorA: o,
      selectorB: 0,
      durationSamples: 0,
      ageSamples: 0
    });
  }
  t.sendMIDIInputEvent("midiIn", e);
}
async function oc() {
  await new Promise((t) => setTimeout(t, 0));
}
async function ac(t, e) {
  const n = globalThis.performance?.now?.() ?? 0, i = new Jl(t, {
    modulation: e.state.modulation,
    lane: e.state.lane,
    articulations: e.state.articulations
  }, e.resourceBaseURL);
  await i.initialise(e.sessionID, e.sampleRate), i.setInitialParameters(e.state.parameters), i.sendEventOrValue("tempo", { bpm: 120 });
  const r = await Os(i, [
    $s,
    js,
    () => Hl(i, {
      maxFramesInFlight: 1,
      serviceLoadTimeoutMs: 2e4,
      ...e.resourceBundle ? { resourceClient: Ql(e.resourceBundle) } : {}
    })
  ]), o = Zl(e.state), a = e.maxInstallFrames ?? e.sampleRate * 4;
  let s = 0;
  try {
    for (; s < a; ) {
      await i.pump(128), s += 128;
      const I = i.getInstallationState(), R = ec(I, o);
      if (R) throw R;
      if (Un(I, o)) break;
      s / 128 % 8 === 0 && await oc();
    }
    const T = i.getInstallationState();
    if (!Un(T, o)) {
      const I = tc(T, o);
      throw new pe(
        I,
        `timed out after ${s} virtual frames (${nc(T)}).`
      );
    }
  } finally {
    await r.stop();
  }
  const l = new Float32Array(e.frameCount * 2), u = Wl(e.performance, e.frameCount, e.sampleRate), c = i.getInstallationState().articulationTriggerConfig, d = e.recordTelemetry === !0, p = /* @__PURE__ */ new Map();
  let f = 0, g = 0, m = 0;
  d && (i.sendEventOrValue("filterSpectrumActivity", 1), i.sendEventOrValue("distortionScopeActivity", 1), i.sendEventOrValue("distortionHistoryActivity", 1));
  const S = d ? Xl.map((T) => {
    const I = (R) => {
      const O = Math.floor(g / Oe), N = p.get(O) ?? {};
      N[T] = structuredClone(R), p.set(O, N);
    };
    return i.addEndpointListener(T, I), { endpointID: T, listener: I };
  }) : [];
  try {
    for (; g < e.frameCount; ) {
      for (; f < u.length && u[f].sample === g; ) {
        const O = u[f];
        rc(i, O.code, c, m), (Xi(O.code) & 240) === 144 && Bt(O.code) > 0 && (m += 1), f += 1;
      }
      const T = u[f]?.sample ?? e.frameCount, I = (Math.floor(g / Oe) + 1) * Oe, R = Math.min(
        128,
        e.frameCount - g,
        T - g,
        ...d ? [I - g] : []
      );
      if (R < 1)
        throw new Error("Speedrun checkpoint render computed an empty advance.");
      i.render(R, l, g), g += R;
    }
  } finally {
    for (const { endpointID: T, listener: I } of S)
      i.removeEndpointListener(T, I);
  }
  const M = (globalThis.performance?.now?.() ?? n) - n;
  return {
    rootIndex: e.rootIndex,
    rootNote: e.rootNote,
    checkpointIndex: e.checkpointIndex,
    frameCount: e.frameCount,
    samples: l,
    telemetry: {
      frameCount: Math.ceil(e.frameCount / Oe),
      frames: [...p.entries()].sort(([T], [I]) => T - I).map(([T, I]) => ({ frame: T, events: I }))
    },
    metrics: {
      renderedFrameCount: e.frameCount,
      installFrameCount: s,
      elapsedMilliseconds: M,
      realtimeMultiplier: M > 0 ? e.frameCount / (M * e.sampleRate / 1e3) : null
    }
  };
}
const _e = self;
function sc(t) {
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
    const i = await import(new URL(e.engineModuleURL, _e.location.href).href), r = i.default ?? i.WavetableSynth, o = await ac(
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
      error: sc(n)
    }, []);
  });
});
