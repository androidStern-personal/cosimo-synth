class Rt {
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
function At(t, e) {
  return new Rt(t, e);
}
async function Dt(t, e) {
  const n = At(t, e);
  return await n.start(), n;
}
const F = -100, Y = 35, Mt = 5, Lt = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function je(t) {
  const e = Lt.find((n) => n.deviceType === t);
  if (e === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${t}`);
  return e;
}
function y(t) {
  return je(t).laneEndpointID;
}
function Ot(t, e) {
  if (!Number.isInteger(e) || e < 1 || e > Mt)
    throw new Error(`Effect Output Trim instance is out of range: ${e}`);
  return `${je(t).hostStem}${e}OutputTrimDb`;
}
function Je(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function _t(t) {
  const e = (Je(t, F, Y) - F) / (Y - F);
  return e * e;
}
function wt(t) {
  const e = Math.sqrt(Je(t, 0, 1));
  return F + e * (Y - F);
}
const Qe = 13, be = 5, Ye = 8, kt = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), ve = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    y("globalFilter")
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
    y("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    y("ott")
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
    y("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    y("flanger")
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
    y("phaser")
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
    y("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    y("reverb")
  ]
}), Xe = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), Ct = Object.freeze([
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
]), Ft = Object.freeze({
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
function Nt(t) {
  return Math.round(t) === 1 ? -5 : Math.round(t) === 2 ? 12 : Math.round(t) === 3 ? -12 : 7;
}
function Ze(t, e) {
  const n = {};
  for (const l of ve[t]) {
    const o = e[l];
    if (typeof o == "number" && Number.isFinite(o)) {
      n[l] = o;
      continue;
    }
    const d = Ft[l];
    if (d === void 0)
      throw new Error(`Missing lane parameter value: ${t}.${l}`);
    n[l] = d;
  }
  const r = [
    ...Xe.chorus,
    y("chorus")
  ], a = Object.keys(e);
  return t === "chorus" && a.length === r.length && a.every((l) => r.includes(l)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = Nt(
    Number(e.chorusRingOffsetMode)
  ) + Number(e.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function et(t) {
  return ve[t];
}
function Pt(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= be)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * Ye + kt[t];
}
function Kt(t, e) {
  const n = new Array(Qe).fill(0), i = Ze(t, e);
  return ve[t].forEach((r, a) => {
    n[a] = i[r];
  }), n;
}
const v = (t, e) => ({ label: t, value: e });
function R(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const A = Object.freeze({
  filter: R(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: R(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: R(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: R(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: R(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: R(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: R(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: R(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), f = (t, e, n, i, r, a, s, l = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: r,
  max: a,
  initial: s,
  step: l.step ?? (a - r) / 1e3,
  scale: l.scale ?? "linear",
  unit: l.unit ?? "",
  choices: l.choices,
  quick: l.quick ?? !1,
  modulationTargetIndex: l.modulationTargetIndex ?? null,
  modulationApplication: l.modulationApplication ?? (l.modulationTargetIndex === void 0 || l.modulationTargetIndex === null ? null : "linear"),
  valueKind: l.valueKind,
  modulationIdentityEndpointID: l.modulationIdentityEndpointID,
  modulationDragStyle: l.modulationDragStyle
});
function D(t, e, n) {
  return f(
    t,
    e,
    "Output Trim",
    "Trim",
    F,
    Y,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const Ut = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], zt = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Bt = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: A.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      f("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(v), quick: !0 }),
      f("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      f("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      f("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      D("filter", "globalFilterOutputTrimDb", 39)
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: A.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      f("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [v("Classic", 0), v("Harmonics", 1)] }),
      f("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      f("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      f("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      f("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      f("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      f("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [v("Symmetric", 0), v("Asymmetric", 1), v("Wavefold", 2)] }),
      D("drive", "distortionOutputTrimDb", 40)
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: A.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      f("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      f("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      f("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      f("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      f("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      D("ott", "ottOutputTrimDb", 41)
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: A.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      f("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(v) }),
      f("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(v) }),
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
      D("chorus", "chorusOutputTrimDb", 42)
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: A.flanger,
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
      D("flanger", "flangerOutputTrimDb", 43)
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: A.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      f("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [v("Free", 0), v("Sync", 1)] }),
      f("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      f("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Ut.map(v) }),
      f("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      f("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      f("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      f("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      f("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      D("phaser", "phaserOutputTrimDb", 44)
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: A.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      f("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [v("Free", 0), v("Sync", 1)] }),
      f("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      f("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: zt.map(v) }),
      f("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      f("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      f("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      D("delay", "delayOutputTrimDb", 45)
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: A.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      f("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      f("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      f("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      f("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      D("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], te = Bt, tt = Object.freeze(
  te.flatMap((t) => t.parameters)
);
new Map(
  tt.map((t) => [t.endpointID, t])
);
function nt(t) {
  const e = te.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function it() {
  return tt;
}
function ye(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const Ht = "lane.v1", Vt = "laneTopology", Re = "laneSlotParams", $t = "laneOutputControl", ue = 16, qt = 8, at = 4, Wt = 3, rt = be * Ye, ot = 4, Gt = 4, jt = rt, Jt = rt + ot, Qt = 0, Yt = 1, Xt = 2, Zt = 3, en = 4, tn = 5;
function nn(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > at)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << qt;
}
const X = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), Z = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), st = new Map(
  Object.entries(Z).map(([t, e]) => [e, t])
), an = Object.freeze({
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
  X.map((t) => [an[t], t])
);
const $ = Object.freeze({
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
}), C = 241;
function rn(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function ie(t) {
  return $.minimumHz * Math.pow(
    $.maximumHz / $.minimumHz,
    rn(t, 0, 1)
  );
}
Object.freeze(
  Array.from({ length: C }, (t, e) => {
    const n = e / (C - 1), i = ie(n), r = ie(
      Math.max(0, e - 0.5) / (C - 1)
    ), a = ie(
      Math.min(C - 1, e + 0.5) / (C - 1)
    );
    return {
      centerHz: i,
      lowHz: e === 0 ? $.minimumHz : r,
      highHz: e === C - 1 ? $.maximumHz : a
    };
  })
);
const on = "voiceEnhancerFrequency", sn = "voiceEnhancerQ", ln = "voiceEnhancerAmount", cn = "voiceEnhancerFrequencyOctaves", dn = "voiceEnhancerQ", un = "voiceEnhancerAmount", lt = "voice.enhancerFrequency", fn = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: on,
    targetKind: cn,
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
    endpointID: sn,
    targetKind: dn,
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
    endpointID: ln,
    targetKind: un,
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
function Ae(t, e) {
  const n = Math.min(t.max, Math.max(t.min, e));
  return t.scale === "log" ? Math.log(n / t.min) / Math.log(t.max / t.min) : (n - t.min) / (t.max - t.min);
}
function mn(t, e) {
  const n = Math.min(1, Math.max(0, e));
  return t.scale === "log" ? t.min * (t.max / t.min) ** n : t.min + (t.max - t.min) * n;
}
const hn = Object.freeze([
  "voice.filterCutoff",
  lt,
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
]), pn = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [lt]: "enhancer-frequency",
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
  hn.map((t) => [t, Object.freeze({
    id: t,
    family: pn[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const ct = 40, dt = 18e3, fe = X.map((t) => Z[t]), gn = /^([a-zA-Z]+)#([1-9][0-9]*)$/, In = /^(parallel|split)#([1-9][0-9]*)$/;
function ne(t) {
  if (typeof t != "string")
    return null;
  const e = gn.exec(t);
  if (e === null)
    return null;
  const n = fe.find((r) => r === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > be ? null : { deviceType: n, instanceNumber: i };
}
function ut(t) {
  if (typeof t != "string")
    return null;
  const e = In.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? ot : Gt) ? null : { groupKind: n, unitNumber: i };
}
function _(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function N(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function m(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function bn(t, e) {
  const n = ne(t);
  if (n === null)
    return { failure: m(`device id ${t} is not a pool instance`) };
  if (!_(e) || !N(e, ["params"]) || !_(e.params))
    return { failure: m(`device ${t} must be { params }`) };
  const i = et(n.deviceType), r = st.get(n.deviceType);
  if (r === void 0)
    return { failure: m(`device ${t} has no effect descriptor`) };
  const a = nt(r).parameters.map((h) => h.endpointID), s = e.params, l = Object.keys(s), o = (h) => l.length === h.length && l.every((I) => h.includes(I)), d = y(n.deviceType), c = [
    ...Xe[n.deviceType],
    d
  ], u = [
    ...Ct,
    d
  ];
  if (!(l.includes(d) && (o(i) || o(a) || o(c) || n.deviceType === "chorus" && o(u))))
    return { failure: m(`device ${t} must carry every parameter once`) };
  for (const h of l) {
    const I = s[h];
    if (typeof I != "number" || !Number.isFinite(I))
      return { failure: m(`device ${t}.${h} must be a finite number`) };
  }
  return { record: { params: Ze(n.deviceType, s) } };
}
function vn(t, e) {
  return !_(t) || t.kind !== "device" ? { failure: m("branches may hold device placements only") } : N(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: m(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: m(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: m("a device placement is { kind, deviceId, enabled }") };
}
function De(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= ct && t <= dt;
}
function ft() {
  return { mix: 1, bypassed: !1 };
}
function yn(t) {
  return !_(t) || !N(t, ["mix", "bypassed"]) || typeof t.mix != "number" || !Number.isFinite(t.mix) || t.mix < 0 || t.mix > 1 || typeof t.bypassed != "boolean" ? null : { mix: t.mix, bypassed: t.bypassed };
}
function Tn(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (c) {
      const u = c instanceof Error ? c.message : String(c);
      return m(`is not valid JSON: ${u}`);
    }
  if (!_(e) || !N(e, ["format", "version", "output", "devices", "chain"]))
    return m("must be { format, version, output, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return m("must be cosimo.lane version 2");
  if (!_(e.devices))
    return m("devices must be an object");
  if (!Array.isArray(e.chain))
    return m("chain must be an array");
  const n = yn(e.output);
  if (n === null)
    return m("output must be { mix: 0..1, bypassed: boolean }");
  const i = {};
  for (const c of Reflect.ownKeys(e.devices)) {
    if (typeof c != "string")
      return m("device ids must be strings");
    const u = bn(c, e.devices[c]);
    if ("failure" in u)
      return u.failure;
    i[c] = u.record;
  }
  const r = new Set(Object.keys(i)), a = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Set(), l = [];
  let o = 0;
  const d = (c) => {
    const u = vn(c, r);
    return "placement" in u && (a.set(
      u.placement.deviceId,
      (a.get(u.placement.deviceId) ?? 0) + 1
    ), o += 1), u;
  };
  for (const c of e.chain) {
    if (!_(c))
      return m("chain nodes must be objects");
    if (c.kind === "device") {
      const E = d(c);
      if ("failure" in E)
        return E.failure;
      l.push(E.placement);
      continue;
    }
    if (c.kind !== "parallel" && c.kind !== "split")
      return m(`unknown chain node kind ${String(c.kind)}`);
    const u = c.kind === "split", p = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], I = u ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], b = u && N(c, p);
    if (!N(c, I) && !b)
      return m(`a ${c.kind} group is { ${I.join(", ")} }`);
    const K = ut(c.groupId);
    if (K === null || K.groupKind !== c.kind)
      return m(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (s.has(String(c.groupId)))
      return m(`group ${String(c.groupId)} is used twice`);
    if (s.add(String(c.groupId)), typeof c.enabled != "boolean")
      return m(`group ${String(c.groupId)} needs a boolean enable`);
    const U = u ? Wt : at;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > U)
      return m(`group ${String(c.groupId)} needs 2..${U} branches`);
    if (u && (!De(c.xoverLowHz) || !De(c.xoverHighHz)))
      return m(`group ${String(c.groupId)} crossovers must sit in ${ct}..${dt} Hz`);
    if (u && !b && (typeof c.xoverLowKeyTrackEnabled != "boolean" || typeof c.xoverHighKeyTrackEnabled != "boolean" || typeof c.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverLowKeyTrackOffsetSemitones) || typeof c.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverHighKeyTrackOffsetSemitones)))
      return m(`group ${String(c.groupId)} Key Track state must be finite`);
    o += 1;
    const k = [];
    for (const E of c.branches) {
      if (!Array.isArray(E))
        return m(`group ${String(c.groupId)} branches must be arrays`);
      const z = [];
      for (const W of E) {
        const B = d(W);
        if ("failure" in B)
          return B.failure;
        z.push(B.placement);
      }
      k.push(z);
    }
    l.push(u ? {
      kind: "split",
      groupId: String(c.groupId),
      enabled: c.enabled,
      xoverLowHz: c.xoverLowHz,
      xoverHighHz: c.xoverHighHz,
      xoverLowKeyTrackEnabled: b ? !1 : c.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: b ? 0 : c.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: b ? !1 : c.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: b ? 0 : c.xoverHighKeyTrackOffsetSemitones,
      branches: k
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: k
    });
  }
  for (const c of r)
    if ((a.get(c) ?? 0) !== 1)
      return m(`device ${c} must be placed exactly once`);
  return o > ue ? m(`flattens to ${o} wire entries; the topology upload holds ${ue}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: i, chain: l } };
}
function Sn() {
  const t = {};
  for (const e of X) {
    const n = Z[e];
    t[`${n}#1`] = {
      params: Ln(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: ft(),
    devices: t,
    chain: X.map((e) => ({
      kind: "device",
      deviceId: `${Z[e]}#1`,
      enabled: !1
    }))
  };
}
const Me = ["distortion#1", "delay#1", "reverb#1"];
function En() {
  const t = Sn(), e = {};
  for (const n of Me) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: ft(),
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && Me.includes(n.deviceId))
  };
}
function xn(t) {
  if (t === void 0)
    return En();
  const e = Tn(t);
  return e._tag === "ok" ? e.value : null;
}
function Rn(t) {
  return Object.keys(t.devices).map((e) => {
    const n = ne(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => fe.indexOf(e.parsed.deviceType) - fe.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function me(t) {
  const e = ne(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return Pt(e.deviceType, e.instanceNumber - 1);
}
function mt(t) {
  const e = ut(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? jt : Jt) + (e.unitNumber - 1);
}
function An(t) {
  const e = new Array(ue).fill(0);
  let n = 0, i = 0;
  const r = (a, s, l) => {
    e[i] = nn(a, s), l && (n |= 1 << i), i += 1;
  };
  for (const a of t.chain) {
    if (a.kind === "device") {
      r(me(a.deviceId), 0, a.enabled);
      continue;
    }
    r(mt(a), a.branches.length, a.enabled), a.branches.forEach((s, l) => {
      for (const o of s)
        r(me(o.deviceId), l + 1, o.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function Dn(t) {
  const e = new Array(Qe).fill(0);
  return e[Qt] = t.xoverLowHz, e[Yt] = t.xoverHighHz, e[Xt] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[Zt] = t.xoverLowKeyTrackOffsetSemitones, e[en] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[tn] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function Mn(t) {
  const e = [{
    endpointID: $t,
    value: t.output
  }];
  let n = 0;
  for (const i of Rn(t)) {
    const r = ne(i.instanceId);
    if (r === null)
      throw new Error(`Invalid lane device identity during replay: ${i.instanceId}`);
    e.push({
      endpointID: Ot(
        r.deviceType,
        r.instanceNumber
      ),
      value: t.devices[i.instanceId].params[y(r.deviceType)]
    }), n += 1, e.push({
      endpointID: Re,
      value: {
        slotId: me(i.instanceId),
        deliverySerial: n,
        values: Kt(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  }
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: Re,
      value: {
        slotId: mt(i),
        deliverySerial: n,
        values: Dn(i)
      }
    }));
  return e.push({
    endpointID: Vt,
    value: An(t)
  }), e;
}
function Ln(t) {
  const e = st.get(t);
  if (e === void 0)
    throw new Error(`Unknown lane device type: ${t}`);
  const n = nt(e).parameters;
  return Object.fromEntries(et(t).map((i) => [
    i,
    n.find((r) => r.endpointID === i)?.initial ?? 0
  ]));
}
const On = "runtimeState";
function _n(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const wn = {
  endpointID: On,
  required: !0,
  mapValue: _n
}, kn = 2e3;
function Le(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Cn(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return Le(i, e) ? {
    found: !0,
    value: i[e]
  } : Le(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function Oe(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Fn {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Nn(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = Cn(e, this.options.stateKey);
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
      const a = e.mapValue ? e.mapValue(r) : r;
      this.runtimeEndpointValues.set(e.endpointID, a), this.applyRuntimeStateIfReady();
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
    for (const o of this.parameterEndpointIDs) {
      if (!this.parameterValues.has(o))
        return;
      e[o] = this.parameterValues.get(o);
    }
    const n = {};
    for (const o of this.runtimeEndpointDependencies) {
      if (!this.runtimeEndpointValues.has(o.endpointID)) {
        if (o.required)
          return;
        continue;
      }
      n[o.endpointID] = this.runtimeEndpointValues.get(o.endpointID);
    }
    const i = {
      state: this.state,
      parameters: e,
      runtimeEndpoints: n
    }, r = Oe(n), a = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, s = this.options.buildRuntimeEvents(i, a), l = Oe({
      runtimeEndpoints: n,
      events: s
    });
    if (l === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
      return;
    }
    if (s.length === 0) {
      this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(s, i).then((o) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        o ? (this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(s);
        const d = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, d && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        this.options.onDeliveryFailure?.(s);
        const o = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, o && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const o of s)
      this.connection.sendEventOrValue?.(
        o.endpointID,
        o.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? kn
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function Nn(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Pn(t, e) {
  return new Fn(t, e);
}
function Kn(t) {
  return Pn(t, {
    stateKey: Ht,
    runtimeEndpointDependencies: [wn],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: xn,
    buildRuntimeEvents: ({ state: e }) => [...Mn(e)]
  });
}
function T(t, e) {
  if (!t)
    throw new Error(e);
}
function ae(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function Un(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function he(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function ht(t) {
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
function zn() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function re(t, e) {
  const n = zn();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Un(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function _e(t) {
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
  throw new Error(`Unsupported text resource payload (${ht(t)})`);
}
function Bn(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return he(t);
  throw new Error(`Unsupported binary resource payload (${ht(t)})`);
}
function Hn(t) {
  const e = t?.frames;
  T(
    Array.isArray(e) || ArrayBuffer.isView(e),
    "Decoded audio data must provide a frames array"
  );
  const n = Array.from(e), i = new Float32Array(n.length);
  for (let r = 0; r < n.length; r += 1) {
    const a = n[r];
    if (typeof a == "number") {
      i[r] = a;
      continue;
    }
    if (ArrayBuffer.isView(a) || Array.isArray(a)) {
      const s = a;
      T(s.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(s[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function pt(t) {
  const e = new DataView(t);
  T(ae(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), T(ae(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, a = null, s = null, l = null, o = null, d = 12;
  for (; d + 8 <= e.byteLength; ) {
    const u = ae(e, d, 4), p = e.getUint32(d + 4, !0), h = d + 8;
    u === "fmt " ? (n = e.getUint16(h, !0), i = e.getUint16(h + 2, !0), r = e.getUint32(h + 4, !0), s = e.getUint16(h + 12, !0), a = e.getUint16(h + 14, !0)) : u === "data" && (l = h, o = p), d = h + p + p % 2;
  }
  T(n !== null, "Wave file is missing a fmt chunk"), T(l !== null && o !== null, "Wave file is missing a data chunk"), T(i === 1, "Only mono wavetable bank files are supported");
  let c;
  if (n === 3 && a === 32)
    c = new Float32Array(t.slice(l, l + o));
  else if (n === 1 && a === 16) {
    const u = o / 2, p = new Int16Array(t.slice(l, l + o));
    c = new Float32Array(u);
    for (let h = 0; h < u; h += 1)
      c[h] = p[h] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${a}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: r ?? 0,
    bitsPerSample: a,
    blockAlign: s ?? 0,
    samples: c
  };
}
async function we(t) {
  T(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return T(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function pe(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function gt(t) {
  const e = new Uint8Array(t).buffer, n = pt(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Vn(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (o) => (T(typeof t.readResource == "function", `Resource bridge cannot read ${o}`), t.readResource(o)), r = async (o) => {
    T(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${o}`);
    const d = await t.readResourceAsAudioData(o);
    return Hn(d);
  }, a = (o) => {
    const d = t.getResourceAddress?.(o);
    return d ?? null;
  }, s = async (o, d = t.getResourceAddress?.(o)) => {
    const c = re(o, d), u = await we(c), p = pt(u);
    return {
      sampleRate: p.sampleRate,
      samples: p.samples
    };
  }, l = async (o, d = t.getResourceAddress?.(o)) => {
    const c = re(o, d);
    return new Uint8Array(await we(c));
  };
  return {
    async readText(o) {
      if (e === "bridge" && typeof t.readResource == "function")
        return _e(await i(o));
      const d = a(o);
      return e === "url" && d !== null ? pe(await l(o, d)) : typeof t.readResource == "function" ? _e(await i(o)) : pe(await l(o, d));
    },
    async readJSON(o) {
      return JSON.parse(await this.readText(o));
    },
    async readBytes(o) {
      return typeof t.readResource == "function" ? Bn(await i(o)) : l(o);
    },
    async readAudio(o) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(o);
      const d = a(o);
      return n === "url" && d !== null ? s(o, d) : typeof t.readResourceAsAudioData == "function" ? r(o) : gt(await this.readBytes(o));
    },
    getURL(o) {
      return re(o, t.getResourceAddress?.(o));
    }
  };
}
function $n(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Vn(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function qn(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, a = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(s) {
      if (e)
        return e(s);
      if (n)
        return JSON.stringify(await n(s));
      if (i)
        return pe(await i(s));
      throw new Error(`Resource client cannot read text ${s}`);
    },
    async readJSON(s) {
      return n ? n(s) : JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      if (i)
        return i(s);
      if (e)
        return he(await e(s));
      if (n)
        return he(JSON.stringify(await n(s)));
      throw new Error(`Resource client cannot read bytes ${s}`);
    },
    async readAudio(s) {
      return r ? r(s) : gt(await this.readBytes(s));
    },
    getURL(s) {
      return a ? a(s) : null;
    }
  };
}
function Wn(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Gn(t) {
  return Wn(t) ? qn(t) : $n(t);
}
const J = 2048;
function H(t, e) {
  if (!t)
    throw new Error(e);
}
function jn(t) {
  H(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    H(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), H(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), H(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), H(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const Jn = 2048, It = 11, Qn = 256;
function x(t, e) {
  if (!t)
    throw new Error(e);
}
function Yn(t) {
  return t > 0 && (t & t - 1) === 0;
}
const ke = /* @__PURE__ */ new Map();
function Xn(t) {
  const e = ke.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let a = 0, s = r;
    for (let l = 0; l < n; l += 1)
      a = a << 1 | s & 1, s >>= 1;
    i[r] = a;
  }
  return ke.set(t, i), i;
}
function bt(t, e, n = !1) {
  const i = t.length;
  x(i === e.length, "FFT real and imaginary buffers must have the same length"), x(Yn(i), "FFT input length must be a power of two");
  const r = Xn(i);
  for (let a = 0; a < i; a += 1) {
    const s = r[a];
    if (s <= a)
      continue;
    const l = t[a];
    t[a] = t[s], t[s] = l;
    const o = e[a];
    e[a] = e[s], e[s] = o;
  }
  for (let a = 2; a <= i; a <<= 1) {
    const s = a >> 1, l = (n ? 2 : -2) * Math.PI / a, o = Math.cos(l), d = Math.sin(l);
    for (let c = 0; c < i; c += a) {
      let u = 1, p = 0;
      for (let h = 0; h < s; h += 1) {
        const I = c + h, b = I + s, K = t[b], U = e[b], k = u * K - p * U, E = u * U + p * K, z = t[I], W = e[I];
        t[I] = z + k, e[I] = W + E, t[b] = z - k, e[b] = W - E;
        const B = u * o - p * d;
        p = u * d + p * o, u = B;
      }
    }
  }
  if (n)
    for (let a = 0; a < i; a += 1)
      t[a] /= i, e[a] /= i;
}
function vt(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let a = 0; a < e.length; a += 1)
    n += Number(e[a]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let a = 0; a < e.length; a += 1)
    r[a] = (Number(e[a]) || 0) - i;
  return r;
}
function Zn(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Jn,
  maxFramesPerTable: i = Qn
} = {}) {
  const r = Float32Array.from(t);
  x(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const a = r.length / n;
  x(a > 0, "Source wavetable files must contain at least one frame"), x(a <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && x(a === e, `Source wavetable frame count mismatch: expected ${e}, got ${a}`);
  const s = [];
  for (let l = 0; l < a; l += 1) {
    const o = l * n, d = o + n;
    s.push(vt(r.slice(o, d)));
  }
  return {
    frameCount: a,
    frames: s
  };
}
function Ce(t) {
  const e = vt(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return bt(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function ei(t, e, {
  mipLevelCount: n = It
} = {}) {
  const i = t?.real?.length ?? 0;
  x(i > 0, "Spectrum must contain real samples"), x(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), x(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), a = new Float64Array(i), s = new Float64Array(i);
  for (let l = 1; l <= r; l += 1) {
    a[l] = t.real[l], s[l] = t.imaginary[l];
    const o = (i - l) % i;
    o !== l && (a[o] = t.real[o], s[o] = t.imaginary[o]);
  }
  return bt(a, s, !0), Float32Array.from(a);
}
const Te = ["A", "B", "C"], yt = [
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
], ti = [
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
], w = Object.freeze([
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
]), ni = Object.freeze([
  ...Te.flatMap((t) => yt.map(
    (e) => `osc${t}.${e}`
  )),
  ...ti
]);
new Set(
  Te.flatMap((t) => yt.map(
    (e) => `osc${t}.${e}`
  ))
);
const Tt = Object.freeze(
  ni.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), ii = it().filter(
  (t) => t.modulationTargetIndex !== null
), ai = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function Se(t) {
  const e = ri(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function ri(t) {
  const e = ai.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const oi = [
  ...ii.map((t) => ({
    kind: Se(ye(t)),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], St = Object.freeze(
  oi.sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), L = Object.freeze([
  ...Tt,
  ...St
]), Q = w.length, si = Tt.length, li = St.length, ci = Q * L.length, di = new Map(w.map((t) => [t.id, t])), ui = new Map(w.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), Ee = new Map(L.map((t) => [t.kind, t]));
function fi() {
  if (Q !== 14 || si !== 59 || li !== 47 || ci !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = w.filter((i) => i.group === t).sort((i, r) => i.runtimeIndex - r.runtimeIndex);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 59], ["rack", 47]]) {
    const n = L.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (di.size !== Q || ui.size !== Q || Ee.size !== L.length)
    throw new Error("Modulation identities must be unique");
}
fi();
function mi(t) {
  return typeof t != "string" ? null : Ee.has(t) ? t : null;
}
function hi(t) {
  const e = mi(t);
  return e !== null && Ee.get(e)?.group === "rack" ? e : null;
}
const pi = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), gi = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function Ii(t) {
  if (typeof t != "string")
    return null;
  const e = gi.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = pi.get(n);
  if (i === void 0)
    return null;
  const r = e[3];
  return i.includes(r) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: r
  } : null;
}
function bi(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function vi(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
w.filter((t) => t.group === "voice").length;
w.filter((t) => t.group === "macro").length;
function yi(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Ti(t) {
  throw new Error(t ?? "Invariant violated");
}
const Si = "globalTune", Ei = "globalTuneSemitones", M = -24, V = 24, Fe = 0, xi = -48, Ri = 48, Ne = -48, Ai = 6, Di = 0, Pe = (Di - Ne) / (Ai - Ne);
function G(t, e, n, i, r = "percent", a = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: a };
}
const Mi = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      G("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      G("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      G("mix", "Mix", 100, 100),
      G("drive", "Drive", 15, 0)
    ]
  }
], Ke = 1e-6;
function S(t, e) {
  if (!Number.isFinite(t) || t < -Ke || t > 1 + Ke)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function ee(t, e) {
  return S(t / 100, `${e} catalog percentage`);
}
function q(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Li(t) {
  return 20 * 1e3 ** t;
}
function Oi(t) {
  return S(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function _i(t) {
  return 0.1 * 200 ** t;
}
function wi(t) {
  return S(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function ki(t) {
  return t;
}
function Ci(t) {
  return S(t, "filterMix endpoint conversion");
}
function P(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function Fi(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: P("filterCutoff", Li, Oi),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: P("filterQ", _i, wi),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: P("filterMix", ki, Ci),
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
function Et(t) {
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
      return yi(t);
  }
}
function Ni(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Pi(t, e) {
  const n = q(t.moduleId, e.id), i = Et(e.format), r = Fi(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: ee(e.defaultPercent, n),
    initialValue: ee(e.initialPercent, n),
    format: i,
    modAmount: Ni(i),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const Ki = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Pe * 100, defaultPercent: Pe * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Ui(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function zi(t, e) {
  const n = `osc${t}`, i = q(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: ee(e.defaultPercent, i),
    initialValue: ee(e.initialPercent, i),
    format: Et(e.format),
    modAmount: Ui(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Bi = Object.freeze(
  Te.flatMap((t) => Ki.map((e) => zi(t, e)))
), Hi = Object.freeze({
  targetId: q("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: S(
    (Fe - M) / (V - M),
    "Global Tune default"
  ),
  initialValue: S(
    (Fe - M) / (V - M),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: V },
  modAmount: {
    min: xi,
    max: Ri,
    unit: "st",
    digits: 2
  },
  binding: P(
    Si,
    (t) => M + (V - M) * t,
    (t) => S(
      (t - M) / (V - M),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: Ei
});
function Vi(t) {
  const e = q("voice-enhancer", t.key), n = S(
    Ae(t, t.initial),
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
    binding: P(
      t.endpointID,
      (i) => mn(t, i),
      (i) => S(
        Ae(t, i),
        `${t.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: t.targetKind
  });
}
const $i = Object.freeze(
  Object.values(fn).map(Vi)
), qi = Object.freeze([
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
function Wi(t) {
  const e = q(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (a) => t.min + n * a, r = (a) => S(
    (a - t.min) / n,
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
    binding: P(t.endpointID, i, r),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const Gi = Object.freeze(
  qi.map(Wi)
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
function Ji(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function oe(t, e) {
  const n = t.valueKind === "effect-output-trim-db" ? _t(e) : t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return S(n, `${t.endpointID} endpoint conversion`);
}
function Qi(t, e) {
  return t.valueKind === "effect-output-trim-db" ? wt(e) : t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Yi(t) {
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
function Zi(t) {
  const e = Ji(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: oe(t, t.initial),
    initialValue: oe(t, t.initial),
    format: Yi(t),
    modAmount: Xi(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Qi(t, n),
      fromEngine: (n) => oe(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : Se(ye(t))
  });
}
const xe = Object.freeze(
  [
    ...te.flatMap((t) => t.parameters.map(Zi)),
    ...ji,
    Hi,
    ...$i,
    ...Bi,
    ...Gi,
    ...Mi.flatMap(
      (t) => t.parameters.map(
        (e) => Pi(t, e)
      )
    )
  ]
), ea = new Map(
  xe.map((t) => [t.targetId, t])
), xt = xe.filter(
  (t) => t.modulationTargetKind !== null
), ge = new Map(
  xt.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (ea.size !== xe.length)
  throw new Error("Target descriptor IDs must be unique");
if (xt.length !== L.length || ge.size !== L.length || L.some((t) => ge.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function se(t) {
  const e = ge.get(t);
  return e === void 0 ? Ti(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  te.map((t) => [t.id, t.label])
);
function ta(t) {
  const e = vi(t);
  return e === 1 ? "" : ` ${e}`;
}
function na(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = se(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = Ii(t);
  if (n !== null) {
    const i = se(bi(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : i.moduleId.toUpperCase()}${ta(n)} ${i.label.toUpperCase()}`;
  }
  return se(t).label.toUpperCase();
}
const ia = it().filter((t) => t.modulationTargetIndex !== null);
new Map(
  ia.map((t) => [
    Se(ye(t)),
    t
  ])
);
const aa = {
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
w.map((t) => ({
  value: t.id,
  label: aa[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const ra = L.map((t) => ({
  value: t.kind,
  label: na(t.kind)
}));
ra.filter((t) => !oa(t.value));
function oa(t) {
  return hi(t) !== null;
}
const sa = [
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
], la = [
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
];
Object.fromEntries(
  sa.map((t, e) => [t, 2 ** e])
);
Object.fromEntries(
  la.map((t, e) => [t, 2 ** e])
);
const ca = "runtimeSyncRequest", da = 2147483647, ua = "runtimeState", fa = "retryDesiredTableRequest", ma = "workerLoadFailure", ha = "serviceLoadAbort", pa = "wavetableLoadBegin", ga = "wavetableMipFrame", Ia = "wavetableUploadAck", ba = "wavetableMipRequest", va = "wavetablePrewarmRequest", ya = "wavetablePrewarmNotification", Ta = "assets/factory-bank-catalog.json", Ie = 3, Sa = 1, Ea = Ie * J, xa = 1, Ra = 2, Aa = 3, Da = 1, Ma = 2, La = 2e4, j = xa, Oa = Ra, Ue = Aa, O = Da, ze = Ma, _a = 48 * 1024 * 1024, le = 3;
function Be(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function g(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function He(t) {
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
function Ve(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function $e(t, e) {
  if (!t)
    throw new Error(e);
}
function wa(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function ka(t, e) {
  return jn(await t.readJSON(e));
}
function Ca(t) {
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
function Fa(t, e) {
  const n = Math.round(Number(t) || 0);
  return wa(n, 0, Math.max(0, e - 1));
}
function ce(t, e, n, i, r) {
  return `${t}:${e}:${n}:${i}:${r}`;
}
function Na(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function qe(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function We(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function Ge() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function Pa(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class Ka {
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
    this.connection = e, this.resourceClient = Gn(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Ta, this.maxBatchesInFlight = Be(
      n.maxFramesInFlight,
      Sa
    ), this.mipLevelCount = n.mipLevelCount ?? It, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? _a) || 0)), this.serviceLoadTimeoutMs = Be(n.serviceLoadTimeoutMs, La), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, g("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(ua, this.handleRuntimeState), this.connection.addEndpointListener?.(Ia, this.handleUploadAck), this.connection.addEndpointListener?.(ba, this.handleMipRequest), this.connection.addEndpointListener?.(va, this.handlePrewarmRequest), this.connection.addEndpointListener?.(ya, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      ca,
      da
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await ka(this.resourceClient, this.catalogPath), g("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < le; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = qe(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      for (const [r, a] of this.tableCache)
        e.has(r) || (!i || a.lastUsedSerial < i.lastUsedSerial) && (n = r, i = a);
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
      byteCount: qe(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = ce(
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
          ...We(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== r || !this.serviceLoadHasPendingTransfers()) && (g("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: Ue,
          failureReasonCode: ze
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== Ue || e.failureReasonCode !== ze ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: a = 0,
    failurePhase: s = j,
    failureReasonCode: l = O
  }) {
    this.connection.sendEventOrValue?.(ma, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: i,
      generation: r,
      candidateAttemptSerial: a,
      failurePhase: s,
      failureReasonCode: l
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: i,
    tableIndex: r,
    failureReasonCode: a = O
  }) {
    this.connection.sendEventOrValue?.(ha, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: a
    });
  }
  emitRetryDesiredTableRequest(e) {
    g("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? He(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(fa, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), r = Fa(e, i.tables.length), a = i.tables[r];
    $e(a, `Could not resolve table ${r}`);
    const s = Na(a, J, this.mipLevelCount), l = this.tableCache.get(s);
    if (l)
      return l.lastUsedSerial = this.cacheUseSerial++, g("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: a.tableId,
        tableName: a.name,
        sourceWav: a.sourceWav,
        frameCount: l.frameCount,
        cacheBytes: this.tableCacheBytes
      }), l;
    const o = Ge();
    g("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n
    });
    const d = await this.resourceClient.readAudio(a.sourceWav), c = Zn(d.samples, {
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n,
      samplesPerFrame: J
    });
    return g("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      frameCount: c.frameCount,
      loadDurationMs: Math.round(Ge() - o)
    }), this.rememberLoadedTable({
      cacheKey: s,
      tableIndex: r,
      tableMeta: a,
      frameCount: c.frameCount,
      frames: c.frames,
      spectra: new Array(c.frameCount)
    });
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.oscillatorIndex === e.oscillatorIndex && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, i) {
    g("info", "Committing desired wavetable load", {
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(pa, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    g("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: j,
      failureReasonCode: O
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: j,
      failureReasonCode: O
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = j,
    failureReasonCode: i = O
  } = {}) {
    g("error", "Service wavetable load failed", {
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
      const a = this.candidateValidations[e.oscillatorIndex];
      return a && a.dspSessionId === e.dspSessionId && a.generation === e.generation && a.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
    }
    let i = null;
    try {
      i = await this.loadTableSource(e.tableIndex);
    } catch (a) {
      return this.isCurrentRuntimeState(n) && (g("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: de(a)
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
    let a = null;
    try {
      a = await this.loadTableSource(n);
    } catch (s) {
      this.isCurrentRuntimeState(e) && (g("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: de(s)
      }), this.handleCandidateLoadFailure(e));
      return;
    }
    !a || !this.isCurrentRuntimeState(e) || this.markCommittedDesiredLoad(e, r, a);
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
    for (let e = 0; e < le; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Pa(() => {
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
    const a = this.resolveServiceTarget(e);
    if (a) {
      if (!await this.prepareServiceTarget(a, e) || !this.isCurrentRuntimeState(e))
        return;
      if (a.kind === "loading" && e.desiredTableIndex !== a.tableIndex && !this.shouldStayIdleOnFailure(e)) {
        g("warn", "Aborting obsolete wavetable load because the desired table changed", {
          dspSessionId: a.dspSessionId,
          oscillatorIndex: n,
          generation: a.generation,
          staleTableIndex: a.tableIndex,
          desiredTableIndex: e.desiredTableIndex,
          desiredIntentSerial: e.desiredIntentSerial
        }), this.emitServiceLoadAbort({
          dspSessionId: a.dspSessionId,
          oscillatorIndex: n,
          generation: a.generation,
          tableIndex: a.tableIndex,
          failureReasonCode: O
        }), this.serviceTable = null, this.clearMipTransferState();
        return;
      }
      a.kind === "active" && e.desiredTableIndex !== a.tableIndex && !this.shouldStayIdleOnFailure(e) && !i && await this.prepareDesiredCandidate(e);
      return;
    }
    if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(e)) {
      this.autoRetryConsumedKeys[n] = this.getDesiredRetryKey(e), this.emitRetryDesiredTableRequest(n);
      return;
    }
    e.serviceState !== 0 || this.shouldStayIdleOnFailure(e) || await this.prepareDesiredLoad(e);
  }
  handleRuntimeState(e) {
    const n = Ca(e ?? {});
    if (g("info", "Received runtime state", He(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= le)
      return;
    const i = n.dspSessionId !== this.knownSessionId;
    i && this.resetSessionState(n);
    const r = n.oscillatorIndex, a = this.latestRuntimeStates[r], s = a ? this.getDesiredRetryKey(a) : null, l = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[r] = Math.max(
      this.nextLoadGenerations[r] ?? 1,
      n.generationFrontier + 1
    ), (i || s !== l) && (this.autoRetryConsumedKeys[r] = null), this.latestRuntimeStates[r] = n, this.pendingRuntimeStateOscillators.add(r), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(i))
      try {
        const r = await this.loadTableSource(i);
        for (let s = 0; s < r.frameCount; s += 1)
          r.spectra[s] || (r.spectra[s] = Ce(r.frames[s]));
        const a = this.tableCache.get(r.cacheKey);
        a && this.refreshCacheEntryByteCount(a), g("info", "Prewarmed wavetable source table", {
          tableIndex: r.tableIndex,
          tableId: r.tableMeta.tableId,
          tableName: r.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (r) {
        g("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: de(r)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), r = Math.trunc(Number(e?.generation)), a = Math.trunc(Number(e?.tableIndex)), s = Math.trunc(Number(e?.mipIndex)), l = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || r !== this.serviceTable.generation || a !== this.serviceTable.tableIndex || s < 0 || s >= this.mipLevelCount)
      return null;
    const o = ce(
      n,
      i,
      r,
      a,
      s
    );
    let d = this.mipJobs.get(o);
    return d ? (!d.completed && l > d.urgencyLevel && (d.urgencyLevel = l), d) : (d = {
      key: o,
      dspSessionId: n,
      oscillatorIndex: i,
      generation: r,
      tableIndex: a,
      mipIndex: s,
      urgencyLevel: l,
      ...We(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(o, d), d);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (g("info", "Received wavetable mip request", {
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.oscillatorIndex)), a = Math.trunc(Number(n.generation)), s = Math.trunc(Number(n.tableIndex)), l = Math.trunc(Number(n.mipIndex)), o = Math.trunc(Number(n.frameIndexBase)), d = Math.trunc(Number(n.frameCount)), c = ce(
      i,
      r,
      a,
      s,
      l
    ), u = this.mipJobs.get(c), p = this.serviceTable?.frameCount ?? 0, h = Math.min(
      Ie,
      p - o
    );
    if (!(!u || u.completed || !u.inFlightBatchBases.has(o) || d <= 0 || d !== h)) {
      u.inFlightBatchBases.delete(o);
      for (let I = 0; I < d; I += 1) {
        const b = o + I;
        u.ackedFrames[b] || (u.ackedFrames[b] = 1, u.ackedFrameCount += 1);
      }
      u.ackedFrameCount === p && u.nextFrameIndex >= p && u.inFlightBatchBases.size === 0 && (u.completed = !0, this.activeUploadKey === u.key && (this.activeUploadKey = null)), Ve(o, d, p) && g("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: r,
        generation: a,
        tableIndex: u.tableIndex,
        mipIndex: l,
        frameIndexBase: o,
        batchFrameCount: d,
        ackedFrameCount: u.ackedFrameCount,
        frameCount: p,
        inFlightBatches: u.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if ($e(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = Ce(this.serviceTable.frames[e]);
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
        Ie,
        this.serviceTable.frameCount - n
      ), r = new Float32Array(Ea);
      try {
        for (let a = 0; a < i; a += 1) {
          const s = n + a, l = this.getSpectrumForFrame(s), o = ei(l, e.mipIndex);
          r.set(o, a * J);
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
            failurePhase: Oa,
            failureReasonCode: O
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(ga, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(r)
      }), Ve(n, i, this.serviceTable.frameCount) && g("info", "Sent wavetable mip batch", {
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
function de(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Ua(t, e = {}) {
  return new Ka(t, e);
}
async function za(t, e = {}) {
  return Dt(t, [
    Kn,
    () => Ua(t, e)
  ]);
}
export {
  za as default
};
