class vt {
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
function yt(t, e) {
  return new vt(t, e);
}
async function St(t, e) {
  const n = yt(t, e);
  return await n.start(), n;
}
const Ge = 12, fe = 5, je = 8, Tt = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), me = Object.freeze({
  globalFilter: [
    "globalFilterMode",
    "globalFilterCutoff",
    "globalFilterResonance",
    "globalFilterDrive",
    "globalFilterCutoffKeyTrackEnabled",
    "globalFilterCutoffKeyTrackOffsetSemitones"
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
    "distortionWetLPKeyTrackOffsetSemitones"
  ],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
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
    "chorusRingLegacyClampEnabled"
  ],
  flanger: [
    "flangerRate",
    "flangerDepth",
    "flangerFeedback",
    "flangerMix",
    "flangerBaseDelayMs",
    "flangerBaseDelayKeyTrackEnabled",
    "flangerBaseDelayKeyTrackOffsetSemitones"
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
    "phaserFrequencyKeyTrackOffsetSemitones"
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
    "delayFilterKeyTrackOffsetSemitones"
  ],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), he = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), Et = Object.freeze([
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
]), xt = Object.freeze({
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
function Rt(t) {
  return Math.round(t) === 1 ? -5 : Math.round(t) === 2 ? 12 : Math.round(t) === 3 ? -12 : 7;
}
function pe(t, e) {
  const n = {};
  for (const l of me[t]) {
    const s = e[l];
    if (typeof s == "number" && Number.isFinite(s)) {
      n[l] = s;
      continue;
    }
    const o = xt[l];
    if (o === void 0)
      throw new Error(`Missing lane parameter value: ${t}.${l}`);
    n[l] = o;
  }
  const i = he.chorus, r = Object.keys(e);
  return t === "chorus" && r.length === i.length && r.every((l) => i.includes(l)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = Rt(
    Number(e.chorusRingOffsetMode)
  ) + Number(e.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function At(t) {
  return me[t];
}
function Dt(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= fe)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * je + Tt[t];
}
function Mt(t, e) {
  const n = new Array(Ge).fill(0), i = pe(t, e);
  return me[t].forEach((r, a) => {
    n[a] = i[r];
  }), n;
}
const y = (t, e) => ({ label: t, value: e });
function D(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const M = Object.freeze({
  filter: D(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M24.22%2067.796a3.995%203.995%200%200%201%204.008-3.991h85.498c8.834%200%2019.732%206.112%2024.345%2013.657l53.76%2087.936c3.46%205.66%2011.628%2010.247%2018.256%2010.247h16.718a3.996%203.996%200%200%201%203.994%204.007v8.985a4.007%204.007%200%200%201-4.007%204.008h-24.7c-8.835%200-19.709-6.13-24.283-13.683l-52.324-86.4c-3.43-5.665-11.577-10.257-18.202-10.257H28.214a3.995%203.995%200%200%201-3.993-3.992V67.796z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-lowpass.svg"
  ),
  drive: D(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M233%2064.5h-28.495c-18.104%200-32.517%204.04-49.695%2018.089-15.765%2012.892-30.941%2031.655-39.559%2046.948-12.478%2022.144-33.858%2039.953-43.54%2043.463-9.68%203.51-23.202%203.5-30.711%203.5H25V192h23.5c9.747%200%2026.265-.681%2039.867-7.61%2018.496-9.42%2033.507-35.51%2047.578-54.853%209.879-13.579%2021.773-27.756%2032.732-36.034C182.775%2082.853%20196.637%2080%20216.5%2080H233V64.5z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-softclipcurve.svg"
  ),
  ott: D(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M175.863%20100.122c0-2.205%201.293-2.747%202.883-1.214l30.096%2028.996-30.11%2029.24c-1.585%201.538-2.87%201-2.87-1.209v-19.24l-95.811.637v18.596c0%202.21-1.28%202.746-2.854%201.201l-29.788-29.225%2029.774-28.982c1.584-1.542%202.868-1.004%202.868%201.2v19.54h95.812v-19.54z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-arrows-vert.svg"
  ),
  chorus: D(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M48%20128c-1.955-29.248%2019.364-64%2037.364-64%2018%200%2036.136%2013.843%2036.136%2064.5s19.136%2080.5%2049.136%2080.5c30%200%2053.364-40.125%2053.364-80.5-8.182%200-7.273-.752-16%200%200%2032.35-20.455%2064.45-37.364%2064.45s-33.909-13.542-33.909-64.45S120.273%2048%2085.364%2048C50.454%2048%2032%2088.626%2032%20127.748c6%200%208.364.252%2016%20.252z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-modsine.svg"
  ),
  flanger: D(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M116.589%20182.742l-7.405%2020.346a4%204%200%200%201-5.125%202.396l-7.525-2.738a4%204%200%200%201-2.386-5.13l7.435-20.427C83.963%20167.623%2072%20148.959%2072%20127.5%2072%2096.296%2097.296%2071%20128.5%2071c3.877%200%207.663.39%2011.32%201.134l6.996-19.222a4%204%200%200%201%205.125-2.396l7.525%202.738a4%204%200%200%201%202.386%205.13l-6.968%2019.142C172.796%2087.002%20185%20105.826%20185%20127.5c0%2031.204-25.296%2056.5-56.5%2056.5-4.086%200-8.071-.434-11.911-1.258zm5.173-14.213A41.32%2041.32%200%200%200%20128%20169c22.644%200%2041-18.356%2041-41%200-14.855-7.9-27.864-19.727-35.056l-27.51%2075.585zm-15.035-5.473l27.51-75.585A41.32%2041.32%200%200%200%20128%2087c-22.644%200-41%2018.356-41%2041%200%2014.855%207.9%2027.864%2019.727%2035.056z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-phase.svg"
  ),
  phaser: D(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M25.101%2077.628a4.008%204.008%200%200%200%203.997%204.01h16.996c6.632%200%2013.927%205.01%2016.3%2011.202l52.724%2085.231c7.115%2018.564%2018.693%2018.571%2025.857.025L193.91%2092.84c2.39-6.187%209.693-11.202%2016.336-11.202h16.49a4.01%204.01%200%200%200%204-4.01V68.82a4%204%200%200%200-3.994-4.009h-23.508c-8.835%200-18.547%206.702-21.69%2014.962l-47.147%2073.852c-3.533%209.287-9.217%209.262-12.694-.051L75.2%2079.805C72.108%2071.524%2062.44%2064.81%2053.6%2064.81H29.11a4.012%204.012%200%200%200-4.008%204.01v8.808z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-filter-notch.svg"
  ),
  delay: D(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20fill-rule='evenodd'%3e%3cpath%20d='M109.533%20197.602a1.887%201.887%200%200%201-.034%202.76l-7.583%207.066a4.095%204.095%200%200%201-5.714-.152l-32.918-34.095c-1.537-1.592-1.54-4.162-.002-5.746l33.1-34.092c1.536-1.581%204.11-1.658%205.74-.18l7.655%206.94c.82.743.833%201.952.02%202.708l-21.11%2019.659s53.036.129%2071.708.064c18.672-.064%2033.437-16.973%2033.437-34.7%200-7.214-5.578-17.64-5.578-17.64-.498-.99-.273-2.444.483-3.229l8.61-8.94c.764-.794%201.772-.632%202.242.364%200%200%209.212%2018.651%209.212%2028.562%200%2028.035-21.765%2050.882-48.533%2050.882-26.769%200-70.921.201-70.921.201l20.186%2019.568z'/%3e%3cpath%20d='M144.398%2058.435a1.887%201.887%200%200%201%20.034-2.76l7.583-7.066a4.095%204.095%200%200%201%205.714.152l32.918%2034.095c1.537%201.592%201.54%204.162.002%205.746l-33.1%2034.092c-1.536%201.581-4.11%201.658-5.74.18l-7.656-6.94c-.819-.743-.832-1.952-.02-2.708l21.111-19.659s-53.036-.129-71.708-.064c-18.672.064-33.437%2016.973-33.437%2034.7%200%207.214%205.578%2017.64%205.578%2017.64.498.99.273%202.444-.483%203.229l-8.61%208.94c-.764.794-1.772.632-2.242-.364%200%200-9.212-18.65-9.212-28.562%200-28.035%2021.765-50.882%2048.533-50.882%2026.769%200%2070.921-.201%2070.921-.201l-20.186-19.568z'/%3e%3c/g%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-repeat.svg"
  ),
  reverb: D(
    () => new URL("data:image/svg+xml,%3csvg%20width='256'%20height='256'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M128.802%2095.03c-9.229-9.369-22.39-15.228-37-15.228-27.92%200-50.555%2021.402-50.555%2047.803%200%2026.4%2022.634%2047.802%2050.555%2047.802%2014.711%200%2027.954-5.94%2037.193-15.423-12.232-16.88-14.177-19.888-14.177-32.38%200-12.016%205.924-18.458%2014.19-31.142%206.753%2013.293%2013.629%2019.445%2013.629%2031.538%200%2012.802-6.03%2020.525-13.402%2032.614%209.206%209.115%2022.185%2014.793%2036.567%2014.793%2027.922%200%2050.556-21.401%2050.556-47.802%200-26.4-22.634-47.803-50.556-47.803-14.608%200-27.77%205.86-37%2015.228zM128%2075.374C138.501%2068.202%20151.252%2064%20165%2064c35.899%200%2065%2028.654%2065%2064%200%2035.346-29.101%2064-65%2064-13.748%200-26.499-4.202-37-11.374C117.499%20187.798%20104.748%20192%2091%20192c-35.899%200-65-28.654-65-64%200-35.346%2029.101-64%2065-64%2013.748%200%2026.499%204.202%2037%2011.374z'%20fill-rule='evenodd'/%3e%3c/svg%3e", import.meta.url).href,
    "../assets/fontaudio/fad-stereo.svg"
  )
}), f = (t, e, n, i, r, a, l, s = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: r,
  max: a,
  initial: l,
  step: s.step ?? (a - r) / 1e3,
  scale: s.scale ?? "linear",
  unit: s.unit ?? "",
  choices: s.choices,
  quick: s.quick ?? !1,
  modulationTargetIndex: s.modulationTargetIndex ?? null,
  modulationApplication: s.modulationApplication ?? (s.modulationTargetIndex === void 0 || s.modulationTargetIndex === null ? null : "linear"),
  modulationIdentityEndpointID: s.modulationIdentityEndpointID,
  modulationDragStyle: s.modulationDragStyle
}), Lt = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], _t = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], wt = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: M.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      f("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(y), quick: !0 }),
      f("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      f("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      f("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: M.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      f("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [y("Classic", 0), y("Harmonics", 1)] }),
      f("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      f("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      f("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      f("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      f("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      f("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [y("Symmetric", 0), y("Asymmetric", 1), y("Wavefold", 2)] })
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: M.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      f("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      f("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      f("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      f("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      f("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 })
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: M.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      f("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(y) }),
      f("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(y) }),
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
      })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: M.flanger,
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
      })
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: M.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      f("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [y("Free", 0), y("Sync", 1)] }),
      f("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      f("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Lt.map(y) }),
      f("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      f("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      f("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      f("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      f("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 })
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: M.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      f("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [y("Free", 0), y("Sync", 1)] }),
      f("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      f("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: _t.map(y) }),
      f("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      f("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      f("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: M.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      f("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      f("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      f("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      f("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 })
    ]
  }
], Y = wt, Je = Object.freeze(
  Y.flatMap((t) => t.parameters)
);
new Map(
  Je.map((t) => [t.endpointID, t])
);
function ge(t) {
  const e = Y.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function Qe() {
  return Je;
}
function Ie(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const b = "lane.v1", kt = "laneTopology", Ee = "laneSlotParams", Ot = "laneOutputControl", re = 16, Ct = 8, Ye = 4, Ft = 3, Xe = fe * je, Ze = 4, Nt = 4, Pt = Xe, Kt = Xe + Ze, Ut = 0, Bt = 1, zt = 2, Ht = 3, $t = 4, Vt = 5;
function qt(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > Ye)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << Ct;
}
const T = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), H = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Wt = new Map(
  Object.entries(H).map(([t, e]) => [e, t])
), Gt = Object.freeze({
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
  T.map((t) => [Gt[t], t])
);
function et() {
  return {
    filter: !1,
    drive: !1,
    ott: !1,
    chorus: !1,
    flanger: !1,
    phaser: !1,
    delay: !1,
    reverb: !1
  };
}
function jt(t) {
  return Object.fromEntries(
    ge(t).parameters.map((e) => [e.endpointID, e.initial])
  );
}
function Jt() {
  return {
    format: "cosimo.lane",
    version: 1,
    order: [...T],
    enabled: et(),
    params: Object.fromEntries(
      T.map((t) => [t, jt(t)])
    )
  };
}
function Qt(t) {
  if (typeof t != "string")
    return { _tag: "json", value: t };
  if (t.trim().length === 0)
    return { _tag: "err", message: `${b} must not be empty` };
  try {
    return { _tag: "json", value: JSON.parse(t) };
  } catch (e) {
    const n = e instanceof Error ? e.message : String(e);
    return { _tag: "err", message: `${b} is not valid JSON: ${n}` };
  }
}
function q(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Yt(t) {
  return typeof t != "string" ? null : T.find((e) => e === t) ?? null;
}
function Xt(t) {
  const e = Qt(t);
  if (e._tag === "err")
    return e;
  if (!q(e.value))
    return { _tag: "err", message: `${b} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled", "params"]);
  for (const s of Reflect.ownKeys(e.value))
    if (typeof s != "string" || !n.has(s))
      return { _tag: "err", message: `${b} has unexpected field ${String(s)}` };
  if (e.value.format !== "cosimo.lane" || e.value.version !== 1)
    return { _tag: "err", message: `${b} must be cosimo.lane version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== T.length)
    return { _tag: "err", message: `${b}.order must contain every effect once` };
  const i = [], r = /* @__PURE__ */ new Set();
  for (const s of e.value.order) {
    const o = Yt(s);
    if (o === null || r.has(o))
      return { _tag: "err", message: `${b}.order is not a complete permutation` };
    r.add(o), i.push(o);
  }
  if (!q(e.value.enabled))
    return { _tag: "err", message: `${b}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== T.length)
    return { _tag: "err", message: `${b}.enabled must contain every effect once` };
  const a = et();
  for (const s of T) {
    const o = e.value.enabled[s];
    if (typeof o != "boolean")
      return { _tag: "err", message: `${b}.enabled.${s} must be boolean` };
    a[s] = o;
  }
  if (!q(e.value.params))
    return { _tag: "err", message: `${b}.params must be an object` };
  if (Reflect.ownKeys(e.value.params).length !== T.length)
    return { _tag: "err", message: `${b}.params must contain every effect once` };
  const l = {};
  for (const s of T) {
    const o = e.value.params[s];
    if (!q(o))
      return { _tag: "err", message: `${b}.params.${s} must be an object` };
    const c = ge(s).parameters.map((p) => p.endpointID), d = he[H[s]], m = Reflect.ownKeys(o), g = (p) => m.length === p.length && m.every((S) => typeof S == "string" && p.includes(S));
    if (!g(c) && !g(d))
      return { _tag: "err", message: `${b}.params.${s} must contain every parameter once` };
    const v = {};
    for (const p of m) {
      if (typeof p != "string")
        return { _tag: "err", message: `${b}.params.${s} has an invalid parameter key` };
      const S = o[p];
      if (typeof S != "number" || !Number.isFinite(S))
        return { _tag: "err", message: `${b}.params.${s}.${p} must be a finite number` };
      v[p] = S;
    }
    l[s] = v;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.lane", version: 1, order: i, enabled: a, params: l }
  };
}
const Zt = "voiceEnhancerFrequency", en = "voiceEnhancerQ", tn = "voiceEnhancerAmount", nn = "voiceEnhancerFrequencyOctaves", an = "voiceEnhancerQ", rn = "voiceEnhancerAmount", tt = "voice.enhancerFrequency", on = Object.freeze({
  frequency: Object.freeze({
    key: "frequency",
    endpointID: Zt,
    targetKind: nn,
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
    endpointID: en,
    targetKind: an,
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
    endpointID: tn,
    targetKind: rn,
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
function xe(t, e) {
  const n = Math.min(t.max, Math.max(t.min, e));
  return t.scale === "log" ? Math.log(n / t.min) / Math.log(t.max / t.min) : (n - t.min) / (t.max - t.min);
}
function sn(t, e) {
  const n = Math.min(1, Math.max(0, e));
  return t.scale === "log" ? t.min * (t.max / t.min) ** n : t.min + (t.max - t.min) * n;
}
const ln = Object.freeze([
  "voice.filterCutoff",
  tt,
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
]), cn = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
  [tt]: "enhancer-frequency",
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
  ln.map((t) => [t, Object.freeze({
    id: t,
    family: cn[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const nt = 40, it = 18e3, oe = T.map((t) => H[t]), dn = /^([a-zA-Z]+)#([1-9][0-9]*)$/, un = /^(parallel|split)#([1-9][0-9]*)$/;
function be(t) {
  if (typeof t != "string")
    return null;
  const e = dn.exec(t);
  if (e === null)
    return null;
  const n = oe.find((r) => r === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > fe ? null : { deviceType: n, instanceNumber: i };
}
function at(t) {
  if (typeof t != "string")
    return null;
  const e = un.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? Ze : Nt) ? null : { groupKind: n, unitNumber: i };
}
function k(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function F(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function h(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function fn(t, e) {
  const n = be(t);
  if (n === null)
    return { failure: h(`device id ${t} is not a pool instance`) };
  if (!k(e) || !F(e, ["params"]) || !k(e.params))
    return { failure: h(`device ${t} must be { params }`) };
  const i = At(n.deviceType), r = he[n.deviceType], a = Wt.get(n.deviceType);
  if (a === void 0)
    return { failure: h(`device ${t} has no effect descriptor`) };
  const l = ge(a).parameters.map((d) => d.endpointID), s = e.params, o = Object.keys(s), u = (d) => o.length === d.length && o.every((m) => d.includes(m));
  if (!(u(i) || u(r) || n.deviceType === "chorus" && u(Et) || u(l)))
    return { failure: h(`device ${t} must carry every parameter once`) };
  for (const d of o) {
    const m = s[d];
    if (typeof m != "number" || !Number.isFinite(m))
      return { failure: h(`device ${t}.${d} must be a finite number`) };
  }
  return { record: { params: pe(n.deviceType, s) } };
}
function mn(t, e) {
  return !k(t) || t.kind !== "device" ? { failure: h("branches may hold device placements only") } : F(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: h(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: h(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: h("a device placement is { kind, deviceId, enabled }") };
}
function Re(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= nt && t <= it;
}
function rt() {
  return { mix: 1, bypassed: !1 };
}
function hn(t) {
  return !k(t) || !F(t, ["mix", "bypassed"]) || typeof t.mix != "number" || !Number.isFinite(t.mix) || t.mix < 0 || t.mix > 1 || typeof t.bypassed != "boolean" ? null : { mix: t.mix, bypassed: t.bypassed };
}
function pn(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (c) {
      const d = c instanceof Error ? c.message : String(c);
      return h(`is not valid JSON: ${d}`);
    }
  if (!k(e) || !F(e, ["format", "version", "output", "devices", "chain"]))
    return h("must be { format, version, output, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return h("must be cosimo.lane version 2");
  if (!k(e.devices))
    return h("devices must be an object");
  if (!Array.isArray(e.chain))
    return h("chain must be an array");
  const n = hn(e.output);
  if (n === null)
    return h("output must be { mix: 0..1, bypassed: boolean }");
  const i = {};
  for (const c of Reflect.ownKeys(e.devices)) {
    if (typeof c != "string")
      return h("device ids must be strings");
    const d = fn(c, e.devices[c]);
    if ("failure" in d)
      return d.failure;
    i[c] = d.record;
  }
  const r = new Set(Object.keys(i)), a = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Set(), s = [];
  let o = 0;
  const u = (c) => {
    const d = mn(c, r);
    return "placement" in d && (a.set(
      d.placement.deviceId,
      (a.get(d.placement.deviceId) ?? 0) + 1
    ), o += 1), d;
  };
  for (const c of e.chain) {
    if (!k(c))
      return h("chain nodes must be objects");
    if (c.kind === "device") {
      const R = u(c);
      if ("failure" in R)
        return R.failure;
      s.push(R.placement);
      continue;
    }
    if (c.kind !== "parallel" && c.kind !== "split")
      return h(`unknown chain node kind ${String(c.kind)}`);
    const d = c.kind === "split", m = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], v = d ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], p = d && F(c, m);
    if (!F(c, v) && !p)
      return h(`a ${c.kind} group is { ${v.join(", ")} }`);
    const S = at(c.groupId);
    if (S === null || S.groupKind !== c.kind)
      return h(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (l.has(String(c.groupId)))
      return h(`group ${String(c.groupId)} is used twice`);
    if (l.add(String(c.groupId)), typeof c.enabled != "boolean")
      return h(`group ${String(c.groupId)} needs a boolean enable`);
    const P = d ? Ft : Ye;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > P)
      return h(`group ${String(c.groupId)} needs 2..${P} branches`);
    if (d && (!Re(c.xoverLowHz) || !Re(c.xoverHighHz)))
      return h(`group ${String(c.groupId)} crossovers must sit in ${nt}..${it} Hz`);
    if (d && !p && (typeof c.xoverLowKeyTrackEnabled != "boolean" || typeof c.xoverHighKeyTrackEnabled != "boolean" || typeof c.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverLowKeyTrackOffsetSemitones) || typeof c.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverHighKeyTrackOffsetSemitones)))
      return h(`group ${String(c.groupId)} Key Track state must be finite`);
    o += 1;
    const C = [];
    for (const R of c.branches) {
      if (!Array.isArray(R))
        return h(`group ${String(c.groupId)} branches must be arrays`);
      const K = [];
      for (const V of R) {
        const U = u(V);
        if ("failure" in U)
          return U.failure;
        K.push(U.placement);
      }
      C.push(K);
    }
    s.push(d ? {
      kind: "split",
      groupId: String(c.groupId),
      enabled: c.enabled,
      xoverLowHz: c.xoverLowHz,
      xoverHighHz: c.xoverHighHz,
      xoverLowKeyTrackEnabled: p ? !1 : c.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: p ? 0 : c.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: p ? !1 : c.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: p ? 0 : c.xoverHighKeyTrackOffsetSemitones,
      branches: C
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: C
    });
  }
  for (const c of r)
    if ((a.get(c) ?? 0) !== 1)
      return h(`device ${c} must be placed exactly once`);
  return o > re ? h(`flattens to ${o} wire entries; the topology upload holds ${re}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: i, chain: s } };
}
function ot(t) {
  const e = {};
  for (const n of T) {
    const i = H[n];
    e[`${i}#1`] = {
      params: pe(i, t.params[n])
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: rt(),
    devices: e,
    chain: t.order.map((n) => ({
      kind: "device",
      deviceId: `${H[n]}#1`,
      enabled: t.enabled[n]
    }))
  };
}
const Ae = ["distortion#1", "delay#1", "reverb#1"];
function De() {
  const t = ot(Jt()), e = {};
  for (const n of Ae) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The v1 default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: rt(),
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && Ae.includes(n.deviceId))
  };
}
function gn(t) {
  if (t === void 0)
    return De();
  const e = pn(t);
  if (e._tag === "ok")
    return e.value;
  const n = Xt(t);
  return n._tag === "ok" ? ot(n.value) : De();
}
function In(t) {
  return Object.keys(t.devices).map((e) => {
    const n = be(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => oe.indexOf(e.parsed.deviceType) - oe.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function se(t) {
  const e = be(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return Dt(e.deviceType, e.instanceNumber - 1);
}
function st(t) {
  const e = at(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? Pt : Kt) + (e.unitNumber - 1);
}
function bn(t) {
  const e = new Array(re).fill(0);
  let n = 0, i = 0;
  const r = (a, l, s) => {
    e[i] = qt(a, l), s && (n |= 1 << i), i += 1;
  };
  for (const a of t.chain) {
    if (a.kind === "device") {
      r(se(a.deviceId), 0, a.enabled);
      continue;
    }
    r(st(a), a.branches.length, a.enabled), a.branches.forEach((l, s) => {
      for (const o of l)
        r(se(o.deviceId), s + 1, o.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function vn(t) {
  const e = new Array(Ge).fill(0);
  return e[Ut] = t.xoverLowHz, e[Bt] = t.xoverHighHz, e[zt] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[Ht] = t.xoverLowKeyTrackOffsetSemitones, e[$t] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[Vt] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function yn(t) {
  const e = [{
    endpointID: Ot,
    value: t.output
  }];
  let n = 0;
  for (const i of In(t))
    n += 1, e.push({
      endpointID: Ee,
      value: {
        slotId: se(i.instanceId),
        deliverySerial: n,
        values: Mt(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: Ee,
      value: {
        slotId: st(i),
        deliverySerial: n,
        values: vn(i)
      }
    }));
  return e.push({
    endpointID: kt,
    value: bn(t)
  }), e;
}
const Sn = "runtimeState";
function Tn(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const En = {
  endpointID: Sn,
  required: !0,
  mapValue: Tn
}, xn = 2e3;
function Me(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function Rn(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return Me(i, e) ? {
    found: !0,
    value: i[e]
  } : Me(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function Le(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class An {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = Dn(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = Rn(e, this.options.stateKey);
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
    }, r = Le(n), a = !this.forceFullReplay && r === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, l = this.options.buildRuntimeEvents(i, a), s = Le({
      runtimeEndpoints: n,
      events: l
    });
    if (s === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
      return;
    }
    if (l.length === 0) {
      this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(l, i).then((o) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        o ? (this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(l);
        const u = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, u && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        this.options.onDeliveryFailure?.(l);
        const o = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, o && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const o of l)
      this.connection.sendEventOrValue?.(
        o.endpointID,
        o.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? xn
      );
    this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = r, this.lastAppliedSnapshot = i;
  }
}
function Dn(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Mn(t, e) {
  return new An(t, e);
}
function Ln(t) {
  return Mn(t, {
    stateKey: b,
    runtimeEndpointDependencies: [En],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: gn,
    buildRuntimeEvents: ({ state: e }) => [...yn(e)]
  });
}
function E(t, e) {
  if (!t)
    throw new Error(e);
}
function X(t, e, n) {
  let i = "";
  for (let r = 0; r < n; r += 1)
    i += String.fromCharCode(t.getUint8(e + r));
  return i;
}
function _n(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function le(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function lt(t) {
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
function wn() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Z(t, e) {
  const n = wn();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (_n(e))
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
  throw new Error(`Unsupported text resource payload (${lt(t)})`);
}
function kn(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return le(t);
  throw new Error(`Unsupported binary resource payload (${lt(t)})`);
}
function On(t) {
  const e = t?.frames;
  E(
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
      const l = a;
      E(l.length === 1, "Only mono wavetable source files are supported"), i[r] = Number(l[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function ct(t) {
  const e = new DataView(t);
  E(X(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), E(X(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, r = null, a = null, l = null, s = null, o = null, u = 12;
  for (; u + 8 <= e.byteLength; ) {
    const d = X(e, u, 4), m = e.getUint32(u + 4, !0), g = u + 8;
    d === "fmt " ? (n = e.getUint16(g, !0), i = e.getUint16(g + 2, !0), r = e.getUint32(g + 4, !0), l = e.getUint16(g + 12, !0), a = e.getUint16(g + 14, !0)) : d === "data" && (s = g, o = m), u = g + m + m % 2;
  }
  E(n !== null, "Wave file is missing a fmt chunk"), E(s !== null && o !== null, "Wave file is missing a data chunk"), E(i === 1, "Only mono wavetable bank files are supported");
  let c;
  if (n === 3 && a === 32)
    c = new Float32Array(t.slice(s, s + o));
  else if (n === 1 && a === 16) {
    const d = o / 2, m = new Int16Array(t.slice(s, s + o));
    c = new Float32Array(d);
    for (let g = 0; g < d; g += 1)
      c[g] = m[g] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${a}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: r ?? 0,
    bitsPerSample: a,
    blockAlign: l ?? 0,
    samples: c
  };
}
async function we(t) {
  E(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return E(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function ce(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function dt(t) {
  const e = new Uint8Array(t).buffer, n = ct(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Cn(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (o) => (E(typeof t.readResource == "function", `Resource bridge cannot read ${o}`), t.readResource(o)), r = async (o) => {
    E(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${o}`);
    const u = await t.readResourceAsAudioData(o);
    return On(u);
  }, a = (o) => {
    const u = t.getResourceAddress?.(o);
    return u ?? null;
  }, l = async (o, u = t.getResourceAddress?.(o)) => {
    const c = Z(o, u), d = await we(c), m = ct(d);
    return {
      sampleRate: m.sampleRate,
      samples: m.samples
    };
  }, s = async (o, u = t.getResourceAddress?.(o)) => {
    const c = Z(o, u);
    return new Uint8Array(await we(c));
  };
  return {
    async readText(o) {
      if (e === "bridge" && typeof t.readResource == "function")
        return _e(await i(o));
      const u = a(o);
      return e === "url" && u !== null ? ce(await s(o, u)) : typeof t.readResource == "function" ? _e(await i(o)) : ce(await s(o, u));
    },
    async readJSON(o) {
      return JSON.parse(await this.readText(o));
    },
    async readBytes(o) {
      return typeof t.readResource == "function" ? kn(await i(o)) : s(o);
    },
    async readAudio(o) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return r(o);
      const u = a(o);
      return n === "url" && u !== null ? l(o, u) : typeof t.readResourceAsAudioData == "function" ? r(o) : dt(await this.readBytes(o));
    },
    getURL(o) {
      return Z(o, t.getResourceAddress?.(o));
    }
  };
}
function Fn(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Cn(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function Nn(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, r = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, a = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(l) {
      if (e)
        return e(l);
      if (n)
        return JSON.stringify(await n(l));
      if (i)
        return ce(await i(l));
      throw new Error(`Resource client cannot read text ${l}`);
    },
    async readJSON(l) {
      return n ? n(l) : JSON.parse(await this.readText(l));
    },
    async readBytes(l) {
      if (i)
        return i(l);
      if (e)
        return le(await e(l));
      if (n)
        return le(JSON.stringify(await n(l)));
      throw new Error(`Resource client cannot read bytes ${l}`);
    },
    async readAudio(l) {
      return r ? r(l) : dt(await this.readBytes(l));
    },
    getURL(l) {
      return a ? a(l) : null;
    }
  };
}
function Pn(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Kn(t) {
  return Pn(t) ? Nn(t) : Fn(t);
}
const j = 2048;
function B(t, e) {
  if (!t)
    throw new Error(e);
}
function Un(t) {
  B(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    B(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), B(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), B(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), B(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const Bn = 2048, ut = 11, zn = 256;
function A(t, e) {
  if (!t)
    throw new Error(e);
}
function Hn(t) {
  return t > 0 && (t & t - 1) === 0;
}
const ke = /* @__PURE__ */ new Map();
function $n(t) {
  const e = ke.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let r = 0; r < t; r += 1) {
    let a = 0, l = r;
    for (let s = 0; s < n; s += 1)
      a = a << 1 | l & 1, l >>= 1;
    i[r] = a;
  }
  return ke.set(t, i), i;
}
function ft(t, e, n = !1) {
  const i = t.length;
  A(i === e.length, "FFT real and imaginary buffers must have the same length"), A(Hn(i), "FFT input length must be a power of two");
  const r = $n(i);
  for (let a = 0; a < i; a += 1) {
    const l = r[a];
    if (l <= a)
      continue;
    const s = t[a];
    t[a] = t[l], t[l] = s;
    const o = e[a];
    e[a] = e[l], e[l] = o;
  }
  for (let a = 2; a <= i; a <<= 1) {
    const l = a >> 1, s = (n ? 2 : -2) * Math.PI / a, o = Math.cos(s), u = Math.sin(s);
    for (let c = 0; c < i; c += a) {
      let d = 1, m = 0;
      for (let g = 0; g < l; g += 1) {
        const v = c + g, p = v + l, S = t[p], P = e[p], C = d * S - m * P, R = d * P + m * S, K = t[v], V = e[v];
        t[v] = K + C, e[v] = V + R, t[p] = K - C, e[p] = V - R;
        const U = d * o - m * u;
        m = d * u + m * o, d = U;
      }
    }
  }
  if (n)
    for (let a = 0; a < i; a += 1)
      t[a] /= i, e[a] /= i;
}
function mt(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let a = 0; a < e.length; a += 1)
    n += Number(e[a]) || 0;
  const i = n / Math.max(1, e.length), r = new Float32Array(e.length);
  for (let a = 0; a < e.length; a += 1)
    r[a] = (Number(e[a]) || 0) - i;
  return r;
}
function Vn(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Bn,
  maxFramesPerTable: i = zn
} = {}) {
  const r = Float32Array.from(t);
  A(r.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const a = r.length / n;
  A(a > 0, "Source wavetable files must contain at least one frame"), A(a <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && A(a === e, `Source wavetable frame count mismatch: expected ${e}, got ${a}`);
  const l = [];
  for (let s = 0; s < a; s += 1) {
    const o = s * n, u = o + n;
    l.push(mt(r.slice(o, u)));
  }
  return {
    frameCount: a,
    frames: l
  };
}
function Oe(t) {
  const e = mt(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return ft(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function qn(t, e, {
  mipLevelCount: n = ut
} = {}) {
  const i = t?.real?.length ?? 0;
  A(i > 0, "Spectrum must contain real samples"), A(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), A(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const r = Math.min(1 << e, i >> 1), a = new Float64Array(i), l = new Float64Array(i);
  for (let s = 1; s <= r; s += 1) {
    a[s] = t.real[s], l[s] = t.imaginary[s];
    const o = (i - s) % i;
    o !== s && (a[o] = t.real[o], l[o] = t.imaginary[o]);
  }
  return ft(a, l, !0), Float32Array.from(a);
}
const ve = ["A", "B", "C"], ht = [
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
], Wn = [
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
], O = Object.freeze([
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
]), Gn = Object.freeze([
  ...ve.flatMap((t) => ht.map(
    (e) => `osc${t}.${e}`
  )),
  ...Wn
]);
new Set(
  ve.flatMap((t) => ht.map(
    (e) => `osc${t}.${e}`
  ))
);
const pt = Object.freeze(
  Gn.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), jn = Qe().filter((t) => t.modulationTargetIndex !== null), Jn = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function ye(t) {
  const e = Qn(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function Qn(t) {
  const e = Jn.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const gt = Object.freeze(
  [
    ...jn.map((t) => ({
      // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
      // and indexes are both minted only by the rack descriptor catalog.
      kind: ye(Ie(t)),
      group: "rack",
      runtimeIndex: t.modulationTargetIndex
    })).sort((t, e) => t.runtimeIndex - e.runtimeIndex),
    { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
    { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
  ]
), _ = Object.freeze([
  ...pt,
  ...gt
]), J = O.length, Yn = pt.length, Xn = gt.length, Zn = J * _.length, ei = new Map(O.map((t) => [t.id, t])), ti = new Map(O.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), Se = new Map(_.map((t) => [t.kind, t]));
function ni() {
  if (J !== 14 || Yn !== 59 || Xn !== 39 || Zn !== 1372)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = O.filter((i) => i.group === t).sort((i, r) => i.runtimeIndex - r.runtimeIndex);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 59], ["rack", 39]]) {
    const n = _.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, r) => i.runtimeIndex !== r))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (ei.size !== J || ti.size !== J || Se.size !== _.length)
    throw new Error("Modulation identities must be unique");
}
ni();
function ii(t) {
  return typeof t != "string" ? null : Se.has(t) ? t : null;
}
function ai(t) {
  const e = ii(t);
  return e !== null && Se.get(e)?.group === "rack" ? e : null;
}
const ri = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), oi = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function si(t) {
  if (typeof t != "string")
    return null;
  const e = oi.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = ri.get(n);
  if (i === void 0)
    return null;
  const r = e[3];
  return i.includes(r) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: r
  } : null;
}
function li(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function ci(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
O.filter((t) => t.group === "voice").length;
O.filter((t) => t.group === "macro").length;
function di(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function ui(t) {
  throw new Error(t ?? "Invariant violated");
}
const fi = "globalTune", mi = "globalTuneSemitones", L = -24, z = 24, Ce = 0, hi = -48, pi = 48, Fe = -48, gi = 6, Ii = 0, Ne = (Ii - Fe) / (gi - Fe);
function W(t, e, n, i, r = "percent", a = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: r, compound: a };
}
const bi = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      W("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      W("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      W("mix", "Mix", 100, 100),
      W("drive", "Drive", 15, 0)
    ]
  }
], Pe = 1e-6;
function x(t, e) {
  if (!Number.isFinite(t) || t < -Pe || t > 1 + Pe)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function Q(t, e) {
  return x(t / 100, `${e} catalog percentage`);
}
function $(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function vi(t) {
  return 20 * 1e3 ** t;
}
function yi(t) {
  return x(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Si(t) {
  return 0.1 * 200 ** t;
}
function Ti(t) {
  return x(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Ei(t) {
  return t;
}
function xi(t) {
  return x(t, "filterMix endpoint conversion");
}
function N(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function Ri(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: N("filterCutoff", vi, yi),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: N("filterQ", Si, Ti),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: N("filterMix", Ei, xi),
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
function It(t) {
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
      return di(t);
  }
}
function Ai(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Di(t, e) {
  const n = $(t.moduleId, e.id), i = It(e.format), r = Ri(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: Q(e.defaultPercent, n),
    initialValue: Q(e.initialPercent, n),
    format: i,
    modAmount: Ai(i),
    binding: r.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: r.articulationParameterId,
    modulationTargetKind: r.modulationTargetKind
  });
}
const Mi = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Ne * 100, defaultPercent: Ne * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Li(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function _i(t, e) {
  const n = `osc${t}`, i = $(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: Q(e.defaultPercent, i),
    initialValue: Q(e.initialPercent, i),
    format: It(e.format),
    modAmount: Li(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const wi = Object.freeze(
  ve.flatMap((t) => Mi.map((e) => _i(t, e)))
), ki = Object.freeze({
  targetId: $("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: x(
    (Ce - L) / (z - L),
    "Global Tune default"
  ),
  initialValue: x(
    (Ce - L) / (z - L),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: z },
  modAmount: {
    min: hi,
    max: pi,
    unit: "st",
    digits: 2
  },
  binding: N(
    fi,
    (t) => L + (z - L) * t,
    (t) => x(
      (t - L) / (z - L),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: mi
});
function Oi(t) {
  const e = $("voice-enhancer", t.key), n = x(
    xe(t, t.initial),
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
    binding: N(
      t.endpointID,
      (i) => sn(t, i),
      (i) => x(
        xe(t, i),
        `${t.endpointID} endpoint conversion`
      )
    ),
    isQuick: !1,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: t.targetKind
  });
}
const Ci = Object.freeze(
  Object.values(on).map(Oi)
), Fi = Object.freeze([
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
function Ni(t) {
  const e = $(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (a) => t.min + n * a, r = (a) => x(
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
    binding: N(t.endpointID, i, r),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const Pi = Object.freeze(
  Fi.map(Ni)
), Ki = Object.freeze([
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
function Ui(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function ee(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return x(n, `${t.endpointID} endpoint conversion`);
}
function Bi(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function zi(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Hi(t) {
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
function $i(t) {
  const e = Ui(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: ee(t, t.initial),
    initialValue: ee(t, t.initial),
    format: zi(t),
    modAmount: Hi(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Bi(t, n),
      fromEngine: (n) => ee(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : ye(Ie(t))
  });
}
const Te = Object.freeze(
  [
    ...Y.flatMap((t) => t.parameters.map($i)),
    ...Ki,
    ki,
    ...Ci,
    ...wi,
    ...Pi,
    ...bi.flatMap(
      (t) => t.parameters.map(
        (e) => Di(t, e)
      )
    )
  ]
), Vi = new Map(
  Te.map((t) => [t.targetId, t])
), bt = Te.filter(
  (t) => t.modulationTargetKind !== null
), de = new Map(
  bt.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Vi.size !== Te.length)
  throw new Error("Target descriptor IDs must be unique");
if (bt.length !== _.length || de.size !== _.length || _.some((t) => de.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function te(t) {
  const e = de.get(t);
  return e === void 0 ? ui(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  Y.map((t) => [t.id, t.label])
);
function qi(t) {
  const e = ci(t);
  return e === 1 ? "" : ` ${e}`;
}
function Wi(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = te(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = si(t);
  if (n !== null) {
    const i = te(li(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : i.moduleId.toUpperCase()}${qi(n)} ${i.label.toUpperCase()}`;
  }
  return te(t).label.toUpperCase();
}
const Gi = Qe().filter((t) => t.modulationTargetIndex !== null);
new Map(
  Gi.map((t) => [
    ye(Ie(t)),
    t
  ])
);
const ji = {
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
O.map((t) => ({
  value: t.id,
  label: ji[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const Ji = _.map((t) => ({
  value: t.kind,
  label: Wi(t.kind)
}));
Ji.filter((t) => !Qi(t.value));
function Qi(t) {
  return ai(t) !== null;
}
const Yi = [
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
], Xi = [
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
  Yi.map((t, e) => [t, 2 ** e])
);
Object.fromEntries(
  Xi.map((t, e) => [t, 2 ** e])
);
const Zi = "runtimeSyncRequest", ea = 2147483647, ta = "runtimeState", na = "retryDesiredTableRequest", ia = "workerLoadFailure", aa = "serviceLoadAbort", ra = "wavetableLoadBegin", oa = "wavetableMipFrame", sa = "wavetableUploadAck", la = "wavetableMipRequest", ca = "wavetablePrewarmRequest", da = "wavetablePrewarmNotification", ua = "assets/factory-bank-catalog.json", ue = 3, fa = 1, ma = ue * j, ha = 1, pa = 2, ga = 3, Ia = 1, ba = 2, va = 2e4, G = ha, ya = pa, Ke = ga, w = Ia, Ue = ba, Sa = 48 * 1024 * 1024, ne = 3;
function Be(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function I(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function ze(t) {
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
function He(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function $e(t, e) {
  if (!t)
    throw new Error(e);
}
function Ta(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function Ea(t, e) {
  return Un(await t.readJSON(e));
}
function xa(t) {
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
function Ra(t, e) {
  const n = Math.round(Number(t) || 0);
  return Ta(n, 0, Math.max(0, e - 1));
}
function ie(t, e, n, i, r) {
  return `${t}:${e}:${n}:${i}:${r}`;
}
function Aa(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function Ve(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function qe(t) {
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
function Da(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class Ma {
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
    this.connection = e, this.resourceClient = Kn(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? ua, this.maxBatchesInFlight = Be(
      n.maxFramesInFlight,
      fa
    ), this.mipLevelCount = n.mipLevelCount ?? ut, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? Sa) || 0)), this.serviceLoadTimeoutMs = Be(n.serviceLoadTimeoutMs, va), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, I("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(ta, this.handleRuntimeState), this.connection.addEndpointListener?.(sa, this.handleUploadAck), this.connection.addEndpointListener?.(la, this.handleMipRequest), this.connection.addEndpointListener?.(ca, this.handlePrewarmRequest), this.connection.addEndpointListener?.(da, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Zi,
      ea
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Ea(this.resourceClient, this.catalogPath), I("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < ne; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = Ve(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: Ve(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = ie(
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
          ...qe(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== r || !this.serviceLoadHasPendingTransfers()) && (I("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: Ke,
          failureReasonCode: Ue
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== Ke || e.failureReasonCode !== Ue ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: r = 0,
    candidateAttemptSerial: a = 0,
    failurePhase: l = G,
    failureReasonCode: s = w
  }) {
    this.connection.sendEventOrValue?.(ia, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: i,
      generation: r,
      candidateAttemptSerial: a,
      failurePhase: l,
      failureReasonCode: s
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: i,
    tableIndex: r,
    failureReasonCode: a = w
  }) {
    this.connection.sendEventOrValue?.(aa, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: r,
      failureReasonCode: a
    });
  }
  emitRetryDesiredTableRequest(e) {
    I("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? ze(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(na, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), r = Ra(e, i.tables.length), a = i.tables[r];
    $e(a, `Could not resolve table ${r}`);
    const l = Aa(a, j, this.mipLevelCount), s = this.tableCache.get(l);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, I("info", "Using cached wavetable source table", {
        tableIndex: r,
        tableId: a.tableId,
        tableName: a.name,
        sourceWav: a.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const o = We();
    I("info", "Reading wavetable source", {
      tableIndex: r,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n
    });
    const u = await this.resourceClient.readAudio(a.sourceWav), c = Vn(u.samples, {
      expectedFrameCount: n === void 0 ? Number(a.frameCount) : n,
      samplesPerFrame: j
    });
    return I("info", "Prepared wavetable source table", {
      tableIndex: r,
      tableId: a.tableId,
      tableName: a.name,
      sourceWav: a.sourceWav,
      frameCount: c.frameCount,
      loadDurationMs: Math.round(We() - o)
    }), this.rememberLoadedTable({
      cacheKey: l,
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
    I("info", "Committing desired wavetable load", {
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(ra, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    I("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: G,
      failureReasonCode: w
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: G,
      failureReasonCode: w
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = G,
    failureReasonCode: i = w
  } = {}) {
    I("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (I("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: ae(a)
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
    } catch (l) {
      this.isCurrentRuntimeState(e) && (I("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: ae(l)
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
    for (let e = 0; e < ne; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, Da(() => {
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
        I("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: w
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
    const n = xa(e ?? {});
    if (I("info", "Received runtime state", ze(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= ne)
      return;
    const i = n.dspSessionId !== this.knownSessionId;
    i && this.resetSessionState(n);
    const r = n.oscillatorIndex, a = this.latestRuntimeStates[r], l = a ? this.getDesiredRetryKey(a) : null, s = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[r] = Math.max(
      this.nextLoadGenerations[r] ?? 1,
      n.generationFrontier + 1
    ), (i || l !== s) && (this.autoRetryConsumedKeys[r] = null), this.latestRuntimeStates[r] = n, this.pendingRuntimeStateOscillators.add(r), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(i))
      try {
        const r = await this.loadTableSource(i);
        for (let l = 0; l < r.frameCount; l += 1)
          r.spectra[l] || (r.spectra[l] = Oe(r.frames[l]));
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
          detail: ae(r)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), r = Math.trunc(Number(e?.generation)), a = Math.trunc(Number(e?.tableIndex)), l = Math.trunc(Number(e?.mipIndex)), s = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || r !== this.serviceTable.generation || a !== this.serviceTable.tableIndex || l < 0 || l >= this.mipLevelCount)
      return null;
    const o = ie(
      n,
      i,
      r,
      a,
      l
    );
    let u = this.mipJobs.get(o);
    return u ? (!u.completed && s > u.urgencyLevel && (u.urgencyLevel = s), u) : (u = {
      key: o,
      dspSessionId: n,
      oscillatorIndex: i,
      generation: r,
      tableIndex: a,
      mipIndex: l,
      urgencyLevel: s,
      ...qe(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(o, u), u);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
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
  handleUploadAck(e) {
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), r = Math.trunc(Number(n.oscillatorIndex)), a = Math.trunc(Number(n.generation)), l = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), o = Math.trunc(Number(n.frameIndexBase)), u = Math.trunc(Number(n.frameCount)), c = ie(
      i,
      r,
      a,
      l,
      s
    ), d = this.mipJobs.get(c), m = this.serviceTable?.frameCount ?? 0, g = Math.min(
      ue,
      m - o
    );
    if (!(!d || d.completed || !d.inFlightBatchBases.has(o) || u <= 0 || u !== g)) {
      d.inFlightBatchBases.delete(o);
      for (let v = 0; v < u; v += 1) {
        const p = o + v;
        d.ackedFrames[p] || (d.ackedFrames[p] = 1, d.ackedFrameCount += 1);
      }
      d.ackedFrameCount === m && d.nextFrameIndex >= m && d.inFlightBatchBases.size === 0 && (d.completed = !0, this.activeUploadKey === d.key && (this.activeUploadKey = null)), He(o, u, m) && I("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: r,
        generation: a,
        tableIndex: d.tableIndex,
        mipIndex: s,
        frameIndexBase: o,
        batchFrameCount: u,
        ackedFrameCount: d.ackedFrameCount,
        frameCount: m,
        inFlightBatches: d.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if ($e(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = Oe(this.serviceTable.frames[e]);
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
        ue,
        this.serviceTable.frameCount - n
      ), r = new Float32Array(ma);
      try {
        for (let a = 0; a < i; a += 1) {
          const l = n + a, s = this.getSpectrumForFrame(l), o = qn(s, e.mipIndex);
          r.set(o, a * j);
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
            failurePhase: ya,
            failureReasonCode: w
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(oa, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(r)
      }), He(n, i, this.serviceTable.frameCount) && I("info", "Sent wavetable mip batch", {
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
function ae(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function La(t, e = {}) {
  return new Ma(t, e);
}
async function _a(t, e = {}) {
  return St(t, [
    Ln,
    () => La(t, e)
  ]);
}
export {
  _a as default
};
