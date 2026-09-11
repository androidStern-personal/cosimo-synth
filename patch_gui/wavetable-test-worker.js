class Ji {
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
function Qi(t, e) {
  return new Ji(t, e);
}
async function Xi(t, e) {
  const n = Qi(t, e);
  return await n.start(), n;
}
const ae = -100, we = 35, Yi = 5, Zi = [
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
function N(t) {
  return Kn(t).laneEndpointID;
}
function er(t, e) {
  if (!Number.isInteger(e) || e < 1 || e > Yi)
    throw new Error(`Effect Output Trim instance is out of range: ${e}`);
  return `${Kn(t).hostStem}${e}OutputTrimDb`;
}
function Un(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function tr(t) {
  const e = (Un(t, ae, we) - ae) / (we - ae);
  return e * e;
}
function nr(t) {
  const e = Math.sqrt(Un(t, 0, 1));
  return ae + e * (we - ae);
}
const Bn = 13, Tt = 5, Vn = 8, ir = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), Et = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    N("globalFilter")
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
    N("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    N("ott")
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
    N("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    N("flanger")
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
    N("phaser")
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
    N("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    N("reverb")
  ]
}), $n = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), rr = Object.freeze([
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
]), or = Object.freeze({
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
function ar(t) {
  return Math.round(t) === 1 ? -5 : Math.round(t) === 2 ? 12 : Math.round(t) === 3 ? -12 : 7;
}
function zn(t, e) {
  const n = {};
  for (const s of Et[t]) {
    const l = e[s];
    if (typeof l == "number" && Number.isFinite(l)) {
      n[s] = l;
      continue;
    }
    const u = or[s];
    if (u === void 0)
      throw new Error(`Missing lane parameter value: ${t}.${s}`);
    n[s] = u;
  }
  const r = [
    ...$n.chorus,
    N("chorus")
  ], o = Object.keys(e);
  return t === "chorus" && o.length === r.length && o.every((s) => r.includes(s)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = ar(
    Number(e.chorusRingOffsetMode)
  ) + Number(e.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function Hn(t) {
  return Et[t];
}
function sr(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= Tt)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * Vn + ir[t];
}
function lr(t, e) {
  const n = new Array(Bn).fill(0), i = zn(t, e);
  return Et[t].forEach((r, o) => {
    n[o] = i[r];
  }), n;
}
const D = (t, e) => ({ label: t, value: e });
function B(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const V = Object.freeze({
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
    ae,
    we,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const cr = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], ur = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], dr = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: V.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      h("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(D), quick: !0 }),
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
    iconUrl: V.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      h("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [D("Classic", 0), D("Harmonics", 1)] }),
      h("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      h("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      h("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      h("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      h("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      h("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [D("Symmetric", 0), D("Asymmetric", 1), D("Wavefold", 2)] }),
      $("drive", "distortionOutputTrimDb", 40)
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: V.ott,
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
    iconUrl: V.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      h("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(D) }),
      h("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(D) }),
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
    iconUrl: V.flanger,
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
    iconUrl: V.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      h("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [D("Free", 0), D("Sync", 1)] }),
      h("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      h("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: cr.map(D) }),
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
    iconUrl: V.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      h("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [D("Free", 0), D("Sync", 1)] }),
      h("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      h("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: ur.map(D) }),
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
    iconUrl: V.reverb,
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
], $e = dr, jn = Object.freeze(
  $e.flatMap((t) => t.parameters)
);
new Map(
  jn.map((t) => [t.endpointID, t])
);
function Wn(t) {
  const e = $e.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function qn() {
  return jn;
}
function At(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const fr = "lane.v1", mr = "laneTopology", $t = "laneSlotParams", hr = "laneOutputControl", ut = 16, pr = 8, Gn = 4, gr = 3, Jn = Tt * Vn, Qn = 4, yr = 4, Ir = Jn, br = Jn + Qn, Sr = 0, vr = 1, Tr = 2, Er = 3, Ar = 4, Rr = 5;
function xr(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > Gn)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << pr;
}
const De = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), Le = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Xn = new Map(
  Object.entries(Le).map(([t, e]) => [e, t])
), Mr = Object.freeze({
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
  De.map((t) => [Mr[t], t])
);
const _r = "voiceEnhancerFrequency", Or = "voiceEnhancerQ", kr = "voiceEnhancerAmount", wr = "voiceEnhancerFrequencyOctaves", Dr = "voiceEnhancerQ", Lr = "voiceEnhancerAmount", Yn = "voice.enhancerFrequency", Nr = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: _r,
    targetKind: wr,
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
    endpointID: Or,
    targetKind: Dr,
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
    endpointID: kr,
    targetKind: Lr,
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
function zt(t, e) {
  const n = Math.min(t.max, Math.max(t.min, e));
  return t.scale === "log" ? Math.log(n / t.min) / Math.log(t.max / t.min) : (n - t.min) / (t.max - t.min);
}
function Cr(t, e) {
  const n = Math.min(1, Math.max(0, e));
  return t.scale === "log" ? t.min * (t.max / t.min) ** n : t.min + (t.max - t.min) * n;
}
const Pr = Object.freeze([
  "voice.filterCutoff",
  Yn,
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
]), Fr = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [Yn]: "enhancer-frequency",
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
  Pr.map((t) => [t, Object.freeze({
    id: t,
    family: Fr[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const Zn = 40, ei = 18e3, dt = De.map((t) => Le[t]), Kr = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Ur = /^(parallel|split)#([1-9][0-9]*)$/;
function ze(t) {
  if (typeof t != "string")
    return null;
  const e = Kr.exec(t);
  if (e === null)
    return null;
  const n = dt.find((r) => r === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > Tt ? null : { deviceType: n, instanceNumber: i };
}
function ti(t) {
  if (typeof t != "string")
    return null;
  const e = Ur.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? Qn : yr) ? null : { groupKind: n, unitNumber: i };
}
function Q(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function se(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function S(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function Br(t, e) {
  const n = ze(t);
  if (n === null)
    return { failure: S(`device id ${t} is not a pool instance`) };
  if (!Q(e) || !se(e, ["params"]) || !Q(e.params))
    return { failure: S(`device ${t} must be { params }`) };
  const i = Hn(n.deviceType), r = Xn.get(n.deviceType);
  if (r === void 0)
    return { failure: S(`device ${t} has no effect descriptor`) };
  const o = Wn(r).parameters.map((m) => m.endpointID), a = e.params, s = Object.keys(a), l = (m) => s.length === m.length && s.every((p) => m.includes(p)), u = N(n.deviceType), c = [
    ...$n[n.deviceType],
    u
  ], f = [
    ...rr,
    u
  ];
  if (!(s.includes(u) && (l(i) || l(o) || l(c) || n.deviceType === "chorus" && l(f))))
    return { failure: S(`device ${t} must carry every parameter once`) };
  for (const m of s) {
    const p = a[m];
    if (typeof p != "number" || !Number.isFinite(p))
      return { failure: S(`device ${t}.${m} must be a finite number`) };
  }
  return { record: { params: zn(n.deviceType, a) } };
}
function Vr(t, e) {
  return !Q(t) || t.kind !== "device" ? { failure: S("branches may hold device placements only") } : se(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: S(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: S(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: S("a device placement is { kind, deviceId, enabled }") };
}
function Ht(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= Zn && t <= ei;
}
function ni() {
  return { mix: 1, bypassed: !1 };
}
function $r(t) {
  return !Q(t) || !se(t, ["mix", "bypassed"]) || typeof t.mix != "number" || !Number.isFinite(t.mix) || t.mix < 0 || t.mix > 1 || typeof t.bypassed != "boolean" ? null : { mix: t.mix, bypassed: t.bypassed };
}
function zr(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (c) {
      const f = c instanceof Error ? c.message : String(c);
      return S(`is not valid JSON: ${f}`);
    }
  if (!Q(e) || !se(e, ["format", "version", "output", "devices", "chain"]))
    return S("must be { format, version, output, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return S("must be cosimo.lane version 2");
  if (!Q(e.devices))
    return S("devices must be an object");
  if (!Array.isArray(e.chain))
    return S("chain must be an array");
  const n = $r(e.output);
  if (n === null)
    return S("output must be { mix: 0..1, bypassed: boolean }");
  const i = {};
  for (const c of Reflect.ownKeys(e.devices)) {
    if (typeof c != "string")
      return S("device ids must be strings");
    const f = Br(c, e.devices[c]);
    if ("failure" in f)
      return f.failure;
    i[c] = f.record;
  }
  const r = new Set(Object.keys(i)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let l = 0;
  const u = (c) => {
    const f = Vr(c, r);
    return "placement" in f && (o.set(
      f.placement.deviceId,
      (o.get(f.placement.deviceId) ?? 0) + 1
    ), l += 1), f;
  };
  for (const c of e.chain) {
    if (!Q(c))
      return S("chain nodes must be objects");
    if (c.kind === "device") {
      const T = u(c);
      if ("failure" in T)
        return T.failure;
      s.push(T.placement);
      continue;
    }
    if (c.kind !== "parallel" && c.kind !== "split")
      return S(`unknown chain node kind ${String(c.kind)}`);
    const f = c.kind === "split", d = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], p = f ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], y = f && se(c, d);
    if (!se(c, p) && !y)
      return S(`a ${c.kind} group is { ${p.join(", ")} }`);
    const g = ti(c.groupId);
    if (g === null || g.groupKind !== c.kind)
      return S(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (a.has(String(c.groupId)))
      return S(`group ${String(c.groupId)} is used twice`);
    if (a.add(String(c.groupId)), typeof c.enabled != "boolean")
      return S(`group ${String(c.groupId)} needs a boolean enable`);
    const I = f ? gr : Gn;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > I)
      return S(`group ${String(c.groupId)} needs 2..${I} branches`);
    if (f && (!Ht(c.xoverLowHz) || !Ht(c.xoverHighHz)))
      return S(`group ${String(c.groupId)} crossovers must sit in ${Zn}..${ei} Hz`);
    if (f && !y && (typeof c.xoverLowKeyTrackEnabled != "boolean" || typeof c.xoverHighKeyTrackEnabled != "boolean" || typeof c.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverLowKeyTrackOffsetSemitones) || typeof c.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverHighKeyTrackOffsetSemitones)))
      return S(`group ${String(c.groupId)} Key Track state must be finite`);
    l += 1;
    const A = [];
    for (const T of c.branches) {
      if (!Array.isArray(T))
        return S(`group ${String(c.groupId)} branches must be arrays`);
      const w = [];
      for (const L of T) {
        const K = u(L);
        if ("failure" in K)
          return K.failure;
        w.push(K.placement);
      }
      A.push(w);
    }
    s.push(f ? {
      kind: "split",
      groupId: String(c.groupId),
      enabled: c.enabled,
      xoverLowHz: c.xoverLowHz,
      xoverHighHz: c.xoverHighHz,
      xoverLowKeyTrackEnabled: y ? !1 : c.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: y ? 0 : c.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: y ? !1 : c.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: y ? 0 : c.xoverHighKeyTrackOffsetSemitones,
      branches: A
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: A
    });
  }
  for (const c of r)
    if ((o.get(c) ?? 0) !== 1)
      return S(`device ${c} must be placed exactly once`);
  return l > ut ? S(`flattens to ${l} wire entries; the topology upload holds ${ut}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: i, chain: s } };
}
function Hr() {
  const t = {};
  for (const e of De) {
    const n = Le[e];
    t[`${n}#1`] = {
      params: Xr(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: ni(),
    devices: t,
    chain: De.map((e) => ({
      kind: "device",
      deviceId: `${Le[e]}#1`,
      enabled: !1
    }))
  };
}
const jt = ["distortion#1", "delay#1", "reverb#1"];
function jr() {
  const t = Hr(), e = {};
  for (const n of jt) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: ni(),
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && jt.includes(n.deviceId))
  };
}
function Wr(t) {
  if (t === void 0)
    return jr();
  const e = zr(t);
  return e._tag === "ok" ? e.value : null;
}
function qr(t) {
  return Object.keys(t.devices).map((e) => {
    const n = ze(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => dt.indexOf(e.parsed.deviceType) - dt.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function ft(t) {
  const e = ze(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return sr(e.deviceType, e.instanceNumber - 1);
}
function ii(t) {
  const e = ti(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? Ir : br) + (e.unitNumber - 1);
}
function Gr(t) {
  const e = new Array(ut).fill(0);
  let n = 0, i = 0;
  const r = (o, a, s) => {
    e[i] = xr(o, a), s && (n |= 1 << i), i += 1;
  };
  for (const o of t.chain) {
    if (o.kind === "device") {
      r(ft(o.deviceId), 0, o.enabled);
      continue;
    }
    r(ii(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const l of a)
        r(ft(l.deviceId), s + 1, l.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function Jr(t) {
  const e = new Array(Bn).fill(0);
  return e[Sr] = t.xoverLowHz, e[vr] = t.xoverHighHz, e[Tr] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[Er] = t.xoverLowKeyTrackOffsetSemitones, e[Ar] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[Rr] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function Qr(t) {
  const e = [{
    endpointID: hr,
    value: t.output
  }];
  let n = 0;
  for (const i of qr(t)) {
    const r = ze(i.instanceId);
    if (r === null)
      throw new Error(`Invalid lane device identity during replay: ${i.instanceId}`);
    e.push({
      endpointID: er(
        r.deviceType,
        r.instanceNumber
      ),
      value: t.devices[i.instanceId].params[N(r.deviceType)]
    }), n += 1, e.push({
      endpointID: $t,
      value: {
        slotId: ft(i.instanceId),
        deliverySerial: n,
        values: lr(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  }
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: $t,
      value: {
        slotId: ii(i),
        deliverySerial: n,
        values: Jr(i)
      }
    }));
  return e.push({
    endpointID: mr,
    value: Gr(t)
  }), e;
}
function Xr(t) {
  const e = Xn.get(t);
  if (e === void 0)
    throw new Error(`Unknown lane device type: ${t}`);
  const n = Wn(e).parameters;
  return Object.fromEntries(Hn(t).map((i) => [
    i,
    n.find((r) => r.endpointID === i)?.initial ?? 0
  ]));
}
const mt = "runtimeState";
function ri(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const Yr = {
  endpointID: mt,
  required: !0,
  mapValue: ri
}, Zr = 2e3;
function Wt(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function qt(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function eo(t, e) {
  if (!qt(t))
    return { found: !1 };
  const n = qt(t.values) ? t.values : void 0;
  return n && Wt(n, e) ? {
    found: !0,
    value: n[e]
  } : Wt(t, e) ? {
    found: !0,
    value: t[e]
  } : { found: !1 };
}
function Gt(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class to {
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
    this.connection = e, this.options = n, this.stateKeys = [.../* @__PURE__ */ new Set([n.stateKey, ...n.fallbackStateKeys ?? []])], this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = no(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
            const r = eo(n, this.stateKeys[i]);
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
    }, r = Gt(n), o = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(i, o), s = Gt({
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
        this.options.sendTimeoutMilliseconds ?? Zr
      );
    this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function no(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function io(t, e) {
  return new to(t, e);
}
function ro(t) {
  return io(t, {
    stateKey: fr,
    runtimeEndpointDependencies: [Yr],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Wr,
    buildRuntimeEvents: ({ state: e }) => [...Qr(e)]
  });
}
const oo = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function ao(t) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(t) && !t.includes("__") && !oo.has(t);
}
function We(t, e = {}) {
  return Object.freeze({ kind: "parameter", endpoint: t, ...e });
}
function so(t) {
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
function lo(t) {
  const e = so({ codec: t.codec, initial: t.initial, lifetime: t.lifetime, history: t.history }), n = Object.freeze([...t.dependencies ?? []]);
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
const co = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.options");
function uo(t) {
  return Object.keys(t).filter((e) => t[e]?.kind === "stored" && t[e].engine?.kind === "shared-prepared").sort().map((e, n) => ({ key: e, input: n }));
}
function fo(t, e = {}) {
  if (e.historyLimit !== void 0 && (!Number.isSafeInteger(e.historyLimit) || e.historyLimit < 0))
    throw new Error("historyLimit must be a non-negative integer.");
  const n = uo(t);
  if (n.length && (!Number.isSafeInteger(e.memoryBudgetBytes) || (e.memoryBudgetBytes ?? 0) < 4))
    throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
  if (n.some(({ key: i }) => !ao(i) || i === "Data"))
    throw new Error("Shared state names must be valid Cmajor identifiers.");
  return Object.freeze(Object.defineProperty({ ...t }, co, { value: Object.freeze({ ...e }) }));
}
const q = 2048, ge = q + 3, Jt = 20, oi = "MSEG 1", mo = 0, G = 2;
function ye(t) {
  return t !== null && typeof t == "object" ? t : {};
}
function Rt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function ce(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function ho(t) {
  return Rt(Number.isFinite(t) ? t : 0, -Jt, Jt);
}
function X(t) {
  return Rt(Number.isFinite(t) ? t : 0, 0, 1);
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
function po(t) {
  const e = Number(t);
  return Rt(
    Number.isFinite(e) ? e : 1,
    mo,
    G
  );
}
function go(t) {
  if (!t || typeof t != "object")
    return null;
  const e = ye(t), n = X(Number(e.startX)), i = X(Number(e.endX));
  return ce(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function yo(t = si()) {
  const e = ye(t), n = ye(e.rate), i = Number(n.seconds), r = e.noteOffPolicy, o = r === "finish_loop" || r === "immediate" || r === "ignore" ? r : "finish_loop";
  return {
    format: "mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: po(Number.isFinite(i) ? i : 1)
    },
    loop: go(e.loop),
    noteOffPolicy: o,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function Io(t, e, n) {
  const i = ye(t);
  let r = Number(i.x);
  return Number.isFinite(r) || (r = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (r = X(r)), {
    x: r,
    y: X(Number(i.y)),
    curvePower: ho(Number(i.curvePower))
  };
}
function He(t = ai()) {
  const e = ye(t), n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((r, o) => Io(r, o, n.length));
  if (!ce(i[0].x, 0) || !ce(i[i.length - 1].x, 1))
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
function Qt(t) {
  return JSON.stringify(He(t));
}
function bo(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function So(t, e) {
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
function vo(t, e) {
  const n = X(Number(e)), i = So(t, n);
  if (i.laterPointWins || ce(i.from.x, i.to.x))
    return i.to.y;
  const r = i.to.x - i.from.x, o = r <= 0 ? 1 : (n - i.from.x) / r, a = X(bo(o, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * a;
}
function To(t, e) {
  return vo(He(t).points, e);
}
function Eo(t) {
  const e = new Float32Array(ge);
  return li(t, e), e;
}
function li(t, e) {
  if (e.length !== ge) throw new Error("Invalid MSEG destination length.");
  const n = He(t);
  for (let i = 0; i < q; i += 1) {
    const r = i / (q - 1);
    e[i + 1] = To(n, r);
  }
  e[0] = e[1], e[q + 1] = e[q], e[q + 2] = e[q];
}
function Xt(t, e) {
  return Qt(t) === Qt(e);
}
function C(t, e) {
  if (!t)
    throw new Error(e);
}
function qe(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function Ao(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function ht(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function ci(t) {
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
function Ro() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Ge(t, e) {
  const n = Ro();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Ao(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function Yt(t) {
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
  throw new Error(`Unsupported text resource payload (${ci(t)})`);
}
function xo(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return ht(t);
  throw new Error(`Unsupported binary resource payload (${ci(t)})`);
}
function Mo(t) {
  const e = t?.frames;
  C(
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
      C(a.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function ui(t) {
  const e = new DataView(t);
  C(qe(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), C(qe(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, o = null, a = null, s = null, l = null, u = 12;
  for (; u + 8 <= e.byteLength; ) {
    const f = qe(e, u, 4), d = e.getUint32(u + 4, !0), m = u + 8;
    f === "fmt " ? (n = e.getUint16(m, !0), i = e.getUint16(m + 2, !0), r = e.getUint32(m + 4, !0), a = e.getUint16(m + 12, !0), o = e.getUint16(m + 14, !0)) : f === "data" && (s = m, l = d), u = m + d + d % 2;
  }
  C(n !== null, "Wave file is missing a fmt chunk"), C(s !== null && l !== null, "Wave file is missing a data chunk"), C(i === 1, "Only mono wavetable bank files are supported");
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
async function Zt(t) {
  C(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return C(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function pt(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function di(t) {
  const e = new Uint8Array(t).buffer, n = ui(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function _o(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (l) => (C(typeof t.readResource == "function", `Resource bridge cannot read ${l}`), t.readResource(l)), r = async (l) => {
    C(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${l}`);
    const u = await t.readResourceAsAudioData(l);
    return Mo(u);
  }, o = (l) => {
    const u = t.getResourceAddress?.(l);
    return u ?? null;
  }, a = async (l, u = t.getResourceAddress?.(l)) => {
    const c = Ge(l, u), f = await Zt(c), d = ui(f);
    return {
      sampleRate: d.sampleRate,
      samples: d.samples
    };
  }, s = async (l, u = t.getResourceAddress?.(l)) => {
    const c = Ge(l, u);
    return new Uint8Array(await Zt(c));
  };
  return {
    async readText(l) {
      if (e === "bridge" && typeof t.readResource == "function")
        return Yt(await i(l));
      const u = o(l);
      return e === "url" && u !== null ? pt(await s(l, u)) : typeof t.readResource == "function" ? Yt(await i(l)) : pt(await s(l, u));
    },
    async readJSON(l) {
      return JSON.parse(await this.readText(l));
    },
    async readBytes(l) {
      return typeof t.readResource == "function" ? xo(await i(l)) : s(l);
    },
    async readAudio(l) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(l);
      const u = o(l);
      return n === "url" && u !== null ? a(l, u) : typeof t.readResourceAsAudioData == "function" ? r(l) : di(await this.readBytes(l));
    },
    getURL(l) {
      return Ge(l, t.getResourceAddress?.(l));
    }
  };
}
function Oo(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return _o(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function ko(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, o = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (i)
        return pt(await i(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (i)
        return i(a);
      if (e)
        return ht(await e(a));
      if (n)
        return ht(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return r ? r(a) : di(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function wo(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Do(t) {
  return wo(t) ? ko(t) : Oo(t);
}
const v = ["A", "B", "C"], fi = [
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
], Lo = [
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
], Y = Object.freeze([
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
]), No = Object.freeze([
  ...v.flatMap((t) => fi.map(
    (e) => `osc${t}.${e}`
  )),
  ...Lo
]);
new Set(
  v.flatMap((t) => fi.map(
    (e) => `osc${t}.${e}`
  ))
);
const mi = Object.freeze(
  No.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), Co = qn().filter(
  (t) => t.modulationTargetIndex !== null
), Po = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function xt(t) {
  const e = Fo(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function Fo(t) {
  const e = Po.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const Ko = [
  ...Co.map((t) => ({
    kind: xt(At(t)),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], hi = Object.freeze(
  Ko.sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), j = Object.freeze([
  ...mi,
  ...hi
]), _e = Y.length, pi = mi.length, je = hi.length, Uo = _e * j.length, Bo = new Map(Y.map((t) => [t.id, t])), gi = new Map(Y.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), ue = new Map(j.map((t) => [t.kind, t]));
function Vo() {
  if (_e !== 14 || pi !== 59 || je !== 47 || Uo !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = Y.filter((i) => i.group === t).sort((i, r) => i.runtimeIndex - r.runtimeIndex);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 59], ["rack", 47]]) {
    const n = j.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (Bo.size !== _e || gi.size !== _e || ue.size !== j.length)
    throw new Error("Modulation identities must be unique");
}
Vo();
function yi(t, e) {
  const n = gi.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function Mt(t) {
  return typeof t != "string" ? null : ue.has(t) ? t : null;
}
function $o(t) {
  const e = Mt(t);
  return e !== null && ue.get(e)?.group === "voice" ? e : null;
}
function _t(t) {
  const e = Mt(t);
  return e !== null && ue.get(e)?.group === "rack" ? e : null;
}
function zo(t) {
  const e = ue.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function Ii(t) {
  const e = ue.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function Ho(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const bi = 4, jo = bi * je, Wo = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), qo = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function Z(t) {
  if (typeof t != "string")
    return null;
  const e = qo.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Wo.get(n);
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
function Si(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function vi(t) {
  if (t === null)
    return null;
  const e = Si(t) - 1;
  return e > bi ? null : e * je + Ii(Ot(t));
}
function Go(...t) {
  return { ...ai(...t), format: "cosimo.mseg.shape" };
}
function en(...t) {
  return { ...He(...t), format: "cosimo.mseg.shape" };
}
function tn(...t) {
  return { ...si(...t), format: "cosimo.mseg.playback" };
}
function Jo(...t) {
  return { ...yo(...t), format: "cosimo.mseg.playback" };
}
const Je = "modulationProgram", Qo = "modulationAmount", Ti = Y.filter((t) => t.group === "voice").length, Ei = Y.filter((t) => t.group === "macro").length, Ne = pi, Xo = je, Ce = Xo + jo, J = Ti * Ne, te = Ei * Ne, Yo = Ti * Ce, Zo = Ei * Ce, W = 512, ee = 256, Ai = J + te;
function ea(t) {
  const e = yi(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function ta(t) {
  const e = $o(t);
  return e === null ? null : zo(e);
}
function Ri(t) {
  const e = ta(t.targetKind), n = _t(t.targetKind);
  let i = n === null ? void 0 : Ii(n);
  if (i === void 0) {
    const a = vi(
      Z(t.targetKind)
    );
    a !== null && (i = a);
  }
  if (e === null && i === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = yi(t.sourceKind, t.sourceSlot);
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
  const r = ea(t);
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
function xi(t) {
  return Z(t.targetKind) !== null ? null : Ri(t).articulationCellIndex;
}
function na(t) {
  if (_t(t.targetKind) !== null)
    return !1;
  const e = Z(t.targetKind);
  return e !== null && vi(e) === null;
}
function ia(t) {
  return {
    ...Ri(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function Mi(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (na(n))
      continue;
    const i = ia(n), r = e[i.path];
    if (r.has(i.cellIndex))
      throw new Error(`Duplicate modulation route cell ${i.path}:${i.cellIndex}`);
    r.set(i.cellIndex, i);
  }
  return e;
}
function ra(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function ne(t) {
  return [...t.values()].filter(ra).sort((e, n) => e.cellIndex - n.cellIndex);
}
function ve(t, e, n, i, r) {
  for (let o = 0; o < t.length; o += 1) {
    const a = t[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    e[o] = a.cellIndex, n[o] = a.sourceIndex, i[o] = a.targetIndex, r[o] = a.polarity;
  }
}
function Qe(t) {
  const e = Mi(t), n = ne(e.voice), i = ne(e.macroVoice), r = ne(e.voiceRack), o = ne(e.macroRack), a = Array.from({ length: J }, () => 0), s = Array.from({ length: J }, () => 0), l = Array.from({ length: J }, () => 0), u = Array.from({ length: J }, () => 0), c = Array.from({ length: J }, () => 0);
  ve(n, a, s, l, u);
  const f = Array.from({ length: te }, () => 0), d = Array.from({ length: te }, () => 0), m = Array.from({ length: te }, () => 0), p = Array.from({ length: te }, () => 0), y = Array.from({ length: te }, () => 0);
  if (ve(
    i,
    f,
    d,
    m,
    p
  ), r.length > W || o.length > ee)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${r.length} voice-rack (max ${W}), ${o.length} macro-rack (max ${ee})`
    );
  const g = Array.from({ length: W }, () => 0), I = Array.from({ length: W }, () => 0), A = Array.from({ length: W }, () => 0), T = Array.from({ length: W }, () => 0), w = Array.from({ length: W }, () => 0), L = Array.from({ length: Yo }, () => 0);
  ve(
    r,
    g,
    I,
    A,
    T
  );
  const K = Array.from({ length: ee }, () => 0), Ft = Array.from({ length: ee }, () => 0), Kt = Array.from({ length: ee }, () => 0), Ut = Array.from({ length: ee }, () => 0), Bt = Array.from({ length: Zo }, () => 0);
  ve(
    o,
    K,
    Ft,
    Kt,
    Ut
  );
  for (const O of e.voice.values()) c[O.cellIndex] = O.amount;
  for (const O of e.macroVoice.values()) y[O.cellIndex] = O.amount;
  for (const O of e.voiceRack.values()) L[O.cellIndex] = O.amount;
  for (const O of e.macroRack.values()) Bt[O.cellIndex] = O.amount;
  for (let O = 0; O < r.length; O += 1) {
    const Vt = r[O];
    if (Vt === void 0) throw new Error(`Missing compiled voice-rack route at index ${O}`);
    w[O] = Vt.reducer;
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
    macroVoiceRoutePolarities: p,
    macroVoiceRouteAmounts: y,
    voiceRackRouteCount: r.length,
    voiceRackRouteCells: g,
    voiceRackRouteSources: I,
    voiceRackRouteTargets: A,
    voiceRackRoutePolarities: T,
    voiceRackRouteReducers: w,
    voiceRackRouteAmounts: L,
    macroRackRouteCount: o.length,
    macroRackRouteCells: K,
    macroRackRouteSources: Ft,
    macroRackRouteTargets: Kt,
    macroRackRoutePolarities: Ut,
    macroRackRouteAmounts: Bt
  };
}
const oa = ["voice", "macroVoice", "voiceRack", "macroRack"], aa = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function nn(t) {
  return Mi(t);
}
function sa(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function la(t, e) {
  if (t === null)
    return [{ endpointID: Je, value: Qe(e) }];
  const n = nn(t), i = nn(e), r = [];
  for (const o of oa) {
    const a = ne(n[o]), s = ne(i[o]);
    if (a.length !== s.length)
      return [{ endpointID: Je, value: Qe(e) }];
    for (let l = 0; l < s.length; l += 1) {
      const u = a[l], c = s[l];
      if (u === void 0 || c === void 0 || !sa(u, c))
        return [{ endpointID: Je, value: Qe(e) }];
      u.amount !== c.amount && r.push({
        endpointID: Qo,
        value: {
          pathKind: aa[o],
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
function pe(t) {
  return { _tag: "err", error: t };
}
function ca(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function ua(t) {
  throw new Error(t ?? "Invariant violated");
}
const da = "globalTune", fa = "globalTuneSemitones", z = -24, fe = 24, rn = 0, _i = -48, Oi = 48, gt = -48, ki = 6, kt = 0, on = (kt - gt) / (ki - gt);
function Te(t, e, n, i, r = "percent", o = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: o };
}
const ma = [
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
], an = 1e-6;
function F(t, e) {
  if (!Number.isFinite(t) || t < -an || t > 1 + an)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function Pe(t, e) {
  return F(t / 100, `${e} catalog percentage`);
}
function Ie(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function ha(t) {
  return 20 * 1e3 ** t;
}
function pa(t) {
  return F(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function ga(t) {
  return 0.1 * 200 ** t;
}
function ya(t) {
  return F(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Ia(t) {
  return t;
}
function ba(t) {
  return F(t, "filterMix endpoint conversion");
}
function le(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function Sa(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: le("filterCutoff", ha, pa),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: le("filterQ", ga, ya),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: le("filterMix", Ia, ba),
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
function wi(t) {
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
      return ca(t);
  }
}
function va(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ta(t, e) {
  const n = Ie(t.moduleId, e.id), i = wi(e.format), r = Sa(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: Pe(e.defaultPercent, n),
    initialValue: Pe(e.initialPercent, n),
    format: i,
    modAmount: va(i),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const Ea = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: on * 100, defaultPercent: on * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Aa(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ra(t, e) {
  const n = `osc${t}`, i = Ie(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: Pe(e.defaultPercent, i),
    initialValue: Pe(e.initialPercent, i),
    format: wi(e.format),
    modAmount: Aa(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const xa = Object.freeze(
  v.flatMap((t) => Ea.map((e) => Ra(t, e)))
), Ma = Object.freeze({
  targetId: Ie("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: F(
    (rn - z) / (fe - z),
    "Global Tune default"
  ),
  initialValue: F(
    (rn - z) / (fe - z),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: fe },
  modAmount: {
    min: _i,
    max: Oi,
    unit: "st",
    digits: 2
  },
  binding: le(
    da,
    (t) => z + (fe - z) * t,
    (t) => F(
      (t - z) / (fe - z),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: fa
});
function _a(t) {
  const e = Ie("voice-enhancer", t.key), n = F(
    zt(t, t.initial),
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
    binding: le(
      t.endpointID,
      (i) => Cr(t, i),
      (i) => F(
        zt(t, i),
        `${t.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: t.targetKind
  });
}
const Oa = Object.freeze(
  Object.values(Nr).map(_a)
), ka = Object.freeze([
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
  const e = Ie(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (o) => t.min + n * o, r = (o) => F(
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
    binding: le(t.endpointID, i, r),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const Da = Object.freeze(
  ka.map(wa)
), La = Object.freeze([
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
function Na(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function Xe(t, e) {
  const n = t.valueKind === "effect-output-trim-db" ? tr(e) : t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return F(n, `${t.endpointID} endpoint conversion`);
}
function Ca(t, e) {
  return t.valueKind === "effect-output-trim-db" ? nr(e) : t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Pa(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Fa(t) {
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
function Ka(t) {
  const e = Na(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: Xe(t, t.initial),
    initialValue: Xe(t, t.initial),
    format: Pa(t),
    modAmount: Fa(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Ca(t, n),
      fromEngine: (n) => Xe(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : xt(At(t))
  });
}
const wt = Object.freeze(
  [
    ...$e.flatMap((t) => t.parameters.map(Ka)),
    ...La,
    Ma,
    ...Oa,
    ...xa,
    ...Da,
    ...ma.flatMap(
      (t) => t.parameters.map(
        (e) => Ta(t, e)
      )
    )
  ]
), Ua = new Map(
  wt.map((t) => [t.targetId, t])
), Di = wt.filter(
  (t) => t.modulationTargetKind !== null
), yt = new Map(
  Di.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Ua.size !== wt.length)
  throw new Error("Target descriptor IDs must be unique");
if (Di.length !== j.length || yt.size !== j.length || j.some((t) => yt.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function Ye(t) {
  const e = yt.get(t);
  return e === void 0 ? ua(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  $e.map((t) => [t.id, t.label])
);
function Ba(t) {
  const e = Si(t);
  return e === 1 ? "" : ` ${e}`;
}
function Va(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = Ye(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = Z(t);
  if (n !== null) {
    const i = Ye(Ot(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : i.moduleId.toUpperCase()}${Ba(n)} ${i.label.toUpperCase()}`;
  }
  return Ye(t).label.toUpperCase();
}
const ie = "modulation.v6", Li = 6, be = 3, re = 3, $a = 4, sn = "modulationMsegBuffer", za = "modulationMsegPlayback", Ni = 4, Ha = ["MSEG 1", "MSEG 2", "MSEG 3"], Ci = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], ja = ["Env 1", "Env 2", "Env 3"], Wa = 1e-3, E = 10, qa = 0.1, Ga = 20, ln = 10 - 0.1, Ja = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: Ga - qa },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: _i,
    max: Oi
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
  voiceEnhancerQ: { min: -ln, max: ln },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Qa = qn().filter((t) => t.modulationTargetIndex !== null), Xa = new Map(
  Qa.map((t) => [
    xt(At(t)),
    t
  ])
);
class Ze extends Error {
  name = "ModulationStateParseError";
}
const Ya = {
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
Y.map((t) => ({
  value: t.id,
  label: Ya[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const Za = j.map((t) => ({
  value: t.kind,
  label: Va(t.kind)
}));
Za.filter((t) => !ts(t.value));
function es(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Dt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function et(t, e) {
  const n = Number(t);
  return Dt(Number.isFinite(n) ? n : e, Wa, E);
}
function ts(t) {
  return _t(t) !== null;
}
function ns(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (t.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function is(t) {
  const e = Z(t);
  return e !== null ? Ot(e) : t;
}
function rs(t) {
  const e = is(t);
  if (Z(e)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = Xa.get(e);
  return n !== void 0 ? ns(n) : Ja[Ho(e)];
}
function os(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function as(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function ss(t, e) {
  const n = rs(t), i = Number(e);
  return Dt(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function ls(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function cs(t) {
  return ls(t) ?? "mseg";
}
function us(t) {
  const e = Mt(t);
  return e !== null ? e : Z(t) !== null ? t : null;
}
function ds(t) {
  return us(t) ?? "oscA.wavetablePosition";
}
function fs(t, e) {
  const n = Ci[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function ms(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? be : t === "macro" ? Ni : $a;
  return Dt(Number.isFinite(n) ? n : 1, 1, i);
}
function oe(t) {
  return {
    name: ja[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function Pi(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = oe(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: et(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: et(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: X(n.sustain ?? i.sustain),
    releaseSeconds: et(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function hs(t, e = 0) {
  return { name: Pi(t, e).name };
}
function ps(t, e, n, i) {
  const r = Number(t.amount);
  return {
    id: os(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: ms(n, t.sourceSlot),
    polarity: as(t.polarity),
    targetKind: i,
    amount: ss(i, r),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function gs(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, r = cs(i.sourceKind), o = ds(i.targetKind);
  return ps(i, e, r, o);
}
function ys(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function Is(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => gs(n, i));
}
function bs(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const r = ys(i);
    if (e.has(i.id) || n.has(r))
      return !1;
    e.add(i.id), n.add(r);
  }
  return !0;
}
function It(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, s) => It(a, e[s]));
  const n = t, i = e, r = Object.keys(n), o = Object.keys(i);
  return r.length === o.length && r.every((a) => es(i, a) && It(n[a], i[a]));
}
function Fi(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = Go(Ha[e] ?? `MSEG ${e + 1}`), r = en(n.shapeA ?? i), o = Jo({
    ...tn(),
    ...n.playback ?? {},
    rate: tn().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: r,
    shapeB: en(n.shapeB ?? r),
    playback: s
  };
}
function Fe() {
  return {
    format: "cosimo.modulation",
    version: Li,
    msegSlots: Array.from({ length: be }, (t, e) => Fi({}, e)),
    envelopeSlots: Array.from({ length: re }, (t, e) => ({
      name: oe(e).name
    })),
    routes: [],
    macroNames: Ci.slice()
  };
}
function Ss(t = Fe()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], r = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: Li,
    msegSlots: Array.from({ length: be }, (o, a) => Fi(n[a], a)),
    envelopeSlots: Array.from({ length: re }, (o, a) => hs(i[a], a)),
    routes: Is(e.routes),
    macroNames: Array.from(
      { length: Ni },
      (o, a) => fs(r[a], a)
    )
  };
}
function tt(t) {
  const e = Ke(t);
  if (e._tag === "err")
    throw e.error;
  return JSON.stringify(e.value);
}
function Ke(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return pe(new Ze("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return pe(new Ze("Expected valid modulation JSON"));
    }
  }
  const n = Ss(e);
  return !It(e, n) || !bs(n.routes) ? pe(new Ze("Expected the current modulation schema")) : de(n);
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
function cn(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(Eo(n))
  };
}
function Ts(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function un(t, e = null, n) {
  const i = [];
  for (let r = 0; r < be; r += 1) {
    const o = t.msegSlots[r], a = e?.msegSlots[r];
    (a === void 0 || !Xt(a.shapeA, o.shapeA)) && i.push(n ? n(r, 0, o.shapeA) : {
      endpointID: sn,
      value: cn(r, 0, o.shapeA)
    }), (a === void 0 || !Xt(a.shapeB, o.shapeB)) && i.push(n ? n(r, 1, o.shapeB) : {
      endpointID: sn,
      value: cn(r, 1, o.shapeB)
    }), (a === void 0 || !Ts(a.playback, o.playback)) && i.push({
      endpointID: za,
      value: vs(r, o.playback)
    });
  }
  return i.push(...la(e?.routes ?? null, t.routes)), i;
}
function Ki(t) {
  if (!(t === null || typeof t != "object")) {
    for (const e of Object.values(t)) Ki(e);
    Object.freeze(t);
  }
}
const Es = {
  parse(t) {
    const e = Ke(t);
    return e._tag === "err" ? { kind: "error", message: e.error.message } : (Ki(e.value), { kind: "ok", value: e.value });
  },
  encode: tt,
  equals: (t, e) => tt(t) === tt(e)
}, nt = "articulationSnapshot", R = 128, dn = 48, As = 1e6, _ = -1, it = [
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
function Lt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function rt(t) {
  return Lt(Number.isFinite(t) ? t : 0, 0, 1);
}
function k(t, e, n = -Number.MAX_VALUE, i = Number.MAX_VALUE) {
  const r = Number(t);
  return Lt(Number.isFinite(r) ? r : e, n, i);
}
function M(t, e, n, i) {
  return Lt(Math.round(k(t, e)), n, i);
}
function Ui(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function ot() {
  return Array.from({ length: R }, () => _);
}
function Rs(t) {
  const e = M(t, 0, 0, R - 1), n = it[e % it.length], i = Math.floor(e / it.length);
  return i === 0 ? n : `${n} ${i + 1}`;
}
function xs() {
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
function Ms(t) {
  const e = xs(), n = t && typeof t == "object" ? t : {}, i = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: k(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: k(n.pan, e.pan, -1, 1),
    octave: M(n.octave, e.octave, -4, 4),
    semitone: M(n.semitone, e.semitone, -12, 12),
    fineCents: k(n.fineCents, e.fineCents, -100, 100),
    volumeDb: k(
      n.volumeDb,
      e.volumeDb,
      gt,
      ki
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
      rt(Number(i[0])),
      rt(Number(i[1])),
      rt(Number(i[2]))
    ]
  };
}
function _s(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: k(e.amount, 0, -48, 48)
  } : null;
}
function Os(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(_s).filter((r) => r !== null) : [], i = /* @__PURE__ */ new Map();
  for (const r of n)
    i.set(r.routeId, r);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Ms(e.parameters),
    envelopes: [0, 1, 2].map((r) => Pi(
      Array.isArray(e.envelopes) ? e.envelopes[r] : void 0,
      r
    )),
    modRouteAmounts: [...i.values()]
  };
}
function ks(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = M(n.runtimeSlot, e, 0, R - 1), r = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${i}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Rs(i);
  return {
    id: r,
    runtimeSlot: i,
    name: o,
    snapshot: Os(n.snapshot)
  };
}
function ws(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(i) ? {
    note: M(n.note, 0, 0, R - 1),
    articulationId: i
  } : null;
}
function Ds(t, e, n, i, r) {
  if (!t || typeof t != "object")
    return null;
  const o = t, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let s = M(o.min, r, r, R - 1), l = M(o.max, s, r, R - 1);
  return l < s && ([s, l] = [l, s]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${i}-${n}`,
    articulationId: a,
    min: s,
    max: l
  };
}
function fn(t, e, n, i) {
  const r = Array.isArray(t) ? t : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < r.length; s += 1) {
    const l = Ds(
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
function Ls(t, e) {
  const n = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), r = [];
  for (const o of n) {
    const a = ws(o, e);
    !a || i.has(a.note) || (i.add(a.note), r.push(a));
  }
  return r;
}
function Ns(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], i = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), o = [];
  for (let l = 0; l < n.length && o.length < R; l += 1) {
    const u = ks(n[l], l);
    !u || i.has(u.runtimeSlot) || r.has(u.id) || (i.add(u.runtimeSlot), r.add(u.id), o.push(u));
  }
  const a = typeof e.selectedSlotId == "string" && o.some((l) => l.id === e.selectedSlotId) ? e.selectedSlotId : null, s = new Set(o.map((l) => l.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: Ui(e.activeTriggerMode),
    slots: o,
    chainAssignments: fn(e.chainAssignments, s, "chain", 0),
    keyAssignments: Ls(e.keyAssignments, s),
    velocityAssignments: fn(e.velocityAssignments, s, "velocity", 1)
  };
}
function mn(t) {
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
    msegMorphs: Array.from({ length: be }, () => 0),
    routeAmounts: Array.from({ length: Ai }, () => 0),
    envelopeAttackSeconds: Array.from({ length: re }, (n, i) => oe(i).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: re }, (n, i) => oe(i).decaySeconds),
    envelopeSustain: Array.from({ length: re }, (n, i) => oe(i).sustain),
    envelopeReleaseSeconds: Array.from({ length: re }, (n, i) => oe(i).releaseSeconds)
  };
}
function hn(t, e, n) {
  for (const i of e) {
    const r = n.get(i.articulationId);
    if (r !== void 0)
      for (let o = i.min; o <= i.max; o += 1)
        t[o] === _ && (t[o] = r);
  }
}
function Cs(t) {
  const e = Ns(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), i = ot(), r = ot(), o = ot();
  hn(i, e.chainAssignments, n), hn(o, e.velocityAssignments, n);
  for (const a of e.keyAssignments) {
    const s = n.get(a.articulationId);
    s === void 0 || r[a.note] !== _ || (r[a.note] = s);
  }
  return o[0] = _, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: e.activeTriggerMode,
    chain: i,
    key: r,
    velocity: o
  };
}
function Bi(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : Cs(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: Ui(e.activeMode),
    chain: Array.from({ length: R }, (n, i) => M(e.chain?.[i], _, _, R - 1)),
    key: Array.from({ length: R }, (n, i) => M(e.key?.[i], _, _, R - 1)),
    velocity: Array.from({ length: R }, (n, i) => i === 0 ? _ : M(e.velocity?.[i], _, _, R - 1))
  });
}
function Ps(t, e) {
  const n = Bi(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const i = globalThis;
  typeof i.cosimo_set_articulation_trigger_config == "function" && i.cosimo_set_articulation_trigger_config(n);
}
const P = "articulations.v4", Nt = [
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
], Ct = [
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
], Fs = [
  ...v.flatMap((t) => Nt.map(
    (e) => `osc${t}.${e}`
  )),
  ...Ct
];
class Vi extends Error {
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
  return pe(new Vi("malformed", t));
}
function Se(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Pt(t, e, n) {
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
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < R;
}
function Ks(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function Us(t) {
  return Fs.some((e) => e === t);
}
function pn(t, e) {
  if (!Se(t))
    return b(`${e} must be an object`);
  const n = Pt(t, ["min", "max"], e);
  return n !== null ? b(n) : Ue(t.min) ? Ue(t.max) ? t.min > t.max ? b(`${e}.min must be less than or equal to ${e}.max`) : de({ min: t.min, max: t.max }) : b(`${e}.max must be an integer in 0..127`) : b(`${e}.min must be an integer in 0..127`);
}
function Bs(t, e) {
  if (!Se(t))
    return b(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return b(`${e} has a non-string parameter id`);
    if (!Us(i))
      return b(`${e} has unknown parameter id "${i}"`);
    const r = t[i];
    if (typeof r != "number" || !Number.isFinite(r))
      return b(`${e}.${i} must be a finite number`);
    n[i] = r;
  }
  return de(n);
}
function Vs(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function $s() {
  return {};
}
function zs(t, e, n) {
  if (!Se(t))
    return b(`${e} must be an object`);
  const i = $s();
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return b(`${e} has a non-string route id`);
    const o = t[r];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > dn)
      return b(
        `${e}.${r} must be a finite route amount within ±${dn}`
      );
    if (!n.has(r))
      return b(`${e}.${r} does not name a current articulable mapping`);
    Vs(i, r, o);
  }
  return de(i);
}
function Hs(t, e, n) {
  const i = `slots[${e}]`;
  if (!Se(t))
    return b(`${i} must be an object`);
  const r = Pt(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    i
  );
  if (r !== null)
    return b(r);
  if (typeof t.id != "string")
    return b(`${i}.id must be a string`);
  if (!Ue(t.runtimeSlot))
    return b(`${i}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return b(`${i}.name must be a string`);
  if (typeof t.color != "string")
    return b(`${i}.color must be a string`);
  if (!Ue(t.key))
    return b(`${i}.key must be an integer in 0..127`);
  const o = pn(t.velRange, `${i}.velRange`);
  if (o._tag === "err")
    return o;
  const a = pn(t.chainRange, `${i}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = Bs(t.overrides, `${i}.overrides`);
  if (s._tag === "err")
    return s;
  const l = zs(
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
const js = Object.fromEntries(
  Nt.map((t, e) => [t, 2 ** e])
), Ws = Object.fromEntries(
  Ct.map((t, e) => [t, 2 ** e])
);
function gn(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function qs(t, e) {
  return Nt.reduce((n, i) => Object.hasOwn(t.overrides, `osc${e}.${i}`) ? n | js[i] : n, 0);
}
function Gs(t) {
  return Ct.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | Ws[n] : e, 0);
}
function Js(t, e) {
  const n = (o, a) => gn(t, `osc${o}.${a}`), i = (o) => gn(t, o), r = Array.from(
    { length: Ai },
    () => As
  );
  for (const [o, a] of Object.entries(t.routeAmounts)) {
    const s = e[o];
    s !== void 0 && (r[s] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: v.map((o) => qs(t, o)),
    sharedOverrideMask: Gs(t),
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
function Qs(t, e) {
  return t.slots.map((n) => Js(n, e));
}
function Xs(t, e) {
  if (!Se(t))
    return b("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return b('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return pe(new Vi(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = Pt(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return b(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return b("selectedSlotId must be null or a string");
  if (!Ks(t.activeTriggerMode))
    return b('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return b("slots must be an array");
  if (t.slots.length > R)
    return b(`slots must contain at most ${R} entries`);
  const i = [], r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const s = Hs(t.slots[a], a, e);
    if (s._tag === "err")
      return s;
    const l = s.value;
    if (r.has(l.id))
      return b(`slots[${a}].id duplicates "${l.id}"`);
    if (o.has(l.runtimeSlot))
      return b(`slots[${a}].runtimeSlot duplicates ${l.runtimeSlot}`);
    r.add(l.id), o.add(l.runtimeSlot), i.push(l);
  }
  return t.selectedSlotId !== null && !r.has(t.selectedSlotId) ? b(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : de({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: i
  });
}
function $i() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Ys(t) {
  const e = Array.from({ length: R }, () => _), n = Array.from({ length: R }, () => _), i = Array.from({ length: R }, () => _);
  for (const r of t.slots) {
    n[r.key] === _ && (n[r.key] = r.runtimeSlot);
    for (let o = r.chainRange.min; o <= r.chainRange.max; o += 1)
      e[o] === _ && (e[o] = r.runtimeSlot);
    for (let o = r.velRange.min; o <= r.velRange.max; o += 1)
      i[o] === _ && (i[o] = r.runtimeSlot);
  }
  return i[0] = _, {
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: t.activeTriggerMode,
    chain: e,
    key: n,
    velocity: i
  };
}
async function Zs(t, e, n, i = {}) {
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
const el = 3, tl = (4 + ge) * 4, yn = "runtimeInstallAck", zi = "runtimeSyncRequest", bt = 0, nl = 8e3, Be = /* @__PURE__ */ new WeakMap(), Hi = 1e9;
let Ee = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % Hi;
function il(t) {
  return Ee = Ee % Hi + 1, t === "modulation" ? -1e9 - Ee : 1e9 + Ee;
}
function rl(t, e) {
  const n = t, i = Be.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), Be.set(n, i);
}
function In(t, e) {
  const n = t, i = Be.get(n);
  i?.delete(e), i?.size === 0 && Be.delete(n);
}
const ol = [100, 250, 500, 1e3], Ae = { _tag: "accepted" }, al = { _tag: "superseded" }, sl = { _tag: "stopped" }, bn = { _tag: "transport-timeout" };
function ll(t) {
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
function cl(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class Sn {
  #o;
  #t;
  #m;
  #v;
  #h = !1;
  #u = /* @__PURE__ */ new Set();
  #n = null;
  #a = null;
  #l = /* @__PURE__ */ new Set();
  #e = null;
  #d = 0;
  #r = /* @__PURE__ */ new Map();
  #f = 0;
  #i = !1;
  #s = 0;
  #p = /* @__PURE__ */ new Set();
  #T = this.#O.bind(this);
  constructor(e, n) {
    this.#o = e, this.#t = n.laneKind;
    const i = n.probeDelaysMilliseconds?.map((r) => Math.max(0, Math.trunc(r))).filter((r) => Number.isFinite(r));
    this.#m = i && i.length > 0 ? i : [...ol], this.#v = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? nl)
    );
  }
  start() {
    if (!this.#i) {
      rl(this.#o, this.#t);
      try {
        this.#f += 1, this.#i = !0, this.#a = null, this.#l.clear(), this.#o.addEndpointListener?.(yn, this.#T);
      } catch (e) {
        throw this.#i = !1, In(this.#o, this.#t), e;
      }
    }
  }
  stop() {
    if (this.#i) {
      this.#i = !1;
      for (const e of this.#u) e();
      this.#o.removeEndpointListener?.(yn, this.#T), In(this.#o, this.#t), this.#r.clear(), this.#a = null, this.#l.clear(), this.#S();
    }
  }
  observeRuntime(e) {
    const n = Math.trunc(Number(e) || 0);
    if (n !== this.#n) {
      for (const i of this.#u) i();
      this.#n = n, this.#a = null, this.#l.clear(), this.#e?.dspSessionId !== n && (this.#e = null), this.#r.clear(), this.#s += 1, this.#S();
    }
  }
  getAcceptedFrontier() {
    return this.#e?.dspSessionId !== this.#n ? 0 : this.#t === "modulation" ? this.#e.acceptedModulationSerial : this.#e.acceptedArticulationSerial;
  }
  getLatestAck() {
    return this.#e ? { ...this.#e } : null;
  }
  hasSessionBaseline() {
    return this.#n !== null && this.#a === this.#n;
  }
  async waitForSessionBaseline() {
    const e = this.#n, n = this.#f;
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
    if (this.#n === null)
      return {
        _tag: "unavailable",
        reason: "no-runtime-session"
      };
    this.#h = !0;
    const n = this.#n, i = this.#f;
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
        if (s._tag === "rejected" && this.#t === "articulation") {
          o ??= s;
          continue;
        }
        if (s._tag !== "accepted")
          return s;
      }
      return o ?? Ae;
    } finally {
      this.#h = !1;
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
  async #E(e, n) {
    if (this.#a === e)
      return Ae;
    const i = il(this.#t);
    this.#l.add(i);
    const r = Date.now() + this.#v;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#c(e, n);
        if (a)
          return a;
        if (this.#a === e)
          return Ae;
        const s = r - Date.now();
        if (s <= 0)
          return bn;
        const l = this.#s;
        this.#I(i), await this.#b(
          l,
          Math.min(this.#y(o), s)
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
    this.#u.add(s);
    const u = async () => {
      this.#c(n, i) || ("submit" in e ? await e.submit({ dspSessionId: n, deliverySerial: r, signal: l }) : this.#_(e.endpointID, cl(e.value, n, r)));
    };
    try {
      let c = 0, f = 0, d = this.#d;
      for (await u(); ; ) {
        const m = this.#c(n, i);
        if (m)
          return m;
        const p = this.#g(n, r, d);
        if (p !== null)
          return p;
        const y = this.#s;
        await this.#b(
          y,
          this.#y(c)
        );
        const g = this.#g(
          n,
          r,
          d
        );
        if (g !== null)
          return g;
        let I = this.#s;
        for (this.#I(r); ; ) {
          const A = this.#c(n, i);
          if (A)
            return A;
          const T = await this.#b(
            I,
            this.#y(c)
          ), w = this.#g(
            n,
            r,
            d
          );
          if (w !== null)
            return w;
          if (T && this.#e?.dspSessionId === n && this.#e.syncSerial === r) {
            if (f >= 1)
              return bn;
            d = this.#d, await u(), f += 1, c += 1;
            break;
          }
          if (T) {
            I = this.#s;
            continue;
          }
          T || (c += 1, I = this.#s, this.#I(r));
        }
      }
    } catch (c) {
      const f = this.#c(n, i);
      if (f) return f;
      throw c;
    } finally {
      s(), this.#u.delete(s);
    }
  }
  #g(e, n, i) {
    const r = this.#e;
    if (!r || r.dspSessionId !== e)
      return null;
    const o = this.#r.get(n);
    return o !== void 0 && o.version > i && o.acknowledgement.dspSessionId === e ? (this.#r.delete(n), {
      _tag: "rejected",
      acknowledgement: { ...o.acknowledgement }
    }) : this.#R(r, n) ? (this.#r.delete(n), Ae) : null;
  }
  #c(e, n) {
    return !this.#i || this.#f !== n ? sl : this.#n !== e ? al : null;
  }
  #y(e) {
    return this.#m[Math.min(
      e,
      this.#m.length - 1
    )];
  }
  #_(e, n) {
    try {
      this.#o.sendEventOrValue?.(
        e,
        n,
        void 0,
        bt
      );
    } catch {
    }
  }
  #I(e) {
    if (this.#i)
      try {
        this.#o.sendEventOrValue?.(
          zi,
          e,
          void 0,
          bt
        );
      } catch {
      }
  }
  #O(e) {
    const n = ll(e);
    if (!n || this.#n !== null && n.dspSessionId !== this.#n || this.#a === n.dspSessionId && this.#e?.dspSessionId === n.dspSessionId && (n.acceptedModulationSerial < this.#e.acceptedModulationSerial || n.acceptedArticulationSerial > this.#e.acceptedArticulationSerial))
      return;
    if (this.#l.has(n.syncSerial) && (this.#a = n.dspSessionId), this.#e = n, this.#d += 1, this.#t === "modulation" ? n.rejectedSerial > 0 : n.rejectedSerial < 0)
      for (this.#r.set(n.rejectedSerial, {
        acknowledgement: { ...n },
        version: this.#d
      }); this.#r.size > 16; ) {
        const r = this.#r.keys().next().value;
        if (r === void 0) break;
        this.#r.delete(r);
      }
    this.#s += 1, this.#S();
  }
  #b(e, n) {
    return !this.#i || this.#s !== e ? Promise.resolve(!0) : new Promise((i) => {
      let r = !1;
      const o = {
        finish: (a) => {
          r || (r = !0, o.timeoutHandle !== null && clearTimeout(o.timeoutHandle), this.#p.delete(o), i(a));
        },
        timeoutHandle: null
      };
      o.timeoutHandle = setTimeout(() => o.finish(!1), n), this.#p.add(o);
    });
  }
  #S() {
    for (const e of [...this.#p])
      e.finish(!0);
  }
}
const ul = 1e3, dl = [ie, P];
function vn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function at(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (vn(i, e)) return i[e];
  if (vn(n, e)) return n[e];
}
function st(t, e) {
  if (t === void 0) return $i();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const i = Xs(n, e);
  return i._tag === "ok" ? i.value : null;
}
function Tn(t) {
  return new Set(t.routes.flatMap((e) => xi(e) === null ? [] : [e.id]));
}
function En(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
function An(t, e) {
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
class fl {
  constructor(e, n) {
    this.connection = e, this.frameworkInput = n, this.modulationLane = new Sn(e, { laneKind: "modulation" }), this.articulationLane = new Sn(e, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = Fe();
  articulationBank = $i();
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
  deliveryObserver;
  handleStoredStateValueBound = this.handleStoredStateValue.bind(this);
  handleRuntimeStateBound = this.handleRuntimeState.bind(this);
  /** Replace desired engine data already accepted by the framework, without persisting it. */
  replaceModulation(e, n) {
    if (!this.frameworkInput) throw new Error("Stored modulation input cannot accept framework replacements.");
    this.modulationState = e, this.hasModulationState = !0, this.deliveryObserver = n, this.applyRuntimeStateIfReady();
  }
  get bootKeys() {
    return this.frameworkInput ? [P] : dl;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(mt, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(mt, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
    const n = at(e, ie), i = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: Fe() } : Ke(n);
    if (i._tag === "err") {
      console.error(`[runtime-state-worker] ${ie} is invalid; boot state was not installed.`);
      const a = at(e, P), s = st(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = i.value, this.hasModulationState = !0;
    const r = at(e, P), o = st(
      r,
      Tn(i.value)
    );
    if (o === null) {
      console.error(`[runtime-state-worker] ${P} is invalid; boot state was not installed.`);
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
    if (e === ie) {
      const r = Ke(n);
      if (r._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${ie}.`);
        return;
      }
      this.modulationState = r.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const i = st(n, Tn(this.modulationState));
    if (i === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${P}.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = ri(e);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(zi, 0, void 0, bt), this.hasRuntimeState || this.scheduleRecovery());
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
    const e = this.lifecycleEpoch, n = this.runtimeGeneration, i = this.modulationState, r = this.articulationBank, o = this.deliveryObserver, s = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, l = this.frameworkInput?.curveCommand ? un(i, s, this.frameworkInput.curveCommand) : un(i, s), u = await this.modulationLane.sendBatch(l);
    if (!this.started || e !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", u, i)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const g = An("modulation", u);
      g && o?.(g), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = i, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, i, r)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const c = this.buildUploadsBySelector(i, r), f = Array.from({ length: R }, (g, I) => {
      const A = c.get(I);
      return A ? En(A) : null;
    }), d = this.lastAppliedArticulationGeneration !== n, m = d && this.articulationLane.getAcceptedFrontier() !== 0, p = [];
    for (let g = 0; g < R; g += 1) {
      const I = c.get(g), A = f[g] !== this.lastAppliedArticulationTokens[g];
      m ? p.push({
        endpointID: nt,
        value: I ?? mn(g)
      }) : d ? I && p.push({ endpointID: nt, value: I }) : A && p.push({
        endpointID: nt,
        value: I ?? mn(g)
      });
    }
    const y = await this.articulationLane.sendBatch(p);
    if (!(!this.started || e !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", y, f)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = f;
        const g = Ys(r);
        if (this.frameworkInput) {
          const I = await this.frameworkInput.publishTriggerConfig(g);
          if (!this.started || e !== this.lifecycleEpoch) return;
          I.kind !== "cancelled" && o?.(I);
        } else
          Ps(g, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const I of p) this.lastAppliedArticulationTokens[I.value.selectorA] = void 0;
        const g = An("articulation", y);
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
      const o = xi(r);
      return o === null ? [] : [[r.id, o]];
    }));
    return new Map(
      Qs(n, i).map((r) => [r.selectorA, r])
    );
  }
  acceptOutcome(e, n, i) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const r = En(i), o = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== r;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, r), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, ul));
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
const ml = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [P],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(t) {
    let e = Rn(t);
    return {
      apply(n, i) {
        return e.closed && (e = Rn(t)), e.apply(n, i);
      },
      stop() {
        e.stop();
      }
    };
  }
};
function Rn(t) {
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
      const p = o.get(d) ?? /* @__PURE__ */ new Map();
      p.set(m, t.listen(d, m)), o.set(d, p);
    },
    removeEndpointListener(d, m) {
      o.get(d)?.get(m)?.(), o.get(d)?.delete(m);
    },
    addStoredStateValueListener(d) {
      a.set(d, t.subscribeStored(
        P,
        (m) => d({ key: P, value: m })
      ));
    },
    removeStoredStateValueListener(d) {
      a.get(d)?.(), a.delete(d);
    },
    requestFullStoredState(d) {
      t.readStored(P).then((m) => {
        e || d({ values: { [P]: m } });
      }, (m) => t.fail(m));
    },
    sendEventOrValue(d, m) {
      e || u(t.send({ kind: "event", endpoint: d, value: m }));
    }
  }, f = new fl(c, {
    onDefect(d) {
      l(), t.fail(d);
    },
    curveCommand: (d, m, p) => ({
      async submit({ dspSessionId: y, deliverySerial: g, signal: I }) {
        const A = await t.prepareData(
          el + d * 2 + m,
          tl,
          (T) => {
            new Int32Array(T.buffer, T.byteOffset, 4).set([1297302855, y, g, ge]), li(p, new Float32Array(T.buffer, T.byteOffset + 16, ge));
          },
          I
        );
        A.kind === "failed" && (s(A), l());
      }
    }),
    async publishTriggerConfig(d) {
      const p = (await Promise.all(r)).find((g) => g.kind !== "sent");
      if (p) return p.kind === "failed" ? p : { kind: "cancelled" };
      if (e) return { kind: "cancelled" };
      const y = t.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: Bi(d) });
      return y.kind === "submitted" ? y.completion : y;
    }
  });
  return {
    get closed() {
      return e;
    },
    apply(d, m) {
      if (e || m.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const p = ++n;
      return new Promise((y) => {
        const g = m.signal.onAbort(() => {
          s({ kind: "cancelled" }), l();
        });
        i = (I) => {
          g(), y(I);
        }, f.replaceModulation(d, (I) => {
          p === n && I.kind !== "preparing" && s(I);
        }), f.start();
      });
    },
    stop: l
  };
}
fo({
  playMode: We("playMode"),
  glideTime: We("glideTime"),
  globalTune: We("globalTune"),
  [ie]: lo({ initial: Fe(), codec: Es, prepare: (t) => t, engine: ml })
});
const Oe = 2048;
function me(t, e) {
  if (!t)
    throw new Error(e);
}
function hl(t) {
  me(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    me(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), me(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), me(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), me(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const pl = 2048, Ve = 11, gl = 256;
function U(t, e) {
  if (!t)
    throw new Error(e);
}
function yl(t) {
  return t > 0 && (t & t - 1) === 0;
}
const xn = /* @__PURE__ */ new Map();
function Il(t) {
  const e = xn.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let o = 0, a = r;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    i[r] = o;
  }
  return xn.set(t, i), i;
}
function ji(t, e, n = !1) {
  const i = t.length;
  U(i === e.length, "FFT real and imaginary buffers must have the same length"), U(yl(i), "FFT input length must be a power of two");
  const r = Il(i);
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
        const p = c + m, y = p + a, g = t[y], I = e[y], A = f * g - d * I, T = f * I + d * g, w = t[p], L = e[p];
        t[p] = w + A, e[p] = L + T, t[y] = w - A, e[y] = L - T;
        const K = f * l - d * u;
        d = f * u + d * l, f = K;
      }
    }
  }
  if (n)
    for (let o = 0; o < i; o += 1)
      t[o] /= i, e[o] /= i;
}
function Wi(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    r[o] = (Number(e[o]) || 0) - i;
  return r;
}
function bl(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = pl,
  maxFramesPerTable: i = gl
} = {}) {
  const r = Float32Array.from(t);
  U(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = r.length / n;
  U(o > 0, "Source wavetable files must contain at least one frame"), U(o <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && U(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const l = s * n, u = l + n;
    a.push(Wi(r.slice(l, u)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function Mn(t) {
  const e = Wi(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return ji(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function qi(t, e, {
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
const ke = 256, he = 2048, Gi = 8, Sl = 12811, St = (Gi + ke * Sl) * 4;
function _n(t, e, n) {
  const i = Math.fround(t * e);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(i + (i >= 0 ? 0.5 : -0.5)))
  ));
}
function vl(t, e, n) {
  if (t.byteLength !== St || !Number.isInteger(e.frameCount) || e.frameCount < 1 || e.frameCount > ke)
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
    ke
  ]);
  let r = Gi;
  const o = 131071, a = 8191, s = Math.fround(o / 1.5), l = Math.fround(a / 0.5);
  for (let u = 0; u < Ve; ++u) {
    const c = Math.min(he, Math.max(256, (1 << u) * 32)), f = he / c;
    for (let d = 0; d < e.frameCount; ++d) {
      const m = qi(n(d), u), p = r + d * (c + 1);
      for (let y = 0; y <= c; ++y) {
        const g = (y === c ? 0 : y) * f, I = (g + he - f) % he, A = (g + f) % he, T = m[g], w = m[I], L = m[A];
        if (T === void 0 || w === void 0 || L === void 0 || !Number.isFinite(T) || !Number.isFinite(w) || !Number.isFinite(L))
          throw new Error("Wavetable preparation produced invalid samples.");
        const K = Math.fround(0.5 * Math.fround(L - w));
        i[p + y] = _n(T, s, o) & 262143 | _n(K, l, a) << 18;
      }
    }
    r += (c + 1) * ke;
  }
}
const Tl = "runtimeSyncRequest", El = 2147483647, Al = "runtimeState", Rl = "retryDesiredTableRequest", xl = "workerLoadFailure", Ml = "serviceLoadAbort", _l = "wavetableLoadBegin", Ol = "wavetableMipFrame", kl = "wavetableUploadAck", wl = "wavetableMipRequest", Dl = "wavetablePrewarmRequest", Ll = "wavetablePrewarmNotification", Nl = "assets/factory-bank-catalog.json", vt = 3, Cl = 1, Pl = vt * Oe, Fl = 1, Kl = 2, Ul = 3, Bl = 1, Vl = 2, $l = 2e4, Re = Fl, On = Kl, kn = Ul, H = Bl, wn = Vl, zl = 48 * 1024 * 1024, lt = 3;
function Dn(t, e) {
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
function Ln(t) {
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
function Nn(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function Cn(t, e) {
  if (!t)
    throw new Error(e);
}
function Hl(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function jl(t, e) {
  return hl(await t.readJSON(e));
}
function Wl(t) {
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
function ql(t, e) {
  const n = Math.round(Number(t) || 0);
  return Hl(n, 0, Math.max(0, e - 1));
}
function ct(t, e, n, i, r) {
  return `${t}:${e}:${n}:${i}:${r}`;
}
function Gl(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function Pn(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Fn(t) {
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
function Jl(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class Ql {
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
    this.connection = e, this.delivery = n.delivery ?? "events", this.resourceClient = Do(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Nl, this.maxBatchesInFlight = Dn(
      n.maxFramesInFlight,
      Cl
    ), this.mipLevelCount = n.mipLevelCount ?? Ve, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? zl) || 0)), this.serviceLoadTimeoutMs = Dn(n.serviceLoadTimeoutMs, $l), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
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
    }), this.connection.addEndpointListener?.(Al, this.handleRuntimeState), this.connection.addEndpointListener?.(kl, this.handleUploadAck), this.connection.addEndpointListener?.(wl, this.handleMipRequest), this.connection.addEndpointListener?.(Dl, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Ll, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Tl,
      El
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await jl(this.resourceClient, this.catalogPath), x("info", "Loaded wavetable catalog", {
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = Pn(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Pn(e),
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
          ...Fn(this.serviceTable.frameCount),
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
          failurePhase: kn,
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== kn || e.failureReasonCode !== wn ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = Re,
    failureReasonCode: s = H
  }) {
    this.connection.sendEventOrValue?.(xl, {
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
    this.connection.sendEventOrValue?.(Ml, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(e) {
    x("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? Ln(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(Rl, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), r = ql(e, i.tables.length), o = i.tables[r];
    Cn(o, `Could not resolve table ${r}`);
    const a = Gl(o, Oe, this.mipLevelCount), s = this.tableCache.get(a);
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
    const u = await this.resourceClient.readAudio(o.sourceWav), c = bl(u.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: Oe
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
    this.connection.sendEventOrValue?.(_l, {
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
      if (await Zs(this.connection, {
        input: e.oscillatorIndex,
        byteLength: St
      }, (i) => {
        vl(i, e, (r) => this.getSpectrumForFrame(r));
      }), this.serviceTable !== e || this.knownSessionId !== e.dspSessionId) return;
      x("info", "Submitted shared wavetable", {
        oscillatorIndex: e.oscillatorIndex,
        tableIndex: e.tableIndex,
        generation: e.generation,
        frameCount: e.frameCount,
        preparedBytes: St,
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
        failureReasonCode: H
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
      failureReasonCode: H
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: Re,
      failureReasonCode: H
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = Re,
    failureReasonCode: i = H
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
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Jl(() => {
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
    const n = Wl(e ?? {});
    if (x("info", "Received runtime state", Ln(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= lt)
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
          r.spectra[a] || (r.spectra[a] = Mn(r.frames[a]));
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
      ...Fn(this.serviceTable.frameCount),
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
    ), f = this.mipJobs.get(c), d = this.serviceTable?.frameCount ?? 0, m = Math.min(
      vt,
      d - l
    );
    if (!(!f || f.completed || !f.inFlightBatchBases.has(l) || u <= 0 || u !== m)) {
      f.inFlightBatchBases.delete(l);
      for (let p = 0; p < u; p += 1) {
        const y = l + p;
        f.ackedFrames[y] || (f.ackedFrames[y] = 1, f.ackedFrameCount += 1);
      }
      f.ackedFrameCount === d && f.nextFrameIndex >= d && f.inFlightBatchBases.size === 0 && (f.completed = !0, this.activeUploadKey === f.key && (this.activeUploadKey = null)), Nn(l, u, d) && x("info", "Acknowledged wavetable mip batch", {
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
    if (Cn(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = Mn(this.serviceTable.frames[e]);
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
        vt,
        this.serviceTable.frameCount - n
      ), r = new Float32Array(Pl);
      try {
        for (let o = 0; o < i; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), l = qi(s, e.mipIndex);
          r.set(l, o * Oe);
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
            failureReasonCode: H
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Ol, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(r)
      }), Nn(n, i, this.serviceTable.frameCount) && x("info", "Sent wavetable mip batch", {
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
function Xl(t, e = {}) {
  return new Ql(t, e);
}
async function Yl(t, e = {}) {
  return Xi(t, [
    ro,
    () => Xl(t, e)
  ]);
}
export {
  Yl as default
};
