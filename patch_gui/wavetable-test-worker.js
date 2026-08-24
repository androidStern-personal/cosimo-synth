class lt {
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
function dt(t, e) {
  return new lt(t, e);
}
async function ct(t, e) {
  const n = dt(t, e);
  return await n.start(), n;
}
const Fe = 8, ae = 5, Ne = 8, ut = Object.freeze({
  globalFilter: 0,
  distortion: 1,
  ott: 2,
  chorus: 3,
  flanger: 4,
  phaser: 5,
  delay: 6,
  reverb: 7
}), Pe = Object.freeze({
  globalFilter: ["globalFilterMode", "globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"],
  distortion: ["distortionMode", "distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"],
  ott: ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"],
  chorus: ["chorusMix", "chorusMotionMode", "chorusBloomMode", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingOffsetMode", "chorusRingFineSemitones"],
  flanger: ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"],
  phaser: ["phaserRate", "phaserRateMode", "phaserRateDivision", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"],
  delay: ["delayTime", "delayFeedback", "delayFilter", "delayMix", "delayTimeMode", "delayDivision"],
  reverb: ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]
});
function Oe(t) {
  return Pe[t];
}
function ft(t, e) {
  if (!Number.isInteger(e) || e < 0 || e >= ae)
    throw new Error(`Lane ordinal out of range: ${e}`);
  return e * Ne + ut[t];
}
function ht(t, e) {
  const n = new Array(Fe).fill(0);
  return Pe[t].forEach((i, a) => {
    const r = e[i];
    if (typeof r != "number" || !Number.isFinite(r))
      throw new Error(`Missing lane parameter value: ${t}.${i}`);
    n[a] = r;
  }), n;
}
const S = (t, e) => ({ label: t, value: e });
function R(t, e) {
  try {
    return t();
  } catch {
    return e;
  }
}
const E = Object.freeze({
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
}), c = (t, e, n, i, a, r, l, d = {}) => ({
  id: `${t}.${e}`,
  effectId: t,
  endpointID: e,
  label: n,
  shortLabel: i,
  min: a,
  max: r,
  initial: l,
  step: d.step ?? (r - a) / 1e3,
  scale: d.scale ?? "linear",
  unit: d.unit ?? "",
  choices: d.choices,
  quick: d.quick ?? !1,
  modulationTargetIndex: d.modulationTargetIndex ?? null,
  modulationApplication: d.modulationApplication ?? (d.modulationTargetIndex === void 0 || d.modulationTargetIndex === null ? null : "linear"),
  modulationDragStyle: d.modulationDragStyle
}), mt = ["4/1", "2/1", "1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/4T", "1/8.", "1/8", "1/8T", "1/16"], pt = ["1/1", "1/2.", "1/2", "1/4.", "1/2T", "1/4", "1/8.", "1/4T", "1/8", "1/16.", "1/8T", "1/16", "1/16T"], gt = [
  {
    id: "filter",
    label: "Filter",
    summary: "Final tone shaping for the complete voice mix.",
    iconUrl: E.filter,
    initialQuickEndpointID: "globalFilterCutoff",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      c("filter", "globalFilterMode", "Mode", "Mode", 0, 5, 1, { step: 1, choices: ["Off", "Lowpass", "Highpass", "Bandpass", "Notch", "Peak"].map(S), quick: !0 }),
      c("filter", "globalFilterCutoff", "Cutoff", "Cut", 20, 2e4, 2e4, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 0, modulationApplication: "octaves" }),
      c("filter", "globalFilterResonance", "Resonance", "Res", 0.1, 20, 0.707107, { scale: "log", modulationTargetIndex: 1, modulationDragStyle: "effective-value" }),
      c("filter", "globalFilterDrive", "Drive", "Drv", 0, 1, 0, { modulationTargetIndex: 2 })
    ]
  },
  {
    id: "drive",
    label: "Distortion",
    summary: "Classic clipping or harmonic-residue saturation.",
    iconUrl: E.drive,
    initialQuickEndpointID: "distortionDriveDb",
    xEndpointID: null,
    yEndpointID: null,
    parameters: [
      c("drive", "distortionMode", "Mode", "Mode", 0, 1, 0, { step: 1, choices: [S("Classic", 0), S("Harmonics", 1)] }),
      c("drive", "distortionDriveDb", "Drive", "Drv", 0, 36, 12, { unit: "dB", quick: !0, modulationTargetIndex: 3 }),
      c("drive", "distortionKnee", "Knee", "Kne", 0, 1, 0.35, { modulationTargetIndex: 4 }),
      c("drive", "distortionWet", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 5 }),
      c("drive", "distortionWetHPHz", "Wet High-pass", "HP", 20, 4e3, 40, { unit: "Hz", scale: "log", modulationTargetIndex: 6, modulationApplication: "octaves" }),
      c("drive", "distortionWetLPHz", "Wet Low-pass", "LP", 20, 2e4, 18e3, { unit: "Hz", scale: "log", modulationTargetIndex: 7, modulationApplication: "octaves" })
    ]
  },
  {
    id: "ott",
    label: "OTT",
    summary: "Upward/downward multiband dynamics with envelope matching.",
    iconUrl: E.ott,
    initialQuickEndpointID: "ottAmount",
    xEndpointID: "ottAmount",
    yEndpointID: "ottTimePercent",
    parameters: [
      c("ott", "ottMix", "Mix", "Mix", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 8 }),
      c("ott", "ottAmount", "Amount", "Amt", 0, 100, 100, { unit: "%", quick: !0, modulationTargetIndex: 9 }),
      c("ott", "ottTimePercent", "Time", "Time", 10, 1e3, 100, { unit: "%", scale: "log", modulationTargetIndex: 10 }),
      c("ott", "ottBandDrive", "Band Drive", "Drv", 0, 100, 0, { unit: "%", modulationTargetIndex: 11 }),
      c("ott", "ottEnvelopeMatch", "Envelope Match", "Env", 0, 100, 0, { unit: "%", modulationTargetIndex: 12 })
    ]
  },
  {
    id: "chorus",
    label: "Chorus",
    summary: "Modulated ensemble, bloom, and pitch-following ring colour.",
    iconUrl: E.chorus,
    initialQuickEndpointID: "chorusMix",
    xEndpointID: "chorusTone",
    yEndpointID: "chorusFeedback",
    parameters: [
      c("chorus", "chorusMotionMode", "Motion", "Mot", 0, 3, 1, { step: 1, choices: ["Subtle", "Wide", "Classic", "Fast"].map(S) }),
      c("chorus", "chorusBloomMode", "Bloom", "Blm", 0, 4, 0, { step: 1, choices: ["Clean", "Small", "Large", "Sm+Sh", "Lg+Sh"].map(S) }),
      c("chorus", "chorusMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 13 }),
      c("chorus", "chorusTone", "Tone", "Tone", 0, 1, 0.5, { modulationTargetIndex: 14 }),
      c("chorus", "chorusFeedback", "Feedback", "Fdbk", 0, 0.95, 0.42, { modulationTargetIndex: 15 }),
      c("chorus", "chorusRingAmount", "Ring", "Ring", 0, 1, 0, { modulationTargetIndex: 16 }),
      c("chorus", "chorusRingOffsetMode", "Ring Pitch", "Pitch", 0, 3, 0, { step: 1, choices: ["+5th", "Low 5th", "+Oct", "-Oct"].map(S) }),
      c("chorus", "chorusRingFineSemitones", "Ring Fine", "Fine", -2, 2, 0, { unit: "st", modulationTargetIndex: 17 })
    ]
  },
  {
    id: "flanger",
    label: "Flanger",
    summary: "Short swept comb delay with signed feedback.",
    iconUrl: E.flanger,
    initialQuickEndpointID: "flangerRate",
    xEndpointID: "flangerRate",
    yEndpointID: "flangerDepth",
    parameters: [
      c("flanger", "flangerRate", "Rate", "Rate", 0.02, 8, 0.35, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 18 }),
      c("flanger", "flangerDepth", "Depth", "Dpt", 0, 1, 0.6, { quick: !0, modulationTargetIndex: 19 }),
      c("flanger", "flangerFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 20 }),
      c("flanger", "flangerMix", "Mix", "Mix", 0, 1, 0, { modulationTargetIndex: 21 })
    ]
  },
  {
    id: "phaser",
    label: "Phaser",
    summary: "Eight-pole swept all-pass network with Free/Sync rate.",
    iconUrl: E.phaser,
    initialQuickEndpointID: "phaserRate",
    xEndpointID: "phaserFrequency",
    yEndpointID: "phaserDepth",
    parameters: [
      c("phaser", "phaserRateMode", "Rate Mode", "Mode", 0, 1, 0, { step: 1, choices: [S("Free", 0), S("Sync", 1)] }),
      c("phaser", "phaserRate", "Rate", "Rate", 0.02, 8, 0.3, { unit: "Hz", scale: "log", quick: !0, modulationTargetIndex: 22 }),
      c("phaser", "phaserRateDivision", "Division", "Div", 0, 12, 2, { step: 1, choices: mt.map(S) }),
      c("phaser", "phaserDepth", "Depth", "Dpt", 0, 1, 0.7, { modulationTargetIndex: 23 }),
      c("phaser", "phaserFrequency", "Frequency", "Freq", 60, 8e3, 600, { unit: "Hz", scale: "log", modulationTargetIndex: 24, modulationApplication: "octaves" }),
      c("phaser", "phaserFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0, { modulationTargetIndex: 25 }),
      c("phaser", "phaserPhase", "Stereo Phase", "Phase", -180, 180, 90, { unit: "deg", modulationTargetIndex: 26 }),
      c("phaser", "phaserMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 27 })
    ]
  },
  {
    id: "delay",
    label: "Delay",
    summary: "Tape-gliding stereo delay with Free/Sync timing.",
    iconUrl: E.delay,
    initialQuickEndpointID: "delayTime",
    xEndpointID: "delayTime",
    yEndpointID: "delayFeedback",
    parameters: [
      c("delay", "delayTimeMode", "Timing", "Mode", 0, 1, 0, { step: 1, choices: [S("Free", 0), S("Sync", 1)] }),
      c("delay", "delayTime", "Time", "Time", 1, 2e3, 375, { unit: "ms", scale: "log", quick: !0, modulationTargetIndex: 28, modulationApplication: "octaves" }),
      c("delay", "delayDivision", "Division", "Div", 0, 12, 8, { step: 1, choices: pt.map(S) }),
      c("delay", "delayFeedback", "Feedback", "Fdbk", -0.95, 0.95, 0.35, { modulationTargetIndex: 29 }),
      c("delay", "delayFilter", "Filter", "Filt", 200, 18e3, 6e3, { unit: "Hz", scale: "log", modulationTargetIndex: 30, modulationApplication: "octaves" }),
      c("delay", "delayMix", "Mix", "Mix", 0, 1, 0, { quick: !0, modulationTargetIndex: 31 })
    ]
  },
  {
    id: "reverb",
    label: "Reverb",
    summary: "Modulated early reflections into a four-line stereo tank.",
    iconUrl: E.reverb,
    initialQuickEndpointID: "reverbSize",
    xEndpointID: "reverbSize",
    yEndpointID: "reverbDecay",
    parameters: [
      c("reverb", "reverbSize", "Size", "Size", 0, 1, 0.5, { quick: !0, modulationTargetIndex: 32 }),
      c("reverb", "reverbDecay", "Decay", "Dcy", 0, 1, 0.4, { quick: !0, modulationTargetIndex: 33 }),
      c("reverb", "reverbDamping", "Damping", "Dmp", 0, 1, 0.5, { modulationTargetIndex: 34 }),
      c("reverb", "reverbMix", "Mix", "Mix", 0, 1, 0, { modulationTargetIndex: 35 })
    ]
  }
], W = gt, Ue = Object.freeze(
  W.flatMap((t) => t.parameters)
);
new Map(
  Ue.map((t) => [t.endpointID, t])
);
function $e(t) {
  const e = W.find((n) => n.id === t);
  if (e === void 0)
    throw new Error(`Unknown rack effect: ${t}`);
  return e;
}
function Be() {
  return Ue;
}
const I = "lane.v1", It = "laneTopology", me = "laneSlotParams", X = 16, bt = 8, Ke = 4, vt = 3, Ve = ae * Ne, ze = 4, St = 4, yt = Ve, xt = Ve + ze, Tt = 0, Rt = 1;
function Et(t, e) {
  if (!Number.isInteger(e) || e < 0 || e > Ke)
    throw new Error(`Invalid lane branch tag: ${String(e)}`);
  return t | e << bt;
}
const y = Object.freeze([
  "filter",
  "drive",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
]), K = Object.freeze({
  filter: "globalFilter",
  drive: "distortion",
  ott: "ott",
  chorus: "chorus",
  flanger: "flanger",
  phaser: "phaser",
  delay: "delay",
  reverb: "reverb"
});
new Map(
  Object.entries(K).map(([t, e]) => [e, t])
);
const At = Object.freeze({
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
  y.map((t) => [At[t], t])
);
function We() {
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
function wt(t) {
  return Object.fromEntries(
    $e(t).parameters.map((e) => [e.endpointID, e.initial])
  );
}
function Dt() {
  return {
    format: "cosimo.lane",
    version: 1,
    order: [...y],
    enabled: We(),
    params: Object.fromEntries(
      y.map((t) => [t, wt(t)])
    )
  };
}
function Mt(t) {
  if (typeof t != "string")
    return { _tag: "json", value: t };
  if (t.trim().length === 0)
    return { _tag: "err", message: `${I} must not be empty` };
  try {
    return { _tag: "json", value: JSON.parse(t) };
  } catch (e) {
    const n = e instanceof Error ? e.message : String(e);
    return { _tag: "err", message: `${I} is not valid JSON: ${n}` };
  }
}
function N(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function Lt(t) {
  return typeof t != "string" ? null : y.find((e) => e === t) ?? null;
}
function kt(t) {
  const e = Mt(t);
  if (e._tag === "err")
    return e;
  if (!N(e.value))
    return { _tag: "err", message: `${I} must be an object` };
  const n = /* @__PURE__ */ new Set(["format", "version", "order", "enabled", "params"]);
  for (const d of Reflect.ownKeys(e.value))
    if (typeof d != "string" || !n.has(d))
      return { _tag: "err", message: `${I} has unexpected field ${String(d)}` };
  if (e.value.format !== "cosimo.lane" || e.value.version !== 1)
    return { _tag: "err", message: `${I} must be cosimo.lane version 1` };
  if (!Array.isArray(e.value.order) || e.value.order.length !== y.length)
    return { _tag: "err", message: `${I}.order must contain every effect once` };
  const i = [], a = /* @__PURE__ */ new Set();
  for (const d of e.value.order) {
    const o = Lt(d);
    if (o === null || a.has(o))
      return { _tag: "err", message: `${I}.order is not a complete permutation` };
    a.add(o), i.push(o);
  }
  if (!N(e.value.enabled))
    return { _tag: "err", message: `${I}.enabled must be an object` };
  if (Reflect.ownKeys(e.value.enabled).length !== y.length)
    return { _tag: "err", message: `${I}.enabled must contain every effect once` };
  const r = We();
  for (const d of y) {
    const o = e.value.enabled[d];
    if (typeof o != "boolean")
      return { _tag: "err", message: `${I}.enabled.${d} must be boolean` };
    r[d] = o;
  }
  if (!N(e.value.params))
    return { _tag: "err", message: `${I}.params must be an object` };
  if (Reflect.ownKeys(e.value.params).length !== y.length)
    return { _tag: "err", message: `${I}.params must contain every effect once` };
  const l = {};
  for (const d of y) {
    const o = e.value.params[d];
    if (!N(o))
      return { _tag: "err", message: `${I}.params.${d} must be an object` };
    const s = $e(d).parameters;
    if (Reflect.ownKeys(o).length !== s.length)
      return { _tag: "err", message: `${I}.params.${d} must contain every parameter once` };
    const u = {};
    for (const f of s) {
      const h = o[f.endpointID];
      if (typeof h != "number" || !Number.isFinite(h))
        return { _tag: "err", message: `${I}.params.${d}.${f.endpointID} must be a finite number` };
      u[f.endpointID] = h;
    }
    l[d] = u;
  }
  return {
    _tag: "ok",
    value: { format: "cosimo.lane", version: 1, order: i, enabled: r, params: l }
  };
}
const He = 40, qe = 18e3, Z = y.map((t) => K[t]), Ct = /^([a-zA-Z]+)#([1-9][0-9]*)$/, _t = /^(parallel|split)#([1-9][0-9]*)$/;
function oe(t) {
  if (typeof t != "string")
    return null;
  const e = Ct.exec(t);
  if (e === null)
    return null;
  const n = Z.find((a) => a === e[1]);
  if (n === void 0)
    return null;
  const i = Number(e[2]);
  return i > ae ? null : { deviceType: n, instanceNumber: i };
}
function Ge(t) {
  if (typeof t != "string")
    return null;
  const e = _t.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = Number(e[2]);
  return i > (n === "parallel" ? ze : St) ? null : { groupKind: n, unitNumber: i };
}
function L(t) {
  return typeof t == "object" && t !== null && !Array.isArray(t);
}
function V(t, e) {
  const n = Reflect.ownKeys(t);
  return n.length === e.length && n.every((i) => typeof i == "string" && e.includes(i));
}
function m(t) {
  return { _tag: "err", message: `lane.v2 ${t}` };
}
function Ft(t, e) {
  const n = oe(t);
  if (n === null)
    return { failure: m(`device id ${t} is not a pool instance`) };
  if (!L(e) || !V(e, ["params"]) || !L(e.params))
    return { failure: m(`device ${t} must be { params }`) };
  const i = Oe(n.deviceType);
  if (Reflect.ownKeys(e.params).length !== i.length)
    return { failure: m(`device ${t} must carry every parameter once`) };
  const a = {};
  for (const r of i) {
    const l = e.params[r];
    if (typeof l != "number" || !Number.isFinite(l))
      return { failure: m(`device ${t}.${r} must be a finite number`) };
    a[r] = l;
  }
  return { record: { params: a } };
}
function Nt(t, e) {
  return !L(t) || t.kind !== "device" ? { failure: m("branches may hold device placements only") } : V(t, ["kind", "deviceId", "enabled"]) ? typeof t.deviceId != "string" || !e.has(t.deviceId) ? { failure: m(`placement references unknown device ${String(t.deviceId)}`) } : typeof t.enabled != "boolean" ? { failure: m(`placement of ${t.deviceId} needs a boolean enable`) } : { placement: { kind: "device", deviceId: t.deviceId, enabled: t.enabled } } : { failure: m("a device placement is { kind, deviceId, enabled }") };
}
function pe(t) {
  return typeof t == "number" && Number.isFinite(t) && t >= He && t <= qe;
}
function Pt(t) {
  let e = t;
  if (typeof t == "string")
    try {
      e = JSON.parse(t);
    } catch (s) {
      const u = s instanceof Error ? s.message : String(s);
      return m(`is not valid JSON: ${u}`);
    }
  if (!L(e) || !V(e, ["format", "version", "devices", "chain"]))
    return m("must be { format, version, devices, chain }");
  if (e.format !== "cosimo.lane" || e.version !== 2)
    return m("must be cosimo.lane version 2");
  if (!L(e.devices))
    return m("devices must be an object");
  if (!Array.isArray(e.chain))
    return m("chain must be an array");
  const n = {};
  for (const s of Reflect.ownKeys(e.devices)) {
    if (typeof s != "string")
      return m("device ids must be strings");
    const u = Ft(s, e.devices[s]);
    if ("failure" in u)
      return u.failure;
    n[s] = u.record;
  }
  const i = new Set(Object.keys(n)), a = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set(), l = [];
  let d = 0;
  const o = (s) => {
    const u = Nt(s, i);
    return "placement" in u && (a.set(
      u.placement.deviceId,
      (a.get(u.placement.deviceId) ?? 0) + 1
    ), d += 1), u;
  };
  for (const s of e.chain) {
    if (!L(s))
      return m("chain nodes must be objects");
    if (s.kind === "device") {
      const b = o(s);
      if ("failure" in b)
        return b.failure;
      l.push(b.placement);
      continue;
    }
    if (s.kind !== "parallel" && s.kind !== "split")
      return m(`unknown chain node kind ${String(s.kind)}`);
    const u = s.kind === "split", f = u ? ["kind", "groupId", "enabled", "xoverLowHz", "xoverHighHz", "branches"] : ["kind", "groupId", "enabled", "branches"];
    if (!V(s, f))
      return m(`a ${s.kind} group is { ${f.join(", ")} }`);
    const h = Ge(s.groupId);
    if (h === null || h.groupKind !== s.kind)
      return m(`group id ${String(s.groupId)} does not name a ${s.kind} unit`);
    if (r.has(String(s.groupId)))
      return m(`group ${String(s.groupId)} is used twice`);
    if (r.add(String(s.groupId)), typeof s.enabled != "boolean")
      return m(`group ${String(s.groupId)} needs a boolean enable`);
    const p = u ? vt : Ke;
    if (!Array.isArray(s.branches) || s.branches.length < 2 || s.branches.length > p)
      return m(`group ${String(s.groupId)} needs 2..${p} branches`);
    if (u && (!pe(s.xoverLowHz) || !pe(s.xoverHighHz)))
      return m(`group ${String(s.groupId)} crossovers must sit in ${He}..${qe} Hz`);
    d += 1;
    const v = [];
    for (const b of s.branches) {
      if (!Array.isArray(b))
        return m(`group ${String(s.groupId)} branches must be arrays`);
      const C = [];
      for (const F of b) {
        const M = o(F);
        if ("failure" in M)
          return M.failure;
        C.push(M.placement);
      }
      v.push(C);
    }
    l.push(u ? {
      kind: "split",
      groupId: String(s.groupId),
      enabled: s.enabled,
      xoverLowHz: s.xoverLowHz,
      xoverHighHz: s.xoverHighHz,
      branches: v
    } : {
      kind: "parallel",
      groupId: String(s.groupId),
      enabled: s.enabled,
      branches: v
    });
  }
  for (const s of i)
    if ((a.get(s) ?? 0) !== 1)
      return m(`device ${s} must be placed exactly once`);
  return d > X ? m(`flattens to ${d} wire entries; the topology upload holds ${X}`) : { _tag: "ok", value: { format: "cosimo.lane", version: 2, devices: n, chain: l } };
}
function je(t) {
  const e = {};
  for (const n of y) {
    const i = K[n];
    e[`${i}#1`] = {
      params: Object.fromEntries(Oe(i).map((a) => [
        a,
        t.params[n][a] ?? 0
      ]))
    };
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.order.map((n) => ({
      kind: "device",
      deviceId: `${K[n]}#1`,
      enabled: t.enabled[n]
    }))
  };
}
const ge = ["distortion#1", "delay#1", "reverb#1"];
function Ie() {
  const t = je(Dt()), e = {};
  for (const n of ge) {
    const i = t.devices[n];
    if (i === void 0)
      throw new Error(`The v1 default is missing starter device ${n}`);
    e[n] = i;
  }
  return {
    format: "cosimo.lane",
    version: 2,
    devices: e,
    chain: t.chain.filter((n) => n.kind === "device" && ge.includes(n.deviceId))
  };
}
function Ot(t) {
  if (t === void 0)
    return Ie();
  const e = Pt(t);
  if (e._tag === "ok")
    return e.value;
  const n = kt(t);
  return n._tag === "ok" ? je(n.value) : Ie();
}
function Ut(t) {
  return Object.keys(t.devices).map((e) => {
    const n = oe(e);
    if (n === null)
      throw new Error(`Invalid lane instance id in state: ${e}`);
    return { instanceId: e, parsed: n };
  }).sort((e, n) => Z.indexOf(e.parsed.deviceType) - Z.indexOf(n.parsed.deviceType) || e.parsed.instanceNumber - n.parsed.instanceNumber).map(({ instanceId: e, parsed: n }) => ({ instanceId: e, deviceType: n.deviceType }));
}
function ee(t) {
  const e = oe(t);
  if (e === null)
    throw new Error(`Invalid lane instance id in state: ${t}`);
  return ft(e.deviceType, e.instanceNumber - 1);
}
function Je(t) {
  const e = Ge(t.groupId);
  if (e === null)
    throw new Error(`Invalid lane group id in state: ${t.groupId}`);
  return (e.groupKind === "parallel" ? yt : xt) + (e.unitNumber - 1);
}
function $t(t) {
  const e = new Array(X).fill(0);
  let n = 0, i = 0;
  const a = (r, l, d) => {
    e[i] = Et(r, l), d && (n |= 1 << i), i += 1;
  };
  for (const r of t.chain) {
    if (r.kind === "device") {
      a(ee(r.deviceId), 0, r.enabled);
      continue;
    }
    a(Je(r), r.branches.length, r.enabled), r.branches.forEach((l, d) => {
      for (const o of l)
        a(ee(o.deviceId), d + 1, o.enabled);
    });
  }
  return { chainLength: i, slotIds: e, enabledMask: n };
}
function Bt(t) {
  const e = new Array(Fe).fill(0);
  return e[Tt] = t.xoverLowHz, e[Rt] = t.xoverHighHz, e;
}
function Kt(t) {
  const e = [];
  let n = 0;
  for (const i of Ut(t))
    n += 1, e.push({
      endpointID: me,
      value: {
        slotId: ee(i.instanceId),
        deliverySerial: n,
        values: ht(
          i.deviceType,
          t.devices[i.instanceId].params
        )
      }
    });
  for (const i of t.chain)
    i.kind === "split" && (n += 1, e.push({
      endpointID: me,
      value: {
        slotId: Je(i),
        deliverySerial: n,
        values: Bt(i)
      }
    }));
  return e.push({
    endpointID: It,
    value: $t(t)
  }), e;
}
const Vt = "runtimeState";
function zt(t) {
  if (typeof t != "object" || t === null || Array.isArray(t))
    return 0;
  const e = Number(Reflect.get(t, "dspSessionId"));
  return Number.isFinite(e) ? Math.trunc(e) : 0;
}
const Wt = {
  endpointID: Vt,
  required: !0,
  mapValue: zt
}, Ht = 2e3;
function be(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
function qt(t, e) {
  const n = t && typeof t == "object" ? t : {}, i = n.values && typeof n.values == "object" ? n.values : {};
  return be(i, e) ? {
    found: !0,
    value: i[e]
  } : be(n, e) ? {
    found: !0,
    value: n[e]
  } : {
    found: !1,
    value: void 0
  };
}
function ve(t) {
  try {
    return JSON.stringify(t);
  } catch {
    return String(t);
  }
}
class Gt {
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
    this.connection = e, this.options = n, this.parameterEndpointIDs = [...new Set(n.parameterEndpointIDs ?? [])], this.runtimeEndpointDependencies = jt(n.runtimeEndpointDependencies ?? []), this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
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
        const n = qt(e, this.options.stateKey);
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
    }, a = ve(n), r = !this.forceFullReplay && a === this.lastAppliedRuntimeEndpointsToken ? this.lastAppliedSnapshot : null, l = this.options.buildRuntimeEvents(i, r), d = ve({
      runtimeEndpoints: n,
      events: l
    });
    if (d === this.lastAppliedToken) {
      this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i;
      return;
    }
    if (l.length === 0) {
      this.lastAppliedToken = d, this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i, this.forceFullReplay = !1;
      return;
    }
    if (this.options.sendRuntimeEvents) {
      this.deliveryInProgress = !0, this.deliveryRefreshPending = !1, this.forceFullReplay = !1, this.options.sendRuntimeEvents(l, i).then((o) => {
        if (this.deliveryInProgress = !1, !this.started)
          return;
        o ? (this.lastAppliedToken = d, this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i) : this.options.onDeliveryFailure?.(l);
        const s = this.deliveryRefreshPending;
        this.deliveryRefreshPending = !1, s && this.applyRuntimeStateIfReady();
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
        this.options.sendTimeoutMilliseconds ?? Ht
      );
    this.lastAppliedToken = d, this.lastAppliedRuntimeEndpointsToken = a, this.lastAppliedSnapshot = i;
  }
}
function jt(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t)
    e.has(n.endpointID) || e.set(n.endpointID, n);
  return [...e.values()];
}
function Jt(t, e) {
  return new Gt(t, e);
}
function Qt(t) {
  return Jt(t, {
    stateKey: I,
    runtimeEndpointDependencies: [Wt],
    applyDefaultRuntimeStateWhenMissing: !0,
    deserializeStoredState: Ot,
    buildRuntimeEvents: ({ state: e }) => [...Kt(e)]
  });
}
function x(t, e) {
  if (!t)
    throw new Error(e);
}
function H(t, e, n) {
  let i = "";
  for (let a = 0; a < n; a += 1)
    i += String.fromCharCode(t.getUint8(e + a));
  return i;
}
function Yt(t) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t);
}
function te(t) {
  return typeof TextEncoder == "function" ? new TextEncoder().encode(t) : Uint8Array.from(t, (e) => e.charCodeAt(0));
}
function Qe(t) {
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
function Xt() {
  const t = globalThis.location?.href;
  if (typeof t == "string" && t.length > 0)
    return new URL("/", t);
  const e = new URL(import.meta.url), n = e.pathname;
  return n.includes("/patch_gui/desktop/") ? (e.pathname = n.replace(/\/patch_gui\/desktop\/[^/]+$/, "/"), e) : n.includes("/patch_gui/") ? (e.pathname = n.replace(/\/patch_gui\/[^/]+$/, "/"), e) : n.includes("/ui/shared/") ? (e.pathname = n.replace(/\/ui\/shared\/[^/]+$/, "/"), e) : (e.pathname = n.replace(/\/[^/]+$/, "/"), e);
}
function q(t, e) {
  const n = Xt();
  if (e instanceof URL)
    return e;
  if (typeof e == "string" && e.length > 0) {
    if (Yt(e))
      return new URL(e);
    const i = e.startsWith("/") ? e.slice(1) : e;
    return new URL(i, n);
  }
  return new URL(t, n);
}
async function Se(t) {
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
  throw new Error(`Unsupported text resource payload (${Qe(t)})`);
}
function Zt(t) {
  if (t instanceof ArrayBuffer)
    return new Uint8Array(t.slice(0));
  if (ArrayBuffer.isView(t))
    return new Uint8Array(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength));
  if (Array.isArray(t))
    return Uint8Array.from(t);
  if (typeof t == "string")
    return te(t);
  throw new Error(`Unsupported binary resource payload (${Qe(t)})`);
}
function en(t) {
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
function Ye(t) {
  const e = new DataView(t);
  x(H(e, 0, 4) === "RIFF", "Expected a RIFF wave file"), x(H(e, 8, 4) === "WAVE", "Expected a WAVE file");
  let n = null, i = null, a = null, r = null, l = null, d = null, o = null, s = 12;
  for (; s + 8 <= e.byteLength; ) {
    const f = H(e, s, 4), h = e.getUint32(s + 4, !0), p = s + 8;
    f === "fmt " ? (n = e.getUint16(p, !0), i = e.getUint16(p + 2, !0), a = e.getUint32(p + 4, !0), l = e.getUint16(p + 12, !0), r = e.getUint16(p + 14, !0)) : f === "data" && (d = p, o = h), s = p + h + h % 2;
  }
  x(n !== null, "Wave file is missing a fmt chunk"), x(d !== null && o !== null, "Wave file is missing a data chunk"), x(i === 1, "Only mono wavetable bank files are supported");
  let u;
  if (n === 3 && r === 32)
    u = new Float32Array(t.slice(d, d + o));
  else if (n === 1 && r === 16) {
    const f = o / 2, h = new Int16Array(t.slice(d, d + o));
    u = new Float32Array(f);
    for (let p = 0; p < f; p += 1)
      u[p] = h[p] / 32768;
  } else
    throw new Error(`Unsupported WAV format: format=${n}, bitsPerSample=${r}`);
  return {
    format: n,
    channelCount: i,
    sampleRate: a ?? 0,
    bitsPerSample: r,
    blockAlign: l ?? 0,
    samples: u
  };
}
async function ye(t) {
  x(typeof fetch == "function", `Could not fetch ${t}: global fetch is unavailable`);
  const e = await fetch(t.toString());
  return x(e.ok, `Failed to fetch resource from ${t}`), e.arrayBuffer();
}
function ne(t) {
  return typeof TextDecoder == "function" ? new TextDecoder().decode(t) : String.fromCharCode(...t);
}
function Xe(t) {
  const e = new Uint8Array(t).buffer, n = Ye(e);
  return {
    sampleRate: n.sampleRate,
    samples: n.samples
  };
}
function tn(t, {
  textPreference: e = "bridge",
  audioPreference: n = "url"
} = {}) {
  const i = async (o) => (x(typeof t.readResource == "function", `Resource bridge cannot read ${o}`), t.readResource(o)), a = async (o) => {
    x(typeof t.readResourceAsAudioData == "function", `Audio resource bridge cannot read ${o}`);
    const s = await t.readResourceAsAudioData(o);
    return en(s);
  }, r = (o) => {
    const s = t.getResourceAddress?.(o);
    return s ?? null;
  }, l = async (o, s = t.getResourceAddress?.(o)) => {
    const u = q(o, s), f = await ye(u), h = Ye(f);
    return {
      sampleRate: h.sampleRate,
      samples: h.samples
    };
  }, d = async (o, s = t.getResourceAddress?.(o)) => {
    const u = q(o, s);
    return new Uint8Array(await ye(u));
  };
  return {
    async readText(o) {
      if (e === "bridge" && typeof t.readResource == "function")
        return Se(await i(o));
      const s = r(o);
      return e === "url" && s !== null ? ne(await d(o, s)) : typeof t.readResource == "function" ? Se(await i(o)) : ne(await d(o, s));
    },
    async readJSON(o) {
      return JSON.parse(await this.readText(o));
    },
    async readBytes(o) {
      return typeof t.readResource == "function" ? Zt(await i(o)) : d(o);
    },
    async readAudio(o) {
      if (n === "bridge" && typeof t.readResourceAsAudioData == "function")
        return a(o);
      const s = r(o);
      return n === "url" && s !== null ? l(o, s) : typeof t.readResourceAsAudioData == "function" ? a(o) : Xe(await this.readBytes(o));
    },
    getURL(o) {
      return q(o, t.getResourceAddress?.(o));
    }
  };
}
function nn(t) {
  const e = t ?? {}, n = !!e.prefersAudioResourceReadBridge;
  return tn(e, {
    textPreference: "bridge",
    audioPreference: n ? "bridge" : "url"
  });
}
function rn(t) {
  const e = typeof t.readText == "function" ? t.readText.bind(t) : null, n = typeof t.readJSON == "function" ? t.readJSON.bind(t) : null, i = typeof t.readBytes == "function" ? t.readBytes.bind(t) : null, a = typeof t.readAudio == "function" ? t.readAudio.bind(t) : null, r = typeof t.getURL == "function" ? t.getURL.bind(t) : null;
  return {
    async readText(l) {
      if (e)
        return e(l);
      if (n)
        return JSON.stringify(await n(l));
      if (i)
        return ne(await i(l));
      throw new Error(`Resource client cannot read text ${l}`);
    },
    async readJSON(l) {
      return n ? n(l) : JSON.parse(await this.readText(l));
    },
    async readBytes(l) {
      if (i)
        return i(l);
      if (e)
        return te(await e(l));
      if (n)
        return te(JSON.stringify(await n(l)));
      throw new Error(`Resource client cannot read bytes ${l}`);
    },
    async readAudio(l) {
      return a ? a(l) : Xe(await this.readBytes(l));
    },
    getURL(l) {
      return r ? r(l) : null;
    }
  };
}
function an(t) {
  return typeof t?.readText == "function" || typeof t?.readJSON == "function" || typeof t?.readBytes == "function" || typeof t?.readAudio == "function";
}
function on(t) {
  return an(t) ? rn(t) : nn(t);
}
const U = 2048;
function _(t, e) {
  if (!t)
    throw new Error(e);
}
function sn(t) {
  _(
    Array.isArray(t?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const e = t;
  return e.tables.forEach((n, i) => {
    _(
      typeof n?.tableId == "string" && n.tableId.length > 0,
      `Factory bank catalog table ${i} must provide tableId`
    ), _(
      typeof n?.name == "string" && n.name.length > 0,
      `Factory bank catalog table ${i} must provide name`
    ), _(
      Number.isInteger(Number(n?.frameCount)) && Number(n.frameCount) > 0,
      `Factory bank catalog table ${i} must provide a positive frameCount`
    ), _(
      typeof n?.sourceWav == "string" && n.sourceWav.length > 0,
      `Factory bank catalog table ${i} must provide sourceWav`
    );
  }), e;
}
const ln = 2048, Ze = 11, dn = 256;
function T(t, e) {
  if (!t)
    throw new Error(e);
}
function cn(t) {
  return t > 0 && (t & t - 1) === 0;
}
const xe = /* @__PURE__ */ new Map();
function un(t) {
  const e = xe.get(t);
  if (e)
    return e;
  const n = Math.round(Math.log2(t)), i = new Uint32Array(t);
  for (let a = 0; a < t; a += 1) {
    let r = 0, l = a;
    for (let d = 0; d < n; d += 1)
      r = r << 1 | l & 1, l >>= 1;
    i[a] = r;
  }
  return xe.set(t, i), i;
}
function et(t, e, n = !1) {
  const i = t.length;
  T(i === e.length, "FFT real and imaginary buffers must have the same length"), T(cn(i), "FFT input length must be a power of two");
  const a = un(i);
  for (let r = 0; r < i; r += 1) {
    const l = a[r];
    if (l <= r)
      continue;
    const d = t[r];
    t[r] = t[l], t[l] = d;
    const o = e[r];
    e[r] = e[l], e[l] = o;
  }
  for (let r = 2; r <= i; r <<= 1) {
    const l = r >> 1, d = (n ? 2 : -2) * Math.PI / r, o = Math.cos(d), s = Math.sin(d);
    for (let u = 0; u < i; u += r) {
      let f = 1, h = 0;
      for (let p = 0; p < l; p += 1) {
        const v = u + p, b = v + l, C = t[b], F = e[b], M = f * C - h * F, ue = f * F + h * C, fe = t[v], he = e[v];
        t[v] = fe + M, e[v] = he + ue, t[b] = fe - M, e[b] = he - ue;
        const st = f * o - h * s;
        h = f * s + h * o, f = st;
      }
    }
  }
  if (n)
    for (let r = 0; r < i; r += 1)
      t[r] /= i, e[r] /= i;
}
function tt(t) {
  const e = ArrayBuffer.isView(t) ? t : Float32Array.from(t);
  let n = 0;
  for (let r = 0; r < e.length; r += 1)
    n += Number(e[r]) || 0;
  const i = n / Math.max(1, e.length), a = new Float32Array(e.length);
  for (let r = 0; r < e.length; r += 1)
    a[r] = (Number(e[r]) || 0) - i;
  return a;
}
function fn(t, {
  expectedFrameCount: e,
  samplesPerFrame: n = ln,
  maxFramesPerTable: i = dn
} = {}) {
  const a = Float32Array.from(t);
  T(a.length % n === 0, `Source wavetable files must contain a whole number of ${n}-sample frames`);
  const r = a.length / n;
  T(r > 0, "Source wavetable files must contain at least one frame"), T(r <= i, `Source wavetable files must contain at most ${i} frames`), e !== void 0 && T(r === e, `Source wavetable frame count mismatch: expected ${e}, got ${r}`);
  const l = [];
  for (let d = 0; d < r; d += 1) {
    const o = d * n, s = o + n;
    l.push(tt(a.slice(o, s)));
  }
  return {
    frameCount: r,
    frames: l
  };
}
function Te(t) {
  const e = tt(t), n = Float64Array.from(e), i = new Float64Array(n.length);
  return et(n, i, !1), n[0] = 0, i[0] = 0, {
    real: n,
    imaginary: i
  };
}
function hn(t, e, {
  mipLevelCount: n = Ze
} = {}) {
  const i = t?.real?.length ?? 0;
  T(i > 0, "Spectrum must contain real samples"), T(i === t.imaginary.length, "Spectrum real and imaginary buffers must have the same length"), T(e >= 0 && e < n, `Mip index must stay inside [0, ${n - 1}]`);
  const a = Math.min(1 << e, i >> 1), r = new Float64Array(i), l = new Float64Array(i);
  for (let d = 1; d <= a; d += 1) {
    r[d] = t.real[d], l[d] = t.imaginary[d];
    const o = (i - d) % i;
    o !== d && (r[o] = t.real[o], l[o] = t.imaginary[o]);
  }
  return et(r, l, !0), Float32Array.from(r);
}
const se = ["A", "B", "C"], nt = [
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
], mn = [
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
  "filterMix"
], D = Object.freeze([
  { id: "mseg-1", sourceKind: "mseg", sourceSlot: 1, group: "voice", runtimeIndex: 0 },
  { id: "mseg-2", sourceKind: "mseg", sourceSlot: 2, group: "voice", runtimeIndex: 1 },
  { id: "mseg-3", sourceKind: "mseg", sourceSlot: 3, group: "voice", runtimeIndex: 2 },
  { id: "env-1", sourceKind: "env", sourceSlot: 1, group: "voice", runtimeIndex: 3 },
  { id: "env-2", sourceKind: "env", sourceSlot: 2, group: "voice", runtimeIndex: 4 },
  { id: "env-3", sourceKind: "env", sourceSlot: 3, group: "voice", runtimeIndex: 5 },
  { id: "macro-1", sourceKind: "macro", sourceSlot: 1, group: "macro", runtimeIndex: 0 },
  { id: "macro-2", sourceKind: "macro", sourceSlot: 2, group: "macro", runtimeIndex: 1 },
  { id: "macro-3", sourceKind: "macro", sourceSlot: 3, group: "macro", runtimeIndex: 2 },
  { id: "macro-4", sourceKind: "macro", sourceSlot: 4, group: "macro", runtimeIndex: 3 },
  { id: "velocity", sourceKind: "velocity", sourceSlot: null, group: "voice", runtimeIndex: 6 },
  { id: "pressure", sourceKind: "pressure", sourceSlot: null, group: "voice", runtimeIndex: 7 },
  { id: "slide", sourceKind: "slide", sourceSlot: null, group: "voice", runtimeIndex: 8 }
]), pn = Object.freeze([
  ...se.flatMap((t) => nt.map(
    (e) => `osc${t}.${e}`
  )),
  ...mn
]);
new Set(
  se.flatMap((t) => nt.map(
    (e) => `osc${t}.${e}`
  ))
);
const it = Object.freeze(
  pn.map((t, e) => ({ kind: t, group: "voice", runtimeIndex: e }))
), gn = Be().filter((t) => t.modulationTargetIndex !== null), In = [
  "globalFilter",
  "distortion",
  "ott",
  "chorus",
  "flanger",
  "phaser",
  "delay",
  "reverb"
];
function le(t) {
  const e = bn(t);
  if (e === null)
    throw new Error(`Effect endpoint has no device-type prefix: ${t}`);
  return e;
}
function bn(t) {
  const e = In.find((n) => t.startsWith(n));
  return e === void 0 ? null : `lane.${e}#1.${t}`;
}
const rt = Object.freeze(
  gn.map((t) => ({
    // SAFETY: The preceding filter proves the authored index is non-null; endpoint IDs
    // and indexes are both minted only by the rack descriptor catalog.
    kind: le(t.endpointID),
    group: "rack",
    runtimeIndex: t.modulationTargetIndex
  })).sort((t, e) => t.runtimeIndex - e.runtimeIndex)
), A = Object.freeze([
  ...it,
  ...rt
]), $ = D.length, vn = it.length, Sn = rt.length, yn = $ * A.length, xn = new Map(D.map((t) => [t.id, t])), Tn = new Map(D.map((t) => [
  `${t.sourceKind}:${t.sourceSlot ?? 0}`,
  t
])), Rn = new Map(A.map((t) => [t.kind, t]));
function En() {
  if ($ !== 13 || vn !== 51 || Sn !== 36 || yn !== 1131)
    throw new Error("Unexpected modulation domain size");
  for (const [t, e] of [["voice", 9], ["macro", 4]]) {
    const n = D.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, a) => i.runtimeIndex !== a))
      throw new Error(`Bad modulation ${t} source indexes`);
  }
  for (const [t, e] of [["voice", 51], ["rack", 36]]) {
    const n = A.filter((i) => i.group === t);
    if (n.length !== e || n.some((i, a) => i.runtimeIndex !== a))
      throw new Error(`Bad modulation ${t} target indexes`);
  }
  if (xn.size !== $ || Tn.size !== $ || Rn.size !== A.length)
    throw new Error("Modulation identities must be unique");
}
En();
const An = /* @__PURE__ */ new Map([
  ["globalFilter", ["globalFilterCutoff", "globalFilterResonance", "globalFilterDrive"]],
  ["distortion", ["distortionDriveDb", "distortionKnee", "distortionWet", "distortionWetHPHz", "distortionWetLPHz"]],
  ["ott", ["ottMix", "ottAmount", "ottTimePercent", "ottBandDrive", "ottEnvelopeMatch"]],
  ["chorus", ["chorusMix", "chorusTone", "chorusFeedback", "chorusRingAmount", "chorusRingFineSemitones"]],
  ["flanger", ["flangerRate", "flangerDepth", "flangerFeedback", "flangerMix"]],
  ["phaser", ["phaserRate", "phaserDepth", "phaserFrequency", "phaserFeedback", "phaserPhase", "phaserMix"]],
  ["delay", ["delayTime", "delayFeedback", "delayFilter", "delayMix"]],
  ["reverb", ["reverbSize", "reverbDecay", "reverbDamping", "reverbMix"]]
]), wn = /^lane\.([a-zA-Z]+)#([1-9][0-9]*)\.([A-Za-z0-9]+)$/;
function Dn(t) {
  if (typeof t != "string")
    return null;
  const e = wn.exec(t);
  if (e === null)
    return null;
  const n = e[1], i = An.get(n);
  if (i === void 0)
    return null;
  const a = e[3];
  return i.includes(a) ? {
    instanceId: `${n}#${e[2]}`,
    deviceType: n,
    endpointID: a
  } : null;
}
function Mn(t) {
  return `lane.${t.deviceType}#1.${t.endpointID}`;
}
function Ln(t) {
  return Number(t.instanceId.slice(t.instanceId.indexOf("#") + 1));
}
D.filter((t) => t.group === "voice").length;
D.filter((t) => t.group === "macro").length;
function kn(t) {
  throw new Error(`Unhandled case: ${JSON.stringify(t)}`);
}
function Cn(t) {
  throw new Error(t ?? "Invariant violated");
}
function P(t, e, n, i, a = "percent", r = null) {
  return { id: t, label: e, initialPercent: n, defaultPercent: i, format: a, compound: r };
}
const _n = [
  {
    moduleId: "voice-filter",
    workspace: "voice",
    quickParameterId: "cutoff",
    parameters: [
      // Initial values mirror the authoritative Cmajor parameter defaults:
      // 1000 Hz and Q 0.707107. The retired UI patch-value bag used to
      // overwrite these after boot, which made editor-open and headless
      // instances start from different sounds.
      P("cutoff", "Cutoff", 56.63233347786729, 70, "frequency"),
      P("resonance", "Resonance", 36.91760377573153, 0),
      // Initial 100% mirrors the engine's back-compat filterMix default 1.0.
      P("mix", "Mix", 100, 100),
      P("drive", "Drive", 15, 0)
    ]
  }
], Re = 1e-6;
function k(t, e) {
  if (!Number.isFinite(t) || t < -Re || t > 1 + Re)
    throw new RangeError(`${e} produced non-normalized value ${t}`);
  return Math.min(1, Math.max(0, t));
}
function z(t, e) {
  return k(t / 100, `${e} catalog percentage`);
}
function de(t, e) {
  if (e.length === 0 || e.includes("."))
    throw new Error(`Invalid catalog parameter id "${e}"`);
  return `${t}.${e}`;
}
function Fn(t) {
  return 20 * 1e3 ** t;
}
function Nn(t) {
  return k(Math.log(t / 20) / Math.log(1e3), "filterCutoff endpoint conversion");
}
function Pn(t) {
  return 0.1 * 200 ** t;
}
function On(t) {
  return k(Math.log(t / 0.1) / Math.log(200), "filterQ endpoint conversion");
}
function Un(t) {
  return t;
}
function $n(t) {
  return k(t, "filterMix endpoint conversion");
}
function B(t, e, n) {
  return { _tag: "endpoint", endpointId: t, toEngine: e, fromEngine: n };
}
function Bn(t, e) {
  switch (t) {
    case "voice-filter.cutoff":
      return {
        binding: B("filterCutoff", Fn, Nn),
        articulationParameterId: "filterCutoffHz",
        modulationTargetKind: "filterCutoffOctaves"
      };
    case "voice-filter.resonance":
      return {
        binding: B("filterQ", Pn, On),
        articulationParameterId: "filterQ",
        modulationTargetKind: "filterQ"
      };
    case "voice-filter.mix":
      return {
        binding: B("filterMix", Un, $n),
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
function at(t) {
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
      return kn(t);
  }
}
function Kn(t) {
  return t.kind === "frequency" ? { min: -6, max: 6, unit: "oct", digits: 1 } : t.kind === "semitone" ? { min: -48, max: 48, unit: "st", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Vn(t, e) {
  const n = de(t.moduleId, e.id), i = at(e.format), a = Bn(n, t.workspace);
  return Object.freeze({
    targetId: n,
    moduleId: t.moduleId,
    workspace: t.workspace,
    label: e.label,
    defaultValue: z(e.defaultPercent, n),
    initialValue: z(e.initialPercent, n),
    format: i,
    modAmount: Kn(i),
    binding: a.binding,
    isQuick: t.quickParameterId === e.id,
    compound: e.compound,
    articulationParameterId: a.articulationParameterId,
    modulationTargetKind: a.modulationTargetKind
  });
}
const zn = [
  { targetIdSuffix: "framePosition", parameterKind: "wavetablePosition", label: "Index", initialPercent: 44, defaultPercent: 0, format: "percent", isQuick: !0 },
  { targetIdSuffix: "warpAmount", parameterKind: "warpAmount", label: "Warp", initialPercent: 58, defaultPercent: 50, format: "percent" },
  { targetIdSuffix: "pitchSemitones", parameterKind: "pitchSemitones", label: "Tune", initialPercent: 50, defaultPercent: 50, format: "semitone" },
  { targetIdSuffix: "volumeDb", parameterKind: "ampGainDb", label: "Level", initialPercent: 80, defaultPercent: 80, format: "percent" },
  { targetIdSuffix: "pan", parameterKind: "pan", label: "Pan", initialPercent: 50, defaultPercent: 50, format: "signed" },
  { targetIdSuffix: "unisonDetune", parameterKind: "unisonDetune", label: "Unison", initialPercent: 35, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonBlend", parameterKind: "unisonBlend", label: "Uni Blend", initialPercent: 75, defaultPercent: 75, format: "percent" },
  { targetIdSuffix: "unisonWidth", parameterKind: "unisonWidth", label: "Uni Width", initialPercent: 100, defaultPercent: 100, format: "percent" },
  { targetIdSuffix: "unisonWavetablePositionSpread", parameterKind: "unisonWavetablePositionSpread", label: "Uni WT Spread", initialPercent: 0, defaultPercent: 0, format: "percent" },
  { targetIdSuffix: "unisonWarpSpread", parameterKind: "unisonWarpSpread", label: "Uni Warp Spread", initialPercent: 0, defaultPercent: 0, format: "percent" }
];
function Wn(t) {
  return t === "pitchSemitones" ? { min: -48, max: 48, unit: "st", digits: 0 } : t === "ampGainDb" ? { min: -48, max: 6, unit: "dB", digits: 0 } : t === "pan" ? { min: -100, max: 100, unit: "pan", digits: 0 } : { min: -100, max: 100, unit: "%", digits: 0 };
}
function Hn(t, e) {
  const n = `osc${t}`, i = de(n, e.targetIdSuffix);
  return Object.freeze({
    targetId: i,
    moduleId: n,
    workspace: "voice",
    label: e.label,
    defaultValue: z(e.defaultPercent, i),
    initialValue: z(e.initialPercent, i),
    format: at(e.format),
    modAmount: Wn(e.parameterKind),
    binding: { _tag: "unbacked", reason: "no-endpoint" },
    isQuick: e.isQuick === !0,
    compound: null,
    articulationParameterId: null,
    modulationTargetKind: `${n}.${e.parameterKind}`
  });
}
const qn = Object.freeze(
  se.flatMap((t) => zn.map((e) => Hn(t, e)))
), Gn = Object.freeze([
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
  { moduleId: "env3", targetIdSuffix: "release", endpointID: "env3Release", targetKind: "env3Release", label: "ENV 3 Release", min: 1e-3, max: 10, initial: 0.2, format: "time", articulationParameterId: "env3.releaseSeconds" }
]);
function jn(t) {
  const e = de(t.moduleId, t.targetIdSuffix), n = t.max - t.min, i = (r) => t.min + n * r, a = (r) => k(
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
const Jn = Object.freeze(
  Gn.map(jn)
);
function Qn(t) {
  return `${t.effectId}.${t.endpointID}`;
}
function G(t, e) {
  const n = t.scale === "log" ? Math.log(e / t.min) / Math.log(t.max / t.min) : (e - t.min) / (t.max - t.min);
  return k(n, `${t.endpointID} endpoint conversion`);
}
function Yn(t, e) {
  return t.scale === "log" ? t.min * (t.max / t.min) ** e : t.min + (t.max - t.min) * e;
}
function Xn(t) {
  return t.unit === "Hz" ? { kind: "frequency", minHz: t.min, maxHz: t.max } : t.unit === "deg" ? { kind: "phase" } : t.unit === "st" ? { kind: "semitone", span: Math.max(Math.abs(t.min), Math.abs(t.max)) } : t.min < 0 && t.max > 0 ? { kind: "signed-percent" } : { kind: "percent" };
}
function Zn(t) {
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
function ei(t) {
  const e = Qn(t);
  return Object.freeze({
    targetId: e,
    moduleId: t.effectId,
    workspace: "effects",
    label: t.label,
    defaultValue: G(t, t.initial),
    initialValue: G(t, t.initial),
    format: Xn(t),
    modAmount: Zn(t),
    binding: {
      _tag: "endpoint",
      endpointId: t.endpointID,
      toEngine: (n) => Yn(t, n),
      fromEngine: (n) => G(t, n)
    },
    isQuick: t.quick,
    compound: t.endpointID === "phaserRate" || t.endpointID === "delayTime" ? "sync" : null,
    articulationParameterId: null,
    modulationTargetKind: t.modulationTargetIndex === null ? null : le(t.endpointID)
  });
}
const ce = Object.freeze(
  [
    ...W.flatMap((t) => t.parameters.map(ei)),
    ...qn,
    ...Jn,
    ..._n.flatMap(
      (t) => t.parameters.map(
        (e) => Vn(t, e)
      )
    )
  ]
), ti = new Map(
  ce.map((t) => [t.targetId, t])
), ot = ce.filter(
  (t) => t.modulationTargetKind !== null
), ie = new Map(
  ot.flatMap((t) => t.modulationTargetKind === null ? [] : [[t.modulationTargetKind, t]])
);
if (ti.size !== ce.length)
  throw new Error("Target descriptor IDs must be unique");
if (ot.length !== A.length || ie.size !== A.length || A.some((t) => ie.get(t.kind)?.modulationTargetKind !== t.kind))
  throw new Error("Every canonical modulation target must have one exact display descriptor");
function j(t) {
  const e = ie.get(t);
  return e === void 0 ? Cn(`Modulation target "${t}" has no display descriptor`) : e;
}
new Map(
  W.map((t) => [t.id, t.label])
);
function ni(t) {
  const e = Ln(t);
  return e === 1 ? "" : ` ${e}`;
}
function ii(t) {
  const e = /^osc([ABC])\.(.+)$/.exec(t);
  if (e !== null) {
    const i = j(t);
    return `${e[1]} ${i.label.toUpperCase()}`;
  }
  const n = Dn(t);
  if (n !== null) {
    const i = j(Mn(n));
    return `${i.moduleId.toUpperCase()}${ni(n)} ${i.label.toUpperCase()}`;
  }
  return j(t).label.toUpperCase();
}
const ri = Be().filter((t) => t.modulationTargetIndex !== null), ai = new Map(
  ri.map((t) => [le(t.endpointID), t])
), oi = {
  "mseg-1": "MSEG 1",
  "mseg-2": "MSEG 2",
  "mseg-3": "MSEG 3",
  "env-1": "ENV 1",
  "env-2": "ENV 2",
  "env-3": "ENV 3",
  velocity: "VEL",
  pressure: "AT",
  slide: "SLIDE",
  "macro-1": "MACRO 1",
  "macro-2": "MACRO 2",
  "macro-3": "MACRO 3",
  "macro-4": "MACRO 4"
};
D.map((t) => ({
  value: t.id,
  label: oi[t.id],
  sourceKind: t.sourceKind,
  sourceSlot: t.sourceSlot
}));
const si = A.map((t) => ({
  value: t.kind,
  label: ii(t.kind)
}));
si.filter((t) => !li(t.value));
function li(t) {
  return ai.has(t);
}
const di = [
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
], ci = [
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
  "env3.releaseSeconds"
];
Object.fromEntries(
  di.map((t, e) => [t, 2 ** e])
);
Object.fromEntries(
  ci.map((t, e) => [t, 2 ** e])
);
const ui = "runtimeSyncRequest", fi = 2147483647, hi = "runtimeState", mi = "retryDesiredTableRequest", pi = "workerLoadFailure", gi = "serviceLoadAbort", Ii = "wavetableLoadBegin", bi = "wavetableMipFrame", vi = "wavetableUploadAck", Si = "wavetableMipRequest", yi = "wavetablePrewarmRequest", xi = "wavetablePrewarmNotification", Ti = "assets/factory-bank-catalog.json", re = 3, Ri = 1, Ei = re * U, Ai = 1, wi = 2, Di = 3, Mi = 1, Li = 2, ki = 2e4, O = Ai, Ci = wi, Ee = Di, w = Mi, Ae = Li, _i = 48 * 1024 * 1024, J = 3;
function we(t, e) {
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
function De(t) {
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
function Me(t, e, n) {
  const i = t + e;
  return t === 0 || i === n || i % 16 === 0;
}
function Le(t, e) {
  if (!t)
    throw new Error(e);
}
function Fi(t, e, n) {
  return Math.min(Math.max(t, e), n);
}
async function Ni(t, e) {
  return sn(await t.readJSON(e));
}
function Pi(t) {
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
function Oi(t, e) {
  const n = Math.round(Number(t) || 0);
  return Fi(n, 0, Math.max(0, e - 1));
}
function Q(t, e, n, i, a) {
  return `${t}:${e}:${n}:${i}:${a}`;
}
function Ui(t, e, n) {
  return [
    t.tableId,
    t.sourceWav,
    e,
    n
  ].join("|");
}
function ke(t) {
  let e = 0;
  for (const n of t.frames)
    e += n.byteLength;
  for (const n of t.spectra)
    n && (e += n.real.byteLength + n.imaginary.byteLength);
  return e;
}
function Ce(t) {
  return {
    nextFrameIndex: 0,
    ackedFrames: new Uint8Array(t),
    ackedFrameCount: 0,
    inFlightBatchBases: /* @__PURE__ */ new Set()
  };
}
function _e() {
  return typeof globalThis.performance?.now == "function" ? globalThis.performance.now() : Date.now();
}
function $i(t) {
  if (typeof globalThis.queueMicrotask == "function") {
    globalThis.queueMicrotask(t);
    return;
  }
  Promise.resolve().then(t);
}
class Bi {
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
    this.connection = e, this.resourceClient = on(n.resourceClient ?? e), this.catalogPath = n.catalogPath ?? Ti, this.maxBatchesInFlight = we(
      n.maxFramesInFlight,
      Ri
    ), this.mipLevelCount = n.mipLevelCount ?? Ze, this.cacheBudgetBytes = Math.max(0, Math.round(Number(n.cacheBudgetBytes ?? _i) || 0)), this.serviceLoadTimeoutMs = we(n.serviceLoadTimeoutMs, ki), this.setTimeoutFn = typeof n.setTimeoutFn == "function" ? n.setTimeoutFn : globalThis.setTimeout?.bind(globalThis) ?? null, this.clearTimeoutFn = typeof n.clearTimeoutFn == "function" ? n.clearTimeoutFn : globalThis.clearTimeout?.bind(globalThis) ?? null, this.handleRuntimeState = this.handleRuntimeState.bind(this), this.handleUploadAck = this.handleUploadAck.bind(this), this.handleMipRequest = this.handleMipRequest.bind(this), this.handlePrewarmRequest = this.handlePrewarmRequest.bind(this);
  }
  async start() {
    return this.started ? this : (this.started = !0, g("info", "Starting wavetable worker controller", {
      catalogPath: this.catalogPath,
      maxFramesInFlight: this.maxBatchesInFlight,
      mipLevelCount: this.mipLevelCount,
      cacheBudgetBytes: this.cacheBudgetBytes,
      serviceLoadTimeoutMs: this.serviceLoadTimeoutMs
    }), this.connection.addEndpointListener?.(hi, this.handleRuntimeState), this.connection.addEndpointListener?.(vi, this.handleUploadAck), this.connection.addEndpointListener?.(Si, this.handleMipRequest), this.connection.addEndpointListener?.(yi, this.handlePrewarmRequest), this.connection.addEndpointListener?.(xi, this.handlePrewarmRequest), this.connection.sendEventOrValue?.(
      ui,
      fi
    ), this);
  }
  async ensureCatalogLoaded() {
    return this.catalog || (this.catalog = await Ni(this.resourceClient, this.catalogPath), g("info", "Loaded wavetable catalog", {
      catalogPath: this.catalogPath,
      tableCount: this.catalog.tables.length
    })), this.catalog;
  }
  resetSessionState(e) {
    this.knownSessionId = e.dspSessionId, this.pendingRuntimeStateOscillators.clear();
    for (let n = 0; n < J; n += 1)
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
    this.tableCacheBytes -= e.byteCount, e.byteCount = ke(e), e.lastUsedSerial = this.cacheUseSerial++, this.tableCacheBytes += e.byteCount, this.evictCacheIfNeeded();
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
      byteCount: ke(e),
      lastUsedSerial: this.cacheUseSerial++
    };
    return this.tableCache.set(i.cacheKey, i), this.tableCacheBytes += i.byteCount, this.evictCacheIfNeeded(), i;
  }
  createFullMipJobsForServiceTable(e = 2) {
    if (!(!this.serviceTable || this.serviceTable.mode !== "loading"))
      for (let n = 0; n < this.mipLevelCount; n += 1) {
        const i = Q(
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
          ...Ce(this.serviceTable.frameCount),
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
      this.serviceLoadWatchdogHandle = null, !(!this.serviceTable || this.serviceTable.mode !== "loading" || this.serviceTable.dspSessionId !== e || this.serviceTable.oscillatorIndex !== n || this.serviceTable.generation !== i || this.serviceTable.tableIndex !== a || !this.serviceLoadHasPendingTransfers()) && (g("error", "Timed out waiting for wavetable mip upload acknowledgements", {
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
          failurePhase: Ee,
          failureReasonCode: Ae
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
    return !e.hasFailure || e.failedTableIndex !== e.desiredTableIndex || e.failurePhase !== Ee || e.failureReasonCode !== Ae ? !1 : this.autoRetryConsumedKeys[e.oscillatorIndex] !== this.getDesiredRetryKey(e);
  }
  emitWorkerLoadFailure({
    dspSessionId: e,
    oscillatorIndex: n,
    tableIndex: i,
    generation: a = 0,
    candidateAttemptSerial: r = 0,
    failurePhase: l = O,
    failureReasonCode: d = w
  }) {
    this.connection.sendEventOrValue?.(pi, {
      dspSessionId: e,
      oscillatorIndex: n,
      tableIndex: i,
      generation: a,
      candidateAttemptSerial: r,
      failurePhase: l,
      failureReasonCode: d
    });
  }
  emitServiceLoadAbort({
    dspSessionId: e,
    oscillatorIndex: n,
    generation: i,
    tableIndex: a,
    failureReasonCode: r = w
  }) {
    this.connection.sendEventOrValue?.(gi, {
      dspSessionId: e,
      oscillatorIndex: n,
      generation: i,
      tableIndex: a,
      failureReasonCode: r
    });
  }
  emitRetryDesiredTableRequest(e) {
    g("warn", "Requesting retry for failed desired wavetable load", {
      latestRuntimeState: this.latestRuntimeStates[e] ? De(this.latestRuntimeStates[e]) : null
    }), this.connection.sendEventOrValue?.(mi, e);
  }
  async loadTableSource(e, n) {
    const i = await this.ensureCatalogLoaded(), a = Oi(e, i.tables.length), r = i.tables[a];
    Le(r, `Could not resolve table ${a}`);
    const l = Ui(r, U, this.mipLevelCount), d = this.tableCache.get(l);
    if (d)
      return d.lastUsedSerial = this.cacheUseSerial++, g("info", "Using cached wavetable source table", {
        tableIndex: a,
        tableId: r.tableId,
        tableName: r.name,
        sourceWav: r.sourceWav,
        frameCount: d.frameCount,
        cacheBytes: this.tableCacheBytes
      }), d;
    const o = _e();
    g("info", "Reading wavetable source", {
      tableIndex: a,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      loaderMode: "resource-client",
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n
    });
    const s = await this.resourceClient.readAudio(r.sourceWav), u = fn(s.samples, {
      expectedFrameCount: n === void 0 ? Number(r.frameCount) : n,
      samplesPerFrame: U
    });
    return g("info", "Prepared wavetable source table", {
      tableIndex: a,
      tableId: r.tableId,
      tableName: r.name,
      sourceWav: r.sourceWav,
      frameCount: u.frameCount,
      loadDurationMs: Math.round(_e() - o)
    }), this.rememberLoadedTable({
      cacheKey: l,
      tableIndex: a,
      tableMeta: r,
      frameCount: u.frameCount,
      frames: u.frames,
      spectra: new Array(u.frameCount)
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
    }, this.nextLoadGenerations[e.oscillatorIndex] = n + 1, this.clearMipTransferState(), this.connection.sendEventOrValue?.(Ii, {
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
      failurePhase: O,
      failureReasonCode: w
    }), this.emitWorkerLoadFailure({
      dspSessionId: e.dspSessionId,
      oscillatorIndex: e.oscillatorIndex,
      tableIndex: e.desiredTableIndex,
      generation: 0,
      candidateAttemptSerial: e.desiredIntentSerial,
      failurePhase: O,
      failureReasonCode: w
    });
  }
  handleServiceTargetFailure(e, {
    failurePhase: n = O,
    failureReasonCode: i = w
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
      const r = this.candidateValidations[e.oscillatorIndex];
      return r && r.dspSessionId === e.dspSessionId && r.generation === e.generation && r.tableIndex === e.tableIndex && (this.candidateValidations[e.oscillatorIndex] = null), !0;
    }
    let i = null;
    try {
      i = await this.loadTableSource(e.tableIndex);
    } catch (r) {
      return this.isCurrentRuntimeState(n) && (g("error", "Could not reload committed service wavetable source", {
        kind: e.kind,
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        detail: Y(r)
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
      this.isCurrentRuntimeState(e) && (g("error", "Could not prepare desired wavetable source", {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        desiredIntentSerial: e.desiredIntentSerial,
        tableIndex: n,
        detail: Y(l)
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
    for (let e = 0; e < J; e += 1)
      if (this.pendingRuntimeStateOscillators.has(e))
        return e;
    return null;
  }
  scheduleRuntimeStateDrain() {
    !this.started || this.runtimeStateDrainRunning || this.runtimeStateDrainScheduled || this.selectPendingRuntimeStateOscillator() === null || (this.runtimeStateDrainScheduled = !0, $i(() => {
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
        g("warn", "Aborting obsolete wavetable load because the desired table changed", {
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
          failureReasonCode: w
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
    const n = Pi(e ?? {});
    if (g("info", "Received runtime state", De(n)), n.dspSessionId <= 0 || n.oscillatorIndex < 0 || n.oscillatorIndex >= J)
      return;
    const i = n.dspSessionId !== this.knownSessionId;
    i && this.resetSessionState(n);
    const a = n.oscillatorIndex, r = this.latestRuntimeStates[a], l = r ? this.getDesiredRetryKey(r) : null, d = this.getDesiredRetryKey(n);
    this.nextLoadGenerations[a] = Math.max(
      this.nextLoadGenerations[a] ?? 1,
      n.generationFrontier + 1
    ), (i || l !== d) && (this.autoRetryConsumedKeys[a] = null), this.latestRuntimeStates[a] = n, this.pendingRuntimeStateOscillators.add(a), this.scheduleRuntimeStateDrain();
  }
  async handlePrewarmRequest(e) {
    const n = e !== null && typeof e == "object" && !Array.isArray(e) ? e : null, i = Math.trunc(Number(n?.tableIndex ?? e));
    if (Number.isFinite(i))
      try {
        const a = await this.loadTableSource(i);
        for (let l = 0; l < a.frameCount; l += 1)
          a.spectra[l] || (a.spectra[l] = Te(a.frames[l]));
        const r = this.tableCache.get(a.cacheKey);
        r && this.refreshCacheEntryByteCount(r), g("info", "Prewarmed wavetable source table", {
          tableIndex: a.tableIndex,
          tableId: a.tableMeta.tableId,
          tableName: a.tableMeta.name,
          reason: typeof n?.reason == "string" ? n.reason : null,
          cacheBytes: this.tableCacheBytes
        });
      } catch (a) {
        g("warn", "Ignoring wavetable prewarm failure", {
          tableIndex: i,
          reason: typeof n?.reason == "string" ? n.reason : null,
          detail: Y(a)
        });
      }
  }
  getOrCreateMipJob(e) {
    const n = Math.trunc(Number(e?.dspSessionId)), i = Math.trunc(Number(e?.oscillatorIndex)), a = Math.trunc(Number(e?.generation)), r = Math.trunc(Number(e?.tableIndex)), l = Math.trunc(Number(e?.mipIndex)), d = Math.trunc(Number(e?.urgencyLevel) || 0);
    if (!this.serviceTable || n !== this.serviceTable.dspSessionId || i !== this.serviceTable.oscillatorIndex || a !== this.serviceTable.generation || r !== this.serviceTable.tableIndex || l < 0 || l >= this.mipLevelCount)
      return null;
    const o = Q(
      n,
      i,
      a,
      r,
      l
    );
    let s = this.mipJobs.get(o);
    return s ? (!s.completed && d > s.urgencyLevel && (s.urgencyLevel = d), s) : (s = {
      key: o,
      dspSessionId: n,
      oscillatorIndex: i,
      generation: a,
      tableIndex: r,
      mipIndex: l,
      urgencyLevel: d,
      ...Ce(this.serviceTable.frameCount),
      completed: !1
    }, this.mipJobs.set(o, s), s);
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
    const n = e ?? {}, i = Math.trunc(Number(n.dspSessionId)), a = Math.trunc(Number(n.oscillatorIndex)), r = Math.trunc(Number(n.generation)), l = Math.trunc(Number(n.tableIndex)), d = Math.trunc(Number(n.mipIndex)), o = Math.trunc(Number(n.frameIndexBase)), s = Math.trunc(Number(n.frameCount)), u = Q(
      i,
      a,
      r,
      l,
      d
    ), f = this.mipJobs.get(u), h = this.serviceTable?.frameCount ?? 0, p = Math.min(
      re,
      h - o
    );
    if (!(!f || f.completed || !f.inFlightBatchBases.has(o) || s <= 0 || s !== p)) {
      f.inFlightBatchBases.delete(o);
      for (let v = 0; v < s; v += 1) {
        const b = o + v;
        f.ackedFrames[b] || (f.ackedFrames[b] = 1, f.ackedFrameCount += 1);
      }
      f.ackedFrameCount === h && f.nextFrameIndex >= h && f.inFlightBatchBases.size === 0 && (f.completed = !0, this.activeUploadKey === f.key && (this.activeUploadKey = null)), Me(o, s, h) && g("info", "Acknowledged wavetable mip batch", {
        dspSessionId: i,
        oscillatorIndex: a,
        generation: r,
        tableIndex: f.tableIndex,
        mipIndex: d,
        frameIndexBase: o,
        batchFrameCount: s,
        ackedFrameCount: f.ackedFrameCount,
        frameCount: h,
        inFlightBatches: f.inFlightBatchBases.size
      }), this.armServiceLoadWatchdog(), this.pumpUploads();
    }
  }
  getSpectrumForFrame(e) {
    if (Le(this.serviceTable, "Current table must exist before building a spectrum"), !this.serviceTable.spectra[e]) {
      this.serviceTable.spectra[e] = Te(this.serviceTable.frames[e]);
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
        re,
        this.serviceTable.frameCount - n
      ), a = new Float32Array(Ei);
      try {
        for (let r = 0; r < i; r += 1) {
          const l = n + r, d = this.getSpectrumForFrame(l), o = hn(d, e.mipIndex);
          a.set(o, r * U);
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
            failurePhase: Ci,
            failureReasonCode: w
          }
        ), this.serviceTable = null, this.clearMipTransferState(), this.scheduleRuntimeStateDrain();
        return;
      }
      this.connection.sendEventOrValue?.(bi, {
        dspSessionId: e.dspSessionId,
        oscillatorIndex: e.oscillatorIndex,
        generation: e.generation,
        tableIndex: e.tableIndex,
        mipIndex: e.mipIndex,
        frameIndexBase: n,
        frameCount: i,
        samples: Array.from(a)
      }), Me(n, i, this.serviceTable.frameCount) && g("info", "Sent wavetable mip batch", {
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
function Y(t) {
  if (t && typeof t == "object") {
    const e = t;
    return e.message || e.stack || String(t);
  }
  return String(t);
}
function Ki(t, e = {}) {
  return new Bi(t, e);
}
async function Vi(t, e = {}) {
  return ct(t, [
    Qt,
    () => Ki(t, e)
  ]);
}
export {
  Vi as default
};
