class gt {
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
function It(t, e) {
  return new gt(t, e);
}
async function bt(t, e) {
  const n = It(t, e);
  return await n.start(), n;
}
const We = 12, ue = 5, qe = 8, vt = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), fe = Object.freeze({
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
}), me = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz", "distortionType"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
}), yt = Object.freeze([
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
]), St = Object.freeze({
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
function Tt(t) {
  return Math.round(t) === 1 ? -5 : Math.round(t) === 2 ? 12 : Math.round(t) === 3 ? -12 : 7;
}
function he(t, e) {
  const n = {};
  for (const c of fe[t]) {
    const l = e[c];
    if (typeof l == "number" && Number.isFinite(l)) {
      n[c] = l;
      continue;
    }
    const s = St[c];
    if (s === void 0)
      throw new Error(`Missing lane parameter value: ${t}.${c}`);
    n[c] = s;
  }
  const i = me.chorus, a = Object.keys(e);
  return t === "chorus" && a.length === i.length && a.every((c) => i.includes(c)) && (n.chorusRingKeyTrackEnabled = 1, n.chorusRingKeyTrackOffsetSemitones = Tt(
    Number(e.chorusRingOffsetMode)
  ) + Number(e.chorusRingFineSemitones), n.chorusRingLegacyClampEnabled = 1), n;
}
function xt(t) {
  return fe[t];
}
function Et(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= ue)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * qe + vt[t];
}
function Rt(t, e) {
  const n = new Array(We).fill(0), i = he(t, e);
  return fe[t].forEach((a, r) => {
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
}), d = (t, e, n, i, a, r, c, l = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: a,
  max: r,
  initial: c,
  step: l.step ?? (r - a) / 1e3,
  scale: l.scale ?? "linear",
  unit: l.unit ?? "",
  choices: l.choices,
  quick: l.quick ?? !1,
  modulationTargetIndex: l.modulationTargetIndex ?? null,
  modulationApplication: l.modulationApplication ?? (l.modulationTargetIndex === void 0 || l.modulationTargetIndex === null ? null : "linear"),
  modulationIdentityEndpointID: l.modulationIdentityEndpointID,
  modulationDragStyle: l.modulationDragStyle
}), At = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], Dt = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], Mt = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: M.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      d("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(y), quick: !0 }),
      d("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      d("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      d("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
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
      d("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [y("Classic", 0), y("Harmonics", 1)] }),
      d("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      d("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      d("drive", "distortionWet", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 5 }),
      d("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      d("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" }),
      d("drive", "distortionType", "Type", "Type", 0, 2, 1, { step: 1, choices: [y("Symmetric", 0), y("Asymmetric", 1), y("Wavefold", 2)] })
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
      d("ott", "ottMix", "Mix", "Mix", 0, 100, 50, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      d("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      d("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      d("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      d("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 })
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
      d("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(y) }),
      d("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(y) }),
      d("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 13 }),
      d("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      d("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      d("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      d("chorus", "chorusRingFrequencyHz", "Ring Frequency", "Freq", 10, 2e4, 28, {
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
      d("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      d("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      d("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      d("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 21 }),
      d("flanger", "flangerBaseDelayMs", "Base Delay / Tune", "Tune", 0.2, 16, 0.6, {
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
      d("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [y("Free", 0), y("Sync", 1)] }),
      d("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      d("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: At.map(y) }),
      d("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      d("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      d("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      d("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      d("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 27 })
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
      d("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [y("Free", 0), y("Sync", 1)] }),
      d("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      d("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: Dt.map(y) }),
      d("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      d("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      d("delay", "delayMix", "Mix", "Mix", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 31 })
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
      d("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      d("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      d("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      d("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0.5, { modulationTargetIndex: 35 })
    ]
  }
], J = Mt, Ge = Object.freeze(
  J.flatMap((t) => t.parameters)
);
new Map(
  Ge.map((t) => [t.endpointID, t])
);
function pe(t) {
  const e = J.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function je() {
  return Ge;
}
function ge(t) {
  return t.modulationIdentityEndpointID ?? t.endpointID;
}
const v = "lane.v1", Lt = "laneTopology", Te = "laneSlotParams", re = 16, wt = 8, Je = 4, kt = 3, Qe = ue * qe, Ye = 4, _t = 4, Ot = Qe, Ft = Qe + Ye, Ct = 0, Nt = 1, Pt = 2, Kt = 3, Ut = 4, Bt = 5;
function $t(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > Je)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << wt;
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
]), $ = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
}), zt = new Map(
  Object.entries($).map(([t, e]) => [e, t])
), Ht = Object.freeze({
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
  T.map((t) => [Ht[t], t])
);
function Xe() {
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
function Vt(t) {
  return Object.fromEntries(
    pe(t).parameters.map((e) => [e.endpointID, e.initial])
  );
}
function Wt() {
  return {
    format: "cosimo.lane",
    version: 1,
    order: [...T],
    enabled: Xe(),
    params: Object.fromEntries(
      T.map((t) => [t, Vt(t)])
    )
  };
}
function qt(t) {
  if (typeof t != "string")
    return { _tag: "json", value: t };
  if (t.trim().length === 0)
    return { _tag: "err", message: `${v} must not be empty` };
  try {
    return { _tag: "json", value: JSON.parse(t) };
  } catch (e) {
    const n = e instanceof Error ? e.message : String(e);
    return { _tag: "err", message: `${v} is not valid JSON: ${n}` };
  }
}
function H(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Gt(t) {
  return typeof t != "string" ? null : T.find((e) => e === t) ?? null;
}
function jt(t) {
  const e = qt(t);
  if (e._tag === "err")
    return e;
  if (!H(e.value))
    return { _tag: "err", message: `${v} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled", "params"]);
  for (const l of Reflect.ownKeys(e.value))
    if (typeof l != "string" || !n.has(l))
      return { _tag: "err", message: `${v} has unexpected field ${String(l)}` };
  if (e.value.format !== "cosimo.lane" || e.value.version !== 1)
    return { _tag: "err", message: `${v} must be cosimo.lane version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== T.length)
    return { _tag: "err", message: `${v}.order must contain every effect once` };
  const i = [], a = /* @__PURE__ */ new Set();
  for (const l of e.value.order) {
    const s = Gt(l);
    if (s === null || a.has(s))
      return { _tag: "err", message: `${v}.order is not a complete permutation` };
    a.add(s), i.push(s);
  }
  if (!H(e.value.enabled))
    return { _tag: "err", message: `${v}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== T.length)
    return { _tag: "err", message: `${v}.enabled must contain every effect once` };
  const r = Xe();
  for (const l of T) {
    const s = e.value.enabled[l];
    if (typeof s != "boolean")
      return { _tag: "err", message: `${v}.enabled.${l} must be boolean` };
    r[l] = s;
  }
  if (!H(e.value.params))
    return { _tag: "err", message: `${v}.params must be an object` };
  if (Reflect.ownKeys(e.value.params).length !== T.length)
    return { _tag: "err", message: `${v}.params must contain every effect once` };
  const c = {};
  for (const l of T) {
    const s = e.value.params[l];
    if (!H(s))
      return { _tag: "err", message: `${v}.params.${l} must be an object` };
    const f = pe(l).parameters.map((g) => g.endpointID), u = me[$[l]], m = Reflect.ownKeys(s), p = (g) => m.length === g.length && m.every((S) => typeof S == "string" && g.includes(S));
    if (!p(f) && !p(u))
      return { _tag: "err", message: `${v}.params.${l} must contain every parameter once` };
    const I = {};
    for (const g of m) {
      if (typeof g != "string")
        return { _tag: "err", message: `${v}.params.${l} has an invalid parameter key` };
      const S = s[g];
      if (typeof S != "number" || !Number.isFinite(S))
        return { _tag: "err", message: `${v}.params.${l}.${g} must be a finite number` };
      I[g] = S;
    }
    c[l] = I;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.lane", version: 1, order: i, enabled: r, params: c }
  };
}
const Jt = Object.freeze([
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
]), Qt = Object.freeze({
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
  Jt.map((t) => [t, Object.freeze({
    id: t,
    family: Qt[t],
    buttonLabel: "Key Track",
    initialEnabled: !1
  })])
);
const Ze = 40, et = 18e3, ae = T.map((t) => $[t]), Yt = /^([a-zA-Z]+)#([1-9][0-9]*)$/, Xt = /^(parallel|split)#([1-9][0-9]*)$/;
function Ie(t) {
  if (typeof t != "string")
    return null;
  const e = Yt.exec(t);
  if (e === null)
    return null;
  const n = ae.find((a) => a === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > ue ? null : { deviceType: n, instanceNumber: i };
}
function tt(t) {
  if (typeof t != "string")
    return null;
  const e = Xt.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? Ye : _t) ? null : { groupKind: n, unitNumber: i };
}
function C(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function U(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function h(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function Zt(t, e) {
  const n = Ie(t);
  if (n === null)
    return { failure: h(`device id ${t} is not a pool instance`) };
  if (!C(e) || !U(e, ["params"]) || !C(e.params))
    return { failure: h(`device ${t} must be { params }`) };
  const i = xt(n.deviceType), a = me[n.deviceType], r = zt.get(n.deviceType);
  if (r === void 0)
    return { failure: h(`device ${t} has no effect descriptor`) };
  const c = pe(r).parameters.map((u) => u.endpointID), l = e.params, s = Object.keys(l), o = (u) => s.length === u.length && s.every((m) => u.includes(m));
  if (!(o(i) || o(a) || n.deviceType === "chorus" && o(yt) || o(c)))
    return { failure: h(`device ${t} must carry every parameter once`) };
  for (const u of s) {
    const m = l[u];
    if (typeof m != "number" || !Number.isFinite(m))
      return { failure: h(`device ${t}.${u} must be a finite number`) };
  }
  return { record: { params: he(n.deviceType, l) } };
}
function en(t, e) {
  return !C(t) || t.kind !== "device" ? { failure: h("branches may hold device placements only") } : U(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: h(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: h(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: h("a device placement is { kind, deviceId, enabled }") };
}
function xe(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= Ze && t <= et;
}
function tn(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (o) {
      const f = o instanceof Error ? o.message : String(o);
      return h(`is not valid JSON: ${f}`);
    }
  if (!C(e) || !U(e, ["format", "version", "devices", "chain"]))
    return h("must be { format, version, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return h("must be cosimo.lane version 2");
  if (!C(e.devices))
    return h("devices must be an object");
  if (!Array.isArray(e.chain))
    return h("chain must be an array");
  const n = {};
  for (const o of Reflect.ownKeys(e.devices)) {
    if (typeof o != "string")
      return h("device ids must be strings");
    const f = Zt(o, e.devices[o]);
    if ("failure" in f)
      return f.failure;
    n[o] = f.record;
  }
  const i = new Set(Object.keys(n)), a = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set(), c = [];
  let l = 0;
  const s = (o) => {
    const f = en(o, i);
    return "placement" in f && (a.set(
      f.placement.deviceId,
      (a.get(f.placement.deviceId) ?? 0) + 1
    ), l += 1), f;
  };
  for (const o of e.chain) {
    if (!C(o))
      return h("chain nodes must be objects");
    if (o.kind === "device") {
      const E = s(o);
      if ("failure" in E)
        return E.failure;
      c.push(E.placement);
      continue;
    }
    if (o.kind !== "parallel" && o.kind !== "split")
      return h(`unknown chain node kind ${String(o.kind)}`);
    const f = o.kind === "split", u = ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"], p = f ? [
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
    ] : ["kind", "groupId", "enabled", "branches"], I = f && U(o, u);
    if (!U(o, p) && !I)
      return h(`a ${o.kind} group is { ${p.join(", ")} }`);
    const g = tt(o.groupId);
    if (g === null || g.groupKind !== o.kind)
      return h(`group id ${String(o.groupId)} does not name a ${o.kind} unit`);
    if (r.has(String(o.groupId)))
      return h(`group ${String(o.groupId)} is used twice`);
    if (r.add(String(o.groupId)), typeof o.enabled != "boolean")
      return h(`group ${String(o.groupId)} needs a boolean enable`);
    const S = f ? kt : Je;
    if (!Array.isArray(o.branches) || o.branches.length < 2 || o.branches.length > S)
      return h(`group ${String(o.groupId)} needs 2..${S} branches`);
    if (f && (!xe(o.xoverLowHz) || !xe(o.xoverHighHz)))
      return h(`group ${String(o.groupId)} crossovers must sit in ${Ze}..${et} Hz`);
    if (f && !I && (typeof o.xoverLowKeyTrackEnabled != "boolean" || typeof o.xoverHighKeyTrackEnabled != "boolean" || typeof o.xoverLowKeyTrackOffsetSemitones != "number" || !Number.isFinite(o.xoverLowKeyTrackOffsetSemitones) || typeof o.xoverHighKeyTrackOffsetSemitones != "number" || !Number.isFinite(o.xoverHighKeyTrackOffsetSemitones)))
      return h(`group ${String(o.groupId)} Key Track state must be finite`);
    l += 1;
    const O = [];
    for (const E of o.branches) {
      if (!Array.isArray(E))
        return h(`group ${String(o.groupId)} branches must be arrays`);
      const N = [];
      for (const z of E) {
        const F = s(z);
        if ("failure" in F)
          return F.failure;
        N.push(F.placement);
      }
      O.push(N);
    }
    c.push(f ? {
      kind: "split",
      groupId: String(o.groupId),
      enabled: o.enabled,
      xoverLowHz: o.xoverLowHz,
      xoverHighHz: o.xoverHighHz,
      xoverLowKeyTrackEnabled: I ? !1 : o.xoverLowKeyTrackEnabled,
      xoverLowKeyTrackOffsetSemitones: I ? 0 : o.xoverLowKeyTrackOffsetSemitones,
      xoverHighKeyTrackEnabled: I ? !1 : o.xoverHighKeyTrackEnabled,
      xoverHighKeyTrackOffsetSemitones: I ? 0 : o.xoverHighKeyTrackOffsetSemitones,
      branches: O
    } : {
      kind: "parallel",
      groupId: String(o.groupId),
      enabled: o.enabled,
      branches: O
    });
  }
  for (const o of i)
    if ((a.get(o) ?? 0) !== 1)
      return h(`device ${o} must be placed exactly once`);
  return l > re ? h(`flattens to ${l} wire entries; the topology upload holds ${re}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, devices: n, chain: c } };
}
function nt(t) {
  const e = {};
  for (const n of T) {
    const i = $[n];
    e[`${i}#1`] = {
      params: he(i, t.params[n])
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.order.map((n) => ({
      kind: "device",
      deviceId: `${$[n]}#1`,
      enabled: t.enabled[n]
    }))
  };
}
const Ee = ["distortion#1", "delay#1", "reverb#1"];
function Re() {
  const t = nt(Wt()), e = {};
  for (const n of Ee) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The v1 default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && Ee.includes(n.deviceId))
  };
}
function nn(t) {
  if (t === void 0)
    return Re();
  const e = tn(t);
  if (e._tag === "ok")
    return e.value;
  const n = jt(t);
  return n._tag === "ok" ? nt(n.value) : Re();
}
function rn(t) {
  return Object.keys(t.devices).map((e) => {
    const n = Ie(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => ae.indexOf(e.parsed.deviceType) - ae.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function oe(t) {
  const e = Ie(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return Et(e.deviceType, e.instanceNumber - 1);
}
function it(t) {
  const e = tt(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? Ot : Ft) + (e.unitNumber - 1);
}
function an(t) {
  const e = new Array(re).fill(0);
  let n = 0, i = 0;
  const a = (r, c, l) => {
    e[i] = $t(r, c), l && (n |= 1 << i), i += 1;
  };
  for (const r of t.chain) {
    if (r.kind === "device") {
      a(oe(r.deviceId), 0, r.enabled);
      continue;
    }
    a(it(r), r.branches.length, r.enabled), r.branches.forEach((c, l) => {
      for (const s of c)
        a(oe(s.deviceId), l + 1, s.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function on(t) {
  const e = new Array(We).fill(0);
  return e[Ct] = t.xoverLowHz, e[Nt] = t.xoverHighHz, e[Pt] = t.xoverLowKeyTrackEnabled ? 1 : 0, e[Kt] = t.xoverLowKeyTrackOffsetSemitones, e[Ut] = t.xoverHighKeyTrackEnabled ? 1 : 0, e[Bt] = t.xoverHighKeyTrackOffsetSemitones, e;
}
function sn(t) {
  const e = [];
  let n = 0;
  for (const i of rn(t))
    n += 1, e.push({
      endpointID: Te,
      value: {
        slotId: oe(i.instanceId),
        deliverySerial: n,
        values: Rt(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: Te,
      value: {
        slotId: it(i),
        deliverySerial: n,
        values: on(i)
      }
    }));
  return e.push({
    endpointID: Lt,
    value: an(t)
  }), e;
}
const ln = "runtimeState";
function cn(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const dn = {
  endpointID: ln,
  required: !0,
  mapValue: cn
}, un = 2e3;
function Ae(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function fn(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return Ae(i, e) ? {
    found: !0,
    value: i[e]
  } : Ae(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function De(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class mn {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = hn(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = fn(e, this.options.stateKey);
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
    for (const s of this.parameterEndpointIDs) {
      if (!this.parameterValues.has(s))
        return;
      e[s] = this.parameterValues.get(s);
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
      parameters: e,
      runtimeEndpoints: n
    }, a = De(n), r = !this.forceFullReplay && a === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, c = this.options.buildRuntimeEvents(i, r), l = De({
      runtimeEndpoints: n,
      events: c
    });
    if (l === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i;
      return;
    }
    if (c.length === 0) {
      this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(c, i).then((s) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        s ? (this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(c);
        const o = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, o && this.applyRuntimeStateIfReady();
      }).catch(() => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        this.options.onDeliveryFailure?.(c);
        const s = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, s && this.applyRuntimeStateIfReady();
      });
      return;
    }
    for (const s of c)
      this.connection.sendEventOrValue?.(
        s.endpointID,
        s.value,
        void 0,
        this.options.sendTimeoutMilliseconds ?? un
      );
    this.lastAppliedToken = l, this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i;
  }
}
function hn(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function pn(t, e) {
  return new mn(t, e);
}
function gn(t) {
  return pn(t, {
    stateKey: v,
    runtimeEndpointDependencies: [dn],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: nn,
    buildRuntimeEvents: ({ state: e }) => [...sn(e)]
  });
}
function x(t, e) {
  if (!t)
    throw new Error(e);
}
function Y(t, e, n) {
  let i = "";
  for (let a = 0; a < n; a += 1)
    i += String.fromCharCode(t.getUint8(e + a));
  return i;
}
function In(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function se(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function rt(t) {
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
function bn() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function X(t, e) {
  const n = bn();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (In(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function Me(t) {
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
  throw new Error(`Unsupported text resource payload (${rt(t)})`);
}
function vn(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return se(t);
  throw new Error(`Unsupported binary resource payload (${rt(t)})`);
}
function yn(t) {
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
      const c = r;
      x(c.length === 1, "Only mono wavetable source files are supported"), i[a] = Number(c[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(t?.sampleRate) || 0,
    samples: i
  };
}
function at(t) {
  const e = new DataView(t);
  x(Y(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), x(Y(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, a = null, r = null, c = null, l = null, s = null, o = 12;
  for (; o + 8 <= e.byteLength; ) {
    const u = Y(e, o, 4), m = e.getUint32(o + 4, !0), p = o + 8;
    u === "fmt " ? (n = e.getUint16(p, !0), i = e.getUint16(p + 2, !0), a = e.getUint32(p + 4, !0), c = e.getUint16(p + 12, !0), r = e.getUint16(p + 14, !0)) : u === "data" && (l = p, s = m), o = p + m + m % 2;
  }
  x(n !== null, "Wave file is missing a fmt chunk"), x(l !== null && s !== null, "Wave file is missing a data chunk"), x(i === 1, "Only mono wavetable bank files are supported");
  let f;
  if (n === 3 && r === 32)
    f = new Float32Array(t.slice(l, l + s));
  else if (n === 1 && r === 16) {
    const u = s / 2, m = new Int16Array(t.slice(l, l + s));
    f = new Float32Array(u);
    for (let p = 0; p < u; p += 1)
      f[p] = m[p] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${r}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: a ?? 0,
    bitsPerSample: r,
    blockAlign: c ?? 0,
    samples: f
  };
}
async function Le(t) {
  x(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return x(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function le(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function ot(t) {
  const e = new Uint8Array(t).buffer, n = at(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function Sn(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (s) => (x(typeof t.readResource == "function", `Resource bridge cannot read ${s}`), t.readResource(s)), a = async (s) => {
    x(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${s}`);
    const o = await t.readResourceAsAudioData(s);
    return yn(o);
  }, r = (s) => {
    const o = t.getResourceAddress?.(s);
    return o ?? null;
  }, c = async (s, o = t.getResourceAddress?.(s)) => {
    const f = X(s, o), u = await Le(f), m = at(u);
    return {
      sampleRate: m.sampleRate,
      samples: m.samples
    };
  }, l = async (s, o = t.getResourceAddress?.(s)) => {
    const f = X(s, o);
    return new Uint8Array(await Le(f));
  };
  return {
    async readText(s) {
      if (e === "bridge" && typeof t.readResource == "function")
        return Me(await i(s));
      const o = r(s);
      return e === "url" && o !== null ? le(await l(s, o)) : typeof t.readResource == "function" ? Me(await i(s)) : le(await l(s, o));
    },
    async readJSON(s) {
      return JSON.parse(await this.readText(s));
    },
    async readBytes(s) {
      return typeof t.readResource == "function" ? vn(await i(s)) : l(s);
    },
    async readAudio(s) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return a(s);
      const o = r(s);
      return n === "url" && o !== null ? c(s, o) : typeof t.readResourceAsAudioData == "function" ? a(s) : ot(await this.readBytes(s));
    },
    getURL(s) {
      return X(s, t.getResourceAddress?.(s));
    }
  };
}
function Tn(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return Sn(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function xn(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, a = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, r = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(c) {
      if (e)
        return e(c);
      if (n)
        return JSON.stringify(await n(c));
      if (i)
        return le(await i(c));
      throw new Error(`Resource client cannot read text ${c}`);
    },
    async readJSON(c) {
      return n ? n(c) : JSON.parse(await this.readText(c));
    },
    async readBytes(c) {
      if (i)
        return i(c);
      if (e)
        return se(await e(c));
      if (n)
        return se(JSON.stringify(await n(c)));
      throw new Error(`Resource client cannot read bytes ${c}`);
    },
    async readAudio(c) {
      return a ? a(c) : ot(await this.readBytes(c));
    },
    getURL(c) {
      return r ? r(c) : null;
    }
  };
}
function En(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function Rn(t) {
  return En(t) ? xn(t) : Tn(t);
}
const q = 2048;
function P(t, e) {
  if (!t)
    throw new Error(e);
}
function An(t) {
  P(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    P(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), P(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), P(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), P(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const Dn = 2048, st = 11, Mn = 256;
function R(t, e) {
  if (!t)
    throw new Error(e);
}
function Ln(t) {
  return t > 0 && (t & t - 1) === 0;
}
const we = /* @__PURE__ */ new Map();
function wn(t) {
  const e = we.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let a = 0; a < t; a += 1) {
    let r = 0, c = a;
    for (let l = 0; l < n; l += 1)
      r = r << 1 | c & 1, c >>= 1;
    i[a] = r;
  }
  return we.set(t, i), i;
}
function lt(t, e, n = !1) {
  const i = t.length;
  R(i === e.length, "FFT real and imaginary buffers must have the same length"), R(Ln(i), "FFT input length must be a power of two");
  const a = wn(i);
  for (let r = 0; r < i; r += 1) {
    const c = a[r];
    if (c <= r)
      continue;
    const l = t[r];
    t[r] = t[c], t[c] = l;
    const s = e[r];
    e[r] = e[c], e[c] = s;
  }
  for (let r = 2; r <= i; r <<= 1) {
    const c = r >> 1, l = (n ? 2 : -2) * Math.PI / r, s = Math.cos(l), o = Math.sin(l);
    for (let f = 0; f < i; f += r) {
      let u = 1, m = 0;
      for (let p = 0; p < c; p += 1) {
        const I = f + p, g = I + c, S = t[g], O = e[g], E = u * S - m * O, N = u * O + m * S, z = t[I], F = e[I];
        t[I] = z + E, e[I] = F + N, t[g] = z - E, e[g] = F - N;
        const pt = u * s - m * o;
        m = u * o + m * s, u = pt;
      }
    }
  }
  if (n)
    for (let r = 0; r < i; r += 1)
      t[r] /= i, e[r] /= i;
}
function ct(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let r = 0; r < e.length; r += 1)
    n += Number(e[r]) || 0;
  const i = n / Math.max(1, e.length), a = new Float32Array(e.length);
  for (let r = 0; r < e.length; r += 1)
    a[r] = (Number(e[r]) || 0) - i;
  return a;
}
function kn(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = Dn,
  maxFramesPerTable: i = Mn
} = {}) {
  const a = Float32Array.from(t);
  R(a.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const r = a.length / n;
  R(r > 0, "Source wavetable files must contain at least one frame"), R(r <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && R(r === e, `Source wavetable frame count mismatch: expected ${e}, got ${r}`);
  const c = [];
  for (let l = 0; l < r; l += 1) {
    const s = l * n, o = s + n;
    c.push(ct(a.slice(s, o)));
  }
  return {
    frameCount: r,
    frames: c
  };
}
function ke(t) {
  const e = ct(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return lt(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function _n(t, e, {
  mipLevelCount: n = st
} = {}) {
  const i = t?.real?.length ?? 0;
  R(i > 0, "Spectrum must contain real samples"), R(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), R(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const a = Math.min(1 << e, i >> 1), r = new Float64Array(i), c = new Float64Array(i);
  for (let l = 1; l <= a; l += 1) {
    r[l] = t.real[l], c[l] = t.imaginary[l];
    const s = (i - l) % i;
    s !== l && (r[s] = t.real[s], c[s] = t.imaginary[s]);
  }
  return lt(r, c, !0), Float32Array.from(r);
}
const be = ["A", "B", "C"], dt = [
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
], On = [
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
], _ = Object.freeze([
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
]), Fn = Object.freeze([
  ...be.flatMap((t) => dt.map(
    (e) => `osc${t}.${e}`
  )),
  ...On
]);
new Set(
  be.flatMap((t) => dt.map(
    (e) => `osc${t}.${e}`
  ))
);
const ut = Object.freeze(
  Fn.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), Cn = je().filter((t) => t.modulationTargetIndex !== null), Nn = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function ve(t) {
  const e = Pn(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function Pn(t) {
  const e = Nn.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const ft = Object.freeze(
  [
    ...Cn.map((t) => ({
      // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
      // and indexes are both minted only by the rack descriptor catalog.
      kind: ve(ge(t)),
      group: "rack",
      runtimeIndex: t.modulationTargetIndex
    })).sort((t, e) => t.runtimeIndex - e.runtimeIndex),
    { kind: "lane.frequencySplit#1.xoverLowHz", group: "rack", runtimeIndex: 37 },
    { kind: "lane.frequencySplit#1.xoverHighHz", group: "rack", runtimeIndex: 38 }
  ]
), w = Object.freeze([
  ...ut,
  ...ft
]), G = _.length, Kn = ut.length, Un = ft.length, Bn = G * w.length, $n = new Map(_.map((t) => [t.id, t])), zn = new Map(_.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), ye = new Map(w.map((t) => [t.kind, t]));
function Hn() {
  if (G !== 14 || Kn !== 56 || Un !== 39 || Bn !== 1330)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 10], ["macro", 4]]) {
    const n = _.filter((i) => i.group === t).sort((i, a) => i.runtimeIndex - a.runtimeIndex);
    if (n.length !== e || n.some((i, a) => i.runtimeIndex !== a))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 56], ["rack", 39]]) {
    const n = w.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, a) => i.runtimeIndex !== a))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if ($n.size !== G || zn.size !== G || ye.size !== w.length)
    throw new Error("Modulation identities must be unique");
}
Hn();
function Vn(t) {
  return typeof t != "string" ? null : ye.has(t) ? t : null;
}
function Wn(t) {
  const e = Vn(t);
  return e !== null && ye.get(e)?.group === "rack" ? e : null;
}
const qn = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix", "flangerBaseDelayMs"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]],
  ["frequencySplit", ["xoverLowHz", "xoverHighHz"]]
]), Gn = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function jn(t) {
  if (typeof t != "string")
    return null;
  const e = Gn.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = qn.get(n);
  if (i === void 0)
    return null;
  const a = e[3];
  return i.includes(a) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: a
  } : null;
}
function Jn(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function Qn(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
_.filter((t) => t.group === "voice").length;
_.filter((t) => t.group === "macro").length;
function Yn(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Xn(t) {
  throw new Error(t ?? "Invariant violated");
}
const Zn = "globalTune", ei = "globalTuneSemitones", L = -24, K = 24, _e = 0, ti = -48, ni = 48, Oe = -48, ii = 6, ri = 0, Fe = (ri - Oe) / (ii - Oe);
function V(t, e, n, i, a = "percent", r = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: a, compound: r };
}
const ai = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      V("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      V("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      V("mix", "Mix", 100, 100),
      V("drive", "Drive", 15, 0)
    ]
  }
], Ce = 1e-6;
function A(t, e) {
  if (!Number.isFinite(t) || t < -Ce || t > 1 + Ce)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function j(t, e) {
  return A(t / 100, `${e} catalog percentage`);
}
function Q(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function oi(t) {
  return 20 * 1e3 ** t;
}
function si(t) {
  return A(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function li(t) {
  return 0.1 * 200 ** t;
}
function ci(t) {
  return A(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function di(t) {
  return t;
}
function ui(t) {
  return A(t, "filterMix endpoint conversion");
}
function B(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function fi(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: B("filterCutoff", oi, si),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: B("filterQ", li, ci),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: B("filterMix", di, ui),
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
function mt(t) {
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
      return Yn(t);
  }
}
function mi(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function hi(t, e) {
  const n = Q(t.moduleId, e.id), i = mt(e.format), a = fi(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: j(e.defaultPercent, n),
    initialValue: j(e.initialPercent, n),
    format: i,
    modAmount: mi(i),
    binding: a.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: a.articulationParameterId,
    modulationTargetKind: a.modulationTargetKind
  });
}
const pi = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: Fe * 100, defaultPercent: Fe * 100, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function gi(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Ii(t, e) {
  const n = `osc${t}`, i = Q(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: j(e.defaultPercent, i),
    initialValue: j(e.initialPercent, i),
    format: mt(e.format),
    modAmount: gi(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const bi = Object.freeze(
  be.flatMap((t) => pi.map((e) => Ii(t, e)))
), vi = Object.freeze({
  targetId: Q("voice", "globalTune"),
  moduleId: "voice",
  workspace: "voice",
  label: "Global Tune",
  defaultValue: A(
    (_e - L) / (K - L),
    "Global Tune default"
  ),
  initialValue: A(
    (_e - L) / (K - L),
    "Global Tune initial value"
  ),
  format: { kind: "semitone", span: K },
  modAmount: {
    min: ti,
    max: ni,
    unit: "st",
    digits: 2
  },
  binding: B(
    Zn,
    (t) => L + (K - L) * t,
    (t) => A(
      (t - L) / (K - L),
      "Global Tune endpoint conversion"
    )
  ),
  isQuick: !1,
  compound: null,
  articulationParameterId: null,
  modulationTargetKind: ei
}), yi = Object.freeze([
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
function Si(t) {
  const e = Q(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (r) => t.min + n * r, a = (r) => A(
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
    binding: B(t.endpointID, i, a),
    isQuick: !1,
    compound: null,
    articulationParameterId: t.articulationParameterId,
    modulationTargetKind: t.targetKind
  });
}
const Ti = Object.freeze(
  yi.map(Si)
), xi = Object.freeze([
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
function Ei(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function Z(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return A(n, `${t.endpointID} endpoint conversion`);
}
function Ri(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Ai(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Di(t) {
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
function Mi(t) {
  const e = Ei(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: Z(t, t.initial),
    initialValue: Z(t, t.initial),
    format: Ai(t),
    modAmount: Di(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Ri(t, n),
      fromEngine: (n) => Z(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : ve(ge(t))
  });
}
const Se = Object.freeze(
  [
    ...J.flatMap((t) => t.parameters.map(Mi)),
    ...xi,
    vi,
    ...bi,
    ...Ti,
    ...ai.flatMap(
      (t) => t.parameters.map(
        (e) => hi(t, e)
      )
    )
  ]
), Li = new Map(
  Se.map((t) => [t.targetId, t])
), ht = Se.filter(
  (t) => t.modulationTargetKind !== null
), ce = new Map(
  ht.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (Li.size !== Se.length)
  throw new Error("Target descriptor IDs must be unique");
if (ht.length !== w.length || ce.size !== w.length || w.some((t) => ce.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function ee(t) {
  const e = ce.get(t);
  return e === void 0 ? Xn(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  J.map((t) => [t.id, t.label])
);
function wi(t) {
  const e = Qn(t);
  return e === 1 ? "" : ` ${e}`;
}
function ki(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = ee(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = jn(t);
  if (n !== null) {
    const i = ee(Jn(n));
    return `${n.deviceType === "frequencySplit" ? "FREQUENCY SPLIT" : i.moduleId.toUpperCase()}${wi(n)} ${i.label.toUpperCase()}`;
  }
  return ee(t).label.toUpperCase();
}
const _i = je().filter((t) => t.modulationTargetIndex !== null);
new Map(
  _i.map((t) => [
    ve(ge(t)),
    t
  ])
);
const Oi = {
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
_.map((t) => ({
  value: t.id,
  label: Oi[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const Fi = w.map((t) => ({
  value: t.kind,
  label: ki(t.kind)
}));
Fi.filter((t) => !Ci(t.value));
function Ci(t) {
  return Wn(t) !== null;
}
const Ni = [
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
], Pi = [
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
  Ni.map((t, e) => [t, 2 ** e])
);
Object.fromEntries(
  Pi.map((t, e) => [t, 2 ** e])
);
const Ki = "runtimeSyncRequest", Ui = 2147483647, Bi = "runtimeState", $i = "retryDesiredTableRequest", zi = "workerLoadFailure", Hi = "serviceLoadAbort", Vi = "wavetableLoadBegin", Wi = "wavetableMipFrame", qi = "wavetableUploadAck", Gi = "wavetableMipRequest", ji = "wavetablePrewarmRequest", Ji = "wavetablePrewarmNotification", Qi = "assets/factory-bank-catalog.json", de = 3, Yi = 1, Xi = de * q, Zi = 1, er = 2, tr = 3, nr = 1, ir = 2, rr = 2e4, W = Zi, ar = er, Ne = tr, k = nr, Pe = ir, or = 48 * 1024 * 1024, te = 3;
function Ke(t, e) {
  const n = Math.round(Number(t));
  return Number.isFinite(n) && n > 0 ? n : e;
}
function b(t, e, n = null) {
  const i = typeof console?.[t] == "function" ? console[t].bind(console) : console.log?.bind(console);
  if (i) {
    if (n && Object.keys(n).length > 0) {
      i(`[wavetable-worker] ${e}`, n);
      return;
    }
    i(`[wavetable-worker] ${e}`);
  }
}
function Ue(t) {
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
function Be(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function $e(t, e) {
  if (!t)
    throw new Error(e);
}
function sr(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function lr(t, e) {
  return An(await t.readJSON(e));
}
function cr(t) {
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
function dr(t, e) {
  const n = Math.round(Number(t) || 0);
  return sr(n, 0, Math.max(0, e - 1));
}
function ne(t, e, n, i, a) {
  return `${t}:${e}:${n}:${i}:${a}`;
}
function ur(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function ze(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function He(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function Ve() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function fr(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class mr {
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
    this.connection = e, this.resourceClient = Rn(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Qi, this.maxBatchesInFlight = Ke(
      n.maxFramesInFlight,
      Yi
    ), this.mipLevelCount = n.mipLevelCount ?? st, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? or) || 0)), this.serviceLoadTimeoutMs = Ke(n.serviceLoadTimeoutMs, rr), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, b("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(Bi, this.handleRuntimeState), this.connection.addEndpointListener?.(qi, this.handleUploadAck), this.connection.addEndpointListener?.(Gi, this.handleMipRequest), this.connection.addEndpointListener?.(ji, this.handlePrewarmRequest), this.connection.addEndpointListener?.(Ji, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      Ki,
      Ui
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await lr(this.resourceClient, this.catalogPath), b("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < te; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = ze(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: ze(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = ne(
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
          ...He(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== a || !this.serviceLoadHasPendingTransfers()) && (b("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: Ne,
          failureReasonCode: Pe
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== Ne || e.failureReasonCode !== Pe ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: a = 0,
    candidateAttemptSerial: r = 0,
    failurePhase: c = W,
    failureReasonCode: l = k
  }) {
    this.connection.sendEventOrValue?.(zi, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: i,
      generation: a,
      candidateAttemptSerial: r,
      failurePhase: c,
      failureReasonCode: l
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: i,
    tableIndex: a,
    failureReasonCode: r = k
  }) {
    this.connection.sendEventOrValue?.(Hi, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: a,
      failureReasonCode: r
    });
  }
  emitRetryDesiredTableRequest(e) {
    b("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? Ue(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.($i, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), a = dr(e, i.tables.length), r = i.tables[a];
    $e(r, `Could not resolve table ${a}`);
    const c = ur(r, q, this.mipLevelCount), l = this.tableCache.get(c);
    if (l)
      return l.lastUsedSerial = this.cacheUseSerial++, b("info", "Using cached wavetable source table", {
        tableIndex: a,
        tableId: r.tableId,
        tableName: r.name,
        sourceWav: r.sourceWav,
        frameCount: l.frameCount,
        cacheBytes: this.tableCacheBytes
      }), l;
    const s = Ve();
    b("info", "Reading wavetable source", {
      tableIndex: a,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n
    });
    const o = await this.resourceClient.readAudio(r.sourceWav), f = kn(o.samples, {
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n,
      samplesPerFrame: q
    });
    return b("info", "Prepared wavetable source table", {
      tableIndex: a,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      frameCount: f.frameCount,
      loadDurationMs: Math.round(Ve() - s)
    }), this.rememberLoadedTable({
      cacheKey: c,
      tableIndex: a,
      tableMeta: r,
      frameCount: f.frameCount,
      frames: f.frames,
      spectra: new Array(f.frameCount)
    });
  }
  isMatchingServiceTable(e) {
    return !!(this.serviceTable && this.serviceTable.dspSessionId === e.dspSessionId && this.serviceTable.oscillatorIndex === e.oscillatorIndex && this.serviceTable.generation === e.generation && this.serviceTable.tableIndex === e.tableIndex);
  }
  markCommittedDesiredLoad(e, n, i) {
    b("info", "Committing desired wavetable load", {
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(Vi, {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      generation: n,
      tableIndex: e.desiredTableIndex,
      frameCount: i.frameCount
    }), this.createFullMipJobsForServiceTable(2), this.pumpUploads();
  }
  handleCandidateLoadFailure(e) {
    b("error", "Failed to prepare desired wavetable source", {
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      desiredIntentSerial: e.desiredIntentSerial,
      tableIndex: e.desiredTableIndex,
      failurePhase: W,
      failureReasonCode: k
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: W,
      failureReasonCode: k
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = W,
    failureReasonCode: i = k
  } = {}) {
    b("error", "Service wavetable load failed", {
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
      return this.isCurrentRuntimeState(n) && (b("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: ie(r)
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
    } catch (c) {
      this.isCurrentRuntimeState(e) && (b("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: ie(c)
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
    for (let e = 0; e < te; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, fr(() => {
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
        b("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
    const n = cr(e ?? {});
    if (b("info", "Received runtime state", Ue(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= te)
      return;
    const i = n.dspSessionId !== this.knownSessionId;
    i && this.resetSessionState(n);
    const a = n.oscillatorIndex, r = this.latestRuntimeStates[a], c = r ? this.getDesiredRetryKey(r) : null, l = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[a] = Math.max(
      this.nextLoadGenerations[a] ?? 1,
      n.generationFrontier + 1
    ), (i || c !== l) && (this.autoRetryConsumedKeys[a] = null), this.latestRuntimeStates[a] = n, this.pendingRuntimeStateOscillators.add(a), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(i))
      try {
        const a = await this.loadTableSource(i);
        for (let c = 0; c < a.frameCount; c += 1)
          a.spectra[c] || (a.spectra[c] = ke(a.frames[c]));
        const r = this.tableCache.get(a.cacheKey);
        r && this.refreshCacheEntryByteCount(r), b("info", "Prewarmed wavetable source table", {
          tableIndex: a.tableIndex,
          tableId: a.tableMeta.tableId,
          tableName: a.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (a) {
        b("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: ie(a)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), a = Math.trunc(Number(e?.generation)), r = Math.trunc(Number(e?.tableIndex)), c = Math.trunc(Number(e?.mipIndex)), l = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || a !== this.serviceTable.generation || r !== this.serviceTable.tableIndex || c < 0 || c >= this.mipLevelCount)
      return null;
    const s = ne(
      n,
      i,
      a,
      r,
      c
    );
    let o = this.mipJobs.get(s);
    return o ? (!o.completed && l > o.urgencyLevel && (o.urgencyLevel = l), o) : (o = {
      key: s,
      dspSessionId: n,
      oscillatorIndex: i,
      generation: a,
      tableIndex: r,
      mipIndex: c,
      urgencyLevel: l,
      ...He(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(s, o), o);
  }
  handleMipRequest(e) {
    const n = this.getOrCreateMipJob(e ?? {});
    !n || n.completed || (b("info", "Received wavetable mip request", {
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), a = Math.trunc(Number(n.oscillatorIndex)), r = Math.trunc(Number(n.generation)), c = Math.trunc(Number(n.tableIndex)), l = Math.trunc(Number(n.mipIndex)), s = Math.trunc(Number(n.frameIndexBase)), o = Math.trunc(Number(n.frameCount)), f = ne(
      i,
      a,
      r,
      c,
      l
    ), u = this.mipJobs.get(f), m = this.serviceTable?.frameCount ?? 0, p = Math.min(
      de,
      m - s
    );
    if (!(!u || u.completed || !u.inFlightBatchBases.has(s) || o <= 0 || o !== p)) {
      u.inFlightBatchBases.delete(s);
      for (let I = 0; I < o; I += 1) {
        const g = s + I;
        u.ackedFrames[g] || (u.ackedFrames[g] = 1, u.ackedFrameCount += 1);
      }
      u.ackedFrameCount === m && u.nextFrameIndex >= m && u.inFlightBatchBases.size === 0 && (u.completed = !0, this.activeUploadKey === u.key && (this.activeUploadKey = null)), Be(s, o, m) && b("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: a,
        generation: r,
        tableIndex: u.tableIndex,
        mipIndex: l,
        frameIndexBase: s,
        batchFrameCount: o,
        ackedFrameCount: u.ackedFrameCount,
        frameCount: m,
        inFlightBatches: u.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if ($e(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = ke(this.serviceTable.frames[e]);
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
        de,
        this.serviceTable.frameCount - n
      ), a = new Float32Array(Xi);
      try {
        for (let r = 0; r < i; r += 1) {
          const c = n + r, l = this.getSpectrumForFrame(c), s = _n(l, e.mipIndex);
          a.set(s, r * q);
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
            failurePhase: ar,
            failureReasonCode: k
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(Wi, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(a)
      }), Be(n, i, this.serviceTable.frameCount) && b("info", "Sent wavetable mip batch", {
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
function ie(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function hr(t, e = {}) {
  return new mr(t, e);
}
async function pr(t, e = {}) {
  return bt(t, [
    gn,
    () => hr(t, e)
  ]);
}
export {
  pr as default
};
