class yr {
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
function vr(t, e) {
  return new yr(t, e);
}
async function Sr(t, e) {
  const n = vr(t, e);
  return await n.start(), n;
}
const ee = -100, be = 35, wt = 5, Lt = [
  { deviceType: "globalFilter", laneEndpointID: "globalFilterOutputTrimDb", hostStem: "laneGlobalFilter" },
  { deviceType: "distortion", laneEndpointID: "distortionOutputTrimDb", hostStem: "laneDistortion" },
  { deviceType: "ott", laneEndpointID: "ottOutputTrimDb", hostStem: "laneOtt" },
  { deviceType: "chorus", laneEndpointID: "chorusOutputTrimDb", hostStem: "laneChorus" },
  { deviceType: "flanger", laneEndpointID: "flangerOutputTrimDb", hostStem: "laneFlanger" },
  { deviceType: "phaser", laneEndpointID: "phaserOutputTrimDb", hostStem: "lanePhaser" },
  { deviceType: "delay", laneEndpointID: "delayOutputTrimDb", hostStem: "laneDelay" },
  { deviceType: "reverb", laneEndpointID: "reverbOutputTrimDb", hostStem: "laneReverb" }
];
function Yn(t) {
  const e = Lt.find((n) => n.deviceType === t);
  if (e === void 0)
    throw new Error(`Unknown effect Output Trim device type: ${t}`);
  return e;
}
function F(t) {
  return Yn(t).laneEndpointID;
}
function Nt(t, e) {
  if (!Number.isInteger(e) || e < 1 || e > wt)
    throw new Error(`Effect Output Trim instance is out of range: ${e}`);
  return `${Yn(t).hostStem}${e}OutputTrimDb`;
}
function Zn() {
  return Lt.flatMap((t) => Array.from(
    { length: wt },
    (e, n) => Nt(t.deviceType, n + 1)
  ));
}
function br(t) {
  if (typeof t != "string")
    return null;
  for (const e of Lt)
    for (let n = 1; n <= wt; n += 1)
      if (t === Nt(e.deviceType, n))
        return {
          deviceType: e.deviceType,
          instanceNumber: n,
          laneEndpointID: e.laneEndpointID
        };
  return null;
}
function ei(t, e, n) {
  return Math.min(n, Math.max(e, t));
}
function Tr(t) {
  const e = (ei(t, ee, be) - ee) / (be - ee);
  return e * e;
}
function Er(t) {
  const e = Math.sqrt(ei(t, 0, 1));
  return ee + e * (be - ee);
}
const ti = 13, Ct = 5, ni = 8, Ar = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), Pt = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones",
    F("globalFilter")
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
    F("distortion")
  ],
  ott: [
    "ottMix",
    "ottAmount",
    "ottTimePercent",
    "ottBandDrive",
    "ottEnvelopeMatch",
    F("ott")
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
    F("chorus")
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones",
    F("flanger")
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
    F("phaser")
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
    F("delay")
  ],
  reverb: [
    "reverbSize",
    "reverbDecay",
    "reverbDamping",
    "reverbMix",
    F("reverb")
  ]
}), ii = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), Rr = Object.freeze([
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
]), xr = Object.freeze({
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
function Mr(t) {
  return Math.round(t) === 1 ? -5 : Math.round(t) === 2 ? 12 : Math.round(t) === 3 ? -12 : 7;
}
function ri(t, e) {
  const n = {};
  for (const s of Pt[t]) {
    const l = e[s];
    if (typeof l == "number" && Number.isFinite(l)) {
      n[s] = l;
      continue;
    }
    const u = xr[s];
    if (u === void 0)
      throw new Error(`Missing lane parameter value: ${t}.${s}`);
    n[s] = u;
  }
  const r = [
    ...ii.chorus,
    F("chorus")
  ], o = Object.keys(e);
  return t === "chorus" && o.length === r.length && o.every((s) => r.includes(s)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = Mr(
    Number(e.chorusRingOffsetMode)
  ) + Number(e.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function Ft(t) {
  return Pt[t];
}
function Dr(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= Ct)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * ni + Ar[t];
}
function Or(t, e) {
  const n = new Array(ti).fill(0), i = ri(t, e);
  return Pt[t].forEach((r, o) => {
    n[o] = i[r];
  }), n;
}
const C = (t, e) => ({ label: t, value: e });
function V(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const $ = Object.freeze({
  filter: V(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: V(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: V(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: V(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: V(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: V(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: V(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: V(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), I = (t, e, n, i, r, o, a, s = {}) => ({
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
function z(t, e, n) {
  return I(
    t,
    e,
    "Output Trim",
    "Trim",
    ee,
    be,
    0,
    {
      unit: "dB",
      modulationTargetIndex: n,
      modulationApplication: "linear",
      valueKind: "effect-output-trim-db"
    }
  );
}
const kr = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], _r = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], wr = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: $.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      I("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(C), quick: !0 }),
      I("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      I("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      I("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 }),
      z("filter", "globalFilterOutputTrimDb", 39)
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
      I("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [C("Classic", 0), C("Harmonics", 1)] }),
      I("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      I("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      I("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      I("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      I("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      I("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [C("Symmetric", 0), C("Asymmetric", 1), C("Wavefold", 2)] }),
      z("drive", "distortionOutputTrimDb", 40)
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
      I("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      I("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      I("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      I("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      I("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 }),
      z("ott", "ottOutputTrimDb", 41)
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
      I("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(C) }),
      I("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(C) }),
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
      z("chorus", "chorusOutputTrimDb", 42)
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
      z("flanger", "flangerOutputTrimDb", 43)
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
      I("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [C("Free", 0), C("Sync", 1)] }),
      I("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      I("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: kr.map(C) }),
      I("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      I("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      I("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      I("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      I("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 }),
      z("phaser", "phaserOutputTrimDb", 44)
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
      I("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [C("Free", 0), C("Sync", 1)] }),
      I("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      I("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: _r.map(C) }),
      I("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      I("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      I("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 }),
      z("delay", "delayOutputTrimDb", 45)
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
      I("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      I("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      I("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      I("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 }),
      z("reverb", "reverbOutputTrimDb", 46)
    ]
  }
], Xe = wr, oi = Object.freeze(
  Xe.flatMap((t) => t.parameters)
);
new Map(
  oi.map((t) => [t.endpointID, t])
);
function ai(t) {
  const e = Xe.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function si() {
  return oi;
}
function Kt(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const li = "lane.v1", Be = "laneTopology", Te = "laneSlotParams", vt = "laneSlotParamValue", ci = "laneOutputControl", St = 16, Lr = 8, ui = 4, Nr = 3, di = Ct * ni, fi = 4, Cr = 4, Pr = di, Fr = di + fi, Kr = 0, Ur = 1, Br = 2, Vr = 3, $r = 4, zr = 5;
function jr(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > ui)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << Lr;
}
const Ve = Object.freeze([
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
}), mi = new Map(
  Object.entries($e).map(([t, e]) => [e, t])
), Hr = Object.freeze({
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
  Ve.map((t) => [Hr[t], t])
);
const Wr = "voiceEnhancerFrequency", qr = "voiceEnhancerQ", Gr = "voiceEnhancerAmount", Jr = "voiceEnhancerFrequencyOctaves", Qr = "voiceEnhancerQ", Xr = "voiceEnhancerAmount", hi = "voice.enhancerFrequency", Yr = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: Wr,
    targetKind: Jr,
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
    endpointID: qr,
    targetKind: Qr,
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
    endpointID: Gr,
    targetKind: Xr,
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
function tn(t, e) {
  const n = Math.min(t.max, Math.max(t.min, e));
  return t.scale === "log" ? Math.log(n / t.min) / Math.log(t.max / t.min) : (n - t.min) / (t.max - t.min);
}
function Zr(t, e) {
  const n = Math.min(1, Math.max(0, e));
  return t.scale === "log" ? t.min * (t.max / t.min) ** n : t.min + (t.max - t.min) * n;
}
const eo = Object.freeze([
  "voice.filterCutoff",
  hi,
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
]), to = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [hi]: "enhancer-frequency",
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
  eo.map((t) => [t, Object.freeze({
    id: t,
    family: to[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const pi = 40, gi = 18e3, bt = Ve.map((t) => $e[t]), no = /^([a-zA-Z]+)#([1-9][0-9]*)$/, io = /^(parallel|split)#([1-9][0-9]*)$/;
function Re(t) {
  if (typeof t != "string")
    return null;
  const e = no.exec(t);
  if (e === null)
    return null;
  const n = bt.find((r) => r === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > Ct ? null : { deviceType: n, instanceNumber: i };
}
function Ii(t) {
  if (typeof t != "string")
    return null;
  const e = io.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? fi : Cr) ? null : { groupKind: n, unitNumber: i };
}
function te(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function de(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function A(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function ro(t, e) {
  const n = Re(t);
  if (n === null)
    return { failure: A(`device id ${t} is not a pool instance`) };
  if (!te(e) || !de(e, ["params"]) || !te(e.params))
    return { failure: A(`device ${t} must be { params }`) };
  const i = Ft(n.deviceType), r = mi.get(n.deviceType);
  if (r === void 0)
    return { failure: A(`device ${t} has no effect descriptor`) };
  const o = ai(r).parameters.map((f) => f.endpointID), a = e.params, s = Object.keys(a), l = (f) => s.length === f.length && s.every((p) => f.includes(p)), u = F(n.deviceType), c = [
    ...ii[n.deviceType],
    u
  ], m = [
    ...Rr,
    u
  ];
  if (!(s.includes(u) && (l(i) || l(o) || l(c) || n.deviceType === "chorus" && l(m))))
    return { failure: A(`device ${t} must carry every parameter once`) };
  for (const f of s) {
    const p = a[f];
    if (typeof p != "number" || !Number.isFinite(p))
      return { failure: A(`device ${t}.${f} must be a finite number`) };
  }
  return { record: { params: ri(n.deviceType, a) } };
}
function oo(t, e) {
  return !te(t) || t.kind !== "device" ? { failure: A("branches may hold device placements only") } : de(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: A(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: A(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: A("a device placement is { kind, deviceId, enabled }") };
}
function nn(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= pi && t <= gi;
}
function yi() {
  return { mix: 1, bypassed: !1 };
}
function ao(t) {
  return !te(t) || !de(t, ["mix", "bypassed"]) || typeof t.mix != "number" || !Number.isFinite(t.mix) || t.mix < 0 || t.mix > 1 || typeof t.bypassed != "boolean" ? null : { mix: t.mix, bypassed: t.bypassed };
}
function so(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (c) {
      const m = c instanceof Error ? c.message : String(c);
      return A(`is not valid JSON: ${m}`);
    }
  if (!te(e) || !de(e, ["format", "version", "output", "devices", "chain"]))
    return A("must be { format, version, output, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return A("must be cosimo.lane version 2");
  if (!te(e.devices))
    return A("devices must be an object");
  if (!Array.isArray(e.chain))
    return A("chain must be an array");
  const n = ao(e.output);
  if (n === null)
    return A("output must be { mix: 0..1, bypassed: boolean }");
  const i = {};
  for (const c of Reflect.ownKeys(e.devices)) {
    if (typeof c != "string")
      return A("device ids must be strings");
    const m = ro(c, e.devices[c]);
    if ("failure" in m)
      return m.failure;
    i[c] = m.record;
  }
  const r = new Set(Object.keys(i)), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), s = [];
  let l = 0;
  const u = (c) => {
    const m = oo(c, r);
    return "placement" in m && (o.set(
      m.placement.deviceId,
      (o.get(m.placement.deviceId) ?? 0) + 1
    ), l += 1), m;
  };
  for (const c of e.chain) {
    if (!te(c))
      return A("chain nodes must be objects");
    if (c.kind === "device") {
      const b = u(c);
      if ("failure" in b)
        return b.failure;
      s.push(b.placement);
      continue;
    }
    if (c.kind !== "parallel" && c.kind !== "split")
      return A(`unknown chain node kind ${String(c.kind)}`);
    const m = c.kind === "split", d = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], p = m ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], y = m && de(c, d);
    if (!de(c, p) && !y)
      return A(`a ${c.kind} group is { ${p.join(", ")} }`);
    const g = Ii(c.groupId);
    if (g === null || g.groupKind !== c.kind)
      return A(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (a.has(String(c.groupId)))
      return A(`group ${String(c.groupId)} is used twice`);
    if (a.add(String(c.groupId)), typeof c.enabled != "boolean")
      return A(`group ${String(c.groupId)} needs a boolean enable`);
    const v = m ? Nr : ui;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > v)
      return A(`group ${String(c.groupId)} needs 2..${v} branches`);
    if (m && (!nn(c.xoverLowHz) || !nn(c.xoverHighHz)))
      return A(`group ${String(c.groupId)} crossovers must sit in ${pi}..${gi} Hz`);
    if (m && !y && (typeof c.xoverLowKeyTrackEnabled != "boolean" || typeof c.xoverHighKeyTrackEnabled != "boolean" || typeof c.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverLowKeyTrackOffsetSemitones) || typeof c.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverHighKeyTrackOffsetSemitones)))
      return A(`group ${String(c.groupId)} Key Track state must be finite`);
    l += 1;
    const x = [];
    for (const b of c.branches) {
      if (!Array.isArray(b))
        return A(`group ${String(c.groupId)} branches must be arrays`);
      const S = [];
      for (const M of b) {
        const w = u(M);
        if ("failure" in w)
          return w.failure;
        S.push(w.placement);
      }
      x.push(S);
    }
    s.push(m ? {
      kind: "split",
      groupId: String(c.groupId),
      enabled: c.enabled,
      xoverLowHz: c.xoverLowHz,
      xoverHighHz: c.xoverHighHz,
      xoverLowKeyTrackEnabled: y ? !1 : c.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: y ? 0 : c.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: y ? !1 : c.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: y ? 0 : c.xoverHighKeyTrackOffsetSemitones,
      branches: x
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: x
    });
  }
  for (const c of r)
    if ((o.get(c) ?? 0) !== 1)
      return A(`device ${c} must be placed exactly once`);
  return l > St ? A(`flattens to ${l} wire entries; the topology upload holds ${St}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: i, chain: s } };
}
function lo() {
  const t = {};
  for (const e of Ve) {
    const n = $e[e];
    t[`${n}#1`] = {
      params: po(n)
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: yi(),
    devices: t,
    chain: Ve.map((e) => ({
      kind: "device",
      deviceId: `${$e[e]}#1`,
      enabled: !1
    }))
  };
}
const rn = ["distortion#1", "delay#1", "reverb#1"];
function vi() {
  const t = lo(), e = {};
  for (const n of rn) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The current default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: yi(),
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && rn.includes(n.deviceId))
  };
}
function Si(t) {
  if (t === void 0)
    return vi();
  const e = so(t);
  return e._tag === "ok" ? e.value : null;
}
function et(t) {
  return JSON.stringify({
    format: "cosimo.lane",
    version: 2,
    output: t.output,
    devices: t.devices,
    chain: t.chain
  });
}
function co(t) {
  return Object.keys(t.devices).map((e) => {
    const n = Re(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => bt.indexOf(e.parsed.deviceType) - bt.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function Tt(t) {
  const e = Re(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return Dr(e.deviceType, e.instanceNumber - 1);
}
function bi(t) {
  const e = Ii(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? Pr : Fr) + (e.unitNumber - 1);
}
function uo(t) {
  const e = new Array(St).fill(0);
  let n = 0, i = 0;
  const r = (o, a, s) => {
    e[i] = jr(o, a), s && (n |= 1 << i), i += 1;
  };
  for (const o of t.chain) {
    if (o.kind === "device") {
      r(Tt(o.deviceId), 0, o.enabled);
      continue;
    }
    r(bi(o), o.branches.length, o.enabled), o.branches.forEach((a, s) => {
      for (const l of a)
        r(Tt(l.deviceId), s + 1, l.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function fo(t) {
  const e = new Array(ti).fill(0);
  return e[Kr] = t.xoverLowHz, e[Ur] = t.xoverHighHz, e[Br] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[Vr] = t.xoverLowKeyTrackOffsetSemitones, e[$r] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[zr] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function Ti(t) {
  const e = [{
    endpointID: ci,
    value: t.output
  }];
  let n = 0;
  for (const i of co(t)) {
    const r = Re(i.instanceId);
    if (r === null)
      throw new Error(`Invalid lane device identity during replay: ${i.instanceId}`);
    e.push({
      endpointID: Nt(
        r.deviceType,
        r.instanceNumber
      ),
      value: t.devices[i.instanceId].params[F(r.deviceType)]
    }), n += 1, e.push({
      endpointID: Te,
      value: {
        slotId: Tt(i.instanceId),
        deliverySerial: n,
        values: Or(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  }
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: Te,
      value: {
        slotId: bi(i),
        deliverySerial: n,
        values: fo(i)
      }
    }));
  return e.push({
    endpointID: Be,
    value: uo(t)
  }), e;
}
function mo(t, e, n, i) {
  const r = t.devices[e], o = Re(e);
  if (r === void 0 || o === null || !Ft(o.deviceType).includes(n) || !Number.isFinite(i))
    return null;
  const a = { ...r.params, [n]: i };
  return o.deviceType === "delay" && n === "delayTimeMode" && i >= 0.5 && (a.delayTimeKeyTrackEnabled = 0), {
    ...t,
    devices: {
      ...t.devices,
      [e]: { params: a }
    }
  };
}
function ho(t, e) {
  let n = t;
  for (const [i, r] of Object.entries(e)) {
    const o = br(i);
    if (o === null || typeof r != "number" || !Number.isFinite(r))
      continue;
    const a = `${o.deviceType}#${o.instanceNumber}`;
    if (n.devices[a] === void 0)
      continue;
    const s = Math.min(
      be,
      Math.max(ee, r)
    );
    Object.is(n.devices[a]?.params[o.laneEndpointID], s) || (n = mo(
      n,
      a,
      o.laneEndpointID,
      s
    ) ?? n);
  }
  return n;
}
function po(t) {
  const e = mi.get(t);
  if (e === void 0)
    throw new Error(`Unknown lane device type: ${t}`);
  const n = ai(e).parameters;
  return Object.fromEntries(Ft(t).map((i) => [
    i,
    n.find((r) => r.endpointID === i)?.initial ?? 0
  ]));
}
const Et = "runtimeState";
function Ei(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const go = {
  endpointID: Et,
  required: !0,
  mapValue: Ei
}, Io = 2e3;
function on(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function an(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function yo(t, e) {
  if (!an(t))
    return { found: !1 };
  const n = an(t.values) ? t.values : void 0;
  return n && on(n, e) ? {
    found: !0,
    value: n[e]
  } : on(t, e) ? {
    found: !0,
    value: t[e]
  } : { found: !1 };
}
function sn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class vo {
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
    this.connection = e, this.options = n, this.stateKeys = [.../* @__PURE__ */ new Set([n.stateKey, ...n.fallbackStateKeys ?? []])], this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = So(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
            const r = yo(n, this.stateKeys[i]);
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
    }, r = sn(n), o = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, a = this.options.buildRuntimeEvents(i, o), s = sn({
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
        this.options.sendTimeoutMilliseconds ?? Io
      );
    this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function So(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function bo(t, e) {
  return new vo(t, e);
}
function To(t) {
  return bo(t, {
    stateKey: li,
    runtimeEndpointDependencies: [go],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Si,
    buildRuntimeEvents: ({ state: e }) => [...Ti(e)]
  });
}
function K(t, e) {
  if (!t)
    throw new Error(e);
}
function tt(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function Eo(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function At(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Ai(t) {
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
function Ao() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function nt(t, e) {
  const n = Ao();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Eo(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function ln(t) {
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
  throw new Error(`Unsupported text resource payload (${Ai(t)})`);
}
function Ro(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return At(t);
  throw new Error(`Unsupported binary resource payload (${Ai(t)})`);
}
function xo(t) {
  const e = t?.frames;
  K(
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
      K(a.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(a[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function Ri(t) {
  const e = new DataView(t);
  K(tt(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), K(tt(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, o = null, a = null, s = null, l = null, u = 12;
  for (; u + 8 <= e.byteLength; ) {
    const m = tt(e, u, 4), d = e.getUint32(u + 4, !0), f = u + 8;
    m === "fmt " ? (n = e.getUint16(f, !0), i = e.getUint16(f + 2, !0), r = e.getUint32(f + 4, !0), a = e.getUint16(f + 12, !0), o = e.getUint16(f + 14, !0)) : m === "data" && (s = f, l = d), u = f + d + d % 2;
  }
  K(n !== null, "Wave file is missing a fmt chunk"), K(s !== null && l !== null, "Wave file is missing a data chunk"), K(i === 1, "Only mono wavetable bank files are supported");
  let c;
  if (n === 3 && o === 32)
    c = new Float32Array(t.slice(s, s + l));
  else if (n === 1 && o === 16) {
    const m = l / 2, d = new Int16Array(t.slice(s, s + l));
    c = new Float32Array(m);
    for (let f = 0; f < m; f += 1)
      c[f] = d[f] / 32768;
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
async function cn(t) {
  K(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return K(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function Rt(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function xi(t) {
  const e = new Uint8Array(t).buffer, n = Ri(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Mo(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (l) => (K(typeof t.readResource == "function", `Resource bridge cannot read ${l}`), t.readResource(l)), r = async (l) => {
    K(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${l}`);
    const u = await t.readResourceAsAudioData(l);
    return xo(u);
  }, o = (l) => {
    const u = t.getResourceAddress?.(l);
    return u ?? null;
  }, a = async (l, u = t.getResourceAddress?.(l)) => {
    const c = nt(l, u), m = await cn(c), d = Ri(m);
    return {
      sampleRate: d.sampleRate,
      samples: d.samples
    };
  }, s = async (l, u = t.getResourceAddress?.(l)) => {
    const c = nt(l, u);
    return new Uint8Array(await cn(c));
  };
  return {
    async readText(l) {
      if (e === "bridge" && typeof t.readResource == "function")
        return ln(await i(l));
      const u = o(l);
      return e === "url" && u !== null ? Rt(await s(l, u)) : typeof t.readResource == "function" ? ln(await i(l)) : Rt(await s(l, u));
    },
    async readJSON(l) {
      return JSON.parse(await this.readText(l));
    },
    async readBytes(l) {
      return typeof t.readResource == "function" ? Ro(await i(l)) : s(l);
    },
    async readAudio(l) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(l);
      const u = o(l);
      return n === "url" && u !== null ? a(l, u) : typeof t.readResourceAsAudioData == "function" ? r(l) : xi(await this.readBytes(l));
    },
    getURL(l) {
      return nt(l, t.getResourceAddress?.(l));
    }
  };
}
function Do(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Mo(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Oo(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, o = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(a) {
      if (e)
        return e(a);
      if (n)
        return JSON.stringify(await n(a));
      if (i)
        return Rt(await i(a));
      throw new Error(`Resource client cannot read text ${a}`);
    },
    async readJSON(a) {
      return n ? n(a) : JSON.parse(await this.readText(a));
    },
    async readBytes(a) {
      if (i)
        return i(a);
      if (e)
        return At(await e(a));
      if (n)
        return At(JSON.stringify(await n(a)));
      throw new Error(`Resource client cannot read bytes ${a}`);
    },
    async readAudio(a) {
      return r ? r(a) : xi(await this.readBytes(a));
    },
    getURL(a) {
      return o ? o(a) : null;
    }
  };
}
function ko(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function _o(t) {
  return ko(t) ? Oo(t) : Do(t);
}
const wo = new Set("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern external false float float32 float64 for friend goto graph if import inline input int int32 int64 let long loop mutable namespace new node noexcept not not_eq nullptr operator or or_eq output parameter private processor protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast string struct switch template this thread_local throw true try typedef typeid typename union unsigned using value virtual void volatile wchar_t while xor xor_eq".split(" "));
function Lo(t) {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(t) && !t.includes("__") && !wo.has(t);
}
function h(t, e = {}) {
  return Object.freeze({ kind: "parameter", endpoint: t, ...e });
}
function Mi(t) {
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
function un(t) {
  const e = Mi({ codec: t.codec, initial: t.initial, lifetime: t.lifetime, history: t.history }), n = Object.freeze([...t.dependencies ?? []]);
  if ("kind" in t.engine && t.engine.kind === "shared-data") {
    const o = t.engine, a = t.prepare, s = t.prepare, l = o.length;
    return Object.freeze({ ...e, engine: Object.freeze({
      kind: "shared-prepared",
      dependencies: n,
      storage: Object.freeze({ type: o.type, fixedLength: l ?? null }),
      prepare: l === void 0 ? s : (u, c) => ({
        length: l,
        write: (m) => a(u, m, c)
      })
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
const No = /* @__PURE__ */ Symbol.for("builder-kit.plugin-state.options");
function Co(t) {
  return Object.keys(t).filter((e) => t[e]?.kind === "stored" && t[e].engine?.kind === "shared-prepared").sort().map((e, n) => ({ key: e, input: n }));
}
function Po(t, e = {}) {
  if (e.historyLimit !== void 0 && (!Number.isSafeInteger(e.historyLimit) || e.historyLimit < 0))
    throw new Error("historyLimit must be a non-negative integer.");
  const n = Co(t);
  if (n.length && (!Number.isSafeInteger(e.memoryBudgetBytes) || (e.memoryBudgetBytes ?? 0) < 4))
    throw new Error("Shared state requires an explicit positive memoryBudgetBytes.");
  if (n.some(({ key: i }) => !Lo(i) || i === "Data"))
    throw new Error("Shared state names must be valid Cmajor identifiers.");
  return Object.freeze(Object.defineProperty({ ...t }, No, { value: Object.freeze({ ...e }) }));
}
const X = 2048, Ee = X + 3, dn = 20, Di = "MSEG 1", Fo = 0, Y = 2;
function Ae(t) {
  return t !== null && typeof t == "object" ? t : {};
}
function Ut(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function me(t, e, n = 1e-12) {
  return Math.abs(t - e) <= n;
}
function Ko(t) {
  return Ut(Number.isFinite(t) ? t : 0, -dn, dn);
}
function ne(t) {
  return Ut(Number.isFinite(t) ? t : 0, 0, 1);
}
function Oi(t = Di) {
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
function ki() {
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
function Uo(t) {
  const e = Number(t);
  return Ut(
    Number.isFinite(e) ? e : 1,
    Fo,
    Y
  );
}
function Bo(t) {
  if (!t || typeof t != "object")
    return null;
  const e = Ae(t), n = ne(Number(e.startX)), i = ne(Number(e.endX));
  return me(n, i) ? null : i < n ? {
    startX: i,
    endX: n
  } : { startX: n, endX: i };
}
function Vo(t = ki()) {
  const e = Ae(t), n = Ae(e.rate), i = Number(n.seconds), r = e.noteOffPolicy, o = r === "finish_loop" || r === "immediate" || r === "ignore" ? r : "finish_loop";
  return {
    format: "mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: Uo(Number.isFinite(i) ? i : 1)
    },
    loop: Bo(e.loop),
    noteOffPolicy: o,
    legatoRestarts: !!e.legatoRestarts,
    holdFinalValue: e.holdFinalValue !== !1
  };
}
function $o(t, e, n) {
  const i = Ae(t);
  let r = Number(i.x);
  return Number.isFinite(r) || (r = e === 0 ? 0 : e === n - 1 ? 1 : 0), e !== 0 && e !== n - 1 && (r = ne(r)), {
    x: r,
    y: ne(Number(i.y)),
    curvePower: Ko(Number(i.curvePower))
  };
}
function Ye(t = Oi()) {
  const e = Ae(t), n = Array.isArray(e.points) ? e.points : [];
  if (n.length < 2)
    throw new Error("MSEG shapes require at least two points");
  const i = n.map((r, o) => $o(r, o, n.length));
  if (!me(i[0].x, 0) || !me(i[i.length - 1].x, 1))
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  for (let r = 1; r < i.length; r += 1)
    if (i[r].x < i[r - 1].x)
      throw new Error("MSEG shape points must stay in non-decreasing x order");
  return {
    format: "mseg.shape",
    version: 1,
    name: typeof e.name == "string" && e.name.trim() ? e.name : Di,
    globalSmooth: !!e.globalSmooth,
    points: i
  };
}
function fn(t) {
  return JSON.stringify(Ye(t));
}
function zo(t, e) {
  if (Math.abs(e) < 0.01)
    return t;
  const n = Math.exp(e * t) - 1, i = Math.exp(e) - 1;
  return n / i;
}
function jo(t, e) {
  if (e <= t[0].x)
    return { from: t[0], to: t[0], laterPointWins: !1 };
  for (let n = 0; n < t.length - 1; n += 1) {
    const i = t[n], r = t[n + 1];
    if (e < r.x)
      return { from: i, to: r, laterPointWins: !1 };
    if (me(e, r.x)) {
      let o = n + 1;
      for (; o + 1 < t.length && me(t[o + 1].x, e); )
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
function Ho(t, e) {
  const n = ne(Number(e)), i = jo(t, n);
  if (i.laterPointWins || me(i.from.x, i.to.x))
    return i.to.y;
  const r = i.to.x - i.from.x, o = r <= 0 ? 1 : (n - i.from.x) / r, a = ne(zo(o, i.from.curvePower));
  return i.from.y + (i.to.y - i.from.y) * a;
}
function Wo(t, e) {
  return Ho(Ye(t).points, e);
}
function qo(t) {
  const e = new Float32Array(Ee);
  return _i(t, e), e;
}
function _i(t, e) {
  if (e.length !== Ee) throw new Error("Invalid MSEG destination length.");
  const n = Ye(t);
  for (let i = 0; i < X; i += 1) {
    const r = i / (X - 1);
    e[i + 1] = Wo(n, r);
  }
  e[0] = e[1], e[X + 1] = e[X], e[X + 2] = e[X];
}
function mn(t, e) {
  return fn(t) === fn(e);
}
const E = ["A", "B", "C"], Bt = [
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
], Go = [
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
], ie = Object.freeze([
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
]), Jo = Object.freeze([
  ...E.flatMap((t) => Bt.map(
    (e) => `osc${t}.${e}`
  )),
  ...Go
]);
new Set(
  E.flatMap((t) => Bt.map(
    (e) => `osc${t}.${e}`
  ))
);
const wi = Object.freeze(
  Jo.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), Qo = si().filter(
  (t) => t.modulationTargetIndex !== null
), Xo = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function Vt(t) {
  const e = Yo(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function Yo(t) {
  const e = Xo.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const Zo = [
  ...Qo.map((t) => ({
    kind: Vt(Kt(t)),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })),
  { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
  { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
], Li = Object.freeze(
  Zo.sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), W = Object.freeze([
  ...wi,
  ...Li
]), Pe = ie.length, Ni = wi.length, Ze = Li.length, ea = Pe * W.length, ta = new Map(ie.map((t) => [t.id, t])), Ci = new Map(ie.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), he = new Map(W.map((t) => [t.kind, t]));
function na() {
  if (Pe !== 14 || Ni !== 59 || Ze !== 47 || ea !== 1484)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = ie.filter((i) => i.group === t).sort((i, r) => i.runtimeIndex - r.runtimeIndex);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 59], ["rack", 47]]) {
    const n = W.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (ta.size !== Pe || Ci.size !== Pe || he.size !== W.length)
    throw new Error("Modulation identities must be unique");
}
na();
function Pi(t, e) {
  const n = Ci.get(`${t}:${e ?? 0}`);
  if (n === void 0)
    throw new Error(`Unknown modulation source: ${t}:${e ?? 0}`);
  return n;
}
function $t(t) {
  return typeof t != "string" ? null : he.has(t) ? t : null;
}
function ia(t) {
  const e = $t(t);
  return e !== null && he.get(e)?.group === "voice" ? e : null;
}
function zt(t) {
  const e = $t(t);
  return e !== null && he.get(e)?.group === "rack" ? e : null;
}
function Fi(t) {
  const e = he.get(t);
  if (e?.group !== "voice") throw new Error(`Unknown voice modulation target: ${t}`);
  return e.runtimeIndex;
}
function Ki(t) {
  const e = he.get(t);
  if (e?.group !== "rack") throw new Error(`Unknown rack modulation target: ${t}`);
  return e.runtimeIndex;
}
function ra(t) {
  const e = t.indexOf(".");
  return e >= 0 ? t.slice(e + 1) : t;
}
const Ui = 4, oa = Ui * Ze, aa = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive", "globalFilterOutputTrimDb"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionOutputTrimDb"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch", "ottOutputTrimDb"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones", "chorusOutputTrimDb"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs", "flangerOutputTrimDb"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix", "phaserOutputTrimDb"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayOutputTrimDb"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix", "reverbOutputTrimDb"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), sa = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function re(t) {
  if (typeof t != "string")
    return null;
  const e = sa.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = aa.get(n);
  if (i === void 0)
    return null;
  const r = e[3];
  return i.includes(r) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: r
  } : null;
}
function jt(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function Bi(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
function Vi(t) {
  if (t === null)
    return null;
  const e = Bi(t) - 1;
  return e > Ui ? null : e * Ze + Ki(jt(t));
}
function la(...t) {
  return { ...Oi(...t), format: "cosimo.mseg.shape" };
}
function hn(...t) {
  return { ...Ye(...t), format: "cosimo.mseg.shape" };
}
function pn(...t) {
  return { ...ki(...t), format: "cosimo.mseg.playback" };
}
function ca(...t) {
  return { ...Vo(...t), format: "cosimo.mseg.playback" };
}
const it = "modulationProgram", ua = "modulationAmount", $i = ie.filter((t) => t.group === "voice").length, zi = ie.filter((t) => t.group === "macro").length, ze = Ni, da = Ze, je = da + oa, Z = $i * ze, ae = zi * ze, fa = $i * je, ma = zi * je, Q = 512, oe = 256, ji = Z + ae;
function ha(t) {
  const e = Pi(t.sourceKind, t.sourceSlot);
  if (e.group !== "voice")
    throw new Error("Macro is not a per-voice modulation source");
  return e.runtimeIndex;
}
function pa(t) {
  const e = ia(t);
  return e === null ? null : Fi(e);
}
function Hi(t) {
  const e = pa(t.targetKind), n = zt(t.targetKind);
  let i = n === null ? void 0 : Ki(n);
  if (i === void 0) {
    const a = Vi(
      re(t.targetKind)
    );
    a !== null && (i = a);
  }
  if (e === null && i === void 0)
    throw new Error(`Unknown modulation target: ${t.targetKind}`);
  if (t.sourceKind === "macro") {
    const a = Pi(t.sourceKind, t.sourceSlot);
    if (a.group !== "macro")
      throw new Error(`Invalid macro modulation source: ${t.sourceKind}:${String(t.sourceSlot)}`);
    const s = a.runtimeIndex;
    if (e !== null) {
      const u = s * ze + e;
      return {
        path: "macroVoice",
        cellIndex: u,
        sourceIndex: s,
        targetIndex: e,
        articulationCellIndex: Z + u
      };
    }
    const l = i ?? 0;
    return {
      path: "macroRack",
      cellIndex: s * je + l,
      sourceIndex: s,
      targetIndex: l,
      articulationCellIndex: null
    };
  }
  const r = ha(t);
  if (e !== null) {
    const a = r * ze + e;
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
    cellIndex: r * je + o,
    sourceIndex: r,
    targetIndex: o,
    articulationCellIndex: null
  };
}
function Wi(t) {
  return re(t.targetKind) !== null ? null : Hi(t).articulationCellIndex;
}
function ga(t) {
  if (zt(t.targetKind) !== null)
    return !1;
  const e = re(t.targetKind);
  return e !== null && Vi(e) === null;
}
function Ia(t) {
  return {
    ...Hi(t),
    enabled: t.enabled,
    polarity: t.polarity === "bipolar" ? 1 : 0,
    reducer: t.reducer === "mean" ? 2 : 1,
    amount: t.amount
  };
}
function qi(t) {
  const e = {
    voice: /* @__PURE__ */ new Map(),
    macroVoice: /* @__PURE__ */ new Map(),
    voiceRack: /* @__PURE__ */ new Map(),
    macroRack: /* @__PURE__ */ new Map()
  };
  for (const n of t) {
    if (ga(n))
      continue;
    const i = Ia(n), r = e[i.path];
    if (r.has(i.cellIndex))
      throw new Error(`Duplicate modulation route cell ${i.path}:${i.cellIndex}`);
    r.set(i.cellIndex, i);
  }
  return e;
}
function ya(t) {
  return t.enabled ? t.path === "voiceRack" || t.path === "macroRack" ? t.amount !== 0 : !0 : !1;
}
function se(t) {
  return [...t.values()].filter(ya).sort((e, n) => e.cellIndex - n.cellIndex);
}
function Oe(t, e, n, i, r) {
  for (let o = 0; o < t.length; o += 1) {
    const a = t[o];
    if (a === void 0)
      throw new Error(`Missing compiled modulation route at index ${o}`);
    e[o] = a.cellIndex, n[o] = a.sourceIndex, i[o] = a.targetIndex, r[o] = a.polarity;
  }
}
function rt(t) {
  const e = qi(t), n = se(e.voice), i = se(e.macroVoice), r = se(e.voiceRack), o = se(e.macroRack), a = Array.from({ length: Z }, () => 0), s = Array.from({ length: Z }, () => 0), l = Array.from({ length: Z }, () => 0), u = Array.from({ length: Z }, () => 0), c = Array.from({ length: Z }, () => 0);
  Oe(n, a, s, l, u);
  const m = Array.from({ length: ae }, () => 0), d = Array.from({ length: ae }, () => 0), f = Array.from({ length: ae }, () => 0), p = Array.from({ length: ae }, () => 0), y = Array.from({ length: ae }, () => 0);
  if (Oe(
    i,
    m,
    d,
    f,
    p
  ), r.length > Q || o.length > oe)
    throw new Error(
      `Modulation program exceeds the rack route capacity: ${r.length} voice-rack (max ${Q}), ${o.length} macro-rack (max ${oe})`
    );
  const g = Array.from({ length: Q }, () => 0), v = Array.from({ length: Q }, () => 0), x = Array.from({ length: Q }, () => 0), b = Array.from({ length: Q }, () => 0), S = Array.from({ length: Q }, () => 0), M = Array.from({ length: fa }, () => 0);
  Oe(
    r,
    g,
    v,
    x,
    b
  );
  const w = Array.from({ length: oe }, () => 0), q = Array.from({ length: oe }, () => 0), G = Array.from({ length: oe }, () => 0), J = Array.from({ length: oe }, () => 0), ge = Array.from({ length: ma }, () => 0);
  Oe(
    o,
    w,
    q,
    G,
    J
  );
  for (const L of e.voice.values()) c[L.cellIndex] = L.amount;
  for (const L of e.macroVoice.values()) y[L.cellIndex] = L.amount;
  for (const L of e.voiceRack.values()) M[L.cellIndex] = L.amount;
  for (const L of e.macroRack.values()) ge[L.cellIndex] = L.amount;
  for (let L = 0; L < r.length; L += 1) {
    const en = r[L];
    if (en === void 0) throw new Error(`Missing compiled voice-rack route at index ${L}`);
    S[L] = en.reducer;
  }
  return {
    voiceRouteCount: n.length,
    voiceRouteCells: a,
    voiceRouteSources: s,
    voiceRouteTargets: l,
    voiceRoutePolarities: u,
    voiceRouteAmounts: c,
    macroVoiceRouteCount: i.length,
    macroVoiceRouteCells: m,
    macroVoiceRouteSources: d,
    macroVoiceRouteTargets: f,
    macroVoiceRoutePolarities: p,
    macroVoiceRouteAmounts: y,
    voiceRackRouteCount: r.length,
    voiceRackRouteCells: g,
    voiceRackRouteSources: v,
    voiceRackRouteTargets: x,
    voiceRackRoutePolarities: b,
    voiceRackRouteReducers: S,
    voiceRackRouteAmounts: M,
    macroRackRouteCount: o.length,
    macroRackRouteCells: w,
    macroRackRouteSources: q,
    macroRackRouteTargets: G,
    macroRackRoutePolarities: J,
    macroRackRouteAmounts: ge
  };
}
const va = ["voice", "macroVoice", "voiceRack", "macroRack"], Sa = {
  voice: 1,
  macroVoice: 2,
  voiceRack: 3,
  macroRack: 4
};
function gn(t) {
  return qi(t);
}
function ba(t, e) {
  return t.cellIndex === e.cellIndex && t.sourceIndex === e.sourceIndex && t.targetIndex === e.targetIndex && t.polarity === e.polarity && t.reducer === e.reducer;
}
function Ta(t, e) {
  if (t === null)
    return [{ endpointID: it, value: rt(e) }];
  const n = gn(t), i = gn(e), r = [];
  for (const o of va) {
    const a = se(n[o]), s = se(i[o]);
    if (a.length !== s.length)
      return [{ endpointID: it, value: rt(e) }];
    for (let l = 0; l < s.length; l += 1) {
      const u = a[l], c = s[l];
      if (u === void 0 || c === void 0 || !ba(u, c))
        return [{ endpointID: it, value: rt(e) }];
      u.amount !== c.amount && r.push({
        endpointID: ua,
        value: {
          pathKind: Sa[o],
          cellIndex: c.cellIndex,
          amount: c.amount
        }
      });
    }
  }
  return r;
}
function pe(t) {
  return { _tag: "ok", value: t };
}
function Se(t) {
  return { _tag: "err", error: t };
}
function Ea(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Aa(t) {
  throw new Error(t ?? "Invariant violated");
}
const Ra = "globalTune", xa = "globalTuneSemitones", j = -24, Ie = 24, In = 0, Gi = -48, Ji = 48, xt = -48, Qi = 6, Ht = 0, yn = (Ht - xt) / (Qi - xt);
function ke(t, e, n, i, r = "percent", o = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: o };
}
const Ma = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      ke("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      ke("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      ke("mix", "Mix", 100, 100),
      ke("drive", "Drive", 15, 0)
    ]
  }
], vn = 1e-6;
function U(t, e) {
  if (!Number.isFinite(t) || t < -vn || t > 1 + vn)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function He(t, e) {
  return U(t / 100, `${e} catalog percentage`);
}
function xe(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Da(t) {
  return 20 * 1e3 ** t;
}
function Oa(t) {
  return U(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function ka(t) {
  return 0.1 * 200 ** t;
}
function _a(t) {
  return U(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function wa(t) {
  return t;
}
function La(t) {
  return U(t, "filterMix endpoint conversion");
}
function fe(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function Na(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: fe("filterCutoff", Da, Oa),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: fe("filterQ", ka, _a),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: fe("filterMix", wa, La),
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
function Xi(t) {
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
      return Ea(t);
  }
}
function Ca(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Pa(t, e) {
  const n = xe(t.moduleId, e.id), i = Xi(e.format), r = Na(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: He(e.defaultPercent, n),
    initialValue: He(e.initialPercent, n),
    format: i,
    modAmount: Ca(i),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const Fa = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: yn * 100, defaultPercent: yn * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Ka(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ua(t, e) {
  const n = `osc${t}`, i = xe(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: He(e.defaultPercent, i),
    initialValue: He(e.initialPercent, i),
    format: Xi(e.format),
    modAmount: Ka(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Ba = Object.freeze(
  E.flatMap((t) => Fa.map((e) => Ua(t, e)))
), Va = Object.freeze({
  targetId: xe("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: U(
    (In - j) / (Ie - j),
    "Global Tune default"
  ),
  initialValue: U(
    (In - j) / (Ie - j),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: Ie },
  modAmount: {
    min: Gi,
    max: Ji,
    unit: "st",
    digits: 2
  },
  binding: fe(
    Ra,
    (t) => j + (Ie - j) * t,
    (t) => U(
      (t - j) / (Ie - j),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: xa
});
function $a(t) {
  const e = xe("voice-enhancer", t.key), n = U(
    tn(t, t.initial),
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
    binding: fe(
      t.endpointID,
      (i) => Zr(t, i),
      (i) => U(
        tn(t, i),
        `${t.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: t.targetKind
  });
}
const za = Object.freeze(
  Object.values(Yr).map($a)
), ja = Object.freeze([
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
function Ha(t) {
  const e = xe(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (o) => t.min + n * o, r = (o) => U(
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
    binding: fe(t.endpointID, i, r),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const Wa = Object.freeze(
  ja.map(Ha)
), qa = Object.freeze([
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
function Ga(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function ot(t, e) {
  const n = t.valueKind === "effect-output-trim-db" ? Tr(e) : t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return U(n, `${t.endpointID} endpoint conversion`);
}
function Ja(t, e) {
  return t.valueKind === "effect-output-trim-db" ? Er(e) : t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Qa(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Xa(t) {
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
function Ya(t) {
  const e = Ga(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: ot(t, t.initial),
    initialValue: ot(t, t.initial),
    format: Qa(t),
    modAmount: Xa(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Ja(t, n),
      fromEngine: (n) => ot(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : Vt(Kt(t))
  });
}
const Wt = Object.freeze(
  [
    ...Xe.flatMap((t) => t.parameters.map(Ya)),
    ...qa,
    Va,
    ...za,
    ...Ba,
    ...Wa,
    ...Ma.flatMap(
      (t) => t.parameters.map(
        (e) => Pa(t, e)
      )
    )
  ]
), Za = new Map(
  Wt.map((t) => [t.targetId, t])
), Yi = Wt.filter(
  (t) => t.modulationTargetKind !== null
), Mt = new Map(
  Yi.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Za.size !== Wt.length)
  throw new Error("Target descriptor IDs must be unique");
if (Yi.length !== W.length || Mt.size !== W.length || W.some((t) => Mt.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function at(t) {
  const e = Mt.get(t);
  return e === void 0 ? Aa(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  Xe.map((t) => [t.id, t.label])
);
function es(t) {
  const e = Bi(t);
  return e === 1 ? "" : ` ${e}`;
}
function ts(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = at(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = re(t);
  if (n !== null) {
    const i = at(jt(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : i.moduleId.toUpperCase()}${es(n)} ${i.label.toUpperCase()}`;
  }
  return at(t).label.toUpperCase();
}
const le = "modulation.v6", Zi = 6, Me = 3, ce = 3, ns = 4, Sn = "modulationMsegBuffer", is = "modulationMsegPlayback", er = 4, rs = ["MSEG 1", "MSEG 2", "MSEG 3"], tr = ["Macro 1", "Macro 2", "Macro 3", "Macro 4"], os = ["Env 1", "Env 2", "Env 3"], as = 1e-3, R = 10, ss = 0.1, ls = 20, bn = 10 - 0.1, cs = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: ls - ss },
  filterMix: { min: -1, max: 1 },
  pitchSemitones: { min: -48, max: 48 },
  globalTuneSemitones: {
    min: Gi,
    max: Ji
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
  mseg1Rate: { min: -Y, max: Y },
  mseg2Rate: { min: -Y, max: Y },
  mseg3Rate: { min: -Y, max: Y },
  env1Attack: { min: -R, max: R },
  env1Decay: { min: -R, max: R },
  env1Sustain: { min: -1, max: 1 },
  env1Release: { min: -R, max: R },
  env2Attack: { min: -R, max: R },
  env2Decay: { min: -R, max: R },
  env2Sustain: { min: -1, max: 1 },
  env2Release: { min: -R, max: R },
  env3Attack: { min: -R, max: R },
  env3Decay: { min: -R, max: R },
  env3Sustain: { min: -1, max: 1 },
  env3Release: { min: -R, max: R },
  ampAttack: { min: -R, max: R },
  ampDecay: { min: -R, max: R },
  ampSustain: { min: -1, max: 1 },
  ampRelease: { min: -R, max: R },
  voiceEnhancerFrequencyOctaves: { min: -6, max: 6 },
  voiceEnhancerQ: { min: -bn, max: bn },
  voiceEnhancerAmount: { min: -1, max: 1 }
}, us = si().filter((t) => t.modulationTargetIndex !== null), ds = new Map(
  us.map((t) => [
    Vt(Kt(t)),
    t
  ])
);
class st extends Error {
  name = "ModulationStateParseError";
}
const fs = {
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
ie.map((t) => ({
  value: t.id,
  label: fs[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const ms = W.map((t) => ({
  value: t.kind,
  label: ts(t.kind)
}));
ms.filter((t) => !ps(t.value));
function hs(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function qt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function lt(t, e) {
  const n = Number(t);
  return qt(Number.isFinite(n) ? n : e, as, R);
}
function ps(t) {
  return zt(t) !== null;
}
function gs(t) {
  if (t.modulationApplication === "octaves")
    return { min: -6, max: 6 };
  if (t.modulationApplication === "semitones")
    return { min: -60, max: 60 };
  const e = t.max - t.min;
  return { min: -e, max: e };
}
function Is(t) {
  const e = re(t);
  return e !== null ? jt(e) : t;
}
function ys(t) {
  const e = Is(t);
  if (re(e)?.deviceType === "frequencySplit")
    return { min: -4, max: 4 };
  const n = ds.get(e);
  return n !== void 0 ? gs(n) : cs[ra(e)];
}
function vs(t, e) {
  return typeof t == "string" && t.trim() ? t : `mod-route-${e + 1}`;
}
function Ss(t) {
  return t === "bipolar" ? "bipolar" : "unipolar";
}
function bs(t, e) {
  const n = ys(t), i = Number(e);
  return qt(Number.isFinite(i) ? i : 0, n.min, n.max);
}
function Ts(t) {
  return t === "mseg" || t === "env" || t === "velocity" || t === "pressure" || t === "slide" || t === "macro" ? t : null;
}
function Es(t) {
  return Ts(t) ?? "mseg";
}
function As(t) {
  const e = $t(t);
  return e !== null ? e : re(t) !== null ? t : null;
}
function Rs(t) {
  return As(t) ?? "oscA.wavetablePosition";
}
function xs(t, e) {
  const n = tr[e] ?? `Macro ${e + 1}`;
  return typeof t == "string" && t.trim() ? t.trim() : n;
}
function Ms(t, e) {
  const n = Math.round(Number(e));
  if (t === "velocity" || t === "pressure" || t === "slide")
    return null;
  const i = t === "mseg" ? Me : t === "macro" ? er : ns;
  return qt(Number.isFinite(n) ? n : 1, 1, i);
}
function ue(t) {
  return {
    name: os[t] ?? `Env ${t + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function nr(t, e = 0) {
  const n = t && typeof t == "object" ? t : {}, i = ue(e);
  return {
    name: typeof n.name == "string" && n.name.trim() ? n.name : i.name,
    attackSeconds: lt(n.attackSeconds ?? i.attackSeconds, i.attackSeconds),
    decaySeconds: lt(n.decaySeconds ?? i.decaySeconds, i.decaySeconds),
    sustain: ne(n.sustain ?? i.sustain),
    releaseSeconds: lt(n.releaseSeconds ?? i.releaseSeconds, i.releaseSeconds)
  };
}
function Ds(t, e = 0) {
  return { name: nr(t, e).name };
}
function Os(t, e, n, i) {
  const r = Number(t.amount);
  return {
    id: vs(t.id, e),
    enabled: t.enabled !== !1,
    sourceKind: n,
    sourceSlot: Ms(n, t.sourceSlot),
    polarity: Ss(t.polarity),
    targetKind: i,
    amount: bs(i, r),
    reducer: t.reducer === "mean" ? "mean" : "max"
  };
}
function ks(t, e = 0) {
  const i = t !== null && typeof t == "object" ? t : {}, r = Es(i.sourceKind), o = Rs(i.targetKind);
  return Os(i, e, r, o);
}
function _s(t) {
  return `${t.sourceKind}:${t.sourceSlot ?? 0}->${t.targetKind}`;
}
function ws(t) {
  return (Array.isArray(t) ? t : []).map((n, i) => ks(n, i));
}
function Ls(t) {
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const r = _s(i);
    if (e.has(i.id) || n.has(r))
      return !1;
    e.add(i.id), n.add(r);
  }
  return !0;
}
function Dt(t, e) {
  if (t === null || e === null || typeof t != "object" || typeof e != "object")
    return Object.is(t, e);
  if (Array.isArray(t) || Array.isArray(e))
    return !Array.isArray(t) || !Array.isArray(e) || t.length !== e.length ? !1 : t.every((a, s) => Dt(a, e[s]));
  const n = t, i = e, r = Object.keys(n), o = Object.keys(i);
  return r.length === o.length && r.every((a) => hs(i, a) && Dt(n[a], i[a]));
}
function ir(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = la(rs[e] ?? `MSEG ${e + 1}`), r = hn(n.shapeA ?? i), o = ca({
    ...pn(),
    ...n.playback ?? {},
    rate: pn().rate
  }), { rate: a, ...s } = o;
  return {
    shapeA: r,
    shapeB: hn(n.shapeB ?? r),
    playback: s
  };
}
function We() {
  return {
    format: "cosimo.modulation",
    version: Zi,
    msegSlots: Array.from({ length: Me }, (t, e) => ir({}, e)),
    envelopeSlots: Array.from({ length: ce }, (t, e) => ({
      name: ue(e).name
    })),
    routes: [],
    macroNames: tr.slice()
  };
}
function Ns(t = We()) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.msegSlots) ? e.msegSlots : [], i = Array.isArray(e.envelopeSlots) ? e.envelopeSlots : [], r = Array.isArray(e.macroNames) ? e.macroNames : [];
  return {
    format: "cosimo.modulation",
    version: Zi,
    msegSlots: Array.from({ length: Me }, (o, a) => ir(n[a], a)),
    envelopeSlots: Array.from({ length: ce }, (o, a) => Ds(i[a], a)),
    routes: ws(e.routes),
    macroNames: Array.from(
      { length: er },
      (o, a) => xs(r[a], a)
    )
  };
}
function ct(t) {
  const e = qe(t);
  if (e._tag === "err")
    throw e.error;
  return JSON.stringify(e.value);
}
function qe(t) {
  let e = t;
  if (typeof t == "string") {
    if (t.trim() === "")
      return Se(new st("Expected a modulation document"));
    try {
      e = JSON.parse(t);
    } catch {
      return Se(new st("Expected valid modulation JSON"));
    }
  }
  const n = Ns(e);
  return !Dt(e, n) || !Ls(n.routes) ? Se(new st("Expected the current modulation schema")) : pe(n);
}
function Cs(t, e) {
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
function Tn(t, e, n) {
  return {
    slot: t + 1,
    shapeIndex: e,
    buffer: Array.from(qo(n))
  };
}
function Ps(t, e) {
  return t.holdFinalValue === e.holdFinalValue && t.noteOffPolicy === e.noteOffPolicy && t.legatoRestarts === e.legatoRestarts && JSON.stringify(t.loop) === JSON.stringify(e.loop);
}
function En(t, e = null, n) {
  const i = [];
  for (let r = 0; r < Me; r += 1) {
    const o = t.msegSlots[r], a = e?.msegSlots[r];
    (a === void 0 || !mn(a.shapeA, o.shapeA)) && i.push(n ? n(r, 0, o.shapeA) : {
      endpointID: Sn,
      value: Tn(r, 0, o.shapeA)
    }), (a === void 0 || !mn(a.shapeB, o.shapeB)) && i.push(n ? n(r, 1, o.shapeB) : {
      endpointID: Sn,
      value: Tn(r, 1, o.shapeB)
    }), (a === void 0 || !Ps(a.playback, o.playback)) && i.push({
      endpointID: is,
      value: Cs(r, o.playback)
    });
  }
  return i.push(...Ta(e?.routes ?? null, t.routes)), i;
}
function rr(t) {
  if (!(t === null || typeof t != "object")) {
    for (const e of Object.values(t)) rr(e);
    Object.freeze(t);
  }
}
const Fs = {
  parse(t) {
    const e = qe(t);
    return e._tag === "err" ? { kind: "error", message: e.error.message } : (rr(e.value), { kind: "ok", value: e.value });
  },
  encode: ct,
  equals: (t, e) => ct(t) === ct(e)
}, Ks = [
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
], Us = [
  { id: "A", oscillatorIndex: 0 },
  { id: "B", oscillatorIndex: 1 },
  { id: "C", oscillatorIndex: 2 }
];
function Bs(t) {
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
function Vs(t, e, n) {
  const i = n.articulationParameterID === null ? null : `osc${t}.${n.articulationParameterID}`;
  return Object.freeze({
    controlID: n.controlID,
    // SAFETY: both interpolated pieces come from closed unions above, so
    // their concatenation is exactly one OscillatorControlEndpointID.
    endpointID: `osc${t}${n.endpointSuffix}`,
    oscillatorIndex: e,
    articulationParameterID: i
  });
}
function $s(t, e, n) {
  const i = `osc${t}.${n}`;
  return Object.freeze({
    parameterKind: n,
    targetKind: i,
    // SAFETY: the oscillator and target suffix are both closed canonical
    // unions, so the interpolated ID belongs to the UI target domain.
    uiTargetID: `osc${t}.${Bs(n)}`,
    runtimeTargetIndex: Fi(i),
    oscillatorIndex: e
  });
}
function zs(t, e) {
  const n = Object.freeze(Ks.map(
    (o) => Vs(t, e, o)
  )), i = Object.freeze(Bt.map(
    (o) => $s(t, e, o)
  )), r = Object.freeze(n.flatMap(
    (o) => o.articulationParameterID === null ? [] : [o.articulationParameterID]
  ));
  return Object.freeze({
    id: t,
    oscillatorIndex: e,
    tableStatus: Object.freeze({ endpointID: "runtimeState", oscillatorIndex: e }),
    controls: n,
    modulationTargets: i,
    articulationParameterIDs: r
  });
}
const Fe = Object.freeze(
  Us.map(({ id: t, oscillatorIndex: e }) => zs(t, e))
);
function js() {
  if (Fe.length !== E.length || Fe.some((e, n) => e.id !== E[n] || e.oscillatorIndex !== n))
    throw new Error("Oscillator binding contracts must match frozen A/B/C runtime order");
  const t = Fe.flatMap(
    (e) => e.controls.map((n) => n.endpointID)
  );
  if (new Set(t).size !== t.length)
    throw new Error("Oscillator control endpoint IDs must be unique");
}
js();
const ut = "articulationSnapshot", D = 128, An = 48, Hs = 1e6, _ = -1, dt = [
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
function Gt(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
function ft(t) {
  return Gt(Number.isFinite(t) ? t : 0, 0, 1);
}
function N(t, e, n = -Number.MAX_VALUE, i = Number.MAX_VALUE) {
  const r = Number(t);
  return Gt(Number.isFinite(r) ? r : e, n, i);
}
function k(t, e, n, i) {
  return Gt(Math.round(N(t, e)), n, i);
}
function or(t) {
  return t === "key" || t === "vel" || t === "chain" ? t : "chain";
}
function mt() {
  return Array.from({ length: D }, () => _);
}
function Ws(t) {
  const e = k(t, 0, 0, D - 1), n = dt[e % dt.length], i = Math.floor(e / dt.length);
  return i === 0 ? n : `${n} ${i + 1}`;
}
function qs() {
  return {
    wavetablePosition: 0,
    pan: 0,
    octave: 0,
    semitone: 0,
    fineCents: 0,
    volumeDb: Ht,
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
function Gs(t) {
  const e = qs(), n = t && typeof t == "object" ? t : {}, i = Array.isArray(n.msegMorphs) ? n.msegMorphs : [];
  return {
    wavetablePosition: N(n.wavetablePosition, e.wavetablePosition, 0, 1),
    pan: N(n.pan, e.pan, -1, 1),
    octave: k(n.octave, e.octave, -4, 4),
    semitone: k(n.semitone, e.semitone, -12, 12),
    fineCents: N(n.fineCents, e.fineCents, -100, 100),
    volumeDb: N(
      n.volumeDb,
      e.volumeDb,
      xt,
      Qi
    ),
    mute: k(n.mute, e.mute, 0, 1),
    solo: k(n.solo, e.solo, 0, 1),
    warpMode: k(n.warpMode, e.warpMode, 0, 4),
    warpAmount: N(n.warpAmount, e.warpAmount, 0, 1),
    filterMode: k(n.filterMode, e.filterMode, 0, 5),
    filterCutoff: N(n.filterCutoff, e.filterCutoff, 20, 2e4),
    filterKeyTrackOffsetSemitones: N(
      n.filterKeyTrackOffsetSemitones,
      e.filterKeyTrackOffsetSemitones,
      -60,
      60
    ),
    filterQ: N(n.filterQ, e.filterQ, 0.1, 20),
    unisonVoices: k(n.unisonVoices, e.unisonVoices, 1, 8),
    unisonDetune: N(n.unisonDetune, e.unisonDetune, 0, 1),
    unisonBlend: N(n.unisonBlend, e.unisonBlend, 0, 1),
    unisonWidth: N(n.unisonWidth, e.unisonWidth, 0, 1),
    unisonPhase: N(n.unisonPhase, e.unisonPhase, 0, 1),
    unisonRandom: N(n.unisonRandom, e.unisonRandom, 0, 1),
    unisonPhaseMode: k(n.unisonPhaseMode, e.unisonPhaseMode, 0, 1),
    unisonDetuneMode: k(n.unisonDetuneMode, e.unisonDetuneMode, 0, 4),
    unisonStackMode: k(n.unisonStackMode, e.unisonStackMode, 0, 4),
    unisonWavetablePositionSpread: N(
      n.unisonWavetablePositionSpread,
      e.unisonWavetablePositionSpread,
      0,
      1
    ),
    unisonWarpSpread: N(n.unisonWarpSpread, e.unisonWarpSpread, 0, 1),
    msegMorphs: [
      ft(Number(i[0])),
      ft(Number(i[1])),
      ft(Number(i[2]))
    ]
  };
}
function Js(t) {
  if (!t || typeof t != "object")
    return null;
  const e = t, n = typeof e.routeId == "string" ? e.routeId.trim() : "";
  return n ? {
    routeId: n,
    amount: N(e.amount, 0, -48, 48)
  } : null;
}
function Qs(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.modRouteAmounts) ? e.modRouteAmounts.map(Js).filter((r) => r !== null) : [], i = /* @__PURE__ */ new Map();
  for (const r of n)
    i.set(r.routeId, r);
  return {
    format: "cosimo.articulation.snapshot",
    version: 1,
    parameters: Gs(e.parameters),
    envelopes: [0, 1, 2].map((r) => nr(
      Array.isArray(e.envelopes) ? e.envelopes[r] : void 0,
      r
    )),
    modRouteAmounts: [...i.values()]
  };
}
function Xs(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = k(n.runtimeSlot, e, 0, D - 1), r = typeof n.id == "string" && n.id.trim() ? n.id.trim() : `articulation-${i}`, o = typeof n.name == "string" && n.name.trim() ? n.name.trim() : Ws(i);
  return {
    id: r,
    runtimeSlot: i,
    name: o,
    snapshot: Qs(n.snapshot)
  };
}
function Ys(t, e) {
  if (!t || typeof t != "object")
    return null;
  const n = t, i = typeof n.articulationId == "string" ? n.articulationId.trim() : "";
  return e.has(i) ? {
    note: k(n.note, 0, 0, D - 1),
    articulationId: i
  } : null;
}
function Zs(t, e, n, i, r) {
  if (!t || typeof t != "object")
    return null;
  const o = t, a = typeof o.articulationId == "string" ? o.articulationId.trim() : "";
  if (!e.has(a))
    return null;
  let s = k(o.min, r, r, D - 1), l = k(o.max, s, r, D - 1);
  return l < s && ([s, l] = [l, s]), {
    id: typeof o.id == "string" && o.id.trim() ? o.id.trim() : `${i}-${n}`,
    articulationId: a,
    min: s,
    max: l
  };
}
function Rn(t, e, n, i) {
  const r = Array.isArray(t) ? t : [], o = /* @__PURE__ */ new Set(), a = [];
  for (let s = 0; s < r.length; s += 1) {
    const l = Zs(
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
function el(t, e) {
  const n = Array.isArray(t) ? t : [], i = /* @__PURE__ */ new Set(), r = [];
  for (const o of n) {
    const a = Ys(o, e);
    !a || i.has(a.note) || (i.add(a.note), r.push(a));
  }
  return r;
}
function tl(t) {
  const e = t && typeof t == "object" ? t : {}, n = Array.isArray(e.slots) ? e.slots : [], i = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), o = [];
  for (let l = 0; l < n.length && o.length < D; l += 1) {
    const u = Xs(n[l], l);
    !u || i.has(u.runtimeSlot) || r.has(u.id) || (i.add(u.runtimeSlot), r.add(u.id), o.push(u));
  }
  const a = typeof e.selectedSlotId == "string" && o.some((l) => l.id === e.selectedSlotId) ? e.selectedSlotId : null, s = new Set(o.map((l) => l.id));
  return {
    selectedSlotId: a,
    activeTriggerMode: or(e.activeTriggerMode),
    slots: o,
    chainAssignments: Rn(e.chainAssignments, s, "chain", 0),
    keyAssignments: el(e.keyAssignments, s),
    velocityAssignments: Rn(e.velocityAssignments, s, "velocity", 1)
  };
}
function xn(t) {
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
    volumeDbs: e(Ht),
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
    msegMorphs: Array.from({ length: Me }, () => 0),
    routeAmounts: Array.from({ length: ji }, () => 0),
    envelopeAttackSeconds: Array.from({ length: ce }, (n, i) => ue(i).attackSeconds),
    envelopeDecaySeconds: Array.from({ length: ce }, (n, i) => ue(i).decaySeconds),
    envelopeSustain: Array.from({ length: ce }, (n, i) => ue(i).sustain),
    envelopeReleaseSeconds: Array.from({ length: ce }, (n, i) => ue(i).releaseSeconds)
  };
}
function Mn(t, e, n) {
  for (const i of e) {
    const r = n.get(i.articulationId);
    if (r !== void 0)
      for (let o = i.min; o <= i.max; o += 1)
        t[o] === _ && (t[o] = r);
  }
}
function nl(t) {
  const e = tl(t), n = new Map(e.slots.map((a) => [a.id, a.runtimeSlot])), i = mt(), r = mt(), o = mt();
  Mn(i, e.chainAssignments, n), Mn(o, e.velocityAssignments, n);
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
function ar(t) {
  const e = t && typeof t == "object" && t.format === "cosimo.articulation.triggerConfig" ? t : nl(t);
  return JSON.stringify({
    format: "cosimo.articulation.triggerConfig",
    version: 1,
    activeMode: or(e.activeMode),
    chain: Array.from({ length: D }, (n, i) => k(e.chain?.[i], _, _, D - 1)),
    key: Array.from({ length: D }, (n, i) => k(e.key?.[i], _, _, D - 1)),
    velocity: Array.from({ length: D }, (n, i) => i === 0 ? _ : k(e.velocity?.[i], _, _, D - 1))
  });
}
function il(t, e) {
  const n = ar(t);
  e?.sendNativeArticulationTriggerConfig?.(n);
  const i = globalThis;
  typeof i.cosimo_set_articulation_trigger_config == "function" && i.cosimo_set_articulation_trigger_config(n);
}
const P = "articulations.v4", Jt = [
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
], Qt = [
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
], sr = [
  ...E.flatMap((t) => Jt.map(
    (e) => `osc${t}.${e}`
  )),
  ...Qt
];
class lr extends Error {
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
function T(t) {
  return Se(new lr("malformed", t));
}
function De(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Xt(t, e, n) {
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
function Ge(t) {
  return typeof t == "number" && Number.isInteger(t) && t >= 0 && t < D;
}
function rl(t) {
  return t === "chain" || t === "key" || t === "vel";
}
function ol(t) {
  return sr.some((e) => e === t);
}
function Dn(t, e) {
  if (!De(t))
    return T(`${e} must be an object`);
  const n = Xt(t, ["min", "max"], e);
  return n !== null ? T(n) : Ge(t.min) ? Ge(t.max) ? t.min > t.max ? T(`${e}.min must be less than or equal to ${e}.max`) : pe({ min: t.min, max: t.max }) : T(`${e}.max must be an integer in 0..127`) : T(`${e}.min must be an integer in 0..127`);
}
function al(t, e) {
  if (!De(t))
    return T(`${e} must be an object`);
  const n = {};
  for (const i of Reflect.ownKeys(t)) {
    if (typeof i != "string")
      return T(`${e} has a non-string parameter id`);
    if (!ol(i))
      return T(`${e} has unknown parameter id "${i}"`);
    const r = t[i];
    if (typeof r != "number" || !Number.isFinite(r))
      return T(`${e}.${i} must be a finite number`);
    n[i] = r;
  }
  return pe(n);
}
function cr(t, e, n) {
  Object.defineProperty(t, e, {
    configurable: !0,
    enumerable: !0,
    value: n,
    writable: !0
  });
}
function ur() {
  return {};
}
function sl(t, e, n) {
  if (!De(t))
    return T(`${e} must be an object`);
  const i = ur();
  for (const r of Reflect.ownKeys(t)) {
    if (typeof r != "string")
      return T(`${e} has a non-string route id`);
    const o = t[r];
    if (typeof o != "number" || !Number.isFinite(o) || Math.abs(o) > An)
      return T(
        `${e}.${r} must be a finite route amount within ±${An}`
      );
    if (!n.has(r))
      return T(`${e}.${r} does not name a current articulable mapping`);
    cr(i, r, o);
  }
  return pe(i);
}
function ll(t, e, n) {
  const i = `slots[${e}]`;
  if (!De(t))
    return T(`${i} must be an object`);
  const r = Xt(
    t,
    ["id", "runtimeSlot", "name", "color", "key", "velRange", "chainRange", "overrides", "routeAmounts"],
    i
  );
  if (r !== null)
    return T(r);
  if (typeof t.id != "string")
    return T(`${i}.id must be a string`);
  if (!Ge(t.runtimeSlot))
    return T(`${i}.runtimeSlot must be an integer in 0..127`);
  if (typeof t.name != "string")
    return T(`${i}.name must be a string`);
  if (typeof t.color != "string")
    return T(`${i}.color must be a string`);
  if (!Ge(t.key))
    return T(`${i}.key must be an integer in 0..127`);
  const o = Dn(t.velRange, `${i}.velRange`);
  if (o._tag === "err")
    return o;
  const a = Dn(t.chainRange, `${i}.chainRange`);
  if (a._tag === "err")
    return a;
  const s = al(t.overrides, `${i}.overrides`);
  if (s._tag === "err")
    return s;
  const l = sl(
    t.routeAmounts,
    `${i}.routeAmounts`,
    n
  );
  return l._tag === "err" ? l : pe({
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
function cl(t) {
  const e = {};
  for (const n of sr) {
    if (!Object.hasOwn(t, n))
      continue;
    const i = t[n];
    i !== void 0 && (e[n] = i);
  }
  return e;
}
function ul(t) {
  const e = ur();
  for (const [n, i] of Object.entries(t))
    cr(e, n, i);
  return e;
}
const dl = Object.fromEntries(
  Jt.map((t, e) => [t, 2 ** e])
), fl = Object.fromEntries(
  Qt.map((t, e) => [t, 2 ** e])
);
function On(t, e) {
  return Object.hasOwn(t.overrides, e) ? t.overrides[e] ?? 0 : 0;
}
function ml(t, e) {
  return Jt.reduce((n, i) => Object.hasOwn(t.overrides, `osc${e}.${i}`) ? n | dl[i] : n, 0);
}
function hl(t) {
  return Qt.reduce((e, n) => Object.hasOwn(t.overrides, n) ? e | fl[n] : e, 0);
}
function pl(t, e) {
  const n = (o, a) => On(t, `osc${o}.${a}`), i = (o) => On(t, o), r = Array.from(
    { length: ji },
    () => Hs
  );
  for (const [o, a] of Object.entries(t.routeAmounts)) {
    const s = e[o];
    s !== void 0 && (r[s] = a);
  }
  return {
    selectorA: t.runtimeSlot,
    enabled: !0,
    oscillatorOverrideMasks: E.map((o) => ml(t, o)),
    sharedOverrideMask: hl(t),
    framePositions: E.map((o) => n(o, "framePosition")),
    pans: E.map((o) => n(o, "pan")),
    octaves: E.map((o) => n(o, "octave")),
    semitones: E.map((o) => n(o, "semitone")),
    fineCents: E.map((o) => n(o, "fineCents")),
    phases: E.map((o) => n(o, "phase")),
    phaseRandoms: E.map((o) => n(o, "phaseRandom")),
    retriggers: E.map((o) => n(o, "retrigger")),
    volumeDbs: E.map((o) => n(o, "volumeDb")),
    mutes: E.map((o) => n(o, "mute")),
    solos: E.map((o) => n(o, "solo")),
    warpModes: E.map((o) => n(o, "warpMode")),
    warpAmounts: E.map((o) => n(o, "warpAmount")),
    filterMode: i("filterMode"),
    filterCutoffHz: i("filterCutoffHz"),
    filterKeyTrackOffsetSemitones: i("filterKeyTrackOffsetSemitones"),
    filterQ: i("filterQ"),
    unisonVoices: E.map((o) => n(o, "unisonVoices")),
    unisonDetunes: E.map((o) => n(o, "unisonDetune")),
    unisonBlends: E.map((o) => n(o, "unisonBlend")),
    unisonWidths: E.map((o) => n(o, "unisonWidth")),
    unisonDetuneModes: E.map((o) => n(o, "unisonDetuneMode")),
    unisonStackModes: E.map((o) => n(o, "unisonStackMode")),
    unisonWavetablePositionSpreads: E.map((o) => n(o, "unisonWavetablePositionSpread")),
    unisonWarpSpreads: E.map((o) => n(o, "unisonWarpSpread")),
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
function gl(t, e) {
  return t.slots.map((n) => pl(n, e));
}
function dr(t, e) {
  if (!De(t))
    return T("payload must be an object");
  if (t.format !== "cosimo.articulations")
    return T('format must be exactly "cosimo.articulations"');
  if (t.version !== 4)
    return Se(new lr(
      "unsupported-version",
      "version must be exactly 4; earlier articulation formats are deliberately unsupported"
    ));
  const n = Xt(
    t,
    ["format", "version", "selectedSlotId", "activeTriggerMode", "slots"],
    "payload"
  );
  if (n !== null)
    return T(n);
  if (t.selectedSlotId !== null && typeof t.selectedSlotId != "string")
    return T("selectedSlotId must be null or a string");
  if (!rl(t.activeTriggerMode))
    return T('activeTriggerMode must be "chain", "key", or "vel"');
  if (!Array.isArray(t.slots))
    return T("slots must be an array");
  if (t.slots.length > D)
    return T(`slots must contain at most ${D} entries`);
  const i = [], r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (let a = 0; a < t.slots.length; a += 1) {
    const s = ll(t.slots[a], a, e);
    if (s._tag === "err")
      return s;
    const l = s.value;
    if (r.has(l.id))
      return T(`slots[${a}].id duplicates "${l.id}"`);
    if (o.has(l.runtimeSlot))
      return T(`slots[${a}].runtimeSlot duplicates ${l.runtimeSlot}`);
    r.add(l.id), o.add(l.runtimeSlot), i.push(l);
  }
  return t.selectedSlotId !== null && !r.has(t.selectedSlotId) ? T(`selectedSlotId "${t.selectedSlotId}" does not identify an existing slot`) : pe({
    format: t.format,
    version: t.version,
    selectedSlotId: t.selectedSlotId,
    activeTriggerMode: t.activeTriggerMode,
    slots: i
  });
}
function ht(t) {
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
      overrides: cl(e.overrides),
      routeAmounts: ul(e.routeAmounts)
    }))
  };
}
function Yt() {
  return {
    format: "cosimo.articulations",
    version: 4,
    selectedSlotId: null,
    activeTriggerMode: "chain",
    slots: []
  };
}
function Il(t) {
  const e = Array.from({ length: D }, () => _), n = Array.from({ length: D }, () => _), i = Array.from({ length: D }, () => _);
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
const vl = 3, Sl = (4 + Ee) * 4, kn = "runtimeInstallAck", fr = "runtimeSyncRequest", Ot = 0, bl = 8e3, Je = /* @__PURE__ */ new WeakMap(), mr = 1e9;
let _e = (Date.now() & 1073741823 ^ Math.floor(Math.random() * 1073741823)) % mr;
function Tl(t) {
  return _e = _e % mr + 1, t === "modulation" ? -1e9 - _e : 1e9 + _e;
}
function El(t, e) {
  const n = t, i = Je.get(n) ?? /* @__PURE__ */ new Set();
  if (i.has(e))
    throw new Error(`A ${e} runtime install lane is already active for this connection.`);
  i.add(e), Je.set(n, i);
}
function _n(t, e) {
  const n = t, i = Je.get(n);
  i?.delete(e), i?.size === 0 && Je.delete(n);
}
const Al = [100, 250, 500, 1e3], we = { _tag: "accepted" }, Rl = { _tag: "superseded" }, xl = { _tag: "stopped" }, wn = { _tag: "transport-timeout" };
function Ml(t) {
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
  ].every((m) => typeof m == "number" && Number.isSafeInteger(m) && m >= -2147483648 && m <= 2147483647) || typeof r != "number" || typeof o != "number" || typeof a != "number" || typeof s != "number" || typeof l != "number" || typeof u != "number" || r < 0 || o < 0 || a > 0 || l < 0 ? null : {
    dspSessionId: r,
    acceptedModulationSerial: o,
    acceptedArticulationSerial: a,
    rejectedSerial: s,
    rejectionReason: l,
    syncSerial: u
  };
}
function Dl(t, e, n) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error("Runtime install commands require an object payload.");
  return {
    ...t,
    dspSessionId: e,
    deliverySerial: n
  };
}
class Ln {
  #o;
  #t;
  #m;
  #b;
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
    this.#m = i && i.length > 0 ? i : [...Al], this.#b = Math.max(
      1,
      Math.trunc(n.healthTimeoutMilliseconds ?? bl)
    );
  }
  start() {
    if (!this.#i) {
      El(this.#o, this.#t);
      try {
        this.#f += 1, this.#i = !0, this.#a = null, this.#l.clear(), this.#o.addEndpointListener?.(kn, this.#T);
      } catch (e) {
        throw this.#i = !1, _n(this.#o, this.#t), e;
      }
    }
  }
  stop() {
    if (this.#i) {
      this.#i = !1;
      for (const e of this.#u) e();
      this.#o.removeEndpointListener?.(kn, this.#T), _n(this.#o, this.#t), this.#r.clear(), this.#a = null, this.#l.clear(), this.#S();
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
      return o ?? we;
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
      return we;
    const i = Tl(this.#t);
    this.#l.add(i);
    const r = Date.now() + this.#b;
    let o = 0;
    try {
      for (; ; ) {
        const a = this.#c(e, n);
        if (a)
          return a;
        if (this.#a === e)
          return we;
        const s = r - Date.now();
        if (s <= 0)
          return wn;
        const l = this.#s;
        this.#y(i), await this.#v(
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
    this.#u.add(s);
    const u = async () => {
      this.#c(n, i) || ("submit" in e ? await e.submit({ dspSessionId: n, deliverySerial: r, signal: l }) : this.#D(e.endpointID, Dl(e.value, n, r)));
    };
    try {
      let c = 0, m = 0, d = this.#d;
      for (await u(); ; ) {
        const f = this.#c(n, i);
        if (f)
          return f;
        const p = this.#g(n, r, d);
        if (p !== null)
          return p;
        const y = this.#s;
        await this.#v(
          y,
          this.#I(c)
        );
        const g = this.#g(
          n,
          r,
          d
        );
        if (g !== null)
          return g;
        let v = this.#s;
        for (this.#y(r); ; ) {
          const x = this.#c(n, i);
          if (x)
            return x;
          const b = await this.#v(
            v,
            this.#I(c)
          ), S = this.#g(
            n,
            r,
            d
          );
          if (S !== null)
            return S;
          if (b && this.#e?.dspSessionId === n && this.#e.syncSerial === r) {
            if (m >= 1)
              return wn;
            d = this.#d, await u(), m += 1, c += 1;
            break;
          }
          if (b) {
            v = this.#s;
            continue;
          }
          b || (c += 1, v = this.#s, this.#y(r));
        }
      }
    } catch (c) {
      const m = this.#c(n, i);
      if (m) return m;
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
    }) : this.#R(r, n) ? (this.#r.delete(n), we) : null;
  }
  #c(e, n) {
    return !this.#i || this.#f !== n ? xl : this.#n !== e ? Rl : null;
  }
  #I(e) {
    return this.#m[Math.min(
      e,
      this.#m.length - 1
    )];
  }
  #D(e, n) {
    try {
      this.#o.sendEventOrValue?.(
        e,
        n,
        void 0,
        Ot
      );
    } catch {
    }
  }
  #y(e) {
    if (this.#i)
      try {
        this.#o.sendEventOrValue?.(
          fr,
          e,
          void 0,
          Ot
        );
      } catch {
      }
  }
  #O(e) {
    const n = Ml(e);
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
  #v(e, n) {
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
const Ol = 1e3, kl = [le, P];
function Nn(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function pt(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  if (Nn(i, e)) return i[e];
  if (Nn(n, e)) return n[e];
}
function gt(t, e) {
  if (t === void 0) return Yt();
  let n = t;
  if (typeof n == "string")
    try {
      n = JSON.parse(n);
    } catch {
      return null;
    }
  const i = dr(n, e);
  return i._tag === "ok" ? i.value : null;
}
function Cn(t) {
  return new Set(t.routes.flatMap((e) => Wi(e) === null ? [] : [e.id]));
}
function Pn(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
function Fn(t, e) {
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
class _l {
  constructor(e, n) {
    this.connection = e, this.frameworkInput = n, this.modulationLane = new Ln(e, { laneKind: "modulation" }), this.articulationLane = new Ln(e, { laneKind: "articulation" });
  }
  connection;
  frameworkInput;
  modulationState = We();
  articulationBank = Yt();
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
    { length: D },
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
    return this.frameworkInput ? [P] : kl;
  }
  start() {
    this.started || (this.started = !0, this.lifecycleEpoch += 1, this.modulationLane.start(), this.articulationLane.start(), this.connection.addStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.addEndpointListener?.(Et, this.handleRuntimeStateBound), this.requestBootState(this.lifecycleEpoch));
  }
  stop() {
    this.started && (this.started = !1, this.lifecycleEpoch += 1, this.bootPending = !1, this.pendingBootKeys = null, this.bootEvents.length = 0, this.connection.removeStoredStateValueListener?.(this.handleStoredStateValueBound), this.connection.removeEndpointListener?.(Et, this.handleRuntimeStateBound), this.clearRecoveryTimer(), this.lastRejectedToken.clear(), this.articulationLane.stop(), this.modulationLane.stop());
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
    const n = pt(e, le), i = this.frameworkInput ? { _tag: "ok", value: this.modulationState } : n === void 0 ? { _tag: "ok", value: We() } : qe(n);
    if (i._tag === "err") {
      console.error(`[runtime-state-worker] ${le} is invalid; boot state was not installed.`);
      const a = pt(e, P), s = gt(a, /* @__PURE__ */ new Set());
      s !== null && (this.articulationBank = s, this.hasArticulationState = !0);
      return;
    }
    this.modulationState = i.value, this.hasModulationState = !0;
    const r = pt(e, P), o = gt(
      r,
      Cn(i.value)
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
    if (e === le) {
      const r = qe(n);
      if (r._tag === "err") {
        console.error(`[runtime-state-worker] Rejected invalid ${le}.`);
        return;
      }
      this.modulationState = r.value, this.hasModulationState = !0, this.applyRuntimeStateIfReady();
      return;
    }
    const i = gt(n, Cn(this.modulationState));
    if (i === null) {
      console.error(`[runtime-state-worker] Rejected invalid ${P}.`);
      return;
    }
    this.articulationBank = i, this.hasArticulationState = !0, this.applyRuntimeStateIfReady();
  }
  handleRuntimeState(e) {
    if (!this.started) return;
    const n = Ei(e);
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
      this.frameworkInput && this.recoveryTimer === null && (this.connection.sendEventOrValue?.(fr, 0, void 0, Ot), this.hasRuntimeState || this.scheduleRecovery());
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
    const e = this.lifecycleEpoch, n = this.runtimeGeneration, i = this.modulationState, r = this.articulationBank, o = this.deliveryObserver, s = this.lastAppliedModulationGeneration !== n ? null : this.lastAppliedModulationState, l = this.frameworkInput?.curveCommand ? En(i, s, this.frameworkInput.curveCommand) : En(i, s), u = await this.modulationLane.sendBatch(l);
    if (!this.started || e !== this.lifecycleEpoch) return;
    if (!this.acceptOutcome("modulation", u, i)) {
      this.lastAppliedModulationState = null, this.lastAppliedModulationGeneration = -1;
      const g = Fn("modulation", u);
      g && o?.(g), this.finishDelivery();
      return;
    }
    if (this.lastAppliedModulationState = i, this.lastAppliedModulationGeneration = n, this.desiredStateChanged(n, i, r)) {
      this.deliveryRefreshPending = !0, this.finishDelivery();
      return;
    }
    const c = this.buildUploadsBySelector(i, r), m = Array.from({ length: D }, (g, v) => {
      const x = c.get(v);
      return x ? Pn(x) : null;
    }), d = this.lastAppliedArticulationGeneration !== n, f = d && this.articulationLane.getAcceptedFrontier() !== 0, p = [];
    for (let g = 0; g < D; g += 1) {
      const v = c.get(g), x = m[g] !== this.lastAppliedArticulationTokens[g];
      f ? p.push({
        endpointID: ut,
        value: v ?? xn(g)
      }) : d ? v && p.push({ endpointID: ut, value: v }) : x && p.push({
        endpointID: ut,
        value: v ?? xn(g)
      });
    }
    const y = await this.articulationLane.sendBatch(p);
    if (!(!this.started || e !== this.lifecycleEpoch)) {
      if (this.acceptOutcome("articulation", y, m)) {
        this.lastAppliedArticulationGeneration = n, this.lastAppliedArticulationTokens = m;
        const g = Il(r);
        if (this.frameworkInput) {
          const v = await this.frameworkInput.publishTriggerConfig(g);
          if (!this.started || e !== this.lifecycleEpoch) return;
          v.kind !== "cancelled" && o?.(v);
        } else
          il(g, this.connection);
        this.clearRecoveryTimer(), this.lastRejectedToken.clear();
      } else {
        for (const v of p) this.lastAppliedArticulationTokens[v.value.selectorA] = void 0;
        const g = Fn("articulation", y);
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
      const o = Wi(r);
      return o === null ? [] : [[r.id, o]];
    }));
    return new Map(
      gl(n, i).map((r) => [r.selectorA, r])
    );
  }
  acceptOutcome(e, n, i) {
    if (n._tag === "accepted") return !0;
    if (n._tag === "superseded" || n._tag === "stopped") return !1;
    const r = Pn(i), o = n._tag !== "rejected" || this.lastRejectedToken.get(e) !== r;
    return n._tag === "rejected" && this.lastRejectedToken.set(e, r), console.error(`[runtime-state-worker] ${e} delivery was not accepted.`, { outcome: n._tag }), o && this.scheduleRecovery(), !1;
  }
  scheduleRecovery() {
    !this.started || this.recoveryTimer !== null || (this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null, this.applyRuntimeStateIfReady();
    }, Ol));
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
const wl = {
  eventEndpoints: ["modulationMsegPlayback", "modulationProgram", "modulationAmount", "articulationSnapshot", "runtimeSyncRequest"],
  outputEndpoints: ["runtimeState", "runtimeInstallAck"],
  storedKeys: [P],
  hostEffects: ["cosimo.articulation-trigger-config"],
  dataInputs: [3, 4, 5, 6, 7, 8],
  replacement: "finish",
  create(t) {
    let e = Kn(t);
    return {
      apply(n, i) {
        return e.closed && (e = Kn(t)), e.apply(n, i);
      },
      stop() {
        e.stop();
      }
    };
  }
};
function Kn(t) {
  let e = !1, n = 0, i;
  const r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map();
  function s(d) {
    const f = i;
    i = void 0, f ? f(d) : d.kind !== "cancelled" && t.report(d);
  }
  function l() {
    e || (e = !0, m.stop(), s({ kind: "cancelled" }), r.clear());
  }
  function u(d) {
    if (d.kind !== "submitted") {
      d.kind === "failed" && d.error.kind !== "transport" && (s(d), l());
      return;
    }
    r.add(d.completion), d.completion.then((f) => {
      r.delete(d.completion), !(e || f.kind === "sent") && (s(f), l());
    }, (f) => {
      e || (l(), t.fail(f));
    });
  }
  const c = {
    addEndpointListener(d, f) {
      const p = o.get(d) ?? /* @__PURE__ */ new Map();
      p.set(f, t.listen(d, f)), o.set(d, p);
    },
    removeEndpointListener(d, f) {
      o.get(d)?.get(f)?.(), o.get(d)?.delete(f);
    },
    addStoredStateValueListener(d) {
      a.set(d, t.subscribeStored(
        P,
        (f) => d({ key: P, value: f })
      ));
    },
    removeStoredStateValueListener(d) {
      a.get(d)?.(), a.delete(d);
    },
    requestFullStoredState(d) {
      t.readStored(P).then((f) => {
        e || d({ values: { [P]: f } });
      }, (f) => t.fail(f));
    },
    sendEventOrValue(d, f) {
      e || u(t.send({ kind: "event", endpoint: d, value: f }));
    }
  }, m = new _l(c, {
    onDefect(d) {
      l(), t.fail(d);
    },
    curveCommand: (d, f, p) => ({
      async submit({ dspSessionId: y, deliverySerial: g, signal: v }) {
        const x = await t.prepareData(
          vl + d * 2 + f,
          Sl,
          (b) => {
            new Int32Array(b.buffer, b.byteOffset, 4).set([1297302855, y, g, Ee]), _i(p, new Float32Array(b.buffer, b.byteOffset + 16, Ee));
          },
          v
        );
        x.kind === "failed" && (s(x), l());
      }
    }),
    async publishTriggerConfig(d) {
      const p = (await Promise.all(r)).find((g) => g.kind !== "sent");
      if (p) return p.kind === "failed" ? p : { kind: "cancelled" };
      if (e) return { kind: "cancelled" };
      const y = t.send({ kind: "host-effect", name: "cosimo.articulation-trigger-config", value: ar(d) });
      return y.kind === "submitted" ? y.completion : y;
    }
  });
  return {
    get closed() {
      return e;
    },
    apply(d, f) {
      if (e || f.signal.aborted) return Promise.resolve({ kind: "cancelled" });
      const p = ++n;
      return new Promise((y) => {
        const g = f.signal.onAbort(() => {
          s({ kind: "cancelled" }), l();
        });
        i = (v) => {
          g(), y(v);
        }, m.replaceModulation(d, (v) => {
          p === n && v.kind !== "preparing" && s(v);
        }), m.start();
      });
    },
    stop: l
  };
}
function Zt(t) {
  if (!(t === null || typeof t != "object")) {
    for (const e of Object.values(t)) Zt(e);
    Object.freeze(t);
  }
}
const Ll = {
  parse(t) {
    const e = Si(t);
    return e ? (Zt(e), { kind: "ok", value: e }) : { kind: "error", message: "Invalid rack document." };
  },
  encode: et,
  equals: (t, e) => et(t) === et(e)
}, Nl = {
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
      for (const r of Reflect.get(e, "slots")) {
        if (r === null || typeof r != "object") continue;
        const o = Reflect.get(r, "routeAmounts");
        if (o !== null && typeof o == "object")
          for (const a of Object.keys(o)) n.add(a);
      }
    const i = dr(e, n);
    return i._tag === "err" ? { kind: "error", message: i.error.message } : (Zt(i.value), { kind: "ok", value: i.value });
  },
  encode: (t) => JSON.stringify(ht(t)),
  equals: (t, e) => JSON.stringify(ht(t)) === JSON.stringify(ht(e))
}, Un = [ci, Te, vt, Be], Cl = { kind: "sent", proof: "native-publication-processed" };
const Pl = {
  eventEndpoints: Un,
  outputEndpoints: ["runtimeState"],
  replacement: "finish",
  create(t) {
    let e, n, i = 0, r = 0, o, a = !1, s = Promise.resolve();
    const l = (d) => Ti(d).filter((f) => Un.includes(f.endpointID));
    async function u(d, f, p = !1) {
      if (a || f.aborted) return { kind: "cancelled" };
      const y = l(d), g = e && !p ? l(e) : [], v = (S) => S.find((M) => M.endpointID === Be)?.value, x = g.length > 0 && JSON.stringify(v(g)) === JSON.stringify(v(y)), b = [];
      for (const S of y) {
        if (!x) {
          b.push(S);
          continue;
        }
        if (S.endpointID !== Be)
          if (S.endpointID === Te) {
            const M = S.value, w = g.find((J) => J.endpointID === S.endpointID && J.value.slotId === M.slotId), q = w ? w.value.values : [], G = M.values.flatMap((J, ge) => Object.is(J, q[ge]) ? [] : [ge]);
            G.length === 1 ? b.push({
              endpointID: vt,
              value: { slotId: M.slotId, paramIndex: G[0], value: M.values[G[0]] }
            }) : G.length > 1 && b.push(S);
          } else JSON.stringify(S.value) !== JSON.stringify(g.find((M) => M.endpointID === S.endpointID)?.value) && b.push(S);
      }
      e = void 0;
      for (const S of b) {
        if (a || f.aborted) return { kind: "cancelled" };
        const M = S.endpointID === Te || S.endpointID === vt ? { ...Object(S.value), deliverySerial: ++i } : S.value, w = t.send({ kind: "event", endpoint: S.endpointID, value: M }), q = w.kind === "submitted" ? await w.completion : w;
        if (q.kind !== "sent") return q;
      }
      return a || f.aborted ? { kind: "cancelled" } : (e = d, Cl);
    }
    function c(d, f, p = !1) {
      const y = s.then(() => u(d, f, p));
      return s = y.catch(() => {
      }), y;
    }
    const m = t.listen("runtimeState", (d) => {
      const f = d !== null && typeof d == "object" ? Reflect.get(d, "dspSessionId") : void 0;
      if (typeof f != "number" || f === o) return;
      const p = o !== void 0;
      o = f;
      const y = r;
      p && n && c(n, t.signal, !0).then((g) => {
        g.kind === "failed" && y === r && t.report(g);
      }, t.fail);
    });
    return {
      apply(d, f) {
        return r += 1, n = d, c(d, f.signal);
      },
      stop() {
        a = !0, m();
      }
    };
  }
}, Fl = Object.freeze({
  ...Object.fromEntries(Fe.flatMap(({ controls: t }) => t.map(({ endpointID: e }) => [e, h(e)]))),
  ...Object.fromEntries(Zn().map((t) => [t, h(t)])),
  playMode: h("playMode"),
  glideTime: h("glideTime"),
  macro1: h("macro1"),
  macro2: h("macro2"),
  macro3: h("macro3"),
  macro4: h("macro4"),
  filterMode: h("filterMode"),
  filterCutoff: h("filterCutoff"),
  filterQ: h("filterQ"),
  mseg1Morph: h("mseg1Morph"),
  mseg2Morph: h("mseg2Morph"),
  mseg3Morph: h("mseg3Morph"),
  mseg1Rate: h("mseg1Rate"),
  mseg2Rate: h("mseg2Rate"),
  mseg3Rate: h("mseg3Rate"),
  env1Attack: h("env1Attack"),
  env1Decay: h("env1Decay"),
  env1Sustain: h("env1Sustain"),
  env1Release: h("env1Release"),
  env2Attack: h("env2Attack"),
  env2Decay: h("env2Decay"),
  env2Sustain: h("env2Sustain"),
  env2Release: h("env2Release"),
  env3Attack: h("env3Attack"),
  env3Decay: h("env3Decay"),
  env3Sustain: h("env3Sustain"),
  env3Release: h("env3Release"),
  filterMix: h("filterMix"),
  ampRelease: h("ampRelease"),
  sourceMode: h("sourceMode"),
  globalTune: h("globalTune"),
  ampAttack: h("ampAttack"),
  ampDecay: h("ampDecay"),
  ampSustain: h("ampSustain"),
  filterCutoffKeyTrackEnabled: h("filterCutoffKeyTrackEnabled"),
  filterCutoffKeyTrackOffsetSemitones: h("filterCutoffKeyTrackOffsetSemitones"),
  voiceEnhancerFrequency: h("voiceEnhancerFrequency"),
  voiceEnhancerQ: h("voiceEnhancerQ"),
  voiceEnhancerAmount: h("voiceEnhancerAmount"),
  voiceEnhancerKeyTrackEnabled: h("voiceEnhancerKeyTrackEnabled"),
  voiceEnhancerKeyTrackOffsetSemitones: h("voiceEnhancerKeyTrackOffsetSemitones"),
  polishEnhancerAmount: h("polishEnhancerAmount"),
  polishCompressionClipAmount: h("polishCompressionClipAmount"),
  polishOutputTrimDb: h("polishOutputTrimDb"),
  polishSafeBassAmount: h("polishSafeBassAmount"),
  polishSafeBassBypass: h("polishSafeBassBypass"),
  polishEnhancerBypass: h("polishEnhancerBypass"),
  polishCompressionClipBypass: h("polishCompressionClipBypass"),
  polishOutputTrimBypass: h("polishOutputTrimBypass")
});
Po({
  ...Fl,
  [le]: un({ initial: We(), codec: Fs, prepare: (t) => t, engine: wl }),
  [li]: un({
    initial: vi(),
    codec: Ll,
    dependencies: Zn(),
    prepare: (t, { parameters: e }) => ho(t, e),
    engine: Pl
  }),
  [P]: Mi({ initial: Yt(), codec: Nl })
});
const Ke = 2048;
function ye(t, e) {
  if (!t)
    throw new Error(e);
}
function Kl(t) {
  ye(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    ye(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), ye(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), ye(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), ye(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const Ul = 2048, Qe = 11, Bl = 256;
function B(t, e) {
  if (!t)
    throw new Error(e);
}
function Vl(t) {
  return t > 0 && (t & t - 1) === 0;
}
const Bn = /* @__PURE__ */ new Map();
function $l(t) {
  const e = Bn.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let o = 0, a = r;
    for (let s = 0; s < n; s += 1)
      o = o << 1 | a & 1, a >>= 1;
    i[r] = o;
  }
  return Bn.set(t, i), i;
}
function hr(t, e, n = !1) {
  const i = t.length;
  B(i === e.length, "FFT real and imaginary buffers must have the same length"), B(Vl(i), "FFT input length must be a power of two");
  const r = $l(i);
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
      let m = 1, d = 0;
      for (let f = 0; f < a; f += 1) {
        const p = c + f, y = p + a, g = t[y], v = e[y], x = m * g - d * v, b = m * v + d * g, S = t[p], M = e[p];
        t[p] = S + x, e[p] = M + b, t[y] = S - x, e[y] = M - b;
        const w = m * l - d * u;
        d = m * u + d * l, m = w;
      }
    }
  }
  if (n)
    for (let o = 0; o < i; o += 1)
      t[o] /= i, e[o] /= i;
}
function pr(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += Number(e[o]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let o = 0; o < e.length; o += 1)
    r[o] = (Number(e[o]) || 0) - i;
  return r;
}
function zl(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Ul,
  maxFramesPerTable: i = Bl
} = {}) {
  const r = Float32Array.from(t);
  B(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const o = r.length / n;
  B(o > 0, "Source wavetable files must contain at least one frame"), B(o <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && B(o === e, `Source wavetable frame count mismatch: expected ${e}, got ${o}`);
  const a = [];
  for (let s = 0; s < o; s += 1) {
    const l = s * n, u = l + n;
    a.push(pr(r.slice(l, u)));
  }
  return {
    frameCount: o,
    frames: a
  };
}
function Vn(t) {
  const e = pr(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return hr(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function gr(t, e, {
  mipLevelCount: n = Qe
} = {}) {
  const i = t?.real?.length ?? 0;
  B(i > 0, "Spectrum must contain real samples"), B(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), B(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), o = new Float64Array(i), a = new Float64Array(i);
  for (let s = 1; s <= r; s += 1) {
    o[s] = t.real[s], a[s] = t.imaginary[s];
    const l = (i - s) % i;
    l !== s && (o[l] = t.real[l], a[l] = t.imaginary[l]);
  }
  return hr(o, a, !0), Float32Array.from(o);
}
const Ue = 256, ve = 2048, Ir = 8, jl = 12811, kt = (Ir + Ue * jl) * 4;
function $n(t, e, n) {
  const i = Math.fround(t * e);
  return Math.max(-n, Math.min(
    n,
    Math.trunc(Math.fround(i + (i >= 0 ? 0.5 : -0.5)))
  ));
}
function Hl(t, e, n) {
  if (t.byteLength !== kt || !Number.isInteger(e.frameCount) || e.frameCount < 1 || e.frameCount > Ue)
    throw new Error("Invalid packed wavetable destination or frame count.");
  const i = new Int32Array(t.buffer, t.byteOffset, t.byteLength / 4);
  i.set([
    1465139788,
    1,
    e.dspSessionId,
    e.generation,
    e.tableIndex,
    e.frameCount,
    Qe,
    Ue
  ]);
  let r = Ir;
  const o = 131071, a = 8191, s = Math.fround(o / 1.5), l = Math.fround(a / 0.5);
  for (let u = 0; u < Qe; ++u) {
    const c = Math.min(ve, Math.max(256, (1 << u) * 32)), m = ve / c;
    for (let d = 0; d < e.frameCount; ++d) {
      const f = gr(n(d), u), p = r + d * (c + 1);
      for (let y = 0; y <= c; ++y) {
        const g = (y === c ? 0 : y) * m, v = (g + ve - m) % ve, x = (g + m) % ve, b = f[g], S = f[v], M = f[x];
        if (b === void 0 || S === void 0 || M === void 0 || !Number.isFinite(b) || !Number.isFinite(S) || !Number.isFinite(M))
          throw new Error("Wavetable preparation produced invalid samples.");
        const w = Math.fround(0.5 * Math.fround(M - S));
        i[p + y] = $n(b, s, o) & 262143 | $n(w, l, a) << 18;
      }
    }
    r += (c + 1) * Ue;
  }
}
const Wl = "runtimeSyncRequest", ql = 2147483647, Gl = "runtimeState", Jl = "retryDesiredTableRequest", Ql = "workerLoadFailure", Xl = "serviceLoadAbort", Yl = "wavetableLoadBegin", Zl = "wavetableMipFrame", ec = "wavetableUploadAck", tc = "wavetableMipRequest", nc = "wavetablePrewarmRequest", ic = "wavetablePrewarmNotification", rc = "assets/factory-bank-catalog.json", _t = 3, oc = 1, ac = _t * Ke, sc = 1, lc = 2, cc = 3, uc = 1, dc = 2, fc = 2e4, Le = sc, zn = lc, jn = cc, H = uc, Hn = dc, mc = 48 * 1024 * 1024, It = 3;
function Wn(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function O(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function qn(t) {
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
function Gn(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function Jn(t, e) {
  if (!t)
    throw new Error(e);
}
function hc(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function pc(t, e) {
  return Kl(await t.readJSON(e));
}
function gc(t) {
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
function Ic(t, e) {
  const n = Math.round(Number(t) || 0);
  return hc(n, 0, Math.max(0, e - 1));
}
function yt(t, e, n, i, r) {
  return `${t}:${e}:${n}:${i}:${r}`;
}
function yc(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function Qn(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Xn(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function Ne() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function vc(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class Sc {
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
    this.connection = e, this.delivery = n.delivery ?? "events", this.resourceClient = _o(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? rc, this.maxBatchesInFlight = Wn(
      n.maxFramesInFlight,
      oc
    ), this.mipLevelCount = n.mipLevelCount ?? Qe, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? mc) || 0)), this.serviceLoadTimeoutMs = Wn(n.serviceLoadTimeoutMs, fc), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    if (this.started)
      return this;
    if (this.delivery === "shared" && !this.connection.sharedData)
      throw new Error("Cosimo requires a host with direct shared wavetable preparation.");
    return this.started = !0, O("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Gl, this.handleRuntimeState), this.connection.addEndpointListener?.(ec, this.handleUploadAck), this.connection.addEndpointListener?.(tc, this.handleMipRequest), this.connection.addEndpointListener?.(nc, this.handlePrewarmRequest), this.connection.addEndpointListener?.(ic, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Wl,
      ql
    ), this;
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await pc(this.resourceClient, this.catalogPath), O("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < It; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = Qn(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Qn(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = yt(
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
          ...Xn(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== r || !this.serviceLoadHasPendingTransfers()) && (O("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: jn,
          failureReasonCode: Hn
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== jn || e.failureReasonCode !== Hn ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: o = 0,
    failurePhase: a = Le,
    failureReasonCode: s = H
  }) {
    this.connection.sendEventOrValue?.(Ql, {
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
    this.connection.sendEventOrValue?.(Xl, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: o
    });
  }
  emitRetryDesiredTableRequest(e) {
    O("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? qn(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(Jl, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), r = Ic(e, i.tables.length), o = i.tables[r];
    Jn(o, `Could not resolve table ${r}`);
    const a = yc(o, Ke, this.mipLevelCount), s = this.tableCache.get(a);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, O("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: o.tableId,
        tableName: o.name,
        sourceWav: o.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const l = Ne();
    O("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n
    });
    const u = await this.resourceClient.readAudio(o.sourceWav), c = zl(u.samples, {
      expectedFrameCount: n === void 0 ? Number(o.frameCount) : n,
      samplesPerFrame: Ke
    });
    return O("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: o.tableId,
      tableName: o.name,
      sourceWav: o.sourceWav,
      frameCount: c.frameCount,
      loadDurationMs: Math.round(Ne() - l)
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
    if (O("info", "Committing desired wavetable load", {
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
    this.connection.sendEventOrValue?.(Yl, {
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
    const n = Ne();
    try {
      if (await yl(this.connection, {
        input: e.oscillatorIndex,
        byteLength: kt
      }, (i) => {
        Hl(i, e, (r) => this.getSpectrumForFrame(r));
      }), this.serviceTable !== e || this.knownSessionId !== e.dspSessionId) return;
      O("info", "Submitted shared wavetable", {
        oscillatorIndex: e.oscillatorIndex,
        tableIndex: e.tableIndex,
        generation: e.generation,
        frameCount: e.frameCount,
        preparedBytes: kt,
        preparationMs: Ne() - n,
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
        failurePhase: zn,
        failureReasonCode: H
      }), this.serviceTable = null, this.clearMipTransferState(), O("error", "Shared wavetable preparation failed", { detail: Ce(i) }), this.scheduleRuntimeStateDrain();
    }
  }
  handleCandidateLoadFailure(e) {
    O("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: Le,
      failureReasonCode: H
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: Le,
      failureReasonCode: H
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = Le,
    failureReasonCode: i = H
  } = {}) {
    O("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (O("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: Ce(o)
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
      this.isCurrentRuntimeState(e) && (O("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: Ce(a)
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
    for (let e = 0; e < It; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, vc(() => {
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
        O("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
    const n = gc(e ?? {});
    if (O("info", "Received runtime state", qn(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= It)
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
          r.spectra[a] || (r.spectra[a] = Vn(r.frames[a]));
        const o = this.tableCache.get(r.cacheKey);
        o && this.refreshCacheEntryByteCount(o), O("info", "Prewarmed wavetable source table", {
          tableIndex: r.tableIndex,
          tableId: r.tableMeta.tableId,
          tableName: r.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (r) {
        O("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: Ce(r)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), r = Math.trunc(Number(e?.generation)), o = Math.trunc(Number(e?.tableIndex)), a = Math.trunc(Number(e?.mipIndex)), s = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || r !== this.serviceTable.generation || o !== this.serviceTable.tableIndex || a < 0 || a >= this.mipLevelCount)
      return null;
    const l = yt(
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
      ...Xn(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(l, u), u);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (O("info", "Received wavetable mip request", {
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.oscillatorIndex)), o = Math.trunc(Number(n.generation)), a = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), l = Math.trunc(Number(n.frameIndexBase)), u = Math.trunc(Number(n.frameCount)), c = yt(
      i,
      r,
      o,
      a,
      s
    ), m = this.mipJobs.get(c), d = this.serviceTable?.frameCount ?? 0, f = Math.min(
      _t,
      d - l
    );
    if (!(!m || m.completed || !m.inFlightBatchBases.has(l) || u <= 0 || u !== f)) {
      m.inFlightBatchBases.delete(l);
      for (let p = 0; p < u; p += 1) {
        const y = l + p;
        m.ackedFrames[y] || (m.ackedFrames[y] = 1, m.ackedFrameCount += 1);
      }
      m.ackedFrameCount === d && m.nextFrameIndex >= d && m.inFlightBatchBases.size === 0 && (m.completed = !0, this.activeUploadKey === m.key && (this.activeUploadKey = null)), Gn(l, u, d) && O("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: r,
        generation: o,
        tableIndex: m.tableIndex,
        mipIndex: s,
        frameIndexBase: l,
        batchFrameCount: u,
        ackedFrameCount: m.ackedFrameCount,
        frameCount: d,
        inFlightBatches: m.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (Jn(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = Vn(this.serviceTable.frames[e]);
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
        _t,
        this.serviceTable.frameCount - n
      ), r = new Float32Array(ac);
      try {
        for (let o = 0; o < i; o += 1) {
          const a = n + o, s = this.getSpectrumForFrame(a), l = gr(s, e.mipIndex);
          r.set(l, o * Ke);
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
            failurePhase: zn,
            failureReasonCode: H
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
        frameCount: i,
        samples: Array.from(r)
      }), Gn(n, i, this.serviceTable.frameCount) && O("info", "Sent wavetable mip batch", {
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
function Ce(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function bc(t, e = {}) {
  return new Sc(t, e);
}
async function Tc(t, e = {}) {
  return Sr(t, [
    To,
    () => bc(t, e)
  ]);
}
export {
  Tc as default
};
