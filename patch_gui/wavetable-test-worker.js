class It {
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
          } catch (a) {
            n.push(a);
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
function bt(t, e) {
  return new It(t, e);
}
async function vt(t, e) {
  const n = bt(t, e);
  return await n.start(), n;
}
const qe = 12, fe = 5, Ge = 8, yt = Object.freeze({
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
}), St = Object.freeze([
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
]), Tt = Object.freeze({
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
function xt(t) {
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
    const o = Tt[l];
    if (o === void 0)
      throw new Error(`Missing lane parameter value: ${t}.${l}`);
    n[l] = o;
  }
  const i = he.chorus, a = Object.keys(e);
  return t === "chorus" && a.length === i.length && a.every((l) => i.includes(l)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = xt(
    Number(e.chorusRingOffsetMode)
  ) + Number(e.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function Et(t) {
  return me[t];
}
function Rt(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= fe)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * Ge + yt[t];
}
function At(t, e) {
  const n = new Array(qe).fill(0), i = pe(t, e);
  return me[t].forEach((a, r) => {
    n[r] = i[a];
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
}), f = (t, e, n, i, a, r, l, s = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: a,
  max: r,
  initial: l,
  step: s.step ?? (r - a) / 1e3,
  scale: s.scale ?? "linear",
  unit: s.unit ?? "",
  choices: s.choices,
  quick: s.quick ?? !1,
  modulationTargetIndex: s.modulationTargetIndex ?? null,
  modulationApplication: s.modulationApplication ?? (s.modulationTargetIndex === void 0 || s.modulationTargetIndex === null ? null : "linear"),
  modulationIdentityEndpointID: s.modulationIdentityEndpointID,
  modulationDragStyle: s.modulationDragStyle
}), Dt = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Mt = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Lt = [
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
      f("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: Dt.map(y) }),
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
      f("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Mt.map(y) }),
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
], Q = Lt, je = Object.freeze(
  Q.flatMap((t) => t.parameters)
);
new Map(
  je.map((t) => [t.endpointID, t])
);
function ge(t) {
  const e = Q.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function Je() {
  return je;
}
function Ie(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const b = "lane.v1", wt = "laneTopology", xe = "laneSlotParams", kt = "laneOutputControl", ae = 16, _t = 8, Qe = 4, Ot = 3, Ye = fe * Ge, Xe = 4, Ft = 4, Ct = Ye, Nt = Ye + Xe, Pt = 0, Kt = 1, Ut = 2, Bt = 3, $t = 4, zt = 5;
function Ht(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > Qe)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << _t;
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
]), z = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), Vt = new Map(
  Object.entries(z).map(([t, e]) => [e, t])
), Wt = Object.freeze({
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
  T.map((t) => [Wt[t], t])
);
function Ze() {
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
function qt(t) {
  return Object.fromEntries(
    ge(t).parameters.map((e) => [e.endpointID, e.initial])
  );
}
function Gt() {
  return {
    format: "cosimo.lane",
    version: 1,
    order: [...T],
    enabled: Ze(),
    params: Object.fromEntries(
      T.map((t) => [t, qt(t)])
    )
  };
}
function jt(t) {
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
function V(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Jt(t) {
  return typeof t != "string" ? null : T.find((e) => e === t) ?? null;
}
function Qt(t) {
  const e = jt(t);
  if (e._tag === "err")
    return e;
  if (!V(e.value))
    return { _tag: "err", message: `${b} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled", "params"]);
  for (const s of Reflect.ownKeys(e.value))
    if (typeof s != "string" || !n.has(s))
      return { _tag: "err", message: `${b} has unexpected field ${String(s)}` };
  if (e.value.format !== "cosimo.lane" || e.value.version !== 1)
    return { _tag: "err", message: `${b} must be cosimo.lane version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== T.length)
    return { _tag: "err", message: `${b}.order must contain every effect once` };
  const i = [], a = /* @__PURE__ */ new Set();
  for (const s of e.value.order) {
    const o = Jt(s);
    if (o === null || a.has(o))
      return { _tag: "err", message: `${b}.order is not a complete permutation` };
    a.add(o), i.push(o);
  }
  if (!V(e.value.enabled))
    return { _tag: "err", message: `${b}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== T.length)
    return { _tag: "err", message: `${b}.enabled must contain every effect once` };
  const r = Ze();
  for (const s of T) {
    const o = e.value.enabled[s];
    if (typeof o != "boolean")
      return { _tag: "err", message: `${b}.enabled.${s} must be boolean` };
    r[s] = o;
  }
  if (!V(e.value.params))
    return { _tag: "err", message: `${b}.params must be an object` };
  if (Reflect.ownKeys(e.value.params).length !== T.length)
    return { _tag: "err", message: `${b}.params must contain every effect once` };
  const l = {};
  for (const s of T) {
    const o = e.value.params[s];
    if (!V(o))
      return { _tag: "err", message: `${b}.params.${s} must be an object` };
    const c = ge(s).parameters.map((p) => p.endpointID), d = he[z[s]], m = Reflect.ownKeys(o), g = (p) => m.length === p.length && m.every((S) => typeof S == "string" && p.includes(S));
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
    value: { format: "cosimo.lane", version: 1, order: i, enabled: r, params: l }
  };
}
const Yt = Object.freeze([
  "voice.filterCutoff",
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
]), Xt = Object.freeze({
  "voice.filterCutoff": "filter-frequency",
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
  Yt.map((t) => [t, Object.freeze({
    id: t,
    family: Xt[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const et = 40, tt = 18e3, oe = T.map((t) => z[t]), Zt = /^([a-zA-Z]+)#([1-9][0-9]*)$/, en = /^(parallel|split)#([1-9][0-9]*)$/;
function be(t) {
  if (typeof t != "string")
    return null;
  const e = Zt.exec(t);
  if (e === null)
    return null;
  const n = oe.find((a) => a === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > fe ? null : { deviceType: n, instanceNumber: i };
}
function nt(t) {
  if (typeof t != "string")
    return null;
  const e = en.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? Xe : Ft) ? null : { groupKind: n, unitNumber: i };
}
function _(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function C(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function h(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function tn(t, e) {
  const n = be(t);
  if (n === null)
    return { failure: h(`device id ${t} is not a pool instance`) };
  if (!_(e) || !C(e, ["params"]) || !_(e.params))
    return { failure: h(`device ${t} must be { params }`) };
  const i = Et(n.deviceType), a = he[n.deviceType], r = Vt.get(n.deviceType);
  if (r === void 0)
    return { failure: h(`device ${t} has no effect descriptor`) };
  const l = ge(r).parameters.map((d) => d.endpointID), s = e.params, o = Object.keys(s), u = (d) => o.length === d.length && o.every((m) => d.includes(m));
  if (!(u(i) || u(a) || n.deviceType === "chorus" && u(St) || u(l)))
    return { failure: h(`device ${t} must carry every parameter once`) };
  for (const d of o) {
    const m = s[d];
    if (typeof m != "number" || !Number.isFinite(m))
      return { failure: h(`device ${t}.${d} must be a finite number`) };
  }
  return { record: { params: pe(n.deviceType, s) } };
}
function nn(t, e) {
  return !_(t) || t.kind !== "device" ? { failure: h("branches may hold device placements only") } : C(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: h(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: h(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: h("a device placement is { kind, deviceId, enabled }") };
}
function Ee(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= et && t <= tt;
}
function it() {
  return { mix: 1, bypassed: !1 };
}
function rn(t) {
  return !_(t) || !C(t, ["mix", "bypassed"]) || typeof t.mix != "number" || !Number.isFinite(t.mix) || t.mix < 0 || t.mix > 1 || typeof t.bypassed != "boolean" ? null : { mix: t.mix, bypassed: t.bypassed };
}
function an(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (c) {
      const d = c instanceof Error ? c.message : String(c);
      return h(`is not valid JSON: ${d}`);
    }
  if (!_(e) || !C(e, ["format", "version", "output", "devices", "chain"]))
    return h("must be { format, version, output, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return h("must be cosimo.lane version 2");
  if (!_(e.devices))
    return h("devices must be an object");
  if (!Array.isArray(e.chain))
    return h("chain must be an array");
  const n = rn(e.output);
  if (n === null)
    return h("output must be { mix: 0..1, bypassed: boolean }");
  const i = {};
  for (const c of Reflect.ownKeys(e.devices)) {
    if (typeof c != "string")
      return h("device ids must be strings");
    const d = tn(c, e.devices[c]);
    if ("failure" in d)
      return d.failure;
    i[c] = d.record;
  }
  const a = new Set(Object.keys(i)), r = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Set(), s = [];
  let o = 0;
  const u = (c) => {
    const d = nn(c, a);
    return "placement" in d && (r.set(
      d.placement.deviceId,
      (r.get(d.placement.deviceId) ?? 0) + 1
    ), o += 1), d;
  };
  for (const c of e.chain) {
    if (!_(c))
      return h("chain nodes must be objects");
    if (c.kind === "device") {
      const E = u(c);
      if ("failure" in E)
        return E.failure;
      s.push(E.placement);
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
    ] : ["kind", "groupId", "enabled", "branches"], p = d && C(c, m);
    if (!C(c, v) && !p)
      return h(`a ${c.kind} group is { ${v.join(", ")} }`);
    const S = nt(c.groupId);
    if (S === null || S.groupKind !== c.kind)
      return h(`group id ${String(c.groupId)} does not name a ${c.kind} unit`);
    if (l.has(String(c.groupId)))
      return h(`group ${String(c.groupId)} is used twice`);
    if (l.add(String(c.groupId)), typeof c.enabled != "boolean")
      return h(`group ${String(c.groupId)} needs a boolean enable`);
    const N = d ? Ot : Qe;
    if (!Array.isArray(c.branches) || c.branches.length < 2 || c.branches.length > N)
      return h(`group ${String(c.groupId)} needs 2..${N} branches`);
    if (d && (!Ee(c.xoverLowHz) || !Ee(c.xoverHighHz)))
      return h(`group ${String(c.groupId)} crossovers must sit in ${et}..${tt} Hz`);
    if (d && !p && (typeof c.xoverLowKeyTrackEnabled != "boolean" || typeof c.xoverHighKeyTrackEnabled != "boolean" || typeof c.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverLowKeyTrackOffsetSemitones) || typeof c.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(c.xoverHighKeyTrackOffsetSemitones)))
      return h(`group ${String(c.groupId)} Key Track state must be finite`);
    o += 1;
    const F = [];
    for (const E of c.branches) {
      if (!Array.isArray(E))
        return h(`group ${String(c.groupId)} branches must be arrays`);
      const P = [];
      for (const H of E) {
        const K = u(H);
        if ("failure" in K)
          return K.failure;
        P.push(K.placement);
      }
      F.push(P);
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
      branches: F
    } : {
      kind: "parallel",
      groupId: String(c.groupId),
      enabled: c.enabled,
      branches: F
    });
  }
  for (const c of a)
    if ((r.get(c) ?? 0) !== 1)
      return h(`device ${c} must be placed exactly once`);
  return o > ae ? h(`flattens to ${o} wire entries; the topology upload holds ${ae}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, output: n, devices: i, chain: s } };
}
function rt(t) {
  const e = {};
  for (const n of T) {
    const i = z[n];
    e[`${i}#1`] = {
      params: pe(i, t.params[n])
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: it(),
    devices: e,
    chain: t.order.map((n) => ({
      kind: "device",
      deviceId: `${z[n]}#1`,
      enabled: t.enabled[n]
    }))
  };
}
const Re = ["distortion#1", "delay#1", "reverb#1"];
function Ae() {
  const t = rt(Gt()), e = {};
  for (const n of Re) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The v1 default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    output: it(),
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && Re.includes(n.deviceId))
  };
}
function on(t) {
  if (t === void 0)
    return Ae();
  const e = an(t);
  if (e._tag === "ok")
    return e.value;
  const n = Qt(t);
  return n._tag === "ok" ? rt(n.value) : Ae();
}
function sn(t) {
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
  return Rt(e.deviceType, e.instanceNumber - 1);
}
function at(t) {
  const e = nt(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? Ct : Nt) + (e.unitNumber - 1);
}
function ln(t) {
  const e = new Array(ae).fill(0);
  let n = 0, i = 0;
  const a = (r, l, s) => {
    e[i] = Ht(r, l), s && (n |= 1 << i), i += 1;
  };
  for (const r of t.chain) {
    if (r.kind === "device") {
      a(se(r.deviceId), 0, r.enabled);
      continue;
    }
    a(at(r), r.branches.length, r.enabled), r.branches.forEach((l, s) => {
      for (const o of l)
        a(se(o.deviceId), s + 1, o.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function cn(t) {
  const e = new Array(qe).fill(0);
  return e[Pt] = t.xoverLowHz, e[Kt] = t.xoverHighHz, e[Ut] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[Bt] = t.xoverLowKeyTrackOffsetSemitones, e[$t] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[zt] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function dn(t) {
  const e = [{
    endpointID: kt,
    value: t.output
  }];
  let n = 0;
  for (const i of sn(t))
    n += 1, e.push({
      endpointID: xe,
      value: {
        slotId: se(i.instanceId),
        deliverySerial: n,
        values: At(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: xe,
      value: {
        slotId: at(i),
        deliverySerial: n,
        values: cn(i)
      }
    }));
  return e.push({
    endpointID: wt,
    value: ln(t)
  }), e;
}
const un = "runtimeState";
function fn(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const mn = {
  endpointID: un,
  required: !0,
  mapValue: fn
}, hn = 2e3;
function De(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function pn(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return De(i, e) ? {
    found: !0,
    value: i[e]
  } : De(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function Me(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class gn {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = In(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = pn(e, this.options.stateKey);
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
    const i = (a) => {
      this.parameterValues.set(e, a), this.applyRuntimeStateIfReady();
    };
    return this.parameterListeners.set(e, i), i;
  }
  getRuntimeEndpointListener(e) {
    const n = this.runtimeEndpointListeners.get(e.endpointID);
    if (n)
      return n;
    const i = (a) => {
      const r = e.mapValue ? e.mapValue(a) : a;
      this.runtimeEndpointValues.set(e.endpointID, r), this.applyRuntimeStateIfReady();
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
    }, a = Me(n), r = !this.forceFullReplay && a === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, l = this.options.buildRuntimeEvents(i, r), s = Me({
      runtimeEndpoints: n,
      events: l
    });
    if (s === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i;
      return;
    }
    if (l.length === 0) {
      this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(l, i).then((o) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        o ? (this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(l);
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
        this.options.sendTimeoutMilliseconds ?? hn
      );
    this.lastAppliedToken = s, this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i;
  }
}
function In(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function bn(t, e) {
  return new gn(t, e);
}
function vn(t) {
  return bn(t, {
    stateKey: b,
    runtimeEndpointDependencies: [mn],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: on,
    buildRuntimeEvents: ({ state: e }) => [...dn(e)]
  });
}
function x(t, e) {
  if (!t)
    throw new Error(e);
}
function X(t, e, n) {
  let i = "";
  for (let a = 0; a < n; a += 1)
    i += String.fromCharCode(t.getUint8(e + a));
  return i;
}
function yn(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function le(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function ot(t) {
  if (t === null)
    return "null";
  if (t === void 0)
    return "undefined";
  const e = typeof t, n = t?.constructor?.name;
  if (e !== "object")
    return n ? `${e}:${n}` : e;
  const i = Object.keys(t).slice(0, 6), a = i.length > 0 ? ` keys=${i.join(",")}` : "";
  return n ? `${e}:${n}${a}` : `${e}${a}`;
}
function Sn() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function Z(t, e) {
  const n = Sn();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (yn(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function Le(t) {
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
  throw new Error(`Unsupported text resource payload (${ot(t)})`);
}
function Tn(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return le(t);
  throw new Error(`Unsupported binary resource payload (${ot(t)})`);
}
function xn(t) {
  const e = t?.frames;
  x(
    Array.isArray(e) || ArrayBuffer.isView(e),
    "Decoded audio data must provide a frames array"
  );
  const n = Array.from(e), i = new Float32Array(n.length);
  for (let a = 0; a < n.length; a += 1) {
    const r = n[a];
    if (typeof r == "number") {
      i[a] = r;
      continue;
    }
    if (ArrayBuffer.isView(r) || Array.isArray(r)) {
      const l = r;
      x(l.length === 1, "Only mono wavetable source files are supported"), i[a] = Number(l[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function st(t) {
  const e = new DataView(t);
  x(X(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), x(X(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, a = null, r = null, l = null, s = null, o = null, u = 12;
  for (; u + 8 <= e.byteLength; ) {
    const d = X(e, u, 4), m = e.getUint32(u + 4, !0), g = u + 8;
    d === "fmt " ? (n = e.getUint16(g, !0), i = e.getUint16(g + 2, !0), a = e.getUint32(g + 4, !0), l = e.getUint16(g + 12, !0), r = e.getUint16(g + 14, !0)) : d === "data" && (s = g, o = m), u = g + m + m % 2;
  }
  x(n !== null, "Wave file is missing a fmt chunk"), x(s !== null && o !== null, "Wave file is missing a data chunk"), x(i === 1, "Only mono wavetable bank files are supported");
  let c;
  if (n === 3 && r === 32)
    c = new Float32Array(t.slice(s, s + o));
  else if (n === 1 && r === 16) {
    const d = o / 2, m = new Int16Array(t.slice(s, s + o));
    c = new Float32Array(d);
    for (let g = 0; g < d; g += 1)
      c[g] = m[g] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${r}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: a ?? 0,
    bitsPerSample: r,
    blockAlign: l ?? 0,
    samples: c
  };
}
async function we(t) {
  x(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return x(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function ce(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function lt(t) {
  const e = new Uint8Array(t).buffer, n = st(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function En(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (o) => (x(typeof t.readResource == "function", `Resource bridge cannot read ${o}`), t.readResource(o)), a = async (o) => {
    x(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${o}`);
    const u = await t.readResourceAsAudioData(o);
    return xn(u);
  }, r = (o) => {
    const u = t.getResourceAddress?.(o);
    return u ?? null;
  }, l = async (o, u = t.getResourceAddress?.(o)) => {
    const c = Z(o, u), d = await we(c), m = st(d);
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
        return Le(await i(o));
      const u = r(o);
      return e === "url" && u !== null ? ce(await s(o, u)) : typeof t.readResource == "function" ? Le(await i(o)) : ce(await s(o, u));
    },
    async readJSON(o) {
      return JSON.parse(await this.readText(o));
    },
    async readBytes(o) {
      return typeof t.readResource == "function" ? Tn(await i(o)) : s(o);
    },
    async readAudio(o) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return a(o);
      const u = r(o);
      return n === "url" && u !== null ? l(o, u) : typeof t.readResourceAsAudioData == "function" ? a(o) : lt(await this.readBytes(o));
    },
    getURL(o) {
      return Z(o, t.getResourceAddress?.(o));
    }
  };
}
function Rn(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return En(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function An(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, a = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, r = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
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
      return a ? a(l) : lt(await this.readBytes(l));
    },
    getURL(l) {
      return r ? r(l) : null;
    }
  };
}
function Dn(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Mn(t) {
  return Dn(t) ? An(t) : Rn(t);
}
const G = 2048;
function U(t, e) {
  if (!t)
    throw new Error(e);
}
function Ln(t) {
  U(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    U(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), U(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), U(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), U(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const wn = 2048, ct = 11, kn = 256;
function R(t, e) {
  if (!t)
    throw new Error(e);
}
function _n(t) {
  return t > 0 && (t & t - 1) === 0;
}
const ke = /* @__PURE__ */ new Map();
function On(t) {
  const e = ke.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let a = 0; a < t; a += 1) {
    let r = 0, l = a;
    for (let s = 0; s < n; s += 1)
      r = r << 1 | l & 1, l >>= 1;
    i[a] = r;
  }
  return ke.set(t, i), i;
}
function dt(t, e, n = !1) {
  const i = t.length;
  R(i === e.length, "FFT real and imaginary buffers must have the same length"), R(_n(i), "FFT input length must be a power of two");
  const a = On(i);
  for (let r = 0; r < i; r += 1) {
    const l = a[r];
    if (l <= r)
      continue;
    const s = t[r];
    t[r] = t[l], t[l] = s;
    const o = e[r];
    e[r] = e[l], e[l] = o;
  }
  for (let r = 2; r <= i; r <<= 1) {
    const l = r >> 1, s = (n ? 2 : -2) * Math.PI / r, o = Math.cos(s), u = Math.sin(s);
    for (let c = 0; c < i; c += r) {
      let d = 1, m = 0;
      for (let g = 0; g < l; g += 1) {
        const v = c + g, p = v + l, S = t[p], N = e[p], F = d * S - m * N, E = d * N + m * S, P = t[v], H = e[v];
        t[v] = P + F, e[v] = H + E, t[p] = P - F, e[p] = H - E;
        const K = d * o - m * u;
        m = d * u + m * o, d = K;
      }
    }
  }
  if (n)
    for (let r = 0; r < i; r += 1)
      t[r] /= i, e[r] /= i;
}
function ut(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let r = 0; r < e.length; r += 1)
    n += Number(e[r]) || 0;
  const i = n / Math.max(1, e.length), a = new Float32Array(e.length);
  for (let r = 0; r < e.length; r += 1)
    a[r] = (Number(e[r]) || 0) - i;
  return a;
}
function Fn(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = wn,
  maxFramesPerTable: i = kn
} = {}) {
  const a = Float32Array.from(t);
  R(a.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const r = a.length / n;
  R(r > 0, "Source wavetable files must contain at least one frame"), R(r <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && R(r === e, `Source wavetable frame count mismatch: expected ${e}, got ${r}`);
  const l = [];
  for (let s = 0; s < r; s += 1) {
    const o = s * n, u = o + n;
    l.push(ut(a.slice(o, u)));
  }
  return {
    frameCount: r,
    frames: l
  };
}
function _e(t) {
  const e = ut(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return dt(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function Cn(t, e, {
  mipLevelCount: n = ct
} = {}) {
  const i = t?.real?.length ?? 0;
  R(i > 0, "Spectrum must contain real samples"), R(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), R(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const a = Math.min(1 << e, i >> 1), r = new Float64Array(i), l = new Float64Array(i);
  for (let s = 1; s <= a; s += 1) {
    r[s] = t.real[s], l[s] = t.imaginary[s];
    const o = (i - s) % i;
    o !== s && (r[o] = t.real[o], l[o] = t.imaginary[o]);
  }
  return dt(r, l, !0), Float32Array.from(r);
}
const ve = ["A", "B", "C"], ft = [
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
], Nn = [
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
  "ampRelease"
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
]), Pn = Object.freeze([
  ...ve.flatMap((t) => ft.map(
    (e) => `osc${t}.${e}`
  )),
  ...Nn
]);
new Set(
  ve.flatMap((t) => ft.map(
    (e) => `osc${t}.${e}`
  ))
);
const mt = Object.freeze(
  Pn.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), Kn = Je().filter((t) => t.modulationTargetIndex !== null), Un = [
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
  const e = Bn(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function Bn(t) {
  const e = Un.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const ht = Object.freeze(
  [
    ...Kn.map((t) => ({
      // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
      // and indexes are both minted only by the rack descriptor catalog.
      kind: ye(Ie(t)),
      group: "rack",
      runtimeIndex: t.modulationTargetIndex
    })).sort((t, e) => t.runtimeIndex - e.runtimeIndex),
    { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
    { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
  ]
), w = Object.freeze([
  ...mt,
  ...ht
]), j = O.length, $n = mt.length, zn = ht.length, Hn = j * w.length, Vn = new Map(O.map((t) => [t.id, t])), Wn = new Map(O.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), Se = new Map(w.map((t) => [t.kind, t]));
function qn() {
  if (j !== 14 || $n !== 56 || zn !== 39 || Hn !== 1330)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = O.filter((i) => i.group === t).sort((i, a) => i.runtimeIndex - a.runtimeIndex);
    if (n.length !== e || n.some((i, a) => i.runtimeIndex !== a))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 56], ["rack", 39]]) {
    const n = w.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, a) => i.runtimeIndex !== a))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (Vn.size !== j || Wn.size !== j || Se.size !== w.length)
    throw new Error("Modulation identities must be unique");
}
qn();
function Gn(t) {
  return typeof t != "string" ? null : Se.has(t) ? t : null;
}
function jn(t) {
  const e = Gn(t);
  return e !== null && Se.get(e)?.group === "rack" ? e : null;
}
const Jn = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), Qn = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function Yn(t) {
  if (typeof t != "string")
    return null;
  const e = Qn.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Jn.get(n);
  if (i === void 0)
    return null;
  const a = e[3];
  return i.includes(a) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: a
  } : null;
}
function Xn(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function Zn(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
O.filter((t) => t.group === "voice").length;
O.filter((t) => t.group === "macro").length;
function ei(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function ti(t) {
  throw new Error(t ?? "Invariant violated");
}
const ni = "globalTune", ii = "globalTuneSemitones", L = -24, B = 24, Oe = 0, ri = -48, ai = 48, Fe = -48, oi = 6, si = 0, Ce = (si - Fe) / (oi - Fe);
function W(t, e, n, i, a = "percent", r = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: a, compound: r };
}
const li = [
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
], Ne = 1e-6;
function A(t, e) {
  if (!Number.isFinite(t) || t < -Ne || t > 1 + Ne)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function J(t, e) {
  return A(t / 100, `${e} catalog percentage`);
}
function Y(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function ci(t) {
  return 20 * 1e3 ** t;
}
function di(t) {
  return A(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function ui(t) {
  return 0.1 * 200 ** t;
}
function fi(t) {
  return A(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function mi(t) {
  return t;
}
function hi(t) {
  return A(t, "filterMix endpoint conversion");
}
function $(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function pi(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: $("filterCutoff", ci, di),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: $("filterQ", ui, fi),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: $("filterMix", mi, hi),
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
function pt(t) {
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
      return ei(t);
  }
}
function gi(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ii(t, e) {
  const n = Y(t.moduleId, e.id), i = pt(e.format), a = pi(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: J(e.defaultPercent, n),
    initialValue: J(e.initialPercent, n),
    format: i,
    modAmount: gi(i),
    binding: a.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: a.articulationParameterId,
    modulationTargetKind: a.modulationTargetKind
  });
}
const bi = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Ce * 100, defaultPercent: Ce * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function vi(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function yi(t, e) {
  const n = `osc${t}`, i = Y(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: J(e.defaultPercent, i),
    initialValue: J(e.initialPercent, i),
    format: pt(e.format),
    modAmount: vi(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const Si = Object.freeze(
  ve.flatMap((t) => bi.map((e) => yi(t, e)))
), Ti = Object.freeze({
  targetId: Y("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: A(
    (Oe - L) / (B - L),
    "Global Tune default"
  ),
  initialValue: A(
    (Oe - L) / (B - L),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: B },
  modAmount: {
    min: ri,
    max: ai,
    unit: "st",
    digits: 2
  },
  binding: $(
    ni,
    (t) => L + (B - L) * t,
    (t) => A(
      (t - L) / (B - L),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: ii
}), xi = Object.freeze([
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
function Ei(t) {
  const e = Y(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (r) => t.min + n * r, a = (r) => A(
    (r - t.min) / n,
    `${t.endpointID} endpoint conversion`
  );
  return Object.freeze({
    targetId: e,
    moduleId: t.moduleId,
    workspace: "voice",
    label: t.label,
    defaultValue: a(t.initial),
    initialValue: a(t.initial),
    format: t.format === "time" ? { kind: "time", minSeconds: t.min, maxSeconds: t.max } : { kind: "percent" },
    modAmount: t.format === "time" ? { min: -n, max: n, unit: "s", digits: 3 } : { min: -100, max: 100, unit: "%", digits: 0 },
    binding: $(t.endpointID, i, a),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const Ri = Object.freeze(
  xi.map(Ei)
), Ai = Object.freeze([
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
function Di(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function ee(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return A(n, `${t.endpointID} endpoint conversion`);
}
function Mi(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Li(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function wi(t) {
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
function ki(t) {
  const e = Di(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: ee(t, t.initial),
    initialValue: ee(t, t.initial),
    format: Li(t),
    modAmount: wi(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Mi(t, n),
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
    ...Q.flatMap((t) => t.parameters.map(ki)),
    ...Ai,
    Ti,
    ...Si,
    ...Ri,
    ...li.flatMap(
      (t) => t.parameters.map(
        (e) => Ii(t, e)
      )
    )
  ]
), _i = new Map(
  Te.map((t) => [t.targetId, t])
), gt = Te.filter(
  (t) => t.modulationTargetKind !== null
), de = new Map(
  gt.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (_i.size !== Te.length)
  throw new Error("Target descriptor IDs must be unique");
if (gt.length !== w.length || de.size !== w.length || w.some((t) => de.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function te(t) {
  const e = de.get(t);
  return e === void 0 ? ti(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  Q.map((t) => [t.id, t.label])
);
function Oi(t) {
  const e = Zn(t);
  return e === 1 ? "" : ` ${e}`;
}
function Fi(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = te(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = Yn(t);
  if (n !== null) {
    const i = te(Xn(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : i.moduleId.toUpperCase()}${Oi(n)} ${i.label.toUpperCase()}`;
  }
  return te(t).label.toUpperCase();
}
const Ci = Je().filter((t) => t.modulationTargetIndex !== null);
new Map(
  Ci.map((t) => [
    ye(Ie(t)),
    t
  ])
);
const Ni = {
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
  label: Ni[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const Pi = w.map((t) => ({
  value: t.kind,
  label: Fi(t.kind)
}));
Pi.filter((t) => !Ki(t.value));
function Ki(t) {
  return jn(t) !== null;
}
const Ui = [
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
], Bi = [
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
  Ui.map((t, e) => [t, 2 ** e])
);
Object.fromEntries(
  Bi.map((t, e) => [t, 2 ** e])
);
const $i = "runtimeSyncRequest", zi = 2147483647, Hi = "runtimeState", Vi = "retryDesiredTableRequest", Wi = "workerLoadFailure", qi = "serviceLoadAbort", Gi = "wavetableLoadBegin", ji = "wavetableMipFrame", Ji = "wavetableUploadAck", Qi = "wavetableMipRequest", Yi = "wavetablePrewarmRequest", Xi = "wavetablePrewarmNotification", Zi = "assets/factory-bank-catalog.json", ue = 3, er = 1, tr = ue * G, nr = 1, ir = 2, rr = 3, ar = 1, or = 2, sr = 2e4, q = nr, lr = ir, Pe = rr, k = ar, Ke = or, cr = 48 * 1024 * 1024, ne = 3;
function Ue(t, e) {
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
function Be(t) {
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
function $e(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function ze(t, e) {
  if (!t)
    throw new Error(e);
}
function dr(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function ur(t, e) {
  return Ln(await t.readJSON(e));
}
function fr(t) {
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
function mr(t, e) {
  const n = Math.round(Number(t) || 0);
  return dr(n, 0, Math.max(0, e - 1));
}
function ie(t, e, n, i, a) {
  return `${t}:${e}:${n}:${i}:${a}`;
}
function hr(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function He(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Ve(t) {
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
function pr(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class gr {
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
    this.connection = e, this.resourceClient = Mn(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Zi, this.maxBatchesInFlight = Ue(
      n.maxFramesInFlight,
      er
    ), this.mipLevelCount = n.mipLevelCount ?? ct, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? cr) || 0)), this.serviceLoadTimeoutMs = Ue(n.serviceLoadTimeoutMs, sr), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, I("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Hi, this.handleRuntimeState), this.connection.addEndpointListener?.(Ji, this.handleUploadAck), this.connection.addEndpointListener?.(Qi, this.handleMipRequest), this.connection.addEndpointListener?.(Yi, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Xi, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      $i,
      zi
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await ur(this.resourceClient, this.catalogPath), I("info", "Loaded wavetable catalog", {
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = He(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      for (const [a, r] of this.tableCache)
        e.has(a) || (!i || r.lastUsedSerial < i.lastUsedSerial) && (n = a, i = r);
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
      byteCount: He(e),
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
          ...Ve(this.serviceTable.frameCount),
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
    const { dspSessionId: e, oscillatorIndex: n, generation: i, tableIndex: a } = this.serviceTable;
    this.cancelServiceLoadWatchdog(), this.serviceLoadWatchdogHandle = this.setTimeoutFn(() => {
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== a || !this.serviceLoadHasPendingTransfers()) && (I("error", "Timed out waiting for wavetable mip upload acknowledgements", {
        dspSessionId: e,
        oscillatorIndex: n,
        generation: i,
        tableIndex: a,
        serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
      }), this.handleServiceTargetFailure(
        {
          kind: "loading",
          dspSessionId: e,
          oscillatorIndex: n,
          generation: i,
          tableIndex: a
        },
        {
          failurePhase: Pe,
          failureReasonCode: Ke
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== Pe || e.failureReasonCode !== Ke ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: a = 0,
    candidateAttemptSerial: r = 0,
    failurePhase: l = q,
    failureReasonCode: s = k
  }) {
    this.connection.sendEventOrValue?.(Wi, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: i,
      generation: a,
      candidateAttemptSerial: r,
      failurePhase: l,
      failureReasonCode: s
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: i,
    tableIndex: a,
    failureReasonCode: r = k
  }) {
    this.connection.sendEventOrValue?.(qi, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: a,
      failureReasonCode: r
    });
  }
  emitRetryDesiredTableRequest(e) {
    I("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? Be(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(Vi, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), a = mr(e, i.tables.length), r = i.tables[a];
    ze(r, `Could not resolve table ${a}`);
    const l = hr(r, G, this.mipLevelCount), s = this.tableCache.get(l);
    if (s)
      return s.lastUsedSerial = this.cacheUseSerial++, I("info", "Using cached wavetable source table", {
        tableIndex: a,
        tableId: r.tableId,
        tableName: r.name,
        sourceWav: r.sourceWav,
        frameCount: s.frameCount,
        cacheBytes: this.tableCacheBytes
      }), s;
    const o = We();
    I("info", "Reading wavetable source", {
      tableIndex: a,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n
    });
    const u = await this.resourceClient.readAudio(r.sourceWav), c = Fn(u.samples, {
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n,
      samplesPerFrame: G
    });
    return I("info", "Prepared wavetable source table", {
      tableIndex: a,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      frameCount: c.frameCount,
      loadDurationMs: Math.round(We() - o)
    }), this.rememberLoadedTable({
      cacheKey: l,
      tableIndex: a,
      tableMeta: r,
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(Gi, {
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
      failurePhase: q,
      failureReasonCode: k
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: q,
      failureReasonCode: k
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = q,
    failureReasonCode: i = k
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
      const r = this.candidateValidations[e.oscillatorIndex];
      return r && r.dspSessionId === e.dspSessionId && r.generation === e.generation && r.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
    }
    let i = null;
    try {
      i = await this.loadTableSource(e.tableIndex);
    } catch (r) {
      return this.isCurrentRuntimeState(n) && (I("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: re(r)
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
    const a = this.candidateValidations[e.oscillatorIndex];
    return a && a.dspSessionId === e.dspSessionId && a.generation === e.generation && a.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
  }
  async prepareDesiredLoad(e) {
    const n = e.desiredTableIndex, i = this.candidateValidations[e.oscillatorIndex];
    if (i && i.dspSessionId === e.dspSessionId && i.tableIndex === n && i.desiredIntentSerial === e.desiredIntentSerial)
      return;
    const a = Math.max(
      this.nextLoadGenerations[e.oscillatorIndex] ?? 1,
      e.generationFrontier + 1
    );
    let r = null;
    try {
      r = await this.loadTableSource(n);
    } catch (l) {
      this.isCurrentRuntimeState(e) && (I("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: re(l)
      }), this.handleCandidateLoadFailure(e));
      return;
    }
    !r || !this.isCurrentRuntimeState(e) || this.markCommittedDesiredLoad(e, a, r);
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
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, pr(() => {
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
    const a = this.candidateValidations[n];
    if (a && a.dspSessionId === e.dspSessionId && a.generation > e.generationFrontier)
      return;
    const r = this.resolveServiceTarget(e);
    if (r) {
      if (!await this.prepareServiceTarget(r, e) || !this.isCurrentRuntimeState(e))
        return;
      if (r.kind === "loading" && e.desiredTableIndex !== r.tableIndex && !this.shouldStayIdleOnFailure(e)) {
        I("warn", "Aborting obsolete wavetable load because the desired table changed", {
          dspSessionId: r.dspSessionId,
          oscillatorIndex: n,
          generation: r.generation,
          staleTableIndex: r.tableIndex,
          desiredTableIndex: e.desiredTableIndex,
          desiredIntentSerial: e.desiredIntentSerial
        }), this.emitServiceLoadAbort({
          dspSessionId: r.dspSessionId,
          oscillatorIndex: n,
          generation: r.generation,
          tableIndex: r.tableIndex,
          failureReasonCode: k
        }), this.serviceTable = null, this.clearMipTransferState();
        return;
      }
      r.kind === "active" && e.desiredTableIndex !== r.tableIndex && !this.shouldStayIdleOnFailure(e) && !i && await this.prepareDesiredCandidate(e);
      return;
    }
    if (this.serviceTable = null, this.clearMipTransferState(), this.shouldAutomaticallyRetryTimeoutFailure(e)) {
      this.autoRetryConsumedKeys[n] = this.getDesiredRetryKey(e), this.emitRetryDesiredTableRequest(n);
      return;
    }
    e.serviceState !== 0 || this.shouldStayIdleOnFailure(e) || await this.prepareDesiredLoad(e);
  }
  handleRuntimeState(e) {
    const n = fr(e ?? {});
    if (I("info", "Received runtime state", Be(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= ne)
      return;
    const i = n.dspSessionId !== this.knownSessionId;
    i && this.resetSessionState(n);
    const a = n.oscillatorIndex, r = this.latestRuntimeStates[a], l = r ? this.getDesiredRetryKey(r) : null, s = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[a] = Math.max(
      this.nextLoadGenerations[a] ?? 1,
      n.generationFrontier + 1
    ), (i || l !== s) && (this.autoRetryConsumedKeys[a] = null), this.latestRuntimeStates[a] = n, this.pendingRuntimeStateOscillators.add(a), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(i))
      try {
        const a = await this.loadTableSource(i);
        for (let l = 0; l < a.frameCount; l += 1)
          a.spectra[l] || (a.spectra[l] = _e(a.frames[l]));
        const r = this.tableCache.get(a.cacheKey);
        r && this.refreshCacheEntryByteCount(r), I("info", "Prewarmed wavetable source table", {
          tableIndex: a.tableIndex,
          tableId: a.tableMeta.tableId,
          tableName: a.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (a) {
        I("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: re(a)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), a = Math.trunc(Number(e?.generation)), r = Math.trunc(Number(e?.tableIndex)), l = Math.trunc(Number(e?.mipIndex)), s = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || a !== this.serviceTable.generation || r !== this.serviceTable.tableIndex || l < 0 || l >= this.mipLevelCount)
      return null;
    const o = ie(
      n,
      i,
      a,
      r,
      l
    );
    let u = this.mipJobs.get(o);
    return u ? (!u.completed && s > u.urgencyLevel && (u.urgencyLevel = s), u) : (u = {
      key: o,
      dspSessionId: n,
      oscillatorIndex: i,
      generation: a,
      tableIndex: r,
      mipIndex: l,
      urgencyLevel: s,
      ...Ve(this.serviceTable.frameCount),
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), a = Math.trunc(Number(n.oscillatorIndex)), r = Math.trunc(Number(n.generation)), l = Math.trunc(Number(n.tableIndex)), s = Math.trunc(Number(n.mipIndex)), o = Math.trunc(Number(n.frameIndexBase)), u = Math.trunc(Number(n.frameCount)), c = ie(
      i,
      a,
      r,
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
      d.ackedFrameCount === m && d.nextFrameIndex >= m && d.inFlightBatchBases.size === 0 && (d.completed = !0, this.activeUploadKey === d.key && (this.activeUploadKey = null)), $e(o, u, m) && I("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: a,
        generation: r,
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
    if (ze(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = _e(this.serviceTable.frames[e]);
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
      ), a = new Float32Array(tr);
      try {
        for (let r = 0; r < i; r += 1) {
          const l = n + r, s = this.getSpectrumForFrame(l), o = Cn(s, e.mipIndex);
          a.set(o, r * G);
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
            failurePhase: lr,
            failureReasonCode: k
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(ji, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(a)
      }), $e(n, i, this.serviceTable.frameCount) && I("info", "Sent wavetable mip batch", {
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
function re(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Ir(t, e = {}) {
  return new gr(t, e);
}
async function br(t, e = {}) {
  return vt(t, [
    vn,
    () => Ir(t, e)
  ]);
}
export {
  br as default
};
