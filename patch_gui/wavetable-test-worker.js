class dn {
  connection;
  serviceFactories;
  services = [];
  started = !1;
  constructor(t, n) {
    this.connection = t, this.serviceFactories = n;
  }
  async start() {
    if (!this.started) {
      this.started = !0;
      try {
        for (const t of this.serviceFactories) {
          const n = typeof t == "function" ? await t(this.connection) : t;
          this.services.push(n), await n.start();
        }
      } catch (t) {
        const n = [];
        for (const i of [...this.services].reverse())
          try {
            await i.stop?.();
          } catch (r) {
            n.push(r);
          }
        throw this.services.length = 0, this.started = !1, n.length > 0 ? new AggregateError(
          [t, ...n],
          "Patch worker service startup failed and cleanup also failed"
        ) : t;
      }
    }
  }
  async stop() {
    if (!this.started)
      return;
    this.started = !1;
    const t = [];
    for (const n of [...this.services].reverse())
      try {
        await n.stop?.();
      } catch (i) {
        t.push(i);
      }
    if (this.services.length = 0, t.length > 0)
      throw new AggregateError(t, "Patch worker service cleanup failed");
  }
  getServices() {
    return [...this.services];
  }
}
function un(e, t) {
  return new dn(e, t);
}
async function mn(e, t) {
  const n = un(e, t);
  return await n.start(), n;
}
const B = -100, ne = 35, fn = 5, hn = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function gt(e) {
  const t = hn.find((n) => n.deviceType === e);
  if (t === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${e}`);
  return t;
}
function T(e) {
  return gt(e).laneEndpointID;
}
function pn(e, t) {
  if (!Number.isInteger(t) || t < 1 || t > fn)
    throw new Error(`Effect Output Trim instance is out of range: ${t}`);
  return `${gt(e).hostStem}${t}OutputTrimDb`;
}
function It(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function gn(e) {
  const t = (It(e, B, ne) - B) / (ne - B);
  return t * t;
}
function In(e) {
  const t = Math.sqrt(It(e, 0, 1));
  return B + t * (ne - B);
}
const bt = 13, Le = 5, yt = 8, bn = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), ke = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    T("globalFilter")
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
    T("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    T("ott")
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
    T("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    T("flanger")
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
    T("phaser")
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
    T("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    T("reverb")
  ]
}), vt = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), yn = Object.freeze([
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
]), vn = Object.freeze({
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
function Sn(e) {
  return Math.round(e) === 1 ? -5 : Math.round(e) === 2 ? 12 : Math.round(e) === 3 ? -12 : 7;
}
function St(e, t) {
  const n = {};
  for (const l of ke[e]) {
    const s = t[l];
    if (typeof s == "number" && Number.isFinite(s)) {
      n[l] = s;
      continue;
    }
    const d = vn[l];
    if (d === void 0)
      throw new Error(`Missing lane parameter value: ${e}.${l}`);
    n[l] = d;
  }
  const r = [
    ...vt.chorus,
    T("chorus")
  ], a = Object.keys(t);
  return e === "chorus" && a.length === r.length && a.every((l) => r.includes(l)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = Sn(
    Number(t.chorusRingOffsetMode)
  ) + Number(t.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function Tt(e) {
  return ke[e];
}
function Tn(e, t) {
  if (!Number.isInteger(t) || t < 0 || t >= Le)
    throw new Error(`Lane ordinal out of range: ${t}`);
  return t * yt + bn[e];
}
function En(e, t) {
  const n = new Array(bt).fill(0), i = St(e, t);
  return ke[e].forEach((r, a) => {
    n[a] = i[r];
  }), n;
}
const v = (e, t) => ({ label: e, value: t });
function _(e, t) {
  try {
    return e();
  } catch {
    return t;
  }
}
const w = Object.freeze({
  filter: _(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: _(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: _(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: _(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: _(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: _(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: _(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: _(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), m = (e, t, n, i, r, a, o, l = {}) => ({
  id: `${e}.${t}`,
  effectId: e,
  endpointID: t,
  label: n,
  shortLabel: i,
  min: r,
  max: a,
  initial: o,
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
function L(e, t, n) {
  return m(
    e,
    t,
    "Output Trim",
    "Trim",
    B,
    ne,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const xn = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Rn = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], An = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: w.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      m("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(v), quick: !0 }),
      m("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      m("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      m("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      L("filter", "globalFilterOutputTrimDb", 39)
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: w.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      m("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [v("Classic", 0), v("Harmonics", 1)] }),
      m("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      m("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      m("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      m("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      m("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      m("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [v("Symmetric", 0), v("Asymmetric", 1), v("Wavefold", 2)] }),
      L("drive", "distortionOutputTrimDb", 40)
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: w.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      m("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      m("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      m("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      m("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      m("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      L("ott", "ottOutputTrimDb", 41)
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: w.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      m("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(v) }),
      m("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(v) }),
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
      }),
      L("chorus", "chorusOutputTrimDb", 42)
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: w.flanger,
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
      }),
      L("flanger", "flangerOutputTrimDb", 43)
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: w.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      m("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [v("Free", 0), v("Sync", 1)] }),
      m("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      m("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: xn.map(v) }),
      m("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      m("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      m("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      m("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      m("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      L("phaser", "phaserOutputTrimDb", 44)
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: w.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      m("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [v("Free", 0), v("Sync", 1)] }),
      m("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      m("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Rn.map(v) }),
      m("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      m("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      m("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      L("delay", "delayOutputTrimDb", 45)
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: w.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      m("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      m("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      m("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      m("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      L("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], se = An, Et = Object.freeze(
  se.flatMap((e) => e.parameters)
);
new Map(
  Et.map((e) => [e.endpointID, e])
);
function xt(e) {
  const t = se.find((n) => n.id === e);
  if (t === void 0)
    throw new Error(`Unknown rack effect: ${e}`);
  return t;
}
function Rt() {
  return Et;
}
function Ne(e) {
  return e.modulationIdentityEndpointID ?? e.endpointID;
}
const Mn = "lane.v1", Dn = "laneTopology", Ve = "laneSlotParams", On = "laneOutputControl", Se = 16, _n = 8, At = 4, wn = 3, Mt = Le * yt, Dt = 4, Ln = 4, kn = Mt, Nn = Mt + Dt, Cn = 0, Fn = 1, Pn = 2, Kn = 3, Un = 4, zn = 5;
function Bn(e, t) {
  if (!Number.isInteger(t) || t < 0 || t > At)
    throw new Error(`Invalid lane branch tag: ${String(t)}`);
  return e | t << _n;
}
const ie = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), re = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Ot = new Map(
  Object.entries(re).map(([e, t]) => [t, e])
), Vn = Object.freeze({
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
  ie.map((e) => [Vn[e], e])
);
const Hn = "voiceEnhancerFrequency", $n = "voiceEnhancerQ", qn = "voiceEnhancerAmount", Wn = "voiceEnhancerFrequencyOctaves", Gn = "voiceEnhancerQ", jn = "voiceEnhancerAmount", _t = "voice.enhancerFrequency", Jn = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: Hn,
    targetKind: Wn,
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
    endpointID: $n,
    targetKind: Gn,
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
    endpointID: qn,
    targetKind: jn,
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
function He(e, t) {
  const n = Math.min(e.max, Math.max(e.min, t));
  return e.scale === "log" ? Math.log(n / e.min) / Math.log(e.max / e.min) : (n - e.min) / (e.max - e.min);
}
function Qn(e, t) {
  const n = Math.min(1, Math.max(0, t));
  return e.scale === "log" ? e.min * (e.max / e.min) ** n : e.min + (e.max - e.min) * n;
}
const Yn = Object.freeze([
  "voice.filterCutoff",
  _t,
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
]), Xn = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [_t]: "enhancer-frequency",
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
  Yn.map((e) => [e, Object.freeze({
    id: e,
    family: Xn[e],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const wt = 40, Lt = 18e3, Te = ie.map((e) => re[e]), Zn = /^([a-zA-Z]+)#([1-9][0-9]*)$/, ei = /^(parallel|split)#([1-9][0-9]*)$/;
function le(e) {
  if (typeof e != "string")
    return null;
  const t = Zn.exec(e);
  if (t === null)
    return null;
  const n = Te.find((r) => r === t[1]);
  if (n === void 0)
    return null;
  const i = Number(t[2]);
  return i > Le ? null : { deviceType: n, instanceNumber: i };
}
function kt(e) {
  if (typeof e != "string")
    return null;
  const t = ei.exec(e);
  if (t === null)
    return null;
  const n = t[1], i = Number(t[2]);
  return i > (n === "parallel" ? Dt : Ln) ? null : { groupKind: n, unitNumber: i };
}
function U(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function V(e, t) {
  const n = Reflect.ownKeys(e);
  return n.length === t.length && n.every((i) => typeof i == "string" && t.includes(i));
}
function p(e) {
  return { _tag: "err", message: `lane.v2 ${e}` };
}
function ti(e, t) {
  const n = le(e);
  if (n === null)
    return { failure: p(`device id ${e} is not a pool instance`) };
  if (!U(t) || !V(t, ["params"]) || !U(t.params))
    return { failure: p(`device ${e} must be { params }`) };
  const i = Tt(n.deviceType), r = Ot.get(n.deviceType);
  if (r === void 0)
    return { failure: p(`device ${e} has no effect descriptor`) };
  const a = xt(r).parameters.map((f) => f.endpointID), o = t.params, l = Object.keys(o), s = (f) => l.length === f.length && l.every((y) => f.includes(y)), d = T(n.deviceType), c = [
    ...vt[n.deviceType],
    d
  ], u = [
    ...yn,
    d
  ];
  if (!(l.includes(d) && (s(i) || s(a) || s(c) || n.deviceType === "chorus" && s(u))))
    return { failure: p(`device ${e} must carry every parameter once`) };
  for (const f of l) {
    const y = o[f];
    if (typeof y != "number" || !Number.isFinite(y))
      return { failure: p(`device ${e}.${f} must be a finite number`) };
  }
  return { record: { params: St(n.deviceType, o) } };
}
function ni(e, t) {
  return !U(e) || e.kind !== "device" ? { failure: p("branches may hold device placements only") } : V(e, ["kind", "deviceId", "enabled"]) ? typeof e.deviceId != "string" || !t.has(e.deviceId) ? { failure: p(`placement references unknown device ${String(e.deviceId)}`) } : typeof e.enabled != "boolean" ? { failure: p(`placement of ${e.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: e.deviceId, enabled: e.enabled } } : { failure: p("a device placement is { kind, deviceId, enabled }") };
}
function $e(e) {
  return typeof e == "number" && Number.isFinite(e) && e >= wt && e <= Lt;
}
function Nt() {
  return { mix: 1, bypassed: !1 };
}
function ii(e) {
  return !U(e) || !V(e, ["mix", "bypassed"]) || typeof e.mix != "number" || !Number.isFinite(e.mix) || e.mix < 0 || e.mix > 1 || typeof e.bypassed != "boolean" ? null : { mix: e.mix, bypassed: e.bypassed };
}
function ri(e) {
  let t = e;
  if (typeof e == "string")
    try {
      t = JSON.parse(e);
    } catch (c) {
      const u = c instanceof Error ? c.message : String(c);
      return p(`is not valid JSON: ${u}`);
    }
  if (!U(t) || !V(t, ["format", "version", "output", "devices", "chain"]))
    return p("must be { format, version, output, devices, chain }");
  if (t.format !== "cosimo.lane" || t.version !== 2)
    return p("must be cosimo.lane version 2");
  if (!U(t.devices))
    return p("devices must be an object");
  if (!Array.isArray(t.chain))
    return p("chain must be an array");
  const n = ii(t.output);
  if (n === null)
    return p("output must be { mix: 0..1, bypassed: boolean }");
  const i = {};
  for (const c of Reflect.ownKeys(t.devices)) {
    if (typeof c != "string")
      return p("device ids must be strings");
    const u = ti(c, t.devices[c]);
    if ("failure" in u)
      return u.failure;
    i[c] = u.record;
  }
  const r = new Set(Object.keys(i)), a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), l = [];
  let s = 0;
  const d = (c) => {
    const u = ni(c, r);
    return "placement" in u && (a.set(
      u.placement.deviceId,
      (a.get(u.placement.deviceId) ?? 0) + 1
    ), s += 1), u;
  };
  for (const c of t.chain) {
    if (!U(c))
      return p("chain nodes must be objects");
    if (c.kind === "device") {
      const S = d(c);
      if ("failure" in S)
        return S.failure;
      l.push(S.placement);
      continue;
    }
    if (c.kind !== "parallel" && c.kind !== "split")
      return p(`unknown chain node kind ${String(c.kind)}`);
    const u = c.kind === "split", h = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], y = u ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], b = u && V(c, h);
    if (!V(c, y) && !b)
      return p(`a ${c.kind} group is { ${y.join(", ")} }`);
    const R = kt(c.groupId);
    if (R === null || R.groupKind !== c.kind)
      return p(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (o.has(String(c.groupId)))
      return p(`group ${String(c.groupId)} is used twice`);
    if (o.add(String(c.groupId)), typeof c.enabled != "boolean")
      return p(`group ${String(c.groupId)} needs a boolean enable`);
    const F = u ? wn : At;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > F)
      return p(`group ${String(c.groupId)} needs 2..${F} branches`);
    if (u && (!$e(c.xoverLowHz) || !$e(c.xoverHighHz)))
      return p(`group ${String(c.groupId)} crossovers must sit in ${wt}..${Lt} Hz`);
    if (u && !b && (typeof c.xoverLowKeyTrackEnabled != "boolean" || typeof c.xoverHighKeyTrackEnabled != "boolean" || typeof c.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverLowKeyTrackOffsetSemitones) || typeof c.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverHighKeyTrackOffsetSemitones)))
      return p(`group ${String(c.groupId)} Key Track state must be finite`);
    s += 1;
    const D = [];
    for (const S of c.branches) {
      if (!Array.isArray(S))
        return p(`group ${String(c.groupId)} branches must be arrays`);
      const A = [];
      for (const O of S) {
        const P = d(O);
        if ("failure" in P)
          return P.failure;
        A.push(P.placement);
      }
      D.push(A);
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
      branches: D
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: D
    });
  }
  for (const c of r)
    if ((a.get(c) ?? 0) !== 1)
      return p(`device ${c} must be placed exactly once`);
  return s > Se ? p(`flattens to ${s} wire entries; the topology upload holds ${Se}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: i, chain: l } };
}
function ai() {
  const e = {};
  for (const t of ie) {
    const n = re[t];
    e[`${n}#1`] = {
      params: mi(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Nt(),
    devices: e,
    chain: ie.map((t) => ({
      kind: "device",
      deviceId: `${re[t]}#1`,
      enabled: !1
    }))
  };
}
const qe = ["distortion#1", "delay#1", "reverb#1"];
function oi() {
  const e = ai(), t = {};
  for (const n of qe) {
    const i = e.devices[n];
    if (i === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    t[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: Nt(),
    devices: t,
    chain: e.chain.filter((n) => n.kind === "device" && qe.includes(n.deviceId))
  };
}
function si(e) {
  if (e === void 0)
    return oi();
  const t = ri(e);
  return t._tag === "ok" ? t.value : null;
}
function li(e) {
  return Object.keys(e.devices).map((t) => {
    const n = le(t);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${t}`);
    return { instanceId: t, parsed: n };
  }).sort((t, n) => Te.indexOf(t.parsed.deviceType) - Te.indexOf(n.parsed.deviceType) || t.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: t, parsed: n }) => ({ instanceId: t, deviceType: n.deviceType }));
}
function Ee(e) {
  const t = le(e);
  if (t === null)
    throw new Error(`Invalid lane instance id in state: ${e}`);
  return Tn(t.deviceType, t.instanceNumber - 1);
}
function Ct(e) {
  const t = kt(e.groupId);
  if (t === null)
    throw new Error(`Invalid lane group id in state: ${e.groupId}`);
  return (t.groupKind === "parallel" ? kn : Nn) + (t.unitNumber - 1);
}
function ci(e) {
  const t = new Array(Se).fill(0);
  let n = 0, i = 0;
  const r = (a, o, l) => {
    t[i] = Bn(a, o), l && (n |= 1 << i), i += 1;
  };
  for (const a of e.chain) {
    if (a.kind === "device") {
      r(Ee(a.deviceId), 0, a.enabled);
      continue;
    }
    r(Ct(a), a.branches.length, a.enabled), a.branches.forEach((o, l) => {
      for (const s of o)
        r(Ee(s.deviceId), l + 1, s.enabled);
    });
  }
  return { chainLength: i, slotIds: t, enabledMask: n };
}
function di(e) {
  const t = new Array(bt).fill(0);
  return t[Cn] = e.xoverLowHz, t[Fn] = e.xoverHighHz, t[Pn] = e.xoverLowKeyTrackEnabled ? 1 : 0, t[Kn] = e.xoverLowKeyTrackOffsetSemitones, t[Un] = e.xoverHighKeyTrackEnabled ? 1 : 0, t[zn] = e.xoverHighKeyTrackOffsetSemitones, t;
}
function ui(e) {
  const t = [{
    endpointID: On,
    value: e.output
  }];
  let n = 0;
  for (const i of li(e)) {
    const r = le(i.instanceId);
    if (r === null)
      throw new Error(`Invalid lane device identity during replay: ${i.instanceId}`);
    t.push({
      endpointID: pn(
        r.deviceType,
        r.instanceNumber
      ),
      value: e.devices[i.instanceId].params[T(r.deviceType)]
    }), n += 1, t.push({
      endpointID: Ve,
      value: {
        slotId: Ee(i.instanceId),
        deliverySerial: n,
        values: En(
          i.deviceType,
          e.devices[i.instanceId].params
        )
      }
    });
  }
  for (const i of e.chain)
    i.kind === "split" && (n += 1, t.push({
      endpointID: Ve,
      value: {
        slotId: Ct(i),
        deliverySerial: n,
        values: di(i)
      }
    }));
  return t.push({
    endpointID: Dn,
    value: ci(e)
  }), t;
}
function mi(e) {
  const t = Ot.get(e);
  if (t === void 0)
    throw new Error(`Unknown lane device type: ${e}`);
  const n = xt(t).parameters;
  return Object.fromEntries(Tt(e).map((i) => [
    i,
    n.find((r) => r.endpointID === i)?.initial ?? 0
  ]));
}
const fi = "runtimeState";
function hi(e) {
  if (typeof e != "object" || e === null || Array.isArray(e))
    return 0;
  const t = Number(Reflect.get(e, "dspSessionId"));
  return Number.isFinite(t) ? Math.trunc(t) : 0;
}
const pi = {
  endpointID: fi,
  required: !0,
  mapValue: hi
}, gi = 2e3;
function We(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function Ge(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Ii(e, t) {
  if (!Ge(e))
    return { found: !1 };
  const n = Ge(e.values) ? e.values : void 0;
  return n && We(n, t) ? {
    found: !0,
    value: n[t]
  } : We(e, t) ? {
    found: !0,
    value: e[t]
  } : { found: !1 };
}
function je(e) {
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
class bi {
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
  constructor(t, n) {
    this.connection = t, this.options = n, this.stateKeys = [.../* @__PURE__ */ new Set([n.stateKey, ...n.fallbackStateKeys ?? []])], this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = yi(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
  }
  start() {
    if (!this.started) {
      this.started = !0, this.lifetime += 1, this.deliveryInProgress = !1, this.deliveryRefreshPending = !1, this.lastAppliedToken = null, this.lastAppliedRuntimeEndpointsToken = null, this.lastAppliedSnapshot = null, this.pendingStateKeyIndex = null, this.activeStateKeyIndex = null, this.connection.addStoredStateValueListener?.(this.handleStoredStateValue);
      for (const t of this.parameterEndpointIDs)
        this.connection.addParameterListener?.(t, this.getParameterListener(t)), this.connection.requestParameterValue?.(t);
      for (const t of this.runtimeEndpointDependencies)
        this.connection.addEndpointListener?.(t.endpointID, this.getRuntimeEndpointListener(t));
      this.requestStoredState();
    }
  }
  stop() {
    if (this.started) {
      this.started = !1, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValue);
      for (const t of this.parameterEndpointIDs)
        this.connection.removeParameterListener?.(t, this.getParameterListener(t));
      for (const t of this.runtimeEndpointDependencies)
        this.connection.removeEndpointListener?.(t.endpointID, this.getRuntimeEndpointListener(t));
    }
  }
  /** Rebuild and resend the complete runtime image from the stored snapshot. */
  replayFullRuntimeState() {
    this.started && (this.lastAppliedToken = null, this.lastAppliedRuntimeEndpointsToken = null, this.lastAppliedSnapshot = null, this.forceFullReplay = !0, this.applyRuntimeStateIfReady());
  }
  requestStoredState() {
    if (typeof this.connection.requestFullStoredState == "function") {
      const t = this.lifetime;
      this.connection.requestFullStoredState((n) => {
        if (!(!this.started || t !== this.lifetime)) {
          for (let i = 0; i < this.stateKeys.length; i += 1) {
            const r = Ii(n, this.stateKeys[i]);
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
  handleStoredStateValue(t) {
    if (!t || typeof t != "object")
      return;
    const n = t;
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
  requestStateKeyAtIndex(t) {
    if (t >= this.stateKeys.length) {
      this.options.applyDefaultRuntimeStateWhenMissing && (this.activeStateKeyIndex = null, this.applyStoredValue(void 0));
      return;
    }
    this.pendingStateKeyIndex = t, this.connection.requestStoredStateValue?.(this.stateKeys[t]);
  }
  getParameterListener(t) {
    const n = this.parameterListeners.get(t);
    if (n)
      return n;
    const i = (r) => {
      this.parameterValues.set(t, r), this.applyRuntimeStateIfReady();
    };
    return this.parameterListeners.set(t, i), i;
  }
  getRuntimeEndpointListener(t) {
    const n = this.runtimeEndpointListeners.get(t.endpointID);
    if (n)
      return n;
    const i = (r) => {
      const a = t.mapValue ? t.mapValue(r) : r;
      this.runtimeEndpointValues.set(t.endpointID, a), this.applyRuntimeStateIfReady();
    };
    return this.runtimeEndpointListeners.set(t.endpointID, i), i;
  }
  applyStoredValue(t) {
    const n = this.options.deserializeStoredState(t);
    n !== null && (this.state = n, this.hasState = !0, this.applyRuntimeStateIfReady());
  }
  applyRuntimeStateIfReady() {
    if (!this.hasState)
      return;
    if (this.deliveryInProgress) {
      this.deliveryRefreshPending = !0;
      return;
    }
    const t = {};
    for (const s of this.parameterEndpointIDs) {
      if (!this.parameterValues.has(s))
        return;
      t[s] = this.parameterValues.get(s);
    }
    const n = {};
    for (const s of this.runtimeEndpointDependencies) {
      if (!this.runtimeEndpointValues.has(s.endpointID)) {
        if (s.required)
          return;
        continue;
      }
      n[s.endpointID] = this.runtimeEndpointValues.get(s.endpointID);
    }
    const i = {
      state: this.state,
      parameters: t,
      runtimeEndpoints: n
    }, r = je(n), a = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, o = this.options.buildRuntimeEvents(i, a), l = je({
      runtimeEndpoints: n,
      events: o
    });
    if (l === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
      return;
    }
    if (o.length === 0) {
      this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      const s = this.lifetime;
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(o, i).then((d) => {
        if (!this.started || s !== this.lifetime)
          return;
        this.deliveryInProgress = !1, d ? (this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(o);
        const c = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, c && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (!this.started || s !== this.lifetime)
          return;
        this.deliveryInProgress = !1, this.options.onDeliveryFailure?.(o);
        const d = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, d && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const s of o)
      this.connection.sendEventOrValue?.(
        s.endpointID,
        s.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? gi
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function yi(e) {
  const t = /* @__PURE__ */ new Map();
  for (const n of e)
    t.has(n.endpointID) || t.set(n.endpointID, n);
  return [...t.values()];
}
function vi(e, t) {
  return new bi(e, t);
}
function Si(e) {
  return vi(e, {
    stateKey: Mn,
    runtimeEndpointDependencies: [pi],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: si,
    buildRuntimeEvents: ({ state: t }) => [...ui(t)]
  });
}
function de(e) {
  return Object.freeze({ kind: "parameter", endpoint: e });
}
function Ti(e) {
  const t = Object.freeze({ ...e.codec });
  return Object.freeze({ kind: "stored", initial: t.parse(e.initial), codec: t, ...e.engine ? { engine: e.engine } : {} });
}
function Ei(e) {
  return Object.freeze({ ...e });
}
function E(e, t) {
  if (!e)
    throw new Error(t);
}
function ue(e, t, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(e.getUint8(t + r));
  return i;
}
function xi(e) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(e);
}
function xe(e) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(e) : Uint8Array.from(e, (t) => t.charCodeAt(0));
}
function Ft(e) {
  if (e === null)
    return "null";
  if (e === void 0)
    return "undefined";
  const t = typeof e, n = e?.constructor?.name;
  if (t !== "object")
    return n ? `${t}:${n}` : t;
  const i = Object.keys(e).slice(0, 6), r = i.length > 0 ? ` keys=${i.join(",")}` : "";
  return n ? `${t}:${n}${r}` : `${t}${r}`;
}
function Ri() {
  const e = globalThis.location?.href;
  if (typeof e == "string" && e.length > 0)
    return new URL("/", e);
  const t = new URL(import.meta.url), n = t.pathname;
  return n.includes("/patch_gui/desktop/") ? (t.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), t) : n.includes("/patch_gui/") ? (t.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), t) : n.includes("/ui/shared/") ? (t.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), t) : (t.pathname = n.replace(/\/[^/]+$/, "/"), t);
}
function me(e, t) {
  const n = Ri();
  if (t instanceof URL)
    return t;
  if (typeof t == "string" && t.length > 0) {
    if (xi(t))
      return new URL(t);
    const i = t.startsWith("/") ? t.slice(1) : t;
    return new URL(i, n);
  }
  return new URL(e, n);
}
async function Je(e) {
  if (typeof e == "string")
    return e;
  if (e && typeof e.text == "function")
    return e.text();
  if (e instanceof ArrayBuffer)
    return typeof TextDecoder == "function" ? new TextDecoder().decode(new Uint8Array(e)) : String.fromCharCode(...new Uint8Array(e));
  if (ArrayBuffer.isView(e)) {
    const t = new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
    return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
  }
  if (Array.isArray(e)) {
    const t = Uint8Array.from(e);
    return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
  }
  throw new Error(`Unsupported text resource payload (${Ft(e)})`);
}
function Ai(e) {
  if (e instanceof ArrayBuffer)
    return new Uint8Array(e.slice(0));
  if (ArrayBuffer.isView(e))
    return new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength));
  if (Array.isArray(e))
    return Uint8Array.from(e);
  if (typeof e == "string")
    return xe(e);
  throw new Error(`Unsupported binary resource payload (${Ft(e)})`);
}
function Mi(e) {
  const t = e?.frames;
  E(
    Array.isArray(t) || ArrayBuffer.isView(t),
    "Decoded audio data must provide a frames array"
  );
  const n = Array.from(t), i = new Float32Array(n.length);
  for (let r = 0; r < n.length; r += 1) {
    const a = n[r];
    if (typeof a == "number") {
      i[r] = a;
      continue;
    }
    if (ArrayBuffer.isView(a) || Array.isArray(a)) {
      const o = a;
      E(o.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(o[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(e?.sampleRate) || 0,
    samples: i
  };
}
function Pt(e) {
  const t = new DataView(e);
  E(ue(t, 0, 4) === "RIFF", "Expected a RIFF wave file"), E(ue(t, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, a = null, o = null, l = null, s = null, d = 12;
  for (; d + 8 <= t.byteLength; ) {
    const u = ue(t, d, 4), h = t.getUint32(d + 4, !0), f = d + 8;
    u === "fmt " ? (n = t.getUint16(f, !0), i = t.getUint16(f + 2, !0), r = t.getUint32(f + 4, !0), o = t.getUint16(f + 12, !0), a = t.getUint16(f + 14, !0)) : u === "data" && (l = f, s = h), d = f + h + h % 2;
  }
  E(n !== null, "Wave file is missing a fmt chunk"), E(l !== null && s !== null, "Wave file is missing a data chunk"), E(i === 1, "Only mono wavetable bank files are supported");
  let c;
  if (n === 3 && a === 32)
    c = new Float32Array(e.slice(l, l + s));
  else if (n === 1 && a === 16) {
    const u = s / 2, h = new Int16Array(e.slice(l, l + s));
    c = new Float32Array(u);
    for (let f = 0; f < u; f += 1)
      c[f] = h[f] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${a}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: r ?? 0,
    bitsPerSample: a,
    blockAlign: o ?? 0,
    samples: c
  };
}
async function Qe(e) {
  E(typeof fetch == "function", `Could not fetch ${e}: global fetch is unavailable`);
  const t = await fetch(e.toString());
  return E(t.ok, `Failed to fetch resource from ${e}`), t.arrayBuffer();
}
function Re(e) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(e) : String.fromCharCode(...e);
}
function Kt(e) {
  const t = new Uint8Array(e).buffer, n = Pt(t);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Di(e, {
  textPreference: t = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (s) => (E(typeof e.readResource == "function", `Resource bridge cannot read ${s}`), e.readResource(s)), r = async (s) => {
    E(typeof e.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const d = await e.readResourceAsAudioData(s);
    return Mi(d);
  }, a = (s) => {
    const d = e.getResourceAddress?.(s);
    return d ?? null;
  }, o = async (s, d = e.getResourceAddress?.(s)) => {
    const c = me(s, d), u = await Qe(c), h = Pt(u);
    return {
      sampleRate: h.sampleRate,
      samples: h.samples
    };
  }, l = async (s, d = e.getResourceAddress?.(s)) => {
    const c = me(s, d);
    return new Uint8Array(await Qe(c));
  };
  return {
    async readText(s) {
      if (t === "bridge" && typeof e.readResource == "function")
        return Je(await i(s));
      const d = a(s);
      return t === "url" && d !== null ? Re(await l(s, d)) : typeof e.readResource == "function" ? Je(await i(s)) : Re(await l(s, d));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof e.readResource == "function" ? Ai(await i(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof e.readResourceAsAudioData == "function")
        return r(s);
      const d = a(s);
      return n === "url" && d !== null ? o(s, d) : typeof e.readResourceAsAudioData == "function" ? r(s) : Kt(await this.readBytes(s));
    },
    getURL(s) {
      return me(s, e.getResourceAddress?.(s));
    }
  };
}
function Oi(e) {
  const t = e ?? {}, n = !!t.prefersAudioResourceReadBridge;
  return Di(t, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function _i(e) {
  const t = typeof e.readText == "function" ? e.readText.bind(e) : null, n = typeof e.readJSON == "function" ? e.readJSON.bind(e) : null, i = typeof e.readBytes == "function" ? e.readBytes.bind(e) : null, r = typeof e.readAudio == "function" ? e.readAudio.bind(e) : null, a = typeof e.getURL == "function" ? e.getURL.bind(e) : null;
  return {
    async readText(o) {
      if (t)
        return t(o);
      if (n)
        return JSON.stringify(await n(o));
      if (i)
        return Re(await i(o));
      throw new Error(`Resource client cannot read text ${o}`);
    },
    async readJSON(o) {
      return n ? n(o) : JSON.parse(await this.readText(o));
    },
    async readBytes(o) {
      if (i)
        return i(o);
      if (t)
        return xe(await t(o));
      if (n)
        return xe(JSON.stringify(await n(o)));
      throw new Error(`Resource client cannot read bytes ${o}`);
    },
    async readAudio(o) {
      return r ? r(o) : Kt(await this.readBytes(o));
    },
    getURL(o) {
      return a ? a(o) : null;
    }
  };
}
function wi(e) {
  return typeof e?.readText == "function" || typeof e?.readJSON == "function" || typeof e?.readBytes == "function" || typeof e?.readAudio == "function";
}
function Li(e) {
  return wi(e) ? _i(e) : Oi(e);
}
const Ce = ["A", "B", "C"], Ut = [
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
], ki = [
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
], z = Object.freeze([
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
]), Ni = Object.freeze([
  ...Ce.flatMap((e) => Ut.map(
    (t) => `osc${e}.${t}`
  )),
  ...ki
]);
new Set(
  Ce.flatMap((e) => Ut.map(
    (t) => `osc${e}.${t}`
  ))
);
const zt = Object.freeze(
  Ni.map((e, t) => ({ kind: e, group: "voice", runtimeIndex: t }))
), Ci = Rt().filter(
  (e) => e.modulationTargetIndex !== null
), Fi = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function Fe(e) {
  const t = Pi(e);
  if (t === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${e}`);
  return t;
}
function Pi(e) {
  const t = Fi.find((n) => e.startsWith(n));
  return t === void 0 ? null : `lane.${t}#1.${e}`;
}
const Ki = [
  ...Ci.map((e) => ({
    kind: Fe(Ne(e)),
    group: "rack",
    runtimeIndex: e.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Bt = Object.freeze(
  Ki.sort((e, t) => e.runtimeIndex - t.runtimeIndex)
), C = Object.freeze([
  ...zt,
  ...Bt
]), Z = z.length, Ui = zt.length, zi = Bt.length, Bi = Z * C.length, Vi = new Map(z.map((e) => [e.id, e])), Hi = new Map(z.map((e) => [
  `${e.sourceKind}:${e.sourceSlot ?? 0}`,
  e
])), Pe = new Map(C.map((e) => [e.kind, e]));
function $i() {
  if (Z !== 14 || Ui !== 59 || zi !== 47 || Bi !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [e, t] of [["voice", 10], ["macro", 4]]) {
    const n = z.filter((i) => i.group === e).sort((i, r) => i.runtimeIndex - r.runtimeIndex);
    if (n.length !== t || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${e} source indexes`);
  }
  for (const [e, t] of [["voice", 59], ["rack", 47]]) {
    const n = C.filter((i) => i.group === e);
    if (n.length !== t || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${e} target indexes`);
  }
  if (Vi.size !== Z || Hi.size !== Z || Pe.size !== C.length)
    throw new Error("Modulation identities must be unique");
}
$i();
function Vt(e) {
  return typeof e != "string" ? null : Pe.has(e) ? e : null;
}
function qi(e) {
  const t = Vt(e);
  return t !== null && Pe.get(t)?.group === "rack" ? t : null;
}
function Wi(e) {
  const t = e.indexOf(".");
  return t >= 0 ? e.slice(t + 1) : e;
}
const Gi = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), ji = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function ce(e) {
  if (typeof e != "string")
    return null;
  const t = ji.exec(e);
  if (t === null)
    return null;
  const n = t[1], i = Gi.get(n);
  if (i === void 0)
    return null;
  const r = t[3];
  return i.includes(r) ? {
    instanceId: `${n}#${t[2]}`,
    deviceType: n,
    endpointID: r
  } : null;
}
function Ht(e) {
  return `lane.${e.deviceType}#1.${e.endpointID}`;
}
function Ji(e) {
  return Number(e.instanceId.slice(e.instanceId.indexOf("#") + 1));
}
const Ye = 20, $t = "MSEG 1", Qi = 0, K = 2, Yi = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function Ke(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function Ae(e, t, n = 1e-12) {
  return Math.abs(e - t) <= n;
}
function Xi(e) {
  return Ke(Number.isFinite(e) ? e : 0, -Ye, Ye);
}
function G(e) {
  return Ke(Number.isFinite(e) ? e : 0, 0, 1);
}
function qt(e = $t) {
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: e,
    globalSmooth: !1,
    points: [
      { x: 0, y: 0, curvePower: 0 },
      { x: 1, y: 1, curvePower: 0 }
    ]
  };
}
function Me() {
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
function Zi(e) {
  const t = Number(e);
  return Ke(
    Number.isFinite(t) ? t : 1,
    Qi,
    K
  );
}
function er(e) {
  if (!e || typeof e != "object")
    return null;
  const t = e, n = G(Number(t.startX)), i = G(Number(t.endX));
  return Ae(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function tr(e = Me()) {
  const t = e && typeof e == "object" ? e : {}, n = t.rate && typeof t.rate == "object" ? t.rate : {}, i = Number(n.seconds), r = t.noteOffPolicy, a = Yi.has(r) ? r : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: Zi(Number.isFinite(i) ? i : 1)
    },
    loop: er(t.loop),
    noteOffPolicy: a,
    legatoRestarts: !!t.legatoRestarts,
    holdFinalValue: t.holdFinalValue !== !1
  };
}
function nr(e, t, n) {
  const i = e && typeof e == "object" ? e : {};
  let r = Number(i.x);
  return Number.isFinite(r) || (r = t === 0 ? 0 : t === n - 1 ? 1 : 0), t !== 0 && t !== n - 1 && (r = G(r)), {
    x: r,
    y: G(Number(i.y)),
    curvePower: Xi(Number(i.curvePower))
  };
}
function Xe(e = qt()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.points) ? t.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((r, a) => nr(r, a, n.length));
  if (!Ae(i[0].x, 0) || !Ae(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let r = 1; r < i.length; r += 1)
    if (i[r].x < i[r - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof t.name == "string" && t.name.trim() ? t.name : $t,
    globalSmooth: !!t.globalSmooth,
    points: i
  };
}
z.filter((e) => e.group === "voice").length;
z.filter((e) => e.group === "macro").length;
function ir(e) {
  return { _tag: "ok", value: e };
}
function fe(e) {
  return { _tag: "err", error: e };
}
function rr(e) {
  throw new Error(`Unhandled case: ${JSON.stringify(e)}`);
}
function ar(e) {
  throw new Error(e ?? "Invariant violated");
}
const or = "globalTune", sr = "globalTuneSemitones", k = -24, $ = 24, Ze = 0, Wt = -48, Gt = 48, et = -48, lr = 6, cr = 0, tt = (cr - et) / (lr - et);
function J(e, t, n, i, r = "percent", a = null) {
  return { id: e, label: t, initialPercent: n, defaultPercent: i, format: r, compound: a };
}
const dr = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      J("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      J("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      J("mix", "Mix", 100, 100),
      J("drive", "Drive", 15, 0)
    ]
  }
], nt = 1e-6;
function x(e, t) {
  if (!Number.isFinite(e) || e < -nt || e > 1 + nt)
    throw new RangeError(`${t} produced non-normalized value ${e}`);
  return Math.min(1, Math.max(0, e));
}
function ae(e, t) {
  return x(e / 100, `${t} catalog percentage`);
}
function j(e, t) {
  if (t.length === 0 || t.includes("."))
    throw new Error(`Invalid catalog parameter id "${t}"`);
  return `${e}.${t}`;
}
function ur(e) {
  return 20 * 1e3 ** e;
}
function mr(e) {
  return x(Math.log(e / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function fr(e) {
  return 0.1 * 200 ** e;
}
function hr(e) {
  return x(Math.log(e / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function pr(e) {
  return e;
}
function gr(e) {
  return x(e, "filterMix endpoint conversion");
}
function H(e, t, n) {
  return { _tag: "endpoint", endpointId: e, toEngine: t, fromEngine: n };
}
function Ir(e, t) {
  switch (e) {
    case "voice-filter.cutoff":
      return {
        binding: H("filterCutoff", ur, mr),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: H("filterQ", fr, hr),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: H("filterMix", pr, gr),
        // T05 scope: articulations do not own Mix yet — capturing it
        // would extend the persisted articulation schema.
        articulationParameterId: null,
        modulationTargetKind: "filterMix"
      };
    default:
      return {
        binding: {
          _tag: "unbacked",
          reason: t === "effects" ? "rack-dsp" : "no-endpoint"
        },
        articulationParameterId: null,
        modulationTargetKind: null
      };
  }
}
function jt(e) {
  switch (e) {
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
      return rr(e);
  }
}
function br(e) {
  return e.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : e.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function yr(e, t) {
  const n = j(e.moduleId, t.id), i = jt(t.format), r = Ir(n, e.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: e.moduleId,
    workspace: e.workspace,
    label: t.label,
    defaultValue: ae(t.defaultPercent, n),
    initialValue: ae(t.initialPercent, n),
    format: i,
    modAmount: br(i),
    binding: r.binding,
    isQuick: e.quickParameterId === t.id,
    compound: t.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const vr = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: tt * 100, defaultPercent: tt * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Sr(e) {
  return e === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : e === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : e === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Tr(e, t) {
  const n = `osc${e}`, i = j(n, t.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: t.label,
    defaultValue: ae(t.defaultPercent, i),
    initialValue: ae(t.initialPercent, i),
    format: jt(t.format),
    modAmount: Sr(t.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: t.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${t.parameterKind}`
  });
}
const Er = Object.freeze(
  Ce.flatMap((e) => vr.map((t) => Tr(e, t)))
), xr = Object.freeze({
  targetId: j("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: x(
    (Ze - k) / ($ - k),
    "Global Tune default"
  ),
  initialValue: x(
    (Ze - k) / ($ - k),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: $ },
  modAmount: {
    min: Wt,
    max: Gt,
    unit: "st",
    digits: 2
  },
  binding: H(
    or,
    (e) => k + ($ - k) * e,
    (e) => x(
      (e - k) / ($ - k),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: sr
});
function Rr(e) {
  const t = j("voice-enhancer", e.key), n = x(
    He(e, e.initial),
    `${e.endpointID} initial value`
  );
  return Object.freeze({
    targetId: t,
    moduleId: "voice-enhancer",
    workspace: "voice",
    label: e.label,
    defaultValue: n,
    initialValue: n,
    format: e.unit === "Hz" ? { kind: "frequency", minHz: e.min, maxHz: e.max } : { kind: "percent" },
    modAmount: e.modulationApplication === "octaves" ? { min: -6, max: 6, unit: "oct", digits: 2 } : e.unit === "Q" ? { min: -9.9, max: 9.9, unit: "Q", digits: 2 } : { min: -100, max: 100, unit: "%", digits: 0 },
    binding: H(
      e.endpointID,
      (i) => Qn(e, i),
      (i) => x(
        He(e, i),
        `${e.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: e.targetKind
  });
}
const Ar = Object.freeze(
  Object.values(Jn).map(Rr)
), Mr = Object.freeze([
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
function Dr(e) {
  const t = j(e.moduleId, e.targetIdSuffix), n = e.max - e.min, i = (a) => e.min + n * a, r = (a) => x(
    (a - e.min) / n,
    `${e.endpointID} endpoint conversion`
  );
  return Object.freeze({
    targetId: t,
    moduleId: e.moduleId,
    workspace: "voice",
    label: e.label,
    defaultValue: r(e.initial),
    initialValue: r(e.initial),
    format: e.format === "time" ? { kind: "time", minSeconds: e.min, maxSeconds: e.max } : { kind: "percent" },
    modAmount: e.format === "time" ? { min: -n, max: n, unit: "s", digits: 3 } : { min: -100, max: 100, unit: "%", digits: 0 },
    binding: H(e.endpointID, i, r),
    isQuick: !1,
    compound: null,
    articulationParameterId: e.articulationParameterId,
    modulationTargetKind: e.targetKind
  });
}
const Or = Object.freeze(
  Mr.map(Dr)
), _r = Object.freeze([
  { suffix: "low", label: "Low Crossover", kind: "lane.frequencySplit#1.xoverLowHz" },
  { suffix: "high", label: "High Crossover", kind: "lane.frequencySplit#1.xoverHighHz" }
].map(({ suffix: e, label: t, kind: n }) => Object.freeze({
  targetId: `frequency-split.${e}`,
  moduleId: "frequency-split",
  workspace: "effects",
  label: t,
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
function wr(e) {
  return `${e.effectId}.${e.endpointID}`;
}
function he(e, t) {
  const n = e.valueKind === "effect-output-trim-db" ? gn(t) : e.scale === "log" ? Math.log(t / e.min) / Math.log(e.max / e.min) : (t - e.min) / (e.max - e.min);
  return x(n, `${e.endpointID} endpoint conversion`);
}
function Lr(e, t) {
  return e.valueKind === "effect-output-trim-db" ? In(t) : e.scale === "log" ? e.min * (e.max / e.min) ** t : e.min + (e.max - e.min) * t;
}
function kr(e) {
  return e.unit === "Hz" ? { kind: "frequency", minHz: e.min, maxHz: e.max } : e.unit === "deg" ? { kind: "phase" } : e.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(e.min), Math.abs(e.max)) } : e.min < 0 && e.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Nr(e) {
  if (e.scale === "log")
    return { min: -6, max: 6, unit: "oct", digits: 2 };
  if (e.unit === "st") {
    const n = e.max - e.min;
    return { min: -n, max: n, unit: "st", digits: 2 };
  }
  if (e.unit === "dB") {
    const n = e.max - e.min;
    return { min: -n, max: n, unit: "dB", digits: 1 };
  }
  const t = e.max - e.min;
  return { min: -t, max: t, unit: "%", digits: t <= 2 ? 3 : 1 };
}
function Cr(e) {
  const t = wr(e);
  return Object.freeze({
    targetId: t,
    moduleId: e.effectId,
    workspace: "effects",
    label: e.label,
    defaultValue: he(e, e.initial),
    initialValue: he(e, e.initial),
    format: kr(e),
    modAmount: Nr(e),
    binding: {
      _tag: "endpoint",
      endpointId: e.endpointID,
      toEngine: (n) => Lr(e, n),
      fromEngine: (n) => he(e, n)
    },
    isQuick: e.quick,
    compound: e.endpointID === "phaserRate" || e.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: e.modulationTargetIndex === null ? null : Fe(Ne(e))
  });
}
const Ue = Object.freeze(
  [
    ...se.flatMap((e) => e.parameters.map(Cr)),
    ..._r,
    xr,
    ...Ar,
    ...Er,
    ...Or,
    ...dr.flatMap(
      (e) => e.parameters.map(
        (t) => yr(e, t)
      )
    )
  ]
), Fr = new Map(
  Ue.map((e) => [e.targetId, e])
), Jt = Ue.filter(
  (e) => e.modulationTargetKind !== null
), De = new Map(
  Jt.flatMap((e) => e.modulationTargetKind === null ? [] : [[e.modulationTargetKind, e]])
);
if (Fr.size !== Ue.length)
  throw new Error("Target descriptor IDs must be unique");
if (Jt.length !== C.length || De.size !== C.length || C.some((e) => De.get(e.kind)?.modulationTargetKind !== e.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function pe(e) {
  const t = De.get(e);
  return t === void 0 ? ar(`Modulation target "${e}" has no display descriptor`) : t;
}
new Map(
  se.map((e) => [e.id, e.label])
);
function Pr(e) {
  const t = Ji(e);
  return t === 1 ? "" : ` ${t}`;
}
function Kr(e) {
  const t = /^osc([ABC])\.(.+)$/.exec(e);
  if (t !== null) {
    const i = pe(e);
    return `${t[1]} ${i.label.toUpperCase()}`;
  }
  const n = ce(e);
  if (n !== null) {
    const i = pe(Ht(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : i.moduleId.toUpperCase()}${Pr(n)} ${i.label.toUpperCase()}`;
  }
  return pe(e).label.toUpperCase();
}
const Ur = "modulation.v6", Qt = 6, ze = 3, Yt = 3, zr = 4, Xt = 4, Br = ["MSEG 1", "MSEG 2", "MSEG 3"], Zt = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], Vr = ["Env 1", "Env 2", "Env 3"], Hr = 1e-3, g = 10, $r = 0.1, qr = 20, it = 10 - 0.1, Wr = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: qr - $r },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Wt,
    max: Gt
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
  mseg1Rate: { min: -K, max: K },
  mseg2Rate: { min: -K, max: K },
  mseg3Rate: { min: -K, max: K },
  env1Attack: { min: -g, max: g },
  env1Decay: { min: -g, max: g },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -g, max: g },
  env2Attack: { min: -g, max: g },
  env2Decay: { min: -g, max: g },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -g, max: g },
  env3Attack: { min: -g, max: g },
  env3Decay: { min: -g, max: g },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -g, max: g },
  ampAttack: { min: -g, max: g },
  ampDecay: { min: -g, max: g },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -g, max: g },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -it, max: it },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, Gr = Rt().filter((e) => e.modulationTargetIndex !== null), jr = new Map(
  Gr.map((e) => [
    Fe(Ne(e)),
    e
  ])
);
class ge extends Error {
  name = "ModulationStateParseError";
}
const Jr = {
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
z.map((e) => ({
  value: e.id,
  label: Jr[e.id],
  sourceKind: e.sourceKind,
  sourceSlot: e.sourceSlot
}));
const Qr = C.map((e) => ({
  value: e.kind,
  label: Kr(e.kind)
}));
Qr.filter((e) => !Xr(e.value));
function Yr(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function Be(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
function Ie(e, t) {
  const n = Number(e);
  return Be(Number.isFinite(n) ? n : t, Hr, g);
}
function Xr(e) {
  return qi(e) !== null;
}
function Zr(e) {
  if (e.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (e.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const t = e.max - e.min;
  return { min: -t, max: t };
}
function ea(e) {
  const t = ce(e);
  return t !== null ? Ht(t) : e;
}
function ta(e) {
  const t = ea(e);
  if (ce(t)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = jr.get(t);
  return n !== void 0 ? Zr(n) : Wr[Wi(t)];
}
function na(e, t) {
  return typeof e == "string" && e.trim() ? e : `mod-route-${t + 1}`;
}
function ia(e) {
  return e === "bipolar" ? "bipolar" : "unipolar";
}
function ra(e, t) {
  const n = ta(e), i = Number(t);
  return Be(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function aa(e) {
  return e === "mseg" || e === "env" || e === "velocity" || e === "pressure" || e === "slide" || e === "macro" ? e : null;
}
function oa(e) {
  return aa(e) ?? "mseg";
}
function sa(e) {
  const t = Vt(e);
  return t !== null ? t : ce(e) !== null ? e : null;
}
function la(e) {
  return sa(e) ?? "oscA.wavetablePosition";
}
function ca(e, t) {
  const n = Zt[t] ?? `Macro ${t + 1}`;
  return typeof e == "string" && e.trim() ? e.trim() : n;
}
function da(e, t) {
  const n = Math.round(Number(t));
  if (e === "velocity" || e === "pressure" || e === "slide")
    return null;
  const i = e === "mseg" ? ze : e === "macro" ? Xt : zr;
  return Be(Number.isFinite(n) ? n : 1, 1, i);
}
function en(e) {
  return {
    name: Vr[e] ?? `Env ${e + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function ua(e, t = 0) {
  const n = e && typeof e == "object" ? e : {}, i = en(t);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: Ie(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: Ie(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: G(n.sustain ?? i.sustain),
    releaseSeconds: Ie(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function ma(e, t = 0) {
  return { name: ua(e, t).name };
}
function fa(e, t, n, i) {
  const r = Number(e.amount);
  return {
    id: na(e.id, t),
    enabled: e.enabled !== !1,
    sourceKind: n,
    sourceSlot: da(n, e.sourceSlot),
    polarity: ia(e.polarity),
    targetKind: i,
    amount: ra(i, r),
    reducer: e.reducer === "mean" ? "mean" : "max"
  };
}
function ha(e, t = 0) {
  const i = e !== null && typeof e == "object" ? e : {}, r = oa(i.sourceKind), a = la(i.targetKind);
  return fa(i, t, r, a);
}
function pa(e) {
  return `${e.sourceKind}:${e.sourceSlot ?? 0}->${e.targetKind}`;
}
function ga(e) {
  return (Array.isArray(e) ? e : []).map((n, i) => ha(n, i));
}
function Ia(e) {
  const t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of e) {
    const r = pa(i);
    if (t.has(i.id) || n.has(r))
      return !1;
    t.add(i.id), n.add(r);
  }
  return !0;
}
function Oe(e, t) {
  if (e === null || t === null || typeof e != "object" || typeof t != "object")
    return Object.is(e, t);
  if (Array.isArray(e) || Array.isArray(t))
    return !Array.isArray(e) || !Array.isArray(t) || e.length !== t.length ? !1 : e.every((o, l) => Oe(o, t[l]));
  const n = e, i = t, r = Object.keys(n), a = Object.keys(i);
  return r.length === a.length && r.every((o) => Yr(i, o) && Oe(n[o], i[o]));
}
function tn(e, t) {
  const n = e && typeof e == "object" ? e : {}, i = qt(Br[t] ?? `MSEG ${t + 1}`), r = Xe(n.shapeA ?? i), a = tr({
    ...Me(),
    ...n.playback ?? {},
    rate: Me().rate
  }), { rate: o, ...l } = a;
  return {
    shapeA: r,
    shapeB: Xe(n.shapeB ?? r),
    playback: l
  };
}
function nn() {
  return {
    format: "cosimo.modulation",
    version: Qt,
    msegSlots: Array.from({ length: ze }, (e, t) => tn({}, t)),
    envelopeSlots: Array.from({ length: Yt }, (e, t) => ({
      name: en(t).name
    })),
    routes: [],
    macroNames: Zt.slice()
  };
}
function ba(e = nn()) {
  const t = e && typeof e == "object" ? e : {}, n = Array.isArray(t.msegSlots) ? t.msegSlots : [], i = Array.isArray(t.envelopeSlots) ? t.envelopeSlots : [], r = Array.isArray(t.macroNames) ? t.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: Qt,
    msegSlots: Array.from({ length: ze }, (a, o) => tn(n[o], o)),
    envelopeSlots: Array.from({ length: Yt }, (a, o) => ma(i[o], o)),
    routes: ga(t.routes),
    macroNames: Array.from(
      { length: Xt },
      (a, o) => ca(r[o], o)
    )
  };
}
function be(e) {
  const t = rn(e);
  if (t._tag === "err")
    throw t.error;
  return JSON.stringify(t.value);
}
function rn(e) {
  let t = e;
  if (typeof e == "string") {
    if (e.trim() === "")
      return fe(new ge("Expected a modulation document"));
    try {
      t = JSON.parse(e);
    } catch {
      return fe(new ge("Expected valid modulation JSON"));
    }
  }
  const n = ba(t);
  return !Oe(t, n) || !Ia(n.routes) ? fe(new ge("Expected the current modulation schema")) : ir(n);
}
function an(e) {
  if (!(e === null || typeof e != "object")) {
    for (const t of Object.values(e)) an(t);
    Object.freeze(e);
  }
}
const ya = {
  parse(e) {
    const t = rn(e);
    return t._tag === "err" ? { kind: "error", message: t.error.message } : (an(t.value), { kind: "ok", value: t.value });
  },
  encode: be,
  equals: (e, t) => be(e) === be(t)
};
Ei({
  playMode: de("playMode"),
  glideTime: de("glideTime"),
  globalTune: de("globalTune"),
  [Ur]: Ti({ initial: nn(), codec: ya })
});
const ee = 2048;
function q(e, t) {
  if (!e)
    throw new Error(t);
}
function va(e) {
  q(
    Array.isArray(e?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const t = e;
  return t.tables.forEach((n, i) => {
    q(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), q(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), q(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), q(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), t;
}
const Sa = 2048, oe = 11, Ta = 256;
function M(e, t) {
  if (!e)
    throw new Error(t);
}
function Ea(e) {
  return e > 0 && (e & e - 1) === 0;
}
const rt = /* @__PURE__ */ new Map();
function xa(e) {
  const t = rt.get(e);
  if (t)
    return t;
  const n = Math.round(Math.log2(e)), i = new Uint32Array(e);
  for (let r = 0; r < e; r += 1) {
    let a = 0, o = r;
    for (let l = 0; l < n; l += 1)
      a = a << 1 | o & 1, o >>= 1;
    i[r] = a;
  }
  return rt.set(e, i), i;
}
function on(e, t, n = !1) {
  const i = e.length;
  M(i === t.length, "FFT real and imaginary buffers must have the same length"), M(Ea(i), "FFT input length must be a power of two");
  const r = xa(i);
  for (let a = 0; a < i; a += 1) {
    const o = r[a];
    if (o <= a)
      continue;
    const l = e[a];
    e[a] = e[o], e[o] = l;
    const s = t[a];
    t[a] = t[o], t[o] = s;
  }
  for (let a = 2; a <= i; a <<= 1) {
    const o = a >> 1, l = (n ? 2 : -2) * Math.PI / a, s = Math.cos(l), d = Math.sin(l);
    for (let c = 0; c < i; c += a) {
      let u = 1, h = 0;
      for (let f = 0; f < o; f += 1) {
        const y = c + f, b = y + o, R = e[b], F = t[b], D = u * R - h * F, S = u * F + h * R, A = e[y], O = t[y];
        e[y] = A + D, t[y] = O + S, e[b] = A - D, t[b] = O - S;
        const P = u * s - h * d;
        h = u * d + h * s, u = P;
      }
    }
  }
  if (n)
    for (let a = 0; a < i; a += 1)
      e[a] /= i, t[a] /= i;
}
function sn(e) {
  const t = ArrayBuffer.isView(e) ? e : Float32Array.from(e);
  let n = 0;
  for (let a = 0; a < t.length; a += 1)
    n += Number(t[a]) || 0;
  const i = n / Math.max(1, t.length), r = new Float32Array(t.length);
  for (let a = 0; a < t.length; a += 1)
    r[a] = (Number(t[a]) || 0) - i;
  return r;
}
function Ra(e, {
  expectedFrameCount: t,
  samplesPerFrame: n = Sa,
  maxFramesPerTable: i = Ta
} = {}) {
  const r = Float32Array.from(e);
  M(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const a = r.length / n;
  M(a > 0, "Source wavetable files must contain at least one frame"), M(a <= i, `Source wavetable files must contain at most ${i} frames`), t !== void 0 && M(a === t, `Source wavetable frame count mismatch: expected ${t}, got ${a}`);
  const o = [];
  for (let l = 0; l < a; l += 1) {
    const s = l * n, d = s + n;
    o.push(sn(r.slice(s, d)));
  }
  return {
    frameCount: a,
    frames: o
  };
}
function at(e) {
  const t = sn(e), n = Float64Array.from(t), i = new Float64Array(n.length);
  return on(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function ln(e, t, {
  mipLevelCount: n = oe
} = {}) {
  const i = e?.real?.length ?? 0;
  M(i > 0, "Spectrum must contain real samples"), M(i === e.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), M(t >= 0 && t < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << t, i >> 1), a = new Float64Array(i), o = new Float64Array(i);
  for (let l = 1; l <= r; l += 1) {
    a[l] = e.real[l], o[l] = e.imaginary[l];
    const s = (i - l) % i;
    s !== l && (a[s] = e.real[s], o[s] = e.imaginary[s]);
  }
  return on(a, o, !0), Float32Array.from(a);
}
const Aa = [
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
], Ma = [
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
  Aa.map((e, t) => [e, 2 ** t])
);
Object.fromEntries(
  Ma.map((e, t) => [e, 2 ** t])
);
async function Da(e, t, n) {
  const i = e.sharedData;
  if (!i) throw new Error("This patch host does not support direct shared-data preparation.");
  const r = i.reserve(t.input, t.byteLength);
  try {
    n(r), await i.commit(r.id);
  } catch (a) {
    throw i.cancel(r.id), a;
  }
}
const te = 256, W = 2048, cn = 8, Oa = 12811, _e = (cn + te * Oa) * 4;
function ot(e, t, n) {
  const i = Math.fround(e * t);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(i + (i >= 0 ? 0.5 : -0.5)))
  ));
}
function _a(e, t, n) {
  if (e.byteLength !== _e || !Number.isInteger(t.frameCount) || t.frameCount < 1 || t.frameCount > te)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const i = new Int32Array(e.buffer, e.byteOffset, e.byteLength / 4);
  i.set([
    1465139788,
    1,
    t.dspSessionId,
    t.generation,
    t.tableIndex,
    t.frameCount,
    oe,
    te
  ]);
  let r = cn;
  const a = 131071, o = 8191, l = Math.fround(a / 1.5), s = Math.fround(o / 0.5);
  for (let d = 0; d < oe; ++d) {
    const c = Math.min(W, Math.max(256, (1 << d) * 32)), u = W / c;
    for (let h = 0; h < t.frameCount; ++h) {
      const f = ln(n(h), d), y = r + h * (c + 1);
      for (let b = 0; b <= c; ++b) {
        const R = (b === c ? 0 : b) * u, F = (R + W - u) % W, D = (R + u) % W, S = f[R], A = f[F], O = f[D];
        if (S === void 0 || A === void 0 || O === void 0 || !Number.isFinite(S) || !Number.isFinite(A) || !Number.isFinite(O))
          throw new Error("Wavetable preparation produced invalid samples.");
        const P = Math.fround(0.5 * Math.fround(O - A));
        i[y + b] = ot(S, l, a) & 262143 | ot(P, s, o) << 18;
      }
    }
    r += (c + 1) * te;
  }
}
const wa = "runtimeSyncRequest", La = 2147483647, ka = "runtimeState", Na = "retryDesiredTableRequest", Ca = "workerLoadFailure", Fa = "serviceLoadAbort", Pa = "wavetableLoadBegin", Ka = "wavetableMipFrame", Ua = "wavetableUploadAck", za = "wavetableMipRequest", Ba = "wavetablePrewarmRequest", Va = "wavetablePrewarmNotification", Ha = "assets/factory-bank-catalog.json", we = 3, $a = 1, qa = we * ee, Wa = 1, Ga = 2, ja = 3, Ja = 1, Qa = 2, Ya = 2e4, Q = Wa, st = Ga, lt = ja, N = Ja, ct = Qa, Xa = 48 * 1024 * 1024, ye = 3;
function dt(e, t) {
  const n = Math.round(Number(e));
  return Number.isFinite(n) && n > 0 ? n : t;
}
function I(e, t, n = null) {
  const i = typeof console?.[e] == "function" ? console[e].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${t}`, n);
      return;
    }
    i(`[wavetable-worker] ${t}`);
  }
}
function ut(e) {
  return {
    dspSessionId: e.dspSessionId,
    oscillatorIndex: e.oscillatorIndex,
    desiredIntentSerial: e.desiredIntentSerial,
    desiredTableIndex: e.desiredTableIndex,
    generationFrontier: e.generationFrontier,
    serviceState: e.serviceState,
    active: e.hasActive ? {
      tableIndex: e.activeTableIndex,
      generation: e.activeGeneration
    } : null,
    loading: e.hasLoading ? {
      tableIndex: e.loadingTableIndex,
      generation: e.loadingGeneration
    } : null,
    failure: e.hasFailure ? {
      tableIndex: e.failedTableIndex,
      generation: e.failedGeneration,
      scope: e.failureScope,
      phase: e.failurePhase,
      reason: e.failureReasonCode
    } : null
  };
}
function mt(e, t, n) {
  const i = e + t;
  return e === 0 || i === n || i % 16 === 0;
}
function ft(e, t) {
  if (!e)
    throw new Error(t);
}
function Za(e, t, n) {
  return Math.min(Math.max(e, t), n);
}
async function eo(e, t) {
  return va(await e.readJSON(t));
}
function to(e) {
  return {
    dspSessionId: Math.trunc(Number(e?.dspSessionId) || 0),
    oscillatorIndex: Math.trunc(Number(e?.oscillatorIndex) || 0),
    desiredIntentSerial: Math.trunc(Number(e?.desiredIntentSerial) || 0),
    desiredTableIndex: Math.trunc(Number(e?.desiredTableIndex) || 0),
    generationFrontier: Math.trunc(Number(e?.generationFrontier) || 0),
    serviceState: Math.trunc(Number(e?.serviceState) || 0),
    hasActive: !!e?.hasActive,
    activeTableIndex: Math.trunc(Number(e?.activeTableIndex) || 0),
    activeGeneration: Math.trunc(Number(e?.activeGeneration) || 0),
    hasLoading: !!e?.hasLoading,
    loadingTableIndex: Math.trunc(Number(e?.loadingTableIndex) || 0),
    loadingGeneration: Math.trunc(Number(e?.loadingGeneration) || 0),
    hasFailure: !!e?.hasFailure,
    failedTableIndex: Math.trunc(Number(e?.failedTableIndex) || 0),
    failedGeneration: Math.trunc(Number(e?.failedGeneration) || 0),
    failureScope: Math.trunc(Number(e?.failureScope) || 0),
    failurePhase: Math.trunc(Number(e?.failurePhase) || 0),
    failureReasonCode: Math.trunc(Number(e?.failureReasonCode) || 0)
  };
}
function no(e, t) {
  const n = Math.round(Number(e) || 0);
  return Za(n, 0, Math.max(0, t - 1));
}
function ve(e, t, n, i, r) {
  return `${e}:${t}:${n}:${i}:${r}`;
}
function io(e, t, n) {
  return [
    e.tableId,
    e.sourceWav,
    t,
    n
  ].join("|");
}
function ht(e) {
  let t = 0;
  for (const n of e.frames)
    t += n.byteLength;
  for (const n of e.spectra)
    n && (t += n.real.byteLength + n.imaginary.byteLength);
  return t;
}
function pt(e) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(e),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function Y() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function ro(e) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(e);
    return;
  }
  Promise.resolve().then(e);
}
class ao {
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
  constructor(t, n = {}) {
    this.connection = t, this.delivery = n.delivery ?? "events", this.resourceClient = Li(n.resourceClient ?? t), this.catalogPath = n.catalogPath ?? Ha, this.maxBatchesInFlight = dt(
      n.maxFramesInFlight,
      $a
    ), this.mipLevelCount = n.mipLevelCount ?? oe, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Xa) || 0)), this.serviceLoadTimeoutMs = dt(n.serviceLoadTimeoutMs, Ya), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    if (this.started)
      return this;
    if (this.delivery === "shared" && !this.connection.sharedData)
      throw new Error("Cosimo requires a host with direct shared wavetable preparation.");
    return this.started = !0, I("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(ka, this.handleRuntimeState), this.connection.addEndpointListener?.(Ua, this.handleUploadAck), this.connection.addEndpointListener?.(za, this.handleMipRequest), this.connection.addEndpointListener?.(Ba, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Va, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      wa,
      La
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await eo(this.resourceClient, this.catalogPath), I("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(t) {
    this.knownSessionId = t.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < ye; n += 1)
      this.nextLoadGenerations[n] = 1, this.latestRuntimeStates[n] = null, this.firstRuntimeStateInSession[n] = !0, this.candidateValidations[n] = null, this.autoRetryConsumedKeys[n] = null;
    this.nextLoadGenerations[t.oscillatorIndex] = Math.max(
      1,
      t.generationFrontier + 1
    ), this.serviceTable = null, this.mipJobs.clear(), this.activeUploadKey = null, this.cancelServiceLoadWatchdog();
  }
  clearMipTransferState() {
    this.cancelServiceLoadWatchdog(), this.mipJobs.clear(), this.activeUploadKey = null;
  }
  refreshCacheEntryByteCount(t) {
    this.tableCacheBytes -= t.byteCount, t.byteCount = ht(t), t.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += t.byteCount, this.evictCacheIfNeeded();
  }
  getPinnedCacheKeys() {
    const t = /* @__PURE__ */ new Set();
    return this.serviceTable?.cacheKey && t.add(this.serviceTable.cacheKey), t;
  }
  evictCacheIfNeeded() {
    if (this.cacheBudgetBytes <= 0)
      return;
    const t = this.getPinnedCacheKeys();
    for (; this.tableCacheBytes > this.cacheBudgetBytes; ) {
      let n = null, i = null;
      for (const [r, a] of this.tableCache)
        t.has(r) || (!i || a.lastUsedSerial < i.lastUsedSerial) && (n = r, i = a);
      if (!n || !i)
        return;
      this.tableCache.delete(n), this.tableCacheBytes -= i.byteCount;
    }
  }
  rememberLoadedTable(t) {
    const n = this.tableCache.get(t.cacheKey);
    if (n)
      return n.lastUsedSerial = this.cacheUseSerial++, n;
    const i = {
      ...t,
      byteCount: ht(t),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(t = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = ve(
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
          urgencyLevel: t,
          ...pt(this.serviceTable.frameCount),
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
    for (const t of this.mipJobs.values())
      if (t.dspSessionId === this.serviceTable.dspSessionId && t.generation === this.serviceTable.generation && t.tableIndex === this.serviceTable.tableIndex && !t.completed && (t.inFlightBatchBases.size > 0 || t.nextFrameIndex > 0))
        return !0;
    return !1;
  }
  armServiceLoadWatchdog() {
    if (!this.setTimeoutFn || !this.serviceLoadHasPendingTransfers() || !this.serviceTable) {
      this.cancelServiceLoadWatchdog();
      return;
    }
    const { dspSessionId: t, oscillatorIndex: n, generation: i, tableIndex: r } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== t || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== r || !this.serviceLoadHasPendingTransfers()) && (I("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: t,
        oscillatorIndex: n,
        generation: i,
        tableIndex: r,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: t,
          oscillatorIndex: n,
          generation: i,
          tableIndex: r
        },
        {
          failurePhase: lt,
          failureReasonCode: ct
        }
      ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain());
    }, this.serviceLoadTimeoutMs), this.serviceLoadWatchdogHandle?.unref?.();
  }
  resolveServiceTarget(t) {
    return t.hasLoading ? {
      kind: "loading",
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      generation: t.loadingGeneration,
      tableIndex: t.loadingTableIndex
    } : t.hasActive ? {
      kind: "active",
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      generation: t.activeGeneration,
      tableIndex: t.activeTableIndex
    } : null;
  }
  shouldStayIdleOnFailure(t) {
    return t.hasFailure && t.failedTableIndex === t.desiredTableIndex && t.desiredIntentSerial > 0;
  }
  getDesiredRetryKey(t) {
    return `${t.dspSessionId}:${t.oscillatorIndex}:${t.desiredTableIndex}`;
  }
  shouldAutomaticallyRetryTimeoutFailure(t) {
    return !t.hasFailure || t.failedTableIndex !== t.desiredTableIndex || t.failurePhase !== lt || t.failureReasonCode !== ct ? !1 : this.autoRetryConsumedKeys[t.oscillatorIndex] !== this.getDesiredRetryKey(t);
  }
  emitWorkerLoadFailure({
    dspSessionId: t,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: a = 0,
    failurePhase: o = Q,
    failureReasonCode: l = N
  }) {
    this.connection.sendEventOrValue?.(Ca, {
      dspSessionId: t,
      oscillatorIndex: n,
      tableIndex: i,
      generation: r,
      candidateAttemptSerial: a,
      failurePhase: o,
      failureReasonCode: l
    });
  }
  emitServiceLoadAbort({
    dspSessionId: t,
    oscillatorIndex: n,
    generation: i,
    tableIndex: r,
    failureReasonCode: a = N
  }) {
    this.connection.sendEventOrValue?.(Fa, {
      dspSessionId: t,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: a
    });
  }
  emitRetryDesiredTableRequest(t) {
    I("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[t] ? ut(this.latestRuntimeStates[t]) : null
    }), this.connection.sendEventOrValue?.(Na, t);
  }
  async loadTableSource(t, n) {
    const i = await this.ensureCatalogLoaded(), r = no(t, i.tables.length), a = i.tables[r];
    ft(a, `Could not resolve table ${r}`);
    const o = io(a, ee, this.mipLevelCount), l = this.tableCache.get(o);
    if (l)
      return l.lastUsedSerial = this.cacheUseSerial++, I("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: a.tableId,
        tableName: a.name,
        sourceWav: a.sourceWav,
        frameCount: l.frameCount,
        cacheBytes: this.tableCacheBytes
      }), l;
    const s = Y();
    I("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n
    });
    const d = await this.resourceClient.readAudio(a.sourceWav), c = Ra(d.samples, {
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n,
      samplesPerFrame: ee
    });
    return I("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      frameCount: c.frameCount,
      loadDurationMs: Math.round(Y() - s)
    }), this.rememberLoadedTable({
      cacheKey: o,
      tableIndex: r,
      tableMeta: a,
      frameCount: c.frameCount,
      frames: c.frames,
      spectra: new Array(c.frameCount)
    });
  }
  isMatchingServiceTable(t) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === t.dspSessionId && this.serviceTable.oscillatorIndex === t.oscillatorIndex && this.serviceTable.generation === t.generation && this.serviceTable.tableIndex === t.tableIndex);
  }
  markCommittedDesiredLoad(t, n, i) {
    if (I("info", "Committing desired wavetable load", {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      desiredIntentSerial: t.desiredIntentSerial,
      generation: n,
      tableIndex: t.desiredTableIndex,
      tableName: i.tableMeta?.name ?? null,
      frameCount: i.frameCount
    }), this.serviceTable = {
      ...i,
      mode: "loading",
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      generation: n,
      desiredIntentSerial: t.desiredIntentSerial
    }, this.candidateValidations[t.oscillatorIndex] = {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      tableIndex: t.desiredTableIndex,
      desiredIntentSerial: t.desiredIntentSerial,
      generation: n
    }, this.nextLoadGenerations[t.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.delivery === "shared") {
      this.prepareSharedTable();
      return;
    }
    this.connection.sendEventOrValue?.(Pa, {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      generation: n,
      tableIndex: t.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  async prepareSharedTable() {
    const t = this.serviceTable;
    if (!t) return;
    const n = Y();
    try {
      if (await Da(this.connection, {
        input: t.oscillatorIndex,
        byteLength: _e
      }, (i) => {
        _a(i, t, (r) => this.getSpectrumForFrame(r));
      }), this.serviceTable !== t || this.knownSessionId !== t.dspSessionId) return;
      I("info", "Submitted shared wavetable", {
        oscillatorIndex: t.oscillatorIndex,
        tableIndex: t.tableIndex,
        generation: t.generation,
        frameCount: t.frameCount,
        preparedBytes: _e,
        preparationMs: Y() - n,
        sampleUploadBytes: 0
      });
    } catch (i) {
      if (this.serviceTable !== t || this.knownSessionId !== t.dspSessionId) return;
      const r = this.candidateValidations[t.oscillatorIndex];
      r?.dspSessionId === t.dspSessionId && r.generation === t.generation && r.desiredIntentSerial === t.desiredIntentSerial && (this.candidateValidations[t.oscillatorIndex] = null), this.emitWorkerLoadFailure({
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: 0,
        tableIndex: t.tableIndex,
        candidateAttemptSerial: t.desiredIntentSerial,
        failurePhase: st,
        failureReasonCode: N
      }), this.serviceTable = null, this.clearMipTransferState(), I("error", "Shared wavetable preparation failed", { detail: X(i) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(t) {
    I("error", "Failed to prepare desired wavetable source", {
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      desiredIntentSerial: t.desiredIntentSerial,
      tableIndex: t.desiredTableIndex,
      failurePhase: Q,
      failureReasonCode: N
    }), this.emitWorkerLoadFailure({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      tableIndex: t.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: t.desiredIntentSerial,
      failurePhase: Q,
      failureReasonCode: N
    });
  }
  handleServiceTargetFailure(t, {
    failurePhase: n = Q,
    failureReasonCode: i = N
  } = {}) {
    I("error", "Service wavetable load failed", {
      kind: t.kind,
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      generation: t.generation,
      tableIndex: t.tableIndex,
      failurePhase: n,
      failureReasonCode: i
    }), this.emitWorkerLoadFailure({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      tableIndex: t.tableIndex,
      generation: t.generation,
      candidateAttemptSerial: 0,
      failurePhase: n,
      failureReasonCode: i
    }), t.kind === "loading" && this.emitServiceLoadAbort({
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      generation: t.generation,
      tableIndex: t.tableIndex,
      failureReasonCode: i
    });
  }
  async prepareServiceTarget(t, n) {
    if (this.isMatchingServiceTable(t)) {
      this.serviceTable && (this.serviceTable.mode = t.kind);
      const a = this.candidateValidations[t.oscillatorIndex];
      return a && a.dspSessionId === t.dspSessionId && a.generation === t.generation && a.tableIndex === t.tableIndex && (this.candidateValidations[t.oscillatorIndex] = null), !0;
    }
    let i = null;
    try {
      i = await this.loadTableSource(t.tableIndex);
    } catch (a) {
      return this.isCurrentRuntimeState(n) && (I("error", "Could not reload committed service wavetable source", {
        kind: t.kind,
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        detail: X(a)
      }), this.handleServiceTargetFailure(t)), !1;
    }
    if (!i || !this.isCurrentRuntimeState(n))
      return !1;
    this.serviceTable = {
      ...i,
      mode: t.kind,
      dspSessionId: t.dspSessionId,
      oscillatorIndex: t.oscillatorIndex,
      generation: t.generation,
      desiredIntentSerial: n.desiredIntentSerial
    }, this.clearMipTransferState(), t.kind === "loading" && (this.delivery === "shared" ? await this.prepareSharedTable() : (this.createFullMipJobsForServiceTable(2), this.pumpUploads()));
    const r = this.candidateValidations[t.oscillatorIndex];
    return r && r.dspSessionId === t.dspSessionId && r.generation === t.generation && r.tableIndex === t.tableIndex && (this.candidateValidations[t.oscillatorIndex] = null), !0;
  }
  async prepareDesiredLoad(t) {
    const n = t.desiredTableIndex, i = this.candidateValidations[t.oscillatorIndex];
    if (i && i.dspSessionId === t.dspSessionId && i.tableIndex === n && i.desiredIntentSerial === t.desiredIntentSerial)
      return;
    const r = Math.max(
      this.nextLoadGenerations[t.oscillatorIndex] ?? 1,
      t.generationFrontier + 1
    );
    let a = null;
    try {
      a = await this.loadTableSource(n);
    } catch (o) {
      this.isCurrentRuntimeState(t) && (I("error", "Could not prepare desired wavetable source", {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        desiredIntentSerial: t.desiredIntentSerial,
        tableIndex: n,
        detail: X(o)
      }), this.handleCandidateLoadFailure(t));
      return;
    }
    !a || !this.isCurrentRuntimeState(t) || this.markCommittedDesiredLoad(t, r, a);
  }
  async prepareDesiredCandidate(t) {
    await this.prepareDesiredLoad(t);
  }
  isCurrentRuntimeState(t) {
    return this.started && t.dspSessionId === this.knownSessionId && this.latestRuntimeStates[t.oscillatorIndex] === t;
  }
  selectPendingRuntimeStateOscillator() {
    if (this.serviceTable?.mode === "loading")
      return this.pendingRuntimeStateOscillators.has(this.serviceTable.oscillatorIndex) ? this.serviceTable.oscillatorIndex : null;
    for (let t = 0; t < ye; t += 1)
      if (this.pendingRuntimeStateOscillators.has(t))
        return t;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, ro(() => {
      this.runtimeStateDrainScheduled = !1, this.drainRuntimeStates().catch((t) => {
        console.error(t);
      });
    }));
  }
  async drainRuntimeStates() {
    if (!this.runtimeStateDrainRunning) {
      this.runtimeStateDrainRunning = !0;
      try {
        for (; this.started; ) {
          const t = this.selectPendingRuntimeStateOscillator();
          if (t === null)
            break;
          this.pendingRuntimeStateOscillators.delete(t);
          const n = this.latestRuntimeStates[t];
          if (n && (await this.reconcileRuntimeState(n), this.serviceTable?.mode === "loading"))
            break;
        }
      } finally {
        this.runtimeStateDrainRunning = !1, this.scheduleRuntimeStateDrain();
      }
    }
  }
  async reconcileRuntimeState(t) {
    if (!this.isCurrentRuntimeState(t))
      return;
    const n = t.oscillatorIndex, i = this.firstRuntimeStateInSession[n] ?? !1;
    this.firstRuntimeStateInSession[n] = !1;
    const r = this.candidateValidations[n];
    if (r && r.dspSessionId === t.dspSessionId && r.generation > t.generationFrontier)
      return;
    const a = this.resolveServiceTarget(t);
    if (a) {
      if (!await this.prepareServiceTarget(a, t) || !this.isCurrentRuntimeState(t))
        return;
      if (a.kind === "loading" && t.desiredTableIndex !== a.tableIndex && !this.shouldStayIdleOnFailure(t)) {
        I("warn", "Aborting obsolete wavetable load because the desired table changed", {
          dspSessionId: a.dspSessionId,
          oscillatorIndex: n,
          generation: a.generation,
          staleTableIndex: a.tableIndex,
          desiredTableIndex: t.desiredTableIndex,
          desiredIntentSerial: t.desiredIntentSerial
        }), this.emitServiceLoadAbort({
          dspSessionId: a.dspSessionId,
          oscillatorIndex: n,
          generation: a.generation,
          tableIndex: a.tableIndex,
          failureReasonCode: N
        }), this.serviceTable = null, this.clearMipTransferState();
        return;
      }
      a.kind === "active" && t.desiredTableIndex !== a.tableIndex && !this.shouldStayIdleOnFailure(t) && !i && await this.prepareDesiredCandidate(t);
      return;
    }
    if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(t)) {
      this.autoRetryConsumedKeys[n] = this.getDesiredRetryKey(t), this.emitRetryDesiredTableRequest(n);
      return;
    }
    t.serviceState !== 0 || this.shouldStayIdleOnFailure(t) || await this.prepareDesiredLoad(t);
  }
  handleRuntimeState(t) {
    const n = to(t ?? {});
    if (I("info", "Received runtime state", ut(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= ye)
      return;
    const i = n.dspSessionId !== this.knownSessionId;
    i && this.resetSessionState(n);
    const r = n.oscillatorIndex, a = this.latestRuntimeStates[r], o = a ? this.getDesiredRetryKey(a) : null, l = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[r] = Math.max(
      this.nextLoadGenerations[r] ?? 1,
      n.generationFrontier + 1
    ), (i || o !== l) && (this.autoRetryConsumedKeys[r] = null), this.latestRuntimeStates[r] = n, this.pendingRuntimeStateOscillators.add(r), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(t) {
    const n = t !== null && typeof t == "object" && !Array.isArray(t) ? t : null, i = Math.trunc(Number(n?.tableIndex ?? t));
    if (Number.isFinite(i))
      try {
        const r = await this.loadTableSource(i);
        for (let o = 0; o < r.frameCount; o += 1)
          r.spectra[o] || (r.spectra[o] = at(r.frames[o]));
        const a = this.tableCache.get(r.cacheKey);
        a && this.refreshCacheEntryByteCount(a), I("info", "Prewarmed wavetable source table", {
          tableIndex: r.tableIndex,
          tableId: r.tableMeta.tableId,
          tableName: r.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (r) {
        I("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: X(r)
        });
      }
  }
  getOrCreateMipJob(t) {
    const n = Math.trunc(Number(t?.dspSessionId)), i = Math.trunc(Number(t?.oscillatorIndex)), r = Math.trunc(Number(t?.generation)), a = Math.trunc(Number(t?.tableIndex)), o = Math.trunc(Number(t?.mipIndex)), l = Math.trunc(Number(t?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || r !== this.serviceTable.generation || a !== this.serviceTable.tableIndex || o < 0 || o >= this.mipLevelCount)
      return null;
    const s = ve(
      n,
      i,
      r,
      a,
      o
    );
    let d = this.mipJobs.get(s);
    return d ? (!d.completed && l > d.urgencyLevel && (d.urgencyLevel = l), d) : (d = {
      key: s,
      dspSessionId: n,
      oscillatorIndex: i,
      generation: r,
      tableIndex: a,
      mipIndex: o,
      urgencyLevel: l,
      ...pt(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(s, d), d);
  }
  handleMipRequest(t) {
    const n = this.getOrCreateMipJob(t ?? {});
    !n || n.completed || (I("info", "Received wavetable mip request", {
      dspSessionId: n.dspSessionId,
      oscillatorIndex: n.oscillatorIndex,
      generation: n.generation,
      tableIndex: n.tableIndex,
      mipIndex: n.mipIndex,
      urgencyLevel: n.urgencyLevel,
      frameCount: this.serviceTable?.frameCount ?? 0
    }), this.pumpUploads());
  }
  handleUploadAck(t) {
    const n = t ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.oscillatorIndex)), a = Math.trunc(Number(n.generation)), o = Math.trunc(Number(n.tableIndex)), l = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndexBase)), d = Math.trunc(Number(n.frameCount)), c = ve(
      i,
      r,
      a,
      o,
      l
    ), u = this.mipJobs.get(c), h = this.serviceTable?.frameCount ?? 0, f = Math.min(
      we,
      h - s
    );
    if (!(!u || u.completed || !u.inFlightBatchBases.has(s) || d <= 0 || d !== f)) {
      u.inFlightBatchBases.delete(s);
      for (let y = 0; y < d; y += 1) {
        const b = s + y;
        u.ackedFrames[b] || (u.ackedFrames[b] = 1, u.ackedFrameCount += 1);
      }
      u.ackedFrameCount === h && u.nextFrameIndex >= h && u.inFlightBatchBases.size === 0 && (u.completed = !0, this.activeUploadKey === u.key && (this.activeUploadKey = null)), mt(s, d, h) && I("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: r,
        generation: a,
        tableIndex: u.tableIndex,
        mipIndex: l,
        frameIndexBase: s,
        batchFrameCount: d,
        ackedFrameCount: u.ackedFrameCount,
        frameCount: h,
        inFlightBatches: u.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(t) {
    if (ft(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[t]) {
      this.serviceTable.spectra[t] = at(this.serviceTable.frames[t]);
      const n = this.tableCache.get(this.serviceTable.cacheKey);
      n && this.refreshCacheEntryByteCount(n);
    }
    return this.serviceTable.spectra[t];
  }
  selectNextMipJob() {
    let t = null;
    for (const n of this.mipJobs.values())
      n.completed || (t === null || n.urgencyLevel > t.urgencyLevel) && (t = n);
    return t;
  }
  completeServiceTransferIfReady() {
    if (!this.serviceTable || this.serviceTable.mode !== "loading")
      return !1;
    for (const t of this.mipJobs.values())
      if (!t.completed)
        return !1;
    return this.cancelServiceLoadWatchdog(), this.serviceTable = null, this.mipJobs.clear(), this.activeUploadKey = null, this.scheduleRuntimeStateDrain(), !0;
  }
  pumpUploads() {
    if (this.delivery === "shared" || !this.serviceTable)
      return;
    let t = this.activeUploadKey ? this.mipJobs.get(this.activeUploadKey) ?? null : null;
    if ((!t || t.completed) && (t = this.selectNextMipJob(), this.activeUploadKey = t?.key ?? null), !t) {
      this.completeServiceTransferIfReady();
      return;
    }
    for (; t.inFlightBatchBases.size < this.maxBatchesInFlight && t.nextFrameIndex < this.serviceTable.frameCount; ) {
      const n = t.nextFrameIndex, i = Math.min(
        we,
        this.serviceTable.frameCount - n
      ), r = new Float32Array(qa);
      try {
        for (let a = 0; a < i; a += 1) {
          const o = n + a, l = this.getSpectrumForFrame(o), s = ln(l, t.mipIndex);
          r.set(s, a * ee);
        }
      } catch {
        this.handleServiceTargetFailure(
          {
            kind: this.serviceTable.mode ?? "loading",
            dspSessionId: t.dspSessionId,
            oscillatorIndex: t.oscillatorIndex,
            generation: t.generation,
            tableIndex: t.tableIndex
          },
          {
            failurePhase: st,
            failureReasonCode: N
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Ka, {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        mipIndex: t.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(r)
      }), mt(n, i, this.serviceTable.frameCount) && I("info", "Sent wavetable mip batch", {
        dspSessionId: t.dspSessionId,
        oscillatorIndex: t.oscillatorIndex,
        generation: t.generation,
        tableIndex: t.tableIndex,
        mipIndex: t.mipIndex,
        frameIndexBase: n,
        batchFrameCount: i,
        frameCount: this.serviceTable.frameCount,
        inFlightBatches: t.inFlightBatchBases.size + 1
      }), t.inFlightBatchBases.add(n), t.nextFrameIndex += i, this.armServiceLoadWatchdog();
    }
    t.ackedFrameCount === this.serviceTable.frameCount && t.nextFrameIndex >= this.serviceTable.frameCount && t.inFlightBatchBases.size === 0 && (t.completed = !0, this.activeUploadKey = null, this.pumpUploads());
  }
}
function X(e) {
  if (e && typeof e == "object") {
    const t = e;
    return t.message || t.stack || String(e);
  }
  return String(e);
}
function oo(e, t = {}) {
  return new ao(e, t);
}
async function so(e, t = {}) {
  return mn(e, [
    Si,
    () => oo(e, t)
  ]);
}
export {
  so as default
};
